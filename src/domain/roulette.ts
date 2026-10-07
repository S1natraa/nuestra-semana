/**
 * Geometría de la ruleta. El resultado lo elige el servidor (aleatoriedad
 * criptográfica); aquí solo se calcula la rotación para que la animación
 * termine exactamente en ese segmento, en un punto aleatorio dentro de él.
 *
 * Convención: el segmento i ocupa [i·s, (i+1)·s) grados en sentido horario
 * desde las 12 en punto (donde está el puntero). Girar la rueda R grados en
 * sentido horario deja bajo el puntero el ángulo (−R mod 360) de la rueda.
 */

export function mod(value: number, m: number): number {
  return ((value % m) + m) % m
}

export function segmentAngle(count: number): number {
  return 360 / count
}

/** Índice del segmento que queda bajo el puntero con la rueda girada `rotation` grados. */
export function segmentAtRotation(rotation: number, count: number): number {
  const theta = mod(-rotation, 360)
  return Math.min(count - 1, Math.floor(theta / segmentAngle(count)))
}

export interface SpinPlan {
  /** Rotación final absoluta en grados. */
  rotation: number
  /** Duración de la animación en segundos. */
  duration: number
}

/**
 * Calcula la rotación final para aterrizar en `index`. `random` debe devolver
 * valores en [0, 1). El punto exacto dentro del segmento, las vueltas extra y
 * la duración varían en cada giro.
 */
export function planSpin(currentRotation: number, index: number, count: number, random: () => number = Math.random): SpinPlan {
  const size = segmentAngle(count)
  const offset = size * (0.12 + 0.76 * random())
  const landingTheta = index * size + offset
  const turns = 6 + Math.floor(random() * 3)
  const base = currentRotation + turns * 360
  const delta = mod(mod(-landingTheta, 360) - mod(base, 360), 360)
  return {
    rotation: base + delta,
    duration: 5.2 + random() * 1.6,
  }
}

/** Ángulo central (grados, horario desde arriba) del segmento i. */
export function segmentCenter(index: number, count: number): number {
  return (index + 0.5) * segmentAngle(count)
}
