import { useState, useEffect, useRef } from 'react'
import { Button, IconArrow, IconCheck, IconMinus, IconPlus, Wordmark, LangToggle } from './primitives'
import { DailyPage } from './PlannerPages'
import { useLang } from '../i18n'
import { BANGLADESH_DISTRICTS } from '../lib/districts'
import { OrderConfirmationData } from '../types/order'

function Field({
  label, id, type = 'text', placeholder, value, onChange, onBlur, required, textarea, error,
}: {
  label: string; id: string; type?: string; placeholder?: string
  value: string; onChange: (v: string) => void; onBlur?: () => void; required?: boolean; textarea?: boolean; error?: string
}) {
  const cls =
    `mt-2 w-full rounded-[8px] border bg-white px-4 py-3 text-[15px] text-ink placeholder:text-ink-45 transition-colors focus:border-green focus:outline-none ${
      error ? 'border-red-400 focus:border-red-500' : 'border-ink-15 hover:border-ink-45'
    }`
  return (
    <label htmlFor={id} className="block">
      <span className="text-[14px] font-medium text-ink">
        {label}{required && <span className="text-green"> *</span>}
      </span>
      {textarea ? (
        <textarea
          id={id}
          rows={3}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cls + ' resize-none'}
        />
      ) : (
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cls}
        />
      )}
      {error && <span id={`${id}-error`} role="alert" className="mt-1.5 block text-[12px] font-medium text-red-600">{error}</span>}
    </label>
  )
}

export type DeliveryZone = 'inside_chattogram' | 'outside_chattogram'
export type PaymentMethod = 'cod' | 'bkash_manual'
type CheckoutField = 'name' | 'phone' | 'district' | 'city' | 'address' | 'bkashTrxId'

interface PricingPreviewData {
  quantity: number
  unitPrice: number
  productSubtotal: number
  deliveryZone: DeliveryZone
  district?: string
  deliveryCharge: number
  preDiscountTotal: number
}

interface CouponInfo {
  valid: boolean
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  discountAmount: number
}

interface CouponPreviewData extends PricingPreviewData {
  coupon: CouponInfo
  finalTotal: number
}

/**
 * Generates a standard UUID v4 using browser crypto API, with safe fallback.
 */
