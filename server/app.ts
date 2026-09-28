import express from 'express'
import fs from 'node:fs'
import helmet from 'helmet'
import { GoogleGenAI } from '@google/genai'
import { validateServerEnvironment } from './lib/envValidation.js'
import { calculateBasePricing, PricingValidationError } from './domain/pricing.js'
import { validateAndCalculateCoupon, normalizeCouponCode } from './services/coupons.js'
import { CreateOrderRequestSchema } from './domain/orderSchema.js'
import { createOrder, OrderServiceError } from './services/orderService.js'
import { getPublicPaymentConfig } from './lib/paymentConfig.js'
import { requireAdmin } from './middleware/requireAdmin.js'
import {
  listAdminOrders,
  getAdminOrderDetail,
} from './services/adminOrderService.js'
import {
  updateOrderStatus,
  returnOrder,
  verifyBkashPayment,
  failBkashPayment,
  markCodPaid,
  getOrderAuditHistory,
  MutationConflictError,
  MutationValidationError,
  MutationNotFoundError,
  ALLOWED_ORDER_STATUSES,
} from './services/adminMutationService.js'
import { z, ZodError } from 'zod'

// Load .env if present (overwriting dummy placeholder if needed)
if (fs.existsSync('.env')) {
  try {
    const envContent = fs.readFileSync('.env', 'utf-8')
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (match) {
        const key = match[1]
        let val = (match[2] || '').trim()
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
        if (val && (process.env[key] === 'MY_GEMINI_API_KEY' || !process.env[key])) {
          process.env[key] = val
        }
      }
    }
  } catch (e) {
    console.warn('Could not parse .env file:', e)
  }
}

// 1. Validate required server environment variables at startup
validateServerEnvironment()

// Safe helper to resolve client IP accurately (respects trust proxy configuration)
export function getClientIp(req: express.Request): string {
  // When trust proxy is enabled, Express securely resolves req.ip using the trusted proxy hop(s),
  // ignoring any client-spoofed X-Forwarded-For prefixes.
  if (req.ip) {
    return req.ip
  }
  return req.socket.remoteAddress || '127.0.0.1'
}

// In-memory sliding window rate limiter to protect the Gemini Free Tier quota
interface RateLimitRecord {
  timestamps: number[]
}
const ipChatHistory = new Map<string, RateLimitRecord>()

// Clean up stale IP records every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of ipChatHistory.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < 3600000)
    if (record.timestamps.length === 0) {
      ipChatHistory.delete(ip)
    }
  }
}, 10 * 60 * 1000)

export function checkRateLimit(ip: string): { allowed: boolean; message?: string } {
  const now = Date.now()
  let record = ipChatHistory.get(ip)
  if (!record) {
    record = { timestamps: [] }
    ipChatHistory.set(ip, record)
  }

  // Prune timestamps older than 1 hour
  record.timestamps = record.timestamps.filter((ts) => now - ts < 3600000)

  // Rate limit 1: Max 8 requests per minute per IP
  const lastMinuteCount = record.timestamps.filter((ts) => now - ts < 60000).length
  if (lastMinuteCount >= 8) {
    return {
      allowed: false,
      message: 'Rate limit exceeded: You can send at most 8 messages per minute. Please pause for a moment.',
    }
  }

  // Rate limit 2: Max 30 requests per hour per IP
  if (record.timestamps.length >= 30) {
    return {
      allowed: false,
      message: 'Hourly chat limit reached for this session. Please wait or proceed to order the planner directly.',
    }
  }

  record.timestamps.push(now)
  return { allowed: true }
}

// In-memory sliding window rate limiter for POST /api/orders
// Limits order creation attempts to exactly 30 requests per minute and 100 per hour per IP
const ipOrderHistory = new Map<string, RateLimitRecord>()

export function checkOrderRateLimit(ip: string, simulatedNow?: number): { allowed: boolean; message?: string } {
  const now = simulatedNow ?? Date.now()
  let record = ipOrderHistory.get(ip)
  if (!record) {
    record = { timestamps: [] }
    ipOrderHistory.set(ip, record)
  }

  record.timestamps = record.timestamps.filter((ts) => now - ts < 3600000)

  const lastMinuteCount = record.timestamps.filter((ts) => now - ts < 60000).length
  if (lastMinuteCount >= 30) {
    return {
      allowed: false,
      message: 'Too many order requests. Please wait a moment before trying again.',
    }
  }

  if (record.timestamps.length >= 100) {
    return {
      allowed: false,
      message: 'Order creation limit reached for this IP session. Please contact support.',
    }
  }

  record.timestamps.push(now)
  return { allowed: true }
}

