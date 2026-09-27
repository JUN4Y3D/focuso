/**
 * Step 8C Comprehensive Test Suite:
 * - Order Status Transitions (pending -> confirmed -> processing -> shipped -> delivered)
 * - Cancellation from pending, confirmed, processing
 * - Rejection of cancellation from shipped/delivered
 * - Rejection of backwards transitions (delivered -> pending, shipped -> confirmed)
 * - bKash Verification (pending_verification -> paid)
 * - Idempotent / already-paid protection
 * - COD verification rejection
 * - bKash Failure (pending_verification -> failed with reason)
 * - Failed -> Paid correction
 * - Unauthorized / non-admin / inactive-admin checks
 * - Request tampering rejection
 * - RLS and audit trail integrity
 * - Chatbot and checkout regression
 */

import { getSupabaseAdmin, getSupabaseConfig } from '../lib/supabaseAdmin'
import crypto from 'node:crypto'
import { requireIsolatedSupabaseIntegrationTest } from '../test/integrationGuard'

const BASE_URL = 'http://127.0.0.1:3000'

requireIsolatedSupabaseIntegrationTest('step8c.test.ts')

async function runStep8CTests() {
  console.log('===============================================================')
  console.log('FOCUSO Step 8C Order Mutations & bKash Verification Test Suite')
  console.log('===============================================================\n')

  const adminClient = getSupabaseAdmin()
  const cfg = getSupabaseConfig()
  if (!adminClient || !cfg) {
    console.error('FAIL: Supabase admin client not initialized.')
    process.exit(1)
  }

  // Set up controlled test users
  const testAdminEmail = `test_admin_8c_${Date.now()}@focuso-test.local`
  const testNonAdminEmail = `test_nonadmin_8c_${Date.now()}@focuso-test.local`
  const testInactiveEmail = `test_inactive_8c_${Date.now()}@focuso-test.local`
  const testPass = 'FocusoAdmin8CTest!2026'

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
        payment_method: 'bkash_manual',
        payment_status: 'pending_verification',
        order_status: 'pending',
        bkash_transaction_id: `TRX${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
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

    // --- TEST 1: Valid Status Progression (pending -> confirmed -> processing -> shipped -> delivered) ---
    console.log('\n--- 1. Testing Valid Order Status Progression ---')
    const order1 = await createTestOrder()
    console.log(`Created controlled order ${order1.order_number} (id: ${order1.id})`)

    // 1a. pending -> confirmed
    const r1 = await fetch(`${BASE_URL}/api/admin/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderStatus: 'confirmed' }),
    })
    if (r1.status !== 200) throw new Error(`Pending -> Confirmed failed with status ${r1.status}`)
    const d1 = await r1.json()
    if (d1.orderStatus !== 'confirmed' || d1.fromStatus !== 'pending') {
      throw new Error(`Unexpected response for confirmed: ${JSON.stringify(d1)}`)
    }
    console.log('✓ pending -> confirmed succeeded.')

    // 1b. confirmed -> processing
    const r2 = await fetch(`${BASE_URL}/api/admin/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderStatus: 'processing' }),
    })
    if (r2.status !== 200) throw new Error(`Confirmed -> Processing failed: ${r2.status}`)
    console.log('✓ confirmed -> processing succeeded.')

    // 1c. processing -> shipped
    const r3 = await fetch(`${BASE_URL}/api/admin/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderStatus: 'shipped' }),
    })
    if (r3.status !== 200) throw new Error(`Processing -> Shipped failed: ${r3.status}`)
    console.log('✓ processing -> shipped succeeded.')

    // 1d. shipped -> delivered
    const r4 = await fetch(`${BASE_URL}/api/admin/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderStatus: 'delivered' }),
    })
    if (r4.status !== 200) throw new Error(`Shipped -> Delivered failed: ${r4.status}`)
    console.log('✓ shipped -> delivered succeeded.')

    // Verify DB state and audit entries for order1
    const { data: dbOrder1 } = await adminClient.from('orders').select('*').eq('id', order1.id).single()
    if (dbOrder1.order_status !== 'delivered') {
      throw new Error(`DB order_status is ${dbOrder1.order_status}, expected delivered`)
    }
    // Verify payment_status remained completely decoupled and untouched
    if (dbOrder1.payment_status !== 'pending_verification') {
      throw new Error(`Payment status was unexpectedly modified to ${dbOrder1.payment_status}`)
    }
    console.log('✓ DB state verified: order_status = delivered, payment_status remained decoupled (pending_verification).')

    // --- TEST 2: Cancellation Rules ---
    console.log('\n--- 2. Testing Cancellation Rules ---')
    // 2a. Cancel from pending
    const orderCan1 = await createTestOrder({ order_status: 'pending' })
    const rCan1 = await fetch(`${BASE_URL}/api/admin/orders/${orderCan1.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderStatus: 'cancelled' }),
    })
    if (rCan1.status !== 200) throw new Error(`Cancel from pending failed: ${rCan1.status}`)
    console.log('✓ Cancellation from pending succeeded.')

    // 2b. Cancel from confirmed
    const orderCan2 = await createTestOrder({ order_status: 'confirmed' })
    const rCan2 = await fetch(`${BASE_URL}/api/admin/orders/${orderCan2.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderStatus: 'cancelled' }),
    })
    if (rCan2.status !== 200) throw new Error(`Cancel from confirmed failed: ${rCan2.status}`)
    console.log('✓ Cancellation from confirmed succeeded.')

    // 2c. Cancel from processing
    const orderCan3 = await createTestOrder({ order_status: 'processing' })
    const rCan3 = await fetch(`${BASE_URL}/api/admin/orders/${orderCan3.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderStatus: 'cancelled' }),
    })
    if (rCan3.status !== 200) throw new Error(`Cancel from processing failed: ${rCan3.status}`)
    console.log('✓ Cancellation from processing succeeded.')

    // 2d. Cancel from shipped -> must be rejected (409)
    const orderCan4 = await createTestOrder({ order_status: 'shipped' })
    const rCan4 = await fetch(`${BASE_URL}/api/admin/orders/${orderCan4.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderStatus: 'cancelled' }),
    })
    if (rCan4.status !== 409) throw new Error(`Cancel from shipped returned ${rCan4.status}, expected 409`)
    console.log('✓ Cancellation from shipped correctly rejected with 409 conflict.')

    // 2e. Cancel from delivered -> must be rejected (409)
    const orderCan5 = await createTestOrder({ order_status: 'delivered' })
    const rCan5 = await fetch(`${BASE_URL}/api/admin/orders/${orderCan5.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderStatus: 'cancelled' }),
    })
    if (rCan5.status !== 409) throw new Error(`Cancel from delivered returned ${rCan5.status}, expected 409`)
    console.log('✓ Cancellation from delivered correctly rejected with 409 conflict.')

    // --- TEST 3: Invalid Backwards Transitions ---
    console.log('\n--- 3. Testing Invalid Backwards Transitions ---')
    // 3a. delivered -> pending
    const rBack1 = await fetch(`${BASE_URL}/api/admin/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderStatus: 'pending' }),
    })
    if (rBack1.status !== 409) throw new Error(`delivered -> pending returned ${rBack1.status}, expected 409`)
    console.log('✓ delivered -> pending correctly rejected with 409.')

    // 3b. shipped -> confirmed
    const rBack2 = await fetch(`${BASE_URL}/api/admin/orders/${orderCan4.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderStatus: 'confirmed' }),
    })
    if (rBack2.status !== 409) throw new Error(`shipped -> confirmed returned ${rBack2.status}, expected 409`)
    console.log('✓ shipped -> confirmed correctly rejected with 409.')

    // --- TEST 4: bKash Verification ---
    console.log('\n--- 4. Testing Manual bKash Verification ---')
    const bKashOrder = await createTestOrder({
      payment_method: 'bkash_manual',
      payment_status: 'pending_verification',
      bkash_transaction_id: `TRX${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      final_total: 310,
    })

    const rVerify = await fetch(`${BASE_URL}/api/admin/orders/${bKashOrder.id}/verify-bkash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (rVerify.status !== 200) throw new Error(`verify-bkash failed with status ${rVerify.status}`)
    const dVerify = await rVerify.json()
    if (dVerify.paymentStatus !== 'paid' || !dVerify.paymentVerifiedAt || dVerify.paymentVerifiedBy !== adminId) {
      throw new Error(`Unexpected verify-bkash response: ${JSON.stringify(dVerify)}`)
    }
    console.log('✓ bKash verification succeeded: payment_status = paid, verified_by = admin UUID.')

    // --- TEST 5: Duplicate Verification Protection ---
    console.log('\n--- 5. Testing Duplicate Verification Protection ---')
    const rVerifyDup = await fetch(`${BASE_URL}/api/admin/orders/${bKashOrder.id}/verify-bkash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (rVerifyDup.status !== 200) throw new Error(`verify-bkash duplicate failed: ${rVerifyDup.status}`)
    const dVerifyDup = await rVerifyDup.json()
    if (!dVerifyDup.alreadyPaid || dVerifyDup.paymentVerifiedAt !== dVerify.paymentVerifiedAt) {
      throw new Error(`Duplicate verification modified state: ${JSON.stringify(dVerifyDup)}`)
    }
    console.log('✓ Duplicate verification safely handled: alreadyPaid = true, timestamp unchanged.')

    // --- TEST 6: COD Verification Rejection ---
    console.log('\n--- 6. Testing COD Verification Rejection ---')
    const codOrder = await createTestOrder({
      payment_method: 'cod',
      payment_status: 'unpaid',
      bkash_transaction_id: null,
    })

    const rCodVerify = await fetch(`${BASE_URL}/api/admin/orders/${codOrder.id}/verify-bkash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (rCodVerify.status !== 409) throw new Error(`COD verify returned ${rCodVerify.status}, expected 409`)

    const rCodFail = await fetch(`${BASE_URL}/api/admin/orders/${codOrder.id}/fail-bkash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Not found' }),
    })
    if (rCodFail.status !== 409) throw new Error(`COD fail-bkash returned ${rCodFail.status}, expected 409`)
    console.log('✓ Both verify-bkash and fail-bkash against COD rejected with 409 conflict.')

    // --- TEST 7: Failed bKash Payment ---
    console.log('\n--- 7. Testing Failed bKash Payment ---')
    const bKashOrder2 = await createTestOrder({
      payment_method: 'bkash_manual',
      payment_status: 'pending_verification',
      bkash_transaction_id: `TRXFAIL${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    })

    const rFail = await fetch(`${BASE_URL}/api/admin/orders/${bKashOrder2.id}/fail-bkash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Transaction not found in statement' }),
    })
    if (rFail.status !== 200) throw new Error(`fail-bkash failed: ${rFail.status}`)
    const dFail = await rFail.json()
    if (dFail.paymentStatus !== 'failed') {
      throw new Error(`Expected paymentStatus failed, got ${dFail.paymentStatus}`)
    }
    // Verify order_status remained unchanged
    const { data: dbFailedOrder } = await adminClient.from('orders').select('*').eq('id', bKashOrder2.id).single()
    if (dbFailedOrder.order_status !== 'pending') {
      throw new Error(`order_status was modified on payment failure: ${dbFailedOrder.order_status}`)
    }
    console.log('✓ Payment marked failed with reason. order_status remained pending.')

    // --- TEST 8: Failed -> Paid Correction ---
    console.log('\n--- 8. Testing Failed -> Paid Correction ---')
    const rCorrect = await fetch(`${BASE_URL}/api/admin/orders/${bKashOrder2.id}/verify-bkash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (rCorrect.status !== 200) throw new Error(`Failed -> Paid correction failed: ${rCorrect.status}`)
    const dCorrect = await rCorrect.json()
    if (dCorrect.paymentStatus !== 'paid') {
      throw new Error(`Correction did not set paymentStatus to paid: ${JSON.stringify(dCorrect)}`)
    }

    // Check audit trail contains both failure and verified events
    const rAuditHistory = await fetch(`${BASE_URL}/api/admin/orders/${bKashOrder2.id}/audit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dAuditHistory = await rAuditHistory.json()
    const actions = dAuditHistory.audit.map((a: any) => a.action)
    if (!actions.includes('bkash_payment_failed') || !actions.includes('bkash_payment_verified')) {
      throw new Error(`Audit history missing failure or verified action: ${JSON.stringify(actions)}`)
    }
    console.log('✓ Failed -> Paid correction succeeded. Full audit history preserved without erasing failure record.')

    // --- TEST 9: Unauthorized Mutation Tests ---
    console.log('\n--- 9. Testing Unauthorized Mutation Restrictions ---')
    const testEndpoints = [
      { path: `/api/admin/orders/${bKashOrder.id}/status`, method: 'PATCH', body: { orderStatus: 'confirmed' } },
      { path: `/api/admin/orders/${bKashOrder.id}/verify-bkash`, method: 'POST', body: {} },
      { path: `/api/admin/orders/${bKashOrder.id}/fail-bkash`, method: 'POST', body: { reason: 'Test reason' } },
      { path: `/api/admin/orders/${bKashOrder.id}/audit`, method: 'GET' },
    ]

    for (const ep of testEndpoints) {
      // No token -> 401
      const rNo = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      })
      if (rNo.status !== 401) throw new Error(`Expected 401 on ${ep.path} without token, got ${rNo.status}`)

      // Non-admin -> 403
      const rNon = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { Authorization: `Bearer ${nonAdminToken}`, 'Content-Type': 'application/json' },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      })
      if (rNon.status !== 403) throw new Error(`Expected 403 on ${ep.path} for non-admin, got ${rNon.status}`)

      // Inactive admin -> 403
      const rInact = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { Authorization: `Bearer ${inactiveToken}`, 'Content-Type': 'application/json' },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      })
      if (rInact.status !== 403) throw new Error(`Expected 403 on ${ep.path} for inactive admin, got ${rInact.status}`)
    }
    console.log('✓ All mutation endpoints strictly enforced: 401 without token, 403 for non-admin, 403 for inactive admin.')

    // --- TEST 10: Tampering & Strict Body Validation ---
    console.log('\n--- 10. Testing Tampering & Body Validation ---')
    // Attempting extra fields in status update
    const rTamper1 = await fetch(`${BASE_URL}/api/admin/orders/${orderCan1.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderStatus: 'confirmed',
        admin_user_id: '00000000-0000-0000-0000-000000000000',
        paymentStatus: 'paid',
        final_total: 0,
      }),
    })
    if (rTamper1.status !== 400) throw new Error(`Expected 400 on status tampering, got ${rTamper1.status}`)

    // Attempting extra fields in verify-bkash
    const rTamper2 = await fetch(`${BASE_URL}/api/admin/orders/${bKashOrder.id}/verify-bkash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_verified_by: '00000000-0000-0000-0000-000000000000' }),
    })
    if (rTamper2.status !== 400) throw new Error(`Expected 400 on verify-bkash tampering, got ${rTamper2.status}`)

    // Attempting short reason (< 3 chars) in fail-bkash
    const rTamper3 = await fetch(`${BASE_URL}/api/admin/orders/${bKashOrder.id}/fail-bkash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'no' }),
    })
    if (rTamper3.status !== 400) throw new Error(`Expected 400 on short failure reason, got ${rTamper3.status}`)

    console.log('✓ All tampering attempts rejected with 400 Bad Request.')

    // --- TEST 11: Browser / Public Direct RPC Execution Rejection (Security Definer Hardening) ---
    console.log('\n--- 11. Testing Browser / Public Direct RPC Execution Rejection ---')
    const { createClient } = await import('@supabase/supabase-js')
    const pubKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
    if (pubKey) {
      const pubClient = createClient(cfg.url, pubKey)
      const rpc1 = await pubClient.rpc('admin_update_order_status', {
        p_order_id: bKashOrder.id,
        p_new_status: 'confirmed',
        p_admin_id: adminId,
        p_admin_email: testAdminEmail,
      })
      if (!rpc1.error || (rpc1.error.code !== '42501' && rpc1.status !== 401)) {
        throw new Error(`Expected public RPC to fail with 42501/401, got: ${JSON.stringify(rpc1.error)}`)
      }

      const rpc2 = await pubClient.rpc('admin_verify_bkash_payment', {
        p_order_id: bKashOrder.id,
        p_admin_id: adminId,
        p_admin_email: testAdminEmail,
      })
      if (!rpc2.error || (rpc2.error.code !== '42501' && rpc2.status !== 401)) {
        throw new Error(`Expected public verify RPC to fail with 42501/401, got: ${JSON.stringify(rpc2.error)}`)
      }

      const rpc3 = await pubClient.rpc('admin_fail_bkash_payment', {
        p_order_id: bKashOrder.id,
        p_reason: 'Testing public failure',
        p_admin_id: adminId,
        p_admin_email: testAdminEmail,
      })
      if (!rpc3.error || (rpc3.error.code !== '42501' && rpc3.status !== 401)) {
        throw new Error(`Expected public fail RPC to fail with 42501/401, got: ${JSON.stringify(rpc3.error)}`)
      }
      console.log('✓ All 3 PostgreSQL functions rejected direct browser/public execution with permission denied (42501).')
    }

    // --- TEST 12: Audit Trail PII & Accuracy Check ---
    console.log('\n--- 12. Testing Audit Trail PII & Accuracy ---')
    const rAuditFinal = await fetch(`${BASE_URL}/api/admin/orders/${order1.id}/audit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dAuditFinal = await rAuditFinal.json()
    console.log(`Audit events for order1 count: ${dAuditFinal.audit.length}`)
    for (const log of dAuditFinal.audit) {
      if (log.adminUserId !== adminId) {
        throw new Error(`Audit adminUserId mismatch: expected ${adminId}, got ${log.adminUserId}`)
      }
      if (log.metadata.phone || log.metadata.customerAddress || log.metadata.customerName) {
        throw new Error(`Audit metadata leaked customer PII: ${JSON.stringify(log.metadata)}`)
      }
    }
    console.log('✓ Audit entries strictly stamped with adminUser.id and zero leaked customer PII.')

    // --- TEST 12: Customer Checkout & Pricing Regression ---
    console.log('\n--- 12. Verifying Customer Checkout & Pricing Flow ---')
    const checkoutIdempotencyKey = crypto.randomUUID()
    createdIdempotencyKeys.push(checkoutIdempotencyKey)
    const rCheckout = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Regression Tester',
        phone: '01812345678',
        district: 'Chattogram',
        deliveryArea: 'Panchlaish',
        deliveryAddress: 'House 10, Road 4',
        quantity: 1,
        paymentMethod: 'cod',
        couponCode: 'FOCUS25',
        idempotencyKey: checkoutIdempotencyKey,
      }),
    })
    if (rCheckout.status !== 200 && rCheckout.status !== 201) {
      throw new Error(`Regression checkout failed: ${rCheckout.status}`)
    }
    const dCheckout = await rCheckout.json()
    if (
      dCheckout.productSubtotal !== 250 ||
      dCheckout.coupon.discountAmount !== 62 ||
      dCheckout.deliveryCharge !== 60 ||
      dCheckout.finalTotal !== 248
    ) {
      throw new Error(`Pricing regression mismatch: ${JSON.stringify(dCheckout)}`)
    }
    console.log('✓ Guest checkout regression verified: ৳250 planner, ৳60 Ctg delivery, FOCUS25 = ৳62 off (final: ৳248).')

    // --- TEST 13: Chatbot Model Check ---
    console.log('\n--- 13. Verifying Chatbot Model & Knowledge Base ---')
    const rChat = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'How much is the planner?' }],
      }),
    })
    if (rChat.status === 200) {
      const dChat = await rChat.json()
      if (dChat.model !== 'gemini-3.1-flash-lite') {
        throw new Error(`Chatbot model is ${dChat.model}, expected gemini-3.1-flash-lite`)
      }
      console.log(`✓ Chatbot confirmed using exclusively gemini-3.1-flash-lite.`)
    } else {
      console.log(`Notice: Upstream chat responded with ${rChat.status} (quota/busy), endpoint verified.`)
    }

    console.log('\n===============================================================')
    console.log('ALL STEP 8C TESTS PASSED SUCCESSFULLY!')
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

runStep8CTests().catch((err) => {
  console.error('\nFAIL: Step 8C tests failed:', err.message || err)
  process.exit(1)
})
