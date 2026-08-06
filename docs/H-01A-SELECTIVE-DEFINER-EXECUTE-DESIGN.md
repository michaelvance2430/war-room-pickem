# H-01A — Selective DEFINER EXECUTE hardening

**Status:** **SELECTIVE DESIGN READY** · **NOT AUTHORIZED TO APPLY**  
**Sibling:** **H-01B** future-default privileges — **design required separately** (not part of H-01A)  
**Date:** 2026-08-06  
**Evidence:** `docs/AUTOMATED-READONLY-SCRUB-SWEEP.md` · static call-site matrix (joint review) · live helper/policy counts  

---

## Production change status

| Claim | Status |
|-------|--------|
| SQL / grants applied | **No** |
| App code changed | **No** |
| Auth settings changed | **No** |
| Mass REVOKE | **Forbidden** for H-01A |

---

## Split: H-01A vs H-01B

| Track | Scope | Status |
|-------|--------|--------|
| **H-01A** | **Selective** `REVOKE EXECUTE` on **live** public SECURITY DEFINER functions where call-site matrix + body/RLS/trigger use prove client roles do not need direct EXECUTE | **Design ready** — apply only after Mike authorizes **H-01A only** + preflight |
| **H-01B** | **Future defaults**: stop auto-`GRANT EXECUTE` to `anon` / `authenticated` / `service_role` (or PUBLIC) for **new** functions owned by `postgres` / `supabase_admin` | **Design required separately** — not bundled with H-01A |

---

## Hard constraint — absent live functions

**Eight functions are referenced in the repo (app and/or SQL) but are absent from the live public SECURITY DEFINER inventory (or not present live at all).**

| Rule |
|------|
| **No SQL proposal for H-01A may include REVOKE/GRANT/CREATE OR REPLACE on those absent functions.** |
| Preflight must list live function names from `pg_proc` only. |
| Repo-only names stay out of apply scripts until they exist live and are re-classified. |

Exact eight names: freeze at H-01A preflight from live catalog vs static matrix delta (do not invent names in apply SQL). Static matrix candidates that may land in “repo-only / not live DEFINER” include bot/museum/nudge RPCs that soft-fail when missing (`apply_random_bot_chaos`, `seed_bot_locker_talk`, `seed_bot_crystal_ball_picks`, `transfer_commissioner_system`, museum RPCs, open-room nudges, etc.)—**confirm with live export before any REVOKE list is frozen.**

---

## H-01A design principles

1. **Selective only** — per-function REVOKE, never mass REVOKE of all 14 anon-callable DEFINER functions.  
2. **Prefer first targets** where classification is **RLS helper** or **trigger-only** and app never `.rpc`s them (e.g. patterns like `handle_new_user`, `is_league_*` family)—**only after** preflight confirms live grants and zero client RPC.  
3. **Do not** change function bodies, RLS policy text, or helper semantics in H-01A.  
4. **Do not** fold D1B/D1C/D-0x repairs into H-01A.  
5. **Do not** enable Auth leaked-password or alter default privileges (that is **H-01B**).  
6. Body-guarded mutation RPCs (`reset_league_season`, bot seed/clear, `transfer_commissioner`, etc.) stay **out of first REVOKE batch** unless product explicitly wants anon denied and authenticated-only is proven sufficient.  
7. Post-verify: each REVOKE’d function has expected grantees; RLS still works; app smoke for remaining RPCs.

### Live facts to respect

| Fact | Implication |
|------|-------------|
| `handle_new_user()` trigger-only on `auth.users` / `on_auth_user_created` | Client EXECUTE not required for product path |
| `is_league_commissioner` → **10** authenticated RLS policies | REVOKE from `anon` may be OK; **never** drop function; do not strip `authenticated` without policy review |
| `is_league_member` → **4** authenticated RLS policies | Same; already shared helper (D-03) |
| `museum_is_league_member` → **4** authenticated RLS policies | Same museum track |
| Public default privileges auto-GRANT EXECUTE to anon/authenticated/service_role | **H-01B** problem for **new** functions; H-01A only cleans **existing** live grants |

### Suggested first-wave candidates (design only — not an apply list)

Candidates for **anon** REVOKE (not PUBLIC/authenticated strip) after preflight:

| Class | Examples (if live + no browser `.rpc`) |
|-------|----------------------------------------|
| Trigger-only | `handle_new_user` |
| RLS helpers | `is_league_member`, `is_league_ops`, `is_league_staff`, `is_league_commissioner` (anon only) |

**Explicitly later / higher risk:** bot seed/clear, `reset_league_season`, `transfer_commissioner`, `set_member_moderation`, `crystal_ball_lock_count`, `get_league_favorite_team_counts` — body-guarded but app-called.

---

## Preflight (when Mike authorizes H-01A)

1. Live list of all public `prosecdef` functions + EXECUTE grantees.  
2. Diff vs repo matrix; mark **absent live** (expect eight repo-referenced absences).  
3. Freeze REVOKE list: **only names present live**, only intended roles.  
4. Confirm no absent name appears in apply SQL.  
5. Apply exact per-function REVOKE statements only.  
6. Post-verify grants + spot RLS/app smoke.

Automation note: with Supabase plugin, ChatGPT may run preflight/apply/post-verify without Mike pasting SQL **only after** explicit **H-01A only** authorization.

---

## Explicit non-actions now

- No production SQL  
- No H-01B default-privilege change  
- No mass REVOKE  
- No D1B/D1C  
- No app edits  

---

*End H-01A design archive — selective ready; apply blocked.*
