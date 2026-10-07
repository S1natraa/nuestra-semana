/** Crear pareja, invitar y unirse con código. */
import { motion } from 'framer-motion'
import { Copy, Heart, LogOut, Share2, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Avatar } from '@/components/avatar/Avatar'
import { SplashScreen } from '@/components/feedback/SplashScreen'
import { ErrorState } from '@/components/feedback/States'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextInput } from '@/components/ui/Controls'
import { browserTimeZone } from '@/domain/dates'
import { copyToClipboard, localStore } from '@/lib/browser'
import { errorMessage } from '@/services/errors'
import { useAuth } from '@/state/auth'
import { useBackend } from '@/state/backend'
import { useCreateCouple, useJoinCouple } from '@/state/mutations'
import { useAppStateQuery, useCoupleRealtime } from '@/state/queries'
import { useToast } from '@/state/toast'

const PENDING_INVITE = 'nuestra-semana:pending-invite'

/** /unirse/:code — guarda el código y lleva a entrar/registrarse. */
export function JoinLinkPage() {
  const { code } = useParams()
  const { user } = useAuth()
  const backend = useBackend()
  if (code) localStore.set(PENDING_INVITE, code.toUpperCase())
  if (user) return <Navigate to="/bienvenida" replace />
  return <Navigate to={backend.mode === 'demo' ? '/entrar' : '/registro'} replace />
}

export function OnboardingPage() {
  const query = useAppStateQuery()
  const backend = useBackend()
  const navigate = useNavigate()
  const toast = useToast()
  const createCouple = useCreateCouple()
  const joinCouple = useJoinCouple()
  const [code, setCode] = useState(() => localStore.get<string>(PENDING_INVITE, ''))
  const [error, setError] = useState<string | null>(null)
  const waiting = Boolean(query.data?.couple && query.data.couple.member_count < 2)
  useCoupleRealtime(query.data?.couple?.id)

  // Mientras espera a su pareja, revisa cada pocos segundos.
  useEffect(() => {
    if (!waiting) return
    const timer = window.setInterval(() => void query.refetch(), 5000)
    return () => window.clearInterval(timer)
  }, [waiting, query])

  if (query.isPending) return <SplashScreen message="Preparando tu espacio…" />
  if (query.isError) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    )
  }
  const state = query.data
  if (state.couple && state.couple.member_count >= 2) return <Navigate to="/" replace />

  const create = async () => {
    setError(null)
    try {
      await createCouple.mutateAsync(browserTimeZone())
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const join = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await joinCouple.mutateAsync(code)
      localStore.remove(PENDING_INVITE)
      toast.success('¡Ya están juntos! ❤️', 'Configuren su primera semana.')
      navigate('/', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const inviteLink = state.couple ? `${window.location.origin}/unirse/${state.couple.invite_code}` : ''

  return (
    <div className="min-h-dvh px-5 py-10 sm:py-16">
      <div className="app-backdrop" aria-hidden />
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <span className="text-lg font-extrabold tracking-tight">Nuestra Semana</span>
          <button
            type="button"
            onClick={() => void backend.signOut()}
            className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-navy-300 hover:text-cream-50"
          >
            <LogOut className="size-4" aria-hidden /> {backend.mode === 'demo' ? 'Cambiar de perfil' : 'Salir'}
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-10 flex items-center gap-4">
          <Avatar profile={state.me} mood={4} size={72} />
          <div>
            <p className="text-sm font-semibold text-navy-300">Bienvenida/o</p>
            <h1 className="text-3xl font-extrabold tracking-tight">¡Hola, {state.me.display_name}!</h1>
          </div>
        </motion.div>

        {waiting && state.couple ? (
          <Card tone="glow" className="mt-8 text-center">
            <Heart className="mx-auto size-8 text-blush-300" aria-hidden />
            <h2 className="mt-3 text-2xl font-extrabold">Invita a tu pareja</h2>
            <p className="mt-1 text-navy-200">Comparte este código. En cuanto se una, empieza su primera semana juntos.</p>
            <p className="mt-6 font-mono text-5xl font-extrabold tracking-[0.2em] text-honey-300" aria-label={`Código de invitación ${state.couple.invite_code.split('').join(' ')}`}>
              {state.couple.invite_code}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button
                variant="cream"
                icon={<Copy className="size-4" aria-hidden />}
                onClick={async () => toast.success((await copyToClipboard(inviteLink)) ? 'Enlace copiado' : 'Copia el código manualmente')}
              >
                Copiar enlace
              </Button>
              {'share' in navigator && (
                <Button
                  variant="secondary"
                  icon={<Share2 className="size-4" aria-hidden />}
                  onClick={() => void navigator.share({ title: 'Nuestra Semana', text: `Únete a nuestra semana con el código ${state.couple!.invite_code}`, url: inviteLink }).catch(() => {})}
                >
                  Compartir
                </Button>
              )}
            </div>
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-navy-300" role="status">
              <motion.span className="size-2 rounded-full bg-mint-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity }} />
              Esperando a tu pareja…
            </p>
            {backend.mode === 'demo' && (
              <p className="mt-4 text-xs text-navy-400">Modo demo: toca «Cambiar de perfil», crea otro perfil y únete con este código.</p>
            )}
          </Card>
        ) : (
          <div className="mt-8 grid gap-4">
            <Card tone="glow">
              <Users className="size-7 text-lilac-300" aria-hidden />
              <h2 className="mt-3 text-xl font-extrabold">Crear nuestra pareja</h2>
              <p className="mt-1 text-sm text-navy-200">Recibirás un código para invitar a tu pareja. Usaremos tu zona horaria ({browserTimeZone()}) para saber cuándo empieza y termina cada día.</p>
              <Button className="mt-5" onClick={() => void create()} loading={createCouple.isPending}>
                Crear pareja
              </Button>
            </Card>
            <Card>
              <h2 className="text-xl font-extrabold">Tengo un código</h2>
              <p className="mt-1 text-sm text-navy-200">Tu pareja ya creó el espacio: escribe su código de 6 caracteres.</p>
              <form className="mt-4 flex gap-2" onSubmit={join}>
                <label htmlFor="invite-code" className="sr-only">
                  Código de invitación
                </label>
                <TextInput
                  id="invite-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ABC123"
                  autoComplete="off"
                  className="font-mono text-lg tracking-[0.3em] uppercase"
                />
                <Button type="submit" loading={joinCouple.isPending} disabled={code.length !== 6}>
                  Unirme
                </Button>
              </form>
            </Card>
          </div>
        )}
        {error && (
          <p className="mt-4 rounded-2xl border border-coral-400/30 bg-coral-400/8 px-4 py-3 text-sm font-semibold text-coral-300" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
