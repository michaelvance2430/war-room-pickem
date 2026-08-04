-- Anonymous league favorite-team counts for the commissioner card builder.
-- Returns team_id → supporter_count only (no names, no user ids).
-- Active human members of the requested league + sport only.
-- Authorize: league commissioner or deputy (card-builder ops).

create or replace function public.get_league_favorite_team_counts(
  p_league_id uuid,
  p_sport_id text
)
returns table (
  team_id text,
  supporter_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Card builder only: commissioner or deputy of this league
  if not exists (
    select 1
    from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = auth.uid()
      and (
        m.role = 'commissioner'
        or coalesce(m.is_deputy, false) = true
      )
  ) then
    raise exception 'Not authorized for this league';
  end if;

  if p_sport_id is null or char_length(trim(p_sport_id)) < 2 then
    return;
  end if;

  return query
  select
    f.team_id::text,
    count(distinct f.user_id)::bigint as supporter_count
  from public.memberships m
  inner join public.profile_favorite_teams f
    on f.user_id = m.user_id
   and f.sport_id = trim(p_sport_id)
  where m.league_id = p_league_id
    and coalesce(m.is_bot, false) = false
    and f.team_id is not null
    and f.team_id <> 'no-team'
  group by f.team_id
  order by count(distinct f.user_id) desc, f.team_id;
end;
$$;

comment on function public.get_league_favorite_team_counts(uuid, text) is
  'Anonymous favorite-team supporter counts for active human members of one league and sport. Ops only.';

grant execute on function public.get_league_favorite_team_counts(uuid, text) to authenticated;

notify pgrst, 'reload schema';
