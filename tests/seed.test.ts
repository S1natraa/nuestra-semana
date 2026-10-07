/** El seed del modo demo produce un estado coherente sea cual sea el día. */
import { describe, expect, it } from 'vitest'
import { callRpc, openDatabase } from '../src/demo/pgliteDb'
import { seedDemo } from '../src/demo/seed'
import { isConfirmed, resolveCalendar, rouletteStage } from '../src/domain/calendar'
import { zonedTimeToInstant } from '../src/domain/dates'
import type { AppState, HistoryData } from '../src/domain/types'

const TZ = 'America/Mexico_City'

describe.each([
  ['lunes', '2026-09-28', 'weekday'],
  ['miércoles', '2026-09-30', 'weekday'],
  ['sábado', '2026-10-03', 'weekend'],
  ['domingo', '2026-10-04', 'weekend'],
] as const)('seed demo un %s', (_label, today, phase) => {
  it('genera historia, ruleta pendiente y la semana correcta', async () => {
    const db = await openDatabase()
    const started = performance.now()
    const { daniId, samiId } = await seedDemo(db, { timeZone: TZ, now: zonedTimeToInstant(today, 10, 0, TZ) })
    const elapsed = performance.now() - started

    const state = (await callRpc(db, daniId, 'get_state')) as AppState
    const cal = resolveCalendar(state)
    expect(state.today).toBe(today)
    expect(cal.phase).toBe(phase)

    const history = (await callRpc(db, daniId, 'get_history')) as HistoryData
    expect(history.weeks.length).toBe(phase === 'weekend' ? 7 : 6)
    expect(cal.pendingRoulettes).toHaveLength(1)
    expect(cal.pendingRoulettes[0]!.id).toBe(cal.resultWeek!.id)
    const stages = [rouletteStage(cal.resultWeek, daniId), rouletteStage(cal.resultWeek, samiId)]
    expect(stages).toContain('spin')

    if (phase === 'weekday') {
      expect(cal.currentWeek?.status).toBe('active')
      expect(isConfirmed(cal.currentWeek, daniId) && isConfirmed(cal.currentWeek, samiId)).toBe(true)
      expect(cal.setupWeek).toBeNull()
    } else if (today === '2026-10-04') {
      expect(cal.setupWeek?.week_start).toBe('2026-10-05')
      expect(isConfirmed(cal.setupWeek, daniId)).toBe(false)
    }

    // Historia variada: ambos han ganado alguna vez.
    expect(history.stats[daniId]!.wins).toBeGreaterThan(0)
    expect(history.stats[samiId]!.wins).toBeGreaterThan(0)
    expect(state.achievements.length).toBeGreaterThan(4)
    console.info(`seed (${today}): ${Math.round(elapsed)} ms`)
    await db.close()
  })
})
