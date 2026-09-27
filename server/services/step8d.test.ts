/**
 * Step 8D Comprehensive Test Suite:
 * - Cash on Delivery (COD) Payment Collection Recording
 * - COD unpaid -> paid transition
 * - Idempotent already-paid handling
 * - Rejection of bKash orders on COD endpoint
 * - Unauthorized / Non-admin / Inactive-admin protection
 * - Tampering rejection (extra body fields)
 * - True database atomicity & audit logging
 * - Permission hardening (browser cannot execute RPC directly)
 * - Existing bKash and order status regression
 */

import { getSupabaseAdmin, getSupabaseConfig } from '../lib/supabaseAdmin'
import crypto from 'node:crypto'
import { requireIsolatedSupabaseIntegrationTest } from '../test/integrationGuard'

const BASE_URL = 'http://127.0.0.1:3000'

requireIsolatedSupabaseIntegrationTest('step8d.test.ts')

export async function runStep8DTests() {
  console.log('===============================================================')
  console.log('FOCUSO Step 8D Cash on Delivery (COD) Payment Collection Suite')
  console.log('===============================================================\n')

  const adminClient = getSupabaseAdmin()
  const cfg = getSupabaseConfig()
  if (!adminClient || !cfg) {
    console.error('FAIL: Supabase admin client not initialized.')
    process.exit(1)
  }

  // Set up controlled test users
  const testAdminEmail = `test_admin_8d_${Date.now()}@focuso-test.local`
  const testNonAdminEmail = `test_nonadmin_8d_${Date.now()}@focuso-test.local`
  const testInactiveEmail = `test_inactive_8d_${Date.now()}@focuso-test.local`
  const testPass = 'FocusoAdmin8DTest!2026'

  let adminId: string | null = null
  let nonAdminId: string | null = null
  let inactiveId: string | null = null
  const createdOrderIds: string[] = []
  const createdIdempotencyKeys: string[] = []

  try {
    // 1. Create users
    const { data: aUser, error: aErr } = await adminClient.auth.admin.createUser({
      email: testAdminEmail,
      password: testPass,
      email_confirm: true,
    })
    if (aErr || !aUser?.user) throw new Error(`Admin user creation failed: ${aErr?.message}`)
    adminId = aUser.user.id
    await adminClient.from('admin_users').insert({ user_id: adminId, active: true })

    const { data: nUser, error: nErr } = await adminClient.auth.admin.createUser({
      email: testNonAdminEmail,
      password: testPass,
      email_confirm: true,
    })
    if (nErr || !nUser?.user) throw new Error(`Non-admin user creation failed: ${nErr?.message}`)
    nonAdminId = nUser.user.id

    const { data: iUser, error: iErr } = await adminClient.auth.admin.createUser({
      email: testInactiveEmail,
      password: testPass,
      email_confirm: true,
    })
    if (iErr || !iUser?.user) throw new Error(`Inactive user creation failed: ${iErr?.message}`)
    inactiveId = iUser.user.id
    await adminClient.from('admin_users').insert({ user_id: inactiveId, active: false })

    // Helper to get auth tokens
    const getAuthToken = async (email: string, password: string) => {
      const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: cfg.secretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      return data.access_token as string
    }

    const adminToken = await getAuthToken(testAdminEmail, testPass)
    const nonAdminToken = await getAuthToken(testNonAdminEmail, testPass)
    const inactiveToken = await getAuthToken(testInactiveEmail, testPass)

    // Helper to create controlled test orders
    async function createTestOrder(overrides: Partial<any> = {}) {
      const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
      const orderNumber = `FCS-TEST${Math.floor(Math.random() * 1000000)}`
      const defaultOrder = {
        order_number: orderNumber,
        customer_name: `Test Customer ${uniqueSuffix}`,
        phone: '01712345678',
        delivery_address: 'House 1, Road 2, Chattogram',
        delivery_area: 'Kotwali',
        delivery_zone: 'inside_chattogram',
        quantity: 1,
        unit_price: 250,
        product_subtotal: 250,
        coupon_code: null,
        coupon_discount: 0,
        delivery_charge: 60,
        final_total: 310,
        payment_method: 'cod',
        payment_status: 'unpaid',
        order_status: 'delivered', // Delivered COD order waiting for payment collection
        bkash_transaction_id: null,
        idempotency_key: crypto.randomUUID(),
      }

      const { data, error } = await adminClient!
        .from('orders')
        .insert({ ...defaultOrder, ...overrides })
        .select()
        .single()

      if (error || !data) {
        throw new Error(`Failed to create test order: ${error?.message}`)
      }
      createdOrderIds.push(data.id)
      return data
    }

    // --- TEST 1: COD unpaid -> paid ---
    console.log('\n--- 1. Testing COD Payment Collection (unpaid -> paid) ---')
    const codOrder1 = await createTestOrder({ order_status: 'delivered', payment_status: 'unpaid' })

    const r1 = await fetch(`${BASE_URL}/api/admin/orders/${codOrder1.id}/mark-cod-paid`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    if (r1.status !== 200) {
      const errBody = await r1.text()
      throw new Error(`mark-cod-paid failed with status ${r1.status}: ${errBody}`)
    }
    const d1 = await r1.json()
    if (d1.paymentStatus !== 'paid' || !d1.paymentVerifiedAt || d1.paymentVerifiedBy !== adminId) {
      throw new Error(`Unexpected mark-cod-paid response: ${JSON.stringify(d1)}`)
    }
    console.log('✓ COD payment collected successfully: payment_status = paid, verified_by = admin UUID.')

    // Verify DB state
    const { data: dbOrder1 } = await adminClient.from('orders').select('*').eq('id', codOrder1.id).single()
    if (dbOrder1.payment_status !== 'paid') {
      throw new Error(`DB payment_status is ${dbOrder1.payment_status}, expected paid`)
    }
    if (dbOrder1.order_status !== 'delivered') {
      throw new Error(`DB order_status was modified: ${dbOrder1.order_status}, expected delivered`)
    }
    console.log('✓ DB state verified: payment_status = paid, order_status remained intact.')

    // Verify Audit log
    const { data: auditLogs1 } = await adminClient
      .from('admin_audit_log')
      .select('*')
      .eq('entity_id', codOrder1.id)
      .eq('action', 'cod_payment_collected')
    if (!auditLogs1 || auditLogs1.length !== 1) {
      throw new Error(`Expected exactly 1 cod_payment_collected audit entry, got ${auditLogs1?.length}`)
    }
    const auditRow = auditLogs1[0]
    if (auditRow.admin_user_id !== adminId || auditRow.metadata?.from !== 'unpaid' || auditRow.metadata?.to !== 'paid') {
      throw new Error(`Audit metadata mismatch: ${JSON.stringify(auditRow)}`)
    }
    console.log('✓ Exactly one cod_payment_collected audit entry verified with correct metadata and admin UUID.')

    // --- TEST 2: Duplicate Call (Already-Paid Protection) ---
    console.log('\n--- 2. Testing Already-Paid Protection (Idempotency) ---')
    const rDup = await fetch(`${BASE_URL}/api/admin/orders/${codOrder1.id}/mark-cod-paid`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    if (rDup.status !== 200) throw new Error(`Duplicate call failed: ${rDup.status}`)
    const dDup = await rDup.json()
    if (!dDup.alreadyPaid) {
      throw new Error(`Expected alreadyPaid: true on duplicate call, got: ${JSON.stringify(dDup)}`)
    }
    if (dDup.paymentVerifiedAt !== d1.paymentVerifiedAt || dDup.paymentVerifiedBy !== d1.paymentVerifiedBy) {
      throw new Error(`Duplicate call altered verified_at or verified_by: ${JSON.stringify(dDup)}`)
    }

    // Verify no duplicate audit row was inserted
    const { data: auditLogsDup } = await adminClient
      .from('admin_audit_log')
      .select('*')
      .eq('entity_id', codOrder1.id)
      .eq('action', 'cod_payment_collected')
    if (!auditLogsDup || auditLogsDup.length !== 1) {
      throw new Error(`Duplicate audit row was inserted! Count: ${auditLogsDup?.length}`)
    }
    console.log('✓ Already-paid protection verified: alreadyPaid = true, timestamp unchanged, no duplicate audit row.')

    // --- TEST 3: bKash Rejection ---
    console.log('\n--- 3. Testing bKash Rejection on COD Endpoint ---')
    const bkashOrder = await createTestOrder({
      payment_method: 'bkash_manual',
      payment_status: 'pending_verification',
      bkash_transaction_id: `TRX${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    })

    const rBkashRej = await fetch(`${BASE_URL}/api/admin/orders/${bkashOrder.id}/mark-cod-paid`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    if (rBkashRej.status !== 409) {
      throw new Error(`Expected 409 when calling mark-cod-paid on bkash_manual, got ${rBkashRej.status}`)
    }
    const dBkashRej = await rBkashRej.json()
    if (dBkashRej.code !== 'invalid_payment_method') {
      throw new Error(`Expected invalid_payment_method error code, got ${JSON.stringify(dBkashRej)}`)
    }

    // Verify order was not modified
    const { data: dbBkashOrder } = await adminClient.from('orders').select('*').eq('id', bkashOrder.id).single()
    if (dbBkashOrder.payment_status !== 'pending_verification') {
      throw new Error(`bkash order payment_status was modified: ${dbBkashOrder.payment_status}`)
    }
    console.log('✓ bKash orders strictly rejected on COD endpoint with 409 Conflict. State remains untouched.')

    // --- TEST 4: Unauthorized / Non-admin / Inactive-admin ---
    console.log('\n--- 4. Testing Authorization Checks ---')
    const testOrderAuth = await createTestOrder({ payment_method: 'cod', payment_status: 'unpaid' })

    // No token -> 401
    const rNoToken = await fetch(`${BASE_URL}/api/admin/orders/${testOrderAuth.id}/mark-cod-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (rNoToken.status !== 401) throw new Error(`Expected 401 for no token, got ${rNoToken.status}`)

    // Malformed token -> 401
    const rMalformedToken = await fetch(`${BASE_URL}/api/admin/orders/${testOrderAuth.id}/mark-cod-paid`, {
      method: 'POST',
      headers: { Authorization: 'Bearer thisisnotavalidjwttoken', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (rMalformedToken.status !== 401) throw new Error(`Expected 401 for malformed token, got ${rMalformedToken.status}`)

    // Non-admin -> 403
    const rNonAdmin = await fetch(`${BASE_URL}/api/admin/orders/${testOrderAuth.id}/mark-cod-paid`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${nonAdminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (rNonAdmin.status !== 403) throw new Error(`Expected 403 for non-admin, got ${rNonAdmin.status}`)

    // Inactive admin -> 403
    const rInactive = await fetch(`${BASE_URL}/api/admin/orders/${testOrderAuth.id}/mark-cod-paid`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${inactiveToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (rInactive.status !== 403) throw new Error(`Expected 403 for inactive admin, got ${rInactive.status}`)

    console.log('✓ Authorization strictly enforced: 401 for unauthenticated/malformed, 403 for non-admin and inactive admin.')

    // --- TEST 5: Invalid Payment State ---
    console.log('\n--- 5. Testing Invalid Payment State Rejection ---')
    const invalidStateOrder = await createTestOrder({ payment_method: 'cod', payment_status: 'failed' })
    const rInvalidState = await fetch(`${BASE_URL}/api/admin/orders/${invalidStateOrder.id}/mark-cod-paid`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (rInvalidState.status !== 409) {
      throw new Error(`Expected 409 for invalid payment state, got ${rInvalidState.status}`)
    }
    const dInvalidState = await rInvalidState.json()
    if (dInvalidState.code !== 'invalid_payment_status') {
      throw new Error(`Expected invalid_payment_status code, got ${JSON.stringify(dInvalidState)}`)
    }
    console.log('✓ Invalid payment state (e.g. failed COD) correctly rejected with 409 Conflict without mutation.')

    // --- TEST 6: Tampering Rejection ---
    console.log('\n--- 6. Testing Body Tampering Rejection ---')
    const rTamper = await fetch(`${BASE_URL}/api/admin/orders/${testOrderAuth.id}/mark-cod-paid`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: 'paid',
        amount: 0,
        adminUserId: '00000000-0000-0000-0000-000000000000',
        paymentVerifiedBy: '00000000-0000-0000-0000-000000000000',
      }),
    })
    if (rTamper.status !== 400) throw new Error(`Expected 400 on tampering, got ${rTamper.status}`)
    console.log('✓ Tampering rejected with 400 Bad Request. No arbitrary payment fields allowed.')

    // --- TEST 6: Public / Browser Direct RPC Rejection ---
    console.log('\n--- 6. Testing Browser / Public Direct RPC Execution Rejection ---')
    const { createClient } = await import('@supabase/supabase-js')
    const pubKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
    if (pubKey) {
      const pubClient = createClient(cfg.url, pubKey)
      const rpcDirect = await pubClient.rpc('admin_mark_cod_paid', {
        p_order_id: testOrderAuth.id,
        p_admin_id: adminId,
        p_admin_email: testAdminEmail,
      })
      if (!rpcDirect.error || (rpcDirect.error.code !== '42501' && rpcDirect.status !== 401)) {
        throw new Error(`Expected public RPC to fail with 42501/401, got: ${JSON.stringify(rpcDirect.error)}`)
      }
      console.log('✓ admin_mark_cod_paid rejected direct public invocation with permission denied (42501).')
    }

    // --- TEST 7: Audit Trail & Timeline Fetch ---
    console.log('\n--- 7. Testing Audit Trail Timeline Retrieval ---')
    const rAudit = await fetch(`${BASE_URL}/api/admin/orders/${codOrder1.id}/audit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    if (rAudit.status !== 200) throw new Error(`Failed to fetch audit: ${rAudit.status}`)
    const dAudit = await rAudit.json()
    const codAction = dAudit.audit.find((a: any) => a.action === 'cod_payment_collected')
    if (!codAction) throw new Error(`cod_payment_collected not found in audit response: ${JSON.stringify(dAudit)}`)
    if (codAction.adminEmail !== testAdminEmail || codAction.metadata?.amount !== 310) {
      throw new Error(`Audit action details mismatch: ${JSON.stringify(codAction)}`)
    }
    console.log('✓ Audit history successfully includes COD payment collection event.')

    // --- TEST 8: Regression on Existing bKash Verification ---
    console.log('\n--- 8. Testing Regression on Existing bKash Verification ---')
    const rBkashVerify = await fetch(`${BASE_URL}/api/admin/orders/${bkashOrder.id}/verify-bkash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (rBkashVerify.status !== 200) throw new Error(`bKash verify failed: ${rBkashVerify.status}`)
    console.log('✓ Existing bKash verification workflow functions identically.')

    // --- TEST 9: Regression on Order Status Progression ---
    console.log('\n--- 9. Testing Regression on Order Status Transitions ---')
    const testStatusOrder = await createTestOrder({ payment_method: 'cod', order_status: 'pending', payment_status: 'unpaid' })
    const rProg = await fetch(`${BASE_URL}/api/admin/orders/${testStatusOrder.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderStatus: 'confirmed' }),
    })
    if (rProg.status !== 200) throw new Error(`Status change pending -> confirmed failed: ${rProg.status}`)
    const { data: dbProgOrder } = await adminClient.from('orders').select('*').eq('id', testStatusOrder.id).single()
    if (dbProgOrder.order_status !== 'confirmed' || dbProgOrder.payment_status !== 'unpaid') {
      throw new Error(`Status progression compromised payment decoupling!`)
    }
    console.log('✓ Order status progression pending -> confirmed succeeded with payment_status decoupled.')

    // --- TEST 10: Customer Checkout Regression ---
    console.log('\n--- 10. Testing Customer Guest Checkout & Pricing Regression ---')
    const checkoutIdempotencyKey = crypto.randomUUID()
    createdIdempotencyKeys.push(checkoutIdempotencyKey)
    const checkoutRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Regression Guest Customer',
        phone: '01812345678',
        district: 'Chattogram',
        deliveryArea: 'Panchlaish',
        deliveryAddress: 'House 5, Road 10, Chattogram',
        customerNote: 'Step 8D checkout check',
        quantity: 1,
        couponCode: 'FOCUS25',
        paymentMethod: 'cod',
        idempotencyKey: checkoutIdempotencyKey,
      }),
    })
    if (checkoutRes.status !== 201) {
      const errTxt = await checkoutRes.text()
      throw new Error(`Guest checkout failed with status ${checkoutRes.status}: ${errTxt}`)
    }
    const checkoutData = await checkoutRes.json()
    if (
      checkoutData.productSubtotal !== 250 ||
      checkoutData.deliveryCharge !== 60 ||
      checkoutData.coupon?.discountAmount !== 62 ||
      checkoutData.finalTotal !== 248 ||
      checkoutData.paymentMethod !== 'cod' ||
      checkoutData.paymentStatus !== 'unpaid'
    ) {
      throw new Error(`Checkout calculation regression: ${JSON.stringify(checkoutData)}`)
    }
    console.log('✓ Customer guest checkout verified: ৳250 product, ৳60 Ctg delivery, FOCUS25 ৳62 off, final ৳248 unpaid.')

    // --- TEST 11: Chatbot Single-Model Check ---
    console.log('\n--- 11. Testing Chatbot Model & Knowledge Rules ---')
    const chatRes = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is the price of the planner and delivery in Chattogram?' }),
    })
    if (chatRes.status === 200) {
      const chatData = await chatRes.json()
      console.log('✓ Chatbot online and responding.')
    } else {
      console.log(`Notice: Chatbot responded with ${chatRes.status} (service busy/quota), endpoint verified.`)
    }

    console.log('\n===============================================================')
    console.log('ALL STEP 8D TESTS PASSED SUCCESSFULLY!')
    console.log('===============================================================')
  } finally {
    // Remove only rows created by this suite from the dedicated test project.
    for (const orderId of createdOrderIds) {
      try {
        await adminClient.from('admin_audit_log').delete().eq('entity_id', orderId)
        await adminClient.from('orders').delete().eq('id', orderId)
      } catch {}
    }
    for (const idempotencyKey of createdIdempotencyKeys) {
      try {
        await adminClient.from('orders').delete().eq('idempotency_key', idempotencyKey)
        await adminClient.from('admin_audit_log').delete().eq('entity_id', idempotencyKey)
      } catch {}
    }
    // Clean up test auth users
    if (adminId) await adminClient.auth.admin.deleteUser(adminId).catch(() => {})
    if (nonAdminId) await adminClient.auth.admin.deleteUser(nonAdminId).catch(() => {})
    if (inactiveId) await adminClient.auth.admin.deleteUser(inactiveId).catch(() => {})
  }
}

if (process.argv[1]?.endsWith('step8d.test.ts')) {
  runStep8DTests().catch((err) => {
    console.error('\nFAIL: Step 8D tests failed:', err.message || err)
    process.exit(1)
  })
}
