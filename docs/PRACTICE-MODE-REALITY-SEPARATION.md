# P0 UX — Separate Practice Mode from the Real League

**Status:** Implementation started (Phases 1–2 + sticky exit) — 2026-08-03  
**Date:** 2026-08-03  
**Promise:** *I can’t accidentally ruin anything.*  
**Trust bar:** User always knows **I’m practicing** *or* **I’m in my real league** — never both at once.

### Shipped in this pass

| Item | Where |
|------|--------|
| Global **Practice** chrome + Return to Live League | `PracticeModeChrome`, layout |
| `EVENT_PRACTICE_MODE` on start/exit | `bored-practice.ts` |
| No **Trial sandbox** league rename | `PicksClient` keeps real league name |
| Sticky practice (no silent wipe on bare `/picks`) | `PicksClient` restores practice URL |

### Graduation (shipped)

**Teach once. Trust the player.**

Practice is a **state** (data isolation + trust promise), not a product that constantly announces itself.

| Keep | Remove |
|------|--------|
| One calm top banner (`PracticeModeChrome`) | Picks “Practice Mode · practice card” panel |
| One **Return to Live League** | `PRACTICE · NOT LIVE` / dual exits on Picks |
| Soft “I’m Bored” entry intent | Onboarding second Practice strip |
| Done modal as recap, not re-branding | “fake week” lock CTAs |

Entry intent (“I’m Bored”) is enough. After guided lesson + one practice run, the player should feel like they are playing War Room—not using a training simulator.

### Offseason lifecycle (product law)

> **Practice exists until football exists.**  
> **Practice belongs to the offseason.**  
> **When real football begins, War Room stops pretending.**

| Phase | Member “I’m Bored” | Practice state |
|-------|--------------------|----------------|
| Preseason / pre-kickoff | Visible, fun, low stakes | Allowed |
| Official opening kickoff | **Gone** — not in a menu | Window closes; active practice cleared |
| Live season | Absent | Season *is* the tutorial |
| Next August / new offseason | Returns as ritual | Window opens again |

Post-kickoff practice drills = **Foundry only**, never player chrome.

**Code already gates this for members:** `isBoredPracticeWindowOpen` / `hasOpeningWeekStarted` hide CTA, block start, clear sticky practice.

Guest tour may still practice for conversion — separate reality.

Season Opening beat (design): after the ceremony peak, one quiet line — *Practice is over. The season is here.* — then the button is simply gone.

---

## Constitution (locked)

> **War Room should never make the user question whether their actions are real.**

> **Teach once. Then trust the player.**

> **Practice belongs to the offseason.**

---

## Design principle — two realities only

| 🏈 Real League | 🎮 Practice Mode (“I’m Bored”) |
|----------------|--------------------------------|
| Everything is real | Everything is practice |
| Every pick / lock / result matters | Nothing affects the real league |
| No fake copy, labels, training objects | Unmistakable sandbox identity |
| Never wonder “does this count?” | Never worry about mistakes |

**Absolute rule when Practice Mode is OFF**

- No fake league card  
- No fake week (99)  
- No practice banner  
- No training copy  
- No placeholder objects  

**100% real.**

---

## Important: don’t confuse three different systems

Today the product uses similar words for different worlds. The redesign must name them clearly.

| System | What it is | Real league? |
|--------|------------|--------------|
| **A. Practice Mode (“I’m Bored”)** | Client-only fake week 99, private practice card | **No** — must feel like a separate world |
| **B. Season sandbox (pre-open)** | Whole room before real season doors open (`isSandboxMode`) — demo cards/bots, career cheevos don’t bank | **Shared dry-run for the real room** — different product problem |
| **C. Foundry / creator eyes / hop** | Lab tools for Mike | Creator only |
| **D. Onboarding practice** | New-player journey uses bored-practice rails + “Practice mode” strip | Overlaps A — must align with Practice Mode identity |
| **E. Guest demo** | Tour without account | Separate |

**This mission focuses on A** (and D where it reuses A).  
**B** should stay labeled (SandboxSimBanner) but not be called “Practice Mode” if that confuses A.  
**C** stays Foundry.

---

# 1. Complete list of Practice Mode artifacts currently visible

### Entry / activation

