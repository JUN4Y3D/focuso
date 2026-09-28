-- Apply after 20260928_add_returned_order_workflow.sql.
-- Record a completed manual refund. This function never transfers money.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_refund_bkash_payment(
  p_order_id UUID,
  p_reason TEXT,
  p_refund_transaction_id TEXT,
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
  v_reason TEXT := TRIM(p_reason);
  v_reference TEXT := UPPER(TRIM(p_refund_transaction_id));
BEGIN
  IF v_reason IS NULL OR LENGTH(v_reason) < 3 OR LENGTH(v_reason) > 300 THEN
    RAISE EXCEPTION 'INVALID_REASON: Refund reason must be between 3 and 300 characters';
  END IF;
  IF v_reference IS NULL OR v_reference !~ '^[A-Z0-9]{10}$' THEN
    RAISE EXCEPTION 'INVALID_REASON: Enter a valid 10-character bKash refund Transaction ID';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.payment_method <> 'bkash_manual' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: Only manual bKash payments can use this refund action';
  END IF;
  IF v_order.payment_status = 'refunded' THEN
    RETURN jsonb_build_object('orderId', p_order_id, 'orderStatus', v_order.order_status,
      'paymentStatus', 'refunded', 'alreadyRefunded', true);
  END IF;
  IF v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS: Only paid payments can be refunded';
  END IF;

  -- Preserve fulfillment and original incoming payment verification details.
  UPDATE public.orders SET payment_status = 'refunded', updated_at = NOW()
  WHERE id = p_order_id;
  INSERT INTO public.admin_audit_log (admin_user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (p_admin_id, 'bkash_payment_refunded', 'order', p_order_id::text,
    jsonb_build_object('from', 'paid', 'to', 'refunded', 'reason', v_reason,
      'refundTransactionId', v_reference, 'amount', v_order.final_total,
      'adminEmail', p_admin_email), NOW());
  RETURN jsonb_build_object('orderId', p_order_id, 'orderStatus', v_order.order_status,
    'paymentStatus', 'refunded', 'alreadyRefunded', false);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_refund_bkash_payment(UUID, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_bkash_payment(UUID, TEXT, TEXT, UUID, TEXT)
  TO service_role;

-- The older generic status function predates Returned and otherwise permits
-- unexpected transitions out of that state. Guard it without changing its API.
CREATE OR REPLACE FUNCTION public.guard_returned_order_fulfillment()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.order_status = 'returned' AND NEW.order_status IS DISTINCT FROM OLD.order_status THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Returned fulfillment is closed';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_returned_order_fulfillment ON public.orders;
CREATE TRIGGER guard_returned_order_fulfillment BEFORE UPDATE OF order_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_returned_order_fulfillment();

NOTIFY pgrst, 'reload schema';
COMMIT;
