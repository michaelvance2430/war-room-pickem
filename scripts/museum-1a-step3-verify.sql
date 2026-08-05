-- ============================================================
-- Museum Phase 1A — STEP 3: Read-only verification
-- Run AFTER museum-phase1a-foundation.sql
-- NO inserts, updates, deletes, or test data.
-- ============================================================

-- A) Four new tables exist
select
  to_regclass('public.museum_events') is not null as museum_events,
  to_regclass('public.museum_event_participants') is not null as museum_event_participants,
  to_regclass('public.museum_allegiance_snapshots') is not null as museum_allegiance_snapshots,
  to_regclass('public.game_final_scores') is not null as game_final_scores;

-- B) Expected columns exist (full column inventory)
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'museum_events',
    'museum_event_participants',
    'museum_allegiance_snapshots',
    'game_final_scores'
  )
order by table_name, ordinal_position;

-- B2) game_results optional numeric columns present
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'game_results'
  and column_name in (
    'away_score', 'home_score', 'overtime', 'score_source', 'finalized_at'
  )
order by column_name;

-- C) RLS enabled
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'museum_events',
    'museum_event_participants',
    'museum_allegiance_snapshots',
    'game_final_scores'
  )
order by 1;

-- D) Policies exist (SELECT only expected)
select schemaname, tablename, policyname, cmd, roles::text as roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'museum_events',
    'museum_event_participants',
    'museum_allegiance_snapshots',
    'game_final_scores'
  )
order by tablename, policyname;

-- E) Functions exist
select p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'museum_is_league_ops',
    'museum_is_league_member',
    'museum_league_is_production',
    'museum_card_first_kickoff',
    'museum_rebuild_allegiance_snapshots',
    'museum_freeze_allegiance_snapshots',
    'museum_upsert_game_final_scores',
    'museum_league_event_count'
  )
order by 1;

-- F) Function ACLs — PUBLIC / anon / authenticated / service_role / unexpected
-- Uses proacl + acldefault + aclexplode (PUBLIC is a privilege grantor, not a pg_roles row)
with museum_fns as (
  select
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as args,
    coalesce(
      p.proacl,
      acldefault('f', p.proowner)
    ) as acl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'museum_is_league_ops',
      'museum_is_league_member',
      'museum_league_is_production',
      'museum_card_first_kickoff',
      'museum_rebuild_allegiance_snapshots',
      'museum_freeze_allegiance_snapshots',
      'museum_upsert_game_final_scores',
      'museum_league_event_count'
    )
),
exploded as (
  select
    f.proname,
    f.args,
    a.grantee,
    a.privilege_type,
    a.is_grantable
  from museum_fns f
  cross join lateral aclexplode(f.acl) as a
),
labeled as (
  select
    e.proname,
    e.args,
    e.privilege_type,
    e.is_grantable,
    case
      when e.grantee = 0 then 'PUBLIC'
      else coalesce(r.rolname, e.grantee::text)
    end as grantee_name
  from exploded e
  left join pg_roles r on r.oid = e.grantee
)
select
  proname as function_name,
  args,
  grantee_name,
  privilege_type,
  is_grantable
from labeled
where privilege_type = 'EXECUTE'
order by function_name, grantee_name;

