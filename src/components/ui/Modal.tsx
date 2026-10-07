import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/browser'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Diálogo accesible: hoja inferior en móvil, ventana centrada en escritorio. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current
      const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    }, 30)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <ModalLayer key="modal">
          <motion.div
            className="absolute inset-0 bg-navy-950/75 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className={cn(
              'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/8 bg-navy-850 shadow-card sm:rounded-[28px]',
              size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
            )}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />
            <header className="flex items-start gap-3 px-5 pt-4 pb-3 sm:px-6 sm:pt-6">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-xl font-extrabold tracking-tight text-cream-50">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="mt-1 text-sm text-navy-300">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="focus-ring -mr-1 rounded-full p-2 text-navy-300 transition hover:bg-white/6 hover:text-cream-50"
                aria-label="Cerrar"
              >
                <X className="size-5" aria-hidden />
              </button>
            </header>
            <div className="scroll-thin flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
            {footer && <footer className="border-t border-white/6 bg-navy-900/60 px-5 py-4 pb-safe sm:px-6">{footer}</footer>}
          </motion.div>
        </ModalLayer>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Mientras el diálogo se desvanece, deja pasar los clics a la página. */
function ModalLayer({ children }: { children: ReactNode }) {
  const isPresent = useIsPresent()
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      style={{ pointerEvents: isPresent ? undefined : 'none' }}
    >
      {children}
    </div>
  )
}
