-- BUILD 21 REVIEW ONLY. Service-only authorization for the autonomous
-- Fieldhouse tournament worker. The raw secret remains inside Supabase Vault.

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'war_room_fieldhouse_cron_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'war_room_fieldhouse_cron_secret',
      'Authorizes the autonomous Fieldhouse tournament results worker'
    );
  end if;
end;
$$;

create or replace function public.authorize_fieldhouse_tournament_worker(
  p_secret text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from vault.decrypted_secrets secret
    where secret.name = 'war_room_fieldhouse_cron_secret'
      and length(coalesce(p_secret, '')) = 64
      and secret.decrypted_secret = p_secret
  );
$$;

revoke all on function public.authorize_fieldhouse_tournament_worker(text)
  from public, anon, authenticated;
grant execute on function public.authorize_fieldhouse_tournament_worker(text)
  to service_role;

notify pgrst, 'reload schema';
