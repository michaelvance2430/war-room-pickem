-- =============================================================================
-- E1 — Saturday Situation Room — SELECT ONLY blast-radius audit
-- League: Saturday Situation Room
-- UUID:   76730ee3-d440-4a91-9616-a768ffc03189
--
-- SAFE: every statement is SELECT (or SELECT into client results only).
-- DO NOT run INSERT/UPDATE/DELETE/DDL/RPC that mutates.
-- DO NOT wrap mutations in ROLLBACK.
-- =============================================================================

-- Constant for copy-paste convenience (PostgreSQL)
-- Use this UUID in every WHERE.
-- 76730ee3-d440-4a91-9616-a768ffc03189

-- ── A. League row ───────────────────────────────────────────────────────────
-- SELECT ONLY
SELECT
  id,
  name,
  code,
  sport_id,
  current_week,
  commissioner_id,
  cut_percent,
  regular_season_weeks,
  games_per_week,
  crystal_ball_enabled,
  created_at
FROM public.leagues
WHERE id = '76730ee3-d440-4a91-9616-a768ffc03189';

-- SELECT ONLY — column inventory if extra season fields exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leagues'
ORDER BY ordinal_position;

-- ── B. Memberships / roster ─────────────────────────────────────────────────
-- SELECT ONLY
SELECT
  m.id AS membership_id,
  m.user_id,
  m.role,
  m.division::text AS division,
  coalesce(m.is_bot, false) AS is_bot,
  m.joined_at,
  m.total_points,
  m.weekly_points,
  m.ats_correct,
  m.ats_total,
  m.current_streak,
  m.best_week,
  m.worst_week,
  m.perfect_weeks,
  m.best_bet_hits,
  m.best_bet_total,
  m.prop_hits,
  m.prop_total,
  m.weeks_played,
  p.display_name
FROM public.memberships m
LEFT JOIN public.profiles p ON p.id = m.user_id
WHERE m.league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
ORDER BY coalesce(m.is_bot, false), p.display_name NULLS LAST;

-- SELECT ONLY — counts vs baseline (expect 27 human / 0 bot if clean)
SELECT
  count(*) AS total_memberships,
  count(*) FILTER (WHERE coalesce(is_bot, false) = false) AS humans,
  count(*) FILTER (WHERE coalesce(is_bot, false) = true) AS bots,
  count(*) FILTER (WHERE coalesce(is_bot, false) = false AND total_points <> 0) AS humans_with_points,
  count(*) FILTER (WHERE coalesce(is_bot, false) = false AND weeks_played > 0) AS humans_with_weeks_played,
  sum(total_points) FILTER (WHERE coalesce(is_bot, false) = true) AS bot_points_sum
FROM public.memberships
WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189';

-- ── C. Week cards (0–8 focus) ───────────────────────────────────────────────
-- SELECT ONLY
SELECT
  wc.id AS week_card_id,
  wc.week_number,
  wc.published_at,
  wc.lock_time,
  wc.prop_question,
  wc.prop_option_a,
  wc.prop_option_b,
  wc.prop_points,
  (SELECT count(*) FROM public.card_games cg WHERE cg.week_card_id = wc.id) AS game_count
FROM public.week_cards wc
WHERE wc.league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
ORDER BY wc.week_number;

-- SELECT ONLY — card_games columns present (demo markers often on odds_event_id)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'card_games'
ORDER BY ordinal_position;

-- SELECT ONLY — card games with demo/foundry markers
-- App stores demo slate ids as oddsEventId → odds_event_id (DB id is often UUID).
SELECT
  wc.week_number,
  cg.id AS card_game_id,
  cg.away_team,
  cg.home_team,
  cg.spread,
  cg.favorite,
  cg.start_time,
  cg.bookmaker,
  cg.sort_order,
  cg.odds_event_id,
  (
    coalesce(cg.odds_event_id::text, '') ILIKE 'demo%'
    OR coalesce(cg.odds_event_id::text, '') ILIKE 'demo-w%'
    OR coalesce(cg.odds_event_id::text, '') ILIKE 'demo-nfl%'
    OR coalesce(cg.bookmaker, '') ILIKE '%demo%'
  ) AS looks_demo_marker,
  (coalesce(cg.away_team, '') || ' @ ' || coalesce(cg.home_team, '')) AS matchup
