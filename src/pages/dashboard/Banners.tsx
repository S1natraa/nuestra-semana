import { motion } from 'framer-motion'
import { ArrowRight, Check, ShieldCheck, X } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { rouletteStage } from '@/domain/calendar'
import { formatLongDay, formatWeekRangeCompact } from '@/domain/dates'
import type { PendingCorrection, WeekSummary } from '@/domain/types'
import { useResolveCorrection } from '@/state/mutations'
import { useSession } from '@/state/queries'
import { useToast } from '@/state/toast'

/** Aviso de ruleta pendiente (propia o de la pareja). */
export function RouletteBanner({ week }: { week: WeekSummary }) {
  const { userId, partner } = useSession()
  const mine = rouletteStage(week, userId)
  const theirs = rouletteStage(week, partner?.id)

  if (mine === 'spin' || mine === 'accept') {
    return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          to="/ruleta"
          className="focus-ring group flex items-center gap-4 rounded-[24px] border border-blush-300/30 bg-linear-to-r from-blush-400/20 via-lilac-400/15 to-navy-850 p-4 shadow-card sm:p-5"
        >
          <motion.span
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cream-50 text-2xl"
            animate={{ rotate: [0, 12, -12, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2 }}
            aria-hidden
          >
            🎰
          </motion.span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold">{mine === 'spin' ? 'Te toca girar la ruleta' : 'Acepta tu castigo'}</span>
            <span className="text-sm text-navy-200">Semana del {formatWeekRangeCompact(week.week_start)}</span>
          </span>
          <ArrowRight className="size-5 shrink-0 transition group-hover:translate-x-1" aria-hidden />
        </Link>
      </motion.div>
    )
  }
  if (theirs === 'spin' || theirs === 'accept') {
    return (
      <Link
        to="/ruleta"
        className="focus-ring flex items-center gap-3 rounded-[20px] border border-white/8 bg-navy-850/70 px-4 py-3 text-sm font-semibold text-navy-200 hover:text-cream-50"
      >
        <span aria-hidden>🎰</span>
        <span className="flex-1">
          {partner?.display_name} {theirs === 'spin' ? 'todavía tiene que girar la ruleta' : 'aún no acepta su castigo'}.
        </span>
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    )
  }
  return null
}

/** Correcciones que pidió la pareja: solo se aplican si tú las apruebas. */
export function CorrectionApprovals({ corrections }: { corrections: PendingCorrection[] }) {
  const { partner, userId } = useSession()
  const resolve = useResolveCorrection()
  const toast = useToast()
  const incoming = corrections.filter((c) => c.requested_by !== userId)
  const outgoing = corrections.filter((c) => c.requested_by === userId)
  if (incoming.length === 0 && outgoing.length === 0) return null

  const decide = (id: string, approve: boolean) =>
    resolve.mutate(
      { id, approve },
      {
        onSuccess: () => toast.success(approve ? 'Corrección aprobada' : 'Corrección rechazada'),
        onError: (error) => toast.saveError(error, () => decide(id, approve)),
      },
    )

  return (
    <div className="space-y-2">
      {incoming.map((c) => (
        <motion.div
          key={c.id}
          layout
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[22px] border border-lilac-300/25 bg-lilac-400/8 p-4"
        >
          <p className="flex items-start gap-2 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-lilac-300" aria-hidden />
            <span>
              <strong>{partner?.display_name}</strong> pide corregir <strong>{c.goal_icon} {c.goal_title}</strong> del {formatLongDay(c.day).toLowerCase()} como{' '}
              <strong>{c.set_done ? 'cumplida' : 'no cumplida'}</strong>.
              {c.note && <span className="mt-1 block text-navy-300">“{c.note}”</span>}
            </span>
          </p>
          <div className="mt-3 flex gap-2 pl-6">
            <Button size="sm" variant="cream" icon={<Check className="size-4" aria-hidden />} onClick={() => decide(c.id, true)} disabled={resolve.isPending}>
              Aprobar
            </Button>
            <Button size="sm" variant="ghost" icon={<X className="size-4" aria-hidden />} onClick={() => decide(c.id, false)} disabled={resolve.isPending}>
              Rechazar
            </Button>
          </div>
        </motion.div>
      ))}
      {outgoing.map((c) => (
        <p key={c.id} className="rounded-[18px] bg-white/[0.04] px-4 py-2.5 text-sm text-navy-300">
          ⏳ Esperando que {partner?.display_name} apruebe tu corrección de {c.goal_icon} {c.goal_title} ({formatLongDay(c.day).toLowerCase()}).
        </p>
      ))}
    </div>
  )
}
