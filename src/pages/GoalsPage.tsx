/** Metas: vista diaria ("Hoy") y vista semanal por meta ("Semana"). */
import { CalendarHeart, Lock } from 'lucide-react'
import { useState } from 'react'
import { AvatarProgress } from '@/components/avatar/AvatarProgress'
import { MotivationalMessage } from '@/components/feedback/MotivationalMessage'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/States'
import { DailyTask } from '@/components/goals/DailyTask'
import { GoalCard } from '@/components/goals/GoalCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { AnimatedNumber, CircularProgress } from '@/components/progress/Progress'
import { accentStyle } from '@/components/results/WeeklyScore'
import { ButtonLink } from '@/components/ui/Button'
import { Card, Eyebrow } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Controls'
import { isConfirmed, isClosed } from '@/domain/calendar'
import { formatLongDay, formatWeekRange } from '@/domain/dates'
import { memberProgress, todaySummary, todayTasks } from '@/domain/progress'
import type { Profile, WeekDetail, WeekSummary } from '@/domain/types'
import { useFeedback } from '@/state/feedback'
import { usePendingCompletions, useToggleCompletion } from '@/state/mutations'
import { useSession, useWeekQuery } from '@/state/queries'

type Tab = 'today' | 'week'

export function GoalsPage() {
  const { calendar, userId } = useSession()
  const [tab, setTab] = useState<Tab>(calendar.phase === 'weekday' ? 'today' : 'week')
  const weekend = calendar.phase === 'weekend'
  const nextConfirmed = isConfirmed(calendar.nextWeek, userId)
  // Fin de semana: si ya configuré la próxima, la muestro; si no, repaso la que terminó.
  const week = weekend ? (nextConfirmed ? calendar.nextWeek : calendar.currentWeek ?? calendar.nextWeek) : calendar.currentWeek
  const detail = useWeekQuery(week?.id)
  const setupPending = Boolean(calendar.setupWeek && !isConfirmed(calendar.setupWeek, userId))

  return (
    <div>
      <PageHeader
        eyebrow={week ? formatWeekRange(week.week_start) : undefined}
        title="Metas"
        actions={
          <Segmented<Tab>
            label="Vista"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'today', label: 'Hoy' },
              { value: 'week', label: 'Semana' },
            ]}
          />
        }
      />

      {setupPending && (
        <SetupPrompt sunday={calendar.weekday === 7} weekend={weekend} />
      )}

      {!week ? null : detail.isPending ? (
        <ListSkeleton rows={4} label="Cargando metas" />
      ) : detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      ) : tab === 'today' ? (
        <TodayView week={week} detail={detail.data} />
      ) : (
        <WeekView week={week} detail={detail.data} />
      )}
    </div>
  )
}

function SetupPrompt({ sunday, weekend }: { sunday: boolean; weekend: boolean }) {
  return (
    <EmptyState
      className="mb-6"
      icon="🗓️"
      title="Esta semana todavía no tiene metas."
      description={sunday ? 'Es domingo. ¡Vamos a preparar la semana!' : weekend ? 'Ya puedes preparar la próxima semana.' : 'La semana ya empezó, pero todavía puedes sumarte con los días que quedan.'}
      action={
        <ButtonLink to="/configurar" icon={<CalendarHeart className="size-5" aria-hidden />}>
          Crear metas
        </ButtonLink>
      }
    />
  )
}

// ─────────────────────────── Hoy ───────────────────────────

