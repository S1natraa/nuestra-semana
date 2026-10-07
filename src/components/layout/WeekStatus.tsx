import { motion } from 'framer-motion'
import { WEEK_STATUS_LABEL, isConfirmed, type Calendar } from '@/domain/calendar'
import type { WeekSummary } from '@/domain/types'
import { cn } from '@/lib/browser'

type Tone = 'lilac' | 'mint' | 'honey' | 'blush' | 'muted'

const TONES: Record<Tone, string> = {
  lilac: 'bg-lilac-400/15 text-lilac-300',
  mint: 'bg-mint-400/15 text-mint-300',
  honey: 'bg-honey-300/15 text-honey-300',
  blush: 'bg-blush-400/15 text-blush-300',
  muted: 'bg-white/8 text-navy-200',
}

export function describeWeek(week: WeekSummary | null, calendar: Calendar, partnerId?: string, meId?: string): { label: string; tone: Tone; live: boolean } {
  if (calendar.phase === 'waiting-partner') return { label: 'Esperando a tu pareja', tone: 'muted', live: false }
  if (!week) return { label: calendar.phase === 'weekend' ? 'Preparación' : 'Sin configurar', tone: 'lilac', live: false }
  const started = calendar.today >= week.week_start
  switch (week.status) {
    case 'setup':
      return { label: WEEK_STATUS_LABEL.setup, tone: 'lilac', live: false }
    case 'active':
      if (!started) {
        const both = isConfirmed(week, meId) && isConfirmed(week, partnerId)
        return both ? { label: 'Lista para el lunes', tone: 'mint', live: false } : { label: WEEK_STATUS_LABEL.setup, tone: 'lilac', live: false }
      }
      return { label: WEEK_STATUS_LABEL.active, tone: 'mint', live: true }
    case 'closing':
      return { label: WEEK_STATUS_LABEL.closing, tone: 'honey', live: true }
    case 'result':
      return { label: WEEK_STATUS_LABEL.result, tone: 'honey', live: false }
    case 'punishment':
      return { label: WEEK_STATUS_LABEL.punishment, tone: 'blush', live: false }
    case 'completed':
      return { label: week.skipped ? 'Semana sin jugar' : WEEK_STATUS_LABEL.completed, tone: 'muted', live: false }
  }
}

export function WeekStatus({ week, calendar, partnerId, meId, className }: { week: WeekSummary | null; calendar: Calendar; partnerId?: string; meId?: string; className?: string }) {
  const { label, tone, live } = describeWeek(week, calendar, partnerId, meId)
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold tracking-[0.12em] uppercase', TONES[tone], className)}
    >
      <span className="relative flex size-2" aria-hidden>
        {live && (
          <motion.span
            className="absolute inline-flex size-full rounded-full bg-current opacity-60"
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        )}
        <span className="relative inline-flex size-2 rounded-full bg-current" />
      </span>
      <span className="sr-only">Estado de la semana: </span>
      {label}
    </span>
  )
}
