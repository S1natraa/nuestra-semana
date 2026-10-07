/** Autenticación con Supabase Auth (correo + contraseña). */
import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Controls'
import { errorMessage } from '@/services/errors'
import type { SupabaseBackend } from '@/services/backend'
import { useAuth } from '@/state/auth'
import { useBackend } from '@/state/backend'
import { AuthLayout } from './AuthLayout'

function usePasswordAuth() {
  const backend = useBackend()
  if (backend.mode !== 'supabase') throw new Error('Solo disponible con Supabase')
  return (backend as SupabaseBackend).auth
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="rounded-2xl border border-coral-400/30 bg-coral-400/8 px-4 py-3 text-sm font-semibold text-coral-300" role="alert">
      {message}
    </p>
  )
}

export function LoginPage() {
  const auth = usePasswordAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!EMAIL.test(email.trim()) || !password) {
      setError('Escribe tu correo y tu contraseña.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await auth.signIn(email, password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/entrar' ? from : '/', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Hola de nuevo ✨" subtitle="Entra para ver cómo va su semana.">
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Correo">
          {(props) => <TextInput {...props} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Contraseña">
          {(props) => (
            <TextInput {...props} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" block loading={busy}>
          Entrar
        </Button>
      </form>
      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm">
        <Link to="/recuperar" className="focus-ring rounded font-semibold text-navy-200 hover:text-cream-50">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link to="/registro" state={location.state} className="focus-ring rounded font-bold text-blush-300 hover:text-blush-200">
          Crear cuenta
        </Link>
      </div>
    </AuthLayout>
  )
}

export function SignupPage() {
  const auth = usePasswordAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || name.trim().length > 30) return setError('Escribe tu nombre (máx. 30 caracteres).')
    if (!EMAIL.test(email.trim())) return setError('Ese correo no parece válido.')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    setBusy(true)
    setError(null)
    try {
      const { needsConfirmation } = await auth.signUp(email, password, name)
      if (needsConfirmation) setSentTo(email.trim())
      else navigate('/bienvenida', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <AuthLayout title="Revisa tu correo 💌" subtitle={<>Te enviamos un enlace de confirmación a <strong className="text-cream-50">{sentTo}</strong>.</>}>
        <div className="flex items-center gap-3 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <MailCheck className="size-8 text-mint-300" aria-hidden />
          <p className="text-sm text-navy-200">Ábrelo desde este dispositivo para entrar directamente. Después podrás crear tu pareja o unirte con un código.</p>
        </div>
        <Link to="/entrar" className="focus-ring mt-6 inline-block rounded font-bold text-blush-300">
          Volver a entrar
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Crea tu cuenta" subtitle="Cada persona tiene su propia cuenta. Después se unen como pareja.">
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="¿Cómo te llamas?">
          {(props) => <TextInput {...props} autoComplete="given-name" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Correo">
          {(props) => <TextInput {...props} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres.">
          {(props) => (
            <TextInput {...props} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" block loading={busy}>
          Crear cuenta
        </Button>
      </form>
      <p className="mt-6 text-sm text-navy-300">
        ¿Ya tienes cuenta?{' '}
        <Link to="/entrar" className="focus-ring rounded font-bold text-blush-300">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  )
}

export function ForgotPasswordPage() {
  const auth = usePasswordAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!EMAIL.test(email.trim())) return setError('Ese correo no parece válido.')
    setBusy(true)
    setError(null)
    try {
      await auth.requestPasswordReset(email)
      setSent(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Recupera tu acceso" subtitle="Te enviaremos un enlace para elegir una contraseña nueva.">
      {sent ? (
        <p className="rounded-3xl border border-mint-400/25 bg-mint-400/8 p-5 text-sm text-mint-300" role="status">
          Si existe una cuenta con ese correo, recibirás el enlace en unos minutos.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Field label="Correo">
            {(props) => <TextInput {...props} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" block loading={busy}>
            Enviar enlace
          </Button>
        </form>
      )}
      <Link to="/entrar" className="focus-ring mt-6 inline-block rounded text-sm font-bold text-blush-300">
        Volver a entrar
      </Link>
    </AuthLayout>
  )
}

export function ResetPasswordPage() {
  const auth = usePasswordAuth()
  const { user, clearRecovery } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    setError(null)
    try {
      await auth.updatePassword(password)
      clearRecovery()
      navigate('/', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <AuthLayout title="Enlace no válido" subtitle="El enlace expiró o ya se usó.">
        <Link to="/recuperar" className="focus-ring inline-block rounded font-bold text-blush-300">
          Pedir un enlace nuevo
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Nueva contraseña" subtitle="Elige una contraseña que recuerdes.">
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Contraseña nueva" hint="Mínimo 8 caracteres.">
          {(props) => <TextInput {...props} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Field label="Repite la contraseña">
          {(props) => <TextInput {...props} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" block loading={busy}>
          Guardar y entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
