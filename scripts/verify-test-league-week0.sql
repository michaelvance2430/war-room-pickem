select id, name, code, sport_id, current_week
from public.leagues
where id = '688ef992-082c-4599-a564-f08036c877fb';

select count(*) as week_card_count
from public.week_cards
where league_id = '688ef992-082c-4599-a564-f08036c877fb';

select id, name, code, sport_id, current_week
from public.leagues
where code = 'L76VW3';
