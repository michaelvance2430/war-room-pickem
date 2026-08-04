/**
 * Production black-box recorder for Standings → peer profile freezes.
 *
 * Enable (optional kill-switch off):
 *   localStorage.setItem("warroom-profile-nav", "1")  // force on
 *   localStorage.setItem("warroom-profile-nav", "0")  // force off
 * Default: ON for profile navigations (P0 freeze capture).
 *
 * Logs: [WR-PROFILE-NAV][<traceId>] <event> +Nms …
 * No private profile content — ids, timings, network meta only.
 */

import { readLeague, readSession } from "@/lib/session-read";

export type ProfileNavOrigin = "standings-click" | "player-link" | "direct-url" | "unknown";

type Trace = {
  id: string;
  t0: number;
  origin: ProfileNavOrigin;
  targetUserId: string;
  renderCount: number;
  requestCount: number;
  longTaskMax: number;
  longTaskCount: number;
  usable: boolean;
  stopObservers?: () => void;
};

let active: Trace | null = null;
let fetchPatched = false;
let originalFetch: typeof fetch | null = null;

function canUse() {
  return typeof window !== "undefined";
}

/** Default ON; set warroom-profile-nav=0 to silence. */
export function isProfileNavTraceEnabled(): boolean {
  if (!canUse()) return false;
  try {
    const v = localStorage.getItem("warroom-profile-nav");
    if (v === "0" || v === "false") return false;
    if (v === "1" || v === "true") return true;
    // Also on when runtime debug is on
    if (localStorage.getItem("warroom-runtime-debug") === "1") return true;
  } catch {
    /* ok */
  }
  // Default ON — P0 capture until freeze is solved
  return true;
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function elapsed(t: Trace) {
  return Math.round(nowMs() - t.t0);
}

function log(t: Trace, event: string, extra?: string) {
  if (!isProfileNavTraceEnabled()) return;
  const e = extra ? ` ${extra}` : "";
  // eslint-disable-next-line no-console
  console.log(`[WR-PROFILE-NAV][${t.id}] ${event} +${elapsed(t)}ms${e}`);
}

function makeTraceId() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().slice(0, 8);
    }
  } catch {
    /* ok */
  }
  return Math.random().toString(36).slice(2, 10);
}

function contextFields(targetUserId: string) {
  const session = readSession();
  const league = readLeague();
  const me = session?.playerId || null;
  let viewAs = false;
  try {
    // light read — avoid importing league module graph if possible
    viewAs = localStorage.getItem("warroom-view-as-player") === "1";
  } catch {
    /* ok */
  }
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const mem =
    typeof performance !== "undefined"
      ? (
          performance as Performance & {
            memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
          }
        ).memory
      : undefined;

  return {
    authUserId: me ? shortId(me) : "none",
    leagueId: league?.id ? shortId(league.id) : "none",
    targetUserId: shortId(targetUserId),
    isSelf: !!(me && me === targetUserId),
    role: session?.isCommissioner ? "commish" : "player",
    viewAs,
    route: typeof location !== "undefined" ? location.pathname : "?",
    visibility:
      typeof document !== "undefined" ? document.visibilityState : "?",
    ua: nav?.userAgent?.slice(0, 120) || "?",
    standingsWarm: !!(
      (window as unknown as { __wrStandingsWarm?: boolean }).__wrStandingsWarm
    ),
    profileWarm: !!(
      (window as unknown as { __wrProfileChunkWarm?: boolean }).__wrProfileChunkWarm
    ),
    heapMb: mem
      ? Math.round(mem.usedJSHeapSize / (1024 * 1024))
      : null,
  };
}

function installLongTaskObserver(t: Trace) {
  if (typeof PerformanceObserver === "undefined") return () => {};
  try {
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const d = e.duration;
        t.longTaskCount += 1;
        if (d > t.longTaskMax) t.longTaskMax = d;
        const src =
          // attribution is not always present
          (e as PerformanceEntry & { attribution?: { name?: string }[] })
            .attribution?.[0]?.name || "unknown";
        log(
          t,
          "longtask",
          `duration=${Math.round(d)}ms source=${String(src).slice(0, 80)}`
        );
      }
    });
    obs.observe({ entryTypes: ["longtask"] });
    return () => {
      try {
        obs.disconnect();
      } catch {
        /* ok */
      }
    };
  } catch {
    return () => {};
  }
}

