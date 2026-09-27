import { useEffect, useRef, useState } from 'react'

export type HudHudPresence = 'waiting' | 'flying' | 'landing' | 'idle'
// Document lifetime only: route remounts do not replay; every browser reload does.
let arrivalStarted = false

export function useHudHudPresence() {
  const flightRef = useRef<HTMLSpanElement>(null)
  const [phase, setPhase] = useState<HudHudPresence>(() =>
    arrivalStarted || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'idle' : 'waiting'
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    if (arrivalStarted || media.matches) { arrivalStarted = true; setPhase('idle') }
    else {
      // Two frames allow layout to settle, without the old deliberate delay.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          arrivalStarted = true
          setPhase(current => current === 'waiting' && !media.matches ? 'flying' : 'idle')
        })
      })
    }
    const reduceMotion = () => { if (media.matches) { arrivalStarted = true; setPhase('idle') } }
    media.addEventListener('change', reduceMotion)
    return () => { cancelAnimationFrame(frame); media.removeEventListener('change', reduceMotion) }
  }, [])

  useEffect(() => {
    const bird = flightRef.current
    if (phase !== 'flying' || !bird) return
    // Measure the untransformed perch, not a viewport-specific destination.
    const perch = bird.parentElement!.getBoundingClientRect()
    const startX = -perch.right - 24
    const rise = Math.min(135, window.innerHeight * .22)
    const frames = Array.from({ length: 81 }, (_, index) => {
      const t = index / 80
      const u = 1 - t
      // Bezier travel plus two tapered arcs; all offsets end exactly at the perch.
      const x = u ** 3 * startX + 3 * u ** 2 * t * startX * .72 + 3 * u * t ** 2 * startX * .08
      const flare = Math.sin(Math.PI * Math.max(0, (t - .7) / .3)) * 10
      const arc = Math.sin(3 * Math.PI * t) * Math.sin(Math.PI * t) * rise * .52
      const y = u ** 3 * -35 + 3 * u ** 2 * t * -rise + 3 * u * t ** 2 * -rise * .7 - t ** 3 * 4 - arc - flare
      const pitch = -9 * Math.sin(3 * Math.PI * t) * Math.sin(Math.PI * t)
      return { offset: t, transform: `translate(${x}px, ${y}px) rotate(${pitch}deg)` }
    })
    const flight = bird.animate(frames, { duration: 3200, easing: 'cubic-bezier(.32,.08,.22,1)', fill: 'forwards' })
    flight.onfinish = () => setPhase(current => current === 'flying' ? 'landing' : current)
    // A resize changes the target coordinate system; settle safely at the new perch.
    const resize = () => setPhase('idle')
    window.addEventListener('resize', resize)
    return () => { flight.cancel(); window.removeEventListener('resize', resize) }
  }, [phase])

  return {
    phase,
    flightRef,
    finishMotion: () => setPhase(current => current === 'flying' ? 'landing' : 'idle'),
    settle: () => { arrivalStarted = true; setPhase('idle') },
  }
}
