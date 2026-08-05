# Postseason Snapshot Design — Stage PS0

**Status:** 🔒 PS0 design · **PS1 pure engine shipped** (no DB / runtime wiring)  
**Date:** 2026-08-05  
**Law:** `docs/POSTSEASON-COMPETITION-LAW.md`  
**SQL (review only):** `supabase/postseason-snapshots-REVIEW-ONLY.sql`  
**Pure engine:** `src/lib/postseason/*` · verify: `npx tsx scripts/verify-postseason-ps1.mjs`  
**Do not execute SQL against production in this stage.**

---

## 1. Purpose

Replace live re-seed of Championship / Toilet Bowl from current standings with a **durable, once-written** snapshot at the **authoritative cut**, so:

- Qualifier sets, seeds, byes, and Toilet Bowl existence are stable  
- Re-score / refresh / page load cannot silently reshuffle the field  
- Repair is explicit, warned, and audited  

---

## 2. Snapshot contents (exact)

### Header (one row per league · season)

| Field | Type (logical) | Notes |
|-------|----------------|--------|
| `id` | uuid | PK |
| `league_id` | uuid | FK leagues |
| `season_key` | text | Stable season identity (e.g. `2026` or `2026-cfb`; product uses same key as trophies’ year) |
| `sport_id` | text | `cfb` \| `nfl` \| … denormalized for readers |
| `cut_week` | int | CFB 14 / NFL 18 (or league override if ever added) |
| `frozen_at` | timestamptz | Authoritative freeze instant |
| `cut_percent` | int | Saved league cut (eliminated %) at freeze |
| `eligible_human_count` | int | Count used in formula |
| `qualifier_count` | int | Result of ceil formula + min 2 + cap |
| `toilet_bowl_active` | boolean | True only if ≥4 non-qualifiers |
| `snapshot_version` | int | Starts at 1; increments only on intentional repair |
| `creation_reason` | text | e.g. `cut_week_scored` \| `manual_repair` \| `foundry_preview` (preview never prod) |
| `created_by` | uuid | null for system; user for repair |
| `supersedes_snapshot_id` | uuid null | Prior version when repaired |
| `repair_note` | text null | Required when `creation_reason = manual_repair` |
| `metadata` | jsonb | Extensible (formula inputs, standings fingerprint) |
| `created_at` / `updated_at` | timestamptz | |

**Idempotency:** At most **one active** snapshot per `(league_id, season_key)` for ordinary readers. Historical versions may be retained for audit (see SQL) **or** single-row upsert with version bump + repair log only.

**Recommended:** One **current** row unique on `(league_id, season_key)` + append-only **`league_postseason_repair_log`** for history (simpler reads).

### Participants (many rows)

| Field | Type | Notes |
|-------|------|--------|
| `id` | uuid | PK |
| `snapshot_id` | uuid | FK header |
| `user_id` | uuid | FK profiles |
| `display_name_snapshot` | text | Name at freeze (survives rename) |
| `field` | text | `championship` \| `toilet` \| `eliminated` |
| `seed` | int null | Null for eliminated-only rows if stored; seeds 1..n within field |
| `first_round_bye` | boolean | True if bye in R1 |
| `division_snapshot` | text null | Optional N/S/E/W at freeze |
| `standings_rank_at_cut` | int null | Optional audit |
| `season_points_at_cut` | numeric null | Optional audit |

**Constraints:**

- Unique `(snapshot_id, user_id, field)`  
- **Exclusion:** same `user_id` cannot appear in both `championship` and `toilet` for the same `snapshot_id`  
- Eliminated set = eligible humans not in championship (and not toilet if inactive)

### Eligible roster (optional third table or JSON)

**Option A (preferred):** participant rows cover championship + toilet + eliminated.  
**Option B:** `eligible_roster jsonb` on header for full freeze of who counted as human.

Prefer **Option A** for queryability + exclusion constraints.

### Intentional repair metadata

On repair write:

| Field | Use |
|-------|-----|
| `snapshot_version` | +1 |
| `creation_reason` | `manual_repair` |
| `repair_note` | Human reason (required) |
| `created_by` | Commissioner user id |
| `supersedes_snapshot_id` | Previous snapshot id (if versioning rows) |
| Repair log row | Before/after fingerprint, timestamps |

