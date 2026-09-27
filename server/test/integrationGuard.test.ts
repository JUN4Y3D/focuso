import assert from 'node:assert/strict'
import { requireIsolatedSupabaseIntegrationTest } from './integrationGuard'

const keys = [
  'RUN_SUPABASE_INTEGRATION_TESTS',
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_TEST_URL',
  'SUPABASE_TEST_SECRET_KEY',
  'SUPABASE_TEST_PUBLISHABLE_KEY',
] as const

const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]))

try {
  for (const key of keys) delete process.env[key]
  assert.throws(() => requireIsolatedSupabaseIntegrationTest('guard test'), /RUN_SUPABASE_INTEGRATION_TESTS=true/)

  Object.assign(process.env, {
    RUN_SUPABASE_INTEGRATION_TESTS: 'true',
    SUPABASE_TEST_URL: 'https://test.supabase.co',
    SUPABASE_TEST_SECRET_KEY: 'test-secret',
    SUPABASE_TEST_PUBLISHABLE_KEY: 'test-publishable',
  })
  assert.throws(() => requireIsolatedSupabaseIntegrationTest('guard test'), /must run with SUPABASE_URL/)

  Object.assign(process.env, {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SECRET_KEY: 'test-secret',
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable',
  })
  assert.doesNotThrow(() => requireIsolatedSupabaseIntegrationTest('guard test'))
  console.log('Integration safety guard: 3 assertions passed.')
} finally {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
}