function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Safe RFC4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function Checkout({
  qty, setQty, onBack, onPlaced,
}: {
  qty: number
  setQty: (n: number) => void
  onBack: () => void
  onPlaced: (order: OrderConfirmationData) => void
}) {
  const { t, lang } = useLang()
  const c = t.checkout

  // Form field state (Customer & Delivery)
  // f.city maps to Thana / Area; f.address maps to Detailed Address
  const [f, setF] = useState({ name: '', phone: '', district: '', city: '', address: '', notes: '' })
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))
  const [touched, setTouched] = useState<Partial<Record<CheckoutField, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const markTouched = (field: CheckoutField) => () => setTouched((current) => ({ ...current, [field]: true }))

  // Payment method selection: 'cod' (default) or 'bkash_manual'
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod')
  const [bkashTrxId, setBkashTrxId] = useState('')
  const [copiedNumber, setCopiedNumber] = useState(false)
  const [amountChangedWarning, setAmountChangedWarning] = useState(false)

  // Public payment configuration loaded from server
  const [bkashNumber, setBkashNumber] = useState<string | null>(null)
  const [bkashConfigState, setBkashConfigState] = useState<'loading' | 'ready' | 'error'>('loading')

  // Coupon state
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<CouponInfo | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState('')

  // Order submission & Error states
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Idempotency state management
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey())
  const lastSubmittedPayloadRef = useRef<string | null>(null)

  // Authoritative server-side preview pricing state
  const [pricing, setPricing] = useState<PricingPreviewData | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [pricingError, setPricingError] = useState<string | null>(null)
  const fetchCountRef = useRef(0)

  // Fetch safe payment config on mount
  useEffect(() => {
    fetch('/api/payment-config')
      .then((res) => {
        if (!res.ok) throw new Error(`Payment configuration request failed (${res.status})`)
        return res.json()
      })
      .then((cfg) => {
        if (!cfg || typeof cfg.bkashNumber !== 'string' || !/^01\d{9}$/.test(cfg.bkashNumber)) {
          throw new Error('Payment configuration response was invalid')
        }
        setBkashNumber(cfg.bkashNumber)
        setBkashConfigState('ready')
      })
      .catch((err) => {
        setBkashNumber(null)
        setBkashConfigState('error')
        console.warn('Could not load payment configuration from server:', err)
      })
  }, [])

  // Clear entered TrxID and show clear warning if user changes pricing-affecting fields after entering a TrxID
  const previousPriceFingerprintRef = useRef<string>('')
  useEffect(() => {
    const currentPriceFingerprint = `${qty}-${f.district}-${appliedCoupon?.code || ''}`
    if (previousPriceFingerprintRef.current && previousPriceFingerprintRef.current !== currentPriceFingerprint) {
      if (bkashTrxId.trim() !== '') {
        setBkashTrxId('')
        setAmountChangedWarning(true)
      }
    }
    previousPriceFingerprintRef.current = currentPriceFingerprint
  }, [qty, f.district, appliedCoupon])

  // Request authoritative preview pricing from server (with or without coupon)
  const fetchAuthoritativePricing = async (
    targetQty: number,
    targetDistrict: string,
    activeCouponCode?: string | null
  ) => {
    if (!targetDistrict) {
      setPricing(null)
      setPricingError(null)
      return
    }

    const currentFetchId = ++fetchCountRef.current
    setPricingLoading(true)
    setPricingError(null)

    if (activeCouponCode) {
      // Use coupon preview endpoint
      try {
        const res = await fetch('/api/coupon-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: targetQty,
            district: targetDistrict,
            couponCode: activeCouponCode,
          }),
        })

        const data = await res.json()

        if (currentFetchId !== fetchCountRef.current) return

        if (!res.ok) {
          // If coupon became invalid (e.g. min order), remove applied coupon and use base pricing if returned
          setAppliedCoupon(null)
          setCouponError(data.error || (lang === 'bn' ? 'কুপন কোডটি সঠিক নয়' : 'Invalid coupon code'))
          if (data.basePricing) {
            setPricing(data.basePricing)
          }
          setPricingLoading(false)
          return
        }

        const couponData = data as CouponPreviewData
        setPricing({
          quantity: couponData.quantity,
          unitPrice: couponData.unitPrice,
          productSubtotal: couponData.productSubtotal,
          deliveryZone: couponData.deliveryZone,
          district: couponData.district,
          deliveryCharge: couponData.deliveryCharge,
          preDiscountTotal: couponData.preDiscountTotal,
        })
        setAppliedCoupon(couponData.coupon)
        setCouponInput(couponData.coupon.code)
        setCouponError('')
        setPricingLoading(false)
      } catch (err) {
        if (currentFetchId === fetchCountRef.current) {
          console.error('Coupon preview error:', err)
          setPricingLoading(false)
          setPricingError(
            lang === 'bn'
              ? 'মূল্য নির্ধারণে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
              : 'Unable to calculate pricing. Please try again.'
          )
        }
      }
    } else {
      // Use base pricing endpoint
      try {
        const res = await fetch('/api/pricing-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: targetQty,
            district: targetDistrict,
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Failed to calculate pricing')
        }

        const data: PricingPreviewData = await res.json()

        if (currentFetchId !== fetchCountRef.current) return

        setPricing(data)
        setPricingLoading(false)
      } catch (err) {
        if (currentFetchId === fetchCountRef.current) {
          console.error('Pricing preview error:', err)
          setPricingLoading(false)
          setPricingError(
            lang === 'bn'
              ? 'মূল্য নির্ধারণে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
              : 'Unable to calculate pricing. Please try again.'
          )
        }
      }
    }
  }

  // Refetch authoritative preview pricing whenever quantity, district, or applied coupon changes
  useEffect(() => {
    fetchAuthoritativePricing(qty, f.district, appliedCoupon?.code)
  }, [qty, f.district])

  // Apply a coupon code explicitly
  const applyCouponCode = async (rawCode: string) => {
    const trimmed = rawCode.trim()
    if (!trimmed) {
      setCouponError(lang === 'bn' ? 'অনুগ্রহ করে কুপন কোড লিখুন' : 'Please enter a coupon code')
      return
    }

    if (!f.district) {
      setCouponError(
        lang === 'bn'
          ? 'কুপন প্রয়োগের আগে অনুগ্রহ করে আপনার জেলা নির্বাচন করুন'
          : 'Please select your district first'
      )
      return
    }

    setCouponLoading(true)
    setCouponError('')

    try {
      const res = await fetch('/api/coupon-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: qty,
          district: f.district,
          couponCode: trimmed,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setCouponError(data.error || (lang === 'bn' ? 'কুপন কোডটি সঠিক নয়' : 'Invalid coupon code'))
        return
      }

      const couponData = data as CouponPreviewData
      setPricing({
        quantity: couponData.quantity,
        unitPrice: couponData.unitPrice,
        productSubtotal: couponData.productSubtotal,
        deliveryZone: couponData.deliveryZone,
        district: couponData.district,
        deliveryCharge: couponData.deliveryCharge,
        preDiscountTotal: couponData.preDiscountTotal,
      })
      setAppliedCoupon(couponData.coupon)
      setCouponInput(couponData.coupon.code)
      setCouponError('')
    } catch (err) {
      console.error('Apply coupon error:', err)
      setCouponError(
        lang === 'bn'
          ? 'কুপন যাচাই করতে সমস্যা হয়েছে।'
          : 'Failed to validate coupon code.'
      )
    } finally {
      setCouponLoading(false)
    }
  }

  // Remove applied coupon
  const handleRemoveCoupon = async () => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError('')
    // Restore base pricing immediately
    if (f.district) {
      await fetchAuthoritativePricing(qty, f.district, null)
    }
  }

  // Copy bKash Send Money number
  const handleCopyBkashNumber = () => {
    if (!bkashNumber) return
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(bkashNumber)
      setCopiedNumber(true)
      setTimeout(() => setCopiedNumber(false), 2000)
    }
  }

  // Handle switching payment method
  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    if (method === 'bkash_manual' && !bkashNumber) return
    setPaymentMethod(method)
    setSubmitError(null)
    if (method === 'cod') {
      // Clear any entered TrxID when switching back to COD
      setBkashTrxId('')
      setAmountChangedWarning(false)
    }
  }

  const isBkashValid = paymentMethod === 'bkash_manual'
    ? Boolean(bkashNumber && /^[A-Z0-9]{6,32}$/.test(bkashTrxId.trim().toUpperCase()))
    : true

  const fieldErrors: Partial<Record<CheckoutField, string>> = {
    name: f.name.trim().length >= 2 ? undefined : c.validation.name,
    phone: /^((\+?88)?01[3-9]\d{8})$/.test(f.phone.replace(/[\s\-()]/g, '')) ? undefined : c.validation.phone,
    district: f.district.trim() ? undefined : c.validation.district,
    city: f.city.trim().length >= 2 ? undefined : c.validation.city,
    address: f.address.trim().length >= 5 ? undefined : c.validation.address,
    bkashTrxId: paymentMethod !== 'bkash_manual' || /^[A-Z0-9]{6,32}$/.test(bkashTrxId.trim().toUpperCase())
      ? undefined
      : c.validation.bkashTrxId,
  }

  const showFieldError = (field: CheckoutField) =>
    fieldErrors[field] && (touched[field] || submitAttempted) ? fieldErrors[field] : undefined
  const hasFieldErrors = Object.values(fieldErrors).some(Boolean)

  const valid = Boolean(
    !hasFieldErrors &&
    isBkashValid &&
    pricing !== null &&
    !pricingLoading &&
    !pricingError
  )

  const unitPrice = pricing ? pricing.unitPrice : 250
  const subtotal = pricing ? pricing.productSubtotal : qty * unitPrice
  const deliveryCharge = pricing ? pricing.deliveryCharge : null
  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0
  const finalTotal = pricing ? Math.max(0, pricing.preDiscountTotal - discountAmount) : null
  const deliveryZone = pricing ? pricing.deliveryZone : null

  const handleManualApply = (e: React.FormEvent) => {
    e.preventDefault()
    applyCouponCode(couponInput)
  }

  /**
   * Final Authoritative Order Submission Handler (Step 7)
   * Calls POST /api/orders with strict customer/business fields and managed idempotency.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    if (!valid || submitting || !pricing || !deliveryZone || finalTotal === null) {
      const firstInvalid = (Object.keys(fieldErrors) as CheckoutField[]).find((field) => fieldErrors[field])
      if (firstInvalid) {
        setTouched((current) => ({ ...current, [firstInvalid]: true }))
        requestAnimationFrame(() => document.getElementById(firstInvalid)?.focus())
      }
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    // Construct the canonical payload containing ONLY customer & business inputs
    const orderPayload = {
      customerName: f.name.trim(),
      phone: f.phone.trim(),
      district: f.district.trim(),
      deliveryArea: f.city.trim(), // Thana / Area
      deliveryAddress: f.address.trim(), // Detailed address
      quantity: qty,
      couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      customerNote: f.notes.trim() || undefined,
      paymentMethod,
      bkashTransactionId: paymentMethod === 'bkash_manual' ? bkashTrxId.trim().toUpperCase() : undefined,
    }

    // Material change detection for idempotency key management:
    // If the customer changed quantity, district, area, address, phone, name, coupon, paymentMethod, or TrxID
    // after a prior attempt, generate a fresh idempotency key.
    const currentPayloadFingerprint = JSON.stringify(orderPayload)
    if (
      lastSubmittedPayloadRef.current &&
      lastSubmittedPayloadRef.current !== currentPayloadFingerprint
    ) {
      idempotencyKeyRef.current = generateIdempotencyKey()
    }
    lastSubmittedPayloadRef.current = currentPayloadFingerprint

    const requestBody = {
      ...orderPayload,
      idempotencyKey: idempotencyKeyRef.current,
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await res.json().catch(() => ({}))

      // HTTP 201 (Created) or HTTP 200 (Idempotent Retry Success)
      if (res.status === 201 || res.status === 200) {
        // Prepare a new idempotency key for any future orders
        idempotencyKeyRef.current = generateIdempotencyKey()
        lastSubmittedPayloadRef.current = null
        setSubmitting(false)

        // Pass the authoritative server response to the confirmation view
        onPlaced(data as OrderConfirmationData)
        return
      }

      // Handle specific HTTP error status codes cleanly
      if (res.status === 400) {
        // Validation error (e.g., invalid phone, invalid coupon, missing field, bad TrxID)
        const errMsg =
          data.error ||
          (lang === 'bn'
            ? 'অর্ডারের তথ্যে ত্রুটি রয়েছে। অনুগ্রহ করে তথ্য যাচাই করুন।'
            : 'Invalid order information. Please review your details.')

        // If the coupon expired or became invalid before submission, refresh preview
        if (data.code === 'not_found' || data.code === 'expired' || data.code === 'inactive' || data.code === 'usage_limit_reached') {
          setAppliedCoupon(null)
          setCouponError(errMsg)
          fetchAuthoritativePricing(qty, f.district, null)
        }

        setSubmitError(errMsg)
      } else if (res.status === 409) {
        // Duplicate TrxID conflict or idempotency conflict
        if (data.code === 'duplicate_transaction_id') {
          setSubmitError(
            lang === 'bn'
              ? 'এই ট্রানজেকশন আইডিটি ইতিমধ্যে ব্যবহৃত হয়েছে। অনুগ্রহ করে আপনার bKash ট্রানজেকশন যাচাই করে আবার চেষ্টা করুন।'
              : 'This transaction ID has already been used. Please check your bKash transaction and try again.'
          )
        } else {
          setSubmitError(
            lang === 'bn'
              ? 'এই অর্ডারের জন্য একটি পরিবর্তন শনাক্ত হয়েছে। অনুগ্রহ করে বিস্তারিত দেখে আবার অর্ডার করুন।'
              : 'Order details changed. Please review your order and try again.'
          )
        }
        // Refresh idempotency key on explicit conflict
        idempotencyKeyRef.current = generateIdempotencyKey()
      } else if (res.status === 429) {
        // Rate limit exceeded
        setSubmitError(
          lang === 'bn'
            ? 'অতিরিক্ত প্রচেষ্টা লক্ষ্য করা গেছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।'
            : 'Too many attempts. Please wait a moment and try again.'
        )
      } else {
        // General server / network error (HTTP 500)
        setSubmitError(
          lang === 'bn'
            ? 'আমরা এই মুহূর্তে আপনার অর্ডার সম্পন্ন করতে পারছি না। অনুগ্রহ করে আবার চেষ্টা করুন।'
            : "We couldn't place your order right now. Please try again."
        )
      }
    } catch (netErr) {
      console.error('Order submission network error:', netErr)
      setSubmitError(
        lang === 'bn'
          ? 'নেটওয়ার্ক সমস্যা হয়েছে। অনুগ্রহ করে আপনার ইন্টারনেট চেক করে আবার চেষ্টা করুন।'
          : 'Network error. Please check your connection and try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Format currency numbers localized
  const formatTaka = (num: number) => {
    if (lang === 'bn') {
      const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
      return '৳' + String(num).replace(/\d/g, (d) => bnDigits[Number(d)])
    }
    return `৳${num}`
  }

  return (
    <div className="storefront-checkout min-h-screen">
      <header className="border-b border-ink-15">
        <div className="focuso-container h-[64px] flex items-center justify-between">
          <button onClick={onBack} className="hover:opacity-70 transition-opacity">
            <Wordmark className="text-[20px]" />
          </button>
          <div className="flex items-center gap-6">
            <LangToggle />
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 text-[15px] text-ink-60 hover:text-ink transition-colors"
            >
              <IconArrow className="w-4 h-4 rotate-180" /> {c.back}
            </button>
          </div>
        </div>
      </header>

      <main className="focuso-container checkout-shell py-10 md:py-14">
        <h1 className="font-serif text-[clamp(32px,5vw,44px)] leading-[1.08] tracking-[-0.025em]">{c.title}</h1>
        <p className="mt-3 text-[15px] text-ink-60">{c.subtitle}</p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-9 grid min-[960px]:grid-cols-[minmax(0,1.25fr)_minmax(340px,.85fr)] gap-9 min-[960px]:gap-14 items-start"
        >
          {/* Customer & Delivery Information */}
          <div className="checkout-details space-y-9">
            <section className="pb-9 border-b border-ink-15">
              <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-green">01</p>
              <h2 className="mt-1 text-[19px] font-semibold text-ink">
                {c.deliveryDetails}
              </h2>
              <div className="mt-6 grid gap-5">
                <Field
                  label={c.fields.name.label}
                  id="name"
                  placeholder={c.fields.name.ph}
                  value={f.name}
                  onChange={set('name')}
                  onBlur={markTouched('name')}
                  required
                  error={showFieldError('name')}
                />

                <div className="grid sm:grid-cols-2 gap-5">
                  <Field
                    label={c.fields.phone.label}
                    id="phone"
                    type="tel"
                    placeholder={c.fields.phone.ph}
                    value={f.phone}
                    onChange={set('phone')}
                    onBlur={markTouched('phone')}
                    required
                    error={showFieldError('phone')}
                  />

                  {/* District Selection (Step 4B: Chattogram = ৳60, All other districts = ৳100) */}
                  <label htmlFor="district" className="block">
                    <span className="text-[14px] font-medium text-ink">
                      {c.fields.district?.label || 'District'}<span className="text-green"> *</span>
                    </span>
                    <div className="relative mt-2">
                      <select
                        id="district"
                        value={f.district}
                        onChange={(e) => set('district')(e.target.value)}
                        onBlur={markTouched('district')}
                        required
                        aria-invalid={Boolean(showFieldError('district'))}
                        aria-describedby={showFieldError('district') ? 'district-error' : undefined}
                        className={`w-full appearance-none rounded-[8px] border bg-white px-4 py-3 pr-10 text-[15px] text-ink transition-colors focus:outline-none ${
                          showFieldError('district') ? 'border-red-400 focus:border-red-500' : 'border-ink-15 hover:border-ink-45 focus:border-green'
                        }`}
                      >
                        <option value="" disabled>
                          {c.fields.district?.ph || (lang === 'bn' ? 'জেলা নির্বাচন করুন' : 'Select your district')}
                        </option>
                        {BANGLADESH_DISTRICTS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {lang === 'bn' ? d.labelBn : d.labelEn}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-ink-45">
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </div>
                    {showFieldError('district') && <span id="district-error" role="alert" className="mt-1.5 block text-[12px] font-medium text-red-600">{showFieldError('district')}</span>}
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <Field
                    label={c.fields.city.label}
                    id="city"
                    placeholder={c.fields.city.ph}
                    value={f.city}
                    onChange={set('city')}
                    onBlur={markTouched('city')}
                    required
                    error={showFieldError('city')}
                  />
                  <Field
                    label={c.fields.address.label}
                    id="address"
                    placeholder={c.fields.address.ph}
                    value={f.address}
                    onChange={set('address')}
                    onBlur={markTouched('address')}
                    required
                    error={showFieldError('address')}
                  />
                </div>

                <Field
                  label={c.fields.notes.label}
                  id="notes"
                  placeholder={c.fields.notes.ph}
                  value={f.notes}
                  onChange={set('notes')}
                  textarea
                />
              </div>
            </section>

            {/* Step 7: Payment Method Selection */}
            <section>
              <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-green">02</p>
              <h2 className="mt-1 text-[19px] font-semibold text-ink">
                {c.paymentMethod}
              </h2>
              <div className="mt-5 grid sm:grid-cols-2 gap-3">
                {/* Cash on Delivery Option */}
                <label
                  onClick={() => handleSelectPaymentMethod('cod')}
                  className={`flex flex-col justify-between p-4 rounded-[12px] border cursor-pointer transition-all ${
                    paymentMethod === 'cod'
                      ? 'border-green bg-soft-green/60 shadow-xs'
                      : 'border-ink-15 bg-white hover:border-ink-45'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={() => handleSelectPaymentMethod('cod')}
                      className="sr-only"
                    />
                    <span className={`grid place-items-center w-5 h-5 rounded-full border-2 ${
                      paymentMethod === 'cod' ? 'border-green' : 'border-ink-15'
                    }`}>
                      {paymentMethod === 'cod' && <span className="w-2.5 h-2.5 rounded-full bg-green" />}
                    </span>
                    <span className="text-[16px] text-ink font-semibold">{c.cod}</span>
                  </div>
                  <span className="text-[13px] text-ink-60 mt-2 pl-8">
                    {c.codDesc || (lang === 'bn' ? 'পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন' : 'Pay when you receive your order')}
                  </span>
                </label>

                {/* bKash Manual Send Money Option */}
                <label
                  onClick={() => handleSelectPaymentMethod('bkash_manual')}
                  aria-disabled={!bkashNumber}
                  className={`flex flex-col justify-between p-4 rounded-[12px] border cursor-pointer transition-all ${
                    paymentMethod === 'bkash_manual'
                      ? 'border-green bg-soft-green/60 shadow-xs'
                      : bkashNumber
                        ? 'border-ink-15 bg-white hover:border-ink-45'
                        : 'border-ink-15 bg-ink/[0.03] opacity-65 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bkash_manual"
                      checked={paymentMethod === 'bkash_manual'}
                      onChange={() => handleSelectPaymentMethod('bkash_manual')}
                      disabled={!bkashNumber}
                      className="sr-only"
                    />
                    <span className={`grid place-items-center w-5 h-5 rounded-full border-2 ${
                      paymentMethod === 'bkash_manual' ? 'border-green' : 'border-ink-15'
                    }`}>
                      {paymentMethod === 'bkash_manual' && <span className="w-2.5 h-2.5 rounded-full bg-green" />}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] text-ink font-semibold">{c.bkash || 'bKash'}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-pink-700 bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
                        Send Money
                      </span>
                    </div>
                  </div>
                  <span className="text-[13px] text-ink-60 mt-2 pl-8">
                    {bkashConfigState === 'loading'
                      ? (lang === 'bn' ? 'পেমেন্ট তথ্য লোড হচ্ছে…' : 'Loading payment details…')
                      : bkashConfigState === 'error'
                        ? (lang === 'bn' ? 'bKash পেমেন্ট বর্তমানে অনুপলব্ধ' : 'bKash payment is currently unavailable')
                        : c.bkashDesc || (lang === 'bn' ? 'bKash সেন্ড মানি করে এখনই পরিশোধ করুন' : 'Pay now using bKash Send Money')}
                  </span>
                </label>
              </div>

              {/* bKash Payment Instructions & TrxID Input Card */}
              {paymentMethod === 'bkash_manual' && (
                <div className="mt-5 rounded-[14px] border border-green/25 bg-white p-5 space-y-5 animate-fade shadow-sm">
                  {/* Warning if amount changed after TrxID was typed */}
                  {amountChangedWarning && (
                    <div className="rounded-[8px] bg-amber-50 border border-amber-200 p-3 text-[13px] text-amber-900">
                      ⚠️ {c.bkashPriceChangedWarning || (lang === 'bn' ? 'অর্ডারের মোট টাকার পরিমাণ পরিবর্তিত হয়েছে। অনুগ্রহ করে আপনার bKash পেমেন্টের তথ্য পুনরায় যাচাই করুন।' : 'Order amount changed. Please verify your bKash payment details again.')}
                    </div>
                  )}

                  {/* Send Money Number & Authoritative Payable Amount Display */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-[10px] bg-cream/45 border border-[#d9ce95] p-3.5 flex flex-col justify-between">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-60">
                        {c.bkashSendMoneyTo || (lang === 'bn' ? 'সেন্ড মানি করুন' : 'Send Money to')}
                      </span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[18px] font-mono font-bold text-deep tracking-wider">
                          {bkashNumber}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyBkashNumber}
                          className="px-2.5 py-1 text-[12px] font-medium rounded-[6px] border border-ink-15 bg-white text-ink hover:border-green hover:text-green transition-colors"
                        >
                          {copiedNumber ? (c.bkashCopied || 'Copied!') : (c.bkashCopy || 'Copy')}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-[10px] bg-soft-green/60 border border-green/30 p-3.5 flex flex-col justify-between">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-green">
                        {c.bkashAmountToSend || (lang === 'bn' ? 'প্রদেয় মোট টাকা' : 'Amount to send')}
                      </span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-[20px] font-serif font-bold text-deep">
                          {finalTotal !== null ? formatTaka(finalTotal) : '—'}
                        </span>
                        <span className="text-[11px] text-ink-60">
                          {lang === 'bn' ? 'সঠিক পরিমাণ পাঠান' : 'Exact amount'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Step-by-Step Instructions */}
                  <div className="rounded-[10px] border border-ink-15 bg-sand-light/20 p-4">
                    <h3 className="text-[13px] font-semibold text-ink uppercase tracking-wider mb-2">
                      {c.bkashInstructionsTitle || (lang === 'bn' ? 'bKash পেমেন্ট নির্দেশিকা' : 'bKash Payment Steps')}
                    </h3>
                    <ol className="text-[13px] text-ink-60 space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>{c.bkashStep1 || (lang === 'bn' ? 'আপনার bKash অ্যাপ ওপেন করুন।' : 'Open your bKash app.')}</li>
                      <li>{c.bkashStep2 || (lang === 'bn' ? 'Send Money অপশন বেছে নিন।' : 'Choose Send Money.')}</li>
                      <li>
                        {c.bkashStep3 || (lang === 'bn' ? 'উপরে উল্লেখিত নম্বরে প্রদর্শিত সঠিক পরিমাণ টাকা পাঠান।' : 'Send the exact amount shown above to the displayed number.')}
                      </li>
                      <li>
                        {c.bkashStep4 || (lang === 'bn' ? 'এসএমএস বা বিবরণী থেকে bKash ট্রানজেকশন আইডি (TrxID) কপি করুন।' : 'Copy the bKash Transaction ID (TrxID) from your confirmation SMS or statement.')}
                      </li>
                      <li>{c.bkashStep5 || (lang === 'bn' ? 'নিচে TrxID লিখুন এবং অর্ডার সম্পন্ন করুন।' : 'Enter the TrxID below and place your order.')}</li>
                    </ol>
                  </div>

                  {/* Transaction ID Input Field */}
                  <div>
                    <label htmlFor="bkashTrxId" className="block">
                      <span className="text-[14px] font-medium text-ink">
                        {c.bkashTrxIdLabel || 'bKash Transaction ID (TrxID)'}<span className="text-green"> *</span>
                      </span>
                      <input
                        id="bkashTrxId"
                        type="text"
                        placeholder={c.bkashTrxIdPh || 'e.g. 9M87XTR23A'}
                        value={bkashTrxId}
                        onChange={(e) => {
                          setBkashTrxId(e.target.value.toUpperCase())
                          setAmountChangedWarning(false)
                          setSubmitError(null)
                        }}
                        onBlur={markTouched('bkashTrxId')}
                        required={paymentMethod === 'bkash_manual'}
                        aria-invalid={Boolean(showFieldError('bkashTrxId'))}
                        aria-describedby={showFieldError('bkashTrxId') ? 'bkashTrxId-error' : 'bkashTrxId-help'}
                        className={`mt-2 w-full font-mono rounded-[8px] border bg-white px-4 py-3 text-[16px] text-ink placeholder:font-sans placeholder:text-ink-45 uppercase transition-colors focus:outline-none ${
                          showFieldError('bkashTrxId') ? 'border-red-400 focus:border-red-500' : 'border-ink-15 focus:border-green'
                        }`}
                      />
                    </label>
                    {showFieldError('bkashTrxId') ? (
                      <p id="bkashTrxId-error" role="alert" className="mt-1.5 text-[12px] font-medium text-red-600">{showFieldError('bkashTrxId')}</p>
                    ) : (
                      <p id="bkashTrxId-help" className="mt-1.5 text-[12px] text-ink-45">
                        {c.bkashTrxIdHelp || (lang === 'bn' ? 'টাকা পাঠানোর পর প্রাপ্ত ট্রানজেকশন আইডিটি এখানে লিখুন।' : 'Enter the alphanumeric Transaction ID received after sending money.')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Order summary */}
          <aside className="checkout-summary rounded-[14px] border border-ink-15 bg-white p-5 sm:p-6 min-[960px]:sticky min-[960px]:top-6">
            <h2 className="text-[11px] font-semibold tracking-[0.16em] uppercase text-green">
              {c.orderSummary}
            </h2>
            <div className="mt-5 flex gap-4">
              <div className="w-20 h-24 rounded-[8px] overflow-hidden bg-soft-green border border-ink-15 shrink-0 grid place-items-center p-1.5">
                <DailyPage className="w-full h-auto" />
              </div>
              <div className="min-w-0">
                <p className="text-[16px] font-semibold leading-tight">{c.productName}</p>
                <p className="text-[14px] text-ink-60 mt-1">{c.productMeta}</p>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="inline-flex min-h-10 items-center border border-ink-15 rounded-[8px] bg-white" aria-label={c.quantityLabel}>
                    <button
                      type="button"
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      disabled={qty <= 1 || submitting}
                      className="grid h-10 w-10 place-items-center text-ink hover:text-green disabled:opacity-30 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <IconMinus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-[14px] font-semibold" aria-live="polite">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(Math.min(9, qty + 1))}
                      disabled={qty >= 9 || submitting}
                      className="grid h-10 w-10 place-items-center text-ink hover:text-green disabled:opacity-30 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <IconPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[15px] font-medium text-ink">
                    {formatTaka(unitPrice * qty)}
                  </span>
                </div>
              </div>
            </div>

            {/* Coupon Code Input & Application */}
            <div className="mt-6 border-t border-ink-15 pt-5">
              <span className="text-[14px] font-medium text-ink block mb-2">
                {c.fields.coupon?.label || 'Coupon code'}
              </span>

              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-[10px] border border-[#d9ce95] bg-cream/55 px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-deep bg-white/80 px-2 py-0.5 rounded border border-[#d9ce95]">
                      {appliedCoupon.code}
                    </span>
                    <span className="text-[13px] text-ink">
                      {c.fields.coupon?.applied || 'FOCUS25 applied'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    disabled={submitting}
                    className="text-[13px] font-medium text-red-600 hover:text-red-700 transition-colors"
                  >
                    {c.fields.coupon?.remove || 'Remove'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={c.fields.coupon?.ph || 'Promo code'}
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value)
                        setCouponError('')
                      }}
                      disabled={couponLoading || submitting}
                      className="flex-1 rounded-[10px] border border-ink-15 bg-white px-3.5 py-2 text-[14px] text-ink placeholder:text-ink-45 uppercase focus:border-green focus:outline-none transition-colors"
                    />
                    <Button
                      type="button"
                      onClick={handleManualApply}
                      disabled={couponLoading || !couponInput.trim() || submitting}
                      className="!py-2 !px-4 text-[14px]"
                    >
                      {couponLoading ? (lang === 'bn' ? 'যাচাই হচ্ছে...' : 'Verifying...') : (c.fields.coupon?.apply || 'Apply')}
                    </Button>
                  </div>

                  {/* Eligible Promo Code Card: FOCUS25 */}
                  <div className="rounded-[10px] border border-green/20 bg-soft-green/45 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-bold font-mono text-deep tracking-wider">
                            FOCUS25
                          </span>
                          <span className="text-[11px] font-semibold text-green bg-soft-green px-1.5 py-0.2 rounded">
                            {c.fields.coupon?.offerTitle || '25% OFF'}
                          </span>
                        </div>
                        <p className="text-[12px] text-ink-60 mt-0.5">
                          {c.fields.coupon?.offerSubtitle || 'On planner price'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyCouponCode('FOCUS25')}
                        disabled={couponLoading || submitting}
                        className="text-[12px] font-semibold text-green hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {c.fields.coupon?.apply || 'Apply'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {couponError && (
                <p className="mt-2 text-[12px] text-red-600 font-medium">
                  {couponError}
                </p>
              )}
            </div>

            {/* Price Breakdown */}
            <div className="mt-6 border-t border-ink-15 pt-5">
              {pricingError && (
                <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
                  {pricingError}
                </div>
              )}

              <dl className="space-y-3 text-[15px]">
                <div className="flex justify-between">
                  <dt className="text-ink-60">
                    {c.subtotal} {qty > 1 && `(${qty} × ${formatTaka(unitPrice)})`}
                  </dt>
                  <dd className="font-medium text-ink">{formatTaka(subtotal)}</dd>
                </div>

                <div className="flex justify-between">
                  <dt className="text-ink-60">{c.delivery}</dt>
                  <dd className="font-medium text-ink">
                    {deliveryCharge !== null ? (
                      formatTaka(deliveryCharge)
                    ) : (
                      <span className="text-right text-[12px] leading-snug text-ink-45">
                        {c.calculatedAfterDistrict}
                      </span>
                    )}
                  </dd>
                </div>

                {appliedCoupon && discountAmount > 0 && (
                  <div className="flex justify-between text-green font-medium">
                    <dt className="flex items-center gap-1">
                      <span>{c.discount || 'Coupon discount'}</span>
                      <span className="text-[12px] font-mono opacity-80">({appliedCoupon.code})</span>
                    </dt>
                    <dd>-{formatTaka(discountAmount)}</dd>
                  </div>
                )}

                <div className="mt-1 flex justify-between gap-5 border-t border-ink-15 pt-4 items-baseline">
                  <dt className="text-[16px] font-semibold text-ink">{c.total}</dt>
                  <dd className="text-[18px] font-serif font-bold text-deep">
                    {pricingLoading ? (
                      <span className="text-[15px] font-sans font-normal text-ink-45 animate-pulse">
                        {lang === 'bn' ? 'হিসাব হচ্ছে...' : 'Calculating...'}
                      </span>
                    ) : finalTotal !== null ? (
                      formatTaka(finalTotal)
                    ) : (
                      <span className="max-w-36 text-right text-[12px] font-sans font-normal leading-snug text-ink-45">
                        {c.calculatedAfterDistrict}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Submission error feedback */}
            {submitError && (
              <div className="mt-4 rounded-[10px] border border-red-200 bg-red-50 p-3.5 text-[13px] text-red-700 animate-fade">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 font-bold shrink-0">⚠️</span>
                  <span>{submitError}</span>
                </div>
              </div>
            )}

            <Button full className="mt-6 min-h-13" type="submit" disabled={submitting || pricingLoading}>
              {submitting
                ? (lang === 'bn' ? 'অর্ডার প্রক্রিয়াধীন...' : 'Processing order...')
                : c.placeOrder}
            </Button>
            {!valid && !submitAttempted && !pricingLoading && (
              <p className="mt-2.5 text-center text-[12px] text-ink-45">
                {c.completeDetails}
              </p>
            )}
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-ink-15 pt-4 text-center text-[11px] leading-snug text-ink-60">
              {c.trust.map((item: string) => (
                <span key={item} className="flex flex-col items-center gap-1">
                  <IconCheck className="h-3.5 w-3.5 text-green" />
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-ink-45 text-center">{c.safeNote}</p>
          </aside>
        </form>
      </main>
    </div>
  )
}
