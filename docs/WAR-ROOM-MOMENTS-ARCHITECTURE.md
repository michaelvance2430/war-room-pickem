# Promote "War Room Moments" to a Core Product System

**Status:** Architecture decision — **critique first, no implementation until approved**  
**Date:** 2026-08-03  
**Audience:** Founder + implementers  
**Related:** `OFFICIAL-SEASON-OPENING-SEQUENCE.md`, `WAR-ROOM-CONSTITUTION.md`, Foundry hub

---

> **This is a foundational product architecture decision. Before implementation, critique whether this framework is the right long-term direction for War Room, not just whether the code can support it.**

This is no longer a Foundry rename.  
This is a product architecture decision.

War Room is becoming a **collection of memorable traditions**, not isolated features.  
Foundry should reflect that.

---

## Rename (Foundry surface)

Replace the current Preview section with:

# 🎬 War Room Moments

This becomes the permanent home for every major **player-facing** emotional beat.

These are not “previews.”  
They are the emotional beats of the product.

Foundry becomes the studio where every major War Room experience is created, previewed, and verified before production.

---

## Four permanent Moment categories

### 🏈 Season Begins

Happen **once** and establish the feeling of a new season.

Examples:

- College Football Opening  
- NFL Kickoff  
- Future sport openings  

**Identity law:** Every opening has its own identity.

- **CFB** → Saturday mornings, campuses, rivalries, GameDay  
- **NFL** → prime time, stadium lights, Opening Weekend  

No generic celebration.  
The sport should be recognizable **before a single word is read**.

---

### 📅 Weekly Rituals

The heartbeat of the season.

Examples:

- Card Goes Live  
- Gazette Reveal  
- Board Unlock  
- Gazette Archive Opens  
- Weekly Cheevos  

---

### 🏆 Milestones

Moments players **earn**.

Examples:

- Ring Ceremony  
- First Cheevo  
- Trophy Unlock  
- Hall of Fame additions  
- Future major achievements  

---

### 👑 Season Finale

The emotional close of the season.

Examples:

- Crown the Champion  
- Championship Ceremony  
- Season Wrap-up  
- Trophy Presentation  

---

## Rarity law (protect goosebumps)

Not every Moment uses full ceremony energy.

**Season-scale fireworks / full-screen ritual** stay rare (≈ four peaks):

1. Season Opening  
2. First Week Scored (if treated as a peak)  
3. Champion Crowned  
4. New Season Begins Again  

Weekly rituals and many milestones may be quieter (paper, banner, short toast).  
If everything has fireworks, nothing has fireworks.

---

## Every Moment is a reusable object

Instead of custom one-off systems, every Moment defines:

| Field | Purpose |
|-------|---------|
| **Name** | Player-facing identity |
| **Category** | Season Begins · Weekly Ritual · Milestone · Season Finale |
| **Purpose** | One sentence: what tradition this builds |
| **Supported Sports** | Per-sport identity, not generic |
| **Trigger** | When the world becomes true (publish, score, engrave…) |
| **Eligibility** | Who can see it (user · league · sport · season · role) |
| **Priority** | ExperienceQueue order |
| **Animation** | None / light / full ceremony (budgeted) |
| **Copy** | Speech bank, personal garnish rules, sport voice |
| **Replay Policy** | Once per season · once ever · every week · Foundry-only replay |
| **Foundry Preview** | How Mike previews without customer discovery |
| **Analytics** | Claim, complete, skip, speech_id (no PII abuse) |

Future experiences **plug into this framework** instead of inventing new popup systems, wave loaders, or DeferredChrome catalogs.

---

## Product philosophy

War Room should not be remembered because of features.  
It should be remembered because of **moments**.

Every Moment answers one question:

> **Will players remember this a month later?**

If not, it probably doesn't belong in War Room Moments.

Football is the excuse.  
Relationships are the product.  
**War Room Moments are how those relationships become annual traditions.**

---

## Constitution addition (proposed)

> **Moments become traditions. Traditions keep leagues together.**

---

## Relationship to existing work

| Existing design | How it fits |
|-----------------|-------------|
| Official Season Opening Ceremony | First **Season Begins** Moment object (CFB / NFL identities) |
| Board empty / never invent history | Trust before drama — Moments never invent achievement |
| Practice Mode / dual realities | Moments never fire in Practice; Live League only |
| ExperienceQueue (opening sequence doc) | Runtime orchestrator for Moment priority |
| `user_season_moments` (proposed) | Claim / replay policy store |
| Foundry | Studio: create, preview, verify Moments |
| RoomDeferredChrome | **Not** the Moment runtime — retired as architecture |

---

## Future direction

1. **Catalog** every major player beat as a Moment object (including legacy ceremonies).  
2. **Runtime** ExperienceQueue consumes Moment definitions (one blocking Moment at a time).  
3. **Foundry** War Room Moments lab: list by category, preview, eligibility reasons, reset (creator only).  
4. **Sports** pack each Season Begins Moment with sport identity (visual + voice) before copy.  
5. **Rarity audits** — no new full-ceremony Moment without replacing or demoting another peak.

---

## Explicit non-goals

- Not a rename of Foundry for marketing only  
- Not re-enabling DeferredChrome waves  
- Not fireworks on every badge  
- Not generic multi-sport confetti with swapped week numbers  

---

## Implementation phases (only after architecture approval)

| Phase | Work |
|-------|------|
| A | Architecture critique + constitution line (this doc) |
| B | Moment type schema + registry (code, no UI polish) |
| C | Migrate Season Opening into first Moment definition |
| D | ExperienceQueue consumes Moment registry |
| E | Foundry “War Room Moments” studio UI |
| F | Migrate Ring / Finale / Gazette / Card Live as Moments |

**No implementation of B–F until the long-term direction is approved.**

---

## Design amendment log

| Date | Note |
|------|------|
| 2026-08-03 | Architecture promotion: Moments as core system, four categories, object schema, rarity, Foundry as studio. Critique-first framing. |
