import { AnimatePresence, motion } from 'framer-motion'
import { motivationalMessage, partnerMessage } from '@/domain/mood'
import { cn } from '@/lib/browser'

interface MotivationalMessageProps {
  percentage: number
  /** Mensaje en tercera persona para la tarjeta de la pareja. */
  about?: 'me' | 'partner'
  className?: string
}

export function MotivationalMessage({ percentage, about = 'me', className }: MotivationalMessageProps) {
  const message = about === 'me' ? motivationalMessage(percentage) : partnerMessage(percentage)
  return (
    <div className={cn('relative min-h-5', className)} aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={message.text}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="text-sm font-semibold"
        >
          <span aria-hidden>{message.emoji} </span>
          {message.text}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
