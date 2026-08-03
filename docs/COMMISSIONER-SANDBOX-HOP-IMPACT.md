# P0 Impact Assessment — Commissioner Sandbox / Dry-run Hop Bar

**Status:** Impact assessment only — **no removal code until Mike approves**  
**Date:** 2026-08-03  
**Ask:** Remove Sandbox / Dry Run / Hop Bar / internal terminology from the **normal commissioner** experience; keep creator tooling in **Foundry**.

---

## Thesis (product)

> It solves a **creator** problem, not a **customer** problem.

Onboarding exists to teach hosts safely.  
One real published week should teach the weekly habit.  
A permanent sandbox hop layer adds cognitive load without becoming part of that habit.

**Target experience:** Every normal commissioner always feels like they are running a **real league**.

---

## What “this feature” actually is (inventory)

Do not conflate systems. Impact differs by layer.

| Layer | What it is | Who sees it today | Real league? |
|-------|------------|-------------------|--------------|
| **A. Sandbox hop bar** | Sticky Home · Picks · Board · Gazette · Commish jumps + Close/Wipe | Hosts only **after** opt-in (`SandboxSessionChrome` + `SandboxHopOptIn`) | Navigation chrome over pre-open room |
| **B. Hop opt-in toggle** | “Dry-run hop bar / Sandbox only · optional” on Host tools | **`labTools` only** → `showCommishLabTools()` (app creator / Foundry sticky / creator eyes / creator sandbox) | Lab UI on `/commissioner` |
| **C. Season sandbox mode** | `isSandboxMode()` — room before doors open; demo/sim framing | **Everyone** in the room (`SandboxSimBanner` on Home) | Shared pre-open dry-run for the **real** room |
| **D. Lab dry-run tools** | Demo publish, randomize score, auto-score weeks, dry-run odds pull | **`labTools` only** (same gate as B) | Founder QA toys on Host page when creator |
| **E. Practice Mode (“I’m Bored”)** | Client-only week 99 | Players / onboarding | **Not** hop; separate reality (already being isolated) |
| **F. Foundry** | Creator desk, eyes, test-mode, platform usage | Creator | Intended home for A/B/D |

**This review’s primary subject:** **A + B** (hop bar + its host-facing toggle), and whether **D** language (“Sandbox / Dry run”) should leave normal Host Dashboard forever.

**Related but not the same decision:** **C** (whole-room pre-open season mode) — removing hop does **not** automatically remove pre-open room physics.

---

## Evaluation questions

### 1. Is this feature used by anyone except the creator?

**Evidence from code (not product analytics):**

| Gate | Result |
|------|--------|
| Hop **opt-in UI** | Only when `labTools === true` → `showCommishLabTools()` — creator / Foundry session only |
| Hop **chrome** | Any `isOps()` host **if** hop flag is ON for that league — but the only product UI that sets the flag is the lab-gated opt-in |
| Default | Hop is **off**; visiting Host Dashboard does **not** turn it on |

**Conclusion:**

- **Intended users of hop:** creator only (already).
- **Normal commissioners:** should **not** see the toggle; should **not** get the bar unless a shared browser left a stale `localStorage` hop key (edge case after creator testing on the same device/league).
- **No in-app usage telemetry** for hop toggles was found — cannot prove zero non-creator activations from data; **code path says non-creators cannot turn it on.**

**Answer: Yes (effectively creator-only already).** Residual risk is stale keys + leftover internal words elsewhere, not a healthy multi-host habit.

---

### 2. Can all QA / demo workflows move into Foundry?

| Workflow today | Foundry / creator path exists? | Notes |
|----------------|----------------------------------|--------|
| Jump routes while dry-running a room | Hop bar (A) | Replace with Foundry sticky chrome / eyes / simple bookmarks — **yes** |
| Demo slate + bots + one-tap publish | Lab tools on Host when `labTools` | Already creator-gated; **home should be Foundry**, not Host Dashboard homepage |
| Randomize results / auto-score weeks | Lab tools on Host | Same — Foundry or Host **only under creator gate** |
| Dry-run odds pull (all open games) | Lab checkbox | Same |
| Progressive / season-sim knobs | Foundry test-mode + creator sandbox | **Yes** |
| “See what a new host sees” | Creator eyes | **Yes** |
| **Real host first card + invite** | Host onboarding / FirstCardWizard / Host Dashboard | **Must stay customer** — not Foundry |
| **Room-wide pre-open physics** (C) | Season sandbox mode | Product decision separate from hop; may stay as *preseason room*, but **rename away from lab jargon** |

**Answer: Yes for hop + lab dry-run tooling.**  
**Caveat:** Keep **real host onboarding and real weekly publish/score** on the Host Dashboard. Do not force customers through Foundry.

---

