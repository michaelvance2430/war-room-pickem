-- =============================================================================
-- Build 21 — sport season boundary seeds — REVIEW ONLY
-- =============================================================================
-- DO NOT APPLY without Mike's explicit production approval.
-- Apply only after sport-season-windows-build21-REVIEW-ONLY.sql.
--
-- These rows drive offseason countdowns, not weekly card opening. Confirmed
-- governing-body dates are official. A future football opener that has not
-- been announced remains visibly estimated in the app.
--
-- Reviewed sources (2026-09-06):
--   CFB 2026 kickoff: https://collegefootballplayoff.com/news/2026/8/27/season-kickoff
--   CFB title dates: https://collegefootballplayoff.com/sports/2025/2/20/2027vegas
--                    https://collegefootballplayoff.com/news/2025/10/1/nola-28
--   NFL 2026 opener: https://www.nfl.com/news/seahawks-to-kick-off-2026-nfl-regular-season-on-wednesday-sept-9-in-seattle
--   NFL dates: https://www.nfl.com/news/2026-27-national-football-league-important-dates
--   NCAA first-contest dates: https://web3.ncaa.org/lsdbi/reports/getReport/90008
--   2027 tournament finals: https://www.ncaa.com/news/basketball-men/article/2026-05-07/2027-march-madness-mens-ncaa-tournament-schedule-dates
--                            https://www.ncaa.com/news/basketball-women/article/2026-05-07/2027-march-madness-womens-ncaa-tournament-schedule-dates-times

begin;

insert into public.sport_season_windows (
  sport_id,
  season_key,
  first_event_at,
  season_ends_at,
  timing_status,
  display_label,
  source_note
)
values
  (
    'cfb', 2026,
    '2026-08-29 16:00:00+00',
    '2027-01-26 08:00:00+00',
    'official',
    '2026-27',
    'CFP: 2026 season kicked off Aug 29 at noon ET; championship Jan 25, 2027. End timestamp includes an overnight completion buffer.'
  ),
  (
    'nfl', 2026,
    '2026-09-10 00:20:00+00',
    '2027-02-15 08:00:00+00',
    'official',
    '2026-27',
    'NFL: season opener Sep 9, 2026 at 8:20 PM ET; Super Bowl LXI Feb 14, 2027. End timestamp includes an overnight completion buffer.'
  ),
  (
    'ncaam', 2026,
    '2026-11-02 05:00:00+00',
    '2027-04-06 08:00:00+00',
    'official',
    '2026-27',
    'NCAA: first permissible contest Nov 2, 2026; championship Apr 5, 2027. End timestamp includes an overnight completion buffer.'
  ),
  (
    'ncaaw', 2026,
    '2026-11-02 05:00:00+00',
    '2027-04-05 08:00:00+00',
    'official',
    '2026-27',
    'NCAA: first permissible contest Nov 2, 2026; championship Apr 4, 2027. End timestamp includes an overnight completion buffer.'
  ),
  (
    'cfb', 2027,
    '2027-08-28 16:00:00+00',
    '2028-01-25 08:00:00+00',
    'estimated',
    '2027-28',
    'Estimated Week Zero opener. CFP has officially announced the Jan 24, 2028 championship; replace the opener and status when the first game is announced.'
  ),
  (
    'nfl', 2027,
    '2027-09-10 00:20:00+00',
    '2028-02-14 08:00:00+00',
    'estimated',
    '2027-28',
    'Estimated Thursday opener. Super Bowl LXII is officially Feb 13, 2028; replace the opener and status after the NFL schedule release.'
  ),
  (
    'ncaam', 2027,
    '2027-11-01 04:00:00+00',
    '2028-04-04 08:00:00+00',
    'official',
    '2027-28',
    'NCAA: first permissible contest Nov 1, 2027; championship Apr 3, 2028. End timestamp includes an overnight completion buffer.'
  ),
  (
    'ncaaw', 2027,
    '2027-11-01 04:00:00+00',
    '2028-04-03 08:00:00+00',
    'official',
    '2027-28',
    'NCAA: first permissible contest Nov 1, 2027; championship Apr 2, 2028. End timestamp includes an overnight completion buffer.'
  )
