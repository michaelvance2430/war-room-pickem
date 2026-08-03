# Host Dashboard — League Control Room redesign

**Status:** Rev 3 **FROZEN** — pre-code catalogs in `docs/HOST-DASHBOARD-IMPLEMENTATION-PREP.md`  
**Date:** 2026-08-03 (rev 3 + prep)

---

## Constitution line (keep in front during every decision)

> **The Commissioner page should feel like opening the door to your league—not opening league software.**

You are not building “commissioner tools.”  
You are building the **headquarters of someone’s football season.**

| Role word | Means |
|-----------|--------|
| **Commissioner** | Permission (publish, score, rules, pass role) |
| **Host** | Identity — creates the experience friends return for |

**Competitive feeling**

| ESPN Commissioner | War Room Host Dashboard |
|-------------------|-------------------------|
| “I need to do admin.” | **“Let’s see what my idiots are up to.”** (that smile) |

---

## Approvals (locked)

| # | Decision | Status |
|---|----------|--------|
| **1** | Hierarchy: **Hero → This Week → The Room → League Settings** | **Approved** (naming refined below) |
| **2** | Remove primary checklist + “three jobs” framing | **Approved** |
| **3** | This Week is a permanent owned object (never disappears) | **Approved** |
| **4** | Fate of four equal tabs | **HOLD** — navigation follows IA |

**Principle**

> A host opens War Room to **host people**, not manage software.

---

## Naming refinements (rev 3)

| Was | Now | Why |
|-----|-----|-----|
| League Health | **The Room** | Opening the door and looking around — not “health metrics” |
| Advanced | **League Settings** | Not scary; boring tools when needed |
| Current Week Card (as the centerpiece name) | **This Week** | The product object; a card lives *inside* it |

```
Nav: Home · Board · Locker · League · Account

LEAGUE (Host Dashboard)
  Hero
  This Week
  The Room
  League Settings
```

**Nav principle:** Labels answer “Where am I going?” — not “What role am I?”  
**League** scales for owners, deputies, and future sports. Permissions unchanged.

---

# 1. Information hierarchy

```
HOST DASHBOARD  (emotion; route may stay /commissioner)
│
├── 1. HERO — “Why did I open today?”
│      NEVER generic. Always a reason. Changes every week.
│      One primary action (or quiet healthy state).
│
├── 2. THIS WEEK — THE object (heartbeat)
│      Not “a card task.” The week you own.
│      Inside: status, published, games, prop, kickoff countdown,
│      locks, edit, preview, (future: history / archive).
│      Object permanence: never “I did that… where did it go?”
│
├── 3. THE ROOM — people and pulse
│      Seats, invites, relational peeks (Standings / Locker / Gazette)
│      “Who’s here? Who’s in the circle?”
│
└── 4. LEAGUE SETTINGS — boring on purpose (not scary)
       Rules · Deputies · Bots · Reset · Pass gavel · Danger zone
       Almost never needed mid-season.
```

