import { useEffect, useState } from 'react'
import { Wordmark, Button, IconMenu, IconClose, IconArrow, LangToggle } from './primitives'
import { useLang } from '../i18n'

export function Nav({ onOrder, onHome }: { onOrder: () => void; onHome: () => void }) {
  const { t } = useLang()
  const links = t.nav.links
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <header
      className={`storefront-nav sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-white-soft/85 backdrop-blur-md border-b border-ink-15' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="focuso-container h-[68px] flex items-center justify-between">
        <button onClick={onHome} className="nav-wordmark text-ink hover:opacity-70 transition-opacity" aria-label="FOCUSO home">
          <Wordmark className="text-[22px] lg:text-[28px]" />
        </button>

        <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="nav-link text-[14px] text-ink-60 transition-colors hover:text-ink focus-visible:text-ink">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-4 border-l border-ink-15 pl-5">
          <LangToggle className="text-[14px]" />
          <Button onClick={onOrder} className="focuso-button nav-order-button">
            {t.nav.orderNow}<IconArrow className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="lg:hidden flex items-center gap-4">
          <LangToggle />
          <button
            className="nav-menu-trigger text-ink"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <IconMenu />
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div className="nav-mobile-sheet fixed inset-0 z-50 bg-white-soft lg:hidden flex flex-col overflow-y-auto">
          <div className="nav-mobile-header px-6 flex items-center justify-between border-b border-ink-15">
            <Wordmark className="text-[22px]" />
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="nav-menu-trigger"><IconClose /></button>
          </div>
          <nav aria-label="Mobile navigation" className="nav-mobile-links flex flex-col px-6 py-8 gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="font-serif text-[30px] py-4 border-b border-ink-15 text-ink"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="nav-mobile-actions mt-auto p-6 flex items-center justify-between gap-4 border-t border-ink-15">
            <LangToggle className="text-[15px]" />
            <Button onClick={() => { setOpen(false); onOrder() }} className="focuso-button px-5">{t.nav.orderFull}<IconArrow className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </header>
  )
}