-- F2) Explicit PASS/FAIL matrix for intended EXECUTE policy
with museum_fns as (
  select
    p.oid,
    p.proname,
    coalesce(p.proacl, acldefault('f', p.proowner)) as acl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'museum_is_league_ops',
      'museum_is_league_member',
      'museum_league_is_production',
      'museum_card_first_kickoff',
      'museum_rebuild_allegiance_snapshots',
      'museum_freeze_allegiance_snapshots',
      'museum_upsert_game_final_scores',
      'museum_league_event_count'
    )
),
exec_grants as (
  select
    f.proname,
    case
      when a.grantee = 0 then 'PUBLIC'
      else coalesce(r.rolname, a.grantee::text)
    end as grantee_name
  from museum_fns f
  cross join lateral aclexplode(f.acl) as a
  left join pg_roles r on r.oid = a.grantee
  where a.privilege_type = 'EXECUTE'
)
select
  f.proname as function_name,
  not exists (
    select 1 from exec_grants g
    where g.proname = f.proname and g.grantee_name = 'PUBLIC'
  ) as public_has_no_execute,
  not exists (
    select 1 from exec_grants g
    where g.proname = f.proname and g.grantee_name = 'anon'
  ) as anon_has_no_execute,
  exists (
    select 1 from exec_grants g
    where g.proname = f.proname and g.grantee_name = 'authenticated'
  ) as authenticated_has_execute,
  coalesce((
    select string_agg(distinct g.grantee_name, ', ' order by g.grantee_name)
    from exec_grants g
    where g.proname = f.proname
      and g.grantee_name not in ('authenticated', 'postgres')
      -- postgres/owner may appear depending on cluster; flag unexpected others
  ), '') as non_auth_grantees_note,
  coalesce((
    select string_agg(distinct g.grantee_name, ', ' order by g.grantee_name)
    from exec_grants g
    where g.proname = f.proname
  ), '') as all_execute_grantees
from museum_fns f
order by 1;

-- Expected F2:
--   public_has_no_execute = true
--   anon_has_no_execute = true
--   authenticated_has_execute = true
--   all_execute_grantees typically only "authenticated" (owner/postgres may also show)
--
-- service_role: Supabase service_role is not granted EXECUTE via these grants.
-- It operates as a privileged API role (bypasses RLS; function EXECUTE still
-- subject to grants unless superuser). Absence of service_role in all_execute_grantees
-- is expected and correct for Phase 1A (RPCs still callable from service client
-- when the JWT role is service_role only if the role has EXECUTE or is superuser).
-- Explicit check:
select
  r.rolname,
  r.rolsuper as is_superuser,
  r.rolbypassrls as bypass_rls
from pg_roles r
where r.rolname in ('service_role', 'authenticated', 'anon', 'postgres')
order by 1;

-- G) Foreign keys + delete actions
select
  con.conname,
  rel.relname as table_name,
  conf.relname as ref_table,
  case con.confdeltype
    when 'a' then 'NO ACTION'
    when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
  end as on_delete
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
left join pg_class conf on conf.oid = con.confrelid
where n.nspname = 'public'
  and con.contype = 'f'
  and rel.relname in (
    'museum_events',
    'museum_event_participants',
    'museum_allegiance_snapshots',
    'game_final_scores'
  )
order by rel.relname, con.conname;

-- Expected:
-- museum_events → leagues RESTRICT
-- museum_event_participants → museum_events CASCADE
-- museum_allegiance_snapshots → leagues CASCADE (+ user_id profiles SET NULL)
-- game_final_scores → leagues CASCADE

-- H) Unique / supporting indexes
select indexname, tablename, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'museum_events',
    'museum_event_participants',
    'museum_allegiance_snapshots',
    'game_final_scores'
  )
order by tablename, indexname;

-- I) Zero Museum foundation rows before first publish/score
select
  (select count(*) from public.museum_events) as museum_events_count,
  (select count(*) from public.museum_event_participants) as museum_participants_count,
  (select count(*) from public.museum_allegiance_snapshots) as allegiance_snapshots_count,
  (select count(*) from public.game_final_scores) as game_final_scores_count;

-- Expect: all 0

-- J) Competitive row counts (must match Step 1 pre-migration results)
select 'leagues' as tbl, count(*)::bigint as row_count from public.leagues
union all select 'memberships', count(*)::bigint from public.memberships
union all select 'week_cards', count(*)::bigint from public.week_cards
union all select 'card_games', count(*)::bigint from public.card_games
union all select 'picks', count(*)::bigint from public.picks
union all select 'week_results', count(*)::bigint from public.week_results
union all select 'game_results', count(*)::bigint from public.game_results
union all select 'league_trophies', count(*)::bigint from public.league_trophies
union all select 'gazette_editions', count(*)::bigint from public.gazette_editions
order by 1;
