/**
 * MODO DEMO — Postgres real (PGlite, WASM) ejecutando exactamente la misma
 * migración que Supabase. Así el modo demo y las pruebas usan la misma
 * lógica de negocio, RLS y validaciones que producción.
 */
import { PGlite } from '@electric-sql/pglite'
import shimSql from './sql/shim.sql?raw'
import coreSql from '../../supabase/migrations/20260928000000_nuestra_semana.sql?raw'
import demoSql from './sql/demo.sql?raw'

/** Huella del esquema: si cambia la migración, el demo crea una base nueva. */
export const SCHEMA_FINGERPRINT = fnv1a(shimSql + coreSql + demoSql)

export interface RpcCaller {
  (fn: string, args?: Record<string, unknown>): Promise<unknown>
}

export interface OpenOptions {
  /** `idb://nombre` en el navegador; vacío = en memoria (pruebas y seed). */
  dataDir?: string
  /** Contenido inicial (volcado de otra instancia, p. ej. la del seed). */
  loadDataDir?: Blob | File
}

export async function openDatabase(options: OpenOptions = {}): Promise<PGlite> {
  // Durabilidad estricta: cada consulta termina cuando ya está guardada en
  // IndexedDB, así un cambio confirmado sobrevive a un refresh.
  const db = await PGlite.create({ dataDir: options.dataDir, loadDataDir: options.loadDataDir })
  const installed = await db.query<{ ok: boolean }>(
    `select exists (select 1 from information_schema.tables where table_schema = 'demo' and table_name = 'clock') as ok`,
  )
  if (!installed.rows[0]?.ok) {
    await db.exec(shimSql)
    await db.exec(coreSql)
    await db.exec(demoSql)
  }
  return db
}

const FN_NAME = /^[a-z_]+$/
const ARG_NAME = /^p_[a-z_]+$/

/** Volatilidad de cada función RPC, por base (no cambia mientras está abierta). */
const volatility = new WeakMap<PGlite, Map<string, string>>()

/**
 * Ejecuta una función RPC como lo haría PostgREST: dentro de una transacción,
 * con el rol `authenticated` y el claim `sub` del usuario, así que RLS aplica.
 * Igual que PostgREST, las funciones STABLE/IMMUTABLE corren en una
 * transacción de solo lectura (si alguna escribiera, fallaría aquí también).
 */
export async function callRpc(
  db: PGlite,
  userId: string | null,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  if (!FN_NAME.test(fn)) throw new Error(`Nombre de función no válido: ${fn}`)
  const names = Object.keys(args)
  for (const name of names) {
    if (!ARG_NAME.test(name)) throw new Error(`Parámetro no válido: ${name}`)
  }
  let known = volatility.get(db)
  if (!known) volatility.set(db, (known = new Map()))
  return db.transaction(async (tx) => {
    let kind = known.get(fn)
    if (kind === undefined) {
      const res = await tx.query<{ v: string }>(
        `select p.provolatile as v from pg_catalog.pg_proc p
           join pg_catalog.pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = $1`,
        [fn],
      )
      kind = res.rows[0]?.v ?? 'v'
      known.set(fn, kind)
    }
    if (kind !== 'v') await tx.query('set transaction read only')
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: userId ?? '', role: 'authenticated' }),
    ])
    await tx.query('set local role authenticated')
    const placeholders = names.map((name, i) => `${name} => $${i + 1}`).join(', ')
    const result = await tx.query<{ result: unknown }>(
      `select public.${fn}(${placeholders}) as result`,
      names.map((name) => toParam(args[name])),
    )
    return result.rows[0]?.result ?? null
  })
}

/** Consulta arbitraria con el rol `authenticated` (para probar RLS directamente). */
export async function queryAs<T>(db: PGlite, userId: string, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ])
    await tx.query('set local role authenticated')
    const result = await tx.query<T>(sql, params)
    return result.rows
  })
}

function toParam(value: unknown): unknown {
  if (value === undefined) return null
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) return JSON.stringify(value)
  return value
}

// ─────────────────────────── Reloj simulado ───────────────────────────

export async function getClockOffsetSeconds(db: PGlite): Promise<number> {
  const res = await db.query<{ offset_seconds: string | number }>('select offset_seconds from demo.clock where id = 1')
  return Number(res.rows[0]?.offset_seconds ?? 0)
}

export async function setClockOffsetSeconds(db: PGlite, seconds: number): Promise<void> {
  await db.query('update demo.clock set offset_seconds = $1 where id = 1', [Math.round(seconds)])
}

/** Coloca el reloj simulado en un instante concreto. */
export async function setSimulatedNow(db: PGlite, target: Date): Promise<void> {
  await setClockOffsetSeconds(db, (target.getTime() - Date.now()) / 1000)
}

export async function getSimulatedNow(db: PGlite): Promise<Date> {
  const res = await db.query<{ now: Date }>('select public.app_now() as now')
  return new Date(res.rows[0]!.now)
}

// ─────────────────────────── Usuarios demo ────────────────────────────

export async function createDemoUser(db: PGlite, displayName: string, email?: string): Promise<string> {
  const res = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
    [email ?? null, JSON.stringify({ display_name: displayName })],
  )
  return res.rows[0]!.id
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}
