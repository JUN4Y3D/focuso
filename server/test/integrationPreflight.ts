import { requireIsolatedSupabaseIntegrationTest } from './integrationGuard'

requireIsolatedSupabaseIntegrationTest('test:integration')
console.log('Integration test preflight passed: dedicated Supabase test environment confirmed.')
