/**
 * Consultas y comandos tipados. Cada función corresponde a una RPC de la
 * base de datos; la UI nunca escribe en tablas directamente.
 */
import type {
  AppState,
  CoupleSettings,
  GoalDraft,
  HistoryData,
  ISODate,
  Profile,
  PunishmentDraft,
  UserSettings,
  WeekDetail,
} from '@/domain/types'
import type { Backend } from './backend'

export interface SpinResult {
  segment_index: number
  segment_count: number
  punishment: { id: string; text: string; emoji: string }
}

export interface ProfilePatch {
  display_name?: string
  accent?: Profile['accent']
  avatar?: Profile['avatar']
  avatar_url?: string | null
}

export interface CoupleSettingsPatch extends Partial<CoupleSettings> {
  timezone?: string
}

export function createApi(backend: Backend) {
  const rpc = backend.rpc.bind(backend)
  return {
    getState: () => rpc<AppState>('get_state'),
    getWeek: (weekId: string) => rpc<WeekDetail>('get_week', { p_week_id: weekId }),
    getHistory: () => rpc<HistoryData>('get_history'),

    createCouple: (timezone: string) => rpc<{ id: string; invite_code: string }>('create_couple', { p_timezone: timezone }),
    joinCouple: (code: string) => rpc<{ id: string; invite_code: string }>('join_couple', { p_code: code }),

    updateProfile: (patch: ProfilePatch) => rpc<Profile>('update_profile', { p_patch: patch }),
    updateUserSettings: (patch: Partial<UserSettings>) => rpc<UserSettings>('update_user_settings', { p_patch: patch }),
    updateCoupleSettings: (patch: CoupleSettingsPatch) => rpc<CoupleSettings>('update_couple_settings', { p_patch: patch }),

    saveGoals: (weekId: string, goals: GoalDraft[]) =>
      rpc<{ saved: number }>('save_goals', {
        p_week_id: weekId,
        p_goals: goals.map((g) => ({
          title: g.title.trim(),
          description: g.description.trim() || null,
          icon: g.icon,
          target_days: g.target_days,
          days: [...g.days].sort((a, b) => a - b),
        })),
      }),
    savePunishments: (weekId: string, items: PunishmentDraft[]) =>
      rpc<{ saved: number }>('save_punishments', {
        p_week_id: weekId,
        p_items: items.map((p) => ({ text: p.text.trim(), emoji: p.emoji })),
      }),
    confirmSetup: (weekId: string) => rpc<{ both_ready: boolean }>('confirm_setup', { p_week_id: weekId }),

    setCompletion: (goalId: string, done: boolean) =>
      rpc<{ goal_id: string; day: ISODate; done: boolean }>('set_completion', { p_goal_id: goalId, p_done: done }),

    requestCorrection: (goalId: string, day: ISODate, done: boolean, note: string) =>
      rpc<{ id: string }>('request_correction', { p_goal_id: goalId, p_day: day, p_done: done, p_note: note.trim() || null }),
    resolveCorrection: (correctionId: string, approve: boolean) =>
      rpc<{ id: string; approved: boolean }>('resolve_correction', { p_correction_id: correctionId, p_approve: approve }),
    cancelCorrection: (correctionId: string) => rpc<null>('cancel_correction', { p_correction_id: correctionId }),

    spinRoulette: (weekId: string) => rpc<SpinResult>('spin_roulette', { p_week_id: weekId }),
    acceptPunishment: (weekId: string) => rpc<{ completed: boolean }>('accept_punishment', { p_week_id: weekId }),
  }
}

export type Api = ReturnType<typeof createApi>
