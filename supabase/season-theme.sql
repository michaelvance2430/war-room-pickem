-- ============================================================
-- League season / holiday background theme
-- Run once in Supabase → SQL Editor → Run
-- ============================================================

alter table public.leagues
  add column if not exists season_theme_id text not null default 'default';

comment on column public.leagues.season_theme_id is
  'App background theme: default | halloween | thanksgiving | christmas | newyear';

notify pgrst, 'reload schema';
