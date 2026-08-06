# H-01B — Future default privileges for new functions

**Status:** **DESIGN REQUIRED SEPARATELY** · **NOT STARTED** · **NOT AUTHORIZED**  
**Must not be bundled with H-01A selective REVOKE of existing functions.**

---

## Problem

Public-schema default function privileges currently **auto-GRANT EXECUTE** to:

- `anon`  
- `authenticated`  
- `service_role`  

for **new** functions owned by `postgres` and/or `supabase_admin`.

Effect: every new SECURITY DEFINER (and other) function re-opens the H-01 anon surface unless every migration remembers explicit REVOKE—exactly the advisor “anon-executable SECURITY DEFINER” class.

---

## Design work still required (outline only)

| Topic | Open questions |
|-------|----------------|
| Scope | All new functions vs SECURITY DEFINER only vs public schema only |
| Mechanism | `ALTER DEFAULT PRIVILEGES` for role(s); migration lint; template REVOKE block |
| service_role | Keep auto-EXECUTE for service_role or grant per function? |
| Authenticated | Default deny + per-RPC grant vs keep authenticated default |
| Anon | Default **deny** EXECUTE (recommended direction for H-01B product law) |
| Rollback | How to restore defaults if a migration breaks |
| Existing 27 | **Out of H-01B** — those are H-01A selective |

---

## Relation to H-01A

| Track | Acts on |
|-------|---------|
| H-01A | **Existing** live functions — selective REVOKE |
| H-01B | **Future** creates — stop auto-grant leak |

Apply order preference: H-01A batches may ship first; H-01B should land soon after so new SQL does not re-expand anon surface.

---

## Explicit non-actions

- No `ALTER DEFAULT PRIVILEGES` until Mike authorizes **H-01B** specifically  
- No mass REVOKE of existing functions under H-01B  

---

*End H-01B stub — design required separately.*
