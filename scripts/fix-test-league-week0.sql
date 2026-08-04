update public.leagues
set current_week = 0
where id = '688ef992-082c-4599-a564-f08036c877fb'
  and code = '7AWX8T'
  and sport_id = 'cfb'
  and current_week = 1
  and not exists (
    select 1
    from public.week_cards
    where league_id = '688ef992-082c-4599-a564-f08036c877fb'
  );
