-- =====================================================================
-- Nuestra Semana · esquema principal
--
-- Postgres 15+ (Supabase). Este mismo archivo se ejecuta sin cambios en
-- PGlite para el modo demo y para las pruebas automatizadas.
--
-- Modelo de seguridad:
--   * Todas las tablas tienen RLS. Los clientes solo pueden LEER (select)
--     lo que les corresponde; no existen políticas de insert/update/delete.
--   * Toda escritura pasa por funciones RPC SECURITY DEFINER que validan
--     identidad (auth.uid()), pertenencia a la pareja, estado de la semana
--     y fecha actual en la zona horaria de la pareja.
--   * Las lecturas agregadas (get_state, get_week, get_history) son
--     SECURITY INVOKER, así que la privacidad la garantiza RLS.
-- =====================================================================

-- ───────────────────────────── Tipos ─────────────────────────────────

create type public.week_status as enum ('setup', 'active', 'closing', 'result', 'punishment', 'completed');
create type public.tie_rule as enum ('both_spin', 'nobody', 'most_tasks');
create type public.week_outcome as enum ('win', 'loss', 'tie');
create type public.correction_status as enum ('pending', 'approved', 'rejected');

-- ───────────────────────────── Reloj ─────────────────────────────────
-- Toda regla de calendario usa app_now(). En producción es now(); el modo
-- demo la redefine para poder simular el paso de los días.

create function public.app_now()
returns timestamptz
language sql stable
set search_path = ''
as $$ select now() $$;

