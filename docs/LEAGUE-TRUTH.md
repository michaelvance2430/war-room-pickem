# LeagueTruth — Truth Layer

**Engineering rule:** Every production-facing value must be traceable to a single authoritative source.

**Product North Star:** War Room should never lie to the user—even with placeholder data.

## Module

`src/lib/league-truth.ts`

## Answers (one place)

| Question | API |
|----------|-----|
| Has the season officially scored? | `seasonHasOfficialScore` / `loadLeagueTruth()` |
| What is **Trusted Live Week**? | `trustedLiveWeek` / `getTrustedLiveWeek()` |
| Which weeks are officially scored? | `scoredWeeks` |
| What published weeks may players see? | `visiblePublishedWeeks` |
| What are orphan week cards? | `orphanPublishedWeeks` |
| May we show Crown/Shame/standings chrome? | `mayShowSeasonCompetitiveChrome` |
| May we show this player’s pts/ATS/streak? | `mayShowPlayerCompetitiveStats` |
| Is calendar open for week N? | `isWeekCalendarOpen` |

## Forbidden shortcuts

| Don’t | Do |
|-------|-----|
| `max(week_cards.week_number)` | Trusted Live Week |
| Membership `total_points` alone | Official scored weeks first |
| Per-page “has season started?” invent | `loadLeagueTruth` / `hasOfficialScoredWeek` |
| Fake urgency from orphan weeks | `orphanPublishedWeeks` ignored for CTAs |

## Trace example

```
Official Results (week_results + game_results)
        ↓
Week score applied (membership projection)
        ↓
Season score
        ↓
Standings
        ↓
Home Hero / Profile
```

## Migration

New code **must** ask LeagueTruth for reality questions.  
Legacy call sites migrate gradually; do not add new parallel logic.

## Related

* Constitution: Zero-tolerance · Official Results · Trusted Live Week · Truth Layer  
* `docs/ZERO-TOLERANCE-FAKE-DATA-AUDIT.md`  
* `docs/WEEK-INVENTORY-TRUST.md`  
