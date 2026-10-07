/**
 * Configuración de entorno. Solo se leen claves PÚBLICAS de Supabase (URL y
 * publishable/anon key); nunca debe existir una clave secreta en el cliente
 * (vite.config.ts detiene la compilación si alguien pega una).
 * Sin estas variables la app arranca en MODO DEMO.
 */
// Acepta la URL aunque se haya copiado con "/rest/v1" o una barra final.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/(\/rest\/v1)?\/*$/, '')
export const SUPABASE_KEY = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim()

/** Decidido al compilar: así el build de producción no incluye nada del modo demo. */
export const IS_DEMO: boolean = __DEMO_MODE__
