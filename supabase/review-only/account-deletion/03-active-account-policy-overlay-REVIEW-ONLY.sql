-- Fail closed for valid-but-revoked JWTs after account deletion begins.
-- REVIEW ONLY. Apply to disposable branches before production consideration.

do $$
declare
  v_table record;
begin
  for v_table in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      'Active accounts only',
      v_table.schema_name,
      v_table.table_name
    );
    execute format(
      'create policy %I on %I.%I as restrictive for all to authenticated using ((select private.is_active_account())) with check ((select private.is_active_account()))',
      'Active accounts only',
      v_table.schema_name,
      v_table.table_name
    );
  end loop;
end;
$$;

-- Storage is outside public but still accepts the same JWT. Existing bucket
-- policies remain; this restrictive policy is an additional mandatory gate.
drop policy if exists "Active accounts only" on storage.objects;
create policy "Active accounts only"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using ((select private.is_active_account()))
  with check ((select private.is_active_account()));

