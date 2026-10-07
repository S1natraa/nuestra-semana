import { describe, expect, it } from 'vitest'
import {
  addDays,
  formatLongDay,
  formatWeekRange,
  formatWeekRangeCompact,
  isoWeekday,
  mondayOf,
  todayInTimeZone,
} from './dates'
import { moodLevel, motivationalMessage } from './mood'
import { dayCellState, memberProgress, todayTasks, todaySummary } from './progress'
import { planSpin, segmentAtRotation } from './roulette'
import { firstOpenWeekday, validateGoal, validatePunishments } from './validation'
import type { Completion, Goal, GoalDraft, Weekday } from './types'

const W = '2026-09-28'

function goal(id: string, target: number, days: Weekday[]): Goal {
  return { id, user_id: 'u', title: id, description: null, icon: '🎯', target_days: target, position: 0, days }
}
function done(goalId: string, ...dates: string[]): Completion[] {
  return dates.map((completed_on) => ({ goal_id: goalId, user_id: 'u', completed_on }))
}

describe('fechas', () => {
  it('calcula la semana sin depender de la zona horaria', () => {
    expect(isoWeekday('2026-09-28')).toBe(1)
    expect(isoWeekday('2026-10-04')).toBe(7)
    expect(mondayOf('2026-10-03')).toBe('2026-09-28')
    expect(mondayOf('2026-10-04')).toBe('2026-09-28')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('formatea en español como en el diseño', () => {
    expect(formatWeekRange('2026-09-28')).toBe('28 sep — 2 oct, 2026')
    expect(formatWeekRange('2025-12-29')).toBe('29 dic, 2025 — 2 ene, 2026')
    expect(formatWeekRangeCompact('2026-09-21')).toBe('21 sep – 25 sep')
    expect(formatLongDay('2026-09-29')).toBe('Martes 29 de septiembre')
    expect(formatLongDay('2026-09-30')).toBe('Miércoles 30 de septiembre')
  })

  it('obtiene el día actual en la zona de la pareja', () => {
    const instant = new Date('2026-09-28T03:00:00Z')
    expect(todayInTimeZone('America/Mexico_City', instant)).toBe('2026-09-27')
    expect(todayInTimeZone('Europe/Madrid', instant)).toBe('2026-09-28')
  })
})

describe('progreso', () => {
  it('cada meta pesa lo mismo (ejemplo de la especificación = 85 %)', () => {
    const goals = [goal('gym', 5, [1, 2, 3, 4, 5]), goal('fr', 5, [1, 2, 3, 4, 5]), goal('sec', 5, [1, 2, 3, 4, 5]), goal('food', 5, [1, 2, 3, 4, 5])]
    const completions = [
      ...done('gym', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'),
      ...done('fr', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'),
      ...done('sec', '2026-09-28', '2026-09-30', '2026-10-02'),
      ...done('food', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'),
    ]
    expect(memberProgress(goals, completions, W).percentage).toBe(85)
  })

  it('no usa tareas completadas / tareas totales', () => {
    const goals = [goal('run', 3, [1, 2, 3, 4, 5]), goal('read', 5, [1, 2, 3, 4, 5]), goal('med', 2, [2, 4])]
    const completions = [
      ...done('run', '2026-09-28', '2026-09-29', '2026-09-30'),
      ...done('read', '2026-09-28', '2026-09-29'),
      ...done('med', '2026-09-29'),
    ]
    const p = memberProgress(goals, completions, W)
    expect(p.percentage).toBe(63.33)
    expect(p.completed).toBe(6)
    expect(p.total).toBe(10)
    expect(p.goalsCompleted).toBe(1)
  })

  it('ignora completados fuera de la semana o de los días de la meta', () => {
    const goals = [goal('g', 2, [1, 3])]
    const completions = [...done('g', '2026-09-28', '2026-09-29', '2026-10-05')]
    expect(memberProgress(goals, completions, W).percentage).toBe(50)
  })

  it('sin participación o sin metas es 0 %', () => {
    expect(memberProgress([], [], W).percentage).toBe(0)
    expect(memberProgress([goal('g', 1, [1])], done('g', W), W, false).percentage).toBe(0)
  })

  it('las tareas de hoy incluyen solo lo programado y bloquean flexibles cumplidas', () => {
    const goals = [goal('fixed', 2, [1, 3]), goal('flex', 2, [1, 2, 3, 4, 5]), goal('off', 1, [5])]
    const completions = [...done('flex', '2026-09-28', '2026-09-29')]
    const tasks = todayTasks(goals, completions, '2026-09-30', W)
    expect(tasks.map((t) => [t.goal.id, t.state])).toEqual([
      ['fixed', 'todo'],
      ['flex', 'met'],
    ])
    expect(todaySummary(tasks)).toEqual({ done: 0, total: 1, percentage: 0 })
    expect(todayTasks(goals, completions, '2026-10-03', W)).toEqual([])
  })

  it('estado de cada día en la vista semanal', () => {
    const fixed = goal('fixed', 2, [1, 3])
    const flex = goal('flex', 2, [1, 2, 3, 4, 5])
    const completions = done('fixed', '2026-09-28')
    const today = '2026-09-30'
    expect(dayCellState(fixed, completions, W, 1, today)).toBe('done')
    expect(dayCellState(fixed, completions, W, 2, today)).toBe('off')
    expect(dayCellState(fixed, completions, W, 3, today)).toBe('today')
    expect(dayCellState(flex, completions, W, 1, today)).toBe('free')
    expect(dayCellState(flex, completions, W, 4, today)).toBe('upcoming')
    expect(dayCellState(goal('f2', 2, [1, 2]), [], W, 1, today)).toBe('missed')
  })
})

describe('ánimo y mensajes', () => {
  it('niveles del avatar según la especificación', () => {
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 99, 99.4, 99.6, 100].map(moodLevel)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5,
    ])
  })

  it('mensajes motivacionales por rango', () => {
    expect(motivationalMessage(10).text).toBe('Vamos, apenas comienza la semana.')
    expect(motivationalMessage(30).text).toBe('Buen comienzo.')
    expect(motivationalMessage(50).text).toBe('Ya llevas más de la mitad.')
    expect(motivationalMessage(70).text).toBe('¡Vas muy bien!')
    expect(motivationalMessage(90).text).toBe('¡Casi lo tienes!')
    expect(motivationalMessage(100).text).toBe('¡Semana perfecta! 🔥')
  })
})

describe('ruleta', () => {
  it('la animación siempre aterriza en el segmento elegido por el servidor', () => {
    let seed = 42
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    for (let count = 3; count <= 5; count++) {
      for (let index = 0; index < count; index++) {
        let rotation = random() * 1000
        for (let trial = 0; trial < 200; trial++) {
          const plan = planSpin(rotation, index, count, random)
          expect(segmentAtRotation(plan.rotation, count)).toBe(index)
          expect(plan.rotation - rotation).toBeGreaterThanOrEqual(6 * 360)
          rotation = plan.rotation
        }
      }
    }
  })

  it('el punto de parada varía dentro del segmento', () => {
    const stops = new Set<number>()
    for (let i = 0; i < 50; i++) stops.add(Math.round(planSpin(0, 2, 5).rotation % 360))
    expect(stops.size).toBeGreaterThan(10)
  })
})

describe('validaciones', () => {
  const base: GoalDraft = { key: 'k', title: 'Gym', description: '', icon: '🏋️', target_days: 3, days: [1, 3, 5], flexible: false }

  it('metas', () => {
    expect(validateGoal(base)).toBeNull()
    expect(validateGoal({ ...base, title: ' ' })).toBe('Cada meta necesita un nombre.')
    expect(validateGoal({ ...base, days: [1, 3] })).toBe('Elige 3 días.')
    expect(validateGoal({ ...base, days: [1, 2, 3, 4] })).toBe('Elige exactamente 3 días.')
    expect(validateGoal({ ...base, flexible: true, days: [1, 2, 3, 4, 5] })).toBeNull()
    expect(validateGoal({ ...base, days: [3, 4, 5] }, 3)).toBeNull()
    expect(validateGoal({ ...base, days: [2, 4, 5] }, 3)).toBe('La semana ya empezó: elige días a partir de hoy.')
    expect(validateGoal({ ...base, target_days: 4, days: [2, 3, 4, 5] }, 3)).toBe('Solo quedan 3 días en esta semana.')
  })

  it('primer día disponible', () => {
    expect(firstOpenWeekday(W, '2026-09-27')).toBe(1)
    expect(firstOpenWeekday(W, '2026-09-28')).toBe(1)
    expect(firstOpenWeekday(W, '2026-09-30')).toBe(3)
  })

  it('castigos', () => {
    const p = (text: string) => ({ key: text, text, emoji: '🎲' })
    expect(validatePunishments([p('Invitar la cena'), p('Preparar el desayuno')])).toBe('Agrega al menos 3 castigos.')
    expect(validatePunishments([p('Invitar la cena'), p('Preparar el desayuno'), p(' ')])).toBe('Ningún castigo puede quedar vacío.')
    expect(validatePunishments([p('a1'), p('a2'), p('a3'), p('a4'), p('a5'), p('a6')])).toContain('como máximo 5')
    expect(validatePunishments([p('Invitar la cena'), p('Preparar el desayuno'), p('Una bofetada')])).toContain('no parece seguro')
    expect(validatePunishments([p('Invitar la cena'), p('Preparar el desayuno'), p('Lavar el coche')])).toBeNull()
  })
})
