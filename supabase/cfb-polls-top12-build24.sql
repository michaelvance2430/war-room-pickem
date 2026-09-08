-- Build 24: expand the room ballot from Top 10 to the 12-team CFP field.

create or replace function public.cfb_ballot_has_twelve_unique(candidate text[])
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select cardinality(candidate) = 12
    and array_position(candidate, null) is null
    and cardinality(array(select distinct unnest(candidate))) = 12
$$;

alter table public.cfb_member_ballots
  drop constraint if exists cfb_member_ballots_ranked_team_ids_check;

alter table public.cfb_member_ballots
  add constraint cfb_member_ballots_ranked_team_ids_check
  check (public.cfb_ballot_has_twelve_unique(ranked_team_ids));

revoke all on function public.cfb_ballot_has_twelve_unique(text[]) from public, anon;
grant execute on function public.cfb_ballot_has_twelve_unique(text[]) to authenticated, service_role;

comment on table public.cfb_member_ballots is
  'One persistent Top 12 playoff-field ballot per league member and CFB week; visible room-wide only after reveal.';

drop function if exists public.cfb_ballot_has_ten_unique(text[]);
