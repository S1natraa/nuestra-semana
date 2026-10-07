/**
 * Herramientas del MODO DEMO (no existen con Supabase): cambiar de persona y
 * avanzar el reloj para recorrer domingo → lunes … viernes → cierre.
 */
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, FastForward, FlaskConical, RotateCcw, Sunrise, Trophy, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar } from '@/components/avatar/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { addDays, formatLongDay, isoWeekday, todayInTimeZone, zonedTimeToInstant } from '@/domain/dates'
import { useDemo } from '@/state/backend'
import { useSession } from '@/state/queries'
import { useToast } from '@/state/toast'
import { errorMessage } from '@/services/errors'

export function DemoPanel() {
  const demo = useDemo()
  const session = useSession()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState<Date | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const timeZone = session.state.couple?.timezone ?? 'UTC'
  const today = session.state.today
  const weekday = isoWeekday(today)

  useEffect(() => {
    if (open && demo) void demo.getNow().then(setNow)
  }, [open, demo, today])

  if (!demo) return null

  const travel = async (label: string, date: string, hour: number, minute = 0) => {
    setBusy(label)
    try {
      await demo.setNow(zonedTimeToInstant(date, hour, minute, timeZone))
      await queryClient.invalidateQueries()
      setNow(await demo.getNow())
      toast.success('Reloj de demo actualizado', `${formatLongDay(date)}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    } catch (error) {
      toast.show({ tone: 'error', title: errorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  const switchTo = async (userId: string) => {
    setBusy('switch')
    try {
      await demo.signInAs(userId)
      setOpen(false)
    } finally {
      setBusy(null)
    }
  }

  const daysToSaturday = 6 - weekday
  const daysToSunday = 7 - weekday
  const daysToMonday = 8 - weekday

  const clock = now
    ? `${formatLongDay(todayInTimeZone(timeZone, now))} · ${now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', timeZone })}`
    : '…'

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring fixed right-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 inline-flex size-11 items-center justify-center gap-2 rounded-full border border-honey-300/30 bg-navy-800/95 text-sm font-extrabold text-honey-300 shadow-card backdrop-blur lg:right-auto lg:bottom-24 lg:left-6 lg:size-auto lg:px-4 lg:py-2.5"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
        aria-label="Abrir herramientas del modo demo"
        title="Herramientas del modo demo"
      >
        <FlaskConical className="size-[18px] lg:size-4" aria-hidden />
        <span className="hidden lg:inline">Demo</span>
      </motion.button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Herramientas del modo demo"
        description="Datos de ejemplo guardados solo en este navegador. Con Supabase conectado, este panel no existe."
      >
        <div className="space-y-6">
          <section>
            <h3 className="text-xs font-extrabold tracking-[0.14em] text-navy-300 uppercase">Ver la app como</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[session.me, session.partner].filter(Boolean).map((profile) => {
                const current = profile!.id === session.userId
                return (
                  <button
                    key={profile!.id}
                    type="button"
                    disabled={current || busy !== null}
                    onClick={() => void switchTo(profile!.id)}
                    className="focus-ring flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-left transition enabled:hover:bg-white/6 disabled:cursor-default"
                  >
                    <Avatar profile={profile!} size={40} decorative />
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold">{profile!.display_name}</span>
                      <span className="text-xs text-navy-300">{current ? 'Eres tú ahora' : 'Cambiar'}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-extrabold tracking-[0.14em] text-navy-300 uppercase">Reloj simulado</h3>
            <p className="mt-2 flex items-center gap-2 text-[15px] font-bold">
              <CalendarDays className="size-4 text-lilac-300" aria-hidden /> {clock}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                icon={<FastForward className="size-4" aria-hidden />}
                loading={busy === 'day'}
                disabled={busy !== null}
                onClick={() => void travel('day', addDays(today, 1), 9)}
              >
                Siguiente día (9:00)
              </Button>
              <Button
                variant="secondary"
                icon={<Trophy className="size-4" aria-hidden />}
                loading={busy === 'close'}
                disabled={busy !== null || weekday >= 6}
                onClick={() => void travel('close', addDays(today, daysToSaturday), 9)}
              >
                Cerrar semana (sábado)
              </Button>
              <Button
                variant="secondary"
                icon={<Sunrise className="size-4" aria-hidden />}
                loading={busy === 'sunday'}
                disabled={busy !== null || weekday === 7}
                onClick={() => void travel('sunday', addDays(today, daysToSunday), 18)}
              >
                Ir al domingo (18:00)
              </Button>
              <Button
                variant="secondary"
                icon={<UserRound className="size-4" aria-hidden />}
                loading={busy === 'monday'}
                disabled={busy !== null}
                onClick={() => void travel('monday', addDays(today, daysToMonday), 8)}
              >
                Ir al lunes (8:00)
              </Button>
            </div>
            <p className="mt-2 text-xs text-navy-300">El tiempo solo avanza. Así se prueban el cierre del viernes y la ruleta sin esperar.</p>
          </section>

          <section className="relative rounded-2xl border border-coral-400/20 bg-coral-400/5 p-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {confirmReset ? (
                <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-sm font-semibold">¿Borrar todos los datos demo y empezar de nuevo?</p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="danger" size="sm" onClick={() => void demo.reset()}>
                      Sí, reiniciar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                      Cancelar
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-navy-200">Vuelve al presente con datos de ejemplo nuevos.</p>
                  <Button variant="danger" size="sm" icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => setConfirmReset(true)}>
                    Reiniciar demo
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </Modal>
    </>
  )
}
