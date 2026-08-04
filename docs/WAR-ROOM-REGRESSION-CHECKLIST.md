# War Room Regression Checklist

Living checklist for every freeze / certification. Confidence grows with milestones; we do not start from zero each time.

## Mindset (non-negotiable)

**Engineering’s job is to prove the build is NOT ready for Week 0.**

Find reasons to fail it. Do not hunt for a PASS.

### The $1,000 bet

Every engineering report answers first:

> If I had to bet $1,000 that this won’t break during Week 0, would I take that bet?

- **Yes** → list remaining residual risk.
- **No** → state **why** (not a soft PASS).

Grok is excellent at code paths, state transitions, and structured attack.  
Grok is **not** a substitute for Mike on a phone. Both legs are required.

---

## Two-leg freeze process

| Leg | Who | Time | Goal |
|-----|-----|------|------|
| **1. Engineering attack** | Grok (code + workflow + automation) | 15–20 min | Prove it fails; concrete evidence |
| **2. Product use** | Mike (human league member + commissioner) | 10–15 min | Feel, humor, flow, Saturday atmosphere |

**Freeze only if neither finds anything significant** (and Mike product-approves).

---

## Evidence format (every finding)

Do not report vague “role testing: FAIL.”

For each issue:

```text
FINDING: <one line>
Sequence: <exact steps>
Page: <route>
Role: commissioner | deputy | player | view-as-player | guest
Reproducible: YES / NO / INTERMITTENT
Attempts: <n>
Confidence area is stable (1–10): <n>
Status: FIXED | OPEN | PARKING LOT
```

---

## Engineering attack menu (15–20 min)

Run as an angry user. Do not stop after one happy path.

### Navigation

- [ ] Rapid page switching (Home ↔ Picks ↔ Standings ↔ Board ↔ Locker)
- [ ] Browser Back / Forward through the above
- [ ] Refresh during navigation
- [ ] Refresh with a modal open (Gazette, Cold Open, Picks saved, etc.)
- [ ] Refresh during loading / cardBusy skeleton

### Role testing

- [ ] Commissioner
- [ ] Deputy (if available)
- [ ] Player
- [ ] View-as-player (toggle while staying on same page)
- [ ] League switch (NFL ↔ CFB, multi-league)

### State testing

- [ ] Empty: no card this week (host)
- [ ] Empty: no card this week (player)
- [ ] Complete: picks locked
- [ ] Locked: card frozen after kickoff
- [ ] Published: card live, picks open
- [ ] Week transition / jump to non-live week

### Mobile

- [ ] Bottom navigation not covered by overlays
- [ ] Rotation
- [ ] Scroll (Home, Picks, Gazette)
- [ ] Modal scrolling
- [ ] Keyboard (join codes, settings)

### Performance / console

- [ ] Console errors / warnings
- [ ] Long tasks / freeze feel
- [ ] Obvious duplicate network storms
- [ ] Offline / slow network (throttle once)

### UI truth

- [ ] No duplicate CTAs to same destination
- [ ] No wrong-role messaging
- [ ] Dead links
- [ ] CTAs go to the exact task (not generic Home)

### Theme (CFB)

- [ ] Automatic season skin for trusted week
- [ ] Creator skin preview Apply (sim date + week)
- [ ] Holiday window jump + day after returns to season
- [ ] Reset to real time clears indicator
- [ ] Non-creator never sees Skin panel

---

## Critical scenarios (seed list — grow toward 40–50)

Add a row when a real bug or near-miss teaches us something. Never delete a row; mark superseded.

### Identity & leagues

| ID | Scenario | Why it matters | Last checked | Conf (1–10) |
|----|----------|----------------|--------------|-------------|
| L1 | Switch leagues via Home League Hub; land with no stale room data | Stale picks/week/theme | | |
| L2 | One-league user still sees League Hub | Growth + multi-room idea | | |
| L3 | Empty sport (no NFL leagues) shows join/start/browse | Growth empty state | | |
| L4 | Hub CTA MAKE PICKS / SET WEEK routes to exact task | Not generic Home | | |

### Picks empty (no card)

