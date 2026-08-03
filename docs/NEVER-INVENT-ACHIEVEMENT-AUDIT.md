# P0 Trust Audit — Never Invent Results / Achievement

**Status:** ✅ **APPROVED & IMPLEMENTED** (2026-08-03)  
**Date:** 2026-08-03  
**Class:** Trust issue (same family as Board empty history)

### Implementation

- Gate: `hasOfficialScoredWeek()` → `listScoredWeekNumbers().length > 0`
- Crown, Standings competitive columns, Stats power/season, Hot takes, Championship/Toilet seeds, Players pts all gated
- Shared `SeasonNotStartedEmpty` + achievement constitution line

---

## Thesis

> **War Room never awards what hasn't been earned.**

If nobody has won → nobody wears the crown.  
If nobody has lost → there is no Wall of Shame.  
If nobody has points → everyone has zero — and the UI should not look like a finished leaderboard.

**Promise:** If War Room says something happened, the player must trust it actually happened.

Related truth rules already in the product/constitution:

| # | Rule | Surface |
|---|------|---------|
| 1 | Never invent **history** | The Board |
| 2 | Never invent **reality** | Practice Mode / dual realities |
| 3 | Never invent **achievement** | Standings, Crown, stats, brackets *(this audit)* |

---

## Proposed constitution line (not applied until approved)

> **War Room never awards what hasn't been earned.**

Companion:

> **War Room never invents champions, losers, rankings, or statistics.**

Everything shown as earned must come from real league activity (scored weeks / real prior-season hardware that was actually engraved).

---

## Source-of-truth problem

Several UIs infer “season progress” from **membership/player season fields** (`totalPoints`, `weeklyPoints`, `weeksPlayed`, `ats*`, `currentStreak`) — not always from `listScoredWeekNumbers()`.

| Source | Risk if dirty / zero-but-shaped data |
|--------|--------------------------------------|
| `listScoredWeekNumbers()` | Authoritative “did football produce a result?” |
| `Player.weeklyPoints` / `weeksPlayed` / `totalPoints` | Can lag, leak sandbox residue, or be empty arrays vs zeros |
| `Player.currentStreak` / `atsCorrect` / `atsTotal` | Same — look “real” at 0 or leftover non-zero |
| Hardware / trophies (prior years) | **Real history** if engraved from past seasons — different from *this* season invention |

**Inconsistency today:** Standings uses a soft “preseason” flag; Championship/Toilet still seed brackets from points; Stats always builds power rankings; Home always mounts Crown.

---

## Inventory — surfaces that imply progress before real scored weeks

Severity key:

| Sev | Meaning |
|-----|---------|
| **🔴 High** | Looks like earned season achievement (crown/shame/rank/stats) when nothing scored |
| **🟠 Med** | Rank/order UI exists; may show zeros or role labels that feel like awards |
| **🟡 Low** | Copy/nav that *teases* future shame/glory without naming winners |
| **✅ OK** | Already empty / gated, or clearly prior-season hardware |

Gate “preseason” in code today is **not unified**. Approximate checks found:

- Standings: `anyScored = totalPoints > 0 \|\| weeklyPoints.length > 0` (not `listScoredWeekNumbers`)  
- `weekCrownAndShame`: `leagueHasScoredWeek` = `weeksPlayed > 0` OR any `weeklyPoints` entry **> 0**  
- Board (post-fix): `scoredWeeks.length === 0` → empty  

---

### 1. Crown & Wall of Shame — `CrownAndShame`

| | |
|--|--|
| **Where** | Home (`page.tsx` secondary chrome), Standings (when not “preseason”) |
| **Code** | `src/components/CrownAndShame.tsx`, `weekCrownAndShame` in `src/lib/fun-board.ts` |
| **What it shows** | 🐐 This week’s crown · 🛍️ Wall of shame · pts · names |
| **When empty** | Returns dashed “populates once a week is scored…” if `weekCrownAndShame` → null |
| **Risk 🔴** | **Home always mounts `<CrownAndShame />`** after first-week chrome ends — if membership data has leftover points / weeksPlayed, **real names + pts render** and look like cheating. Standings hides component when soft-preseason; **Home does not**. |
| **Also** | Soft-preseason ≠ scored-weeks: `weeklyPoints: [0]` can flip standings out of preseason while crown logic still nulls — or inverse with dirty weeksPlayed. |

---

### 2. Standings table — ranks, Pts, ATS%, Streak, Swing, Cut Line

