/** Pequeñas utilidades del navegador. */

export function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch {
    // No disponible: se ignora.
  }
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export const localStore = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Almacenamiento no disponible (modo privado, etc.).
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // idem
    }
  },
}

/**
 * Recorta al centro y reduce una imagen a un cuadrado JPEG para usarla como
 * foto de perfil (ligera, sin metadatos EXIF).
 */
export async function prepareAvatarImage(file: File, size = 320): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Elige una imagen (JPG, PNG o WebP).')
  if (file.size > 12 * 1024 * 1024) throw new Error('La imagen es demasiado grande (máx. 12 MB).')
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No pudimos procesar la imagen.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No pudimos procesar la imagen.'))), 'image/jpeg', 0.86)
  })
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
