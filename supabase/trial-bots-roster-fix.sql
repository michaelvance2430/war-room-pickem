-- Fix: roster RPC so Players page always lists trial bots
-- Run in Supabase SQL Editor → Run once after trial-bots.sql

create or replace function public.get_league_roster(p_league_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  display_name text,
  division public.division,
  role public.member_role,
  total_points int,
  avatar_url text,
  is_bot boolean
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
  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id and m.user_id = auth.uid()
  ) then
    raise exception 'Not a member of this league';
  end if;

  return query
  select
    m.id,
    m.user_id,
    coalesce(p.display_name, 'Player')::text,
    m.division,
    m.role,
    coalesce(m.total_points, 0),
    p.avatar_url::text,
    coalesce(m.is_bot, false)
  from public.memberships m
  left join public.profiles p on p.id = m.user_id
  where m.league_id = p_league_id
  order by coalesce(m.is_bot, false), p.display_name nulls last;
end;
$$;

grant execute on function public.get_league_roster(uuid) to authenticated;
notify pgrst, 'reload schema';

-- Quick count check (optional): how many bots in each league?
select l.name, count(*) filter (where m.is_bot) as bots,
       count(*) filter (where not m.is_bot) as humans
from public.memberships m
join public.leagues l on l.id = m.league_id
group by l.name;
