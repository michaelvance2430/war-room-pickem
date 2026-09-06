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

commit;

-- Weekly rows are deliberately separate. Do not invent them from these season
-- starts: each sport_card_windows row must represent that app week's actual
-- earliest scheduled game, and the client subtracts exactly seven days.
