# D-02 P6 / P7 — App catalog parity + remove upsert fallback

**Status:** REVIEW ONLY — **not deployed** · **not pushed as app release** · **not claimed complete**  
**Depends on:** D-02 SQL **LIVE / STRUCTURALLY VERIFIED**  
**Does not:** D-03 · D1B · D1C · production SQL · real egg history tests  

---

## 1. Goals (Mike-approved direction)

| ID | Goal |
|----|------|
| **P7** | Remove direct `easter_egg_finds` upsert fallback; honest RPC failure; local grant may still succeed offline |
| **P6** | Catalog parity: app 20 IDs ≡ approved seed ≡ D-02 SQL seed; fail on drift |
| **Behavioral** | Disposable-identity plan for live RPC + direct-insert denial (not executed here) |

---

## 2. Proposed code changes (local working tree)

### 2.1 Files

| File | Change |
|------|--------|
| `src/lib/egg-cloud.ts` | **Rewrite sync path:** no upsert; `cloudSynced`; catalog gate; only cache on success |
| `src/lib/egg-cloud-sync-core.ts` | **New** pure interpret/gates for tests |
| `src/lib/easter-egg-db-catalog-seed.ts` | **New** frozen 20-ID approved seed (matches SQL) |
| `src/lib/easter-eggs.ts` | Flex event only via `shouldDispatchEggFlex` (requires cloudSynced) |
| `scripts/verify-easter-egg-catalog-parity.mjs` | **New** P6 parity |
| `scripts/verify-easter-egg-cloud.mjs` | **New** P7 unit/source checks |
| `package.json` | Optional scripts (not required for review) |

### 2.2 Diff summary — `syncEasterEggFindToCloud`

**Before (defect / bypass):**

```ts
if (error) {
  // Fallback: direct insert if RPC missing but table exists
  await supabase.from("easter_egg_finds").upsert({ user_id, discovery_id, ... });
  addCloudEggToCache(uid, discoveryId);
  return { ok: true }; // false cloud success path
}
// also cached even when row.ok === false
```

**After (proposed):**

```ts
// Client gate: isApprovedEasterEggId(discoveryId)
const { data, error } = await supabase.rpc("record_easter_egg_find", { ... });
const result = interpretRecordEggRpcResponse({ data, error, clientCatalogTotal });
// only if result.cloudSynced && result.ok → addCloudEggToCache
// never upsert easter_egg_finds
return result; // { ok, cloudSynced, found?, total?, flexesInserted?, error?, reason? }
```

**Deprecated:** `playerName` still optional for call-site compat; sent as `p_player_name` but **server ignores** (D-02). Documented deprecated on opts.

### 2.3 Local vs cloud honesty

| Layer | On RPC failure |
|-------|----------------|
| Local `grantDiscovery` | **Still succeeds** (offline / curiosity UX) |
| Permanent badge local | Unchanged |
| Cloud cache | **Not** updated |
| `cloudSynced` | `false` |
| Flex newspaper dispatch | **Not** fired (`shouldDispatchEggFlex`) |
| Player-facing “cloud saved” | **Must not** claim success (no UI today claims cloud; keep it that way) |

### 2.4 Upsert fallback removed

Direct client insert is already **denied** by D-02 SQL (`egg_finds_insert_self` dropped). Removing upsert:

- Avoids noisy failing requests  
- Avoids any future policy re-open becoming a bypass  
- Aligns app with RPC-only product law  

---

## 3. Tests

### 3.1 P6 — catalog parity

```bash
node scripts/verify-easter-egg-catalog-parity.mjs
```

Asserts:

1. Seed has exactly 20 unique `egg_*`  
2. App `id: "egg_*"` set equals seed  
3. D-02 SQL seed equals seed  
4. `listEasterEggDefs` still filters passport  

**Run result (local):** see command output when executed in review.

### 3.2 P7 — unit / source

```bash
node scripts/verify-easter-egg-cloud.mjs
```

Covers:

