import { motion } from 'framer-motion'
import { Avatar } from '@/components/avatar/Avatar'
import { AnimatedNumber } from '@/components/progress/Progress'
import { formatWeekRange } from '@/domain/dates'
import type { MoodLevel } from '@/domain/mood'
import type { Profile, WeekSummary, WeeklyResult as Result } from '@/domain/types'
import { cn } from '@/lib/browser'
import { accentStyle } from './WeeklyScore'

interface WeeklyResultProps {
  week: WeekSummary
  me: Profile
  partner: Profile
  compact?: boolean
}

export interface ResultStory {
  headline: string
  detail: string
  /** Lo que salió en la ruleta, si ya se giró. */
  outcomes: string[]
  winner: Profile | null
  loser: Profile | null
  tie: boolean
}

/** Frases del resultado a partir de lo que calculó el servidor. */
export function resultStory(week: WeekSummary, me: Profile, partner: Profile): ResultStory {
  const byId = (id: string) => (id === me.id ? me : partner)
  const winnerRow = week.results.find((r) => r.outcome === 'win')
  const loserRow = week.results.find((r) => r.outcome === 'loss')
  const tie = week.results.length > 0 && week.results.every((r) => r.outcome === 'tie')
  const spinners = week.results.filter((r) => r.must_spin).map((r) => byId(r.user_id))
  const outcomes = week.roulette
    .filter((spin) => spin.punishment)
    .map((spin) => {
      const who = byId(spin.spinner_id).display_name
      return `${spin.accepted_at ? `${who} cumplirá` : `A ${who} le tocó`}: ${spin.punishment!.emoji} ${spin.punishment!.text}${spin.accepted_at ? ' ✓' : ''}`
    })
  const pendingSpinners = spinners.filter((p) => !week.roulette.some((spin) => spin.spinner_id === p.id))

  if (tie) {
    const detail =
      spinners.length === 0
        ? 'Nadie gira la ruleta esta vez. 💛'
        : pendingSpinners.length === 2
          ? 'Regla de empate: ambos giran la ruleta.'
          : pendingSpinners.length === 1
            ? `${pendingSpinners[0]!.display_name} deberá girar la ruleta.`
            : ''
    return { headline: '¡Empate! 🤝', detail, outcomes, winner: null, loser: null, tie: true }
  }
  const winner = winnerRow ? byId(winnerRow.user_id) : null
  const loser = loserRow ? byId(loserRow.user_id) : null
  const loserSpins = Boolean(loserRow?.must_spin)
  const loserSpun = loser ? week.roulette.some((spin) => spin.spinner_id === loser.id) : false
  return {
    headline: winner ? `¡${winner.display_name} gana esta semana! 🏆` : 'Semana cerrada',
    detail: !loser
      ? ''
      : !loserSpins
        ? `${loser.display_name} se salva: no hay castigos preparados.`
        : loserSpun
          ? ''
          : `${loser.display_name} deberá girar la ruleta.`,
    outcomes,
    winner,
    loser,
    tie: false,
  }
}

function moodFor(result: Result | undefined): MoodLevel {
  if (!result) return 2
  if (result.outcome === 'win') return 5
  if (result.outcome === 'tie') return 4
  return result.percentage >= 60 ? 1 : 0
}

export function WeeklyResult({ week, me, partner, compact = false }: WeeklyResultProps) {
  const story = resultStory(week, me, partner)
  const people = [me, partner]
  const avatarSize = compact ? 64 : 104

  return (
    <div className="relative">
      <p className="text-center text-sm font-semibold text-navy-300">{formatWeekRange(week.week_start)}</p>
      <div className={cn('flex items-end justify-center', compact ? 'mt-9 gap-4' : 'mt-10 gap-5 sm:gap-10')}>
        {people.map((person, i) => {
          const result = week.results.find((r) => r.user_id === person.id)
          const winner = result?.outcome === 'win'
          return (
            <motion.div
              key={person.id}
              style={accentStyle(person.accent)}
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: winner && !compact ? -10 : 0, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.15, type: 'spring', stiffness: 180, damping: 16 }}
            >
              <div className="relative">
                {winner && (
                  <motion.span
                    className="absolute -top-7 left-1/2 -translate-x-1/2 text-3xl"
                    initial={{ y: -20, opacity: 0, rotate: -30 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    transition={{ delay: 0.7, type: 'spring' }}
                    aria-hidden
                  >
                    👑
                  </motion.span>
                )}
                <Avatar profile={person} mood={moodFor(result)} size={avatarSize} />
              </div>
              <p className="mt-3 text-sm font-extrabold tracking-[0.12em] text-(--accent) uppercase">{person.display_name}</p>
              <p className={cn('leading-none font-extrabold tracking-tight', compact ? 'text-4xl' : 'text-5xl sm:text-6xl')}>
                <AnimatedNumber value={Math.round(result?.percentage ?? 0)} />
                <span className="text-[0.5em] text-navy-300">%</span>
              </p>
              {result && !compact && (
                <p className="mt-1.5 text-xs font-semibold text-navy-300 tabular-nums">
                  {result.completed_tasks}/{result.total_tasks} tareas · {result.goals_completed}/{result.goals_count} metas
                </p>
              )}
              {result && !result.participated && <p className="mt-1 text-xs font-semibold text-coral-300">No configuró su semana</p>}
            </motion.div>
          )
        })}
      </div>
      <motion.div
        className={cn('pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-navy-700 px-3 py-1 text-xs font-black tracking-widest text-navy-200', compact ? 'top-[6.5rem]' : 'top-[9rem]')}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: 'spring' }}
        aria-hidden
      >
        VS
      </motion.div>
      <motion.div className="mt-6 text-center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <p className={cn('font-extrabold tracking-tight text-balance', compact ? 'text-xl' : 'text-2xl sm:text-3xl')}>{story.headline}</p>
        {story.detail && <p className="mt-1 text-navy-200">{story.detail}</p>}
        {story.outcomes.map((line) => (
          <p key={line} className="mt-1.5 text-sm font-semibold text-honey-200">
            {line}
          </p>
        ))}
      </motion.div>
    </div>
  )
}
