import { useState, type ReactNode } from 'react'
import { Button, SectionLabel, IconArrow, IconChevron, IconMinus, IconPlus, Wordmark } from './primitives'
import { MonthlyPage, WeeklyPage, DailyPage } from './PlannerPages'
import { useLang } from '../i18n'

function PlannerStack({ front, behind, className = '' }: { front: ReactNode; behind: ReactNode; className?: string }) {
  return <div className={`relative mx-auto w-full max-w-[320px] ${className}`}><div className="absolute right-[-8%] top-[6%] w-[84%] rotate-[3.5deg] overflow-hidden rounded-[8px] border border-ink-15 bg-white opacity-70">{behind}</div><div className="relative overflow-hidden rounded-[8px] border border-ink-15 bg-white shadow-[0_8px_18px_rgba(40,52,46,0.10)]">{front}</div></div>
}

function Hero({ onOrder }: { onOrder: () => void }) {
  const { t } = useLang()
  return <section className="home-hero focuso-container pb-16 pt-10 md:pb-24 md:pt-14"><div className="grid items-center gap-12 lg:grid-cols-[0.96fr_0.84fr] lg:gap-24"><div className="max-w-[34rem] animate-fade"><SectionLabel>{t.hero.label}</SectionLabel><h1 className="font-serif mt-5 text-[clamp(42px,5.3vw,68px)] leading-[1.02] tracking-[-0.035em] text-ink">{t.hero.tagline}</h1><p className="font-serif mt-4 text-[clamp(19px,2.1vw,25px)] italic leading-[1.25] text-green">{t.hero.title1} {t.hero.title2}</p><p className="mt-5 max-w-[31rem] text-[15px] leading-[1.7] text-ink-60 md:text-[16px]">{t.hero.body}</p><div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3"><Button onClick={onOrder} className="focuso-button px-5 py-3 text-[14px]">{t.hero.order}</Button><a href="#inside" className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink transition-colors hover:text-green">{t.hero.explore} <IconArrow className="h-4 w-4" /></a></div></div><div className="relative mx-auto w-full max-w-[430px]"><div className="rounded-[13px] bg-soft-green p-8 sm:p-11"><PlannerStack front={<DailyPage />} behind={<MonthlyPage />} /></div><div className="hero-plaque absolute -bottom-3 left-0 flex rounded-[6px] border border-[#dfd9ac] bg-cream px-3 py-2.5 shadow-[0_4px_8px_rgba(40,52,46,0.05)] sm:-left-2">{t.hero.stats.map(([stat, label]) => <div key={label} className="border-r border-[#d9d2a1] px-3 last:border-0 first:pl-0 last:pr-0"><span className="block font-serif text-[16px] leading-none text-deep">{stat}</span><span className="mt-1 block text-[9px] leading-none text-ink-60">{label}</span></div>)}</div></div></div></section>
}

function Problem() {
  const { t } = useLang()
  return <section className="border-y border-ink-15"><div className="focuso-container py-20 text-center md:py-28"><h2 className="mx-auto max-w-[42rem] font-serif text-[clamp(29px,3.7vw,46px)] leading-[1.08] tracking-[-0.025em]">{t.tension.heading}</h2><p className="mx-auto mt-5 max-w-[39rem] text-[14px] leading-[1.75] text-ink-60 md:text-[15px]">{t.tension.body1}</p></div></section>
}

