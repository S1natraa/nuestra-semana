/**
 * Avatar con anillo de progreso que reacciona cuando el porcentaje sube:
 * rebote, partículas y, al llegar al 100 %, confeti y mensaje especial.
 */
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { ACCENTS } from '@/domain/constants'
import { moodLevel } from '@/domain/mood'
import { displayPercent } from '@/domain/progress'
import { originFromElement } from '@/lib/confetti'
import { useFeedback } from '@/state/feedback'
import { Avatar, type AvatarProfile } from './Avatar'

interface AvatarProgressProps {
  profile: AvatarProfile
  percentage: number
  size?: number
  /** Solo el avatar propio lanza confeti/sonido; el de la pareja solo se anima. */
  reactive?: boolean
  ring?: boolean
}

interface Particle {
  id: number
  x: number
  y: number
  glyph: string
  rotate: number
}

const GLYPHS = ['✨', '❤️', '⭐', '💫']

export function AvatarProgress({ profile, percentage, size = 96, reactive = false, ring = true }: AvatarProgressProps) {
  const controls = useAnimationControls()
  const reduceMotion = useReducedMotion()
  const feedback = useFeedback()
  const wrapper = useRef<HTMLDivElement>(null)
  const previous = useRef<number | null>(null)
  const nextParticle = useRef(0)
  const [particles, setParticles] = useState<Particle[]>([])
  const [perfect, setPerfect] = useState(false)

  const shown = displayPercent(percentage)
  const mood = moodLevel(percentage)
  const accent = ACCENTS[profile.accent]

  useEffect(() => {
    const before = previous.current
    previous.current = shown
    if (before === null || shown <= before || reduceMotion) return

    void controls.start({ scale: [1, 1.14, 0.96, 1], rotate: [0, -4, 3, 0], transition: { duration: 0.6 } })
    const burst = Array.from({ length: 6 }, (_, i) => {
      const angle = (-Math.PI / 2) + ((i - 2.5) / 2.5) * 1.1
      return {
        id: nextParticle.current++,
        x: Math.cos(angle) * size * 0.75,
        y: Math.sin(angle) * size * 0.75,
        glyph: GLYPHS[i % GLYPHS.length]!,
        rotate: (i - 3) * 18,
      }
    })
    setParticles((list) => [...list, ...burst])
    const ids = new Set(burst.map((p) => p.id))
    const timer = window.setTimeout(() => setParticles((list) => list.filter((p) => !ids.has(p.id))), 1100)

    if (shown === 100 && before < 100) {
      setPerfect(true)
      if (reactive) {
        feedback.burst(originFromElement(wrapper.current), 90)
        feedback.sound('victory')
        feedback.vibrate([30, 40, 60])
      }
      window.setTimeout(() => setPerfect(false), 3200)
    }
    return () => window.clearTimeout(timer)
  }, [shown, controls, reduceMotion, size, reactive, feedback])

  const ringSize = size + 16
  const radius = (ringSize - 6) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div ref={wrapper} className="relative grid place-items-center" style={{ width: ringSize, height: ringSize }}>
      {ring && (
        <svg width={ringSize} height={ringSize} className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={4} />
          <motion.circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke={accent.base}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - Math.min(100, shown) / 100) }}
            transition={{ type: 'spring', stiffness: 70, damping: 18 }}
          />
        </svg>
      )}
      <motion.div
        animate={controls}
        whileHover={reduceMotion ? undefined : { y: -2 }}
        style={{ filter: mood === 5 ? `drop-shadow(0 0 18px ${accent.base})` : undefined }}
      >
        <Avatar profile={profile} mood={mood} size={size} />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
        <AnimatePresence>
          {particles.map((p) => (
            <motion.span
              key={p.id}
              className="absolute text-base"
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
              animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: [0.4, 1.1, 0.8], rotate: p.rotate }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              {p.glyph}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {perfect && (
          <motion.div
            className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-honey-300 px-3 py-1 text-xs font-extrabold whitespace-nowrap text-ink shadow-soft"
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            role="status"
          >
            ¡100 %! 🎉
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
