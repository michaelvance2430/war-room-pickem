# League Switcher — Stage 0 product decisions (binding)

**Status:** Binding product decisions approved before Stage 1 implementation.  
**Do not re-open in code without Mike + ChatGPT review.**

These decisions govern multi-league switcher attention work. Stage 1 is backdrop-only; badge work starts only after Stage 1 review.

---

## 1. Badge number

```
count = (outstanding weekly hub task ? 1 : 0) + N unread commissioner announcements
```

- Weekly hub task is **binary** (0 or 1): the hub presents **sequential** next actions only.
- Do **not** enumerate every future step.
- Do **not** create a parallel mission system.

Examples:

| State | Badge |
|-------|-------|
| One unfinished weekly task, 0 unread announcements | **1** |
| One unfinished weekly task, 2 unread announcements | **3** |
| No task, 2 unread announcements | **2** |
| Nothing actionable | **no badge** |

---

## 2. Score Week

**Yes.** “Score Week” counts as an actionable commissioner task and must eventually match the existing Home host mission (`resolveCommishHomeMission`).

---

## 3. Deputies

Deputies may receive host-style operational badges **only** for actions they are actually authorized to perform.

Never display a badge that leads a deputy to an inaccessible or unauthorized action.

---

## 4. Current league

- **Expanded league card:** show the current league’s count.
- **Collapsed league-switcher control:** count **OTHER leagues only** — the current league’s Home mission already handles that room.

---

## 5. Collapsed badge scope

The collapsed control sums actionable items across **all other leagues** and **all sports**, not only the currently visible sport tab.

---

## 6. Crystal Ball / Lock Picks

**Yes.** Count them when the existing hub resolver truthfully identifies them as the user’s current task.

---

## 7. Announcement reads

Before Stage 3 (announcement counting):

- Verify the **deployed production** database has `announcement_reads` (structure + RLS policies).
- Repository SQL alone is **not** proof.
- Do **not** ship announcement counting unless durable per-user read state is confirmed.

---

## 8. Refresh policy

Refresh attention state when:

1. The switcher **opens**
2. The browser regains **focus / visibility**
3. After a **relevant task is completed** in the current session
4. Every **60 seconds only while the switcher remains open**

Do **not** continuously poll while the switcher is closed.  
Reuse existing pulse TTL / single-flight protections where appropriate.

---

## Implementation stages

| Stage | Scope |
|-------|--------|
| **1** | League switcher backdrop only (visual / client) — shipped |
| **2** | Weekly hub-task badges only (binary 0/1 per league; no announcements) — shipped |
| **3** | Combined badges = task bit + durable unread announcements (batched; production gate required) — authorized after Stage 2 visual review |
| **4** | Score Week parity + deputy authorization alignment — not authorized yet |

---

## Out of scope for badges (always)

- Ordinary Locker Room chat
- Gazette / general activity
- Foundry / simulation / fake demo state
- Completed or acknowledged items
- Mixing unread chat with actionable counts
- Clearing a task badge merely because the league was opened
