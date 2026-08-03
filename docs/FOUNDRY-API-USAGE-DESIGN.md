# Foundry · Platform API Usage — Design (approval before code)

**Status:** Design only — **stop for Mike approval before implementation**  
**Mission:** Move Odds API credit monitoring out of normal Commissioner UI into Foundry; platform-level aggregation for the creator.  
**Date:** 2026-08-03  

**Constraints (from mission):**  
- Do not touch onboarding  
- Do not change normal commissioner workflows except **removing** the credits strip  
- Do not change API calling behavior, retries, or scoring logic  
- No Foundry language outside creator tools  
- No destructive SQL  

---

## 1. Executive summary

| Today | After (proposed) |
|-------|------------------|
| Every non–first-hour commish who pulls odds/syncs scores can see **account-wide** “Odds API credits left” on `/commissioner` | **No** credit UI on `/commissioner` for owners, deputies, or players |
| Quota is session-ephemeral React state after last Pull Odds / Sync | Foundry **Platform API Usage** dashboard (creator-only) |
| No per-league or historical log | New **server-side** usage log on odds/scores routes → aggregate by league, sport, action, day |
| Provider headers only (account totals) | Keep reading provider headers **and** log each War Room request with context |

**Hard truth from audit:** The Odds API only returns **one account’s** `x-requests-remaining` / `x-requests-used` / `x-requests-last`. That is **not** per league. Per-league / per-action / by-day breakdowns **do not exist today** and **cannot be reconstructed** from history. They require **new logging going forward**.

---

## 2. Current architecture (as-built)

### 2.1 Call path

```
CommissionerClient.pullOdds()
  → lib/odds.ts fetchFootballOdds(sport, week, { dryRun? })
    → GET /api/odds/nfl  or  GET /api/odds/ncaaf
      → The Odds API v4 .../odds  (apiKey from server env)

CommissionerClient.syncFinalScores / score path
  → lib/scores.ts fetchFootballScores(sport, daysFrom)
    → GET /api/scores/nfl  or  GET /api/scores/ncaaf
      → The Odds API v4 .../scores
```

**Also:** Demo slate / randomize paths use **zero** Odds API credits (local/fake data).

### 2.2 Where credit values come from

| Source | Fields | Scope |
|--------|--------|--------|
| The Odds API response headers on **every** successful or error response from their API | `x-requests-remaining`, `x-requests-used`, `x-requests-last` | **Entire API account** (single `ODDS_API_KEY`) |
| Our route JSON passthrough | `remaining`, `used`, `last` on success **and** many error bodies | Same account totals |
| `CommissionerClient` state | `oddsCreditsRemaining`, `oddsCreditsUsed`, `oddsCreditsLast` | Client-only; updated via `applyOddsQuota()` after pull/sync |

**Provider note:** These headers are **account-wide**. They do **not** identify which league, user, or sport caused the consumption. One shared key on Vercel = one shared quota across **all** War Room leagues.

**Estimated cost copy in UI today (informal, not from provider per-call headers):**

> Free plan is usually 500 credits/month (Pull Odds ≈ 1, Sync scores ≈ 2). Demo slate uses zero credits.

Actual The Odds API pricing depends on plan, markets, regions, and endpoint. We do **not** currently parse a per-request cost header into storage—only remaining/used/last.

### 2.3 Where credits are shown (to remove from normal hosts)

**File:** `src/app/commissioner/CommissionerClient.tsx`  

**UI block:** Under header when `!(firstTime || simpleHost)`, alongside “View as player”:

- “Odds API credits left: {remaining}”
- “(used this period: {used} · last call: {last})”
- Free-plan explanatory copy (Pull Odds ≈ 1, Sync ≈ 2)

**Who sees it:** Any ops user who is **not** in first-time/simple-host chrome and who has triggered a pull/sync that returned quota headers (or residual state). That includes **normal owners** and **deputies**—not Foundry-only.

**Also mentioned (copy only, not live numbers):**

