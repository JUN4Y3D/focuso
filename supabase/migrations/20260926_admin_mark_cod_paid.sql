-- ==============================================================================
-- Migration: 20260926_admin_mark_cod_paid.sql
-- Description: Step 8D - Secure Cash on Delivery Payment Collection Recording
-- Function:
--   public.admin_mark_cod_paid(p_order_id UUID, p_admin_id UUID, p_admin_email TEXT)
--
-- Security:
--   - SECURITY DEFINER with safe search_path = public, pg_temp.
--   - EXECUTE is REVOKED from PUBLIC, anon, and authenticated.
--   - EXECUTE is GRANTED only to service_role (trusted backend).
--   - Direct browser invocation is strictly disallowed.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_mark_cod_paid(
  p_order_id UUID,
  p_admin_id UUID,
  p_admin_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_verified_at TIMESTAMPTZ;
BEGIN
  -- 1. Lock and retrieve order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- 2. Reject non-COD orders (specifically bkash_manual)
  IF v_order.payment_method != 'cod' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: COD collection only applies to cod orders';
  END IF;

  -- 3. Already-paid protection (idempotent safe response without duplicate audit entries)
  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', true,
      'orderId', v_order.id,
      'paymentStatus', 'paid',
      'alreadyPaid', true,
      'paymentVerifiedAt', v_order.payment_verified_at,
      'paymentVerifiedBy', v_order.payment_verified_by,
      'amount', v_order.final_total
    );
  END IF;

  -- 4. Validate allowed payment state (only unpaid COD orders can transition to paid)
  IF v_order.payment_status != 'unpaid' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS: Cannot collect COD payment in % state', v_order.payment_status;
  END IF;

  v_verified_at := NOW();

  -- 5. Update order payment fields only (fulfillment order_status remains untouched)
  UPDATE public.orders
  SET payment_status = 'paid',
      payment_verified_at = v_verified_at,
      payment_verified_by = p_admin_id,
      updated_at = v_verified_at
  WHERE id = p_order_id;

  -- 6. Atomically append audit entry
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) VALUES (
    p_admin_id,
    'cod_payment_collected',
    'order',
    p_order_id::text,
    jsonb_build_object(
      'from', 'unpaid',
      'to', 'paid',
      'amount', v_order.final_total,
      'adminEmail', p_admin_email
    ),
    v_verified_at
  );

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'paymentStatus', 'paid',
    'paymentVerifiedAt', v_verified_at,
    'paymentVerifiedBy', p_admin_id,
    'amount', v_order.final_total
  );
END;
$$;

-- Revoke and Grant Permissions (SECURITY DEFINER Hardening)
REVOKE EXECUTE ON FUNCTION public.admin_mark_cod_paid(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_cod_paid(UUID, UUID, TEXT) TO service_role;
