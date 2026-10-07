/**
 * DATOS DEMO. Genera varias semanas de historia para Dani y Sami usando las
 * mismas funciones RPC que la app (con el reloj simulado), así que todo lo que
 * se ve en el modo demo pasó por las reglas reales: configuración del domingo,
 * tareas día a día, cierre del viernes, ruleta y logros.
 * Solo se usa en el modo demo; nunca toca Supabase.
 */
import type { PGlite } from '@electric-sql/pglite'
import { resolveCalendar } from '@/domain/calendar'
import { addDays, isoWeekday, mondayOf, todayInTimeZone, zonedTimeToInstant } from '@/domain/dates'
import type { AppState, WeekDetail, WeekSummary } from '@/domain/types'
import { callRpc, createDemoUser, setClockOffsetSeconds, setSimulatedNow } from './pgliteDb'

interface SeedGoal {
  title: string
  icon: string
  target_days: number
  days: number[]
  description?: string
}

const DANI_GOALS: SeedGoal[] = [
  { icon: '🏋️', title: 'Ir al gym', target_days: 4, days: [1, 2, 4, 5] },
  { icon: '🥗', title: 'Comer saludable', target_days: 5, days: [1, 2, 3, 4, 5], description: 'Nada de comida rápida' },
  { icon: '⏰', title: 'Levantarse temprano', target_days: 5, days: [1, 2, 3, 4, 5] },
  { icon: '🇫🇷', title: 'Estudiar francés', target_days: 5, days: [1, 2, 3, 4, 5] },
  { icon: '💻', title: 'Estudiar Security+', target_days: 3, days: [1, 2, 3, 4, 5] },
]

const SAMI_GOALS: SeedGoal[] = [
  { icon: '🏃', title: 'Correr', target_days: 3, days: [1, 2, 3, 4, 5], description: 'Mínimo 5 km' },
  { icon: '📚', title: 'Leer 20 minutos', target_days: 5, days: [1, 2, 3, 4, 5] },
  { icon: '💧', title: 'Tomar 2 L de agua', target_days: 5, days: [1, 2, 3, 4, 5] },
  { icon: '🧘', title: 'Meditar', target_days: 4, days: [1, 2, 3, 4] },
  { icon: '🎸', title: 'Practicar guitarra', target_days: 2, days: [1, 2, 3, 4, 5] },
]

const DANI_PUNISHMENTS = [
  { emoji: '🍕', text: 'Invitar la cena' },
  { emoji: '🍳', text: 'Preparar el desayuno' },
  { emoji: '🏃', text: 'Hacer 30 minutos de cardio' },
  { emoji: '🎬', text: 'Dejar que yo elija la película' },
  { emoji: '🧹', text: 'Hacer una tarea doméstica' },
]

const SAMI_PUNISHMENTS = [
  { emoji: '💆', text: 'Dar un masaje de 15 minutos' },
  { emoji: '🍰', text: 'Comprar mi postre favorito' },
  { emoji: '☕', text: 'Llevarme el café a la cama' },
  { emoji: '🧺', text: 'Doblar la ropa del fin de semana' },
  { emoji: '🚗', text: 'Lavar el coche' },
]

/** Probabilidad de cumplir cada tarea en cada semana pasada (de la más antigua a la más reciente). */
const PAST_WEEKS = [
  { dani: 0.7, sami: 0.88 },
  { dani: 0.92, sami: 0.72 },
  { dani: 0.82, sami: 0.93 },
  { dani: 0.96, sami: 0.64 },
  { dani: 1, sami: 0.84 },
  { dani: 0.88, sami: 0.66 },
]

export interface SeedOptions {
  timeZone: string
  now?: Date
  onProgress?: (fraction: number) => void
}

export interface SeedResult {
  daniId: string
  samiId: string
}