- `CommishWeekChecklist` advanced blurb mentions “odds credits” as buried advanced tools  
- Error strings from odds routes may mention credits exhausted (acceptable as operational error text; do not expand into a credits dashboard on Commish)

### 2.4 Server routes (key handling)

| Route | Sport | Provider path (conceptually) |
|-------|-------|------------------------------|
| `src/app/api/odds/ncaaf/route.ts` | CFB | `americanfootball_ncaaf` odds |
| `src/app/api/odds/nfl/route.ts` | NFL | `americanfootball_nfl` odds |
| `src/app/api/scores/ncaaf/route.ts` | CFB | `americanfootball_ncaaf` scores |
| `src/app/api/scores/nfl/route.ts` | NFL | `americanfootball_nfl` scores |

- Key: `process.env.ODDS_API_KEY` (fallback also checks `NEXT_PUBLIC_ODDS_API_KEY`—prefer **server-only** `ODDS_API_KEY`; public prefix is a smell for secrets)  
- Key is appended as query param to The Odds API (provider pattern); **never** returned in our JSON body today  
- Routes currently have **no** session/creator auth gate—any client that can hit the app origin can call them (existing behavior; **do not change call behavior** in this mission, but Foundry **aggregation** endpoints must be creator-only)

### 2.5 Foundry placement today

- Hub: `src/app/founder/page.tsx`  
- Gate: `isAppCreator(session.playerId)` (UUID allowlist + env)  
- Session chrome: `FoundrySessionChrome` / sticky Foundry bar  

No API usage section exists yet.

### 2.6 Per-league / action logging

| Question | Answer |
|----------|--------|
| Does per-league logging exist? | **No** |
| Does per-action (pull_odds vs score_sync) log exist? | **No** |
| Is there a Supabase table for Odds usage? | **No** (grep shows no `api_usage` / `odds_usage` schema) |
| Can historical per-league totals be reconstructed? | **No** — inventing them would be false |
| Can historical account totals be reconstructed? | **No** from our DB; only whatever The Odds API dashboard shows for the account |

---

## 3. What can be measured **now** (no new logging)

| Metric | Available now? | How |
|--------|----------------|-----|
| Credits remaining (provider period) | **Yes, live only** | Last response headers after any odds/scores call |
| Credits used (provider period) | **Yes, live only** | `x-requests-used` |
| Last request cost (provider “last”) | **Yes, live only** | `x-requests-last` (credits charged on last API request, per provider) |
| Total request count (War Room, historical) | **No** | Need log |
| Pull Odds count | **No** | Need log |
| Score-sync count | **No** | Need log |
| Failed API requests (historical) | **No** | Need log (routes return errors but don’t persist) |
| Last successful / failed call timestamps | **No** | Need log |
| Usage today / week / month | **No** (except month ≈ provider “used” as coarse account total) | Need log for day/week; month can show provider `used` + log from deploy date |
| By league | **No** | Need log + league_id on request context |
| By sport | **No** | Need log |
| By endpoint/action | **No** | Need log |
| By day | **No** | Need log |
| Top-consuming leagues | **No** | Need log |

**Honest Foundry Phase 0 (if shipped without table):**  
Live “probe” or “last pull snapshot” of account remaining/used/last only—**not** league table, not trends. Mission requires aggregation → **logging is required** for full deliverable.

---

## 4. What requires new logging

To satisfy mission items 2–4 (counts, failures, by league/sport/action/day, league table), implement an **additive** usage log written **server-side only** inside the four odds/scores routes (and nowhere in the browser).

**Going forward only.** Do not backfill fake history.

### 4.1 Attribution challenge (important)

Odds/scores routes today are **anonymous GET** from the browser; they do **not** receive `league_id` in the URL.

**Proposed non-breaking attribution (does not change when/how often provider is called):**

1. **Optional query params** on our routes (ignored if missing):  
   - `leagueId` (uuid)  
   - `action` optional override; default derived from route  
