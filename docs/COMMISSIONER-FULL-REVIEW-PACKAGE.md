# COMMISSIONER FULL REVIEW PACKAGE

**Audience:** ChatGPT (or any model) product-clarity / feature-trimming review of the **current** Commissioner experience.  
**Constraint for reviewers:** Inventory and critique only. This package does **not** redesign or implement changes.  
**Generated:** 2026-08-03  
**Repo path:** `war-room-pickem` · route `/commissioner`

---

## Package size note

The Commissioner client alone is **~200KB / ~5,000 lines** of unminified source. The full package is split:

| Part | Path | What to load |
|------|------|----------------|
| **1 — Page source** | [`docs/COMMISSIONER-REVIEW-1-PAGE.md`](./COMMISSIONER-REVIEW-1-PAGE.md) | `page.tsx`, `loading.tsx`, **full** `CommissionerClient.tsx` |
| **2 — Components** | [`docs/COMMISSIONER-REVIEW-2-COMPONENTS.md`](./COMMISSIONER-REVIEW-2-COMPONENTS.md) | Every direct child component + onboarding/invite/view-as-player/foundry hooks (full source) |
| **3 — Flows** | [`docs/COMMISSIONER-REVIEW-3-FLOWS.md`](./COMMISSIONER-REVIEW-3-FLOWS.md) | Route/query logic, onboarding hooks, copy catalog, component tree, section notes (see/action/visible/real-data) |

**Also exported as plain text for offline paste:**  
`C:\Users\micha\Documents\WAR-ROOM-COMMISSIONER-FULL-REVIEW.txt`  
(concatenated package: this index + parts 1–3)

---

## How to feed ChatGPT

1. Upload or paste **Part 3 first** (tree + flows + notes) for structure.  
2. Then **Part 1** (full page — largest).  
3. Then **Part 2** (components).  
4. Ask for product clarity / feature trimming against the emotional goal of hosting (not documentation).

Suggested prompt fragment:

> You are reviewing the War Room Commissioner (/commissioner) experience for product clarity and feature trimming. Use the attached review package as the sole product inventory. Do not invent UI. For each surface, assess: (1) does a first-time host understand what to do? (2) is this essential vs. advanced vs. lab-only? (3) what would you cut, bury, or rename? Flag every Foundry mention visible to normal hosts. Flag checklist vs conversation conflicts.

---

## Scope checklist (must cover)

- [x] Build Card  
- [x] Pull Odds  
- [x] Who's In  
- [x] Enter Results  
- [x] Settings  
- [x] First Card Wizard  
- [x] Card publishing  
- [x] Scoring  
- [x] Invites  
- [x] Deputies/moderators  
- [x] Season reset  
- [x] View as Player  
- [x] Foundry references  

---

## Quick facts

- **Tabs:** `settings` | `card` | `picks` | `results`  
- **Ops roles:** Owner (full) vs Deputy (card/picks/results, no settings)  
- **First-time:** no scored weeks → simplified chrome + wizard  
- **Lab tools:** `showCommishLabTools()` — creator/Foundry only  
- **Onboarding deep link:** `/commissioner?tab=card&first=1`  

---

## Emotional goals (context from recent scrubs — not implemented claims)

- Immersion: in the experience, not above it  
- Host: "Wow… I can actually run this." not "I know the three jobs."  
- Note: page chrome may still show three-jobs / Foundry language — inventory in Part 3

---

## End of index — open parts 1–3 for full content
