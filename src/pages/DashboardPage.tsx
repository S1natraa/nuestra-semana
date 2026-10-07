/** Inicio: la pantalla más importante. Se adapta al momento de la semana. */
import { motion } from 'framer-motion'
import { ArrowRight, CalendarHeart, CircleCheck, Hourglass, Trophy } from 'lucide-react'
import { ConfettiEffect } from '@/components/feedback/ConfettiEffect'
import { ErrorState, Skeleton } from '@/components/feedback/States'
import { WeekStatus } from '@/components/layout/WeekStatus'
import { WeeklyResult } from '@/components/results/WeeklyResult'
import { WeeklyScore } from '@/components/results/WeeklyScore'
import { ButtonLink } from '@/components/ui/Button'
import { Card, Eyebrow } from '@/components/ui/Card'
import { isConfirmed, rouletteStage } from '@/domain/calendar'
import { formatWeekRange, isoWeekday } from '@/domain/dates'
import { displayPercent, memberProgress } from '@/domain/progress'
import type { WeekSummary } from '@/domain/types'
import { firstOpenWeekday } from '@/domain/validation'
import { useFirstTime } from '@/state/feedback'
import { useSession, useWeekQuery } from '@/state/queries'
import { CorrectionApprovals, RouletteBanner } from './dashboard/Banners'
import { MyTodayCard, PartnerTodayCard, QuoteCard, WeekStrip } from './dashboard/TodayCards'

export function DashboardPage() {
  const session = useSession()
  const { calendar, me, partner, state } = session

  return (
    <div className="space-y-5 sm:space-y-6">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] font-semibold text-navy-300">
            Hola, <span className="text-cream-50">{me.display_name}</span> ✨
          </p>
          <WeekStatus week={calendar.focusWeek} calendar={calendar} meId={me.id} partnerId={partner?.id} />
        </div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-[40px] leading-[1.02] font-extrabold tracking-tight sm:text-[52px]"
        >
          Nuestra Semana
        </motion.h1>
        <p className="mt-2 text-base font-semibold text-lilac-300">{formatWeekRange(calendar.focusWeekStart)}</p>
      </header>

      {calendar.pendingRoulettes.map((week) => (
        <RouletteBanner key={week.id} week={week} />
      ))}
      <CorrectionApprovals corrections={state.corrections} />

      {calendar.phase === 'waiting-partner' || !partner ? (
        <WaitingPartner />
      ) : calendar.phase === 'weekday' ? (
        <WeekdayView />
      ) : (
        <WeekendView />
      )}
    </div>
  )
}

function WaitingPartner() {
  const { state } = useSession()
  return (
    <Card tone="glow" className="text-center">
      <p className="text-4xl" aria-hidden>
        💌
      </p>
      <h2 className="mt-3 text-2xl font-extrabold">Falta tu pareja</h2>
      <p className="mt-1 text-navy-200">Comparte el código para empezar a jugar juntos.</p>
      <p className="mt-5 font-mono text-4xl font-extrabold tracking-[0.2em] text-honey-300">{state.couple?.invite_code}</p>
      <ButtonLink to="/bienvenida" variant="cream" className="mt-6">
        Ver opciones para invitar
      </ButtonLink>
    </Card>
  )
}

// ─────────────────────────── Lunes a viernes ───────────────────────────