-- ───────────────────────────── Tablas ────────────────────────────────

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  avatar_url   text check (avatar_url is null or char_length(avatar_url) <= 400000),
  avatar       jsonb not null default '{}'::jsonb,
  accent       text not null default 'pink'
               check (accent in ('pink', 'sky', 'lavender', 'sun', 'mint', 'peach')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.couples (
  id          uuid primary key default gen_random_uuid(),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  timezone    text not null default 'UTC',
  revision    bigint not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id   uuid not null unique references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table public.couple_settings (
  couple_id        uuid primary key references public.couples (id) on delete cascade,
  tie_rule         public.tie_rule not null default 'both_spin',
  streak_threshold smallint not null default 80 check (streak_threshold between 10 and 100),
  updated_at       timestamptz not null default now()
);

create table public.user_settings (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  sounds_enabled   boolean not null default false,
  confetti_enabled boolean not null default true,
  updated_at       timestamptz not null default now()
);

create table public.weeks (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  status     public.week_status not null default 'setup',
  skipped    boolean not null default false,
  closed_at  timestamptz,
  created_at timestamptz not null default now(),
  unique (couple_id, week_start)
);

-- Participación de cada miembro en una semana (confirmación del domingo).
create table public.week_members (
  week_id      uuid not null references public.weeks (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  couple_id    uuid not null references public.couples (id) on delete cascade,
  confirmed_at timestamptz,
  primary key (week_id, user_id)
);

create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  week_id     uuid not null references public.weeks (id) on delete cascade,
  couple_id   uuid not null references public.couples (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 60),
  description text check (description is null or char_length(description) <= 200),
  icon        text not null default '🎯' check (char_length(icon) between 1 and 16),
  target_days smallint not null check (target_days between 1 and 5),
  position    smallint not null default 0,
  created_at  timestamptz not null default now()
);
create index goals_week_user_idx on public.goals (week_id, user_id);

-- Días en los que la meta puede cumplirse (1 = lunes … 5 = viernes).
-- Si hay más días que target_days, la meta es flexible.
create table public.goal_days (
  goal_id uuid not null references public.goals (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 5),
  primary key (goal_id, weekday)
);

create table public.goal_completions (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references public.goals (id) on delete cascade,
  week_id      uuid not null references public.weeks (id) on delete cascade,
  couple_id    uuid not null references public.couples (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  completed_on date not null,
  created_at   timestamptz not null default now(),
  unique (goal_id, completed_on)
);
create index goal_completions_week_idx on public.goal_completions (week_id);

create table public.punishments (
  id         uuid primary key default gen_random_uuid(),
  week_id    uuid not null references public.weeks (id) on delete cascade,
  couple_id  uuid not null references public.couples (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  target_id  uuid not null references public.profiles (id) on delete cascade,
  text       text not null check (char_length(btrim(text)) between 2 and 80),
  emoji      text not null default '🎲' check (char_length(emoji) between 1 and 16),
  position   smallint not null default 0,
  created_at timestamptz not null default now(),
  check (author_id <> target_id)
);
create index punishments_week_target_idx on public.punishments (week_id, target_id);

create table public.weekly_results (
  week_id         uuid not null references public.weeks (id) on delete cascade,
  couple_id       uuid not null references public.couples (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  percentage      numeric(5, 2) not null check (percentage between 0 and 100),
  completed_tasks integer not null,
  total_tasks     integer not null,
  goals_count     integer not null,
  goals_completed integer not null,
  participated    boolean not null,
  outcome         public.week_outcome not null,
  must_spin       boolean not null default false,
  created_at      timestamptz not null default now(),
  primary key (week_id, user_id)
);
create index weekly_results_member_idx on public.weekly_results (couple_id, user_id);

create table public.roulette_results (
  id            uuid primary key default gen_random_uuid(),
  week_id       uuid not null references public.weeks (id) on delete cascade,
  couple_id     uuid not null references public.couples (id) on delete cascade,
  spinner_id    uuid not null references public.profiles (id) on delete cascade,
  punishment_id uuid not null references public.punishments (id) on delete cascade,
  segment_index smallint not null,
  segment_count smallint not null,
  spun_at       timestamptz not null default now(),
  accepted_at   timestamptz,
  unique (week_id, spinner_id),
  check (segment_index >= 0 and segment_index < segment_count)
);

-- Correcciones excepcionales de días pasados: las pide el dueño de la meta
-- y solo se aplican si la pareja las aprueba.
create table public.corrections (
  id           uuid primary key default gen_random_uuid(),
  week_id      uuid not null references public.weeks (id) on delete cascade,
  couple_id    uuid not null references public.couples (id) on delete cascade,
  goal_id      uuid not null references public.goals (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  day          date not null,
  set_done     boolean not null,
  note         text check (note is null or char_length(note) <= 140),
  status       public.correction_status not null default 'pending',
  decided_by   uuid references public.profiles (id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create unique index corrections_one_pending_idx on public.corrections (goal_id, day) where status = 'pending';
create index corrections_week_idx on public.corrections (week_id);

create table public.achievements (
  code        text primary key,
  title       text not null,
  description text not null,
  icon        text not null,
  sort        smallint not null default 0
);

create table public.user_achievements (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  code        text not null references public.achievements (code) on delete cascade,
  couple_id   uuid not null references public.couples (id) on delete cascade,
  week_id     uuid references public.weeks (id) on delete set null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);
create index user_achievements_couple_idx on public.user_achievements (couple_id);

insert into public.achievements (code, title, description, icon, sort) values
  ('first_week',   'Primera semana',       'Cerraste tu primera semana jugando.',                 '✨', 1),
  ('first_win',    'Primera victoria',     'Ganaste tu primer duelo semanal.',                    '🏆', 2),
  ('perfect_week', 'Semana perfecta',      'Terminaste una semana al 100%.',                      '💯', 3),
  ('streak_3',     '3 semanas en racha',   'Tres semanas seguidas por encima de tu meta de racha.', '🔥', 4),
  ('goals_10',     '10 metas completadas', 'Completaste 10 metas semanales al 100%.',             '🎯', 5),
  ('wins_5',       'Ganar 5 duelos',       'Acumulaste cinco victorias semanales.',               '⚔️', 6),
  ('streak_5',     'Imparable',            'Cinco semanas seguidas en racha.',                    '🚀', 7),
  ('good_sport',   'Buen perdedor',        'Aceptaste un castigo con deportividad.',              '🤝', 8);

-- ─────────────────────── Alta de usuarios ────────────────────────────

create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := left(btrim(coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  )), 30);
  if v_name is null or v_name = '' then
    v_name := 'Yo';
  end if;
  insert into public.profiles (id, display_name) values (new.id, v_name);
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────── Helpers de identidad ────────────────────────

create function public.my_couple_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select cm.couple_id from public.couple_members cm where cm.user_id = (select auth.uid())
$$;

create function public.my_partner_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select other.user_id
  from public.couple_members me
  join public.couple_members other
    on other.couple_id = me.couple_id and other.user_id <> me.user_id
  where me.user_id = (select auth.uid())
$$;

-- Fecha de hoy en la zona horaria de la pareja.
create function public.couple_today(p_couple uuid)
returns date
language sql stable
set search_path = ''
as $$
  select (public.app_now() at time zone c.timezone)::date from public.couples c where c.id = p_couple
$$;

-- Aleatoriedad fuerte: 32 bits de gen_random_uuid() (pg_strong_random) con
-- muestreo por rechazo para que cada resultado sea exactamente equiprobable.
create function public._random_int(p_n integer)
returns integer
language plpgsql volatile
set search_path = ''
as $$
declare
  v_limit bigint;
  v bigint;
begin
  if p_n is null or p_n < 1 then
    raise exception 'Rango aleatorio no válido.';
  end if;
  v_limit := (4294967296 / p_n) * p_n;
  loop
    v := ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint;
    exit when v < v_limit;
  end loop;
  return (v % p_n)::integer;
end;
$$;

create function public._touch(p_couple uuid)
returns void
language sql volatile security definer
set search_path = ''
as $$
  update public.couples set revision = revision + 1 where id = p_couple
$$;

create function public._require_uid()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

-- Castigos: filtro básico de seguridad. La app es un juego entre dos
-- personas; nada peligroso, ilegal, humillante o que implique daño físico.
-- Debe mantenerse sincronizado con src/domain/validation.ts (hay una prueba
-- que compara ambos filtros con los mismos ejemplos).
create function public.is_safe_punishment(p_text text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select not (
    lower(coalesce(p_text, '')) ~ (
      '(golpea|bofetad|cachetad|puñetaz|patada|lastim|herid|emborrach|borrach|ilegal|humill|'
      || 'desnud|insult|escupi|asfix|ahoga|veneno|suicid|violen|nalgad|acoso|acosa|amenaz|'
      || 'chantaj|foto íntima|fotos íntimas|autolesi|quemadura|electrocut|sin comer nada|'
      || 'no comer nada|humiliat|naked|starv|poison|suicide|violence|blackmail|spank)'
    )
    or lower(coalesce(p_text, '')) ~ (
      '(^|[^a-z0-9áéíóúüñ])(arma|armas|robar|robo|matar|golpe|golpes|pegarle|pegarte|herir|'
      || 'sangre|sangrar|azotar|azote|azotes|ayuno|ayunar|ayunas|shot|shots|droga|drogas|'
      || 'hit|slap|punch|kick|hurt|blood|knife|gun|weapon|drug|drugs|drunk|steal|illegal|'
      || 'choke|kill|threat)($|[^a-z0-9áéíóúüñ])'
    )
  )
$$;

-- ─────────────────────── Calendario semanal ──────────────────────────

create function public._ensure_week(p_couple uuid, p_monday date)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.weeks (couple_id, week_start, status)
  values (
    p_couple,
    p_monday,
    case when p_monday <= public.couple_today(p_couple)
         then 'active'::public.week_status else 'setup'::public.week_status end
  )
  on conflict (couple_id, week_start) do nothing
  returning id into v_id;

  if v_id is null then
    select w.id into v_id from public.weeks w where w.couple_id = p_couple and w.week_start = p_monday;
  end if;
  return v_id;
end;
$$;

-- Progreso de cada miembro en una semana. Cada META pesa lo mismo:
-- porcentaje = promedio de (días cumplidos / días objetivo) de sus metas.
create function public.week_progress(p_week uuid)
returns table (
  user_id         uuid,
  participated    boolean,
  percentage      numeric,
  completed_tasks integer,
  total_tasks     integer,
  goals_count     integer,
  goals_completed integer
)
language sql stable
set search_path = ''
as $$
  with wk as (
    select w.id, w.couple_id, w.week_start from public.weeks w where w.id = p_week
  ),
  members as (
    select cm.user_id, (wm.confirmed_at is not null) as participated
    from wk
    join public.couple_members cm on cm.couple_id = wk.couple_id
    left join public.week_members wm on wm.week_id = wk.id and wm.user_id = cm.user_id
  ),
  per_goal as (
    select g.user_id,
           g.target_days,
           least(g.target_days, (
             select count(*)
             from public.goal_completions gc
             where gc.goal_id = g.id
               and gc.completed_on between wk.week_start and wk.week_start + 4
               and extract(isodow from gc.completed_on)::int in (
                 select gd.weekday from public.goal_days gd where gd.goal_id = g.id
               )
           ))::int as done
    from wk
    join public.goals g on g.week_id = wk.id
  )
  select m.user_id,
         m.participated,
         case when m.participated and count(pg.target_days) > 0
              then round(avg(pg.done::numeric / pg.target_days) * 100, 2)
              else 0::numeric end,
         case when m.participated then coalesce(sum(pg.done), 0) else 0 end::int,
         case when m.participated then coalesce(sum(pg.target_days), 0) else 0 end::int,
         case when m.participated then count(pg.target_days) else 0 end::int,
         case when m.participated then count(*) filter (where pg.done >= pg.target_days) else 0 end::int
  from members m
  left join per_goal pg on pg.user_id = m.user_id
  group by m.user_id, m.participated
$$;

-- Racha actual: semanas consecutivas más recientes con un porcentaje
-- redondeado >= al umbral de la pareja. Una semana sin jugar (omitida o que
-- ni siquiera existe) la rompe, y solo sigue viva si la última semana
-- cerrada es la anterior o la actual.
create function public.member_streak(p_couple uuid, p_user uuid)
returns integer
language plpgsql stable
set search_path = ''
as $$
declare
  v_threshold integer;
  v_today date;
  v_oldest_alive date;
  v_expected date;
  v_streak integer := 0;
  r record;
begin
  v_today := public.couple_today(p_couple);
  if v_today is null then
    return 0;
  end if;
  v_oldest_alive := v_today - (extract(isodow from v_today)::int - 1) - 7;

  select cs.streak_threshold into v_threshold from public.couple_settings cs where cs.couple_id = p_couple;
  v_threshold := coalesce(v_threshold, 80);

  for r in
    select w.week_start, w.skipped, wr.percentage, wr.participated
    from public.weeks w
    left join public.weekly_results wr on wr.week_id = w.id and wr.user_id = p_user
    where w.couple_id = p_couple and w.status in ('result', 'punishment', 'completed')
    order by w.week_start desc
  loop
    if v_expected is null then
      exit when r.week_start < v_oldest_alive;
    else
      exit when r.week_start <> v_expected;
    end if;
    exit when r.skipped or r.percentage is null or not r.participated or round(r.percentage) < v_threshold;
    v_streak := v_streak + 1;
    v_expected := r.week_start - 7;
  end loop;
  return v_streak;
end;
$$;

create function public.member_stats(p_couple uuid, p_user uuid)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'weeks',           count(*),
    'average',         coalesce(round(avg(wr.percentage), 1), 0),
    'wins',            count(*) filter (where wr.outcome = 'win'),
    'losses',          count(*) filter (where wr.outcome = 'loss'),
    'ties',            count(*) filter (where wr.outcome = 'tie'),
    'best',            coalesce(max(wr.percentage), 0),
    'perfect_weeks',   count(*) filter (where wr.percentage >= 100),
    'goals_completed', coalesce(sum(wr.goals_completed), 0),
    'current_streak',  public.member_streak(p_couple, p_user)
  )
  from public.weekly_results wr
  join public.weeks w on w.id = wr.week_id
  where wr.couple_id = p_couple and wr.user_id = p_user and not w.skipped
$$;

create function public._grant(p_user uuid, p_couple uuid, p_code text, p_week uuid)
returns void
language sql volatile security definer
set search_path = ''
as $$
  insert into public.user_achievements (user_id, code, couple_id, week_id, unlocked_at)
  values (p_user, p_code, p_couple, p_week, public.app_now())
  on conflict (user_id, code) do nothing
$$;

create function public._grant_week_achievements(p_week uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  r record;
  v_streak integer;
  v_goals integer;
  v_wins integer;
begin
  for r in select wr.* from public.weekly_results wr where wr.week_id = p_week and wr.participated loop
    perform public._grant(r.user_id, r.couple_id, 'first_week', p_week);
    if r.outcome = 'win' then
      perform public._grant(r.user_id, r.couple_id, 'first_win', p_week);
    end if;
    if r.percentage >= 100 then
      perform public._grant(r.user_id, r.couple_id, 'perfect_week', p_week);
    end if;

    v_streak := public.member_streak(r.couple_id, r.user_id);
    if v_streak >= 3 then
      perform public._grant(r.user_id, r.couple_id, 'streak_3', p_week);
    end if;
    if v_streak >= 5 then
      perform public._grant(r.user_id, r.couple_id, 'streak_5', p_week);
    end if;

    select coalesce(sum(x.goals_completed), 0), count(*) filter (where x.outcome = 'win')
      into v_goals, v_wins
    from public.weekly_results x
    where x.couple_id = r.couple_id and x.user_id = r.user_id;
    if v_goals >= 10 then
      perform public._grant(r.user_id, r.couple_id, 'goals_10', p_week);
    end if;
    if v_wins >= 5 then
      perform public._grant(r.user_id, r.couple_id, 'wins_5', p_week);
    end if;
  end loop;
end;
$$;

-- Cierre de semana: calcula resultados, ganador/perdedor y quién gira.
create function public._close_week(p_week uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  w public.weeks%rowtype;
  v_rule public.tie_rule;
  a record;
  b record;
  v_a_score integer;
  v_b_score integer;
  v_winner uuid;
  v_loser uuid;
  v_tie boolean := false;
  v_both_spin boolean := false;
  v_a_can boolean;
  v_b_can boolean;
  v_a_spin boolean;
  v_b_spin boolean;
begin
  select * into w from public.weeks where id = p_week for update;
  if not found or w.status not in ('setup', 'active') then
    return;
  end if;

  update public.weeks set status = 'closing' where id = w.id;

  select cs.tie_rule into v_rule from public.couple_settings cs where cs.couple_id = w.couple_id;
  v_rule := coalesce(v_rule, 'both_spin');

  select * into a from public.week_progress(w.id) wp order by wp.user_id limit 1;
  if not found then
    update public.weeks set status = 'completed', skipped = true, closed_at = public.app_now() where id = w.id;
    perform public._touch(w.couple_id);
    return;
  end if;
  select * into b from public.week_progress(w.id) wp order by wp.user_id offset 1 limit 1;
  if not found or (not a.participated and not b.participated) then
    update public.weeks set status = 'completed', skipped = true, closed_at = public.app_now() where id = w.id;
    perform public._touch(w.couple_id);
    return;
  end if;

  -- Se compara el porcentaje que ven los usuarios (redondeado a entero).
  v_a_score := round(a.percentage);
  v_b_score := round(b.percentage);

  if v_a_score > v_b_score then
    v_winner := a.user_id; v_loser := b.user_id;
  elsif v_b_score > v_a_score then
    v_winner := b.user_id; v_loser := a.user_id;
  elsif v_rule = 'most_tasks' and a.completed_tasks <> b.completed_tasks then
    if a.completed_tasks > b.completed_tasks then
      v_winner := a.user_id; v_loser := b.user_id;
    else
      v_winner := b.user_id; v_loser := a.user_id;
    end if;
  else
    v_tie := true;
    v_both_spin := v_rule in ('both_spin', 'most_tasks');
  end if;

  -- Solo se gira si quien ganó (o la pareja, en empate) dejó 3-5 castigos confirmados.
  v_a_can := b.participated and (
    select count(*) from public.punishments p
    where p.week_id = w.id and p.author_id = b.user_id and p.target_id = a.user_id
  ) >= 3;
  v_b_can := a.participated and (
    select count(*) from public.punishments p
    where p.week_id = w.id and p.author_id = a.user_id and p.target_id = b.user_id
  ) >= 3;

  v_a_spin := coalesce(v_a_can and ((v_tie and v_both_spin) or (not v_tie and v_loser = a.user_id)), false);
  v_b_spin := coalesce(v_b_can and ((v_tie and v_both_spin) or (not v_tie and v_loser = b.user_id)), false);

  insert into public.weekly_results (
    week_id, couple_id, user_id, percentage, completed_tasks, total_tasks,
    goals_count, goals_completed, participated, outcome, must_spin
  ) values
    (w.id, w.couple_id, a.user_id, a.percentage, a.completed_tasks, a.total_tasks,
     a.goals_count, a.goals_completed, a.participated,
     (case when v_tie then 'tie' when v_winner = a.user_id then 'win' else 'loss' end)::public.week_outcome,
     v_a_spin),
    (w.id, w.couple_id, b.user_id, b.percentage, b.completed_tasks, b.total_tasks,
     b.goals_count, b.goals_completed, b.participated,
     (case when v_tie then 'tie' when v_winner = b.user_id then 'win' else 'loss' end)::public.week_outcome,
     v_b_spin);

  update public.weeks
     set status = (case when v_a_spin or v_b_spin then 'result' else 'completed' end)::public.week_status,
         closed_at = public.app_now()
   where id = w.id;

  perform public._grant_week_achievements(w.id);
  perform public._touch(w.couple_id);
end;
$$;

-- Avanza el calendario de la pareja: cierra semanas vencidas, activa las
-- que ya comenzaron y asegura la semana relevante (actual o siguiente).
create function public._sync_couple(p_couple uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_today date;
  v_dow integer;
  v_monday date;
  v_changed integer;
  w record;
begin
  if p_couple is null or (select count(*) from public.couple_members cm where cm.couple_id = p_couple) < 2 then
    return;
  end if;

  v_today := public.couple_today(p_couple);
  v_dow := extract(isodow from v_today)::int;
  v_monday := v_today - (v_dow - 1);

  for w in
    select x.id from public.weeks x
    where x.couple_id = p_couple and x.status in ('setup', 'active') and x.week_start + 4 < v_today
    order by x.week_start
  loop
    perform public._close_week(w.id);
  end loop;

  update public.weeks x set status = 'active'
  where x.couple_id = p_couple and x.status = 'setup' and x.week_start <= v_today;
  get diagnostics v_changed = row_count;
  if v_changed > 0 then
    perform public._touch(p_couple);
  end if;

  if v_dow <= 5 then
    perform public._ensure_week(p_couple, v_monday);
  else
    perform public._ensure_week(p_couple, v_monday + 7);
  end if;
end;
$$;

create function public.sync_weeks()
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform public._sync_couple(public.my_couple_id());
end;
$$;

-- Semana de mi pareja (con bloqueo opcional) o error.
create function public._my_week(p_week_id uuid, p_lock boolean default false)
returns public.weeks
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  w public.weeks%rowtype;
begin
  perform public._require_uid();
  if p_lock then
    select * into w from public.weeks x where x.id = p_week_id and x.couple_id = public.my_couple_id() for update;
  else
    select * into w from public.weeks x where x.id = p_week_id and x.couple_id = public.my_couple_id();
  end if;
  if not found then
    raise exception 'Semana no encontrada.' using errcode = 'P0002';
  end if;
  return w;
end;
$$;

-- Primer día (1-5) que todavía puede programarse en esa semana.
create function public._first_open_weekday(p_week public.weeks)
returns integer
language plpgsql stable
set search_path = ''
as $$
declare
  v_today date := public.couple_today(p_week.couple_id);
begin
  if v_today < p_week.week_start then
    return 1;
  end if;
  return (v_today - p_week.week_start) + 1;
end;
$$;

create function public._assert_setup_open(p_week public.weeks, p_uid uuid)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if p_week.status not in ('setup', 'active')
     or public.couple_today(p_week.couple_id) > p_week.week_start + 4 then
    raise exception 'Esta semana ya terminó.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.week_members wm
    where wm.week_id = p_week.id and wm.user_id = p_uid and wm.confirmed_at is not null
  ) then
    raise exception 'Tu semana ya está confirmada y no se puede editar.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.couple_members cm where cm.couple_id = p_week.couple_id) < 2 then
    raise exception 'Espera a que tu pareja se una para configurar la semana.' using errcode = 'P0001';
  end if;
end;
$$;

-- ─────────────────────── Lecturas (RLS) ──────────────────────────────

create function public.week_summary(p_week public.weeks)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id',         p_week.id,
    'week_start', p_week.week_start,
    'status',     p_week.status,
    'skipped',    p_week.skipped,
    'closed_at',  p_week.closed_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', wm.user_id, 'confirmed_at', wm.confirmed_at))
      from public.week_members wm where wm.week_id = p_week.id
    ), '[]'::jsonb),
    'results', coalesce((
      select jsonb_agg(to_jsonb(wr) - 'couple_id' - 'week_id' - 'created_at')
      from public.weekly_results wr where wr.week_id = p_week.id
    ), '[]'::jsonb),
    'roulette', coalesce((
      select jsonb_agg(jsonb_build_object(
        'spinner_id',    rr.spinner_id,
        'punishment_id', rr.punishment_id,
        'segment_index', rr.segment_index,
        'segment_count', rr.segment_count,
        'spun_at',       rr.spun_at,
        'accepted_at',   rr.accepted_at,
        'punishment', (
          select jsonb_build_object('text', p.text, 'emoji', p.emoji)
          from public.punishments p where p.id = rr.punishment_id
        )
      ))
      from public.roulette_results rr where rr.week_id = p_week.id
    ), '[]'::jsonb)
  )
$$;

-- Cuántos castigos preparó tu pareja para ti (sin revelar cuáles).
create function public.incoming_punishment_count(p_week uuid)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(*)::int from public.punishments p
  where p.week_id = p_week and p.target_id = (select auth.uid())
$$;

create function public.get_state()
returns jsonb
language plpgsql volatile
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  v_couple uuid;
  v_partner uuid;
  v_today date;
  v_monday date;
begin
  perform public.sync_weeks();
  v_couple := public.my_couple_id();
  v_partner := public.my_partner_id();

  if v_couple is not null then
    v_today := public.couple_today(v_couple);
    v_monday := v_today - (extract(isodow from v_today)::int - 1);
  else
    v_today := (public.app_now() at time zone 'UTC')::date;
  end if;

  return jsonb_build_object(
    'me',       (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'partner',  (select to_jsonb(p) from public.profiles p where p.id = v_partner),
    'settings', (select to_jsonb(s) - 'user_id' from public.user_settings s where s.user_id = v_uid),
    'couple', (
      select jsonb_build_object(
        'id', c.id,
        'invite_code', c.invite_code,
        'timezone', c.timezone,
        'revision', c.revision,
        'member_count', (select count(*) from public.couple_members cm where cm.couple_id = c.id)
      )
      from public.couples c where c.id = v_couple
    ),
    'couple_settings', (
      select jsonb_build_object('tie_rule', cs.tie_rule, 'streak_threshold', cs.streak_threshold)
      from public.couple_settings cs where cs.couple_id = v_couple
    ),
    'today', v_today,
    'now',   public.app_now(),
    'weeks', coalesce((
      select jsonb_agg(public.week_summary(w) order by w.week_start desc)
      from public.weeks w
      where w.couple_id = v_couple
        and (w.week_start >= v_monday - 7 or w.status in ('result', 'punishment'))
    ), '[]'::jsonb),
    'stats', coalesce((
      select jsonb_object_agg(cm.user_id::text, public.member_stats(v_couple, cm.user_id))
      from public.couple_members cm where cm.couple_id = v_couple
    ), '{}'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', ua.user_id, 'code', ua.code, 'unlocked_at', ua.unlocked_at)
                       order by ua.unlocked_at)
      from public.user_achievements ua where ua.couple_id = v_couple
    ), '[]'::jsonb),
    'achievement_catalog', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.sort) from public.achievements a
    ), '[]'::jsonb),
    'corrections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'week_id', c.week_id, 'goal_id', c.goal_id, 'requested_by', c.requested_by,
        'day', c.day, 'set_done', c.set_done, 'note', c.note, 'status', c.status, 'created_at', c.created_at,
        'goal_title', g.title, 'goal_icon', g.icon
      ) order by c.created_at)
      from public.corrections c
      join public.goals g on g.id = c.goal_id
      where c.couple_id = v_couple and c.status = 'pending'
    ), '[]'::jsonb)
  );