function TodayView({ week, detail }: { week: WeekSummary; detail: WeekDetail }) {
  const { state, me, userId, calendar } = useSession()
  const toggle = useToggleCompletion(week.id)
  const pending = usePendingCompletions()
  const feedback = useFeedback()

  if (calendar.phase === 'weekend') {
    return (
      <EmptyState
        icon="😌"
        title={`Hoy es ${calendar.weekday === 6 ? 'sábado' : 'domingo'}: día de descanso`}
        description="Las metas se cumplen de lunes a viernes. Revisa el resultado de la semana o prepara la siguiente."
        action={<ButtonLink to="/" variant="secondary">Ir al inicio</ButtonLink>}
      />
    )
  }
  if (!isConfirmed(week, userId)) return null

  const myGoals = detail.goals.filter((g) => g.user_id === userId)
  const weekly = memberProgress(myGoals, detail.completions, week.week_start)
  const tasks = todayTasks(myGoals, detail.completions, state.today, week.week_start)
  const summary = todaySummary(tasks)
  const open = tasks.filter((t) => t.state !== 'met')
  const met = tasks.filter((t) => t.state === 'met')

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr]" style={accentStyle(me.accent)}>
      <Card tone="glow" className="flex flex-col items-center text-center lg:self-start">
        <Eyebrow className="text-(--accent)">Mis tareas de hoy</Eyebrow>
        <p className="mt-1 text-lg font-extrabold">{formatLongDay(state.today)}</p>
        <div className="mt-5">
          <AvatarProgress profile={me} percentage={weekly.percentage} size={104} reactive />
        </div>
        <p className="mt-4 text-sm font-bold text-navy-300">{me.display_name} · semana</p>
        <p className="text-5xl font-extrabold tracking-tight">
          <AnimatedNumber value={Math.round(weekly.percentage)} />
          <span className="text-[0.5em] text-navy-300">%</span>
        </p>
        <MotivationalMessage percentage={weekly.percentage} className="mt-1" />
        <div className="mt-6 flex items-center gap-4 rounded-3xl bg-white/[0.04] px-5 py-4">
          <CircularProgress value={summary.percentage} size={68} stroke={8} label="Tareas de hoy" track="rgb(255 255 255 / 0.08)">
            <span className="text-sm font-extrabold tabular-nums">{Math.round(summary.percentage)}%</span>
          </CircularProgress>
          <div className="text-left">
            <p className="text-xl font-extrabold">
              {summary.done} de {summary.total}
            </p>
            <p className="text-sm text-navy-300">completadas hoy</p>
          </div>
        </div>
      </Card>

      <Card tone="paper">
        <Eyebrow className="text-ink-soft">Hoy</Eyebrow>
        {tasks.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-ink/[0.04] px-4 py-8 text-center font-semibold text-ink-soft">No tienes metas programadas para hoy. 🌿</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2.5">
              {open.map((task) => (
                <li key={task.goal.id}>
                  <DailyTask
                    task={task}
                    pending={pending.has(task.goal.id)}
                    onToggle={(done) => {
                      toggle.mutate({ goalId: task.goal.id, done })
                      feedback.sound(done ? 'complete' : 'uncheck')
                      if (done) feedback.vibrate(12)
                    }}
                  />
                </li>
              ))}
            </ul>
            {met.length > 0 && (
              <>
                <p className="mt-5 text-xs font-extrabold tracking-[0.14em] text-ink-soft uppercase">Ya cumpliste esta semana</p>
                <ul className="mt-2 space-y-2">
                  {met.map((task) => (
                    <li key={task.goal.id}>
                      <DailyTask task={task} compact />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-ink-soft">
          <Lock className="size-3.5" aria-hidden /> Los días que ya terminaron quedan bloqueados.
        </p>
      </Card>
    </div>
  )
}

// ─────────────────────────── Semana ───────────────────────────

function WeekView({ week, detail }: { week: WeekSummary; detail: WeekDetail }) {
  const { me, partner, userId, state } = useSession()
  const [whose, setWhose] = useState<'mine' | 'partner'>('mine')
  const toggle = useToggleCompletion(week.id)
  const pending = usePendingCompletions()
  const feedback = useFeedback()
  const person: Profile = whose === 'mine' || !partner ? me : partner
  const goals = detail.goals.filter((g) => g.user_id === person.id)
  const confirmed = isConfirmed(week, person.id)
  const progress = memberProgress(goals, detail.completions, week.week_start, confirmed)
  const editable = person.id === userId && week.status === 'active' && !isClosed(week)
  const upcoming = state.today < week.week_start

  return (
    <div style={accentStyle(person.accent)}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {partner && (
          <Segmented<'mine' | 'partner'>
            label="Metas de"
            value={whose}
            onChange={setWhose}
            options={[
              { value: 'mine', label: 'Mis metas' },
              { value: 'partner', label: `Metas de ${partner.display_name}` },
            ]}
          />
        )}
        {confirmed && goals.length > 0 && (
          <p className="text-sm font-bold text-navy-200">
            {Math.round(progress.percentage)}% · {progress.completed}/{progress.total} tareas
          </p>
        )}
      </div>

      {upcoming && confirmed && (
        <p className="mb-4 rounded-[20px] border border-mint-400/20 bg-mint-400/8 px-4 py-3 text-sm font-semibold text-mint-300">
          Semana lista: empieza el lunes. 🎯
        </p>
      )}
      {!confirmed ? (
        <EmptyState
          icon={person.id === userId ? '🗓️' : '⏳'}
          title={person.id === userId ? 'Aún no configuras esta semana' : `${person.display_name} todavía no configura su semana`}
          description={person.id === userId ? undefined : 'Cuando confirme sus metas las verás aquí.'}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {goals.map((goal, i) => (
            <li key={goal.id}>
              <GoalCard
                goal={goal}
                index={i}
                completions={detail.completions}
                weekStart={week.week_start}
                today={state.today}
                pending={pending.has(goal.id)}
                onToggleToday={
                  editable
                    ? (done) => {
                        toggle.mutate({ goalId: goal.id, done })
                        feedback.sound(done ? 'complete' : 'uncheck')
                      }
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
      {person.id !== userId && confirmed && (
        <p className="mt-4 flex items-center gap-2 text-sm text-navy-300">
          <Lock className="size-4" aria-hidden /> Puedes ver el progreso de {person.display_name}, pero solo cada quien marca sus tareas.
        </p>
      )}
    </div>
  )
}
