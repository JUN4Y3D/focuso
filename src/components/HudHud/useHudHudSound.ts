import { useEffect, useRef } from 'react'

/** One media element, invoked only by the launcher's native activation event. */
export function useHudHudSound() {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = .15
    const stop = () => { if (document.hidden) audio.pause() }
    document.addEventListener('visibilitychange', stop)
    return () => { audio.pause(); document.removeEventListener('visibilitychange', stop) }
  }, [])

  return {
    audioRef,
    play: () => {
      const audio = audioRef.current
      // Ignore activation while this same element is playing: never layer voices.
      if (!audio || !audio.paused) return
      audio.volume = .15
      audio.currentTime = 0
      // Playback failure must never prevent immediate access to chat.
      void audio.play().catch(() => {})
    },
  }
}
