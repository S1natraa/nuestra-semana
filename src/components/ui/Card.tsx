import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/browser'

/**
 * Fondos distintos para distinguir de un vistazo:
 *   paper   → mis tareas (crema)
 *   navy    → información general
 *   partner → cosas de la pareja
 *   glow    → resultados y celebraciones
 *   stats   → estadísticas
 */
type Tone = 'paper' | 'navy' | 'partner' | 'glow' | 'stats' | 'outline'

const tones: Record<Tone, string> = {
  paper: 'paper-grain text-ink shadow-paper',
  navy: 'bg-navy-850/85 border border-white/6 shadow-card backdrop-blur-sm',
  partner: 'bg-linear-to-b from-navy-800/90 to-navy-850/90 border border-white/6 shadow-card',
  glow: 'bg-linear-to-br from-navy-750 via-navy-800 to-navy-850 border border-lilac-300/15 shadow-card',
  stats: 'bg-linear-to-b from-lilac-400/10 to-navy-850/80 border border-lilac-300/12 shadow-card',
  outline: 'border border-dashed border-white/15',
}

export interface CardProps extends HTMLMotionProps<'section'> {
  tone?: Tone
  padded?: boolean
}

export function Card({ tone = 'navy', padded = true, className, children, ...rest }: CardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn('relative overflow-hidden rounded-[28px]', tones[tone], padded && 'p-5 sm:p-6', className)}
      {...rest}
    >
      {children}
    </motion.section>
  )
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-[11px] font-extrabold uppercase tracking-[0.16em]', className)}>{children}</p>
}
