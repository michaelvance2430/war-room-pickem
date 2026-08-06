# D1B-A — Apply authorization & execution package

**Date:** 2026-08-06  
**Authorization:** Mike explicit **D1B-A only**  
**Status:** **APPLIED ON PRODUCTION / STRUCTURALLY REPAIRED / POST-VERIFY PASS**  
**Evidence archive:** `docs/D1B-A-APPLY-VERIFICATION.md`

### Scope lock

| In | Out |
|----|-----|
| Replace `"Users manage own picks"` on `public.picks` | `is_league_member` redefine/grants |
| Replace `"Users manage own pick_games"` on `public.pick_games` | Historical data DELETE/UPDATE |
| | Indexes, table grants, app |
| | Other picks/pick_games policies |
| | D1B-B, D1B-C, D1C, H-01 |

### Files

| File | Use |
|------|-----|
| `supabase/D1B-A-APPLY-AUTHORIZED.sql` | Applied on production |
| `supabase/D1B-A-picks-membership-REVIEW-ONLY.sql` | Same policy text (historical name) |
| `supabase/D1B-A-postverify-SELECT-ONLY.sql` | Post-apply SELECT-only verification |
| `docs/D1B-A-APPLY-VERIFICATION.md` | **Production evidence archive** |

### Production execution

| Field | Value |
|-------|--------|
| Apply executed | **YES** |
| Project | war-room-pickem |
| Migration | `d1b_a_picks_membership_correlation` |
| success | **true** |
| overall_pass | **true** |
| Verdict | **LIVE / STRUCTURALLY REPAIRED** |

Full policy text, integrity counts, and helper fingerprint: see verification archive.

### Not claimed

D1B-B · D1B-C · D1C · H-01 remain unrepaired / unapplied.
