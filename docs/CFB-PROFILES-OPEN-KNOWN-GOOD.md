# CFB Profiles Open — Known Good Baseline

**Tag:** `cfb-profiles-open-known-good`  
**SHA:** `c83058d` (`c83058da594547db621b67a9df1f13941202be90`)  
**Branch:** `main`  
**Frozen:** 2026-08-04  
**Status:** Last known-good build for **Profiles reopened** after peer-profile freeze fix  

---

## Milestone

| Item | Status |
|------|--------|
| Profiles reopened | Yes |
| Peer-profile freeze fixed | Yes |
| Phone retest | Passed (Mike) |
| Desktop retest | Passed (Mike) |
| Postmortem | `docs/PROFILE-FREEZE-POSTMORTEM.md` |

---

## What this baseline preserves

### Product behavior

- Standings → peer profile opens without multi-second / multi-minute freezes
- Multiple peers open cleanly after Standings warm
- Own profile / peer identity paint from warm `loadLeaguePlayers` cache when available

### Engineering fixes (must not regress without retest)

| Area | Intent |
|------|--------|
| `badge-celebration` + `BadgeUnlockModal` | No force-check feedback loop into `findNewBadgeUnlocksForSession` |
| `queuePendingBadgeCelebration` | Event only when pending set **grows** |
| `findNewBadgeUnlocksForSession` | Single-flight |
| `loadLeaguePlayers` | Longer TTL + stale-while-revalidate; quiet inflight joins |
| `CrownAndShame` | Stable prop identity (no array-ref thrash) |
| Profile nav trace | **Opt-in only** (`warroom-profile-nav=1`) |

### Key modules

- `src/lib/badge-celebration.ts`
- `src/components/BadgeUnlockModal.tsx`
- `src/lib/legacy-badge-grants.ts`
- `src/lib/cloud.ts` (`loadLeaguePlayers`)
- `src/app/profile/[id]/page.tsx`
- `docs/PROFILE-FREEZE-POSTMORTEM.md`

---

## Known-good smoke sequence

1. Hard refresh production (or local build at tag).  
2. Sign in → real CFB league.  
3. Standings → wait until settled.  
4. Open **3+ peer** profiles (including a previously “bad” peer if known).  
5. Back to Standings → open another peer.  
6. Optional: open **Load profile details** once.  

**Pass:** no freeze, navigation remains usable, no console storm of `badge-celebration.findUnlocks` / LLP depth climb.

---

## Freeze rules

1. **Do not** re-enable default-on profile-nav / LLP graph logging in production.  
2. **Do not** restore `queuePending` → always-fire `warroom-force-badge-check` without single-flight + growth-only dispatch.  
3. **Do not** shorten `loadLeaguePlayers` fresh TTL back to 15s without stampede retest.  
4. Profile **design** work may proceed on top of this tag; freeze fixes require re-running the smoke sequence.

---

## Restore

```bash
git fetch origin
git checkout cfb-profiles-open-known-good
# or
git checkout c83058d
```

---

## Next

**Profile experience review** (design / UX).  
Not: more freeze theory work unless regression appears.
