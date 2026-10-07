import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, TextArea, TextInput, Toggle } from '@/components/ui/Controls'
import { Modal } from '@/components/ui/Modal'
import { GOAL_ICONS, GOAL_SUGGESTIONS } from '@/domain/constants'
import { WORK_DAYS, weekdayName, weekdayShort } from '@/domain/dates'
import type { GoalDraft, Weekday } from '@/domain/types'
import { LIMITS, validateGoal } from '@/domain/validation'
import { cn } from '@/lib/browser'

interface GoalEditorProps {
  open: boolean
  initial: GoalDraft | null
  /** Primer día (1-5) que todavía se puede programar (configuración tardía). */
  firstOpenDay: number
  onClose: () => void
  onSave: (goal: GoalDraft) => void
  onDelete?: () => void
}

export function newGoalDraft(firstOpenDay = 1): GoalDraft {
  const available = WORK_DAYS.filter((d) => d >= firstOpenDay)
  return {
    key: crypto.randomUUID(),
    title: '',
    description: '',
    icon: '🎯',
    target_days: available.length,
    days: [...available],
    flexible: false,
  }
}

function firstDays(count: number, firstOpenDay: number): Weekday[] {
  return WORK_DAYS.filter((d) => d >= firstOpenDay).slice(0, count)
}

export function GoalEditor({ open, initial, firstOpenDay, onClose, onSave, onDelete }: GoalEditorProps) {
  const [draft, setDraft] = useState<GoalDraft>(() => initial ?? newGoalDraft(firstOpenDay))
  const [submitted, setSubmitted] = useState(false)
  const creating = !initial

  useEffect(() => {
    if (open) {
      setDraft(initial ?? newGoalDraft(firstOpenDay))
      setSubmitted(false)
    }
  }, [open, initial, firstOpenDay])

  const available = WORK_DAYS.filter((d) => d >= firstOpenDay)
  const error = validateGoal(draft, firstOpenDay)
  const titleError = submitted && !draft.title.trim() ? 'Escribe un nombre para tu meta.' : null

  const setCount = (count: number) => {
    setDraft((d) =>
      d.flexible
        ? { ...d, target_days: count }
        : { ...d, target_days: count, days: d.days.length >= count ? d.days.slice(0, count) : firstDays(count, firstOpenDay) },
    )
  }

  const toggleDay = (day: Weekday) => {
    setDraft((d) => {
      const has = d.days.includes(day)
      const days = (has ? d.days.filter((x) => x !== day) : [...d.days, day]).sort((a, b) => a - b)
      if (days.length === 0) return d
      return { ...d, days, target_days: days.length }
    })
  }

  const setFlexible = (flexible: boolean) => {
    setDraft((d) =>
      flexible
        ? { ...d, flexible, days: [...available], target_days: Math.min(d.target_days, available.length) }
        : { ...d, flexible, days: firstDays(d.target_days, firstOpenDay) },
    )
  }

  const save = () => {
    setSubmitted(true)
    if (error) return
    onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim() })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={creating ? 'Nueva meta' : 'Editar meta'}
      description="Lo que quieres conseguir de lunes a viernes."
      footer={
        <div className="flex items-center gap-2">
          {onDelete && (
            <Button variant="danger" onClick={onDelete} icon={<Trash2 className="size-4" aria-hidden />} aria-label="Eliminar meta">
              <span className="hidden sm:inline">Eliminar</span>
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="ml-auto">
            Cancelar
          </Button>
          <Button onClick={save} disabled={submitted && Boolean(error)}>
            {creating ? 'Agregar meta' : 'Guardar'}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="Nombre" error={titleError}>
          {(props) => (
            <TextInput
              {...props}
              data-autofocus
              value={draft.title}
              maxLength={LIMITS.goalTitleMax}
              placeholder="Ej. Ir al gym"
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          )}
        </Field>

        {creating && !draft.title && (
          <div className="-mt-2 flex flex-wrap gap-2" aria-label="Sugerencias">
            {GOAL_SUGGESTIONS.slice(0, 6).map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() =>
                  setDraft((d) => {
                    const count = Math.min(s.target_days, available.length)
                    return { ...d, title: s.title, icon: s.icon, target_days: count, days: d.flexible ? d.days : firstDays(count, firstOpenDay) }
                  })
                }
                className="focus-ring rounded-full bg-white/6 px-3 py-1.5 text-sm font-semibold text-navy-200 transition hover:bg-white/10 hover:text-cream-50"
              >
                {s.icon} {s.title}
              </button>
            ))}
          </div>
        )}

        <Field label="Descripción (opcional)" hint={`${draft.description.length}/${LIMITS.goalDescriptionMax}`}>
          {(props) => (
            <TextArea
              {...props}
              value={draft.description}
              maxLength={LIMITS.goalDescriptionMax}
              placeholder="Ej. Mínimo 45 minutos"
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          )}
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-bold text-navy-200">Icono</legend>
          <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10" role="radiogroup" aria-label="Icono de la meta">
            {GOAL_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                role="radio"
                aria-checked={draft.icon === icon}
                aria-label={`Icono ${icon}`}
                onClick={() => setDraft((d) => ({ ...d, icon }))}
                className={cn(
                  'focus-ring grid aspect-square place-items-center rounded-xl text-xl transition',
                  draft.icon === icon ? 'bg-cream-50 shadow-soft' : 'bg-white/5 hover:bg-white/10',
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-bold text-navy-200">¿Cuántos días?</legend>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Cantidad de días">
            {[1, 2, 3, 4, 5].map((count) => {
              const disabled = count > available.length
              return (
                <button
                  key={count}
                  type="button"
                  role="radio"
                  aria-checked={draft.target_days === count}
                  disabled={disabled}
                  onClick={() => setCount(count)}
                  className={cn(
                    'focus-ring h-12 rounded-2xl text-lg font-extrabold transition disabled:opacity-30',
                    draft.target_days === count ? 'bg-linear-to-br from-blush-300 to-lilac-300 text-ink shadow-soft' : 'bg-white/5 text-cream-50 hover:bg-white/10',
                  )}
                >
                  {count}
                </button>
              )
            })}
          </div>
          {firstOpenDay > 1 && (
            <p className="mt-2 text-xs font-semibold text-honey-300">La semana ya empezó: solo puedes usar los días que quedan.</p>
          )}
        </fieldset>

        <div className="rounded-2xl bg-white/[0.03] px-4 py-2">
          <Toggle
            checked={!draft.flexible}
            onChange={(specific) => setFlexible(!specific)}
            label="Elegir días específicos"
            description={
              draft.flexible
                ? `Cuenta cualquier día de ${weekdayName(available[0] ?? 1)} a viernes hasta llegar a ${draft.target_days}.`
                : 'Solo se podrá marcar en los días elegidos.'
            }
          />
          {!draft.flexible && (
            <div className="grid grid-cols-5 gap-2 pt-1 pb-3" role="group" aria-label="Días de la semana">
              {WORK_DAYS.map((day) => {
                const checked = draft.days.includes(day)
                const disabled = day < firstOpenDay
                return (
                  <label
                    key={day}
                    className={cn(
                      'flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 py-2 text-sm font-bold transition has-focus-visible:outline-2 has-focus-visible:outline-honey-300',
                      checked ? 'border-transparent bg-(--accent,#ff94b4) text-ink' : 'border-white/10 text-navy-200 hover:border-white/25',
                      disabled && 'cursor-not-allowed opacity-30',
                    )}
                  >
                    <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => toggleDay(day)} />
                    {weekdayShort(day)}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {submitted && error && (
          <p className="text-sm font-semibold text-coral-300" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
