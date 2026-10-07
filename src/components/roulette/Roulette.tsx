/**
 * Ruleta de castigos. El índice ganador lo decide el servidor (aleatoriedad
 * criptográfica, un solo giro); la animación desacelera durante varios
 * segundos y se detiene en un punto aleatorio DENTRO de ese segmento, así que
 * el resultado visual siempre coincide con el lógico.
 */
import { animate, motion, useAnimationControls, useMotionValue, useMotionValueEvent } from 'framer-motion'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { planSpin, segmentAngle, segmentAtRotation, segmentCenter } from '@/domain/roulette'
import { cn } from '@/lib/browser'
import { useFeedback } from '@/state/feedback'

export interface RouletteSegment {
  id: string
  emoji: string
  text: string
}

interface RouletteProps {
  segments: RouletteSegment[]
  /** Índice ya elegido (giro previo): la rueda se muestra detenida ahí. */
  landedIndex?: number | null
  /** Pide el giro al servidor y devuelve el índice elegido. */
  onSpin?: () => Promise<number>
  onLanded?: (index: number) => void
  canSpin: boolean
  spinLabel?: string
}

const COLORS = ['#ffb3c9', '#a9d6ff', '#cbbcff', '#ffe08e', '#9eeccd']
const SIZE = 400
const C = SIZE / 2
const R = 184

function wedgePath(index: number, count: number): string {
  const size = segmentAngle(count)
  const a0 = ((index * size - 90) * Math.PI) / 180
  const a1 = (((index + 1) * size - 90) * Math.PI) / 180
  const x0 = C + R * Math.cos(a0)
  const y0 = C + R * Math.sin(a0)
  const x1 = C + R * Math.cos(a1)
  const y1 = C + R * Math.sin(a1)
  return `M${C} ${C} L${x0} ${y0} A${R} ${R} 0 ${size > 180 ? 1 : 0} 1 ${x1} ${y1} Z`
}