FROM public.card_games cg
JOIN public.week_cards wc ON wc.id = cg.week_card_id
WHERE wc.league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
  AND wc.week_number BETWEEN 0 AND 8
ORDER BY wc.week_number, cg.sort_order;

-- SELECT ONLY — per-week demo-marker summary
SELECT
  wc.week_number,
  count(cg.*) AS games,
  count(cg.*) FILTER (
    WHERE coalesce(cg.odds_event_id::text, '') ILIKE 'demo%'
       OR coalesce(cg.odds_event_id::text, '') ILIKE 'demo-nfl%'
  ) AS demo_odds_event_ids,
  min(wc.published_at) AS published_at
FROM public.week_cards wc
LEFT JOIN public.card_games cg ON cg.week_card_id = wc.id
WHERE wc.league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
  AND wc.week_number BETWEEN 0 AND 8
GROUP BY wc.week_number
ORDER BY wc.week_number;

-- ── D. Picks (0–8) ──────────────────────────────────────────────────────────
-- SELECT ONLY — pick headers
SELECT
  p.id AS pick_id,
  p.user_id,
  p.week_number,
  p.locked_at,
  p.created_at,
  p.updated_at,
  p.prop_choice,
  p.best_bet_game_id,
  p.total_points,
  coalesce(m.is_bot, false) AS is_bot,
  p.display_name_override
FROM public.picks p
LEFT JOIN public.memberships m
  ON m.league_id = p.league_id AND m.user_id = p.user_id
WHERE p.league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
  AND p.week_number BETWEEN 0 AND 8
ORDER BY p.week_number, coalesce(m.is_bot, false), p.user_id;

-- SELECT ONLY — pick counts by week × bot/human
SELECT
  p.week_number,
  count(*) AS picks,
  count(*) FILTER (WHERE coalesce(m.is_bot, false)) AS bot_picks,
  count(*) FILTER (WHERE NOT coalesce(m.is_bot, false)) AS human_picks,
  count(*) FILTER (WHERE p.locked_at IS NOT NULL) AS locked_picks
FROM public.picks p
LEFT JOIN public.memberships m
  ON m.league_id = p.league_id AND m.user_id = p.user_id
WHERE p.league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
  AND p.week_number BETWEEN 0 AND 8
GROUP BY p.week_number
ORDER BY p.week_number;

-- SELECT ONLY — pick_games volume (not full selection dump)
SELECT
  p.week_number,
  count(pg.*) AS pick_game_rows,
  count(DISTINCT p.user_id) AS users_with_picks
FROM public.pick_games pg
JOIN public.picks p ON p.id = pg.pick_id
WHERE p.league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
  AND p.week_number BETWEEN 0 AND 8
GROUP BY p.week_number
ORDER BY p.week_number;

-- ── E. Results / scoring ────────────────────────────────────────────────────
-- SELECT ONLY
SELECT
  wr.id AS week_result_id,
  wr.week_number,
  wr.prop_result,
  wr.scored_at
FROM public.week_results wr
WHERE wr.league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
ORDER BY wr.week_number;

-- SELECT ONLY — game_results counts per week
SELECT
  wr.week_number,
  wr.scored_at,
  count(gr.*) AS game_result_rows
FROM public.week_results wr
LEFT JOIN public.game_results gr ON gr.week_result_id = wr.id
WHERE wr.league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
GROUP BY wr.week_number, wr.scored_at
ORDER BY wr.week_number;

