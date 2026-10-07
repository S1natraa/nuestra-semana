import { motion } from 'framer-motion'
import { CircleAlert, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/browser'
import { errorMessage } from '@/services/errors'

// ─────────────────────────── Esqueletos ───────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-white/7', className)} aria-hidden />
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Cargando inicio">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <Skeleton className="h-64 rounded-[28px]" />
        <Skeleton className="h-64 rounded-[28px]" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Skeleton className="h-80 rounded-[28px]" />
        <Skeleton className="h-80 rounded-[28px]" />
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 4, label = 'Cargando' }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-3xl" />
      ))}
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Cargando estadísticas">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-44 rounded-[28px]" />
        <Skeleton className="h-44 rounded-[28px]" />
      </div>
      <Skeleton className="h-72 rounded-[28px]" />
      <ListSkeleton rows={3} />
    </div>
  )
}

// ─────────────────────────── Estado vacío ───────────────────────────

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('flex flex-col items-center rounded-[28px] border border-dashed border-white/12 px-6 py-12 text-center', className)}
    >
      <div className="grid size-16 place-items-center rounded-3xl bg-white/6 text-3xl" aria-hidden>
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-extrabold tracking-tight text-balance">{title}</h2>
      {description && <p className="mt-1.5 max-w-sm text-sm text-navy-300 text-balance">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  )
}

// ─────────────────────────── Error ───────────────────────────

export function ErrorState({ error, onRetry, title = 'No pudimos cargar esta información.' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="flex flex-col items-center rounded-[28px] border border-coral-400/25 bg-coral-400/5 px-6 py-10 text-center" role="alert">
      <CircleAlert className="size-8 text-coral-300" aria-hidden />
      <h2 className="mt-3 font-extrabold">{title}</h2>
      <p className="mt-1 text-sm text-navy-300">{errorMessage(error)}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full bg-cream-50 px-5 py-2.5 text-sm font-bold text-ink"
        >
          <RefreshCw className="size-4" aria-hidden /> Intentar nuevamente
        </button>
      )}
    </div>
  )
}
