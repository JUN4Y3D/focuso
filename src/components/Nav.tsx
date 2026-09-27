import { useEffect, useState } from 'react'
import { Wordmark, Button, IconMenu, IconClose, LangToggle } from './primitives'
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
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-white-soft/85 backdrop-blur-md border-b border-ink-15' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="mx-auto max-w-[1320px] px-6 md:px-10 h-[72px] flex items-center justify-between">
        <button onClick={onHome} className="text-ink hover:opacity-70 transition-opacity">
          <Wordmark className="text-[24px]" />
        </button>

        <nav className="hidden md:flex items-center gap-9">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-[15px] text-ink-60 hover:text-ink transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-6">
          <LangToggle />
          <Button onClick={onOrder} className="px-5 py-2.5 text-[15px]">
            {t.nav.orderNow}
          </Button>
        </div>

        <div className="md:hidden flex items-center gap-4">
          <LangToggle />
          <button
            className="text-ink p-1"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <IconMenu />
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div className="fixed inset-0 z-50 bg-white-soft md:hidden flex flex-col animate-fade">
          <div className="h-[72px] px-6 flex items-center justify-between border-b border-ink-15">
            <Wordmark className="text-[24px]" />
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-1"><IconClose /></button>
          </div>
          <nav className="flex flex-col px-6 py-8 gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="font-serif text-[30px] py-3 border-b border-ink-15 text-ink"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-auto p-6 flex items-center justify-between gap-4">
            <LangToggle className="text-[15px]" />
            <Button onClick={() => { setOpen(false); onOrder() }} className="px-6">{t.nav.orderFull}</Button>
          </div>
        </div>
      )}
    </header>
  )
}