export function resetOrderRateLimitForTesting(ip?: string) {
  if (ip) {
    ipOrderHistory.delete(ip)
  } else {
    ipOrderHistory.clear()
  }
}

// In-memory sliding window rate limiter for admin mutations (Step 9A)
// Limits rapid automated mutation calls to 60 per minute per admin IP
const ipAdminMutationHistory = new Map<string, RateLimitRecord>()

export function checkAdminMutationRateLimit(ip: string): { allowed: boolean; message?: string } {
  const now = Date.now()
  let record = ipAdminMutationHistory.get(ip)
  if (!record) {
    record = { timestamps: [] }
    ipAdminMutationHistory.set(ip, record)
  }

  record.timestamps = record.timestamps.filter((ts) => now - ts < 60000)

  if (record.timestamps.length >= 60) {
    return {
      allowed: false,
      message: 'Too many admin mutation requests in a short period. Please wait a moment.',
    }
  }

  record.timestamps.push(now)
  return { allowed: true }
}

// Single Gemini model strictly enforced across the application
const CHAT_MODEL = 'gemini-3.1-flash-lite'
const MAX_OUTPUT_TOKENS = 300
const MAX_HISTORY_MESSAGES = 4
const MAX_PROMPT_CHARS = 400

const systemInstruction = `You are the FOCUSO Companion, a concise, calm product assistant for the FOCUSO Daily Planner.

Authoritative FOCUSO Rules:
1. Product & Pricing:
- FOCUSO Daily Planner (undated 60-day system, A5 format).
- Price: ৳250 per planner (Bangladeshi Taka).

2. Delivery Charges:
- Chattogram district: ৳60
- All other Bangladesh districts (Dhaka, Sylhet, Rajshahi, etc.): ৳100
- Delivery timeframe: An exact delivery timeframe is not currently specified in the system. Do not invent or promise any timeframe (such as 2–3 days). If asked how long delivery takes, state clearly that an exact delivery timeframe is not currently specified.

3. Coupon (FOCUS25):
- Code: FOCUS25
- Discount: 25% off the product subtotal only.
- Fractional taka discount is rounded down using Math.floor().
- Delivery charge is NEVER discounted.

4. Payment Methods & Ordering:
- Cash on Delivery (COD): Pay cash when the parcel is delivered.
- Manual bKash Send Money: Customers send money manually to the provided personal bKash number and submit the Transaction ID (TrxID) during checkout. Manual bKash payments remain in "pending verification" status until verified by an admin.
- IMPORTANT: Do NOT describe manual bKash as an official or automated "bKash Payment Gateway". It is strictly manual bKash Send Money.
- Guest Checkout: Orders are placed via instant guest checkout on the website—no customer account or password is required.

5. Product Features & Philosophy:
- Features: Monthly intentions, weekly bridges, daily planner page with hourly schedule starting from Fajr, top 3 priorities, daily task checklist, 5 daily Salah tracker, weekly habit grid, and daily Qur'an reading space.
- Philosophy: "Plan what matters. Stay consistent. Muslim by design — not by decoration."

Tone & Behavioral Rules:
- Keep answers concise, factual, polite, and helpful (under 2 short paragraphs).
- Answer questions directly from these authoritative rules.
- If asked in Bengali, reply naturally and respectfully in Bengali; if in English, reply in English.
- Do not ramble, do not write essays, and do not invent policies or timeframes not listed above.`

export const app = express()

