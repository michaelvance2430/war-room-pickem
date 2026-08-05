# Experience Orchestrator — Binding Product Decisions

**Status:** 🔒 **BINDING** · audit / plan only · **do not implement from this doc yet**  
**Date recorded:** 2026-08-05  
**Revised:** 2026-08-05 (Cold Open fully locked · sole Season Opening cinematic · ceremony vs result)  
**Owner:** Product (Mike)  
**Audience:** Future Experience Orchestrator + Moments implementers  

### How to use

These decisions are **product law** for the future Experience Orchestrator and experience-order plan.

| Do | Do not |
|----|--------|
| Treat this file as law for orchestrator design | Implement UI/eligibility/schema from this pass |
| Diff against current Ring / Cold Open / Season Opening code | Keep opening-week Ring Ceremony as silent production truth |
| Prefer authoritative kickoff / championship timestamps | Hardcode calendar dates when live season data exists |
| Keep **result truth** on permanent league surfaces | Make the 7-day Ring Ceremony the only place the winner is revealed |
| Treat **Cold Open** as the sole user-facing season-opening cinematic | Queue a second “Season Opening” fullscreen alongside Cold Open |

**Emotional pair (locked):**

| Experience | Line |
|------------|------|
| **Ring Ceremony** | **“You won.”** |
| **Cold Open** | **“Now defend it.”** |

**Ceremony vs result (locked):**

| Temporary | Permanent |
|-----------|-----------|
| Ring Ceremony cinematic (7-day window; may be missed) | Championship **result** — who won, score, opponent, season, hardware, identity |

**Season opening (locked):**

| Internal name | User-facing cinematic |
|---------------|------------------------|
| Category **Season Begins** / system label “Season Opening” | **Cold Open only** — one season-opening cinematic for the player |

---

## A. Ring Ceremony

### Purpose

**Close the completed season and officially honor the champion.**

### Eligibility window

| Rule | Binding |
|------|---------|
| **Opens** | Immediately when the championship / final season result becomes **authoritative** |
| **Duration** | Exactly **seven (7) days** from that open instant |
| **Closes** | Permanently at end of the seven-day window |
| **Missed visit** | Member who does not visit during the window **misses the ceremony** (cinema only) |
| **No automatic ceremony replay** | Do **not** auto-replay the **ceremony** later in Account, Gazette, next-season queue, or permanent surfaces |

**Wording care:** “No Account / Gazette **replay**” means the **cinematic ceremony** does not replay. The **champion’s identity and result** remain permanently available on those and other league surfaces (see §A Permanent truth).

### Behavior

| Rule | Binding |
|------|---------|
| **Unit** | Once per **user · league · completed season** |
| **Display cap** | Maximum **one** automatic display per user (for that unit) |
| **Seen** | Viewed or dismissed → mark **seen** durably |
| **No re-show** | Do not show again during remaining window after seen |
| **Expired (unseen)** | Window ends before view → resolve as **expired**, not seen |
| **Stacking** | Do **not** stack another fullscreen experience immediately behind it |
| **Exit** | Return to **Home** after completion / dismissal |

### Permanent truth — ceremony vs result (CRITICAL)

> **The Ring Ceremony expires after seven days.**  
> **The championship result never expires.**

Missing the ceremony means missing the **cinematic presentation only** — **not** missing the **information**.

| Layer | Binding |
|-------|---------|
| **Ring Ceremony** | Temporary automatic fullscreen; 7-day window; may expire unseen |
| **Championship result** | Durable forever; accessible across devices; independent of ceremony view |
| **Ceremony role** | Presentation / honor only — **not** the mutation that grants the trophy |
| **Hardware award** | From **authoritative championship completion**, independent of whether anyone views the ceremony |
| **Sole reveal forbidden** | Do **not** make the temporary Ring Ceremony the **only** place that reveals the winner |

#### Permanent surfaces that may name the champion (not ceremony replay)