| | |
|--|--|
| **Where** | `/standings` |
| **Code** | `src/app/standings/page.tsx`, `rankPlayersWithSwings`, `SwingBadge`, `streakDisplay`, `atsPct` |
| **What it shows** | `#` rank, Player, Div, **Swing**, Last in, **Pts**, **ATS%**, **Streak**, cut line to Toilet Bowl |
| **Preseason banner** | Soft: “No weeks scored yet… tied at zero” + “Preseason board” note |
| **Risk 🔴/🟠** | **Still renders full competitive columns** at zeros. Rank `#1…n` implies order. **Cut line** implies toilet path. Swing badges: **WAITING** / **THE CREATOR** / **RUNS THE ROOM** (role labels that can read as awards). Hardware flair emojis on names (prior seasons) mix with zero-season board. |
| **OK partial** | Crown block suppressed when soft-preseason. Subcopy acknowledges no scored weeks. |

---

### 3. Home — Crown mount + postseason / shame path tiles

| | |
|--|--|
| **Where** | `/` Home secondary section |
| **Code** | `page.tsx` → `CrownAndShame`; postseason tiles (`primaryPath` / `shamePath` labels) |
| **Risk 🔴** | Crown component always present (see §1). |
| **Risk 🟡** | Championship / Toilet Bowl tiles with labels/blurbs exist **before cut** — marketing of future paths, not winners. Fine if pure navigation; risky if copy implies current standings. |

---

### 4. Stats / Power Rankings

| | |
|--|--|
| **Where** | `/stats` (Power Rankings tab + Season stats); `/power-rankings` redirects here |
| **Code** | `src/app/stats/page.tsx`, `powerBoardWithLabels`, power formula (last 4, ATS, streak, season avg) |
| **What it shows** | Ordered **#1…**, Swing, Last 4 pts, **ATS %**, last card, **power score**, **W/L streak** |
| **Risk 🔴** | **No preseason gate.** With zero scored weeks, power of zeros still produces a **ranked list** that looks like “who is hot.” Season stats table same fields. |
| **Also** | `HotTakeTicker` on Power tab — can invent roast narrative from standings shape. |

---

### 5. Hot Take Ticker

| | |
|--|--|
| **Where** | Home (warroom variant), Stats Power tab |
| **Code** | `HotTakeTicker.tsx` → `buildHotTakes` / CFB+NFL voice packs |
| **Risk 🟠** | Takes built from `loadLeaguePlayers()` standings-shaped data — can claim heaters/shame before first score depending on voice pack content. Needs voice-pack review in implementation pass. |

---

### 6. Championship bracket

| | |
|--|--|
| **Where** | `/championship` |
| **Code** | `championship/page.tsx`, `seedChampionship` → `comparePlayers` on **totalPoints** etc. |
| **What it shows** | Seeded bracket, top-half field, division “winners” in seed logic |
| **Risk 🔴** | With ≥2 players and **zero scored weeks**, still **seeds and draws a bracket** as if standings exist. Looks like projected champs / cut already decided. |
| **Gate** | Uses `listScoredWeekNumbers` for *advancement* and cut lock, **not** for whether to seed at all. |

---

### 7. Toilet Bowl bracket

| | |
|--|--|
| **Where** | `/toilet-bowl` |
| **Code** | `toilet-bowl/page.tsx`, `seedToiletBowl` → worst-first ranking |
| **Risk 🔴** | Same as Championship: **bottom-half shame field invented** from unearned points order. Highest “trust damage” alongside Crown. |

---

### 8. Home week hero — last week recap

| | |
|--|--|
| **Where** | Home hero |
| **Code** | `HomeWeekHero.tsx` — `lastWeekRecap` from prior `listScoredWeekNumbers` + weeklyPoints |
| **Risk 🟠** | Should only fire when prior scored week exists; **if scored list empty, recap skipped** (OK). Risk only if scored-week list / weeklyPoints disagree. |

---

### 9. Players roster

| | |
|--|--|
| **Where** | `/players` |
| **Code** | `players/page.tsx` shows `{totalPoints} pts` on members |
| **Risk 🟠** | Zero pts is honest; non-zero leftover pts look like season production. Prefer hide pts column when no scored weeks. |

---

### 10. Profile / Football Resume / Season plot

| | |
|--|--|
| **Where** | `/profile/[id]`, Account identity, heavy details |
| **Code** | `FootballResume.tsx` (Season ATS, streak, pick’em pts); `ProfileSeasonPlot.tsx` (streak, rank) |
| **Risk 🟠** | Season stats at 0 may still look like a filled resume. Prior-season trophies OK if real. Sandbox/preseason note on profile exists in places. |

---

### 11. Gazette / paper

