# D1B-C — SELECT-Only Preflight & Apply-Scope Review

**Status:** **PREFLIGHT PACKAGE READY / AWAIT LIVE SELECT PREFLIGHT / APPLY NOT AUTHORIZED / NOT REPAIRED**  
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
| Apply D1B-C | **No** — Mike explicit **D1B-C only** after live preflight MATCH |
| Change `"Commissioner grants achievements"` | **No** |
| Mutate achievement rows | **No** |
| Crystal Ball pick/result policies (D1C) | **No** |
| D1B-A re-touch | **No** (already structurally repaired) |
| D1B-B / H-01 | **No** |

---

## Remaining program track order (after D1B-A)

| Order | Track | Notes |
|-------|--------|--------|
| **Now** | **D1B-C** | This package — safest next repair |
| Next large | **D1B-B** | Membership/join authority — coordinated RPC + app |
| Later | **H-01A** | Selective DEFINER EXECUTE cleanup |
| Later | **H-01B** | Future default privileges |
| Parked | **D1C** | Disposable testing + dependencies first |
| Parallel when ready | Behavioral suites D-01 / D-02 / D-03 | **Disposable identities only** |

---

## 1. Expected live defect (repo + scrub)

From `crystal-ball-full.sql` / scrub tautology inventory:

```text
"Members read achievements" FOR SELECT TO authenticated
USING (
  exists (
    select 1 from public.memberships m
    where m.league_id = league_id and m.user_id = auth.uid()
  )
)
```

Unqualified `league_id` inside the subquery is interpreted as **`m.league_id`**, yielding tautology **`m.league_id = m.league_id`**.  
Effect: any authenticated user who is a member of **any** league can read **all** achievement rows (broader than product intent).

Scrub list item: `achievements` — Members read achievements.

**Stop if live preflight shows** the policy already uses `is_league_member` / qualified `achievements.league_id` correctly (already repaired).

---

## 2. Target policy (apply-scope — exact)

Replace **only**:

| Attribute | Value |
|-----------|--------|
| Table | `public.achievements` |
| Policy name | `"Members read achievements"` |
| Command | `FOR SELECT` |
| Role | `TO authenticated` |
| USING | `public.is_league_member(achievements.league_id)` |
| WITH CHECK | n/a (SELECT) |

**Preserve:** `"Commissioner grants achievements"` (INSERT) and any other achievements policies if present.

**Helper:** `public.is_league_member(uuid)` — **no** CREATE OR REPLACE / grant changes (same as D1B-A).

---

## 3. SQL proposal audit (`D1B-C-achievements-select-REVIEW-ONLY.sql`)

| Check | Result |
|-------|--------|
| Single DROP/CREATE of Members read only | **PASS** |
| Uses `is_league_member` | **PASS** (`league_id` on row = achievements.league_id in single-table policy) |
| No commissioner INSERT change | **PASS** |
| No data DML | **PASS** |
| No D1B-A/B, D1C, H-01 | **PASS** |
| Transaction + NOTIFY | **PASS** |

Optional clarity (equivalent): `public.is_league_member(achievements.league_id)` — recommended if rewriting apply SQL for explicitness; current form is valid for single-table RLS.

---

## 4. Compatibility

| Path | Impact |
|------|--------|
| Crystal Ball board (`eq("league_id", session.leagueId)`) | OK for members of that league |
| Cross-league authenticated scrape | **Denied** (desired) |
| Former member | Loses SELECT of that league’s achievements (desired for “current member”) |
| Commissioner grant INSERT | Unchanged |
| Village Nerd / crown flows | Unchanged if member of league |

---

## 5. Live preflight checklist (operator)

Run `supabase/D1B-C-preflight-SELECT-ONLY.sql` against production **SELECT-only**:

1. Complete policies on `achievements`  
2. Confirm `"Members read achievements"` name + SELECT + tautology or unqualified join  
3. RLS enabled  
4. Keys / indexes (no new indexes expected)  
5. Row counts + orphan-membership inventory (evidence only)  
6. `is_league_member` body still correct  
7. Consumer list (includes D1B-A manage-own)  
8. Commissioner grants policy still present  

Archive results into this doc §0 (same pattern as D1B-A) before apply auth.

---

## 6. Historical inventory rule

- Counts of achievements whose owner left the league are **evidence only**  
- **No DELETE / UPDATE / cleanup**  
- Visibility after D1B-C is **current membership of the reader’s league**, not “ever earned” across all leagues for non-members  

---

## 7. Apply gate (Mike)

1. Live SELECT preflight **MATCH** design  
2. Explicit authorize **D1B-C only**  
3. Apply `supabase/D1B-C-achievements-select-REVIEW-ONLY.sql`  
4. Post-verify: Members read uses `is_league_member`; no tautology; Commissioner grants unchanged  
5. Archive verification — **do not** claim D1B-B / D1C / H-01  

**This document does not authorize apply.**

---

## 8. Status declarations

| Statement | True? |
|-----------|-------|
| Production unchanged by this package | **Yes** |
| D1B-C repaired | **No** |
| D1B-A still repaired | **Yes** (untouched) |
| D1B-B / D1C / H-01 untouched | **Yes** |
