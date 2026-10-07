import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/components/avatar/Avatar'
import { DailyTask } from '@/components/goals/DailyTask'
import { CircularProgress } from '@/components/progress/Progress'
import { accentStyle } from '@/components/results/WeeklyScore'
import { Card, Eyebrow } from '@/components/ui/Card'
import { WORK_DAYS, dateOfWeekday, formatLongDay, weekdayShort } from '@/domain/dates'
import { quoteOfTheDay } from '@/domain/mood'
import { todaySummary, todayTasks } from '@/domain/progress'
import type { Completion, Goal, ISODate, Profile, Weekday } from '@/domain/types'
import { cn } from '@/lib/browser'
import { useFeedback } from '@/state/feedback'
import { usePendingCompletions, useToggleCompletion } from '@/state/mutations'

interface TodayProps {
  weekId: string
  weekStart: ISODate
  today: ISODate
  goals: Goal[]
  completions: Completion[]
}

/** "HOY · Mis tareas": se marcan directamente desde el inicio. */
export function MyTodayCard({ weekId, weekStart, today, goals, completions, me }: TodayProps & { me: Profile }) {
  const toggle = useToggleCompletion(weekId)
  const pending = usePendingCompletions()
  const feedback = useFeedback()
  const tasks = todayTasks(goals, completions, today, weekStart)
  const summary = todaySummary(tasks)
  const allDone = summary.total > 0 && summary.done === summary.total
  const wasAllDone = useRef(allDone)

  useEffect(() => {
    if (allDone && !wasAllDone.current) {
      feedback.burst({ x: 0.3, y: 0.55 }, 50)
      feedback.sound('progress')
    }
    wasAllDone.current = allDone
  }, [allDone, feedback])

  return (
    <Card tone="paper" style={accentStyle(me.accent)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow className="text-ink-soft">Hoy · Mis tareas</Eyebrow>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{formatLongDay(today)}</h2>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            {summary.total === 0 ? 'Hoy no tienes tareas programadas.' : `${summary.done} de ${summary.total} completadas`}
          </p>
        </div>
        {summary.total > 0 && (
          <CircularProgress value={summary.percentage} size={72} stroke={8} label="Progreso de hoy" color="var(--accent-deep)">
            <span className="text-base font-extrabold text-ink tabular-nums">{Math.round(summary.percentage)}%</span>
          </CircularProgress>
        )}
      </div>

      {tasks.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {tasks.map((task) => (
            <li key={task.goal.id}>
              <DailyTask
                task={task}
                pending={pending.has(task.goal.id)}
                onToggle={(done) => {
                  toggle.mutate({ goalId: task.goal.id, done })
                  if (done) {
                    feedback.sound('complete')
                    feedback.vibrate(12)
                  } else {
                    feedback.sound('uncheck')
                  }
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-2xl bg-ink/[0.04] px-4 py-6 text-center text-sm font-semibold text-ink-soft">
          Día libre de metas. ¡Aprovecha para descansar! 😌
        </p>
      )}

      <AnimatePresence>
        {allDone && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 flex items-center gap-2 rounded-2xl bg-mint-400/20 px-4 py-3 text-sm font-bold text-mint-600"
            role="status"
          >
            <Sparkles className="size-4" aria-hidden /> ¡Día completo! Mañana, más.
          </motion.p>
        )}
      </AnimatePresence>

      <Link
        to="/metas"
        className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded-full text-sm font-extrabold text-ink hover:gap-2.5"
        style={{ transition: 'gap 150ms' }}
      >
        Ver semana completa <ArrowRight className="size-4" aria-hidden />
      </Link>
    </Card>
  )
}

/** Tareas de hoy de la pareja: visibles, nunca editables. */
export function PartnerTodayCard({ weekStart, today, goals, completions, partner, confirmed }: Omit<TodayProps, 'weekId'> & { partner: Profile; confirmed: boolean }) {
  const tasks = todayTasks(goals, completions, today, weekStart)
  const summary = todaySummary(tasks)
  return (
    <Card tone="partner" style={accentStyle(partner.accent)}>
      <div className="flex items-center gap-3">
        <Avatar profile={partner} size={40} decorative />
        <div className="min-w-0 flex-1">
          <Eyebrow className="text-(--accent)">Hoy · {partner.display_name}</Eyebrow>
          <p className="text-sm font-semibold text-navy-200">
            {!confirmed ? 'Todavía no configura su semana' : summary.total === 0 ? 'Sin tareas hoy' : `${summary.done} de ${summary.total} completadas`}
          </p>
        </div>
      </div>
      {confirmed && tasks.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {tasks.map((task) => (
            <li key={task.goal.id}>
              <DailyTask task={task} readOnly tone="navy" compact />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function QuoteCard({ today }: { today: ISODate }) {
  return (
    <Card tone="glow" className="bg-linear-to-br from-lilac-400/20 via-navy-800 to-blush-400/15">
      <span className="absolute -top-6 -right-2 text-[120px] leading-none font-black text-white/5" aria-hidden>
        “
      </span>
      <p className="relative text-2xl leading-snug font-extrabold tracking-tight whitespace-pre-line">{quoteOfTheDay(today)}</p>
      <p className="relative mt-3 text-sm font-semibold text-navy-300">Frase del día</p>
    </Card>
  )
}

/** Resumen compacto lunes-viernes: tareas hechas / programadas por día. */
export function WeekStrip({ weekStart, today, goals, completions, people }: { weekStart: ISODate; today: ISODate; goals: Goal[]; completions: Completion[]; people: Profile[] }) {
  const cell = (person: Profile, day: Weekday) => {
    const date = dateOfWeekday(weekStart, day)
    const scheduled = goals.filter((g) => g.user_id === person.id && g.days.includes(day))
    const done = completions.filter((c) => c.user_id === person.id && c.completed_on === date).length
    return { date, scheduled: scheduled.length, done }
  }
  return (
    <Card>
      <Eyebrow className="text-navy-300">Esta semana</Eyebrow>
      <table className="mt-3 w-full table-fixed text-center">
        <caption className="sr-only">Tareas completadas por día</caption>
        <thead>
          <tr>
            <th scope="col" className="w-12">
              <span className="sr-only">Persona</span>
            </th>
            {WORK_DAYS.map((day) => {
              const isToday = dateOfWeekday(weekStart, day) === today
              return (
                <th key={day} scope="col" className="pb-2">
                  <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-extrabold', isToday ? 'bg-cream-50 text-ink' : 'text-navy-300')}>
                    {weekdayShort(day)}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id} style={accentStyle(person.accent)}>
              <th scope="row" className="py-1.5">
                <Avatar profile={person} size={30} decorative />
                <span className="sr-only">{person.display_name}</span>
              </th>
              {WORK_DAYS.map((day) => {
                const c = cell(person, day)
                const future = c.date > today
                const complete = c.scheduled > 0 && c.done >= c.scheduled
                return (
                  <td key={day} className="py-1.5">
                    {c.scheduled === 0 ? (
                      <span className="text-sm text-navy-500" aria-label="Sin tareas">
                        –
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex min-w-9 justify-center rounded-lg px-1.5 py-1 text-xs font-extrabold tabular-nums',
                          complete ? 'bg-(--accent) text-ink' : future ? 'text-navy-400' : 'bg-white/6 text-cream-50',
                        )}
                        aria-label={`${c.done} de ${c.scheduled}`}
                      >
                        {c.done}/{c.scheduled}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
