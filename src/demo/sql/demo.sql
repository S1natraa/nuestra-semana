-- =====================================================================
-- MODO DEMO · reloj simulado. Reemplaza app_now() para poder avanzar días
-- (domingo → lunes → … → sábado) sin esperar. Nunca se ejecuta en Supabase.
-- =====================================================================

create schema demo;

create table demo.clock (
  id             integer primary key default 1 check (id = 1),
  offset_seconds bigint not null default 0
);
insert into demo.clock default values;

create or replace function public.app_now()
returns timestamptz
language sql stable security definer
set search_path = ''
as $$
  select now() + make_interval(secs => (select c.offset_seconds from demo.clock c where c.id = 1))
$$;

revoke all on function public.app_now() from public;
grant execute on function public.app_now() to authenticated;