2. Client `fetchFootballOdds` / `fetchFootballScores` pass `leagueId` from `getSession()?.leagueId` / `getLeague()?.id` when present.  
3. Server validates UUID format only; never trusts client for **authorization** of the log row (log is append-only telemetry).  
4. If `leagueId` missing → still log with `league_id = null` (counts toward platform totals, not a named league).

**Do not** add retries or extra provider calls for attribution.

### 4.2 Estimated credit cost

- Prefer storing provider `x-requests-last` when present as `provider_last_cost` (integer string/int).  
- Also store `estimated_credit_cost` using a small fixed map for rollups if header missing:

| Action | Estimated credits (document as estimate) |
|--------|------------------------------------------|
| `pull_odds` (odds endpoint) | 1 |
| `score_sync` (scores endpoint) | 2 |

These match current product copy; label UI as **estimated** where derived from map, **provider** where from `x-requests-last`.

---

## 5. Proposed schema (additive SQL — no destructive ops)

### 5.1 Table: `platform_odds_api_usage`

```sql
-- Additive only. Run in Supabase when approved.
create table if not exists public.platform_odds_api_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Context (nullable when client didn't send league)
  league_id uuid null references public.leagues(id) on delete set null,
  user_id uuid null,  -- optional; only if we later pass session id server-side

  sport text null check (sport is null or sport in ('cfb', 'nfl')),
  action text not null check (action in ('pull_odds', 'score_sync')),
  endpoint text not null,  -- e.g. '/api/odds/ncaaf', provider sport key optional secondary column

  -- Provider account snapshot after this call (account-wide)
  provider_remaining int null,
  provider_used int null,
  provider_last_cost int null,

  estimated_credit_cost int not null default 1,

  success boolean not null,
  http_status int null,
  error_code text null,  -- short: 'quota', 'upstream_4xx', 'upstream_5xx', 'config', 'network' — not full body dump

  -- Optional operational metadata (no secrets)
  dry_run boolean not null default false,
  week_number int null
);

create index if not exists platform_odds_api_usage_created_at_idx
  on public.platform_odds_api_usage (created_at desc);

create index if not exists platform_odds_api_usage_league_created_idx
  on public.platform_odds_api_usage (league_id, created_at desc);

create index if not exists platform_odds_api_usage_action_created_idx
  on public.platform_odds_api_usage (action, created_at desc);
```

**Do not log:** API keys, Authorization headers, full upstream bodies, PII beyond optional user_id if ever added carefully.

### 5.2 RLS / access model

| Role | Access |
|------|--------|
| `anon` / normal authenticated players | **No** select/insert/update/delete |
| League commissioners | **No** platform table access |
| Server (service role or secured server route) | **Insert** on each odds/scores call; **Select** only from creator-gated API |

Recommended:

1. **Enable RLS** on `platform_odds_api_usage`.  
2. **No policies** for `authenticated` that allow read (default deny).  
3. Route handlers use **service role** Supabase client **only on server** to insert + for Foundry aggregate GET.  
4. Foundry API route verifies creator identity before any select (see §6).

Optional later: RPC `get_platform_odds_usage_summary()` with `security definer` that checks `auth.uid()` against creator allowlist—still no client direct table access.

### 5.3 Snapshot row vs event log

- **Event log** (above) drives counts, league table, trends, failures.  
- **Latest event’s** `provider_remaining` / `provider_used` powers “credits remaining / used” cards without a separate table.  
- Optional tiny table `platform_odds_api_snapshot` is **not required** for v1.

---

## 6. Security model

| Requirement | Design |
|-------------|--------|
| Foundry creator-only UI | `/founder` already gates with `isAppCreator`; new section only renders inside that page |
| Creator-only data API | `GET /api/founder/odds-usage` (name TBD) returns 401/403 unless server verifies session user ∈ creator allowlist (reuse same IDs as `isAppCreator`, prefer server-side allowlist env **without** exposing keys) |
| Normal commish cannot query platform totals | No client SDK select on usage table; no public REST exposure |
| Never expose API keys | Logging omits key; Foundry UI never prints env; routes continue to keep key server-side |
| No secrets in client bundles | Aggregation fetch returns only aggregates + league names/ids/sports/counts |
| Do not change scoring / retries | Logging is fire-and-forget after provider response; insert failure must **not** fail odds/scores response |

