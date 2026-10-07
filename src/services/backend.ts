/**
 * Contrato común de los dos orígenes de datos:
 *   - Supabase (producción): Auth + PostgREST + Realtime + Storage.
 *   - Modo demo: la misma migración SQL ejecutándose en PGlite en el navegador.
 * La UI solo habla con esta interfaz (a través de `createApi`).
 */
import { IS_DEMO } from '@/config/env'
import type { Accent, AvatarStyle } from '@/domain/types'

export interface AuthUser {
  id: string
  email: string | null
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'USER_UPDATED' | 'TOKEN_REFRESHED' | 'INITIAL_SESSION' | string

export interface Backend {
  readonly mode: 'demo' | 'supabase'
  getUser(): Promise<AuthUser | null>
  onAuthChange(listener: (user: AuthUser | null, event: AuthEvent) => void): () => void
  signOut(): Promise<void>
  rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T>
  /** Sube una foto de perfil ya recortada y devuelve la URL a guardar en el perfil. */
  uploadAvatar(userId: string, image: Blob): Promise<string>
  /** Avisa cuando algo cambia en la pareja (la otra persona marcó una tarea, etc.). */
  subscribeCouple(coupleId: string, onChange: () => void): () => void
}

export interface PasswordAuth {
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
}

export interface SupabaseBackend extends Backend {
  readonly mode: 'supabase'
  readonly auth: PasswordAuth
}

export interface DemoUser {
  id: string
  display_name: string
  accent: Accent
  avatar: Partial<AvatarStyle>
  avatar_url: string | null
  partner_name: string | null
}

export interface DemoControls {
  listUsers(): Promise<DemoUser[]>
  signInAs(userId: string): Promise<void>
  createUser(displayName: string): Promise<string>
  getNow(): Promise<Date>
  setNow(target: Date): Promise<void>
  reset(): Promise<void>
}

export interface DemoBackend extends Backend {
  readonly mode: 'demo'
  readonly demo: DemoControls
}

export type AnyBackend = SupabaseBackend | DemoBackend

let loading: Promise<AnyBackend> | null = null

export function loadBackend(onStatus?: (message: string) => void): Promise<AnyBackend> {
  if (!loading) {
    loading = (
      IS_DEMO
        ? import('@/demo/demoBackend').then((m) => m.createDemoBackend(onStatus))
        : import('./supabaseBackend').then((m) => m.createSupabaseBackend())
    ).catch((error: unknown) => {
      loading = null
      throw error
    })
  }
  return loading
}
