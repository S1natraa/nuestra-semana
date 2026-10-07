import confetti from 'canvas-confetti'

const PALETTE = ['#ffb3c9', '#ff94b4', '#a9d6ff', '#cbbcff', '#ffe08e', '#fffaf2', '#9eeccd']

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Pequeña ráfaga desde un punto (0–1 relativo a la ventana). */
export function confettiBurst(origin: { x: number; y: number } = { x: 0.5, y: 0.6 }, amount = 60) {
  void confetti({
    particleCount: amount,
    spread: 70,
    startVelocity: 32,
    gravity: 1.05,
    ticks: 180,
    scalar: 0.9,
    origin,
    colors: PALETTE,
    disableForReducedMotion: true,
  })
}

/** Celebración grande: cañones desde ambos lados durante ~1.6 s. */
export function confettiCelebration() {
  const end = Date.now() + 1600
  const frame = () => {
    void confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors: PALETTE, disableForReducedMotion: true })
    void confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors: PALETTE, disableForReducedMotion: true })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
  confettiBurst({ x: 0.5, y: 0.45 }, 110)
}

export function originFromElement(element: Element | null | undefined): { x: number; y: number } | undefined {
  if (!element || typeof window === 'undefined') return undefined
  const rect = element.getBoundingClientRect()
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  }
}
