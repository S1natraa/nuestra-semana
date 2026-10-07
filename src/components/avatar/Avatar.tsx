/**
 * Avatar ilustrado (SVG) cuya expresión cambia con el progreso:
 * 0 cansado · 1 optimista · 2 sonrisa · 3 confiado · 4 muy feliz · 5 celebración.
 * Si la persona sube una foto, se muestra la foto con una insignia de ánimo.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { useId } from 'react'
import { ACCENTS, HAIR_COLORS, SKIN_TONES, resolveAvatar } from '@/domain/constants'
import { MOOD_LABELS, type MoodLevel } from '@/domain/mood'
import type { HairStyle, Profile } from '@/domain/types'
import { cn } from '@/lib/browser'

export type AvatarProfile = Pick<Profile, 'id' | 'display_name' | 'avatar' | 'avatar_url' | 'accent'>

interface AvatarProps {
  profile: AvatarProfile
  mood?: MoodLevel
  size?: number
  className?: string
  /** Oculta el nombre para lectores de pantalla (si ya aparece al lado). */
  decorative?: boolean
}

export function Avatar({ profile, mood = 2, size = 96, className, decorative = false }: AvatarProps) {
  const label = `${profile.display_name}, ${MOOD_LABELS[mood].toLowerCase()}`
  if (profile.avatar_url) {
    return (
      <div
        className={cn('relative shrink-0', className)}
        style={{ width: size, height: size }}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative || undefined}
      >
        <img
          src={profile.avatar_url}
          alt=""
          className="size-full rounded-full object-cover"
          style={{ boxShadow: `0 0 0 3px ${ACCENTS[profile.accent].base}` }}
          draggable={false}
        />
        <div
          className="absolute -right-1 -bottom-1 rounded-full bg-navy-900 p-[3px]"
          style={{ width: Math.max(26, size * 0.38), height: Math.max(26, size * 0.38) }}
        >
          <MoodFace mood={mood} />
        </div>
        {mood === 5 && (
          <motion.span
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl"
            style={{ fontSize: Math.max(16, size * 0.26) }}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1, rotate: [0, -8, 8, 0] }}
            transition={{ rotate: { repeat: Infinity, duration: 2.4 } }}
            aria-hidden
          >
            👑
          </motion.span>
        )}
      </div>
    )
  }
  return <IllustratedAvatar profile={profile} mood={mood} size={size} className={className} label={decorative ? undefined : label} />
}

// ─────────────────────────── Ilustración ───────────────────────────

function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
}

function IllustratedAvatar({ profile, mood, size, className, label }: { profile: AvatarProfile; mood: MoodLevel; size: number; className?: string; label?: string }) {
  const style = resolveAvatar(profile.id, profile.avatar)
  const accent = ACCENTS[profile.accent]
  const skin = SKIN_TONES[style.skin] ?? SKIN_TONES[1]!
  const hair = HAIR_COLORS[style.hairColor] ?? HAIR_COLORS[0]!
  const bgId = useSvgId('bg')
  const clipId = useSvgId('clip')

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <radialGradient id={bgId} cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor={accent.soft} />
          <stop offset="100%" stopColor={accent.base} />
        </radialGradient>
        <clipPath id={clipId}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="120" height="120" fill={`url(#${bgId})`} />
        {mood >= 4 && <BackgroundSparkles />}
        <BackHair style={style.hair} color={hair} />
        <path d="M16 126 C18 99 37 88 60 88 C83 88 102 99 104 126 Z" fill={accent.deep} />
        <path d="M49 88 Q60 97 71 88" fill="none" stroke="rgb(255 255 255 / 0.35)" strokeWidth="2" />
        <rect x="52" y="76" width="16" height="15" rx="7" fill={skin} />
        <rect x="52" y="76" width="16" height="15" rx="7" fill="rgb(0 0 0 / 0.1)" />
        <ellipse cx="33" cy="60" rx="5" ry="7" fill={skin} />
        <ellipse cx="87" cy="60" rx="5" ry="7" fill={skin} />
        <ellipse cx="60" cy="57" rx="27" ry="30" fill={skin} />
        <FrontHair style={style.hair} color={hair} />
        <AnimatePresence initial={false}>
          <motion.g
            key={mood}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.25 }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          >
            <Face mood={mood} browColor={hair} />
          </motion.g>
        </AnimatePresence>
        {mood === 5 && <PartyHat />}
      </g>
      {mood === 0 && <Snooze />}
    </svg>
  )
}

const INK = '#1b1530'

