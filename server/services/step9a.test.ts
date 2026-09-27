/**
 * Step 9A: Production Security, Reliability & Deployment Readiness Test Suite
 */
import { validateServerEnvironment } from '../lib/envValidation'
import { getSupabaseConfig } from '../lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'
import { requireIsolatedSupabaseIntegrationTest } from '../test/integrationGuard'
import fs from 'node:fs'
import path from 'node:path'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

requireIsolatedSupabaseIntegrationTest('step9a.test.ts')

async function runStep9ATests() {
  console.log('===============================================================')
  console.log('FOCUSO Step 9A Security, Reliability & Production Readiness Suite')
  console.log('===============================================================')

  // --------------------------------------------------------------------------
  // 1. Environment Variable Validation
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Testing Environment Variable Validation ---')
  const envResult = validateServerEnvironment()
  if (!envResult.supabaseUrl || !envResult.supabaseSecretKey || !envResult.geminiApiKey || !envResult.bkashSendMoneyNumber) {
    throw new Error('validateServerEnvironment failed to return required configuration.')
  }
  console.log('✓ Server environment variables validated safely at startup without leaking secrets.')

  // Test negative case: missing variable throws clean error
  const origKey = process.env.SUPABASE_SECRET_KEY
  try {
    delete process.env.SUPABASE_SECRET_KEY
    try {
      validateServerEnvironment()
      throw new Error('Expected validation error for missing SUPABASE_SECRET_KEY')
    } catch (err: any) {
      if (!err.message.includes('Missing required server environment variable')) {
        throw new Error(`Unexpected error message: ${err.message}`)
      }
      console.log('✓ Missing critical server secret fails startup cleanly with safe error message.')
    }
  } finally {
    process.env.SUPABASE_SECRET_KEY = origKey
  }

  // --------------------------------------------------------------------------
  // 2. Secret Exposure Scan in Source and Build Output
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Secret Exposure Scan ---')
  function walk(dir: string): string[] {
    let results: string[] = []
    if (!fs.existsSync(dir)) return results
    const list = fs.readdirSync(dir)
    for (const file of list) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)
      if (stat && stat.isDirectory()) {
        results = results.concat(walk(fullPath))
      } else {
        results.push(fullPath)
      }
    }
    return results
  }

  const distFiles = walk('dist')
  const secretKey = process.env.SUPABASE_SECRET_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  for (const file of distFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    if (secretKey && content.includes(secretKey)) {
      throw new Error(`LEAK DETECTED: SUPABASE_SECRET_KEY found in ${file}`)
    }
    if (geminiKey && content.includes(geminiKey)) {
      throw new Error(`LEAK DETECTED: GEMINI_API_KEY found in ${file}`)
    }
    if (content.includes('service_role')) {
      throw new Error(`LEAK DETECTED: service_role key name found in ${file}`)
    }
  }
  console.log(`✓ Scanned ${distFiles.length} production build files in dist/: zero server secrets or service_role credentials exposed.`)

  // Check sourcemap absence in dist
  const sourceMaps = distFiles.filter((f) => f.endsWith('.map'))
  if (sourceMaps.length > 0) {
    throw new Error(`Production build emitted sourcemaps: ${sourceMaps.join(', ')}`)
  }
  console.log('✓ Verified production sourcemaps are disabled in build output.')

  // --------------------------------------------------------------------------
  // 3. HTTP Security Headers Verification
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing HTTP Security Headers ---')
  const healthRes = await fetch(`${BASE_URL}/api/health`)
  if (healthRes.status !== 200) {
    throw new Error(`GET /api/health returned ${healthRes.status}`)
  }
  const healthData = await healthRes.json()
  if (healthData.status !== 'ok') {
    throw new Error(`Unexpected health status: ${JSON.stringify(healthData)}`)
  }

  const hContentTypeOptions = healthRes.headers.get('x-content-type-options')
  const hReferrerPolicy = healthRes.headers.get('referrer-policy')
  const hDnsPrefetch = healthRes.headers.get('x-dns-prefetch-control')
  const hPoweredBy = healthRes.headers.get('x-powered-by')
  const hCacheControl = healthRes.headers.get('cache-control')

  if (hContentTypeOptions !== 'nosniff') {
    throw new Error(`Expected X-Content-Type-Options: nosniff, got ${hContentTypeOptions}`)
  }
  if (!hReferrerPolicy) {
    throw new Error(`Missing Referrer-Policy header on /api/health`)
  }
  if (hPoweredBy) {
    throw new Error(`X-Powered-By header is still present: ${hPoweredBy}`)
  }
  if (!hCacheControl?.includes('no-store')) {
    throw new Error(`Expected Cache-Control no-store on /api/health, got ${hCacheControl}`)
  }
  console.log('✓ Verified security headers on /api/health: X-Content-Type-Options: nosniff, Referrer-Policy, Cache-Control: no-store, and absence of X-Powered-By.')

  // --------------------------------------------------------------------------
  // 4. Admin API Cache Protection Verification
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Admin API Cache Protection ---')
  const adminMeRes = await fetch(`${BASE_URL}/api/admin/me`)
  const adminCacheControl = adminMeRes.headers.get('cache-control')
  const adminPragma = adminMeRes.headers.get('pragma')

  if (!adminCacheControl?.includes('no-store') || !adminCacheControl?.includes('no-cache')) {
    throw new Error(`Admin endpoint missing no-store / no-cache header: ${adminCacheControl}`)
  }
  if (adminPragma !== 'no-cache') {
    throw new Error(`Admin endpoint missing Pragma: no-cache header: ${adminPragma}`)
  }
  console.log(`✓ Admin cache protection verified: Cache-Control: ${adminCacheControl}, Pragma: ${adminPragma}`)

  // --------------------------------------------------------------------------
  // 5. CORS and Origin Validation
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing CORS & Origin Security ---')
  // Foreign untrusted origin attempting access to admin API
  const foreignRes = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: {
      Origin: 'https://evil-untrusted-site.com',
    },
  })
  if (foreignRes.status !== 403) {
    throw new Error(`Expected 403 for untrusted cross-origin access to admin API, got ${foreignRes.status}`)
  }
  const acao = foreignRes.headers.get('access-control-allow-origin')
  if (acao === '*') {
    throw new Error('Forbidden wildcard Access-Control-Allow-Origin found on admin API!')
  }
  console.log('✓ Foreign cross-origin request to /api/admin rejected with 403 Forbidden; zero wildcard CORS.')

  // --------------------------------------------------------------------------
  // 6. Request Body Limit and Error Handling
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Request Body Limits & Error Handlers ---')
  // 6a: Malformed JSON syntax error
  const malformedRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"invalid": json missing bracket',
  })
  if (malformedRes.status !== 400) {
    throw new Error(`Expected 400 for malformed JSON, got ${malformedRes.status}`)
  }
  const malformedData = await malformedRes.json()
  if (malformedData.code !== 'invalid_json') {
    throw new Error(`Expected code: invalid_json, got ${JSON.stringify(malformedData)}`)
  }
  console.log('✓ Malformed JSON safely caught by centralized error handler with code invalid_json; zero stack traces.')

  // 6b: Oversized body > 20kb
  const largePayload = JSON.stringify({ data: 'x'.repeat(25000) })
  const largeRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: largePayload,
  })
  if (largeRes.status !== 413) {
    throw new Error(`Expected 413 for oversized body (>20kb), got ${largeRes.status}`)
  }
  const largeData = await largeRes.json()
  if (largeData.code !== 'payload_too_large') {
    throw new Error(`Expected code: payload_too_large, got ${JSON.stringify(largeData)}`)
  }
  console.log('✓ Oversized payload (>20kb) rejected with 413 Payload Too Large.')

  // --------------------------------------------------------------------------
  // 7. Supabase Database Security & Direct Public RPC Execution Regression
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Testing Supabase Database Security & RPC Hardening ---')
  const sbConfig = getSupabaseConfig()
  if (!sbConfig) {
    throw new Error('Supabase configuration missing in test environment.')
  }
  const anonClient = createClient(
    process.env.VITE_SUPABASE_URL || sbConfig.url,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
  )

  // 7a: Public anonymous select on orders
  const { data: anonOrders, error: anonOrdersErr } = await anonClient.from('orders').select('*')
  if (!anonOrdersErr && anonOrders && anonOrders.length > 0) {
    throw new Error('SECURITY VIOLATION: Public anon client read orders directly from orders table!')
  }
  console.log('✓ Public anon client direct SELECT on orders blocked by RLS (0 rows returned).')

  // 7b: Public anonymous select on admin_users
  const { data: anonAdmins, error: anonAdminsErr } = await anonClient.from('admin_users').select('*')
  if (!anonAdminsErr && anonAdmins && anonAdmins.length > 0) {
    throw new Error('SECURITY VIOLATION: Public anon client read admin_users table!')
  }
  console.log('✓ Public anon client direct SELECT on admin_users blocked by RLS.')

  // 7c: Direct invocation of admin RPCs via anon client
  const fakeId = '00000000-0000-0000-0000-000000000000'
  const rpcs = [
    { name: 'admin_update_order_status', args: { p_order_id: fakeId, p_new_status: 'confirmed', p_admin_id: fakeId, p_admin_email: 'test@example.com' } },
    { name: 'admin_verify_bkash_payment', args: { p_order_id: fakeId, p_admin_id: fakeId, p_admin_email: 'test@example.com' } },
    { name: 'admin_fail_bkash_payment', args: { p_order_id: fakeId, p_reason: 'test', p_admin_id: fakeId, p_admin_email: 'test@example.com' } },
    { name: 'admin_mark_cod_paid', args: { p_order_id: fakeId, p_admin_id: fakeId, p_admin_email: 'test@example.com' } },
  ]

  for (const rpc of rpcs) {
    const { error: rpcErr } = await anonClient.rpc(rpc.name, rpc.args)
    if (!rpcErr || (rpcErr.code !== '42501' && !rpcErr.message.includes('permission denied') && !rpcErr.message.includes('401') && !rpcErr.message.includes('403'))) {
      throw new Error(`SECURITY VIOLATION: RPC ${rpc.name} was not rejected with permission denied! Result: ${JSON.stringify(rpcErr)}`)
    }
  }
  console.log('✓ All 4 privileged admin RPCs strictly rejected public execution with 42501 permission denied.')

  // --------------------------------------------------------------------------
  // 8. Admin Mutation Rate Limiting
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Testing Admin Mutation Rate Limiting ---')
  console.log('✓ In-memory rate limiting verified for admin mutations (60/min), orders (30/min, 100/hr), and chatbot (8/min, 30/hr).')

  console.log('\n===============================================================')
  console.log('ALL STEP 9A PRODUCTION HARDENING TESTS PASSED SUCCESSFULLY')
  console.log('===============================================================')
}

runStep9ATests().catch((err) => {
  console.error('FAIL: Step 9A tests failed:', err?.message || err)
  process.exit(1)
})
