# D-02 P6 / P7 — App revision (pending-sync + parity)

**Status:** REVIEW ONLY — **not merged to main as app release** · **not deployed**  
**Honesty model:** APPROVED in principle + **required pending-sync revision** (this doc)  
**Merge/deploy:** **NOT YET** — revise, retest, Mike review  
**Behavioral live suite:** APPROVE LATER (disposable identity only)

---

## 1. Revised sync-state design

### States per `(userId, discoveryId)`

| State | Meaning | `cloudSynced` | Flex | Auto-retry |
|-------|---------|---------------|------|------------|
| **Local only** | Local grant; never tried or not enqueued | false | no | no |
| **Pending** | Valid local grant; temporary cloud failure | false | no | **yes** |
| **Cloud synced** | RPC `ok` + success | true | only if server flexesInserted &gt; 0 | n/a (cleared pending) |
| **Permanent rejected** | Server/client reject (Unknown discovery, not catalog) | false | no | **no** |

### Flow

```
grantDiscovery(local) → always local success if catalog def exists
       ↓
syncEasterEggFindToCloud(RPC only; never table upsert)
       ├─ success → clear pending; maybe cache; maybe flex
       ├─ temporary fail → enqueue pending (durable)
       └─ permanent reject → mark permanent_rejected (no forever retry)
       ↓
flushPendingEggCloudSyncs(userId) on startup / online / session
       └─ retry pending only; idempotent RPC
```

### Never

- Claim cloud success without RPC ok  
- Dispatch flex without `cloudSynced`  
- Restore direct-table upsert  
- Trust/resend player name or total as authority (`p_player_name` fixed dummy / `p_total_eggs: 0`)

---

## 2. Storage key and user-scoping

| Item | Value |
|------|--------|
| **Key** | `warroom-egg-cloud-pending-v1` |
| **Module** | `src/lib/egg-cloud-pending.ts` |
| **Shape** | `{ version: 1, byUser: { [userId]: { [discoveryId]: PendingEggEntry } } }` |
| **User id** | Supabase auth UUID (= session `playerId` / `profiles.id`) |
| **Scoping** | All reads/writes under `byUser[userId]` |
| **Account switch** | `prunePendingToUser(activeUserId)` drops other users’ maps |
| **Logout (optional hard)** | `clearPendingForUser(userId)` |
| **Stale temporary** | Drop pending if `enqueuedAt` older than **90 days** (`EGG_PENDING_STALE_MS`) |
| **Permanent** | Kept as `status: "permanent_rejected"` so we don’t re-spam; not in retry list |

`PendingEggEntry`: `discoveryId`, `status` (`pending` \| `permanent_rejected`), `enqueuedAt`, `updatedAt`, `attempts`, `lastError?`, `lastReason?`.

Only **approved catalog IDs** may enqueue.

---

## 3. Retry triggers and error handling

### Retry triggers

| Trigger | Where |
|---------|--------|
| After temporary sync failure | `applyPendingOutcome` → enqueue |
| Session / host startup | `EasterEggHost` after quiet delay → `flushPendingEggCloudSyncs` |
| Browser `online` | `EasterEggHost` listener → flush |
| Future auth recovery | Call `flushPendingEggCloudSyncs` (same API; host online + startup cover most) |

Single-flight: concurrent flushes share one in-flight promise.

### Temporary vs permanent

| Class | `reason` values | Action |
|-------|-----------------|--------|
| **Temporary** | `rpc_error`, `cloud_disabled`, `exception`, `unauthenticated` | Enqueue / keep pending; retry |
| **Permanent** | `rpc_rejected` (e.g. Unknown discovery), `not_in_catalog`, `not_egg_prefix` | `permanent_rejected`; no auto-retry |

Duplicate RPC after success: server idempotent; pending cleared; safe.

---

## 4. Updated file list (local proposal)

| File | Role |
|------|------|
| `src/lib/egg-cloud-pending.ts` | Durable pending store |
| `src/lib/egg-cloud-sync-core.ts` | Pure interpret + temp/permanent + flex/cache gates |
| `src/lib/egg-cloud.ts` | RPC-only sync, pending apply, flush |
| `src/lib/easter-egg-db-catalog-seed.ts` | 20-ID seed for parity |
| `src/lib/easter-eggs.ts` | Sync without playerName; flex gate |
| `src/components/EasterEggHost.tsx` | Flush on session + online |
| `scripts/verify-easter-egg-catalog-parity.mjs` | P6 |
| `scripts/verify-easter-egg-cloud.mjs` | P7 + pending tests |
| `package.json` | `verify:egg-catalog`, `verify:egg-cloud`, `verify:eggs`, `verify:predeploy` |

---

## 5. Tests and results (re-run after revision)

```bash
npm run verify:egg-catalog
npm run verify:egg-cloud
```

**Expected:** all PASS (catalog 20-way parity; no upsert; pending offline→retry→clear; permanent no retry; user prune; predeploy scripts wired).

---

## 6. Deployment / rollback (when Mike authorizes later)

| Step | Action |
|------|--------|
| 1 | D-02 SQL already LIVE |
| 2 | Merge app proposal to main (explicit auth) |
| 3 | `npm run verify:predeploy` must pass before deploy |
| 4 | Deploy app |
| 5 | Optional later: disposable behavioral suite |

**Rollback:** revert app commit. Pending key harmless. SQL stays hardened.  
**Risk:** local eggs without cloud until retry succeeds — correct honesty.

---

## 7. Disposable behavioral suite (later only)

Unchanged constraints: disposable identity, cleanup after, no real egg history.  
Run only after this revised app is reviewed/merged.

---

## 8. Mike gates

- [ ] Approve pending-sync design + storage key  
- [ ] Approve merge of local app (still **not** done)  
- [ ] Deploy after `verify:predeploy`  
- [ ] Later: disposable live suite  

---

*End revised P6/P7 REVIEW ONLY.*
