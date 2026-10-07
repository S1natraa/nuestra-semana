import { ChartNoAxesCombined, Dices, House, Settings, Target, type LucideIcon } from 'lucide-react'
import { isConfirmed, rouletteStage } from '@/domain/calendar'
import type { Session } from '@/state/queries'

export interface NavItem {
  to: string
  label: string
  shortLabel: string
  icon: LucideIcon
  locked?: boolean
  /** Punto de aviso (algo pendiente para mí). */
  attention?: boolean
  hint?: string
}

/** La navegación se adapta al momento de la semana. */
export function buildNavigation(session: Session | null): NavItem[] {
  const calendar = session?.calendar
  const me = session?.userId
  const pendingForMe = calendar?.pendingRoulettes.some((w) => ['spin', 'accept'].includes(rouletteStage(w, me))) ?? false
  const rouletteAvailable = Boolean(calendar && (calendar.pendingRoulettes.length > 0 || (calendar.resultWeek?.roulette.length ?? 0) > 0))
  const setupPending = Boolean(calendar?.setupWeek && !isConfirmed(calendar.setupWeek, me))
  const approvals = session?.state.corrections.some((c) => c.requested_by !== me) ?? false

  return [
    { to: '/', label: 'Inicio', shortLabel: 'Inicio', icon: House, attention: approvals },
    { to: '/metas', label: 'Metas', shortLabel: 'Metas', icon: Target, attention: setupPending, hint: setupPending ? 'Configura tu semana' : undefined },
    {
      to: '/ruleta',
      label: 'Ruleta',
      shortLabel: 'Ruleta',
      icon: Dices,
      locked: !rouletteAvailable,
      attention: pendingForMe,
      hint: rouletteAvailable ? undefined : 'Disponible al cerrar la semana',
    },
    { to: '/historial', label: 'Historial', shortLabel: 'Historial', icon: ChartNoAxesCombined },
    { to: '/ajustes', label: 'Configuración', shortLabel: 'Ajustes', icon: Settings },
  ]
}
