import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser-safe Supabase Client.
 *
 * CRITICAL SECURITY ARCHITECTURE:
 * - Uses ONLY browser-safe public variables:
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_PUBLISHABLE_KEY
 * - NEVER imports SUPABASE_SECRET_KEY, Cloudflare AI credentials, or other server-only credentials.
 * - Used strictly for admin Supabase Auth (signInWithPassword, signOut, getSession, onAuthStateChange).
 * - Customer store users remain pure guest checkouts without accounts or sessions.
 */

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || ''

export const isSupabaseAuthAvailable = Boolean(supabaseUrl && supabasePublishableKey)

let clientInstance: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseAuthAvailable) {
    return null
  }
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'focuso_admin_auth',
      },
    })
  }
  return clientInstance
}
