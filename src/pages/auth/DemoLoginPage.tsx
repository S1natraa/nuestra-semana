/** MODO DEMO: se elige un perfil (sin contraseñas). No existe con Supabase. */
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, FlaskConical, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '@/components/avatar/Avatar'
import { ErrorState, ListSkeleton } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Controls'
import { errorMessage } from '@/services/errors'
import { useDemo } from '@/state/backend'
import { AuthLayout } from './AuthLayout'

export function DemoLoginPage() {
  const demo = useDemo()!
  const navigate = useNavigate()
  const users = useQuery({ queryKey: ['demo-users'], queryFn: () => demo.listUsers() })
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const enter = async (id: string) => {
    setBusy(id)
    try {
      await demo.signInAs(id)
      navigate('/', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy('new')
    try {
      const id = await demo.createUser(name)
      await demo.signInAs(id)
      navigate('/bienvenida', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  return (
    <AuthLayout
      title="¿Quién eres?"
      subtitle={
        <span className="inline-flex items-center gap-2">
          <FlaskConical className="size-4 text-honey-300" aria-hidden /> Modo demo · los datos viven solo en este navegador.
        </span>
      }
    >
      {users.isPending ? (
        <ListSkeleton rows={2} label="Cargando perfiles" />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : (
        <ul className="space-y-3">
          {users.data.map((user, i) => (
            <motion.li key={user.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <button
                type="button"
                onClick={() => void enter(user.id)}
                disabled={busy !== null}
                className="focus-ring group flex w-full items-center gap-4 rounded-[24px] border border-white/8 bg-navy-850/80 p-4 text-left shadow-soft transition hover:border-white/20 hover:bg-navy-800 disabled:opacity-60"
              >
                <Avatar profile={user} mood={3} size={56} decorative />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-extrabold">Entrar como {user.display_name}</span>
                  <span className="text-sm text-navy-300">{user.partner_name ? `En pareja con ${user.partner_name}` : 'Sin pareja todavía'}</span>
                </span>
                <ArrowRight className="size-5 text-navy-300 transition group-hover:translate-x-1 group-hover:text-cream-50" aria-hidden />
              </button>
            </motion.li>
          ))}
        </ul>
      )}

      <form onSubmit={create} className="mt-8 rounded-[24px] border border-dashed border-white/12 p-5">
        <h2 className="flex items-center gap-2 font-extrabold">
          <UserPlus className="size-5 text-lilac-300" aria-hidden /> Empezar desde cero
        </h2>
        <p className="mt-1 text-sm text-navy-300">Crea un perfil nuevo para probar el registro de una pareja (crear, invitar y unirse con código).</p>
        <Field label="Tu nombre" className="mt-4">
          {(props) => <TextInput {...props} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Ej. Alex" />}
        </Field>
        {error && (
          <p className="mt-3 text-sm font-semibold text-coral-300" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="secondary" className="mt-4" loading={busy === 'new'} disabled={!name.trim() || busy !== null}>
          Crear perfil demo
        </Button>
      </form>

      <p className="mt-6 text-xs leading-relaxed text-navy-400">
        Para usar cuentas reales, configura <code className="text-navy-200">VITE_SUPABASE_URL</code> y{' '}
        <code className="text-navy-200">VITE_SUPABASE_PUBLISHABLE_KEY</code> (ver README).
      </p>
    </AuthLayout>
  )
}
