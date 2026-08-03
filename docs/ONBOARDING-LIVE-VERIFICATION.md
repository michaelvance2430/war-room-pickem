# Onboarding live verification (Phase 1–3 + immersion P0)

**Status:** Re-verify after **Developer Scrub #1 immersion redesign** — **before Phase 4**  
**Two jobs in this doc:**  
1. **Engineering confidence** — does the machine work?  
2. **Emotional confidence** — does a first-time user *feel* the Promise?  

**Code under test:** immersive host (slim practice strip, coach strip, nav pointers) + Home-first journeys  
**Do not start Phase 4 until Mike completes both jobs live.**  
**Immersion fails the ship gate even if the state machine is perfect.**

---

## Scrub #1 immersion checklist (P0)

Walk Practice / first session and mark each:

| # | Feeling check | Pass? |
|---|---------------|-------|
| 1 | Starts on **Home** (front door) — **not** Foundry / simulator UI | |
| 2 | **One** meaningful click to start — no OK → OK → Open chain before the app | |
| 3 | Practice mode is a **slim banner** — app stays the hero | |
| 4 | Coach **points** at real nav; player drives (not only watching a course) | |
| 5 | Every “go here” gets **recognition → confirm → explain → next** (Standings never dead-ends) | |
| 6 | Coach **reveals** the UI — large modal does not hide what you’re teaching | |
| 7 | **One** ending only — no double “you trust yourself” / duplicate peak | |
| 8 | Coach sounds like a **host beside you**, not software | |

Constitution line to hold:

> **They need to feel like they are IN the experience. Not viewing it from above.**

---

## Scrub #2 — Commissioner hosting (P0)

Walk the **commissioner** journey. Emotional goal:

> **“Wow… I can actually run this.”**  
> Not: “I know the three jobs.”

| # | Check | Pass? |
|---|-------|-------|
| 1 | **Zero Foundry** language in production onboarding UI | |
| 2 | Opening is a **conversation** (coach stays with you) — not a checklist | |
| 3 | **One action at a time** — never a full responsibility dump | |
| 4 | Exactly one **Start here** cue every beat | |
| 5 | Feels like **walking into** the room, not reading a manual | |
| 6 | **Scoring / advanced** only after a practice week is live | |

---

## Two kinds of verification

| | Engineering pass | Emotion pass |
|--|------------------|--------------|
| **Question** | Did the state machine work? | Did I leave more invested? |
| **Evidence** | Buttons, events, storage, skip, refresh | Promise, scores, memories, “would I text a friend?” |
| **Fail means** | Fix bugs before polish | Fix **storytelling** before more features |

A month ago we chased freezes.  
If we’re now arguing whether “Share invite” feels like inviting friends over for football — **that is a good sign.**

Remaining gap (~10–15%): not engineering — **storytelling**. That’s what people remember months later.

---

## Ship gate — War Room Promise (emotions, not “it works”)

After **each** full journey, Mike answers **honestly** (not “did the modal open?”):

| # | Promise (must **feel** true) | Yes / No | Note |
|---|------------------------------|----------|------|
| 1 | **I know what to do.** | | |
| 2 | **I can’t accidentally ruin anything.** | | |
| 3 | **My friends are going to love this.** | | |
| 4 | **I want Week 1 to start today.** | | |
| 5 | **This feels like it was built by someone who actually plays this game with friends.** | | |

If any **No**, Phase 4 is not next — fix the journey first.

### Founder Rule (end of each journey)

> Would I be **excited** to invite my own family league after this experience?

Yes / No: ______

---

## Emotional checkpoint (every step)

After **each** screen, before moving on, Mike fills this (pencil or notes):

| Score | 1–10 |
|-------|------|
| **Confidence** | |
| **Excitement** | |
| **Trust** | |

Then free text:

- **What confused me?**  
- **What surprised me?**  
- **What made me smile?**  
- **What would make me text a friend?**  

Those answers matter more than whether a button fired an event.

**Investment check:**  
Did I leave **slightly more invested** than when I arrived on this screen? (Not just more *informed*.)  
Yes / No: ______

If No → screen fails even if mechanics are perfect.

---

## Memory Created? (every step)

Every step must plant **one memory** — not only teach a task.

If a screen teaches something but creates **no memory**, mark it **DELETE / rewrite** for Phase 4 storytelling.

| Memory seed examples (War Room, not generic pick’em) |
|------------------------------------------------------|
| “The room isn’t alive yet — until you publish.” |
| “Every great league starts with one message.” |
| “You locked your first card.” |
| “Your buddy is going to hate losing to you.” |
| “Standings is the table you trash-talk all week.” |
| “Locker Room is where personalities come alive.” |
| “You’re ready — Week 1 won’t feel foreign.” |

---

## Storytelling reframes (same task, different feeling)

Use these as the **emotion target** while walking current copy. Current UI may still say “Job 1 of 3” — note the gap.