function System() {
  const { t } = useLang(); const pages = [MonthlyPage, WeeklyPage, DailyPage]
  return <section id="how" className="focuso-container py-20 md:py-28"><div className="max-w-[38rem]"><SectionLabel>{t.system.label}</SectionLabel><h2 className="font-serif mt-4 text-[clamp(30px,3.8vw,46px)] leading-[1.08] tracking-[-0.025em]">{t.system.heading}</h2><p className="mt-5 text-[14px] leading-[1.75] text-ink-60 md:text-[15px]">{t.system.body}</p></div><div id="inside" className="planner-grid mt-12 grid gap-9 md:grid-cols-3 md:gap-7">{t.system.steps.map((step, index) => { const Page = pages[index]; return <div key={step.label} className="relative"><div className="rounded-[8px] border border-ink-15 bg-white p-3 shadow-[0_7px_16px_rgba(40,52,46,0.08)]"><div className="overflow-hidden rounded-[4px] border border-ink-15"><Page /></div></div>{index < 2 && <IconArrow className="absolute right-[-28px] top-[42%] hidden h-5 w-5 text-ink-45 md:block" />}<div className="mt-4 flex gap-2.5"><span className="text-[11px] font-semibold text-green">0{index + 1}</span><div><h3 className="text-[14px] font-semibold text-ink">{step.label}</h3><p className="mt-1 text-[12px] leading-[1.55] text-ink-60">{step.body}</p></div></div></div>})}</div></section>
}

function HabitGrowth() {
  const { t } = useLang()
  return <section className="home-habit bg-soft-green/80"><div className="focuso-container grid items-center gap-12 py-20 md:grid-cols-[0.9fr_1.1fr] md:py-24 lg:gap-24"><div className="mx-auto w-full max-w-[300px] rounded-[8px] border border-ink-15 bg-white p-3 shadow-[0_8px_18px_rgba(40,52,46,0.10)]"><div className="overflow-hidden rounded-[4px] border border-ink-15"><WeeklyPage /></div></div><div className="max-w-[31rem]"><SectionLabel>{t.habitTracker.label}</SectionLabel><h2 className="font-serif mt-4 text-[clamp(30px,3.6vw,43px)] leading-[1.08] tracking-[-0.025em]">{t.habitTracker.heading}</h2><p className="mt-5 text-[14px] leading-[1.75] text-ink-60 md:text-[15px]">{t.habitTracker.body}</p><p className="habit-highlight mt-6 rounded-[5px] border-l-[3px] border-deep bg-cream px-4 py-3 font-serif text-[13px] font-semibold leading-[1.45] text-deep">{t.habitTracker.compound}</p></div></div></section>
}

function SixtyDay() {
  const { t } = useLang()
  return <section className="focuso-container py-20 md:py-28"><div className="sixty-panel mx-auto max-w-[760px] rounded-[12px] border border-[#e6dfb5] bg-cream px-7 py-14 text-center md:px-14 md:py-16"><SectionLabel>{t.sixtyDay.label}</SectionLabel><h2 className="font-serif mt-4 text-[clamp(30px,3.7vw,45px)] leading-[1.08] tracking-[-0.025em] text-deep">{t.sixtyDay.heading}</h2><p className="mx-auto mt-5 max-w-[35rem] text-[14px] leading-[1.75] text-ink-60 md:text-[15px]">{t.sixtyDay.body}</p></div></section>
}

