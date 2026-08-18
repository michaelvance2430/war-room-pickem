-- Account-deletion production foundation verification.
-- SELECT ONLY. Safe to rerun after future schema changes.

with rls_tables as (
  select n.nspname schema_name, c.relname table_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relrowsecurity
),
active_policies as (
  select schemaname schema_name, tablename table_name
  from pg_policies
  where schemaname = 'public'
    and policyname = 'Active accounts only'
),
rpc_acl as (
  select p.proname,
    has_function_privilege('anon', p.oid, 'execute') anon_execute,
    has_function_privilege('authenticated', p.oid, 'execute') authenticated_execute,
    has_function_privilege('service_role', p.oid, 'execute') service_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'begin_account_deletion', 'redact_account_data',
      'complete_account_deletion', 'fail_account_deletion'
    )
)
select jsonb_build_object(
  'profilesAuthFkExists', exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_id_fkey'
  ),
  'nonActiveProfiles', (
    select count(*) from public.profiles where account_state <> 'active'
  ),
  'rlsTableCount', (select count(*) from rls_tables),
  'activePolicyCount', (select count(*) from active_policies),
  'missingActivePolicies', coalesce((
    select jsonb_agg(r.table_name order by r.table_name)
    from rls_tables r
    left join active_policies a using (schema_name, table_name)
    where a.table_name is null
  ), '[]'::jsonb),
  'postseasonConstraints', (
    select jsonb_object_agg(conrelid::regclass::text, pg_get_constraintdef(oid, true))
    from pg_constraint
    where conname in (
      'cfb_postseason_entries_user_id_fkey',
      'postseason_scorecards_user_id_fkey'
    )
  ),
  'rpcAcl', (select jsonb_agg(to_jsonb(rpc_acl) order by proname) from rpc_acl)
) as account_deletion_foundation;
