# Structural / security defect register

**As of:** 2026-08-06  
**Evidence chain:** P15 (complete) · P16 (complete) · P17 (complete) · P18 (complete)  
**Mode:** Inspection only unless Mike explicitly authorizes a stage  

**Production confirmation for this register:** no D1A, no REVOKE, no function edits, no other production changes applied from this chain.

---

## 1. Database-guts inspection gates (closed)

| Gate | Archive | Verdict |
|------|---------|---------|
| P15 Q1 `leagues` RLS enabled / forced | P15 | **PASS** (`true` / `false`) |
| P15 Q2 sport immutability trigger | P15 | **PASS** (`leagues_sport_id_immutable_trg` = O) |
| P15 Q3 UNIQUE integrity inventory | P15 | **PASS** (D1A integrity gate) |
| P15 Q4 postseason tables | P15 | **PASS** (zero live tables) |
| P16 Block 1 DEFINER inventory + search_path | P16 | **PASS** (27; all configured) |
| P16 Block 2 EXECUTE grants | P16 | **FINDING** (broad anon/PUBLIC) |
| P16 Block 3 missing search_path | P16 | **PASS** (zero rows) |
| P17 Block 1 triage | P17 | **FINDING** (17 anonymously callable) |
| P17 Block 2 full-body review | P17 | **DEFECTS + protected set** |
| P17 Blocks 3–4 | P17 | **SKIPPED** (redundant) |
| P18 Block 1 DEFINER leagues DELETE/UPDATE | P18 | **PASS** (0 delete; 2 safe updates) |

**Last database-guts inspection gate for this chain: CLOSED (P18).**

Remaining work is **repair design / apply authorization**, not further catalog discovery for D1A residual-function risk.

**Optional at apply time only (already in D1A file):** re-SELECT exact `leagues` DELETE policy names immediately before DROP; freeze names from that run. Not a new guts-audit stage.

---

## 2. Confirmed defects (authorization / integrity)

### D-01 · `purge_locker_before` — destructive authorization

| Field | Value |
|-------|--------|
| Severity | Was **High** (member/anon bulk wipe) |
| Type | Authorization defect (authenticated member over-privileged) + unbounded cutoff |
| Effect (pre-repair) | Any league member could delete locker messages older than caller-controlled `p_before`; future/`now()` cutoff could wipe history including recent board |
| Evidence | P17 Block 2 · preflight 2026-08-06 |
| Status | **REPAIRED / STRUCTURALLY VERIFIED / BEHAVIORAL TESTS PENDING** |
| Applied | 2026-08-06 via SQL Editor — `docs/D-01-APPLY-VERIFICATION.md` |
| Live body | `is_league_staff`; `v_boundary = now() - interval '7 days'`; reject newer `p_before`; server-capped cutoff |
| Live EXECUTE | `authenticated`, `postgres`, `service_role` — **not** `anon` / `PUBLIC` |
| Behavioral T7–T11 | **PENDING** (isolated disposable league only; not claimed passed) |
| Design | `docs/D-01-PURGE-LOCKER-BEFORE-REMEDIATION.md` |
| SQL | `supabase/D-01-purge-locker-before-REVIEW-ONLY.sql` |

### D-02 · `record_easter_egg_find` — achievement integrity

| Field | Value |
|-------|--------|
| Severity | **Medium–High** (integrity / fraud surface) |
| Type | Untrusted caller input on discovery identity and milestones |
| Effect | Arbitrary `egg_*` discovery IDs; caller-controlled `player_name` and `p_total_eggs` → fabricated finds / milestone flex |
| Evidence | P17 Block 2 · call-site map in D-02 design |
| Status | **LIVE / STRUCTURALLY VERIFIED / BEHAVIORAL TESTS PENDING** |
| Design | `docs/D-02-RECORD-EASTER-EGG-FIND-REMEDIATION.md` |
| SQL | `supabase/D-02-record-easter-egg-find-REVIEW-ONLY.sql` (applied operator SQL Editor) |
| Preflight | `docs/D-02-PREFLIGHT-EVIDENCE.md` — PASS |
| Apply archive | `docs/D-02-APPLY-VERIFICATION.md` |
| Live | Catalog 20 · RPC-only finds · profile name · server total/milestones · no anon/PUBLIC EXECUTE |
| Behavioral | **PENDING** — disposable identity only; not against real egg history |
| App fallback | Still present until separate P7 change |

### D-03 · `record_league_first_join` — membership correlation

| Field | Value |
|-------|--------|
| Severity | **Medium** (hardening / integrity) |
| Type | Missing membership gate |
| Effect | Self-only identity OK, but no required membership in `p_league_id` before insert; arbitrary first-join rows subject to DB constraints only |
| Evidence | P17 Block 2 |
| Apply status | **REVIEW ONLY — not authorized** |
| Intended fix | Require existing matching membership before insert |

---

## 3. Known product / RLS defects (prior design — not re-probed as bodies)

### D-04 · `leagues` DELETE policy (product retired) — **VERIFIED ABSENT**

| Field | Value |
|-------|--------|
| Severity | Was **High** while policy live |
| Type | RLS policy that granted commissioner DELETE while product Delete League is retired |
| Prior evidence (Pass 1.5 / D1A freeze) | Exactly one DELETE policy: `"Commissioner deletes league"` |
| Live 2026-08-06 (SQL Editor) | **Zero** DELETE policies; policy **already absent** |
| This session | **VERIFIED NO-OP** — Block B **not** run; **no** production change |
| Drift | State differs from prior freeze; **timing/cause unknown** — do not attribute without evidence |
| Archive | `docs/D1A-VERIFICATION-NO-OP.md` |
| Residual | P18: no SECURITY DEFINER public function deletes leagues; app fail-closed remains |

