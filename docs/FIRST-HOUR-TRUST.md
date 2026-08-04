# First Hour Trust (P0)

**Status:** ACTIVE — 2026-08-04  
**Mission:** Make the first 15 minutes feel inevitable.  
**Whiteboard:** *The product is better than what the sim currently allows people to trust.*  
**Host path:** `docs/COMMISH-FIRST-HOUR.md`

---

## Assessment

**The game is ready. The wrapper isn't.**

Not: “Picks are confusing.”  
Yes: “The first hour keeps getting in the way of the picks.”

---

## Acceptance criteria

A friend with zero context should be able to:

1. Create an account (under a minute)  
2. Join a league **or** create a league  
3. Understand what War Room is  
4. Make picks in a **real** room  
5. Leave wanting to start their own league  

…without seeing:

* SQL / UUID / infrastructure errors  
* Loading loops  
* Contradictory states (Home vs Picks vs Board)  
* Stuck tutorials  
* **Guest / demo alternate universe** (retired — one world only)

---

## Guest mode — REMOVED (frozen)

Guest tour is **deleted**, not paused. No dormant product.

| Keep | Purpose |
|------|---------|
| `src/lib/guest-mode.ts` | `GUEST_MODE_RETIRED` + `purgeRetiredGuestSession` / `bootPurgeLegacyGuest` only |
| Legacy id constants | Detect stale localStorage → clear → `/login?mode=signup` |

No guest components, seed world, cloud forks, or `isGuestMode()` branches.  
**Direction:** Account → Join/Create → play. Foundry is the only simulation.

---

## Rules

### Rule of Closure (product law)

> **Every meaningful action must end with certainty.**

Audit every first-hour transition:

> Does the player immediately know it worked, and do they know exactly where to go next?

If no — the workflow is not finished.  
Home is the natural resting place after most completed jobs.  
Full law: `docs/WAR-ROOM-CONSTITUTION.md` · Rule of Closure.

### Teach once. Then disappear forever.

Tutorials never become obstacles.  
Dismiss → gone. Navigate → gone. Already on the page → gone.

### Guests visit. They do not fail.

Every guest failure becomes membership language:

> Join the league to unlock this.

Never: raw Postgres, uuid, “room cache empty.”

### Home is sacred

Home always opens. Even a limited guest Home. Never hang on “Opening Home…”

### One reality

If Home says the week is live, Picks and Board agree.  
If Home says no card, Picks does not show a full card.

### Players first, then hosts

Commissioner journey is next — fewer people, after first-hour player trust.

---

## Do not touch until first hour is beautiful

* Achievements · trophies · hardware · museum · crews  

Nobody sees the trophy case if they quit during onboarding.

---

## Engineering checklist (this pass)

- [x] Guest Locker never hits Supabase / never shows uuid errors  
- [x] Guest tutorial = one coach beat, then gone forever  
- [x] `ensureGuestWorld()` so guest Home re-seeds instead of hanging  
- [x] Guest `leagueHasLiveCard` = true (tour Week 9)  
- [x] HomeWeekHero degraded path reads local guest card  
- [ ] Clean commissioner onboarding (next)  
- [ ] Re-sim smoke after deploy  

---

## One line

> Fix the container so people get to experience the soul — picks, standings, personality — instead of wondering if the app is broken.
