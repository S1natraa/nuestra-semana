/**
 * Validaciones de la configuración semanal. Dan feedback inmediato en la UI;
 * el servidor aplica exactamente las mismas reglas (y es quien decide).
 */
import { diffDays } from './dates'
import type { GoalDraft, ISODate, PunishmentDraft } from './types'

export const LIMITS = {
  minGoals: 1,
  maxGoals: 10,
  goalTitleMax: 60,
  goalDescriptionMax: 200,
  minPunishments: 3,
  maxPunishments: 5,
  punishmentMin: 2,
  punishmentMax: 80,
} as const

/** Primer día (1-5) que todavía puede programarse. 1 si la semana no empezó. */
export function firstOpenWeekday(weekStart: ISODate, today: ISODate): number {
  if (today < weekStart) return 1
  return diffDays(today, weekStart) + 1
}

export function validateGoal(goal: GoalDraft, firstOpenDay = 1): string | null {
  const title = goal.title.trim()
  if (!title) return 'Cada meta necesita un nombre.'
  if (title.length > LIMITS.goalTitleMax) return `El nombre es demasiado largo (máx. ${LIMITS.goalTitleMax}).`
  if (goal.description.trim().length > LIMITS.goalDescriptionMax) {
    return `La descripción es demasiado larga (máx. ${LIMITS.goalDescriptionMax}).`
  }
  if (!Number.isInteger(goal.target_days) || goal.target_days < 1 || goal.target_days > 5) {
    return 'Elige entre 1 y 5 días.'
  }
  const available = 5 - firstOpenDay + 1
  if (goal.target_days > available) {
    return available <= 0 ? 'Esta semana ya no tiene días disponibles.' : `Solo quedan ${available} días en esta semana.`
  }
  if (goal.days.some((d) => d < firstOpenDay)) return 'La semana ya empezó: elige días a partir de hoy.'
  if (new Set(goal.days).size !== goal.days.length) return 'Hay días repetidos.'
  if (goal.days.length < goal.target_days) {
    return `Elige ${goal.target_days} ${goal.target_days === 1 ? 'día' : 'días'}.`
  }
  if (!goal.flexible && goal.days.length !== goal.target_days) {
    return `Elige exactamente ${goal.target_days} ${goal.target_days === 1 ? 'día' : 'días'}.`
  }
  return null
}

export function validateGoals(goals: GoalDraft[], firstOpenDay = 1): string | null {
  if (goals.length < LIMITS.minGoals) return 'Agrega al menos una meta.'
  if (goals.length > LIMITS.maxGoals) return `Puedes tener como máximo ${LIMITS.maxGoals} metas por semana.`
  for (const goal of goals) {
    const error = validateGoal(goal, firstOpenDay)
    if (error) return goal.title.trim() ? `${goal.title.trim()}: ${error}` : error
  }
  return null
}

export function validatePunishment(item: PunishmentDraft): string | null {
  const text = item.text.trim()
  if (text.length < LIMITS.punishmentMin) return 'Ningún castigo puede quedar vacío.'
  if (text.length > LIMITS.punishmentMax) return `Máximo ${LIMITS.punishmentMax} caracteres.`
  if (!isSafePunishment(text)) return 'Esto no parece seguro. Elige algo divertido, razonable y acordado por ambos.'
  return null
}

export function validatePunishments(items: PunishmentDraft[]): string | null {
  if (items.length < LIMITS.minPunishments) return `Agrega al menos ${LIMITS.minPunishments} castigos.`
  if (items.length > LIMITS.maxPunishments) return `Puedes agregar como máximo ${LIMITS.maxPunishments} castigos.`
  for (const item of items) {
    const error = validatePunishment(item)
    if (error) return error
  }
  return null
}

// Mismo filtro que public.is_safe_punishment (supabase/migrations). Hay una
// prueba que comprueba que ambos coinciden con los mismos ejemplos.
const UNSAFE_STEMS = [
  'golpea', 'bofetad', 'cachetad', 'puñetaz', 'patada', 'lastim', 'herid', 'emborrach', 'borrach',
  'ilegal', 'humill', 'desnud', 'insult', 'escupi', 'asfix', 'ahoga', 'veneno', 'suicid', 'violen',
  'nalgad', 'acoso', 'acosa', 'amenaz', 'chantaj', 'foto íntima', 'fotos íntimas', 'autolesi',
  'quemadura', 'electrocut', 'sin comer nada', 'no comer nada', 'humiliat', 'naked', 'starv',
  'poison', 'suicide', 'violence', 'blackmail', 'spank',
]
const UNSAFE_WORDS = [
  'arma', 'armas', 'robar', 'robo', 'matar', 'golpe', 'golpes', 'pegarle', 'pegarte', 'herir',
  'sangre', 'sangrar', 'azotar', 'azote', 'azotes', 'ayuno', 'ayunar', 'ayunas', 'shot', 'shots',
  'droga', 'drogas', 'hit', 'slap', 'punch', 'kick', 'hurt', 'blood', 'knife', 'gun', 'weapon',
  'drug', 'drugs', 'drunk', 'steal', 'illegal', 'choke', 'kill', 'threat',
]
const WORD_CHARS = 'a-z0-9áéíóúüñ'
const UNSAFE_WORD_REGEX = new RegExp(`(^|[^${WORD_CHARS}])(${UNSAFE_WORDS.join('|')})($|[^${WORD_CHARS}])`)

export function isSafePunishment(text: string): boolean {
  const lower = text.toLowerCase()
  if (UNSAFE_STEMS.some((stem) => lower.includes(stem))) return false
  return !UNSAFE_WORD_REGEX.test(lower)
}
