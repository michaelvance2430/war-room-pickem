# D1B-C — Achievements SELECT visibility

**Status:** **LIVE PREFLIGHT PASS / APPLY-SCOPE MATCH / APPLY NOT AUTHORIZED / NOT REPAIRED**  
**Slice:** Fix membership tautology on achievements read only  
**Date:** 2026-08-06  
**Preflight + apply-scope:** `docs/D1B-C-PREFLIGHT-AND-APPLY-SCOPE.md` (§0 fresh live production archive)  
**Preflight SQL:** `supabase/D1B-C-preflight-SELECT-ONLY.sql`  
**SQL proposal:** `supabase/D1B-C-achievements-select-REVIEW-ONLY.sql`  


---

## Priority

**Next scrub target after D1B-A** (structurally repaired). Narrowest remaining isolation fix: **one SELECT policy**.

Larger tracks remain later: D1B-B · H-01A · H-01B · D1C (parked) · D-01/D-02/D-03 behavioral suites (disposable identities).

---

## Locked findings

- Product UI is **league-scoped** (`crystal-ball.ts` selects `eq("league_id", session.leagueId)`).  
- Live policy tautology (`m.league_id = m.league_id` via unqualified `league_id` in EXISTS) allows broader authenticated reads than intended.  
- Recommended rule: read only when **currently a member of the achievement row’s league**.  
- Separate from D1B-A (done) and D1B-B (not started).  
- **No** historical achievement mutation.

---

## Target policy

Replace **only** `"Members read achievements"`:

```text
USING: public.is_league_member(achievements.league_id)
```

**Do not** change:

- `"Commissioner grants achievements"` INSERT (unless later product change)  
- Achievement rows / upsert app paths  
- Crystal Ball pick/result RLS (D1C)  

---

## Compatibility

| Path | Impact |
|------|--------|
| Crystal Ball board achievements | OK (query already league-filtered; RLS matches product) |
| Cross-league client scrape | Denied (desired) |
| Commissioner grant | Unchanged |

---

## Apply gate

| Step | Status |
|------|--------|
| Fresh live SELECT-only preflight | **PASS** (archived §0) |
| Apply-scope MATCH design + REVIEW-ONLY SQL | **Yes** |
| Mike explicit **`D1B-C authorized — apply only`** | **Not yet** |
| Production apply | **Blocked until that authorization** |

Live defect confirmed: `m.league_id = m.league_id` tautology on `"Members read achievements"`.  
Table empty (0 rows); cleanup not needed.

---

*End D1B-C design.*