function WeekdayView() {
  const { calendar, me, partner, state, userId } = useSession()
  const week = calendar.currentWeek
  const detail = useWeekQuery(week?.id)

  if (!week || detail.isPending) {
    return (
      <div className="space-y-5" role="status" aria-label="Cargando la semana">
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          <Skeleton className="h-72 rounded-[28px]" />
          <Skeleton className="h-72 rounded-[28px]" />
        </div>
        <Skeleton className="h-80 rounded-[28px]" />
      </div>
    )
  }
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />

  const { goals, completions } = detail.data
  const mineConfirmed = isConfirmed(week, userId)
  const partnerConfirmed = isConfirmed(week, partner!.id)
  const myGoals = goals.filter((g) => g.user_id === userId)
  const partnerGoals = goals.filter((g) => g.user_id === partner!.id)
  const myProgress = memberProgress(myGoals, completions, week.week_start, mineConfirmed)
  const partnerProgress = memberProgress(partnerGoals, completions, week.week_start, partnerConfirmed)
  const myShown = displayPercent(myProgress.percentage)
  const partnerShown = displayPercent(partnerProgress.percentage)
  const friday = isoWeekday(state.today) === 5

  return (
    <>
      <section aria-label="Comparación de la semana" className="relative grid grid-cols-2 gap-3 sm:gap-5">
        <WeeklyScore
          profile={me}
          progress={mineConfirmed ? myProgress : null}
          isMe
          streak={state.stats[userId]?.current_streak ?? 0}
          pendingLabel="Configura tu semana"
          leading={mineConfirmed && partnerConfirmed && myShown > partnerShown}
        />
        <WeeklyScore
          profile={partner!}
          progress={partnerConfirmed ? partnerProgress : null}
          isMe={false}
          streak={state.stats[partner!.id]?.current_streak ?? 0}
          pendingLabel="Configurando su semana…"
          leading={mineConfirmed && partnerConfirmed && partnerShown > myShown}
        />
        <motion.span
          className="pointer-events-none absolute top-[5.5rem] left-1/2 z-10 grid size-11 -translate-x-1/2 place-items-center rounded-full border-4 border-navy-950 bg-cream-50 text-xs font-black tracking-wider text-ink sm:top-28 sm:size-14 sm:text-sm"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 14 }}
          aria-hidden
        >
          VS
        </motion.span>
      </section>

      {friday && mineConfirmed && (
        <p className="rounded-[20px] border border-honey-300/25 bg-honey-300/8 px-4 py-3 text-sm font-semibold text-honey-300">
          ⏳ Hoy es viernes: último día para sumar. La semana se cierra a medianoche.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          {mineConfirmed ? (
            <MyTodayCard weekId={week.id} weekStart={week.week_start} today={state.today} goals={myGoals} completions={completions} me={me} />
          ) : (
            <LateSetupCard />
          )}
        </div>
        <div className="space-y-5">
          <QuoteCard today={state.today} />
          <PartnerTodayCard
            weekStart={week.week_start}
            today={state.today}
            goals={partnerGoals}
            completions={completions}
            partner={partner!}
            confirmed={partnerConfirmed}
          />
          <WeekStrip weekStart={week.week_start} today={state.today} goals={goals} completions={completions} people={[me, partner!]} />
        </div>
      </div>
    </>
  )
}

function LateSetupCard() {
  const { calendar, state } = useSession()
  const week = calendar.setupWeek
  const remaining = week ? 5 - firstOpenWeekday(week.week_start, state.today) + 1 : 0
  return (
    <Card tone="paper" className="text-ink">
      <Eyebrow className="text-ink-soft">Tu semana</Eyebrow>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Esta semana todavía no tiene metas.</h2>
      <p className="mt-2 text-ink-soft">
        La semana ya empezó, pero aún puedes sumarte: {remaining === 1 ? 'queda 1 día' : `quedan ${remaining} días`} para cumplir tus metas.
      </p>
      <ButtonLink to="/configurar" className="mt-5" icon={<CalendarHeart className="size-5" aria-hidden />}>
        Configurar ahora
      </ButtonLink>
    </Card>
  )
}

// ─────────────────────────── Fin de semana ───────────────────────────

function WeekendView() {
  const { calendar } = useSession()
  const sunday = calendar.weekday === 7
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {sunday ? (
        <>
          <SetupCallout />
          <ResultCard />
        </>
      ) : (
        <>
          <ResultCard />
          <SetupCallout />
        </>
      )}
    </div>
  )
}

