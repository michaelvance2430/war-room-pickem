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

## Crew transfer into another sport (parking lot)

When a commissioner asks the existing crew whether they want to play another
sport, treat it as a roster handoff—not a disposable chat poll.

- Members receive a prominent **Next Season?** card on Home plus a Locker Room
  notice. They answer **Yes / Maybe / No** and select interested sports.
- The commissioner sees a **Crew Interest** dashboard with response totals,
  named responses, non-responders, and sport-by-sport demand.
- **Start [sport] with these members** creates a draft league for the selected
  sport and carries over only the opted-in roster.
- The commissioner reviews settings and sends the new-room invitation before
  anything becomes active.
- Account identity and account-wide achievements follow the people. Standings,
  points, trophies, season records, and sport-specific competitive history do
  not transfer into the new league.
- Keep the original league intact and provide a clear link between sibling rooms
  so the crew can move without losing its history.

---

## Recruiting Board / matchup scouting (parking lot)

Give players an optional side-by-side team comparison before they make a pick.
The feature should feel like a recruiting/scouting board inside War Room—not a
spreadsheet dump and not a required extra step.

- Open directly from a matchup on the Picks page and return to that same pick.
- Compare both teams in parallel with the same stat categories and clearly
  show which team leads each category.
- **CFB:** national rank, record, conference record, strength of schedule,
  scoring offense/defense, turnover margin, ATS record, home/road split, and
  recent form.
- **NFL:** record, division standing, points for/against, offensive/defensive
  rank, turnover margin, ATS record, home/road split, recent form, and material
  injury status when reliable data is available.
- **March Madness:** tournament seed, record, NET/résumé indicators, strength
  of schedule, quality wins, offense/defense, rebounding, turnover margin,
  free-throw shooting, recent form, and relevant injuries.
- Preserve each sport's decision language: rankings for CFB, pro performance
  for NFL, and seeds/résumé/upset signals for March Madness.
- Show data source and freshness. Never invent or silently estimate a team stat.
- Keep the core weekly flow fast: scouting is available for players who want
  help, while confident players can still pick immediately.

Foundry should prove normal comparisons, missing data, stale data, ties,
unranked teams, First Four teams, and mobile layout before production release.

---

## Commissioner unlock + odds telemetry (parking lot)

- Before first kickoff, let the commissioner deliberately **Unlock Week** when a
  card was locked too early. Require confirmation and an audit reason.
- Unlocking must clear affected locked-pick state safely, preserve an audit
  receipt, and automatically publish a league announcement explaining that the
  week reopened and players may need to confirm picks again.
- The commissioner can then pull a fresh odds snapshot (for example, Monday of
  Week 0) and republish under the normal lock rules. Never silently replace a
  spread underneath a locked pick.
- Scrub the odds-provider key and request path end to end. Foundry must show
  configuration health, last successful request, latest HTTP/error status,
  provider-reported requests/credits used and remaining, and whether the shown
  balance is current or stale.
- Foundry must distinguish **key missing**, **provider unreachable**, **provider
  response lacks quota headers**, and **telemetry table/service-role missing**.

---

## Out of scope until explicitly pulled in

- Multi-sport packs (see `docs/MULTI_SPORT.md`)  
- Public app-wide achievement leaderboard (see `docs/public-launch-backlog.md`)  
