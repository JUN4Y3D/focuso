# FOCUSO isolated integration-test environment

Integration tests must run only against a dedicated Supabase project. They create test users, orders, payment states, and audit rows; do not point them at production or a developer's shared environment.

## Provision the project

1. Create a new Supabase project reserved for FOCUSO testing.
2. Record its project URL, server secret/service-role credential, and browser publishable key.
3. Apply repository migrations in this exact order:

   **Do not apply these files in alphabetical filename order.** Several migrations share the same date prefix, and alphabetical ordering would run dependent changes before the initial schema.

   1. `20260925_initial_backend_schema.sql`
   2. `20260925_add_delivery_area_and_idempotency_to_orders.sql`
   3. `20260925_create_admin_users.sql`
   4. `20260925_replace_coupons_with_focus25.sql`
   5. `20260926_order_mutations_and_audit_functions.sql`
   6. `20260926_admin_mark_cod_paid.sql`

4. Do not seed an admin in advance unless you need to inspect the dashboard manually. The protected integration suites create and remove their own test admins.
5. Copy `.env.test.example` to a local ignored `.env.test` file and fill it with test-project values only.

## Required variable matching

`RUN_SUPABASE_INTEGRATION_TESTS` must be `true`. The guard also requires all of these active variables to match their `SUPABASE_TEST_*` counterpart exactly:

- `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`

This prevents a test command from silently using production credentials.

## Run tests

Load the local test environment into your shell, then start the application in a separate terminal:

```bash
set -a; source .env.test; set +a
npm run dev
```

With that server running, use another terminal with the same environment:

```bash
set -a; source .env.test; set +a
npm run test:integration
```

`test:integration` runs a preflight guard before any database-backed suite. If the dedicated project variables are absent or do not match the active variables, it exits before contacting Supabase.

The safe default commands are `npm test` and `npm run validate`; neither runs remote Supabase tests.
