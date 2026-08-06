# E0 — Emergency Foundry Quarantine & Blast-Radius Audit

**Status:** QUARANTINE ACTIVE  
**Date:** 2026-08-05  
**Mode:** Isolate Foundry · audit only · **do not repair league yet** · **do not re-simulate** · **no RLS migration**

---

## Incident (as reported)

| Field | Value |
|-------|--------|
| Affected production league | **[NOT PROVIDED — Mike to fill]** |
| League ID | **[NOT PROVIDED — Mike to fill]** |
| Intended current week before sim | **[NOT PROVIDED — Mike to fill]** |
| Observed after Foundry simulation | **Week 8** |

---

## E0 actions taken (app)

| Action | Detail |
|--------|--------|
| Kill switch | `src/lib/foundry-quarantine.ts` · `FOUNDRY_EMERGENCY_QUARANTINE = true` |
| Lab tools off | `showCommishLabTools()` → always false under quarantine |
| Sticky session | Cannot arm; `isFoundrySessionSticky()` forced false; `markFoundrySessionActive` clears sticky |
| Drama / ceremonies | `prepareFoundryDramaAfterScore` / `forceFoundryGazetteAndCheevos` / `allowFoundryCeremonies` refused |
| Bot sim RPCs | `seedTrialBotsInCloud` (non-replacement), `seedBotPicksForWeekInCloud`, `applyRandomBotChaosForWeek` blocked |
| CFB champ sim jump | `jumpCfbChampionshipFinal` blocked |
| Foundry hub | Banner warning on `/founder` |

**Not done (by design):** restore `current_week`, wipe scores, delete sim weeks, RLS policy changes.

---

## Blast radius (read-only code audit)

### How Foundry reaches production week state

Foundry is **not** a separate database. Rule #2 in `docs/WAR-ROOM-FOUNDRY.md` requires simulation to drive the **real** production pipeline. On a **production-mode league** with creator ops session:

```text
Foundry sticky / lab tools (creator only)
  → Host Dashboard lab: demo slate · publish demo week · seed bots · lock bot picks
  → Randomize & score  OR  Auto-score week range (0→N)
  → handleSaveResults → real week_results / game_results / membership points
  → advanceLeagueAfterScore(scoredWeek)
  → setLeagueActiveWeek(scoredWeek + 1)
  → leagues.current_week written via authenticated Supabase client
```

**Calendar “sandbox”** (`isSandboxMode` / preseason tools) is **time-based before season open**, not “non-production league.” Before doors open, creator lab tools were allowed to run the **real** score + week advance on whatever room the session pointed at — including production leagues.

### Crown-jewel tables that can be hit by that path

| Domain | Write path | Foundry-related? |
|--------|------------|------------------|
| `leagues.current_week` | `setLeagueActiveWeek` · auto-publish · season reset | **Yes** (advance after score) |
| `week_cards` / `card_games` | publish demo / publish card | **Yes** (demo publish) |
| `picks` / `pick_games` | seed bot picks · self sim · real score | **Yes** |
| `week_results` / `game_results` | score / randomize | **Yes** |
| `memberships` stats | scoring | **Yes** |
| `memberships` bots | `seed_trial_bots` | **Yes** |
| `league_trophies` | auto-engrave / season close | Possible if closeout run |
| Gazette archive | archive after score / Foundry drama | **Yes** |
| Achievements / badges | badge eval after score · drama force | **Yes** (local + possible cloud) |
| Permanent career | `canWritePermanentCareer` mode gate | **Partial** — mode must be production; lab can still write league-scoped truth |
| Crystal ball | seed bot CB | Possible |
| Locker | seed bot talk | Possible |

### Paths that claim isolation (and gaps)

| Path | Claimed isolation | Gap |
|------|-------------------|-----|
| Creator eyes | Local week / local cards; no `current_week` write | Safe for week stamp if eyes stays on; **Foundry sticky + real Host path does write** |
| Bored practice | Week 99 practice | Not this incident |
| `career-integrity` | Blocks non-production career | Does **not** block league week/scores |
| Preseason tools lock after open | Locks demo tools when calendar open | **Before open**, tools allowed on production rooms |

### Blast radius for “Week 8 observed”

Likely cumulative effect of scoring weeks 0…7 (or 1…7) with **auto-advance**, or direct `setLeagueActiveWeek(8)` after multi-week auto-score.

**Possible collateral (verify with SELECT only, do not repair here):**

- Published week cards for sim weeks  
- Scored results and player points for those weeks  
- Bot memberships and locked picks  
- Gazette editions for scored weeks  
- LocalStorage active-week keys for that league  

---

## What to inspect next (Mike — SELECT only)

```sql
-- SELECT ONLY — fill league id
-- select id, name, code, sport_id, current_week, commissioner_id, created_at
-- from public.leagues where id = '<LEAGUE_UUID>';

-- SELECT ONLY
-- select week_number, published_at from public.week_cards
-- where league_id = '<LEAGUE_UUID>' order by week_number;

-- SELECT ONLY
-- select week_number, scored_at from public.week_results
-- where league_id = '<LEAGUE_UUID>' order by week_number;

-- SELECT ONLY
-- select count(*) filter (where is_bot) as bots, count(*) as members
-- from public.memberships where league_id = '<LEAGUE_UUID>';
```

---

## Repair (NOT executed)

Separate authorized step after identity + intended week confirmed:

1. Confirm league UUID and intended `current_week`  
2. Inventory scored weeks / cards / bots  
3. Decide: roll back week only vs wipe sim scores vs leave history  
4. Prefer **ops-owned repair SQL** with backup snapshot first  
5. Never re-run Foundry on that room until isolation ships  

---

## Isolation requirements (future — not this E0)

1. Foundry may only mutate leagues with `mode != production` (or dedicated foundry flag)  
2. Lab tools must refuse production-mode leagues even for creator  
3. Prefer dedicated Foundry Supabase project  
4. `setLeagueActiveWeek` after score must not be reachable from randomize/auto-score on production  

---

## Confirmation

| | |
|--|--|
| Foundry quarantined in app | **Yes** |
| League repaired | **No** |
| Simulation re-run | **No** |
| RLS migration | **No** |
| Production data mutated by this E0 commit | **No** (code only) |