| | |
|--|--|
| **Where** | `/gazette`, `GazettePaper`, Home spotlight |
| **Risk 🔴** (if paper exists without score) | Paper layout includes A1 Crown, swing stories, etc. (`GazettePaper.tsx`). Should only archive after score — **verify** no empty-week edition with invented crown. |
| **Risk 🟡** | Spotlight copy mentions “Crowns, shame…” as ritual tease — OK if not naming people. Cold open preseason is intentional anticipation. |

---

### 12. Trophy Room / Museum / Championship banner / Last season hardware

| | |
|--|--|
| **Where** | Trophy Room, Museum, `ChampionshipBanner`, `LastSeasonHardwareWall` |
| **Risk** | **✅ Usually OK** if only **prior-season engraved** hardware. **🔴** if sim/sandbox engravings from dry-run seasons still show as real (related to sandbox wipe — separate scrub). |

---

### 13. Crew page / crew reveal

| | |
|--|--|
| **Where** | `/crew`, `CrewRevealModal` |
| **Risk 🟡/🟠** | Can surface champ/toilet **names** from crew chapter metadata — verify not invented for current unscored season. |

---

### 14. Picks graded card / practice

| | |
|--|--|
| **Where** | Live picks after score; Practice Mode local grade |
| **Risk** | Practice pts are **Practice Mode** (separate reality). Live week ATS line after real score is OK. Do not bleed practice rank into Standings (already isolated if week 99 only). |

---

### 15. Host Dashboard / League

| | |
|--|--|
| **Where** | Host “This Week” / hero |
| **Risk 🟡** | Should emphasize job (publish/score), not fake standings. Audit when Host polish continues — not primary trust screen for players. |

---

### 16. Locker / Announcements

| | |
|--|--|
| **Risk 🟡** | Bot/copy may joke about shame/crown without data. Content tone only. |

---

## Gate matrix (current vs desired)

| Surface | Gate today | Desired (product) |
|---------|------------|-------------------|
| Board | `scoredWeeks.length === 0` → empty | Keep |
| Crown (lib) | `leagueHasScoredWeek` on player fields | Align to **scored weeks list** (authoritative) |
| Crown (Home) | Always mounted | Hide / empty personality when no scored weeks |
| Crown (Standings) | Soft preseason | Same authoritative gate |
| Standings table | Soft preseason banner; still full table | Empty or roster-only (joined, div, ready) — no fake competitive columns |
| Stats / Power | None | Empty until first scored week |
| Championship / Toilet | Seeds always if ≥2 players | Empty until cut **or** first scored week (product choice) — never invent seeds from zero |
| Hot takes | None | Anticipation takes only when unscored |
| Players pts | Always | Hide pts until scored |
| Profile season stats | Varies | “Season not started” not filled zeros as achievements |

---

## Root causes (for implementers later)

1. **Multiple definitions of “has the season started?”** (soft player fields vs scored-week list).  
2. **Home Crown not sharing Standings preseason gate.**  
3. **Brackets seed from standings math before cut/score.**  
4. **Stats/Power always rank.**  
5. **Leftover membership season columns** from sandbox / prior tests can invent non-zero crowns even when `listScoredWeekNumbers()` is empty.

---

## Recommended empty-state direction (design only)

When **zero scored weeks** (authoritative):

**Do not render:** Crown, Wall of Shame, weekly winner/loser, ATS%, Streak, Swing (earned), competitive Pts rankings, Power list, invented brackets.

**Do render (examples Mike approved):**

- 🏆 **No Crown Yet** — Week 1 decides who gets to wear it.  
- 😅 **Wall of Shame is still under construction.**  
- 📊 **Standings begin after the first scored week.** Right now everybody is undefeated.  
- Roster: **Players joined · Division · Ready** — or single line: *No standings until Week 1 is scored.*  
- Optional rotating takes (like Board) for curiosity.

---

## Proposed fourth truth rule (wording)

Mike’s three rules, expanded slightly for constitution fit:

1. **Never invent history** (Board).  
2. **Never invent reality** (Practice vs Live).  
3. **Never invent achievement** (this audit — Crown / rankings / stats).  

Umbrella:

> **If War Room says something happened, the player should be able to trust that it actually happened.**

---

## Out of scope for this pass

- No code changes  
- No Foundry-only demo scores cleanup (related; separate if sandbox residue)  
- Board empty state already shipped  

---

## Approval questions

1. Authoritative gate = **`listScoredWeekNumbers().length === 0`** everywhere (recommended)?  
2. Soft-preseason role swings (**THE CREATOR** / **RUNS THE ROOM**) — keep as identity flair or hide with competitive columns?  
3. Championship/Toilet before cut: **full empty state** vs “preview seeds” labeled as unofficial (recommend **empty**)?  
4. Prior-season Trophy Room: always show real engravings (recommended **yes**)?  

**No implementation until approved.**
