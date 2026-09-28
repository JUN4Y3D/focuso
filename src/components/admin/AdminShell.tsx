import { useEffect, useState, useCallback, useRef } from 'react'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'
import { BANGLADESH_DISTRICTS } from '../../lib/districts'
import { PaymentMethodBadge, PaymentStatusBadge, OrderStatusBadge } from './AdminBadges'
import { OrderDetailDrawer } from './OrderDetailDrawer'

export interface OrderItem {
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

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface AdminShellProps {
  onLogoutSuccess: () => void
}

export function AdminShell({ onLogoutSuccess }: AdminShellProps) {
  const { admin, logout } = useAdminAuth()

  // Data state
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter & Search states
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [district, setDistrict] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Selected Order for Detail Drawer
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  // Debounce search input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value)
    setCurrentPage(1)
  }

  // Fetch orders from protected Express API
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const client = getSupabaseBrowserClient()
      const session = (await client?.auth.getSession())?.data.session
      const token = session?.access_token

      if (!token) {
        await logout()
        onLogoutSuccess()
        return
      }

      const params = new URLSearchParams()
      params.set('page', String(currentPage))
      params.set('limit', '20')
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (paymentMethod) params.set('paymentMethod', paymentMethod)
      if (paymentStatus) params.set('paymentStatus', paymentStatus)
      if (orderStatus) params.set('orderStatus', orderStatus)
      if (district) params.set('district', district)

      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.status === 401 || res.status === 403) {
        // Session expired or revoked
        await logout()
        onLogoutSuccess()
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to retrieve orders.')
      }

      const data = await res.json()
      setOrders(data.orders || [])
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 })
    } catch (err: any) {
      console.warn('[AdminDashboard] Error loading orders:', err?.message || err)
      setError(err.message || 'Unable to load orders. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [currentPage, debouncedSearch, paymentMethod, paymentStatus, orderStatus, district, logout, onLogoutSuccess])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleLogout = async () => {
    await logout()
    onLogoutSuccess()
  }

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  // Count summaries derived from current view
  const pendingBkashCount = orders.filter(
    (o) => o.paymentMethod === 'bkash_manual' && o.paymentStatus === 'pending_verification'
  ).length

  return (
    <div className="min-h-screen bg-sand flex flex-col font-sans">
      {/* Admin Header */}
      <header className="bg-white border-b border-stone-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <span className="font-serif tracking-widest text-xl font-bold text-deep">
                FOCUSO
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-300">
                Operations
              </span>
            </div>

            {/* Minimal Nav */}
            <nav className="hidden sm:flex items-center gap-1">
              <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 text-deep">
                Orders
              </span>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs text-ink/70 hidden sm:inline-block font-mono">
              {admin?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-stone-600 hover:text-deep px-3 py-1.5 rounded-lg border border-stone-300 hover:border-stone-400 bg-white transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Title & Top Stats Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-deep">
              Order Management
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Read-only operations view &bull; Total orders: {pagination.total}
            </p>
          </div>

          {/* Quick Notice Badge if pending bKash verification orders present */}
          {pendingBkashCount > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                <strong>{pendingBkashCount}</strong> bKash order(s) awaiting verification on this page
              </span>
            </div>
          )}
        </div>

        {/* Filters and Search Bar Card */}
        <div className="bg-white rounded-xl border border-stone-200/80 p-4 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-2">
              <label htmlFor="order-search" className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                Search
              </label>
              <div className="relative">
                <input
                  id="order-search"
                  type="text"
                  placeholder="Order number, customer name, or phone..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-stone-300 text-ink placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-deep focus:border-deep transition"
                />
                <svg
                  className="w-4 h-4 text-stone-400 absolute left-2.5 top-2.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Payment Method Filter */}
            <div>
              <label htmlFor="filter-method" className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                Payment Method
              </label>
              <select
                id="filter-method"
                value={paymentMethod}
                onChange={handleFilterChange(setPaymentMethod)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 bg-white text-ink focus:outline-none focus:ring-1 focus:ring-deep focus:border-deep transition"
              >
                <option value="">All Methods</option>
                <option value="cod">Cash on Delivery (COD)</option>
                <option value="bkash_manual">bKash Send Money</option>
              </select>
            </div>

            {/* Payment Status Filter */}
            <div>
              <label htmlFor="filter-payment-status" className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                Payment Status
              </label>
              <select
                id="filter-payment-status"
                value={paymentStatus}
                onChange={handleFilterChange(setPaymentStatus)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 bg-white text-ink focus:outline-none focus:ring-1 focus:ring-deep focus:border-deep transition"
              >
                <option value="">All Payment Statuses</option>
                <option value="pending_verification">Pending verification</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            {/* Fulfillment Status Filter */}
            <div>
              <label htmlFor="filter-order-status" className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                Fulfillment
              </label>
              <select
                id="filter-order-status"
                value={orderStatus}
                onChange={handleFilterChange(setOrderStatus)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 bg-white text-ink focus:outline-none focus:ring-1 focus:ring-deep focus:border-deep transition"
              >
                <option value="">All Fulfillment</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="returned">Returned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* District Filter */}
            <div>
              <label htmlFor="filter-district" className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                District
              </label>
              <select
                id="filter-district"
                value={district}
                onChange={handleFilterChange(setDistrict)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 bg-white text-ink focus:outline-none focus:ring-1 focus:ring-deep focus:border-deep transition"
              >
                <option value="">All Districts</option>
                {BANGLADESH_DISTRICTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.labelEn}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
            <div>
              <p className="font-semibold">Error retrieving dashboard orders</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
            <button
              onClick={fetchOrders}
              className="px-3 py-1 bg-white border border-rose-300 rounded text-xs font-semibold hover:bg-rose-100 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Orders Table Container */}
        <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-left text-xs">
              <thead className="bg-stone-50 text-stone-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">Order</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Customer</th>
                  <th scope="col" className="px-4 py-3">District</th>
                  <th scope="col" className="px-4 py-3 text-center">Qty</th>
                  <th scope="col" className="px-4 py-3 text-right">Total</th>
                  <th scope="col" className="px-4 py-3">Payment</th>
                  <th scope="col" className="px-4 py-3">Payment Status</th>
                  <th scope="col" className="px-4 py-3">Order Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100 bg-white">
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-stone-400">
                      <div className="inline-block w-6 h-6 border-2 border-stone-300 border-t-deep rounded-full animate-spin mb-2" />
                      <p className="text-xs uppercase tracking-wider">Loading orders...</p>
                    </td>
                  </tr>
                )}

                {!loading && orders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-stone-500">
                      <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-deep">No orders yet</p>
                      <p className="text-xs text-stone-400 mt-1">
                        {debouncedSearch || paymentMethod || paymentStatus || district
                          ? 'No orders match the selected filters.'
                          : 'Orders placed by customers will appear here.'}
                      </p>
                    </td>
                  </tr>
                )}

                {!loading &&
                  orders.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => setSelectedOrderId(o.id)}
                      className="hover:bg-stone-50/80 cursor-pointer transition"
                    >
                      {/* Order Number */}
                      <td className="px-4 py-3.5 font-mono font-bold text-deep whitespace-nowrap">
                        {o.orderNumber}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-stone-500 whitespace-nowrap">
                        {formatDate(o.createdAt)}
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-ink">{o.customerName}</div>
                        <div className="font-mono text-[11px] text-stone-400">{o.phone}</div>
                      </td>

                      {/* District & Area */}
                      <td className="px-4 py-3.5">
                        <div className="text-ink font-medium">{o.district}</div>
                        <div className="text-[11px] text-stone-400">{o.deliveryArea}</div>
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3.5 text-center font-medium text-ink">
                        {o.quantity}
                      </td>

                      {/* Final Total */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-deep whitespace-nowrap">
                        ৳{o.finalTotal}
                      </td>

                      {/* Payment Method */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <PaymentMethodBadge method={o.paymentMethod} />
                      </td>

                      {/* Payment Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <PaymentStatusBadge status={o.paymentStatus} />
                      </td>

                      {/* Order Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <OrderStatusBadge status={o.orderStatus} />
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedOrderId(o.id)
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-deep bg-stone-100 hover:bg-stone-200 rounded transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs">
              <span className="text-stone-500">
                Page <strong className="text-deep">{pagination.page}</strong> of{' '}
                <strong className="text-deep">{pagination.totalPages}</strong> ({pagination.total} total)
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || loading}
                  className="px-3 py-1 rounded bg-white border border-stone-300 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage >= pagination.totalPages || loading}
                  className="px-3 py-1 rounded bg-white border border-stone-300 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Selected Order Detail Drawer */}
      {selectedOrderId && (
        <OrderDetailDrawer
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUnauthorized={() => {
            setSelectedOrderId(null)
            handleLogout()
          }}
          onOrderUpdated={(updated) => {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === updated.id
                  ? {
                      ...o,
                      orderStatus: updated.orderStatus,
                      paymentStatus: updated.paymentStatus,
                    }
                  : o
              )
            )
          }}
        />
      )}
    </div>
  )
}