end;
$$;

create function public.get_week(p_week_id uuid)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  w public.weeks%rowtype;
begin
  perform public._require_uid();
  select * into w from public.weeks x where x.id = p_week_id;
  if not found then
    raise exception 'Semana no encontrada.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'week', public.week_summary(w),
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'user_id', g.user_id,
        'title', g.title,
        'description', g.description,
        'icon', g.icon,
        'target_days', g.target_days,
        'position', g.position,
        'days', coalesce((
          select jsonb_agg(gd.weekday order by gd.weekday) from public.goal_days gd where gd.goal_id = g.id
        ), '[]'::jsonb)
      ) order by g.user_id, g.position)
      from public.goals g where g.week_id = w.id
    ), '[]'::jsonb),
    'completions', coalesce((
      select jsonb_agg(jsonb_build_object('goal_id', gc.goal_id, 'user_id', gc.user_id, 'completed_on', gc.completed_on)
                       order by gc.completed_on)
      from public.goal_completions gc where gc.week_id = w.id
    ), '[]'::jsonb),
    'punishments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'author_id', p.author_id, 'target_id', p.target_id,
        'text', p.text, 'emoji', p.emoji, 'position', p.position
      ) order by p.author_id, p.position, p.id)
      from public.punishments p where p.week_id = w.id
    ), '[]'::jsonb),
    'incoming_punishments', public.incoming_punishment_count(w.id),
    'corrections', coalesce((
      select jsonb_agg(to_jsonb(c) - 'couple_id' order by c.created_at)
      from public.corrections c where c.week_id = w.id
    ), '[]'::jsonb)
  );
