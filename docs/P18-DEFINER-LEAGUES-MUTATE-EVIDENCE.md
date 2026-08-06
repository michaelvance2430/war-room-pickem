# P18 — SECURITY DEFINER residual · leagues DELETE/UPDATE

**Mode:** Live catalog SELECT only · no production mutations  
**SQL:** `supabase/P18-definer-leagues-mutate-SELECT-ONLY.sql`  
**Depends on:** P15–P17 complete  

---

## Block 1 — DEFINER bodies that DELETE or UPDATE `public.leagues`

| Field | Live result |
|-------|-------------|
| SECURITY DEFINER that **DELETE** `public.leagues` | **zero** |
| SECURITY DEFINER that **UPDATE** `public.leagues` | **two** |

### 1. `reset_league_season`

| Check | Live |
|-------|------|
| Auth | Authenticated caller required |
| Authorization | Current commissioner required |
| UPDATE scope | `current_week` → **0** only |
| `sport_id` | **Not** updated |

### 2. `transfer_commissioner`

| Check | Live |
|-------|------|
| Auth | Authenticated caller required |
| Authorization | Current commissioner required |
| Target | New commissioner must already belong to the league |
| UPDATE scope | `commissioner_id` only |
| `sport_id` | **Not** updated |

### Verdict

**PASS** for the D1A residual-function gate.

- No inspected public SECURITY DEFINER can **delete** a league.
- Sport-immutability trigger remains intact; neither function attempts to alter `sport_id`.

**Status:** CLOSED (PASS) · **Recorded:** 2026-08-06 (operator paste)

**Remediation:** **None authorized.**

---

## P18 overall

| Block | Verdict |
|-------|---------|
| 1 | **PASS** |

**Archive status: COMPLETE**

---

## Production confirmation

| Claim | Status |
|-------|--------|
| Functions modified | **No** |
| Grants revoked | **No** |
| D1A applied | **No** |