| Task (current) | Story beat (desired feeling) |
|----------------|------------------------------|
| Share invite / Job 1 | **Every great league starts with one message.** This is the easiest part. Copy it. Drop it in the group chat. The fun starts when the first person joins. |
| Publish card / Job 2 | **The room isn’t alive yet.** Publish the first card. That’s the moment everyone starts checking their phones. |
| Score later / Job 3 | When the games die, you write the ending — standings move, the paper cooks, the room gets a story. |
| Open My Picks | This is where every week begins — not a settings page, the ritual. |
| Lock picks | You’re not just making picks. You’re joining a room of bragging rights, rivalries, and stories. |
| You’re ready | Not “training over” — **the real season is about to begin.** |

Same instructions. Totally different feeling.

---

## How to force a clean first-session run

```js
localStorage.removeItem("warroom-onboarding-v1")
localStorage.removeItem("warroom-player-tutorial-v1")
location.reload()
```

**Exit:** Skip / Skip for now / Skip onboarding (marks complete — will not auto-trap forever).  
**Storage:** `warroom-onboarding-v1` (versioned).

---

## Technical risk verification (engineering half)

| # | Risk | Code verdict | Mike confirms live |
|---|------|--------------|--------------------|
| 1 | Host remount restarts journey | Likely OK (persistent Nav + localStorage) | stepId stable across routes? |
| 2 | Commish journey on normal players | OK (`isActuallyCommissioner` + first-time) | |
| 3 | “Practice” writes real picks if live week exists | **⚠️ High Promise #2 risk** | Test **with and without** live card |
| 4 | Commish can publish/score for real | Intentional; soft-continue available | |
| 5 | Completion versioned | `v1` key | |
| 6 | Refresh resumes | Should | Celebrate phase OK? |
| 7 | Auto-start trap | Skip marks complete | |
| 8 | Dual legacy + new coach | Should exclusive | No “Walk the dog”? |
| 9 | Login welcome stacks | Race ~0–1.4s possible | |
| 10 | Console / storms / hydration / longtasks | | Watch live |

**No P0 code fix in this pass.** #3 is the top safety note for Promise #2.

---

# A. New commissioner — step cards

**Felt goal:** *“I can run this league.”*  
**Who:** Real host, zero scored weeks, onboarding storage cleared.

After **each** step, fill Emotional checkpoint + Memory Created.

---

### A0 · Welcome (fullscreen)

| | |
|--|--|
| **Current kicker / title** | You’re the host / You’re running the room. |
| **Current speak** | Friends don’t need another spreadsheet… bragging rights, rivalries, paper when the week dies. |
| **Action** | `Let's run the room →` |
| **Success** | Always |
| **Celebration** | none |
| **Next** | Invite |
| **Stuck risk** | Low |
| **Real data** | No |
| **Exit** | Skip for now |

**Memory target:** “I’m the host of a room, not a spreadsheet admin.”  
**Story beat (desired):** You’re opening the league your friends will talk about all season.

**Emotional checkpoint:** Confidence __ / Excitement __ / Trust __  
Confused? Surprised? Smile? Text a friend?  
More invested? Y/N · Memory created? ________________

---

### A1 · Invite

| | |
|--|--|
| **Current** | Job 1 of 3 · Share your invite |
| **Action** | Open Home to share → / secondary I’ve shared |
| **Success** | Manual (secondary/Continue) |
| **Micro** | ✓ Invite ready… |
| **Stuck risk** | Medium if secondary not obvious |
| **Real data** | Share only |

**Memory target:** “Every great league starts with one message.”  
**Story beat (desired):** Easiest part — drop it in the group chat; fun starts when the first person joins.  
**Gap note:** Current “Job 1 of 3” is task-y; storytelling may lag.

**Emotional checkpoint:** C __ / E __ / T __  
Confused? Surprised? Smile? Text a friend?  
More invested? Y/N · Memory created? ________________

---

### A2 · Publish (**peak if they actually publish**)

| | |
|--|--|
| **Current** | Job 2 of 3 · Publish this week’s card |
| **Action** | Pull Odds & publish → real Commish |
| **Success** | `warroom-card-published` **or** soft “I’ve published” |
| **Peak copy** | 🎉 Your first week is officially LIVE… |
| **Real data** | **Yes if they publish** |
| **Stuck risk** | Medium if event misses and secondary missed |

**Memory target:** “The room is alive.” / “Everyone starts checking their phones.”  
**Story beat (desired):** The room isn’t alive yet — publish is the moment it is.

**Emotional checkpoint:** C __ / E __ / T __  
Confused? Surprised? Smile? Text a friend?  
More invested? Y/N · Memory created? ________________

---

### A3 · Score hint

| | |
|--|--|
| **Current** | Job 3 of 3 · When the games die |
| **Action** | Peek Results / Got it → finish |
| **Success** | Manual |
| **Real score required** | No |

**Memory target:** “When the week dies, you write the story.”  
**Story beat:** Standings move, the paper cooks — host loop, not homework.

**Emotional checkpoint:** C __ / E __ / T __  
More invested? Y/N · Memory created? ________________

---

### A4 · Host finish (**peak**)

| | |
|--|--|
| **Title** | You can run this league. |
| **Peak** | 🏆 Invite. Publish. Score. Welcome to the War Room. |
| **After** | `completed.commissioner`; **player journey may auto-start next** |

