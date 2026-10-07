/**
 * Normaliza errores de Supabase/PostgREST, de Postgres (PGlite) y de red en
 * mensajes claros para la persona usuaria.
 */

/** Códigos que usan nuestras funciones RPC para errores de negocio (mensaje apto para mostrar). */
const BUSINESS_CODES = new Set(['P0001', 'P0002', '22023', '42501', '28000'])

export class AppError extends Error {
  readonly code: string | undefined
  readonly retryable: boolean

  constructor(message: string, options: { code?: string; retryable?: boolean; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'AppError'
    this.code = options.code
    this.retryable = options.retryable ?? false
  }
}

interface ErrorLike {
  message?: unknown
  code?: unknown
  status?: unknown
  name?: unknown
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  const e = (error ?? {}) as ErrorLike
  const message = typeof e.message === 'string' ? e.message : ''
  const code = typeof e.code === 'string' ? e.code : undefined

  if (code && BUSINESS_CODES.has(code) && message) {
    return new AppError(message, { code, cause: error })
  }
  if (
    (error instanceof TypeError && /fetch|network|load failed/i.test(message)) ||
    /failed to fetch|networkerror|network request failed/i.test(message)
  ) {
    return new AppError('No pudimos conectar. Revisa tu conexión e inténtalo otra vez.', {
      code: 'network',
      retryable: true,
      cause: error,
    })
  }
  if (code === 'PGRST301' || /jwt expired/i.test(message)) {
    return new AppError('Tu sesión expiró. Vuelve a iniciar sesión.', { code: 'auth', cause: error })
  }
  return new AppError('Algo salió mal. Inténtalo de nuevo.', { code, retryable: true, cause: error })
}

export function errorMessage(error: unknown): string {
  return toAppError(error).message
}

/** Mensajes de Supabase Auth en español. */
export function authErrorMessage(error: unknown): string {
  const message = String((error as ErrorLike | null)?.message ?? '')
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(message)) return 'Confirma tu correo antes de entrar (revisa tu bandeja de entrada).'
  if (/already registered|already exists/i.test(message)) return 'Ya existe una cuenta con ese correo.'
  if (/signups? (are |is )?(not allowed|disabled)/i.test(message)) return 'El registro de cuentas nuevas está cerrado. Si ya tienes cuenta, entra con tu correo.'
  if (/password should be at least|weak password/i.test(message)) return 'La contraseña debe tener al menos 8 caracteres.'
  if (/rate limit|too many/i.test(message)) return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.'
  if (/invalid email|unable to validate email/i.test(message)) return 'Ese correo no parece válido.'
  if (/failed to fetch|network/i.test(message)) return 'No pudimos conectar. Revisa tu conexión.'
  return message || 'No pudimos completar la acción.'
}
