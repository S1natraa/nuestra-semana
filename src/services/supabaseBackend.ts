/** Backend de producción: Supabase Auth + RPC (PostgREST) + Realtime + Storage. */
import { createClient, type User } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '@/config/env'
import type { AuthUser, SupabaseBackend } from './backend'
import { AppError, authErrorMessage, toAppError } from './errors'

function toAuthUser(user: User | null | undefined): AuthUser | null {
  return user ? { id: user.id, email: user.email ?? null } : null
}

export function createSupabaseBackend(): SupabaseBackend {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })

  return {
    mode: 'supabase',

    async getUser() {
      const { data, error } = await client.auth.getSession()
      if (error) throw toAppError(error)
      return toAuthUser(data.session?.user)
    },

    onAuthChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        listener(toAuthUser(session?.user), event)
      })
      return () => data.subscription.unsubscribe()
    },

    async signOut() {
      const { error } = await client.auth.signOut()
      if (error) throw toAppError(error)
    },

    async rpc<T>(fn: string, args?: Record<string, unknown>) {
      const { data, error } = await client.rpc(fn, args ?? {})
      if (error) throw toAppError(error)
      return data as T
    },

    async uploadAvatar(userId, image) {
      const path = `${userId}/${crypto.randomUUID()}.jpg`
      const { error } = await client.storage.from('avatars').upload(path, image, {
        contentType: image.type || 'image/jpeg',
        cacheControl: '31536000',
        upsert: false,
      })
      if (error) throw new AppError('No pudimos subir la foto. Inténtalo de nuevo.', { retryable: true, cause: error })
      return client.storage.from('avatars').getPublicUrl(path).data.publicUrl
    },

    subscribeCouple(coupleId, onChange) {
      const channel = client
        .channel(`couple-${coupleId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${coupleId}` }, () =>
          onChange(),
        )
        .subscribe()
      return () => {
        void client.removeChannel(channel)
      }
    },

    auth: {
      async signIn(email, password) {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new AppError(authErrorMessage(error), { cause: error })
      },

      async signUp(email, password, displayName) {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: `${window.location.origin}/`,
          },
        })
        if (error) throw new AppError(authErrorMessage(error), { cause: error })
        return { needsConfirmation: !data.session }
      },

      async requestPasswordReset(email) {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/restablecer`,
        })
        if (error) throw new AppError(authErrorMessage(error), { cause: error })
      },

      async updatePassword(password) {
        const { error } = await client.auth.updateUser({ password })
        if (error) throw new AppError(authErrorMessage(error), { cause: error })
      },
    },
  }
}
