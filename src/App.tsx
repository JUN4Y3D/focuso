import { useEffect, useState } from 'react'
import { Nav } from './components/Nav'
import { Home } from './components/Home'
import { Checkout } from './components/Checkout'
import { Confirmation } from './components/Confirmation'
import { FocusoCompanion } from './components/FocusoCompanion'
import { LanguageProvider } from './i18n'
import { OrderConfirmationData } from './types/order'
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext'
import { AdminLogin } from './components/admin/AdminLogin'
import { AdminShell } from './components/admin/AdminShell'

type CustomerView = 'home' | 'checkout' | 'confirmation'

export default function App() {
  return (
    <LanguageProvider>
      <AdminAuthProvider>
        <AppRouter />
      </AdminAuthProvider>
    </LanguageProvider>
  )
}

function AppRouter() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path)
    setPathname(path)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  // Admin routing check
  if (pathname === '/admin/login' || pathname === '/admin') {
    return <AdminRouteHandler pathname={pathname} onNavigate={navigateTo} />
  }

  // Customer guest experience (no accounts, pure guest checkout)
  return <CustomerShell />
}

function AdminRouteHandler({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate: (path: string) => void
}) {
  const { admin, loading } = useAdminAuth()

  // Prevent UI flash while checking Supabase session & verifying with backend
  if (loading) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-3 border-stone-300 border-t-deep rounded-full animate-spin mb-4" />
          <p className="text-xs uppercase tracking-widest text-ink/70 font-semibold">
            Verifying Session...
          </p>
        </div>
      </div>
    )
  }

  if (pathname === '/admin/login') {
    if (admin) {
      // Already authenticated & authorized admin
      onNavigate('/admin')
      return null
    }
    return <AdminLogin onSuccess={() => onNavigate('/admin')} />
  }

  // pathname === '/admin'
  if (!admin) {
    // Not authorized or unauthenticated -> redirect to /admin/login
    onNavigate('/admin/login')
    return null
  }

  return <AdminShell onLogoutSuccess={() => onNavigate('/admin/login')} />
}

function CustomerShell() {
  const [view, setView] = useState<CustomerView>('home')
  const [qty, setQty] = useState(1)
  const [confirmedOrder, setConfirmedOrder] = useState<OrderConfirmationData | null>(null)

  // Reset scroll on view change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [view])

  const goOrder = () => setView('checkout')
  const goHome = () => {
    setView('home')
    setConfirmedOrder(null)
  }

  const handleOrderPlaced = (orderData: OrderConfirmationData) => {
    setConfirmedOrder(orderData)
    setView('confirmation')
  }

  if (view === 'checkout') {
    return (
      <>
        <Checkout
          qty={qty}
          setQty={setQty}
          onBack={goHome}
          onPlaced={handleOrderPlaced}
        />
        <FocusoCompanion />
      </>
    )
  }

  if (view === 'confirmation') {
    return (
      <>
        <Confirmation order={confirmedOrder} onHome={goHome} />
        <FocusoCompanion />
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-white-soft text-ink font-sans selection:bg-soft-green selection:text-deep">
      <Nav onOrder={goOrder} onHome={goHome} />
      <Home onOrder={goOrder} qty={qty} setQty={setQty} />
      <FocusoCompanion />
    </div>
  )
}
