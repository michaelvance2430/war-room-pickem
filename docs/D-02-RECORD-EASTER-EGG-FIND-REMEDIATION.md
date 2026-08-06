# D-02 — `record_easter_egg_find` remediation design

**Status:** REVIEW ONLY — **not authorized to apply** · **not claimed repaired**  
**Defect:** STRUCTURAL-SECURITY-DEFECT-REGISTER **D-02** · P17 Block 2  
**Severity:** Medium–High (integrity / fabricated discoveries & milestone newspapers)

---

## 1. Findings and call-site map

### 1.1 RPC call sites (app)

| Location | Role |
|----------|------|
| `src/lib/egg-cloud.ts` → `syncEasterEggFindToCloud` | **Only** PostgREST RPC call to `record_easter_egg_find` |
| `src/lib/easter-eggs.ts` → `grantDiscovery` | Local grant; if `discoveryId.startsWith("egg_")`, async calls `syncEasterEggFindToCloud` |

**RPC arguments today:**

```ts
supabase.rpc("record_easter_egg_find", {
  p_discovery_id: discoveryId,
  p_player_name: playerName || "A player",  // from getSession()?.playerName
  p_total_eggs: listEasterEggDefs().length, // client catalog length
});
```

**Fallback path (integrity risk independent of RPC):** if RPC errors, client may `upsert` into `easter_egg_finds` with only RLS `user_id = auth.uid()` — **any** `discovery_id` string allowed by RLS.

### 1.2 Indirect grant paths (local → cloud)

All legitimate cloud finds flow through `grantDiscovery` → only known `DISCOVERY_CATALOG` ids (local def required). Client-side already rejects unknown ids **for local grant**, but the **RPC itself** does not validate the catalog (attacker can call RPC directly).

Triggers that call `grantDiscovery` for real eggs (examples): holidays, birthday, anniversary, trophy multi-tap, lucky seven, acrostic, etc. — all in `src/lib/easter-eggs.ts` + UI hosts.

| Component / lib | Notes |
|-----------------|--------|
| `EasterEggHost.tsx` | Session open / noteAppOpen |
| `EasterEggTracker.tsx` | Progress UI (`found / xx`) |
| `EggFlexNewspaper.tsx` | Platform-wide flex display |
| Passport stamps (`stamp_*`) | Local only via `grantDiscovery`; **not** synced to cloud (`egg_` prefix gate) |

### 1.3 Canonical catalog (app — source of product truth today)

**File:** `src/lib/easter-eggs.ts` → `DISCOVERY_CATALOG`

| Class | Filter | Count (repo) | Cloud sync? |
|-------|--------|--------------|-------------|
| True Easter eggs | `kind !== "passport"` and `id.startsWith("egg_")` via `listEasterEggDefs()` | **20** | Yes (RPC) |
| Passport stamps | `stamp_cfb_season`, `stamp_nfl_season`, `stamp_wwc` | 3 | **No** (not `egg_`) |

**Canonical `egg_*` IDs (repo catalog):**

1. `egg_anniversary`  
2. `egg_curiosity_trophy`  
3. `egg_vonnaggio_gold`  
4. `egg_hidden_headline`  
5. `egg_leap_day`  
6. `egg_birthday`  
7. `egg_sibling_supremacy`  
8. `egg_lucky_seven`  
9. `egg_obsession`  
10. `egg_halloween`  
11. `egg_christmas`  
12. `egg_thanksgiving`  
13. `egg_newyear`  
14. `egg_three_peat`  
15. `egg_never_give_up`  
16. `egg_developer_thanks`  
17. `egg_impossible`  
18. `egg_mascot_scout`  
19. `egg_veterans`  
20. `egg_welcome_home`  

**There is no server-side catalog table today.** Server only checks `p_discovery_id like 'egg_%'`.

### 1.4 Legitimate total

| Layer | How total is established |
|-------|---------------------------|
| App UI / RPC arg | `listEasterEggDefs().length` → **20** in current repo |
| Live / repo SQL | `greatest(1, coalesce(p_total_eggs, 19))` — default **19** (stale vs app) |
| Milestones | Hardcoded **7**, **10**, and **`v_total` (full)** in function body |

Product intent (comments): milestone flexes at 7 / 10 / full catalog; UI shows `"N / xx"` and deliberately **hides** total from players until full.

### 1.5 Authoritative display name

| Source | Trust |
|--------|--------|
| `profiles.display_name` | **Authoritative** for account identity |
| `getSession()?.playerName` (client) | Session/local — **not** trusted for flex newspaper |
| RPC `p_player_name` | **Attacker-controlled today** |

### 1.6 Tables, constraints, RLS, grants (repo)

#### `public.easter_egg_finds`

| Item | Definition |
|------|------------|
| PK | `(user_id, discovery_id)` → **idempotent** same user + same discovery |
| FK | `user_id → profiles(id)` |
| RLS | enabled |
| SELECT | `egg_finds_select_authenticated` — `using (true)` (any signed-in user) |
| INSERT | `egg_finds_insert_self` — `user_id = auth.uid()` only (**no ID allowlist**) |
| UPDATE/DELETE | none in repo |

