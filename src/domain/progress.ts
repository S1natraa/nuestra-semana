/**
 * Cálculo de progreso. Cada META pesa lo mismo en el porcentaje semanal:
 *   porcentaje = promedio( min(días cumplidos, objetivo) / objetivo )
 * Es la misma fórmula que usa la función SQL public.week_progress al cerrar
 * la semana (hay pruebas que verifican que ambas coinciden).
 */
import { dateOfWeekday, fridayOf, isoWeekday } from './dates'
import type { Completion, Goal, ISODate, Weekday } from './types'

export interface GoalProgress {
  goal: Goal
  /** Días cumplidos que cuentan (limitado al objetivo). */
  done: number
  target: number
  ratio: number
  complete: boolean
}

export interface MemberProgress {
  /** 0–100 con dos decimales, igual que en la base de datos. */
  percentage: number
  completed: number
  total: number
  goalsCount: number
  goalsCompleted: number
  goals: GoalProgress[]
}

export function isFlexible(goal: Pick<Goal, 'days' | 'target_days'>): boolean {
  return goal.days.length > goal.target_days
}

function countsForGoal(goal: Goal, completion: Completion, weekStart: ISODate): boolean {
  if (completion.goal_id !== goal.id) return false
  if (completion.completed_on < weekStart || completion.completed_on > fridayOf(weekStart)) return false
  return goal.days.includes(isoWeekday(completion.completed_on) as Weekday)
}

export function goalProgress(goal: Goal, completions: Completion[], weekStart: ISODate): GoalProgress {
  const count = completions.filter((c) => countsForGoal(goal, c, weekStart)).length
  const done = Math.min(count, goal.target_days)
  const ratio = goal.target_days > 0 ? done / goal.target_days : 0
  return { goal, done, target: goal.target_days, ratio, complete: done >= goal.target_days }
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function memberProgress(
  goals: Goal[],
  completions: Completion[],
  weekStart: ISODate,
  participated = true,
): MemberProgress {
  const perGoal = goals.map((g) => goalProgress(g, completions, weekStart))
  if (!participated || perGoal.length === 0) {
    return { percentage: 0, completed: 0, total: 0, goalsCount: 0, goalsCompleted: 0, goals: perGoal }
  }
  const average = perGoal.reduce((sum, g) => sum + g.ratio, 0) / perGoal.length
  return {
    percentage: round2(average * 100),
    completed: perGoal.reduce((sum, g) => sum + g.done, 0),
    total: perGoal.reduce((sum, g) => sum + g.target, 0),
    goalsCount: perGoal.length,
    goalsCompleted: perGoal.filter((g) => g.complete).length,
    goals: perGoal,
  }
}

/** Porcentaje que ve el usuario (y el que decide al ganador). */
export function displayPercent(percentage: number): number {
  return Math.round(percentage)
}

// ─────────────────────────── Tareas de hoy ───────────────────────────

export type TodayTaskState = 'todo' | 'done' | 'met'

export interface TodayTask {
  goal: Goal
  state: TodayTaskState
  /** Días que cuentan esta semana, incluido hoy si está hecho. */
  weekDone: number
  target: number
}

/**
 * Tareas programadas para `today`. Una meta flexible cuyo objetivo semanal ya
 * se alcanzó en otros días queda como `met` y no puede marcarse de nuevo.
 */
export function todayTasks(goals: Goal[], completions: Completion[], today: ISODate, weekStart: ISODate): TodayTask[] {
  const weekday = isoWeekday(today)
  if (weekday > 5 || today < weekStart || today > fridayOf(weekStart)) return []
  return goals
    .filter((g) => g.days.includes(weekday as Weekday))
    .map((goal) => {
      const mine = completions.filter((c) => countsForGoal(goal, c, weekStart))
      const doneToday = mine.some((c) => c.completed_on === today)
      const otherDays = mine.filter((c) => c.completed_on !== today).length
      const state: TodayTaskState = doneToday ? 'done' : otherDays >= goal.target_days ? 'met' : 'todo'
      return { goal, state, weekDone: Math.min(mine.length, goal.target_days), target: goal.target_days }
    })
}

export function todaySummary(tasks: TodayTask[]): { done: number; total: number; percentage: number } {
  const counted = tasks.filter((t) => t.state !== 'met')
  const done = counted.filter((t) => t.state === 'done').length
  return { done, total: counted.length, percentage: counted.length ? (done / counted.length) * 100 : 0 }
}

// ─────────────────────────── Vista semanal ───────────────────────────

export type DayCellState = 'done' | 'missed' | 'free' | 'today' | 'upcoming' | 'off'

/** Estado de un día (1-5) para una meta, visto desde `today`. */
export function dayCellState(goal: Goal, completions: Completion[], weekStart: ISODate, weekday: number, today: ISODate): DayCellState {
  const date = dateOfWeekday(weekStart, weekday)
  if (completions.some((c) => c.goal_id === goal.id && c.completed_on === date)) return 'done'
  if (!goal.days.includes(weekday as Weekday)) return 'off'
  if (date === today) return 'today'
  if (date > today) return 'upcoming'
  return isFlexible(goal) ? 'free' : 'missed'
}

/** Mayor porcentaje que todavía puede alcanzarse (útil para mensajes). */
export function maxReachablePercent(goals: Goal[], completions: Completion[], weekStart: ISODate, today: ISODate): number {
  if (goals.length === 0) return 0
  const todayWeekday = Math.min(isoWeekday(today), 6)
  const ratios = goals.map((goal) => {
    const { done } = goalProgress(goal, completions, weekStart)
    const remaining = goal.days.filter((d) => {
      const date = dateOfWeekday(weekStart, d)
      return d >= todayWeekday && !completions.some((c) => c.goal_id === goal.id && c.completed_on === date)
    }).length
    return Math.min(goal.target_days, done + remaining) / goal.target_days
  })
  return round2((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100)
}