function SetupCallout() {
  const { calendar, userId, partner } = useSession()
  const week = calendar.setupWeek ?? calendar.nextWeek
  const mine = isConfirmed(week, userId)
  const theirs = isConfirmed(week, partner?.id)
  const sunday = calendar.weekday === 7

  if (mine && theirs) {
    return (
      <Card tone="glow" className="flex flex-col justify-center text-center">
        <p className="text-5xl" aria-hidden>
          💞
        </p>
        <h2 className="mt-3 text-2xl font-extrabold">Los dos están listos.</h2>
        <p className="mt-1 text-navy-200">Nos vemos el lunes.</p>
      </Card>
    )
  }
  if (mine) {
    return (
      <Card tone="glow" className="flex flex-col justify-center">
        <CircleCheck className="size-8 text-mint-300" aria-hidden />
        <h2 className="mt-3 text-2xl font-extrabold">Tu semana está lista 🎯</h2>
        <p className="mt-1 flex items-center gap-2 text-navy-200">
          <Hourglass className="size-4" aria-hidden /> Esperando a que {partner?.display_name} prepare la suya…
        </p>
      </Card>
    )
  }
  return (
    <Card tone="paper" className="relative overflow-hidden">
      <motion.span
        className="absolute -top-4 -right-3 text-7xl opacity-90"
        animate={{ rotate: [0, 8, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
        aria-hidden
      >
        ❤️
      </motion.span>
      <Eyebrow className="text-ink-soft">{sunday ? 'Es domingo' : 'Próxima semana'}</Eyebrow>
      <h2 className="mt-2 max-w-sm text-2xl leading-tight font-extrabold tracking-tight text-ink sm:text-3xl">
        {sunday ? '¡Es hora de preparar nuestra próxima semana! ❤️' : 'Ya pueden preparar la próxima semana'}
      </h2>
      <p className="mt-2 text-ink-soft">Define tus metas y prepara los castigos.</p>
      {theirs && <p className="mt-2 text-sm font-bold text-mint-600">✓ {partner?.display_name} ya está lista/o.</p>}
      <ButtonLink to="/configurar" size="lg" className="mt-6" icon={<CalendarHeart className="size-5" aria-hidden />}>
        Configurar mi semana
      </ButtonLink>
    </Card>
  )
}

function ResultCard() {
  const { calendar, partner } = useSession()
  const week = calendar.resultWeek
  if (!week || !partner) {
    return (
      <Card className="flex flex-col justify-center text-center">
        <Trophy className="mx-auto size-8 text-navy-400" aria-hidden />
        <h2 className="mt-3 text-xl font-extrabold">Aún no hay resultados</h2>
        <p className="mt-1 text-sm text-navy-300">El primer resultado aparecerá al cerrar su primera semana.</p>
      </Card>
    )
  }
  return <ResultCardBody week={week} />
}

function ResultCardBody({ week }: { week: WeekSummary }) {
  const { me, partner, userId } = useSession()
  const stage = rouletteStage(week, userId)
  const partnerStage = rouletteStage(week, partner!.id)
  const outcome = week.results.find((r) => r.user_id === userId)?.outcome
  const celebrate = useFirstTime(outcome === 'win' || outcome === 'tie' ? `won:${week.id}:${userId}` : null)
  return (
    <Card tone="glow">
      <ConfettiEffect fire={celebrate} sound="victory" />
      <Eyebrow className="text-center text-honey-300">Resultado semanal</Eyebrow>
      <div className="mt-4">
        <WeeklyResult week={week} me={me} partner={partner!} compact />
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {stage === 'spin' || stage === 'accept' ? (
          <ButtonLink to="/ruleta" size="lg" icon={<span aria-hidden>🎰</span>}>
            {stage === 'spin' ? 'Girar la ruleta' : 'Ver mi castigo'}
          </ButtonLink>
        ) : partnerStage !== 'none' ? (
          <ButtonLink to="/ruleta" variant="secondary">
            Ver la ruleta
          </ButtonLink>
        ) : null}
        <ButtonLink to={`/resultado/${week.id}`} variant="ghost" icon={<ArrowRight className="size-4" aria-hidden />}>
          Ver detalle
        </ButtonLink>
      </div>
    </Card>
  )
}
