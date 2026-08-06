# D1B-A — SELECT-Only Preflight & Final Apply-Scope Review

**Status:** **LIVE PREFLIGHT PASS / APPLY-SCOPE MATCH / APPLY AUTHORIZED / EXECUTION PENDING OR AWAITING POST-VERIFY ARCHIVE / NOT YET CLAIMED REPAIRED**  
**Date:** 2026-08-06  
**Slice:** `public.picks` + `public.pick_games` manage-own membership correlation only  
**Design:** `docs/D1B-A-PICKS-MEMBERSHIP-CORRELATION.md`  
**SQL proposal:** `supabase/D1B-A-picks-membership-REVIEW-ONLY.sql`  
**Preflight SQL:** `supabase/D1B-A-preflight-SELECT-ONLY.sql`  

### Explicit non-actions (this package)

| Action | Status |
|--------|--------|
| Apply D1B-A policies | **Authorized** by Mike (D1B-A only) — use `supabase/D1B-A-APPLY-AUTHORIZED.sql`; agent environment cannot run prod DDL without service credentials |
| DELETE / UPDATE / cleanup of historical rows | **No** — not needed and not authorized |
| Index changes | **No** |
| App code | **No** |
| D1B-B / D1B-C / D1C / H-01 | **Untouched** |
| Change `is_league_member` definition or grants | **No** |

---

## Related program status (parked / separate)

| Track | Classification |
|-------|----------------|
| **D1C** | **DESIGN + NON-PRODUCTION SQL READY / EPHEMERAL TESTS NOT RUN / PRODUCTION APPLY BLOCKED / NOT REPAIRED** (parked). **Do not test S2b against production.** |
| **D1B-B / D1B-C / H-01** | Untouched by this package |

---

## 0. Fresh live preflight archive (production — SELECT-only)

**Method:** SELECT-only catalog and aggregate queries run directly against the **connected Supabase production project**. No policy DDL; no data mutation; no manual paste required for this evidence set.

**Verdict:** **LIVE PREFLIGHT PASS / APPLY-SCOPE MATCH** the archived D1B-A design and `supabase/D1B-A-picks-membership-REVIEW-ONLY.sql`.

### 0.1 RLS

| Table | RLS enabled |
|-------|-------------|
| `public.picks` | **Yes** |
| `public.pick_games` | **Yes** |

### 0.2 Vulnerable policy baseline (live)

#### `public.picks` — `"Users manage own picks"`

| Field | Live value |
|-------|------------|
| Command | **ALL** |
| Role | **authenticated** |
| USING | `auth.uid() = user_id` |
| WITH CHECK | `auth.uid() = user_id` |

**Finding:** Ownership only — **does not** require membership in the target league (`picks.league_id`).

#### `public.pick_games` — `"Users manage own pick_games"`

| Field | Live value |
|-------|------------|
| Command | **ALL** |
| Role | **authenticated** |
| USING | Parent pick exists **and** parent pick `user_id = auth.uid()` |
| WITH CHECK | **null** (missing) |

**Finding:** Ownership through parent pick only — **does not** require membership in the parent pick’s league. Missing WITH CHECK confirmed.

### 0.3 Helper safety (live)

| Field | Live value |
|-------|------------|
| Function | `public.is_league_member(p_league_id uuid)` |
| SECURITY DEFINER | **true** |
| Volatility | **STABLE** SQL function |
| `search_path` | **public** |
| Body | Checks `public.memberships` for `league_id = p_league_id` **and** `user_id = auth.uid()` |

**Decision (locked for D1B-A):** **Reuse unchanged.** Do not redefine. Do not alter grants in D1B-A.

### 0.4 Structural relationships (live)

| Relationship | Confirmed |
|--------------|-----------|
| `pick_games.pick_id` → `picks.id` | **ON DELETE CASCADE** |
| `picks.league_id` → `leagues.id` | **ON DELETE CASCADE** |
| `picks.user_id` → `profiles.id` | **ON DELETE CASCADE** |
| Unique pick | `(league_id, user_id, week_number)` |
| Unique pick-game | `(pick_id, card_game_id)` |

### 0.5 Live integrity counts (evidence only)

| Metric | Value |
|--------|------:|
| `picks` | **7** |
| `pick_games` | **35** |
| Picks without matching league membership | **0** |
| Pick-games under nonmember picks | **0** |
| Pick-games missing parent pick | **0** |

**Historical cleanup:** not needed and **not authorized**.

### 0.6 Apply-scope verdict (live)

**MATCH** existing D1B-A design. When Mike authorizes **D1B-A only**, replace **exactly**:

**A. `public.picks` — `"Users manage own picks"`**

```text
USING and WITH CHECK:
  user_id = auth.uid()
  AND public.is_league_member(league_id)
```

**B. `public.pick_games` — `"Users manage own pick_games"`**

