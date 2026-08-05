-- ============================================================
-- Museum Phase 1A — compact verification (READ ONLY)
-- Supabase often only shows the LAST result set of a long script.
-- This file uses a few queries so each result is easy to see.
-- Run ALL statements; check each result tab if Supabase shows multiple.
-- ============================================================

-- RESULT 1: tables + museum row counts + competitive counts
select
  'check' as section,
  to_regclass('public.museum_events') is not null as museum_events_exists,
  to_regclass('public.museum_event_participants') is not null as participants_exists,
  to_regclass('public.museum_allegiance_snapshots') is not null as snapshots_exists,
  to_regclass('public.game_final_scores') is not null as final_scores_exists,
  (select count(*) from public.museum_events) as museum_events_count,
  (select count(*) from public.museum_event_participants) as museum_participants_count,
  (select count(*) from public.museum_allegiance_snapshots) as snapshots_count,
  (select count(*) from public.game_final_scores) as final_scores_count,
  (select count(*) from public.leagues) as leagues,
  (select count(*) from public.memberships) as memberships,
  (select count(*) from public.week_cards) as week_cards,
  (select count(*) from public.card_games) as card_games,
  (select count(*) from public.picks) as picks,
  (select count(*) from public.week_results) as week_results,
  (select count(*) from public.game_results) as game_results,
  (select count(*) from public.league_trophies) as league_trophies,
  (select count(*) from public.gazette_editions) as gazette_editions;

-- RESULT 2: RLS enabled
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

-- RESULT 3: foreign keys + on delete
select
  rel.relname as table_name,
  conf.relname as ref_table,
  case con.confdeltype
    when 'a' then 'NO ACTION'
    when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
  end as on_delete,
  con.conname
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
order by 1, 2;

-- RESULT 4: function EXECUTE ACL (PUBLIC / anon / authenticated)
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
  ), '') as all_execute_grantees
from museum_fns f
order by 1;

-- RESULT 5: functions exist count
select count(*) as museum_function_count
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
  );
-- expect 8