| ID | Scenario | Why it matters | Last checked | Conf (1–10) |
|----|----------|----------------|--------------|-------------|
| P1 | Commissioner, live week, no card → “You had one job…” + Build Card | Host bottleneck | | |
| P2 | Player, live week, no card → swagger roast + Go to Locker | Never “build the card” | | |
| P3 | Deputy (ops), no card → Build Card (ops path) | isOps not isCommissioner only | | |
| P4 | View-as-player while on empty Picks flips host → player copy without leaving page | Role stuck was a real bug (f933fbd) | | |
| P5 | Hard refresh on empty Picks: player copy may rotate (session salt) | Variety without flicker mid-session | | |
| P6 | Non-live week with no card: archive messaging + jump to live | Wrong week empty | | |

### Picks with card

| ID | Scenario | Why it matters | Last checked | Conf (1–10) |
|----|----------|----------------|--------------|-------------|
| P7 | Lock picks; return Home → caught up / quiet, no fake urgency | Anticipation philosophy | | |
| P8 | Refresh mid-save / mid-load card | Stuck busy / double lock | | |
| P9 | Jump week while card loading | Wrong week paint | | |

### Home

| ID | Scenario | Why it matters | Last checked | Conf (1–10) |
|----|----------|----------------|--------------|-------------|
| H1 | League Hub only at top; no second switcher lower | Single source of truth | | |
| H2 | No I’m Bored | No manufactured engagement | | |
| H3 | League tools (preseason) is sole host tools entry from banner | No twin Commish tile | | |
| H4 | Locked player: hero says caught up; no hours/checklist theater | Never cry wolf | | |
| H5 | Gazette spotlight only when paper real / imminent | Real moment only | | |

### Theme / skins (CFB)

| ID | Scenario | Why it matters | Last checked | Conf (1–10) |
|----|----------|----------------|--------------|-------------|
| T1 | Weeks 0–6 → Opening Season (automatic) | No user pick | | |
| T2 | Weeks 7–13 → The Grind | | | |
| T3 | Week 14+ → Championship Run | | | |
| T4 | Halloween Oct 30–Nov 1 ET → holiday wash | 3-day window | | |
| T5 | Nov 2 → back to season skin | Auto return | | |
| T6 | Creator Skin panel: Apply sim, indicator shows, Reset clears | Mike only | | |
| T7 | Non-creator never sees Skin ▴ | Product rule | | |
| T8 | Commish Settings has no skin picker | Product rule | | |

### Moments / overlays (freeze-class)

| ID | Scenario | Why it matters | Last checked | Conf (1–10) |
|----|----------|----------------|--------------|-------------|
| M1 | Cold Open → Gazette handoff; page remains scrollable after | Body lock ownership | | |
| M2 | Refresh with Gazette open | Orphan lock | | |
| M3 | SAFE NAV / no stuck body lock after navigation | Global freeze | | |

### Commissioner (later surface — seed)

| ID | Scenario | Why it matters | Last checked | Conf (1–10) |
|----|----------|----------------|--------------|-------------|
| C1 | Build card from Picks empty Build Card CTA lands on card tab | Direct routing | | |
| C2 | Publish week; player empty becomes picks UI | State transition | | |

---

## Known fixed (keep for regression)

| Date | Finding | Sequence | Fix |
|------|---------|----------|-----|
| 2026-08 | Picks empty role stuck after View as player | Commish on empty `/picks` → toggle View as player → still saw Build Card until re-nav | `f933fbd` listen `warroom-view-as-player` + resync `hostCanBuild` |

---

## Certification report template

```text
$1000 BET: YES / NO
Why not (if NO): <one paragraph>

FINDINGS (evidence format for each)

CHECKLIST IDs run: <L1, P1, …>
CHECKLIST IDs skipped (and why):

Grok leg: <minutes>
Mike leg: PENDING / DONE

Ready for Mike product cert: YES / NO
Ready for freeze tag: YES / NO (requires Mike)
```

---

## Freeze tags (examples)

| Tag | Meaning |
|-----|---------|
| `war-room-moments-stable-baseline` | Moments stack freeze |
| `cfb-pre-commissioner-known-good` | Post Home/Picks/skins cert (only after Mike) |

Never create a known-good tag without both legs + Mike product approval.

---

## How to grow the list

After every bug, near-miss, or Mike “that felt weird”:

1. Add a scenario row with ID.
2. Fill **Why it matters**.
3. Re-run that ID on every freeze until Conf ≥ 8 for three freezes, then keep it but don’t obsess.

Target by Week 0 open: **40–50 critical scenarios**.
