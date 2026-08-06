# D1B-B — Test matrix (post fair-entry revision)

**Classification context:** **REVIEW-ONLY PACKAGE REVISED / DISPOSABLE READY**  
**Behavioral execution:** **NOT_RUN** unless noted  

| ID | Case | Expect | Status |
|----|------|--------|--------|
| S-FE-TS | `node scripts/verify-fair-entry-parity.mjs` | All PASS | Run at commit time if node available |
| S-FE-SQL | percentile SQL smokes | Match TS | **NOT_RUN** (needs disposable) |
| S1–S4 | Static package structure | PASS | **PASS** (source audit) |
| S-CUT | cut_percent 10/50/75 ok; 9/76/neg/100 fail | validation contract | **NOT_RUN** (disposable) |
| S-CUT-LIVE | Package does not alter cut_percent CHECK | no DDL on check | **PASS** (source) |
| S-SEASON | FE freezes season_year isolation | no cross-season leak | **NOT_RUN** |
| D0–D15 | Disposable JWT suite | Per guide | **NOT_RUN** |
| FE-preseason | no week_results | points 0 | **NOT_RUN** |
| FE-mid | scored + humans | match band pct | **NOT_RUN** |
| FE-freeze | second joiner | same frozen points | **NOT_RUN** |
| FE-exclude-self | exclude joiner from array | no self in sample | **NOT_RUN** |
| FE-bots | bots in league | bots ignored in pct | **NOT_RUN** |
| CAP+FE | full capacity + FE | both enforced in TX | **NOT_RUN** |

Update status only after genuine disposable execution.
