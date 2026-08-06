# D1B-C — Achievements SELECT visibility

**Status:** **DESIGN READY / APPLY NOT AUTHORIZED**  
**Slice:** Fix membership tautology on achievements read only  
**Date:** 2026-08-06  

---

## Locked findings

- Product UI is **league-scoped** (`crystal-ball.ts` selects `eq("league_id", session.leagueId)`).  
- Live policy tautology (`m.league_id = m.league_id` / unqualified `league_id`) allows broader authenticated reads than intended.  
- Recommended rule: read only when **currently a member of the achievement row’s league**.  
- Separate from D1B-A and D1B-B.  
- **No** historical achievement mutation.

---

## Target policy

Replace **only** `"Members read achievements"`:

```text
USING: public.is_league_member(achievements.league_id)
```

(or equivalent correlated `memberships` EXISTS with **qualified** `achievements.league_id` — prefer helper to match D-03 and avoid tautology)

**Do not** change:

- `"Commissioner grants achievements"` INSERT (unless later product change)  
- Achievement rows / upsert app paths  

---

## Compatibility

| Path | Impact |
|------|--------|
| Crystal Ball board achievements | OK (query already league-filtered; RLS matches product) |
| Cross-league client scrape | Denied (desired) |
| Commissioner grant | Unchanged |

---

## SQL proposal

`supabase/D1B-C-achievements-select-REVIEW-ONLY.sql`

---

## Apply gate

Mike authorizes **D1B-C only** after SELECT preflight of live policy text.

---

*End D1B-C design.*
