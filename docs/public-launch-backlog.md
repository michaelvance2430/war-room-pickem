# Public launch backlog

Items to ship when War Room goes public (not friend-league only).

## Achievement points leaderboard (app-wide)

**When:** Live public rollout  
**Why:** Career / achievement points are personal flex today; a public board turns them into a global chase.

### Spec (from product notes)

1. **Global leaderboard** of achievement (career / cheevo) points across the **entire app** — not one league.
2. Show **top 100** players (display name, avatar if any, points, maybe badge count).
3. If the signed-in player is **not in the top 100**, still show:
   - their **global rank** (e.g. “You’re #347 of 12,041”)
   - their points
   - distance to #100 (optional: “123 pts from the board”)
4. If they **are** in the top 100, highlight their row.

### Implementation notes (when we build)

- Career cheevo points are still partly **client / localStorage** in friend mode — **public board requires server-side totals** (Supabase profile or `career_points` table, updated on badge unlock / week score / etc.).
- RLS: public read of display name + points only; no private league data.
- Page: e.g. `/leaderboard` or under Stats / Account “War Room ranks”.
- Cache / pagination: top 100 query is cheap; rank-for-user can be a count of players with higher points + 1.
- Handle ties: same points → stable order (joined_at or user id).
- Bots / trial accounts excluded.

### Not in scope for friend-league season

- Can stay off until multi-tenant public auth + server career bank are real.
