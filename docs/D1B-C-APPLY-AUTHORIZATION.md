# D1B-C — Apply authorization

**Date:** 2026-08-06  
**Authorization:** Mike explicit **`D1B-C authorized — apply only`**  
**Status:** **APPLIED ON PRODUCTION / STRUCTURALLY REPAIRED / POST-VERIFY PASS**  
**Evidence archive:** `docs/D1B-C-APPLY-VERIFICATION.md`

### Scope lock

| In | Out |
|----|-----|
| Replace `"Members read achievements"` SELECT only | Commissioner grants INSERT |
| `is_league_member` on row league | Helper redefine/grants |
| | Data, indexes, app, D1B-A/B, D1C, H-01 |

### Production execution

| Field | Value |
|-------|--------|
| Apply executed | **YES** |
| Project | war-room-pickem |
| Migration | `d1b_c_achievements_visibility_correlation` |
| success | **true** |
| overall_pass | **true** |
| Verdict | **LIVE / STRUCTURALLY REPAIRED** |

### Not claimed

D1B-B · D1C · H-01 remain unrepaired / unapplied.
