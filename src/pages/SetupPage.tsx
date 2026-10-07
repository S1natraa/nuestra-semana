/**
 * Configuración de la semana (domingo): metas → castigos → resumen.
 * Cada paso se guarda en la base de datos; además, lo que se está editando
 * se respalda en este navegador para no perderlo si algo falla o se recarga.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CircleCheck, EyeOff, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/States'
import { GoalEditor, newGoalDraft } from '@/components/goals/GoalEditor'
import { PageHeader } from '@/components/layout/PageHeader'
import { PunishmentEditor } from '@/components/punishments/Punishments'
import { accentStyle } from '@/components/results/WeeklyScore'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { isConfirmed } from '@/domain/calendar'
import { GOAL_SUGGESTIONS, PUNISHMENT_SUGGESTIONS } from '@/domain/constants'
import { WORK_DAYS, formatWeekRange, weekdayLetter } from '@/domain/dates'
import { isFlexible } from '@/domain/progress'
import type { GoalDraft, PunishmentDraft, WeekDetail, WeekSummary } from '@/domain/types'
import { LIMITS, firstOpenWeekday, validateGoals, validatePunishments } from '@/domain/validation'
import { cn, localStore } from '@/lib/browser'
import { errorMessage } from '@/services/errors'
import { useFeedback } from '@/state/feedback'
import { useConfirmSetup, useSaveGoals, useSavePunishments } from '@/state/mutations'
import { useSession, useWeekQuery } from '@/state/queries'
import { useToast } from '@/state/toast'

type Step = 1 | 2 | 3

export function SetupPage() {
  const { calendar, userId, partner } = useSession()
  const week = calendar.setupWeek
  const detail = useWeekQuery(week?.id)

  if (!partner) {
    return <EmptyState icon="💌" title="Falta tu pareja" description="Cuando se una podrán configurar la semana." action={<ButtonLink to="/bienvenida">Invitar</ButtonLink>} />
  }
  if (!week) {
    const running = calendar.phase === 'weekday' && isConfirmed(calendar.currentWeek, userId)
    return (
      <EmptyState
        icon={running ? '🚀' : '🗓️'}
        title={running ? 'Tu semana ya está en marcha' : 'Todavía no hay semana para configurar'}
        description={running ? 'Las metas no se pueden cambiar una vez que la semana comenzó.' : 'La configuración se abre el fin de semana.'}
        action={<ButtonLink to={running ? '/metas' : '/'}>{running ? 'Ver mis metas' : 'Ir al inicio'}</ButtonLink>}
      />
    )
  }
  if (isConfirmed(week, userId)) return <ConfirmedSummary week={week} />
  if (detail.isPending) return <ListSkeleton rows={5} label="Cargando tu configuración" />
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
  return <SetupWizard week={week} detail={detail.data} />
}

interface Draft {
  step: Step
  goals: GoalDraft[]
  punishments: PunishmentDraft[]
  dirty: boolean
}

function emptyPunishments(): PunishmentDraft[] {
  return Array.from({ length: LIMITS.minPunishments }, (_, i) => ({ key: crypto.randomUUID(), text: '', emoji: ['🍕', '🍳', '🎬'][i]! }))
}

function SetupWizard({ week, detail }: { week: WeekSummary; detail: WeekDetail }) {
  const { userId, partner, state, me } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const feedback = useFeedback()
  const saveGoals = useSaveGoals()
  const savePunishments = useSavePunishments()
  const confirmSetup = useConfirmSetup()
  const storageKey = `nuestra-semana:setup-draft:${userId}:${week.id}`
  const firstOpenDay = firstOpenWeekday(week.week_start, state.today)

  const [draft, setDraft] = useState<Draft>(() => {
    const local = localStore.get<Draft | null>(storageKey, null)
    if (local?.dirty) return local
    const goals: GoalDraft[] = detail.goals
      .filter((g) => g.user_id === userId)
      .map((g) => ({
        key: g.id,
        title: g.title,
        description: g.description ?? '',
        icon: g.icon,
        target_days: g.target_days,
        days: g.days,
        flexible: isFlexible(g),
      }))
    const punishments: PunishmentDraft[] = detail.punishments
      .filter((p) => p.author_id === userId)
      .map((p) => ({ key: p.id, text: p.text, emoji: p.emoji }))
    return {
      step: goals.length > 0 && punishments.length >= LIMITS.minPunishments ? 3 : goals.length > 0 ? 2 : 1,
      goals,
      punishments: punishments.length ? punishments : emptyPunishments(),
      dirty: false,
    }
  })
  const [editing, setEditing] = useState<GoalDraft | 'new' | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null)

  useEffect(() => {
    localStore.set(storageKey, draft)
  }, [draft, storageKey])

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch, dirty: true }))
  const goTo = (step: Step) => {
    setShowErrors(false)
    setError(null)
    setDraft((d) => ({ ...d, step }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goalsError = validateGoals(draft.goals, firstOpenDay)
  const punishmentsError = validatePunishments(draft.punishments)
  const totalDays = draft.goals.reduce((sum, g) => sum + g.target_days, 0)

  const submitGoals = async () => {
    setShowErrors(true)
    if (goalsError) return
    try {
      await saveGoals.mutateAsync({ weekId: week.id, goals: draft.goals })
      setDraft((d) => ({ ...d, dirty: false }))
      goTo(2)
    } catch (e) {
      setError({ message: errorMessage(e), retry: () => void submitGoals() })
    }
  }

  const submitPunishments = async () => {
    setShowErrors(true)
    if (punishmentsError) return
    try {
      await savePunishments.mutateAsync({ weekId: week.id, items: draft.punishments })
      setDraft((d) => ({ ...d, dirty: false }))
      goTo(3)
    } catch (e) {
      setError({ message: errorMessage(e), retry: () => void submitPunishments() })
    }
  }

  const start = async () => {
    setError(null)
    try {
      // Por si hubo cambios sin guardar (p. ej. tras recargar), se guarda todo antes de confirmar.
      if (draft.dirty) {
        await saveGoals.mutateAsync({ weekId: week.id, goals: draft.goals })
        await savePunishments.mutateAsync({ weekId: week.id, items: draft.punishments })
      }
      const result = await confirmSetup.mutateAsync(week.id)
      localStore.remove(storageKey)
      feedback.celebrate()
      feedback.sound('victory')
      toast.success(result.both_ready ? '¡Los dos están listos! 💞' : '¡Tu semana está lista! 🎯', result.both_ready ? 'Nos vemos el lunes.' : `Falta que ${partner?.display_name} confirme la suya.`)
      navigate('/', { replace: true })
    } catch (e) {
      setError({ message: errorMessage(e), retry: () => void start() })
    }
  }

  const saving = saveGoals.isPending || savePunishments.isPending || confirmSetup.isPending

  return (
    <div style={accentStyle(me.accent)}>
      <Stepper step={draft.step} />

      {firstOpenDay > 1 && (
        <p className="mb-5 rounded-[20px] border border-honey-300/25 bg-honey-300/8 px-4 py-3 text-sm font-semibold text-honey-300">
          La semana ya empezó: tus metas solo pueden usar los días que quedan (desde el {WORK_DAYS.filter((d) => d >= firstOpenDay).map(weekdayLetter).join(', ')}).
        </p>
      )}

      <div>
        {draft.step === 1 && (
          <motion.section key="goals" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}>
            <PageHeader eyebrow={formatWeekRange(week.week_start)} title="Configura tus metas de la semana" subtitle="Elige qué quieres conseguir de lunes a viernes." />

            {draft.goals.length === 0 ? (
              <Card tone="outline" className="text-center">
                <p className="text-4xl" aria-hidden>
                  🎯
                </p>
                <p className="mt-2 font-extrabold">Empieza con una meta</p>
                <p className="mt-1 text-sm text-navy-300">Toca una sugerencia o crea la tuya.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {GOAL_SUGGESTIONS.map((s) => (
                    <button
                      key={s.title}
                      type="button"
                      onClick={() => {
                        const base = newGoalDraft(firstOpenDay)
                        const count = Math.min(s.target_days, base.days.length)
                        update({ goals: [...draft.goals, { ...base, title: s.title, icon: s.icon, target_days: count, days: base.days.slice(0, count) }] })
                      }}
                      className="focus-ring rounded-full bg-white/6 px-3.5 py-2 text-sm font-semibold transition hover:bg-white/12"
                    >
                      {s.icon} {s.title}
                    </button>
                  ))}
                </div>
              </Card>
            ) : (
              <ul className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {draft.goals.map((goal) => (
                    <motion.li
                      key={goal.key}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
                      className="flex items-center gap-3 rounded-[22px] border border-white/6 bg-navy-850/85 p-3 pr-2 sm:p-4"
                    >
                      <button
                        type="button"
                        onClick={() => setEditing(goal)}
                        className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left"
                        aria-label={`Editar ${goal.title}`}
                      >
                        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/6 text-2xl" aria-hidden>
                          {goal.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-extrabold">{goal.title}</span>
                          <span className="text-sm text-navy-300">
                            {goal.flexible ? 'Cualquier día' : goal.days.map(weekdayLetter).join(' · ')}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-white/8 px-3 py-1 text-sm font-extrabold whitespace-nowrap">
                          {goal.target_days} {goal.target_days === 1 ? 'día' : 'días'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(goal)}
                        className="focus-ring hidden size-10 place-items-center rounded-2xl text-navy-300 hover:bg-white/6 hover:text-cream-50 sm:grid"
                        aria-label={`Editar ${goal.title}`}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => update({ goals: draft.goals.filter((g) => g.key !== goal.key) })}
                        className="focus-ring grid size-10 place-items-center rounded-2xl text-navy-300 hover:bg-coral-400/10 hover:text-coral-300"
                        aria-label={`Eliminar ${goal.title}`}
                      >
                        <Trash2 className="size-[18px]" aria-hidden />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}

            <button
              type="button"
              onClick={() => setEditing('new')}
              disabled={draft.goals.length >= LIMITS.maxGoals}
              className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-white/15 py-4 font-extrabold text-navy-200 transition hover:border-white/30 hover:text-cream-50 disabled:opacity-40"
            >
              <Plus className="size-5" aria-hidden /> Agregar otra meta
            </button>

            {showErrors && goalsError && <InlineError message={goalsError} />}
            {error && <SaveError message={error.message} onRetry={error.retry} />}

            <div className="mt-8 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-navy-300">
                {draft.goals.length} {draft.goals.length === 1 ? 'meta' : 'metas'} · {totalDays} días
              </p>
              <Button size="lg" onClick={() => void submitGoals()} loading={saveGoals.isPending} icon={<ArrowRight className="size-5" aria-hidden />}>
                Continuar
              </Button>
            </div>
          </motion.section>
        )}

        {draft.step === 2 && (
          <motion.section key="punishments" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}>
            <PageHeader
              eyebrow={formatWeekRange(week.week_start)}
              title="Agrega los castigos para tu pareja"
              subtitle="Si tu pareja termina la semana con un porcentaje menor, tendrá que girar esta ruleta."
            />

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <p className="flex gap-3 rounded-[20px] border border-honey-300/25 bg-honey-300/8 p-4 text-sm font-semibold text-honey-200">
                <ShieldCheck className="size-5 shrink-0 text-honey-300" aria-hidden />
                Los castigos deben ser seguros, razonables y previamente acordados por ambos.
              </p>
              <p className="flex gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm text-navy-200">
                <EyeOff className="size-5 shrink-0 text-lilac-300" aria-hidden />
                {partner?.display_name} no verá estos castigos hasta que le toque girar la ruleta.
              </p>
            </div>

            <ul className="space-y-2.5">
              <AnimatePresence initial={false}>
                {draft.punishments.map((item, index) => (
                  <PunishmentEditor
                    key={item.key}
                    item={item}
                    index={index}
                    showErrors={showErrors}
                    onChange={(next) => update({ punishments: draft.punishments.map((p) => (p.key === item.key ? next : p)) })}
                    onRemove={
                      draft.punishments.length > LIMITS.minPunishments
                        ? () => update({ punishments: draft.punishments.filter((p) => p.key !== item.key) })
                        : undefined
                    }
                  />
                ))}
              </AnimatePresence>
            </ul>

            <button
              type="button"
              onClick={() => update({ punishments: [...draft.punishments, { key: crypto.randomUUID(), text: '', emoji: '🎲' }] })}
              disabled={draft.punishments.length >= LIMITS.maxPunishments}
              className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-white/15 py-4 font-extrabold text-navy-200 transition hover:border-white/30 hover:text-cream-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-5" aria-hidden /> Agregar otro castigo
              <span className="text-sm font-semibold text-navy-400">
                ({draft.punishments.length}/{LIMITS.maxPunishments})
              </span>
            </button>

            <div className="mt-5">
              <p className="text-xs font-extrabold tracking-[0.14em] text-navy-300 uppercase">Ideas</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PUNISHMENT_SUGGESTIONS.filter((s) => !draft.punishments.some((p) => p.text.trim() === s.text)).map((s) => (
                  <button
                    key={s.text}
                    type="button"
                    onClick={() => {
                      const emptyIndex = draft.punishments.findIndex((p) => !p.text.trim())
                      if (emptyIndex >= 0) {
                        update({ punishments: draft.punishments.map((p, i) => (i === emptyIndex ? { ...p, text: s.text, emoji: s.emoji } : p)) })
                      } else if (draft.punishments.length < LIMITS.maxPunishments) {
                        update({ punishments: [...draft.punishments, { key: crypto.randomUUID(), text: s.text, emoji: s.emoji }] })
                      }
                    }}
                    className="focus-ring rounded-full bg-white/6 px-3.5 py-2 text-sm font-semibold transition hover:bg-white/12"
                  >
                    {s.emoji} {s.text}
                  </button>
                ))}
              </div>
            </div>

            {showErrors && punishmentsError && <InlineError message={punishmentsError} />}
            {error && <SaveError message={error.message} onRetry={error.retry} />}

            <div className="mt-8 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => goTo(1)} icon={<ArrowLeft className="size-5" aria-hidden />}>
                Atrás
              </Button>
              <Button size="lg" onClick={() => void submitPunishments()} loading={savePunishments.isPending} icon={<ArrowRight className="size-5" aria-hidden />}>
                Continuar
              </Button>
            </div>
          </motion.section>
        )}

        {draft.step === 3 && (
          <motion.section key="summary" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <Card tone="glow" className="mx-auto max-w-xl text-center">
              <motion.span
                className="mx-auto grid size-16 place-items-center rounded-full bg-mint-400/15 text-mint-300"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 12 }}
                aria-hidden
              >
                <CircleCheck className="size-9" />
              </motion.span>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Tu semana está lista 🎯</h1>
              <p className="mt-1 text-navy-300">{formatWeekRange(week.week_start)}</p>
              <dl className="mt-6 grid grid-cols-3 gap-3">
                {[
                  ['Metas', draft.goals.length],
                  ['Días totales', totalDays],
                  ['Castigos', draft.punishments.length],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-3xl bg-white/[0.05] px-2 py-4">
                    <dt className="text-xs font-bold text-navy-300">{label}</dt>
                    <dd className="mt-1 text-3xl font-extrabold">{value}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-6 space-y-1.5 text-left">
                {draft.goals.map((g) => (
                  <li key={g.key} className="flex items-center gap-2 rounded-2xl bg-white/[0.03] px-3 py-2 text-sm">
                    <span aria-hidden>{g.icon}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{g.title}</span>
                    <span className="text-navy-300">{g.target_days} d</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-navy-300">Al comenzar ya no podrás editar tus metas ni tus castigos esta semana.</p>
              {error && <SaveError message={error.message} onRetry={error.retry} />}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                <Button variant="ghost" onClick={() => goTo(2)} disabled={saving} icon={<ArrowLeft className="size-5" aria-hidden />}>
                  Revisar
                </Button>
                <Button size="lg" onClick={() => void start()} loading={confirmSetup.isPending}>
                  Comenzar la semana
                </Button>
              </div>
            </Card>
          </motion.section>
        )}
      </div>

      <GoalEditor
        open={editing !== null}
        initial={editing === 'new' ? null : editing}
        firstOpenDay={firstOpenDay}
        onClose={() => setEditing(null)}
        onSave={(goal) => {
          const exists = draft.goals.some((g) => g.key === goal.key)
          update({ goals: exists ? draft.goals.map((g) => (g.key === goal.key ? goal : g)) : [...draft.goals, goal] })
          setEditing(null)
        }}
        onDelete={
          editing && editing !== 'new'
            ? () => {
                update({ goals: draft.goals.filter((g) => g.key !== editing.key) })
                setEditing(null)
              }
            : undefined
        }
      />
    </div>
  )
}

function Stepper({ step }: { step: Step }) {
  const steps = ['Metas', 'Castigos', 'Listo']
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Pasos de la configuración">
      {steps.map((label, i) => {
        const n = (i + 1) as Step
        const done = n < step
        const current = n === step
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={current ? 'step' : undefined}>
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold transition-colors',
                current ? 'bg-cream-50 text-ink' : done ? 'bg-mint-400 text-ink' : 'bg-white/8 text-navy-300',
              )}
            >
              {done ? '✓' : n}
            </span>
            <span className={cn('text-sm font-bold', current ? 'text-cream-50' : 'text-navy-300')}>{label}</span>
            {i < steps.length - 1 && <span className={cn('h-0.5 flex-1 rounded-full', done ? 'bg-mint-400/60' : 'bg-white/8')} aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="mt-4 rounded-2xl border border-coral-400/30 bg-coral-400/8 px-4 py-3 text-sm font-semibold text-coral-300" role="alert">
      {message}
    </p>
  )
}

function SaveError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-coral-400/30 bg-coral-400/8 px-4 py-3" role="alert">
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-extrabold text-coral-300">No pudimos guardar este cambio.</p>
        <p className="text-sm text-navy-200">{message} Tus datos siguen aquí.</p>
      </div>
      <Button size="sm" variant="cream" onClick={onRetry} icon={<RefreshCw className="size-4" aria-hidden />}>
        Intentar nuevamente
      </Button>
    </div>
  )
}

function ConfirmedSummary({ week }: { week: WeekSummary }) {
  const { userId, partner } = useSession()
  const detail = useWeekQuery(week.id)
  const mine = useMemo(() => detail.data?.goals.filter((g) => g.user_id === userId) ?? [], [detail.data, userId])
  const punishments = detail.data?.punishments.filter((p) => p.author_id === userId) ?? []
  const partnerReady = isConfirmed(week, partner?.id)
  return (
    <div>
      <PageHeader eyebrow={formatWeekRange(week.week_start)} title="Tu semana está lista 🎯" subtitle={partnerReady ? 'Los dos están listos. Nos vemos el lunes.' : `Esperando a que ${partner?.display_name} confirme la suya.`} />
      {detail.isPending ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <h2 className="font-extrabold">Tus metas</h2>
            <ul className="mt-3 space-y-2">
              {mine.map((g) => (
                <li key={g.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
                  <span aria-hidden>{g.icon}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{g.title}</span>
                  <span className="text-sm text-navy-300">{g.target_days} d</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="font-extrabold">Castigos para {partner?.display_name}</h2>
            <ul className="mt-3 space-y-2">
              {punishments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
                  <span aria-hidden>{p.emoji}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-2 text-xs text-navy-300">
              <EyeOff className="size-3.5" aria-hidden /> Secretos hasta que se gire la ruleta.
            </p>
          </Card>
        </div>
      )}
      <p className="mt-6 text-sm text-navy-300">Una vez confirmada, la semana ya no se puede editar.</p>
    </div>
  )
}
