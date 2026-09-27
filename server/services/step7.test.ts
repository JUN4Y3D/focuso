import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { getSupabaseAdmin } from '../lib/supabaseAdmin'

const BASE_URL = 'http://localhost:3000'

async function runStep7TestSuite() {
  console.log('===============================================================')
  console.log('FOCUSO Step 7 Comprehensive Manual bKash & COD Test Suite')
  console.log('===============================================================\n')

  const admin = getSupabaseAdmin()
  if (!admin) {
    throw new Error('Supabase admin client unavailable for tests.')
  }

  const createdOrderNumbers: string[] = []
  const createdIdempotencyKeys: string[] = []

  try {
    // -------------------------------------------------------------------------
    // Test 0: Payment Config Endpoint
    // -------------------------------------------------------------------------
    console.log('--- 0. Testing GET /api/payment-config ---')
    const configRes = await fetch(`${BASE_URL}/api/payment-config`)
    assert.equal(configRes.status, 200)
    const configData = await configRes.json()
    assert.equal(configData.bkashManualEnabled, true)
    assert.ok(typeof configData.bkashNumber === 'string' && configData.bkashNumber.length >= 11)
    // Verify no secret leak
    assert.equal(configData.supabaseKey, undefined)
    assert.equal(configData.secretKey, undefined)
    assert.equal(configData.geminiApiKey, undefined)
    console.log('✓ Test 0 Passed: /api/payment-config returned public info safely.')

    // -------------------------------------------------------------------------
    // Test 1: Existing COD Flow — Chattogram + No Coupon
    // Qty: 1
    // Expected: Subtotal ৳250, Delivery ৳60, Total ৳310, payment_method: cod, payment_status: unpaid
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing COD Flow: Chattogram, No Coupon ---')
    const idempCod = crypto.randomUUID()
    createdIdempotencyKeys.push(idempCod)

    const payloadCod = {
      customerName: 'Jahangir Alam',
      phone: '01812345678',
      district: 'Chattogram',
      deliveryArea: 'GEC Circle',
      deliveryAddress: 'Hillview R/A, Road 2',
      quantity: 1,
      paymentMethod: 'cod',
      idempotencyKey: idempCod,
    }

    const resCod = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadCod),
    })

    assert.equal(resCod.status, 201)
    const dataCod = await resCod.json()
    createdOrderNumbers.push(dataCod.orderNumber)

    assert.equal(dataCod.finalTotal, 310)
    assert.equal(dataCod.paymentMethod, 'cod')
    assert.equal(dataCod.paymentStatus, 'unpaid')
    assert.equal(dataCod.orderStatus, 'pending')

    const { data: dbCodRow } = await admin
      .from('orders')
      .select('*')
      .eq('order_number', dataCod.orderNumber)
      .single()

    assert.equal(dbCodRow.payment_method, 'cod')
    assert.equal(dbCodRow.payment_status, 'unpaid')
    assert.equal(dbCodRow.final_total, 310)
    assert.equal(dbCodRow.bkash_transaction_id, null)
    console.log(`✓ Test 1 Passed: COD order ${dataCod.orderNumber} confirmed with unpaid status (Total: ৳310).`)

    // -------------------------------------------------------------------------
    // Test 2: bKash Manual — Chattogram + No Coupon
    // Qty: 1, Dist: Chattogram
    // Expected: Total ৳310, payment_method: bkash_manual, payment_status: pending_verification
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing bKash Manual: Chattogram, No Coupon ---')
    const idempBkash1 = crypto.randomUUID()
    createdIdempotencyKeys.push(idempBkash1)
    const testTrxId1 = 'TRX' + Math.random().toString(36).slice(2, 9).toUpperCase()

    const payloadBkash1 = {
      customerName: 'Mustafa Kamal',
      phone: '01712345678',
      district: 'Chattogram',
      deliveryArea: 'Agrabad',
      deliveryAddress: 'House 5, Road 1',
      quantity: 1,
      paymentMethod: 'bkash_manual',
      bkashTransactionId: testTrxId1,
      idempotencyKey: idempBkash1,
    }

    const resBkash1 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadBkash1),
    })

    assert.equal(resBkash1.status, 201)
    const dataBkash1 = await resBkash1.json()
    createdOrderNumbers.push(dataBkash1.orderNumber)

    assert.equal(dataBkash1.finalTotal, 310)
    assert.equal(dataBkash1.paymentMethod, 'bkash_manual')
    assert.equal(dataBkash1.paymentStatus, 'pending_verification')
    assert.equal(dataBkash1.bkashTransactionId, testTrxId1)

    const { data: dbBkashRow1 } = await admin
      .from('orders')
      .select('*')
      .eq('order_number', dataBkash1.orderNumber)
      .single()

    assert.equal(dbBkashRow1.payment_method, 'bkash_manual')
    assert.equal(dbBkashRow1.payment_status, 'pending_verification')
    assert.equal(dbBkashRow1.bkash_transaction_id, testTrxId1)
    assert.equal(dbBkashRow1.final_total, 310)
    console.log(`✓ Test 2 Passed: bKash order ${dataBkash1.orderNumber} confirmed with pending_verification (Total: ৳310).`)

    // -------------------------------------------------------------------------
    // Test 3: bKash Manual + FOCUS25 (Chattogram)
    // Qty: 1
    // Expected: Subtotal ৳250, Discount ৳62, Delivery ৳60, Total ৳248
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing bKash Manual + FOCUS25 ---')
    const idempBkash2 = crypto.randomUUID()
    createdIdempotencyKeys.push(idempBkash2)
    const testTrxId2 = 'TRX' + Math.random().toString(36).slice(2, 9).toUpperCase()

    const payloadBkash2 = {
      customerName: 'Samira Anjum',
      phone: '01912345678',
      district: 'Chattogram',
      deliveryArea: 'Nasirabad',
      deliveryAddress: 'Housing Society',
      quantity: 1,
      couponCode: 'FOCUS25',
      paymentMethod: 'bkash_manual',
      bkashTransactionId: testTrxId2,
      idempotencyKey: idempBkash2,
    }

    const resBkash2 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadBkash2),
    })

    assert.equal(resBkash2.status, 201)
    const dataBkash2 = await resBkash2.json()
    createdOrderNumbers.push(dataBkash2.orderNumber)

    assert.equal(dataBkash2.quantity, 1)
    assert.equal(dataBkash2.productSubtotal, 250)
    assert.equal(dataBkash2.coupon.code, 'FOCUS25')
    assert.equal(dataBkash2.coupon.discountAmount, 62)
    assert.equal(dataBkash2.deliveryCharge, 60)
    assert.equal(dataBkash2.finalTotal, 248)
    assert.equal(dataBkash2.paymentMethod, 'bkash_manual')
    assert.equal(dataBkash2.paymentStatus, 'pending_verification')

    const { data: dbBkashRow2 } = await admin
      .from('orders')
      .select('*')
      .eq('order_number', dataBkash2.orderNumber)
      .single()

    assert.equal(dbBkashRow2.coupon_discount, 62)
    assert.equal(dbBkashRow2.final_total, 248)
    assert.equal(dbBkashRow2.payment_status, 'pending_verification')
    console.log(`✓ Test 3 Passed: bKash + FOCUS25 order ${dataBkash2.orderNumber} confirmed with ৳248.`)

    // -------------------------------------------------------------------------
    // Test 4: bKash Manual — Outside Chattogram (Dhaka)
    // Qty: 1, Dist: Dhaka
    // Expected: Subtotal ৳250, Delivery ৳100, Total ৳350
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing bKash Manual: Outside Chattogram (Dhaka) ---')
    const idempBkash3 = crypto.randomUUID()
    createdIdempotencyKeys.push(idempBkash3)
    const testTrxId3 = 'TRX' + Math.random().toString(36).slice(2, 9).toUpperCase()

    const payloadBkash3 = {
      customerName: 'Rayhan Uddin',
      phone: '01612345678',
      district: 'Dhaka',
      deliveryArea: 'Dhanmondi',
      deliveryAddress: 'Road 8A',
      quantity: 1,
      paymentMethod: 'bkash_manual',
      bkashTransactionId: testTrxId3,
      idempotencyKey: idempBkash3,
    }

    const resBkash3 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadBkash3),
    })

    assert.equal(resBkash3.status, 201)
    const dataBkash3 = await resBkash3.json()
    createdOrderNumbers.push(dataBkash3.orderNumber)

    assert.equal(dataBkash3.deliveryCharge, 100)
    assert.equal(dataBkash3.finalTotal, 350)
    assert.equal(dataBkash3.paymentMethod, 'bkash_manual')
    assert.equal(dataBkash3.paymentStatus, 'pending_verification')
    console.log(`✓ Test 4 Passed: Dhaka bKash order ${dataBkash3.orderNumber} confirmed with ৳350.`)

    // -------------------------------------------------------------------------
    // Test 5: Missing TrxID for bkash_manual
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Missing TrxID for bKash ---')
    const idempNoTrx = crypto.randomUUID()
    const resNoTrx = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'No Trx Customer',
        phone: '01812345678',
        district: 'Chattogram',
        deliveryArea: 'Pahartali',
        deliveryAddress: 'Road 3',
        quantity: 1,
        paymentMethod: 'bkash_manual',
        idempotencyKey: idempNoTrx,
      }),
    })

    assert.equal(resNoTrx.status, 400, 'Must reject missing TrxID with HTTP 400')
    const dataNoTrx = await resNoTrx.json()
    console.log(`✓ Test 5 Passed: Rejected missing TrxID with HTTP 400 (${dataNoTrx.error})`)

    // -------------------------------------------------------------------------
    // Test 6: Duplicate TrxID Rejection
    // Reusing testTrxId1 with a different idempotency key and customer
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Duplicate TrxID Rejection ---')
    const idempDupTrx = crypto.randomUUID()
    const resDupTrx = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Fraud Attempt',
        phone: '01899999999',
        district: 'Dhaka',
        deliveryArea: 'Mirpur',
        deliveryAddress: 'Section 10',
        quantity: 1,
        paymentMethod: 'bkash_manual',
        bkashTransactionId: testTrxId1.toLowerCase(), // test case-insensitive duplicate match
        idempotencyKey: idempDupTrx,
      }),
    })

    assert.equal(resDupTrx.status, 409, 'Must reject duplicate TrxID with HTTP 409 Conflict')
    const dataDupTrx = await resDupTrx.json()
    assert.equal(dataDupTrx.code, 'duplicate_transaction_id')
    console.log(`✓ Test 6 Passed: Rejected duplicate TrxID with HTTP 409 (${dataDupTrx.error})`)

    // -------------------------------------------------------------------------
    // Test 7: COD with TrxID Inconsistency Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing COD with TrxID Inconsistency ---')
    const idempCodWithTrx = crypto.randomUUID()
    const resCodWithTrx = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Confused Customer',
        phone: '01812345678',
        district: 'Chattogram',
        deliveryArea: 'Agrabad',
        deliveryAddress: 'Road 1',
        quantity: 1,
        paymentMethod: 'cod',
        bkashTransactionId: 'SOME_TRX_123',
        idempotencyKey: idempCodWithTrx,
      }),
    })

    assert.equal(resCodWithTrx.status, 400, 'Must reject COD with TrxID with HTTP 400')
    const dataCodWithTrx = await resCodWithTrx.json()
    console.log(`✓ Test 7 Passed: Rejected COD with TrxID (${dataCodWithTrx.error})`)

    // -------------------------------------------------------------------------
    // Test 8: Fake Payment Status Manipulation Injection
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Fake Payment Status Manipulation Injection ---')
    const idempFake = crypto.randomUUID()
    const resFake = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Hacker',
        phone: '01812345678',
        district: 'Chattogram',
        deliveryArea: 'Agrabad',
        deliveryAddress: 'Road 1',
        quantity: 1,
        paymentMethod: 'bkash_manual',
        bkashTransactionId: 'TRX_FAKE_1234',
        paymentStatus: 'paid', // Malicious attempt to self-mark paid
        idempotencyKey: idempFake,
      }),
    })

    assert.equal(resFake.status, 400, 'Must reject unrecognized financial key paymentStatus')
    console.log('✓ Test 8 Passed: Malicious paymentStatus injection rejected with HTTP 400.')

    // -------------------------------------------------------------------------
    // Test 9: Idempotent Retry of bKash Order
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Testing Idempotent Retry of bKash Order ---')
    const retryRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadBkash2),
    })

    assert.equal(retryRes.status, 200, 'Idempotent retry returns HTTP 200')
    const retryData = await retryRes.json()
    assert.equal(retryData.orderNumber, dataBkash2.orderNumber)
    assert.equal(retryData.isDuplicate, true)
    console.log(`✓ Test 9 Passed: Idempotent retry returned same order ${retryData.orderNumber} without duplicate.`)

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
    console.log('✓ Cleaned up test data cleanly.')

    console.log('\n===============================================================')
    console.log('ALL STEP 7 TESTS COMPLETED SUCCESSFULLY!')
    console.log('===============================================================\n')
  } catch (e) {
    console.error('Test Suite Failed:', e)
    process.exit(1)
  }
}

runStep7TestSuite()
