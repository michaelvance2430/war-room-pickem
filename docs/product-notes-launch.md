# Product notes — launch / growth (logged)

**Status:** Ideas only. Not in Phase 1 multi-sport spine.  
**Owner:** Mike Vance  
**Logged:** 2026-07-31 (approx)

---

## 1. Achievement titles (launch tiers)

| Cohort | Title / reward idea |
|--------|---------------------|
| **First 1,000 players** (includes everyone in the test run) | **OG** title |
| **Next 5,000 players** | A different **fun** title (not “fund”) — witty, sassy, room energy |
| **Everyone after that** | Option to pick up a **mildly interesting** achievement (not the same as OG) |

### Notes
- Needs a global, server-side player order / join stamp (not localStorage only).
- Test-run players must be grandfathered into the first 1,000.
- Titles equip like existing nameplate titles when possible.
- Copy for these titles follows **Voice** below — sarcastic shit-talk, never bigotry.

---

## 2. Room / invite controls

### Lock room (commissioner)
- **Action:** Commish can **freeze the league** when happy with roster size.
- **Effect:** No more invites accepted (join by code / link blocked until unlocked).
- **Why:** Stop late stragglers after the room is “set.”

### Invite link landing — clear options
When someone hits an invite link, show explicit paths:

1. **Join as commissioner** — start their own room  
2. **Join with a code** — friend / private room  
3. **Join open rooms** — discover / hybrid public spots  

Supports:
- Pure stranger leagues  
- Hybrid (friends + open seats)

---

## 3. Anti-quit friction

- Early-season **quit** should carry a **real negative consequence** (detractor / penalty).
- Goal: stop people joining then bailing mid-season when they can’t commit.
- Leaving a half-empty league is bad for the remaining group.

### Open design questions
- Season window for “early” vs free leave  
- Penalty form: badge (trash energy), points, join cooldown, public “bailed” flag  
- Commish-kick vs voluntary leave  

---

## Suggested build order (when we leave multi-sport spine)

1. **Lock room** — smallest, highest host value  
2. **Invite landing options** — growth + clarity  
3. **Quit penalty** — needs careful UX so it doesn’t feel cruel to good-faith leavers  
4. **OG / launch titles** — needs global player index + migration for test-run users  

---

## Voice (foundation — all sports, all features)

The whole experience — CFB, NFL, event packs, Gazette, titles, invites, quit roasts — sits on one pillar:

> **Sarcastic shit-talking fun.**

| Do | Don’t |
|----|--------|
| Witty, sassy, roast-the-room energy | Racist |
| Multi-gen dad-joke / group-chat heat | Sexist |
| Fair game: bad picks, ghosts, chaos | Homophobic |
| Leave them laughing, not targeted for who they are | Xenophobic / bigoted |

Shit-talk the **card**, the **week**, the **lock habits**, the **Toilet Bowl path** — never identity or protected traits. If a line could land as a real-world slur or punch-down, it doesn’t ship.

This is non-negotiable product DNA across every sport pack.

---

## Locker reactions (dev)

- React on messages with emoji (😂 🔥 😭 😤 💀 🤬 👏 👀 🤡 🫡) without a full reply.
- SQL: `supabase/locker-reactions.sql`
- Toggle on/off; muted users can’t react.

---

## Out of scope until explicitly pulled in

- Multi-sport packs (see `docs/MULTI_SPORT.md`)  
- Public app-wide achievement leaderboard (see `docs/public-launch-backlog.md`)  
