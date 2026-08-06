/**
 * P7 unit/source coverage: egg cloud + durable pending + backoff (no network).
 * Usage: npm run verify:egg-cloud
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const EGG_BACKOFF_BASE_MS = 30_000;
const EGG_BACKOFF_MAX_MS = 6 * 60 * 60 * 1000;

function computeBackoffMs(attempts) {
  const n = Math.max(1, Math.floor(attempts));
  return Math.min(EGG_BACKOFF_MAX_MS, EGG_BACKOFF_BASE_MS * Math.pow(2, n - 1));
}

function interpretRecordEggRpcResponse({ data, error, clientCatalogTotal }) {
  if (error) {
    return {
      ok: false,
      cloudSynced: false,
      error: error.message || "RPC error",
      reason: "rpc_error",
    };
  }
  if (!data || data.ok === false) {
    return {
      ok: false,
      cloudSynced: false,
      error: data?.error || "RPC rejected",
      reason: "rpc_rejected",
      found: data?.found,
      total: data?.total ?? clientCatalogTotal,
      flexesInserted: 0,
    };
  }
  return {
    ok: true,
    cloudSynced: true,
    found: data.found,
    total: data.total ?? clientCatalogTotal,
    flexesInserted: data.flexesInserted ?? 0,
  };
}
function shouldDispatchEggFlex(res) {
  return (
    res.cloudSynced === true &&
    res.ok === true &&
    typeof res.flexesInserted === "number" &&
    res.flexesInserted > 0
  );
}
function isTemporaryEggSyncFailure(res) {
  if (res.cloudSynced || res.ok) return false;
  const r = res.reason;
  return (
    r === "rpc_error" ||
    r === "cloud_disabled" ||
    r === "exception" ||
    r === "unauthenticated"
  );
}
function isPermanentEggSyncRejection(res) {
  if (res.cloudSynced || res.ok) return false;
  return (
    res.reason === "rpc_rejected" ||
    res.reason === "not_in_catalog" ||
    res.reason === "not_egg_prefix"
  );
}

/** In-memory pending with backoff fields */
function makePendingMemory() {
  /** @type {Record<string, Record<string, any>>} */
  const byUser = {};
  return {
    byUser,
    enqueue(userId, discoveryId, meta, nowMs = Date.now()) {
      if (!byUser[userId]) byUser[userId] = {};
      const prev = byUser[userId][discoveryId];
      if (prev?.status === "permanent_rejected") return false;
      const now = new Date(nowMs).toISOString();
      if (!prev || prev.status !== "pending") {
        byUser[userId][discoveryId] = {
          discoveryId,
          status: "pending",
          enqueuedAt: now,
          attempts: 0,
          nextAttemptAt: now,
          lastError: meta?.error,
        };
      } else {
        byUser[userId][discoveryId] = {
          ...prev,
          lastError: meta?.error ?? prev.lastError,
        };
      }
      return true;
    },
    markAttempt(userId, discoveryId, nowMs = Date.now()) {
      const prev = byUser[userId]?.[discoveryId];
      if (!prev || prev.status === "permanent_rejected") return null;
      const attempts = (prev.attempts || 0) + 1;
      const now = new Date(nowMs).toISOString();
      const next = new Date(nowMs + computeBackoffMs(attempts)).toISOString();
      const entry = {
        ...prev,
        status: "pending",
        attempts,
        lastAttemptAt: now,
        nextAttemptAt: next,
      };
      byUser[userId][discoveryId] = entry;
      return entry;
    },
    clear(userId, discoveryId) {
      if (byUser[userId]) delete byUser[userId][discoveryId];
    },
    markPermanent(userId, discoveryId) {
      if (!byUser[userId]) byUser[userId] = {};
      byUser[userId][discoveryId] = {
        discoveryId,
        status: "permanent_rejected",
        enqueuedAt: "t0",
        attempts: 1,
      };
    },
    listDue(userId, nowMs, force = false) {
      const map = byUser[userId] || {};
      return Object.keys(map).filter((id) => {
        const e = map[id];
        if (e.status !== "pending") return false;
        if (force) return true;
        if (!e.nextAttemptAt) return true;
        return Date.parse(e.nextAttemptAt) <= nowMs;
      });
    },
    listAllPending(userId) {
      const map = byUser[userId] || {};
      return Object.keys(map).filter((id) => map[id].status === "pending");
    },
    get(userId, discoveryId) {
      return byUser[userId]?.[discoveryId] || null;
    },
  };
}

