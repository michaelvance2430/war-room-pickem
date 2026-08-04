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
  // Keep longtask observer a bit longer for post-usable freezes
  const t = active;
  setTimeout(() => {
    if (active?.id === t.id) {
      log(
        t,
        "trace-summary",
        `origin=${t.origin} maxLt=${Math.round(t.longTaskMax)}ms ltCount=${t.longTaskCount} renders=${t.renderCount} requests=${t.requestCount}`
      );
      t.stopObservers?.();
    }
  }, 4000);
}

export function getActiveProfileNavTraceId(): string | null {
  return active?.id ?? null;
}