**Memory target:** “I can run this league.”  
**Promise table** for full commissioner journey → fill at end.

**Emotional checkpoint:** C __ / E __ / T __  
Would I invite family? (Founder Rule) Y/N  
**⚠️ Note:** Player onboarding may stack immediately after — jarring? ______

---

# B. New player — step cards

**Felt goal:** *“I can’t wait until Week 1.”* / *“I know exactly what I’m doing.”*  
**Banner:** Practice mode · Training league · Not live  

**⚠️ With live week published:** path may be **real** My Picks — stress-test Promise #2.

---

### B0 · Welcome

| | |
|--|--|
| **Title** | Welcome to War Room. |
| **Speak** | Private room with your people… |
| **Why** | Practice ~3 min · nothing affects league · can’t mess up |
| **Action** | Start practice → / Skip for now |

**Memory target:** “I’m safe. This is a room, not a public app.”  

**Emotional checkpoint:** C __ / E __ / T __ · More invested? · Memory? ________________

---

### B1 · Mission

| | |
|--|--|
| **Title** | This is where every week begins. |
| **Speak** | Predict · beat friends · climb · win |
| **Why** | Picks are the excuse — room is the product |

**Memory target:** “Football is the excuse; the room is why I’m here.”  

**Emotional checkpoint:** C __ / E __ / T __ · More invested? · Memory? ________________

---

### B2 · Open My Picks

| | |
|--|--|
| **Primary** | Open practice card → |
| **Success** | Path `/picks` |
| **Micro** | ✓ You’re on My Picks. Practice only. |
| **Live week risk** | Real picks possible |

**Memory target:** “This is the weekly ritual.”  

**Emotional checkpoint:** C __ / E __ / T __ · Confused by practice vs live? ______

---

### B3 · Fill card

| | |
|--|--|
| **Speak** | Sides · 1–5 once · Best Bet · prop (dense — storytelling debt) |
| **Success** | `warroom-tut-picks-filled` or secondary |
| **Micro** | ✓ Card looks full. |

**Memory target:** “My 5 is my loudest take.” (if confidence lands)  
**Gap:** Four mechanics at once — may score low on confidence/excitement.

**Emotional checkpoint:** C __ / E __ / T __ · Overwhelmed? Y/N · Memory? ________________

---

### B4 · Lock (**peak #1**)

| | |
|--|--|
| **Peak** | ✅ Nice! … bragging rights, rivalries, and stories… nothing affected your league |
| **Success** | save flag or secondary |

**Memory target:** “You locked your first card.” + “joining a room of stories.”  
**Must feel earned** (not confetti spam).

**Emotional checkpoint:** C __ / E __ / T __  
**Smile?** ______ **Text a friend?** ______  
More invested? · Memory? ________________

---

### B5 · Standings peek

| | |
|--|--|
| **Speak** | Not silent scoreboard… brother or boss… |

**Memory target:** “Your buddy is going to hate losing to you.” / trash-talk table  

**Emotional checkpoint:** C __ / E __ / T __ · Memory? ________________

---

### B6 · Locker peek

| | |
|--|--|
| **Speak** | Personalities… where yours comes alive |

**Memory target:** “Locker Room remembers the room’s characters.”  

**Emotional checkpoint:** C __ / E __ / T __ · Memory? ________________

---

### B7 · You’re ready (**peak #2**)

| | |
|--|--|
| **Title** | You’re ready. |
| **Peak** | 🏆 … Welcome to the War Room. |
| **Must feel** | Season about to begin — not “training over” |

**Memory target:** “I can’t wait for Week 1.”  

**Emotional checkpoint:** C __ / E __ / T __  
**Full Promise table**  
Founder Rule: invite family? Y/N  

---

## End-of-journey synthesis (Mike)

### Commissioner journey

| | |
|--|--|
| Opening confidence (1–10) | |
| Ending confidence (1–10) | |
| Lowest-confidence step | |
| Best War Room moment | |
| Most generic / task-y moment | |
| Promise 1–5 | |
| Founder Rule | |
| Stacked into player journey after? | |

### Player journey

| | |
|--|--|
| Opening confidence (1–10) | |
| Ending confidence (1–10) | |
| Lowest-confidence step | |
| Best War Room moment | |
| Most generic moment | |
| Practice felt safe? | |
| Live card danger felt? | |
| Promise 1–5 | |
| Founder Rule | |
| Would I text 8 friends “opening the league”? | |

### Storytelling debt list (for Phase 4 — not code yet)

Steps that **taught** but created **no memory**:

1. ________  
2. ________  
3. ________  

Steps that need **story reframe** (not new features):

1. ________  
2. ________  

---

## Constitution link

Also in `docs/WAR-ROOM-CONSTITUTION.md`:

> **Every screen should leave the player feeling slightly more invested than when they arrived.**  
> Not more informed. **More invested.**

---

## Stop

Await **Mike’s live walkthrough notes** (especially emotional checkpoints + Memory Created).  
**No Phase 4** until then.
