/* Real FOCUSO planner pages — the final product layouts, shown as-is.
   These PNGs are the source of truth: rendered at their native A5 aspect
   ratio (no stretch, crop or distortion). Callers frame them with a border
   and tonal surface per the FOCUSO visual system. */
import monthlyImg from '../assets/planner/monthly.webp'
import weeklyImg from '../assets/planner/weekly.webp'
import dailyImg from '../assets/planner/daily.webp'

function PlannerImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} loading="lazy" className={`block w-full h-auto ${className}`} />
}

export function MonthlyPage({ className = '' }: { className?: string }) {
  return <PlannerImage src={monthlyImg} alt="FOCUSO monthly planning page" className={className} />
}

export function WeeklyPage({ className = '' }: { className?: string }) {
  return <PlannerImage src={weeklyImg} alt="FOCUSO weekly planning page" className={className} />
}

export function DailyPage({ className = '' }: { className?: string }) {
  return <PlannerImage src={dailyImg} alt="FOCUSO daily planning page" className={className} />
}
