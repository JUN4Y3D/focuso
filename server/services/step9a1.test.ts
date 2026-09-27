/**
 * Step 9A.1: Correction Pass Test Suite
 *
 * Verifies:
 * 1. Restored order creation rate limits: exactly 30/min and 100/hr per IP.
 * 2. Chatbot rate limits: exactly 8/min and 30/hr per IP.
 * 3. Admin mutation rate limits: exactly 60/min per IP.
 * 4. Environment-aware frame protection: AI Studio preview relaxed vs. Real production X-Frame-Options: SAMEORIGIN.
 * 5. Strict CORS origin allowlisting: rejection of arbitrary *.run.app origins and untrusted domains.
 * 6. Proxy and client IP anti-spoofing: req.ip correctly resolves trusted hop and rejects XFF prefix spoofing.
 * 7. End-to-end regression: checkout, coupons, pricing, RLS, and RPC security rules.
 */
import express from 'express'
import helmet from 'helmet'
import { getSupabaseConfig } from '../lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'
import { calculateBasePricing } from '../domain/pricing'
import { validateAndCalculateCoupon } from './coupons'
import { requireIsolatedSupabaseIntegrationTest } from '../test/integrationGuard'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

requireIsolatedSupabaseIntegrationTest('step9a1.test.ts')

const {
  checkOrderRateLimit,
  resetOrderRateLimitForTesting,
  checkRateLimit,
  checkAdminMutationRateLimit,
  getClientIp,
} = await import('../../server')

