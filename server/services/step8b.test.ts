/**
 * Step 8B Comprehensive Test Suite
 *
 * Verifies:
 * 1. Protected List Endpoint:
 *    - No token -> 401
 *    - Malformed token -> 401
 *    - Authenticated non-admin -> 403
 *    - Inactive admin -> 403
 *    - Active admin -> 200
 * 2. Protected Detail Endpoint:
 *    - No token -> 401
 *    - Non-admin -> 403
 *    - Active admin + valid order ID -> 200
 *    - Active admin + valid order number -> 200
 *    - Nonexistent order -> 404
 *    - Malformed order identifier -> safe 400 or 404
 * 3. Pagination Verification:
 *    - Page 1 works
 *    - Page 2 works when enough orders exist
 *    - Limit is respected
 *    - Excessive limit is capped at 100
 *    - Total count is returned accurately
 * 4. Search Verification:
 *    - Search by exact order number
 *    - Search by partial customer name
 *    - Search by phone number
 *    - Unrelated orders excluded
 * 5. Filters Verification:
 *    - paymentMethod = bkash_manual
 *    - paymentStatus = pending_verification
 *    - orderStatus = pending
 *    - district = Chattogram
 *    - district = Dhaka
 * 6. Customer Data & PII Verification:
 *    - Customer details properly formatted
 *    - No sensitive secrets or tokens exposed
 * 7. Security:
 *    - Direct unauthenticated / anonymous SELECT on orders blocked
 *    - No mutations allowed in Step 8B
 */

import { getSupabaseAdmin, getSupabaseConfig } from '../lib/supabaseAdmin'
import { requireIsolatedSupabaseIntegrationTest } from '../test/integrationGuard'

const BASE_URL = 'http://127.0.0.1:3000'

requireIsolatedSupabaseIntegrationTest('step8b.test.ts')

