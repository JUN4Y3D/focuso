import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'
import { PaymentMethodBadge, PaymentStatusBadge, OrderStatusBadge } from './AdminBadges'

export interface AdminOrderDetail {
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

export interface OrderAuditRecord {
  id: string
  action: string
  createdAt: string
  adminUserId: string | null
  adminEmail: string | null
  metadata: {
    from?: string
    to?: string
    reason?: string
    expectedAmount?: number
    transactionId?: string
    [key: string]: any
  }
}

interface OrderDetailDrawerProps {
  orderId: string
  onClose: () => void
  onUnauthorized: () => void
  onOrderUpdated?: (updatedOrder: { id: string; orderStatus: string; paymentStatus: string }) => void
}

type DialogActionType =
  | { type: 'confirm_order' }
  | { type: 'start_processing' }
  | { type: 'mark_shipped' }
  | { type: 'mark_delivered' }
  | { type: 'cancel_order' }
  | { type: 'verify_bkash' }
  | { type: 'fail_bkash' }
  | { type: 'mark_cod_paid' }

export function OrderDetailDrawer({
  orderId,
  onClose,
  onUnauthorized,
  onOrderUpdated,
}: OrderDetailDrawerProps) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null)
  const [auditLogs, setAuditLogs] = useState<OrderAuditRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)

  // Dialog State
  const [activeDialog, setActiveDialog] = useState<DialogActionType | null>(null)
  const [failReason, setFailReason] = useState('')

  async function getValidToken(): Promise<string | null> {
    const client = getSupabaseBrowserClient()
    const session = (await client?.auth.getSession())?.data.session
    return session?.access_token || null
  }

  // Fetch Order Details
  async function fetchDetail() {
    setLoading(true)
    setError(null)

    try {
      const token = await getValidToken()
      if (!token) {
        onUnauthorized()
        return
      }

      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 401 || res.status === 403) {
        onUnauthorized()
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load order details.')
      }

      const data = await res.json()
      setOrder(data.order)
    } catch (err: any) {
      setError(err.message || 'Unable to retrieve order details.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch Audit History
  async function fetchAudit() {
    setAuditLoading(true)
    try {
      const token = await getValidToken()
      if (!token) return

      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/audit`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 401 || res.status === 403) {
        onUnauthorized()
        return
      }

      if (res.ok) {
        const data = await res.json()
        setAuditLogs(data.audit || [])
      }
    } catch {
      // Ignore background audit refresh errors
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
    fetchAudit()
  }, [orderId])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !actionPending) {
        if (activeDialog) {
          setActiveDialog(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, activeDialog, actionPending])

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return isoString
    }
  }

  // Execute Order Status Change
  async function handleStatusChange(targetStatus: string) {
    if (!order || actionPending) return
    setActionPending(true)
    setActionError(null)

    try {
      const token = await getValidToken()
      if (!token) {
        onUnauthorized()
        return
      }

      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderStatus: targetStatus }),
      })

      if (res.status === 401 || res.status === 403) {
        onUnauthorized()
        return
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update order status.')
      }

      // Backend confirmed update
      const newStatus = data.orderStatus || targetStatus
      setOrder((prev) => (prev ? { ...prev, orderStatus: newStatus } : null))
      if (onOrderUpdated) {
        onOrderUpdated({
          id: order.id,
          orderStatus: newStatus,
          paymentStatus: order.paymentStatus,
        })
      }
      setActiveDialog(null)
      await fetchAudit()
    } catch (err: any) {
      setActionError(err.message || 'Error updating order status.')
    } finally {
      setActionPending(false)
    }
  }

  // Execute bKash Verification
  async function handleVerifyBkash() {
    if (!order || actionPending) return
    setActionPending(true)
    setActionError(null)

    try {
      const token = await getValidToken()
      if (!token) {
        onUnauthorized()
        return
      }

      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/verify-bkash`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (res.status === 401 || res.status === 403) {
        onUnauthorized()
        return
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify bKash payment.')
      }

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              paymentStatus: 'paid',
              paymentVerifiedAt: data.paymentVerifiedAt || new Date().toISOString(),
              paymentVerifiedBy: data.paymentVerifiedBy || prev.paymentVerifiedBy,
            }
          : null
      )
      if (onOrderUpdated) {
        onOrderUpdated({
          id: order.id,
          orderStatus: order.orderStatus,
          paymentStatus: 'paid',
        })
      }
      setActiveDialog(null)
      await fetchAudit()
    } catch (err: any) {
      setActionError(err.message || 'Error verifying payment.')
    } finally {
      setActionPending(false)
    }
  }

  // Execute bKash Failure
  async function handleFailBkash() {
    if (!order || actionPending) return
    const trimmed = failReason.trim()
    if (!trimmed || trimmed.length < 3) {
      setActionError('Reason must be at least 3 characters long.')
      return
    }

    setActionPending(true)
    setActionError(null)

    try {
      const token = await getValidToken()
      if (!token) {
        onUnauthorized()
        return
      }

      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/fail-bkash`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: trimmed }),
      })

      if (res.status === 401 || res.status === 403) {
        onUnauthorized()
        return
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to mark payment as failed.')
      }

      setOrder((prev) => (prev ? { ...prev, paymentStatus: 'failed' } : null))
      if (onOrderUpdated) {
        onOrderUpdated({
          id: order.id,
          orderStatus: order.orderStatus,
          paymentStatus: 'failed',
        })
      }
      setActiveDialog(null)
      setFailReason('')
      await fetchAudit()
    } catch (err: any) {
      setActionError(err.message || 'Error updating payment status.')
    } finally {
      setActionPending(false)
    }
  }

  // Execute COD Payment Collection
  async function handleMarkCodPaid() {
    if (!order || actionPending) return
    setActionPending(true)
    setActionError(null)

    try {
      const token = await getValidToken()
      if (!token) {
        onUnauthorized()
        return
      }

      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/mark-cod-paid`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (res.status === 401 || res.status === 403) {
        onUnauthorized()
        return
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record COD payment.')
      }

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              paymentStatus: 'paid',
              paymentVerifiedAt: data.paymentVerifiedAt || new Date().toISOString(),
              paymentVerifiedBy: data.paymentVerifiedBy || prev.paymentVerifiedBy,
            }
          : null
      )
      if (onOrderUpdated) {
        onOrderUpdated({
          id: order.id,
          orderStatus: order.orderStatus,
          paymentStatus: 'paid',
        })
      }
      setActiveDialog(null)
      await fetchAudit()
    } catch (err: any) {
      setActionError(err.message || 'Error recording COD payment.')
    } finally {
      setActionPending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-stone-900/40 backdrop-blur-xs flex justify-end animate-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-stone-200 relative">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/60">
          <div>
            <div className="flex items-center gap-3">
              <h2 id="drawer-title" className="text-lg font-mono font-bold text-deep">
                {order ? order.orderNumber : 'Loading Order...'}
              </h2>
              {order && <OrderStatusBadge status={order.orderStatus} />}
            </div>
            {order && (
              <p className="text-xs text-stone-500 mt-1">
                Placed on {formatDate(order.createdAt)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition"
            aria-label="Close details"
            disabled={actionPending}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Global Action Error Alert */}
        {actionError && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-xs text-rose-800">
            <span>{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-600 hover:text-rose-900 font-bold ml-2"
            >
              &times;
            </button>
          </div>
        )}

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-20 text-center">
              <div className="inline-block w-8 h-8 border-3 border-stone-300 border-t-deep rounded-full animate-spin mb-3" />
              <p className="text-xs uppercase tracking-wider text-stone-500 font-medium">
                Loading order details...
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              <p className="font-semibold mb-1">Failed to load order</p>
              <p className="text-xs">{error}</p>
            </div>
          )}

          {order && !loading && (
            <>
              {/* SECTION: Fulfillment & Contextual Order Status Controls */}
              <div className="bg-stone-50/80 border border-stone-200 rounded-xl p-4.5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Fulfillment Status & Actions
                  </h3>
                  <OrderStatusBadge status={order.orderStatus} />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {order.orderStatus === 'pending' && (
                    <>
                      <button
                        onClick={() => handleStatusChange('confirmed')}
                        disabled={actionPending}
                        className="px-3 py-1.5 bg-deep text-white text-xs font-medium rounded-lg hover:bg-deep/90 transition shadow-xs disabled:opacity-50"
                      >
                        Confirm order
                      </button>
                      <button
                        onClick={() => setActiveDialog({ type: 'cancel_order' })}
                        disabled={actionPending}
                        className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 text-xs font-medium rounded-lg hover:bg-rose-50 transition disabled:opacity-50"
                      >
                        Cancel order
                      </button>
                    </>
                  )}

                  {order.orderStatus === 'confirmed' && (
                    <>
                      <button
                        onClick={() => handleStatusChange('processing')}
                        disabled={actionPending}
                        className="px-3 py-1.5 bg-deep text-white text-xs font-medium rounded-lg hover:bg-deep/90 transition shadow-xs disabled:opacity-50"
                      >
                        Start processing
                      </button>
                      <button
                        onClick={() => setActiveDialog({ type: 'cancel_order' })}
                        disabled={actionPending}
                        className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 text-xs font-medium rounded-lg hover:bg-rose-50 transition disabled:opacity-50"
                      >
                        Cancel order
                      </button>
                    </>
                  )}

                  {order.orderStatus === 'processing' && (
                    <>
                      <button
                        onClick={() => handleStatusChange('shipped')}
                        disabled={actionPending}
                        className="px-3 py-1.5 bg-deep text-white text-xs font-medium rounded-lg hover:bg-deep/90 transition shadow-xs disabled:opacity-50"
                      >
                        Mark as shipped
                      </button>
                      <button
                        onClick={() => setActiveDialog({ type: 'cancel_order' })}
                        disabled={actionPending}
                        className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 text-xs font-medium rounded-lg hover:bg-rose-50 transition disabled:opacity-50"
                      >
                        Cancel order
                      </button>
                    </>
                  )}

                  {order.orderStatus === 'shipped' && (
                    <button
                      onClick={() => setActiveDialog({ type: 'mark_delivered' })}
                      disabled={actionPending}
                      className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-emerald-800 transition shadow-xs disabled:opacity-50"
                    >
                      Mark as delivered
                    </button>
                  )}

                  {order.orderStatus === 'delivered' && (
                    <span className="text-xs text-stone-500 font-medium">
                      Order successfully delivered. No further status changes allowed.
                    </span>
                  )}

                  {order.orderStatus === 'cancelled' && (
                    <span className="text-xs text-rose-700 font-medium">
                      Order is cancelled. Terminal state.
                    </span>
                  )}
                </div>
              </div>

              {/* SECTION: Customer */}
              <div className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-4.5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Customer Information
                </h3>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-stone-400 block">Customer Name</span>
                    <span className="font-medium text-ink">{order.customerName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-400 block">Phone</span>
                    <span className="font-mono text-ink font-medium">{order.phone}</span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-400 block">District</span>
                    <span className="font-medium text-ink">{order.district}</span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-400 block">Thana / Area</span>
                    <span className="font-medium text-ink">{order.deliveryArea}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs text-stone-400 block">Detailed Delivery Address</span>
                    <span className="text-ink leading-relaxed font-normal">
                      {order.deliveryAddress}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION: bKash Verification & Payment Details */}
              <div className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Payment Details
                  </h3>
                  <div className="flex items-center gap-2">
                    <PaymentMethodBadge method={order.paymentMethod} />
                    <PaymentStatusBadge status={order.paymentStatus} />
                  </div>
                </div>

                {order.paymentMethod === 'bkash_manual' ? (
                  <div className="space-y-3 pt-1">
                    {/* Explicit Verification Notice */}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs leading-relaxed">
                      <strong>Manual verification rule:</strong> Verify this transaction manually in your bKash account before marking it paid.
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-lg border border-stone-200">
                      <div>
                        <span className="text-stone-400 block">bKash Transaction ID</span>
                        <span className="font-mono text-sm font-bold text-pink-700 tracking-wider">
                          {order.bkashTransactionId || 'None provided'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Expected Amount</span>
                        <span className="font-mono text-sm font-bold text-deep">
                          ৳{order.finalTotal}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Order Placed</span>
                        <span className="text-stone-700">{formatDate(order.createdAt)}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Payment Status</span>
                        <span className="font-medium capitalize text-stone-700">
                          {order.paymentStatus.replace('_', ' ')}
                        </span>
                      </div>
                      {order.paymentVerifiedAt && (
                        <div className="sm:col-span-2 pt-1 border-t border-stone-100 text-stone-500">
                          Verified at: <strong>{formatDate(order.paymentVerifiedAt)}</strong>
                        </div>
                      )}
                    </div>

                    {/* bKash Mutation Controls */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {order.paymentStatus === 'pending_verification' && (
                        <>
                          <button
                            onClick={() => setActiveDialog({ type: 'verify_bkash' })}
                            disabled={actionPending}
                            className="px-3.5 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition shadow-xs disabled:opacity-50"
                          >
                            Mark Payment Verified
                          </button>
                          <button
                            onClick={() => {
                              setFailReason('')
                              setActiveDialog({ type: 'fail_bkash' })
                            }}
                            disabled={actionPending}
                            className="px-3.5 py-1.5 bg-white border border-rose-300 text-rose-700 text-xs font-medium rounded-lg hover:bg-rose-50 transition disabled:opacity-50"
                          >
                            Mark Payment Failed
                          </button>
                        </>
                      )}

                      {order.paymentStatus === 'failed' && (
                        <>
                          <div className="w-full text-xs text-rose-800 bg-rose-50 border border-rose-200 p-2.5 rounded-lg mb-1">
                            Payment currently marked as failed. If payment is later confirmed, you may correct it to paid.
                          </div>
                          <button
                            onClick={() => setActiveDialog({ type: 'verify_bkash' })}
                            disabled={actionPending}
                            className="px-3.5 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition shadow-xs disabled:opacity-50"
                          >
                            Mark Payment Verified (Correction)
                          </button>
                        </>
                      )}

                      {order.paymentStatus === 'paid' && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Payment verified &bull; {order.paymentVerifiedAt ? formatDate(order.paymentVerifiedAt) : 'Confirmed'}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div className="grid sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-lg border border-stone-200">
                      <div>
                        <span className="text-stone-400 block">Payment Method</span>
                        <span className="font-medium text-stone-800">Cash on Delivery (COD)</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Total Amount to Collect</span>
                        <span className="font-mono text-sm font-bold text-deep">
                          ৳{order.finalTotal}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Payment Status</span>
                        <span className="font-medium capitalize text-stone-700">
                          {order.paymentStatus}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Current Fulfillment Status</span>
                        <span className="font-medium capitalize text-stone-700">
                          {order.orderStatus}
                        </span>
                      </div>
                      {order.paymentVerifiedAt && (
                        <div className="sm:col-span-2 pt-1 border-t border-stone-100 text-stone-500">
                          Payment recorded at: <strong>{formatDate(order.paymentVerifiedAt)}</strong>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {order.paymentStatus === 'unpaid' ? (
                        <>
                          <button
                            onClick={() => setActiveDialog({ type: 'mark_cod_paid' })}
                            disabled={actionPending}
                            className="px-3.5 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition shadow-xs disabled:opacity-50"
                          >
                            Mark COD Payment Received
                          </button>
                          <span className="text-[11px] text-stone-500 italic">
                            Order is currently &lsquo;{order.orderStatus}&rsquo;. Record payment only after cash is received.
                          </span>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Payment received &bull; ৳{order.finalTotal} &bull; {order.paymentVerifiedAt ? formatDate(order.paymentVerifiedAt) : 'Recorded'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: Order Summary */}
              <div className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-4.5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Order Breakdown
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-stone-600">
                    <span>
                      FOCUSO Planner &times; {order.quantity} (৳{order.unitPrice} each)
                    </span>
                    <span className="font-medium text-ink">৳{order.productSubtotal}</span>
                  </div>

                  {order.couponCode && (
                    <div className="flex justify-between text-emerald-700">
                      <span className="flex items-center gap-1.5">
                        <span>Coupon</span>
                        <span className="font-mono text-xs px-1.5 py-0.2 rounded bg-emerald-100 font-bold">
                          {order.couponCode}
                        </span>
                      </span>
                      <span>-৳{order.couponDiscount}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-stone-600">
                    <span>Delivery Charge ({order.district})</span>
                    <span className="font-medium text-ink">৳{order.deliveryCharge}</span>
                  </div>

                  <div className="pt-2 border-t border-stone-200 flex justify-between font-bold text-base text-deep">
                    <span>Total Amount</span>
                    <span>৳{order.finalTotal}</span>
                  </div>
                </div>
              </div>

              {/* SECTION: Customer Note */}
              <div className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-4.5 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Customer Notes
                </h3>
                {order.customerNote ? (
                  <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
                    {order.customerNote}
                  </p>
                ) : (
                  <p className="text-xs text-stone-400 italic">No note</p>
                )}
              </div>

              {/* SECTION: Activity / Audit Trail */}
              <div className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Activity & Audit History
                  </h3>
                  {auditLoading && (
                    <span className="text-[10px] text-stone-400">Refreshing...</span>
                  )}
                </div>

                {auditLogs.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">No activity recorded yet.</p>
                ) : (
                  <div className="relative border-l border-stone-200 ml-2 space-y-4 py-1">
                    {auditLogs.map((log) => {
                      let actionTitle = log.action
                      let detailText = ''

                      if (log.action === 'order_status_changed') {
                        actionTitle = 'Order status changed'
                        detailText = `${log.metadata.from || ''} → ${log.metadata.to || ''}`
                      } else if (log.action === 'bkash_payment_verified') {
                        actionTitle = 'bKash payment verified'
                        detailText = `${log.metadata.from || 'pending'} → paid (৳${log.metadata.expectedAmount || order.finalTotal})`
                      } else if (log.action === 'bkash_payment_failed') {
                        actionTitle = 'Payment marked failed'
                        detailText = log.metadata.reason ? `Reason: ${log.metadata.reason}` : 'bKash payment verification failed'
                      } else if (log.action === 'cod_payment_collected') {
                        actionTitle = 'COD payment received'
                        detailText = `unpaid → paid (৳${log.metadata.amount || order.finalTotal})`
                      } else if (log.action === 'order_idempotency_lock') {
                        actionTitle = 'Order placed'
                        detailText = 'Initial order creation lock'
                      }

                      return (
                        <div key={log.id} className="relative pl-4 text-xs">
                          {/* Dot indicator */}
                          <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-deep border-2 border-white" />
                          <div className="flex items-center justify-between font-medium text-stone-800">
                            <span>{actionTitle}</span>
                            <span className="text-[11px] text-stone-400">
                              {formatDate(log.createdAt)}
                            </span>
                          </div>
                          {detailText && (
                            <p className="text-stone-600 mt-0.5 capitalize">{detailText}</p>
                          )}
                          {log.adminEmail && (
                            <p className="text-[11px] text-stone-400 mt-0.5">
                              By: {log.adminEmail}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            disabled={actionPending}
            className="px-4 py-2 text-xs font-semibold text-stone-700 hover:text-deep bg-white border border-stone-300 rounded-lg hover:border-stone-400 transition disabled:opacity-50"
          >
            Close
          </button>
        </div>

        {/* Confirmation Modal Dialogs */}
        {activeDialog && (
          <div
            className="absolute inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
              {activeDialog.type === 'cancel_order' && (
                <>
                  <h3 className="text-base font-bold text-rose-900">Cancel Order</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Are you sure you want to cancel order <strong>{order?.orderNumber}</strong>? This will set fulfillment status to <strong>cancelled</strong>. This action is terminal and cannot be reversed.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setActiveDialog(null)}
                      disabled={actionPending}
                      className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900 border border-stone-300 rounded-lg"
                    >
                      Never mind
                    </button>
                    <button
                      onClick={() => handleStatusChange('cancelled')}
                      disabled={actionPending}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs disabled:opacity-50"
                    >
                      {actionPending ? 'Cancelling...' : 'Yes, Cancel Order'}
                    </button>
                  </div>
                </>
              )}

              {activeDialog.type === 'mark_delivered' && (
                <>
                  <h3 className="text-base font-bold text-deep">Mark as Delivered</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Has order <strong>{order?.orderNumber}</strong> been confirmed received by the customer? This marks fulfillment as delivered.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setActiveDialog(null)}
                      disabled={actionPending}
                      className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900 border border-stone-300 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleStatusChange('delivered')}
                      disabled={actionPending}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs disabled:opacity-50"
                    >
                      {actionPending ? 'Updating...' : 'Confirm Delivered'}
                    </button>
                  </div>
                </>
              )}

              {activeDialog.type === 'verify_bkash' && (
                <>
                  <h3 className="text-base font-bold text-emerald-900">Mark bKash Payment Verified</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Please confirm that you have manually verified the incoming transaction in your official bKash merchant/personal statement:
                  </p>
                  <div className="p-3 bg-pink-50 border border-pink-150 rounded-lg text-xs space-y-1">
                    <div>TrxID: <strong className="font-mono text-pink-900">{order?.bkashTransactionId || 'None'}</strong></div>
                    <div>Expected Amount: <strong className="text-pink-900">৳{order?.finalTotal}</strong></div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setActiveDialog(null)}
                      disabled={actionPending}
                      className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900 border border-stone-300 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleVerifyBkash}
                      disabled={actionPending}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs disabled:opacity-50"
                    >
                      {actionPending ? 'Verifying...' : 'Yes, Payment Verified'}
                    </button>
                  </div>
                </>
              )}

              {activeDialog.type === 'fail_bkash' && (
                <>
                  <h3 className="text-base font-bold text-rose-900">Mark bKash Payment Failed</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Specify the reason why this payment cannot be verified (e.g. Transaction ID not found, insufficient amount sent). A reason between 3 and 300 characters is required:
                  </p>
                  <textarea
                    rows={3}
                    value={failReason}
                    onChange={(e) => setFailReason(e.target.value)}
                    placeholder="e.g. Transaction ID not found in bKash account statement."
                    className="w-full text-xs p-2.5 border border-stone-300 rounded-lg focus:ring-1 focus:ring-rose-500 focus:outline-none"
                    maxLength={300}
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-stone-400">
                      {failReason.trim().length} / 300 characters
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActiveDialog(null)}
                        disabled={actionPending}
                        className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900 border border-stone-300 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleFailBkash}
                        disabled={actionPending || failReason.trim().length < 3}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs disabled:opacity-50"
                      >
                        {actionPending ? 'Submitting...' : 'Mark Failed'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {activeDialog.type === 'mark_cod_paid' && (
                <>
                  <h3 className="text-base font-bold text-deep">Mark COD payment as received?</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Confirm recording cash collection for order <strong>{order?.orderNumber}</strong>.
                  </p>
                  <div className="p-3 bg-stone-100 rounded-lg text-xs space-y-1.5 border border-stone-200">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Order Number:</span>
                      <strong className="font-mono text-stone-800">{order?.orderNumber}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Amount:</span>
                      <strong className="text-deep font-bold font-mono">৳{order?.finalTotal}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Current Fulfillment Status:</span>
                      <strong className="capitalize text-stone-800">{order?.orderStatus}</strong>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                    <strong>Notice:</strong> Use this only after confirming that the COD payment has actually been received.
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setActiveDialog(null)}
                      disabled={actionPending}
                      className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900 border border-stone-300 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMarkCodPaid}
                      disabled={actionPending}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs disabled:opacity-50"
                    >
                      {actionPending ? 'Recording...' : 'Confirm COD Payment Received'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