#### `public.egg_milestone_flexes`

| Item | Definition |
|------|------------|
| Unique | `(finder_user_id, milestone)` — **one flex per user per milestone** |
| Columns | `finder_name`, `found`, `total`, `milestone` (name/total stored on flex row) |
| RLS SELECT | authenticated `using (true)` (platform-wide newspaper) |
| INSERT | **via SECURITY DEFINER RPC only** (no client insert policy in repo) |

#### `record_easter_egg_find(text, text, int)`

| Item | Live/repo behavior |
|------|---------------------|
| Auth | `auth.uid()` required (returns json error if null) |
| User binding | Always inserts as `v_uid` — **cannot record for another user** via this RPC |
| Discovery validation | Prefix `egg_%` only |
| Name | Trusts `p_player_name` |
| Total | Trusts `p_total_eggs` (default 19) |
| Found count | Counts all rows for user with `discovery_id like 'egg_%'` (**includes fakes** already inserted) |
| Grants (repo) | `REVOKE PUBLIC`; `GRANT authenticated` |
| Grants (P16/P17 live pattern) | Often **anon/PUBLIC** also present — preflight must re-check |

### 1.7 Tests

No automated test suite found for `record_easter_egg_find` / egg catalog integrity. Design §6 is the first formal matrix.

### 1.8 Compatibility impact (before signature change)

| Option | App break risk | Notes |
|--------|----------------|-------|
| **A. Keep signature** `(p_discovery_id, p_player_name, p_total_eggs)` but **ignore** name/total server-side | **Lowest** | Current `egg-cloud.ts` keeps working; params become no-ops |
| B. Drop name/total params | Medium | Requires coordinated app RPC args change |
| C. Add catalog table | None for RPC shape | App catalog must stay in sync (product process) |
| Remove client INSERT policy / fallback upsert | Low for happy path | Fallback soft-fails if RPC works; reduces bypass |

**Recommendation:** Option **A** for RPC + server catalog table + close direct-insert bypass.

---

## 2. Recommended design

### 2.1 Security / integrity rules

1. **Require authentication** (`auth.uid()` not null).  
2. **Self-only:** all writes use `auth.uid()` only (already true for RPC).  
3. **Allowlist:** `p_discovery_id` must exist in server-owned catalog of true eggs (`egg_*` only; no stamps).  
4. **Never trust** `p_player_name` — load `profiles.display_name` for `v_uid` (fallback `'A player'`).  
5. **Never trust** `p_total_eggs` — `v_total := count(*) from catalog` (active eggs).  
6. **Milestones:** server array `[7, 10, v_total]` with `v_total` derived; only fire when `v_found >= milestone`.  
7. **Idempotency:** keep `ON CONFLICT DO NOTHING` on finds PK and flex unique.  
8. **Found count:** count only discoveries present in the **catalog** (not arbitrary `egg_%` junk).  
9. **Grants:** `REVOKE` from `PUBLIC` and `anon`; `GRANT EXECUTE` to `authenticated` only.  
10. **Bypass:** remove or tighten `egg_finds_insert_self` so clients cannot insert non-catalog IDs (prefer **no direct INSERT** — RPC only).  

### 2.2 Server-owned catalog

**Preferred:** table `public.easter_egg_catalog`:

| Column | Purpose |
|--------|---------|
| `discovery_id text PRIMARY KEY` | Canonical id |
| `is_active boolean default true` | Soft-retire without breaking history |
| `sort_order int` | Optional |

Seed with the 20 repo `egg_*` ids. RPC validates `exists (select 1 from easter_egg_catalog where discovery_id = trim(p_discovery_id) and is_active)`.

**Alternative (lighter):** hard-coded `text[]` allowlist inside the function — no table, but dual-maintenance with app is worse over time.

### 2.3 Response shape (preserve UI)

Keep JSON keys used by app:

```json
{ "ok", "newFind", "found", "total", "flexesInserted" }
```

Optional additive: `"error"` on failure (already used for auth/missing).  
`total` becomes server catalog count (**20** with full seed), not client-supplied.

### 2.4 App follow-up (same release recommended, not required for RPC harden)

| Change | Why |
|--------|-----|
| Stop sending trusted semantics for name/total (can leave args for compat) | Clarity |
| Remove or gate **direct insert fallback** after RPC harden | Prevent bypass |
| Single source of truth process when adding eggs | Update `DISCOVERY_CATALOG` **and** seed SQL / catalog table |

App file proposals live in §4 (optional REVIEW-ONLY notes only — **no app edit until authorized**).

---

## 3. Exact affected files

### 3.1 This REVIEW-ONLY package (docs/SQL proposals)

