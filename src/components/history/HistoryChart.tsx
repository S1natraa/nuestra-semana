/**
 * Evolución semanal del porcentaje de cada persona.
 * - Una sola escala (0–100 %), rejilla fina y sólida.
 * - Líneas de 2px con marcadores de forma distinta por persona (círculo /
 *   cuadrado) además del color: la identidad nunca depende solo del color.
 * - Leyenda siempre visible, etiqueta directa solo en el último punto.
 * - Cursor + tooltip con ambas personas; también con teclado (← →).
 * - En móvil se desplaza horizontalmente cuando hay muchas semanas.
 * - Vista de tabla equivalente.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Table2, ChartLine } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { chartSeriesStyles, type SeriesStyle } from '@/domain/constants'
import { formatShortDate, formatWeekRangeCompact } from '@/domain/dates'
import type { Profile, WeekSummary } from '@/domain/types'
import { cn } from '@/lib/browser'

interface HistoryChartProps {
  weeks: WeekSummary[]
  people: Profile[]
}

const HEIGHT = 240
const PAD_TOP = 18
const PAD_BOTTOM = 34
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM
const STEP_MIN = 64
const PAD_X = 28
const END_LABEL_SPACE = 92
const TICKS = [0, 25, 50, 75, 100]

const y = (value: number) => PAD_TOP + PLOT_H * (1 - value / 100)

function Marker({ shape, x, y: cy, color, r = 4.5 }: { shape: SeriesStyle['marker']; x: number; y: number; color: string; r?: number }) {
  // Anillo de 2px del color de la superficie para que se lea sobre las líneas.
  return shape === 'circle' ? (
    <circle cx={x} cy={cy} r={r} fill={color} stroke="#0e1639" strokeWidth={2} />
  ) : (
    <rect x={x - r} y={cy - r} width={r * 2} height={r * 2} rx={1.5} fill={color} stroke="#0e1639" strokeWidth={2} />
  )
}

export function HistoryChart({ weeks, people }: HistoryChartProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [active, setActive] = useState<number | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const styles = useMemo(() => chartSeriesStyles(people), [people])

  // Cronológico: de la semana más antigua a la más reciente.
  const ordered = useMemo(() => [...weeks].sort((a, b) => (a.week_start < b.week_start ? -1 : 1)), [weeks])
  const series = people.map((person) => ({
    person,
    style: styles[person.id]!,
    values: ordered.map((w) => w.results.find((r) => r.user_id === person.id)?.percentage ?? null),
  }))

  // Ancho disponible: con pocas semanas la gráfica se estira para llenarlo;
  // con muchas, cada semana conserva STEP_MIN y aparece el scroll horizontal.
  const [available, setAvailable] = useState(0)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setAvailable(entry!.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [view])

  const count = ordered.length
  const fit = count > 1 ? Math.floor((available - PAD_X * 2 - END_LABEL_SPACE) / (count - 1)) : 0
  const step = Math.max(STEP_MIN, fit)
  const width = Math.max(PAD_X * 2 + (count - 1) * step + END_LABEL_SPACE, 320)
  const x = (i: number) => PAD_X + i * step

  useEffect(() => {
    // Mostrar primero las semanas más recientes.
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [count, view])

  const last = count - 1
  const endValues = series.map((s) => s.values[last] ?? null)
  const endLabelsCollide = endValues.length === 2 && endValues[0] !== null && endValues[1] !== null && Math.abs(y(endValues[0]!) - y(endValues[1]!)) < 18

  const onPointer = (clientX: number) => {
    const el = scroller.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = clientX - rect.left + el.scrollLeft
    const index = Math.round((px - PAD_X) / step)
    setActive(Math.max(0, Math.min(last, index)))
  }

  const winnerName = (week: WeekSummary) => {
    const win = week.results.find((r) => r.outcome === 'win')
    if (!win) return week.results.length ? 'Empate' : '—'
    return people.find((p) => p.id === win.user_id)?.display_name ?? '—'
  }

  if (count === 0) return null

  return (
    <figure className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Leyenda: siempre visible con 2 series; la clave imita la marca (línea + forma). */}
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Leyenda">
          {series.map(({ person, style }) => (
            <li key={person.id} className="flex items-center gap-2 text-sm font-bold text-cream-50">
              <svg width="30" height="12" aria-hidden>
                <line x1="1" y1="6" x2="29" y2="6" stroke={style.color} strokeWidth="2" strokeLinecap="round" />
                <Marker shape={style.marker} x={15} y={6} color={style.color} r={4} />
              </svg>
              {person.display_name}
            </li>
          ))}
        </ul>
        <div className="inline-flex rounded-full bg-navy-800 p-1" role="group" aria-label="Formato">
          {(
            [
              ['chart', 'Gráfica', ChartLine],
              ['table', 'Tabla', Table2],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={cn(
                'focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition',
                view === value ? 'bg-cream-50 text-ink' : 'text-navy-300 hover:text-cream-50',
              )}
            >
              <Icon className="size-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'chart' ? (
        <div className="mt-4 flex">
          {/* Eje Y fijo (no se desplaza con las semanas). */}
          <svg width="40" height={HEIGHT} className="shrink-0" aria-hidden>
            {TICKS.map((t) => (
              <text key={t} x={34} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#9fa8da" className="tabular-nums">
                {t}%
              </text>
            ))}
          </svg>
          <div
            ref={scroller}
            className="scroll-thin relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-xl"
            tabIndex={0}
            role="group"
            aria-label="Gráfica de evolución semanal. Usa las flechas izquierda y derecha para recorrer las semanas."
            onPointerMove={(e) => onPointer(e.clientX)}
            onPointerDown={(e) => onPointer(e.clientX)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive((a) => a ?? last)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                setActive((a) => Math.max(0, (a ?? last) - 1))
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                setActive((a) => Math.min(last, (a ?? last) + 1))
              }
            }}
          >
            <svg width={width} height={HEIGHT} className="block" aria-hidden>
              {TICKS.map((t) => (
                <line key={t} x1={0} x2={width} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / 0.07)" strokeWidth={1} />
              ))}
              {ordered.map((w, i) => (
                <text key={w.id} x={x(i)} y={HEIGHT - 12} textAnchor="middle" fontSize={11} fill="#9fa8da">
                  {formatShortDate(w.week_start)}
                </text>
              ))}

              {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD_TOP - 6} y2={PAD_TOP + PLOT_H} stroke="rgb(255 250 242 / 0.35)" strokeWidth={1} />}

              {series.map(({ person, style, values }) => {
                const points = values.map((v, i) => (v === null ? null : [x(i), y(v)] as const)).filter(Boolean) as (readonly [number, number])[]
                const d = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join(' ')
                return (
                  <g key={person.id}>
                    <motion.path
                      d={d}
                      fill="none"
                      stroke={style.color}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                    {points.map(([px, py], i) => (
                      <Marker key={i} shape={style.marker} x={px} y={py} color={style.color} r={active !== null && x(active) === px ? 6 : 4.5} />
                    ))}
                  </g>
                )
              })}

              {!endLabelsCollide &&
                series.map(({ person, style, values }) => {
                  const v = values[last]
                  if (v === null || v === undefined) return null
                  return (
                    <g key={person.id} transform={`translate(${x(last) + 12} ${y(v)})`}>
                      <Marker shape={style.marker} x={4} y={0} color={style.color} r={3.5} />
                      <text x={13} y={0} dominantBaseline="middle" fontSize={12} fontWeight={700} fill="#fffaf2">
                        {person.display_name} {Math.round(v)}%
                      </text>
                    </g>
                  )
                })}
            </svg>

            <AnimatePresence>
              {active !== null && ordered[active] && (
                <motion.div
                  key="tooltip"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute top-2 z-10 w-44 rounded-2xl border border-white/10 bg-navy-900/95 p-3 shadow-card backdrop-blur"
                  style={{ left: Math.min(Math.max(x(active) - 88 - (scroller.current?.scrollLeft ?? 0), 4), (scroller.current?.clientWidth ?? 300) - 180) }}
                  role="status"
                >
                  <p className="text-xs font-semibold text-navy-300">{formatWeekRangeCompact(ordered[active].week_start)}</p>
                  <ul className="mt-2 space-y-1.5">
                    {series.map(({ person, style, values }) => (
                      <li key={person.id} className="flex items-center gap-2">
                        <span className="h-0.5 w-3 rounded-full" style={{ background: style.color }} aria-hidden />
                        <span className="text-base font-extrabold text-cream-50 tabular-nums">
                          {values[active] === null ? '—' : `${Math.round(values[active]!)}%`}
                        </span>
                        <span className="truncate text-xs text-navy-300">{person.display_name}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 border-t border-white/8 pt-2 text-xs text-navy-200">Ganó: {winnerName(ordered[active])}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="scroll-thin mt-4 overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-sm">
            <caption className="sr-only">Porcentaje semanal de cada persona</caption>
            <thead>
              <tr className="text-xs text-navy-300">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Semana
                </th>
                {people.map((p) => (
                  <th key={p.id} scope="col" className="py-2 pr-3 text-right font-semibold">
                    {p.display_name}
                  </th>
                ))}
                <th scope="col" className="py-2 font-semibold">
                  Ganador
                </th>
              </tr>
            </thead>
            <tbody>
              {[...ordered].reverse().map((w) => (
                <tr key={w.id} className="border-t border-white/6">
                  <th scope="row" className="py-2.5 pr-3 font-semibold text-navy-200">
                    {formatWeekRangeCompact(w.week_start)}
                  </th>
                  {people.map((p) => {
                    const r = w.results.find((x) => x.user_id === p.id)
                    return (
                      <td key={p.id} className="py-2.5 pr-3 text-right font-bold tabular-nums">
                        {r ? `${Math.round(r.percentage)}%` : '—'}
                      </td>
                    )
                  })}
                  <td className="py-2.5 font-semibold">{winnerName(w)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <figcaption className="sr-only">
        Evolución del porcentaje semanal. {series.map((s) => `${s.person.display_name}: ${s.values.map((v) => (v === null ? 'sin dato' : `${Math.round(v)}%`)).join(', ')}`).join('. ')}
      </figcaption>
    </figure>
  )
}
