# P17 — SECURITY DEFINER body + ACL review

**Mode:** Live catalog SELECT only · no production mutations  
**SQL:** `supabase/P17-definer-body-acl-review-SELECT-ONLY.sql`  
**Depends on:** P16 complete (Block 2 FINDING — broad EXECUTE; body review required)

**Do not** REVOKE grants, replace functions, or apply D1A without Mike’s explicit authorization.

---

## Block 1 — DEFINER inventory + grantees + guard heuristics + call surface

| Field | Live result |
|-------|-------------|
| SECURITY DEFINER count | **27** |
| Anonymously callable (anon and/or PUBLIC) | **17** |
| Mutation/admin in anonymous set | **Yes** (multiple) |
| Heuristic guards | Triage only — exploitability undetermined |

### Priority full-body review (operator list)

`clear_trial_bots`, `purge_locker_before`, `reset_league_season`, `seed_bot_picks_for_week`, `seed_bot_sport_pool_votes`, `seed_trial_bots`, `set_member_moderation`, `transfer_commissioner`, `record_league_first_join`, `record_easter_egg_find`, `crystal_ball_lock_count`, `get_league_favorite_team_counts`

### Interpretation limits

- Heuristic body flags are **not** proof of authorization.
- **Cross-schema triggers:** Block 1 only searched trigger attachments on **`public`** tables. `handle_new_user` (and similar) may attach to `auth.users`; `rpc_or_direct_callable` does **not** prove unattached. Re-check attachments across schemas when reviewing those bodies.

### Verdict

**FINDING / FULL BODY REVIEW REQUIRED**

**Binding:** No remediation authorized. No REVOKE, function edits, D1A, or production changes.

**Status:** CLOSED (FINDING) · **Recorded:** 2026-08-06 (operator paste)

---

## Block 2 — Full definitions + ACLs for anonymously callable DEFINER only

**Status:** CLOSED · full-body review completed · **Recorded:** 2026-08-06 (operator paste)

### CONFIRMED DEFECT 1 — `purge_locker_before`

| Field | Detail |
|-------|--------|
| Severity | **High / destructive authorization defect** |
| Auth | Requires authentication |
| Authorization bug | Any **league member** may call; not commissioner/moderation-only |
| Effect | Deletes all `locker_messages` for the league older than caller-controlled `p_before` |
| Abuse | Member supplies a **future** timestamp → can wipe entire Locker Room history |
| Remediation (design only) | Commissioner-only or explicit moderation role; tests: regular members and anonymous cannot purge |
| Apply | **REVIEW ONLY — not authorized** |

### CONFIRMED DEFECT 2 — `record_easter_egg_find`

| Field | Detail |
|-------|--------|
| Severity | **Integrity / achievement defect** |
| Auth | Any authenticated caller |
| Authorization bug | Arbitrary discovery IDs accepted if they begin with `egg_`; caller controls `player_name` and `p_total_eggs` |
| Effect | Fabricated discoveries; potentially fraudulent milestone-flex records |
| Remediation (design only) | Validate discovery IDs against server-owned allowlist/catalog; derive display name and milestone total from trusted data |
| Apply | **REVIEW ONLY — not authorized** |

### HARDENING FINDING — `record_league_first_join`

| Field | Detail |
|-------|--------|
| Severity | Integrity / membership-correlation hardening |
| Auth | Self-only identity enforced |
| Gap | Does **not** require existing membership in `p_league_id` before insert into `league_first_joins` |
| Effect | Arbitrary league first-join rows subject to remaining DB constraints |
| Remediation (design only) | Require matching membership before insertion |
| Apply | **REVIEW ONLY — not authorized** |

### PROTECTED BY INTERNAL BODY CHECKS (broad grants remain least-privilege surface)

These mutation/admin functions authenticate and enforce **commissioner or authorized staff** internally:

- `clear_trial_bots`
- `reset_league_season`
- `seed_bot_picks_for_week`
- `seed_bot_sport_pool_votes`
- `seed_trial_bots`
- `set_member_moderation`
- `transfer_commissioner`
- `get_league_favorite_team_counts`

### LOW PRIVILEGE / CORRECT ATTACHMENT

| Function | Notes |
|----------|--------|
| `crystal_ball_lock_count` | No privileged data/action for unauthenticated callers |
| `is_league_*` helpers | Same |
| `handle_new_user` | Attached to **`auth.users`** as a trigger (cross-schema; Block 1 public-only search was incomplete) |

### Least-privilege note

Broad **anon/PUBLIC** EXECUTE grants remain a hardening surface even where internal guards work. **No REVOKE authorized** in this pass.

---

## Block 3 — Anonymously executable DEFINER subset

**Status:** **SKIPPED (redundant)** — Block 2 already exported full definitions + ACLs for the anonymously callable set.

---

## Block 4 — Full EXECUTE ACL for DEFINER routines

**Status:** **SKIPPED (redundant)** — Block 2 `execute_grantees_all` / `execute_grantees_anonymous` already archived exact ACLs for the critical surface.

---

## P17 overall

| Block | Verdict |
|-------|---------|
| 1 | **FINDING / FULL BODY REVIEW REQUIRED** |
| 2 | **CLOSED** — defects + protected set documented |
| 3–4 | **SKIPPED** as redundant |

**Archive status: COMPLETE for body/ACL phase** (2026-08-06)

**Remediation:** **None authorized.** No REVOKE, function edits, D1A, or production changes.

**Defect backlog (REVIEW ONLY designs):**

1. `purge_locker_before` — commissioner/moderation-only + deny member/anon  
2. `record_easter_egg_find` — server allowlist + trusted name/total  
3. `record_league_first_join` — require membership before insert  

---

## Production confirmation

| Claim | Status |
|-------|--------|
| Grants revoked | **No** |
| Functions edited | **No** |
| D1A applied | **No** |
| Remediation SQL applied | **No** |
