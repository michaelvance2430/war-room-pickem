-- Crystal Ball is a permanent War Room rule, not a commissioner option.
update public.leagues
set crystal_ball_enabled = true
where crystal_ball_enabled is distinct from true;

alter table public.leagues
  alter column crystal_ball_enabled set default true,
  alter column crystal_ball_enabled set not null;

create or replace function public.enforce_required_crystal_ball()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.crystal_ball_enabled := true;
  return new;
end;
$$;

drop trigger if exists leagues_require_crystal_ball on public.leagues;
create trigger leagues_require_crystal_ball
before insert or update of crystal_ball_enabled on public.leagues
for each row execute function public.enforce_required_crystal_ball();
