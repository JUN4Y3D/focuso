-- ==============================================================================
-- Migration: 20260926_order_mutations_and_audit_functions.sql
-- Description: Step 8C - Atomic Order Mutations with Audit Logging
-- Functions:
--   1. admin_update_order_status
--   2. admin_verify_bkash_payment
--   3. admin_fail_bkash_payment
--
-- Security:
--   - Functions run with SECURITY DEFINER and safe search_path = public, pg_temp.
--   - EXECUTE is REVOKED from PUBLIC, anon, and authenticated.
--   - EXECUTE is GRANTED only to service_role (trusted backend).
--   - Direct browser invocation is strictly disallowed.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. admin_update_order_status
-- Atomically updates order_status and logs action into admin_audit_log
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_order_id UUID,
  p_new_status TEXT,
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
  v_result JSONB;
BEGIN
  -- Validate target status
  IF p_new_status NOT IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'INVALID_STATUS: % is not a valid order status', p_new_status;
  END IF;

  -- Lock and retrieve order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- Idempotency check: if status already matches, return current state without double-logging
  IF v_order.order_status = p_new_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'orderId', v_order.id,
      'orderStatus', v_order.order_status,
      'unchanged', true
    );
  END IF;

  -- Validate allowed state transitions:
  -- pending -> confirmed | cancelled
  -- confirmed -> processing | cancelled
  -- processing -> shipped | cancelled
  -- shipped -> delivered
  -- delivered -> (terminal)
  -- cancelled -> (terminal)
  IF p_new_status = 'cancelled' THEN
    IF v_order.order_status NOT IN ('pending', 'confirmed', 'processing') THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: Cannot cancel order in % state', v_order.order_status;
    END IF;
  ELSE
    IF v_order.order_status = 'pending' AND p_new_status != 'confirmed' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: Pending orders can only transition to confirmed or cancelled';
    ELSIF v_order.order_status = 'confirmed' AND p_new_status != 'processing' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: Confirmed orders can only transition to processing or cancelled';
    ELSIF v_order.order_status = 'processing' AND p_new_status != 'shipped' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: Processing orders can only transition to shipped or cancelled';
    ELSIF v_order.order_status = 'shipped' AND p_new_status != 'delivered' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: Shipped orders can only transition to delivered';
    ELSIF v_order.order_status IN ('delivered', 'cancelled') THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: % is a terminal state', v_order.order_status;
    END IF;
  END IF;

  -- Update order status
  UPDATE public.orders
  SET order_status = p_new_status,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Append audit log entry atomically
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) VALUES (
    p_admin_id,
    'order_status_changed',
    'order',
    p_order_id::text,
    jsonb_build_object(
      'from', v_order.order_status,
      'to', p_new_status,
      'adminEmail', p_admin_email
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'from', v_order.order_status,
    'to', p_new_status
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. admin_verify_bkash_payment
-- Atomically marks bKash manual payment as paid and logs audit entry
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_verify_bkash_payment(
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
  -- Lock and retrieve order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- Strictly reject COD orders
  IF v_order.payment_method != 'bkash_manual' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: bKash verification is only allowed for bkash_manual orders';
  END IF;

  -- Already-paid protection: return current state without updating timestamps or creating audit entries
  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', true,
      'orderId', v_order.id,
      'paymentStatus', 'paid',
      'alreadyPaid', true,
      'paymentVerifiedAt', v_order.payment_verified_at,
      'paymentVerifiedBy', v_order.payment_verified_by
    );
  END IF;

  -- Allowable starting states: pending_verification or failed (failed -> paid correction)
  IF v_order.payment_status NOT IN ('pending_verification', 'failed') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS: Cannot verify payment in % state', v_order.payment_status;
  END IF;

  v_verified_at := NOW();

  -- Update order record
  UPDATE public.orders
  SET payment_status = 'paid',
      payment_verified_at = v_verified_at,
      payment_verified_by = p_admin_id,
      updated_at = v_verified_at
  WHERE id = p_order_id;

  -- Record audit log entry
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) VALUES (
    p_admin_id,
    'bkash_payment_verified',
    'order',
    p_order_id::text,
    jsonb_build_object(
      'from', v_order.payment_status,
      'to', 'paid',
      'expectedAmount', v_order.final_total,
      'transactionId', COALESCE(v_order.bkash_transaction_id, ''),
      'adminEmail', p_admin_email
    ),
    v_verified_at
  );

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'from', v_order.payment_status,
    'to', 'paid',
    'paymentVerifiedAt', v_verified_at,
    'paymentVerifiedBy', p_admin_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. admin_fail_bkash_payment
-- Atomically marks bKash manual payment as failed with required reason
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_fail_bkash_payment(
  p_order_id UUID,
  p_reason TEXT,
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
  v_trimmed_reason TEXT;
BEGIN
  v_trimmed_reason := TRIM(p_reason);
  IF v_trimmed_reason IS NULL OR LENGTH(v_trimmed_reason) < 3 OR LENGTH(v_trimmed_reason) > 300 THEN
    RAISE EXCEPTION 'INVALID_REASON: Reason must be between 3 and 300 characters';
  END IF;

  -- Lock and retrieve order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- Strictly reject COD orders
  IF v_order.payment_method != 'bkash_manual' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: bKash payment failure only applies to bkash_manual orders';
  END IF;

  -- Already-paid protection: cannot mark paid order as failed
  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'ALREADY_PAID: Cannot mark an already verified and paid order as failed';
  END IF;

  -- Idempotency check: if already failed, return safe response
  IF v_order.payment_status = 'failed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'orderId', v_order.id,
      'paymentStatus', 'failed',
      'alreadyFailed', true
    );
  END IF;

  -- Normal allowable state: pending_verification
  IF v_order.payment_status != 'pending_verification' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS: Cannot fail payment in % state', v_order.payment_status;
  END IF;

  -- Update order payment status only (order fulfillment status remains unchanged)
  UPDATE public.orders
  SET payment_status = 'failed',
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Record audit log entry
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) VALUES (
    p_admin_id,
    'bkash_payment_failed',
    'order',
    p_order_id::text,
    jsonb_build_object(
      'from', v_order.payment_status,
      'to', 'failed',
      'reason', v_trimmed_reason,
      'transactionId', COALESCE(v_order.bkash_transaction_id, ''),
      'adminEmail', p_admin_email
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'from', v_order.payment_status,
    'to', 'failed',
    'reason', v_trimmed_reason
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Revoke and Grant Permissions (SECURITY DEFINER Hardening)
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_verify_bkash_payment(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_fail_bkash_payment(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_verify_bkash_payment(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_fail_bkash_payment(UUID, TEXT, UUID, TEXT) TO service_role;
