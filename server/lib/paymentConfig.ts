/**
 * Centralized safe payment configuration service.
 * Manages customer-displayable payment configuration.
 *
 * CRITICAL SECURITY:
 * Never exposes server secrets, Supabase keys, or administrative credentials.
 */

export interface PublicPaymentConfig {
  bkashManualEnabled: boolean
  bkashNumber: string
}

export function getPublicPaymentConfig(): PublicPaymentConfig {
  const configuredNumber = process.env.BKASH_SEND_MONEY_NUMBER?.trim()
  // Provide safe fallback number if not explicitly set in environment
  const bkashNumber = configuredNumber || '01812345678'

  return {
    bkashManualEnabled: true,
    bkashNumber,
  }
}
