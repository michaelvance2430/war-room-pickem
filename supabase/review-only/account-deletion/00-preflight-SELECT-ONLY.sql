-- War Room account deletion: production dependency inventory.
-- SELECT ONLY. Safe to run against production. This file changes nothing.

-- 1. Every foreign key that can participate in an Auth/profile/league cascade.
select
  src_ns.nspname as source_schema,
  src.relname as source_table,
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid, true) as definition,
  dst_ns.nspname as target_schema,
  dst.relname as target_table
from pg_constraint con
join pg_class src on src.oid = con.conrelid
join pg_namespace src_ns on src_ns.oid = src.relnamespace
join pg_class dst on dst.oid = con.confrelid
join pg_namespace dst_ns on dst_ns.oid = dst.relnamespace
where con.contype = 'f'
  and (
    (dst_ns.nspname = 'auth' and dst.relname = 'users')
    or (dst_ns.nspname = 'public' and dst.relname in ('profiles', 'leagues'))
  )
order by target_schema, target_table, source_schema, source_table, constraint_name;

-- 2. Identity-shaped columns, including columns that lack a foreign key.
select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema in ('public', 'storage')
  and (
    column_name in (
      'id', 'user_id', 'profile_id', 'player_id', 'author_id', 'created_by',
      'updated_by', 'commissioner_id', 'owner_id', 'owner', 'owner_id',
      'reported_by', 'blocked_user_id', 'blocker_id', 'finder_user_id',
      'winner_user_id', 'actor_user_id', 'crowned_by', 'repaired_by',
      'corrected_by'
    )
    or column_name like '%user_id'
    or column_name like '%profile_id'
    or column_name like '%player_id'
  )
order by table_schema, table_name, ordinal_position;

-- 3. Profile columns that must be classified as preserve, redact, or delete.
select
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
order by ordinal_position;

-- 4. Storage buckets and per-user object-path counts.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

select
  bucket_id,
  split_part(name, '/', 1) as first_path_segment,
  split_part(name, '/', 2) as second_path_segment,
  count(*) as object_count
from storage.objects
group by bucket_id, split_part(name, '/', 1), split_part(name, '/', 2)
order by bucket_id, object_count desc, first_path_segment, second_path_segment;

-- 5. Commissioner-owned rooms block deletion until Pass the Keys succeeds.
select
  commissioner_id,
  count(*) as owned_room_count,
  array_agg(id order by created_at) as owned_room_ids
from public.leagues
group by commissioner_id
order by owned_room_count desc, commissioner_id;

-- 6. Policies and functions whose authorization depends on auth.uid().
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
  and (coalesce(qual, '') like '%auth.uid%'
    or coalesce(with_check, '') like '%auth.uid%')
order by schemaname, tablename, policyname;

select
  n.nspname as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and pg_get_functiondef(p.oid) like '%auth.uid%'
order by function_schema, function_name, arguments;

