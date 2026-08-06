# D-02 — `record_easter_egg_find` apply + structural verification archive

**Date:** 2026-08-06  
**Authorization:** Mike explicitly authorized D-02 only  
**SQL:** `supabase/D-02-record-easter-egg-find-REVIEW-ONLY.sql` (operator SQL Editor)  
**Preflight:** `docs/D-02-PREFLIGHT-EVIDENCE.md` — PASS (clean history)  

---

## Verdict

| Field | Status |
|-------|--------|
| Structural repair | **LIVE** |
| Classification | **LIVE / STRUCTURALLY VERIFIED / BEHAVIORAL TESTS PENDING** |
| Claimed fully repaired (incl. behavioral) | **No** — behavioral suite pending isolated disposable identity |
| Historical data deleted/updated | **No** |
| App code / client upsert fallback | **Unchanged** (P7 later) |
| D-03 / other defects | **Not started** |

---

## Apply (operator)

| Item | Result |
|------|--------|
| Scope | Catalog create + seed 20 · RLS + SELECT policy · drop `egg_finds_insert_self` · replace function body · REVOKE anon/PUBLIC · GRANT authenticated · NOTIFY pgrst |
| Historical finds/flexes | Not deleted or updated |

---

## Structural post-verification (operator — SELECT only)

| Check | Result |
|-------|--------|
| Active/distinct catalog IDs | **Exactly 20** |
| Catalog policies | Authenticated **SELECT only**; no client INSERT/UPDATE/DELETE |
| `easter_egg_finds` direct INSERT policy | **Absent** (`egg_finds_insert_self` dropped) |
| Function EXECUTE | **No** `anon` / `PUBLIC`; retained `authenticated`, `postgres`, `service_role` |
| Function body | `uses_server_catalog` · `uses_profile_name` · `ignores_deprecated_inputs` · `uses_server_milestones` |
| Signature | Unchanged `(text, text, integer)` |
| SECURITY DEFINER | Preserved |
| `search_path=public` | Preserved |

**No additional structural SELECT required** for classification.

---

## Behavioral tests — PENDING (constraints)

| Rule | |
|------|--|
| Do **not** run valid-RPC / direct-insert tests against real users or real Easter Egg history | Binding |
| Allowed | Isolated **disposable** identity, or rollback-safe test **explicitly reviewed** before execution |
| Suite when authorized | Valid ID · fake ID · duplicate · spoof name/total · direct insert denial · anon deny |

---

## Exact production change (operator-applied)

| Object | Change |
|--------|--------|
| `public.easter_egg_catalog` | Created; 20 IDs seeded; RLS on; SELECT for authenticated |
| `public.easter_egg_finds` | Dropped policy `egg_finds_insert_self` |
| `public.record_easter_egg_find(text,text,int)` | Hardened body (catalog allowlist; profile name; server total/milestones 7/10/full; deprecated args ignored) |
| EXECUTE on that function | REVOKE PUBLIC + anon; GRANT authenticated |

---

## Next (not authorized)

1. Isolated disposable identity behavioral suite  
2. Separate app change: remove direct-upsert fallback (P7)  
3. Catalog parity test app↔DB (P6)  
4. D-03 only if Mike authorizes  

---

*End D-02 structural verification archive.*
