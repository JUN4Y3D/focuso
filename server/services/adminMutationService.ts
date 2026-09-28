import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'

export class MutationConflictError extends Error {
  public readonly statusCode: number = 409
  public readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'MutationConflictError'
    this.code = code
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class MutationValidationError extends Error {
  public readonly statusCode: number = 400
  public readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'MutationValidationError'
    this.code = code
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class MutationNotFoundError extends Error {
  public readonly statusCode: number = 404
  public readonly code: string = 'order_not_found'

  constructor(message: string = 'Order not found.') {
    super(message)
    this.name = 'MutationNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export interface AdminAuditEntry {
  id: string
  action: string
  createdAt: string
  adminUserId: string | null
  adminEmail: string | null
  metadata: Record<string, any>
}

export const ALLOWED_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const

export type OrderStatusType = (typeof ALLOWED_ORDER_STATUSES)[number]

/**
 * Translates PostgreSQL RPC raised exceptions into typed domain errors.
 * Never exposes SQL stack traces, database schema details, or service-role credentials.
 */
function handleRpcError(error: any): never {
  const rawMessage = (error?.message || '').trim()

  if (rawMessage === 'ORDER_NOT_FOUND' || rawMessage.includes('ORDER_NOT_FOUND')) {
    throw new MutationNotFoundError('Order not found.')
  }

  if (rawMessage.startsWith('INVALID_STATUS')) {
    const cleanMsg = rawMessage.replace(/^INVALID_STATUS:\s*/, '')
    throw new MutationValidationError('invalid_status', cleanMsg || 'Invalid order status.')
  }

  if (rawMessage.startsWith('INVALID_REASON')) {
    const cleanMsg = rawMessage.replace(/^INVALID_REASON:\s*/, '')
    throw new MutationValidationError('invalid_reason', cleanMsg || 'Invalid failure reason.')
  }

  if (rawMessage.startsWith('INVALID_TRANSITION')) {
    const cleanMsg = rawMessage.replace(/^INVALID_TRANSITION:\s*/, '')
    throw new MutationConflictError('invalid_transition', cleanMsg || 'Invalid status transition.')
  }

  if (rawMessage.startsWith('INVALID_PAYMENT_METHOD')) {
    const cleanMsg = rawMessage.replace(/^INVALID_PAYMENT_METHOD:\s*/, '')
    throw new MutationConflictError('invalid_payment_method', cleanMsg || 'Invalid payment method.')
  }

  if (rawMessage.startsWith('INVALID_PAYMENT_STATUS')) {
    const cleanMsg = rawMessage.replace(/^INVALID_PAYMENT_STATUS:\s*/, '')
    throw new MutationConflictError('invalid_payment_status', cleanMsg || 'Invalid payment status.')
  }

  if (rawMessage.startsWith('ALREADY_PAID')) {
    const cleanMsg = rawMessage.replace(/^ALREADY_PAID:\s*/, '')
    throw new MutationConflictError('already_paid', cleanMsg || 'Order is already marked as paid.')
  }

  // Log unknown/internal DB exceptions server-side only
  console.error('[AdminMutationService] PostgreSQL RPC error:', error)
  throw new Error('Database mutation failed.')
}

/**
 * Authoritative Order Status Mutation via PostgreSQL RPC:
 * Executes public.admin_update_order_status inside a single PostgreSQL transaction
 * with row locking (SELECT ... FOR UPDATE) and atomic audit logging.
 */
export async function updateOrderStatus(
  orderId: string,
  targetStatus: OrderStatusType,
  adminUser: { id: string; email: string }
): Promise<{
  orderId: string
  orderStatus: string
  fromStatus: string
  alreadyInState?: boolean
}> {
  const admin = getSupabaseAdmin()
  if (!admin) {
    throw new Error('Supabase admin client not initialized.')
  }

  const { data, error } = await admin.rpc('admin_update_order_status', {
    p_order_id: orderId,
    p_new_status: targetStatus,
    p_admin_id: adminUser.id,
    p_admin_email: adminUser.email,
  })

  if (error) {
    handleRpcError(error)
  }

  if (data?.unchanged) {
    return {
      orderId: data.orderId || orderId,
      orderStatus: data.orderStatus || targetStatus,
      fromStatus: data.orderStatus || targetStatus,
      alreadyInState: true,
    }
  }

  return {
    orderId: data.orderId || orderId,
    orderStatus: data.to || targetStatus,
    fromStatus: data.from || targetStatus,
  }
}

/**
 * Authoritative bKash Manual Payment Verification via PostgreSQL RPC:
 * Executes public.admin_verify_bkash_payment inside a single PostgreSQL transaction
 * with row locking, atomic payment status change, and audit logging.
 */
export async function verifyBkashPayment(
  orderId: string,
  adminUser: { id: string; email: string }
): Promise<{
  orderId: string
  paymentStatus: string
  paymentVerifiedAt: string
  paymentVerifiedBy: string
  alreadyPaid?: boolean
}> {
  const admin = getSupabaseAdmin()
  if (!admin) {
    throw new Error('Supabase admin client not initialized.')
  }

  const { data, error } = await admin.rpc('admin_verify_bkash_payment', {
    p_order_id: orderId,
    p_admin_id: adminUser.id,
    p_admin_email: adminUser.email,
  })

  if (error) {
    handleRpcError(error)
  }

  return {
    orderId: data.orderId || orderId,
    paymentStatus: data.paymentStatus || data.to || 'paid',
    paymentVerifiedAt: data.paymentVerifiedAt,
    paymentVerifiedBy: data.paymentVerifiedBy,
    alreadyPaid: Boolean(data.alreadyPaid),
  }
}

/**
 * Authoritative bKash Manual Payment Failure via PostgreSQL RPC:
 * Executes public.admin_fail_bkash_payment inside a single PostgreSQL transaction
 * with row locking, reason audit logging, and strict decoupling from order_status.
 */
export async function failBkashPayment(
  orderId: string,
  rawReason: string,
  adminUser: { id: string; email: string }
): Promise<{
  orderId: string
  paymentStatus: string
  reason: string
  alreadyFailed?: boolean
}> {
  const admin = getSupabaseAdmin()
  if (!admin) {
    throw new Error('Supabase admin client not initialized.')
  }

  const reason = (rawReason || '').trim()
  if (!reason || reason.length < 3 || reason.length > 300) {
    throw new MutationValidationError(
      'invalid_reason',
      'Failure reason is required and must be between 3 and 300 characters.'
    )
  }

  const { data, error } = await admin.rpc('admin_fail_bkash_payment', {
    p_order_id: orderId,
    p_reason: reason,
    p_admin_id: adminUser.id,
    p_admin_email: adminUser.email,
  })

  if (error) {
    handleRpcError(error)
  }

  return {
    orderId: data.orderId || orderId,
    paymentStatus: data.paymentStatus || data.to || 'failed',
    reason: data.reason || reason,
    alreadyFailed: Boolean(data.alreadyFailed),
  }
}

/**
 * Authoritative Cash on Delivery Payment Collection via PostgreSQL RPC:
 * Executes public.admin_mark_cod_paid inside a single PostgreSQL transaction
 * with row locking, atomic payment status change (unpaid -> paid), and audit logging.
 */
export async function markCodPaid(
  orderId: string,
  adminUser: { id: string; email: string }
): Promise<{
  orderId: string
  paymentStatus: string
  paymentVerifiedAt: string
  paymentVerifiedBy: string
  amount: number
  alreadyPaid?: boolean
}> {
  const admin = getSupabaseAdmin()
  if (!admin) {
    throw new Error('Supabase admin client not initialized.')
  }

  const { data, error } = await admin.rpc('admin_mark_cod_paid', {
    p_order_id: orderId,
    p_admin_id: adminUser.id,
    p_admin_email: adminUser.email,
  })

  if (error) {
    handleRpcError(error)
  }

  return {
    orderId: data.orderId || orderId,
    paymentStatus: data.paymentStatus || 'paid',
    paymentVerifiedAt: data.paymentVerifiedAt,
    paymentVerifiedBy: data.paymentVerifiedBy,
    amount: data.amount,
    alreadyPaid: Boolean(data.alreadyPaid),
  }
}

/**
 * Retrieves chronological audit history for a specific order.
 * Sanitizes metadata and resolves admin emails safely without exposing customer PII.
 */
export async function getOrderAuditHistory(orderId: string): Promise<AdminAuditEntry[]> {
  const admin = getSupabaseAdmin()
  if (!admin) {
    throw new Error('Supabase admin client not initialized.')
  }

  // Verify order exists
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .maybeSingle()

  if (orderErr) {
    console.error('[AdminMutationService] Error checking order existence:', orderErr.message)
    throw new Error('Failed to verify order.')
  }

  if (!order) {
    throw new MutationNotFoundError()
  }

  // Fetch only audit rows for this order
  const { data: rows, error: auditErr } = await admin
    .from('admin_audit_log')
    .select('id, action, created_at, admin_user_id, metadata')
    .eq('entity_type', 'order')
    .eq('entity_id', orderId)
    .order('created_at', { ascending: true })

  if (auditErr) {
    console.error('[AdminMutationService] Error fetching audit logs:', auditErr.message)
    throw new Error('Failed to retrieve audit history.')
  }

  if (!rows || rows.length === 0) {
    return []
  }

  // Collect distinct admin user IDs needing email lookup
  const adminUserIds = Array.from(
    new Set(rows.map((r) => r.admin_user_id).filter((id): id is string => Boolean(id)))
  )

  const emailMap = new Map<string, string>()

  // Fetch admin user emails if possible
  for (const adminId of adminUserIds) {
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(adminId)
      if (authUser?.user?.email) {
        emailMap.set(adminId, authUser.user.email)
      }
    } catch {
      // Fallback to metadata.adminEmail if user lookup fails
    }
  }

  return rows.map((row) => {
    const meta = (row.metadata || {}) as Record<string, any>
    const resolvedEmail =
      (row.admin_user_id ? emailMap.get(row.admin_user_id) : null) ||
      meta.adminEmail ||
      null

    // Build sanitized metadata removing any customer PII or raw internals
    const sanitizedMeta: Record<string, any> = {}
    if (meta.from !== undefined) sanitizedMeta.from = meta.from
    if (meta.to !== undefined) sanitizedMeta.to = meta.to
    if (meta.reason !== undefined) sanitizedMeta.reason = meta.reason
    if (meta.expectedAmount !== undefined) sanitizedMeta.expectedAmount = meta.expectedAmount
    if (meta.transactionId !== undefined) sanitizedMeta.transactionId = meta.transactionId
    if (meta.amount !== undefined) sanitizedMeta.amount = meta.amount

    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      adminUserId: row.admin_user_id,
      adminEmail: resolvedEmail,
      metadata: sanitizedMeta,
    }
  })
}
