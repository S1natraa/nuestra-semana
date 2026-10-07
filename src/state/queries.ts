import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { resolveCalendar, type Calendar } from '@/domain/calendar'
import type { AppState, CoupleSettings, Profile, UserSettings } from '@/domain/types'
import { useApi, useBackend } from './backend'
import { useAuth } from './auth'

export const queryKeys = {
  state: (userId: string) => ['state', userId] as const,
  week: (userId: string, weekId: string) => ['week', userId, weekId] as const,
  history: (userId: string) => ['history', userId] as const,
}

export function useAppStateQuery() {
  const api = useApi()
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.state(user?.id ?? 'anon'),
    queryFn: api.getState,
    enabled: Boolean(user),
    // Detecta el cambio de día y cierres de semana aunque la app quede abierta.
    refetchInterval: 60_000,
    staleTime: 10_000,
  })
}

export function useWeekQuery(weekId: string | null | undefined) {
  const api = useApi()
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.week(user?.id ?? 'anon', weekId ?? 'none'),
    queryFn: () => api.getWeek(weekId!),
    enabled: Boolean(user && weekId),
    staleTime: 10_000,
  })
}

export function useHistoryQuery() {
  const api = useApi()
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.history(user?.id ?? 'anon'),
    queryFn: api.getHistory,
    enabled: Boolean(user),
    staleTime: 30_000,
  })
}

// ─────────────────────────── Sesión cargada ───────────────────────────

export interface Session {
  state: AppState
  me: Profile
  partner: Profile | null
  calendar: Calendar
  settings: UserSettings
  coupleSettings: CoupleSettings
  userId: string
}

export const SessionContext = createContext<Session | null>(null)

export function buildSession(state: AppState): Session {
  return {
    state,
    me: state.me,
    partner: state.partner,
    calendar: resolveCalendar(state),
    settings: state.settings ?? { sounds_enabled: false, confetti_enabled: true },
    coupleSettings: state.couple_settings ?? { tie_rule: 'both_spin', streak_threshold: 80 },
    userId: state.me.id,
  }
}

/** Datos de la sesión ya cargados (solo dentro del shell autenticado). */
export function useSession(): Session {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession debe usarse dentro del shell de la app')
  return ctx
}

export function useSessionMemo(state: AppState | undefined): Session | null {
  return useMemo(() => (state ? buildSession(state) : null), [state])
}

/** Refresca todo cuando la pareja cambia algo (Supabase Realtime). */
export function useCoupleRealtime(coupleId: string | null | undefined) {
  const backend = useBackend()
  const queryClient = useQueryClient()
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!coupleId) return
    const unsubscribe = backend.subscribeCouple(coupleId, () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void queryClient.invalidateQueries(), 250)
    })
    return () => {
      window.clearTimeout(timer.current)
      unsubscribe()
    }
  }, [backend, coupleId, queryClient])
}