function installFetchProbe(t: Trace) {
  if (!canUse() || fetchPatched) return;
  fetchPatched = true;
  originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const tr = active;
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const isProfileRelated =
      !!tr &&
      (url.includes("memberships") ||
        url.includes("profiles") ||
        url.includes("week_results") ||
        url.includes("players") ||
        url.includes(tr.targetUserId));
    if (!tr || !isProfileRelated) {
      return originalFetch!(input, init);
    }
    tr.requestCount += 1;
    const n = tr.requestCount;
    const path = url.replace(/^https?:\/\/[^/]+/, "").slice(0, 120);
    log(tr, "net-start", `#${n} ${path}`);
    const tNet = nowMs();
    try {
      const res = await originalFetch!(input, init);
      log(
        tr,
        "net-end",
        `#${n} status=${res.status} ${Math.round(nowMs() - tNet)}ms ${path}`
      );
      return res;
    } catch (err) {
      log(
        tr,
        "net-fail",
        `#${n} ${Math.round(nowMs() - tNet)}ms ${path} err=${
          err instanceof Error ? err.message : "fail"
        }`
      );
      throw err;
    }
  };
}

/** Mark Standings as warm after interactive — call from standings page once. */
export function markStandingsWarm() {
  if (!canUse()) return;
  try {
    (window as unknown as { __wrStandingsWarm?: boolean }).__wrStandingsWarm =
      true;
  } catch {
    /* ok */
  }
}

/**
 * Start a nav trace from a profile link click (Standings / PlayerLink).
 * Returns trace id.
 */
export function startProfileNavTrace(
  targetUserId: string,
  origin: ProfileNavOrigin = "player-link"
): string | null {
  if (!canUse() || !isProfileNavTraceEnabled()) return null;
  // End previous without usable if abandoned
  if (active && !active.usable) {
    log(active, "abandoned", "new-click");
    active.stopObservers?.();
  }

  const t: Trace = {
    id: makeTraceId(),
    t0: nowMs(),
    origin,
    targetUserId,
    renderCount: 0,
    requestCount: 0,
    longTaskMax: 0,
    longTaskCount: 0,
    usable: false,
  };
  active = t;
  installFetchProbe(t);
  const stopLt = installLongTaskObserver(t);
  t.stopObservers = () => {
    stopLt();
  };

  const ctx = contextFields(targetUserId);
  log(
    t,
    "click",
    `origin=${origin} target=${ctx.targetUserId} self=${ctx.isSelf} auth=${ctx.authUserId} league=${ctx.leagueId}`
  );
  log(
    t,
    "context",
    `role=${ctx.role} viewAs=${ctx.viewAs} vis=${ctx.visibility} standingsWarm=${ctx.standingsWarm} profileWarm=${ctx.profileWarm} heapMb=${ctx.heapMb ?? "n/a"} from=${ctx.route}`
  );
  log(t, "device", `ua=${ctx.ua}`);
  log(t, "nav-start", `href=/profile/${shortId(targetUserId)}`);

  try {
    performance.mark?.(`wr-profile-nav:${t.id}:click`);
  } catch {
    /* ok */
  }

  // Lag sample after 0ms / 1s / 3s
  const lagSample = (label: string) => {
    const a = nowMs();
    setTimeout(() => {
      if (active?.id !== t.id) return;
      const lag = Math.round(nowMs() - a);
      if (lag >= 50) log(t, "event-loop-lag", `${label}=${lag}ms`);
    }, 0);
  };
  lagSample("post-click");
  setTimeout(() => lagSample("t+1s"), 1000);
  setTimeout(() => lagSample("t+3s"), 3000);

  return t.id;
}

