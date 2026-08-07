-- Commissioner-selected championship hardware. Choice is free preseason,
-- then immutable once the opening card has kicked or any week is scored.
alter table public.leagues
  add column if not exists championship_trophy_id text;

alter table public.leagues
  drop constraint if exists leagues_championship_trophy_id_check;
alter table public.leagues
  add constraint leagues_championship_trophy_id_check check (
    championship_trophy_id is null or championship_trophy_id in (
      'command_cup', 'golden_gut', 'the_receipt',
      'insufferable_crown', 'brass_football', 'last_one_standing'
    )
  );

alter table public.league_trophies
  add column if not exists trophy_design_id text;

create or replace function public.lock_championship_trophy_after_kickoff()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.championship_trophy_id is not distinct from old.championship_trophy_id then
    return new;
  end if;

  if exists (
    select 1 from public.week_results wr where wr.league_id = old.id
  ) or exists (
    select 1
    from public.week_cards wc
    join public.card_games cg on cg.week_card_id = wc.id
    where wc.league_id = old.id
      and cg.start_time ~ '^\\d{4}-\\d{2}-\\d{2}'
      and cg.start_time::timestamptz <= now()
  ) then
    raise exception 'Championship trophy is locked after opening kickoff';
  end if;
  return new;
end;
$$;

drop trigger if exists leagues_lock_championship_trophy on public.leagues;
create trigger leagues_lock_championship_trophy
before update of championship_trophy_id on public.leagues
for each row execute function public.lock_championship_trophy_after_kickoff();

comment on column public.leagues.championship_trophy_id is
  'Commissioner-selected championship hardware; required before season and locked at opening kickoff.';
comment on column public.league_trophies.trophy_design_id is
  'Frozen trophy catalog id copied at engraving so historical hardware never changes.';
