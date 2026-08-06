# D1B-C — SELECT-Only Preflight & Apply-Scope Review

# D1B-C — SELECT-Only Preflight & Apply-Scope Review

**Status:** **LIVE PREFLIGHT PASS / APPLY-SCOPE MATCH / APPLY AUTHORIZED / AWAITING POST-VERIFY ARCHIVE / NOT YET CLAIMED REPAIRED**  
**Date:** 2026-08-06  
**Slice:** Replace **only** `"Members read achievements"` on `public.achievements`  
**Design:** `docs/D1B-C-ACHIEVEMENTS-VISIBILITY.md`  
**SQL proposal:** `supabase/D1B-C-achievements-select-REVIEW-ONLY.sql`  
**Preflight SQL:** `supabase/D1B-C-preflight-SELECT-ONLY.sql`  

### Why next after D1B-A

| Factor | Assessment |
|--------|------------|
| Scope | **One** SELECT policy |
| Helper | Reuse live `is_league_member` (proven on D-03 + D1B-A) |
| Data mutation | **None** |
| App | **None** (UI already league-scoped) |
| Risk | Medium read isolation; low blast radius vs D1B-B / D1C / H-01 |
| Bundle | **Do not** with D1B-B, D1C, H-01, or Crystal Ball policies |

### Explicit non-actions (this package)

| Action | Status |
|--------|--------|
| Apply D1B-C | **Authorized** — `supabase/D1B-C-APPLY-AUTHORIZED.sql`; claim repair only after post-verify archive |
| Change `"Commissioner grants achievements"` | **No** |
| Mutate achievement rows | **No** |
| Table grants / indexes | **No** (H-01 separate for grants) |
| Crystal Ball pick/result policies (D1C) | **No** |
| D1B-A re-touch | **No** (already structurally repaired) |
| D1B-B / H-01 | **No** |

---

## 0. Fresh live preflight archive (production — SELECT-only)

**Method:** SELECT-only catalog and aggregate queries on the **connected production Supabase project**.  
**No** production SQL changes. **No** achievement row contents, user identities, or private values retrieved.

**Verdict:** **LIVE PREFLIGHT PASS / APPLY-SCOPE MATCH** the D1B-C design and REVIEW-ONLY SQL.

### 0.1 Table / RLS

| Field | Live |
|-------|------|
| Table | `public.achievements` |
| RLS enabled | **true** |
| RLS forced | **false** |
| Columns | `league_id`, `user_id`, `code`, `title`, `flavor`, `earned_at` (all NOT NULL as listed) |

### 0.2 Target SELECT policy — defect confirmed

| Field | Live |
|-------|------|
| Policy | `"Members read achievements"` |
| Command | **SELECT** |
| Role | **authenticated** |
| USING | `EXISTS (SELECT 1 FROM memberships m WHERE m.league_id = m.league_id AND m.user_id = auth.uid())` |

**Finding:** `m.league_id = m.league_id` is a **tautology**. Policy checks that the user is a member of **any** league; it does **not** correlate membership to `achievements.league_id`. Confirms the documented cross-league visibility defect.

### 0.3 Commissioner INSERT — preserve

| Field | Live |
|-------|------|
| Policy | `"Commissioner grants achievements"` |
| Command | **INSERT** |
| WITH CHECK | `leagues.id = achievements.league_id` AND `leagues.commissioner_id = auth.uid()` |

**Verdict:** Properly correlated to the target achievement league. **Do not** replace or modify in D1B-C.

### 0.4 Shared helper safety

| Field | Live |
|-------|------|
| Function | `public.is_league_member(p_league_id uuid)` |
| security_definer | **true** |
| search_path | **public** |
| body_refs memberships | **true** |
| correlates `league_id` to `p_league_id` | **true** |
| correlates `user_id` to `auth.uid()` | **true** |

**Decision:** Reuse **unchanged**. No redefine / no grant changes in D1B-C.

### 0.5 Constraints / indexes

| Object | Live |
|--------|------|
| PK | `(league_id, user_id, code)` |
| FK `league_id` | → `leagues(id)` ON DELETE CASCADE |
| FK `user_id` | → `profiles(id)` ON DELETE CASCADE |
| Indexes | `achievements_pkey`; `achievements_league_idx` on `(league_id)` |

