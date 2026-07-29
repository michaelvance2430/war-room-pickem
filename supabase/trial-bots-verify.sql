-- Verify + fix trial bot functions after a successful create
-- 1) List functions
select n.nspname as schema, p.proname as name,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('seed_trial_bots', 'clear_trial_bots', 'seed_bot_picks_for_week');

-- 2) Re-grant (in case grants failed)
grant execute on function public.seed_trial_bots(uuid, int) to authenticated;
grant execute on function public.seed_trial_bots(uuid, int) to service_role;
grant execute on function public.clear_trial_bots(uuid) to authenticated;
grant execute on function public.clear_trial_bots(uuid) to service_role;
grant execute on function public.seed_bot_picks_for_week(uuid, int) to authenticated;
grant execute on function public.seed_bot_picks_for_week(uuid, int) to service_role;

-- 3) Force PostgREST to reload schema cache (so the website sees the functions)
notify pgrst, 'reload schema';
