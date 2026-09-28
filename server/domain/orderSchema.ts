import { z } from 'zod'
import { BANGLADESH_DISTRICTS } from '../../src/lib/districts.js'

// Canonical list of valid Bangladesh district values
export const VALID_DISTRICTS = BANGLADESH_DISTRICTS.map((d) => d.value)

/**
 * Validates and normalizes Bangladesh mobile phone numbers.
 * Accepts formats:
 * - 01XXXXXXXXX
 * - +8801XXXXXXXXX
 * - 8801XXXXXXXXX
 * Normalizes to standard: 01XXXXXXXXX (11 digits starting with 013, 014, 015, 016, 017, 018, 019)
 */
export function normalizeBangladeshPhone(rawPhone: string): string | null {
  if (typeof rawPhone !== 'string') return null

  // Remove spaces, dashes, parentheses
  let cleaned = rawPhone.replace(/[\s\-()]/g, '')

  // Remove leading +88 or 88
  if (cleaned.startsWith('+8801')) {
    cleaned = cleaned.slice(3)
  } else if (cleaned.startsWith('8801')) {
    cleaned = cleaned.slice(2)
  }

  // Must match exactly 11 digits: 01 followed by 3,4,5,6,7,8,9 and 8 more digits
  const bdPhoneRegex = /^01[3-9]\d{8}$/
  if (!bdPhoneRegex.test(cleaned)) {
    return null
  }

  return cleaned
}

/**
 * Masks phone number for safe logging (never expose full customer phone in logs).
 * Example: 01812345678 -> 018****5678
 */
export function maskPhoneForLogs(phone: string): string {
  if (!phone || phone.length < 8) return '***'
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

/**
 * Normalizes customer name:
 * - Trims whitespace
 * - Collapses internal consecutive whitespace
 * - Validates length (2 to 100 characters)
 */
export function normalizeCustomerName(rawName: string): string | null {
  if (typeof rawName !== 'string') return null
  const trimmed = rawName.trim().replace(/\s+/g, ' ')
  if (trimmed.length < 2 || trimmed.length > 100) return null
  return trimmed
}

/**
 * Normalizes bKash Transaction ID (TrxID).
 * - Trims whitespace
 * - Converts to uppercase
 * - Validates alphanumeric length between 6 and 32 characters
 */
export function normalizeBkashTrxId(rawTrxId: string | null | undefined): string | null {
  if (typeof rawTrxId !== 'string') return null
  const trimmed = rawTrxId.trim().toUpperCase()
  if (!/^[A-Z0-9]{6,32}$/.test(trimmed)) {
    return null
  }
  return trimmed
}

/**
 * Strict Zod schema for POST /api/orders request payload.
 *
 * CRITICAL DEFENSE:
 * 1. ONLY accepts customer and business inputs.
 * 2. Strict mode (.strict()): Disallows and rejects client-provided financial fields
 *    like unitPrice, productSubtotal, deliveryZone, deliveryCharge, couponDiscount,
 *    finalTotal, paymentStatus, orderStatus, etc.
 * 3. Enforces paymentMethod: 'cod' | 'bkash_manual'.
 * 4. Conditional validation via .superRefine():
 *    - For 'cod': bkashTransactionId must not be provided.
 *    - For 'bkash_manual': bkashTransactionId is strictly required and validated.
 */
export const CreateOrderRequestSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .min(2, { message: 'Customer name must be at least 2 characters.' })
      .max(100, { message: 'Customer name cannot exceed 100 characters.' }),

    phone: z
      .string()
      .trim()
      .refine((val) => normalizeBangladeshPhone(val) !== null, {
        message: 'Invalid Bangladesh mobile number. Must start with 013-019 and contain 11 digits.',
      }),

    district: z
      .string()
      .trim()
      .refine((val) => VALID_DISTRICTS.includes(val), {
        message: 'Invalid district. Please select a valid Bangladesh district.',
      }),

    deliveryArea: z
      .string()
      .trim()
      .min(2, { message: 'Delivery area (Thana / Area) is required.' })
      .max(100, { message: 'Delivery area cannot exceed 100 characters.' }),

    deliveryAddress: z
      .string()
      .trim()
      .min(5, { message: 'Detailed delivery address is required.' })
      .max(300, { message: 'Delivery address cannot exceed 300 characters.' }),

    quantity: z
      .number()
      .int({ message: 'Quantity must be an integer.' })
      .min(1, { message: 'Quantity must be at least 1.' })
      .max(9, { message: 'Quantity cannot exceed 9.' }),

    couponCode: z
      .string()
      .trim()
      .max(30, { message: 'Coupon code cannot exceed 30 characters.' })
      .optional()
      .nullable(),

    customerNote: z
      .string()
      .trim()
      .max(500, { message: 'Customer note cannot exceed 500 characters.' })
      .optional()
      .nullable(),

    paymentMethod: z
      .enum(['cod', 'bkash_manual'], {
        message: "Payment method must be either 'cod' or 'bkash_manual'.",
      })
      .default('cod'),

    bkashTransactionId: z
      .string()
      .trim()
      .max(50, { message: 'bKash Transaction ID cannot exceed 50 characters.' })
      .optional()
      .nullable(),

    idempotencyKey: z
      .string()
      .uuid({ message: 'Idempotency key must be a valid UUID.' }),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.paymentMethod === 'bkash_manual') {
      const normalized = normalizeBkashTrxId(data.bkashTransactionId)
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A valid bKash Transaction ID (6-32 alphanumeric characters) is required for bKash payment.',
          path: ['bkashTransactionId'],
        })
      }
    } else if (data.paymentMethod === 'cod') {
      if (data.bkashTransactionId && data.bkashTransactionId.trim() !== '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'bKash Transaction ID must not be provided for Cash on Delivery.',
          path: ['bkashTransactionId'],
        })
      }
    }
  })

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>
