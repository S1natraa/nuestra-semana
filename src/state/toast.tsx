import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, CircleCheck, RefreshCw, Sparkles, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/browser'
import { toAppError } from '@/services/errors'

type Tone = 'success' | 'error' | 'info' | 'achievement'

interface ToastInput {
  tone?: Tone
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  duration?: number
}

interface ToastItem extends ToastInput {
  id: number
}

interface ToastApi {
  show(toast: ToastInput): void
  success(title: string, description?: string): void
  /** "No pudimos guardar este cambio." con botón de reintento si tiene sentido. */
  saveError(error: unknown, retry?: () => void): void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const show = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-2), { ...toast, id }])
      window.setTimeout(() => dismiss(id), toast.duration ?? (toast.action ? 8000 : 4200))
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ tone: 'success', title, description }),
      saveError: (error, retry) => {
        const appError = toAppError(error)
        show({
          tone: 'error',
          title: appError.retryable ? 'No pudimos guardar este cambio.' : appError.message,
          description: appError.retryable ? appError.message : undefined,
          action: appError.retryable && retry ? { label: 'Intentar nuevamente', onClick: retry } : undefined,
        })
      },
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.16 } }}
              className={cn(
                'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-card backdrop-blur-md',
                toast.tone === 'error'
                  ? 'border-coral-400/30 bg-navy-800/95'
                  : toast.tone === 'achievement'
                    ? 'border-honey-300/40 bg-navy-800/95'
                    : 'border-white/10 bg-navy-800/95',
              )}
              role={toast.tone === 'error' ? 'alert' : 'status'}
            >
              <span className="mt-0.5 shrink-0">
                {toast.tone === 'error' ? (
                  <CircleAlert className="size-5 text-coral-300" aria-hidden />
                ) : toast.tone === 'achievement' ? (
                  <Sparkles className="size-5 text-honey-300" aria-hidden />
                ) : (
                  <CircleCheck className="size-5 text-mint-300" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cream-50">{toast.title}</p>
                {toast.description && <p className="mt-0.5 text-sm text-navy-300">{toast.description}</p>}
                {toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick()
                      dismiss(toast.id)
                    }}
                    className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-full bg-cream-50 px-3 py-1.5 text-xs font-bold text-ink"
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="focus-ring -mr-1 rounded-full p-1 text-navy-300 hover:text-cream-50"
                aria-label="Cerrar aviso"
              >
                <X className="size-4" aria-hidden />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
