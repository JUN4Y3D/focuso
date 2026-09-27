import assert from 'node:assert/strict'
import {
  calculateDiscountAmount,
  normalizeCouponCode,
  validateAndCalculateCoupon,
} from './coupons'

async function runCouponTests() {
  console.log('Running FOCUSO Step 5 Coupon Tests:\n')

  // 1. Coupon normalization tests
  assert.equal(normalizeCouponCode('FOCUS25'), 'FOCUS25')
  assert.equal(normalizeCouponCode('focus25'), 'FOCUS25')
  assert.equal(normalizeCouponCode('Focus25'), 'FOCUS25')
  assert.equal(normalizeCouponCode('  FOCUS25  '), 'FOCUS25')
  assert.equal(normalizeCouponCode(''), '')
  console.log('✓ Normalization: FOCUS25, focus25, Focus25, whitespace all resolve to FOCUS25')

  // 2. Math.floor discount calculations
  // Qty 1 (subtotal 250): 250 * 0.25 = 62.5 -> floor = 62
  const disc250 = calculateDiscountAmount('percentage', 25, 250)
  assert.equal(disc250, 62)
  console.log('✓ Rounding: ৳250 × 25% = ৳62.50 -> Math.floor = ৳62 (not ৳63)')

  // Qty 2 (subtotal 500): 500 * 0.25 = 125 -> floor = 125
  const disc500 = calculateDiscountAmount('percentage', 25, 500)
  assert.equal(disc500, 125)
  console.log('✓ Rounding: ৳500 × 25% = ৳125.00 -> Math.floor = ৳125')

  // Qty 3 (subtotal 750): 750 * 0.25 = 187.50 -> floor = 187
  const disc750 = calculateDiscountAmount('percentage', 25, 750)
  assert.equal(disc750, 187)
  console.log('✓ Rounding: ৳750 × 25% = ৳187.50 -> Math.floor = ৳187 (not ৳188)')

  // 3. Removed / Deprecated coupons must fail
  const old1 = await validateAndCalculateCoupon('FOCUSO50', 250)
  assert.equal(old1.valid, false)
  console.log('✓ Deprecated coupon rejected: FOCUSO50 (valid = false)')

  const old2 = await validateAndCalculateCoupon('BARAKAH', 250)
  assert.equal(old2.valid, false)
  console.log('✓ Deprecated coupon rejected: BARAKAH (valid = false)')

  const old3 = await validateAndCalculateCoupon('FOCUSO', 250)
  assert.equal(old3.valid, false)
  console.log('✓ Deprecated coupon rejected: FOCUSO (valid = false)')

  // 4. Random invalid code
  const randomCode = await validateAndCalculateCoupon('TEST123', 250)
  assert.equal(randomCode.valid, false)
  console.log('✓ Random invalid code rejected: TEST123 (valid = false)')

  // 5. Valid FOCUS25 validation against DB
  const validRes = await validateAndCalculateCoupon('FOCUS25', 250)
  assert.equal(validRes.valid, true)
  if (validRes.valid) {
    assert.equal(validRes.code, 'FOCUS25')
    assert.equal(validRes.discountType, 'percentage')
    assert.equal(validRes.discountValue, 25)
    assert.equal(validRes.discountAmount, 62)
  }
  console.log('✓ Active coupon verified in Supabase: FOCUS25 is active and yields ৳62 discount for ৳250 subtotal')

  console.log('\nAll coupon unit tests passed!')
}

runCouponTests().catch((err) => {
  console.error('Coupon tests failed:', err)
  process.exit(1)
})
