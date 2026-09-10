-- First predictions remain available after opening kickoff; revisions do not.
-- Apply before the native client update. Existing clients remain compatible.
begin;
create or replace function public.d1c_enforce_crystal_ball_write_window()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_at timestamptz;
begin
  if nullif(btrim(new.team_name), '') is null then
    raise exception 'Choose a Crystal Ball team' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.league_id is distinct from old.league_id or new.user_id is distinct from old.user_id then
      raise exception 'Crystal Ball ownership cannot change' using errcode = '23514';
    end if;
    select min(public.d1c_parse_kickoff(cg.start_time)) into v_at
    from public.leagues l join public.week_cards wc on wc.league_id=l.id
    join public.card_games cg on cg.week_card_id=wc.id
    where l.id=old.league_id
      and wc.week_number=case lower(l.sport_id) when 'cfb' then 0 when 'nfl' then 1 else -1 end;
    if v_at is not null and now() >= v_at then
      raise exception 'Crystal Ball is locked at opening kickoff. Existing picks cannot be changed.' using errcode='23514';
    end if;
  else
    -- The database records the actual time; late entries cannot backdate receipts.
    new.picked_at := now();
  end if;
  return new;
end;
$$;
drop policy if exists "Users insert own crystal ball before kickoff" on public.crystal_ball_picks;
drop policy if exists "Users insert own first crystal ball" on public.crystal_ball_picks;
create policy "Users insert own first crystal ball" on public.crystal_ball_picks
for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.memberships m
    where m.league_id=crystal_ball_picks.league_id and m.user_id=(select auth.uid())
  )
);
commit;
