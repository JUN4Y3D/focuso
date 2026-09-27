import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { useLang } from '../i18n'

/* The official wordmark asset was not supplied to the project.
   Per the brand guidelines (§27), this is a clearly-labelled placeholder
   set in the brand display face — not a redrawn or invented mark. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`wordmark-en tracking-[0.02em] leading-none select-none ${className}`}
      aria-label="FOCUSO"
      title="FOCUSO — wordmark placeholder"
    >
      FOCUSO
    </span>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block text-green text-[12px] font-semibold tracking-[0.18em] uppercase">
      {children}
    </span>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  full?: boolean
}

export function Button({ variant = 'primary', full, className = '', children, ...rest }: BtnProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[10px] text-[16px] font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.985] px-6 py-3.5'
  const styles = {
    primary: 'bg-green text-white-soft hover:bg-deep',
    secondary: 'border border-ink-15 text-ink hover:bg-ink-04 bg-transparent',
    ghost: 'text-ink hover:text-green bg-transparent px-0 py-0',
  }[variant]
  return (
    <button className={`${base} ${styles} ${full ? 'w-full' : ''} ${className}`} {...rest}>
      {children}
    </button>
  )
}

/* Minimal EN ↔ Bangla switch — understated, no pill, no decorative track.
   Two labels split by a hairline; the active language reads in full ink,
   the other sits back at reduced weight. Works on desktop and mobile. */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLang()
  const opts: { code: 'en' | 'bn'; label: string; face: string }[] = [
    { code: 'en', label: 'EN', face: 'wordmark-en' },
    { code: 'bn', label: 'বাংলা', face: 'bn' },
  ]
  return (
    <div
      role="group"
      aria-label={t.nav.langLabel}
      className={`inline-flex items-center gap-2 text-[14px] leading-none ${className}`}
    >
      {opts.map((o, i) => {
        const active = lang === o.code
        return (
          <span key={o.code} className="inline-flex items-center gap-2">
            {i > 0 && <span aria-hidden className="text-ink-45 select-none">|</span>}
            <button
              type="button"
              onClick={() => setLang(o.code)}
              aria-pressed={active}
              className={`${o.face} transition-colors ${
                active ? 'text-ink font-semibold' : 'text-ink-45 hover:text-ink font-medium'
              }`}
            >
              {o.label}
            </button>
          </span>
        )
      })}
    </div>
  )
}

/* Minimal, functional line icons — consistent 1.6 stroke, monochrome (§19) */
type IconProps = { className?: string }
const s = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const IconArrow = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...s}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)
export const IconMinus = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...s}><path d="M5 12h14" /></svg>
)
export const IconPlus = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...s}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconCheck = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...s}><path d="M20 6L9 17l-5-5" /></svg>
)
export const IconMenu = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...s}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
)
export const IconClose = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...s}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const IconChevron = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...s}><path d="M6 9l6 6 6-6" /></svg>
)