end;
$$;

create function public.get_history()
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  v_couple uuid;
begin
  perform public._require_uid();
  v_couple := public.my_couple_id();
  return jsonb_build_object(
    'weeks', coalesce((
      select jsonb_agg(public.week_summary(w) order by w.week_start desc)
      from public.weeks w
      where w.couple_id = v_couple and not w.skipped and w.status in ('result', 'punishment', 'completed')
    ), '[]'::jsonb),
    'stats', coalesce((
      select jsonb_object_agg(cm.user_id::text, public.member_stats(v_couple, cm.user_id))
      from public.couple_members cm where cm.couple_id = v_couple
    ), '{}'::jsonb)
  );
end;
$$;

-- ─────────────────────── Pareja y perfil ─────────────────────────────

create function public._new_invite_code()
returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + public._random_int(length(v_alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.couples c where c.invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

create function public._valid_timezone(p_tz text)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_tz is not null and exists (select 1 from pg_catalog.pg_timezone_names t where t.name = p_tz)
$$;

create function public.create_couple(p_timezone text)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  v_couple uuid;
  v_code text;
begin
  if exists (select 1 from public.couple_members cm where cm.user_id = v_uid) then
    raise exception 'Ya perteneces a una pareja.' using errcode = 'P0001';
  end if;

  v_code := public._new_invite_code();
  insert into public.couples (invite_code, timezone, created_by)
  values (v_code, case when public._valid_timezone(p_timezone) then p_timezone else 'UTC' end, v_uid)
  returning id into v_couple;

  insert into public.couple_members (couple_id, user_id) values (v_couple, v_uid);
  insert into public.couple_settings (couple_id) values (v_couple);

  return jsonb_build_object('id', v_couple, 'invite_code', v_code);
end;
$$;

create function public.join_couple(p_code text)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  c public.couples%rowtype;
  v_members integer;
begin
  select * into c from public.couples x where x.invite_code = v_code for update;
  if not found then
    raise exception 'Ese código de invitación no existe.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.couple_members cm where cm.user_id = v_uid and cm.couple_id = c.id) then
    return jsonb_build_object('id', c.id, 'invite_code', c.invite_code);
  end if;
  if exists (select 1 from public.couple_members cm where cm.user_id = v_uid) then
    raise exception 'Ya perteneces a otra pareja.' using errcode = 'P0001';
  end if;

  select count(*) into v_members from public.couple_members cm where cm.couple_id = c.id;
  if v_members >= 2 then
    raise exception 'Esta pareja ya está completa.' using errcode = 'P0001';
  end if;

  insert into public.couple_members (couple_id, user_id) values (c.id, v_uid);
  perform public._touch(c.id);
  perform public._sync_couple(c.id);
  return jsonb_build_object('id', c.id, 'invite_code', c.invite_code);
end;
$$;

create function public.update_profile(p_patch jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  v_name text;
  v_url text;
  v_avatar jsonb;
  v_hair text;
  v_skin integer;
  v_hair_color integer;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Datos de perfil no válidos.' using errcode = '22023';
  end if;

  if p_patch ? 'display_name' then
    v_name := btrim(coalesce(p_patch ->> 'display_name', ''));
    if char_length(v_name) < 1 or char_length(v_name) > 30 then
      raise exception 'El nombre debe tener entre 1 y 30 caracteres.' using errcode = '22023';
    end if;
    update public.profiles set display_name = v_name where id = v_uid;
  end if;

  if p_patch ? 'accent' then
    if coalesce(p_patch ->> 'accent', '') not in ('pink', 'sky', 'lavender', 'sun', 'mint', 'peach') then
      raise exception 'Ese color no está disponible.' using errcode = '22023';
    end if;
    update public.profiles set accent = p_patch ->> 'accent' where id = v_uid;
  end if;

  if p_patch ? 'avatar_url' then
    v_url := nullif(p_patch ->> 'avatar_url', '');
    if v_url is not null and not (v_url ~ '^https://' or v_url ~ '^data:image/(png|jpeg|webp);base64,') then
      raise exception 'La imagen no es válida.' using errcode = '22023';
    end if;
    if v_url is not null and char_length(v_url) > 400000 then
      raise exception 'La imagen es demasiado grande.' using errcode = '22023';
    end if;
    update public.profiles set avatar_url = v_url where id = v_uid;
  end if;

  if p_patch ? 'avatar' then
    v_avatar := p_patch -> 'avatar';
    if jsonb_typeof(v_avatar) <> 'object' then
      raise exception 'Avatar no válido.' using errcode = '22023';
    end if;
    v_hair := coalesce(v_avatar ->> 'hair', 'short');
    if v_hair not in ('short', 'curly', 'long', 'bun', 'buzz', 'waves') then
      raise exception 'Peinado no válido.' using errcode = '22023';
    end if;
    if jsonb_typeof(v_avatar -> 'skin') <> 'number' or jsonb_typeof(v_avatar -> 'hairColor') <> 'number' then
      raise exception 'Avatar no válido.' using errcode = '22023';
    end if;
    v_skin := (v_avatar ->> 'skin')::numeric::integer;
    v_hair_color := (v_avatar ->> 'hairColor')::numeric::integer;
    if v_skin not between 0 and 4 or v_hair_color not between 0 and 5 then
      raise exception 'Avatar no válido.' using errcode = '22023';
    end if;
    update public.profiles
       set avatar = jsonb_build_object('hair', v_hair, 'skin', v_skin, 'hairColor', v_hair_color)
     where id = v_uid;
  end if;

  update public.profiles set updated_at = public.app_now() where id = v_uid;
  perform public._touch(public.my_couple_id());
  return (select to_jsonb(p) from public.profiles p where p.id = v_uid);
end;
$$;

create function public.update_user_settings(p_patch jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Preferencias no válidas.' using errcode = '22023';
  end if;
  if p_patch ? 'sounds_enabled' then
    if jsonb_typeof(p_patch -> 'sounds_enabled') <> 'boolean' then
      raise exception 'Preferencias no válidas.' using errcode = '22023';
    end if;
    update public.user_settings set sounds_enabled = (p_patch ->> 'sounds_enabled')::boolean where user_id = v_uid;
  end if;
  if p_patch ? 'confetti_enabled' then
    if jsonb_typeof(p_patch -> 'confetti_enabled') <> 'boolean' then
      raise exception 'Preferencias no válidas.' using errcode = '22023';
    end if;
    update public.user_settings set confetti_enabled = (p_patch ->> 'confetti_enabled')::boolean where user_id = v_uid;
  end if;
  update public.user_settings set updated_at = public.app_now() where user_id = v_uid;
  return (select to_jsonb(s) - 'user_id' from public.user_settings s where s.user_id = v_uid);
end;
$$;

create function public.update_couple_settings(p_patch jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_couple uuid;
  v_threshold integer;
begin
  perform public._require_uid();
  v_couple := public.my_couple_id();
  if v_couple is null then
    raise exception 'Primero crea o únete a una pareja.' using errcode = 'P0001';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Ajustes no válidos.' using errcode = '22023';
  end if;

  if p_patch ? 'tie_rule' then
    if coalesce(p_patch ->> 'tie_rule', '') not in ('both_spin', 'nobody', 'most_tasks') then
      raise exception 'Regla de empate no válida.' using errcode = '22023';
    end if;
    update public.couple_settings set tie_rule = (p_patch ->> 'tie_rule')::public.tie_rule where couple_id = v_couple;
  end if;

  if p_patch ? 'streak_threshold' then
    if jsonb_typeof(p_patch -> 'streak_threshold') <> 'number' then
      raise exception 'El porcentaje de racha debe ser un número.' using errcode = '22023';
    end if;
    v_threshold := round((p_patch ->> 'streak_threshold')::numeric);
    if v_threshold not between 10 and 100 then
      raise exception 'El porcentaje de racha debe estar entre 10 y 100.' using errcode = '22023';
    end if;
    update public.couple_settings set streak_threshold = v_threshold where couple_id = v_couple;
  end if;

  if p_patch ? 'timezone' then
    if not public._valid_timezone(p_patch ->> 'timezone') then
      raise exception 'Zona horaria no válida.' using errcode = '22023';
    end if;
    update public.couples set timezone = p_patch ->> 'timezone' where id = v_couple;
  end if;

  update public.couple_settings set updated_at = public.app_now() where couple_id = v_couple;
  perform public._touch(v_couple);
  return (
    select jsonb_build_object('tie_rule', cs.tie_rule, 'streak_threshold', cs.streak_threshold, 'timezone', c.timezone)
    from public.couple_settings cs join public.couples c on c.id = cs.couple_id
    where cs.couple_id = v_couple
  );
end;
$$;

-- ─────────────────────── Configuración del domingo ───────────────────

create function public.save_goals(p_week_id uuid, p_goals jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  w public.weeks%rowtype;
  v_first integer;
  g jsonb;
  v_title text;
  v_description text;
  v_icon text;
  v_target integer;
  v_days integer[];
  v_goal_id uuid;
  v_position integer := 0;
begin
  perform public._sync_couple(public.my_couple_id());
  w := public._my_week(p_week_id, true);
  perform public._assert_setup_open(w, v_uid);

  if p_goals is null or jsonb_typeof(p_goals) <> 'array' then
    raise exception 'Formato de metas no válido.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_goals) < 1 then
    raise exception 'Agrega al menos una meta.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_goals) > 10 then
    raise exception 'Puedes tener como máximo 10 metas por semana.' using errcode = '22023';
  end if;

  v_first := public._first_open_weekday(w);

  delete from public.goals x where x.week_id = w.id and x.user_id = v_uid;

  for g in select value from jsonb_array_elements(p_goals) loop
    if jsonb_typeof(g) <> 'object' then
      raise exception 'Formato de metas no válido.' using errcode = '22023';
    end if;

    v_title := btrim(coalesce(g ->> 'title', ''));
    if v_title = '' then
      raise exception 'Cada meta necesita un nombre.' using errcode = '22023';
    end if;
    if char_length(v_title) > 60 then
      raise exception 'El nombre de la meta es demasiado largo (máx. 60).' using errcode = '22023';
    end if;

    v_description := nullif(btrim(coalesce(g ->> 'description', '')), '');
    if v_description is not null and char_length(v_description) > 200 then
      raise exception 'La descripción es demasiado larga (máx. 200).' using errcode = '22023';
    end if;

    v_icon := coalesce(nullif(btrim(coalesce(g ->> 'icon', '')), ''), '🎯');
    if char_length(v_icon) > 16 then
      raise exception 'Icono no válido.' using errcode = '22023';
    end if;

    if jsonb_typeof(g -> 'target_days') <> 'number' then
      raise exception 'Indica cuántos días quieres cumplir "%".', v_title using errcode = '22023';
    end if;
    v_target := (g ->> 'target_days')::numeric::integer;
    if v_target not between 1 and 5 then
      raise exception 'Los días de "%" deben estar entre 1 y 5.', v_title using errcode = '22023';
    end if;

    if jsonb_typeof(g -> 'days') <> 'array' then
      raise exception 'Elige los días de "%".', v_title using errcode = '22023';
    end if;
    select array_agg(distinct d::integer order by d::integer)
      into v_days
    from jsonb_array_elements_text(g -> 'days') as d
    where d ~ '^[1-5]$';

    if v_days is null or cardinality(v_days) <> jsonb_array_length(g -> 'days') then
      raise exception 'Los días de "%" no son válidos.', v_title using errcode = '22023';
    end if;
    if v_days[1] < v_first then
      raise exception 'La semana ya empezó: "%" solo puede usar días a partir de hoy.', v_title using errcode = '22023';
    end if;
    if cardinality(v_days) < v_target then
      raise exception '"%" necesita al menos % días disponibles.', v_title, v_target using errcode = '22023';
    end if;

    insert into public.goals (week_id, couple_id, user_id, title, description, icon, target_days, position)
    values (w.id, w.couple_id, v_uid, v_title, v_description, v_icon, v_target, v_position)
    returning id into v_goal_id;

    insert into public.goal_days (goal_id, weekday)
    select v_goal_id, unnest(v_days);

    v_position := v_position + 1;
  end loop;

  insert into public.week_members (week_id, user_id, couple_id)
  values (w.id, v_uid, w.couple_id)
  on conflict (week_id, user_id) do nothing;

  perform public._touch(w.couple_id);
  return jsonb_build_object('saved', v_position);
end;
$$;

create function public.save_punishments(p_week_id uuid, p_items jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  v_partner uuid := public.my_partner_id();
  w public.weeks%rowtype;
  item jsonb;
  v_text text;
  v_emoji text;
  v_position integer := 0;
begin
  perform public._sync_couple(public.my_couple_id());
  w := public._my_week(p_week_id, true);
  perform public._assert_setup_open(w, v_uid);

  if v_partner is null then
    raise exception 'Espera a que tu pareja se una para preparar castigos.' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Formato de castigos no válido.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) < 3 then
    raise exception 'Agrega al menos 3 castigos.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 5 then
    raise exception 'Puedes agregar como máximo 5 castigos.' using errcode = '22023';
  end if;

  delete from public.punishments x where x.week_id = w.id and x.author_id = v_uid;

  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Formato de castigos no válido.' using errcode = '22023';
    end if;
    v_text := btrim(coalesce(item ->> 'text', ''));
    if char_length(v_text) < 2 then
      raise exception 'Ningún castigo puede quedar vacío.' using errcode = '22023';
    end if;
    if char_length(v_text) > 80 then
      raise exception 'Cada castigo debe tener como máximo 80 caracteres.' using errcode = '22023';
    end if;
    if not public.is_safe_punishment(v_text) then
      raise exception '"%" no parece seguro. Elige algo divertido, razonable y acordado por ambos.', v_text
        using errcode = '22023';
    end if;
    v_emoji := coalesce(nullif(btrim(coalesce(item ->> 'emoji', '')), ''), '🎲');
    if char_length(v_emoji) > 16 then
      raise exception 'Emoji no válido.' using errcode = '22023';
    end if;

    insert into public.punishments (week_id, couple_id, author_id, target_id, text, emoji, position)
    values (w.id, w.couple_id, v_uid, v_partner, v_text, v_emoji, v_position);
    v_position := v_position + 1;
  end loop;

  insert into public.week_members (week_id, user_id, couple_id)
  values (w.id, v_uid, w.couple_id)
  on conflict (week_id, user_id) do nothing;

  perform public._touch(w.couple_id);
  return jsonb_build_object('saved', v_position);
end;
$$;

create function public.confirm_setup(p_week_id uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  w public.weeks%rowtype;
  v_first integer;
  v_goals integer;
  v_punishments integer;
  v_invalid integer;
  v_ready integer;
begin
  perform public._sync_couple(public.my_couple_id());
  w := public._my_week(p_week_id, true);
  perform public._assert_setup_open(w, v_uid);

  select count(*) into v_goals from public.goals g where g.week_id = w.id and g.user_id = v_uid;
  if v_goals < 1 then
    raise exception 'Agrega al menos una meta antes de comenzar.' using errcode = 'P0001';
  end if;

  select count(*) into v_punishments from public.punishments p where p.week_id = w.id and p.author_id = v_uid;
  if v_punishments < 3 or v_punishments > 5 then
    raise exception 'Necesitas entre 3 y 5 castigos para tu pareja.' using errcode = 'P0001';
  end if;

  -- Si la semana ya empezó, cada meta debe seguir teniendo días suficientes.
  v_first := public._first_open_weekday(w);
  select count(*) into v_invalid
  from public.goals g
  where g.week_id = w.id and g.user_id = v_uid
    and (select count(*) from public.goal_days gd where gd.goal_id = g.id and gd.weekday >= v_first) < g.target_days;
  if v_invalid > 0 then
    raise exception 'La semana avanzó: revisa los días de tus metas.' using errcode = 'P0001';
  end if;

  delete from public.goal_days gd
  using public.goals g
  where gd.goal_id = g.id and g.week_id = w.id and g.user_id = v_uid and gd.weekday < v_first;

  insert into public.week_members (week_id, user_id, couple_id, confirmed_at)
  values (w.id, v_uid, w.couple_id, public.app_now())
  on conflict (week_id, user_id) do update set confirmed_at = excluded.confirmed_at;

  select count(*) into v_ready from public.week_members wm where wm.week_id = w.id and wm.confirmed_at is not null;
  if v_ready >= 2 and w.status = 'setup' then
    update public.weeks set status = 'active' where id = w.id;
  end if;

  perform public._touch(w.couple_id);
  return jsonb_build_object('both_ready', v_ready >= 2);
end;
$$;

-- ─────────────────────── Cumplimiento diario ─────────────────────────

-- Marca / desmarca una meta propia para HOY (la fecha la decide el servidor).
create function public.set_completion(p_goal_id uuid, p_done boolean)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  g public.goals%rowtype;
  w public.weeks%rowtype;
  v_today date;
  v_other integer;
begin
  perform public._sync_couple(public.my_couple_id());

  select * into g from public.goals x where x.id = p_goal_id and x.couple_id = public.my_couple_id();
  if not found then
    raise exception 'Meta no encontrada.' using errcode = 'P0002';
  end if;
  if g.user_id <> v_uid then
    raise exception 'Solo puedes marcar tus propias metas.' using errcode = '42501';
  end if;

  select * into w from public.weeks x where x.id = g.week_id;
  v_today := public.couple_today(w.couple_id);

  if w.status <> 'active' or v_today < w.week_start or v_today > w.week_start + 4 then
    raise exception 'Solo puedes marcar tareas del día de hoy, de lunes a viernes.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.week_members wm
    where wm.week_id = w.id and wm.user_id = v_uid and wm.confirmed_at is not null
  ) then
    raise exception 'Confirma tu semana antes de marcar tareas.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.goal_days gd where gd.goal_id = g.id and gd.weekday = extract(isodow from v_today)::int
  ) then
    raise exception 'Esta meta no está programada para hoy.' using errcode = 'P0001';
  end if;

  if coalesce(p_done, false) then
    select count(*) into v_other from public.goal_completions gc
    where gc.goal_id = g.id and gc.completed_on <> v_today;
    if v_other >= g.target_days then
      raise exception 'Ya cumpliste esta meta todos los días de la semana.' using errcode = 'P0001';
    end if;
    insert into public.goal_completions (goal_id, week_id, couple_id, user_id, completed_on)
    values (g.id, w.id, w.couple_id, v_uid, v_today)
    on conflict (goal_id, completed_on) do nothing;
  else
    delete from public.goal_completions gc where gc.goal_id = g.id and gc.completed_on = v_today;
  end if;

  perform public._touch(w.couple_id);
  return jsonb_build_object('goal_id', g.id, 'day', v_today, 'done', coalesce(p_done, false));
end;
$$;

-- Corrección excepcional de un día pasado: la pide el dueño de la meta…
create function public.request_correction(p_goal_id uuid, p_day date, p_done boolean, p_note text)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  g public.goals%rowtype;
  w public.weeks%rowtype;
  v_today date;
  v_current boolean;
  v_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform public._sync_couple(public.my_couple_id());

  select * into g from public.goals x where x.id = p_goal_id and x.couple_id = public.my_couple_id();
  if not found then
    raise exception 'Meta no encontrada.' using errcode = 'P0002';
  end if;
  if g.user_id <> v_uid then
    raise exception 'Solo puedes corregir tus propias metas.' using errcode = '42501';
  end if;

  select * into w from public.weeks x where x.id = g.week_id;
  v_today := public.couple_today(w.couple_id);
  if w.status <> 'active' or v_today > w.week_start + 4 then
    raise exception 'La semana ya cerró; no se puede corregir.' using errcode = 'P0001';
  end if;
  if p_day is null or p_day < w.week_start or p_day >= v_today then
    raise exception 'Solo puedes corregir días anteriores de esta semana.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.goal_days gd where gd.goal_id = g.id and gd.weekday = extract(isodow from p_day)::int
  ) then
    raise exception 'Esa meta no estaba programada ese día.' using errcode = 'P0001';
  end if;
  if v_note is not null and char_length(v_note) > 140 then
    raise exception 'La nota es demasiado larga (máx. 140).' using errcode = '22023';
  end if;

  v_current := exists (select 1 from public.goal_completions gc where gc.goal_id = g.id and gc.completed_on = p_day);
  if v_current = coalesce(p_done, false) then
    raise exception 'Esa tarea ya está en ese estado.' using errcode = 'P0001';
  end if;

  begin
    insert into public.corrections (week_id, couple_id, goal_id, requested_by, day, set_done, note)
    values (w.id, w.couple_id, g.id, v_uid, p_day, coalesce(p_done, false), v_note)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ya hay una corrección pendiente para ese día.' using errcode = 'P0001';
  end;

  perform public._touch(w.couple_id);
  return jsonb_build_object('id', v_id);
end;
$$;

-- …y solo se aplica si la otra persona la aprueba.
create function public.resolve_correction(p_correction_id uuid, p_approve boolean)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  c public.corrections%rowtype;
  g public.goals%rowtype;
  w public.weeks%rowtype;
  v_other integer;
begin
  perform public._sync_couple(public.my_couple_id());

  select * into c from public.corrections x
  where x.id = p_correction_id and x.couple_id = public.my_couple_id()
  for update;
  if not found then
    raise exception 'Corrección no encontrada.' using errcode = 'P0002';
  end if;
  if c.status <> 'pending' then
    raise exception 'Esta corrección ya fue resuelta.' using errcode = 'P0001';
  end if;
  if c.requested_by = v_uid then
    raise exception 'Tu pareja es quien debe aprobar esta corrección.' using errcode = '42501';
  end if;

  select * into w from public.weeks x where x.id = c.week_id;
  if w.status <> 'active' or public.couple_today(w.couple_id) > w.week_start + 4 then
    raise exception 'La semana ya cerró; no se puede corregir.' using errcode = 'P0001';
  end if;

  if coalesce(p_approve, false) then
    select * into g from public.goals x where x.id = c.goal_id;
    if c.set_done then
      select count(*) into v_other from public.goal_completions gc
      where gc.goal_id = g.id and gc.completed_on <> c.day;
      if v_other >= g.target_days then
        raise exception 'Esa meta ya alcanzó su objetivo semanal.' using errcode = 'P0001';
      end if;
      insert into public.goal_completions (goal_id, week_id, couple_id, user_id, completed_on)
      values (g.id, w.id, w.couple_id, g.user_id, c.day)
      on conflict (goal_id, completed_on) do nothing;
    else
      delete from public.goal_completions gc where gc.goal_id = g.id and gc.completed_on = c.day;
    end if;
  end if;

  update public.corrections
     set status = (case when coalesce(p_approve, false) then 'approved' else 'rejected' end)::public.correction_status,
         decided_by = v_uid,
         decided_at = public.app_now()
   where id = c.id;

  perform public._touch(w.couple_id);
  return jsonb_build_object('id', c.id, 'approved', coalesce(p_approve, false));
end;
$$;

create function public.cancel_correction(p_correction_id uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  v_couple uuid;
begin
  delete from public.corrections x
  where x.id = p_correction_id and x.requested_by = v_uid and x.status = 'pending'
  returning x.couple_id into v_couple;
  if v_couple is null then
    raise exception 'Corrección no encontrada.' using errcode = 'P0002';
  end if;
  perform public._touch(v_couple);
end;
$$;

-- ─────────────────────── Ruleta de castigos ──────────────────────────

create function public.spin_roulette(p_week_id uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  v_partner uuid := public.my_partner_id();
  w public.weeks%rowtype;
  r public.weekly_results%rowtype;
  v_ids uuid[];
  v_count integer;
  v_index integer;
  p public.punishments%rowtype;
begin
  perform public._sync_couple(public.my_couple_id());
  w := public._my_week(p_week_id, true);

  if w.status not in ('result', 'punishment') then
    raise exception 'La ruleta estará disponible cuando termine la semana.' using errcode = 'P0001';
  end if;

  select * into r from public.weekly_results x where x.week_id = w.id and x.user_id = v_uid;
  if not found or not r.must_spin then
    raise exception 'Esta semana no te toca girar la ruleta.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.roulette_results rr where rr.week_id = w.id and rr.spinner_id = v_uid) then
    raise exception 'Ya giraste la ruleta esta semana.' using errcode = 'P0001';
  end if;

  select array_agg(x.id order by x.position, x.id) into v_ids
  from public.punishments x
  where x.week_id = w.id and x.target_id = v_uid and x.author_id = v_partner;
  v_count := coalesce(cardinality(v_ids), 0);
  if v_count < 3 then
    raise exception 'No hay castigos suficientes para girar.' using errcode = 'P0001';
  end if;

  v_index := public._random_int(v_count);
  select * into p from public.punishments x where x.id = v_ids[v_index + 1];

  insert into public.roulette_results (week_id, couple_id, spinner_id, punishment_id, segment_index, segment_count, spun_at)
  values (w.id, w.couple_id, v_uid, p.id, v_index, v_count, public.app_now());

  update public.weeks set status = 'punishment' where id = w.id;
  perform public._touch(w.couple_id);

  return jsonb_build_object(
    'segment_index', v_index,
    'segment_count', v_count,
    'punishment', jsonb_build_object('id', p.id, 'text', p.text, 'emoji', p.emoji)
  );
end;
$$;

create function public.accept_punishment(p_week_id uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_uid();
  w public.weeks%rowtype;
  v_pending integer;
begin
  w := public._my_week(p_week_id, true);

  update public.roulette_results rr
     set accepted_at = public.app_now()
   where rr.week_id = w.id and rr.spinner_id = v_uid and rr.accepted_at is null;
  if not found then
    if exists (select 1 from public.roulette_results rr where rr.week_id = w.id and rr.spinner_id = v_uid) then
      raise exception 'Este castigo ya estaba registrado.' using errcode = 'P0001';
    end if;
    raise exception 'Primero gira la ruleta.' using errcode = 'P0001';
  end if;

  perform public._grant(v_uid, w.couple_id, 'good_sport', w.id);

  select count(*) into v_pending
  from public.weekly_results wr
  where wr.week_id = w.id and wr.must_spin and not exists (
    select 1 from public.roulette_results rr
    where rr.week_id = w.id and rr.spinner_id = wr.user_id and rr.accepted_at is not null
  );
  if v_pending = 0 then
    update public.weeks set status = 'completed' where id = w.id;
  end if;

  perform public._touch(w.couple_id);
  return jsonb_build_object('completed', v_pending = 0);
end;
$$;

-- ─────────────────────── Row Level Security ──────────────────────────

alter table public.profiles          enable row level security;
alter table public.couples           enable row level security;
alter table public.couple_members    enable row level security;
alter table public.couple_settings   enable row level security;
alter table public.user_settings     enable row level security;
alter table public.weeks             enable row level security;
alter table public.week_members      enable row level security;
alter table public.goals             enable row level security;
alter table public.goal_days         enable row level security;
alter table public.goal_completions  enable row level security;
alter table public.punishments       enable row level security;
alter table public.weekly_results    enable row level security;
alter table public.roulette_results  enable row level security;
alter table public.corrections       enable row level security;
alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;

create policy "perfil propio y de la pareja" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or id = (select public.my_partner_id()));

create policy "mi pareja" on public.couples
  for select to authenticated using (id = (select public.my_couple_id()));

create policy "miembros de mi pareja" on public.couple_members
  for select to authenticated using (couple_id = (select public.my_couple_id()));

create policy "ajustes de mi pareja" on public.couple_settings
  for select to authenticated using (couple_id = (select public.my_couple_id()));

create policy "mis preferencias" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));

create policy "semanas de mi pareja" on public.weeks
  for select to authenticated using (couple_id = (select public.my_couple_id()));

create policy "participación de mi pareja" on public.week_members
  for select to authenticated using (couple_id = (select public.my_couple_id()));

create policy "metas de mi pareja" on public.goals
  for select to authenticated using (couple_id = (select public.my_couple_id()));

create policy "días de metas de mi pareja" on public.goal_days
  for select to authenticated
  using (exists (
    select 1 from public.goals g
    where g.id = goal_days.goal_id and g.couple_id = (select public.my_couple_id())
  ));

create policy "cumplimientos de mi pareja" on public.goal_completions
  for select to authenticated using (couple_id = (select public.my_couple_id()));

-- Los castigos son secretos: los ve quien los escribió y, solo cuando le
-- toca girar la ruleta (semana cerrada y perdida), quien los recibe.
create policy "castigos propios o revelados" on public.punishments
  for select to authenticated
  using (
    author_id = (select auth.uid())
    or (
      target_id = (select auth.uid())
      and exists (
        select 1 from public.weekly_results wr
        where wr.week_id = punishments.week_id
          and wr.user_id = (select auth.uid())
          and wr.must_spin
      )
    )
  );

create policy "resultados de mi pareja" on public.weekly_results
  for select to authenticated using (couple_id = (select public.my_couple_id()));

create policy "ruletas de mi pareja" on public.roulette_results
  for select to authenticated using (couple_id = (select public.my_couple_id()));

create policy "correcciones de mi pareja" on public.corrections
  for select to authenticated using (couple_id = (select public.my_couple_id()));

create policy "catálogo de logros" on public.achievements
  for select to authenticated using (true);

create policy "logros de mi pareja" on public.user_achievements
  for select to authenticated using (couple_id = (select public.my_couple_id()));

-- ─────────────────────── Permisos ────────────────────────────────────
-- Todo explícito: no dependemos de los privilegios por defecto del proyecto
-- (Supabase dejó de exponer automáticamente las tablas nuevas de public).

grant usage on schema public to authenticated;

revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;

revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.app_now(),
  public.my_couple_id(),
  public.my_partner_id(),
  public.couple_today(uuid),
  public.is_safe_punishment(text),
  public.member_streak(uuid, uuid),
  public.member_stats(uuid, uuid),
  public.week_summary(public.weeks),
  public.incoming_punishment_count(uuid),
  public._require_uid(),
  public.sync_weeks(),
  public.get_state(),
  public.get_week(uuid),
  public.get_history(),
  public.create_couple(text),
  public.join_couple(text),
  public.update_profile(jsonb),
  public.update_user_settings(jsonb),
  public.update_couple_settings(jsonb),
  public.save_goals(uuid, jsonb),
  public.save_punishments(uuid, jsonb),
  public.confirm_setup(uuid),
  public.set_completion(uuid, boolean),
  public.request_correction(uuid, date, boolean, text),
  public.resolve_correction(uuid, boolean),
  public.cancel_correction(uuid),
  public.spin_roulette(uuid),
  public.accept_punishment(uuid)
to authenticated;