### 3. Does onboarding eliminate the original need?

**Original need (inferred):** Let a host learn publish → lock → score → drama **without** fearing they wrecked the live season, and let the creator verify that loop quickly.

| Need | Current safer path |
|------|---------------------|
| New host learns the job | Commissioner onboarding + Host Dashboard coaching + First Card flow |
| Player learns picks without risk | Practice Mode (I’m Bored) — separate from hop |
| Creator verifies full loop | Foundry + lab tools + creator sandbox |
| First real week | Publish real card; room learns by season |

**Answer: Yes for normal commissioners.**  
Hop does not teach the weekly habit; it teaches **lab navigation**.  
Once a host publishes one real week, hop is not part of the job.  
Onboarding + real first week cover the customer problem; Foundry covers the creator problem.

---

### 4. Does removing this simplify the Host Dashboard?

**Already true for normal hosts:**

- Hop opt-in is not on their Host Dashboard (`labTools` false).
- Host Dashboard IA (Hero → This Week → The Room → League Settings) does not depend on hop.

**Still simplified by a hard Foundry-only policy:**

| If we remove / rehome | Host Dashboard gain |
|------------------------|---------------------|
| Delete or Foundry-only hop chrome from app shell | One less sticky bar system in layout; fewer “Sandbox hop” strings in the product |
| Keep lab tools off Host homepage even for creator | Host page stays “door to the league”; creator tests from Foundry |
| Scrub residual “Sandbox / Dry run / hop” copy from host-visible surfaces | Language matches **real league** |
| Document that season pre-open (C) is “before the season” not “sandbox lab” | Players/hosts stop reading shop vocabulary |

**Answer: Yes, modestly for normal hosts (mostly language + chrome hygiene); meaningfully for product clarity and for creator discipline.**  
Largest IA win is **not** deleting a block normal hosts already never see — it is **guaranteeing they never can**, and cleaning residual lab vocabulary from the room.

---

## Recommendation

| Decision | Recommendation |
|----------|----------------|
| Move hop bar + hop opt-in fully behind Foundry / creator tools | **Yes — approve** |
| Normal commissioners never see Sandbox / Dry Run / Hop Bar / internal terms | **Yes — approve** |
| Keep Practice Mode (I’m Bored) as the customer-safe practice reality | **Yes — separate system; already isolating** |
| Keep real host onboarding + real first publish on Host Dashboard | **Yes — do not move customer teaching to Foundry** |
| Season pre-open room mode (C) | **Do not delete in the same change** without a second decision; **do** rename consumer copy away from “Sandbox / dry-run” if it still reads as lab |
| Implementation | **Hold until Mike approves this assessment** |

### Target end state (when approved)

| Audience | Sees |
|----------|------|
| **Normal commissioner** | Host Dashboard only; real league language; onboarding; real weeks |
| **Players** | Real league + optional Practice Mode; no hop; no shop jargon |
| **Creator** | Foundry: hop-equivalent navigation, demo publish, auto-score, eyes, sandbox season sim |

### Suggested implementation slices (later — not now)

1. **Hard gate:** `SandboxSessionChrome` / `SandboxHopOptIn` require `isAppCreator` (or Foundry session), not merely `isOps` + localStorage.  
2. **Relocate:** Hop controls live under Foundry UI, not Host Dashboard body.  
3. **Copy pass:** Host-visible and player-visible strings — replace Sandbox/Dry-run/hop with preseason / Practice Mode / real-league language.  
4. **Stale key scrub:** Clear hop localStorage for non-creators on session boot.  
5. **Optional:** Creator-only lab strip on Host remains off homepage (Foundry-first).

---

## Risk / impact matrix

| Risk | Severity | Mitigation |
|------|----------|------------|
| Creator loses fast route hops while QA | Low | Foundry sticky / eyes / bookmarks |
| Shared-device leftover hop bar | Low | Hard creator gate + key scrub |
| Confusing pre-open room with “removed sandbox” | Med | Separate decision + rename for C |
| Hosts who relied on hop (unlikely) | Low | None expected; no customer habit |

---

## Answers summary

| # | Question | Answer |
|---|----------|--------|
| 1 | Used by anyone except creator? | **No (code-gated creator-only).** |
| 2 | QA/demo → Foundry? | **Yes** for hop + lab dry-run tools. |
| 3 | Onboarding eliminates need? | **Yes** for customers. |
| 4 | Simplifies Host Dashboard? | **Yes** (hygiene + guarantee + language). |

**Overall:** Approve relocating the **entire hop feature and dry-run lab chrome** behind Foundry / creator tools.  
Normal commissioners should never see Sandbox, Dry Run, Hop Bar, or internal terminology — their experience should always feel like running a **real league**.

**No implementation in this pass.** Await approval.