---

## 3. Existing table vs new table

### Candidates audited

| Table | Can own freeze? | Why not |
|-------|-----------------|---------|
| `league_trophies` | **No** | End-of-season hardware; one row per trophy type; no field/seeds/byes |
| `week_results` / `game_results` | **No** | Weekly scoring only |
| `memberships` | **No** | Live roster; mutates after cut |
| `museum_allegiance_snapshots` | **No** | Team allegiance per game; different domain |
| `gazette_editions` | **No** | Narrative archive |
| `leagues` jsonb column | **Fragile** | No exclusion constraints; hard RLS; easy silent overwrite; poor audit |

### Recommendation: **NEW tables**

**`public.league_postseason_snapshots`** + **`public.league_postseason_participants`** (+ optional **`league_postseason_repair_log`**).

| Why new | Detail |
|---------|--------|
| Domain | Cut freeze ≠ trophy engraving |
| Constraints | Cross-field exclusion needs participant rows |
| Idempotency | Unique active snapshot per league/season |
| RLS | Read members; write only via controlled freeze/repair paths |
| Ordinary reads | SELECT only — never CREATE on page load |

---

## 4. When the snapshot is created (PS1 runtime — not this stage)

| Trigger | Allowed |
|---------|---------|
| First time cut week becomes authoritatively scored | **Yes** — primary |
| Intentional commissioner repair | **Yes** — warned |
| Page load / refresh / standings fetch | **No** |
| Re-score of cut week after freeze exists | **No** silent rewrite; may prompt repair |
| Membership join/leave after freeze | **No** rewrite of fields |
| Foundry preview | Local/sandbox only — never production snapshot |

**Ordinary reads must never create or rewrite the snapshot.**

---

## 5. Authorization & RLS model

| Actor | Read snapshot | Create freeze | Repair |
|-------|---------------|---------------|--------|
| League member (authenticated) | Yes | No | No |
| Commissioner | Yes | System path after cut score (server/client ops) | Yes, with confirm |
| Deputy | Yes | Same as ops if product grants (recommend **commish-only repair**) | Product decision: default **commish-only** |
| Non-member | No | No | No |
| Anon | No | No | No |

**RLS sketch:**

- SELECT: membership exists for `league_id`  
- INSERT freeze: commissioner (or security-definer function `freeze_postseason_if_absent`)  
- UPDATE/DELETE: **denied** for ordinary clients; repair via security-definer `repair_postseason_snapshot` that checks commissioner + required note  

Prefer **security-definer RPCs** so clients cannot partial-write participants.

---

## 6. Repair path design

### Name

`repair_postseason_snapshot` (conceptual)

### Requirements

| Rule | Detail |
|------|--------|
| Who | Commissioner (recommended; not page-load) |
| Confirm | Explicit UI confirmation with consequences |
| Warn | “This rewrites championship/Toilet fields and may invalidate playoff progress already shown.” |
| Audit | Repair log: actor, timestamp, note, before/after version, optional JSON diff |
| Never triggered by | Page load, refresh, re-score, membership fetch, ordinary scoring, hub pulse |
| After repair | New version; readers use latest; trophies **not** auto-rewritten (hardware law separate) |

### Inputs

- League + season  
- Optional: recompute from **current** standings vs paste lists (product may start with recompute-only)  
- Required: `repair_note` non-empty  

### Outputs

- New snapshot version  
- Audit log row  
- Success/failure — never half-applied (transaction)

---

## 7. Read model (PS1)

```text
if snapshot exists for league+season:
  Championship page ← championship participants + byes
  Toilet page ← if toilet_bowl_active else “Not contested”
  Closeout ← toilet required only if toilet_bowl_active
  Auto-engrave toilet ← only if active + final decided
else:
  Pre-cut: projected field (labeled Projected) — optional
  Never invent freeze on read
```

---

## 8. Stage PS1 implementation file plan

### New / primary files (planned)

