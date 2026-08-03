# Zero-Tolerance Fake Data Audit

**Date:** 2026-08-03  
**North Star:** *War Room should never lie to the user—even with placeholder data.*  
**Constitution:** History · Achievement · Zero-tolerance no-fake-data  

This is a living inventory of production-facing places that can invent or imply unearned data.  
Guest Mode demo is called out separately (allowed only when labeled DEMO).

---

## Severity key

| Level | Meaning |
|-------|---------|
| **P0** | Live players can believe false season history |
| **P1** | Misleading urgency / week inventory / residual stats |
| **P2** | Copy or UX that *sounds* like history but is anticipation |
| **OK** | Already gated or explicitly non-production |

---

## Audit matrix

| Page / surface | Fake or misleading value | Why misleading | Correct empty state | Correct data source | Status |
|----------------|--------------------------|----------------|---------------------|---------------------|--------|
| **Standings · Crown / Shame** | Name + **5 pts** (residue) | Looks like season started | Two-column **No Crown Yet / Nobody… yet** with **—** | `hasOfficialScoredWeek` + `weeksPlayed > 0` + `weekCrownAndShame` | **Fixed** `84e700e` |
| **Home · CrownAndShame** | Same | Same | Same empty component | Same | **Fixed** (shared component) |
| **Standings · competitive table** | Full rank/pts/ATS/streak if `seasonStarted` true from orphan scores | Fake midseason table | Roster-only or SeasonNotStartedEmpty | Trusted `listScoredWeekNumbers` only | **Partial** — table gated; orphan scores still a risk until data clean |
| **Stats page** | Points / ATS / PPG when membership has residue | Spreadsheet of ghosts | “No stats until first scored week” | Official scored + `weeksPlayed` | **Audit · verify gate** |
| **Power Rankings** | Rankings from points | Invented order | Anticipation empty | Official scored only | **Audit · verify gate** |
| **Profile · Plot so far** | Streak, ATS, rank before score | Personal history lie | “Your story starts here” | `storyStarted` / official score | **OK** empty shipped |
| **Profile · Football Resume** | Season ledger numbers | Career/season mix-up | “Populates after first score” | Scored membership | **Mostly OK** — copy present |
| **Home · HotTakeTicker** | Achievement takes pre-season | Invented drama | Quiet anticipation lines | `hasOfficialScoredWeek` | **OK** |
| **Home · Swing badges** (if shown pre-season) | **THE CREATOR / RUNS THE ROOM / WAITING** | Not fake *points*; role labels only | Keep as identity, not “climbed 3” | Role IDs only pre-season | **OK** if never show rank deltas pre-score |
| **Home · Week hero last-week recap** | Last week pts/rank from `weeklyPoints` | Can show residual recap | Hide until official score | Trusted scored + weeksPlayed | **P1 verify** |
| **Jump to week / published chips** | Weeks 5–7 with no contiguous path | Fake week inventory | Contiguous around live only | `trustWeekBrowserWeeks` | **Fixed** UI; **data residue** may remain |
| **MultiLeagueHomeHub pulse** | “Needs picks · Week N” from **max** `week_cards` | Orphan week invents urgency | Active/trusted week only; else ENTER | `current_week` + trusted card | **P1 open** |
| **Board** | Demo/placeholder weeks | False archive | Empty board copy bank | Scored weeks only | **OK** (empty Board work) |
| **Gazette / paper** | Crown/shame/movers stories | Fake news if no score | Don’t generate paper pre-score | Scored week edition only | **OK if gated** |
| **Commish checklist / progress** | Steps “done” from residue | Fake host progress | Steps from real card/score state | Card + trusted score | **P1 verify** |
| **Guest Mode tour** | Full Week 0–8 scored demo, ATS, pts | Looks like a real league | Must stay **DEMO**-labeled; never real membership | `guest-demo-seed.ts` local only | **OK as tour** if chrome clear |
| **Foundry / demo slate** | Demo games + auto-score | Lab tools | Never customer chrome | Foundry only | **OK** |
| **Sandbox auto-score range** | Manufactures week_cards + scores | Residue in real leagues | Preseason/Foundry only | Lab gate | **P0 process** — already preseason-gated; residue cleanup separate |
| **Membership `total_points` / `weekly_points`** | Leftover 5-pt rows after wipe incomplete | Powers Crown/stats if gates weak | Wipe on reset; ignore if `weeks_played = 0` | Cloud membership + official weeks | **P0 data + gates** |
| **Championship / Toilet / brackets** | Crowns fields early | Invented hardware path | Empty until cut week | `listScored` + cut week | **Verify** |
| **Locker unread / home tiles** | Badges without real unseen | Fake urgency | Hide count if unknown | `room-unseen` real keys | **P2 verify** |

---

## Empty-state examples (canonical)

### Crown

```
👑 This week's crown
No Crown Yet
—
Week 1 decides the first Crown.
```

### Wall of Shame

```
😈 / 🧻 Wall of shame
Nobody… yet
—
Someone will be roasted after the first scored week.
```

### Latest scored week

```
No scored weeks yet.
Season hasn't started.
```

### Upcoming week (not open)

```
Week N
Status: Waiting for league start / calendar unlock
Official opening: {date}
Nothing to do yet.
```

### League creation

```
Your season begins Week X.
```

Not: “Week X exists with fake data.”

---

## Root causes (patterns)

1. **Membership residue** — `weekly_points` / `total_points` without official `week_results`  
2. **Orphan `week_cards`** — Foundry / auto-score / free publish any week  
3. **Weak “has season started?”** — any positive points array vs official scored list  
4. **Max week_card as “open week”** — hub invents needs-picks on future residue  
5. **Guest demo** — intentional, must never leak into real session  

---

## Already shipped trust fixes (this arc)

| Ship | What |
|------|------|
| Board empty / never invent | History principle |
| Crown/Shame empty + weeksPlayed gate | `84e700e` |
| Jump-to-week contiguous inventory | `01c35cf`, `fa9d1a8` |
| Hot takes anticipation pre-score | ticker gate |
| Plot empty | ProfileSeasonPlot |

---

## Recommended fix order (after this audit)

1. **P0:** Confirm Stats / Power Rankings / hero recap never read residual membership when `!hasOfficialScoredWeek`  
2. **P1:** MultiLeague pulse → trusted live week, not max week_card  
3. **P1:** Foundry orphan audit + optional data cleanup (Mike approval)  
4. **P2:** Unread counts only when store is real  
5. **System:** Week config open guard (commissioner calendar) — prevents new fake weeks  

---

## Guest Mode note

Guest tour **intentionally** fabricates a lived-in room through Week 9 (`GUEST_SCORED_WEEKS`, synthetic pts). That is allowed **only** under explicit Guest/DEMO identity.  
If a real league ever shows guest seed numbers, that is a **P0 session leak**.