| Surface | Role |
|---------|------|
| **Trophy Room / Museum** | Engraved champion hardware and history |
| **Champion’s permanent ring and hardware** | Winner identity across career / room |
| **Final Gazette** | Narrative record of the close |
| **Archived final standings / bracket** | Scoreboard truth of the season |
| **Offseason reigning-champion identity on Home** | Where appropriate |
| **Next season’s Cold Open** | May **acknowledge** the champion (“Now defend it.”) — does **not** re-award the ring |

#### Durable result payload (always accessible)

- Champion identity (who won)  
- Final result / score / margin (as the product records it)  
- Opponent (when applicable)  
- Season / season key  
- Ring, trophy, and hardware (type, engraving, award timestamp)  

#### Replay policy

| Allowed | Forbidden |
|---------|-----------|
| Browse permanent surfaces anytime for **result** | Automatically **replay the expired Ring Ceremony** from those surfaces |
| Future **optional** replay / archive (separate design) | Treating optional replay as part of the **automatic experience queue** |

### Copy concept

> **“You won.”**

---

## B. Cold Open — FULLY LOCKED

Cold Open decisions are **not TBD**. They are binding product law.

### Purpose

- Launch the upcoming season  
- Recap the previous season  
- Acknowledge the defending champion  
- Establish rivalries / storylines  
- Turn attention toward the new competition and the **current Home mission**

### Eligibility window

| Rule | Binding |
|------|---------|
| **Opens** | Exactly **seven (7) days before** the upcoming season’s **authoritative first kickoff** |
| **Remains eligible** | Until that first kickoff |
| **Expires** | Permanently at first kickoff, **whether viewed or not** |
| **No hardcoded dates** | When authoritative kickoff data exists, **use it** — do not invent a fixed calendar date |

### Display rules

| Rule | Binding |
|------|---------|
| **Unit** | Once per **user · league · upcoming season** |
| **Seen** | Viewed or dismissed → mark **seen** durably; do not replay |
| **Unseen during window** | Remains eligible on **later visits** during the seven-day window |
| **Session** | Maximum **one automatic fullscreen experience per session** |
| **Required setup gates (priority)** | Authentication · joining · sport allegiance take priority over Cold Open |
| **Picks** | Cold Open must **not** block a player from completing picks |
| **Deferred by required experience** | If another required experience consumes the session, Cold Open may wait until a **later visit** still inside its window |
| **At kickoff** | Remove from queue **permanently** |
| **No makeup** | No makeup replay after kickoff |
| **Exit** | Return to **Home** after completion or dismissal |
| **Stacking** | Do **not** immediately launch another fullscreen behind it |

### Content concept

1. Brief previous-season recap  
2. Champion acknowledgment (defending — not re-awarding the ring)  
3. Rivalry / storyline setup  
4. New-season launch  
5. Ends pointing attention toward the **current Home mission**

### Copy concept

> **“Now defend it.”**

---

## C. Season Opening relationship — Cold Open is the cinematic

**Cold Open is the canonical user-facing Season Opening experience.**

| Allowed | Forbidden |
|---------|-----------|
| “Season Opening” / **Season Begins** as **internal category** or system name | A **second** automatic fullscreen cinematic named Season Opening |
| One player-facing open: **Cold Open** | Queue **Cold Open → separate Season Opening** |
| Foundry may still label lab tools “Season Opening Lab” while driving Cold Open | Queue **Season Opening → Cold Open** |

**Only one season-opening cinematic exists for the player: Cold Open.**

Existing `SeasonOpeningMoment` / official opening sequence **code and docs** must be **reconciled or retired as a separate auto peak** when the orchestrator is implemented — not dual-queued with Cold Open.

---

## D. Ring Ceremony vs Cold Open

