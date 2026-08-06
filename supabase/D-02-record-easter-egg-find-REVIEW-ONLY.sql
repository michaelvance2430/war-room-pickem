-- =============================================================================
-- D-02 — record_easter_egg_find integrity harden — REVIEW ONLY
-- =============================================================================
-- APPLIED 2026-08-06 (operator SQL Editor). Structural post-verify PASS.
-- Status: LIVE / STRUCTURALLY VERIFIED / BEHAVIORAL TESTS PENDING
-- Archive: docs/D-02-APPLY-VERIFICATION.md
-- Behavioral: disposable identity only; not claimed passed.
--
-- Historical: required Mike explicit authorization for D-02 AFTER preflight review.
-- Design: docs/D-02-RECORD-EASTER-EGG-FIND-REMEDIATION.md
-- Preflight: supabase/D-02-preflight-SELECT-ONLY.sql
-- Evidence: P17 DEFECT 2 · STRUCTURAL-SECURITY-DEFECT-REGISTER D-02
--
-- Product decisions APPROVED: P1 catalog table · P2 RPC-only insert · P3 no
-- historical delete in this apply · P4 milestones 7/10/full · P5 keep signature
-- (deprecated untrusted args) · P6 dual catalog + parity · P7 SQL then app.
--
-- SCOPE:
--   1) Server-owned easter_egg_catalog + seed of exactly 20 canonical egg_* ids
--   2) Catalog: RLS on; authenticated SELECT optional; NO client INSERT/UPDATE/DELETE
--   3) Replace record_easter_egg_find body (signature kept for compatibility):
--        - p_player_name, p_total_eggs DEPRECATED — ignored for trust
--        - auth required; self-only (auth.uid())
--        - validate discovery_id against catalog (active)
--        - name from profiles.display_name
--        - total + milestones [7,10,full] from server catalog
--        - found counts only catalog ids (invalid historical rows left in place)
--        - idempotent finds + flexes
--   4) REVOKE EXECUTE from PUBLIC + anon; GRANT authenticated
--   5) Drop client INSERT policy on easter_egg_finds (RPC-only writes)
--
-- DOES NOT: delete easter_egg_finds / flex history · D-01 · D-03 · D1B/D1C · app code
-- =============================================================================

begin;

-- ── 1. Server catalog ───────────────────────────────────────────────────────
create table if not exists public.easter_egg_catalog (
  discovery_id text primary key,
  is_active boolean not null default true,
  sort_order int not null default 0
);

comment on table public.easter_egg_catalog is
  'D-02: Server-owned allowlist of true Easter Egg discovery ids (not passport stamps).';

-- Seed canonical ids from src/lib/easter-eggs.ts listEasterEggDefs() (2026-08-06)
insert into public.easter_egg_catalog (discovery_id, is_active, sort_order) values
  ('egg_anniversary', true, 1),
  ('egg_curiosity_trophy', true, 2),
  ('egg_vonnaggio_gold', true, 3),
  ('egg_hidden_headline', true, 4),
  ('egg_leap_day', true, 5),
  ('egg_birthday', true, 6),
  ('egg_sibling_supremacy', true, 7),
  ('egg_lucky_seven', true, 8),
  ('egg_obsession', true, 9),
  ('egg_halloween', true, 10),
  ('egg_christmas', true, 11),
  ('egg_thanksgiving', true, 12),
  ('egg_newyear', true, 13),
  ('egg_three_peat', true, 14),
  ('egg_never_give_up', true, 15),
  ('egg_developer_thanks', true, 16),
  ('egg_impossible', true, 17),
  ('egg_mascot_scout', true, 18),
  ('egg_veterans', true, 19),
  ('egg_welcome_home', true, 20)
on conflict (discovery_id) do update
  set is_active = excluded.is_active,
      sort_order = excluded.sort_order;

alter table public.easter_egg_catalog enable row level security;

-- Authenticated read OK (ids are not a huge spoiler vs full flavor text; product may tighten later)
drop policy if exists "egg_catalog_select_authenticated" on public.easter_egg_catalog;
create policy "egg_catalog_select_authenticated"
  on public.easter_egg_catalog for select to authenticated
  using (true);

-- No client INSERT/UPDATE/DELETE policies (service/SQL only)

-- ── 2. RPC-only writes: remove direct client insert bypass ──────────────────
drop policy if exists "egg_finds_insert_self" on public.easter_egg_finds;

