-- War Room: allow highest week through CFP Final (app week 18+)
-- Supabase → SQL Editor → paste ALL of this → Run
-- Project must be the same as the app: dorhjepugsjpmnuzdzck

-- 1) Drop ANY check constraint on regular_season_weeks (name can vary)
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'leagues'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%regular_season_weeks%'
  loop
    execute format('alter table public.leagues drop constraint %I', r.conname);
    raise notice 'Dropped constraint: %', r.conname;
  end loop;
end $$;

-- 2) New limit: 4–24
alter table public.leagues
  add constraint leagues_regular_season_weeks_check
  check (regular_season_weeks between 4 and 24);

-- 3) Verify (you should see between 4 and 24)
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.leagues'::regclass
  and contype = 'c'
  and pg_get_constraintdef(oid) ilike '%regular_season_weeks%';