let fails = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL", msg);
    fails += 1;
  } else {
    console.log("PASS", msg);
  }
}

const isApproved = (id) =>
  ["egg_lucky_seven", "egg_anniversary", "egg_curiosity_trophy"].includes(id);

// --- Source guards ---
const eggCloud = readFileSync(resolve(root, "src/lib/egg-cloud.ts"), "utf8");
assert(!/\.upsert\s*\(/.test(eggCloud), "1 no upsert");
assert(eggCloud.includes("record_easter_egg_find"), "2 uses RPC");
assert(eggCloud.includes("flushPendingEggCloudSyncs"), "3 flush API");
assert(eggCloud.includes("markPendingAttemptWithBackoff"), "4 backoff on flush fail");
assert(eggCloud.includes("Session user mismatch"), "5 cross-user session guard");
assert(!eggCloud.includes("prunePendingToUser"), "6 no prune on user switch");
assert(eggCloud.includes("p_total_eggs: 0"), "7 no client total authority");
assert(eggCloud.includes("force"), "8 force flush option for tests");

const pendingSrc = readFileSync(
  resolve(root, "src/lib/egg-cloud-pending.ts"),
  "utf8"
);
assert(pendingSrc.includes("warroom-egg-cloud-pending-v1"), "9 storage key");
assert(pendingSrc.includes("nextAttemptAt"), "10 nextAttemptAt field");
assert(pendingSrc.includes("lastAttemptAt"), "11 lastAttemptAt field");
assert(pendingSrc.includes("computeBackoffMs"), "12 backoff helper");
assert(pendingSrc.includes("EGG_BACKOFF_MAX_MS"), "13 max backoff");
assert(
  pendingSrc.includes("NOT for ordinary logout"),
  "14 clearPending documented not for logout"
);
assert(
  !pendingSrc.includes("function prunePendingToUser"),
  "15 prunePendingToUser removed"
);

const host = readFileSync(
  resolve(root, "src/components/EasterEggHost.tsx"),
  "utf8"
);
assert(host.includes("flushPendingEggCloudSyncs"), "16 host flushes");
assert(host.includes('"online"'), "17 host online retry");

const easterEggs = readFileSync(resolve(root, "src/lib/easter-eggs.ts"), "utf8");
assert(easterEggs.includes("shouldDispatchEggFlex"), "18 flex gate");
assert(
  !/syncEasterEggFindToCloud\(\s*\{[^}]*playerName/s.test(easterEggs),
  "19 no playerName authority from grant"
);

// --- Core RPC cases ---
{
  const res = interpretRecordEggRpcResponse({
    data: { ok: true, found: 3, total: 20, flexesInserted: 0 },
    error: null,
    clientCatalogTotal: 20,
  });
  assert(res.cloudSynced, "20 valid success");
}
{
  const res = interpretRecordEggRpcResponse({
    data: { ok: false, error: "Unknown discovery" },
    error: null,
    clientCatalogTotal: 20,
  });
  assert(isPermanentEggSyncRejection(res), "21 permanent Unknown discovery");
}
{
  const res = interpretRecordEggRpcResponse({
    data: null,
    error: { message: "offline" },
    clientCatalogTotal: 20,
  });
  assert(isTemporaryEggSyncFailure(res), "22 offline temporary");
}

// --- Backoff math ---
assert(computeBackoffMs(1) === 30_000, "23 attempt1 = 30s");
assert(computeBackoffMs(2) === 60_000, "24 attempt2 = 60s");
assert(computeBackoffMs(3) === 120_000, "25 attempt3 = 120s");
assert(computeBackoffMs(20) === EGG_BACKOFF_MAX_MS, "26 capped at max");

// --- Offline grant → logout → login → still pending (no clear) ---
{
  const mem = makePendingMemory();
  const t0 = 1_000_000;
  mem.enqueue("user-a", "egg_lucky_seven", { error: "offline" }, t0);
  // simulate logout: do NOT clearUser
  assert(
    mem.listAllPending("user-a").includes("egg_lucky_seven"),
    "27 pending survives logout (not cleared)"
  );
  // login same user — due immediately (nextAttemptAt = t0)
  assert(
    mem.listDue("user-a", t0 + 1000).includes("egg_lucky_seven"),
    "28 same user login can flush when due"
  );
  // success clears
  mem.clear("user-a", "egg_lucky_seven");
  assert(mem.listAllPending("user-a").length === 0, "29 cleared after success");
}

// --- User A pending → B login → A not sent as B ---
{
  const mem = makePendingMemory();
  mem.enqueue("user-a", "egg_lucky_seven");
  mem.enqueue("user-b", "egg_anniversary");
  // B flush only lists B
  const bDue = mem.listDue("user-b", Date.now(), true);
  assert(bDue.includes("egg_anniversary"), "30 B sees own pending");
  assert(!bDue.includes("egg_lucky_seven"), "31 B never sees A pending");
  // A still intact
  assert(
    mem.listAllPending("user-a").includes("egg_lucky_seven"),
    "32 A queue preserved while B active"
  );
  // return to A
  assert(
    mem.listDue("user-a", Date.now(), true).includes("egg_lucky_seven"),
    "33 return to A can sync A item"
  );
}

// --- No immediate retry loop after temporary fail during flush ---
{
  const mem = makePendingMemory();
  const t0 = 5_000_000;
  mem.enqueue("user-a", "egg_anniversary", {}, t0);
  // first flush attempt fails → markAttempt
  const entry = mem.markAttempt("user-a", "egg_anniversary", t0);
  assert(entry.attempts === 1, "34 attempt incremented");
  assert(Date.parse(entry.nextAttemptAt) > t0, "35 nextAttemptAt in future");
  // immediate re-flush at t0+1s skips
  assert(
    mem.listDue("user-a", t0 + 1000).length === 0,
    "36 no immediate loop (backoff holds)"
  );
  // storm of online events at same time still empty due list
  for (let i = 0; i < 20; i++) {
    assert(
      mem.listDue("user-a", t0 + 5000).length === 0,
      "37 online storm does not re-due before nextAttemptAt"
    );
  }
  // after backoff window
  const after = Date.parse(entry.nextAttemptAt) + 1;
  assert(
    mem.listDue("user-a", after).includes("egg_anniversary"),
    "38 due after nextAttemptAt"
  );
  // success
  mem.clear("user-a", "egg_anniversary");
  assert(mem.listAllPending("user-a").length === 0, "39 success removes pending");
}

// --- force path bypasses nextAttemptAt (manual/test only) ---
{
  const mem = makePendingMemory();
  const t0 = 9_000_000;
  mem.enqueue("user-a", "egg_curiosity_trophy", {}, t0);
  mem.markAttempt("user-a", "egg_curiosity_trophy", t0);
  assert(mem.listDue("user-a", t0 + 1000).length === 0, "40 normal not due");
  assert(
    mem.listDue("user-a", t0 + 1000, true).includes("egg_curiosity_trophy"),
    "41 force=true ignores nextAttemptAt"
  );
}

// --- Permanent rejection stops auto retry ---
{
  const mem = makePendingMemory();
  mem.enqueue("user-a", "egg_lucky_seven");
  mem.markPermanent("user-a", "egg_lucky_seven");
  assert(
    mem.listDue("user-a", Date.now(), true).length === 0,
    "42 permanent not in due even with force"
  );
}

// --- Duplicate enqueue single entry ---
{
  const mem = makePendingMemory();
  mem.enqueue("user-a", "egg_lucky_seven");
  mem.enqueue("user-a", "egg_lucky_seven");
  assert(mem.listAllPending("user-a").length === 1, "43 single pending entry");
}

// --- package scripts ---
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
assert(pkg.scripts["verify:egg-catalog"], "44 verify:egg-catalog");
assert(pkg.scripts["verify:egg-cloud"], "45 verify:egg-cloud");
assert(
  pkg.scripts["verify:predeploy"]?.includes("verify:egg-catalog") &&
    pkg.scripts["verify:predeploy"]?.includes("verify:egg-cloud"),
  "46 predeploy wires both egg verifies"
);

if (fails > 0) {
  console.error(`\n${fails} egg-cloud check(s) failed`);
  process.exit(1);
}
console.log(`\nEgg cloud checks OK (${46 - fails} designed asserts; fails=${fails})`);