-- SELECT ONLY — how current_week=8 is explained by scored weeks
SELECT
  l.current_week,
  (SELECT max(week_number) FROM public.week_results wr
    WHERE wr.league_id = l.id) AS max_scored_week,
  (SELECT count(*) FROM public.week_results wr
    WHERE wr.league_id = l.id) AS scored_week_count,
  (SELECT max(week_number) FROM public.week_cards wc
    WHERE wc.league_id = l.id AND wc.published_at IS NOT NULL) AS max_published_week
FROM public.leagues l
WHERE l.id = '76730ee3-d440-4a91-9616-a768ffc03189';

-- ── F. Derived competitive state (summary) ──────────────────────────────────
-- SELECT ONLY — standings-shaped snapshot
SELECT
  m.user_id,
  coalesce(m.is_bot, false) AS is_bot,
  m.division::text,
  m.total_points,
  m.weeks_played,
  m.current_streak,
  m.ats_correct,
  m.ats_total,
  m.perfect_weeks,
  array_length(m.weekly_points, 1) AS weekly_points_len
FROM public.memberships m
WHERE m.league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
ORDER BY m.total_points DESC NULLS LAST
LIMIT 40;

-- ── G. Permanent / cultural surfaces ────────────────────────────────────────
-- SELECT ONLY — trophies
SELECT id, season_year, trophy_type, winner_name, winner_user_id, awarded_at, subtitle, notes
FROM public.league_trophies
WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
ORDER BY season_year DESC, trophy_type;

-- SELECT ONLY — gazette
SELECT id, week_number, created_at
FROM public.gazette_editions
WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
ORDER BY week_number;

-- SELECT ONLY — announcements
SELECT id, created_at, left(coalesce(title, body, ''), 80) AS preview
FROM public.announcements
WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
ORDER BY created_at DESC
LIMIT 50;

-- SELECT ONLY — locker volume
SELECT count(*) AS locker_messages,
       min(created_at) AS first_msg,
       max(created_at) AS last_msg
FROM public.locker_messages
WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189';

-- SELECT ONLY — crystal ball
SELECT user_id, team_name, locked_at, created_at
FROM public.crystal_ball_picks
WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189';

SELECT * FROM public.crystal_ball_result
WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189';

-- SELECT ONLY — achievements for this league (if table present)
SELECT league_id, user_id, code, awarded_at
FROM public.achievements
WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
ORDER BY awarded_at DESC NULLS LAST
LIMIT 100;

-- SELECT ONLY — postseason tables if exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name ILIKE '%postseason%';

-- ── H. Timeline reconstruction helpers ──────────────────────────────────────
-- SELECT ONLY — union of key timestamps (week domain)
SELECT 'week_card' AS kind, week_number, published_at AS ts, id::text AS ref
FROM public.week_cards
WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
UNION ALL
SELECT 'week_result', week_number, scored_at, id::text
FROM public.week_results
WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
ORDER BY ts NULLS LAST, week_number;

-- ── Export helpers for pre-repair backup (SELECT ONLY — save results) ───────
-- SELECT ONLY
SELECT * FROM public.leagues WHERE id = '76730ee3-d440-4a91-9616-a768ffc03189';
-- SELECT ONLY
SELECT * FROM public.memberships WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189';
-- SELECT ONLY
SELECT * FROM public.week_cards WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189';
-- SELECT ONLY
SELECT cg.*
FROM public.card_games cg
JOIN public.week_cards wc ON wc.id = cg.week_card_id
WHERE wc.league_id = '76730ee3-d440-4a91-9616-a768ffc03189';
-- SELECT ONLY
SELECT * FROM public.picks WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189';
-- SELECT ONLY
SELECT pg.*
FROM public.pick_games pg
JOIN public.picks p ON p.id = pg.pick_id
WHERE p.league_id = '76730ee3-d440-4a91-9616-a768ffc03189';
-- SELECT ONLY
SELECT * FROM public.week_results WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189';
-- SELECT ONLY
SELECT gr.*
FROM public.game_results gr
JOIN public.week_results wr ON wr.id = gr.week_result_id
WHERE wr.league_id = '76730ee3-d440-4a91-9616-a768ffc03189';

-- END E1 SELECT ONLY
