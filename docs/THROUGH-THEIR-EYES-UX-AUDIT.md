# Through Their Eyes — Onboarding UX Audit

**Phase:** Product Polish (no code in this deliverable)  
**Lens:** First-time commissioner and first-time player — human confidence, not button training  
**Constraint:** Do not redesign workflows or add features; improve clarity, confidence, celebration, trust  
**Goal end-state feeling:** *“I know exactly what to do and I’m excited to play.”*

---

## Scope map (what “onboarding” actually is today)

War Room does **not** use a single linear “Through Their Eyes” product name in code. The first-session experience is a **stack of coaches** that fire at different times:

| Track | Entry | Primary surfaces |
|-------|--------|------------------|
| **A. Player — real account** | First login, incomplete tutorial flag | Sticky coach **“Walk the dog”** (`PlayerWalkthrough` + `player-tutorial.ts`) → My Picks → save → Padawan outro |
| **B. Commish — real host** | First-time host until a week is scored | Home **Commish · first jobs** (`CommishSetupBanner`) → Commish **First card wizard** → **Card is live** modal → optional **See player view** |
| **C. Guest demo** | Demo mode | Full-screen **GuestOnboarding** (welcome → role → 3 steps) |
| **D. Post-core unlock** | After first real lock | **Soft unlock** banner (“room unlocked”) |
| **E. Ambient** | Login / publish / save | Login welcome, Picks saved modal, progressive disclosure |

**View as player** (Account / after publish) is the closest product phrase to “through their eyes” — it is a **mode switch**, not a guided story of what they feel.

Assume Mike’s path (create room → publish → practice/lock → wander) ≈ brand-new host + brand-new friend.

---

## Global five-question scorecard

For every step below we score (rough): **Why / What / Confirm / Next / Emotion** as Strong · Partial · Weak.

---

# Track A — Player walkthrough (“Walk the dog”)

Default path is **picks-only** (3 steps). Full path (Crystal Ball + picks) is Account re-run.

## A0 · Silent start (tutorial auto-starts)

| | |
|--|--|
| **Current purpose** | Detect first session; auto-start coach; ensure a practice card exists if no live week |
| **Why** | Weak — coach appears without a warm “welcome, here’s the one job of the week” |
| **What** | Partial — sticky bar assumes user notices bottom coach over nav |
| **Confirm** | Weak — no “you’re in training” moment |
| **Next** | Partial — CTA open picks |
| **Emotion** | Weak — “Walk the dog” is insider slang; not confidence |

**Confusion:** Tutorial can start while Login welcome / other drama competes. “Trial sandbox” may appear without framing.

**Missing:** One-sentence mission: *Every week you open My Picks and lock a card before kickoff. Let’s do it once together.*

**Copy:** Rename coach eyebrow from “Walk the dog” → **“Your first lock”** or **“Weekly job · practice”**.

**UI:** Progress dots 1–3 always visible; single primary CTA; dim competing chrome slightly (already z-index high).

**Celebrate / next:** Soft pulse on coach arrival; “This takes ~60 seconds.”

---

## A1 · Step 1 of 3 · Open My Picks

**Current copy (approx):** *Open My Picks… trial sandbox if no live card…*

| | |
|--|--|
| **Why** | Partial — says “the job every week” but not *why it matters* (standings, bragging, the room waiting) |
| **What** | Strong — clear CTA |
| **Confirm** | Weak — landing on /picks doesn’t celebrate “you’re on the board” |
| **Next** | Partial — auto-advances to fill; user may not notice step changed |
| **Emotion** | Partial |

**Confusion:** Empty live week vs trial sandbox not visually distinct enough. User may think the league is broken.

**Copy (suggested):**

> **Step 1 of 3 · Open My Picks**  
> This is the whole game, every week: one card, locked before kickoff.  
> Tap below — if the real week isn’t published yet, we’ll use a safe practice card so nothing breaks.

**UI:** Badge on screen: **Practice card** vs **Live week · counts**.

**Confirm:** On arrival: short toast/coach line *“You’re on My Picks. Now fill the card.”*

**Celebrate:** Micro check on step 1 complete.

**Next:** Explicit *“Next: pick every game + confidence.”*

---

## A2 · Step 2 of 3 · Fill the card

**Current copy:** Pick side, confidence 1–5 once each, Best Bet 2×, prop. Practice doesn’t count standings.

| | |
|--|--|
| **Why** | Weak for confidence rule — *why* unique 1–5 feels like homework |
| **What** | Partial — four jobs in one paragraph |
| **Confirm** | Weak — “Done → next” is manual; easy to advance without filling |
| **Next** | Partial |
| **Emotion** | Weak — cognitive load peaks here |

