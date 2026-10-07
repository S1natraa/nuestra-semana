import { motion } from 'framer-motion'
import { Lock, Trophy } from 'lucide-react'
import { Avatar } from '@/components/avatar/Avatar'
import { ProgressBar } from '@/components/progress/Progress'
import { accentStyle, streakFlames } from '@/components/results/WeeklyScore'
import { ACCENTS } from '@/domain/constants'
import { formatShortDate, formatWeekRangeCompact } from '@/domain/dates'
import type { Achievement, MemberStats, Profile, UnlockedAchievement, WeekSummary } from '@/domain/types'
import { cn } from '@/lib/browser'

// ─────────────────────────── Estadísticas ───────────────────────────

export function StatsCard({ profile, stats, isMe }: { profile: Profile; stats: MemberStats | undefined; isMe: boolean }) {
  const s = stats ?? { weeks: 0, average: 0, wins: 0, losses: 0, ties: 0, best: 0, perfect_weeks: 0, goals_completed: 0, current_streak: 0 }
  const items = [
    { label: 'Promedio', value: `${Math.round(s.average)}%` },
    { label: 'Victorias', value: String(s.wins) },
    { label: 'Mejor semana', value: `${Math.round(s.best)}%` },
    { label: 'Racha actual', value: s.current_streak > 0 ? `${streakFlames(s.current_streak)} ${s.current_streak}` : '0' },
  ]
  return (
    <motion.article
      style={accentStyle(profile.accent)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[28px] border border-lilac-300/12 bg-linear-to-b from-(--accent)/10 to-navy-850/90 p-5 shadow-card"
    >
      <header className="flex items-center gap-3">
        <Avatar profile={profile} size={48} decorative />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-extrabold">{profile.display_name}</h3>
          <p className="text-xs font-semibold text-navy-300">
            {isMe ? 'Tú' : 'Tu pareja'} · {s.weeks} {s.weeks === 1 ? 'semana' : 'semanas'} jugadas
          </p>
        </div>
      </header>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-white/[0.04] px-3.5 py-3">
            <dt className="text-xs font-semibold text-navy-300">{item.label}</dt>
            <dd className="mt-1 text-2xl font-extrabold tracking-tight">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-navy-300">
        {s.perfect_weeks} {s.perfect_weeks === 1 ? 'semana perfecta' : 'semanas perfectas'} · {s.goals_completed} metas completadas
      </p>
    </motion.article>
  )
}

// ─────────────────────────── Logros ───────────────────────────

export function AchievementBadge({ achievement, unlocked }: { achievement: Achievement; unlocked: UnlockedAchievement | undefined }) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-3xl border p-3.5 transition',
        unlocked ? 'border-honey-300/25 bg-honey-300/[0.06]' : 'border-white/6 bg-white/[0.02]',
      )}
    >
      <span
        className={cn(
          'relative grid size-12 shrink-0 place-items-center rounded-2xl text-2xl',
          unlocked ? 'bg-honey-300/15 shadow-[0_0_24px_-6px_rgb(255_224_142/0.55)]' : 'bg-white/5 grayscale',
        )}
        aria-hidden
      >
        <span className={cn(!unlocked && 'opacity-40')}>{achievement.icon}</span>
        {!unlocked && <Lock className="absolute -right-1 -bottom-1 size-5 rounded-full bg-navy-800 p-1 text-navy-300" />}
      </span>
      <div className="min-w-0">
        <p className={cn('font-extrabold', !unlocked && 'text-navy-200')}>{achievement.title}</p>
        <p className="text-xs text-navy-300">
          {unlocked ? `Desbloqueado el ${formatShortDate(unlocked.unlocked_at.slice(0, 10))}` : achievement.description}
        </p>
      </div>
      <span className="sr-only">{unlocked ? 'Desbloqueado' : 'Bloqueado'}</span>
    </li>
  )
}

// ─────────────────────────── Semana del historial ───────────────────────────

export function WeekHistoryItem({ week, people, index }: { week: WeekSummary; people: Profile[]; index: number }) {
  const winner = week.results.find((r) => r.outcome === 'win')
  const tie = week.results.length > 0 && week.results.every((r) => r.outcome === 'tie')
  const nameOf = (id: string) => people.find((p) => p.id === id)?.display_name ?? '—'

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className="rounded-[24px] border border-white/6 bg-navy-850/80 p-4 shadow-soft sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-extrabold">{formatWeekRangeCompact(week.week_start)}</h3>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold',
            tie ? 'bg-lilac-400/15 text-lilac-300' : 'bg-honey-300/15 text-honey-300',
          )}
        >
          {tie ? '🤝 Empate' : <><Trophy className="size-3.5" aria-hidden /> Ganó {winner ? nameOf(winner.user_id) : '—'}</>}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {people.map((person) => {
          const r = week.results.find((x) => x.user_id === person.id)
          const pct = r?.percentage ?? 0
          return (
            <div key={person.id} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3" style={accentStyle(person.accent)}>
              <span className="truncate text-sm font-bold text-navy-200">{person.display_name}</span>
              <ProgressBar value={pct} label={`${person.display_name}: ${Math.round(pct)}%`} height={8} color={ACCENTS[person.accent].base} />
              <span className="text-right text-sm font-extrabold tabular-nums">{Math.round(pct)}%</span>
            </div>
          )
        })}
      </div>
      {week.roulette.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-white/6 pt-3">
          {week.roulette.map((spin) => (
            <li key={spin.spinner_id} className="flex items-center gap-2 text-sm">
              <span aria-hidden>{spin.punishment?.emoji ?? '🎲'}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-bold">{nameOf(spin.spinner_id)}:</span> {spin.punishment?.text ?? 'Castigo'}
              </span>
              <span className={cn('shrink-0 text-xs font-bold', spin.accepted_at ? 'text-mint-300' : 'text-honey-300')}>
                {spin.accepted_at ? '✓ Aceptado' : 'Pendiente'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {week.results.some((r) => r.must_spin) && week.roulette.length === 0 && (
        <p className="mt-3 border-t border-white/6 pt-3 text-sm text-honey-300">🎰 Ruleta pendiente</p>
      )}
    </motion.li>
  )
}
