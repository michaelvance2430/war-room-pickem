begin;

alter table public.leagues
  drop constraint if exists leagues_championship_trophy_id_check;

alter table public.leagues
  add constraint leagues_championship_trophy_id_check
  check (
    championship_trophy_id is null
    or championship_trophy_id = any (array[
      'command_cup'::text,
      'golden_gut'::text,
      'the_receipt'::text,
      'insufferable_crown'::text,
      'brass_football'::text,
      'last_one_standing'::text,
      'nfl_sunday_scepter'::text,
      'nfl_gridiron_crown'::text,
      'nfl_fourth_down_forge'::text,
      'nfl_two_minute_monument'::text,
      'nfl_iron_end_zone'::text,
      'nfl_final_whistle'::text
    ])
  );

update public.leagues
set championship_trophy_id = 'nfl_sunday_scepter'
where lower(sport_id) = 'nfl'
  and mode = 'foundry'
  and championship_trophy_id in ('command_cup', 'golden_gut', 'the_receipt', 'insufferable_crown', 'brass_football', 'last_one_standing');

commit;
