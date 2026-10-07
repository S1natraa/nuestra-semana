-- =====================================================================
-- MODO DEMO · réplica mínima de lo que Supabase ya trae de serie, para que
-- la migración real se ejecute sin cambios dentro de PGlite.
-- Nunca se ejecuta contra Supabase.
-- =====================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Igual que en Supabase: el usuario sale del claim "sub" del JWT de la petición.
create function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
