-- Migration: 20260925_replace_coupons_with_focus25.sql
-- Description: Deactivate old deprecated coupons (FOCUSO50, BARAKAH, FOCUSO) and insert/upsert the authoritative FOCUS25 coupon.
-- Business rule: 25% off product subtotal only, whole BDT floored, delivery untouched.

-- 1. Deactivate/remove old deprecated coupon codes
UPDATE public.coupons
SET active = FALSE,
    updated_at = NOW()
WHERE UPPER(code) IN ('FOCUSO50', 'BARAKAH', 'FOCUSO');

-- 2. Upsert the authoritative FOCUS25 coupon
INSERT INTO public.coupons (
  code,
  discount_type,
  discount_value,
  minimum_order,
  maximum_discount,
  active,
  starts_at,
  expires_at,
  usage_limit,
  usage_count,
  created_at,
  updated_at
)
VALUES (
  'FOCUS25',
  'percentage',
  25,
  0,
  NULL,
  TRUE,
  NULL,
  NULL,
  NULL,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (UPPER(code))
DO UPDATE SET
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  minimum_order = EXCLUDED.minimum_order,
  maximum_discount = EXCLUDED.maximum_discount,
  active = TRUE,
  starts_at = EXCLUDED.starts_at,
  expires_at = EXCLUDED.expires_at,
  usage_limit = EXCLUDED.usage_limit,
  updated_at = NOW();
