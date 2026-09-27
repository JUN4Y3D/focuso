-- ==============================================================================
-- Migration: 20260925_create_admin_users.sql
-- Description: Step 8A - Administrator Authentication & Authorization
-- Tables: public.admin_users
-- Security: Row Level Security (RLS) enabled on public.admin_users with zero
--           anonymous/public browser access. Backend service-role authorization only.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create public.admin_users Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on active for quick lookup
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(active);

-- ------------------------------------------------------------------------------
-- 2. Attach Reusable updated_at Trigger
-- ------------------------------------------------------------------------------
-- Reuses handle_updated_at() defined in 20260925_initial_backend_schema.sql
DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Intentionally NO public / anonymous policies created.
-- Browser clients cannot read, insert, update, or delete admin records.
-- All authorization queries occur on the trusted backend via service_role / Supabase Secret Key.