```text
USING and WITH CHECK:
  parent pick exists
  AND parent pick user_id = auth.uid()
  AND public.is_league_member(parent pick league_id)
```

**Preserve every other** `picks` / `pick_games` policy.

### 0.7 Explicit exclusions (reconfirmed)

- Do not change `is_league_member`
- No data DELETE/UPDATE
- No indexes or table grants
- No app changes
- No D1B-B or D1B-C
- No D1C
- No H-01

---

## 1. Preflight execution history

| Source | Role |
|--------|------|
| **Fresh live production SELECT-only** (this archive §0) | **Authoritative for apply gate** |
| `docs/AUTOMATED-READONLY-SCRUB-SWEEP.md` | Earlier inventory (aligned: 7 picks, 0 nonmember) |
| `docs/D-03-HELPER-SAFETY-GATE.md` | Helper body/grants context (H-01 separate) |
| Repo `schema.sql` / proposal SQL | Target policy text |

**Stop rule for future re-checks:** if live policy names, FKs, or `is_league_member` body differ materially from §0 / design → **do not apply**.

---

## 2. Match or drift (design vs fresh live)

| Item | Design / proposal | Fresh live | Verdict |
|------|-------------------|------------|---------|
| Policy name `Users manage own picks` | Replace in place | Present; ALL; auth only | **MATCH** |
| USING/WITH CHECK today | Ownership only | `auth.uid() = user_id` both | **MATCH defect** |
| Target-league membership on picks | Required after apply | **Missing** | **DEFECT CONFIRMED** |
| Policy name `Users manage own pick_games` | Replace in place | Present; ALL | **MATCH** |
| pick_games USING today | Parent ownership | Parent + owner | **MATCH defect** |
| pick_games WITH CHECK today | Should exist after apply | **null** | **DEFECT CONFIRMED** (+ gap vs proposal) |
| Parent league membership | `is_league_member(p.league_id)` | **Missing** | **DEFECT CONFIRMED** |
| `is_league_member` reuse | Unchanged | Body correct DEFINER STABLE | **MATCH** |
| FKs / uniques | As design | Confirmed live | **MATCH** |
| Historical nonmember picks | 0 | **0** / 7 | **MATCH clean** |
| Orphan pick_games | 0 | **0** | **MATCH** |
| pick_games row count | n/a | **35** | Inventory only |
| D1B-A SQL scope | 2 policies only | Scope still valid | **MATCH** |

**Overall:** **APPLY-SCOPE MATCH** — ready for Mike’s **separate D1B-A-only apply authorization** (not granted by this archive).

---

## 4. Expected live policy surface (repo + scrub)

### picks (expected family — confirm live with P1)

| Policy (repo lineage) | cmd | Role in D1B-A |
|-----------------------|-----|----------------|
| **Users manage own picks** | ALL | **REPLACE** |
| Members view league picks | SELECT | **PRESERVE** (if still live) |
| Ops read league picks | SELECT | **PRESERVE** |
| Ops score picks | UPDATE | **PRESERVE** |
| Members read locked/scored week picks | SELECT | **PRESERVE** if present |

### pick_games (expected family — confirm live with P2)

| Policy (repo lineage) | cmd | Role in D1B-A |
|-----------------------|-----|----------------|
| **Users manage own pick_games** | ALL | **REPLACE** |
| Members read pick_games | SELECT | **PRESERVE** (if still live) |
| Ops read league pick_games | SELECT | **PRESERVE** |
| Members read locked/scored week pick_games | SELECT | **PRESERVE** if present |

**Note:** `picks-privacy.sql` drops open mate view in favor of commissioner/ops read — live may show either lineage. D1B-A must **not** drop any non-manage-own policy.

### Schema keys (repo `schema.sql` — confirm P4)

| Object | Definition |
|--------|------------|
| `picks` PK | `id uuid` |
| `picks` unique | `(league_id, user_id, week_number)` |
| `picks.league_id` | FK → `leagues` |
| `pick_games` PK | `id uuid` |
| `pick_games.pick_id` | FK → `picks(id)` ON DELETE CASCADE |
| `pick_games` unique | `(pick_id, card_game_id)` |

### RLS (repo)

| Table | RLS enabled in schema.sql |
|-------|---------------------------|
| picks | Yes |
| pick_games | Yes |

Forced RLS: expect **false** unless product changed — confirm P3.

---

## 5. `is_league_member(uuid)` — archived live definition summary

From **D-03 helper safety gate** (live at that time):

| Field | Value |
|-------|--------|
| Body | Correct `memberships` EXISTS for `p_league_id` + `auth.uid()` |
| SECURITY DEFINER / STABLE | Yes |
| `search_path` | `public` |
| EXECUTE | PUBLIC, anon, authenticated, postgres, service_role (H-01 inventory — **do not change in D1B-A**) |

**D1B-A must NOT** CREATE OR REPLACE / REVOKE / GRANT this helper.

### Known policy consumers of `is_league_member` (archive + expected)

