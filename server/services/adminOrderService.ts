import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { VALID_DISTRICTS } from '../domain/orderSchema.js'

export interface AdminOrderListItem {
  id: string
  orderNumber: string
  createdAt: string
  customerName: string
  phone: string
  district: string
  deliveryArea: string
  quantity: number
  finalTotal: number
  paymentMethod: string
  paymentStatus: string
  orderStatus: string
}

export interface AdminOrderDetailItem {
  id: string
  orderNumber: string
  createdAt: string
  quantity: number
  unitPrice: number
  productSubtotal: number
  couponCode: string | null
  couponDiscount: number
  deliveryCharge: number
  finalTotal: number
  customerName: string
  phone: string
  district: string
  deliveryArea: string
  deliveryAddress: string
  customerNote: string | null
  paymentMethod: string
  paymentStatus: string
  bkashTransactionId: string | null
  paymentVerifiedAt: string | null
  paymentVerifiedBy: string | null
  orderStatus: string
}

export interface AdminOrderListQuery {
  page?: number
  limit?: number
  search?: string
  paymentMethod?: string
  paymentStatus?: string
  orderStatus?: string
  district?: string
  from?: string
  to?: string
  sort?: 'desc' | 'asc'
}

export interface AdminOrdersResponse {
  orders: AdminOrderListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Extracts human-intended customer note from customer_note column.
 * Filters out internal structured prefixes like "Area: ...", "Idempotency: ...", "bKash TrxID: ...".
 */
export function extractCleanCustomerNote(rawNote: string | null | undefined): string | null {
  if (!rawNote || !rawNote.trim()) return null
  const segments = rawNote.split(' | ')
  const cleanSegments: string[] = []

  for (const seg of segments) {
    const trimmed = seg.trim()
    if (
      trimmed.startsWith('Area:') ||
      trimmed.startsWith('Idempotency:') ||
      trimmed.startsWith('bKash TrxID:')
    ) {
      continue
    }
    if (trimmed.startsWith('Note:')) {
      const noteText = trimmed.replace(/^Note:\s*/, '').trim()
      if (noteText) cleanSegments.push(noteText)
      continue
    }
    cleanSegments.push(trimmed)
  }

  const result = cleanSegments.join(' | ').trim()
  return result.length > 0 ? result : null
}

/**
 * Resolves delivery area from order record or customer note.
 */
export function resolveDeliveryArea(order: any): string {
  if (order.delivery_area && order.delivery_area.trim()) {
    return order.delivery_area.trim()
  }
  if (order.customer_note) {
    const match = order.customer_note.match(/Area:\s*([^|]+)/i)
    if (match && match[1]?.trim()) {
      return match[1].trim()
    }
  }
  return order.delivery_address || 'Standard Delivery'
}

/**
 * In-memory / audit-log cache for resolving exact district of orders.
 */
let auditMapCache: Map<string, string> | null = null
let auditMapCacheTimestamp = 0

async function getDistrictAuditMap(): Promise<Map<string, string>> {
  const now = Date.now()
  if (auditMapCache && now - auditMapCacheTimestamp < 30000) {
    return auditMapCache
  }

  const admin = getSupabaseAdmin()
  if (!admin) return new Map()

  try {
    const { data } = await admin
      .from('admin_audit_log')
      .select('entity_id, metadata')
      .eq('action', 'order_idempotency_lock')

    const newMap = new Map<string, string>()
    if (data) {
      for (const row of data) {
        if (row.entity_id && row.metadata?.district) {
          newMap.set(row.entity_id, row.metadata.district)
        }
      }
    }
    auditMapCache = newMap
    auditMapCacheTimestamp = now
    return newMap
  } catch (err) {
    console.warn('[AdminOrderService] Could not refresh district audit map:', err)
    return auditMapCache || new Map()
  }
}

/**
 * Resolves authoritative district for an order.
 */
export async function resolveDistrict(order: any, auditMap?: Map<string, string>): Promise<string> {
  const map = auditMap || (await getDistrictAuditMap())

  if (order.idempotency_key && map.has(order.idempotency_key)) {
    return map.get(order.idempotency_key)!
  }

  if (order.customer_note) {
    const match = order.customer_note.match(/Idempotency:\s*([a-f0-9\-]+)/i)
    if (match && match[1] && map.has(match[1])) {
      return map.get(match[1])!
    }
  }

  // Fallback to zone classification if audit log absent
  return order.delivery_zone === 'inside_chattogram' ? 'Chattogram' : 'Outside Chattogram'
}

/**
 * Queries orders for admin dashboard with pagination, search, filters, and sorting.
 */
export async function listAdminOrders(query: AdminOrderListQuery): Promise<AdminOrdersResponse> {
  const admin = getSupabaseAdmin()
  if (!admin) {
    throw new Error('Supabase admin client is not initialized.')
  }

  // 1. Pagination parameters validation
  let page = Number(query.page)
  if (!Number.isInteger(page) || page < 1) page = 1

  let limit = Number(query.limit)
  if (!Number.isInteger(limit) || limit < 1) limit = 20
  if (limit > 100) limit = 100

  // 2. Build base query with exact row count
  let sbQuery = admin.from('orders').select(
    `
      id,
      order_number,
      created_at,
      customer_name,
      phone,
      delivery_address,
      delivery_area,
      delivery_zone,
      quantity,
      final_total,
      payment_method,
      payment_status,
      order_status,
      customer_note,
      idempotency_key
    `,
    { count: 'exact' }
  )

  // 3. Search handling
  // Normalize search: trim, limit length, escape SQL LIKE wildcards
  if (query.search && query.search.trim()) {
    const rawSearch = query.search.trim().slice(0, 80)
    // Strip characters that could distort ilike filters
    const sanitizedSearch = rawSearch.replace(/[%_,]/g, ' ').trim()

    if (sanitizedSearch) {
      // Allow search across order_number, customer_name, or phone
      sbQuery = sbQuery.or(
        `order_number.ilike.%${sanitizedSearch}%,customer_name.ilike.%${sanitizedSearch}%,phone.ilike.%${sanitizedSearch}%`
      )
    }
  }

  // 4. Exact Filters
  if (query.paymentMethod) {
    const method = query.paymentMethod.trim()
    if (method === 'cod' || method === 'bkash_manual') {
      sbQuery = sbQuery.eq('payment_method', method)
    }
  }

  if (query.paymentStatus) {
    const status = query.paymentStatus.trim()
    const allowed = ['unpaid', 'pending_verification', 'paid', 'failed', 'refunded']
    if (allowed.includes(status)) {
      sbQuery = sbQuery.eq('payment_status', status)
    }
  }

  if (query.orderStatus) {
    const status = query.orderStatus.trim()
    const allowed = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
    if (allowed.includes(status)) {
      sbQuery = sbQuery.eq('order_status', status)
    }
  }

  // Date range filters (timezone-safe ISO parsing)
  if (query.from) {
    const fromDate = new Date(query.from)
    if (!isNaN(fromDate.getTime())) {
      sbQuery = sbQuery.gte('created_at', fromDate.toISOString())
    }
  }

  if (query.to) {
    const toDate = new Date(query.to)
    if (!isNaN(toDate.getTime())) {
      // Include the entire end-date day by pushing to end of day if only YYYY-MM-DD passed
      if (query.to.length <= 10) {
        toDate.setUTCHours(23, 59, 59, 999)
      }
      sbQuery = sbQuery.lte('created_at', toDate.toISOString())
    }
  }

  // 5. Sorting (default: created_at DESC)
  const ascending = query.sort === 'asc'
  sbQuery = sbQuery.order('created_at', { ascending })

  // 6. Pagination Range
  const fromIndex = (page - 1) * limit
  const toIndex = fromIndex + limit - 1
  sbQuery = sbQuery.range(fromIndex, toIndex)

  const { data, count, error } = await sbQuery

  if (error) {
    console.error('[AdminOrderService] listAdminOrders query error:', error.message)
    throw new Error('Failed to retrieve orders.')
  }

  const rawOrders = data || []
  const total = count || 0
  const totalPages = Math.ceil(total / limit) || 1

  // Resolve districts and format items
  const auditMap = await getDistrictAuditMap()

  let orders: AdminOrderListItem[] = []

  for (const row of rawOrders) {
    const district = await resolveDistrict(row, auditMap)
    const deliveryArea = resolveDeliveryArea(row)

    // District filter in-memory if user filtered by specific district
    if (query.district && query.district.trim()) {
      const targetDistrict = query.district.trim()
      if (district.toLowerCase() !== targetDistrict.toLowerCase()) {
        continue
      }
    }

    orders.push({
      id: row.id,
      orderNumber: row.order_number,
      createdAt: row.created_at,
      customerName: row.customer_name,
      phone: row.phone,
      district,
      deliveryArea,
      quantity: row.quantity,
      finalTotal: row.final_total,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      orderStatus: row.order_status,
    })
  }

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  }
}

