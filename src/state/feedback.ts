import { useContext, useEffect, useMemo, useState } from 'react'
import { localStore, vibrate } from '@/lib/browser'
import { confettiBurst, confettiCelebration, prefersReducedMotion } from '@/lib/confetti'
import { playSound, type SoundName } from '@/lib/sound'
import { SessionContext } from './queries'

export interface Feedback {
  sound(name: SoundName): void
  burst(origin?: { x: number; y: number }, amount?: number): void
  celebrate(): void
  vibrate(pattern: number | number[]): void
  soundsEnabled: boolean
  confettiEnabled: boolean
}

/**
 * Devuelve `key` solo la primera vez que se ve en este navegador (p. ej. para
 * celebrar una victoria una sola vez aunque se abra el resultado varias veces).
 */
export function useFirstTime(key: string | null): string | null {
  const [fresh, setFresh] = useState<string | null>(null)
  useEffect(() => {
    if (!key) return
    const storageKey = `nuestra-semana:first-time:${key}`
    if (localStore.get(storageKey, false)) return
    localStore.set(storageKey, true)
    setFresh(key)
  }, [key])
  return fresh
}

/** Sonidos, confeti y vibración respetando las preferencias de la persona. */
export function useFeedback(): Feedback {
  const session = useContext(SessionContext)
  const soundsEnabled = session?.settings.sounds_enabled ?? false
  const confettiEnabled = session?.settings.confetti_enabled ?? true
  return useMemo<Feedback>(
    () => ({
      soundsEnabled,
      confettiEnabled,
      sound: (name) => {
        if (soundsEnabled) playSound(name)
      },
      burst: (origin, amount) => {
        if (confettiEnabled && !prefersReducedMotion()) confettiBurst(origin, amount)
      },
      celebrate: () => {
        if (confettiEnabled && !prefersReducedMotion()) confettiCelebration()
      },
      vibrate: (pattern) => vibrate(pattern),
    }),
    [soundsEnabled, confettiEnabled],
  )
}