/** Solo la cara (para la insignia sobre una foto). */
export function MoodFace({ mood }: { mood: MoodLevel }) {
  return (
    <svg viewBox="30 28 60 60" className="size-full" aria-hidden>
      <circle cx="60" cy="58" r="29" fill="#ffd66b" />
      <Face mood={mood} browColor="#8a5a14" />
    </svg>
  )
}

function Face({ mood, browColor }: { mood: MoodLevel; browColor: string }) {
  return (
    <g>
      <Cheeks mood={mood} />
      <Brows mood={mood} color={browColor} />
      <Eyes mood={mood} />
      <Mouth mood={mood} />
    </g>
  )
}

function Cheeks({ mood }: { mood: MoodLevel }) {
  if (mood < 2) return null
  const opacity = [0, 0, 0.28, 0.36, 0.46, 0.55][mood]
  return (
    <g fill="#ff7fa3" opacity={opacity}>
      <ellipse cx="44" cy="67" rx="5.5" ry="3.6" />
      <ellipse cx="76" cy="67" rx="5.5" ry="3.6" />
    </g>
  )
}

const BROWS: Record<MoodLevel, [string, string]> = {
  0: ['M43 51 L53 48.5', 'M67 48.5 L77 51'],
  1: ['M43 49 Q48 46.5 53 48', 'M67 48 Q72 46.5 77 49'],
  2: ['M43 48 Q48 45 53 47', 'M67 47 Q72 45 77 48'],
  3: ['M43 48 Q48 45.5 53 47.5', 'M67 45.5 Q72 42.5 77 45.5'],
  4: ['M43 46 Q48 42.5 53 45', 'M67 45 Q72 42.5 77 46'],
  5: ['M43 44.5 Q48 40.5 53 43.5', 'M67 43.5 Q72 40.5 77 44.5'],
}

function Brows({ mood, color }: { mood: MoodLevel; color: string }) {
  const [left, right] = BROWS[mood]
  return (
    <g fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round">
      <path d={left} />
      <path d={right} />
    </g>
  )
}

