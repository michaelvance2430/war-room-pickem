# D1B-B — Disposable execution guide

**Status:** Design only · **DO NOT RUN AGAINST PRODUCTION**  
**Date:** 2026-08-06  
**Package:** `supabase/review-only/D1B-B/`  

### Prerequisites

- Disposable Supabase project or local Postgres with:
  - Base schema: `leagues`, `memberships`, `profiles`, enums `member_role`, `division`
  - Optional: `record_league_first_join`, `week_results` for later fair-entry tests
- Ability to create 2+ auth users and obtain JWTs (`auth.uid()`)
- **Never** point at war-room-pickem production

### Fair-entry scope for disposable

Until fair-entry server parity lands:

- Treat suite as **early-season / zero points** only  
- Do **not** claim mid-season parity  
- Mark fair-entry tests **BLOCKED** or **NOT_RUN**

---

## 1. Apply order on disposable only

```text
1. Ensure base War Room schema exists (or restore dump without prod data)
2. psql / SQL editor: 01-schema-max-human-members.sql
3. 02-helpers.sql
4. 03-rpc-create-league.sql
5. 04-rpc-join-by-code.sql
6. 05-rpc-join-open.sql
7. 06-rpc-list-open-leagues.sql
8. Do NOT apply 07-policy-transitions-FUTURE.sql
9. 08-preflight-SELECT-ONLY.sql (catalog sanity)
10. 09-disposable-test-harness.sql (static checks + NOT_RUN placeholders)
11. Run behavioral cases below with real JWTs
12. Optional: 11-rollback-scripts.sql stage-6 section
```

Backfill after 01:

```sql
UPDATE public.leagues SET max_human_members = 32 WHERE max_human_members IS NULL;
```

---

## 2. Auth simulation

For each test user:

1. Create user in Auth  
2. Ensure `profiles` row  
3. Call RPCs with user JWT via Supabase client `supabase.rpc(...)`  

Never use service_role to call join RPCs when testing grants (except setup).

---

## 3. Test matrix

| ID | Case | Method | Expected | Status |
|----|------|--------|----------|--------|
| D0 | unauthenticated create/join/list | no JWT | `d1b_b:not_authenticated` | **NOT_RUN** |
| D1 | valid create | JWT A | league + commissioner membership; code returned | **NOT_RUN** |
| D2 | failed create rollback | force bad max or unique | no orphan league without commissioner | **NOT_RUN** |
| D3 | code collision | mock generator / force duplicate | validation_failed or retry | **NOT_RUN** |
| D4 | join valid code | JWT B + code from D1 | player seat; role player | **NOT_RUN** |
| D5 | invalid code | JWT B | invalid_code | **NOT_RUN** |
| D6 | already-member rejoin | JWT B again | already_member true; one row | **NOT_RUN** |
| D7 | open join | set is_open; JWT C | seat | **NOT_RUN** |
| D8 | closed rejection | is_open false | not_open | **NOT_RUN** |
| D9 | human capacity | max=2; two humans; third | league_full | **NOT_RUN** |
| D10 | bots excluded | 1 human + 30 bots; max 32 | human can still join until 32 humans | **NOT_RUN** |
| D11 | final-seat race | two JWTs parallel at max-1 | exactly one new human membership | **NOT_RUN** |
| D12 | privilege spoof | cannot pass role via RPC | N/A — no params; verify columns after join | **NOT_RUN** |
| D13 | RPC grants | anon EXECUTE | denied | **NOT_RUN** |
| D14 | discovery no code | list_open_leagues_public | JSON rooms without code key | **NOT_RUN** |
| D15 | rollback stage-6 | drop RPCs per 11 | functions gone; data kept | **NOT_RUN** |
| D16 | no prod deps | — | package self-contained on base schema | **PASS** (static review) |
| FE | mid-season fair-entry points | scored weeks + freezes | match TS fixtures | **BLOCKED** (stub) |

---

## 4. Race test sketch (D11)

```text
1. Create league max_human_members=2, seat commissioner (1 human)
2. Join user B (2 humans = full)
3. Reset: delete B; leave commissioner only; OR use max=2 and one empty seat
4. Fire join_league_by_code from B and C simultaneously
5. Assert memberships human count = 2; one of B/C has membership; other league_full
```

---

## 5. After fair-entry parity

Add fixtures:

| Fixture | Setup | Expect points |
|---------|-------|---------------|
| FE-preseason | no week_results | 0 |
| FE-w2-empty | week 2 scored, no humans with points | 0 |
| FE-w2-p75 | humans [0,10,20,40]; band 1-2 | percentile 75 ≈ 25–30 (match TS) |
| FE-frozen | sport_settings frozen 1-2=99 | 99 idempotent |

---

## 6. Production dependency check

Disposable must **not** use:

- Production project URL  
- Production service role against live data  
- Real user emails/PII  

---

## 7. Status

| Statement | True? |
|-----------|-------|
| Guide authored | **Yes** |
| Suite executed | **No** (NOT_RUN) |
| Mid-season fair-entry executable | **No** until parity SQL |
