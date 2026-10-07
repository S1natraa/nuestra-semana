/** Ruleta de castigos: solo se activa con la semana cerrada y alguien que deba girar. */
import { useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, ErrorState, Skeleton } from '@/components/feedback/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { Roulette, type RouletteSegment } from '@/components/roulette/Roulette'
import { RouletteResult } from '@/components/roulette/RouletteResult'
import { ButtonLink } from '@/components/ui/Button'
import { rouletteFor, rouletteStage } from '@/domain/calendar'
import { formatWeekRange } from '@/domain/dates'
import type { Profile, Punishment, WeekSummary } from '@/domain/types'
import type { SpinResult } from '@/services/api'
import { useFeedback } from '@/state/feedback'
import { useAcceptPunishment, useSpinRoulette } from '@/state/mutations'
import { useSession, useWeekQuery } from '@/state/queries'
import { useToast } from '@/state/toast'

export function RoulettePage() {
  const { calendar, userId, partner } = useSession()
  const active = (w: WeekSummary, id: string | undefined) => ['spin', 'accept'].includes(rouletteStage(w, id))
  const week =
    calendar.pendingRoulettes.find((w) => active(w, userId)) ??
    calendar.pendingRoulettes.find((w) => active(w, partner?.id)) ??
    (calendar.resultWeek && calendar.resultWeek.roulette.length > 0 ? calendar.resultWeek : null)

  if (!week || !partner) {
    return (
      <div>
        <PageHeader title="Ruleta" />
        <EmptyState
          icon={<Lock className="size-7 text-navy-300" />}
          title="La ruleta aparecerá cuando termine la semana."
          description="El viernes a medianoche se cierra la semana. Quien tenga el menor porcentaje girará la ruleta con los castigos que preparó su pareja."
          action={<ButtonLink to="/" variant="secondary">Volver al inicio</ButtonLink>}
        />
      </div>
    )
  }
  return <WeekRoulette week={week} partner={partner} />
}

function WeekRoulette({ week, partner }: { week: WeekSummary; partner: Profile }) {
  const { userId, me } = useSession()
  const detail = useWeekQuery(week.id)
  const myStage = rouletteStage(week, userId)
  const partnerStage = rouletteStage(week, partner.id)

  const title =
    myStage === 'spin'
      ? 'Es momento de girar la ruleta'
      : myStage === 'accept'
        ? '¡La ruleta decidió!'
        : myStage === 'done'
          ? 'Castigo registrado'
          : `La ruleta de ${partner.display_name}`

  return (
    <div>
      <PageHeader eyebrow={`Semana del ${formatWeekRange(week.week_start)}`} title={title} />
      {detail.isPending ? (
        <div className="grid place-items-center">
          <Skeleton className="aspect-square w-full max-w-[420px] rounded-full" />
        </div>
      ) : detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      ) : (
        <div className="space-y-12">
          {myStage !== 'none' && (
            <MySpin week={week} segments={segmentsFor(detail.data.punishments, userId)} partner={partner} me={me} />
          )}
          {partnerStage !== 'none' && (
            <PartnerSpin week={week} segments={segmentsFor(detail.data.punishments, partner.id)} partner={partner} />
          )}
        </div>
      )}
    </div>
  )
}

function segmentsFor(punishments: Punishment[], targetId: string): RouletteSegment[] {
  return punishments
    .filter((p) => p.target_id === targetId)
    .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1))
    .map((p) => ({ id: p.id, emoji: p.emoji, text: p.text }))
}