function configureApp() {
  // 1. Trust 1 reverse proxy hop (Cloud Run / AI Studio ingress) for accurate req.ip
  app.set('trust proxy', 1)

  // 2. Remove Express identifying header
  app.disable('x-powered-by')

  // 3. Environment-aware HTTP Security Headers via Helmet:
  // - AI Studio preview / dev: Identified via process.env.APPLET_ID or process.env.AI_STUDIO_PREVIEW === 'true'.
  //   In this environment, iframe embedding inside the AI Studio web console is required, so frameguard is disabled.
  // - Real production: Identified when (process.env.NODE_ENV === 'production' && !isAiStudioPreview) or process.env.FOCUSO_ENV === 'production'.
  //   In real production (or when ENABLE_FRAMEGUARD=true), clickjacking protection is strictly enforced with X-Frame-Options: SAMEORIGIN.
  const isAiStudioPreview = Boolean(process.env.APPLET_ID || process.env.AI_STUDIO_PREVIEW === 'true')
  const isRealProduction =
    (process.env.NODE_ENV === 'production' && !isAiStudioPreview) ||
    process.env.FOCUSO_ENV === 'production'
  const enableFrameguard = isRealProduction || process.env.ENABLE_FRAMEGUARD === 'true'

  app.use(
    helmet({
      contentSecurityPolicy: false, // Don't break Vite inline scripts/HMR or dynamic assets
      crossOriginEmbedderPolicy: false,
      frameguard: enableFrameguard ? { action: 'sameorigin' } : false,
      xContentTypeOptions: true,
      dnsPrefetchControl: { allow: false },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hidePoweredBy: true,
      hsts: isRealProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    })
  )

  // 4. Global Request Body Limit (20kb) - bounds all incoming JSON payloads
  app.use(express.json({ limit: '20kb' }))

  // 5. CORS & Origin Validation for /api
  // Strictly allow only verified origins; NO broad *.run.app wildcards.
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  let trustedAppOrigin: string | null = null
  let trustedPreviewOrigin: string | null = null
  if (process.env.APP_URL) {
    try {
      trustedAppOrigin = new URL(process.env.APP_URL).origin.toLowerCase()
      trustedPreviewOrigin = trustedAppOrigin.replace('ais-dev-', 'ais-pre-')
    } catch {
      // Ignore invalid APP_URL format
    }
  }

  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin
    const host = req.headers.host || ''

    if (origin) {
      let isAllowed = false
      try {
        const originUrl = new URL(origin)
        const normalizedOrigin = originUrl.origin.toLowerCase()

        // 1. Same-host request (origin host matches the HTTP Host header)
        if (originUrl.host === host) {
          isAllowed = true
        }
        // 2. Local development loopback (localhost or 127.0.0.1)
        else if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
          isAllowed = true
        }
        // 3. Exact known AI Studio development/preview URL for this specific applet instance
        else if (trustedAppOrigin && normalizedOrigin === trustedAppOrigin) {
          isAllowed = true
        } else if (trustedPreviewOrigin && normalizedOrigin === trustedPreviewOrigin) {
          isAllowed = true
        }
        // 4. Operator-configured production allowed origins (exact domain matches)
        else if (configuredOrigins.includes(normalizedOrigin)) {
          isAllowed = true
        }
      } catch {
        isAllowed = false
      }

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        res.setHeader('Access-Control-Max-Age', '86400')
        res.setHeader('Vary', 'Origin')
      } else if (req.path.startsWith('/admin')) {
        return res.status(403).json({ error: 'Cross-origin requests to admin API are not permitted.' })
      }
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end()
    }

    next()
  })

  // 6. Admin and Sensitive API Cache Protection
  app.use('/api/admin', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    next()
  })

  // 7. Minimal Health Check Endpoint (Step 9A)
  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    return res.json({ status: 'ok' })
  })

  // Safe Public Payment Configuration Endpoint (Step 7)
  // Returns only customer-displayable payment configuration (bKash number & manual enable flag)
  app.get('/api/payment-config', (_req, res) => {
    return res.json(getPublicPaymentConfig())
  })

  // Authoritative Pricing Preview Endpoint (Step 4 / 4B)
  app.post('/api/pricing-preview', (req, res) => {
    try {
      const { quantity, deliveryZone, district } = req.body || {}
      const result = calculateBasePricing({ quantity, deliveryZone, district })
      return res.json(result)
    } catch (err: unknown) {
      if (err instanceof PricingValidationError) {
        return res.status(err.statusCode).json({
          error: err.message,
          field: err.field,
        })
      }
      return res.status(400).json({ error: 'Unable to calculate pricing.' })
    }
  })

  // Authoritative Coupon Pricing Preview Endpoint (Step 5)
  // Accepts strictly: quantity, district, couponCode
  app.post('/api/coupon-preview', async (req, res) => {
    try {
      const { quantity, district, couponCode } = req.body || {}

      // 1. Calculate authoritative base pricing (validates quantity & district)
      const basePricing = calculateBasePricing({ quantity, district })

      // 2. Normalize and validate coupon against Supabase
      const normalizedCode = normalizeCouponCode(couponCode)
      if (!normalizedCode) {
        return res.status(400).json({
          error: 'Coupon code cannot be empty.',
          field: 'couponCode',
        })
      }

      const couponResult = await validateAndCalculateCoupon(normalizedCode, basePricing.productSubtotal)

      if (!couponResult.valid) {
        return res.status(400).json({
          error: couponResult.message,
          reason: couponResult.reason,
          field: 'couponCode',
          basePricing, // Send base pricing so client retains valid base state
        })
      }

      // 3. Authoritative final total = productSubtotal - discountAmount + deliveryCharge
      const finalTotal = Math.max(0, basePricing.productSubtotal - couponResult.discountAmount + basePricing.deliveryCharge)

      return res.json({
        quantity: basePricing.quantity,
        district: basePricing.district,
        deliveryZone: basePricing.deliveryZone,
        unitPrice: basePricing.unitPrice,
        productSubtotal: basePricing.productSubtotal,
        deliveryCharge: basePricing.deliveryCharge,
        preDiscountTotal: basePricing.preDiscountTotal,
        coupon: {
          valid: true,
          code: couponResult.code,
          discountType: couponResult.discountType,
          discountValue: couponResult.discountValue,
          discountAmount: couponResult.discountAmount,
        },
        finalTotal,
      })
    } catch (err: unknown) {
      if (err instanceof PricingValidationError) {
        return res.status(err.statusCode).json({
          error: err.message,
          field: err.field,
        })
      }
      console.error('[CouponPreview] Unexpected error:', err)
      return res.status(400).json({ error: 'Unable to calculate coupon preview.' })
    }
  })

  // Authoritative Supabase Order Creation Endpoint (Step 6A)
  // Accepts strictly customer/business inputs via CreateOrderRequestSchema
  app.post('/api/orders', async (req, res) => {
    try {
      // 1. Per-IP Rate Limiting for order creations
      const clientIp = getClientIp(req)

      const rateCheck = checkOrderRateLimit(clientIp)
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: rateCheck.message,
          code: 'rate_limited',
        })
      }

      // 2. Strict Zod Schema Validation
      // Any unsupported extra keys (e.g. unitPrice, finalTotal, etc.) are strictly rejected
      const parseResult = CreateOrderRequestSchema.safeParse(req.body)
      if (!parseResult.success) {
        const issues = parseResult.error.issues
        const firstIssue = issues[0]
        return res.status(400).json({
          error: firstIssue?.message || 'Invalid order request payload.',
          field: firstIssue?.path.join('.') || 'request',
          code: 'validation_error',
        })
      }

      // 3. Process Order via Server-Authoritative Order Service
      const confirmation = await createOrder(parseResult.data)

      return res.status(confirmation.isDuplicate ? 200 : 201).json(confirmation)
    } catch (err: unknown) {
      if (err instanceof OrderServiceError) {
        return res.status(err.statusCode).json({
          error: err.message,
          code: err.code,
        })
      }

      if (err instanceof PricingValidationError) {
        return res.status(err.statusCode).json({
          error: err.message,
          field: err.field,
          code: 'pricing_error',
        })
      }

      console.error('[Orders API] Unexpected order processing failure:', err)
      return res.status(500).json({
        error: 'An unexpected error occurred while processing your order. Please try again.',
        code: 'server_error',
      })
    }
  })

  // ============================================================================
  // Step 8A: Minimal Protected Admin Identity/Session Verification Endpoint
  // Strictly authenticated and authorized via requireAdmin middleware.
  // Returns only safe admin identity fields (id, email).
  // Critical: Does NOT expose orders, payment mutations, or sensitive server credentials.
  // ============================================================================
  app.get('/api/admin/me', requireAdmin, (req, res) => {
    return res.json({
      authenticated: true,
      user: {
        id: req.adminUser!.id,
        email: req.adminUser!.email,
      },
    })
  })

  // ============================================================================
  // Step 8B: Protected Read-Only Admin Orders API Endpoints
  // Protected strictly by requireAdmin middleware.
  // Direct client queries to the orders table are never allowed.
  // ============================================================================

  // 1. GET /api/admin/orders - Paginated, searchable, filterable order list
  app.get('/api/admin/orders', requireAdmin, async (req, res) => {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20
      const search = typeof req.query.search === 'string' ? req.query.search : undefined
      const paymentMethod = typeof req.query.paymentMethod === 'string' ? req.query.paymentMethod : undefined
      const paymentStatus = typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus : undefined
      const orderStatus = typeof req.query.orderStatus === 'string' ? req.query.orderStatus : undefined
      const district = typeof req.query.district === 'string' ? req.query.district : undefined
      const from = typeof req.query.from === 'string' ? req.query.from : undefined
      const to = typeof req.query.to === 'string' ? req.query.to : undefined
      const sort = req.query.sort === 'asc' ? 'asc' : 'desc'

      const result = await listAdminOrders({
        page,
        limit,
        search,
        paymentMethod,
        paymentStatus,
        orderStatus,
        district,
        from,
        to,
        sort,
      })

      return res.json(result)
    } catch (err: any) {
      console.error('[AdminAPI] Failed to fetch orders:', err?.message || err)
      return res.status(500).json({
        error: 'Failed to retrieve orders.',
      })
    }
  })

  // 2. GET /api/admin/orders/:id - Detailed single order view
  app.get('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    try {
      const identifier = req.params.id
      if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
        return res.status(400).json({ error: 'Order identifier is required.' })
      }

      const order = await getAdminOrderDetail(identifier)
      if (!order) {
        return res.status(404).json({ error: 'Order not found.' })
      }

      return res.json({ order })
    } catch (err: any) {
      console.error('[AdminAPI] Failed to fetch order details:', err?.message || err)
      return res.status(500).json({
        error: 'Failed to retrieve order details.',
      })
    }
  })

  // 3. PATCH /api/admin/orders/:id/status - Update fulfillment order status
  const UpdateOrderStatusBodySchema = z
    .object({
      orderStatus: z.enum(ALLOWED_ORDER_STATUSES, {
        message: `orderStatus must be one of: ${ALLOWED_ORDER_STATUSES.join(', ')}`,
      }),
    })
    .strict()

  app.patch('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
    try {
      const rateCheck = checkAdminMutationRateLimit(getClientIp(req))
      if (!rateCheck.allowed) {
        return res.status(429).json({ error: rateCheck.message, code: 'rate_limited' })
      }

      const orderId = String(req.params.id)
      if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        return res.status(400).json({ error: 'Valid order UUID is required.' })
      }

      const parseResult = UpdateOrderStatusBodySchema.safeParse(req.body)
      if (!parseResult.success) {
        const issues = (parseResult.error as any).issues || (parseResult.error as any).errors || []
        return res.status(400).json({
          error: 'Invalid request body.',
          details: issues.map((e: any) => e.message),
        })
      }

      const adminUser = req.adminUser!
      const result = await updateOrderStatus(orderId, parseResult.data.orderStatus, adminUser)
      return res.json(result)
    } catch (err: any) {
      if (err instanceof MutationNotFoundError) {
        return res.status(404).json({ error: err.message })
      }
      if (err instanceof MutationConflictError) {
        return res.status(409).json({ error: err.message, code: err.code })
      }
      if (err instanceof MutationValidationError) {
        return res.status(400).json({ error: err.message, code: err.code })
      }
      console.error('[AdminAPI] Failed to update order status:', err?.message || err)
      return res.status(500).json({ error: 'Failed to update order status.' })
    }
  })

  // 4. POST /api/admin/orders/:id/return - Record a returned fulfillment outcome.
  // Payment is intentionally not accepted or modified by this endpoint.
  const ReturnOrderBodySchema = z
    .object({
      reason: z
        .string()
        .trim()
        .min(3, 'Return reason must be at least 3 characters long.')
        .max(300, 'Return reason cannot exceed 300 characters.'),
      adminNote: z
        .string()
        .trim()
        .max(500, 'Admin note cannot exceed 500 characters.')
        .optional(),
    })
    .strict()

  app.post('/api/admin/orders/:id/return', requireAdmin, async (req, res) => {
    try {
      const rateCheck = checkAdminMutationRateLimit(getClientIp(req))
      if (!rateCheck.allowed) {
        return res.status(429).json({ error: rateCheck.message, code: 'rate_limited' })
      }

      const orderId = String(req.params.id)
      if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        return res.status(400).json({ error: 'Valid order UUID is required.' })
      }

      const parseResult = ReturnOrderBodySchema.safeParse(req.body)
      if (!parseResult.success) {
        const issues = (parseResult.error as any).issues || (parseResult.error as any).errors || []
        return res.status(400).json({
          error: 'Invalid request body.',
          details: issues.map((e: any) => e.message),
        })
      }

      const result = await returnOrder(
        orderId,
        parseResult.data.reason,
        parseResult.data.adminNote,
        req.adminUser!
      )
      return res.json(result)
    } catch (err: any) {
      if (err instanceof MutationNotFoundError) {
        return res.status(404).json({ error: err.message })
      }
      if (err instanceof MutationConflictError) {
        return res.status(409).json({ error: err.message, code: err.code })
      }
      if (err instanceof MutationValidationError) {
        return res.status(400).json({ error: err.message, code: err.code })
      }
      console.error('[AdminAPI] Failed to record returned order:', err?.message || err)
      return res.status(500).json({ error: 'Failed to record returned order.' })
    }
  })

  // 5. POST /api/admin/orders/:id/verify-bkash - Manually verify bKash payment
  app.post('/api/admin/orders/:id/verify-bkash', requireAdmin, async (req, res) => {
    try {
      const rateCheck = checkAdminMutationRateLimit(getClientIp(req))
      if (!rateCheck.allowed) {
        return res.status(429).json({ error: rateCheck.message, code: 'rate_limited' })
      }

      const orderId = String(req.params.id)
      if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        return res.status(400).json({ error: 'Valid order UUID is required.' })
      }

      // Strict validation: Reject any unexpected body fields to prevent tampering
      if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        return res.status(400).json({
          error: 'No body parameters are accepted for bKash verification.',
        })
      }

      const adminUser = req.adminUser!
      const result = await verifyBkashPayment(orderId, adminUser)
      return res.json(result)
    } catch (err: any) {
      if (err instanceof MutationNotFoundError) {
        return res.status(404).json({ error: err.message })
      }
      if (err instanceof MutationConflictError) {
        return res.status(409).json({ error: err.message, code: err.code })
      }
      if (err instanceof MutationValidationError) {
        return res.status(400).json({ error: err.message, code: err.code })
      }
      console.error('[AdminAPI] Failed to verify bKash payment:', err?.message || err)
      return res.status(500).json({ error: 'Failed to verify payment.' })
    }
  })

  // 5. POST /api/admin/orders/:id/fail-bkash - Mark manual bKash payment as failed
  const FailBkashBodySchema = z
    .object({
      reason: z
        .string()
        .trim()
        .min(3, 'Reason must be at least 3 characters long.')
        .max(300, 'Reason cannot exceed 300 characters.'),
    })
    .strict()

  app.post('/api/admin/orders/:id/fail-bkash', requireAdmin, async (req, res) => {
    try {
      const rateCheck = checkAdminMutationRateLimit(getClientIp(req))
      if (!rateCheck.allowed) {
        return res.status(429).json({ error: rateCheck.message, code: 'rate_limited' })
      }

      const orderId = String(req.params.id)
      if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        return res.status(400).json({ error: 'Valid order UUID is required.' })
      }

      const parseResult = FailBkashBodySchema.safeParse(req.body)
      if (!parseResult.success) {
        const issues = (parseResult.error as any).issues || (parseResult.error as any).errors || []
        return res.status(400).json({
          error: 'Invalid request body.',
          details: issues.map((e: any) => e.message),
        })
      }

      const adminUser = req.adminUser!
      const result = await failBkashPayment(orderId, parseResult.data.reason, adminUser)
      return res.json(result)
    } catch (err: any) {
      if (err instanceof MutationNotFoundError) {
        return res.status(404).json({ error: err.message })
      }
      if (err instanceof MutationConflictError) {
        return res.status(409).json({ error: err.message, code: err.code })
      }
      if (err instanceof MutationValidationError) {
        return res.status(400).json({ error: err.message, code: err.code })
      }
      console.error('[AdminAPI] Failed to mark payment as failed:', err?.message || err)
      return res.status(500).json({ error: 'Failed to update payment status.' })
    }
  })

  // 6. GET /api/admin/orders/:id/audit - Chronological audit history for this order
  app.get('/api/admin/orders/:id/audit', requireAdmin, async (req, res) => {
    try {
      const orderId = String(req.params.id)
      if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        return res.status(400).json({ error: 'Valid order UUID is required.' })
      }

      const history = await getOrderAuditHistory(orderId)
      return res.json({ audit: history })
    } catch (err: any) {
      if (err instanceof MutationNotFoundError) {
        return res.status(404).json({ error: err.message })
      }
      console.error('[AdminAPI] Failed to fetch order audit history:', err?.message || err)
      return res.status(500).json({ error: 'Failed to retrieve audit history.' })
    }
  })

  // 7. POST /api/admin/orders/:id/mark-cod-paid - Secure Cash on Delivery payment collection recording
  const MarkCodPaidBodySchema = z.object({}).strict()

  app.post('/api/admin/orders/:id/mark-cod-paid', requireAdmin, async (req, res) => {
    try {
      const rateCheck = checkAdminMutationRateLimit(getClientIp(req))
      if (!rateCheck.allowed) {
        return res.status(429).json({ error: rateCheck.message, code: 'rate_limited' })
      }

      const orderId = String(req.params.id)
      if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        return res.status(400).json({ error: 'Valid order UUID is required.' })
      }

      const parseResult = MarkCodPaidBodySchema.safeParse(req.body)
      if (!parseResult.success) {
        const issues = (parseResult.error as any).issues || (parseResult.error as any).errors || []
        return res.status(400).json({
          error: 'Invalid request body. No arbitrary payment fields are accepted.',
          details: issues.map((e: any) => e.message),
        })
      }

      const adminUser = req.adminUser!
      const result = await markCodPaid(orderId, adminUser)
      return res.json(result)
    } catch (err: any) {
      if (err instanceof MutationNotFoundError) {
        return res.status(404).json({ error: err.message })
      }
      if (err instanceof MutationConflictError) {
        return res.status(409).json({ error: err.message, code: err.code })
      }
      if (err instanceof MutationValidationError) {
        return res.status(400).json({ error: err.message, code: err.code })
      }
      console.error('[AdminAPI] Failed to record COD payment:', err?.message || err)
      return res.status(500).json({ error: 'Failed to record COD payment.' })
    }
  })

  // Single-model Gemini API Chat Endpoint with abuse protection
  app.post('/api/chat', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' })
      }

      // Per-IP rate limiting
      const clientIp = getClientIp(req)

      const rateCheck = checkRateLimit(clientIp)
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: rateCheck.message,
          rateLimited: true,
        })
      }

      const { messages } = req.body

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty messages array provided.' })
      }

      // Input validation and pruning: keep only the last MAX_HISTORY_MESSAGES
      const sanitizedMessages = messages
        .filter((m) => m && typeof m.text === 'string' && m.text.trim())
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m) => {
          const role = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user'
          const text = String(m.text).slice(0, MAX_PROMPT_CHARS).trim()
          return {
            role,
            parts: [{ text }],
          }
        })

      if (sanitizedMessages.length === 0) {
        return res.status(400).json({ error: 'Message content is empty or invalid.' })
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })

      // Strictly use ONLY gemini-3.1-flash-lite, with zero fallback to billable models
      const response = await ai.models.generateContent({
        model: CHAT_MODEL,
        contents: sanitizedMessages,
        config: {
          systemInstruction,
          temperature: 0.6,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      })

      const reply = response.text || ''
      return res.json({ reply, model: CHAT_MODEL })
    } catch (err: unknown) {
      console.error(`Gemini (${CHAT_MODEL}) generation error:`, err)
      const errStatus = (err as { status?: number })?.status
      const errMsg = err instanceof Error ? err.message : String(err)
      const isQuotaOrBusy =
        errStatus === 429 ||
        errStatus === 503 ||
        errMsg.includes('429') ||
        errMsg.includes('quota') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('503') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('high demand')

      return res.status(isQuotaOrBusy ? 429 : 500).json({
        error: isQuotaOrBusy
          ? 'The assistant is currently at capacity or resting. Please try again in a few moments or proceed with ordering.'
          : 'Unable to reach the assistant at this time.',
        quotaExceeded: isQuotaOrBusy,
      })
    }
  })

  // Centralized production error handler
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        error: 'Invalid JSON payload format.',
        code: 'invalid_json',
      })
    }

    if (err.type === 'entity.too.large') {
      return res.status(413).json({
        error: 'Request payload exceeds the maximum allowed size (20kb).',
        code: 'payload_too_large',
      })
    }

    console.error('[Production Server Error]:', err?.message || 'Unknown internal error')
    return res.status(500).json({
      error: 'An internal server error occurred.',
      code: 'internal_server_error',
    })
  })
}

configureApp()

export default app
