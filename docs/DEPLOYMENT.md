# FOCUSO deployment contract

FOCUSO is a single Node/Express application. In development, Express hosts Vite middleware; in production, it serves the built `dist/` frontend and API routes from the same process.

## Build and start

Install dependencies with the project's supported Node-compatible package manager, then run:

```bash
npm run lint
npm run build
npm start
```

`npm start` runs `tsx server.ts`. Set `NODE_ENV=production` for the server to serve `dist/`; otherwise it starts Vite middleware for development. `npm run validate` is safe for ordinary development because it does not execute remote integration tests.

## Migration bootstrap

Apply the Supabase migrations in this exact order before starting the application against a new project:

1. `20260925_initial_backend_schema.sql`
2. `20260925_add_delivery_area_and_idempotency_to_orders.sql`
3. `20260925_create_admin_users.sql`
4. `20260925_replace_coupons_with_focus25.sql`
5. `20260926_order_mutations_and_audit_functions.sql`
6. `20260926_admin_mark_cod_paid.sql`

Do not sort these files alphabetically. Several migrations share the same date prefix, and alphabetical order would run dependent changes before the initial schema.

## Required server-only environment variables

- `SUPABASE_URL`: Supabase project URL used by the privileged server client.
- `SUPABASE_SECRET_KEY`: Supabase server secret/service-role credential. Never expose it to browser code.
- `GEMINI_API_KEY`: server-side Gemini credential for the FOCUSO Companion.
- `BKASH_SEND_MONEY_NUMBER`: manual bKash Send Money destination displayed to customers.

## Required browser/build variables

- `VITE_SUPABASE_URL`: Supabase project URL for browser-side admin authentication only.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: browser-safe Supabase publishable key for admin authentication only.

These `VITE_` values are embedded at build time. Do not place server secrets or the Gemini key in any `VITE_` variable.

## Runtime configuration

- `PORT`: HTTP listen port; defaults to `3000`.
- `NODE_ENV`: use `production` to serve the production build.
- `ALLOWED_ORIGINS`: comma-separated exact additional origins allowed for API CORS.
- `APP_URL`: exact application URL. It is used to recognize that app's AI Studio preview counterpart, when applicable.
- `FOCUSO_ENV=production`: explicitly enables production frame protection.
- `ENABLE_FRAMEGUARD=true`: explicitly enables `X-Frame-Options: SAMEORIGIN`.
- `AI_STUDIO_PREVIEW=true`: optional embedded-preview compatibility switch; do not set it in normal production.

Set the real FOCUSO production URL at deployment time; no production domain is hard-coded. Keep `ALLOWED_ORIGINS` limited to exact domains that need cross-origin API access. Protected admin APIs never allow wildcard CORS.

## Reverse proxy and health checks

The application currently uses `trust proxy = 1`, assuming one trusted proxy hop. Confirm this matches the actual hosting provider before launch; changing it without knowing the proxy topology can compromise client-IP rate limits.

Use `GET /api/health` for uptime or readiness monitoring. It returns only `{ "status": "ok" }` and does not perform a database health check.

## AI Studio independence

AI Studio markers only relax frame protection for an embedded preview. They are optional; normal production runs without `AI_STUDIO_PREVIEW` or platform-provided `APPLET_ID`, and uses standard production frame protection.