on conflict (sport_id, season_key) do update
set
  first_event_at = excluded.first_event_at,
  season_ends_at = excluded.season_ends_at,
  timing_status = excluded.timing_status,
  display_label = excluded.display_label,
  source_note = excluded.source_note,
  updated_at = now();

-- Product-week scaffolds give the UI a visibly estimated opening date before
-- the provider publishes events. The zero-credit schedule worker replaces the
-- estimate with the actual earliest eligible game. Re-running this seed never
-- overwrites a provider-verified first game.
with explicit_windows(
  sport_id, season_key, week_number, start_date, end_date,
  first_game_override, timing_status, display_label, source_note
) as (
  values
    ('cfb', 2026, 0, date '2026-08-27', date '2026-09-03', timestamptz '2026-08-29 16:00:00+00', 'official', 'Week 0', 'Official 2026 kickoff; weekly boundary reviewed for War Room.'),
    ('cfb', 2026, 1, date '2026-09-03', date '2026-09-08', null::timestamptz, 'estimated', 'Week 1', 'War Room Week 1 boundary; earliest event pending provider verification.'),
    ('cfb', 2026, 15, date '2026-12-18', date '2026-12-22', null::timestamptz, 'estimated', 'Postseason 1', 'War Room postseason boundary; earliest event pending provider verification.'),
    ('cfb', 2026, 16, date '2026-12-31', date '2027-01-03', null::timestamptz, 'estimated', 'Postseason 2', 'War Room postseason boundary; earliest event pending provider verification.'),
    ('cfb', 2026, 17, date '2027-01-08', date '2027-01-12', null::timestamptz, 'estimated', 'Postseason 3', 'War Room postseason boundary; earliest event pending provider verification.'),
    ('cfb', 2026, 18, date '2027-01-18', date '2027-01-21', null::timestamptz, 'estimated', 'Championship', 'War Room championship boundary; earliest event pending provider verification.'),
    ('nfl', 2026, 1, date '2026-09-09', date '2026-09-15', timestamptz '2026-09-10 00:20:00+00', 'official', 'Week 1', 'Official Wednesday NFL opener; weekly boundary reviewed for War Room.'),
    ('nfl', 2026, 19, date '2027-01-16', date '2027-01-19', null::timestamptz, 'estimated', 'Wild Card', 'War Room playoff boundary; earliest event pending provider verification.'),
    ('nfl', 2026, 20, date '2027-01-23', date '2027-01-25', null::timestamptz, 'estimated', 'Divisional', 'War Room playoff boundary; earliest event pending provider verification.'),
    ('nfl', 2026, 21, date '2027-01-31', date '2027-02-02', null::timestamptz, 'estimated', 'Conference Championships', 'War Room playoff boundary; earliest event pending provider verification.'),
    ('nfl', 2026, 22, date '2027-02-14', date '2027-02-15', null::timestamptz, 'estimated', 'Super Bowl', 'War Room championship boundary; earliest event pending provider verification.')
),
generated_windows as (
  select 'cfb'::text sport_id, 2026 season_key, week_number,
    date '2026-09-08' + ((week_number - 2) * 7) start_date,
    date '2026-09-08' + ((week_number - 2) * 7) + 7 end_date,
    null::timestamptz first_game_override, 'estimated'::text timing_status,
    'Week ' || week_number display_label,
    'War Room Tuesday-Monday CFB boundary; earliest event pending provider verification.'::text source_note
  from generate_series(2, 14) as weeks(week_number)
  union all
  select 'nfl', 2026, week_number,
    date '2026-09-17' + ((week_number - 2) * 7),
    date '2026-09-17' + ((week_number - 2) * 7) + 5,
    null::timestamptz, 'estimated', 'Week ' || week_number,
    'War Room Thursday-Monday NFL boundary; earliest event pending provider verification.'
  from generate_series(2, 18) as weeks(week_number)
  union all
  select sport_id, 2026, week_number,
    date '2026-11-02' + ((week_number - 1) * 7),
    date '2026-11-02' + ((week_number - 1) * 7) + 7,
    null::timestamptz, 'estimated', 'Window ' || week_number,
    'War Room Monday-Sunday Fieldhouse boundary; earliest event pending provider verification.'
  from (values ('ncaam'::text), ('ncaaw'::text)) sports(sport_id)
  cross join generate_series(1, 19) as weeks(week_number)
  union all
  select 'cfb', 2027, week_number,
    case when week_number = 0 then date '2027-08-26'
         when week_number = 1 then date '2027-09-02'
         else date '2027-09-07' + ((week_number - 2) * 7) end,
    case when week_number = 0 then date '2027-09-02'
         when week_number = 1 then date '2027-09-07'
         else date '2027-09-07' + ((week_number - 2) * 7) + 7 end,
    case when week_number = 0 then timestamptz '2027-08-28 16:00:00+00' else null::timestamptz end,
    'estimated', 'Week ' || week_number,
    'Estimated 2027 CFB product boundary; replace from the published schedule.'
  from generate_series(0, 14) as weeks(week_number)
  union all
  select 'nfl', 2027, week_number,
    date '2027-09-09' + ((week_number - 1) * 7),
    date '2027-09-09' + ((week_number - 1) * 7) + 5,
    null::timestamptz, 'estimated', 'Week ' || week_number,
    'Estimated 2027 NFL product boundary; replace from the published schedule.'
  from generate_series(1, 18) as weeks(week_number)
  union all
  select sport_id, 2027, week_number,
    date '2027-11-01' + ((week_number - 1) * 7),
    date '2027-11-01' + ((week_number - 1) * 7) + 7,
    null::timestamptz, 'estimated', 'Window ' || week_number,
    'War Room Monday-Sunday Fieldhouse boundary; earliest event pending provider verification.'
  from (values ('ncaam'::text), ('ncaaw'::text)) sports(sport_id)
  cross join generate_series(1, 19) as weeks(week_number)
),
all_windows as (
  select * from explicit_windows
  union all
  select * from generated_windows
),
prepared as (
  select
    sport_id, season_key, week_number,
    start_date::timestamp at time zone 'America/New_York' as window_starts_at,
    end_date::timestamp at time zone 'America/New_York' as window_ends_at,
    coalesce(
      first_game_override,
      start_date::timestamp at time zone 'America/New_York'
    ) as first_game_at,
    timing_status, display_label, source_note
  from all_windows
)
insert into public.sport_card_windows (
  sport_id, season_key, week_number,
  window_starts_at, window_ends_at, first_game_at,
  timing_status, display_label, source_note
)
select
  sport_id, season_key, week_number,
  window_starts_at, window_ends_at, first_game_at,
  timing_status, display_label, source_note
from prepared
on conflict (sport_id, season_key, week_number) do update
set
  window_starts_at = excluded.window_starts_at,
  window_ends_at = excluded.window_ends_at,
  first_game_at = case
    when public.sport_card_windows.last_ingested_at is not null
      then public.sport_card_windows.first_game_at
    else excluded.first_game_at
  end,
  timing_status = case
    when public.sport_card_windows.last_ingested_at is not null
      then public.sport_card_windows.timing_status
    else excluded.timing_status
  end,
  display_label = excluded.display_label,
  source_note = case
    when public.sport_card_windows.last_ingested_at is not null
      then public.sport_card_windows.source_note
    else excluded.source_note
  end,
  updated_at = now();

commit;

-- Weekly rows are deliberately separate. Do not invent them from these season
-- starts: each sport_card_windows row must represent that app week's actual
-- earliest scheduled game, and the client subtracts exactly seven days.
