# D-02 P6 / P7 — App revision (pending preserve + backoff)

**Status:** REVIEW ONLY — **not merged** · **not deployed** · **app not pushed to main**  
**Merge/deploy:** **NOT YET**  
**Behavioral live suite:** later, disposable identity only  

---

## 1. Revised design (post reliability review)

### 1.1 Pending across logout / account switch

| Rule | Behavior |
|------|----------|
| Storage key | `warroom-egg-cloud-pending-v1` |
| Isolation | `byUser[authUuid][discoveryId]` |
| Logout | **Do not** clear pending |
| Account switch | **Do not** prune other users |
| Flush | **Only** currently authenticated `userId` |
| Cross-send | Refused if `auth.getUser().id !== userId` |
| Clear pending | Success, or **explicit** local wipe / account deletion API only |
| Stale | Drop temporary pending if `enqueuedAt` &gt; **90 days** |

### 1.2 Bounded exponential backoff

| Field | Role |
|-------|------|
| `attempts` | Count of completed flush failures |
| `lastAttemptAt` | ISO of last flush attempt |
| `nextAttemptAt` | ISO; automatic flush skips until due |

| Constant | Value |
|----------|--------|
| Base | **30s** |
| Formula | `min(MAX, BASE * 2^(attempts-1))` |
| Max | **6 hours** |

| Path | Behavior |
|------|----------|
| First local grant + temp fail | `enqueue` with `nextAttemptAt = now` (eligible once) |
| Flush attempt + temp fail | `markPendingAttemptWithBackoff` → future `nextAttemptAt` |
| Startup / online flush | Respects `nextAttemptAt` (`force: false`) |
| Manual/test | `flushPendingEggCloudSyncs(userId, { force: true })` only |
| Success | `clearPendingEgg` |
| Permanent reject | `permanent_rejected`; never auto-retry |
| Single-flight | One in-flight flush promise |

**No recursive immediate retry** after temporary failure inside the same flush loop item (backoff schedules future only).

### 1.3 Honesty (unchanged approvals)

- Local grant may succeed offline  
- Never claim `cloudSynced` without RPC ok  
- No flex without confirmed server success  
- **Never** restore table upsert  
- Name/total not authority (`p_player_name` dummy, `p_total_eggs: 0`)

---

## 2. Files (local proposal)

| File | Change |
|------|--------|
| `src/lib/egg-cloud-pending.ts` | Preserve queues; backoff fields; no prune |
| `src/lib/egg-cloud.ts` | Session match guard; flush force/backoff; no prune |
| `src/lib/egg-cloud-sync-core.ts` | Temp/permanent classification |
| `src/lib/easter-egg-db-catalog-seed.ts` | 20-ID seed |
| `src/lib/easter-eggs.ts` | Sync + flex gate |
| `src/components/EasterEggHost.tsx` | Flush on session + online |
| `scripts/verify-easter-egg-*.mjs` | Parity + pending/backoff tests |
| `package.json` | `verify:egg-catalog`, `verify:egg-cloud`, `verify:eggs`, `verify:predeploy` |

---

## 3. Test commands and results (this revision)

```bash
npm run verify:egg-catalog   # PASS — 12 checks
npm run verify:egg-cloud     # PASS — 46 checks (pending preserve + backoff)
npm run verify:eggs          # PASS
npm run verify:predeploy     # PASS (eggs + home-mission 22/22)
```

| Suite | Result |
|-------|--------|
| Catalog parity | **PASS** (12) |
| Egg cloud / pending / backoff | **PASS** (46) |
| Predeploy | **PASS** (includes home-mission **22/22**) |

---

## 4. Deploy / rollback (when authorized later)

1. D-02 SQL already LIVE  
2. Merge app after Mike go  
3. `npm run verify:predeploy` required  
4. Deploy  
5. Disposable behavioral suite later  

**Rollback:** revert app. Queues remain in localStorage harmlessly.

---

*End revised P6/P7.*
