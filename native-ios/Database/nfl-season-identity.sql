-- NFL rooms always run Weeks 1-18 with five weekly games.
begin;

alter table public.leagues drop constraint if exists leagues_regular_season_weeks_check;
alter table public.leagues add constraint leagues_regular_season_weeks_check
check (regular_season_weeks between 4 and 18);

create or replace function public.enforce_nfl_season_identity() returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
begin
  if new.sport_id='nfl' then
    new.regular_season_weeks:=18;
    new.games_per_week:=5;
    new.current_week:=greatest(1,new.current_week);
  end if;
  return new;
end
$function$;

revoke all on function public.enforce_nfl_season_identity() from public,anon,authenticated;

drop trigger if exists enforce_nfl_season_identity on public.leagues;
create trigger enforce_nfl_season_identity
before insert or update of sport_id,regular_season_weeks,games_per_week,current_week
on public.leagues
for each row execute function public.enforce_nfl_season_identity();

update public.leagues
set regular_season_weeks=18,
    games_per_week=5,
    current_week=greatest(1,current_week)
where sport_id='nfl'
  and (regular_season_weeks<>18 or games_per_week<>5 or current_week<1);

commit;