/**
 * Retrieves full order details for admin by order ID or Order Number.
 * Strictly excludes secrets, idempotency keys, and auth credentials.
 */
export async function getAdminOrderDetail(identifier: string): Promise<AdminOrderDetailItem | null> {
  const admin = getSupabaseAdmin()
  if (!admin) {
    throw new Error('Supabase admin client is not initialized.')
  }

  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    return null
  }

  const trimmed = identifier.trim()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
  const isOrderNumber = /^FCS-[0-9A-Z]{6,12}$/i.test(trimmed)

  let query = admin.from('orders').select('*')

  if (isUuid) {
    query = query.eq('id', trimmed)
  } else if (isOrderNumber) {
    query = query.ilike('order_number', trimmed)
  } else {
    // Malformed identifier format
    return null
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error('[AdminOrderService] getAdminOrderDetail error:', error.message)
    throw new Error('Failed to retrieve order details.')
  }

  if (!data) {
    return null
  }

  const auditMap = await getDistrictAuditMap()
  const district = await resolveDistrict(data, auditMap)
  const deliveryArea = resolveDeliveryArea(data)
  const cleanNote = extractCleanCustomerNote(data.customer_note)

  return {
    id: data.id,
    orderNumber: data.order_number,
    createdAt: data.created_at,
    quantity: data.quantity,
    unitPrice: data.unit_price,
    productSubtotal: data.product_subtotal,
    couponCode: data.coupon_code || null,
    couponDiscount: data.coupon_discount || 0,
    deliveryCharge: data.delivery_charge,
    finalTotal: data.final_total,
    customerName: data.customer_name,
    phone: data.phone,
    district,
    deliveryArea,
    deliveryAddress: data.delivery_address,
    customerNote: cleanNote,
    paymentMethod: data.payment_method,
    paymentStatus: data.payment_status,
    bkashTransactionId: data.bkash_transaction_id || null,
    paymentVerifiedAt: data.payment_verified_at || null,
    paymentVerifiedBy: data.payment_verified_by || null,
    orderStatus: data.order_status,
  }
}
