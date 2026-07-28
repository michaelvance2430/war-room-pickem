-- ============================================================
-- Reset season (keep members, wipe scores/picks/cards)
-- Run once in Supabase → SQL Editor → Run
-- ============================================================

create or replace function public.reset_league_season(p_league_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_picks int := 0;
  v_cards int := 0;
  v_results int := 0;
  v_members int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.commissioner_id = v_uid
  ) then
    raise exception 'Only the commissioner can reset the season';
  end if;

  -- Picks (+ pick_games via cascade)
  delete from public.picks
  where league_id = p_league_id;
  get diagnostics v_picks = row_count;

  -- Week results (+ game_results via cascade)
  delete from public.week_results
  where league_id = p_league_id;
  get diagnostics v_results = row_count;

  -- Week cards (+ card_games via cascade)
  delete from public.week_cards
  where league_id = p_league_id;
  get diagnostics v_cards = row_count;

  -- Season chatter (optional clean slate; members stay)
  delete from public.announcements
  where league_id = p_league_id;

  -- Zero every member's season stats — keep membership / division / role
  update public.memberships
  set
    total_points = 0,
    weekly_points = '{}',
    ats_correct = 0,
    ats_total = 0,
    current_streak = 0,
    best_week = 0,
    worst_week = 0,
    perfect_weeks = 0,
    best_bet_hits = 0,
    best_bet_total = 0,
    prop_hits = 0,
    prop_total = 0,
    weeks_played = 0
  where league_id = p_league_id;
  get diagnostics v_members = row_count;

  -- Ready for Week 0 openers
  update public.leagues
  set current_week = 0
  where id = p_league_id;

  return json_build_object(
    'ok', true,
    'membersKept', v_members,
    'picksDeleted', v_picks,
    'cardsDeleted', v_cards,
    'resultsDeleted', v_results
  );
end;
$$;

revoke all on function public.reset_league_season(uuid) from public;
grant execute on function public.reset_league_season(uuid) to authenticated;
