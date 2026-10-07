/**
 * Interpreta el estado que devuelve el servidor: qué semana está en curso,
 * cuál se está configurando, cuál tiene resultado y si hay ruletas pendientes.
 */
import { addDays, isoWeekday, mondayOf } from './dates'
import type { AppState, ISODate, RouletteResult, WeekStatus, WeekSummary, WeeklyResult } from './types'

export type Phase = 'no-couple' | 'waiting-partner' | 'weekday' | 'weekend'

export interface Calendar {
  today: ISODate
  weekday: number
  phase: Phase
  /** Semana que contiene a `today` (en fin de semana: la que acaba de terminar). */
  currentWeek: WeekSummary | null
  /** Semana siguiente (existe desde el sábado). */
  nextWeek: WeekSummary | null
  /** Semana que yo puedo configurar ahora mismo, si la hay. */
  setupWeek: WeekSummary | null
  /** Semana protagonista del encabezado. */
  focusWeek: WeekSummary | null
  focusWeekStart: ISODate
  /** Última semana cerrada con resultado. */
  resultWeek: WeekSummary | null
  /** Semanas cerradas con ruleta pendiente de girar o aceptar. */
  pendingRoulettes: WeekSummary[]
}

const CLOSED: WeekStatus[] = ['result', 'punishment', 'completed']

export function isClosed(week: WeekSummary): boolean {
  return CLOSED.includes(week.status)
}

export function isConfirmed(week: WeekSummary | null | undefined, userId: string | undefined): boolean {
  if (!week || !userId) return false
  return week.members.some((m) => m.user_id === userId && m.confirmed_at !== null)
}

export function resultFor(week: WeekSummary | null | undefined, userId: string | undefined): WeeklyResult | null {
  if (!week || !userId) return null
  return week.results.find((r) => r.user_id === userId) ?? null
}

export function rouletteFor(week: WeekSummary | null | undefined, userId: string | undefined): RouletteResult | null {
  if (!week || !userId) return null
  return week.roulette.find((r) => r.spinner_id === userId) ?? null
}

export type RouletteStage = 'none' | 'spin' | 'accept' | 'done'

/** En qué punto está la ruleta de una persona para una semana cerrada. */
export function rouletteStage(week: WeekSummary | null | undefined, userId: string | undefined): RouletteStage {
  const result = resultFor(week, userId)
  if (!week || !result?.must_spin) return 'none'
  const spin = rouletteFor(week, userId)
  if (!spin) return 'spin'
  return spin.accepted_at ? 'done' : 'accept'
}

export function hasPendingRoulette(week: WeekSummary): boolean {
  return (
    isClosed(week) &&
    week.results.some((r) => r.must_spin && !week.roulette.some((s) => s.spinner_id === r.user_id && s.accepted_at))
  )
}

export function resolveCalendar(state: AppState): Calendar {
  const today = state.today
  const weekday = isoWeekday(today)
  const monday = mondayOf(today)
  const byStart = (start: ISODate) => state.weeks.find((w) => w.week_start === start) ?? null
  const meId = state.me.id

  const phase: Phase = !state.couple
    ? 'no-couple'
    : state.couple.member_count < 2
      ? 'waiting-partner'
      : weekday <= 5
        ? 'weekday'
        : 'weekend'

  const currentWeek = byStart(monday)
  const nextWeek = byStart(addDays(monday, 7))

  let setupWeek: WeekSummary | null = null
  if (phase === 'weekend' && nextWeek && !isClosed(nextWeek)) {
    setupWeek = nextWeek
  } else if (phase === 'weekday' && currentWeek && currentWeek.status === 'active' && !isConfirmed(currentWeek, meId)) {
    setupWeek = currentWeek
  }

  const closed = state.weeks
    .filter((w) => isClosed(w) && !w.skipped)
    .sort((a, b) => (a.week_start < b.week_start ? 1 : -1))
  const resultWeek = closed[0] ?? null
  const pendingRoulettes = closed.filter(hasPendingRoulette)

  // En fin de semana el protagonista es la semana siguiente (domingo) o la
  // recién cerrada (sábado); entre semana, la semana en curso.
  let focusWeek: WeekSummary | null = currentWeek
  let focusWeekStart = monday
  if (phase === 'weekend') {
    const sunday = weekday === 7
    focusWeek = sunday ? nextWeek : (currentWeek ?? nextWeek)
    focusWeekStart = sunday || !currentWeek ? addDays(monday, 7) : monday
  }

  return {
    today,
    weekday,
    phase,
    currentWeek,
    nextWeek,
    setupWeek,
    focusWeek,
    focusWeekStart,
    resultWeek,
    pendingRoulettes,
  }
}

export const WEEK_STATUS_LABEL: Record<WeekStatus, string> = {
  setup: 'Preparación',
  active: 'Semana activa',
  closing: 'Cerrando semana',
  result: 'Resultado listo',
  punishment: 'Castigo pendiente',
  completed: 'Semana completada',
}
