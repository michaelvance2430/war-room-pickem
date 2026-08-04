# Commissioner First Hour (P0)

**Status:** ACTIVE — 2026-08-04  
**Companion:** `docs/FIRST-HOUR-TRUST.md` (player/guest)  
**Laws:** Commissioners create experiences, not history · Rule of Closure

---

## Goal

A brand-new commissioner creates and publishes their first week **without instructions or questions.**

Path:

1. Create a league  
2. League Build (room constitution)  
3. Build first card (week-ops)  
4. Publish  
5. Return Home with complete confidence  
6. Know what players experience (optional player view)

---

## Audit lens (every step)

* Is there only one obvious next action?  
* Does every action clearly confirm success?  
* Does the commissioner ever stop and think, “What do I do now?”  
* Does anything feel like admin instead of football?

Rule of Closure — they always know:

1. What just happened  
2. That it worked  
3. The one obvious next step  

---

## Canonical spine (production)

```text
Create league
    → /league-build?new=1
    → Save room · build first card
    → /week-ops?first=1
    → Odds → Games → Prop → Publish
    → "{Week} is LIVE." · Done → Home
    → (optional) See what players see
```

**Not** the first-hour path: Manage League (`/commissioner`) admin desk.  
That is secondary — after the room is live.

Legacy links (`/commissioner?tab=card&first=1`) redirect to week-ops.

---

## What we fixed in this pass

| Friction | Fix |
|----------|-----|
| League Build → old Commish card tab | → `/week-ops?first=1` |
| Join “Build first card” → admin | → week-ops |
| Coaching keys → `/commissioner?tab=card` | → week-ops |
| Publish done = vague “Done” | **It worked** · LIVE · Done → Home · player view |
| Room set → limbo | Hand-off banner: “Room ready · one job left” |
| Dual paths (week-ops vs commissioner) | First hour unified on week-ops |

---

## Out of scope (enhancement, not rescue)

* Achievements · trophies · hardware · museum  
* Full Manage League redesign  
* Scoring first-hour polish (next after publish spine is solid)

---

## Acceptance

A friend handed War Room for the first time should:

1. Create a room  
2. Accept recommended (or customize once)  
3. Publish a card in under ~10 minutes  
4. Land on Home knowing the week is live  
5. Optionally see the player view  

…without opening Foundry, reading a manual, or asking “is this admin software?”

---

## One line

> Hosts run football season, not configuration. Every host action closes one chapter and opens the next.
