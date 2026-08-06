# Structural Hardening D0 — Live RLS Correction Design (REVISED)

**Status:** REVISED DESIGN + SPLIT REVIEW-ONLY PROPOSALS — **not applied**  
**Date:** 2026-08-06 (revision)  
**Supersedes:** combined D0 migration approach in first draft  

### Explicit non-actions

| Action | Status |
|--------|--------|
| Execute any correction SQL on production | **No** |
| Apply D1A / D1B / D1C | **No** |
| Mutation probes on production | **No** |
| App runtime changes | **No** |
| Foundry rebuild / lift quarantine | **No** |
| Alter `league_trophies` / broad profile discovery | **No** |

**Production remained unchanged throughout D0/D1 proposal work.**

---

## Product laws (binding — revised)

### Delete League

| Law | Statement |
|-----|-----------|
| Intent | **Delete League is intentionally retired.** |
| Client DELETE | Removing the live `leagues` DELETE policy is the **desired permanent** behavior. |
| Future RPC | **No** future “Delete League” RPC is planned. |
| Successor | **Archive League** — separate product design, not D0/D1. |
| Rollback docs | May preserve prior DELETE policy SQL for emergency reference only, with a **prominent warning** that restore reopens a known destructive capability. |

### Crystal Ball lock / reveal / write (single authority)

| State | Own pick readable | Peer picks readable | Own write (create/update) |
|-------|-------------------|---------------------|---------------------------|
| **OPEN** (before lock) | Yes (member) | **No** | **Yes** (member) |
| **LOCKED** (at/after authoritative deadline) | Yes (member) | **Yes** (eligible members) | **No** |
| **CROWNED** (`crystal_ball_result` exists) | Yes | **Yes** (members) | **No** |

**Binding rules:**

1. Writes allowed only while the **authoritative lock window is open**.  
2. At the **same** lock boundary: writes become forbidden **and** peer predictions may become readable.  
3. **Commissioner scoring is not** the ordinary reveal trigger.  
4. Crown/result may prove the board is **permanently** revealable.  
5. **One** authoritative resolver must drive: write gate · peer reveal · Home “locked/complete” task UI.  
6. **No** three conflicting deadline systems (app vs RLS vs ad-hoc).  
7. **No** hardcoded year-specific timestamps inside RLS policy text.

#### Authoritative lock semantics (must match app `resolveCrystalBallLock`)

App source of truth today: `src/lib/crystal-ball.ts` → `resolveCrystalBallLock`.

| Sport | Opening week | Lock deadline | Fail-closed when |
|-------|--------------|---------------|------------------|
| **NFL** | Week **1** | First kickoff on a **formally published** Week 1 card (`published_at` set + games with start times) | No formally published Week 1 kickoff → **private peers**, countdown unknown; do **not** invent CFB calendar fallback |
| **CFB** | Week **0** | Existing authoritative CFB CB deadline: calendar **and/or** first kickoff on formally published Week 0 card (app: earlier of calendar vs kickoff for countdown; lock when either path passes) | Derive season identity via **canonical season resolver** — not raw `2026-…` literals in policy SQL |

**Rejected for D1C:** “Reveal after opening week is scored” as the ordinary path.

**App note (future runtime alignment, not D0 execute):** `resolveCrystalBallLock` currently also locks on `listScoredWeekNumbers()` including opening week. Product law says scoring must not be the ordinary reveal trigger. D1C requires **cross-layer** agreement: DB function + app Home/task UI + `resolveCrystalBallLock` share one definition; scoring-as-lock may be demoted to “already locked” lagging signal only after product sign-off.

---

## Confirmed live defects (unchanged inventory)

| # | Defect | Stage |
|---|--------|-------|
| 1 | `leagues` DELETE `commissioner_id = auth.uid()` | **D1A** |
| 2 | Membership tautologies (`m.league_id = m.league_id`) on achievements / crystal_ball_* | **D1B** |
| 3 | picks/pick_games manage-own without target-league membership | **D1B** |
| 4 | Crystal Ball hardcoded 2026 freezes + wrong “score = reveal” proposal | **D1C** (design first) |
| 5 | Trophy / broad discovery | **Out of scope** |

---

## Split deployment (mandatory)

| Stage | Name | Contents | Production readiness |
|-------|------|----------|----------------------|
| **D1A** | League deletion lockdown | Drop **verified** DELETE policies on `public.leagues` only | May be considered for careful production apply after exact preflight |
| **D1B** | Membership-correlation repairs | Achievements tautology; picks/pick_games membership; CB membership correlation only | Prefer staging/ephemeral DB; **no** proven staging Supabase today |
| **D1C** | CB deadline/reveal enforcement | Single lock resolver in DB aligned with app; no hardcoded policy years; no score-as-reveal | **Blocked** until authoritative cross-layer design proven |

**Do not** combine D1A + D1B + D1C into one production transaction for convenience.

### Non-production limitation (honest)

The project currently has **no proven staging Supabase**.

