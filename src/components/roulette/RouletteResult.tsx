import { AnimatePresence, motion } from 'framer-motion'
import { CircleCheck } from 'lucide-react'
import { PunishmentCard } from '@/components/punishments/Punishments'
import { Button } from '@/components/ui/Button'

interface RouletteResultProps {
  emoji: string
  text: string
  /** Quién cumple el castigo (null = yo). */
  who: string | null
  accepted: boolean
  onAccept?: () => void
  accepting?: boolean
}

export function RouletteResult({ emoji, text, who, accepted, onAccept, accepting }: RouletteResultProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      className="relative mx-auto w-full max-w-md text-center"
      role="status"
      aria-live="assertive"
    >
      <h2 className="text-3xl font-extrabold tracking-tight">{who ? `A ${who} le tocó:` : '¡Te tocó este castigo!'}</h2>
      <PunishmentCard emoji={emoji} text={text} className="mt-5" />
      <AnimatePresence mode="popLayout" initial={false}>
        {accepted ? (
          <motion.p
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-mint-400/15 px-4 py-2 font-extrabold text-mint-300"
          >
            <CircleCheck className="size-5" aria-hidden /> Castigo registrado.
          </motion.p>
        ) : onAccept ? (
          <motion.div key="accept" exit={{ opacity: 0 }} className="mt-5">
            <Button size="lg" variant="cream" onClick={onAccept} loading={accepting}>
              Marcar como aceptado
            </Button>
          </motion.div>
        ) : (
          <motion.p key="waiting" className="mt-5 text-sm text-navy-300">
            Esperando a que {who} lo acepte…
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