| | **Ring Ceremony** | **Cold Open** |
|--|-------------------|---------------|
| **Job** | Closes the **completed** season | Opens the **next** season |
| **Copy** | **“You won.”** | **“Now defend it.”** |
| **When** | Immediately after championship is authoritative (7 days) | Week before next season first kickoff (until kickoff) |
| **Champion** | Just crowned (cinema) | Defending acknowledgment only |
| **Separation** | Normally separated by the **offseason** | |
| **Stacking** | **Never** stack in one session | |
| **Hardware** | Does not grant trophy | Does not re-award the ring |
| **If Ring missed** | Result still on permanent surfaces | Next Cold Open may still name the champion |

---

## E. New players

| Rule | Binding |
|------|---------|
| **Gates first** | Do **not** show Ring Ceremony or Cold Open before required **authentication**, **joining**, and **sport allegiance** |
| **Home mission** | Brand-new player must understand Home mission before optional theater blocks weekly action |
| **Picks** | Theater must not block completing picks |
| **Join during Cold Open window** | Eligible only **after** required setup, per one-slot session rule |
| **Join after kickoff** | No expired Cold Open |
| **Join >7 days after previous championship** | No expired Ring Ceremony |

Required redirects and setup are **gates**, not ceremonial queue entries.

---

## F. Durable experience state (recommended future)

Do **not** rely solely on `localStorage` for these experiences — they must not replay independently on every device.

### Key

- `user_id`  
- `league_id`  
- `season` (completed season for Ring; upcoming season for Cold Open)  
- `experience_type` (`ring_ceremony` | `cold_open` | …)

### Status vocabulary

| Status | Meaning |
|--------|---------|
| `eligible` | In window, not yet completed |
| `seen` / `dismissed` | User viewed or dismissed (terminal success path; no auto replay) |
| `expired` | Window ended without view — **not** the same as seen |

Optional: `window_start_at`, `window_end_at`, `resolved_at`, `metadata jsonb`.

### Schema sketch (plan only — do not migrate yet)

```sql
-- PLAN ONLY
create table if not exists public.user_experience_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  league_id uuid not null,
  season_key text not null,
  experience_type text not null,
  status text not null, -- eligible | seen | dismissed | expired
  window_start_at timestamptz,
  window_end_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, league_id, season_key, experience_type)
);
-- RLS: select/insert/update own rows only
```

May evolve `user_season_moments` instead if product prefers one store — **must** still distinguish expired vs seen/dismissed.

---

## G. Orchestrator priority (automatic experiences)

**Required redirects and setup are gates, not ceremonial queue entries.**

After required setup, recommended automatic-experience priority:

1. **Ring Ceremony** — only during its seven-day post-championship window  
2. **Cold Open** — only during its seven-day pre-kickoff window (**sole** season-opening cinematic)  
3. **Post-score Gazette** — when eligible  
4. **Lower-priority optional culture**

**Only one automatic fullscreen experience per session.**

Never stack Ring Ceremony and Cold Open in the same session.  
Never queue a separate Season Opening cinematic.

---

## H. Authoritative timestamps

### Ring Ceremony

| Clock | Source |
|-------|--------|
| **Window start** | Instant championship / final season result becomes **authoritative** (prefer championship trophy `awarded_at` or the single closeout write that makes champ final) |
| **Window end** | `window_start + 7 × 24h` |
| **Season key** | **Completed** season |

### Cold Open

| Clock | Source |
|-------|--------|
| **First kickoff** | Authoritative season open / first kickoff for that league’s sport (calendar and/or first published card kickoff when more accurate) |
| **Window start** | `first_kickoff − 7 × 24h` |
| **Window end** | `first_kickoff` (exclusive after) |
| **Season key** | **Upcoming** season being launched |

Do not use hardcoded marketing dates when authoritative kickoff data exists.

---

## I. Current code behavior vs these decisions (audit)

