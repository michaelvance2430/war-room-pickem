-- =============================================================================
-- League sport immutability (defense in depth)
-- =============================================================================
-- PRODUCT LAW: leagues.sport_id is set only on INSERT. After creation it cannot
-- change via client, commissioner, service role, RPC, or future app bugs.
--
-- APPLY ONLY after:
--   1) Application hardening is deployed (create = INSERT with sport; no write-on-read)
--   2) Mike / ChatGPT review this migration
--   3) Production has no intentional sport-conversion product
--
-- DO NOT apply automatically from CI or app boot.
-- =============================================================================

create or replace function public.leagues_sport_id_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.sport_id is distinct from old.sport_id then
    raise exception 'League sport is immutable after creation.'
      using errcode = 'check_violation',
            hint = 'sport_id may only be set on INSERT. Intentional conversion requires a separate product migration.';
  end if;
  return new;
end;
$$;

comment on function public.leagues_sport_id_immutable() is
  'Rejects any UPDATE that changes leagues.sport_id. INSERT is unrestricted.';

drop trigger if exists leagues_sport_id_immutable_trg on public.leagues;

create trigger leagues_sport_id_immutable_trg
  before update on public.leagues
  for each row
  execute function public.leagues_sport_id_immutable();

-- Optional self-check (safe; does not change rows):
-- select tgname from pg_trigger where tgname = 'leagues_sport_id_immutable_trg';
