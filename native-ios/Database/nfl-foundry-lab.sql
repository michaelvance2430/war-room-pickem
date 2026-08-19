-- A dedicated NFL Foundry. It must never share state, routing, or season rules
-- with the CFB lab at f0000000-0000-4000-8000-000000000001.

insert into public.leagues (
  id,
  name,
  code,
  commissioner_id,
  cut_percent,
  regular_season_weeks,
  games_per_week,
  current_week,
  sport_id,
  sport_settings,
  is_open,
  crystal_ball_enabled,
  max_human_members,
  mode,
  championship_trophy_id,
  late_join_policy,
  lobby_visibility,
  accept_join_requests
)
values (
  'f0000000-0000-4000-8000-000000000002'::uuid,
  'Sunday Foundry Bot Lab',
  'NFLFORGE',
  '09544d2b-6eca-4131-a321-c000586c9029'::uuid,
  50,
  18,
  5,
  1,
  'nfl',
  '{}'::jsonb,
  false,
  true,
  2,
  'foundry',
  'nfl_sunday_scepter',
  'reinforcement_credit',
  'hidden',
  false
)
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  commissioner_id = excluded.commissioner_id,
  regular_season_weeks = 18,
  games_per_week = 5,
  sport_id = 'nfl',
  is_open = false,
  crystal_ball_enabled = true,
  max_human_members = 2,
  mode = 'foundry',
  championship_trophy_id = 'nfl_sunday_scepter',
  lobby_visibility = 'hidden',
  accept_join_requests = false;

insert into public.memberships (
  league_id,
  user_id,
  role,
  division,
  is_bot,
  is_moderator,
  locker_muted,
  is_deputy,
  display_name_override,
  eligible_from_week
)
select
  'f0000000-0000-4000-8000-000000000002'::uuid,
  source.user_id,
  source.role,
  source.division,
  source.is_bot,
  source.is_moderator,
  source.locker_muted,
  source.is_deputy,
  source.display_name_override,
  1
from public.memberships source
where source.league_id = 'f0000000-0000-4000-8000-000000000001'::uuid
on conflict (league_id, user_id) do update set
  role = excluded.role,
  division = excluded.division,
  is_bot = excluded.is_bot,
  is_moderator = excluded.is_moderator,
  locker_muted = excluded.locker_muted,
  is_deputy = excluded.is_deputy,
  display_name_override = excluded.display_name_override,
  eligible_from_week = 1;

insert into public.foundry_season_lifecycle (
  league_id,
  run_number,
  stage,
  week_number
)
values (
  'f0000000-0000-4000-8000-000000000002'::uuid,
  1,
  'season_opening',
  1
)
on conflict (league_id) do nothing;
