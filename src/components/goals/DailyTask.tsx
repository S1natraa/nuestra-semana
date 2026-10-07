import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { Check, Lock, Star } from 'lucide-react'
import type { TodayTask } from '@/domain/progress'
import { cn } from '@/lib/browser'

interface DailyTaskProps {
  task: TodayTask
  onToggle?: (done: boolean) => void
  pending?: boolean
  /** Vista de la pareja: se ve, no se toca. */
  readOnly?: boolean
  tone?: 'paper' | 'navy'
  compact?: boolean
}

export function DailyTask({ task, onToggle, pending = false, readOnly = false, tone = 'paper', compact = false }: DailyTaskProps) {
  const card = useAnimationControls()
  const box = useAnimationControls()
  const done = task.state === 'done'
  const met = task.state === 'met'
  const interactive = !readOnly && !met && Boolean(onToggle)
  const paper = tone === 'paper'

  const toggle = () => {
    if (!interactive || pending) return
    const next = !done
    void box.start({ scale: [0.8, 1.1, 1], transition: { duration: 0.35 } })
    void card.start({ scale: [1, 1.018, 1], y: [0, -2, 0], transition: { duration: 0.35 } })
    onToggle?.(next)
  }

  const meta = met
    ? 'Meta semanal cumplida'
    : task.target > 1
      ? `${task.weekDone} de ${task.target} esta semana`
      : 'Una vez esta semana'

  const Wrapper = interactive ? motion.button : motion.div

  return (
    <Wrapper
      animate={card}
      layout
      {...(interactive
        ? {
            type: 'button' as const,
            role: 'checkbox',
            'aria-checked': done,
            'aria-disabled': pending || undefined,
            onClick: toggle,
          }
        : { role: 'group', 'aria-label': `${task.goal.title}: ${done ? 'hecha' : met ? 'cumplida esta semana' : 'pendiente'}` })}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-[22px] text-left transition-colors',
        compact ? 'px-3 py-2.5' : 'px-3.5 py-3 sm:px-4',
        interactive && 'focus-ring',
        paper
          ? done
            ? 'bg-white/80'
            : 'bg-white/45 hover:bg-white/70'
          : done
            ? 'bg-white/8'
            : 'bg-white/[0.035]',
        pending && 'opacity-70',
      )}
    >
      <motion.span
        animate={box}
        className={cn(
          'grid shrink-0 place-items-center rounded-[11px] border-2 transition-colors duration-200',
          compact ? 'size-7' : 'size-8',
          done
            ? 'border-transparent bg-(--accent) text-ink'
            : met
              ? 'border-transparent bg-honey-300/70 text-ink'
              : paper
                ? 'border-ink/20 bg-white'
                : 'border-white/20',
        )}
        aria-hidden
      >
        <AnimatePresence initial={false}>
          {done && (
            <motion.svg viewBox="0 0 24 24" className="size-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.path
                d="M5 12.5 L10 17.5 L19 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              />
            </motion.svg>
          )}
          {met && <Star className="size-4 fill-current" />}
        </AnimatePresence>
      </motion.span>

      <span
        className={cn('grid shrink-0 place-items-center rounded-2xl text-xl', compact ? 'size-9' : 'size-10', paper ? 'bg-ink/[0.05]' : 'bg-white/6')}
        aria-hidden
      >
        {task.goal.icon}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate font-bold transition-colors',
            compact ? 'text-sm' : 'text-[15px]',
            paper ? (done ? 'text-ink/55 line-through decoration-2 decoration-ink/25' : 'text-ink') : done ? 'text-cream-50/60 line-through decoration-white/25' : 'text-cream-50',
          )}
        >
          {task.goal.title}
        </span>
        <span className={cn('mt-0.5 block text-xs font-medium', paper ? 'text-ink-soft' : 'text-navy-300')}>{meta}</span>
      </span>

      <AnimatePresence initial={false} mode="popLayout">
        {done ? (
          <motion.span
            key="done"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold', paper ? 'bg-mint-400/25 text-mint-600' : 'bg-mint-400/15 text-mint-300')}
          >
            <Check className="mr-0.5 inline size-3" aria-hidden />
            ¡Hecho!
          </motion.span>
        ) : readOnly ? (
          <motion.span key="ro" className={cn('shrink-0 text-[11px] font-bold', paper ? 'text-ink-soft' : 'text-navy-400')}>
            Pendiente
          </motion.span>
        ) : met ? (
          <Lock key="lock" className={cn('size-4 shrink-0', paper ? 'text-ink/35' : 'text-navy-400')} aria-hidden />
        ) : null}
      </AnimatePresence>
    </Wrapper>
  )
}
