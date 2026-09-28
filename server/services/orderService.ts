import crypto from 'node:crypto'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { calculateBasePricing } from '../domain/pricing.js'
import {
  validateAndCalculateCoupon,
  normalizeCouponCode,
} from './coupons.js'
import {
  CreateOrderRequest,
  normalizeBangladeshPhone,
  maskPhoneForLogs,
  normalizeBkashTrxId,
} from '../domain/orderSchema.js'

export interface OrderConfirmationResponse {
  orderNumber: string
  quantity: number
  productSubtotal: number
  coupon: {
    code: string | null
    discountAmount: number
  }
  deliveryCharge: number
  finalTotal: number
  paymentMethod: 'cod' | 'bkash_manual'
  paymentStatus: 'unpaid' | 'pending_verification'
  orderStatus: 'pending'
  bkashTransactionId?: string | null
  createdAt: string
  isDuplicate?: boolean
}

/**
 * Generates an uppercase, cryptographically random, collision-resistant order number.
 * Format: FCS-XXXXXXXX (8 random alphanumeric chars, excluding easily confused characters)
 */
export function generateOrderNumber(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // Base32 unambiguous
  const bytes = crypto.randomBytes(8)
  let result = 'FCS-'
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length]
  }
  return result
}

export class OrderServiceError extends Error {
  public readonly statusCode: number
  public readonly code: string

