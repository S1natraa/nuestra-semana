/** Resultado semanal: ganador, perdedor, empate y desglose por meta. */
import { useParams } from 'react-router'
import { ConfettiEffect } from '@/components/feedback/ConfettiEffect'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProgressBar } from '@/components/progress/Progress'
import { WeeklyResult } from '@/components/results/WeeklyResult'
import { accentStyle } from '@/components/results/WeeklyScore'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { isClosed, rouletteStage } from '@/domain/calendar'
import { goalProgress } from '@/domain/progress'
import type { Profile, WeekDetail } from '@/domain/types'
import { useFirstTime } from '@/state/feedback'
import { useSession, useWeekQuery } from '@/state/queries'

export function ResultPage() {
  const { weekId } = useParams()
  const { calendar, me, partner, userId } = useSession()
  const id = weekId ?? calendar.resultWeek?.id
  const detail = useWeekQuery(id)
  const closedWeek = detail.data?.week
  const outcome = closedWeek?.results.find((r) => r.user_id === userId)?.outcome
  // Confeti solo la primera vez que cada persona ve su victoria (o empate).
  const celebrate = useFirstTime(closedWeek && isClosed(closedWeek) && (outcome === 'win' || outcome === 'tie') ? `won:${closedWeek.id}:${userId}` : null)

  if (!id || !partner) {
    return (
      <div>
        <PageHeader title="Resultado semanal" />
        <EmptyState icon="🏁" title="Todavía no hay resultados" description="La ruleta aparecerá cuando termine la semana." />
      </div>
    )
  }
  if (detail.isPending) return <ListSkeleton rows={3} label="Cargando resultado" />
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />

  const week = detail.data.week
  if (!isClosed(week) || week.skipped) {
    return (
      <div>
        <PageHeader title="Resultado semanal" />
        <EmptyState icon="⏳" title="Esta semana aún no termina" description="El resultado se calcula automáticamente al cerrar el viernes." />
      </div>
    )
  }

  const stage = rouletteStage(week, userId)
  const partnerStage = rouletteStage(week, partner.id)

  return (
    <div>
      <ConfettiEffect fire={celebrate} sound="victory" />
      <PageHeader title="Resultado semanal" />
      <Card tone="glow" className="py-10">
        <WeeklyResult week={week} me={me} partner={partner} />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {stage === 'spin' || stage === 'accept' ? (
            <ButtonLink to="/ruleta" size="lg" icon={<span aria-hidden>🎰</span>}>
              {stage === 'spin' ? 'Ir a la ruleta' : 'Ver mi castigo'}
            </ButtonLink>
          ) : partnerStage !== 'none' ? (
            <ButtonLink to="/ruleta" variant="secondary">
              Ver la ruleta
            </ButtonLink>
          ) : null}
          <ButtonLink to="/historial" variant="ghost">
            Ver historial
          </ButtonLink>
        </div>
      </Card>

      <h2 className="mt-10 mb-4 text-xl font-extrabold">Meta por meta</h2>
      <div className="grid gap-5 md:grid-cols-2">
        <Breakdown person={me} detail={detail.data} />
        <Breakdown person={partner} detail={detail.data} />
      </div>
    </div>
  )
}

function Breakdown({ person, detail }: { person: Profile; detail: WeekDetail }) {
  const goals = detail.goals.filter((g) => g.user_id === person.id)
  const result = detail.week.results.find((r) => r.user_id === person.id)
  return (
    <Card style={accentStyle(person.accent)}>
      <div className="flex items-baseline justify-between">
        <h3 className="font-extrabold">{person.display_name}</h3>
        <span className="text-2xl font-extrabold">{Math.round(result?.percentage ?? 0)}%</span>
      </div>
      {result && !result.participated ? (
        <p className="mt-3 text-sm text-navy-300">No configuró su semana, así que terminó con 0 %.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {goals.map((goal) => {
            const p = goalProgress(goal, detail.completions, detail.week.week_start)
            return (
              <li key={goal.id}>
                <div className="flex items-center gap-2 text-sm">
                  <span aria-hidden>{goal.icon}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{goal.title}</span>
                  <span className="font-bold text-navy-200 tabular-nums">
                    {p.done}/{p.target}
                  </span>
                </div>
                <ProgressBar value={p.ratio * 100} label={`${goal.title}: ${Math.round(p.ratio * 100)}%`} className="mt-1.5" height={6} />
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-navy-300">Cada meta pesa lo mismo en el porcentaje final.</p>
    </Card>
  )
}