**Tabs (#4 HOLD):** Do not let Settings / Build Card / Who’s in / Enter Results define the page. Nav follows this hierarchy later.

**Checklist:** First-season coaching only — not homepage. Fades with experience.

---

# 2. Hero — never generic

Hero always answers: **Why did I open today?**

Not: “Week 0 Live.”  
Yes: a **heartbeat that changes every week.**

| Tone | Example (direction, not final copy) |
|------|-------------------------------------|
| Green | Everyone is locked. Kickoff is tomorrow. |
| Red | Mike still hasn’t submitted picks. |
| Trophy | Games are final. Time to crown this week’s winner. |
| Invite | Five friends still need an invite. |
| Quiet | The room’s ready. Nothing’s on fire. |

**Primary CTA** matches the story (Nudge · Score · Publish · Invite) — or no CTA when healthy.

### Personality (later — not now)

Warm rotating status copy, not jokes:

| Dry | Warmer |
|-----|--------|
| 24 / 25 locked | One holdout left… |
| 24 / 25 locked | Somebody’s cutting it close. |
| 24 / 25 locked | The room’s almost ready. |

Tiny warmth = competitive advantage. Defer implementation until core hierarchy ships.

---

# 3. This Week is the product

Do **not** center the mental model on “Current Week Card.”

Center it on **This Week.**

A card is *inside* This Week — along with everything that makes the week real:

| Inside This Week | Role |
|------------------|------|
| Status | Draft · Published / Live · Needs score · Scored |
| Published | Object you own |
| Preview as player | See what they see |
| Edit | Pull odds, prop, republish path |
| Players locked | Pulse of the room this week |
| Kickoff countdown | When the door closes |
| Games + prop | The slate |
| (Future) History / Archive | Object permanence over seasons |

**This Week = THE object.**  
Not a completed checklist item.

---

# 4. The Room (was League Health)

Click Commissioner → feel like **opening the door and looking around.**

| Lives in The Room | Host question |
|-------------------|---------------|
| Seats / who’s in the circle | Who’s here? |
| Invites (owned object) | Can friends still walk in? |
| Standings / Locker / Gazette peeks | Who’s talking trash? What’s the vibe? |

Software-sounding “health” is gone. **The Room** is human.

---

# 5. League Settings (was Advanced)

Not scary. Not a punishment zone.

```
League Settings
  Rules
  Deputies
  Bots
  Reset
  Pass Gavel
  Danger Zone
```

Host almost never needs this mid-season. Collapsed by default. Calm, clear labels.

---

# 6. The page ages with the host

| Season of host | Dashboard feels like |
|----------------|----------------------|
| **Year one** | Coach — more guidance, soft coaching, first-week clarity |
| **Year three** | Almost no guidance — just information. Heartbeat + This Week + The Room |

Guidance is progressive disclosure by **host experience**, not a permanent checklist homepage.

---

# 7. Wireframe (rev 3)

```
┌──────────────────────────────────────────────────────────────────┐
│  HOST DASHBOARD                              [Preview as player] │
│  {League name}  ·  {sport}                                       │
├──────────────────────────────────────────────────────────────────┤
│  HERO — why did I open today?                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 🔴 Mike still hasn't submitted picks.                      │  │
│  │    Kickoff Thursday.                                       │  │
│  │    [ Call out the holdouts ]                               │  │
│  └────────────────────────────────────────────────────────────┘  │
│  (or 🟢 Everyone locked · Kickoff tomorrow — no admin CTA)       │
│  (or 🏆 Games final · Time to crown this week's winner)          │
├──────────────────────────────────────────────────────────────────┤
│  THIS WEEK                                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Status: Live · Published                                  │  │
│  │  5 games · prop · first kickoff countdown                  │  │
│  │  24/25 locked  (warmth later: "One holdout left…")         │  │
│  │  [Edit] [Preview as player] [See who's out]                │  │
│  │  Always here — never vanishes after publish                │  │
│  └────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  THE ROOM                                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Seats · invites · open the door to Standings / Locker     │  │
│  └────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  LEAGUE SETTINGS  ▸                                              │
│  Rules · Deputies · Bots · Reset · Pass Gavel · Danger Zone      │
└──────────────────────────────────────────────────────────────────┘
```

---

# 8. Component inventory (rev 3)

| Current surface | Decision | Notes |
|-----------------|----------|--------|
| Checklist + Why: / three jobs | **Remove** primary | First-season coaching only, fades |
| Hero attention | **Keep (new)** | Never generic; weekly heartbeat |
| Build Card stack | **Keep → inside This Week** | Edit path of the permanent object |
| Who’s in / announce | **Keep → This Week** | Locks / holdouts |
| Enter Results / Score | **Keep → Hero when hot + This Week** | “Crown a winner” language |
| Invites / code | **Keep → The Room** | Owned object |
| View as player | **Keep → header utility** | Not hero |
| Season rules / theme / cut / CB | **League Settings** | Boring |
| Bots / deputies / pass / reset / danger | **League Settings** | Labeled, not scary |
| Foundry / lab | **Remove** from host UI | Creator only |
| Four equal tabs | **HOLD** | Follow IA later |

---

# 9. Rationale (primary sections)

| Section | Host question | Why it stays |
|---------|---------------|--------------|
| **Hero** | Why did I open today? | Doorway emotion; changes every week; not admin list |
| **This Week** | What’s my league doing this week? | **The product object**; permanent home |
| **The Room** | Who’s here / what’s the vibe? | Opening the door; relationships |
| **League Settings** | Rare ops? | Available, calm, almost never mid-season |

---

# 10. Implementation freeze

**Do not code** until Mike approves rev 3 naming + wireframe.

**When implementing, hold this line:**

> The Commissioner page should feel like opening the door to your league—not opening league software.

Suggested next design pass (still no code): Hero state catalog + This Week status model + what data feeds each line.

---

## Related

- `docs/WAR-ROOM-CONSTITUTION.md` — immersion + investment  
- `docs/COMMISSIONER-REVIEW-3-FLOWS.md` — current engineering map  
