/**
 * Event-loop starvation probe (diagnosis only).
 *
 * Enable:
 *   localStorage.setItem("warroom-runtime-debug", "1")
 *   hard refresh
 *
 * Logs:
 *   [WR-PERF][longtask]   — tasks > 100ms (PerformanceObserver)
 *   [WR-PERF][timer-lag]  — setInterval drift (timer fired late)
 *   [WR-PERF][timeline]   — manual marks (nav / timeout late)
 *
 * Goal: prove main-thread blocks so a 6s withTimeout fires at 25–30s wall clock.
 */

const DEBUG_KEY = "warroom-runtime-debug";

function enabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(DEBUG_KEY) === "1") return true;
  } catch {
    /* ok */
  }
  return process.env.NODE_ENV === "development";
}

function log(tag: string, msg: string, extra?: unknown) {
  if (!enabled()) return;
  try {
    if (extra !== undefined) console.log(`[WR-PERF][${tag}] ${msg}`, extra);
    else console.log(`[WR-PERF][${tag}] ${msg}`);
  } catch {
    /* ok */
  }
}

let installed = false;
let lastIntervalAt = 0;
let lagTimer: number | undefined;
let longTaskObs: PerformanceObserver | null = null;

/** Call once from client shell (SmoothRuntime). Idempotent. */
export function installEventLoopProbe(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  // Always arm when module loads on client; logs only if enabled()
  try {
    if (typeof PerformanceObserver !== "undefined") {
      // longtask is Chromium-only; silently skip elsewhere
      longTaskObs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.duration < 100) continue;
          const any = e as PerformanceEntry & {
            attribution?: {
              name?: string;
              containerType?: string;
              containerSrc?: string;
              containerId?: string;
            }[];
          };
          const attr = any.attribution?.[0];
          const attrBits = [
            attr?.name,
            attr?.containerType,
            attr?.containerSrc,
            attr?.containerId,
          ]
            .filter(Boolean)
            .join(" ");
          // Correlate with last profile-route marks (pre-render freeze)
          let lastMark = "";
          try {
            const marks = performance.getEntriesByType("mark");
            for (let i = marks.length - 1; i >= 0; i--) {
              if (marks[i].name.startsWith("wr-profile-route:")) {
                lastMark = marks[i].name.replace("wr-profile-route:", "");
                break;
              }
            }
          } catch {
            /* ok */
          }
          log(
            "longtask",
            `${Math.round(e.duration)}ms @${Math.round(e.startTime)} ${attrBits}${lastMark ? ` after=${lastMark}` : ""}`.trim()
          );
        }
      });
      try {
        longTaskObs.observe({ entryTypes: ["longtask"] as string[] });
        log("timeline", "longtask observer ON");
      } catch {
        // Safari/Firefox may not support longtask
        try {
          longTaskObs.observe({ type: "longtask", buffered: true } as PerformanceObserverInit);
          log("timeline", "longtask observer ON (type)");
        } catch {
          log("timeline", "longtask observer UNSUPPORTED — use timer-lag only");
        }
      }
    }
  } catch {
    /* ok */
  }

  // Timer lag: if event loop is starved, interval ticks arrive late
  lastIntervalAt = performance.now();
  lagTimer = window.setInterval(() => {
    if (!enabled()) {
      lastIntervalAt = performance.now();
      return;
    }
    const now = performance.now();
    const gap = now - lastIntervalAt;
    lastIntervalAt = now;
    // Expected ~1000ms; if > 1500 main thread blocked between ticks
    if (gap > 1500) {
      log(
        "timer-lag",
        `interval gap ${Math.round(gap)}ms (expected ~1000) — event loop starved ~${Math.round(gap - 1000)}ms`
      );
    }
  }, 1000) as unknown as number;

  // Observe script/chunk downloads (profile route attribution)
  try {
    const resObs = new PerformanceObserver((list) => {
      if (!enabled()) return;
      for (const e of list.getEntries()) {
        const re = e as PerformanceResourceTiming;
        const name = re.name || "";
        if (!/chunk|profile|_next\/static/i.test(name)) continue;
        if (re.duration < 50 && re.transferSize === 0) continue;
        const isProfile =
          /profile/i.test(name) ||
          /\/1522|page-.*profile/i.test(name);
        if (!isProfile && re.duration < 200) continue;
        log(
          "chunk",
          `${Math.round(re.duration)}ms ${isProfile ? "PROFILE " : ""}${name.split("/").slice(-2).join("/")} transfer=${re.transferSize || 0}`
        );
      }
    });
    resObs.observe({ type: "resource", buffered: true });
    log("timeline", "resource/chunk observer ON");
  } catch {
    /* ok */
  }

  try {
    (window as unknown as { __WR_EVENT_LOOP__?: unknown }).__WR_EVENT_LOOP__ = {
      longTasks: () =>
        performance
          .getEntriesByType("longtask" as "mark")
          .map((e) => ({ name: e.name, start: e.startTime, duration: e.duration })),
      help: () =>
        console.log(`
[WR-PERF] Event loop probe
  localStorage warroom-runtime-debug=1
  [WR-PERF][longtask]  — blocking tasks >100ms
  [WR-PERF][timer-lag] — setInterval late (starvation)
  [WR-PERF][prep-nav]  — prepareNavigation start/finish
  [WR-PERF][timeout-late] — withTimeout fired late vs limit
`),
    };
  } catch {
    /* ok */
  }
}

export function wrTimeline(msg: string, extra?: unknown) {
  log("timeline", msg, extra);
}

/** Log when a coded timeout fires much later than its limit (event-loop starvation). */
export function wrTimeoutLate(label: string, limitMs: number, actualMs: number) {
  if (actualMs <= limitMs * 1.25) return;
  log(
    "timeout-late",
    `${label} limit=${limitMs}ms actual=${actualMs}ms LATE_BY=${actualMs - limitMs}ms`
  );
}
