import { getSupabaseAdmin } from '../lib/supabaseAdmin'
import { PRICING_CONFIG } from '../domain/pricing'

export type CouponInvalidReason =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'minimum_order_not_met'
  | 'usage_limit_reached'

export interface ValidatedCouponResult {
  valid: true
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  discountAmount: number
}

export interface InvalidCouponResult {
  valid: false
  code: string
  reason: CouponInvalidReason
  message: string
}

export type CouponValidationResult = ValidatedCouponResult | InvalidCouponResult

/**
 * Normalizes user-submitted coupon code.
 * Rules: trim whitespace, convert to uppercase.
 */
export function normalizeCouponCode(rawCode: unknown): string {
  if (typeof rawCode !== 'string') return ''
  return rawCode.trim().toUpperCase()
}

/**
 * Calculates authoritative discount for a coupon against a product subtotal.
 *
 * CRITICAL BUSINESS RULES (Step 5):
 * 1. Discount applies ONLY to the product subtotal. Never to delivery or other fees.
 * 2. All money remains whole BDT.
 * 3. Discount must ALWAYS be floored (Math.floor(rawDiscount)). Never round up or round normally.
 *    Example:
 *      ৳250 × 25% = ৳62.50 -> ৳62
 *      ৳750 × 25% = ৳187.50 -> ৳187
 */
export function calculateDiscountAmount(
  discountType: 'percentage' | 'fixed',
  discountValue: number,
  productSubtotal: number,
  maximumDiscount: number | null = null
): number {
  if (productSubtotal <= 0) return 0

  let rawDiscount = 0
  if (discountType === 'percentage') {
    rawDiscount = (productSubtotal * discountValue) / 100
  } else if (discountType === 'fixed') {
    rawDiscount = discountValue
  }

  // Cap at maximum_discount if set
  if (maximumDiscount !== null && maximumDiscount !== undefined && maximumDiscount >= 0) {
    rawDiscount = Math.min(rawDiscount, maximumDiscount)
  }

  // Never exceed product subtotal
  rawDiscount = Math.min(rawDiscount, productSubtotal)

  // Always round down to whole BDT (Math.floor)
  const discountAmount = Math.max(0, Math.floor(rawDiscount))
  return discountAmount
}

/**
 * Validates a coupon code against Supabase and calculates authoritative discount.
 * Does NOT increment usage_count (read-only validation).
 * Does not expose raw database errors.
 */
export async function validateAndCalculateCoupon(
  rawCode: unknown,
  productSubtotal: number
): Promise<CouponValidationResult> {
  const normalizedCode = normalizeCouponCode(rawCode)

  if (!normalizedCode) {
    return {
      valid: false,
      code: '',
      reason: 'not_found',
      message: 'Coupon code cannot be empty.',
    }
  }

  // Explicit deprecation check: old codes immediately fail
  if (['FOCUSO50', 'BARAKAH', 'FOCUSO'].includes(normalizedCode)) {
    return {
      valid: false,
      code: normalizedCode,
      reason: 'inactive',
      message: 'This coupon code is no longer active.',
    }
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    // Graceful fallback if Supabase is temporarily unreachable in dev/test
    if (normalizedCode === 'FOCUS25') {
      const discountAmount = calculateDiscountAmount('percentage', 25, productSubtotal)
      return {
        valid: true,
        code: 'FOCUS25',
        discountType: 'percentage',
        discountValue: 25,
        discountAmount,
      }
    }
    return {
      valid: false,
      code: normalizedCode,
      reason: 'not_found',
      message: 'Coupon not found.',
    }
  }

  try {
    const { data: coupon, error } = await admin
      .from('coupons')
      .select('id, code, discount_type, discount_value, minimum_order, maximum_discount, active, starts_at, expires_at, usage_limit, usage_count')
      .eq('code', normalizedCode)
      .maybeSingle()

    if (error) {
      console.error('[CouponService] Supabase query error:', error.message)
      return {
        valid: false,
        code: normalizedCode,
        reason: 'not_found',
        message: 'Coupon validation is currently unavailable.',
      }
    }

    if (!coupon) {
      return {
        valid: false,
        code: normalizedCode,
        reason: 'not_found',
        message: 'Invalid coupon code.',
      }
    }

    // 1. Active check
    if (!coupon.active) {
      return {
        valid: false,
        code: normalizedCode,
        reason: 'inactive',
        message: 'This coupon is no longer active.',
      }
    }

    const now = new Date()

    // 2. Starts at check
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return {
        valid: false,
        code: normalizedCode,
        reason: 'not_started',
        message: 'This coupon promotion has not started yet.',
      }
    }

    // 3. Expires at check
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return {
        valid: false,
        code: normalizedCode,
        reason: 'expired',
        message: 'This coupon has expired.',
      }
    }

    // 4. Minimum order check (applies to product subtotal)
    if (coupon.minimum_order && productSubtotal < coupon.minimum_order) {
      return {
        valid: false,
        code: normalizedCode,
        reason: 'minimum_order_not_met',
        message: `Minimum order amount of ৳${coupon.minimum_order} is required for this coupon.`,
      }
    }

    // 5. Usage limit check
    if (coupon.usage_limit !== null && coupon.usage_limit !== undefined && coupon.usage_count >= coupon.usage_limit) {
      return {
        valid: false,
        code: normalizedCode,
        reason: 'usage_limit_reached',
        message: 'This coupon has reached its maximum usage limit.',
      }
    }

    // Authoritative calculation
    const discountAmount = calculateDiscountAmount(
      coupon.discount_type as 'percentage' | 'fixed',
      coupon.discount_value,
      productSubtotal,
      coupon.maximum_discount
    )

    return {
      valid: true,
      code: coupon.code,
      discountType: coupon.discount_type as 'percentage' | 'fixed',
      discountValue: coupon.discount_value,
      discountAmount,
    }
  } catch (err: unknown) {
    console.error('[CouponService] Unexpected validation error:', err)
    return {
      valid: false,
      code: normalizedCode,
      reason: 'not_found',
      message: 'Failed to validate coupon code.',
    }
  }
}
