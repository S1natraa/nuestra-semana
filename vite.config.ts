import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Rol de una clave JWT clásica de Supabase (anon / service_role), si lo es. */
function jwtRole(token: string): string | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role ?? null
  } catch {
    return null
  }
}

/**
 * Credenciales PÚBLICAS de Supabase (las mismas que lee src/config/env.ts).
 * Detiene el arranque/compilación ante los errores típicos al copiarlas,
 * sobre todo si alguien pega una clave secreta: nunca debe llegar al navegador.
 */
function supabaseEnv(env: Record<string, string>) {
  const url = (env.VITE_SUPABASE_URL ?? '').trim()
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim()

  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
    throw new Error(
      '[.env.local] Esa clave es SECRETA (secret / service_role) y nunca debe ir en la app. ' +
        'Usa la "Publishable key" (sb_publishable_…) o la "anon key".',
    )
  }
  if (/supabase\.com\/dashboard/i.test(url)) {
    throw new Error('[.env.local] Esa es la dirección del panel de Supabase. Usa la "Project URL": https://<tu-proyecto>.supabase.co')
  }
  if (url && !/^https?:\/\/[^\s/]+/i.test(url)) {
    throw new Error('[.env.local] VITE_SUPABASE_URL debe empezar con https:// (la "Project URL" de Supabase).')
  }
  return { url, enabled: Boolean(url && key) }
}

export default defineConfig(({ mode, command }) => {
  // `--mode demo` (npm run dev:demo / build:demo): siempre modo demo y sin leer
  // .env.local, para que ninguna credencial termine en un build público.
  const demoOnly = mode === 'demo'
  const supabase = demoOnly ? { url: '', enabled: false } : supabaseEnv(loadEnv(mode, process.cwd(), 'VITE_'))
  const hasSupabase = supabase.enabled

  if (command === 'build') {
    console.log(
      demoOnly
        ? '\n✓ Build de demostración (dist-demo): datos de ejemplo en el navegador, sin credenciales.\n'
        : hasSupabase
          ? `\n✓ Build de producción conectado a Supabase: ${supabase.url}\n`
          : '\n⚠ Build en MODO DEMO: no hay credenciales de Supabase en .env.local.\n' +
            '  Cada navegador tendría sus propios datos de ejemplo; no lo publiques para usarlo en pareja.\n',
    )
  }

  return {
    envDir: demoOnly ? false : undefined,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        // Con Supabase, el módulo del modo demo se sustituye por un stub vacío.
        ...(hasSupabase
          ? [{ find: /^@\/demo\/demoBackend$/, replacement: fileURLToPath(new URL('./src/demo/disabled.ts', import.meta.url)) }]
          : []),
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      ],
    },
    // Constante de compilación: con Supabase configurado, el modo demo (PGlite)
    // ni siquiera se incluye en el build de producción.
    define: {
      __DEMO_MODE__: JSON.stringify(!hasSupabase),
    },
    // PGlite (modo demo) carga su propio WASM; no debe pre-empaquetarse.
    optimizeDeps: {
      exclude: ['@electric-sql/pglite'],
    },
    build: {
      // El único chunk grande es PGlite, y solo se descarga en modo demo.
      chunkSizeWarningLimit: 800,
    },
    server: {
      port: 5173,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
      testTimeout: 60_000,
      hookTimeout: 60_000,
    },
  }
})