| Artifact | Where | Notes |
|----------|--------|------|
| **“I’m bored. Fake week.”** CTA | Home `BoredLameSandboxCta` | Primary intentional entry |
| “Still bored. Hit me again.” | Same CTA after a run | Re-entry |
| “Cooking a fake week…” | Same | Loading |
| Subcopy: dies at Week 0 kickoff, private, fake, zero standings | Same | Entry framing |
| Onboarding → practice picks | `OnboardingHost` + `player` journey + `startBoredPracticeWeek` | Can enter without “I’m Bored” button |
| Tutorial `ensureTutorialPicksHref` | `player-tutorial.ts` | Can mint practice week |
| Deep link | `/picks?week=99&practice=1&run=…` | URL state |

### Storage / identity (invisible but real)

| Key / flag | Role |
|------------|------|
| `warroom-bored-practice-active-v1` | Active practice session |
| `warroom-bored-practice-card-v1` | Fake games + prop |
| `warroom-bored-practice-picks-v1` | Local picks |
| `warroom-bored-practice-results-v1` | Local grade |
| `warroom-bored-practice-pending-done-v1` | Done modal queue |
| `BORED_PRACTICE_WEEK = 99` | Not a real season index |
| Query `practice=1` / `week=99` | URL practice gate |

### On Picks while practice is active

| Artifact | Notes |
|----------|--------|
| Amber dashed banner | “I’m bored · fake week · not your real card” |
| Body copy about practice grading / Exit | |
| **Exit practice → real picks** | Primary leave |
| **Home (live season)** | Secondary leave |
| **`leagueName` → `"Trial sandbox (not live)"`** | **Leaks as if it’s a league name / header** — core clarity bug |
| Practice-local lock / grade / W-L after score | Local only (correct isolation, weak global chrome) |
| Suppress live card soft-refresh when `practiceMode` | Correct isolation |
| Skip pre-open odds modal when practice | |

### After practice score

| Artifact | Where |
|----------|--------|
| **BoredPracticeDoneModal** | Recap, fake gazette tease, board tease, “do it again”, leave to real |
| Event `warroom-bored-practice-done` | |

### Onboarding (overlaps practice)

| Artifact | Where |
|----------|--------|
| Slim **Practice mode** top strip | `OnboardingHost` when `practiceBanner` |
| “Nothing here affects your real league · Follow the guide” | Same |
| Player journey copy about practice run | `journeys/player.ts` |

### Exit / leave (current)

| Path | Behavior |
|------|----------|
| Exit practice → real picks | `leavePractice("/picks")` + wipe storage |
| Home (live season) | `leavePractice("/")` |
| Nav to `/picks` **without** practice in URL while practice was active | Effect calls `leavePractice` (can feel automatic / surprising) |
| Done modal leave / dismiss | Always wipes practice |

### Related but **not** I’m Bored (document to avoid mix-ups)

| Artifact | System |
|----------|--------|
| Home **Sandbox** strip (`SandboxSimBanner`) | B — pre-season room dry-run |
| Nav `sandboxOn` strip | B / creator progressive |
| `SandboxSessionChrome` hop bar | C — Foundry |
| Sport pool “practice” bots | Host dry-run language, not week 99 |
| FirstCardWizard “Practice week” | Host onboarding language (Host Dashboard) |

---

# 2. Where fake and real states mix (leak map)

| Leak | Why it hurts |
|------|----------------|
| **Picks header shows real league context + “Trial sandbox” as leagueName** | Feels like a fake league *inside* the real app chrome, not a separate world |
| **Practice banner is only on Picks**, not global | Leave Picks → Home/Board/Locker/League look **fully real** while storage may still be practice-active until some exits |
| **Nav has no Practice badge / Exit** | User can wander; one second rule fails |
| **Auto-exit when Nav hits `/picks` without query** | Exit is not always intentional / labeled “Return to My League” |
| **Onboarding Practice strip** vs **I’m Bored** banner | Two different chrome languages for the same rails |
| **SandboxSimBanner (season dry-run) on Home** next to **I’m Bored** CTA | Two “not fully real” systems in one place — vocabulary collision |
| **Done modal** can surface after navigation | Timing can feel like real season drama |
| **Creator eyes / Foundry** banners on Picks | Third “preview” reality if testing |

**Data isolation** is largely solid (local storage, week 99, no live soft-refresh).  
**Emotional / visual isolation** is not.

---

# 3. Proposed global Practice Mode system

### States

```
REAL_LEAGUE  (default)
PRACTICE_MODE  (only after intentional entry)
```

No hybrid UI.

### Entry (only intentional)

| Path | Allowed? |
|------|----------|
| **I’m Bored** (Home CTA) | **Yes — primary** |
| Onboarding practice step | **Yes — but same Practice Mode identity** (same chrome, same exit) |
| Deep link `practice=1` | Yes if product needs shareable/debug; still full chrome |
| Accidental / silent entry | **Never** |

