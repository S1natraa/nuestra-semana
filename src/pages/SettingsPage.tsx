/** Configuración: perfil, preferencias, reglas de la pareja y correcciones. */
import { Camera, Copy, LogOut, RotateCcw, Save, ShieldCheck, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '@/components/avatar/Avatar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, TextInput, Toggle, inputClass } from '@/components/ui/Controls'
import { ACCENTS, ACCENT_ORDER, HAIR_COLORS, HAIR_STYLES, SKIN_TONES, TIE_RULES, resolveAvatar } from '@/domain/constants'
import { dateOfWeekday, formatLongDay, isoWeekday } from '@/domain/dates'
import type { MoodLevel } from '@/domain/mood'
import type { AvatarStyle } from '@/domain/types'
import { cn, copyToClipboard, prepareAvatarImage } from '@/lib/browser'
import { playSound } from '@/lib/sound'
import { errorMessage } from '@/services/errors'
import { useBackend, useDemo } from '@/state/backend'
import {
  useCancelCorrection,
  useRequestCorrection,
  useUpdateCoupleSettings,
  useUpdateProfile,
  useUpdateUserSettings,
} from '@/state/mutations'
import { useSession, useWeekQuery } from '@/state/queries'
import { useToast } from '@/state/toast'

export function SettingsPage() {
  return (
    <div>
      <PageHeader title="Configuración" subtitle="Tu perfil, sus reglas y tus preferencias." />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <ProfileSection />
          <PreferencesSection />
        </div>
        <div className="space-y-5">
          <CoupleRulesSection />
          <CorrectionSection />
          <SessionSection />
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children, description }: { children: React.ReactNode; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-extrabold">{children}</h2>
      {description && <p className="text-sm text-navy-300">{description}</p>}
    </div>
  )
}

// ─────────────────────────── Perfil ───────────────────────────

const MOOD_PREVIEW: { mood: MoodLevel; label: string }[] = [
  { mood: 0, label: '0 %' },
  { mood: 1, label: '20 %' },
  { mood: 2, label: '40 %' },
  { mood: 3, label: '60 %' },
  { mood: 4, label: '80 %' },
  { mood: 5, label: '100 %' },
]

function ProfileSection() {
  const { me } = useSession()
  const backend = useBackend()
  const update = useUpdateProfile()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(me.display_name)
  const [uploading, setUploading] = useState(false)
  const style = resolveAvatar(me.id, me.avatar)

  const save = (patch: Parameters<typeof update.mutate>[0], message?: string) =>
    update.mutate(patch, {
      onSuccess: () => message && toast.success(message),
      onError: (error) => toast.saveError(error, () => save(patch, message)),
    })

  const setAvatar = (patch: Partial<AvatarStyle>) => save({ avatar: { ...style, ...patch } })

  const saveName = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || name.trim() === me.display_name) return
    save({ display_name: name.trim() }, 'Nombre actualizado')
  }

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const image = await prepareAvatarImage(file)
      const url = await backend.uploadAvatar(me.id, image)
      save({ avatar_url: url }, 'Foto actualizada')
    } catch (error) {
      toast.show({ tone: 'error', title: error instanceof Error && !('code' in error) ? error.message : errorMessage(error) })
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <Card>
      <SectionTitle description="Así te ve tu pareja.">Tu perfil</SectionTitle>
      <div className="flex items-center gap-4">
        <Avatar profile={me} mood={4} size={88} />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<Camera className="size-4" aria-hidden />}
            loading={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {me.avatar_url ? 'Cambiar foto' : 'Subir foto'}
          </Button>
          {me.avatar_url && (
            <Button size="sm" variant="ghost" icon={<X className="size-4" aria-hidden />} onClick={() => save({ avatar_url: null }, 'Foto eliminada')}>
              Usar ilustración
            </Button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Elegir foto de perfil"
            onChange={(e) => void uploadPhoto(e.target.files?.[0])}
          />
        </div>
      </div>

      <form onSubmit={saveName} className="mt-5 flex items-end gap-2">
        <Field label="Nombre" className="flex-1">
          {(props) => <TextInput {...props} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Button type="submit" variant="cream" disabled={!name.trim() || name.trim() === me.display_name} icon={<Save className="size-4" aria-hidden />}>
          Guardar
        </Button>
      </form>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-bold text-navy-200">Color personal</legend>
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Color personal">
          {ACCENT_ORDER.map((accent) => (
            <button
              key={accent}
              type="button"
              role="radio"
              aria-checked={me.accent === accent}
              aria-label={ACCENTS[accent].label}
              onClick={() => save({ accent })}
              className={cn(
                'focus-ring grid size-11 place-items-center rounded-full border-4 transition',
                me.accent === accent ? 'border-cream-50 scale-110' : 'border-transparent',
              )}
              style={{ background: ACCENTS[accent].base }}
            >
              {me.accent === accent && <span className="text-sm font-black text-ink">✓</span>}
            </button>
          ))}
        </div>
      </fieldset>

      {!me.avatar_url && (
        <>
          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-bold text-navy-200">Peinado</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Peinado">
              {HAIR_STYLES.map((hair) => (
                <button
                  key={hair.id}
                  type="button"
                  role="radio"
                  aria-checked={style.hair === hair.id}
                  onClick={() => setAvatar({ hair: hair.id })}
                  className={cn(
                    'focus-ring flex flex-col items-center gap-1 rounded-2xl p-2 text-xs font-bold transition',
                    style.hair === hair.id ? 'bg-cream-50 text-ink' : 'bg-white/5 text-navy-200 hover:bg-white/10',
                  )}
                >
                  <Avatar profile={{ ...me, avatar: { ...style, hair: hair.id } }} mood={2} size={40} decorative />
                  {hair.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <SwatchPicker label="Tono de piel" colors={SKIN_TONES} value={style.skin} onChange={(skin) => setAvatar({ skin })} />
            <SwatchPicker label="Color de cabello" colors={HAIR_COLORS} value={style.hairColor} onChange={(hairColor) => setAvatar({ hairColor })} />
          </div>
        </>
      )}

      <div className="mt-6 rounded-3xl bg-white/[0.03] p-4">
        <p className="text-sm font-bold text-navy-200">Tu avatar reacciona a tu progreso</p>
        <ul className="mt-3 grid grid-cols-6 gap-1 text-center">
          {MOOD_PREVIEW.map(({ mood, label }) => (
            <li key={mood} className="flex flex-col items-center gap-1">
              <Avatar profile={me} mood={mood} size={44} />
              <span className="text-[11px] font-bold text-navy-300">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

function SwatchPicker({ label, colors, value, onChange }: { label: string; colors: string[]; value: number; onChange: (index: number) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-navy-200">{label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {colors.map((color, index) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value === index}
            aria-label={`${label} ${index + 1}`}
            onClick={() => onChange(index)}
            className={cn('focus-ring size-9 rounded-full border-[3px] transition', value === index ? 'border-cream-50 scale-110' : 'border-white/10')}
            style={{ background: color }}
          />
        ))}
      </div>
    </fieldset>
  )
}

// ─────────────────────────── Preferencias ───────────────────────────

function PreferencesSection() {
  const { settings } = useSession()
  const update = useUpdateUserSettings()
  return (
    <Card>
      <SectionTitle description="Solo afectan a este perfil.">Preferencias</SectionTitle>
      <Toggle
        icon="🔊"
        label="Sonidos"
        description="Al completar tareas, subir de porcentaje, ganar y girar la ruleta."
        checked={settings.sounds_enabled}
        onChange={(sounds_enabled) => {
          update.mutate({ sounds_enabled })
          if (sounds_enabled) playSound('complete')
        }}
      />
      <Toggle
        icon="🎉"
        label="Confeti"
        description="Celebraciones al llegar al 100 %, ganar la semana y girar la ruleta."
        checked={settings.confetti_enabled}
        onChange={(confetti_enabled) => update.mutate({ confetti_enabled })}
      />
    </Card>
  )
}

// ─────────────────────────── Reglas de la pareja ───────────────────────────

function CoupleRulesSection() {
  const { coupleSettings, state, partner } = useSession()
  const update = useUpdateCoupleSettings()
  const toast = useToast()
  const [threshold, setThreshold] = useState(coupleSettings.streak_threshold)
  const timezones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
    } catch {
      return []
    }
  }, [])
  const currentTz = state.couple?.timezone ?? 'UTC'

  const save = (patch: Parameters<typeof update.mutate>[0], message: string) =>
    update.mutate(patch, {
      onSuccess: () => toast.success(message, partner ? `${partner.display_name} verá el cambio.` : undefined),
      onError: (error) => toast.saveError(error, () => save(patch, message)),
    })

  const commitThreshold = () => {
    if (threshold !== coupleSettings.streak_threshold) save({ streak_threshold: threshold }, 'Meta de racha actualizada')
  }

  return (
    <Card>
      <SectionTitle description="Compartidas: cualquiera de los dos puede cambiarlas.">Reglas de la pareja</SectionTitle>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-navy-200">Si hay empate</legend>
        <div className="space-y-2" role="radiogroup" aria-label="Regla de empate">
          {TIE_RULES.map((rule) => {
            const selected = coupleSettings.tie_rule === rule.id
            return (
              <button
                key={rule.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => !selected && save({ tie_rule: rule.id }, 'Regla de empate actualizada')}
                className={cn(
                  'focus-ring flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition',
                  selected ? 'border-lilac-300/50 bg-lilac-400/10' : 'border-white/8 hover:bg-white/5',
                )}
              >
                <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2', selected ? 'border-lilac-300' : 'border-white/25')}>
                  {selected && <span className="size-2.5 rounded-full bg-lilac-300" />}
                </span>
                <span>
                  <span className="block font-bold">{rule.title}</span>
                  <span className="text-sm text-navy-300">{rule.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-6">
        <label htmlFor="streak-threshold" className="flex items-center justify-between text-sm font-bold text-navy-200">
          <span>Porcentaje mínimo para la racha 🔥</span>
          <span className="text-lg font-extrabold text-cream-50">{threshold}%</span>
        </label>
        <input
          id="streak-threshold"
          type="range"
          min={50}
          max={100}
          step={5}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          onPointerUp={commitThreshold}
          onKeyUp={commitThreshold}
          onBlur={commitThreshold}
          className="focus-ring mt-3 w-full accent-blush-400"
        />
        <p className="mt-1 text-xs text-navy-300">Una semana suma a la racha si alcanzas al menos este porcentaje.</p>
      </div>

      <div className="mt-6">
        <label htmlFor="timezone" className="mb-1.5 block text-sm font-bold text-navy-200">
          Zona horaria de la pareja
        </label>
        <select
          id="timezone"
          value={currentTz}
          onChange={(e) => save({ timezone: e.target.value }, 'Zona horaria actualizada')}
          className={cn(inputClass, 'appearance-none')}
        >
          {!timezones.includes(currentTz) && <option value={currentTz}>{currentTz}</option>}
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-navy-300">Define a qué hora empieza cada día y cuándo se cierra el viernes.</p>
      </div>

      {state.couple && state.couple.member_count < 2 && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] p-4">
          <div>
            <p className="text-sm font-bold">Código de invitación</p>
            <p className="font-mono text-2xl font-extrabold tracking-[0.2em] text-honey-300">{state.couple.invite_code}</p>
          </div>
          <Button
            size="sm"
            variant="cream"
            icon={<Copy className="size-4" aria-hidden />}
            onClick={async () => toast.success((await copyToClipboard(`${window.location.origin}/unirse/${state.couple!.invite_code}`)) ? 'Enlace copiado' : 'No se pudo copiar')}
          >
            Copiar enlace
          </Button>
        </div>
      )}
    </Card>
  )
}

// ─────────────────────────── Corrección excepcional ───────────────────────────

function CorrectionSection() {
  const { calendar, userId, partner, state } = useSession()
  const week = calendar.phase === 'weekday' ? calendar.currentWeek : null
  const detail = useWeekQuery(week?.id)
  const request = useRequestCorrection()
  const cancel = useCancelCorrection()
  const toast = useToast()
  const [goalId, setGoalId] = useState('')
  const [day, setDay] = useState('')
  const [done, setDone] = useState(true)
  const [note, setNote] = useState('')

  const myGoals = detail.data?.goals.filter((g) => g.user_id === userId) ?? []
  const goal = myGoals.find((g) => g.id === goalId) ?? myGoals[0]
  const pastDays = week && goal ? goal.days.map((d) => dateOfWeekday(week.week_start, d)).filter((date) => date < state.today) : []
  const selectedDay = pastDays.includes(day) ? day : (pastDays[pastDays.length - 1] ?? '')
  const currentlyDone = Boolean(goal && detail.data?.completions.some((c) => c.goal_id === goal.id && c.completed_on === selectedDay))
  const mine = state.corrections.filter((c) => c.requested_by === userId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!goal || !selectedDay) return
    request.mutate(
      { goalId: goal.id, day: selectedDay, done, note },
      {
        onSuccess: () => {
          setNote('')
          toast.success('Corrección enviada', `${partner?.display_name} debe aprobarla.`)
        },
        onError: (error) => toast.show({ tone: 'error', title: errorMessage(error) }),
      },
    )
  }

  return (
    <Card>
      <SectionTitle description={`Solo para errores: se aplica únicamente si ${partner?.display_name ?? 'tu pareja'} la aprueba.`}>
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="size-5 text-lilac-300" aria-hidden /> Corregir una tarea
        </span>
      </SectionTitle>
      {!week || isoWeekday(state.today) === 1 ? (
        <p className="text-sm text-navy-300">Disponible durante la semana, para días anteriores a hoy.</p>
      ) : myGoals.length === 0 || pastDays.length === 0 ? (
        <p className="text-sm text-navy-300">No tienes días anteriores que corregir esta semana.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="correction-goal" className="mb-1.5 block text-sm font-bold text-navy-200">
                Meta
              </label>
              <select id="correction-goal" value={goal?.id} onChange={(e) => setGoalId(e.target.value)} className={cn(inputClass, 'appearance-none')}>
                {myGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.icon} {g.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="correction-day" className="mb-1.5 block text-sm font-bold text-navy-200">
                Día
              </label>
              <select id="correction-day" value={selectedDay} onChange={(e) => setDay(e.target.value)} className={cn(inputClass, 'appearance-none')}>
                {pastDays.map((d) => (
                  <option key={d} value={d}>
                    {formatLongDay(d)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-navy-300">
            Ahora está: <strong className="text-cream-50">{currentlyDone ? 'cumplida' : 'no cumplida'}</strong>
          </p>
          <fieldset className="flex gap-2" aria-label="Nuevo estado">
            {[
              [true, 'Marcar cumplida'],
              [false, 'Marcar no cumplida'],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={done === value}
                onClick={() => setDone(value as boolean)}
                className={cn('focus-ring flex-1 rounded-2xl px-3 py-2.5 text-sm font-bold transition', done === value ? 'bg-cream-50 text-ink' : 'bg-white/5 text-navy-200 hover:bg-white/10')}
              >
                {label as string}
              </button>
            ))}
          </fieldset>
          <Field label="Nota para tu pareja (opcional)">
            {(props) => <TextInput {...props} value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Sí fui al gym, olvidé marcarlo" />}
          </Field>
          <Button type="submit" variant="secondary" loading={request.isPending} disabled={done === currentlyDone}>
            Solicitar corrección
          </Button>
        </form>
      )}
      {mine.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-white/6 pt-4">
          {mine.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 text-navy-200">
                ⏳ {c.goal_icon} {c.goal_title} · {formatLongDay(c.day)}
              </span>
              <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => cancel.mutate(c.id)} aria-label="Cancelar solicitud">
                Cancelar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ─────────────────────────── Sesión ───────────────────────────

function SessionSection() {
  const backend = useBackend()
  const demo = useDemo()
  const navigate = useNavigate()
  const [confirmReset, setConfirmReset] = useState(false)
  return (
    <Card>
      <SectionTitle>Sesión</SectionTitle>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          icon={<LogOut className="size-4" aria-hidden />}
          onClick={async () => {
            await backend.signOut()
            navigate('/entrar', { replace: true })
          }}
        >
          {demo ? 'Cambiar de perfil' : 'Cerrar sesión'}
        </Button>
        {demo &&
          (confirmReset ? (
            <>
              <Button variant="danger" onClick={() => void demo.reset()}>
                Sí, borrar datos demo
              </Button>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button variant="danger" icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => setConfirmReset(true)}>
              Reiniciar demo
            </Button>
          ))}
      </div>
      {demo && <p className="mt-3 text-xs text-navy-400">Modo demo: los datos viven solo en este navegador.</p>}
    </Card>
  )
}
