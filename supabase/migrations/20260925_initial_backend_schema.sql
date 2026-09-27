-- ==============================================================================
-- Migration: 20260925_initial_backend_schema.sql
-- Description: Initial backend PostgreSQL schema for FOCUSO e-commerce.
-- Tables: orders, coupons, admin_audit_log
-- Security: Row Level Security (RLS) enabled on all tables with zero public access.
--           Order creation and data management will happen through the trusted
--           server-side Express backend using the Supabase Secret Key.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Reusable updated_at Trigger Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. Orders Table
-- ------------------------------------------------------------------------------
-- Note: Order creation will strictly happen through the trusted Node/Express
-- backend (POST /api/orders). Manual bKash verification and status changes
-- will be handled through administrative tooling.
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_zone TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  product_subtotal INTEGER NOT NULL,
  coupon_code TEXT NULL,
  coupon_discount INTEGER NOT NULL DEFAULT 0,
  delivery_charge INTEGER NOT NULL DEFAULT 0,
  final_total INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  bkash_transaction_id TEXT NULL,
  order_status TEXT NOT NULL DEFAULT 'pending',
  customer_note TEXT NULL,
  payment_verified_at TIMESTAMPTZ NULL,
  payment_verified_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Defensive Constraints
  CONSTRAINT orders_delivery_zone_check CHECK (
    delivery_zone IN ('inside_chattogram', 'outside_chattogram')
  ),
  CONSTRAINT orders_quantity_check CHECK (
    quantity >= 1
  ),
  CONSTRAINT orders_unit_price_check CHECK (
    unit_price >= 0
  ),
  CONSTRAINT orders_product_subtotal_check CHECK (
    product_subtotal >= 0
  ),
  CONSTRAINT orders_coupon_discount_check CHECK (
    coupon_discount >= 0
  ),
  CONSTRAINT orders_delivery_charge_check CHECK (
    delivery_charge >= 0
  ),
  CONSTRAINT orders_final_total_check CHECK (
    final_total >= 0
  ),
  CONSTRAINT orders_payment_method_check CHECK (
    payment_method IN ('cod', 'bkash_manual')
  ),
  CONSTRAINT orders_payment_status_check CHECK (
    payment_status IN ('unpaid', 'pending_verification', 'paid', 'failed', 'refunded')
  ),
  CONSTRAINT orders_order_status_check CHECK (
    order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
  )
);

-- Trigger for orders.updated_at
CREATE TRIGGER set_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for orders
CREATE INDEX idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX idx_orders_phone ON public.orders (phone);
CREATE INDEX idx_orders_order_status ON public.orders (order_status);
CREATE INDEX idx_orders_payment_status ON public.orders (payment_status);
CREATE INDEX idx_orders_payment_method ON public.orders (payment_method);

-- Case-insensitive partial unique index for bKash transaction IDs (ignoring NULLs)
CREATE UNIQUE INDEX idx_orders_bkash_trx_unique
ON public.orders (UPPER(bkash_transaction_id))
WHERE bkash_transaction_id IS NOT NULL;


-- ------------------------------------------------------------------------------
-- 3. Coupons Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value INTEGER NOT NULL,
  minimum_order INTEGER NOT NULL DEFAULT 0,
  maximum_discount INTEGER NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  usage_limit INTEGER NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Defensive Constraints
  CONSTRAINT coupons_discount_type_check CHECK (
    discount_type IN ('fixed', 'percentage')
  ),
  CONSTRAINT coupons_discount_value_check CHECK (
    discount_value >= 0
  ),
  CONSTRAINT coupons_minimum_order_check CHECK (
    minimum_order >= 0
  ),
  CONSTRAINT coupons_maximum_discount_check CHECK (
    maximum_discount IS NULL OR maximum_discount >= 0
  ),
  CONSTRAINT coupons_usage_limit_check CHECK (
    usage_limit IS NULL OR usage_limit >= 0
  ),
  CONSTRAINT coupons_usage_count_check CHECK (
    usage_count >= 0
  )
);

-- Trigger for coupons.updated_at
CREATE TRIGGER set_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Case-insensitive unique index for coupon codes
CREATE UNIQUE INDEX idx_coupons_code_unique ON public.coupons (UPPER(code));
CREATE INDEX idx_coupons_active ON public.coupons (active);


-- ------------------------------------------------------------------------------
-- 4. Admin Audit Log Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX idx_admin_audit_log_entity ON public.admin_audit_log (entity_type, entity_id);


-- ------------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
-- SECURITY NOTICE:
-- Anonymous and public browser access is strictly disallowed on all tables.
-- All client reads and writes are rejected by RLS.
-- Privileged operations will be performed exclusively by the trusted Node/Express
-- backend via the Supabase Secret Key (service role bypass).
-- Role-based admin policies will be attached in a future migration once
-- Supabase Admin Auth is provisioned.

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- No public or anonymous policies created intentionally.