export async function seedDemo(db: PGlite, options: SeedOptions): Promise<SeedResult> {
  const { timeZone } = options
  const now = options.now ?? new Date()
  const today = todayInTimeZone(timeZone, now)
  const thisMonday = mondayOf(today)
  const weekday = isoWeekday(today)
  const random = mulberry32(20260928)

  const travel = (date: string, hour: number, minute = 0) =>
    setSimulatedNow(db, zonedTimeToInstant(date, hour, minute, timeZone))

  const dani = await createDemoUser(db, 'Dani', 'dani@demo.local')
  const sami = await createDemoUser(db, 'Sami', 'sami@demo.local')
  const as = (user: string) => (fn: string, args: Record<string, unknown> = {}) => callRpc(db, user, fn, args)

  await as(dani)('update_profile', { p_patch: { accent: 'pink', avatar: { hair: 'short', skin: 1, hairColor: 0 } } })
  await as(sami)('update_profile', { p_patch: { accent: 'sky', avatar: { hair: 'curly', skin: 2, hairColor: 1 } } })

  // En fin de semana la semana actual ya terminó: se juega completa.
  const weekendToday = weekday >= 6
  const mondays = PAST_WEEKS.map((_, i) => addDays(thisMonday, -7 * (PAST_WEEKS.length - i)))
  const plan = PAST_WEEKS.map((perf, i) => ({ monday: mondays[i]!, perf }))
  if (weekendToday) plan.push({ monday: thisMonday, perf: { dani: 0.8, sami: 0.9 } })

  const totalSteps = plan.length + (weekendToday ? 0 : 1)
  let step = 0
  const progress = () => options.onProgress?.(Math.min(1, ++step / totalSteps))

  await travel(addDays(plan[0]!.monday, -1), 11)
  const couple = (await as(dani)('create_couple', { p_timezone: timeZone })) as { invite_code: string }
  await as(sami)('join_couple', { p_code: couple.invite_code })

  const setupWeek = async (monday: string) => {
    await travel(addDays(monday, -1), 18)
    let weekId = ''
    for (const [user, goals, punishments] of [
      [dani, DANI_GOALS, DANI_PUNISHMENTS],
      [sami, SAMI_GOALS, SAMI_PUNISHMENTS],
    ] as const) {
      const state = (await as(user)('get_state')) as AppState
      const setup = resolveCalendar(state).setupWeek
      if (!setup || setup.week_start !== monday) throw new Error(`Seed: no se pudo abrir la semana ${monday}`)
      weekId = setup.id
      await as(user)('save_goals', { p_week_id: weekId, p_goals: goals })
      await as(user)('save_punishments', { p_week_id: weekId, p_items: punishments })
      await as(user)('confirm_setup', { p_week_id: weekId })
    }
    return (await as(dani)('get_week', { p_week_id: weekId })) as WeekDetail
  }

  const playDay = async (detail: WeekDetail, monday: string, day: number, perf: { dani: number; sami: number }, share = 1) => {
    const date = addDays(monday, day - 1)
    const counts = new Map<string, number>()
    for (const c of detail.completions) counts.set(c.goal_id, (counts.get(c.goal_id) ?? 0) + 1)
    for (const goal of detail.goals) {
      if (!goal.days.includes(day as never)) continue
      const done = counts.get(goal.id) ?? 0
      if (done >= goal.target_days) continue
      const probability = (goal.user_id === dani ? perf.dani : perf.sami) * share
      // Las metas flexibles se reparten a lo largo de la semana.
      const remainingDays = goal.days.filter((d) => d >= day).length
      const needed = goal.target_days - done
      const flexibleBoost = goal.days.length > goal.target_days ? needed / remainingDays : 1
      if (random() < probability * Math.min(1, flexibleBoost + 0.15)) {
        await as(goal.user_id)('set_completion', { p_goal_id: goal.id, p_done: true })
        detail.completions.push({ goal_id: goal.id, user_id: goal.user_id, completed_on: date })
      }
    }
  }

  for (const [index, { monday, perf }] of plan.entries()) {
    const detail = await setupWeek(monday)
    for (let day = 1; day <= 5; day++) {
      await travel(addDays(monday, day - 1), 20, 30)
      await playDay(detail, monday, day, perf)
    }
    // Cierre: el sábado a primera hora.
    await travel(addDays(monday, 5), 0, 5)
    const state = (await as(dani)('get_state')) as AppState
    const closed = state.weeks.find((w) => w.week_start === monday)
    // La ruleta de la semana cerrada más reciente queda pendiente para probarla.
    if (closed && index < plan.length - 1) await settleRoulette(as, closed)
    progress()
  }

  if (!weekendToday) {
    // Semana en curso: configurada el domingo y cumplida hasta hoy.
    const detail = await setupWeek(thisMonday)
    for (let day = 1; day < weekday; day++) {
      await travel(addDays(thisMonday, day - 1), 20, 30)
      await playDay(detail, thisMonday, day, { dani: 0.9, sami: 0.8 })
    }
    await travel(today, 7, 30)
    await playDay(detail, thisMonday, weekday, { dani: 0.9, sami: 0.8 }, 0.45)
    progress()
  }

  // De vuelta al presente (o al "ahora" indicado, en las pruebas).
  if (options.now) await setSimulatedNow(db, options.now)
  else await setClockOffsetSeconds(db, 0)
  await as(dani)('get_state')
  return { daniId: dani, samiId: sami }
}

async function settleRoulette(
  as: (user: string) => (fn: string, args?: Record<string, unknown>) => Promise<unknown>,
  week: WeekSummary,
) {
  for (const result of week.results) {
    if (!result.must_spin) continue
    await as(result.user_id)('spin_roulette', { p_week_id: week.id })
    await as(result.user_id)('accept_punishment', { p_week_id: week.id })
  }
}

/** PRNG determinista para que la historia demo sea siempre la misma. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
