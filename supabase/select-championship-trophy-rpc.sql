-- Deterministic commissioner trophy selection for native clients.
-- The existing leagues trigger remains the authoritative kickoff lock.
create or replace function public.select_championship_trophy(
  p_league_id uuid,
  p_trophy_id text
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_saved text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.commissioner_id = v_uid
  ) then
    raise exception 'Only the commissioner can choose championship hardware';
  end if;

  update public.leagues
  set championship_trophy_id = p_trophy_id
  where id = p_league_id
  returning championship_trophy_id into v_saved;

  if v_saved is distinct from p_trophy_id then
    raise exception 'Championship trophy was not saved';
  end if;

  return v_saved;
end;
$$;

revoke all on function public.select_championship_trophy(uuid, text)
from public, anon, authenticated;
grant execute on function public.select_championship_trophy(uuid, text)
to authenticated;

comment on function public.select_championship_trophy(uuid, text) is
  'Commissioner-only trophy selection with a deterministic saved-value response; the leagues kickoff-lock trigger remains authoritative.';
