-- Public-score-only CFB postseason scoreboard. Picks remain private until their own reveal rules exist.
create or replace function public.get_cfb_postseason_scoreboard(
  p_league_id uuid,
  p_season_key integer
) returns table (
  user_id uuid,
  bowl_score integer,
  cfp_score integer,
  postseason_total integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if (select auth.uid()) is null or not public.is_league_member(p_league_id) then
    raise exception 'League membership required';
  end if;

  return query
  select
    e.user_id,
    e.bowl_score,
    e.cfp_score,
    coalesce(e.bowl_score, 0) + coalesce(e.cfp_score, 0)
  from public.cfb_postseason_entries e
  where e.league_id = p_league_id
    and e.season_key = p_season_key
    and (e.bowl_locked_at is not null or e.cfp_locked_at is not null)
  order by coalesce(e.bowl_score, 0) + coalesce(e.cfp_score, 0) desc, e.user_id;
end;
$function$;

revoke all on function public.get_cfb_postseason_scoreboard(uuid, integer) from public, anon;
grant execute on function public.get_cfb_postseason_scoreboard(uuid, integer) to authenticated;
