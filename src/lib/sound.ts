/**
 * Sonidos sintetizados con Web Audio (sin archivos). Desactivados por
 * defecto; se activan desde Configuración.
 */
export type SoundName = 'complete' | 'uncheck' | 'progress' | 'victory' | 'tick' | 'spin' | 'result' | 'achievement'

let context: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  context ??= new Ctor()
  if (context.state === 'suspended') void context.resume()
  return context
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, options: { type?: OscillatorType; gain?: number; glideTo?: number } = {}) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = options.type ?? 'sine'
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + start)
  if (options.glideTo) osc.frequency.exponentialRampToValueAtTime(options.glideTo, ctx.currentTime + start + duration)
  const peak = options.gain ?? 0.12
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(ctx.currentTime + start)
  osc.stop(ctx.currentTime + start + duration + 0.05)
}

export function playSound(name: SoundName) {
  const ctx = audio()
  if (!ctx) return
  switch (name) {
    case 'complete':
      tone(ctx, 660, 0, 0.12, { type: 'triangle' })
      tone(ctx, 990, 0.07, 0.18, { type: 'triangle' })
      break
    case 'uncheck':
      tone(ctx, 520, 0, 0.12, { type: 'sine', glideTo: 380, gain: 0.07 })
      break
    case 'progress':
      ;[523, 659, 784].forEach((f, i) => tone(ctx, f, i * 0.06, 0.16, { type: 'triangle', gain: 0.08 }))
      break
    case 'victory':
      ;[523, 659, 784, 1047].forEach((f, i) => tone(ctx, f, i * 0.11, i === 3 ? 0.6 : 0.2, { type: 'triangle', gain: 0.11 }))
      tone(ctx, 1319, 0.44, 0.5, { type: 'sine', gain: 0.05 })
      break
    case 'tick':
      tone(ctx, 1800, 0, 0.03, { type: 'square', gain: 0.025 })
      break
    case 'spin':
      tone(ctx, 220, 0, 0.5, { type: 'sawtooth', gain: 0.03, glideTo: 660 })
      break
    case 'result':
      ;[784, 988, 1175].forEach((f, i) => tone(ctx, f, i * 0.09, 0.35, { type: 'sine', gain: 0.1 }))
      break
    case 'achievement':
      ;[880, 1109, 1319, 1760].forEach((f, i) => tone(ctx, f, i * 0.07, 0.25, { type: 'triangle', gain: 0.07 }))
      break
  }
}
