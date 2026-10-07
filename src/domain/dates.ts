/**
 * Fechas de calendario sin horas (YYYY-MM-DD). Toda la aritmética se hace en
 * UTC para que la zona horaria del navegador nunca desplace un día. El "hoy"
 * real lo decide el servidor en la zona horaria de la pareja.
 */
import type { ISODate, Weekday } from './types'

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const WEEKDAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const WEEKDAYS_LETTER = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export const WORK_DAYS: readonly Weekday[] = [1, 2, 3, 4, 5]

export function parseISODate(iso: ISODate): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) throw new Error(`Fecha no válida: ${iso}`)
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

export function toISODate(date: Date): ISODate {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = parseISODate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toISODate(date)
}

/** 1 = lunes … 7 = domingo. */
export function isoWeekday(iso: ISODate): number {
  const day = parseISODate(iso).getUTCDay()
  return day === 0 ? 7 : day
}

export function mondayOf(iso: ISODate): ISODate {
  return addDays(iso, -(isoWeekday(iso) - 1))
}

export function fridayOf(weekStart: ISODate): ISODate {
  return addDays(weekStart, 4)
}

/** Fecha concreta de un día (1-5) dentro de la semana que empieza en `weekStart`. */
export function dateOfWeekday(weekStart: ISODate, weekday: number): ISODate {
  return addDays(weekStart, weekday - 1)
}

export function isWeekend(iso: ISODate): boolean {
  return isoWeekday(iso) >= 6
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86_400_000)
}

export function weekdayName(weekday: number): string {
  return WEEKDAYS_LONG[weekday - 1] ?? ''
}

export function weekdayShort(weekday: number): string {
  return WEEKDAYS_SHORT[weekday - 1] ?? ''
}

export function weekdayLetter(weekday: number): string {
  return WEEKDAYS_LETTER[weekday - 1] ?? ''
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "28 sep" */
export function formatShortDate(iso: ISODate): string {
  const d = parseISODate(iso)
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`
}

/** "28 sep — 2 oct, 2026" (lunes a viernes). */
export function formatWeekRange(weekStart: ISODate, separator = '—'): string {
  const start = parseISODate(weekStart)
  const end = parseISODate(fridayOf(weekStart))
  const startYear = start.getUTCFullYear()
  const endYear = end.getUTCFullYear()
  const left = startYear === endYear ? formatShortDate(weekStart) : `${formatShortDate(weekStart)}, ${startYear}`
  return `${left} ${separator} ${formatShortDate(fridayOf(weekStart))}, ${endYear}`
}

/** "28 sep – 2 oct" (sin año, para listas). */
export function formatWeekRangeCompact(weekStart: ISODate): string {
  return `${formatShortDate(weekStart)} – ${formatShortDate(fridayOf(weekStart))}`
}

/** "Martes 29 de septiembre" */
export function formatLongDay(iso: ISODate): string {
  const d = parseISODate(iso)
  return `${capitalize(weekdayName(isoWeekday(iso)))} ${d.getUTCDate()} de ${MONTHS_LONG[d.getUTCMonth()]}`
}

/** Fecha de hoy en una zona horaria IANA según el reloj del dispositivo. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): ISODate {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch {
    return toISODate(now)
  }
}

/** Instante UTC que corresponde a una hora de reloj en una zona horaria IANA. */
export function zonedTimeToInstant(date: ISODate, hour: number, minute: number, timeZone: string): Date {
  const pad = (n: number) => String(n).padStart(2, '0')
  const guess = new Date(`${date}T${pad(hour)}:${pad(minute)}:00Z`)
  const offsetAt = (instant: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(instant)
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
    return asUtc - instant.getTime()
  }
  const first = new Date(guess.getTime() - offsetAt(guess))
  // Segunda pasada por si el primer intento cruzó un cambio de horario.
  return new Date(guess.getTime() - offsetAt(first))
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
