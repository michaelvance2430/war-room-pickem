# War Room Moments — Stable Baseline (Freeze)

**Tag:** `war-room-moments-stable-baseline`  
**SHA:** `b9989ba29d1d89756a6f29121df4bdffc2f29daa`  
**Branch:** `main`  
**Frozen:** 2026-08-03 (session)  
**Status:** Last known-good Moments interaction baseline

---

## What this baseline preserves

Working handoff and reader contracts:

| Experience | Behavior |
|------------|----------|
| **Season Cold Open** | Opens from Foundry Moments test; scrolls; stays open until dismiss; sticky close; sport-specific CFB/NFL copy; named body lock `season-cold-open` |
| **Gazette modal** | Fixed shell + article-only scroll; sticky ✕; named body lock `gazette-reader` |
| **Handoff** | Cold Open → Moments → Gazette: shared presenter stage + named body locks; next Moment waits for idle |
| **Watchdog** | Orphan force-unlock **does not** kill registered lock owners |

### Key modules (do not casually rewrite)

- `src/lib/smooth.ts` — `acquireBodyLock(owner)`, ownership-aware `unlockIfOrphanedLock`
- `src/lib/moments/presenter.ts` — one active presenter at a time
- `src/lib/safe-nav.ts` — recovery skips force-unlock when a named owner is active
- `src/components/WeeklyColdOpenModal.tsx` — single `closeColdOpen` exit path
- `src/components/GazetteModal.tsx` — scrollport + `gazette-reader` lock

---

## Known-good test sequence

Repeat multiple times after any Moments change:

1. Open **Season Cold Open** (Foundry → Test Moment / current league)
2. Scroll the article top → bottom
3. Finish with **Done / back to Moments** (or ✕ / Escape)
4. Open **Gazette** (force paper / live offer)
5. Scroll Gazette fully
6. Close Gazette
7. Navigate Home / Picks / Standings / Locker

**Pass:** no freeze, no ghost overlay, no body-lock residue, navigation works.

---

## Freeze rules

1. **Do not** modify the shared presenter, body-lock ownership, modal ownership, or Moment cleanup system without **explicit founder approval**.
2. Every future Moment change is **one feature → one commit → one production test**.
3. If a change breaks navigation or scrolling: **`git revert` / reset to this baseline first**, then re-apply a smaller fix.
4. **Do not** stack multiple unverified Moment presenters on top of this baseline.
5. Auto-launch of Moments remains off under SAFE NAV until explicitly re-enabled per Moment.

### Restore this baseline

```bash
git fetch origin
git checkout main
git reset --hard war-room-moments-stable-baseline
# or:
git reset --hard b9989ba29d1d89756a6f29121df4bdffc2f29daa
git push --force-with-lease origin main   # only in emergency recovery
```

---

## Verification notes

- **Build:** `tsc --noEmit` clean at freeze.
- **Browser multi-cycle sequence:** confirmed by product owner in session prior to freeze; re-verify after deploy of this tag if production lag.
- **Not frozen:** visual copy polish of Cold Open/Gazette content (may evolve); new Moments; auto-launch rules.