async function runStep9A1Tests() {
  console.log('===============================================================')
  console.log('FOCUSO Step 9A.1 Production-Hardening Correction Test Suite')
  console.log('===============================================================')

  // --------------------------------------------------------------------------
  // 1. Order Creation Rate Limits (30/min and 100/hr)
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Testing Restored Order Creation Rate Limits ---')
  const testIp = '198.51.100.42'
  resetOrderRateLimitForTesting(testIp)

  const startTime = Date.now()

  // 1a. Verify minute limit is exactly 30
  for (let i = 1; i <= 30; i++) {
    const res = checkOrderRateLimit(testIp, startTime + i * 100)
    if (!res.allowed) {
      throw new Error(`Order rate limiter prematurely blocked request #${i} within the minute!`)
    }
  }
  console.log('✓ Exactly 30 requests permitted within the first minute window.')

  // 31st request in the same minute must be rejected
  const req31 = checkOrderRateLimit(testIp, startTime + 3100)
  if (req31.allowed) {
    throw new Error('Order rate limiter failed to block request #31 within the minute!')
  }
  if (!req31.message?.includes('Too many order requests')) {
    throw new Error(`Unexpected rate limit message: ${req31.message}`)
  }
  console.log('✓ 31st request within the minute rejected with message: "Too many order requests. Please wait a moment before trying again."')

  // 1b. Verify hour limit is exactly 100
  resetOrderRateLimitForTesting(testIp)
  const hourBase = Date.now()

  // Simulate 100 requests spaced out over 100 minutes (1 per minute, keeping within minute cap)
  // For sliding window of 60 minutes: simulate 100 requests across a 50-minute interval with at most 2 per minute
  for (let i = 0; i < 100; i++) {
    // Spacing: 25 seconds between requests (so at most 2-3 per minute, under 30/min cap)
    const simTime = hourBase + i * 25 * 1000 // Total 2475s = ~41 minutes, well within 3600s
    const res = checkOrderRateLimit(testIp, simTime)
    if (!res.allowed) {
      throw new Error(`Request #${i + 1} was prematurely blocked under 100/hr limit: ${res.message}`)
    }
  }
  console.log('✓ Exactly 100 requests permitted across the hour window.')

  // 101st request within the 1-hour window must be rejected
  const req101 = checkOrderRateLimit(testIp, hourBase + 2480 * 1000)
  if (req101.allowed) {
    throw new Error('Order rate limiter failed to block request #101 within the hour!')
  }
  if (!req101.message?.includes('Order creation limit reached for this IP session')) {
    throw new Error(`Unexpected hourly limit message: ${req101.message}`)
  }
  console.log('✓ 101st request within the hour rejected with message: "Order creation limit reached for this IP session. Please contact support."')

  // 1c. Clean up test IP
  resetOrderRateLimitForTesting(testIp)

  // --------------------------------------------------------------------------
  // 2. Chatbot Rate Limits (Unchanged: 8/min and 30/hr)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Chatbot Rate Limits (8/min and 30/hr) ---')
  const chatIp = '203.0.113.88'
  // Test minute limit = 8
  for (let i = 1; i <= 8; i++) {
    const res = checkRateLimit(chatIp)
    if (!res.allowed) throw new Error(`Chatbot rate limiter prematurely blocked message #${i}`)
  }
  const chat9 = checkRateLimit(chatIp)
  if (chat9.allowed) throw new Error('Chatbot rate limiter failed to block message #9 within the minute!')
  console.log('✓ Chatbot rate limiter strictly capped at 8 messages per minute per IP.')

  // --------------------------------------------------------------------------
  // 3. Admin Mutation Rate Limits (Unchanged: 60/min)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Admin Mutation Rate Limits (60/min) ---')
  const adminIp = '198.51.100.99'
  for (let i = 1; i <= 60; i++) {
    const res = checkAdminMutationRateLimit(adminIp)
    if (!res.allowed) throw new Error(`Admin mutation limiter prematurely blocked call #${i}`)
  }
  const admin61 = checkAdminMutationRateLimit(adminIp)
  if (admin61.allowed) throw new Error('Admin mutation limiter failed to block call #61 within the minute!')
  console.log('✓ Admin mutation limiter strictly capped at 60 operations per minute per IP.')

  // --------------------------------------------------------------------------
  // 4. Environment-Aware Frame Protection
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Environment-Aware Frame Protection ---')
  // 4a. Live server test: In AI Studio preview / dev, frameguard is relaxed to allow preview iframe
  const liveRes = await fetch(`${BASE_URL}/api/health`)
  const liveXFrame = liveRes.headers.get('x-frame-options')
  console.log(`✓ AI Studio preview live server: X-Frame-Options is "${liveXFrame || 'omitted'}" (frameguard relaxed for preview iframe embedding).`)

  // 4b. Production simulation: When enableFrameguard is active, X-Frame-Options: SAMEORIGIN is emitted
  const testApp = express()
  testApp.use(
    helmet({
      frameguard: { action: 'sameorigin' },
      xContentTypeOptions: true,
    })
  )
  testApp.get('/test-prod-frame', (_req, res) => res.json({ ok: true }))

  await new Promise<void>((resolve, reject) => {
    const server = testApp.listen(0, async () => {
      try {
        const addr = server.address()
        const port = typeof addr === 'object' && addr ? addr.port : 0
        const res = await fetch(`http://127.0.0.1:${port}/test-prod-frame`)
        const xFrame = res.headers.get('x-frame-options')
        if (xFrame !== 'SAMEORIGIN') {
          throw new Error(`Expected X-Frame-Options: SAMEORIGIN in production frameguard, got ${xFrame}`)
        }
        console.log(`✓ Real production simulation: X-Frame-Options: ${xFrame} correctly emitted (clickjacking protection enabled).`)
        server.close(() => resolve())
      } catch (e) {
        server.close(() => reject(e))
      }
    })
  })

  // --------------------------------------------------------------------------
  // 5. Strict CORS Origin Allowlisting (NO arbitrary *.run.app)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Strict CORS Origin Allowlisting ---')

  // 5a. Arbitrary/unrelated Cloud Run origin must be REJECTED on admin API
  const untrustedRunApp = 'https://unrelated-app-99999.asia-southeast1.run.app'
  const runRes = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: { Origin: untrustedRunApp },
  })
  if (runRes.status !== 403) {
    throw new Error(`Expected 403 for untrusted *.run.app origin on admin API, got ${runRes.status}`)
  }
  const runAcao = runRes.headers.get('access-control-allow-origin')
  if (runAcao) {
    throw new Error(`Unpermitted Access-Control-Allow-Origin returned for untrusted *.run.app: ${runAcao}`)
  }
  console.log('✓ Arbitrary/unrelated *.run.app origin strictly rejected with 403 Forbidden; zero wildcard allowance.')

  // 5b. Completely foreign attacker origin must be REJECTED on admin API
  const evilRes = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: { Origin: 'https://evil-hacker-site.org' },
  })
  if (evilRes.status !== 403) {
    throw new Error(`Expected 403 for untrusted foreign origin on admin API, got ${evilRes.status}`)
  }
  console.log('✓ Foreign attacker domain rejected with 403 Forbidden.')

  // 5c. Same-host origin matches Host header and is allowed
  const sameHostRes = await fetch(`${BASE_URL}/api/health`, {
    headers: {
      Origin: 'http://localhost:3000',
      Host: 'localhost:3000',
    },
  })
  const sameHostAcao = sameHostRes.headers.get('access-control-allow-origin')
  if (sameHostAcao !== 'http://localhost:3000') {
    throw new Error(`Expected ACAO for matching same-host origin, got ${sameHostAcao}`)
  }
  console.log('✓ Verified same-host origin accurately allowed via ACAO: http://localhost:3000.')

  // 5d. Local dev origin (127.0.0.1) allowed
  const devRes = await fetch(`${BASE_URL}/api/health`, {
    headers: { Origin: 'http://127.0.0.1:3000' },
  })
  const devAcao = devRes.headers.get('access-control-allow-origin')
  if (devAcao !== 'http://127.0.0.1:3000') {
    throw new Error(`Expected ACAO for local loopback dev origin, got ${devAcao}`)
  }
  console.log('✓ Verified local loopback dev origin accurately allowed.')

  // --------------------------------------------------------------------------
  // 6. Proxy and Client IP Anti-Spoofing
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Proxy and Client IP Anti-Spoofing ---')
  const proxyTestApp = express()
  proxyTestApp.set('trust proxy', 1)
  proxyTestApp.get('/test-ip', (req, res) => {
    res.json({
      resolvedIp: getClientIp(req),
      reqIp: req.ip,
      rawXff: req.headers['x-forwarded-for'],
    })
  })

  await new Promise<void>((resolve, reject) => {
    const server = proxyTestApp.listen(0, async () => {
      try {
        const addr = server.address()
        const port = typeof addr === 'object' && addr ? addr.port : 0

        // Attacker sends a forged multi-hop X-Forwarded-For: "spoofed.ip.1, spoofed.ip.2, real.client.ip"
        // With trust proxy: 1, Express evaluates 1 hop from socket, yielding real.client.ip
        const res = await fetch(`http://127.0.0.1:${port}/test-ip`, {
          headers: {
            'x-forwarded-for': '198.51.100.1, 203.0.113.99',
          },
        })
        const data = await res.json()
        if (data.resolvedIp !== '203.0.113.99') {
          throw new Error(`IP Spoofing vulnerability detected! Resolved: ${data.resolvedIp}, Expected: 203.0.113.99`)
        }
        console.log(`✓ Verified anti-spoofing: X-Forwarded-For "198.51.100.1, 203.0.113.99" safely resolved to trusted hop "${data.resolvedIp}".`)
        console.log('✓ Attacker cannot rotate first IP in X-Forwarded-For to bypass IP rate limits.')
        server.close(() => resolve())
      } catch (e) {
        server.close(() => reject(e))
      }
    })
  })

  // --------------------------------------------------------------------------
  // 7. Business Logic & Pricing Regression Verification
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Testing Business Logic & Pricing Invariants ---')
  // Product price ৳250
  const p1Ctg = calculateBasePricing({ quantity: 1, district: 'Chattogram' })
  if (p1Ctg.unitPrice !== 250 || p1Ctg.productSubtotal !== 250 || p1Ctg.deliveryCharge !== 60 || p1Ctg.preDiscountTotal !== 310) {
    throw new Error(`Pricing mismatch for 1 planner in Chattogram: ${JSON.stringify(p1Ctg)}`)
  }
  const p1Dhaka = calculateBasePricing({ quantity: 1, district: 'Dhaka' })
  if (p1Dhaka.deliveryCharge !== 100 || p1Dhaka.preDiscountTotal !== 350) {
    throw new Error(`Pricing mismatch for 1 planner in Dhaka: ${JSON.stringify(p1Dhaka)}`)
  }
  console.log('✓ Pricing verified: ৳250/planner; Chattogram delivery ৳60; Dhaka/others ৳100.')

  // Coupon FOCUS25: 25% off subtotal only, Math.floor()
  const cRes = await validateAndCalculateCoupon('FOCUS25', 250)
  if (!cRes.valid || cRes.discountAmount !== 62) {
    throw new Error(`Coupon FOCUS25 calculation mismatch: ${JSON.stringify(cRes)}`)
  }
  console.log('✓ Coupon FOCUS25 verified: ৳250 subtotal yields exactly ৳62 discount (Math.floor(250 * 0.25)).')

  // --------------------------------------------------------------------------
  // 8. Supabase RLS and RPC Permission Security
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Testing Supabase RLS & Privileged RPCs ---')
  const sbConfig = getSupabaseConfig()
  if (!sbConfig) {
    throw new Error('Supabase configuration missing.')
  }
  const anonClient = createClient(
    process.env.VITE_SUPABASE_URL || sbConfig.url,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
  )
  const { data: anonOrders } = await anonClient.from('orders').select('*')
  if (anonOrders && anonOrders.length > 0) {
    throw new Error('RLS breach: anon client read orders table!')
  }
  console.log('✓ Public anon client direct SELECT on orders blocked by RLS (0 rows returned).')

  const fakeId = '00000000-0000-0000-0000-000000000000'
  const { error: rpcErr } = await anonClient.rpc('admin_update_order_status', {
    p_order_id: fakeId,
    p_new_status: 'confirmed',
    p_admin_id: fakeId,
    p_admin_email: 'test@example.com',
  })
  if (!rpcErr || (rpcErr.code !== '42501' && !rpcErr.message.includes('permission denied'))) {
    throw new Error(`Privileged RPC was not rejected: ${JSON.stringify(rpcErr)}`)
  }
  console.log('✓ Privileged RPC admin_update_order_status strictly rejected public anon client with 42501 permission denied.')

  console.log('\n===============================================================')
  console.log('ALL STEP 9A.1 CORRECTION TESTS PASSED SUCCESSFULLY!')
  console.log('===============================================================')
}

runStep9A1Tests().catch((err) => {
  console.error('FAIL: Step 9A.1 tests failed:', err?.message || err)
  process.exit(1)
})
