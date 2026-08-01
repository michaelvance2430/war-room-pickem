-- ============================================================
-- Division / conference titles in league_trophies
-- CFB: SEC, Big Ten, ACC, Big 12 · NFL: AFC/NFC East–West
-- Run once in Supabase → SQL Editor
-- ============================================================

alter table public.league_trophies
  drop constraint if exists league_trophies_trophy_type_check;

alter table public.league_trophies
  add constraint league_trophies_trophy_type_check
  check (
    trophy_type in (
      'championship',
      'toilet_bowl',
      'crystal_ball',
      'division_north',
      'division_south',
      'division_east',
      'division_west'
    )
  );

notify pgrst, 'reload schema';
