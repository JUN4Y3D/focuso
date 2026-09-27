/**
 * Server Environment Variable Validation (Step 9A)
 * Validates critical server secrets at startup without exposing secret values or leaking them to logs.
 */

export interface ValidatedServerEnv {
  supabaseUrl: string
  supabaseSecretKey: string
  geminiApiKey: string
  bkashSendMoneyNumber: string
  nodeEnv: string
  port: number
}

export function validateServerEnvironment(): ValidatedServerEnv {
  const missing: string[] = []

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  if (!supabaseUrl) {
    missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)')
  }

  const supabaseSecretKey = (process.env.SUPABASE_SECRET_KEY || '').trim()
  if (!supabaseSecretKey) {
    missing.push('SUPABASE_SECRET_KEY')
  }

  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!geminiApiKey) {
    missing.push('GEMINI_API_KEY')
  }

  const bkashSendMoneyNumber = (process.env.BKASH_SEND_MONEY_NUMBER || '').trim()
  if (!bkashSendMoneyNumber) {
    missing.push('BKASH_SEND_MONEY_NUMBER')
  }

  if (missing.length > 0) {
    const errorMsg = `[Startup Validation Error] Missing required server environment variable(s): ${missing.join(
      ', '
    )}`
    console.error(errorMsg)
    throw new Error(errorMsg)
  }

  // Basic format sanity checks without logging values
  if (!supabaseUrl.startsWith('https://') && !supabaseUrl.startsWith('http://')) {
    throw new Error('[Startup Validation Error] SUPABASE_URL must be a valid HTTP/HTTPS URL.')
  }

  if (!/^01[3-9]\d{8}$/.test(bkashSendMoneyNumber)) {
    throw new Error(
      '[Startup Validation Error] BKASH_SEND_MONEY_NUMBER must be a valid 11-digit Bangladeshi mobile number.'
    )
  }

  return {
    supabaseUrl,
    supabaseSecretKey,
    geminiApiKey,
    bkashSendMoneyNumber,
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 3000,
  }
}
