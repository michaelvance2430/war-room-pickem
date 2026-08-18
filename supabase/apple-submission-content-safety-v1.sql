-- Apple submission: server-enforced Locker content safety.
-- Client filtering provides immediate feedback; this trigger prevents API bypass.

create or replace function public.guard_locker_objectionable_content()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_body text;
begin
  -- System image and reaction markers contain no user-authored prose.
  if new.body like 'WR_IMG|%' or new.body like 'WR_RX|%' then return new; end if;
  v_body := ' ' || trim(regexp_replace(
    translate(lower(new.body), '0@1!|3 4 5$7+', 'ooiiie a sst'),
    '[^a-z]+', ' ', 'g'
  )) || ' ';
  if v_body like '% kill yourself %'
     or v_body like '% kys %'
     or v_body like '% go die %'
     or v_body like '% nigger %'
     or v_body like '% nigga %'
     or v_body like '% faggot %'
     or v_body like '% retard %' then
    raise exception 'locker_content_rejected' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_locker_objectionable_content() from public, anon, authenticated;

drop trigger if exists guard_locker_objectionable_content on public.locker_messages;
create trigger guard_locker_objectionable_content
before insert or update of body on public.locker_messages
for each row execute function public.guard_locker_objectionable_content();
