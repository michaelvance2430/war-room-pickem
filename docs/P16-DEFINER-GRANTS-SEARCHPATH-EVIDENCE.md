# P16 — SECURITY DEFINER / EXECUTE grants / search_path evidence

**Mode:** Live catalog SELECT only · no production mutations  
**SQL:** `supabase/P16-definer-grants-searchpath-SELECT-ONLY.sql`  
**Complements:** D0 preflight P9–P11 · P15 complete  

**Do not** modify functions, grants, or apply D1A without Mike’s explicit authorization.

---

## Block 1 — SECURITY DEFINER function inventory

| Field | Live result |
|-------|-------------|
| Schema | `public` |
| Count | **27** SECURITY DEFINER functions |
| `proconfig` NULL | **0** |
| Explicit `search_path` configured | **All 27** |

### Notable expanded paths

| Function | Configured search_path (as reported) |
|----------|--------------------------------------|
| `clear_trial_bots` | `public, auth` |
| `seed_trial_bots` | `public, auth, extensions` |
| Remaining (25) | `public` (single-schema path as reported) |

### Verdict

**PASS** for configured-`search_path` presence.

**Binding notes:**

- Preserve this inventory for comparison with Block 2 EXECUTE grants.
- Do **not** modify any functions yet.
- Block 3 (missing search_path) is expected to return **zero rows** given this result; still run Block 3 separately when ready for formal archive of that query shape.

**Status:** CLOSED (PASS) · **Recorded:** 2026-08-06 (operator paste)

---

## Block 2 — anon / authenticated EXECUTE grants

| Field | Live result |
|-------|-------------|
| Surface | **Broad** EXECUTE grants on public routines |
| Concern | Multiple **SECURITY DEFINER** mutation/admin functions executable by **anon** and/or **PUBLIC** |
| Examples called out by operator | bot seeding/clearing, locker purge, season reset, member moderation, commissioner transfer, first-join recording |

### Verdict

**FINDING / NEEDS BODY REVIEW** — not yet confirmed exploitable.

Grants alone do not prove exploitability. Next steps must map **EXECUTE grantees** to **function body guards** (`auth.uid()`, membership, commissioner, ops, service-role) and distinguish **RPC-callable** vs **trigger-only** functions.

### Binding notes

- **Do not** revoke grants or alter functions yet.
- **PUBLIC** grants must be treated as **broadly executable** (any role that inherits PUBLIC).
- Preserve the full Block 2 result set for the body/ACL matrix (P17 after Block 3).

**Status:** CLOSED (FINDING) · **Recorded:** 2026-08-06 (operator paste)

---

## Block 3 — SECURITY DEFINER missing search_path

| Field | Live result |
|-------|-------------|
| Rows missing configured `search_path` | **zero** |
| Functions covered | All **27** public SECURITY DEFINER |

### Verdict

**PASS** — all 27 public SECURITY DEFINER functions have a configured `search_path`.

**Status:** CLOSED (PASS) · **Recorded:** 2026-08-06 (operator paste)

---

## P16 overall

| Block | Verdict | Summary |
|-------|---------|---------|
| 1 | **PASS** | 27 SECURITY DEFINER functions inventoried; all have configured `search_path` |
| 2 | **FINDING** | Broad anon/PUBLIC EXECUTE surface; exploitability not yet determined |
| 3 | **PASS** | Zero functions missing configured `search_path` |

**Archive status: COMPLETE** (2026-08-06)

**Remediation:** **None authorized.** No REVOKE, function edits, D1A, or other production changes.

**Next:** P17 SELECT-only body + ACL review  
**SQL:** `supabase/P17-definer-body-acl-review-SELECT-ONLY.sql`

---

## Production confirmation

| Claim | Status |
|-------|--------|
| Functions modified | **No** |
| Grants revoked or altered | **No** |
| D1A applied | **No** |
| App runtime changed | **No** |