  constructor(statusCode: number, code: string, message: string) {
    super(message)
    this.name = 'OrderServiceError'
    this.statusCode = statusCode
    this.code = code
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Creates an order in Supabase with:
 * 1. Strict server-side pricing recalculation.
 * 2. Independent coupon validation against Supabase.
 * 3. Payment method enforcement:
 *    - 'cod': payment_status = 'unpaid', no TrxID allowed.
 *    - 'bkash_manual': payment_status = 'pending_verification', normalized TrxID required.
 * 4. Case-insensitive duplicate TrxID prevention.
 * 5. Idempotency management via admin_audit_log lock & unique partial index.
 * 6. Atomic coupon usage increment.
 */
export async function createOrder(
  input: CreateOrderRequest
): Promise<OrderConfirmationResponse> {
  const admin = getSupabaseAdmin()
  if (!admin) {
    console.error('[OrderService] Supabase admin client not initialized.')
    throw new OrderServiceError(500, 'database_unavailable', 'Database service is currently unavailable.')
  }

  // Normalize phone
  const normalizedPhone = normalizeBangladeshPhone(input.phone)
  if (!normalizedPhone) {
    throw new OrderServiceError(
      400,
      'invalid_phone',
      'Invalid Bangladesh mobile phone number.'
    )
  }

  // Payment method & TrxID normalization
  const paymentMethod = input.paymentMethod || 'cod'
  let normalizedTrxId: string | null = null

  if (paymentMethod === 'bkash_manual') {
    normalizedTrxId = normalizeBkashTrxId(input.bkashTransactionId)
    if (!normalizedTrxId) {
      throw new OrderServiceError(
        400,
        'invalid_bkash_trx_id',
        'A valid bKash Transaction ID is required for bKash payment.'
      )
    }
  }

  // 1. Authoritative Pricing Calculation
  const basePricing = calculateBasePricing({
    quantity: input.quantity,
    district: input.district,
  })

  // 2. Authoritative Coupon Calculation
  let validatedCouponCode: string | null = null
  let couponDiscount = 0

  if (input.couponCode && input.couponCode.trim()) {
    const rawCoupon = input.couponCode.trim()
    const couponRes = await validateAndCalculateCoupon(
      rawCoupon,
      basePricing.productSubtotal
    )

    if (!couponRes.valid) {
      throw new OrderServiceError(
        400,
        couponRes.reason || 'invalid_coupon',
        couponRes.message || 'The specified coupon code is invalid or expired.'
      )
    }

    validatedCouponCode = couponRes.code
    couponDiscount = couponRes.discountAmount
  }

  const finalTotal = Math.max(
    0,
    basePricing.productSubtotal - couponDiscount + basePricing.deliveryCharge
  )

  // Determine initial payment status strictly on backend
  const paymentStatus: 'unpaid' | 'pending_verification' =
    paymentMethod === 'bkash_manual' ? 'pending_verification' : 'unpaid'

  // 3. Idempotency Check via admin_audit_log lock
  const { data: existingLock, error: lockErr } = await admin
    .from('admin_audit_log')
    .select('id, metadata, created_at')
    .eq('action', 'order_idempotency_lock')
    .eq('entity_id', input.idempotencyKey)
    .maybeSingle()

  if (lockErr) {
    console.error('[OrderService] Error checking idempotency:', lockErr.message)
    throw new OrderServiceError(500, 'server_error', 'Failed to process order.')
  }

  if (existingLock && existingLock.metadata) {
    const meta = existingLock.metadata as {
      orderNumber: string
      quantity: number
      productSubtotal: number
      couponCode: string | null
      couponDiscount: number
      deliveryCharge: number
      finalTotal: number
      district: string
      deliveryArea: string
      deliveryAddress: string
      phone: string
      customerName: string
      paymentMethod?: string
      bkashTransactionId?: string | null
    }

    // Verify whether this is an identical retry or a conflicting reuse
    const isExactMatch =
      meta.quantity === input.quantity &&
      meta.district === input.district &&
      meta.couponCode === validatedCouponCode &&
      meta.deliveryArea === input.deliveryArea &&
      meta.phone === normalizedPhone &&
      (meta.paymentMethod || 'cod') === paymentMethod &&
      (meta.bkashTransactionId || null) === (normalizedTrxId || null)

    if (!isExactMatch) {
      throw new OrderServiceError(
        409,
        'idempotency_conflict',
        'Idempotency key has already been used with different order details.'
      )
    }

    // Identical retry: Return existing order without creating duplicate or re-incrementing coupon
    return {
      orderNumber: meta.orderNumber,
      quantity: meta.quantity,
      productSubtotal: meta.productSubtotal,
      coupon: {
        code: meta.couponCode,
        discountAmount: meta.couponDiscount,
      },
      deliveryCharge: meta.deliveryCharge,
      finalTotal: meta.finalTotal,
      paymentMethod: (meta.paymentMethod as 'cod' | 'bkash_manual') || 'cod',
      paymentStatus: (meta.paymentMethod === 'bkash_manual' ? 'pending_verification' : 'unpaid'),
      orderStatus: 'pending',
      bkashTransactionId: meta.bkashTransactionId || null,
      createdAt: existingLock.created_at,
      isDuplicate: true,
    }
  }

  // 4. Duplicate TrxID Check for bKash (only after idempotency check passes)
  if (paymentMethod === 'bkash_manual' && normalizedTrxId) {
    const { data: existingTrxOrder, error: trxErr } = await admin
      .from('orders')
      .select('id, order_number')
      .ilike('bkash_transaction_id', normalizedTrxId)
      .maybeSingle()

    if (trxErr) {
      console.error('[OrderService] Error checking existing TrxID:', trxErr.message)
      throw new OrderServiceError(500, 'server_error', 'Failed to verify transaction ID.')
    }

    if (existingTrxOrder) {
      // Conflict: This TrxID is already attached to another order
      throw new OrderServiceError(
        409,
        'duplicate_transaction_id',
        'This transaction ID has already been used. Please check your bKash transaction and try again.'
      )
    }
  }

  // 5. Generate Order Number with retry on collision
  let orderNumber = ''
  let insertedOrder: any = null
  const maxRetries = 3

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    orderNumber = generateOrderNumber()

    // Structured customer_note storing distinct deliveryArea & idempotencyKey
    const noteSegments: string[] = []
    if (input.deliveryArea) {
      noteSegments.push(`Area: ${input.deliveryArea}`)
    }
    noteSegments.push(`Idempotency: ${input.idempotencyKey}`)
    if (input.customerNote && input.customerNote.trim()) {
      noteSegments.push(`Note: ${input.customerNote.trim()}`)
    }
    if (paymentMethod === 'bkash_manual' && normalizedTrxId) {
      noteSegments.push(`bKash TrxID: ${normalizedTrxId}`)
    }
    const combinedCustomerNote = noteSegments.join(' | ')

    const { data, error } = await admin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_name: input.customerName.trim(),
        phone: normalizedPhone,
        delivery_address: input.deliveryAddress.trim(),
        delivery_area: input.deliveryArea.trim(),
        delivery_zone: basePricing.deliveryZone,
        quantity: input.quantity,
        unit_price: basePricing.unitPrice,
        product_subtotal: basePricing.productSubtotal,
        coupon_code: validatedCouponCode,
        coupon_discount: couponDiscount,
        delivery_charge: basePricing.deliveryCharge,
        final_total: finalTotal,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        order_status: 'pending',
        bkash_transaction_id: normalizedTrxId,
        customer_note: combinedCustomerNote,
        idempotency_key: input.idempotencyKey,
      })
      .select()
      .maybeSingle()

