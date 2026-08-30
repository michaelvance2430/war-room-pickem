-- Repair official weeks scored before file_dispatch_after_scoring existed.
-- The no-op update intentionally replays the existing deferred, idempotent
-- Dispatch trigger without changing any certified result.

update public.week_results wr
set scored_at = wr.scored_at
where wr.id = 'c5912332-294c-4565-8081-f1852cd1ca03'
  and wr.league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
  and wr.week_number = 0
  and (select count(*) from public.game_results gr where gr.week_result_id = wr.id) = 5
  and not exists (
  select 1
  from public.gazette_editions ge
  where ge.league_id = wr.league_id
    and ge.week_number = wr.week_number
);
