import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { AvatarProgress } from '@/components/avatar/AvatarProgress'
import { MotivationalMessage } from '@/components/feedback/MotivationalMessage'
import { AnimatedNumber, ProgressBar } from '@/components/progress/Progress'
import { ACCENTS } from '@/domain/constants'
import type { MemberProgress } from '@/domain/progress'
import type { Accent, Profile } from '@/domain/types'
import { cn } from '@/lib/browser'
import { useMediaQuery } from '@/lib/useMediaQuery'

export function accentStyle(accent: Accent): CSSProperties {
  const theme = ACCENTS[accent]
  return { '--accent': theme.base, '--accent-soft': theme.soft, '--accent-deep': theme.deep } as CSSProperties
}

export function streakFlames(streak: number): string {
  if (streak <= 0) return ''
  return '🔥'.repeat(Math.min(streak, 5))
}

interface WeeklyScoreProps {
  profile: Profile
  progress: MemberProgress | null
  isMe: boolean
  streak: number
  /** Texto cuando la persona aún no configuró su semana. */
  pendingLabel?: string
  leading?: boolean
}

/** Tarjeta del duelo semanal (una por persona). */
export function WeeklyScore({ profile, progress, isMe, streak, pendingLabel, leading }: WeeklyScoreProps) {
  const percentage = progress?.percentage ?? 0
  const shown = Math.round(percentage)
  const roomy = useMediaQuery('(min-width: 420px)', true)
  return (
    <motion.article
      style={accentStyle(profile.accent)}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative flex flex-col items-center overflow-hidden rounded-[28px] border px-3 pt-5 pb-4 text-center shadow-card sm:px-6 sm:pt-7 sm:pb-6',
        isMe ? 'border-(--accent)/25 bg-linear-to-b from-(--accent)/14 via-navy-850/90 to-navy-850/95' : 'border-white/6 bg-linear-to-b from-white/[0.05] to-navy-850/95',
      )}
      aria-label={`${isMe ? 'Tu progreso' : `Progreso de ${profile.display_name}`}: ${shown}%`}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-radial-[at_50%_0%] from-(--accent)/25 to-transparent" aria-hidden />
      <p className="relative mb-2 text-[11px] font-extrabold tracking-[0.16em] text-(--accent) uppercase">
        {isMe ? 'Tu progreso' : 'Tu pareja'}
        {leading && <span className="ml-1" aria-label="(va ganando)">👑</span>}
      </p>
      <div className="relative">
        <AvatarProgress profile={profile} percentage={percentage} size={roomy ? 84 : 64} reactive={isMe} />
      </div>
      <h2 className="relative mt-3 max-w-full truncate text-base font-extrabold sm:text-lg">
        {profile.display_name} <span aria-hidden>❤️</span>
      </h2>

      {progress && progress.goalsCount > 0 ? (
        <>
          <p className="relative mt-1 text-[44px] leading-none font-extrabold tracking-tight sm:text-[56px]">
            <AnimatedNumber value={shown} />
            <span className="text-[0.5em] text-navy-300">%</span>
          </p>
          <ProgressBar value={percentage} label={`Progreso de ${profile.display_name}`} className="relative mt-3" height={10} />
          <p className="relative mt-2 text-xs font-bold text-navy-300 tabular-nums sm:text-sm">
            {progress.completed} / {progress.total} tareas
          </p>
          <MotivationalMessage percentage={percentage} about={isMe ? 'me' : 'partner'} className="relative mt-2 text-cream-50/90" />
        </>
      ) : (
        <p className="relative mt-4 mb-2 rounded-full bg-white/6 px-3 py-1.5 text-xs font-bold text-navy-200">{pendingLabel ?? 'Sin metas todavía'}</p>
      )}

      {streak > 0 && (
        <p className="relative mt-3 rounded-full bg-honey-300/12 px-2.5 py-1 text-[11px] font-extrabold text-honey-300" title={`Racha de ${streak} semanas`}>
          <span aria-hidden>{streakFlames(streak)}</span> {streak} {streak === 1 ? 'semana' : 'semanas'}
        </p>
      )}
    </motion.article>
  )
}
