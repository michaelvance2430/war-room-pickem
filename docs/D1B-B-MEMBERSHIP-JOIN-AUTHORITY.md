# D1B-B — Membership join authority

**Status:** **B1–B6 LOCKED / REVIEW-ONLY SQL PACKAGE READY / NO PRODUCTION APPLY / NOT REPAIRED**  
**Apply:** **NOT AUTHORIZED** · **no production apply**  
**Date:** 2026-08-06  

**Canonical freeze + map:** `docs/D1B-B-PRODUCT-DECISIONS-AND-CALLSITE-MAP.md`  
**REVIEW-ONLY SQL:** `docs/D1B-B-REVIEW-ONLY-SQL-PACKAGE.md` · `supabase/review-only/D1B-B/`  
**Live preflight:** `docs/D1B-B-PREFLIGHT-AND-DESIGN-SCOPE.md` §0  

---

## Classification

```text
D1B-B:
PRODUCT DECISIONS LOCKED (B1–B6) /
REVIEW-ONLY SQL PACKAGE READY /
NO PRODUCTION APPLY /
NOT REPAIRED
```

---

## B1–B6 (summary — full text in product-decisions doc)

| ID | Lock |
|----|------|
| **B1** | Human membership creation RPC-only after cutover (create / code / open UUID); force server defaults; no INSERT drop until verified |
| **B2** | `max_human_members` default 32; humans+commissioner count; bots do not; TX concurrency; backfill separate; no membership deletes |
| **B3** | Codes private; DEFINER join-by-code; open discovery without codes; tighten leagues SELECT only after app map |
| **B4** | No broad player UPDATE; only `display_name_override` via `set_my_league_display_name`; map all other writers first |
| **B5** | Atomic create league + commissioner seat |
| **B6** | Staged cutover 1–15; never one-shot migration |

---

## Architecture (phased)

1. Freeze ✅ · Call-site map ✅  
2. REVIEW-ONLY RPC/policy SQL ⏳ (not this commit)  
3. Apply RPCs with legacy paths ⏳  
4. App cutover ⏳  
5. Disposable tests ⏳  
6. Drop membership INSERT ⏳  
7. Narrow UPDATE ⏳  
8. Discovery + code privacy ⏳  

---

## Explicit non-actions now

No production SQL · no RPC creation · no max_human_members apply · no policy removal · no app deploy · no D1C/H-01  

---

*See product-decisions-and-callsite-map for full detail.*