/** Direct URL open of /profile/[id] (no prior click). */
export function ensureProfileNavTraceForRoute(targetUserId: string): string | null {
  if (!canUse() || !isProfileNavTraceEnabled()) return null;
  if (active && active.targetUserId === targetUserId && !active.usable) {
    return active.id;
  }
  // Treat as direct if no active click trace for this id in last 5s
  if (
    active &&
    active.targetUserId === targetUserId &&
    nowMs() - active.t0 < 5000
  ) {
    return active.id;
  }
  return startProfileNavTrace(targetUserId, "direct-url");
}

export function profileNavMark(event: string, extra?: string) {
  if (!active || !isProfileNavTraceEnabled()) return;
  log(active, event, extra);
}

/** True when a profile-nav trace is active (for cloud/hydrator hooks). */
export function isProfileNavTraceActive(): boolean {
  return !!(active && isProfileNavTraceEnabled());
}

export function getActiveProfileNavTraceAgeMs(): number {
  if (!active) return -1;
  return Math.round(nowMs() - active.t0);
}

function stackHint(depth = 5): string {
  try {
    return (new Error().stack || "")
      .split("\n")
      .slice(2, 2 + depth)
      .map((s) => s.trim().replace(/\s+/g, " "))
      .join(" ← ")
      .slice(0, 220);
  } catch {
    return "?";
  }
}

/**
 * Synchronous block attribution — name the function that owns the main thread.
 * Usage:
 *   const t0 = profileNavSyncStart("trophy-parse");
 *   ... work ...
 *   profileNavSyncEnd("trophy-parse", t0);
 */
export function profileNavSyncStart(fn: string): number {
  if (!active || !isProfileNavTraceEnabled()) return nowMs();
  log(active, "sync-start", fn);
  try {
    performance.mark?.(`wr-profile-nav:sync-start:${fn}`);
  } catch {
    /* ok */
  }
  return nowMs();
}

export function profileNavSyncEnd(fn: string, t0: number, extra?: string) {
  if (!active || !isProfileNavTraceEnabled()) return;
  const ms = Math.round(nowMs() - t0);
  const e = extra ? ` ${extra}` : "";
  log(active, "sync-end", `${fn} duration=${ms}ms${e}`);
  try {
    performance.mark?.(`wr-profile-nav:sync-end:${fn}`);
  } catch {
    /* ok */
  }
  if (ms >= 50) {
    log(active, "sync-slow", `${fn} duration=${ms}ms${e}`);
  }
}

export function profileNavSync<T>(fn: string, work: () => T): T {
  const t0 = profileNavSyncStart(fn);
  try {
    return work();
  } finally {
    profileNavSyncEnd(fn, t0);
  }
}

/**
 * League-wide work while on profile — tag caller (interval/vis/force/stack).
 */
export function profileNavLeagueWork(
  fn: string,
  reason: string,
  extra?: string
) {
  if (!isProfileNavTraceEnabled()) return;
  let path = "?";
  try {
    path = typeof location !== "undefined" ? location.pathname : "?";
  } catch {
    /* ok */
  }
  const onProfile = path.startsWith("/profile");
  // Always log when a profile nav trace is active OR work runs on /profile
  if (!active && !onProfile) return;
  if (!active && onProfile) {
    // orphan league work on profile without click trace
    // eslint-disable-next-line no-console
    console.log(
      `[WR-PROFILE-NAV][orphan] league-work ${fn} reason=${reason} path=${path}${
        extra ? ` ${extra}` : ""
      } stack=${stackHint()}`
    );
    return;
  }
  if (!active) return;
  log(
    active,
    "league-work",
    `fn=${fn} reason=${reason} path=${path} age=${elapsed(active)}ms${
      extra ? ` ${extra}` : ""
    } stack=${stackHint()}`
  );
}

export function profileNavRouteCommit(pathname: string) {
  if (!pathname?.startsWith("/profile")) return;
  const id = pathname.split("/")[2] || "";
  if (!active) {
    ensureProfileNavTraceForRoute(id);
  }
  if (!active) return;
  log(active, "route-commit", `path=${pathname}`);
  try {
    (
      window as unknown as { __wrProfileChunkWarm?: boolean }
    ).__wrProfileChunkWarm = true;
  } catch {
    /* ok */
  }
}

