/**
 * Development isolation flags + freeze diagnostics for Problem Group 1.
 *
 * ENABLE DIAGNOSTICS (browser console):
 *   localStorage.setItem("warroom-runtime-debug", "1")
 *
 * DISABLE SYSTEMS (browser console), then hard refresh:
 *   localStorage.setItem("warroom-iso", JSON.stringify({
 *     deferred: false,   // A RoomDeferredChrome entirely
 *     navProgressive: false, // B Nav progressive/unseen
 *     wave1: false,      // C
 *     wave2: false,      // D
 *     realtime: false,   // E (pages that check this)
 *     themeDecor: false, // F (layout theme chrome)
 *     smoothPrep: false, // G prepareNavigation + SmoothRuntime extras
 *     smoothPrefetch: false,
 *     smoothPulse: false,
 *   }))
 *
 * RESET:
 *   localStorage.removeItem("warroom-iso")
 *   localStorage.removeItem("warroom-runtime-debug")
 *
 * Production: no logs unless warroom-runtime-debug is set (opt-in).
 * Flags default to all enabled (normal product behavior).
 */

export type IsoFlags = {
  deferred: boolean;
  navProgressive: boolean;
  wave1: boolean;
  wave2: boolean;
  realtime: boolean;
  themeDecor: boolean;
  smoothPrep: boolean;
  smoothPrefetch: boolean;
  smoothPulse: boolean;
};

const DEFAULTS: IsoFlags = {
  deferred: true,
  navProgressive: true,
  wave1: true,
  wave2: true,
  realtime: true,
  themeDecor: true,
  smoothPrep: true,
  smoothPrefetch: true,
  smoothPulse: true,
};

const ISO_KEY = "warroom-iso";
const DEBUG_KEY = "warroom-runtime-debug";

function canUse() {
  return typeof window !== "undefined";
}

export function isRuntimeDebug(): boolean {
  if (!canUse()) return false;
  try {
    if (localStorage.getItem(DEBUG_KEY) === "1") return true;
  } catch {
    /* ok */
  }
  // Never spam production users
  return process.env.NODE_ENV === "development";
}

export function getIsoFlags(): IsoFlags {
  if (!canUse()) return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(ISO_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<IsoFlags>;
    return { ...DEFAULTS, ...p };
  } catch {
    return { ...DEFAULTS };
  }
}

export function isoEnabled(key: keyof IsoFlags): boolean {
  return getIsoFlags()[key] !== false;
}

// ── Counters ─────────────────────────────────────────────────────────────

const counters: Record<string, number> = {};
const activeTimers = new Set<number>();
const activeIntervals = new Set<number>();
let listenerCount = 0;
let bodyLockTracked = 0;

export function wrCount(key: string, by = 1): number {
  counters[key] = (counters[key] || 0) + by;
  return counters[key];
}

export function wrGetCounters(): Record<string, number> {
  return { ...counters, listenerCount, bodyLockTracked, activeTimers: activeTimers.size, activeIntervals: activeIntervals.size };
}

export function wrLog(prefix: string, msg: string, extra?: unknown) {
  if (!isRuntimeDebug()) return;
  if (extra !== undefined) {
    console.log(`${prefix} ${msg}`, extra);
  } else {
    console.log(`${prefix} ${msg}`);
  }
}

/** Mount/unmount tracking for a named component */
export function wrMount(name: string) {
  const n = wrCount(`mount:${name}`);
  wrLog("[WR-RUNTIME]", `mount ${name} (#${n})`);
  return () => {
    wrCount(`unmount:${name}`);
    wrLog("[WR-RUNTIME]", `unmount ${name}`);
  };
}

export function wrEffect(name: string) {
  const n = wrCount(`effect:${name}`);
  wrLog("[WR-RUNTIME]", `effect ${name} (#${n})`);
}

export function wrRoute(pathname: string | null) {
  wrCount("route-change");
  wrLog("[WR-NAV]", `route → ${pathname}`);
}

export function wrBodyLock(delta: number, reason: string) {
  bodyLockTracked = Math.max(0, bodyLockTracked + delta);
  wrCount(delta > 0 ? "body-lock" : "body-unlock");
  wrLog("[WR-BODYLOCK]", `${delta > 0 ? "+" : ""}${delta} → ${bodyLockTracked} (${reason})`);
}

export function wrModal(msg: string, extra?: unknown) {
  wrLog("[WR-MODAL]", msg, extra);
}

export function wrDeferred(msg: string, extra?: unknown) {
  wrLog("[WR-DEFERRED]", msg, extra);
}

/** Wrap setInterval for tracking (optional use) */
export function wrSetInterval(fn: () => void, ms: number, label: string): number {
  wrCount(`interval-create:${label}`);
  const id = window.setInterval(() => {
    wrCount(`interval-tick:${label}`);
    fn();
  }, ms) as unknown as number;
  activeIntervals.add(id);
  wrLog("[WR-RUNTIME]", `setInterval ${label} ${ms}ms id=${id}`);
  return id;
}

export function wrClearInterval(id: number, label: string) {
  window.clearInterval(id);
  activeIntervals.delete(id);
  wrCount(`interval-clear:${label}`);
  wrLog("[WR-RUNTIME]", `clearInterval ${label} id=${id}`);
}

/** Expose snapshot for console: window.__WR_RUNTIME__ */
export function installRuntimeDebugGlobals() {
  if (!canUse() || !isRuntimeDebug()) return;
  try {
    (window as unknown as { __WR_RUNTIME__: unknown }).__WR_RUNTIME__ = {
      counters: () => wrGetCounters(),
      flags: () => getIsoFlags(),
      help: () =>
        console.log(`
[WR] Isolation: localStorage warroom-iso JSON
[WR] Debug: localStorage warroom-runtime-debug = "1"
[WR] window.__WR_RUNTIME__.counters()
[WR] window.__WR_RUNTIME__.flags()
`),
    };
    wrLog("[WR-RUNTIME]", "debug globals installed — __WR_RUNTIME__.help()");
  } catch {
    /* ok */
  }
}
