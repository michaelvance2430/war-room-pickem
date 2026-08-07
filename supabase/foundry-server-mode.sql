-- Foundry server authority: production is the default and only explicit
-- commissioner updates may mark a room as disposable Foundry data.

alter table public.leagues
  add column if not exists mode text not null default 'production';

alter table public.leagues
  drop constraint if exists leagues_mode_check;

alter table public.leagues
  add constraint leagues_mode_check
  check (mode in ('production', 'foundry'));

comment on column public.leagues.mode is
  'Server-authoritative career-integrity mode. Production is reality; foundry is disposable LAB data.';

