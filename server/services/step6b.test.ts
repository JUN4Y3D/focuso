import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { getSupabaseAdmin } from '../lib/supabaseAdmin'

const BASE_URL = 'http://localhost:3000'

async function runStep6BEndToEndTests() {
  console.log('===============================================================')
  console.log('FOCUSO Step 6B Production-Style End-to-End Test Suite')
  console.log('===============================================================\n')

  const admin = getSupabaseAdmin()
  if (!admin) {
    throw new Error('Supabase admin client unavailable for tests.')
  }

  const createdOrderNumbers: string[] = []
  const createdIdempotencyKeys: string[] = []

  try {
    // -------------------------------------------------------------------------
    // Test 1: Chattogram, No coupon
    // Qty: 1
    // Expected: Subtotal ৳250, Delivery ৳60, Total ৳310
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Test 1: Chattogram, No Coupon ---')
    const idemp1 = crypto.randomUUID()
    createdIdempotencyKeys.push(idemp1)

    const payload1 = {
      customerName: 'Tanvir Chowdhury',
      phone: '01812345678',
      district: 'Chattogram',
      deliveryArea: 'Agrabad Commercial Area',
      deliveryAddress: 'House 14, Road 3, Agrabad',
      quantity: 1,
      customerNote: 'Please call before delivery',
      idempotencyKey: idemp1,
    }

    const res1 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload1),
    })

    assert.equal(res1.status, 201, `Expected status 201, got ${res1.status}`)
    const data1 = await res1.json()
    createdOrderNumbers.push(data1.orderNumber)

    assert.equal(data1.quantity, 1)
    assert.equal(data1.productSubtotal, 250)
    assert.equal(data1.deliveryCharge, 60)
    assert.equal(data1.finalTotal, 310)
    assert.equal(data1.paymentMethod, 'cod')
    assert.equal(data1.paymentStatus, 'unpaid')
    assert.equal(data1.orderStatus, 'pending')

    // Direct database verification
    const { data: dbRow1, error: dbErr1 } = await admin
      .from('orders')
      .select('*')
      .eq('order_number', data1.orderNumber)
      .single()

    assert.ifError(dbErr1)
    assert.equal(dbRow1.customer_name, 'Tanvir Chowdhury')
    assert.equal(dbRow1.phone, '01812345678')
    assert.equal(dbRow1.delivery_zone, 'inside_chattogram')
    assert.equal(dbRow1.delivery_area, 'Agrabad Commercial Area')
    assert.equal(dbRow1.delivery_address, 'House 14, Road 3, Agrabad')
    assert.equal(dbRow1.unit_price, 250)
    assert.equal(dbRow1.product_subtotal, 250)
    assert.equal(dbRow1.delivery_charge, 60)
    assert.equal(dbRow1.coupon_discount, 0)
    assert.equal(dbRow1.final_total, 310)
    assert.equal(dbRow1.payment_method, 'cod')
    assert.equal(dbRow1.payment_status, 'unpaid')
    assert.equal(dbRow1.order_status, 'pending')
    assert.equal(dbRow1.idempotency_key, idemp1)
    console.log(`✓ Test 1 Passed: Order ${data1.orderNumber} confirmed in Supabase (৳250 + ৳60 = ৳310).`)

    // -------------------------------------------------------------------------
    // Test 2: Dhaka, No coupon
    // Qty: 1
    // Expected: Subtotal ৳250, Delivery ৳100, Total ৳350
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Test 2: Dhaka, No Coupon ---')
    const idemp2 = crypto.randomUUID()
    createdIdempotencyKeys.push(idemp2)

    const payload2 = {
      customerName: 'Nusrat Jahan',
      phone: '+8801712345678', // test phone with +88 prefix
      district: 'Dhaka',
      deliveryArea: 'Dhanmondi',
      deliveryAddress: 'House 8, Road 27, Dhanmondi',
      quantity: 1,
      idempotencyKey: idemp2,
    }

    const res2 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload2),
    })

    assert.equal(res2.status, 201)
    const data2 = await res2.json()
    createdOrderNumbers.push(data2.orderNumber)

    assert.equal(data2.quantity, 1)
    assert.equal(data2.productSubtotal, 250)
    assert.equal(data2.deliveryCharge, 100)
    assert.equal(data2.finalTotal, 350)

    const { data: dbRow2, error: dbErr2 } = await admin
      .from('orders')
      .select('*')
      .eq('order_number', data2.orderNumber)
      .single()

    assert.ifError(dbErr2)
    assert.equal(dbRow2.customer_name, 'Nusrat Jahan')
    assert.equal(dbRow2.phone, '01712345678') // normalized
    assert.equal(dbRow2.delivery_zone, 'outside_chattogram')
    assert.equal(dbRow2.delivery_area, 'Dhanmondi')
    assert.equal(dbRow2.delivery_address, 'House 8, Road 27, Dhanmondi')
    assert.equal(dbRow2.delivery_charge, 100)
    assert.equal(dbRow2.final_total, 350)
    console.log(`✓ Test 2 Passed: Order ${data2.orderNumber} confirmed in Supabase (৳250 + ৳100 = ৳350).`)

    // -------------------------------------------------------------------------
    // Test 3: Chattogram + FOCUS25
    // Qty: 1
    // Expected: Subtotal ৳250, Discount ৳62, Delivery ৳60, Total ৳248
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Test 3: Chattogram + FOCUS25 ---')
    const idemp3 = crypto.randomUUID()
    createdIdempotencyKeys.push(idemp3)

    const payload3 = {
      customerName: 'Shakil Ahmed',
      phone: '01912345678',
      district: 'Chattogram',
      deliveryArea: 'Nasirabad',
      deliveryAddress: 'Road 5, House 12',
      quantity: 1,
      couponCode: 'FOCUS25',
      idempotencyKey: idemp3,
    }

    const res3 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload3),
    })

    assert.equal(res3.status, 201)
    const data3 = await res3.json()
    createdOrderNumbers.push(data3.orderNumber)

    assert.equal(data3.quantity, 1)
    assert.equal(data3.productSubtotal, 250)
    assert.equal(data3.coupon.code, 'FOCUS25')
    assert.equal(data3.coupon.discountAmount, 62)
    assert.equal(data3.deliveryCharge, 60)
    assert.equal(data3.finalTotal, 248)

    const { data: dbRow3, error: dbErr3 } = await admin
      .from('orders')
      .select('*')
      .eq('order_number', data3.orderNumber)
      .single()

    assert.ifError(dbErr3)
    assert.equal(dbRow3.coupon_code, 'FOCUS25')
    assert.equal(dbRow3.coupon_discount, 62)
    assert.equal(dbRow3.delivery_charge, 60)
    assert.equal(dbRow3.final_total, 248)
    console.log(`✓ Test 3 Passed: Order ${data3.orderNumber} confirmed in Supabase (৳250 - ৳62 + ৳60 = ৳248).`)

    // -------------------------------------------------------------------------
    // Test 4: Dhaka + FOCUS25
    // Qty: 2
    // Expected: Subtotal ৳500, Discount ৳125, Delivery ৳100, Total ৳475
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Test 4: Dhaka qty 2 + FOCUS25 ---')
    const idemp4 = crypto.randomUUID()
    createdIdempotencyKeys.push(idemp4)

    const payload4 = {
      customerName: 'Farhan Kabir',
      phone: '01612345678',
      district: 'Dhaka',
      deliveryArea: 'Uttara Sector 7',
      deliveryAddress: 'House 22, Road 1',
      quantity: 2,
      couponCode: 'FOCUS25',
      idempotencyKey: idemp4,
    }

    const res4 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload4),
    })

    assert.equal(res4.status, 201)
    const data4 = await res4.json()
    createdOrderNumbers.push(data4.orderNumber)

    assert.equal(data4.quantity, 2)
    assert.equal(data4.productSubtotal, 500)
    assert.equal(data4.coupon.code, 'FOCUS25')
    assert.equal(data4.coupon.discountAmount, 125)
    assert.equal(data4.deliveryCharge, 100)
    assert.equal(data4.finalTotal, 475)

    const { data: dbRow4, error: dbErr4 } = await admin
      .from('orders')
      .select('*')
      .eq('order_number', data4.orderNumber)
      .single()

    assert.ifError(dbErr4)
    assert.equal(dbRow4.quantity, 2)
    assert.equal(dbRow4.product_subtotal, 500)
    assert.equal(dbRow4.coupon_code, 'FOCUS25')
    assert.equal(dbRow4.coupon_discount, 125)
    assert.equal(dbRow4.delivery_charge, 100)
    assert.equal(dbRow4.final_total, 475)
    console.log(`✓ Test 4 Passed: Order ${data4.orderNumber} confirmed in Supabase (৳500 - ৳125 + ৳100 = ৳475).`)

    // -------------------------------------------------------------------------
    // Test 5: Double-Click / Race Condition Test
    // Simultaneous submissions with the same idempotency key
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Double-Click / Race Condition Protection ---')
    const idempDouble = crypto.randomUUID()
    createdIdempotencyKeys.push(idempDouble)

    const doublePayload = {
      customerName: 'Double Clicker',
      phone: '01512345678',
      district: 'Chattogram',
      deliveryArea: 'GEC Circle',
      deliveryAddress: 'Finlay Square',
      quantity: 1,
      couponCode: 'FOCUS25',
      idempotencyKey: idempDouble,
    }

    // Trigger two requests simultaneously
    const [resDouble1, resDouble2] = await Promise.all([
      fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doublePayload),
      }),
      fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doublePayload),
      }),
    ])

    const dataDouble1 = await resDouble1.json()
    const dataDouble2 = await resDouble2.json()

    // Both should be successful (one 201, one 200/201), with the exact same order number
    assert.ok(resDouble1.status === 201 || resDouble1.status === 200)
    assert.ok(resDouble2.status === 201 || resDouble2.status === 200)
    assert.equal(dataDouble1.orderNumber, dataDouble2.orderNumber)
    createdOrderNumbers.push(dataDouble1.orderNumber)

    // Check count in database for this idempotency key
    const { data: doubleRows } = await admin
      .from('orders')
      .select('id, order_number')
      .eq('idempotency_key', idempDouble)

    assert.equal(doubleRows?.length, 1, 'Database must contain exactly 1 order row')
    console.log(`✓ Double-Click Test Passed: Exactly 1 row created in Supabase (Order: ${dataDouble1.orderNumber}).`)

    // -------------------------------------------------------------------------
    // Test 6: Network Retry / Idempotency Test
    // Repeat submission of exact same order
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Network Retry / Idempotency Test ---')
    const retryRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doublePayload),
    })

    assert.equal(retryRes.status, 200, 'Idempotent retry should return HTTP 200 OK')
    const retryData = await retryRes.json()
    assert.equal(retryData.orderNumber, dataDouble1.orderNumber)
    assert.equal(retryData.isDuplicate, true)
    console.log(`✓ Network Retry Test Passed: Returned existing order ${retryData.orderNumber} without duplicate.`)

    // -------------------------------------------------------------------------
    // Test 7: Malicious Financial Injection Test
    // Attempting to send manipulated financial parameters
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Price & Financial Manipulation Injection ---')
    const idempMal = crypto.randomUUID()
    const malRes = await fetch(`${BASE_URL}/api/orders`, {
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
        deliveryCharge: 0,
        couponDiscount: 9999,
        finalTotal: 1,
        paymentStatus: 'paid',
      }),
    })

    assert.equal(malRes.status, 400, 'Must reject unexpected financial keys with HTTP 400')
    const malData = await malRes.json()
    console.log(`✓ Manipulation Test Passed: Rejected with HTTP 400 (${malData.error})`)

    // Verify no order created
    const { data: malCheck } = await admin
      .from('orders')
      .select('id')
      .eq('idempotency_key', idempMal)
    assert.equal(malCheck?.length || 0, 0)
    console.log('✓ Verified: Zero rows created in Supabase for malicious attempt.')

    // -------------------------------------------------------------------------
    // Cleanup Test Data
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up controlled test orders ---')
    for (const num of createdOrderNumbers) {
      await admin.from('orders').delete().eq('order_number', num)
    }
    for (const k of createdIdempotencyKeys) {
      await admin.from('admin_audit_log').delete().eq('entity_id', k)
    }
    console.log('✓ Cleaned up test orders cleanly.')

    console.log('\n===============================================================')
    console.log('ALL STEP 6B PRODUCTION TESTS COMPLETED SUCCESSFULLY!')
    console.log('===============================================================\n')
  } catch (e) {
    console.error('Test Suite Failed:', e)
    process.exit(1)
  }
}

runStep6BEndToEndTests()
