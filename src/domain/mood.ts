/** Estados de ánimo del avatar y mensajes motivacionales según el progreso. */
import { displayPercent } from './progress'

export type MoodLevel = 0 | 1 | 2 | 3 | 4 | 5

/**
 * 0–19 cansado · 20–39 optimista · 40–59 sonrisa · 60–79 confiado
 * 80–99 muy feliz · 100 celebración
 */
export function moodLevel(percentage: number): MoodLevel {
  const p = displayPercent(percentage)
  if (p >= 100) return 5
  if (p >= 80) return 4
  if (p >= 60) return 3
  if (p >= 40) return 2
  if (p >= 20) return 1
  return 0
}

export const MOOD_LABELS: Record<MoodLevel, string> = {
  0: 'Cansado',
  1: 'Optimista',
  2: 'Sonriente',
  3: 'Confiado',
  4: 'Muy feliz',
  5: '¡Celebrando!',
}

export interface Message {
  emoji: string
  text: string
}

/** Mensaje para quien mira su propio progreso. */
export function motivationalMessage(percentage: number): Message {
  const p = displayPercent(percentage)
  if (p >= 100) return { emoji: '🏆', text: '¡Semana perfecta! 🔥' }
  if (p >= 81) return { emoji: '🚀', text: '¡Casi lo tienes!' }
  if (p >= 61) return { emoji: '🔥', text: '¡Vas muy bien!' }
  if (p >= 41) return { emoji: '✨', text: 'Ya llevas más de la mitad.' }
  if (p >= 21) return { emoji: '💪', text: 'Buen comienzo.' }
  return { emoji: '🌱', text: 'Vamos, apenas comienza la semana.' }
}

/** Mensaje sobre el progreso de la pareja (tercera persona). */
export function partnerMessage(percentage: number): Message {
  const p = displayPercent(percentage)
  if (p >= 100) return { emoji: '🏆', text: '¡Semana perfecta! 🔥' }
  if (p >= 81) return { emoji: '🚀', text: '¡Casi lo tiene!' }
  if (p >= 61) return { emoji: '🔥', text: '¡Va muy bien!' }
  if (p >= 41) return { emoji: '✨', text: 'Ya va por la mitad.' }
  if (p >= 21) return { emoji: '💪', text: '¡Todavía queda semana!' }
  return { emoji: '🌱', text: 'Apenas está calentando.' }
}

const QUOTES = [
  'Disciplina hoy,\nresultados mañana.',
  'Pequeños pasos,\ngrandes semanas.',
  'Juntos llegamos\nmás lejos.',
  'Lo que se repite,\nse vuelve fácil.',
  'Un check a la vez,\nun día a la vez.',
  'La constancia\nle gana al talento.',
  'Hoy también\ncuenta.',
]

/** Frase del día: estable durante todo el día, cambia al siguiente. */
export function quoteOfTheDay(isoDate: string): string {
  const seed = isoDate.split('-').reduce((acc, part) => acc + Number(part), 0)
  return QUOTES[seed % QUOTES.length]!
}