function wrap(text: string, maxChars: number, maxLines = 2): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1]!.slice(0, maxChars - 1)}…`
    return kept
  }
  return lines.map((l) => (l.length > maxChars + 2 ? `${l.slice(0, maxChars)}…` : l))
}

export function Roulette({ segments, landedIndex, onSpin, onLanded, canSpin, spinLabel = 'GIRAR' }: RouletteProps) {
  const count = segments.length
  const feedback = useFeedback()
  const rotation = useMotionValue(landedIndex != null ? -segmentCenter(landedIndex, count) : 0)
  const pointer = useAnimationControls()
  const lastSegment = useRef(segmentAtRotation(rotation.get(), count))
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'spinning' | 'landed'>(landedIndex != null ? 'landed' : 'idle')

  useEffect(() => {
    if (landedIndex != null && phase === 'idle') {
      rotation.set(-segmentCenter(landedIndex, count))
      setPhase('landed')
    }
  }, [landedIndex, count, phase, rotation])

  useMotionValueEvent(rotation, 'change', (value) => {
    if (phase !== 'spinning') return
    const current = segmentAtRotation(value, count)
    if (current !== lastSegment.current) {
      lastSegment.current = current
      feedback.sound('tick')
      void pointer.start({ rotate: [0, -22, 0], transition: { duration: 0.16 } })
    }
  })

  const spin = async () => {
    if (!onSpin || phase !== 'idle' || !canSpin) return
    setPhase('requesting')
    let index: number
    try {
      index = await onSpin()
    } catch {
      setPhase('idle')
      return
    }
    setPhase('spinning')
    feedback.sound('spin')
    feedback.vibrate(20)
    const plan = planSpin(rotation.get(), index, count)
    await animate(rotation, plan.rotation, { duration: plan.duration, ease: [0.14, 0.82, 0.22, 1] })
    setPhase('landed')
    onLanded?.(index)
  }

  const maxChars = count <= 3 ? 24 : count === 4 ? 20 : 17
  const spinning = phase === 'spinning' || phase === 'requesting'

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]">
      <div className="absolute inset-[-6%] rounded-full bg-radial from-lilac-400/25 via-blush-400/10 to-transparent blur-2xl" aria-hidden />

      <motion.svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="relative size-full drop-shadow-[0_30px_40px_rgb(2_4_16/0.6)]"
        role="img"
        aria-label={`Ruleta con ${count} castigos: ${segments.map((s) => s.text).join(', ')}`}
      >
        <circle cx={C} cy={C} r={R + 14} fill="#131c45" stroke="rgb(255 255 255 / 0.08)" strokeWidth={2} />
        <motion.g style={{ rotate: rotation, originX: '50%', originY: '50%' }}>
          {segments.map((segment, i) => {
            const center = segmentCenter(i, count)
            const lines = wrap(segment.text, maxChars, 3)
            // El texto va hacia el borde, donde el segmento es más ancho; el emoji, junto al centro.
            const firstLineRadius = 150 - (3 - lines.length) * 8
            return (
              <g key={segment.id}>
                <path d={wedgePath(i, count)} fill={COLORS[i % COLORS.length]} stroke="#0e1639" strokeWidth={3} />
                <g transform={`rotate(${center} ${C} ${C})`}>
                  <text x={C} y={C - 80} textAnchor="middle" fontSize={26} dominantBaseline="middle">
                    {segment.emoji}
                  </text>
                  {lines.map((line, li) => (
                    <text
                      key={li}
                      x={C}
                      y={C - firstLineRadius + li * 17}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={count <= 4 ? 15 : 13.5}
                      fontWeight={800}
                      fill="#111a45"
                      fontFamily="inherit"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              </g>
            )
          })}
          <circle cx={C} cy={C} r={R} fill="none" stroke="rgb(255 255 255 / 0.35)" strokeWidth={2} />
        </motion.g>
        {Array.from({ length: 24 }, (_, i) => {
          const angle = ((i * 15 - 90) * Math.PI) / 180
          return (
            <motion.circle
              key={i}
              cx={C + (R + 7) * Math.cos(angle)}
              cy={C + (R + 7) * Math.sin(angle)}
              r={3.2}
              fill={i % 2 ? '#ffe08e' : '#fffaf2'}
              animate={spinning ? { opacity: [0.25, 1, 0.25] } : { opacity: 0.75 }}
              transition={spinning ? { duration: 0.5, repeat: Infinity, delay: (i % 2) * 0.25 } : { duration: 0.3 }}
            />
          )
        })}
      </motion.svg>

      {/* Puntero */}
      <motion.div
        animate={pointer}
        className="absolute top-[-2%] left-1/2 z-10 -translate-x-1/2"
        style={{ originY: 0.15 }}
        aria-hidden
      >
        <svg width="46" height="54" viewBox="0 0 46 54">
          <path d="M23 52 L5 12 A20 20 0 0 1 41 12 Z" fill="#fffaf2" stroke="#0e1639" strokeWidth="3" />
          <circle cx="23" cy="17" r="7" fill="#ff94b4" />
        </svg>
      </motion.div>

      {/* Botón central */}
      <div className="absolute inset-0 grid place-items-center">
        <motion.button
          type="button"
          onClick={() => void spin()}
          disabled={!canSpin || phase !== 'idle'}
          whileHover={canSpin && phase === 'idle' ? { scale: 1.06 } : undefined}
          whileTap={canSpin && phase === 'idle' ? { scale: 0.94 } : undefined}
          animate={canSpin && phase === 'idle' ? { boxShadow: ['0 0 0 0 rgb(255 148 180 / 0.55)', '0 0 0 18px rgb(255 148 180 / 0)'] } : undefined}
          transition={{ boxShadow: { duration: 1.6, repeat: Infinity } }}
          className={cn(
            'focus-ring grid aspect-square w-[25%] place-items-center rounded-full border-4 border-cream-50 bg-linear-to-br from-navy-600 to-navy-900 text-sm font-black tracking-[0.14em] text-cream-50 shadow-card sm:text-base',
            'disabled:cursor-default',
          )}
          aria-label={phase === 'landed' ? 'La ruleta ya se giró' : `${spinLabel} la ruleta`}
        >
          {phase === 'requesting' ? <LoaderCircle className="size-6 animate-spin" aria-hidden /> : phase === 'landed' ? '✓' : spinLabel}
        </motion.button>
      </div>
    </div>
  )
}
