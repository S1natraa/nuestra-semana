import { describe, expect, it } from 'vitest'
import { authErrorMessage, toAppError } from './errors'

describe('mensajes de error de Supabase Auth', () => {
  it.each([
    ['Invalid login credentials', 'Correo o contraseña incorrectos.'],
    ['Email not confirmed', 'Confirma tu correo antes de entrar (revisa tu bandeja de entrada).'],
    ['User already registered', 'Ya existe una cuenta con ese correo.'],
    ['Signups not allowed for this instance', 'El registro de cuentas nuevas está cerrado. Si ya tienes cuenta, entra con tu correo.'],
    ['Email signups are disabled', 'El registro de cuentas nuevas está cerrado. Si ya tienes cuenta, entra con tu correo.'],
    ['email rate limit exceeded', 'Demasiados intentos. Espera un momento y vuelve a intentarlo.'],
  ])('%s', (message, expected) => {
    expect(authErrorMessage({ message })).toBe(expected)
  })
})

describe('errores de las funciones RPC', () => {
  it('muestra los mensajes de negocio tal cual y marca los de red como reintentables', () => {
    expect(toAppError({ code: 'P0001', message: 'La semana ya está cerrada.' }).message).toBe('La semana ya está cerrada.')
    const network = toAppError(new TypeError('Failed to fetch'))
    expect(network.retryable).toBe(true)
    expect(network.code).toBe('network')
  })
})