| File | Action |
|------|--------|
| `docs/D-02-RECORD-EASTER-EGG-FIND-REMEDIATION.md` | This design |
| `supabase/D-02-record-easter-egg-find-REVIEW-ONLY.sql` | Proposed apply SQL |
| `docs/STRUCTURAL-SECURITY-DEFECT-REGISTER.md` | Point D-02 at design (status remains open) |

### 3.2 Production objects touched **only when Mike authorizes apply**

| Object | Change |
|--------|--------|
| `public.easter_egg_catalog` | CREATE + seed (if table approach) |
| `public.record_easter_egg_find(text,text,int)` | CREATE OR REPLACE body |
| EXECUTE grants on that function | REVOKE anon/PUBLIC; GRANT authenticated |
| `egg_finds_insert_self` policy | DROP (or replace with catalog check) — **product decision** |

### 3.3 Not touched

D-01, D-03, D1B, D1C, other functions, locker, leagues DELETE, postseason, app runtime (until separate auth).

---

## 4. REVIEW-ONLY SQL / app proposal

**SQL:** `supabase/D-02-record-easter-egg-find-REVIEW-ONLY.sql`  

**Do not run** without Mike authorization for D-02.

### App (optional, separate authorization)

| File | Proposal |
|------|----------|
| `src/lib/egg-cloud.ts` | After RPC is trusted: remove upsert fallback **or** only upsert when id ∈ client catalog (still weaker than server) |
| `src/lib/easter-eggs.ts` | No required change if signature preserved |

---

## 5. Test plan

### Preflight (SELECT only)

- Function def + args  
- EXECUTE grantees  
- Catalog table present/absent  
- Policies on `easter_egg_finds`  
- Count of live `egg_%` finds not in catalog (orphan fakes)

### Behavioral (use **test accounts** only; do not fabricate flex noise on real community if avoidable — prefer disposable users)

| # | Scenario | Expected |
|---|----------|----------|
| T1 | Anonymous / no JWT | `ok: false` or permission denied; zero rows |
| T2 | Auth + `egg_not_in_catalog` / `egg_fake_xyz` | Reject; zero insert |
| T3 | Auth + `stamp_cfb_season` | Reject (not catalog egg) |
| T4 | Auth + valid `egg_lucky_seven` first time | `newFind: true`; row exists; name from profile |
| T5 | Auth + same id again | `newFind: false`; no second row; flexes not duplicated |
| T6 | Spoof `p_player_name = 'Bill Gates'` | Flex/name uses **profile** display_name, not spoof |
| T7 | Spoof `p_total_eggs = 1` | Milestones still 7/10/**catalog total**; cannot force full at 1 |
| T8 | Spoof `p_total_eggs = 999` | `total` in response = catalog size; no milestone 999 |
| T9 | Direct `insert` into `easter_egg_finds` with fake id | Denied after policy tightens |
| T10 | Cannot pass another `user_id` via RPC | N/A — no param; always auth.uid() |
| T11 | Reach found=7 with valid eggs only | Flex milestone 7 once |
| T12 | found=10 | Flex 10 once |
| T13 | found = catalog total | Flex full once |
| T14 | EXECUTE as anon | Denied after REVOKE |
| T15 | Collateral | Other functions/grants unchanged |

### Post-verify (SELECT)

Body contains catalog check + `profiles.display_name`; grants lack anon/PUBLIC.

---

## 6. Product decisions Mike must make before authorization

| # | Decision | Recommendation |
|---|----------|----------------|
| **P1** | Catalog storage: **table** vs hard-coded array in function | **Table** `easter_egg_catalog` + seed 20 ids |
| **P2** | Close client INSERT policy on `easter_egg_finds`? | **Yes** — RPC-only writes (DEFINER) so allowlist cannot be bypassed |
| **P3** | What to do with **existing** rows where `discovery_id` not in catalog? | Leave in place (no mass delete); stop counting them toward `found` / milestones |
| **P4** | Milestone thresholds stay **7 / 10 / full**? | **Yes** (product law in code comments) |
| **P5** | Keep RPC signature (ignore unused args) vs breaking change | **Keep signature** for zero coordinated app deploy |
| **P6** | Who may add new eggs later? | Require dual update: app `DISCOVERY_CATALOG` + catalog seed migration |
| **P7** | Apply SQL alone vs SQL + remove client fallback same release | Prefer **SQL first**; app fallback removal immediately after |

---

## 7. Rollback

1. Restore function body from `supabase/easter-eggs.sql` / `FIX-EASTER-EGG-FINDS.sql` (vulnerable).  
2. Recreate `egg_finds_insert_self` if dropped.  
3. Catalog table may remain (harmless) or drop if unused.  
4. Re-grant EXECUTE as before.  

**Warning:** Rollback reopens fabrication. Prefer fix-forward.

---

## 8. Authorization gate

| Item | Status |
|------|--------|
| Design | This document |
| SQL proposal | `supabase/D-02-record-easter-egg-find-REVIEW-ONLY.sql` |
| Production apply | **Blocked** |
| Claimed repaired | **No** |

---

*End D-02 REVIEW ONLY design.*