export function profileNavRender() {
  if (!active) return;
  active.renderCount += 1;
  if (active.renderCount <= 3 || active.renderCount % 5 === 0) {
    log(active, "render", `n=${active.renderCount}`);
  }
}

export function profileNavMount(targetUserId: string) {
  if (!active) {
    ensureProfileNavTraceForRoute(targetUserId);
  }
  profileNavMark("profile-mount", `id=${shortId(targetUserId)}`);
}

export function profileNavIdentityStart(extra?: string) {
  profileNavMark("identity-start", extra);
}

export function profileNavIdentityEnd(extra?: string) {
  profileNavMark("identity-end", extra);
}

export function profileNavUsable(extra?: string) {
  if (!active || active.usable) return;
  active.usable = true;
  log(
    active,
    "usable",
    `${extra || ""} renders=${active.renderCount} requests=${active.requestCount} longtasks=${active.longTaskCount} maxLt=${Math.round(active.longTaskMax)}ms`.trim()
  );
  // Keep longtask observer long enough for post-usable freezes (Mike: 83s after usable)
  const t = active;
  setTimeout(() => {
    if (active?.id === t.id) {
      log(
        t,
        "trace-summary",
        `origin=${t.origin} maxLt=${Math.round(t.longTaskMax)}ms ltCount=${t.longTaskCount} renders=${t.renderCount} requests=${t.requestCount}`
      );
    }
  }, 4000);
  setTimeout(() => {
    if (active?.id === t.id) {
      log(
        t,
        "trace-summary-late",
        `origin=${t.origin} maxLt=${Math.round(t.longTaskMax)}ms ltCount=${t.longTaskCount} renders=${t.renderCount} requests=${t.requestCount}`
      );
      t.stopObservers?.();
    }
  }, 120_000);
}

export function getActiveProfileNavTraceId(): string | null {
  return active?.id ?? null;
}

// ── loadLeaguePlayers CALL GRAPH (feedback-loop detector) ─────────────────
// Not a timing trace — answers: who keeps calling loadLeaguePlayers?

type LlpNode = {
  seq: number;
  at: number;
  kind: "cache-hit" | "inflight" | "network";
  caller: string;
  stack: string;
  path: string;
  chainedFrom: number | null;
  msSincePrev: number;
  inflightDepth: number;
};

let llpSeq = 0;
let llpInflightDepth = 0;
let llpLastSeq = 0;
let llpLastAt = 0;
let llpLastEndSeq = 0;
let llpLastEndAt = 0;
const llpRecent: LlpNode[] = [];
const LLP_CHAIN_MS = 80; // if re-entered this soon after prior end → treat as chain

function appStackFrames(max = 8): string {
  try {
    const lines = (new Error().stack || "").split("\n").slice(2);
    const app = lines
      .map((s) => s.trim())
      .filter(
        (s) =>
          /war-room|war_room|src[/\\]|app[/\\]|components[/\\]|lib[/\\]/i.test(
            s
          ) ||
          (!/node_modules|webpack-internal|react-dom|scheduler/i.test(s) &&
            s.includes("at "))
      )
      .slice(0, max);
    return (app.length ? app : lines.slice(0, 4))
      .map((s) => s.replace(/\s+/g, " ").slice(0, 100))
      .join(" ← ");
  } catch {
    return "?";
  }
}