| Guidance | |
|----------|--|
| “Test non-prod first” | **Not currently available** as a standing environment |
| D1A | Smallest blast radius (remove retired DELETE only); production apply possible after preflight + Mike auth |
| D1B / D1C | Prefer ephemeral Supabase / isolated clone before production; do not pretend otherwise |

---

## A. Preflight dependency (SELECT-only — before final D1A SQL)

**File:** `supabase/D0-rls-preflight-SELECT-ONLY.sql` (expanded)

Must run and **archive** before final D1A DROP list is frozen:

| Archive item | Why |
|--------------|-----|
| Exact live `leagues` **DELETE** policy **names** | D1A drops only those names |
| RLS enabled/forced on `leagues` | Safety |
| Sport immutability function def + trigger enabled state | Must remain |
| All `leagues` **UPDATE** policies | Confirm create/settings path |
| Deputy functions/policies (`is_league_ops`, `is_deputy`) | D1B must not break |
| SECURITY DEFINER functions that can DELETE/UPDATE `leagues` | Residual risk outside RLS |

**D1A rule:** Drop **explicit verified policy names** from preflight — **no** uncontrolled `DROP POLICY` wildcards over unknown future names beyond the known retired set documented after preflight.

Template known from repo: `"Commissioner deletes league"`. Live may add variants — only drop names proven in preflight.

---

## B. Stage proposals

### D1A — League deletion lockdown

**File:** `supabase/D1A-league-delete-lockdown-REVIEW-ONLY.sql`

| Include | Exclude |
|---------|---------|
| DROP verified DELETE policies on `leagues` | Any UPDATE/INSERT policy rewrite |
| Comments: Delete retired; Archive later | Crystal Ball, picks, achievements |
| Post-verify: no DELETE policies remain | Sport trigger changes |

**Tests (D1A):**

- Preflight DELETE name list matches drops  
- Commish PostgREST DELETE league → denied; row remains  
- Create league still works  
- Commish/ops settings UPDATE still works  
- `sport_id` UPDATE still rejected by immutability trigger  
- Deputy `is_league_ops` UPDATE still works  

**Rollback:** Emergency-only recreate of prior DELETE policy — **WARN: reopens destructive client delete**. Prefer leave locked.

---

### D1B — Membership-correlation repairs

**File:** `supabase/D1B-membership-correlation-REVIEW-ONLY.sql`

| Include | Exclude |
|---------|---------|
| Qualify `achievements` membership EXISTS | CB reveal/write deadline rules |
| Qualify `crystal_ball_*` membership EXISTS | Hardcoded freezes / score reveal |
| picks/pick_games: own + membership in `picks.league_id` | Trophy / profile / gazette / locker |
| Preserve Ops/deputy pick read/score policies | League DELETE (D1A) |

**Crystal Ball in D1B:** membership correlation only — **do not** change when peers become visible or when writes close (that is D1C).

**Tests (D1B):**

- Zero `m.league_id = m.league_id` in live policies  
- Member manages own picks in own league  
- Member cannot insert picks into another league  
- Non/former member cannot mutate  
- Cross-league achievement/CB **membership** gate holds  
- Deputy scoring paths still work  
- No change to public trophy/profile discovery  

---

### D1C — Crystal Ball deadline / reveal (design; apply later)

**File:** `supabase/D1C-crystal-ball-lock-REVIEW-ONLY.sql` (design stub + blocker)  
**Design detail:** § “Crystal Ball state model” below  

**Tests (D1C — when unblocked):**

- Own write while open  
- Own write rejected after lock  
- Peers unreadable before lock; readable after lock  
- NFL without published W1 kickoff: peers private; no CFB fallback  
- Crown forces permanent reveal  
- Scoring alone does **not** flip reveal if lock not reached (if app aligned)  
- Zero hardcoded `2026-` in policy quals  
- Home task locked/complete uses **same** resolver facts  

---

## C. Crystal Ball state model (canonical)

### Single function contract (target)

```text
crystal_ball_lock_state(p_league_id uuid)
  → {
      sport_id text,           -- from leagues.sport_id
      opening_week int,        -- nfl=1, cfb=0
      lock_at timestamptz,     -- null if unknown (NFL no published kickoff)
      is_locked boolean,       -- now() >= lock_at OR crowned
      is_write_open boolean,   -- member may write own pick
      is_peers_revealed boolean, -- members may read peer picks
      reason text,             -- open | nfl_kickoff | cfb_calendar | cfb_kickoff | crowned | no_kickoff
      kickoff_known boolean
    }
```

**Invariant:**

```text
is_write_open  ⇔  NOT is_locked  (and not crowned)
is_peers_revealed  ⇔  is_locked OR crowned
```

Same facts for Home task completion UI (future app: call one shared definition).

### Resolution algorithm (DB + app must match)

