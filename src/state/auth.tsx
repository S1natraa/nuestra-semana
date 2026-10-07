import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { SplashScreen } from '@/components/feedback/SplashScreen'
import type { AuthUser } from '@/services/backend'
import { useBackend } from './backend'

interface AuthContextValue {
  user: AuthUser | null
  /** true tras abrir el enlace de "olvidé mi contraseña" (Supabase). */
  recovering: boolean
  clearRecovery(): void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = useBackend()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    const apply = (next: AuthUser | null) => {
      // Al cambiar de persona se descarta la caché para no mezclar datos.
      if ((next?.id ?? null) !== lastUserId.current) {
        lastUserId.current = next?.id ?? null
        queryClient.clear()
      }
      setUser(next)
    }
    backend
      .getUser()
      .then((u) => active && apply(u))
      .catch(() => active && apply(null))
      .finally(() => active && setReady(true))
    const unsubscribe = backend.onAuthChange((next, event) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      apply(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [backend, queryClient])

  if (!ready) return <SplashScreen message="Abriendo tu semana…" />
  return (
    <AuthContext.Provider value={{ user, recovering, clearRecovery: () => setRecovering(false) }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