function inferCallerFromStack(stack: string): string {
  // Prefer first named function that is not loadLeaguePlayers itself
  const parts = stack.split(" ← ");
  for (const p of parts) {
    const m =
      p.match(/at\s+([A-Za-z0-9_$.]+)/) ||
      p.match(/([A-Za-z0-9_]+)\s*\(/);
    if (!m) continue;
    const name = m[1];
    if (/loadLeaguePlayers|profileNav|Object\.|async/i.test(name)) continue;
    return name;
  }
  return "unknown";
}

/**
 * Log one loadLeaguePlayers entry for call-graph reconstruction.
 * Returns seq so the callee can log end + chain.
 */
export function logLoadLeaguePlayersCall(kind: LlpNode["kind"], extra?: string): number {
  if (!canUse() || !isProfileNavTraceEnabled()) return -1;
  // Always log LLP graph when on /profile OR profile-nav active
  let path = "?";
  try {
    path = location.pathname || "?";
  } catch {
    /* ok */
  }
  const onProfile = path.startsWith("/profile");
  if (!onProfile && !active) return -1;

  const seq = ++llpSeq;
  const now = nowMs();
  const stack = appStackFrames(10);
  const caller = inferCallerFromStack(stack);
  const msSincePrev = llpLastAt ? Math.round(now - llpLastAt) : -1;
  // Chained if we re-enter soon after a prior call *ended* (completion → re-fire)
  const chainedFrom =
    llpLastEndAt && now - llpLastEndAt < LLP_CHAIN_MS
      ? llpLastEndSeq
      : llpLastAt && now - llpLastAt < LLP_CHAIN_MS
        ? llpLastSeq
        : null;

  llpInflightDepth += 1;
  const node: LlpNode = {
    seq,
    at: now,
    kind,
    caller,
    stack: stack.slice(0, 400),
    path,
    chainedFrom,
    msSincePrev,
    inflightDepth: llpInflightDepth,
  };
  llpRecent.push(node);
  if (llpRecent.length > 80) llpRecent.shift();
  llpLastSeq = seq;
  llpLastAt = now;

  const tid = active?.id || "llp";
  const chain =
    chainedFrom != null ? ` chainedFrom=#${chainedFrom}` : " chainedFrom=none";
  // eslint-disable-next-line no-console
  console.log(
    `[WR-LLP-GRAPH][${tid}] #${seq} kind=${kind} caller=${caller}${chain} msSincePrev=${msSincePrev} depth=${llpInflightDepth} path=${path}${
      extra ? ` ${extra}` : ""
    }`
  );
  // eslint-disable-next-line no-console
  console.log(`[WR-LLP-GRAPH][${tid}] #${seq} stack ${stack.slice(0, 350)}`);

  // Burst warning: >15 calls in 2s
  const windowStart = now - 2000;
  const burst = llpRecent.filter((n) => n.at >= windowStart).length;
  if (burst === 15 || burst === 30 || burst === 50) {
    // eslint-disable-next-line no-console
    console.log(
      `[WR-LLP-GRAPH][${tid}] BURST ${burst} calls in 2s — likely feedback loop. Top callers: ${summarizeLlpCallers(windowStart)}`
    );
  }

  return seq;
}

export function logLoadLeaguePlayersEnd(seq: number, kind: string, extra?: string) {
  if (seq < 0) return;
  llpInflightDepth = Math.max(0, llpInflightDepth - 1);
  llpLastEndSeq = seq;
  llpLastEndAt = nowMs();
  if (!canUse() || !isProfileNavTraceEnabled()) return;
  const tid = active?.id || "llp";
  // eslint-disable-next-line no-console
  console.log(
    `[WR-LLP-GRAPH][${tid}] #${seq} END kind=${kind} depth=${llpInflightDepth}${
      extra ? ` ${extra}` : ""
    }`
  );
}

function summarizeLlpCallers(since: number): string {
  const counts = new Map<string, number>();
  for (const n of llpRecent) {
    if (n.at < since) continue;
    counts.set(n.caller, (counts.get(n.caller) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([c, n]) => `${c}×${n}`)
    .join(", ");
}

export function logPlayersCacheInvalidate(reason: string) {
  if (!canUse() || !isProfileNavTraceEnabled()) return;
  let path = "?";
  try {
    path = location.pathname || "?";
  } catch {
    /* ok */
  }
  if (!path.startsWith("/profile") && !active) return;
  const tid = active?.id || "llp";
  // eslint-disable-next-line no-console
  console.log(
    `[WR-LLP-GRAPH][${tid}] CACHE-INVALIDATE reason=${reason} path=${path} stack=${appStackFrames(6)}`
  );
}
