import React, { useState } from 'react'
import { useAdminAuth } from '../../context/AdminAuthContext'

interface AdminLoginProps {
  onSuccess: () => void
}

export function AdminLogin({ onSuccess }: AdminLoginProps) {
  const { login, isConfigured, error: authError } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!email.trim() || !password) {
      setLocalError('Please enter both email and password.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await login(email, password)
      if (res.success) {
        onSuccess()
      } else if (res.error) {
        setLocalError(res.error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const displayedError = localError || authError

  return (
    <div className="min-h-screen bg-sand flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <span className="font-serif tracking-widest text-2xl font-bold text-deep">
            FOCUSO
          </span>
          <span className="block text-xs uppercase tracking-widest text-olive font-semibold mt-1">
            Administrator Portal
          </span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-stone-200/80 rounded-2xl sm:px-10">
          {!isConfigured && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
              <strong>Notice:</strong> Browser Supabase authentication variables (<code className="font-mono">VITE_SUPABASE_URL</code> and <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code>) are not yet configured in this environment.
            </div>
          )}

          {displayedError && (
            <div
              role="alert"
              className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium leading-relaxed"
            >
              {displayedError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold uppercase tracking-wider text-ink/80 mb-1.5"
              >
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-ink text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-deep/20 focus:border-deep transition"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold uppercase tracking-wider text-ink/80 mb-1.5"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-ink text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-deep/20 focus:border-deep transition"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !isConfigured}
              className="w-full mt-2 py-3 px-4 bg-deep text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm hover:bg-deep/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-deep disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-stone-100 text-center">
            <p className="text-[11px] text-stone-400">
              FOCUSO Operations &bull; Authorised Personnel Only
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
