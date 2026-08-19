-- Native app-open Easter Eggs. Server time and authenticated UUID are the only
-- authority; the client cannot name the discovery it wants to receive.
create schema if not exists private;

create table if not exists private.account_open_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  opened_on date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, opened_on)
);

revoke all on private.account_open_days from public, anon, authenticated;

create or replace function public.record_native_app_open()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := timezone('America/New_York', now())::date;
  v_profile public.profiles%rowtype;
  v_streak integer := 0;
  v_years integer := 0;
  v_tribute_day integer;
  v_awarded text[] := '{}';
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'Profile required'; end if;

  insert into private.account_open_days(user_id, opened_on)
  values(v_uid, v_today) on conflict do nothing;

  with ordered as (
    select opened_on, row_number() over(order by opened_on desc)::integer rn
    from private.account_open_days where user_id = v_uid and opened_on <= v_today
  )
  select count(*)::integer into v_streak
  from ordered where opened_on = v_today - (rn - 1);

  v_years := extract(year from age(v_today, v_profile.created_at::date))::integer;
  v_tribute_day := 40 + ((extract(year from v_today)::integer * 47) % 280);

  with eligible(code, earned) as (
    values
      ('egg_leap_day', extract(month from v_today)=2 and extract(day from v_today)=29),
      ('egg_halloween', extract(month from v_today)=10 and extract(day from v_today)=31),
      ('egg_christmas', extract(month from v_today)=12 and extract(day from v_today)=25),
      ('egg_thanksgiving', extract(month from v_today)=11 and extract(dow from v_today)=4 and extract(day from v_today) between 22 and 28),
      ('egg_newyear', extract(month from v_today)=1 and extract(day from v_today)=1),
      ('egg_birthday', v_profile.birthday_mmdd = to_char(v_today, 'MM-DD')),
      ('egg_anniversary', v_years >= 1 and to_char(v_profile.created_at, 'MM-DD') = to_char(v_today, 'MM-DD')),
      ('egg_veterans', v_years >= 5 and v_years < 10 and v_years % 5 = 0 and to_char(v_profile.created_at, 'MM-DD') = to_char(v_today, 'MM-DD')),
      ('egg_welcome_home', v_years >= 10),
      ('egg_obsession', v_streak >= 365),
      ('egg_developer_thanks', extract(doy from v_today)::integer = v_tribute_day)
  ), inserted as (
    insert into public.easter_egg_finds(user_id, discovery_id, found_at)
    select v_uid, e.code, now() from eligible e
    join public.easter_egg_catalog c on c.discovery_id=e.code and c.is_active
    where e.earned
    on conflict(user_id, discovery_id) do nothing
    returning discovery_id
  )
  select coalesce(array_agg(discovery_id), '{}') into v_awarded from inserted;

  return jsonb_build_object('ok', true, 'openedOn', v_today, 'streak', v_streak, 'awarded', to_jsonb(v_awarded));
end;
$$;

revoke execute on function public.record_native_app_open() from public, anon;
grant execute on function public.record_native_app_open() to authenticated;
