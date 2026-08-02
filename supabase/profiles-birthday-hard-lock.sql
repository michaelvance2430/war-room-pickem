-- Birthday hard lock — one-time MM-DD on profiles.
-- Run once in Supabase SQL Editor (prod + any staging).

alter table public.profiles
  add column if not exists birthday_mmdd text;

alter table public.profiles
  add column if not exists birthday_locked_at timestamptz;

comment on column public.profiles.birthday_mmdd is
  'Private MM-DD birthday. Hard-locked after first save; no self-serve edit.';

comment on column public.profiles.birthday_locked_at is
  'When birthday_mmdd was first locked. Null until saved.';

-- Soft check: only MM-DD or null
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_birthday_mmdd_format'
  ) then
    alter table public.profiles
      add constraint profiles_birthday_mmdd_format
      check (
        birthday_mmdd is null
        or birthday_mmdd ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      );
  end if;
exception
  when others then null;
end $$;

-- Block self-serve changes once locked (ops can still fix via SQL / service role)
create or replace function public.profiles_birthday_hard_lock()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if old.birthday_mmdd is not null
       and old.birthday_mmdd <> ''
       and (
         new.birthday_mmdd is distinct from old.birthday_mmdd
         or new.birthday_locked_at is distinct from old.birthday_locked_at
       ) then
      -- Allow service role / superuser paths that set app.bypass_birthday_lock
      if coalesce(current_setting('app.bypass_birthday_lock', true), '') = '1' then
        return new;
      end if;
      raise exception 'birthday is hard-locked — contact War Room support to correct'
        using errcode = 'P0001';
    end if;
    -- First write: stamp locked_at
    if (old.birthday_mmdd is null or old.birthday_mmdd = '')
       and new.birthday_mmdd is not null
       and new.birthday_mmdd <> '' then
      new.birthday_locked_at := coalesce(new.birthday_locked_at, now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_birthday_hard_lock_trg on public.profiles;
create trigger profiles_birthday_hard_lock_trg
  before update on public.profiles
  for each row
  execute function public.profiles_birthday_hard_lock();
