/** true cuando no hay credenciales de Supabase en el build (ver vite.config.ts). */
declare const __DEMO_MODE__: boolean

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
