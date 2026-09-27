import type { RefObject } from 'react'
import { HudHudBird } from './HudHudBird'
import { useHudHudPresence } from './useHudHudPresence'
import { useHudHudSound } from './useHudHudSound'
import './hudhud.css'

export { HudHudBird } from './HudHudBird'

export function HudHudTrigger({ onOpen, buttonRef, lang }: {
  onOpen: () => void
  buttonRef: RefObject<HTMLButtonElement | null>
  lang: 'en' | 'bn'
}) {
  const { phase, flightRef, finishMotion, settle } = useHudHudPresence()
  const { audioRef, play } = useHudHudSound()
  return (
    <aside className="hudhud-perch" data-phase={phase} aria-label="HudHud">
      <audio ref={audioRef} src="/audio/hudhud-call.wav" preload="none" aria-hidden="true" />
      <button ref={buttonRef} type="button" className="hudhud-trigger" aria-haspopup="dialog"
        aria-controls="hudhud-dialog" aria-label={lang === 'bn' ? 'হুদহুদ AI সহকারী খুলুন' : 'Open HudHud AI assistant'}
        onFocus={settle} onClick={() => {
          settle()
          play()
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            buttonRef.current?.querySelector('.hudhud-bird')?.animate([
              { transform: 'translateY(0)' }, { transform: 'translateY(-2px) rotate(-2deg)' }, { transform: 'translateY(0)' },
            ], { duration: 220, easing: 'cubic-bezier(.2,.7,.3,1)' })
          }
          onOpen()
        }}>
        <span className="hudhud-tooltip" aria-hidden="true">{lang === 'bn' ? 'হুদহুদকে জিজ্ঞেস করুন' : 'Ask HudHud'}</span>
        <span ref={flightRef} className="hudhud-flight" onAnimationEnd={e => { if (e.target === e.currentTarget) finishMotion() }}>
          <span className="hudhud-bird"><HudHudBird /></span>
        </span>
        <svg className="hudhud-branch" viewBox="0 0 100 24" aria-hidden="true"><path d="M10 13Q49 8 91 10M76 10l7-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
    </aside>
  )
}