| File | Role |
|------|------|
| `src/lib/postseason/formula.ts` | Pure: qualifierCount, toilet active, partition humans |
| `src/lib/postseason/freeze.ts` | Build snapshot payload; write-if-absent |
| `src/lib/postseason/load.ts` | Read snapshot; never write |
| `src/lib/postseason/repair.ts` | Repair RPC client + guards |
| `src/lib/postseason/types.ts` | Types |
| `src/lib/brackets.ts` | Consume frozen lists; stop live seedChampionship for post-cut UI |
| `src/app/championship/page.tsx` | Read freeze / projected |
| `src/app/toilet-bowl/page.tsx` | Active vs Not contested |
| `src/lib/season-closeout.ts` | Toilet optional |
| `src/lib/auto-trophies.ts` | Skip toilet if inactive |
| `src/lib/cloud.ts` | Hook freeze after cut-week score (careful, once) |

### Tests (PS1–PS19 + extensions)

| ID | Case |
|----|------|
| **PS1** | n=2, 50% → champ 2, toilet false |
| **PS2** | n=3, 50% → champ 2, toilet false |
| **PS3** | n=4, 50% → champ 2, toilet false |
| **PS4** | n=5, 50% → champ 3, toilet false |
| **PS5** | n=6, 50% → champ 3, toilet false |
| **PS6** | n=7, 50% → champ 4, toilet false |
| **PS7** | n=8, 50% → champ 4, toilet true, 4 participants |
| **PS8** | cutPercent=40, n=10 → ceil(10×0.6)=6 qualifiers |
| **PS9** | cutPercent=0 → all humans champ (cap n), toilet false if n&lt;4 non-qual (0 non-qual) |
| **PS10** | cutPercent=100 with n≥2 → still min 2 qualifiers |
| **PS11** | Non-pow2 field → byes on highest seeds; no fake users |
| **PS12** | No user in both championship and toilet |
| **PS13** | Bots excluded from eligible humans |
| **PS14** | Freeze idempotent: second freeze attempt no-op |
| **PS15** | Read path never inserts snapshot |
| **PS16** | Re-score after freeze does not change participants |
| **PS17** | Post-cut join not added to frozen fields |
| **PS18** | Closeout ready without toilet when inactive |
| **PS19** | No toilet_bowl trophy when inactive; runner-up ≠ toilet |
| **PS20** | Bye: first_round_bye true; no matchup scores invented |
| **PS21** | Repair requires note + commissioner; bumps version |
| **PS22** | Boundary n=1 (solo) → no valid championship field / explicit not-ready |

### Suggested test location

`src/lib/postseason/__tests__/formula.test.ts`  
`src/lib/postseason/__tests__/freeze-idempotency.test.ts`  
(or project’s existing vitest/jest layout)

---

## 9. Residual decisions — **resolved as binding (PS1)**

| ID | Decision |
|----|----------|
| **R1** | Canonical season year = season **starting year** via `canonicalSeasonYear` / `seasonKeyFromYear` in `src/lib/postseason/season-identity.ts`. `defaultSeasonYear` in trophies re-exports it. Jan–Jun → previous year; Jul–Dec → current. |
| **R2** | Freeze must be atomic with cut-week score commit; cut not official if freeze fails. PS1 exposes pure `cutScoreAndFreezeCoupling` + freeze preconditions only — **no** scoring transaction. |
| **R3** | Deputy may **auto-freeze** as consequence of scoring cut week. Deputy **cannot** manual repair. Repair is commissioner-only. Service/creator emergency audited outside ordinary UI. |
| **R4** | Never create snapshot on read. No legacy backfill in PS1. |
| **R5** | Ordinary repair only **before** first authoritative postseason matchup result; then locked. Exceptional rebuild out of PS1. |

Open for **PS2** only: wiring freeze into `saveResultsAndScoreWeek`, RPC, pages, optional division-winner seed reorder parity with legacy `seedChampionship`.

---

## 10. Stage PS0 deliverable checklist

- [x] Canonical postseason law doc  
- [x] Snapshot field list  
- [x] Existing vs new table recommendation  
- [x] Review-only SQL + rollback  
- [x] Auth/RLS model  
- [x] Repair path design  
- [x] PS1 file + test plan  
- [ ] Runtime implementation (**not** this stage)  
- [ ] Execute SQL (**not** this stage)  
