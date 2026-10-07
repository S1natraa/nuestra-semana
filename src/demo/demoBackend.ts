/**
 * MODO DEMO — se activa solo cuando no hay credenciales de Supabase.
 * Datos guardados en este navegador (IndexedDB) con una base Postgres real
 * (PGlite) que ejecuta la misma migración que producción.
 * Las sesiones demo no usan contraseñas: se elige un perfil.
 */
import type { PGlite } from '@electric-sql/pglite'
import { browserTimeZone } from '@/domain/dates'
import type { AuthUser, DemoBackend, DemoUser } from '@/services/backend'
import { AppError, toAppError } from '@/services/errors'
import {
  SCHEMA_FINGERPRINT,
  callRpc,
  createDemoUser,
  getSimulatedNow,
  openDatabase,
  setSimulatedNow,
} from './pgliteDb'
import { seedDemo } from './seed'

const DB_PREFIX = 'nuestra-semana-demo'
const SESSION_KEY = 'nuestra-semana:demo-session'
const LOCK_NAME = 'nuestra-semana-demo-db'

export class DemoLockedError extends AppError {
  constructor() {
    super('El modo demo ya está abierto en otra pestaña. Ciérrala y vuelve a intentarlo.', { code: 'demo-locked', retryable: true })
  }
}

export async function createDemoBackend(onStatus?: (message: string) => void): Promise<DemoBackend> {
  await acquireTabLock()
  const dbName = `${DB_PREFIX}-${SCHEMA_FINGERPRINT}`
  onStatus?.('Preparando la base de datos local…')
  void removeStaleDatabases(dbName)

  let db = (await databaseExists(`/pglite/${dbName}`)) ? await openDatabase({ dataDir: `idb://${dbName}` }) : null
  if (!db || !(await isSeeded(db))) {
    await db?.close()
    // El seed se genera en memoria (rápido) y luego se guarda de una vez en IndexedDB.
    onStatus?.('Creando semanas de ejemplo para Dani y Sami…')
    const memory = await openDatabase()
    await seedDemo(memory, { timeZone: browserTimeZone() })
    await memory.query(`create table demo.meta (key text primary key, value text)`)
    await memory.query(`insert into demo.meta (key, value) values ('seeded', now()::text)`)
    const snapshot = await memory.dumpDataDir('none')
    await memory.close()
    await deleteDatabase(`/pglite/${dbName}`)
    onStatus?.('Guardando en este navegador…')
    db = await openDatabase({ dataDir: `idb://${dbName}`, loadDataDir: snapshot })
  }

  let currentUser: AuthUser | null = await restoreSession(db)
  const listeners = new Set<(user: AuthUser | null, event: string) => void>()
  const emit = (event: string) => listeners.forEach((listener) => listener(currentUser, event))

  const backend: DemoBackend = {
    mode: 'demo',

    async getUser() {
      return currentUser
    },

    onAuthChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async signOut() {
      currentUser = null
      safeStorage.remove(SESSION_KEY)
      emit('SIGNED_OUT')
    },

    async rpc<T>(fn: string, args?: Record<string, unknown>) {
      const started = performance.now()
      try {
        return (await callRpc(db, currentUser?.id ?? null, fn, args)) as T
      } catch (error) {
        throw toAppError(error)
      } finally {
        if (import.meta.env.DEV) console.debug(`[demo rpc] ${fn}: ${Math.round(performance.now() - started)} ms`)
      }
    },

    async uploadAvatar(_userId, image) {
      return blobToDataUrl(image)
    },

    subscribeCouple() {
      // Una sola pestaña y un solo usuario activo a la vez: no hay nada que escuchar.
      return () => {}
    },

    demo: {
      async listUsers() {
        const res = await db.query<DemoUser>(`
          select p.id, p.display_name, p.accent, p.avatar, p.avatar_url,
                 (select pp.display_name
                    from public.couple_members me
                    join public.couple_members other on other.couple_id = me.couple_id and other.user_id <> me.user_id
                    join public.profiles pp on pp.id = other.user_id
                   where me.user_id = p.id) as partner_name
          from public.profiles p
          order by p.created_at, p.display_name`)
        return res.rows
      },

      async signInAs(userId) {
        const res = await db.query<{ id: string; email: string | null }>('select id, email from auth.users where id = $1', [userId])
        const row = res.rows[0]
        if (!row) throw new AppError('Ese perfil demo ya no existe.')
        currentUser = { id: row.id, email: row.email }
        safeStorage.set(SESSION_KEY, row.id)
        emit('SIGNED_IN')
      },

      async createUser(displayName) {
        const name = displayName.trim()
        if (!name || name.length > 30) throw new AppError('El nombre debe tener entre 1 y 30 caracteres.')
        return createDemoUser(db, name)
      },

      getNow: () => getSimulatedNow(db),

      async setNow(target) {
        const current = await getSimulatedNow(db)
        if (target.getTime() < current.getTime() - 60_000) {
          throw new AppError('En el modo demo el tiempo solo avanza. Reinicia el demo para volver al presente.')
        }
        await setSimulatedNow(db, target)
      },

      async reset() {
        await db.close()
        safeStorage.remove(SESSION_KEY)
        await deleteDatabase(`/pglite/${dbName}`)
        window.location.assign('/')
      },
    },
  }

  return backend
}

async function databaseExists(name: string): Promise<boolean> {
  try {
    if (indexedDB.databases) {
      const all = await indexedDB.databases()
      return all.some((info) => info.name === name)
    }
  } catch {
    // Sin soporte: se asume que existe y se verifica el seed al abrir.
  }
  return true
}

async function isSeeded(db: PGlite): Promise<boolean> {
  const res = await db.query<{ ok: boolean }>(
    `select exists (select 1 from information_schema.tables where table_schema = 'demo' and table_name = 'meta') as ok`,
  )
  return Boolean(res.rows[0]?.ok)
}

async function restoreSession(db: PGlite): Promise<AuthUser | null> {
  const id = safeStorage.get(SESSION_KEY)
  if (!id) return null
  const res = await db.query<{ id: string; email: string | null }>('select id, email from auth.users where id = $1', [id])
  return res.rows[0] ? { id: res.rows[0].id, email: res.rows[0].email } : null
}

/** Una sola pestaña puede abrir la base local a la vez (evita corromperla). */
function acquireTabLock(): Promise<void> {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    void navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
      if (!lock) {
        reject(new DemoLockedError())
        return undefined
      }
      resolve()
      return new Promise<void>(() => {}) // se mantiene mientras la pestaña esté abierta
    })
  })
}

async function removeStaleDatabases(currentName: string) {
  try {
    const databases = (await indexedDB.databases?.()) ?? []
    for (const info of databases) {
      if (info.name && info.name.includes(DB_PREFIX) && !info.name.includes(currentName)) {
        await deleteDatabase(info.name)
      }
    }
  } catch {
    // Limpieza opcional: si el navegador no la soporta no pasa nada.
  }
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = request.onerror = request.onblocked = () => resolve()
    } catch {
      resolve()
    }
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new AppError('No pudimos leer la imagen.'))
    reader.readAsDataURL(blob)
  })
}

const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Sin almacenamiento: la sesión demo dura lo que dure la pestaña.
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
