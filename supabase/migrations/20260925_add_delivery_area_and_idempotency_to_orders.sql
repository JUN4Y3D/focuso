-- Migration: 20260925_add_delivery_area_and_idempotency_to_orders.sql
-- Description:
-- 1. Adds delivery_area (TEXT NULL) to public.orders for distinct Thana / Area tracking.
-- 2. Adds idempotency_key (UUID NULL) with a UNIQUE partial index for non-null values.
-- 3. Defines atomic order creation RPC function `create_order_atomic` to encapsulate
--    inserting the order and incrementing coupon usage atomically in a single transaction.

-- 1. Add delivery_area column if not exists
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_area TEXT NULL;

-- 2. Add idempotency_key column if not exists
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS idempotency_key UUID NULL;

-- Create partial unique index on idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key_unique
ON public.orders (idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 3. Atomic Order Creation Function
-- Inserts the order and increments coupon usage atomically.
-- Revoked from public/anon/authenticated; executable only by service_role/backend.
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_order_number TEXT,
  p_customer_name TEXT,
  p_phone TEXT,
  p_delivery_address TEXT,
  p_delivery_area TEXT,
  p_delivery_zone TEXT,
  p_quantity INTEGER,
  p_unit_price INTEGER,
  p_product_subtotal INTEGER,
  p_coupon_code TEXT,
  p_coupon_discount INTEGER,
  p_delivery_charge INTEGER,
  p_final_total INTEGER,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_order_status TEXT,
  p_customer_note TEXT,
  p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_order public.orders%ROWTYPE;
  v_new_order public.orders%ROWTYPE;
  v_coupon_id UUID;
  v_coupon_active BOOLEAN;
  v_usage_count INTEGER;
  v_usage_limit INTEGER;
BEGIN
  -- 1. Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_order
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      -- Return existing order details
      RETURN jsonb_build_object(
        'is_duplicate', true,
        'order_number', v_existing_order.order_number,
        'quantity', v_existing_order.quantity,
        'product_subtotal', v_existing_order.product_subtotal,
        'coupon_code', v_existing_order.coupon_code,
        'coupon_discount', v_existing_order.coupon_discount,
        'delivery_charge', v_existing_order.delivery_charge,
        'final_total', v_existing_order.final_total,
        'payment_method', v_existing_order.payment_method,
        'payment_status', v_existing_order.payment_status,
        'order_status', v_existing_order.order_status,
        'customer_name', v_existing_order.customer_name,
        'phone', v_existing_order.phone,
        'delivery_address', v_existing_order.delivery_address,
        'delivery_area', v_existing_order.delivery_area,
        'created_at', v_existing_order.created_at
      );
    END IF;
  END IF;

  -- 2. Coupon Validation & Usage Lock (if coupon supplied)
  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    SELECT id, active, usage_count, usage_limit
    INTO v_coupon_id, v_coupon_active, v_usage_count, v_usage_limit
    FROM public.coupons
    WHERE UPPER(code) = UPPER(p_coupon_code)
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Coupon not found: %', p_coupon_code USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_coupon_active THEN
      RAISE EXCEPTION 'Coupon is not active: %', p_coupon_code USING ERRCODE = 'P0003';
    END IF;

    IF v_usage_limit IS NOT NULL AND v_usage_count >= v_usage_limit THEN
      RAISE EXCEPTION 'Coupon usage limit reached: %', p_coupon_code USING ERRCODE = 'P0004';
    END IF;

    -- Increment usage count
    UPDATE public.coupons
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = v_coupon_id;
  END IF;

  -- 3. Insert Order
  INSERT INTO public.orders (
    order_number,
    customer_name,
    phone,
    delivery_address,
    delivery_area,
    delivery_zone,
    quantity,
    unit_price,
    product_subtotal,
    coupon_code,
    coupon_discount,
    delivery_charge,
    final_total,
    payment_method,
    payment_status,
    order_status,
    customer_note,
    idempotency_key,
    created_at,
    updated_at
  )
  VALUES (
    p_order_number,
    p_customer_name,
    p_phone,
    p_delivery_address,
    p_delivery_area,
    p_delivery_zone,
    p_quantity,
    p_unit_price,
    p_product_subtotal,
    p_coupon_code,
    p_coupon_discount,
    p_delivery_charge,
    p_final_total,
    p_payment_method,
    p_payment_status,
    p_order_status,
    p_customer_note,
    p_idempotency_key,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_new_order;

  RETURN jsonb_build_object(
    'is_duplicate', false,
    'order_number', v_new_order.order_number,
    'quantity', v_new_order.quantity,
    'product_subtotal', v_new_order.product_subtotal,
    'coupon_code', v_new_order.coupon_code,
    'coupon_discount', v_new_order.coupon_discount,
    'delivery_charge', v_new_order.delivery_charge,
    'final_total', v_new_order.final_total,
    'payment_method', v_new_order.payment_method,
    'payment_status', v_new_order.payment_status,
    'order_status', v_new_order.order_status,
    'customer_name', v_new_order.customer_name,
    'phone', v_new_order.phone,
    'delivery_address', v_new_order.delivery_address,
    'delivery_area', v_new_order.delivery_area,
    'created_at', v_new_order.created_at
  );
END;
$$;

-- Revoke execution from PUBLIC, anon, authenticated; only service_role/backend can call it
REVOKE ALL ON FUNCTION public.create_order_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_atomic FROM anon;
REVOKE ALL ON FUNCTION public.create_order_atomic FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic TO service_role;
