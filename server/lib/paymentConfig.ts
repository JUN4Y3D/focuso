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

  return {
    bkashManualEnabled: true,
    // Server startup rejects a missing number, so never surface a hard-coded
    // payment destination if this helper is reused outside normal startup.
    bkashNumber: configuredNumber || '',
  }
}
