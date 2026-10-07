import { motion } from 'framer-motion'
import { Check, Lock, X } from 'lucide-react'
import { ProgressBar } from '@/components/progress/Progress'
import { WORK_DAYS, dateOfWeekday, formatLongDay, weekdayLetter, weekdayName } from '@/domain/dates'
import { dayCellState, goalProgress, isFlexible, type DayCellState } from '@/domain/progress'
import type { Completion, Goal, ISODate } from '@/domain/types'
import { cn } from '@/lib/browser'

interface GoalCardProps {
  goal: Goal
  completions: Completion[]
  weekStart: ISODate
  today: ISODate
  /** Solo quien es dueño puede marcar el día de hoy. */
  onToggleToday?: (done: boolean) => void
  pending?: boolean
  index?: number
}

const CELL_LABEL: Record<DayCellState, string> = {
  done: 'cumplido',
  missed: 'no cumplido',
  free: 'sin marcar (meta flexible)',
  today: 'hoy, pendiente',
  upcoming: 'próximamente',
  off: 'no programado',
}

export function GoalCard({ goal, completions, weekStart, today, onToggleToday, pending, index = 0 }: GoalCardProps) {
  const progress = goalProgress(goal, completions, weekStart)
  const flexible = isFlexible(goal)
  const percent = Math.round(progress.ratio * 100)

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="rounded-[24px] border border-white/6 bg-navy-850/80 p-4 shadow-soft sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/6 text-2xl" aria-hidden>
          {goal.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-extrabold">{goal.title}</h3>
          <p className="text-sm text-navy-300">
            {progress.done} de {goal.target_days} {goal.target_days === 1 ? 'día' : 'días'}
            {flexible && <span className="text-navy-400"> · flexible</span>}
          </p>
          {goal.description && <p className="mt-1 line-clamp-2 text-sm text-navy-200/80">{goal.description}</p>}
        </div>
        <span className={cn('text-xl font-extrabold tabular-nums', progress.complete ? 'text-mint-300' : 'text-cream-50')}>{percent}%</span>
      </div>

      <ProgressBar value={percent} label={`Progreso de ${goal.title}`} className="mt-4" height={8} />

      <ol className="mt-4 grid grid-cols-5 gap-2" aria-label={`Días de ${goal.title}`}>
        {WORK_DAYS.map((day) => {
          const state = dayCellState(goal, completions, weekStart, day, today)
          const date = dateOfWeekday(weekStart, day)
          const canToggle = Boolean(onToggleToday) && date === today && (state === 'today' || state === 'done') && !pending
          const content = (
            <>
              <span className="text-[11px] font-extrabold text-navy-300">{weekdayLetter(day)}</span>
              <span
                className={cn(
                  'grid size-9 place-items-center rounded-xl border-2 transition-colors',
                  state === 'done' && 'border-transparent bg-(--accent) text-ink',
                  state === 'missed' && 'border-coral-400/50 text-coral-300',
                  state === 'free' && 'border-white/10 text-navy-400',
                  state === 'today' && 'border-(--accent) text-(--accent)',
                  state === 'upcoming' && 'border-dashed border-white/20 text-navy-400',
                  state === 'off' && 'border-transparent bg-white/[0.03] text-navy-500',
                )}
              >
                {state === 'done' ? (
                  <Check className="size-4" strokeWidth={3.4} aria-hidden />
                ) : state === 'missed' ? (
                  <X className="size-4" strokeWidth={3} aria-hidden />
                ) : state === 'today' ? (
                  <motion.span
                    className="size-2 rounded-full bg-current"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    aria-hidden
                  />
                ) : state === 'off' ? (
                  <span aria-hidden>–</span>
                ) : state === 'free' && date < today ? (
                  <Lock className="size-3" aria-hidden />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" aria-hidden />
                )}
              </span>
            </>
          )
          const label = `${weekdayName(day)} (${formatLongDay(date)}): ${CELL_LABEL[state]}`
          return (
            <li key={day} className="flex justify-center">
              {canToggle ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={state === 'done'}
                  aria-label={`${goal.title}, hoy`}
                  onClick={() => onToggleToday?.(state !== 'done')}
                  className="focus-ring flex flex-col items-center gap-1.5 rounded-xl"
                >
                  {content}
                </button>
              ) : (
                <span className="flex flex-col items-center gap-1.5" aria-label={label} role="img">
                  {content}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </motion.article>
  )
}
