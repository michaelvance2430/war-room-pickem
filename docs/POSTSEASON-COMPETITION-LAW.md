# Postseason Competition Law

**Status:** 🔒 **BINDING · Stage PS0** (design + docs only · runtime not implemented)  
**Date:** 2026-08-05  
**Audience:** Implementers of cut freeze, brackets, closeout, trophies  
**Canonical:** This file is the **source of truth** for postseason field rules.  
**Related:** `docs/POSTSEASON-SNAPSHOT-DESIGN.md` · integrity audits · `docs/EXPERIENCE-ORCHESTRATOR-BINDING-DECISIONS.md` (ceremony only — not field math)

---

## What eight means

**Eight humans is not the minimum valid league size.**

Eight is the **minimum size that naturally produces the full two-bracket experience** under a **50% cut**:

| Bracket | Qualifiers at 50% with 8 humans |
|---------|----------------------------------|
| Championship | 4 |
| Toilet Bowl | 4 |

**Minimum viable league:** **2** active humans.  
**Recommended league size:** **8+** for full dual-bracket drama.

---

## Resolved product formulas

| Symbol | Meaning |
|--------|---------|
| `cutPercent` | Fixed at **50%**; commissioners do not choose it |
| `humans` | Count of **eligible active human** memberships at authoritative cut |
| `qualifierCount` | `min(16, ceil(humans × (100 − cutPercent) / 100))` |
| Floor | Minimum **2** qualifiers when `humans ≥ 2` |
| Cap | Qualifiers never exceed `16` or `humans` |
| Exactly 2 humans | **Both** qualify for championship regardless of cut math |

### Illustrative 50% cut table

| Humans | Qualifiers (50%) | Championship format (concept) | Eliminated | Toilet Bowl |
|-------:|-----------------:|-------------------------------|----------:|-------------|
| 2 | 2* | Final between both | 0 | **No** |
| 3 | 2 | Seeds 2–3 play; seed 1 bye | 1 | **No** |
| 4 | 2 | Championship final | 2 | **No** |
| 5 | 3 | Seed 1 bye; 2–3 play | 2 | **No** |
| 6 | 3 | Seed 1 bye; 2–3 play | 3 | **No** |
| 7 | 4 | Four-player bracket | 3 | **No** |
| 8 | 4 | Four-player bracket | 4 | **Yes** |

\*Championship cannot have one participant.

### Large-league conference rule

When a league has more than 32 eligible humans, postseason qualification is
conference-based. The league must have four conferences with at least eight
players apiece. Each conference sends its top four to the Championship and its
bottom four to the Toilet Bowl. Everyone between those two conference cut lines
continues making weekly picks but enters neither bracket.

Example: a 100-player league with four conferences of 25 produces four
Championship qualifiers and four Toilet Bowl qualifiers per conference. Each
conference standings table shows a Championship cut after rank 4 and a Toilet
Bowl cut before rank 22. Overall standings never determine these fields.

---

## Production laws (1–8)

### 1. Single elimination

Postseason competition is **single elimination** only.

### 2. No production bot / fixture fill

**Never** auto-populate a production league or postseason bracket with:

- bots  
- fixtures  
- simulated users  
- placeholder memberships  

Bots undermine trust (fake wins, fake seeds). Foundry fixtures stay isolated. Any future intentional bots mode must be a **clearly labeled separate product mode**, not invisible bracket repair.

### 3. Championship qualifiers

Calculate from:

1. Active **human** memberships at authoritative cut  
2. League’s **saved** `cutPercent`  
3. **Round up** fractional results (`ceil`)  
4. **Minimum 2** humans in the field when at least 2 eligible humans exist  
5. **Capped** at 16 and eligible human count

### 4. Non-power-of-two fields and byes

- Generate the next valid bracket size (power of two).  
- Award **first-round byes to the highest seeds**.  
- **Never** add fake competitors to fill slots.  
- A **bye is not a game**: must not create picks, scores, achievements, Gazette results, or Moments that pretend a matchup occurred.  
- Players with byes **may** still make **weekly** pick'em cards; they **cannot lose the bye** by that weekly card.

### 5. Two-human league

If only **2** active eligible humans exist, **both** compete for the championship regardless of mathematical cut. A championship cannot contain only one player.

### 6. Toilet Bowl (conditional)

| Rule | Detail |
|------|--------|
| Pool | The worst 16 active humans who **did not** qualify for championship |
| Create Toilet Bowl | **≥ 4** non-qualifiers → single-elim Toilet Bowl (legitimate byes OK) |
| No Toilet Bowl | **&lt; 4** non-qualifiers that season |
| No Toilet Bowl means | **No** Toilet Bowl trophy · **no** toilet ceremony beat |

For a 100-player league at the default 50% cut: ranks 1–16 enter the
Championship, ranks 85–100 enter the Toilet Bowl, and ranks 17–84 are removed
from permanent postseason trophy contention. Eliminated players may continue
making postseason picks for weekly points, achievements, and bragging rights.
| Permanent history | May show **“Not contested”** or omit Toilet Bowl |
| Forbidden | Championship **runner-up** converted/labeled as Toilet Bowl recipient |
| Forbidden | Add bots, shrink championship field, or change cut % to manufacture Toilet Bowl |

### 7. Authoritative cut freezes

At the authoritative cut event, freeze **all** of:

- Eligible human roster  
- Championship qualifiers  
- Seeds  
- Byes  
- Eliminated players  
- Whether Toilet Bowl exists  
- Toilet Bowl participants and seeds  

Also freeze identity metadata: league, season, cut week, `cutPercent`, qualifier count, `frozen_at`, version, creation reason (see snapshot design).

### 8. No silent recompute

Later incidental recomputation (page load, refresh, re-score, membership fetch, ordinary scoring) **must not** silently change any frozen postseason field.

**Intentional repair** only: commissioner-confirmed, warned, auditable (see `POSTSEASON-SNAPSHOT-DESIGN.md`).

---

## Post-cut membership

Joins **after** the freeze **cannot** enter frozen championship or Toilet Bowl fields. They retain standings/history only.

---

## Relationship to ceremonies

| Concern | Doc |
|---------|-----|
| Ring Ceremony cinema / 7-day window | Experience Orchestrator binding |
| Hardware / trophies | Awarded from **authoritative result**, not ceremony view |
| Toilet trophy | Only if Toilet Bowl was active and completed |

---

## Implementation stages

| Stage | Scope | Status |
|-------|--------|--------|
| **PS0** | Laws + durable snapshot design + review-only SQL + PS1 plan | **Done** |
| **PS1** | Pure engine + regression tests (no DB/pages) | **Done** — `src/lib/postseason/*` |
| **PS2** | Schema apply, freeze wired to cut-week score, page readers | **Not authorized** |
| **PS3+** | Repair UI, exceptional rebuild, legacy backfill | Later |

---

## Change control

Amendments require product approval and an updated date on this file.
