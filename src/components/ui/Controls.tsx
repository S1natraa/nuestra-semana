import { motion } from 'framer-motion'
import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/browser'

// ─────────────────────────── Interruptor ───────────────────────────

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  icon?: ReactNode
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, description, icon, disabled }: ToggleProps) {
  const id = useId()
  return (
    <div className="flex items-center gap-3 py-2">
      {icon && <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/6 text-lg">{icon}</span>}
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[15px] font-semibold text-cream-50">
          {label}
        </label>
        {description && <p className="text-sm text-navy-300">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'focus-ring relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50',
          checked ? 'bg-mint-400' : 'bg-navy-600',
        )}
      >
        <motion.span
          className="absolute top-1 left-1 block size-6 rounded-full bg-cream-50 shadow"
          animate={{ x: checked ? 24 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
        <span className="sr-only">{checked ? 'Activado' : 'Desactivado'}</span>
      </button>
    </div>
  )
}

// ─────────────────────────── Pestañas segmentadas ───────────────────────────

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode }[]
  label: string
  className?: string
}

export function Segmented<T extends string>({ value, onChange, options, label, className }: SegmentedProps<T>) {
  const group = useId()
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex rounded-full bg-navy-800 p-1', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'focus-ring relative flex-1 rounded-full px-4 py-2 text-sm font-bold transition-colors',
              active ? 'text-ink' : 'text-navy-300 hover:text-cream-50',
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${group}`}
                className="absolute inset-0 rounded-full bg-cream-50"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────── Campos de formulario ───────────────────────────

interface FieldProps {
  label: string
  hint?: string
  error?: string | null
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
  className?: string
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-navy-200">
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-coral-300" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-navy-300">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const inputClass =
  'focus-ring w-full rounded-2xl border border-white/10 bg-navy-900/70 px-4 py-3 text-[15px] text-cream-50 placeholder:text-navy-400 ' +
  'transition-colors focus:border-lilac-300/60 aria-[invalid=true]:border-coral-400/70'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, 'min-h-20 resize-none', props.className)} />
}

export function Chip({ children, className, tone = 'default' }: { children: ReactNode; className?: string; tone?: 'default' | 'honey' | 'mint' | 'coral' | 'lilac' }) {
  const tones = {
    default: 'bg-white/8 text-navy-200',
    honey: 'bg-honey-300/15 text-honey-300',
    mint: 'bg-mint-400/15 text-mint-300',
    coral: 'bg-coral-400/15 text-coral-300',
    lilac: 'bg-lilac-400/15 text-lilac-300',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', tones[tone], className)}>
      {children}
    </span>
  )
}
