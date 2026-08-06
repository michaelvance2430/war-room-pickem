# D1B-B — Disposable execution guide (revised)

**DO NOT RUN AGAINST PRODUCTION**  
**Package:** `supabase/review-only/D1B-B/`  

### Canonical disposable order (R7 — only)

```text
00-disposable-baseline.sql
00b-jwt-and-fixtures.sql
01-schema-max-human-members.sql   -- includes backfill + DEFAULT + NOT NULL
02-helpers.sql
02b-fair-entry.sql
03-rpc-create-league.sql
04-rpc-join-by-code.sql
05-rpc-join-open.sql
06-rpc-list-open-leagues.sql
09-full-test-runner.sql
optional: 12-disposable-rollback.sql
NEVER: 07
```

Host check: `node scripts/verify-fair-entry-parity.mjs`  
Smoke after 02b: `SELECT d1b_b_percentile_value(ARRAY[0,10,20,40], 75);` — expect **25**

### cut_percent create validation (after 03)

| Input | Expect |
|-------|--------|
| omit / null → default 50 | accepted, stored 50 |
| 10 | accepted |
| 50 | accepted |
| 75 | accepted |
| 9 | `d1b_b:validation_failed` (cut_percent) |
| 76 | `d1b_b:validation_failed` |
| negative | `d1b_b:validation_failed` |
| 100 | `d1b_b:validation_failed` |

Do **not** change live `CHECK (cut_percent >= 10 AND cut_percent <= 75)`.

### Season-scoped freezes (after 02b)

- Disposable tests must prove freezes for `season_year=A` do not apply when season_year=B.
- Season-reset freeze cleanup is a **required production-design follow-on** (not part of initial disposable SQL pass).

### App cutover (not disposable SQL)

- Open-room UI code removal and sport-pool seating remain **app-cutover blockers**.
- File **07** remains excluded from disposable stage-6 apply.

### Fair-entry SQL smoke (after 02b)

```sql
SELECT public.d1b_b_percentile_value(ARRAY[]::int[], 75);           -- 0
SELECT public.d1b_b_percentile_value(ARRAY[42], 75);                -- 42
SELECT public.d1b_b_percentile_value(ARRAY[0,100], 75);             -- 75
SELECT public.d1b_b_percentile_value(ARRAY[0,10,20,40], 75);        -- 25
SELECT public.d1b_b_percentile_value(ARRAY[15,15,15,15], 60);       -- 15
```

### Mid-season FE fixture sketch

```text
1. Create league + commissioner (JWT A) via create RPC — points 0
2. Insert week_results week_number=2 for league
3. Set commissioner total_points and add human members with known points
4. join_league_by_code JWT B → total_points should match percentile fixture
5. Second join same band reuses freeze (same points)
```

### Matrix status

See `docs/D1B-B-TEST-MATRIX.md` — behavioral **NOT_RUN** until executed.
