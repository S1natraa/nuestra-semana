/** Tipos de dominio. Reflejan exactamente el JSON que devuelven las RPC. */

export type ISODate = string // "2026-09-28"
export type Weekday = 1 | 2 | 3 | 4 | 5 // lunes … viernes (ISO)

export type WeekStatus = 'setup' | 'active' | 'closing' | 'result' | 'punishment' | 'completed'
export type TieRule = 'both_spin' | 'nobody' | 'most_tasks'
export type Outcome = 'win' | 'loss' | 'tie'
export type Accent = 'pink' | 'sky' | 'lavender' | 'sun' | 'mint' | 'peach'
export type HairStyle = 'short' | 'curly' | 'long' | 'bun' | 'buzz' | 'waves'

export interface AvatarStyle {
  hair: HairStyle
  skin: number
  hairColor: number
}

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  avatar: Partial<AvatarStyle>
  accent: Accent
  created_at: string
  updated_at: string
}

export interface UserSettings {
  sounds_enabled: boolean
  confetti_enabled: boolean
}

export interface Couple {
  id: string
  invite_code: string
  timezone: string
  revision: number
  member_count: number
}

export interface CoupleSettings {
  tie_rule: TieRule
  streak_threshold: number
}

export interface WeekMember {
  user_id: string
  confirmed_at: string | null
}

export interface WeeklyResult {
  user_id: string
  percentage: number
  completed_tasks: number
  total_tasks: number
  goals_count: number
  goals_completed: number
  participated: boolean
  outcome: Outcome
  must_spin: boolean
}

export interface RouletteResult {
  spinner_id: string
  punishment_id: string
  segment_index: number
  segment_count: number
  spun_at: string
  accepted_at: string | null
  punishment: { text: string; emoji: string } | null
}

export interface WeekSummary {
  id: string
  week_start: ISODate
  status: WeekStatus
  skipped: boolean
  closed_at: string | null
  members: WeekMember[]
  results: WeeklyResult[]
  roulette: RouletteResult[]
}

export interface MemberStats {
  weeks: number
  average: number
  wins: number
  losses: number
  ties: number
  best: number
  perfect_weeks: number
  goals_completed: number
  current_streak: number
}

export interface Achievement {
  code: string
  title: string
  description: string
  icon: string
  sort: number
}

export interface UnlockedAchievement {
  user_id: string
  code: string
  unlocked_at: string
}

export interface PendingCorrection {
  id: string
  week_id: string
  goal_id: string
  requested_by: string
  day: ISODate
  set_done: boolean
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  goal_title: string
  goal_icon: string
}

export interface AppState {
  me: Profile
  partner: Profile | null
  settings: UserSettings
  couple: Couple | null
  couple_settings: CoupleSettings | null
  today: ISODate
  now: string
  weeks: WeekSummary[]
  stats: Record<string, MemberStats>
  achievements: UnlockedAchievement[]
  achievement_catalog: Achievement[]
  corrections: PendingCorrection[]
}

export interface Goal {
  id: string
  user_id: string
  title: string
  description: string | null
  icon: string
  target_days: number
  position: number
  days: Weekday[]
}

export interface Completion {
  goal_id: string
  user_id: string
  completed_on: ISODate
}

export interface Punishment {
  id: string
  author_id: string
  target_id: string
  text: string
  emoji: string
  position: number
}

export interface Correction {
  id: string
  week_id: string
  goal_id: string
  requested_by: string
  day: ISODate
  set_done: boolean
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

export interface WeekDetail {
  week: WeekSummary
  goals: Goal[]
  completions: Completion[]
  punishments: Punishment[]
  incoming_punishments: number
  corrections: Correction[]
}

export interface HistoryData {
  weeks: WeekSummary[]
  stats: Record<string, MemberStats>
}

/** Borradores que el usuario edita en la configuración del domingo. */
export interface GoalDraft {
  key: string
  title: string
  description: string
  icon: string
  target_days: number
  days: Weekday[]
  flexible: boolean
}

export interface PunishmentDraft {
  key: string
  text: string
  emoji: string
}