    if (error) {
      // Check for rare unique constraint collision on order_number
      if (error.code === '23505' && error.message.includes('order_number')) {
        console.warn(`[OrderService] Collision on order_number ${orderNumber}, retrying...`)
        continue
      }

      // Check for unique index violation on bkash_transaction_id
      if (error.code === '23505' && error.message.includes('bkash_transaction_id')) {
        throw new OrderServiceError(
          409,
          'duplicate_transaction_id',
          'This transaction ID has already been used. Please check your bKash transaction and try again.'
        )
      }

      // Check for concurrent race condition where another request with the same idempotency key succeeded
      if (error.code === '23505' && error.message.includes('idempotency_key')) {
        console.warn(`[OrderService] Concurrent insert collision on idempotency key ${input.idempotencyKey}. Retrieving existing order...`)
        const { data: existingOrder } = await admin
          .from('orders')
          .select('*')
          .eq('idempotency_key', input.idempotencyKey)
          .maybeSingle()

        if (existingOrder) {
          return {
            orderNumber: existingOrder.order_number,
            quantity: existingOrder.quantity,
            productSubtotal: existingOrder.product_subtotal,
            coupon: {
              code: existingOrder.coupon_code,
              discountAmount: existingOrder.coupon_discount,
            },
            deliveryCharge: existingOrder.delivery_charge,
            finalTotal: existingOrder.final_total,
            paymentMethod: (existingOrder.payment_method as 'cod' | 'bkash_manual') || 'cod',
            paymentStatus: (existingOrder.payment_status as 'unpaid' | 'pending_verification') || 'unpaid',
            orderStatus: 'pending',
            bkashTransactionId: existingOrder.bkash_transaction_id,
            createdAt: existingOrder.created_at,
            isDuplicate: true,
          }
        }
      }

      console.error('[OrderService] Order insert error:', error.message)
      throw new OrderServiceError(500, 'order_creation_failed', 'Failed to create order record.')
    }

    insertedOrder = data
    break
  }

  if (!insertedOrder) {
    throw new OrderServiceError(500, 'order_creation_failed', 'Could not generate unique order number.')
  }

  // 6. Atomic-style Coupon Consumption
  // If a valid coupon was used, increment usage_count now that the order row exists
  if (validatedCouponCode) {
    try {
      const { data: currentCoupon } = await admin
        .from('coupons')
        .select('id, usage_count')
        .eq('code', validatedCouponCode)
        .single()

      if (currentCoupon) {
        const nextUsage = (currentCoupon.usage_count || 0) + 1
        await admin
          .from('coupons')
          .update({
            usage_count: nextUsage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentCoupon.id)
      }
    } catch (couponErr) {
      console.error('[OrderService] Non-fatal error incrementing coupon usage:', couponErr)
    }
  }

  // 7. Record Idempotency Lock
  const lockMetadata = {
    orderId: insertedOrder.id,
    orderNumber: insertedOrder.order_number,
    idempotencyKey: input.idempotencyKey,
    quantity: input.quantity,
    productSubtotal: basePricing.productSubtotal,
    couponCode: validatedCouponCode,
    couponDiscount,
    deliveryCharge: basePricing.deliveryCharge,
    finalTotal,
    district: input.district,
    deliveryArea: input.deliveryArea,
    paymentMethod,
    maskedPhone: maskPhoneForLogs(normalizedPhone),
    transactionId: normalizedTrxId || undefined,
  }

  await admin.from('admin_audit_log').insert({
    action: 'order_idempotency_lock',
    entity_type: 'order',
    entity_id: input.idempotencyKey,
    metadata: lockMetadata,
  })

  // Safe masked server logging (no plain customer phone)
  console.log(
    `[OrderService] Order created: ${insertedOrder.order_number} | Method: ${paymentMethod} | Phone: ${maskPhoneForLogs(
      normalizedPhone
    )} | Total: ৳${finalTotal}`
  )

  return {
    orderNumber: insertedOrder.order_number,
    quantity: insertedOrder.quantity,
    productSubtotal: insertedOrder.product_subtotal,
    coupon: {
      code: insertedOrder.coupon_code,
      discountAmount: insertedOrder.coupon_discount,
    },
    deliveryCharge: insertedOrder.delivery_charge,
    finalTotal: insertedOrder.final_total,
    paymentMethod: insertedOrder.payment_method,
    paymentStatus: insertedOrder.payment_status,
    orderStatus: 'pending',
    bkashTransactionId: insertedOrder.bkash_transaction_id,
    createdAt: insertedOrder.created_at,
    isDuplicate: false,
  }
}
