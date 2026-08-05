-- READ-ONLY incident scan: suspicious leagues.sport_id vs week/card evidence.
-- Paste into Supabase SQL Editor. No INSERT/UPDATE/DELETE.

with roster as (
  select
    league_id,
    count(*)::int as membership_count,
    count(*) filter (where coalesce(is_bot, false) = false)::int as human_count,
    count(*) filter (where is_bot = true)::int as bot_count
  from public.memberships
  group by league_id
),
week0_cards as (
  select distinct league_id
  from public.week_cards
  where week_number = 0
),
week1_cards as (
  select distinct league_id
  from public.week_cards
  where week_number = 1
),
flagged as (
  select
    l.id as league_id,
    l.name,
    l.sport_id,
    l.current_week,
    l.created_at,
    l.commissioner_id,
    coalesce(r.membership_count, 0) as membership_count,
    coalesce(r.human_count, 0) as human_count,
    coalesce(r.bot_count, 0) as bot_count,
    (w0.league_id is not null) as has_week0_card,
    (w1.league_id is not null) as has_week1_card,
    case
      when l.sport_id is null or trim(l.sport_id) = '' then
        'null_or_empty_sport_id'
      when l.sport_id not in ('cfb', 'nfl', 'soccer_wwc') then
        'unknown_sport_id'
      when l.sport_id = 'nfl' and coalesce(l.current_week, -1) = 0 then
        'nfl_with_current_week_0'
      when l.sport_id = 'cfb' and coalesce(l.current_week, -1) = 1
           and w0.league_id is null and w1.league_id is not null then
        'cfb_with_week1_only_card'
      when l.sport_id = 'nfl' and w0.league_id is not null then
        'nfl_with_week0_card'
      when l.sport_id = 'cfb' and w1.league_id is not null and w0.league_id is null
           and coalesce(l.current_week, 0) >= 1 then
        'cfb_week1_card_no_week0'
      when l.id = '76730ee3-d440-4a91-9616-a768ffc03189' then
        'known_incident_saturday_situation_room'
      else null
    end as suspicion_code
  from public.leagues l
  left join roster r on r.league_id = l.id
  left join week0_cards w0 on w0.league_id = l.id
  left join week1_cards w1 on w1.league_id = l.id
)
select
  league_id,
  name,
  sport_id,
  current_week,
  created_at,
  commissioner_id,
  membership_count,
  human_count,
  bot_count,
  has_week0_card,
  has_week1_card,
  suspicion_code,
  case suspicion_code
    when 'null_or_empty_sport_id' then
      'sport_id missing or blank'
    when 'unknown_sport_id' then
      'sport_id not in known pack ids (cfb/nfl/soccer_wwc)'
    when 'nfl_with_current_week_0' then
      'NFL pack with current_week=0 (CFB-style opening week; possible stamp retag)'
    when 'cfb_with_week1_only_card' then
      'CFB pack with week-1 card only and current_week=1 (possible wrong sport)'
    when 'nfl_with_week0_card' then
      'NFL pack has a week_cards row for week 0 (CFB artifact)'
    when 'cfb_week1_card_no_week0' then
      'CFB pack has week 1 card without week 0 (unusual for CFB season)'
    when 'known_incident_saturday_situation_room' then
      'Prior incident league — confirm sport_id=cfb and current_week=0'
    else 'other'
  end as evidence
from flagged
where suspicion_code is not null
order by
  case suspicion_code
    when 'known_incident_saturday_situation_room' then 0
    when 'nfl_with_current_week_0' then 1
    when 'nfl_with_week0_card' then 2
    else 3
  end,
  created_at desc;