| Area | Current behavior | Binding | Verdict |
|------|------------------|---------|---------|
| **Ring window** | Opening week only | Post-championship 7 days | **Conflict** |
| **Ring job** | Defending champ walk-out | Close season · “You won.” | **Conflict** |
| **Ring seen** | localStorage | Durable seen/expired | **Conflict** |
| **Ceremony vs result** | Not fully productized | Result permanent; ceremony may expire | **Must enforce** |
| **Cold Open window** | ~kickoff−7d → open | Same structure | **Mostly aligned** |
| **Cold Open rules** | Partial local seen | Fully locked above | **Align implementation later** |
| **Season Opening Moment** | Separate MomentHost peak | **Must not** be second auto cinematic | **Conflict** — merge/retire auto path into Cold Open |
| **SAFE NAV** | Default ON → MomentHost null | Auto off until safe mode allows | **Hard gate** |
| **Durable state** | localStorage | Cloud recommended | **Conflict** |

---

## J. Staged implementation order (future — do not start now)

| Stage | Work |
|-------|------|
| 0 | Product resolve Finale multi-slide vs Ring post-result peak |
| 1 | Durable `user_experience_state` (or evolved claims) + RLS |
| 2 | Timestamp helpers for ring window + cold open window |
| 3 | Orchestrator shell: gates → one slot → priority |
| 4 | Relocate Ring Ceremony + ceremony/result separation |
| 5 | Cold Open as sole Season Opening cinematic; retire dual auto Season Opening |
| 6 | Gazette priority #3 |
| 7 | New-player gates + picks non-blocking |
| 8 | SAFE NAV production policy |
| 9 | Foundry preview/reset + regression |

---

## K. Experience-order recommendation

```text
GATES (always first — not ceremonial queue)
  auth → join/membership → sport allegiance
  → understand Home mission; never block picks for theater

THEN at most ONE automatic fullscreen per session:

  1. Ring Ceremony   [champ_authoritative, +7d) · not seen/expired]
  2. Cold Open       [kickoff−7d, kickoff) · not seen]
                     ← sole Season Opening cinematic
  3. Post-score Gazette [when eligible]
  4. Optional culture

EXIT: Home.
Never: Cold Open → Season Opening, or Season Opening → Cold Open.
Never: stack Ring + Cold Open same session.
Ceremony may expire; result never does.
```

---

## L. Checklist (do not execute yet)

### Ring Ceremony
- [ ] Window from authoritative championship + 7 days  
- [ ] Durable seen vs expired  
- [ ] One display max per user·league·completed season  
- [ ] No automatic **ceremony** replay (Account / Gazette / queue / permanent surfaces)  
- [ ] Champion identity + result permanently available without ceremony  
- [ ] Hardware from authoritative completion, independent of view  
- [ ] No fullscreen stack after; exit Home  
- [ ] Copy: “You won.”  

### Cold Open
- [ ] Window: kickoff−7d → kickoff from authoritative first kickoff  
- [ ] Fully locked purpose, caps, multi-visit, kickoff kill  
- [ ] Gates + picks non-blocking  
- [ ] Sole user-facing Season Opening cinematic  
- [ ] No dual queue with separate Season Opening  
- [ ] Copy: “Now defend it.”  

### Shared
- [ ] Never same-session stack Ring + Cold Open  
- [ ] Cloud durable state  
- [ ] SAFE NAV / DeferredChrome policy respected  
- [ ] No production mutation on view  

---

## M. Confirmation (documentation pass)

| Item | Status |
|------|--------|
| App code changed | **No** |
| Schema / migration | **No** |
| Production data | **No** |
| Cold Open fully locked | **Yes** (no TBD remaining) |
| Cold Open = sole Season Opening cinematic | **Yes** |
| Permanent champion truth survives Ring expiry | **Yes** |

---

## N. Change control

Amendments require product approval and an updated **Revised** date.  
Do not restore dual Season Opening + Cold Open auto cinematics without updating this document.  
Do not restore opening-week Ring Ceremony as the automatic production experience without updating this document.
