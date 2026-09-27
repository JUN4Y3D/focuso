import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Validates required Supabase server-only environment variables.
 * Supports Supabase's new Secret key (sb_secret_...).
 * Never logs or returns actual secret values.
 */
export function getSupabaseConfig(): { url: string; secretKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim()
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()

  const missing: string[] = []
  if (!url) missing.push('SUPABASE_URL')
  if (!secretKey) missing.push('SUPABASE_SECRET_KEY')

  if (missing.length > 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[Supabase Admin] Notice: Missing environment variable(s): ${missing.join(', ')}. ` +
          `Set these in .env to enable Supabase backend operations.`
      )
    }
    return null
  }

  return { url: url!, secretKey: secretKey! }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null
}

let cachedAdminClient: SupabaseClient | null = null

/**
 * Server-only Supabase Admin Client.
 *
 * CRITICAL SECURITY NOTICE:
 * This file is located in server/lib/ and must ONLY be imported by Node/Express server modules.
 * NEVER import this file or reference SUPABASE_SECRET_KEY from any file in src/.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cachedAdminClient) {
    return cachedAdminClient
  }

  const config = getSupabaseConfig()
  if (!config) {
    return null
  }

  cachedAdminClient = createClient(config.url, config.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return cachedAdminClient
}

/**
 * Minimal non-destructive connection verification.
 * Checks connectivity with the Supabase project without creating tables or inserting data.
 */
export async function verifySupabaseConnection(): Promise<{
  connected: boolean
  message: string
}> {
  const config = getSupabaseConfig()
  if (!config) {
    return {
      connected: false,
      message: 'Supabase credentials are not configured in environment variables.',
    }
  }

  try {
    const client = getSupabaseAdmin()
    if (!client) {
      return { connected: false, message: 'Failed to initialize Supabase client.' }
    }

    // Ping the Supabase Auth Admin service (lightweight, safe, non-destructive check)
    const { error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) {
      return {
        connected: false,
        message: `Supabase responded with an error: ${error.message}`,
      }
    }

    return {
      connected: true,
      message: 'Supabase admin client connected successfully.',
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown connection error'
    return {
      connected: false,
      message: `Failed to connect to Supabase: ${errorMsg}`,
    }
  }
}
