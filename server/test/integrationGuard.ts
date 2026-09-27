/**
 * Blocks database-backed test suites unless they target an explicitly
 * configured, isolated Supabase project. This prevents tests from silently
 * using a developer's or production project's active server credentials.
 */
export function requireIsolatedSupabaseIntegrationTest(testName: string): void {
  if (process.env.RUN_SUPABASE_INTEGRATION_TESTS !== 'true') {
    throw new Error(
      `[Integration test blocked] ${testName} requires RUN_SUPABASE_INTEGRATION_TESTS=true and an isolated Supabase test project.`
    )
  }

  const testUrl = process.env.SUPABASE_TEST_URL?.trim()
  const testSecret = process.env.SUPABASE_TEST_SECRET_KEY?.trim()
  const testPublishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY?.trim()

  if (!testUrl || !testSecret || !testPublishableKey) {
    throw new Error(
      `[Integration test blocked] ${testName} requires SUPABASE_TEST_URL, SUPABASE_TEST_SECRET_KEY, and SUPABASE_TEST_PUBLISHABLE_KEY.`
    )
  }

  if (
    process.env.SUPABASE_URL?.trim() !== testUrl ||
    process.env.SUPABASE_SECRET_KEY?.trim() !== testSecret ||
    process.env.VITE_SUPABASE_URL?.trim() !== testUrl ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() !== testPublishableKey
  ) {
    throw new Error(
      `[Integration test blocked] ${testName} must run with SUPABASE_URL, SUPABASE_SECRET_KEY, VITE_SUPABASE_URL, and VITE_SUPABASE_PUBLISHABLE_KEY set to the dedicated test project values.`
    )
  }
}