**Confusion:** Confidence uniqueness is the #1 first-timer failure. Best Bet vs confidence not contrasted.

**Copy (suggested):**

> **Step 2 of 3 · Build your card**  
> For each game: pick a side.  
> Then rank your **confidence 1–5** — each number only once (your 5 is your loudest take).  
> Mark **one Best Bet** (double points). Answer the prop.  
> Practice cards teach the motions — live weeks count.

**UI:** Break into micro-checks (games picks complete · confidence complete · best bet · prop) with green checks; coach updates as each clears.

**Confirm:** When card is complete, auto-advance coach: *“Card looks full. One more tap: Save.”*

**Celebrate:** Soft confetti or green sweep only when complete (not per game).

**Next:** Point at the big Save / Lock button with a one-time spotlight.

---

## A3 · Step 3 of 3 · Save / Lock

**Current copy:** Hit big Save/Lock; real season is “for blood.”

| | |
|--|--|
| **Why** | Partial |
| **What** | Strong if button is obvious |
| **Confirm** | Strong path if PicksSavedModal fires — **but tutorial may complete via sessionStorage before emotional read** |
| **Next** | Weak after padawan outro dismiss |
| **Emotion** | Partial — “for blood” is cool; practice vs live still fuzzy |

**Confusion:** Save vs Lock language; edit until kickoff vs “locked in.”

**Copy (suggested):**

> **Step 3 of 3 · Lock it in**  
> Hit **Save / Lock** — that’s the finish line for this week.  
> You can still edit until first kickoff. After that, the card freezes.

**Confirm (align with PicksSavedModal):**

> ✅ **Nice — your picks are locked in.**  
> You’re ready for kickoff. (Edit until first kick if you change your mind.)

**Celebrate:** Keep modal ✓; add short vibration-friendly success; coach disappears *after* modal, not before.

**Next:** *“When you’re curious: Standings · Locker · Board after unlock.”* One link home.

---

## A4 · Padawan outro (tutorial complete)

**Current:** “Be patient, young Padawan” / “You locked the slip — Padawan no more” + countdown or “Go win the week.”

| | |
|--|--|
| **Why** | Partial — Star Wars joke rewards insiders |
| **What** | Weak — dismiss only |
| **Confirm** | Strong — training complete |
| **Next** | Partial if season closed; weak if open |
| **Emotion** | Strong for brand fans; risky for dads who don’t want “Padawan” |

**Copy (suggested dual tone):**

> **Training complete**  
> 🎉 You just did the weekly job end-to-end.  
> If doors aren’t open yet: *X days until [open label].* Practice any time.  
> If doors are open: *You’re live. Same job next week.*

Primary CTA: **Take me home** · Secondary: **Peek Standings**

**UI:** Full celebration frame; no skip-feeling dismiss-only.

**Celebrate:** Confetti once; sound optional off by default.

---

## A-full · Crystal Ball steps (Account re-run only)

Steps 1–3 (open / search / lock CB) are clearer than picks for *what*, weaker on *why optional*.

**Improve:** Frame as **bonus flex, zero points** up front; celebration *“Champ pick locked — flex only, no standings damage.”* Then handoff to picks with *“Now the points game.”*

---

# Track B — Commissioner first jobs

## B1 · Commish · first jobs (Home banner) — Step 1 Invite

**Current:** Share invite so people can join · Step 1 of 3 · InviteFriends embed

| | |
|--|--|
| **Why** | Strong |
| **What** | Strong (share link) |
| **Confirm** | Partial — `inviteCopied` local; humans≥2 also advances without celebration |
| **Next** | Partial — step advances quietly |
| **Emotion** | Partial |

**Missing confirmation:** After share/copy: *“Invite ready — send it in the group chat. We’ll move on when someone’s in (or when you’ve shared).”*

**Celebrate:** Checkmark step 1; confetti when first human joins (if detectable).

**Next:** Explicit *“Next job: publish a week so they have something to pick.”*

---

## B2 · Step 2 · Publish this week’s card

**Current:** N people · Pull Odds · pick 5 · Publish CTA → Commish

| | |
|--|--|
| **Why** | Strong (*empty picks = broken room*) |
| **What** | Partial — jumps to Commish; wizard continues there |
| **Confirm** | Weak on Home until card exists |
| **Next** | Partial |
| **Emotion** | Weak — still “ops tasks” |

