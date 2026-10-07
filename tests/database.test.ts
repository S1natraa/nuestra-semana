/**
 * Pruebas de la base de datos real (misma migración que Supabase) ejecutada
 * en PGlite. Recorre semanas completas con reloj simulado:
 * DOMINGO → CONFIGURAR · LUNES…VIERNES → COMPLETAR · SÁBADO → CERRAR
 * RESULTADO → GANADOR/PERDEDOR · RULETA → CASTIGO · HISTORIAL → REGISTRO
 */
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { callRpc, createDemoUser, openDatabase, queryAs, setSimulatedNow } from '../src/demo/pgliteDb'
import { resolveCalendar, rouletteStage } from '../src/domain/calendar'
import { memberProgress } from '../src/domain/progress'
import { isSafePunishment } from '../src/domain/validation'
import type { AppState, HistoryData, WeekDetail, WeekSummary } from '../src/domain/types'

const TZ = 'America/Mexico_City' // UTC−6 todo el año

/** Hora local de la pareja → instante UTC. */
function local(date: string, hour: number, minute = 0): Date {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-06:00`)
}

let db: PGlite
let dani: string
let sami: string
let outsider: string

const as = (user: string) => (fn: string, args: Record<string, unknown> = {}) => callRpc(db, user, fn, args)
const state = async (user: string) => (await as(user)('get_state')) as AppState
const week = async (user: string, id: string) => (await as(user)('get_week', { p_week_id: id })) as WeekDetail
const at = (date: string, hour = 10, minute = 0) => setSimulatedNow(db, local(date, hour, minute))

function goalId(detail: WeekDetail, userId: string, title: string): string {
  const goal = detail.goals.find((g) => g.user_id === userId && g.title === title)
  if (!goal) throw new Error(`No existe la meta ${title}`)
  return goal.id
}

async function weekByStart(user: string, start: string): Promise<WeekSummary> {
  const s = await state(user)
  const w = s.weeks.find((x) => x.week_start === start)
  if (!w) throw new Error(`No existe la semana ${start}`)
  return w
}

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
]

beforeAll(async () => {
  db = await openDatabase()
  dani = await createDemoUser(db, 'Dani', 'dani@example.test')
  sami = await createDemoUser(db, 'Sami', 'sami@example.test')
  outsider = await createDemoUser(db, 'Alex', 'alex@example.test')
})

afterAll(async () => {
  await db?.close()
})

describe('pareja y perfiles', () => {
  it('crea perfil y preferencias al registrarse', async () => {
    const s = await state(dani)
    expect(s.me.display_name).toBe('Dani')
    expect(s.settings).toEqual({ sounds_enabled: false, confetti_enabled: true, updated_at: expect.any(String) })
    expect(s.couple).toBeNull()
  })

  it('crea la pareja con código de invitación y se une con él', async () => {
    await at('2026-10-04', 9)
    const created = (await as(dani)('create_couple', { p_timezone: TZ })) as { invite_code: string }
    expect(created.invite_code).toMatch(/^[A-Z0-9]{6}$/)
    await expect(as(dani)('create_couple', { p_timezone: TZ })).rejects.toThrow('Ya perteneces a una pareja.')

    await expect(as(sami)('join_couple', { p_code: 'ZZZZZZ' })).rejects.toThrow('Ese código de invitación no existe.')
    await as(sami)('join_couple', { p_code: ` ${created.invite_code.toLowerCase()} ` })
    await as(sami)('join_couple', { p_code: created.invite_code }) // idempotente

    await expect(as(outsider)('join_couple', { p_code: created.invite_code })).rejects.toThrow('Esta pareja ya está completa.')

    const s = await state(sami)
    expect(s.couple?.member_count).toBe(2)
    expect(s.couple?.timezone).toBe(TZ)
    expect(s.partner?.display_name).toBe('Dani')
  })

  it('actualiza nombre, color y avatar con validación', async () => {
    await as(sami)('update_profile', { p_patch: { display_name: '  Sami  ', accent: 'sky', avatar: { hair: 'curly', skin: 2, hairColor: 1 } } })
    const s = await state(dani)
    expect(s.partner?.display_name).toBe('Sami')
    expect(s.partner?.accent).toBe('sky')
    expect(s.partner?.avatar).toEqual({ hair: 'curly', skin: 2, hairColor: 1 })
    await expect(as(sami)('update_profile', { p_patch: { display_name: '   ' } })).rejects.toThrow('entre 1 y 30')
    await expect(as(sami)('update_profile', { p_patch: { accent: 'rojo' } })).rejects.toThrow('color')
    await expect(as(sami)('update_profile', { p_patch: { avatar_url: 'javascript:alert(1)' } })).rejects.toThrow('imagen')
  })

  it('nadie fuera de la pareja puede ver sus datos', async () => {
    const s = await state(outsider)
    expect(s.couple).toBeNull()
    expect(s.partner).toBeNull()
    expect(await queryAs(db, outsider, 'select * from public.profiles')).toHaveLength(1)
    expect(await queryAs(db, outsider, 'select * from public.couples')).toHaveLength(0)
  })
})

describe('semana 1 · flujo completo', () => {
  const W1 = '2026-10-05'
  let weekId: string

  it('DOMINGO: abre la configuración de la semana siguiente', async () => {
    await at('2026-10-04', 18)
    const s = await state(dani)
    const cal = resolveCalendar(s)
    expect(cal.phase).toBe('weekend')
    expect(cal.setupWeek?.week_start).toBe(W1)
    expect(cal.setupWeek?.status).toBe('setup')
    expect(cal.focusWeekStart).toBe(W1)
    weekId = cal.setupWeek!.id
  })

  it('valida metas', async () => {
    const save = (goals: unknown) => as(dani)('save_goals', { p_week_id: weekId, p_goals: goals })
    await expect(save([])).rejects.toThrow('Agrega al menos una meta.')
    await expect(save([{ title: '  ', icon: '🏋️', target_days: 3, days: [1, 2, 3] }])).rejects.toThrow('Cada meta necesita un nombre.')
    await expect(save([{ title: 'Gym', target_days: 6, days: [1, 2, 3, 4, 5] }])).rejects.toThrow('entre 1 y 5')
    await expect(save([{ title: 'Gym', target_days: 4, days: [1, 2] }])).rejects.toThrow('necesita al menos 4 días')
    await expect(save([{ title: 'Gym', target_days: 2, days: [1, 1] }])).rejects.toThrow('no son válidos')
    await expect(save([{ title: 'Gym', target_days: 2, days: [6, 7] }])).rejects.toThrow('no son válidos')
    const eleven = Array.from({ length: 11 }, (_, i) => ({ title: `Meta ${i}`, target_days: 1, days: [1] }))
    await expect(save(eleven)).rejects.toThrow('como máximo 10')
  })

  it('valida castigos (3–5, no vacíos, seguros)', async () => {
    const save = (items: unknown) => as(dani)('save_punishments', { p_week_id: weekId, p_items: items })
    await expect(save(DANI_PUNISHMENTS.slice(0, 2))).rejects.toThrow('al menos 3')
    await expect(save([...DANI_PUNISHMENTS, { emoji: '🎤', text: 'Cantar' }])).rejects.toThrow('como máximo 5')
    await expect(save([...DANI_PUNISHMENTS.slice(0, 2), { emoji: '🎲', text: '   ' }])).rejects.toThrow('vacío')
    await expect(save([...DANI_PUNISHMENTS.slice(0, 2), { emoji: '🎲', text: 'Darle una bofetada' }])).rejects.toThrow('no parece seguro')
  })

  it('guarda metas, castigos y confirma; la semana se activa cuando ambos confirman', async () => {
    await as(dani)('save_goals', {
      p_week_id: weekId,
      p_goals: [
        { title: 'Ir al gym', icon: '🏋️', target_days: 5, days: [1, 2, 3, 4, 5] },
        { title: 'Estudiar francés', icon: '🇫🇷', target_days: 5, days: [1, 2, 3, 4, 5] },
        { title: 'Estudiar Security+', icon: '💻', target_days: 5, days: [1, 2, 3, 4, 5] },
        { title: 'Comer saludable', icon: '🥗', target_days: 5, days: [1, 2, 3, 4, 5], description: 'Sin comida rápida' },
      ],
    })
    await as(dani)('save_punishments', { p_week_id: weekId, p_items: DANI_PUNISHMENTS })
    const first = (await as(dani)('confirm_setup', { p_week_id: weekId })) as { both_ready: boolean }
    expect(first.both_ready).toBe(false)
    expect((await weekByStart(dani, W1)).status).toBe('setup')

    await expect(as(sami)('confirm_setup', { p_week_id: weekId })).rejects.toThrow('al menos una meta')
    await as(sami)('save_goals', {
      p_week_id: weekId,
      p_goals: [
        { title: 'Correr', icon: '🏃', target_days: 3, days: [1, 2, 3, 4, 5] },
        { title: 'Leer 20 minutos', icon: '📚', target_days: 5, days: [1, 2, 3, 4, 5] },
        { title: 'Meditar', icon: '🧘', target_days: 2, days: [2, 4] },
      ],
    })
    await expect(as(sami)('confirm_setup', { p_week_id: weekId })).rejects.toThrow('entre 3 y 5 castigos')
    await as(sami)('save_punishments', { p_week_id: weekId, p_items: SAMI_PUNISHMENTS })
    const second = (await as(sami)('confirm_setup', { p_week_id: weekId })) as { both_ready: boolean }
    expect(second.both_ready).toBe(true)
    expect((await weekByStart(sami, W1)).status).toBe('active')
  })

  it('no permite editar la semana después de confirmarla', async () => {
    await expect(
      as(dani)('save_goals', { p_week_id: weekId, p_goals: [{ title: 'Trampa', target_days: 1, days: [1] }] }),
    ).rejects.toThrow('ya está confirmada')
    await expect(as(dani)('save_punishments', { p_week_id: weekId, p_items: DANI_PUNISHMENTS })).rejects.toThrow('ya está confirmada')
  })

  it('los castigos quedan en secreto para quien los recibirá', async () => {
    const detail = await week(sami, weekId)
    expect(detail.punishments.every((p) => p.author_id === sami)).toBe(true)
    expect(detail.punishments).toHaveLength(3)
    expect(detail.incoming_punishments).toBe(5)
    const direct = await queryAs<{ text: string }>(db, sami, 'select text from public.punishments')
    expect(direct.map((p) => p.text).sort()).toEqual(SAMI_PUNISHMENTS.map((p) => p.text).sort())
    // Pero las metas de la pareja sí son visibles.
    expect(detail.goals.filter((g) => g.user_id === dani)).toHaveLength(4)
  })

  it('nadie puede escribir directamente en las tablas', async () => {
    await expect(
      queryAs(db, sami, `insert into public.goal_completions (goal_id, week_id, couple_id, user_id, completed_on)
                           select g.id, g.week_id, g.couple_id, g.user_id, date '2026-10-05' from public.goals g limit 1`),
    ).rejects.toThrow('permission denied')
    await expect(queryAs(db, sami, `update public.goals set target_days = 1`)).rejects.toThrow('permission denied')
    await expect(queryAs(db, sami, `delete from public.punishments`)).rejects.toThrow('permission denied')
  })

  it('SÁBADO/DOMINGO: todavía no se puede marcar nada', async () => {
    const detail = await week(dani, weekId)
    await expect(
      as(dani)('set_completion', { p_goal_id: goalId(detail, dani, 'Ir al gym'), p_done: true }),
    ).rejects.toThrow('Solo puedes marcar tareas del día de hoy')
  })

  it('LUNES: cada quien marca solo sus metas y solo las de hoy', async () => {
    await at('2026-10-05', 8)
    const d = await week(dani, weekId)
    const mark = (user: string, owner: string, title: string, done = true) =>
      as(user)('set_completion', { p_goal_id: goalId(d, owner, title), p_done: done })

    await mark(dani, dani, 'Ir al gym')
    await mark(dani, dani, 'Estudiar Security+')
    await mark(dani, dani, 'Comer saludable')
    await mark(sami, sami, 'Correr')
    await mark(sami, sami, 'Leer 20 minutos')

    await expect(mark(sami, dani, 'Estudiar francés')).rejects.toThrow('Solo puedes marcar tus propias metas.')
    await expect(mark(sami, sami, 'Meditar')).rejects.toThrow('no está programada para hoy')

    // Marcar/desmarcar es idempotente.
    await mark(dani, dani, 'Comer saludable', false)
    await mark(dani, dani, 'Comer saludable', true)
    await mark(dani, dani, 'Comer saludable', true)

    const after = await week(sami, weekId)
    expect(after.completions.filter((c) => c.user_id === dani)).toHaveLength(3)
    expect(after.completions.every((c) => c.completed_on === '2026-10-05')).toBe(true)
  })

  it('MARTES: el lunes queda bloqueado; solo se corrige con aprobación de la pareja', async () => {
    await at('2026-10-06', 21)
    const d = await week(dani, weekId)
    const mark = (user: string, title: string, done = true) =>
      as(user)('set_completion', { p_goal_id: goalId(d, user, title), p_done: done })

    await mark(dani, 'Ir al gym')
    await mark(dani, 'Estudiar francés')
    await mark(dani, 'Comer saludable')
    await mark(sami, 'Correr')
    await mark(sami, 'Leer 20 minutos')
    await mark(sami, 'Meditar')

    // Desmarcar hoy no toca el lunes.
    await mark(dani, 'Ir al gym', false)
    await mark(dani, 'Ir al gym', true)
    const gym = goalId(d, dani, 'Ir al gym')
    const gymDays = (await week(dani, weekId)).completions.filter((c) => c.goal_id === gym).map((c) => c.completed_on)
    expect(gymDays.sort()).toEqual(['2026-10-05', '2026-10-06'])

    // Corrección del francés del lunes (olvidó marcarlo).
    const french = goalId(d, dani, 'Estudiar francés')
    await expect(
      as(dani)('request_correction', { p_goal_id: french, p_day: '2026-10-06', p_done: true, p_note: null }),
    ).rejects.toThrow('días anteriores')
    await expect(
      as(sami)('request_correction', { p_goal_id: french, p_day: '2026-10-05', p_done: true, p_note: null }),
    ).rejects.toThrow('tus propias metas')
    await expect(
      as(dani)('request_correction', { p_goal_id: gym, p_day: '2026-10-05', p_done: true, p_note: null }),
    ).rejects.toThrow('ya está en ese estado')

    const req = (await as(dani)('request_correction', {
      p_goal_id: french,
      p_day: '2026-10-05',
      p_done: true,
      p_note: 'Sí estudié, olvidé marcarlo',
    })) as { id: string }
    await expect(
      as(dani)('request_correction', { p_goal_id: french, p_day: '2026-10-05', p_done: true, p_note: null }),
    ).rejects.toThrow('Ya hay una corrección pendiente')

    const pending = (await state(sami)).corrections
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ goal_title: 'Estudiar francés', day: '2026-10-05', set_done: true })

    await expect(as(dani)('resolve_correction', { p_correction_id: req.id, p_approve: true })).rejects.toThrow('Tu pareja')
    await as(sami)('resolve_correction', { p_correction_id: req.id, p_approve: true })
    await expect(as(sami)('resolve_correction', { p_correction_id: req.id, p_approve: true })).rejects.toThrow('ya fue resuelta')

    const frenchDays = (await week(dani, weekId)).completions.filter((c) => c.goal_id === french).map((c) => c.completed_on)
    expect(frenchDays.sort()).toEqual(['2026-10-05', '2026-10-06'])
  })

  it('MIÉRCOLES y JUEVES: respeta el objetivo de las metas flexibles', async () => {
    await at('2026-10-07', 12)
    const d = await week(dani, weekId)
    const mark = (user: string, title: string) => as(user)('set_completion', { p_goal_id: goalId(d, user, title), p_done: true })
    for (const t of ['Ir al gym', 'Estudiar francés', 'Estudiar Security+', 'Comer saludable']) await mark(dani, t)
    await mark(sami, 'Correr') // 3/3

    await at('2026-10-08', 12)
    for (const t of ['Ir al gym', 'Estudiar francés', 'Comer saludable']) await mark(dani, t)
    await expect(mark(sami, 'Correr')).rejects.toThrow('Ya cumpliste esta meta')
  })

  it('VIERNES: último día para marcar; el progreso en vivo usa metas de igual peso', async () => {
    await at('2026-10-09', 23, 30)
    const d = await week(dani, weekId)
    for (const t of ['Estudiar francés', 'Estudiar Security+', 'Comer saludable']) {
      await as(dani)('set_completion', { p_goal_id: goalId(d, dani, t), p_done: true })
    }
    const live = await week(sami, weekId)
    const mine = (u: string) => live.goals.filter((g) => g.user_id === u)
    const daniLive = memberProgress(mine(dani), live.completions, W1)
    const samiLive = memberProgress(mine(sami), live.completions, W1)
    // Gym 4/5 · Francés 5/5 · Security+ 3/5 · Comer 5/5 → (80+100+60+100)/4
    expect(daniLive.percentage).toBe(85)
    expect(daniLive.completed).toBe(17)
    expect(daniLive.total).toBe(20)
    // Correr 3/3 · Leer 2/5 · Meditar 1/2 → (100+40+50)/3 = 63.33 (no 6/10 = 60)
    expect(samiLive.percentage).toBe(63.33)
  })

  it('SÁBADO: cierra la semana, bloquea cambios y calcula ganador/perdedor', async () => {
    await at('2026-10-10', 0, 5)
    const s = await state(sami)
    const cal = resolveCalendar(s)
    const closed = cal.resultWeek!
    expect(closed.week_start).toBe(W1)
    expect(closed.status).toBe('result')

    const byUser = Object.fromEntries(closed.results.map((r) => [r.user_id, r]))
    expect(byUser[dani]).toMatchObject({ percentage: 85, completed_tasks: 17, total_tasks: 20, outcome: 'win', must_spin: false })
    expect(byUser[sami]).toMatchObject({ percentage: 63.33, outcome: 'loss', must_spin: true, goals_completed: 1 })
    expect(cal.pendingRoulettes.map((w) => w.id)).toEqual([weekId])
    expect(rouletteStage(closed, sami)).toBe('spin')
    expect(rouletteStage(closed, dani)).toBe('none')

    // El servidor y el cliente calculan exactamente lo mismo.
    const detail = await week(dani, weekId)
    for (const user of [dani, sami]) {
      const client = memberProgress(detail.goals.filter((g) => g.user_id === user), detail.completions, W1)
      expect(client.percentage).toBe(byUser[user]!.percentage)
    }

    const d = await week(dani, weekId)
    await expect(
      as(dani)('set_completion', { p_goal_id: goalId(d, dani, 'Ir al gym'), p_done: true }),
    ).rejects.toThrow('Solo puedes marcar tareas del día de hoy')
  })

  it('revela los castigos solo a quien perdió', async () => {
    const forSami = await week(sami, weekId)
    const received = forSami.punishments.filter((p) => p.target_id === sami)
    expect(received.map((p) => p.text)).toEqual(DANI_PUNISHMENTS.map((p) => p.text))

    const forDani = await week(dani, weekId)
    expect(forDani.punishments.filter((p) => p.target_id === dani)).toHaveLength(0)
  })

  it('RULETA: solo gira quien perdió, una sola vez, con un resultado real', async () => {
    await expect(as(dani)('spin_roulette', { p_week_id: weekId })).rejects.toThrow('no te toca girar')
    await expect(as(sami)('accept_punishment', { p_week_id: weekId })).rejects.toThrow('Primero gira')

    const spin = (await as(sami)('spin_roulette', { p_week_id: weekId })) as {
      segment_index: number
      segment_count: number
      punishment: { id: string; text: string }
    }
    expect(spin.segment_count).toBe(5)
    expect(spin.segment_index).toBeGreaterThanOrEqual(0)
    expect(spin.segment_index).toBeLessThan(5)
    expect(spin.punishment.text).toBe(DANI_PUNISHMENTS[spin.segment_index]!.text)

    await expect(as(sami)('spin_roulette', { p_week_id: weekId })).rejects.toThrow('Ya giraste')
    const w = await weekByStart(dani, W1)
    expect(w.status).toBe('punishment')
    expect(w.roulette[0]).toMatchObject({ spinner_id: sami, segment_index: spin.segment_index, accepted_at: null })
    expect(w.roulette[0]!.punishment?.text).toBe(spin.punishment.text)
  })

  it('RESULTADO: registra el castigo aceptado y completa la semana', async () => {
    const res = (await as(sami)('accept_punishment', { p_week_id: weekId })) as { completed: boolean }
    expect(res.completed).toBe(true)
    await expect(as(sami)('accept_punishment', { p_week_id: weekId })).rejects.toThrow('ya estaba registrado')
    const w = await weekByStart(sami, W1)
    expect(w.status).toBe('completed')
    expect(rouletteStage(w, sami)).toBe('done')
    expect(resolveCalendar(await state(sami)).pendingRoulettes).toHaveLength(0)
  })

  it('desbloquea logros automáticamente', async () => {
    const s = await state(dani)
    const codes = (user: string) => s.achievements.filter((a) => a.user_id === user).map((a) => a.code).sort()
    expect(codes(dani)).toEqual(['first_week', 'first_win'])
    expect(codes(sami)).toEqual(['first_week', 'good_sport'])
  })

  it('HISTORIAL: registra la semana y calcula estadísticas', async () => {
    const h = (await as(sami)('get_history')) as HistoryData
    expect(h.weeks).toHaveLength(1)
    expect(h.weeks[0]!.roulette[0]!.punishment).not.toBeNull()
    expect(h.stats[dani]).toMatchObject({ weeks: 1, average: 85, wins: 1, best: 85, current_streak: 1 })
    expect(h.stats[sami]).toMatchObject({ weeks: 1, average: 63.3, wins: 0, losses: 1, current_streak: 0 })
  })

  it('SÁBADO: ya se puede preparar la semana siguiente', async () => {
    const cal = resolveCalendar(await state(dani))
    expect(cal.setupWeek?.week_start).toBe('2026-10-12')
    expect(cal.focusWeekStart).toBe(W1) // el sábado protagoniza el resultado
  })
})

/** Ambos configuran una meta de un día y la cumplen: 100 % vs 100 %. */
async function playPerfectTie(sunday: string, monday: string, daniGoal = { target_days: 1, days: [1] }) {
  await at(sunday, 12)
  const setup = resolveCalendar(await state(dani)).setupWeek!
  expect(setup.week_start).toBe(monday)
  for (const [user, items] of [[dani, DANI_PUNISHMENTS], [sami, SAMI_PUNISHMENTS]] as const) {
    await as(user)('save_goals', {
      p_week_id: setup.id,
      p_goals: [user === dani ? { title: 'Meta', ...daniGoal } : { title: 'Meta', target_days: 1, days: [1] }],
    })
    await as(user)('save_punishments', { p_week_id: setup.id, p_items: items })
    await as(user)('confirm_setup', { p_week_id: setup.id })
  }
  const d = await week(dani, setup.id)
  await at(monday, 9)
  for (const user of [dani, sami]) {
    await as(user)('set_completion', { p_goal_id: goalId(d, user, 'Meta'), p_done: true })
  }
  if (daniGoal.days.includes(2)) {
    await at(addDaysISO(monday, 1), 9)
    await as(dani)('set_completion', { p_goal_id: goalId(d, dani, 'Meta'), p_done: true })
  }
  await at(addDaysISO(monday, 5), 9) // sábado
  return weekByStart(dani, monday)
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('empates', () => {
  it('regla por defecto: ambos giran y cada quien ve los castigos que le tocan', async () => {
    const w = await playPerfectTie('2026-10-11', '2026-10-12')
    expect(w.status).toBe('result')
    expect(w.results.every((r) => r.outcome === 'tie' && r.must_spin)).toBe(true)

    const forDani = await week(dani, w.id)
    expect(forDani.punishments.filter((p) => p.target_id === dani)).toHaveLength(3)
    const forSami = await week(sami, w.id)
    expect(forSami.punishments.filter((p) => p.target_id === sami)).toHaveLength(5)

    await as(dani)('spin_roulette', { p_week_id: w.id })
    await as(dani)('accept_punishment', { p_week_id: w.id })
    expect((await weekByStart(dani, '2026-10-12')).status).toBe('punishment') // falta Sami
    await as(sami)('spin_roulette', { p_week_id: w.id })
    await as(sami)('accept_punishment', { p_week_id: w.id })
    expect((await weekByStart(dani, '2026-10-12')).status).toBe('completed')
  })

  it('regla "nadie gira": la semana se completa sin ruleta', async () => {
    await as(sami)('update_couple_settings', { p_patch: { tie_rule: 'nobody' } })
    const w = await playPerfectTie('2026-10-18', '2026-10-19')
    expect(w.status).toBe('completed')
    expect(w.results.every((r) => r.outcome === 'tie' && !r.must_spin)).toBe(true)
    await expect(as(dani)('spin_roulette', { p_week_id: w.id })).rejects.toThrow('ruleta')
    // Nadie perdió: los castigos siguen ocultos.
    expect((await week(dani, w.id)).punishments.filter((p) => p.target_id === dani)).toHaveLength(0)
  })

  it('regla "más tareas": desempata por tareas completadas', async () => {
    await as(dani)('update_couple_settings', { p_patch: { tie_rule: 'most_tasks' } })
    const w = await playPerfectTie('2026-10-25', '2026-10-26', { target_days: 2, days: [1, 2] })
    const byUser = Object.fromEntries(w.results.map((r) => [r.user_id, r]))
    expect(byUser[dani]).toMatchObject({ percentage: 100, completed_tasks: 2, outcome: 'win', must_spin: false })
    expect(byUser[sami]).toMatchObject({ percentage: 100, completed_tasks: 1, outcome: 'loss', must_spin: true })
    await as(sami)('spin_roulette', { p_week_id: w.id })
    await as(sami)('accept_punishment', { p_week_id: w.id })
  })

  it('rachas y logros acumulados', async () => {
    const h = (await as(dani)('get_history')) as HistoryData
    expect(h.weeks).toHaveLength(4)
    // 85, 100, 100, 100 → 4 semanas seguidas ≥ 80 %
    expect(h.stats[dani]).toMatchObject({ current_streak: 4, wins: 2, perfect_weeks: 3 })
    expect(h.stats[sami]).toMatchObject({ current_streak: 3 })

    await as(dani)('update_couple_settings', { p_patch: { streak_threshold: 90 } })
    const strict = (await as(dani)('get_history')) as HistoryData
    expect(strict.stats[dani]!.current_streak).toBe(3)
    await expect(as(dani)('update_couple_settings', { p_patch: { streak_threshold: 5 } })).rejects.toThrow('entre 10 y 100')
    await as(dani)('update_couple_settings', { p_patch: { streak_threshold: 80, tie_rule: 'both_spin' } })

    const s = await state(dani)
    const codes = s.achievements.filter((a) => a.user_id === dani).map((a) => a.code)
    expect(codes).toEqual(expect.arrayContaining(['first_week', 'first_win', 'perfect_week', 'streak_3']))
  })
})

describe('casos límite del calendario', () => {
  it('configuración tardía: solo días restantes; quien no configura pierde', async () => {
    const monday = '2026-11-02'
    await at('2026-11-04', 10) // miércoles, nadie configuró
    const cal = resolveCalendar(await state(dani))
    expect(cal.phase).toBe('weekday')
    expect(cal.setupWeek?.week_start).toBe(monday)
    const id = cal.setupWeek!.id

    await expect(
      as(dani)('save_goals', { p_week_id: id, p_goals: [{ title: 'Tarde', target_days: 3, days: [1, 2, 3] }] }),
    ).rejects.toThrow('La semana ya empezó')
    await expect(
      as(dani)('save_goals', { p_week_id: id, p_goals: [{ title: 'Tarde', target_days: 4, days: [3, 4, 5] }] }),
    ).rejects.toThrow('necesita al menos 4 días')
    await as(dani)('save_goals', { p_week_id: id, p_goals: [{ title: 'Tarde', target_days: 3, days: [3, 4, 5] }] })
    await as(dani)('save_punishments', { p_week_id: id, p_items: DANI_PUNISHMENTS.slice(0, 3) })
    await as(dani)('confirm_setup', { p_week_id: id })

    const d = await week(dani, id)
    for (const day of ['2026-11-04', '2026-11-05', '2026-11-06']) {
      await at(day, 20)
      await as(dani)('set_completion', { p_goal_id: goalId(d, dani, 'Tarde'), p_done: true })
    }
    await at('2026-11-07', 9)
    const w = await weekByStart(sami, monday)
    const byUser = Object.fromEntries(w.results.map((r) => [r.user_id, r]))
    expect(byUser[dani]).toMatchObject({ percentage: 100, outcome: 'win', participated: true })
    expect(byUser[sami]).toMatchObject({ percentage: 0, outcome: 'loss', participated: false, must_spin: true })
  })

  it('una semana que nadie configuró se omite del historial', async () => {
    await at('2026-11-10', 10) // martes: la semana existe pero nadie configura
    await state(dani)
    await at('2026-11-14', 10) // sábado
    const s = await state(dani)
    const skipped = s.weeks.find((w) => w.week_start === '2026-11-09')!
    expect(skipped).toMatchObject({ status: 'completed', skipped: true })
    const h = (await as(dani)('get_history')) as HistoryData
    expect(h.weeks.some((w) => w.week_start === '2026-11-09')).toBe(false)
    // El hueco rompe la racha.
    expect(h.stats[dani]!.current_streak).toBe(0)
  })

  it('una pareja ajena no puede leer ni tocar nada', async () => {
    const s = await state(dani)
    const someWeek = s.weeks[0]!
    await expect(week(outsider, someWeek.id)).rejects.toThrow('Semana no encontrada.')
    await expect(as(outsider)('spin_roulette', { p_week_id: someWeek.id })).rejects.toThrow('Semana no encontrada.')
    for (const table of ['goals', 'goal_completions', 'punishments', 'weekly_results', 'roulette_results', 'weeks']) {
      expect(await queryAs(db, outsider, `select * from public.${table}`)).toHaveLength(0)
    }
  })

  it('sin sesión no se puede llamar a nada', async () => {
    await expect(callRpc(db, null, 'get_state')).rejects.toThrow('Necesitas iniciar sesión.')
  })
})

describe('aleatoriedad', () => {
  it('_random_int es uniforme (chi-cuadrado)', async () => {
    const res = await db.query<{ v: number; n: number }>(
      'select v, count(*)::int as n from (select public._random_int(5) as v from generate_series(1, 20000)) s group by v order by v',
    )
    expect(res.rows.map((r) => r.v)).toEqual([0, 1, 2, 3, 4])
    const expected = 20000 / 5
    const chi2 = res.rows.reduce((sum, r) => sum + (r.n - expected) ** 2 / expected, 0)
    // 4 grados de libertad: p = 0.0001 ↔ 23.5
    expect(chi2).toBeLessThan(23.5)
  })
})

describe('filtro de castigos', () => {
  it('el cliente y el servidor aplican el mismo filtro', async () => {
    const samples = [
      'Preparar el desayuno', 'Invitar la cena', 'Ordenar el armario', 'Probar comida nueva', 'Cortar el césped',
      'Preparar sangría', 'Limpiar la azotea', 'Una semana sin comer postre', 'Hacer 30 minutos de cardio',
      'Clase de kickboxing', 'Darle una bofetada', 'Llevar un arma', 'Un día de ayuno', 'Tomar 5 shots',
      'HUMILLAR en público', 'Robar algo', 'Publicar fotos íntimas', 'No comer nada en todo el día', 'Kick him',
    ]
    for (const text of samples) {
      const res = await db.query<{ ok: boolean }>('select public.is_safe_punishment($1) as ok', [text])
      expect({ text, safe: isSafePunishment(text) }).toEqual({ text, safe: res.rows[0]!.ok })
    }
  })
})
