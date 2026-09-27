import { Button, IconCheck, Wordmark, LangToggle } from './primitives'
import { useLang } from '../i18n'
import { OrderConfirmationData } from '../types/order'

export function Confirmation({
  order,
  onHome,
}: {
  order: OrderConfirmationData | null
  onHome: () => void
}) {
  const { t, lang } = useLang()
  const c = t.confirmation

  // Fallback order reference if loaded without state
  const displayOrderNumber = order?.orderNumber || 'FCS-CONFIRMED'
  const isBkash = order?.paymentMethod === 'bkash_manual'

  // Format currency localized to Bengali digits when in 'bn' mode
  const formatTaka = (num: number) => {
    if (lang === 'bn') {
      const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
      return '৳' + String(num).replace(/\d/g, (d) => bnDigits[Number(d)])
    }
    return `৳${num}`
  }

  const formatQuantity = (num: number) => {
    if (lang === 'bn') {
      const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
      return String(num).replace(/\d/g, (d) => bnDigits[Number(d)]) + 'টি'
    }
    return `${num} ${num === 1 ? 'copy' : 'copies'}`
  }

  return (
    <div className="storefront-confirmation min-h-screen flex flex-col bg-white-soft">
      <header className="border-b border-ink-15">
        <div className="focuso-container h-[64px] flex items-center justify-between">
          <button onClick={onHome} className="hover:opacity-70 transition-opacity">
            <Wordmark className="text-[20px]" />
          </button>
          <LangToggle />
        </div>
      </header>

      <main className="flex-1 grid place-items-center px-6 py-14 md:py-20">
        <div className="max-w-[38rem] w-full text-center animate-fade">
          <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-soft-green text-green shadow-xs">
            <IconCheck className="w-7 h-7" />
          </span>
          <h1 className="font-serif mt-6 text-[clamp(30px,4.5vw,42px)] leading-[1.15] text-ink">
            {c.title}
          </h1>

          {isBkash ? (
            <div className="mt-4 rounded-[12px] bg-amber-50 border border-amber-200 p-4 text-left">
              <p className="text-[15px] font-medium text-amber-900">
                {lang === 'bn'
                  ? 'আপনার bKash পেমেন্ট জমা হয়েছে এবং যাচাইকরণের অপেক্ষায় রয়েছে।'
                  : 'Your bKash payment has been submitted and is awaiting verification.'}
              </p>
              <p className="mt-1 text-[13px] text-amber-750 text-ink-60">
                {lang === 'bn'
                  ? 'আমাদের টিম ট্রানজেকশন যাচাই করে দ্রুত আপনার অর্ডার প্রক্রিয়া করবে।'
                  : 'Our team will verify the transaction ID and dispatch your planner.'}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-[16px] leading-[1.6] text-ink-60">
              {c.body}
            </p>
          )}

          {/* Authoritative Order Details Card */}
          <div className="mt-8 rounded-[9px] border border-ink-15 bg-white text-left divide-y divide-ink-15 shadow-xs overflow-hidden">
            {/* Header: Order Number & Status */}
            <div className="p-5 bg-sand-light/40 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-45 block">
                  {c.orderRef}
                </span>
                <span className="text-[18px] font-mono font-bold text-deep mt-0.5 block">
                  {displayOrderNumber}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-45 block">
                  {lang === 'bn' ? 'অর্ডার স্ট্যাটাস' : 'Order status'}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-soft-green text-green mt-0.5">
                  {lang === 'bn' ? 'অর্ডার গৃহীত হয়েছে' : 'Order received'}
                </span>
              </div>
            </div>

            {/* Authoritative Item Breakdown */}
            <div className="p-5 space-y-3">
              <div className="flex justify-between items-baseline text-[15px]">
                <span className="text-ink-60">
                  {lang === 'bn' ? 'FOCUSO ডেইলি প্ল্যানার' : 'FOCUSO Daily Planner'}
                </span>
                <span className="font-medium text-ink">
                  {order ? formatQuantity(order.quantity) : '1'}
                </span>
              </div>

              {order && (
                <div className="flex justify-between items-baseline text-[15px]">
                  <span className="text-ink-60">
                    {lang === 'bn' ? 'প্রোডাক্ট সাবটোটাল' : 'Product subtotal'}
                  </span>
                  <span className="font-medium text-ink">
                    {formatTaka(order.productSubtotal)}
                  </span>
                </div>
              )}

              {order && order.coupon.code && order.coupon.discountAmount > 0 && (
                <div className="flex justify-between items-baseline text-[15px] text-green">
                  <span className="flex items-center gap-1 font-medium">
                    <span>{lang === 'bn' ? 'কুপন ছাড়' : 'Coupon discount'}</span>
                    <span className="text-[12px] font-mono opacity-85">({order.coupon.code})</span>
                  </span>
                  <span className="font-medium">
                    -{formatTaka(order.coupon.discountAmount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-baseline text-[15px]">
                <span className="text-ink-60">{c.delivery}</span>
                <span className="font-medium text-ink">
                  {order ? formatTaka(order.deliveryCharge) : c.deliveryVal}
                </span>
              </div>

              {order && (
                <div className="flex justify-between items-baseline border-t border-ink-15 pt-3 text-[17px]">
                  <span className="font-semibold text-ink">
                    {lang === 'bn' ? 'সর্বমোট' : 'Final total'}
                  </span>
                  <span className="font-serif font-bold text-[20px] text-deep">
                    {formatTaka(order.finalTotal)}
                  </span>
                </div>
              )}
            </div>

            {/* Payment & Logistics Terms */}
            <div className="p-5 bg-sand-light/20 space-y-3 text-[14px]">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <span className="text-ink-45 block text-[12px] uppercase tracking-wider font-semibold">
                    {c.payment}
                  </span>
                  <span className="font-medium text-ink mt-0.5 block">
                    {isBkash ? 'bKash (Send Money)' : c.paymentVal}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-ink-45 block text-[12px] uppercase tracking-wider font-semibold">
                    {lang === 'bn' ? 'পেমেন্ট স্ট্যাটাস' : 'Payment status'}
                  </span>
                  {isBkash ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-semibold bg-amber-100 text-amber-900 mt-0.5">
                      {lang === 'bn' ? 'যাচাইকরণের অপেক্ষায়' : 'Pending verification'}
                    </span>
                  ) : (
                    <span className="font-medium text-ink mt-0.5 block">
                      {lang === 'bn' ? 'ডেলিভারিতে পরিশোধ' : 'Pay on delivery'}
                    </span>
                  )}
                </div>
              </div>

              {isBkash && order?.bkashTransactionId && (
                <div className="border-t border-ink-15/60 pt-2 flex justify-between items-center text-[13px]">
                  <span className="text-ink-60">
                    {lang === 'bn' ? 'bKash ট্রানজেকশন আইডি (TrxID)' : 'Transaction ID'}
                  </span>
                  <span className="font-mono font-semibold text-deep bg-white px-2 py-0.5 rounded border border-ink-15">
                    {order.bkashTransactionId}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <Button onClick={onHome} variant="secondary">
              {c.back}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