| Table | Policy (archive) |
|-------|------------------|
| `card_games` | Members read card games |
| `memberships` | Memberships select for members |
| `week_cards` | Members read week cards |
| `league_first_joins` | Users insert own first join (after D-03) |

D1B-A **adds** manage-own picks/pick_games as consumers. Re-run P11 before apply.

---

## 6. Exact policies proposed for replacement

### 6.1 `public.picks` — `"Users manage own picks"`

| Attribute | Value |
|-----------|--------|
| Command | `FOR ALL` |
| Role | `TO authenticated` |
| USING | `user_id = auth.uid() AND public.is_league_member(league_id)` |
| WITH CHECK | `user_id = auth.uid() AND public.is_league_member(league_id)` |
| Correlates to | **row** `picks.league_id` |

### 6.2 `public.pick_games` — `"Users manage own pick_games"`

| Attribute | Value |
|-----------|--------|
| Command | `FOR ALL` |
| Role | `TO authenticated` |
| USING | EXISTS parent `picks p` where `p.id = pick_games.pick_id` AND `p.user_id = auth.uid()` AND `public.is_league_member(p.league_id)` |
| WITH CHECK | Same EXISTS (parent ownership + membership on **parent pick’s** `league_id`) |
| Correlates to | **parent** `picks.league_id` (not a free-standing league on pick_games) |

---

## 7. End-to-end audit of REVIEW-ONLY SQL

File: `supabase/D1B-A-picks-membership-REVIEW-ONLY.sql`

| Check | Result |
|-------|--------|
| Replaces only the two authorized manage-own policies | **PASS** — only those two DROP/CREATE |
| No DROP of mate/ops/reveal policies | **PASS** |
| No helper create/replace/grants | **PASS** |
| No index/trigger/table DDL | **PASS** |
| No historical DML | **PASS** |
| No D1B-B/C, D1C, H-01 | **PASS** |
| picks USING self + membership | **PASS** |
| picks WITH CHECK self + membership | **PASS** (both required for ALL) |
| pick_games USING parent + membership on `p.league_id` | **PASS** |
| pick_games WITH CHECK same | **PASS** (schema live may lack WITH CHECK today — proposal correctly adds it for INSERT/UPDATE) |
| Membership predicate on actual row league | **PASS** — `league_id` / `p.league_id` |
| Transaction wrapped | **PASS** (`begin`/`commit`) |
| `NOTIFY pgrst` | Present — OK post-apply only |

**Caveat:** `FOR ALL` means SELECT is also gated by manage-own USING. Own-row SELECT still works for members; **nonmember former owners** lose manage-own SELECT (mates/ops/locked-week policies may still apply for others). Historical rows retained; visibility follows remaining policies. Acceptable under “current membership required.”

---

## 8. Exact SQL-object scope (apply, when authorized)

| Object | Action |
|--------|--------|
| Policy `Users manage own picks` on `public.picks` | DROP + CREATE |
| Policy `Users manage own pick_games` on `public.pick_games` | DROP + CREATE |
| All other policies | **None** |
| Functions / grants / indexes / tables / data | **None** |

**Out of scope:** bot RPCs, reset, remove-member, app, D1B-B join, D1B-C achievements, D1C, H-01.

---

## 9. Rollback (when apply later authorized)

Restore prior manage-own (ownership only) from pre-apply archive of `qual`/`with_check` — **reopens cross-league write risk**. Prefer re-apply archived exact strings rather than guessing.

---

## 10. Apply gate checklist (Mike)

- [x] Fresh live SELECT-only preflight against production (**PASS** — §0)  
- [x] Evidence archived in this document  
- [x] Policy names match §6 / §0.6  
- [x] Nonmember counts **0**; orphan pick_games **0**  
- [x] `is_league_member` body correct — reuse unchanged  
- [ ] Optional: confirm full preserve-list policy names still present immediately before apply  
- [x] Explicit authorization: **D1B-A apply only** (Mike)  
- [ ] Apply `supabase/D1B-A-APPLY-AUTHORIZED.sql` on production  
- [ ] Post-verify via `supabase/D1B-A-postverify-SELECT-ONLY.sql`  
- [ ] Archive post-verify in docs + register  
- [ ] Spot-check honest client pick save still works  

**Authorization granted. Structural repair claimed only after post-verify PASS archived.**  
See `docs/D1B-A-APPLY-AUTHORIZATION.md`.

---

## 11. Status declarations

| Statement | True? |
|-----------|-------|
| Production policies/data unchanged by this docs archive | **Yes** |
| Fresh live preflight PASS / apply-scope MATCH | **Yes** |
| D1B-A repaired | **No** |
| D1B-A apply authorized | **No** |
| D1B-B / D1B-C untouched | **Yes** |
| D1C untouched / parked | **Yes** |
| H-01 untouched | **Yes** |
| Historical invalid-row cleanup | **Not done / not needed (0)** |
