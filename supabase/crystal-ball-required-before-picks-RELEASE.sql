-- RELEASE GATE: apply only after clients support first Crystal Ball selection
-- after kickoff and the Picks redirect. Do not apply to production early.
begin;
create or replace function public.require_crystal_ball_before_picks()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  -- Scoring updates and bot simulations are not player save attempts.
  if auth.uid() is null or auth.uid() <> new.user_id then return new; end if;
  if exists(select 1 from public.leagues where id=new.league_id and lower(sport_id) in ('cfb','nfl'))
    and not exists(select 1 from public.crystal_ball_picks where league_id=new.league_id
      and user_id=new.user_id and nullif(btrim(team_name),'') is not null) then
    raise exception 'You must choose your Crystal Ball before you can save any picks.' using errcode='23514';
  end if;
  return new;
end;
$$;
drop trigger if exists require_crystal_ball_before_picks on public.picks;
create trigger require_crystal_ball_before_picks before insert or update of prop_choice, best_bet_game_id, locked_at, is_chaos on public.picks
for each row execute function public.require_crystal_ball_before_picks();
commit;
