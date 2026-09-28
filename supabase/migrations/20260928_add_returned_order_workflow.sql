-- ==============================================================================
-- Migration: 20260928_add_returned_order_workflow.sql
-- Description: Add a distinct, auditable Returned fulfillment state.
--
-- A return is not a cancellation and does not imply a payment refund. In
-- particular, a paid bKash order remains payment_status = 'paid' when its
-- fulfillment status becomes 'returned'.
-- ==============================================================================

-- The original orders constraint predates the Returned fulfillment state.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN (
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'returned',
    'cancelled'
  ));

-- ------------------------------------------------------------------------------
-- admin_return_order
-- Atomically records a return and its audit context. Payment fields are never
-- selected for update, so fulfillment and payment remain independent states.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_return_order(
  p_order_id UUID,
  p_reason TEXT,
  p_admin_note TEXT,
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
  v_reason TEXT;
  v_admin_note TEXT;
  v_changed_at TIMESTAMPTZ;
BEGIN
  v_reason := TRIM(p_reason);
  v_admin_note := NULLIF(TRIM(COALESCE(p_admin_note, '')), '');

  IF v_reason IS NULL OR LENGTH(v_reason) < 3 OR LENGTH(v_reason) > 300 THEN
    RAISE EXCEPTION 'INVALID_REASON: Return reason must be between 3 and 300 characters';
  END IF;

  IF v_admin_note IS NOT NULL AND LENGTH(v_admin_note) > 500 THEN
    RAISE EXCEPTION 'INVALID_NOTE: Admin note cannot exceed 500 characters';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- Idempotent retry protection: do not create a second audit record.
  IF v_order.order_status = 'returned' THEN
    RETURN jsonb_build_object(
      'success', true,
      'orderId', v_order.id,
      'orderStatus', 'returned',
      'alreadyReturned', true
    );
  END IF;

  -- A return is only meaningful after shipment or after delivery. It is not a
  -- substitute for cancellation of an unfulfilled order.
  IF v_order.order_status NOT IN ('shipped', 'delivered') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Returns can only be recorded for shipped or delivered orders';
  END IF;

  v_changed_at := NOW();

  -- Do not update payment_status, payment_verified_at, or payment_verified_by.
  UPDATE public.orders
  SET order_status = 'returned',
      updated_at = v_changed_at
  WHERE id = p_order_id;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) VALUES (
    p_admin_id,
    'order_returned',
    'order',
    p_order_id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'from', v_order.order_status,
      'to', 'returned',
      'reason', v_reason,
      'adminNote', v_admin_note,
      'adminEmail', p_admin_email
    )),
    v_changed_at
  );

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'from', v_order.order_status,
    'to', 'returned',
    'reason', v_reason,
    'adminNote', v_admin_note
  ));
END;
$$;

-- The browser must never invoke this privileged function directly.
REVOKE ALL ON FUNCTION public.admin_return_order(UUID, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_return_order(UUID, TEXT, TEXT, UUID, TEXT)
  TO service_role;