**Confusion:** First-time host lands in dense Commish UI; wizard helps but is easy to leave via “Open full tools.”

---

## B3 · First card wizard (on Commish)

**Current:** Pull Odds → pick 5 → Publish · post-kickoff scoring hint

| | |
|--|--|
| **Why** | Partial |
| **What** | Strong structure |
| **Confirm** | Strong when button becomes “Week live ✓” |
| **Next** | Weak — scoring tip is premature at publish moment |
| **Emotion** | Weak |

**Copy after publish (prefer CardPublishedModal tone everywhere):**

> 🎉 **{Week} is officially LIVE.**  
> Players can open My Picks and lock now.  
> Next for you: text the crew once, then **See what they see**.

**UI:** Hide scoring paragraph until after first publish; wizard state machine with checkmarks.

**Celebrate:** Full-screen CardPublishedModal (already exists) should be **unmissable** — ensure first publish always fires it.

---

## B4 · Card is live modal

**Current:** 🟢 Card is live · friends can lock · invite · See player view · Open My Picks · Done

| | |
|--|--|
| **Why** | Strong |
| **What** | Strong CTAs |
| **Confirm** | Strong |
| **Next** | Strong if they tap player view / picks |
| **Emotion** | Strong — best moment in the stack |

**Improve copy slightly:**

> 🎉 **Your first week is officially LIVE.**  
> Players can now begin making picks.  
> Send the invite one more time, then **see their screen**.

**Through Their Eyes:** Make **See player view** the primary amber CTA (already is) — rename to **Through their eyes — player view** if product wants that brand phrase.

**Missing:** After player view, no reverse coach *“You’re seeing what they see. Open My Picks as them / lock yours as host.”*

---

## B5 · Step 3 · Score the week

**Current:** When games finish → Enter Results → score · “Did I lock my own picks?”

| | |
|--|--|
| **Why** | Strong |
| **What** | Partial — multi-step results UI is hard |
| **Confirm** | Weak until standings move |
| **Next** | Weak |
| **Emotion** | Partial |

**Copy when score succeeds:**

> 🏆 **Week scored.**  
> Standings updated. The paper’s cooking.  
> Next: peek Standings, then Gazette when it drops.

**Celebrate:** Crown animation lite; link Standings.

---

## B6 · View as player (Through Their Eyes mode)

**Current purpose:** Host sees non-commish chrome.

| | |
|--|--|
| **Why** | Weak unless after Card live modal |
| **What** | Weak — no persistent “you are in player view” coaching |
| **Confirm** | Weak |
| **Next** | Weak — exit is easy to miss |
| **Emotion** | Partial |

**Confusion:** Mode switch without narrative. Sticky banner needed: *“👀 Player view — this is their Home. Exit anytime.”*

**Copy:** *“This is their nav, their Home, their My Picks. Notice what they *don’t* see (Commish tools).”*

**Celebrate:** None needed; **trust** from clarity.

---

# Track C — Guest demo onboarding

## C1 · Welcome

Simulated Week 9 · bots · safe — **strong framing**.

**Improve:** One line of *purpose*: *“Tour the finished product so you know what you’re building with friends.”*

## C2 · Pick a seat

Clear player vs commish.

**Improve:** Emotion: *“Players lock cards. Hosts run the week. Pick one to tour first.”*

## C3 · Tutorial steps (player / commish)

**Weakness:** “Next →” advances **without verifying** they visited the page — teaches buttons, not doing.

**Improve:** Prefer *“Open My Picks”* as primary that navigates, then coach follows on that route (like real walkthrough). Confirm on return.

**Celebrate:** Demo-only badge *“Demo complete — nothing real was risked.”*

---

# Track D — Soft unlock (after first real lock)

**Current:** Sarcastic “legally allowed to show more buttons” · Board · Home louder · Gazette later

| | |
|--|--|
| **Why** | Partial — progressive disclosure unexplained |
| **What** | Strong CTAs |
| **Confirm** | Strong |
| **Next** | Strong (Board) |
| **Emotion** | Strong brand; may undercut sincerity |

**Copy (celebration-first):**

> 🎉 **You locked a real card — the room opens up.**  
> Board is in the nav. Home gets louder.  
> Gazette still drops when the host scores — worth waiting for.

---

# Track E — Ambient confirmations

## E1 · Picks saved modal

Already closer to the ideal. Tighten:

> ✅ **Nice! Your picks are locked in.**  
> You’re ready for kickoff.  
> Edit until first kickoff · after that, frozen.

## E2 · Login welcome

Status/sarcasm; can **steal focus** from first-lock tutorial.

