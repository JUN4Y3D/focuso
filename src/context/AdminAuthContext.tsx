import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getSupabaseBrowserClient, isSupabaseAuthAvailable } from '../lib/supabaseClient'

export interface AdminUser {
  id: string
  email: string
}

interface AdminAuthContextType {
  admin: AdminUser | null
  loading: boolean
  error: string | null
  isConfigured: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Verify backend authorization using access token
  const verifyTokenWithBackend = useCallback(async (token: string): Promise<AdminUser | null> => {
    try {
      const res = await fetch('/api/admin/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.status === 401) {
        // Token invalid or expired
        return null
      }

      if (res.status === 403) {
        // Authenticated user exists, but is NOT an active FOCUSO admin
        throw new Error('You do not have administrator access.')
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Authorization check failed.')
      }

      const data = await res.json()
      if (data.authenticated && data.user) {
        return {
          id: data.user.id,
          email: data.user.email,
        }
      }
      return null
    } catch (err: any) {
      if (err.message === 'You do not have administrator access.') {
        throw err
      }
      console.warn('[AdminAuth] Authorization verification request failed:', err)
      return null
    }
  }, [])

  // Check current session on mount and when refreshed
  const refreshAuth = useCallback(async () => {
    setLoading(true)
    setError(null)

    const client = getSupabaseBrowserClient()
    if (!client) {
      setAdmin(null)
      setLoading(false)
      return
    }

    try {
      const { data: { session }, error: sessionError } = await client.auth.getSession()

      if (sessionError || !session?.access_token) {
        setAdmin(null)
        setLoading(false)
        return
      }

      try {
        const verifiedAdmin = await verifyTokenWithBackend(session.access_token)
        if (verifiedAdmin) {
          setAdmin(verifiedAdmin)
        } else {
          // Token rejected by backend
          await client.auth.signOut().catch(() => {})
          setAdmin(null)
        }
      } catch (authErr: any) {
        // 403 Forbidden: Sign user out and display clear error
        await client.auth.signOut().catch(() => {})
        setAdmin(null)
        setError(authErr.message || 'You do not have administrator access.')
      }
    } catch (e: any) {
      setAdmin(null)
      setError('An error occurred while verifying your session.')
    } finally {
      setLoading(false)
    }
  }, [verifyTokenWithBackend])

  useEffect(() => {
    refreshAuth()

    const client = getSupabaseBrowserClient()
    if (!client) return

    // Listen to Supabase Auth state changes (e.g. token refreshed, signed out)
    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setAdmin(null)
      } else if (event === 'TOKEN_REFRESHED' && session.access_token) {
        try {
          const verified = await verifyTokenWithBackend(session.access_token)
          if (!verified) {
            await client.auth.signOut().catch(() => {})
            setAdmin(null)
          }
        } catch {
          await client.auth.signOut().catch(() => {})
          setAdmin(null)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [refreshAuth, verifyTokenWithBackend])

  // Login handler
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setError(null)
    const client = getSupabaseBrowserClient()
    if (!client) {
      const msg = 'Supabase Auth is not configured in this environment (missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY).'
      setError(msg)
      return { success: false, error: msg }
    }

    try {
      // 1. Supabase Auth sign in
      const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError || !authData.session?.access_token) {
        const msg = authError?.message || 'Invalid email or password.'
        setError(msg)
        return { success: false, error: msg }
      }

      // 2. Authoritative backend authorization verification
      try {
        const verifiedAdmin = await verifyTokenWithBackend(authData.session.access_token)
        if (!verifiedAdmin) {
          await client.auth.signOut().catch(() => {})
          const msg = 'Session could not be validated. Please try again.'
          setError(msg)
          return { success: false, error: msg }
        }

        setAdmin(verifiedAdmin)
        return { success: true }
      } catch (authzErr: any) {
        // Critical requirement: If user is authenticated in Supabase but not an active admin:
        // sign user out and show "You do not have administrator access."
        await client.auth.signOut().catch(() => {})
        setAdmin(null)
        const msg = authzErr.message || 'You do not have administrator access.'
        setError(msg)
        return { success: false, error: msg }
      }
    } catch (e: any) {
      const msg = e.message || 'An unexpected error occurred during login.'
      setError(msg)
      return { success: false, error: msg }
    }
  }

  // Logout handler
  const logout = async () => {
    const client = getSupabaseBrowserClient()
    try {
      if (client) {
        await client.auth.signOut().catch(() => {})
      }
    } finally {
      setAdmin(null)
      setError(null)
    }
  }

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        loading,
        error,
        isConfigured: isSupabaseAuthAvailable,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}
