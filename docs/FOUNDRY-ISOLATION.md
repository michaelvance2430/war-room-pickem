# Foundry isolation guard

**Status:** closed (app-level integrity)

## Incident

Simulations could advance a **production** league (standings, bots, drama prep)
because calendar “preseason / sandbox mode” is true for every live room before
season open. That is not a lab mark.

## Law

1. **Simulations run only against explicitly marked test (LAB) leagues.**
2. **Production leagues and real identities are hard-blocked.**
3. **No production trophies, achievements, standings, Gazette, or Moments** from Foundry sim paths.
4. **Clear LAB identity** in Foundry UI chrome.
5. **Failed boundary check stops the run** — no soft fallback.

## Explicit LAB signals (any one)

| Signal | Where |
|--------|--------|
| Device mark | `localStorage` `warroom-foundry-lab-league-ids-v1` via Foundry hub “Mark this room LAB” |
| League settings | `settings.isTest` / `settings.mode` in `foundry` \| `sandbox` \| `demo` |
| Flags | `league.is_test`, `settings.is_test` |
| Name cue | name starts with `[LAB]` or contains `FOUNDRY` |
| Guest ids | `guest-*` league ids |

**Not sufficient:** preseason calendar alone, creator sticky alone, eyes mode alone.

## Modules

| File | Role |
|------|------|
| `src/lib/foundry-isolation.ts` | `isExplicitLabLeague`, mark/unmark, `assertFoundryMutationAllowed` |
| `src/lib/foundry-quarantine.ts` | Emergency kill switch + **always** chains isolation |
| `src/lib/founder-one-click.ts` | Entry gate on every post/score/roster/board action |
| `src/lib/foundry-preview.ts` | Lab tools UI + ceremonies require LAB |
| `src/lib/career-integrity.ts` | Permanent engraving only when `resolveLeagueMode() === "production"` |
| `src/components/FoundryLabIsolationPanel.tsx` | Hub mark/unmark UI |
| `src/components/FoundrySessionChrome.tsx` | Sticky LAB bar |

## Operator flow

1. Open a **disposable** room (not a real production league).
2. Foundry hub → **Mark this room LAB**.
3. Run playground (post/score/bots) or Commissioner lab tools.
4. When done: **Unmark (production)** or delete the room.

## Verify

```bash
node scripts/verify-foundry-isolation.mjs
```

## Emergency

Set `FOUNDRY_EMERGENCY_QUARANTINE = true` in `foundry-quarantine.ts` or
`NEXT_PUBLIC_FOUNDRY_QUARANTINE=1` for a full Foundry blackout.

## Production closeout (2026-08-07)

| Step | Result |
|------|--------|
| Push `0192748` | `origin/main` @ `019274810bdc9c0ea56b7be6bca8f4b2d7f032d0` |
| Vercel production | `dpl_2FuCNZhFejnXypf43if9rkd3LkYZ` · aliased **https://www.war-room-picks.com** |
| Prod JS isolation markers | `FOUNDRY_LAB_BLOCK`, `isExplicitLabLeague`, `assertFoundryMutationAllowed`, device LAB key |
| Real league sim hard-block | `founderPostWeek` / `founderScoreWeek` / `founderPostAndScoreWeek` → LAB boundary refuse |
| Marked LAB allow | gate ok; roster path past isolation (RPC auth denied without live session — expected) |
| Host bot pad dual-use | `seedBotPicksForWeekInCloud` on production shape → **not** LAB boundary (RPC permission only) |
| Sim spice still gated | `applyRandomBotChaos` + `seedSelfSimPicksIfEmpty` LAB-blocked on production |
| Crown jewels | score/post refused before standings/Gazette/Moments write path |

Verify scripts:

```bash
node scripts/verify-foundry-isolation.mjs
node scripts/smoke-foundry-isolation-prod.mjs
npx tsx scripts/smoke-foundry-isolation-runtime.mjs
npx tsx scripts/smoke-foundry-isolation-entry.mjs
```
