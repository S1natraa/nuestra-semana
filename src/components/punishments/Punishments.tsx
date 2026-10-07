import { AnimatePresence, motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { PUNISHMENT_EMOJIS } from '@/domain/constants'
import type { PunishmentDraft } from '@/domain/types'
import { LIMITS, validatePunishment } from '@/domain/validation'
import { cn } from '@/lib/browser'

interface PunishmentEditorProps {
  item: PunishmentDraft
  index: number
  onChange: (item: PunishmentDraft) => void
  onRemove?: () => void
  showErrors: boolean
}

/** Fila editable de un castigo (emoji + texto). */
export function PunishmentEditor({ item, index, onChange, onRemove, showErrors }: PunishmentEditorProps) {
  const [picking, setPicking] = useState(false)
  const inputId = useId()
  const error = showErrors ? validatePunishment(item) : null

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.18 } }}
      className="rounded-[22px] border border-white/6 bg-navy-850/80 p-3"
    >
      <div className="flex items-center gap-2.5">
        <span className="w-5 text-center text-sm font-extrabold text-navy-400 tabular-nums" aria-hidden>
          {index + 1}
        </span>
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          className="focus-ring grid size-11 shrink-0 place-items-center rounded-2xl bg-white/6 text-2xl transition hover:bg-white/10"
          aria-label={`Cambiar emoji del castigo ${index + 1} (actual: ${item.emoji})`}
          aria-expanded={picking}
        >
          {item.emoji}
        </button>
        <label htmlFor={inputId} className="sr-only">
          Castigo {index + 1}
        </label>
        <input
          id={inputId}
          value={item.text}
          maxLength={LIMITS.punishmentMax}
          placeholder="Ej. Preparar el desayuno"
          onChange={(e) => onChange({ ...item, text: e.target.value })}
          aria-invalid={error ? true : undefined}
          className="focus-ring min-w-0 flex-1 rounded-2xl border border-white/10 bg-navy-900/70 px-3.5 py-3 text-[15px] text-cream-50 placeholder:text-navy-400 aria-[invalid=true]:border-coral-400/70"
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="focus-ring grid size-11 shrink-0 place-items-center rounded-2xl text-navy-300 transition hover:bg-coral-400/10 hover:text-coral-300"
            aria-label={`Eliminar castigo ${index + 1}`}
          >
            <Trash2 className="size-[18px]" aria-hidden />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {picking && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-8 gap-1.5 pt-3" role="radiogroup" aria-label="Emoji del castigo">
              {PUNISHMENT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="radio"
                  aria-checked={emoji === item.emoji}
                  onClick={() => {
                    onChange({ ...item, emoji })
                    setPicking(false)
                  }}
                  className={cn(
                    'focus-ring grid aspect-square place-items-center rounded-xl text-xl transition',
                    emoji === item.emoji ? 'bg-cream-50' : 'bg-white/5 hover:bg-white/10',
                  )}
                  aria-label={`Emoji ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && (
        <p className="mt-2 pl-8 text-sm font-medium text-coral-300" role="alert">
          {error}
        </p>
      )}
    </motion.li>
  )
}

/** Tarjeta grande de un castigo (resultado de la ruleta, historial). */
export function PunishmentCard({ emoji, text, className }: { emoji: string; text: string; className?: string }) {
  return (
    <div className={cn('paper-grain flex flex-col items-center rounded-[28px] px-6 py-8 text-center text-ink shadow-paper', className)}>
      <motion.span
        className="text-6xl sm:text-7xl"
        initial={{ scale: 0.3, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 12 }}
        aria-hidden
      >
        {emoji}
      </motion.span>
      <p className="mt-4 text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">{text}</p>
    </div>
  )
}
