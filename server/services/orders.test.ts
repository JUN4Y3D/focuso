import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { getSupabaseAdmin } from '../lib/supabaseAdmin'

const BASE_URL = 'http://localhost:3000'

async function runStep6ATests() {
  console.log('Starting FOCUSO Step 6A Comprehensive Order API Tests...\n')
  const admin = getSupabaseAdmin()
  if (!admin) {
    throw new Error('Supabase admin client unavailable for test suite.')
  }

  const createdOrderIds: string[] = []
  const createdAuditIds: string[] = []

  try {
    // -------------------------------------------------------------------------
    // 1. Valid Order Tests (Tests A, B, C, D)
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Valid Order Scenarios ---')

    // Test A: Qty 1, Chattogram, No coupon -> Subtotal ৳250, Delivery ৳60, Total ৳310
    const idempA = crypto.randomUUID()
    const resA = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Junayed Ahmed',
        phone: '01812345678',
        district: 'Chattogram',
        deliveryArea: 'Agrabad',
        deliveryAddress: 'House 12, Road 4, Agrabad C/A',
        quantity: 1,
        idempotencyKey: idempA,
      }),
    })
    const dataA = await resA.json()
    assert.equal(resA.status, 201, `Test A status expected 201, got ${resA.status}`)
    assert.equal(dataA.productSubtotal, 250)
    assert.equal(dataA.deliveryCharge, 60)
    assert.equal(dataA.finalTotal, 310)
    assert.equal(dataA.paymentMethod, 'cod')
    assert.equal(dataA.paymentStatus, 'unpaid')
    assert.equal(dataA.orderStatus, 'pending')
    assert.match(dataA.orderNumber, /^FCS-[2-9A-HJ-NP-Z]{8}$/)
    console.log('✓ Test A Passed: Qty 1 + Chattogram -> ৳250 + ৳60 = ৳310 (Order:', dataA.orderNumber, ')')

    // Test B: Qty 1, Dhaka, No coupon -> Subtotal ৳250, Delivery ৳100, Total ৳350
    const idempB = crypto.randomUUID()
    const resB = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Mohammad Rahim',
        phone: '+8801712345678', // with +88 prefix
        district: 'Dhaka',
        deliveryArea: 'Mirpur-10',
        deliveryAddress: 'Plot 5, Block C, Mirpur',
        quantity: 1,
        idempotencyKey: idempB,
      }),
    })
    const dataB = await resB.json()
    assert.equal(resB.status, 201)
    assert.equal(dataB.productSubtotal, 250)
    assert.equal(dataB.deliveryCharge, 100)
    assert.equal(dataB.finalTotal, 350)
    console.log('✓ Test B Passed: Qty 1 + Dhaka (+8801 phone) -> ৳250 + ৳100 = ৳350 (Order:', dataB.orderNumber, ')')

    // Test C: Qty 1, Chattogram, Coupon: FOCUS25 -> Subtotal ৳250, Discount ৳62, Delivery ৳60, Total ৳248
    const idempC = crypto.randomUUID()
    const resC = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Fatima Begum',
        phone: '8801912345678', // with 88 prefix
        district: 'Chattogram',
        deliveryArea: 'GEC Circle',
        deliveryAddress: 'House 45, Road 2, Nasirabad',
        quantity: 1,
        couponCode: 'focus25', // lowercase normalization test
        idempotencyKey: idempC,
      }),
    })
    const dataC = await resC.json()
    assert.equal(resC.status, 201)
    assert.equal(dataC.productSubtotal, 250)
    assert.equal(dataC.coupon.code, 'FOCUS25')
    assert.equal(dataC.coupon.discountAmount, 62)
    assert.equal(dataC.deliveryCharge, 60)
    assert.equal(dataC.finalTotal, 248)
    console.log('✓ Test C Passed: Qty 1 + Chattogram + FOCUS25 -> ৳250 - ৳62 + ৳60 = ৳248 (Order:', dataC.orderNumber, ')')

    // Test D: Qty 2, Dhaka, Coupon: FOCUS25 -> Subtotal ৳500, Discount ৳125, Delivery ৳100, Total ৳475
    const idempD = crypto.randomUUID()
    const resD = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Tariq Hasan',
        phone: '01612345678',
        district: 'Dhaka',
        deliveryArea: 'Dhanmondi',
        deliveryAddress: 'House 14, Road 27, Dhanmondi',
        quantity: 2,
        couponCode: 'FOCUS25',
        idempotencyKey: idempD,
      }),
    })
    const dataD = await resD.json()
    assert.equal(resD.status, 201)
    assert.equal(dataD.productSubtotal, 500)
    assert.equal(dataD.coupon.code, 'FOCUS25')
    assert.equal(dataD.coupon.discountAmount, 125)
    assert.equal(dataD.deliveryCharge, 100)
    assert.equal(dataD.finalTotal, 475)
    console.log('✓ Test D Passed: Qty 2 + Dhaka + FOCUS25 -> ৳500 - ৳125 + ৳100 = ৳475 (Order:', dataD.orderNumber, ')')

    // -------------------------------------------------------------------------
    // 2. Pricing Manipulation / Financial Field Injection Tests
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Malicious Financial Field Injection ---')
    const idempMal = crypto.randomUUID()
    const resMal = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Attacker',
        phone: '01812345678',
        district: 'Chattogram',
        deliveryArea: 'Agrabad',
        deliveryAddress: 'Somewhere',
        quantity: 1,
        idempotencyKey: idempMal,
        unitPrice: 1,
        productSubtotal: 1,
        deliveryCharge: 0,
        couponDiscount: 9999,
        finalTotal: 1,
      }),
    })
    assert.equal(resMal.status, 400, 'Expected 400 for unexpected financial keys')
    const dataMal = await resMal.json()
    console.log('✓ Malicious financial fields strictly rejected with HTTP 400:', dataMal.error)

    // -------------------------------------------------------------------------
    // 3. Invalid Order Validation Tests
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Field Validation & Edge Cases ---')

    const invalidCases = [
      { name: 'Missing customer name', body: { phone: '01812345678', district: 'Dhaka', deliveryArea: 'Mirpur', deliveryAddress: 'House 1', quantity: 1, idempotencyKey: crypto.randomUUID() } },
      { name: 'Invalid phone prefix (012)', body: { customerName: 'Test', phone: '01212345678', district: 'Dhaka', deliveryArea: 'Mirpur', deliveryAddress: 'House 1', quantity: 1, idempotencyKey: crypto.randomUUID() } },
      { name: 'Invalid phone length (10 digits)', body: { customerName: 'Test', phone: '0181234567', district: 'Dhaka', deliveryArea: 'Mirpur', deliveryAddress: 'House 1', quantity: 1, idempotencyKey: crypto.randomUUID() } },
      { name: 'Missing district', body: { customerName: 'Test', phone: '01812345678', deliveryArea: 'Mirpur', deliveryAddress: 'House 1', quantity: 1, idempotencyKey: crypto.randomUUID() } },
      { name: 'Invalid district (Random City)', body: { customerName: 'Test', phone: '01812345678', district: 'New York', deliveryArea: 'Mirpur', deliveryAddress: 'House 1', quantity: 1, idempotencyKey: crypto.randomUUID() } },
      { name: 'Missing delivery address', body: { customerName: 'Test', phone: '01812345678', district: 'Dhaka', deliveryArea: 'Mirpur', quantity: 1, idempotencyKey: crypto.randomUUID() } },
      { name: 'Quantity 0', body: { customerName: 'Test', phone: '01812345678', district: 'Dhaka', deliveryArea: 'Mirpur', deliveryAddress: 'House 1', quantity: 0, idempotencyKey: crypto.randomUUID() } },
      { name: 'Quantity 10 (>9)', body: { customerName: 'Test', phone: '01812345678', district: 'Dhaka', deliveryArea: 'Mirpur', deliveryAddress: 'House 1', quantity: 10, idempotencyKey: crypto.randomUUID() } },
      { name: 'Fractional quantity (1.5)', body: { customerName: 'Test', phone: '01812345678', district: 'Dhaka', deliveryArea: 'Mirpur', deliveryAddress: 'House 1', quantity: 1.5, idempotencyKey: crypto.randomUUID() } },
      { name: 'Old coupon FOCUSO50', body: { customerName: 'Test', phone: '01812345678', district: 'Dhaka', deliveryArea: 'Mirpur', deliveryAddress: 'House 1', quantity: 1, couponCode: 'FOCUSO50', idempotencyKey: crypto.randomUUID() } },
      { name: 'Random invalid coupon TEST99', body: { customerName: 'Test', phone: '01812345678', district: 'Dhaka', deliveryArea: 'Mirpur', deliveryAddress: 'House 1', quantity: 1, couponCode: 'TEST99', idempotencyKey: crypto.randomUUID() } },
      { name: 'Malformed idempotency key (not UUID)', body: { customerName: 'Test', phone: '01812345678', district: 'Dhaka', deliveryArea: 'Mirpur', deliveryAddress: 'House 1', quantity: 1, idempotencyKey: 'not-a-uuid' } },
    ]

    for (const testCase of invalidCases) {
      const res = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.body),
      })
      assert.equal(res.status, 400, `Expected 400 for ${testCase.name}, got ${res.status}`)
      const errJson = await res.json()
      console.log(`✓ Rejected invalid: ${testCase.name} -> ${errJson.error}`)
    }

    // -------------------------------------------------------------------------
    // 4. Idempotency & Conflict Tests
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Idempotency & Retry Semantics ---')
    const idempTest = crypto.randomUUID()
    const orderPayload = {
      customerName: 'Idempotency Tester',
      phone: '01811223344',
      district: 'Chattogram',
      deliveryArea: 'Agrabad',
      deliveryAddress: 'Test Office, Floor 3',
      quantity: 1,
      idempotencyKey: idempTest,
    }

    // First call: creates order
    const firstRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    })
    assert.equal(firstRes.status, 201)
    const firstData = await firstRes.json()

    // Second call: exact same request with same idempotency key
    const secondRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    })
    assert.equal(secondRes.status, 200, 'Expected 200 for idempotent duplicate retry')
    const secondData = await secondRes.json()
    assert.equal(secondData.orderNumber, firstData.orderNumber)
    assert.equal(secondData.finalTotal, firstData.finalTotal)
    assert.equal(secondData.isDuplicate, true)
    console.log('✓ Idempotent Retry Succeeded: Returned exact same order without creating duplicate row.')

    // Third call: conflicting request reusing the same idempotency key with different quantity
    const conflictRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...orderPayload,
        quantity: 2, // altered!
      }),
    })
    assert.equal(conflictRes.status, 409, 'Expected 409 Conflict for mismatched idempotency reuse')
    const conflictData = await conflictRes.json()
    console.log('✓ Conflicting Idempotency Key Rejected with HTTP 409:', conflictData.error)

    // -------------------------------------------------------------------------
    // 5. Coupon Usage Increment & Atomicity Tests
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Coupon Usage Count Increment & Atomicity ---')

    // Read current usage_count of FOCUS25
    const { data: initialCoupon } = await admin
      .from('coupons')
      .select('usage_count')
      .eq('code', 'FOCUS25')
      .single()

    const initialUsage = initialCoupon?.usage_count || 0
    console.log('Initial FOCUS25 usage_count in Supabase:', initialUsage)

    // Create a new order with FOCUS25
    const idempCouponOrder = crypto.randomUUID()
    const couponOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Coupon User',
        phone: '01899887766',
        district: 'Chattogram',
        deliveryArea: 'Panchlaish',
        deliveryAddress: 'Road 5, House 10',
        quantity: 1,
        couponCode: 'FOCUS25',
        idempotencyKey: idempCouponOrder,
      }),
    })
    assert.equal(couponOrderRes.status, 201)
    const couponOrderData = await couponOrderRes.json()

    // Verify usage_count increased by exactly 1
    const { data: afterCoupon } = await admin
      .from('coupons')
      .select('usage_count')
      .eq('code', 'FOCUS25')
      .single()

    const afterUsage = afterCoupon?.usage_count || 0
    assert.equal(afterUsage, initialUsage + 1, `Expected usage_count ${initialUsage + 1}, got ${afterUsage}`)
    console.log(`✓ Successful order consumed coupon: usage_count incremented from ${initialUsage} to ${afterUsage}`)

    // Idempotent retry of the exact same order
    const retryCouponOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Coupon User',
        phone: '01899887766',
        district: 'Chattogram',
        deliveryArea: 'Panchlaish',
        deliveryAddress: 'Road 5, House 10',
        quantity: 1,
        couponCode: 'FOCUS25',
        idempotencyKey: idempCouponOrder,
      }),
    })
    assert.equal(retryCouponOrderRes.status, 200)

    // Verify usage_count did NOT increment on retry
    const { data: retryCoupon } = await admin
      .from('coupons')
      .select('usage_count')
      .eq('code', 'FOCUS25')
      .single()

    assert.equal(retryCoupon?.usage_count, afterUsage)
    console.log('✓ Idempotent retry did NOT increment coupon usage again (remains ' + retryCoupon?.usage_count + ')')

    // -------------------------------------------------------------------------
    // 6. Safe Test Cleanup (Remove test orders created during this test run)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Test Data Cleanup ---')
    const testKeys = [idempA, idempB, idempC, idempD, idempTest, idempCouponOrder]
    for (const k of testKeys) {
      // Clean audit lock
      await admin.from('admin_audit_log').delete().eq('entity_id', k)
    }

    // Clean test orders by matching the generated order numbers
    const testOrderNumbers = [
      dataA.orderNumber,
      dataB.orderNumber,
      dataC.orderNumber,
      dataD.orderNumber,
      firstData.orderNumber,
      couponOrderData.orderNumber,
    ]
    for (const num of testOrderNumbers) {
      await admin.from('orders').delete().eq('order_number', num)
    }

    // Restore coupon usage count to original
    await admin.from('coupons').update({ usage_count: initialUsage }).eq('code', 'FOCUS25')
    console.log('✓ Safe test cleanup complete: Test orders removed and coupon usage_count reset.')

    console.log('\n======================================================')
    console.log('ALL STEP 6A TESTS COMPLETED SUCCESSFULLY!')
    console.log('======================================================')
  } catch (err) {
    console.error('\n❌ Test failure:', err)
    process.exit(1)
  }
}

runStep6ATests()
