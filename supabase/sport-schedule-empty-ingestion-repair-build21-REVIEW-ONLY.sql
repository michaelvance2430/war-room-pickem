-- BUILD 21 REVIEW ONLY. One-time cleanup for the first guarded manual
-- schedule run, which recorded empty future scans as ingestions. An empty scan
-- is already preserved in the usage ledger; it must not freeze an estimated
-- card window against later provider verification.

begin;

update public.sport_card_windows
set
  last_ingested_at = null,
  updated_at = now()
where last_ingested_at is not null
  and provider_event_count = 0
  and timing_status = 'estimated';

commit;
