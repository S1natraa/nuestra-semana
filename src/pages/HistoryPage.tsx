/** Historial: estadísticas, evolución, logros y todas las semanas anteriores. */
import { useState } from 'react'
import { EmptyState, ErrorState, StatsSkeleton } from '@/components/feedback/States'
import { HistoryChart } from '@/components/history/HistoryChart'
import { AchievementBadge, StatsCard, WeekHistoryItem } from '@/components/history/HistoryParts'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Controls'
import { useHistoryQuery, useSession } from '@/state/queries'

export function HistoryPage() {
  const { me, partner, userId, state } = useSession()
  const history = useHistoryQuery()
  const [badgesOf, setBadgesOf] = useState<'me' | 'partner'>('me')
  const people = partner ? [me, partner] : [me]

  const badgeOwner = badgesOf === 'me' || !partner ? me : partner
  const unlocked = state.achievements.filter((a) => a.user_id === badgeOwner.id)

  return (
    <div>
      <PageHeader title="Historial" subtitle="Sus semanas, rachas y logros." />
      {history.isPending ? (
        <StatsSkeleton />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : (
        <div className="space-y-8">
          {history.data.weeks.length === 0 ? (
            <EmptyState icon="📖" title="Todavía no hay semanas anteriores." description="Cuando cierren su primera semana, aquí verán resultados, estadísticas y rachas." />
          ) : (
            <>
              <section aria-label="Estadísticas" className="grid gap-4 sm:grid-cols-2">
                {people.map((p) => (
                  <StatsCard key={p.id} profile={p} stats={history.data.stats[p.id]} isMe={p.id === userId} />
                ))}
              </section>

              <Card tone="stats">
                <h2 className="text-lg font-extrabold">Evolución semanal</h2>
                <p className="mt-0.5 mb-4 text-sm text-navy-300">Porcentaje de cumplimiento de cada semana.</p>
                <HistoryChart weeks={history.data.weeks} people={people} />
              </Card>
            </>
          )}

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Logros</h2>
                <p className="text-sm text-navy-300">
                  {unlocked.length} de {state.achievement_catalog.length} desbloqueados
                </p>
              </div>
              {partner && (
                <Segmented<'me' | 'partner'>
                  label="Logros de"
                  value={badgesOf}
                  onChange={setBadgesOf}
                  options={[
                    { value: 'me', label: 'Míos' },
                    { value: 'partner', label: partner.display_name },
                  ]}
                />
              )}
            </div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {state.achievement_catalog.map((a) => (
                <AchievementBadge key={a.code} achievement={a} unlocked={unlocked.find((u) => u.code === a.code)} />
              ))}
            </ul>
          </Card>

          {history.data.weeks.length > 0 && (
            <section aria-label="Semanas anteriores">
              <h2 className="mb-4 text-lg font-extrabold">Semanas</h2>
              <ul className="grid gap-4 lg:grid-cols-2">
                {history.data.weeks.map((week, i) => (
                  <WeekHistoryItem key={week.id} week={week} people={people} index={i} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
