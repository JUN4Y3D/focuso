import assert from 'node:assert/strict'
import { requireIsolatedSupabaseIntegrationTest } from '../test/integrationGuard'

requireIsolatedSupabaseIntegrationTest('test_endpoint.ts')

async function testEndpointCases() {
  console.log('Testing /api/coupon-preview live HTTP endpoint:\n')

  // Test Case 1: Qty 1 + Chattogram + FOCUS25 -> 250 - 62 + 60 = 248
  const res1 = await fetch('http://localhost:3000/api/coupon-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: 1, district: 'Chattogram', couponCode: 'FOCUS25' }),
  })
  const data1 = await res1.json()
  assert.equal(res1.status, 200)
  assert.equal(data1.productSubtotal, 250)
  assert.equal(data1.coupon.discountAmount, 62)
  assert.equal(data1.deliveryCharge, 60)
  assert.equal(data1.finalTotal, 248)
  console.log('✓ Case 1: Quantity 1 + Chattogram + FOCUS25 -> Subtotal: ৳250, Disc: ৳62, Delivery: ৳60, Final: ৳248')

  // Test Case 2: Qty 1 + Dhaka + FOCUS25 -> 250 - 62 + 100 = 288
  const res2 = await fetch('http://localhost:3000/api/coupon-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: 1, district: 'Dhaka', couponCode: 'FOCUS25' }),
  })
  const data2 = await res2.json()
  assert.equal(res2.status, 200)
  assert.equal(data2.productSubtotal, 250)
  assert.equal(data2.coupon.discountAmount, 62)
  assert.equal(data2.deliveryCharge, 100)
  assert.equal(data2.finalTotal, 288)
  console.log('✓ Case 2: Quantity 1 + Dhaka + FOCUS25 -> Subtotal: ৳250, Disc: ৳62, Delivery: ৳100, Final: ৳288')

  // Test Case 3: Qty 2 + Chattogram + FOCUS25 -> 500 - 125 + 60 = 435
  const res3 = await fetch('http://localhost:3000/api/coupon-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: 2, district: 'Chattogram', couponCode: 'FOCUS25' }),
  })
  const data3 = await res3.json()
  assert.equal(res3.status, 200)
  assert.equal(data3.productSubtotal, 500)
  assert.equal(data3.coupon.discountAmount, 125)
  assert.equal(data3.deliveryCharge, 60)
  assert.equal(data3.finalTotal, 435)
  console.log('✓ Case 3: Quantity 2 + Chattogram + FOCUS25 -> Subtotal: ৳500, Disc: ৳125, Delivery: ৳60, Final: ৳435')

  // Test Case 4: Qty 2 + Dhaka + FOCUS25 -> 500 - 125 + 100 = 475
  const res4 = await fetch('http://localhost:3000/api/coupon-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: 2, district: 'Dhaka', couponCode: 'FOCUS25' }),
  })
  const data4 = await res4.json()
  assert.equal(res4.status, 200)
  assert.equal(data4.productSubtotal, 500)
  assert.equal(data4.coupon.discountAmount, 125)
  assert.equal(data4.deliveryCharge, 100)
  assert.equal(data4.finalTotal, 475)
  console.log('✓ Case 4: Quantity 2 + Dhaka + FOCUS25 -> Subtotal: ৳500, Disc: ৳125, Delivery: ৳100, Final: ৳475')

  // Test Case 5: Qty 3 + Chattogram + FOCUS25 -> 750 - 187 + 60 = 623
  const res5 = await fetch('http://localhost:3000/api/coupon-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: 3, district: 'Chattogram', couponCode: 'FOCUS25' }),
  })
  const data5 = await res5.json()
  assert.equal(res5.status, 200)
  assert.equal(data5.productSubtotal, 750)
  assert.equal(data5.coupon.discountAmount, 187) // 187.50 floored to 187
  assert.equal(data5.deliveryCharge, 60)
  assert.equal(data5.finalTotal, 623)
  console.log('✓ Case 5: Quantity 3 + Chattogram + FOCUS25 -> Subtotal: ৳750, Disc: ৳187, Delivery: ৳60, Final: ৳623 (187.5 floored)')

  // Test Case 6: Case normalization (focus25 / Focus25 / '  focus25  ')
  const res6 = await fetch('http://localhost:3000/api/coupon-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: 1, district: 'Chattogram', couponCode: '  focus25  ' }),
  })
  assert.equal(res6.status, 200)
  const data6 = await res6.json()
  assert.equal(data6.coupon.code, 'FOCUS25')
  console.log('✓ Case 6: Lowercase and padded code normalized to FOCUS25')

  // Test Case 7: Deprecated coupons rejected
  for (const dep of ['FOCUSO50', 'BARAKAH', 'FOCUSO']) {
    const resDep = await fetch('http://localhost:3000/api/coupon-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 1, district: 'Chattogram', couponCode: dep }),
    })
    assert.equal(resDep.status, 400)
    const dataDep = await resDep.json()
    assert.equal(dataDep.field, 'couponCode')
    console.log(`✓ Deprecated coupon ${dep} rejected with HTTP 400: ${dataDep.error}`)
  }

  // Test Case 8: Random invalid code
  const resBad = await fetch('http://localhost:3000/api/coupon-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: 1, district: 'Chattogram', couponCode: 'TEST123' }),
  })
  assert.equal(resBad.status, 400)
  const dataBad = await resBad.json()
  console.log(`✓ Invalid code TEST123 rejected with HTTP 400: ${dataBad.error}`)

  console.log('\nAll /api/coupon-preview endpoint tests passed successfully!')
}

testEndpointCases().catch((err) => {
  console.error('Endpoint tests failed:', err)
  process.exit(1)
})
