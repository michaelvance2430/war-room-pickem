# D-02 preflight evidence archive

**Mode:** SELECT only · no production mutations  
**SQL:** `supabase/D-02-preflight-SELECT-ONLY.sql` (run one statement at a time in Supabase)

---

## Block 1 — Function definition + EXECUTE grants

**Verdict:** **MATCH** (vulnerable baseline · no drift)

| Field | Live |
|-------|------|
| Signature | `record_easter_egg_find(text, text, integer)` |
| SECURITY DEFINER | Yes |
| `search_path` | `public` |
| Discovery validation | `egg_` prefix only |
| Name / total | Trusts caller |
| Found count | All `egg_%` rows |
| EXECUTE | `anon`, `authenticated`, `postgres`, `service_role` |

**Recorded:** operator paste · no production changes

---

## Block 2 — RLS policies (one table / one query at a time)

### Query 2/3 — `egg_milestone_flexes`

**Verdict:** **MATCH**

| Field | Live |
|-------|------|
| SELECT | `egg_flex_select_authenticated` · role `authenticated` · qual `true` |
| INSERT / UPDATE / DELETE | **None** (no client write policies) |

**Recorded:** operator paste · no production changes

### Query 3/3 — `easter_egg_catalog`

**Verdict:** **MATCH** (pre-apply)

| Field | Live |
|-------|------|
| Rows | **Zero** |
| Interpretation | No live `easter_egg_catalog` policies yet |

**Block 2 complete** · no drift · no production changes

---

## Block 3 — Proposed 20-ID catalog verification

**Verdict:** **PASS**

| Field | Live |
|-------|------|
| `proposed_count` | 20 |
| `is_exactly_20` | true |
| `distinct_ids` | 20 |
| `no_duplicates` | true |
| `live_catalog_regclass` | null |

Catalog list consistent; live table not applied. No production changes.

---

## Block 4 — Invalid discovery ID inventory

**Verdict:** **PASS** (zero rows)

| Consequence | Status |
|-------------|--------|
| Invalid discovery rows | **None** |
| Affected users | **None** |
| Historical find cleanup | **Not needed** |

**Block 5 (affected users):** **SKIPPED** as redundant. No production changes.

---

## Block 6 — Invalid-row counts summary

**Status:** **SKIPPED** as redundant (invalid count known zero)

---

## Block 7 — Milestone flex integrity

**Verdict:** **PASS** (zero rows)

| Check | Result |
|-------|--------|
| `flex.total` ≠ 20 | **None** |
| `flex.found` > user valid catalog count | **None** |

Historical finds and flexes are **clean**. No cleanup needed or authorized. No production changes.

---

## Preflight overall

| Item | Result |
|------|--------|
| Function + grants (vulnerable baseline) | **MATCH** |
| `easter_egg_finds` policies (self-insert bypass) | **MATCH** (repo baseline) |
| `egg_milestone_flexes` (no client write) | **MATCH** |
| `easter_egg_catalog` policies | **MATCH** (absent pre-apply) |
| Proposed catalog 20 unique IDs | **PASS** |
| Live catalog table | **null** (not applied) |
| Invalid discovery inventory | **PASS** (zero) |
| Block 5 affected users | **SKIPPED** (redundant) |
| Block 6 summary | **SKIPPED** (redundant) |
| Flex integrity | **PASS** (zero flags) |

**Archive status: COMPLETE / PASS** (2026-08-06)

**Apply:** blocked until Mike explicitly authorizes D-02 after reviewing apply scope.  
**Cleanup of history:** not required; not authorized.