No index change needed for the policy repair.

### 0.6 Live data integrity (evidence only)

| Metric | Value |
|--------|------:|
| achievement_rows | **0** |
| achievement_users | **0** |
| rows_missing_league | **0** |
| rows_missing_profile | **0** |
| owner_not_current_member | **0** |

Historical cleanup: **not needed and not authorized**.

### 0.7 Table grants — inventory only

anon, authenticated, postgres, and service_role have table-level privileges from existing posture. RLS remains the row-authorization boundary. **Do not** alter grants in D1B-C (H-01 / H-01B separate).

### 0.8 Exact apply scope (when authorized)

Replace **only**:

```sql
CREATE POLICY "Members read achievements"
  ON public.achievements
  FOR SELECT
  TO authenticated
  USING (
    public.is_league_member(achievements.league_id)
  );
```

**Preserve:** Commissioner grants · table data · constraints/indexes · helper definition/grants · app · every other policy/function/table.

### 0.9 Explicit exclusions (reconfirmed)

No achievement DML · no historical cleanup · no helper/grant/index/app changes · no D1B-A/B · no D1C · no H-01.

---

## Remaining program track order

| Order | Track | Notes |
|-------|--------|--------|
| Done | **D1B-A** | Structurally repaired |
| **Ready** | **D1B-C** | Live preflight PASS — await apply auth |
| Larger | **D1B-B** | Membership/join — coordinated RPC + app |
| Later | **H-01A** / **H-01B** | DEFINER EXECUTE / defaults |
| Parked | **D1C** | Disposable testing first |
| Parallel | Behavioral D-01–D-03 | Disposable identities only |

---

## Match or drift (design vs fresh live)

| Item | Design | Fresh live | Verdict |
|------|--------|------------|---------|
| Policy name | Members read achievements | Present SELECT | **MATCH** |
| Defect | Tautology / no league correlation | `m.league_id = m.league_id` live | **DEFECT CONFIRMED / MATCH** |
| Commissioner INSERT | Preserve | Correlated to target league | **MATCH** |
| Helper reuse | Unchanged | DEFINER correct | **MATCH** |
| Empty table | No cleanup | 0 rows | **MATCH** |
| Proposal SQL | `is_league_member(achievements.league_id)` | Scope still valid | **MATCH** |

**Overall:** **APPLY-SCOPE MATCH**.

---

## SQL proposal audit

File: `supabase/D1B-C-achievements-select-REVIEW-ONLY.sql`

| Check | Result |
|-------|--------|
| Single DROP/CREATE Members read only | **PASS** |
| `is_league_member(achievements.league_id)` | **PASS** |
| Commissioner INSERT untouched | **PASS** |
| No data/helper/grants/indexes | **PASS** |

---

## Compatibility

| Path | Impact |
|------|--------|
| Crystal Ball board (league-scoped query) | OK for members of that league |
| Cross-league authenticated scrape | **Denied** after apply (desired) |
| Former member | Loses SELECT for that league (desired) |
| Commissioner grant INSERT | Unchanged |

---

## Apply gate (Mike)

1. ~~Live SELECT preflight MATCH~~ **Done** (§0)  
2. ~~Explicit authorize: **`D1B-C authorized — apply only`**~~ **Done**  
3. Apply `supabase/D1B-C-APPLY-AUTHORIZED.sql` on production  
4. Post-verify via `supabase/D1B-C-postverify-SELECT-ONLY.sql`  
5. Archive verification — do not claim D1B-B / D1C / H-01  

See `docs/D1B-C-APPLY-AUTHORIZATION.md`.

---

## Status declarations

| Statement | True? |
|-----------|-------|
| Live preflight PASS / apply-scope MATCH | **Yes** |
| D1B-C apply authorized | **Yes** |
| D1B-C claimed structurally repaired | **No** until post-verify archive |
| D1B-A still repaired | **Yes** (untouched by design) |
| D1B-B / D1C / H-01 untouched by design | **Yes** |