function Eyes({ mood }: { mood: MoodLevel }) {
  if (mood === 0) {
    return (
      <g>
        <path d="M44.5 59 a4.5 4 0 0 0 9 0 Z" fill={INK} />
        <path d="M66.5 59 a4.5 4 0 0 0 9 0 Z" fill={INK} />
        <path d="M44 58.6 h10 M66 58.6 h10" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        <path d="M45 65 q4 2 8 0 M67 65 q4 2 8 0" fill="none" stroke={INK} strokeOpacity="0.25" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    )
  }
  if (mood >= 4) {
    return (
      <g fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round">
        <path d="M44 61 q5 -6.5 10 0" />
        <path d="M66 61 q5 -6.5 10 0" />
        {mood === 5 && (
          <g stroke="none" fill="#ffd05c">
            <path d="M37 50 l1.2 3 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2 Z" />
            <path d="M83 50 l1.2 3 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2 Z" />
          </g>
        )}
      </g>
    )
  }
  const r = mood === 1 ? 3.1 : 3.4
  return (
    <motion.g
      animate={{ scaleY: [1, 1, 0.12, 1] }}
      transition={{ duration: 4.2, times: [0, 0.93, 0.965, 1], repeat: Infinity, ease: 'easeInOut' }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    >
      <circle cx="49" cy="59" r={r} fill={INK} />
      <circle cx="71" cy="59" r={r} fill={INK} />
      <circle cx="50.2" cy="57.8" r="1" fill="#fff" />
      <circle cx="72.2" cy="57.8" r="1" fill="#fff" />
    </motion.g>
  )
}

function Mouth({ mood }: { mood: MoodLevel }) {
  switch (mood) {
    case 0:
      return <path d="M53 74.5 Q60 71.5 67 74.5" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
    case 1:
      return <path d="M53 72.5 Q60 76.5 67 72.5" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
    case 2:
      return <path d="M50.5 71.5 Q60 79.5 69.5 71.5" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
    case 3:
      return <path d="M51 72.5 Q61.5 79 70.5 69.5" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
    case 4:
      return (
        <g>
          <path d="M49 70 Q60 85 71 70 Q60 73.5 49 70 Z" fill={INK} />
          <ellipse cx="60" cy="78.2" rx="5" ry="2.6" fill="#ff8fa6" />
        </g>
      )
    case 5:
      return (
        <g>
          <path d="M46.5 68.5 Q60 90 73.5 68.5 Q60 72 46.5 68.5 Z" fill={INK} />
          <path d="M49.5 70.2 Q60 73.4 70.5 70.2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="60" cy="81" rx="6" ry="3.2" fill="#ff8fa6" />
        </g>
      )
  }
}

function BackHair({ style, color }: { style: HairStyle; color: string }) {
  if (style === 'long') {
    return <path d="M29 60 C26 33 43 20 60 20 C77 20 94 33 91 60 L93 101 C85 105 76 103 72 96 L48 96 C44 103 35 105 27 101 Z" fill={color} />
  }
  if (style === 'bun') return <circle cx="60" cy="18" r="10.5" fill={color} />
  return null
}

function FrontHair({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case 'short':
      return <path d="M31 58 C28 36 42 23 60 23 C79 23 92 35 89 58 C87 50 83 44 77 42 C71 46 58 47 46 43 C40 45 34 50 31 58 Z" fill={color} />
    case 'buzz':
      return <path d="M34 52 C34 35 46 26 60 26 C74 26 86 35 86 52 C82 44 72 39 60 39 C48 39 38 44 34 52 Z" fill={color} opacity="0.92" />
    case 'waves':
      return (
        <path
          d="M30 60 C27 37 42 21 60 21 C79 21 93 36 90 60 C88 53 85 48 81 46 C78 50 72 51 68 47 C64 51 57 51 53 47 C49 51 42 51 39 47 C35 50 32 54 30 60 Z"
          fill={color}
        />
      )
    case 'curly':
      return (
        <g fill={color}>
          <path d="M33 52 C33 38 45 30 60 30 C75 30 87 38 87 52 C80 46 70 43 60 43 C50 43 40 46 33 52 Z" />
          <circle cx="37" cy="45" r="9" />
          <circle cx="44" cy="35" r="10" />
          <circle cx="55" cy="28.5" r="10.5" />
          <circle cx="67" cy="28.5" r="10.5" />
          <circle cx="78" cy="34.5" r="10" />
          <circle cx="84" cy="45" r="9" />
          <circle cx="32.5" cy="55" r="6" />
          <circle cx="87.5" cy="55" r="6" />
        </g>
      )
    case 'long':
      return <path d="M32 54 C32 36 45 26 60 26 C75 26 88 36 88 54 C84 46 76 41 66 40 C58 44 48 45 40 44 C36 47 34 50 32 54 Z" fill={color} />
    case 'bun':
      return <path d="M32 56 C31 37 44 25 60 25 C76 25 89 37 88 56 C85 47 78 41 68 39 C60 42 48 42 42 41 C37 45 34 50 32 56 Z" fill={color} />
  }
}

function PartyHat() {
  return (
    <motion.g
      initial={{ y: -14, opacity: 0, rotate: -10 }}
      animate={{ y: 0, opacity: 1, rotate: [-10, -4, -10] }}
      transition={{ y: { type: 'spring', stiffness: 260, damping: 14 }, rotate: { repeat: Infinity, duration: 2.6 } }}
      style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
    >
      <path d="M62 2 L77 30 L47 30 Z" fill="#ffd05c" />
      <path d="M55.5 16 L69.5 16 M51.5 23.5 L73 23.5" stroke="#ff94b4" strokeWidth="3.2" />
      <circle cx="62" cy="3" r="4" fill="#ff94b4" />
    </motion.g>
  )
}

function BackgroundSparkles() {
  return (
    <g fill="#fffaf2" opacity="0.8">
      {[
        [18, 28, 0],
        [100, 22, 0.6],
        [104, 70, 1.2],
        [14, 78, 1.8],
      ].map(([x, y, delay]) => (
        <motion.path
          key={`${x}-${y}`}
          d={`M${x} ${y! - 4} l1.1 2.9 l2.9 1.1 l-2.9 1.1 l-1.1 2.9 l-1.1 -2.9 l-2.9 -1.1 l2.9 -1.1 Z`}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.15, 0.8] }}
          transition={{ duration: 2.2, delay, repeat: Infinity }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      ))}
    </g>
  )
}

function Snooze() {
  return (
    <g fill="#c9cfee" fontWeight={800} fontFamily="inherit">
      {[
        { x: 92, y: 30, size: 11, delay: 0 },
        { x: 101, y: 18, size: 14, delay: 0.9 },
      ].map((z) => (
        <motion.text
          key={z.x}
          x={z.x}
          y={z.y}
          fontSize={z.size}
          animate={{ opacity: [0, 1, 0], y: [z.y + 6, z.y - 4] }}
          transition={{ duration: 2.4, delay: z.delay, repeat: Infinity }}
        >
          z
        </motion.text>
      ))}
    </g>
  )
}
