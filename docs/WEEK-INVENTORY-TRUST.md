# Week inventory trust (Jump to Week)

**Status:** UI trust fix shipped · data cleanup pending Mike approval  
**Related:** Constitution — never invent history  

## Product rule

Player-facing week selectors show a **coherent official season sequence** around the live week.

Acceptable (CFB, live Week 0):

- `0` only  
- `0, 1` if Week 1 is legitimately prepared/published  

Not acceptable:

- `0, 1, 5, 6, 7` (non-contiguous orphan islands)

## Source of Weeks 5–7 (code analysis)

| Source | Table | Path |
|--------|--------|------|
| Real published cards | `week_cards` + `card_games` | `publishWeekCard` |
| Foundry one-click | same | `founderPostWeek` → `publishWeekCard` |
| Host sandbox auto-score range | same | League → Auto-score weeks → `sandbox-auto-finish` |
| Not practice | — | Practice is week **99**, client-only, never writes `week_cards` |

`listPublishedWeekNumbers()` returned **every** `week_cards.week_number` for the league — so orphan lab rows became Jump-to-week chips.

## UI fix (this pass)

`trustContiguousPublishedAroundLive` + `trustWeekBrowserWeeks`:

- Start at official live week  
- Walk contiguous published weeks **backward and forward**  
- **Stop at first gap**  
- Trusted scored history remains contiguous-prefix only  

Also: `loadBestAvailableWeekCard` no longer prefers the **highest** published week (that could load week 7 while live is 0).

## Data cleanup (not done)

Foundry → **Audit week inventory (orphans · read-only)** prints:

- orphan week numbers  
- card ids  
- game counts  
- published_at  
- likely creator paths  

**No SQL delete without Mike’s approval.**

### Proposed cleanup (B — pending approval)

For confirmed orphan `week_cards` only (not in player-visible contiguous set):

1. Confirm audit report on the affected league  
2. Delete `card_games` for those week_card ids  
3. Delete related `picks` / `week_results` / `game_results` for those week numbers  
4. Delete `week_cards` rows  
5. Re-audit  

## Consumers

| Surface | Behavior after fix |
|---------|-------------------|
| My Picks Jump to week | Contiguous around live |
| Board | Scored history only (already gated) |
| loadBestAvailableWeekCard | Trusted neighbors only |
| Host auto-score range | Full season list (tooling) |
| Foundry audit | Full inventory + orphan flags |
