import { useState } from 'react'
import { Button, SectionLabel, IconArrow, IconCheck, IconMinus, IconPlus, IconChevron, Wordmark } from './primitives'
import { MonthlyPage, WeeklyPage, DailyPage } from './PlannerPages'
import { useLang } from '../i18n'

const img = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`

/* Premium presentation of the real planner pages: front page with a second
   page offset behind. Border + tonal surface, no drop shadow (brand §16). */
function PlannerStack({ front, behind }: { front: React.ReactNode; behind: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="absolute right-[-9%] top-[7%] w-[80%] rotate-[4.5deg] rounded-[10px] border border-ink-15 overflow-hidden bg-white opacity-85 hidden sm:block">
        {behind}
      </div>
      <div className="relative rounded-[10px] border border-ink-15 overflow-hidden bg-white">
        {front}
      </div>
    </div>
  )
}

/* ---------- SECTION 01 — HERO ---------- */
function Hero({ onOrder }: { onOrder: () => void }) {
  const { t } = useLang()
  return (
    <section className="mx-auto max-w-[1320px] px-6 md:px-10 pt-10 md:pt-16 pb-20 md:pb-28">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-center">
        <div className="animate-fade">
          <SectionLabel>{t.hero.label}</SectionLabel>
          <h1 className="font-serif mt-6 text-[clamp(44px,7vw,76px)] leading-[1.04] tracking-[-0.01em]">
            {t.hero.title1}<br />{t.hero.title2}
          </h1>
          <p className="mt-5 font-serif italic text-[clamp(18px,2.4vw,24px)] leading-[1.3] text-green">
            {t.hero.tagline}
          </p>
          <p className="mt-6 text-[18px] leading-[1.7] text-ink-60 max-w-[30rem]">
            {t.hero.body}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Button onClick={onOrder}>{t.hero.order}</Button>
            <a href="#inside" className="inline-flex items-center gap-2 text-[16px] font-semibold text-ink hover:text-green transition-colors">
              {t.hero.explore} <IconArrow />
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[16px] bg-soft-green px-6 py-10 md:px-10 md:py-14">
            <PlannerStack
              front={<DailyPage className="w-full h-auto" />}
              behind={<MonthlyPage className="w-full h-auto" />}
            />
          </div>
          <div className="hidden md:flex absolute -bottom-5 -left-5 bg-cream border border-ink-15 rounded-[12px] px-5 py-4 gap-6">
            {t.hero.stats.map(([a, b]) => (
              <div key={b}>
                <div className="font-serif text-[22px] leading-none text-deep">{a}</div>
                <div className="text-[12px] text-ink-60 mt-1">{b}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- SECTION 02 — TENSION ---------- */
function Tension() {
  const { t } = useLang()
  const scattered = t.tension.cards
  return (
    <section className="border-y border-ink-15 bg-white-soft">
      <div className="mx-auto max-w-[1320px] px-6 md:px-10 py-20 md:py-28 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <div>
          <h2 className="font-serif text-[clamp(32px,4.5vw,44px)] leading-[1.12]">
            {t.tension.heading}
          </h2>
          <p className="mt-6 text-[18px] leading-[1.7] text-ink-60 max-w-[34rem]">
            {t.tension.body1}
          </p>
          <p className="mt-5 text-[18px] leading-[1.7] text-ink max-w-[34rem]">
            {t.tension.body2}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {scattered.map((t, i) => (
            <div
              key={t}
              className="rounded-[12px] border border-ink-15 bg-ink-04 px-5 py-6 text-[15px] text-ink-60"
              style={{ transform: `rotate(${[-1.5, 1, 1.5, -1][i]}deg)` }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- SECTION 03 — SHOW THE SYSTEM ---------- */
function System() {
  const { t } = useLang()
  const pages = [MonthlyPage, WeeklyPage, DailyPage]
  const nums = ['01', '02', '03']
  const steps = t.system.steps.map((s, i) => ({ n: nums[i], label: s.label, body: s.body, Page: pages[i] }))
  return (
    <section id="how" className="mx-auto max-w-[1320px] px-6 md:px-10 py-20 md:py-28">
      <div className="max-w-[40rem]">
        <SectionLabel>{t.system.label}</SectionLabel>
        <h2 className="font-serif mt-5 text-[clamp(32px,4.5vw,44px)] leading-[1.12]">
          {t.system.heading}
        </h2>
        <p className="mt-6 text-[18px] leading-[1.7] text-ink-60">
          {t.system.body}
        </p>
      </div>

      <div className="mt-14 grid md:grid-cols-3 gap-x-8 gap-y-12">
        {steps.map(({ n, label, body, Page }, i) => (
          <div key={n} className="relative">
            <div className="rounded-[14px] bg-soft-green p-5">
              <div className="rounded-[10px] border border-ink-15 overflow-hidden bg-white">
                <Page className="w-full h-auto" />
              </div>
            </div>
            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-serif text-[22px] text-green">{n}</span>
              <h3 className="text-[20px] font-semibold">{label}</h3>
            </div>
            <p className="mt-2 text-[16px] leading-[1.6] text-ink-60">{body}</p>
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-[30%] -right-4 text-ink-45"><IconArrow className="w-6 h-6" /></div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-r-[10px] border-l-4 border-deep bg-cream p-5 text-[16px] leading-[1.6] text-ink max-w-[44rem]">
        <p className="font-medium text-ink">{t.habitTracker.compound}</p>
      </div>
    </section>
  )
}

/* ---------- SECTION 04 — 60-DAY IDEA ---------- */
function SixtyDay() {
  const { t } = useLang()
  const points = t.sixtyDay.points
  return (
    <section className="border-y border-ink-15 bg-cream/45">
      <div className="mx-auto max-w-[1320px] px-6 md:px-10 py-20 md:py-28 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="rounded-[16px] overflow-hidden bg-soft-green aspect-[5/4] order-last lg:order-first">
          <img
            src={img('1689525970033-948720b0ccf8', 1000, 800)}
            alt={t.sixtyDay.alt}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <SectionLabel>{t.sixtyDay.label}</SectionLabel>
          <h2 className="font-serif mt-5 text-[clamp(32px,4.5vw,44px)] leading-[1.12]">
            {t.sixtyDay.heading}
          </h2>
          <p className="mt-6 text-[18px] leading-[1.7] text-ink-60 max-w-[34rem]">
            {t.sixtyDay.body}
          </p>
          <ul className="mt-8 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[16px] text-ink">
                <span className="mt-0.5 text-green shrink-0"><IconCheck /></span>{p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ---------- SECTION 06 — PRODUCT DETAILS ---------- */
function Details() {
  const { t } = useLang()
  const confirmed = t.details.confirmed
  const placeholders = t.details.placeholders
  return (
    <section className="mx-auto max-w-[1320px] px-6 md:px-10 py-20 md:py-28">
      <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-16">
        <div>
          <SectionLabel>{t.details.label}</SectionLabel>
          <h2 className="font-serif mt-5 text-[clamp(30px,4vw,40px)] leading-[1.12]">
            {t.details.heading}
          </h2>
          <p className="mt-6 text-[17px] leading-[1.7] text-ink-60 max-w-[26rem]">
            {t.details.body}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-10">
          <dl>
            {confirmed.map(([k, v], i) => (
              <div key={i} className="flex justify-between gap-4 py-3.5 border-b border-ink-15">
                <dt className="text-[15px] text-ink-60">{k}</dt>
                <dd className="text-[15px] font-medium text-ink text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <dl>
            {placeholders.map(([k, v], i) => (
              <div key={i} className="flex justify-between gap-4 py-3.5 border-b border-ink-15">
                <dt className="text-[15px] text-ink-60">{k}</dt>
                <dd className="text-[15px] text-ink-45 text-right font-mono">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

/* ---------- SECTION 07 — PURCHASE BLOCK ---------- */
function Purchase({ onOrder, qty, setQty }: { onOrder: () => void; qty: number; setQty: (n: number) => void }) {
  const { t } = useLang()
  return (
    <section id="order" className="bg-white-soft border-t border-ink-15">
      <div className="mx-auto max-w-[1320px] px-6 md:px-10 py-20 md:py-28 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="rounded-[16px] bg-soft-green px-6 py-12 md:px-10 md:py-16">
          <PlannerStack
            front={<DailyPage className="w-full h-auto" />}
            behind={<WeeklyPage className="w-full h-auto" />}
          />
        </div>
        <div>
          <SectionLabel>{t.purchase.label}</SectionLabel>
          <h2 className="font-serif mt-4 text-[clamp(30px,4vw,40px)] leading-[1.12]">
            {t.purchase.heading}
          </h2>
          <p className="mt-4 text-[17px] leading-[1.7] text-ink-60 max-w-[30rem]">
            {t.purchase.body}
          </p>

          <div className="mt-8 flex items-baseline gap-3">
            <span className="font-serif text-[34px] text-ink">{t.purchase.price}</span>
            <span className="text-[14px] text-ink-45">{t.purchase.priceNote}</span>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-6">
            <div className="inline-flex items-center border border-ink-15 rounded-[10px]">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="px-4 py-3 text-ink hover:text-green disabled:opacity-30"
                disabled={qty <= 1}
                aria-label="Decrease quantity"
              ><IconMinus /></button>
              <span className="w-10 text-center text-[16px] font-semibold tabular-nums">{qty}</span>
              <button
                onClick={() => setQty(Math.min(9, qty + 1))}
                className="px-4 py-3 text-ink hover:text-green"
                aria-label="Increase quantity"
              ><IconPlus /></button>
            </div>
            <Button onClick={onOrder} className="px-8">{t.purchase.order}</Button>
          </div>

          <p className="mt-6 text-[14px] text-ink-45">{t.purchase.footnote}</p>
        </div>
      </div>
    </section>
  )
}

/* ---------- SECTION 08 — FAQ ---------- */
function FAQ() {
  const { t } = useLang()
  const faqs = t.faq.items
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="mx-auto max-w-[1320px] px-6 md:px-10 py-20 md:py-28">
      <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
        <div>
          <SectionLabel>{t.faq.label}</SectionLabel>
          <h2 className="font-serif mt-5 text-[clamp(30px,4vw,40px)] leading-[1.12]">
            {t.faq.heading}
          </h2>
        </div>
        <div className="border-t border-ink-15">
          {faqs.map(([q, a], i) => {
            const isOpen = open === i
            return (
              <div
                key={i}
                className={`border-b border-ink-15 px-4 -mx-4 rounded-[8px] transition-colors duration-200 ${
                  isOpen ? 'bg-cream/35' : ''
                }`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-[17px] font-medium text-ink">{q}</span>
                  <span className={`shrink-0 text-ink-60 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <IconChevron />
                  </span>
                </button>
                <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    <p className={`pb-5 text-[16px] leading-[1.7] text-ink-60 max-w-[38rem] ${a.startsWith('[') ? 'font-mono text-ink-45' : ''}`}>{a}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ---------- FOOTER ---------- */
function Footer() {
  const { t } = useLang()
  const cols = t.footer.links
  return (
    <footer className="border-t border-ink-15">
      <div className="mx-auto max-w-[1320px] px-6 md:px-10 py-14 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <Wordmark className="text-[26px]" />
          <p className="mt-4 text-[15px] text-ink-60 max-w-[22rem]">
            {t.footer.tagline}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          {cols.map(([l, h]) => (
            <a key={l} href={h} className="text-[15px] text-ink-60 hover:text-ink transition-colors">{l}</a>
          ))}
        </nav>
      </div>
      <div className="mx-auto max-w-[1320px] px-6 md:px-10 pb-10">
        <p className="text-[13px] text-ink-45">{t.footer.copyright(new Date().getFullYear())}</p>
      </div>
    </footer>
  )
}

export function Home({ onOrder, qty, setQty }: { onOrder: () => void; qty: number; setQty: (n: number) => void }) {
  return (
    <>
      <Hero onOrder={onOrder} />
      <Tension />
      <System />
      <SixtyDay />
      <Details />
      <Purchase onOrder={onOrder} qty={qty} setQty={setQty} />
      <FAQ />
      <Footer />
    </>
  )
}
