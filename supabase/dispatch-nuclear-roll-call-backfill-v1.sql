-- Re-file the four Week 0 editions created before Nuclear roll-call support.
-- Each row was verified to have exactly five certified game results.

update public.week_results wr
set scored_at = wr.scored_at
where wr.id in (
  'c5912332-294c-4565-8081-f1852cd1ca03',
  '05abcfa1-0eee-42be-886b-8d7903cb339a',
  '3048573d-4dd0-4e14-9852-66f073503057',
  '7a91a1cf-7e0f-4a9e-ba9a-f97970ec441f'
)
and wr.week_number = 0
and (select count(*) from public.game_results gr where gr.week_result_id = wr.id) = 5;
