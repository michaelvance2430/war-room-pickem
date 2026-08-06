# D1B-B — Test matrix

**Status:** Authored · **NOT_RUN** (except static review items)  
**Date:** 2026-08-06  
**Classification context:** **BLOCKED BY FAIR-ENTRY PARITY** for production; disposable early-season optional  

| ID | Area | Case | Expect | Executed |
|----|------|------|--------|----------|
| S1 | Static audit | File 07 not in stage-6 | No INSERT/UPDATE/SELECT strip | **PASS** (review) |
| S2 | Static audit | Forced defaults no client privilege params | No privileged args on RPCs | **PASS** (review) |
| S3 | Static audit | FOR UPDATE on joins | Present | **PASS** (review) |
| S4 | Static audit | list_open has no code | Absent | **PASS** (review) |
| S5 | Static audit | Fair-entry stub | Returns 0 | **PASS** (review) / **BLOCKER** |
| D0–D15 | Disposable | See disposable guide | Per case | **NOT_RUN** |
| FE-* | Fair-entry | Band parity fixtures | Match TS | **BLOCKED** |

Do not mark overall disposable suite READY until D0–D15 executed on ephemeral DB and FE unblocked or explicitly scoped out.