**Creator verification on API:**  
Prefer reading session JWT + comparing `sub` to `CREATOR_USER_IDS` / existing hardcode via shared server helper—not only client-side hide.

---

## 7. Foundry UX — “Platform API Usage”

**Placement:** New section on `src/app/founder/page.tsx` (Foundry Hub), below critical first-hour block or in an “Ops” band—compact internal dashboard.

**Title:** `Platform API Usage`

### 7.1 Top summary cards

| Card | Source |
|------|--------|
| Credits remaining | Latest log row `provider_remaining` (or live probe if no rows yet) |
| Credits used (provider period) | Latest `provider_used` |
| Total requests (logged) | Count rows since logging started |
| Pull Odds requests | `action = pull_odds` |
| Score-sync requests | `action = score_sync` |
| Failed requests | `success = false` |
| Last success | max(created_at) where success |
| Last failure | max(created_at) where not success |
| Usage today | sum estimated cost / count where created_at::date = today UTC or America/New_York (pick one TZ and document) |
| Usage this week | rolling 7 days |
| Usage this month / provider cycle | provider `used` + logged counts since month start |

Badge: **“Logged since {first_log_date} · not historical before that”**

### 7.2 Charts / breakdowns (compact)

- **7/30-day trend:** daily request counts (and optional estimated credits)  
- **By action:** pull_odds vs score_sync (and fail rate)  
- **By sport:** cfb vs nfl  
- **Top leagues table** (sort estimated credits or request count desc)

### 7.3 League usage table (columns)

| Column | Source |
|--------|--------|
| League name | join `leagues.name` |
| League id | `league_id` |
| Sport | league.sport_id or majority of logged sport |
| Pull Odds calls | count action pull_odds |
| Score-sync calls | count action score_sync |
| Failed calls | count not success |
| Last API use | max(created_at) |
| Estimated credits consumed | sum(estimated_credit_cost) or sum(provider_last_cost) |

**Null league_id** group as row: “Unattributed / pre-instrumentation client”

### 7.4 Recent failures

Last N rows where `success = false`: time, league, action, sport, error_code, http_status.

### 7.5 Language

- Foundry-only.  
- Do **not** put “Foundry” strings on `/commissioner`.  
- Commish simply has **no** credits strip.

---

## 8. Implementation phases (for approval)

### Phase A — Commish strip removal (small, shippable alone)

1. Remove credits strip UI + explanatory copy from `CommissionerClient`.  
2. Remove or stop updating `oddsCreditsRemaining` / `Used` / `Last` state **or** keep internal vars unused only if still needed for lab—prefer full removal of display path.  
3. Soften `CommishWeekChecklist` “odds credits” phrase if it implies hosts should look for credits.  
4. **Do not** remove header passthrough from API routes (tracking retained).  
5. Verify normal host / deputy never sees credit UI after pull/sync.

### Phase B — Usage log + server write

1. Apply additive SQL for `platform_odds_api_usage` + RLS deny-by-default.  
2. Shared helper `logOddsApiUsage(row)` using service role; swallow errors.  
3. Call helper at end of each of 4 routes (success and failure paths).  
4. Optional query params `leagueId`, `week` from client fetch helpers (no extra provider calls).

### Phase C — Foundry API + UI

1. `GET /api/founder/odds-usage` (or similar): creator-gated aggregates + league table + recent failures + latest provider snapshot.  
2. Foundry section component `FoundryPlatformApiUsage.tsx` mounted only on founder page after creator gate.  
3. Manual refresh button (reuse Foundry Refresh pattern).

### Phase D — Verification (see §9)

