import { useEffect, useRef } from 'react'
import { useFeedback } from '@/state/feedback'

interface ConfettiEffectProps {
  /** Se dispara cada vez que cambia a un valor "verdadero" nuevo. */
  fire: string | number | boolean | null | undefined
  variant?: 'burst' | 'celebration'
  sound?: 'victory' | 'result' | 'achievement'
}

/** Confeti declarativo (respeta las preferencias y "reducir movimiento"). */
export function ConfettiEffect({ fire, variant = 'celebration', sound }: ConfettiEffectProps) {
  const feedback = useFeedback()
  const last = useRef<typeof fire>(null)
  useEffect(() => {
    if (!fire || fire === last.current) return
    last.current = fire
    const timer = window.setTimeout(() => {
      if (variant === 'celebration') feedback.celebrate()
      else feedback.burst()
      if (sound) feedback.sound(sound)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [fire, variant, sound, feedback])
  return null
}
