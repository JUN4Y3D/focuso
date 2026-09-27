export interface OrderConfirmationData {
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