No Phase that changes pull/sync frequency or scoring.

---

## 9. Verification plan

| # | Check | Pass criteria |
|---|--------|----------------|
| 1 | Normal owner on `/commissioner` after Pull Odds | No credits strip, no ≈1/≈2 copy |
| 2 | Deputy on Commish | Same |
| 3 | First-time / simple host | Still no credits (already hidden); no regression |
| 4 | Foundry as creator | Platform API Usage visible with cards |
| 5 | Foundry as non-creator | Cannot open Foundry / cannot fetch usage API (403) |
| 6 | Network tab on odds call | Response still returns games; body does not include API key |
| 7 | After N pulls from league A and B | League table shows A/B counts (once logging live); sort highest first |
| 8 | Failed call (e.g. bad network sim) | Failure row appears; odds route still returns error JSON as today |
| 9 | Log insert failure (broken service role) | Odds/scores still work for hosts |
| 10 | Historical honesty | UI states data starts at first log; no invented pre-log league totals |
| 11 | Demo slate publish | Zero new usage rows (or not counted as provider success)—no provider call |
| 12 | No onboarding files touched | Diff excludes onboarding journeys |

---

## 10. Component / file map (proposed — not yet coded)

| Piece | Path (proposed) |
|-------|-----------------|
| Remove strip | `src/app/commissioner/CommissionerClient.tsx` |
| Client leagueId pass-through | `src/lib/odds.ts`, `src/lib/scores.ts` |
| Route logging | `src/app/api/odds/*`, `src/app/api/scores/*` |
| Log helper | `src/lib/platform-odds-usage.ts` (server-only) |
| Aggregate API | `src/app/api/founder/odds-usage/route.ts` |
| Foundry UI | `src/components/FoundryPlatformApiUsage.tsx` + mount in `src/app/founder/page.tsx` |
| SQL | `supabase/platform-odds-api-usage.sql` (additive) |

**Out of scope:** onboarding, scoring math, retry policy, Foundry language on player surfaces.

---

## 11. Audit answers (mission §6 checklist)

| Question | Answer |
|----------|--------|
| Where do API credit values currently come from? | The Odds API response headers `x-requests-remaining`, `x-requests-used`, `x-requests-last`, passed through our `/api/odds/*` and `/api/scores/*` JSON, then held in Commissioner React state. |
| Does the provider expose only account-wide totals? | **Yes** for those headers—one key, one account quota. Not per league. |
| Does per-league/action logging already exist? | **No.** |
| What additional instrumentation is required? | Additive `platform_odds_api_usage` table + server insert on each odds/scores route + optional `leagueId` query param + creator-only aggregate API. |
| Historical reconstruction? | **Only going forward.** Do not invent historical per-league totals. Provider dashboard may show account-level history outside War Room. |

---

## 12. Risks & decisions for Mike

1. **Unattributed traffic** until clients send `leagueId`—old cached clients still work; counts under “Unattributed.”  
2. **Timezone** for “today” / “this week” (recommend `America/New_York` for ops consistency with kickoffs).  
3. **Whether to stop checking `NEXT_PUBLIC_ODDS_API_KEY`** (security hygiene)—out of scope unless approved; not required for dashboard.  
4. **Auth on odds routes themselves** (lock down to signed-in ops)—**out of scope** for this mission (“do not change API calling behavior”); note as follow-up hardening.  
5. **Cost estimates** (1 vs 2) vs true provider `x-requests-last`—UI should prefer provider last cost when present.

---

## 13. Approval gate

**Implement nothing until Mike approves this design.**

Suggested approval options:

- **A)** Full plan (Phases A–C)  
- **B)** Phase A only first (strip credits from Commish), logging + Foundry next  
- **C)** Design changes requested (schema / placement / estimates)

---

## 14. One-line product outcome

Normal commissioners **host the room**.  
Mike in Foundry **watches the platform’s Odds API burn**—account totals plus honest, forward-looking usage by league, sport, action, and day.
