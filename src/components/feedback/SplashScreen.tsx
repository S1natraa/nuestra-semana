import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'

interface SplashScreenProps {
  message?: string
  error?: string
  onRetry?: () => void
}

/** Pantalla de arranque: nunca se muestra una pantalla en blanco. */
export function SplashScreen({ message, error, onRetry }: SplashScreenProps) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="app-backdrop" aria-hidden />
      <div className="flex max-w-sm flex-col items-center text-center">
        <motion.div
          animate={error ? undefined : { scale: [1, 1.08, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Logo size={64} />
        </motion.div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Nuestra Semana</h1>
        {error ? (
          <>
            <p className="mt-3 text-navy-200" role="alert">
              {error}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="focus-ring mt-6 inline-flex items-center gap-2 rounded-full bg-cream-50 px-5 py-3 font-bold text-ink"
              >
                <RefreshCw className="size-4" aria-hidden /> Intentar nuevamente
              </button>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-navy-300" role="status">
            {message ?? 'Cargando…'}
          </p>
        )}
      </div>
    </div>
  )
}
