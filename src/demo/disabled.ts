/**
 * Sustituye a `demoBackend.ts` en los builds con Supabase configurado (ver el
 * alias en vite.config.ts), para que PGlite y los datos demo no se incluyan.
 */
import type { DemoBackend } from '@/services/backend'

export function createDemoBackend(): Promise<DemoBackend> {
  return Promise.reject(new Error('El modo demo no está incluido en este build.'))
}