function Purchase({ onOrder, qty, setQty }: { onOrder: () => void; qty: number; setQty: (n: number) => void }) {
  const { t } = useLang(); const details = t.details.confirmed
  return <section id="order" className="home-order border-t border-ink-15"><div className="focuso-container grid items-center gap-14 py-20 md:grid-cols-[0.92fr_1.08fr] md:py-28 lg:gap-24"><div className="rounded-[9px] border border-ink-15 bg-white p-8 sm:p-11"><PlannerStack front={<DailyPage />} behind={<WeeklyPage />} /></div><div className="max-w-[34rem]"><SectionLabel>{t.purchase.label}</SectionLabel><h2 className="font-serif mt-4 text-[clamp(30px,3.7vw,44px)] leading-[1.08] tracking-[-0.025em]">{t.details.heading}</h2><p className="mt-4 text-[14px] leading-[1.75] text-ink-60 md:text-[15px]">{t.purchase.body}</p><dl className="mt-6 border-t border-ink-15">{details.slice(0, 5).map(([label, value]) => <div key={label} className="flex items-center justify-between gap-5 border-b border-ink-15 py-2 text-[12px]"><dt className="text-ink-60">{label}</dt><dd className="font-medium text-ink">{value}</dd></div>)}</dl><div className="mt-7 flex items-end gap-3"><span className="font-serif text-[32px] leading-none">{t.purchase.price}</span><span className="pb-1 text-[11px] text-ink-45">{t.purchase.priceNote}</span></div><div className="mt-5 flex flex-wrap items-center gap-4"><div className="quantity-control inline-flex h-[39px] items-center rounded-[5px] border border-ink-15 bg-white"><button onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} className="px-3 text-ink transition hover:text-green disabled:opacity-30" aria-label="Decrease quantity"><IconMinus className="h-3.5 w-3.5" /></button><span className="w-7 text-center text-[13px] font-semibold tabular-nums">{qty}</span><button onClick={() => setQty(Math.min(9, qty + 1))} disabled={qty >= 9} className="px-3 text-ink transition hover:text-green" aria-label="Increase quantity"><IconPlus className="h-3.5 w-3.5" /></button></div><Button onClick={onOrder} className="focuso-button px-5 py-2.5 text-[13px]">{t.purchase.order}</Button></div><p className="mt-4 text-[10px] text-ink-45">{t.purchase.footnote}</p></div></div></section>
}

function FAQ() {
  const { t } = useLang(); const [open, setOpen] = useState<number | null>(null)
  return <section id="faq" className="home-faq border-t border-ink-15">
    <div className="focuso-container grid gap-10 py-20 md:grid-cols-[0.74fr_1.26fr] md:py-24 lg:gap-20">
      <div className="faq-intro"><SectionLabel>{t.faq.label}</SectionLabel><h2 className="font-serif mt-4 max-w-[18rem] text-[clamp(29px,3.6vw,43px)] leading-[1.08] tracking-[-0.025em]">{t.faq.heading}</h2></div>
      <div className="faq-list">{t.faq.items.map(([question, answer], index) => {
        const isOpen = open === index
        return <div key={question} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
          <button onClick={() => setOpen(isOpen ? null : index)} className="faq-question" id={`faq-question-${index}`} aria-expanded={isOpen} aria-controls={`faq-answer-${index}`}>
            <span className="faq-question-number" aria-hidden="true">0{index + 1}</span>
            <span className="faq-question-text">{question}</span>
            <span className="faq-chevron" aria-hidden="true"><IconChevron className={`h-4 w-4 ${isOpen ? 'rotate-180' : ''}`} /></span>
          </button>
          <div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`} aria-hidden={!isOpen} className={`faq-answer ${isOpen ? 'is-open' : ''}`}><div><p>{answer}</p></div></div>
        </div>
      })}</div>
    </div>
  </section>
}

function Footer() { const { t } = useLang(); return <footer className="home-footer border-t border-ink-15 bg-white-soft"><div className="focuso-container py-12"><div className="flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><Wordmark className="text-[19px]" /><p className="mt-3 max-w-[16rem] text-[11px] leading-[1.65] text-ink-60">{t.footer.tagline}</p></div><nav className="flex flex-wrap gap-x-6 gap-y-2">{t.footer.links.map(([label, href]) => <a key={label} href={href} className="text-[10px] text-ink-60 transition hover:text-ink">{label}</a>)}</nav></div><p className="mt-8 text-[9px] text-ink-45">{t.footer.copyright(new Date().getFullYear())}</p></div></footer> }

export function Home({ onOrder, qty, setQty }: { onOrder: () => void; qty: number; setQty: (n: number) => void }) { return <div className="focuso-home"><Hero onOrder={onOrder} /><Problem /><System /><HabitGrowth /><SixtyDay /><Purchase onOrder={onOrder} qty={qty} setQty={setQty} /><FAQ /><Footer /></div> }
