import type { Accent, AvatarStyle, HairStyle, TieRule } from './types'

export const GOAL_ICONS = [
  '🏋️', '🏃', '🚴', '🧘', '🥗', '💧', '⏰', '😴', '📚', '🇫🇷', '💻', '🎸',
  '🎨', '✍️', '🧠', '🧹', '💰', '📵', '🚭', '🍎', '🦷', '🌿', '🐶', '❤️',
  '📞', '🙏', '🎯', '⭐',
]

export const PUNISHMENT_EMOJIS = ['🍕', '🍳', '🏃', '🎬', '🧹', '💆', '🍰', '🧺', '☕', '🚗', '🎤', '🛒', '🌮', '🧽', '🎲', '💐']

export interface GoalSuggestion {
  icon: string
  title: string
  target_days: number
}

export const GOAL_SUGGESTIONS: GoalSuggestion[] = [
  { icon: '🏋️', title: 'Ir al gym', target_days: 4 },
  { icon: '🥗', title: 'Comer saludable', target_days: 5 },
  { icon: '⏰', title: 'Levantarse temprano', target_days: 5 },
  { icon: '📚', title: 'Leer 20 minutos', target_days: 5 },
  { icon: '💧', title: 'Tomar 2 L de agua', target_days: 5 },
  { icon: '🧘', title: 'Meditar', target_days: 3 },
  { icon: '📵', title: 'Nada de pantallas en la cama', target_days: 5 },
  { icon: '🇫🇷', title: 'Estudiar francés', target_days: 5 },
]

export const PUNISHMENT_SUGGESTIONS: { emoji: string; text: string }[] = [
  { emoji: '🍕', text: 'Invitar la cena' },
  { emoji: '🍳', text: 'Preparar el desayuno' },
  { emoji: '🏃', text: 'Hacer 30 minutos de cardio' },
  { emoji: '🎬', text: 'Dejar que yo elija la película' },
  { emoji: '🧹', text: 'Hacer una tarea doméstica' },
  { emoji: '💆', text: 'Dar un masaje de 15 minutos' },
  { emoji: '🍰', text: 'Comprar mi postre favorito' },
  { emoji: '☕', text: 'Llevarme el café a la cama' },
]

export interface AccentTheme {
  label: string
  /** Color principal (texto sobre fondo oscuro, barras, anillos). */
  base: string
  /** Variante más clara para brillos. */
  soft: string
  /** Variante profunda para sombras y degradados. */
  deep: string
}

export const ACCENTS: Record<Accent, AccentTheme> = {
  pink: { label: 'Rosa', base: '#ff9ebb', soft: '#ffd3e0', deep: '#d9577f' },
  sky: { label: 'Azul', base: '#8ec9ff', soft: '#cfe8ff', deep: '#3f8fdb' },
  lavender: { label: 'Lavanda', base: '#bfa9ff', soft: '#e3d9ff', deep: '#7c5ce0' },
  sun: { label: 'Amarillo', base: '#ffd46b', soft: '#fff0c2', deep: '#d9a21f' },
  mint: { label: 'Menta', base: '#8fe3c4', soft: '#d2f6e8', deep: '#2fa57c' },
  peach: { label: 'Durazno', base: '#ffb38a', soft: '#ffe0cf', deep: '#e0733d' },
}

export const ACCENT_ORDER: Accent[] = ['pink', 'sky', 'lavender', 'sun', 'mint', 'peach']

/**
 * Colores para gráficas (sobre la superficie #0e1639). Los acentos pastel son
 * demasiado claros para marcar datos, así que cada acento tiene dos pasos más
 * profundos del mismo tono, validados (banda de luminosidad, croma, daltonismo
 * y visión normal): la primera persona usa `light` y la segunda `dark`.
 * Si ambas eligieron el mismo acento, la segunda usa `CHART_FALLBACK`.
 */
export const CHART_COLORS: Record<Accent, { light: string; dark: string }> = {
  pink: { light: '#de6493', dark: '#b0396b' },
  sky: { light: '#1b9bee', dark: '#0a71b1' },
  lavender: { light: '#9c7cea', dark: '#7553bd' },
  sun: { light: '#bf890d', dark: '#8d6300' },
  mint: { light: '#00ad84', dark: '#0a7f60' },
  peach: { light: '#e16e34', dark: '#af4803' },
}

const CHART_FALLBACK: Record<Accent, Accent> = {
  pink: 'sky',
  sky: 'peach',
  lavender: 'mint',
  sun: 'lavender',
  mint: 'pink',
  peach: 'sky',
}

export interface SeriesStyle {
  color: string
  marker: 'circle' | 'square'
}

/** Estilo estable por persona (el mismo para ambos, sin importar quién mira). */
export function chartSeriesStyles(people: { id: string; accent: Accent }[]): Record<string, SeriesStyle> {
  const [first, second] = [...people].sort((a, b) => (a.id < b.id ? -1 : 1))
  const styles: Record<string, SeriesStyle> = {}
  if (first) styles[first.id] = { color: CHART_COLORS[first.accent].light, marker: 'circle' }
  if (second) {
    const accent = first && second.accent === first.accent ? CHART_FALLBACK[second.accent] : second.accent
    styles[second.id] = { color: CHART_COLORS[accent].dark, marker: 'square' }
  }
  return styles
}

export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'short', label: 'Corto' },
  { id: 'waves', label: 'Ondas' },
  { id: 'curly', label: 'Rizado' },
  { id: 'buzz', label: 'Rapado' },
  { id: 'long', label: 'Largo' },
  { id: 'bun', label: 'Chongo' },
]

export const SKIN_TONES = ['#f8d9c4', '#efc09c', '#d7a076', '#b27852', '#7b4f35']
export const HAIR_COLORS = ['#2a1d19', '#5b3a26', '#9c6130', '#e2b35d', '#c4553f', '#8d90a8']

/** Avatar ilustrado por defecto, estable para cada usuario. */
export function defaultAvatar(userId: string): AvatarStyle {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  return {
    hair: HAIR_STYLES[hash % HAIR_STYLES.length]!.id,
    skin: (hash >>> 3) % SKIN_TONES.length,
    hairColor: (hash >>> 6) % HAIR_COLORS.length,
  }
}

export function resolveAvatar(userId: string, avatar: Partial<AvatarStyle> | null | undefined): AvatarStyle {
  const fallback = defaultAvatar(userId)
  return {
    hair: avatar?.hair ?? fallback.hair,
    skin: avatar?.skin ?? fallback.skin,
    hairColor: avatar?.hairColor ?? fallback.hairColor,
  }
}

export const TIE_RULES: { id: TieRule; title: string; description: string }[] = [
  { id: 'both_spin', title: 'Ambos giran la ruleta', description: 'Cada quien cumple un castigo elegido por la ruleta.' },
  { id: 'most_tasks', title: 'Gana quien completó más tareas', description: 'Si también empatan en tareas, ambos giran.' },
  { id: 'nobody', title: 'Nadie gira', description: 'El empate se celebra en paz. 🤝' },
]