| Case | Expect |
|------|--------|
| Valid RPC ok | `ok` + `cloudSynced`; cache allowed |
| Fake / `ok:false` | not cloudSynced; no cache; no flex |
| Duplicate (`newFind:false`, `ok:true`) | cloudSynced; no flex if flexesInserted=0 |
| Server total vs spoofed client total | uses server `total: 20` |
| RPC transport error | not cloudSynced; no cache; no flex |
| Source | no `.upsert`; uses RPC; grantDiscovery uses flex gate |

### 3.3 Integration (optional later)

Mock Supabase client inject — not required for first review if pure core + source asserts pass.

---

## 4. Deployment impact

| Item | Impact |
|------|--------|
| Requires D-02 SQL live | **Yes** (already) |
| Requires app deploy | **Yes** for P7 to take effect in production browsers |
| Schema / grants | **None** |
| Existing egg history | **Untouched** |
| Users offline / RPC down | Local eggs still grant; cloud lags until next successful sync (no automatic retry queue — same as today for failed void promise) |
| Risk | Slightly more “local-only” finds until reconnect; **correct** vs false cloud success |
| Rollback | Revert app commit; SQL stays hardened |

**Deploy order (when authorized):**

1. Keep D-02 SQL live (already)  
2. Land app P6/P7  
3. Run both verify scripts in CI or pre-merge  
4. Optional: disposable-identity behavioral suite  

---

## 5. Safe behavioral-test plan (live RPC — **not executed**)

### Constraints (binding)

- **No** real player accounts with career identity  
- **No** real league Locker / production conversation history  
- Prefer **new disposable auth user** created for test, then deleted  
- Or Mike-reviewed throwaway account with zero sentimental egg history  
- Stop on unexpected flex newspaper visible to other users (milestones 7/10/20 on disposable only)

### Setup

1. Create disposable Supabase Auth user (email+password or magic link throwaway).  
2. Confirm profile row exists (`display_name` set to e.g. `D02-Test-Disposable`).  
3. Sign in as that user only (anon key + user JWT).  
4. Confirm zero rows in `easter_egg_finds` / flexes for that `user_id` before start.

### Cases

| # | Action | Expect |
|---|--------|--------|
| B1 | RPC `egg_lucky_seven` + spoof name/total | `ok:true`; find row; `finder_name` = profile not spoof; `total=20` |
| B2 | RPC same id again | `newFind:false` or equivalent; still one row |
| B3 | RPC `egg_not_real_xyz` | `ok:false` / Unknown discovery; no row |
| B4 | RPC `stamp_cfb_season` | rejected |
| B5 | Client `insert`/`upsert` into `easter_egg_finds` | **Denied** (RLS) |
| B6 | Anon JWT call RPC | fail / not authenticated |
| B7 | App `syncEasterEggFindToCloud` after P7 deploy | `cloudSynced:true` on valid; `false` on fake; no upsert in network tab |

### Teardown

1. Delete disposable user’s finds (only that user_id) — **explicit cleanup auth** if needed  
2. Delete auth user  
3. Confirm no flex rows left for that user (or accept orphan flex only if milestones hit — prefer avoid by not granting 7 eggs)

### Authorization

Behavioral suite requires **separate Mike go** after app P7 is approved for deploy. This document does **not** authorize live calls.

---

## 6. Explicit non-goals

- Deploy / production app release  
- Push app code to `main` without Mike auth  
- D-03, D1B, D1C  
- Historical egg cleanup  
- Removing deprecated RPC params from signature  

---

## 7. Mike review checklist

- [ ] Approve P7 app behavior (local grant + honest cloud)  
- [ ] Approve P6 parity script as merge gate  
- [ ] Approve optional package.json scripts  
- [ ] Authorize merge/deploy of app changes  
- [ ] Later: authorize disposable behavioral suite  

---

## 8. Suggested package.json scripts (optional)

```json
"verify:egg-catalog": "node scripts/verify-easter-egg-catalog-parity.mjs",
"verify:egg-cloud": "node scripts/verify-easter-egg-cloud.mjs"
```

---

*End P6/P7 REVIEW ONLY.*