### D-05 · Membership tautologies / cross-league write paths (D1B)

| Field | Value |
|-------|--------|
| Severity | **High** (isolation) |
| Type | RLS correlation bugs (`m.league_id = m.league_id` class); picks manage-own without target-league membership |
| Evidence | D0 design inventory (STRUCTURAL-HARDENING-D0-RLS.md) |
| Apply status | **D1B REVIEW-ONLY** — prefer ephemeral/staging; **not authorized** |
| Note | Not re-executed in P15–P18 guts chain |

### D-06 · Crystal Ball lock/reveal RLS (D1C)

| Field | Value |
|-------|--------|
| Severity | **Medium–High** (product integrity) |
| Type | Hardcoded freezes / multi-authority lock; score-as-reveal risk |
| Evidence | D0/D1C design |
| Apply status | **Blocked** until single lock resolver app+DB; **not authorized** |

---

## 4. Hardening findings (not confirmed exploits)

| ID | Finding | Notes | Apply |
|----|---------|-------|-------|
| H-01 | Broad anon/PUBLIC EXECUTE on many SECURITY DEFINER RPCs | Least-privilege surface even where body guards work | No REVOKE without design + tests |
| H-02 | `rls_forced = false` on `leagues` | Matches repo; service role bypasses RLS either way | Do not FORCE without product decision |
| H-03 | Postseason tables absent | Matches REVIEW-ONLY / not applied | Separate PS authorization |
| H-04 | Protected mutation RPCs (bots, reset, transfer, moderation, …) | Internal commissioner/staff checks present | Grants still H-01 surface |

**Protected by body (P17):**  
`clear_trial_bots`, `reset_league_season`, `seed_bot_picks_for_week`, `seed_bot_sport_pool_votes`, `seed_trial_bots`, `set_member_moderation`, `transfer_commissioner`, `get_league_favorite_team_counts`

**Low privilege / correct attachment:**  
`crystal_ball_lock_count`, `is_league_*`; `handle_new_user` → `auth.users` trigger

---

## 5. Recommended repair order

Order balances **blast radius**, **product law**, and **dependency**. No stage runs without Mike’s explicit authorization.

| Order | Stage | What | Why this order | Risk if skipped |
|-------|--------|------|----------------|-----------------|
| **1** | **D1A** | Drop verified `leagues` DELETE policy only | **CLOSED 2026-08-06: VERIFIED NO-OP / ALREADY ABSENT** — see `docs/D1A-VERIFICATION-NO-OP.md` | N/A (desired state satisfied; this session did not DROP) |
| **2** | **D-01** | `purge_locker_before` staff + 7-day retention | **STRUCTURALLY LIVE 2026-08-06**; behavioral T7–T11 still PENDING | Was: members could wipe locker history |
| **3** | **D-02** | `record_easter_egg_find` catalog + trusted fields | **STRUCTURALLY LIVE 2026-08-06**; behavioral PENDING | Was: fake eggs / milestone fraud |
| **4** | **D-03** | `record_league_first_join` require membership | Smaller integrity fix; independent | Spoofed first-join rows |
| **5** | **H-01** | Least-privilege EXECUTE (REVOKE anon/PUBLIC where body is sufficient) | Only after body matrix frozen; easy to break clients/triggers | Over-revoke breaks legit RPC/trigger paths |
| **6** | **D1B** | Membership-correlation RLS repairs | Prefer non-prod first; no staging today | Cross-league read/write isolation bugs remain |
| **7** | **D1C** | Crystal Ball single lock authority | Blocked on shared resolver design | Wrong reveal/write semantics |
| **8** | **PS** | Postseason snapshot tables | Separate product authorization | Cut freeze still non-durable |

### Explicit non-goals until authorized

- Do not enable `FORCE ROW LEVEL SECURITY` casually  
- Do not modify sport immutability trigger/function  
- Do not drop UNIQUE constraints  
- Do not apply combined D0 mega-migration  
- Do not REVOKE grants without per-function call-site analysis  

### D1A apply checklist (when Mike authorizes)

1. SELECT-only: exact DELETE policy names on `public.leagues`  
2. Confirm list matches freeze (expected: `"Commissioner deletes league"` only)  
3. Apply `supabase/D1A-league-delete-lockdown-REVIEW-ONLY.sql` only  
4. Post-verify: zero DELETE policies; sport trigger still O; create/update still work  
5. Do **not** bundle D-01–D-03 or H-01 into the same transaction  

---

## 6. Document index

| Doc / SQL | Role |
|-----------|------|
| `docs/P15-STRUCTURAL-SECURITY-EVIDENCE.md` | RLS, trigger, uniques, postseason |
| `docs/P16-DEFINER-GRANTS-SEARCHPATH-EVIDENCE.md` | DEFINER inventory, grants FINDING, search_path |
| `docs/P17-DEFINER-BODY-ACL-EVIDENCE.md` | Body review, D-01–D-03, protected set |
| `docs/P18-DEFINER-LEAGUES-MUTATE-EVIDENCE.md` | No DEFINER league delete; safe updates |
| `docs/STRUCTURAL-HARDENING-D0-RLS.md` | D1A/B/C design |
| `supabase/D1A-league-delete-lockdown-REVIEW-ONLY.sql` | D1A proposal (not applied) |
| This file | Master defect register + repair order |

---

*End register — inspection chain complete; repair requires Mike authorization.*