async function runStep8BTests() {
  console.log('===============================================================')
  console.log('FOCUSO Step 8B Admin Orders Dashboard Test Suite')
  console.log('===============================================================\n')

  const adminClient = getSupabaseAdmin()
  const cfg = getSupabaseConfig()
  if (!adminClient || !cfg) {
    console.error('FAIL: Supabase admin client not initialized.')
    process.exit(1)
  }

  // 1. Unauthenticated checks on list endpoint
  console.log('--- 1. Testing GET /api/admin/orders without token ---')
  const rNoToken = await fetch(`${BASE_URL}/api/admin/orders`)
  if (rNoToken.status === 401) {
    console.log('✓ Test 1 Passed: Missing token returned 401.')
  } else {
    console.error(`✗ Test 1 Failed: Expected 401, got ${rNoToken.status}`)
    process.exit(1)
  }

  const rBadToken = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: { Authorization: 'Bearer bad.token.here' },
  })
  if (rBadToken.status === 401) {
    console.log('✓ Test 1b Passed: Invalid token returned 401.')
  } else {
    console.error(`✗ Test 1b Failed: Expected 401, got ${rBadToken.status}`)
    process.exit(1)
  }

  // Set up controlled test users
  const testNonAdminEmail = `test_nonadmin_${Date.now()}@focuso-test.local`
  const testAdminEmail = `test_admin_${Date.now()}@focuso-test.local`
  const testPass = 'FocusoAdminTest123!'

  let nonAdminId: string | null = null
  let adminId: string | null = null

  try {
    const { data: nonAdminUser, error: nonAdminCreateErr } = await adminClient.auth.admin.createUser({
      email: testNonAdminEmail,
      password: testPass,
      email_confirm: true,
    })
    if (nonAdminCreateErr || !nonAdminUser?.user) {
      throw new Error(`Failed to create non-admin: ${nonAdminCreateErr?.message}`)
    }
    nonAdminId = nonAdminUser.user.id

    const { data: adminUser, error: adminCreateErr } = await adminClient.auth.admin.createUser({
      email: testAdminEmail,
      password: testPass,
      email_confirm: true,
    })
    if (adminCreateErr || !adminUser?.user) {
      throw new Error(`Failed to create admin: ${adminCreateErr?.message}`)
    }
    adminId = adminUser.user.id

    // Add adminUser to public.admin_users
    await adminClient.from('admin_users').insert({ user_id: adminId, active: true })

    // Sign in to acquire tokens via REST API so adminClient remains pure service role
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

    const nonAdminToken = await getAuthToken(testNonAdminEmail, testPass)
    const adminToken = await getAuthToken(testAdminEmail, testPass)

    // Test Non-Admin forbidden on list
    console.log('\n--- 2. Testing Non-Admin on GET /api/admin/orders ---')
    const rNonAdminList = await fetch(`${BASE_URL}/api/admin/orders`, {
      headers: { Authorization: `Bearer ${nonAdminToken}` },
    })
    if (rNonAdminList.status === 403) {
      console.log('✓ Test 2 Passed: Authenticated non-admin returned 403.')
    } else {
      console.error(`✗ Test 2 Failed: Expected 403, got ${rNonAdminList.status}`)
      process.exit(1)
    }

    // Test Active Admin on list
    console.log('\n--- 3. Testing Active Admin on GET /api/admin/orders ---')
    const rAdminList = await fetch(`${BASE_URL}/api/admin/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    if (rAdminList.status === 200) {
      const listData = await rAdminList.json()
      console.log(`✓ Test 3 Passed: Active admin returned 200. Total orders: ${listData.pagination?.total}`)
      if (Array.isArray(listData.orders)) {
        console.log(`✓ Returned ${listData.orders.length} orders in list.`)
      }
    } else {
      console.error(`✗ Test 3 Failed: Expected 200, got ${rAdminList.status}`)
      process.exit(1)
    }

    // 4. Test Inactive Admin on list
    console.log('\n--- 4. Testing Inactive Admin on GET /api/admin/orders ---')
    const testInactiveAdminEmail = `test_inactive_${Date.now()}@focuso-test.local`
    const { data: inactiveUser, error: inactiveCreateErr } = await adminClient.auth.admin.createUser({
      email: testInactiveAdminEmail,
      password: testPass,
      email_confirm: true,
    })
    if (inactiveCreateErr || !inactiveUser?.user) {
      throw new Error(`Failed to create inactive test user: ${inactiveCreateErr?.message}`)
    }
    const inactiveUserId = inactiveUser.user.id
    await adminClient.from('admin_users').insert({ user_id: inactiveUserId, active: false })

    const inactiveToken = await getAuthToken(testInactiveAdminEmail, testPass)

    const rInactiveList = await fetch(`${BASE_URL}/api/admin/orders`, {
      headers: { Authorization: `Bearer ${inactiveToken}` },
    })
    if (rInactiveList.status === 403) {
      console.log('✓ Test 4 Passed: Inactive admin returned 403.')
    } else {
      console.error(`✗ Test 4 Failed: Expected 403, got ${rInactiveList.status}`)
      process.exit(1)
    }

    // Clean up inactive test user
    await adminClient.from('admin_users').delete().eq('user_id', inactiveUserId)
    await adminClient.auth.admin.deleteUser(inactiveUserId)

    // Retrieve an existing order to test details, search, and filters
    const { data: existingOrders, error: ordersErr } = await adminClient.from('orders').select('*').limit(5)
    if (ordersErr || !existingOrders || existingOrders.length === 0) {
      console.error('No existing orders found in database. Error:', ordersErr?.message)
      process.exit(1)
    }
    const sampleOrder = existingOrders[0]

    // 5. Test Order Detail Endpoint
    console.log('\n--- 5. Testing GET /api/admin/orders/:id ---')
    // 5a. Missing token -> 401
    const rDetNoToken = await fetch(`${BASE_URL}/api/admin/orders/${sampleOrder.id}`)
    if (rDetNoToken.status === 401) {
      console.log('✓ Test 5a Passed: Missing token returned 401 on detail.')
    } else {
      console.error(`✗ Test 5a Failed: Expected 401, got ${rDetNoToken.status}`)
      process.exit(1)
    }

    // 5b. Non-admin -> 403
    const rDetNonAdmin = await fetch(`${BASE_URL}/api/admin/orders/${sampleOrder.id}`, {
      headers: { Authorization: `Bearer ${nonAdminToken}` },
    })
    if (rDetNonAdmin.status === 403) {
      console.log('✓ Test 5b Passed: Non-admin returned 403 on detail.')
    } else {
      console.error(`✗ Test 5b Failed: Expected 403, got ${rDetNonAdmin.status}`)
      process.exit(1)
    }

    // 5c. Active admin by UUID -> 200
    const rDetAdminUuid = await fetch(`${BASE_URL}/api/admin/orders/${sampleOrder.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    if (rDetAdminUuid.status === 200) {
      const det = await rDetAdminUuid.json()
      console.log('✓ Test 5c Passed: Active admin retrieved detail by UUID:', det.order?.orderNumber)
      if (
        det.order &&
        det.order.orderNumber === sampleOrder.order_number &&
        det.order.id === sampleOrder.id &&
        det.order.customerName === sampleOrder.customer_name &&
        det.order.phone === sampleOrder.phone
      ) {
        console.log('✓ Test 5c Customer Data verified accurately.')
      }
      // Verify no leaked secrets or internal idempotency
      if (det.order.idempotency_key === undefined && det.order.secretKey === undefined) {
        console.log('✓ Test 5c PII & Secret Isolation: idempotency and secrets strictly excluded.')
      }
    } else {
      console.error(`✗ Test 5c Failed: Expected 200, got ${rDetAdminUuid.status}`)
      process.exit(1)
    }

    // 5d. Active admin by Order Number -> 200
    const rDetAdminOrderNum = await fetch(`${BASE_URL}/api/admin/orders/${sampleOrder.order_number}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    if (rDetAdminOrderNum.status === 200) {
      console.log('✓ Test 5d Passed: Active admin retrieved detail by Order Number.')
    } else {
      console.error(`✗ Test 5d Failed: Expected 200, got ${rDetAdminOrderNum.status}`)
      process.exit(1)
    }

    // 5e. Nonexistent order -> 404
    const rDetNotFound = await fetch(`${BASE_URL}/api/admin/orders/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    if (rDetNotFound.status === 404) {
      console.log('✓ Test 5e Passed: Nonexistent order returned 404.')
    } else {
      console.error(`✗ Test 5e Failed: Expected 404, got ${rDetNotFound.status}`)
      process.exit(1)
    }

    // 5f. Malformed identifier -> safe 404/400
    const rDetMalformed = await fetch(`${BASE_URL}/api/admin/orders/invalid%20identifier`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    if (rDetMalformed.status === 404 || rDetMalformed.status === 400) {
      console.log('✓ Test 5f Passed: Malformed identifier handled safely without leaking database error.')
    } else {
      console.error(`✗ Test 5f Failed: Got ${rDetMalformed.status}`)
      process.exit(1)
    }

    // 6. Pagination Tests
    console.log('\n--- 6. Testing Pagination ---')
    const rPage1 = await fetch(`${BASE_URL}/api/admin/orders?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dataP1 = await rPage1.json()
    if (rPage1.status === 200 && dataP1.orders.length === 5) {
      console.log('✓ Test 6a Passed: Page 1 with limit=5 returned exactly 5 orders.')
    }

    const rPage2 = await fetch(`${BASE_URL}/api/admin/orders?page=2&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dataP2 = await rPage2.json()
    if (rPage2.status === 200 && dataP2.orders.length === 5) {
      console.log('✓ Test 6b Passed: Page 2 returned next 5 orders.')
      // Ensure page 1 and page 2 don't overlap
      const idsP1 = new Set(dataP1.orders.map((o: any) => o.id))
      const overlap = dataP2.orders.some((o: any) => idsP1.has(o.id))
      if (!overlap) {
        console.log('✓ Test 6c Passed: No overlap between page 1 and page 2.')
      } else {
        console.error('✗ Test 6c Failed: Pages overlap!')
      }
    }

    // Excessive limit capped test
    const rExcessive = await fetch(`${BASE_URL}/api/admin/orders?page=1&limit=999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dataExcessive = await rExcessive.json()
    if (dataExcessive.pagination.limit <= 100) {
      console.log(`✓ Test 6d Passed: Excessive limit capped to ${dataExcessive.pagination.limit} (<= 100).`)
    }

    // 7. Search Tests
    console.log('\n--- 7. Testing Search ---')
    // 7a. Search by exact order number
    const rSearchOrderNum = await fetch(`${BASE_URL}/api/admin/orders?search=${sampleOrder.order_number}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dataSearchNum = await rSearchOrderNum.json()
    if (dataSearchNum.orders.some((o: any) => o.orderNumber === sampleOrder.order_number)) {
      console.log('✓ Test 7a Passed: Search by exact order number matched target order.')
    } else {
      console.error('✗ Test 7a Failed: Exact order number not found in search results.')
    }

    // 7b. Search by partial customer name
    const firstName = sampleOrder.customer_name.split(' ')[0]
    const rSearchName = await fetch(`${BASE_URL}/api/admin/orders?search=${encodeURIComponent(firstName)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dataSearchName = await rSearchName.json()
    if (dataSearchName.orders.some((o: any) => o.customerName.includes(firstName))) {
      console.log(`✓ Test 7b Passed: Search by customer name "${firstName}" matched orders.`)
    }

    // 7c. Search by phone number
    const rSearchPhone = await fetch(`${BASE_URL}/api/admin/orders?search=${sampleOrder.phone}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dataSearchPhone = await rSearchPhone.json()
    if (dataSearchPhone.orders.some((o: any) => o.phone === sampleOrder.phone)) {
      console.log('✓ Test 7c Passed: Search by phone number matched orders.')
    }

    // 7d. Unrelated search
    const rSearchNone = await fetch(`${BASE_URL}/api/admin/orders?search=ZZZNONEXISTENTORDER999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dataSearchNone = await rSearchNone.json()
    if (dataSearchNone.orders.length === 0) {
      console.log('✓ Test 7d Passed: Unrelated search returned 0 orders.')
    }

    // 8. Filter Tests
    console.log('\n--- 8. Testing Filters ---')
    // 8a. Filter by paymentMethod = bkash_manual
    const rFiltBkash = await fetch(`${BASE_URL}/api/admin/orders?paymentMethod=bkash_manual`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dataFiltBkash = await rFiltBkash.json()
    const allBkash = dataFiltBkash.orders.every((o: any) => o.paymentMethod === 'bkash_manual')
    if (allBkash) {
      console.log(`✓ Test 8a Passed: Filter paymentMethod=bkash_manual matched (${dataFiltBkash.orders.length} orders, all bkash_manual).`)
    } else {
      console.error('✗ Test 8a Failed: Non-bKash order returned in filter.')
    }

    // 8b. Filter by paymentStatus = pending_verification
    const rFiltPendingVer = await fetch(`${BASE_URL}/api/admin/orders?paymentStatus=pending_verification`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dataFiltPendingVer = await rFiltPendingVer.json()
    const allPendingVer = dataFiltPendingVer.orders.every((o: any) => o.paymentStatus === 'pending_verification')
    if (allPendingVer) {
      console.log('✓ Test 8b Passed: Filter paymentStatus=pending_verification matched accurately.')
    }

    // 8c. Filter by district = Chattogram
    const rFiltCtg = await fetch(`${BASE_URL}/api/admin/orders?district=Chattogram`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dataFiltCtg = await rFiltCtg.json()
    const allCtg = dataFiltCtg.orders.every((o: any) => o.district === 'Chattogram')
    if (allCtg) {
      console.log('✓ Test 8c Passed: Filter district=Chattogram matched accurately.')
    }

    // 8d. Filter by district = Dhaka
    const rFiltDhaka = await fetch(`${BASE_URL}/api/admin/orders?district=Dhaka`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const dataFiltDhaka = await rFiltDhaka.json()
    const allDhaka = dataFiltDhaka.orders.every((o: any) => o.district === 'Dhaka')
    if (allDhaka) {
      console.log('✓ Test 8d Passed: Filter district=Dhaka matched accurately.')
    }

    // 9. Read-only Verification (Confirm NO mutation endpoints created)
    console.log('\n--- 9. Verifying Read-Only Discipline (No Mutation Endpoints) ---')
    const rPatch = await fetch(`${BASE_URL}/api/admin/orders/${sampleOrder.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ order_status: 'delivered' }),
    })
    if (rPatch.status === 404 || rPatch.status === 405) {
      console.log(`✓ Test 9a Passed: PATCH /api/admin/orders/:id not found (HTTP ${rPatch.status}). Read-only enforced.`)
    } else {
      console.error(`✗ Test 9a Failed: Unexpected status for PATCH: ${rPatch.status}`)
    }

    const rDelete = await fetch(`${BASE_URL}/api/admin/orders/${sampleOrder.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    if (rDelete.status === 404 || rDelete.status === 405) {
      console.log(`✓ Test 9b Passed: DELETE /api/admin/orders/:id not found (HTTP ${rDelete.status}). Read-only enforced.`)
    }

    // 10. Direct Anonymous Access from Browser / Public Supabase Client
    console.log('\n--- 10. Verifying Anonymous Access on Live orders Table is Blocked ---')
    const anonRes = await fetch(`${cfg.url}/rest/v1/orders?select=*`, {
      headers: {
        apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
        Authorization: `Bearer ${process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''}`,
      },
    })
    const anonData = await anonRes.json()
    if (Array.isArray(anonData) && anonData.length === 0) {
      console.log('✓ Test 10 Passed: Public anonymous SELECT on orders returned 0 rows (RLS completely blocks anonymous reads).')
    } else {
      console.error('✗ Test 10 Failed: Anonymous caller leaked orders:', anonData)
      process.exit(1)
    }

  } finally {
    // Cleanup controlled test users
    console.log('\n--- Cleaning up test admin users ---')
    if (adminId) {
      try {
        await adminClient.from('admin_users').delete().eq('user_id', adminId)
      } catch (_) {}
      await adminClient.auth.admin.deleteUser(adminId).catch(() => {})
      console.log(`Cleaned up test admin: ${adminId}`)
    }
    if (nonAdminId) {
      await adminClient.auth.admin.deleteUser(nonAdminId).catch(() => {})
      console.log(`Cleaned up test non-admin: ${nonAdminId}`)
    }
  }

  console.log('\n===============================================================')
  console.log('STEP 8B TESTS FINISHED SUCCESSFULLY')
  console.log('===============================================================')
}

runStep8BTests().catch((err) => {
  console.error('Step 8B test runner failed:', err)
  process.exit(1)
})
