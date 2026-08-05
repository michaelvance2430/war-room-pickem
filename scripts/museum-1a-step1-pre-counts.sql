-- ============================================================
-- Museum Phase 1A — STEP 1: Pre-migration competitive counts
-- READ ONLY. Run BEFORE the foundation migration.
-- Save the result set (screenshot or copy) to compare after Step 3.
-- ============================================================

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
