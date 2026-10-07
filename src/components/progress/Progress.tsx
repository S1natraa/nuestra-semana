import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/browser'

// ─────────────────────────── Número animado ───────────────────────────

/** Cuenta de un valor al siguiente (p. ej. 72 → 76). */
export function AnimatedNumber({ value, className, suffix = '' }: { value: number; className?: string; suffix?: string }) {
  const reduce = useReducedMotion()
  const motionValue = useMotionValue(value)
  const [display, setDisplay] = useState(Math.round(value))

  useEffect(() => {
    if (reduce) {
      motionValue.set(value)
      setDisplay(Math.round(value))
      return
    }
    const controls = animate(motionValue, value, {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    })
    return () => controls.stop()
  }, [value, reduce, motionValue])

  return (
    <span className={cn('tabular-nums', className)}>
      {display}
      {suffix}
    </span>
  )
}

// ─────────────────────────── Barra de progreso ───────────────────────────

interface ProgressBarProps {
  value: number
  label: string
  className?: string
  /** Color de relleno (CSS). Por defecto el acento del contenedor. */
  color?: string
  track?: string
  height?: number
}

export function ProgressBar({ value, label, className, color = 'var(--accent, #ff94b4)', track = 'rgb(255 255 255 / 0.08)', height = 12 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn('relative w-full overflow-hidden rounded-full', className)}
      style={{ height, background: track }}
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          background: `linear-gradient(90deg, color-mix(in oklab, ${color} 78%, white) 0%, ${color} 100%)`,
          boxShadow: `0 0 18px -2px ${color}`,
        }}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 0.9 }}
      >
        <span className="absolute inset-0 rounded-full bg-linear-to-b from-white/35 to-transparent" aria-hidden />
      </motion.div>
    </div>
  )
}

// ─────────────────────────── Progreso circular ───────────────────────────

interface CircularProgressProps {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  label: string
  children?: React.ReactNode
}

export function CircularProgress({ value, size = 88, stroke = 9, color = 'var(--accent, #ff94b4)', track = 'rgb(17 26 69 / 0.1)', label, children }: CircularProgressProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = useMotionValue(0)
  const dashOffset = useTransform(progress, (p) => circumference * (1 - p / 100))

  useEffect(() => {
    const controls = animate(progress, Math.max(0, Math.min(100, value)), { type: 'spring', stiffness: 80, damping: 18 })
    return () => controls.stop()
  }, [value, progress])

  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