function MySpin({ week, segments, partner, me }: { week: WeekSummary; segments: RouletteSegment[]; partner: Profile; me: Profile }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const feedback = useFeedback()
  const spin = useSpinRoulette()
  const accept = useAcceptPunishment()
  const previous = rouletteFor(week, me.id)
  const [result, setResult] = useState<SpinResult | null>(null)
  const [landed, setLanded] = useState(Boolean(previous))
  const [spinning, setSpinning] = useState(false)

  const landedIndex = previous ? segments.findIndex((s) => s.id === previous.punishment_id) : null
  const punishment = result?.punishment ?? (previous?.punishment ? { ...previous.punishment, id: previous.punishment_id } : null)
  const accepted = Boolean(previous?.accepted_at) || accept.isSuccess

  if (segments.length < 3) {
    return <EmptyState icon="🤷" title="No hay castigos para girar" description={`${partner.display_name} no dejó castigos suficientes esta semana.`} />
  }

  return (
    <section aria-label="Tu ruleta" className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="mb-6 text-center text-lg font-semibold text-navy-200 lg:text-left">
          {accepted ? (
            <>¡Buen perdedor! <span aria-hidden>🤝</span></>
          ) : landed ? (
            'Márcalo como aceptado para registrarlo.'
          ) : (
            <>
              {me.display_name}, deberás cumplir el castigo que te toque. <span aria-hidden>🎲</span>
            </>
          )}
        </p>
        <Roulette
          segments={segments}
          landedIndex={landedIndex !== null && landedIndex >= 0 ? landedIndex : null}
          canSpin={!previous}
          onSpin={async () => {
            try {
              setSpinning(true)
              const res = await spin.mutateAsync(week.id)
              setResult(res)
              // El índice sale del id elegido por el servidor: la animación siempre coincide.
              const index = segments.findIndex((s) => s.id === res.punishment.id)
              return index >= 0 ? index : res.segment_index
            } catch (error) {
              setSpinning(false)
              toast.saveError(error)
              throw error
            }
          }}
          onLanded={() => {
            setSpinning(false)
            setLanded(true)
            feedback.celebrate()
            feedback.sound('result')
            feedback.vibrate([40, 30, 90])
            void queryClient.invalidateQueries()
          }}
        />
      </div>
      <div className="min-h-40">
        {landed && punishment ? (
          <RouletteResult
            emoji={punishment.emoji}
            text={punishment.text}
            who={null}
            accepted={accepted}
            accepting={accept.isPending}
            onAccept={() =>
              accept.mutate(week.id, {
                onSuccess: () => {
                  feedback.burst({ x: 0.5, y: 0.7 })
                  toast.success('Castigo registrado.', '¡Buen perdedor! 🤝')
                },
                onError: (error) => toast.saveError(error, () => accept.mutate(week.id)),
              })
            }
          />
        ) : spinning ? (
          <p className="text-center text-2xl font-extrabold lg:text-left" role="status">
            Girando… <span aria-hidden>🤞</span>
          </p>
        ) : (
          <p className="text-center text-navy-300 lg:text-left">Toca <strong className="text-cream-50">GIRAR</strong> cuando estés lista/o. Solo se puede girar una vez.</p>
        )}
      </div>
    </section>
  )
}

function PartnerSpin({ week, segments, partner }: { week: WeekSummary; segments: RouletteSegment[]; partner: Profile }) {
  const spin = rouletteFor(week, partner.id)
  const landedIndex = spin ? segments.findIndex((s) => s.id === spin.punishment_id) : null
  return (
    <section aria-label={`Ruleta de ${partner.display_name}`} className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div className="opacity-95">
        {segments.length >= 3 ? (
          <Roulette segments={segments} landedIndex={landedIndex !== null && landedIndex >= 0 ? landedIndex : null} canSpin={false} spinLabel="ESPERA" />
        ) : null}
      </div>
      <div>
        {spin?.punishment ? (
          <RouletteResult emoji={spin.punishment.emoji} text={spin.punishment.text} who={partner.display_name} accepted={Boolean(spin.accepted_at)} />
        ) : (
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-extrabold">{partner.display_name} debe girar la ruleta</h2>
            <p className="mt-2 text-navy-200">Estos son los castigos que preparaste. En cuanto gire, verás aquí cuál le tocó.</p>
          </div>
        )}
      </div>
    </section>
  )
}
