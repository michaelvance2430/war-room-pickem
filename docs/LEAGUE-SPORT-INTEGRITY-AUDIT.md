# League sport integrity — write audit (Saturday Situation Room)

**Incident league:** `76730ee3-d440-4a91-9616-a768ffc03189` (repaired to `cfb`, `current_week=0`)  
**Immediate app fix:** `8aa5414`  
**This hardening:** defense in depth (app + proposed DB trigger)

## PRODUCT LAW

`leagues.sport_id` is set **only on INSERT**. After creation it is immutable.  
Local stamps never UPDATE cloud. Intentional conversion requires a separate product migration.

---

## Stage A — Write path classification

| Path | File | Class | Status after hardening |
|------|------|--------|------------------------|
| Create league INSERT with `sport_id` | `src/app/join/page.tsx` | **1 Creation INSERT** | Keeps INSERT; removed post-create sport UPDATE |
| Create league INSERT with `sport_id` | `src/lib/sport-pool.ts` | **1 Creation INSERT** | Keeps INSERT; removed post-create sport UPDATE |
| Bare insert + sport UPDATE fallback | join / sport-pool (old) | **2 Post-creation setup UPDATE** | **Removed** — fail if column missing |
| “Re-assert” sport after create | join (old) | **2 Post-creation setup UPDATE** | **Removed** — SELECT verify only |
| NFL extra update after create | join ~450 (old) | **2 Post-creation setup UPDATE** | **Removed** |
| `saveLeagueToCloud` settings | `src/lib/league-sync.ts` | **3 General settings UPDATE** | Whitelist; **strips `sport_id`** |
| `reassertLeagueSportToCloud` | `sport-theme.ts` (old) | **4 Session/read reconciliation** | **Deleted entirely** |
| `fetchMyMemberships` reassert | `session-restore.ts` (old) | **4 Session/read** | **Removed** (already in 8aa5414) |
| `mapLeagueFromRow` reassert | `league-sync.ts` (old) | **4 Session/read** | **Removed** |
| Local stamps / pin | `sport-theme.ts` | Local only | Cloud wins; stamp follows cloud |
| Join existing league | join / open-room | Membership INSERT only | No sport UPDATE |
| Favorite teams | `favorite-teams.ts` | profile table | No league write |
| Crystal Ball | `crystal-ball.ts` | `crystal_ball_picks` | No league sport write |
| Foundry / odds / health | various | **5 Foundry** | SELECTs only on leagues |
| Admin test cleanup | `admin-test-cleanup.ts` | **6 Maintenance** | Reads `sport_id`; no sport UPDATE |
| Season reset `current_week` | `cloud.ts` | **3 Settings-like** | Updates week only, not sport |
| Open-room full unlist | `open-room.ts` | **3 Settings** | `is_open` only |
| Historical SQL repair scripts | `FIX-NFL-SPORT-NOW.sql` etc. | **6 Maintenance** | Manual; superseded by immutability trigger |
| `reassert` no-op stub | post-8aa5414 | **7 Dead code** | **Removed** |

### Creation knows sport before INSERT?

**Yes.** Host picks sport → `withSport` / `insertRow` includes `sport_id: selectedSportId | sportId` on the **first** `.insert(...)`.  
Placeholder “insert without sport then UPDATE” paths are **gone**.

---

## Stage D — Other config write-on-read

| Field | Read/restore mutates? | Notes |
|-------|----------------------|--------|
| `sport_id` | **No** (after fix) | Immutable after INSERT |
| `crystal_ball_enabled` | **No** on read | Only explicit settings save / create INSERT |
| `current_week` | Not on membership fetch | Explicit week ops / season reset |
| `cut_percent` / games | Settings save only | Whitelisted |
| `commissioner_id` | No on read | Stripped from settings patch |
| `is_open` | Explicit open-room APIs | Not membership fetch |

---

## Stage C — DB guard (prepared, not applied)

File: `supabase/league-sport-immutable.sql`  
Trigger `BEFORE UPDATE` raises if `NEW.sport_id IS DISTINCT FROM OLD.sport_id`.

**Do not apply until app deploy + human review.**

---

## Stage E — Incident scan

File: `scripts/sql/incident-league-sport-scan.sql` (read-only)

---

## Observability

`logSportMismatch` → `console.info("[warroom-sport-mismatch]", { leagueId prefix, cloud, local, action: cloud_wins_no_write })`