Rename product language to **Practice Mode** (keep “I’m Bored” as the fun entry button label if desired).

### Persistent identity (while PRACTICE_MODE)

App-shell level (not a one-off card on Picks):

1. **Persistent top banner** (every route)  
   - **Practice Mode**  
   - *Nothing here affects your real league.*  
2. **Distinct accent** (e.g. amber/dashed — already started on Picks; go global)  
3. **Nav training badge** (small “Practice” near League/Home or on Picks)  
4. **Always-visible Exit Practice**  
   - Primary: **Return to My League**  
   - Optional: **Exit → Real picks**  
5. **Never rename the real league** to “Trial sandbox” — say **Practice card** / **Practice week** under Practice chrome instead  

### Exit (always obvious, never sneaky)

| Control | Behavior |
|---------|----------|
| **Exit Practice / Return to My League** | Wipe practice storage + hard nav to Home or real Picks |
| Optional “Practice again” | Only from done modal / Home CTA — re-enters Practice Mode fully |
| Nav without exit | **Do not** silently leave without copy **or** keep Practice chrome until explicit exit |

**Recommended:** Prefer **sticky Practice Mode until explicit exit**, even if user taps Board/Locker — with banner + exit always present.  
Alternative (stricter): leave Practice automatically only when choosing **Return to My League**, never when tapping bare “Picks”.

### When PRACTICE_MODE is OFF

Strip **all** of §1 Practice artifacts.  
Do not show week 99, practice banners, trial sandbox names, or done-modal residue.

---

# 4. Pages that should change behavior when Practice Mode is active

| Page / shell | Real League | Practice Mode |
|--------------|-------------|-----------------|
| **App shell / Nav** | Normal | Banner + badge + Exit Practice |
| **Home** | Real tiles, no fake card | Banner; optional “Still practicing” CTA; **no** fake week mixed into real hero |
| **Picks** | Real card only | Practice card only + full Practice identity (no real card peek) |
| **Board / Standings** | Real | Prefer block with “This is practice — standings aren’t real” **or** soft redirect to Picks practice; never show real standings as if practice counts |
| **Locker / Gazette / News** | Real | Same: don’t imply practice posts are league history; banner + exit |
| **League (Host Dashboard)** | Real host tools | Banner; warn practice ≠ room; **no** publish to real week from practice card |
| **Account / Profile** | Real | Banner only; no practice trophies as real |
| **Trophy Room / Museum** | Real | No practice hardware as real |
| **Onboarding overlays** | — | Must use **same** Practice Mode chrome when on practice rails |

---

## Trust framing (Promise #2)

| User should feel | Never feel |
|------------------|------------|
| “I’m practicing. Nothing counts.” | “Is this my real card?” |
| “I’m in my real league. Everything counts.” | “Did I just mess up my standings?” |

That is the same promise as onboarding: **I can’t accidentally ruin anything.**

---

## Implementation phases (after approval — not now)

| Phase | Work |
|-------|------|
| **0** | Approve this doc + constitution line |
| **1** | Global Practice Mode session flag + shell chrome (banner, accent, Exit) |
| **2** | Picks: remove “Trial sandbox” league rename; bind to shell chrome |
| **3** | Exit model: explicit only; kill ambiguous auto-exits or label them |
| **4** | Align onboarding practice strip with global Practice Mode |
| **5** | Vocabulary: “Sandbox” (season dry-run) vs “Practice Mode” (I’m Bored) — never mix labels |

---

## Approval questions for Mike

1. While in Practice Mode, if user opens **Board** or **Locker**, should we **keep Practice chrome** (recommended) or **force exit**?  
2. Keep button label **“I’m bored. Fake week.”** as entry flavor while product name is **Practice Mode**?  
3. Treat **season SandboxSimBanner** as separate forever (recommended) — only rename if it confuses users?

---

## Related code (for implementers later)

- `src/lib/bored-practice.ts`, `bored-practice-run.ts`  
- `src/components/BoredLameSandboxCta.tsx`, `BoredPracticeDoneModal.tsx`  
- `src/app/picks/PicksClient.tsx` (`practiceMode`, leavePractice)  
- `src/components/onboarding/OnboardingHost.tsx` (Practice strip)  
- `src/components/SandboxSimBanner.tsx` (season dry-run — different system)  
- `src/lib/season-mode.ts` (`isSandboxMode`)  

**No code in this pass.**