-- ── 3. Hardened function (signature preserved for app compatibility) ────────
-- Signature preserved for PostgREST/app compatibility.
-- DEPRECATED parameters (ignored; do not trust):
--   p_player_name  — use profiles.display_name
--   p_total_eggs   — use count(*) from easter_egg_catalog where is_active
create or replace function public.record_easter_egg_find(
  p_discovery_id text,
  p_player_name text,   -- DEPRECATED untrusted
  p_total_eggs int      -- DEPRECATED untrusted
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id text;
  v_found int := 0;
  v_total int := 0;
  v_milestone int;
  v_name text;
  v_flexed int := 0;
  v_inserted boolean := false;
  v_row_count int;
begin
  -- Intentionally unused (deprecated untrusted client input)
  perform p_player_name, p_total_eggs;

  if v_uid is null then
    return json_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  v_id := nullif(trim(coalesce(p_discovery_id, '')), '');
  if v_id is null then
    return json_build_object('ok', false, 'error', 'Missing discovery');
  end if;

  -- Server allowlist only (rejects egg_fake, stamps, empty, etc.)
  if not exists (
    select 1
    from public.easter_egg_catalog c
    where c.discovery_id = v_id
      and c.is_active = true
  ) then
    return json_build_object('ok', false, 'error', 'Unknown discovery');
  end if;

  select count(*)::int into v_total
  from public.easter_egg_catalog
  where is_active = true;

  if v_total < 1 then
    return json_build_object('ok', false, 'error', 'Catalog empty');
  end if;

  -- Trusted display name from profile (never caller p_player_name)
  select coalesce(nullif(trim(p.display_name), ''), 'A player')
    into v_name
  from public.profiles p
  where p.id = v_uid;

  if v_name is null then
    v_name := 'A player';
  end if;

  insert into public.easter_egg_finds (user_id, discovery_id, found_at)
  values (v_uid, v_id, now())
  on conflict (user_id, discovery_id) do nothing;
  get diagnostics v_row_count = row_count;
  v_inserted := v_row_count > 0;

  -- Count only catalog-valid finds (ignore historical junk egg_% rows)
  select count(*)::int into v_found
  from public.easter_egg_finds f
  join public.easter_egg_catalog c
    on c.discovery_id = f.discovery_id
   and c.is_active = true
  where f.user_id = v_uid;

  -- Milestones: 7, 10, full catalog (server total)
  foreach v_milestone in array array[7, 10, v_total]
  loop
    if v_found >= v_milestone then
      begin
        insert into public.egg_milestone_flexes (
          finder_user_id, finder_name, found, total, milestone
        )
        values (
          v_uid, v_name, v_found, v_total, v_milestone
        )
        on conflict (finder_user_id, milestone) do nothing;
        get diagnostics v_row_count = row_count;
        if v_row_count > 0 then
          v_flexed := v_flexed + 1;
        end if;
      exception
        when others then
          begin
            insert into public.egg_milestone_flexes (
              finder_user_id, finder_name, found, total, milestone
            )
            values (
              v_uid, v_name, v_found, v_total, v_milestone
            )
            on conflict on constraint egg_flex_once_per_milestone_global do nothing;
            get diagnostics v_row_count = row_count;
            if v_row_count > 0 then
              v_flexed := v_flexed + 1;
            end if;
          exception
            when others then
              null;
          end;
      end;
    end if;
  end loop;

  return json_build_object(
    'ok', true,
    'newFind', v_inserted,
    'found', v_found,
    'total', v_total,
    'flexesInserted', v_flexed
  );
end;
$$;

comment on function public.record_easter_egg_find(text, text, int) is
  'D-02: Record self egg find against server catalog; profile name; server total/milestones. Ignores untrusted p_player_name/p_total_eggs.';

revoke all on function public.record_easter_egg_find(text, text, int) from public;
revoke all on function public.record_easter_egg_find(text, text, int) from anon;
grant execute on function public.record_easter_egg_find(text, text, int) to authenticated;

commit;

notify pgrst, 'reload schema';

-- =============================================================================
-- PREFLIGHT (SELECT only — run before apply)
-- =============================================================================
-- SELECT pg_get_functiondef(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'record_easter_egg_find';
--
-- SELECT grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public' AND routine_name = 'record_easter_egg_find'
--   AND privilege_type = 'EXECUTE' ORDER BY grantee;
--
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'easter_egg_finds';
--
-- SELECT to_regclass('public.easter_egg_catalog');

-- =============================================================================
-- POST-VERIFY (SELECT only — run after apply)
-- =============================================================================
-- SELECT discovery_id FROM public.easter_egg_catalog WHERE is_active ORDER BY sort_order;
-- -- Expect 20 rows matching design list
--
-- SELECT pg_get_functiondef(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'record_easter_egg_find';
-- -- Expect: easter_egg_catalog, profiles.display_name, no trust of p_total_eggs
--
-- SELECT grantee FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public' AND routine_name = 'record_easter_egg_find'
--   AND privilege_type = 'EXECUTE' ORDER BY grantee;
-- -- Expect: no anon/PUBLIC
--
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'easter_egg_finds';
-- -- Expect: no egg_finds_insert_self

-- =============================================================================
-- EMERGENCY ROLLBACK (reopens fabrication — prefer fix-forward)
-- =============================================================================
-- Restore body + grants from supabase/easter-eggs.sql / FIX-EASTER-EGG-FINDS.sql
-- Recreate policy egg_finds_insert_self if dropped.
-- Catalog table may remain.

-- END D-02 REVIEW-ONLY
