/**
 * Comandos de la app. Todo se persiste vía RPC; la UI solo se actualiza de
 * forma optimista donde la inmediatez importa (marcar tareas) y siempre se
 * reconcilia con el servidor después.
 */
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { AppState, GoalDraft, ISODate, PunishmentDraft, UserSettings, WeekDetail } from '@/domain/types'
import type { CoupleSettingsPatch, ProfilePatch } from '@/services/api'
import { useApi } from './backend'
import { useAuth } from './auth'
import { queryKeys, useSession } from './queries'
import { useToast } from './toast'

function useRefreshAll() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

// ─────────────────────────── Tareas diarias ───────────────────────────

interface ToggleVars {
  goalId: string
  done: boolean
}

const COMPLETION_KEY = ['completion'] as const

export function useToggleCompletion(weekId: string | null | undefined) {
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { userId, state } = useSession()
  const weekKey = queryKeys.week(userId, weekId ?? 'none')

  const mutation = useMutation({
    mutationKey: COMPLETION_KEY,
    mutationFn: ({ goalId, done }: ToggleVars) => api.setCompletion(goalId, done),
    onMutate: async ({ goalId, done }: ToggleVars) => {
      await queryClient.cancelQueries({ queryKey: weekKey })
      const previous = queryClient.getQueryData<WeekDetail>(weekKey)
      if (previous) {
        const today = state.today
        const completions = previous.completions.filter((c) => !(c.goal_id === goalId && c.completed_on === today))
        if (done) completions.push({ goal_id: goalId, user_id: userId, completed_on: today })
        queryClient.setQueryData<WeekDetail>(weekKey, { ...previous, completions })
      }
      return { previous }
    },
    onError: (error, variables, context) => {
      if (context?.previous) queryClient.setQueryData(weekKey, context.previous)
      toast.saveError(error, () => mutation.mutate(variables))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: weekKey })
      void queryClient.invalidateQueries({ queryKey: queryKeys.state(userId) })
    },
  })
  return mutation
}

/** Metas con un cambio en vuelo (para evitar dobles clics). */
export function usePendingCompletions(): Set<string> {
  const pending = useMutationState({
    filters: { mutationKey: COMPLETION_KEY, status: 'pending' },
    select: (m) => (m.state.variables as ToggleVars | undefined)?.goalId,
  })
  return useMemo(() => new Set(pending.filter((id): id is string => Boolean(id))), [pending])
}

// ─────────────────────────── Configuración ───────────────────────────

export function useSaveGoals() {
  const api = useApi()
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: ({ weekId, goals }: { weekId: string; goals: GoalDraft[] }) => api.saveGoals(weekId, goals),
    onSuccess: refresh,
  })
}

export function useSavePunishments() {
  const api = useApi()
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: ({ weekId, items }: { weekId: string; items: PunishmentDraft[] }) => api.savePunishments(weekId, items),
    onSuccess: refresh,
  })
}

export function useConfirmSetup() {
  const api = useApi()
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (weekId: string) => api.confirmSetup(weekId),
    onSuccess: refresh,
  })
}

// ─────────────────────────── Ruleta ───────────────────────────

export function useSpinRoulette() {
  const api = useApi()
  return useMutation({
    mutationFn: (weekId: string) => api.spinRoulette(weekId),
  })
}

export function useAcceptPunishment() {
  const api = useApi()
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (weekId: string) => api.acceptPunishment(weekId),
    onSuccess: refresh,
  })
}

// ─────────────────────────── Perfil y ajustes ───────────────────────────

export function useUpdateProfile() {
  const api = useApi()
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (patch: ProfilePatch) => api.updateProfile(patch),
    onSuccess: refresh,
  })
}

export function useUpdateUserSettings() {
  const api = useApi()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const toast = useToast()
  const key = queryKeys.state(user?.id ?? 'anon')
  const mutation = useMutation({
    mutationFn: (patch: Partial<UserSettings>) => api.updateUserSettings(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<AppState>(key)
      if (previous) queryClient.setQueryData<AppState>(key, { ...previous, settings: { ...previous.settings, ...patch } })
      return { previous }
    },
    onError: (error, patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.saveError(error, () => mutation.mutate(patch))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
  return mutation
}

export function useUpdateCoupleSettings() {
  const api = useApi()
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (patch: CoupleSettingsPatch) => api.updateCoupleSettings(patch),
    onSuccess: refresh,
  })
}

// ─────────────────────────── Pareja ───────────────────────────

export function useCreateCouple() {
  const api = useApi()
  const refresh = useRefreshAll()
  return useMutation({ mutationFn: (timezone: string) => api.createCouple(timezone), onSuccess: refresh })
}

export function useJoinCouple() {
  const api = useApi()
  const refresh = useRefreshAll()
  return useMutation({ mutationFn: (code: string) => api.joinCouple(code), onSuccess: refresh })
}

// ─────────────────────────── Correcciones ───────────────────────────

export function useRequestCorrection() {
  const api = useApi()
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (v: { goalId: string; day: ISODate; done: boolean; note: string }) =>
      api.requestCorrection(v.goalId, v.day, v.done, v.note),
    onSuccess: refresh,
  })
}

export function useResolveCorrection() {
  const api = useApi()
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => api.resolveCorrection(v.id, v.approve),
    onSuccess: refresh,
  })
}

export function useCancelCorrection() {
  const api = useApi()
  const refresh = useRefreshAll()
  return useMutation({ mutationFn: (id: string) => api.cancelCorrection(id), onSuccess: refresh })
}