```text
IF crystal_ball_result exists for league:
  locked=true, write_open=false, peers_revealed=true, reason=crowned
ELSE IF sport = nfl:
  opening_week = 1
  IF formally published week_card(week=1) with games:
    lock_at = min(valid start_time of card_games)
    IF now >= lock_at: locked=true, peers=true, write=false, reason=nfl_kickoff
    ELSE: locked=false, peers=false, write=true, reason=open
  ELSE:
    locked=false, peers=false, write=true?, reason=no_kickoff
    -- Product: fail-closed for PEERS (private). Own pick still readable.
    -- Writes: app today allows open until kickoff known; keep write open
    -- until lock_at known and passed (do not invent lock).
ELSE IF sport = cfb (default):
  opening_week = 0
  calendar_at = canonical_cfb_crystal_ball_deadline(season)  -- NOT literal in policy
  kickoff_at = min start_time if formally published week 0 card else null
  lock_at = earliest of {calendar_at, kickoff_at} when defined
  IF now >= lock_at: locked=true, peers=true, write=false
  ELSE: open
```

### D1C blocker report (truthful)

| Requirement | Status |
|-------------|--------|
| NFL kickoff from `week_cards` + `card_games` | **Expressible in SQL** today |
| Formally published = `published_at IS NOT NULL` + games | **Expressible** |
| CFB calendar without hardcoded year in policy | **Blocked** for pure SQL today: app still uses `crystalBallLockMs` → `2026-08-29T12:00:00-04:00`; `season-calendar.ts` is year-scoped client data, **not** a DB table |
| Canonical season resolver in DB | **Missing** — no `public.season_calendar` / `crystal_ball_deadlines` table |
| Single function used by RLS + app + Home | **Not yet** — requires app refactor to call RPC or shared package + DB function |

**D1C recommendation:** Do **not** ship incomplete DB freezes. Sequence:

1. Define `public.crystal_ball_lock_state(league_id)` (or equivalent) in a design PR.  
2. Land **canonical CFB deadline** source (table or security definer reading approved calendar, season-keyed).  
3. Refactor app `resolveCrystalBallLock` to consume the same rules (or generate both from one TS module + SQL mirror tests).  
4. Then apply D1C RLS using **only** that function (no score-as-reveal).  

Until then: D1B may fix membership correlation only; live CB freezes remain app-enforced + imperfect RLS (documented risk).

---

## D. Authorization matrix (intended end-state)

### `leagues` (after D1A)

| Actor | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| anon | per live discovery | N | N | **N** |
| authenticated | per live discovery | Y create as self | N unless ops/commish | **N permanent** |
| commissioner | Y | Y | Y settings (not sport) | **N** |
| deputy | Y | N | Y via `is_league_ops` | **N** |
| service role | * | * | * | * (ops only; not product Delete) |

### `picks` / `pick_games` (after D1B)

| Actor | Own manage | Cross-league insert | Ops read/score |
|-------|------------|---------------------|----------------|
| member | Y if membership in row league | N | — |
| non-member | N | N | N |
| deputy/commish | as member for own | N | Y via existing ops policies |

### `achievements` / `crystal_ball_*` membership (after D1B)

Correlated `m.league_id = <table>.league_id` only.

### Crystal Ball write/reveal (after D1C)

Per state machine above — not score-triggered.

---

## E. Rollout / rollback warnings

### Rollout order

1. Run and archive **preflight** (production SELECT-only).  
2. Freeze D1A DROP list from exact DELETE policy names.  
3. **D1A** only (Mike auth) → verify.  
4. Plan ephemeral DB for **D1B** → apply D1B → verify.  
5. Complete CB cross-layer design → **D1C** → verify.  

### Rollback warnings

| Stage | Rollback | Warning |
|-------|----------|---------|
| D1A | Re-create DELETE policy | **EMERGENCY ONLY — reopens known destructive client delete of entire leagues + CASCADE** |
| D1B | Restore prior policy text from preflight dump | May reintroduce tautologies / cross-league write risk |
| D1C | Restore prior CB policies | May reintroduce hardcoded years / wrong reveal |

---

## F. Files

| File | Role |
|------|------|
| `docs/STRUCTURAL-HARDENING-D0-RLS.md` | This revised design |
| `supabase/D0-rls-preflight-SELECT-ONLY.sql` | Preflight (required before final D1A) |
| `supabase/D1A-league-delete-lockdown-REVIEW-ONLY.sql` | D1A proposal |
| `supabase/D1B-membership-correlation-REVIEW-ONLY.sql` | D1B proposal |
| `supabase/D1C-crystal-ball-lock-REVIEW-ONLY.sql` | D1C design stub + blocker |
| `supabase/D0-rls-corrections-REVIEW-ONLY.sql` | **SUPERSEDED** — do not apply combined |
| `supabase/D0-rls-corrections-ROLLBACK.sql` | Legacy combined rollback; D1A section warns |

---

## G. Production confirmation

| Claim | Status |
|-------|--------|
| Production DB mutated | **No** |
| Correction SQL executed | **No** |
| Runtime changed | **No** |
| Foundry quarantine | **Active** |

---

## Stop

D0 revision complete. **No SQL executed.** Next: run preflight SELECT archive → Mike authorizes **D1A only** when ready.
