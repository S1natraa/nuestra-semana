import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SplashScreen } from '@/components/feedback/SplashScreen'
import { createApi, type Api } from '@/services/api'
import { loadBackend, type AnyBackend } from '@/services/backend'
import { AppError } from '@/services/errors'

interface BackendContextValue {
  backend: AnyBackend
  api: Api
}

const BackendContext = createContext<BackendContextValue | null>(null)

export function BackendProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<BackendContextValue | null>(null)
  const [status, setStatus] = useState('Cargando…')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setError(null)
    loadBackend((message) => active && setStatus(message))
      .then((backend) => {
        if (active) setValue({ backend, api: createApi(backend) })
      })
      .catch((e: unknown) => {
        if (!active) return
        console.error(e)
        setError(e instanceof AppError ? e.message : 'No pudimos iniciar la aplicación. Recarga la página para intentarlo de nuevo.')
      })
    return () => {
      active = false
    }
  }, [attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  if (error) return <SplashScreen error={error} onRetry={retry} />
  if (!value) return <SplashScreen message={status} />
  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>
}

export function useBackend(): AnyBackend {
  const ctx = useContext(BackendContext)
  if (!ctx) throw new Error('useBackend debe usarse dentro de <BackendProvider>')
  return ctx.backend
}

export function useApi(): Api {
  const ctx = useContext(BackendContext)
  if (!ctx) throw new Error('useApi debe usarse dentro de <BackendProvider>')
  return ctx.api
}

/** Memo estable del backend demo (o null en producción). */
export function useDemo() {
  const backend = useBackend()
  return useMemo(() => (backend.mode === 'demo' ? backend.demo : null), [backend])
}