**Improve:** If tutorial needed, defer welcome or make one line + *“Start your first lock →”* launching coach.

## E3 · Empty My Picks (no card)

Critical trust failure for friends who join early.

**Copy:** *“Your host hasn’t published this week yet. You’ll get a ping / just check back — the room isn’t broken.”*

---

# Cross-cutting findings

1. **Insider language** (“Walk the dog”, Padawan, “for blood”) builds brand for some, **lowers trust** for first-timers.  
2. **Confirmations exist** on save/publish but **tutorial completion can outrun the emotional read**.  
3. **Why is thinner than What** on confidence/Best Bet/prop.  
4. **Next-step is strong at publish**, weak after tutorial dismiss and in player-view mode.  
5. **Commish path is operationally correct** but rarely celebrates “you’re a host now.”  
6. **Through Their Eyes** as a product moment is **under-branded** — only a button after publish.  
7. **Competing popups** risk stacking (welcome + coach + soft unlock).  
8. **Guest tutorial advances without action** — teaches reading, not doing.

---

# Prioritized improvement list (no new features)

## P0 polish (highest confidence impact)

| # | Item | Track |
|---|------|--------|
| 1 | Rewrite coach titles/bodies: mission → action → confirm → next; retire “Walk the dog” as primary label | A |
| 2 | Guarantee celebration order: **Save success modal first**, then tutorial complete / Padawan | A |
| 3 | Empty / practice / live card **state labels** so room never feels broken | A, E3 |
| 4 | After publish: keep **Card live** as the emotional peak; primary CTA **Through their eyes** | B4 |
| 5 | Persistent **Player view** banner with exit and one-line purpose | B6 |
| 6 | Soft unlock: celebration-first, less sarcasm | D |
| 7 | Defer or fuse Login welcome when first-lock coach is active | E2 |

## P1 polish

| # | Item | Track |
|---|------|--------|
| 8 | Fill-card micro-checkmarks (picks / confidence / best bet / prop) | A2 |
| 9 | Confidence **why** one-liner (unique ranks = skill signal) | A2 |
| 10 | Commish step transitions: explicit “Step 1 done → Step 2…” toasts | B1–B3 |
| 11 | Score-week success celebration + Standings CTA | B5 |
| 12 | Guest tutorial: action-first CTAs, no advance without open | C |
| 13 | Padawan outro: dual tone (fun optional subtitle; clear main line) | A4 |

## P2 polish (delight, still no new features)

| # | Item |
|---|------|
| 14 | Micro-animations: coach step complete, publish confetti once, lock pulse |
| 15 | Progress dots always visible on coach |
| 16 | Spotlight/highlight primary Save button once on step 3 |
| 17 | After tutorial: single “suggested next” chip on Home (Standings or Locker) |

---

# Suggested copy bank (drop-in later)

| Moment | Prefer |
|--------|--------|
| Publish | 🎉 Your first week is officially LIVE. Players can now begin making picks. |
| Save picks | ✅ Nice! Your picks are locked in. You’re ready for kickoff. |
| Practice card | Practice card — same buttons as the real week. Standings won’t count this one. |
| Live card | Live week — this one counts. |
| Invite sent | Invite ready. Drop it in the group chat — they’ll land in the room with the code filled in. |
| Tutorial start | Every week has one job: lock a card before kickoff. Let’s do it once together (~1 min). |
| Tutorial done | Training complete. Same job every week from here. |
| Player view | 👀 You’re seeing their Home. Notice what they can’t see — then exit anytime. |
| Soft unlock | You locked a real card — more of the room just unlocked. Peek the Board. |

---

# What success looks like (acceptance for polish phase)

A brand-new user can answer without help:

1. **What do I do every week?** Lock a card before kickoff.  
2. **What does the host do?** Publish the card, then score when games end.  
3. **Did I succeed just now?** Yes — clear celebration.  
4. **What next?** Named next step, one primary CTA.  
5. **Do I trust the room isn’t broken?** Practice/live/empty states are labeled.

---

# Out of scope (per mission)

- No new features, no workflow redesign, no code in this document  
- DeferredChrome / performance / schema not in this audit  

---

# Recommended implementation order (when coding starts)

1. Copy-only pass on `player-tutorial.ts` coach strings + Padawan outro + SoftUnlock + CardPublished  
2. Wire celebration order (save modal → complete)  
3. Practice/live/empty labels on Picks  
4. Player-view sticky banner  
5. Fill-card micro-checks  
6. Guest action-first  
7. Motion last  

**Stop here until product approves this audit.**
