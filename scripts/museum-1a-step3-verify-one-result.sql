-- ============================================================
-- Museum Phase 1A — ONE result set (READ ONLY)
-- Supabase only shows the last SELECT — this file has exactly one.
-- ============================================================

with
tables_ok as (
  select
    (to_regclass('public.museum_events') is not null) as museum_events_exists,
    (to_regclass('public.museum_event_participants') is not null) as participants_exists,
    (to_regclass('public.museum_allegiance_snapshots') is not null) as snapshots_exists,
    (to_regclass('public.game_final_scores') is not null) as final_scores_exists
),
counts as (
  select
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
    (select count(*) from public.gazette_editions) as gazette_editions
),
rls as (
  select bool_and(c.relrowsecurity) as all_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'museum_events',
      'museum_event_participants',
      'museum_allegiance_snapshots',
      'game_final_scores'
    )
),
fks as (
  select
    bool_or(
      rel.relname = 'museum_events'
      and conf.relname = 'leagues'
      and con.confdeltype = 'r'
    ) as museum_events_league_restrict,
    bool_or(
      rel.relname = 'museum_event_participants'
      and conf.relname = 'museum_events'
      and con.confdeltype = 'c'
    ) as participants_event_cascade,
    bool_or(
      rel.relname = 'museum_allegiance_snapshots'
      and conf.relname = 'leagues'
      and con.confdeltype = 'c'
    ) as snapshots_league_cascade,
    bool_or(
      rel.relname = 'game_final_scores'
      and conf.relname = 'leagues'
      and con.confdeltype = 'c'
    ) as final_scores_league_cascade
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
),
museum_fns as (
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
),
acl as (
  select
    (select count(*) from museum_fns) as museum_function_count,
    bool_and(
      not exists (
        select 1 from exec_grants g
        where g.proname = f.proname and g.grantee_name = 'PUBLIC'
      )
    ) as all_public_no_execute,
    bool_and(
      not exists (
        select 1 from exec_grants g
        where g.proname = f.proname and g.grantee_name = 'anon'
      )
    ) as all_anon_no_execute,
    bool_and(
      exists (
        select 1 from exec_grants g
        where g.proname = f.proname and g.grantee_name = 'authenticated'
      )
    ) as all_authenticated_has_execute
  from museum_fns f
)
select
  -- Tables
  t.museum_events_exists,
  t.participants_exists,
  t.snapshots_exists,
  t.final_scores_exists,
  -- Museum empty
  c.museum_events_count,
  c.museum_participants_count,
  c.snapshots_count,
  c.final_scores_count,
  -- Competitive (must match Step 1)
  c.leagues,
  c.memberships,
  c.week_cards,
  c.card_games,
  c.picks,
  c.week_results,
  c.game_results,
  c.league_trophies,
  c.gazette_editions,
  -- RLS
  r.all_rls_enabled,
  -- FKs
  f.museum_events_league_restrict,
  f.participants_event_cascade,
  f.snapshots_league_cascade,
  f.final_scores_league_cascade,
  -- Functions + ACL
  a.museum_function_count,
  a.all_public_no_execute,
  a.all_anon_no_execute,
  a.all_authenticated_has_execute
from tables_ok t
cross join counts c
cross join rls r
cross join fks f
cross join acl a;
