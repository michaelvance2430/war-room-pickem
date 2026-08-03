# P0 Trust & Identity — Lessons Learned

**Status:** Retrospective · accepted P0  
**Date:** 2026-08-03  
**Scope:** Guest Mode · Practice Mode · Live League · Board/Plot empty states · Consistent chrome  
**Ships (representative):** Guest contract, Locker triad, Plot So Far, Practice completion, consistent shell  

This is not a feature list.  
These lessons apply to **every future feature**.

---

## Verdict

> **P0 accepted.**  
> Implementation reinforced the Product Architecture Freeze without introducing new concepts.  
> Do **not** reopen Trust & Identity unless a scrub discovers a **regression**.

---

## Lessons

### 1. Technical accuracy ≠ user understanding

A correct calculation, a successful network call, or a “valid” empty string can still **feel broken**.

| Technical | User hears |
|-----------|------------|
| Supabase RLS reject on guest post | “The app is broken” |
| Rank 1/25 with all zeros | “Did I miss something?” / “Is this fake?” |
| Nav items present but brand hierarchy differs by sport | “Is this a different app?” |

**Rule:** Design for the mental model first. Then wire the system.

---

### 2. Empty states beat fake data

Filler (0 pts, L2, ATS 3–9, fake Week 5) destroys trust faster than a blank page.

**Rule:** If history hasn’t been earned, **say so with personality**.

- Board: nothing to reveal yet  
- Plot: your story starts here  
- Standings/Stats: no competitive columns until first score  

**Empty should feel exciting, not unfinished.**

---

### 3. Users think in goals, not routes

| App language | User language |
|--------------|---------------|
| Open real season picks | Go to This Week |
| Exit demo → Account | Join a League |
| Commish tools | League |

**Rule:** CTAs name the **outcome**, not the path.

---

### 4. Three realities — never blur them

| Reality | Purpose |
|---------|---------|
| **Guest tour** | Convince in five minutes that War Room is worth joining |
| **Practice Mode** | Safe private practice — nothing hits the real league |
| **Live League** | Real season, real friends, real Moments |

**Rule:** Identity chrome and data paths must make the reality obvious. Never hybrid UI.

---

### 5. Every blocked action should teach and convert

Especially Guest Mode:

1. **Why** can’t I?  
2. **What** am I missing?  
3. **How** do I unlock it?  

Never: red permission denied, muted-by-moderator, RLS, SQL, “Not signed in” for guests.

**Rule:** A block is an **invitation**, not an error.

---

### 6. Guests observe. Members belong.

Apply everywhere: Locker, Board, Standings, titles, crews.

Restrictions should feel like **membership**, not a crippled account.

---

### 7. Internal terminology stays in Foundry

Sandbox · Dry Run · Hop · Lab · Shop · Through Their Eyes · DEMO (as product chrome)

**Rule:** Customers never need creator vocabulary.  
Customer language: Preseason · Practice Mode · Guest · Live League · League (destination).

---

### 8. Consistency builds confidence

- ✅ Different **leagues** have different personalities  
- ✅ Different **roles** change job content  
- ❌ Different **sports** must not feel like different apps  

**Rule:** Shell stays familiar. Content and atmosphere change.

---

### 9. Frame vs content

If both the **frame** and the **content** change when switching context, the product feels fragmented.

**Rule:** Change the channel (content), not the TV (shell).

---

### 10. Architecture freeze works when we execute it

This P0 improved War Room by **removing friction and confusion**, not by adding features.

**Rule:** Before inventing something new, ask whether trust/clarity/polish on what exists matters more.

---

### 11. Teach once. Then trust the player.

Graduation of Practice (ship `b77407a`): six reminders → one calm promise.

Helpful copy that repeats the same concept becomes noise.  
Noise is not safety — it is doubt.

**Rule:** Teach the mechanic once. Keep the minimum trust cue. Get out of the way.

Practice is a **state**, not a product whose job is to stay visible.  
The best outcome is players forgetting Practice existed and remembering War Room was easy to learn.

Constitution: `docs/WAR-ROOM-CONSTITUTION.md` → **Teach-once principle**.

---

## Three realities (healthy architecture)

The clearest separation we locked:

> **Guest tour · Practice (state) · Live League**

Each has one job. No bleeding.

---

## Recommended execution order (post–Trust & Identity)

| Order | Focus | Why |
|-------|--------|-----|
| **P0.1** | Trust & Identity | ✅ Done |
| **P0.2** | **League (Host) Dashboard** | Highest leverage weekly screen — hosts run the product |
| **P0.3** | Season Opening Moment | Once-a-year peak; better after host home is solid |
| **P0.4** | War Room Moments framework | Wire first Moment cleanly |
| **P0.5** | Personality return | Gazette, cheevos, crews, titles |

Season Opening happens once a year.  
A host visits League **every week**. Prioritize hosts first.

---

## When to reopen this P0

Only if a scrub finds a **regression**:

- Guest post looks broken again  
- Practice bleeds into live  
- Fake history returns on Board/Plot/Standings  
- Shell drifts by sport without product reason  

Otherwise: **protect and move on.**

---

## Success metric (repeat)

> Does War Room feel more like War Room?

Not: how many features shipped.
