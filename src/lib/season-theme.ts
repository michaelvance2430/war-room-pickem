/**
 * Season / holiday atmosphere skins.
 *
 * PRODUCT RULE (non-negotiable):
 *   Skins are atmosphere controlled by War Room, not customization by users.
 *   No commissioner, player, owner, or settings path may select a skin.
 *
 * CFB resolution order:
 *   1. Active holiday window (America/New_York, 3 calendar days)
 *   2. Current CFB season phase from trusted live week
 *   3. Opening-season fallback
 *
 * NFL / other sports: holiday override only, else pack default (no CFB campus skins).
 *
 * Creator-only local preview may temporarily force a skin for Mike’s inspection.
 * Never writes league configuration. Never a product preference.
 *
 * Tech: `data-sport` = pack default · `data-season-theme` = automatic wash
 *
 * Stored leagues.season_theme_id / settings.seasonThemeId may still exist in DB
 * from the old picker era — ignored in active resolution (cleanup optional).
 */

import { getLeague } from "@/lib/league";

export type SeasonThemeId =
  | "default"
  | "cfb_saturday" // Opening Season (visual system)
  | "cfb_night_lights" // The Grind
  | "cfb_rivalry" // Championship Run
  | "halloween"
  | "thanksgiving"
  | "christmas"
  | "newyear";

/** Product-facing CFB season skin names */
export type CfbSeasonSkinLabel =
  | "Opening Season"
  | "The Grind"
  | "Championship Run";

export type SeasonThemePreset = {
  id: SeasonThemeId;
  label: string;
  blurb: string;
  sportOnly?: "cfb" | "nfl" | "soccer_wwc";
  holiday?: boolean;
  /** CFB automatic season phase (not user-pickable) */
  cfbSeasonPhase?: CfbSeasonSkinLabel;
};

export const DEFAULT_SEASON_THEME_ID: SeasonThemeId = "default";

/**
 * Catalog for labels / CSS / holiday props.
 * Not a product picker catalog.
 */
export const SEASON_THEME_PRESETS: SeasonThemePreset[] = [
  {
    id: "default",
    label: "War Room Colors",
    blurb: "Classic clubhouse pack default.",
  },
  {
    id: "cfb_saturday",
    label: "Opening Season",
    blurb: "CFB weeks 0–6 — campus is waking up.",
    sportOnly: "cfb",
    cfbSeasonPhase: "Opening Season",
  },
  {
    id: "cfb_night_lights",
    label: "The Grind",
    blurb: "CFB weeks 7–13 — midseason weight.",
    sportOnly: "cfb",
    cfbSeasonPhase: "The Grind",
  },
  {
    id: "cfb_rivalry",
    label: "Championship Run",
    blurb: "CFB week 14+ and postseason — every game matters louder.",
    sportOnly: "cfb",
    cfbSeasonPhase: "Championship Run",
  },
  {
    id: "halloween",
    label: "Halloween 🎃",
    blurb: "Auto Oct 30–Nov 1 (ET).",
    holiday: true,
  },
  {
    id: "thanksgiving",
    label: "Thanksgiving 🦃",
    blurb: "Auto Wed–Fri of Thanksgiving week (ET).",
    holiday: true,
  },
  {
    id: "christmas",
    label: "Christmas 🎄",
    blurb: "Auto Dec 24–26 (ET).",
    holiday: true,
  },
  {
    id: "newyear",
    label: "New Year ✨",
    blurb: "Auto Dec 31–Jan 2 (ET).",
    holiday: true,
  },
];

const HOLIDAY_IDS = new Set(
  SEASON_THEME_PRESETS.filter((p) => p.holiday).map((p) => p.id)
);

const CFB_SKIN_IDS = new Set(
  SEASON_THEME_PRESETS.filter((p) => p.sportOnly === "cfb").map((p) => p.id)
);

export function isHolidayThemeId(id: string | null | undefined): boolean {
  return !!id && HOLIDAY_IDS.has(id as SeasonThemeId);
}

export function isCfbRoomSkinId(id: string | null | undefined): boolean {
  return !!id && CFB_SKIN_IDS.has(id as SeasonThemeId);
}

export function isSeasonThemeId(v: unknown): v is SeasonThemeId {
  return typeof v === "string" && SEASON_THEME_PRESETS.some((p) => p.id === v);
}

/** Validate id only — does not honor user storage as truth. */
export function resolveSeasonThemeId(
  raw: string | null | undefined
): SeasonThemeId {
  return isSeasonThemeId(raw) ? raw : DEFAULT_SEASON_THEME_ID;
}

/**
 * @deprecated Product picker removed. Kept as empty/no-op list for any stale import.
 */
export function seasonThemePresetsForSport(
  _sportId?: string | null
): SeasonThemePreset[] {
  return [];
}

export function resolveSeasonThemeIdForSport(
  raw: string | null | undefined,
  sportId?: string | null
): SeasonThemeId {
  const id = resolveSeasonThemeId(raw);
  if (isCfbRoomSkinId(id) && (sportId || "cfb") !== "cfb") {
    return DEFAULT_SEASON_THEME_ID;
  }
  return id;
}

export const SEASON_THEME_EVENT = "warroom-season-theme";
/** Fired when creator sim applies or resets (local only). */
export const CREATOR_SKIN_SIM_EVENT = "warroom-creator-skin-sim";

const ET = "America/New_York";

/** Browser-only sim state (creator). Not a product preference. */
export const CREATOR_SKIN_SIM_KEY = "warroom-creator-skin-sim-v1";

// ── Eastern Time calendar helpers ──────────────────────────────────────

type EtYmd = { year: number; month: number; day: number };

function etYmd(now: Date): EtYmd {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

function inInclusiveRange(
  now: EtYmd,
  start: EtYmd,
  end: EtYmd
): boolean {
  // Cross-year: Dec 31 – Jan 2
  if (start.year === end.year) {
    if (now.year !== start.year) return false;
    const n = now.month * 100 + now.day;
    const a = start.month * 100 + start.day;
    const b = end.month * 100 + end.day;
    return n >= a && n <= b;
  }
  // spans year boundary
  if (now.year === start.year) {
    const n = now.month * 100 + now.day;
    const a = start.month * 100 + start.day;
    return n >= a;
  }
  if (now.year === end.year) {
    const n = now.month * 100 + now.day;
    const b = end.month * 100 + end.day;
    return n <= b;
  }
  return false;
}

/** Fourth Thursday in November (US Thanksgiving), Eastern calendar. */
export function thanksgivingThursdayEt(year: number): EtYmd {
  // Find first day of November, then first Thursday, then +3 weeks
  // Use noon UTC on the 1st and walk with ET formatter
  for (let day = 1; day <= 30; day++) {
    const probe = new Date(Date.UTC(year, 10, day, 17, 0, 0)); // ~noon ET-ish
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: ET,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(probe);
    const wd = parts.find((p) => p.type === "weekday")?.value;
    const m = Number(parts.find((p) => p.type === "month")?.value);
    const d = Number(parts.find((p) => p.type === "day")?.value);
    const y = Number(parts.find((p) => p.type === "year")?.value);
    if (wd === "Thu" && m === 11 && d >= 22 && d <= 28) {
      return { year: y, month: 11, day: d };
    }
  }
  // Fallback classic: Nov 22–28 Thursday
  return { year, month: 11, day: 25 };
}

/**
 * Holiday override — exactly 3 Eastern calendar days
 * (day before · holiday · day after).
 */
export function resolveHolidaySkinInEasternTime(
  now: Date = new Date()
): SeasonThemeId | null {
  const y = etYmd(now);

  // Halloween: Oct 30 – Nov 1
  if (
    inInclusiveRange(
      y,
      { year: y.year, month: 10, day: 30 },
      { year: y.year, month: 11, day: 1 }
    )
  ) {
    return "halloween";
  }

  // Christmas: Dec 24 – Dec 26
  if (
    inInclusiveRange(
      y,
      { year: y.year, month: 12, day: 24 },
      { year: y.year, month: 12, day: 26 }
    )
  ) {
    return "christmas";
  }

  // New Year: Dec 31 – Jan 2
  if (
    inInclusiveRange(
      y,
      { year: y.year, month: 12, day: 31 },
      { year: y.year + 1, month: 1, day: 2 }
    ) ||
    inInclusiveRange(
      y,
      { year: y.year - 1, month: 12, day: 31 },
      { year: y.year, month: 1, day: 2 }
    )
  ) {
    return "newyear";
  }

  // Thanksgiving: Wed–Fri around 4th Thursday in November
  const thu = thanksgivingThursdayEt(y.year);
  const wed = { year: thu.year, month: 11, day: thu.day - 1 };
  const fri = { year: thu.year, month: 11, day: thu.day + 1 };
  if (inInclusiveRange(y, wed, fri)) {
    return "thanksgiving";
  }

  return null;
}

/**
 * CFB season phase from trusted live week.
 * Weeks 0–6 Opening · 7–13 Grind · 14+ Championship Run
 */
export function resolveCfbSeasonSkin(
  trustedWeek: number | null | undefined
): SeasonThemeId {
  if (trustedWeek == null || Number.isNaN(Number(trustedWeek))) {
    return "cfb_saturday"; // opening-season fallback
  }
  const w = Number(trustedWeek);
  if (w <= 6) return "cfb_saturday";
  if (w <= 13) return "cfb_night_lights";
  return "cfb_rivalry";
}

export function cfbSeasonSkinLabel(id: SeasonThemeId): CfbSeasonSkinLabel | null {
  const p = SEASON_THEME_PRESETS.find((x) => x.id === id);
  return p?.cfbSeasonPhase || null;
}

/**
 * Authoritative CFB skin resolver.
 * Holiday ET → season phase → opening fallback.
 * User preference never participates.
 */
export function resolveCfbSkin(input: {
  trustedWeek: number | null;
  now?: Date;
}): SeasonThemeId {
  const holiday = resolveHolidaySkinInEasternTime(input.now ?? new Date());
  if (holiday) return holiday;
  return resolveCfbSeasonSkin(input.trustedWeek);
}

// ── Creator sim (Mike only) — real resolver, fake clock/week ───────────

export type CreatorSkinSimState = {
  /** When true, production resolver uses simulated ET wall + week */
  active: boolean;
  /** YYYY-MM-DD Eastern wall date */
  etDate: string;
  /** HH:mm Eastern wall time */
  etTime: string;
  /** Simulated trusted CFB week (0–20) */
  week: number;
};

function assertCreator(userId?: string | null): boolean {
  try {
    const { isAppCreator } = require("./creator") as typeof import("./creator");
    const { getSession } = require("./league") as typeof import("./league");
    const uid = userId ?? getSession()?.playerId;
    return isAppCreator(uid);
  } catch {
    return false;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a Date as Eastern wall YYYY-MM-DD and HH:mm. */
export function formatEasternWall(now: Date = new Date()): {
  etDate: string;
  etTime: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value || "2026";
  const m = parts.find((p) => p.type === "month")?.value || "01";
  const d = parts.find((p) => p.type === "day")?.value || "01";
  const h = parts.find((p) => p.type === "hour")?.value || "12";
  const mi = parts.find((p) => p.type === "minute")?.value || "00";
  return { etDate: `${y}-${m}-${d}`, etTime: `${pad2(Number(h))}:${pad2(Number(mi))}` };
}

/**
 * Build a Date whose America/New_York wall clock matches etDate + etTime.
 * Used so holiday windows resolve identically for every viewer.
 */
export function dateFromEasternWallClock(
  etDate: string,
  etTime: string
): Date {
  const [ys, ms, ds] = etDate.split("-");
  const [hs, mis] = etTime.split(":");
  const Y = Number(ys);
  const M = Number(ms);
  const D = Number(ds);
  const h = Number(hs);
  const mi = Number(mis || "0");
  if (![Y, M, D, h, mi].every((n) => Number.isFinite(n))) {
    return new Date();
  }
  const target = `${Y}-${pad2(M)}-${pad2(D)} ${pad2(h)}:${pad2(mi)}`;
  // Search a 48h UTC window around the calendar day
  let lo = Date.UTC(Y, M - 1, D - 1, 0, 0, 0);
  let hi = Date.UTC(Y, M - 1, D + 2, 0, 0, 0);
  const fmt = (ms: number) => {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: ET,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms));
    const y = p.find((x) => x.type === "year")?.value;
    const mo = p.find((x) => x.type === "month")?.value;
    const d = p.find((x) => x.type === "day")?.value;
    const hr = p.find((x) => x.type === "hour")?.value;
    const mn = p.find((x) => x.type === "minute")?.value;
    return `${y}-${mo}-${d} ${pad2(Number(hr))}:${pad2(Number(mn))}`;
  };
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fmt(mid) < target) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo);
}

export function getCreatorSkinSim(
  userId?: string | null
): CreatorSkinSimState | null {
  if (typeof window === "undefined") return null;
  if (!assertCreator(userId)) return null;
  try {
    const raw = localStorage.getItem(CREATOR_SKIN_SIM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreatorSkinSimState;
    if (!parsed || !parsed.active) return null;
    if (typeof parsed.etDate !== "string" || typeof parsed.etTime !== "string")
      return null;
    const week = Number(parsed.week);
    if (!Number.isFinite(week)) return null;
    return {
      active: true,
      etDate: parsed.etDate,
      etTime: parsed.etTime,
      week: Math.max(0, Math.min(20, Math.floor(week))),
    };
  } catch {
    return null;
  }
}

function emitSimEvent() {
  try {
    window.dispatchEvent(new CustomEvent(CREATOR_SKIN_SIM_EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * Apply creator sim (local only). No-op if not creator.
 * Does not touch DB / league settings / other users.
 */
export function setCreatorSkinSim(
  state: Omit<CreatorSkinSimState, "active"> | null,
  userId?: string | null
): void {
  if (typeof window === "undefined") return;
  if (!assertCreator(userId)) return;
  try {
    if (!state) {
      localStorage.removeItem(CREATOR_SKIN_SIM_KEY);
    } else {
      const next: CreatorSkinSimState = {
        active: true,
        etDate: state.etDate,
        etTime: state.etTime,
        week: Math.max(0, Math.min(20, Math.floor(Number(state.week) || 0))),
      };
      localStorage.setItem(CREATOR_SKIN_SIM_KEY, JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
  emitSimEvent();
}

/** Clear sim and repaint from real time + trusted live week. */
export async function resetCreatorSkinSimToReal(
  userId?: string | null
): Promise<SeasonThemeId> {
  setCreatorSkinSim(null, userId);
  return paintAutomaticSeasonTheme();
}

export function seasonThemeDisplayName(id: SeasonThemeId): string {
  return SEASON_THEME_PRESETS.find((p) => p.id === id)?.label || id;
}

/** Indicator line for active sim, or null. */
export function creatorSkinSimIndicatorLine(
  userId?: string | null
): string | null {
  const sim = getCreatorSkinSim(userId);
  if (!sim) return null;
  const now = dateFromEasternWallClock(sim.etDate, sim.etTime);
  const id = resolveCfbSkin({ trustedWeek: sim.week, now });
  const name = seasonThemeDisplayName(id);
  // Human date: "Oct 31"
  const [, m, d] = sim.etDate.split("-").map(Number);
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dateLabel = `${monthNames[(m || 1) - 1]} ${d}`;
  return `${dateLabel} · CFB Week ${sim.week} · ${name}`;
}

/**
 * Peek resolved skin for form controls (no paint).
 * Uses production resolveCfbSkin path.
 */
export function peekResolvedCfbSkin(input: {
  etDate: string;
  etTime: string;
  week: number;
}): { id: SeasonThemeId; label: string; now: Date } {
  const now = dateFromEasternWallClock(input.etDate, input.etTime);
  const id = resolveCfbSkin({
    trustedWeek: input.week,
    now,
  });
  return { id, label: seasonThemeDisplayName(id), now };
}

/** Console recovery — wired on client mount. */
export function installCreatorSkinConsoleRecovery(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & {
    __wrResetSkinPreview?: () => Promise<void>;
    __wrSkinPreviewHelp?: () => void;
  };
  w.__wrResetSkinPreview = async () => {
    await resetCreatorSkinSimToReal();
    // eslint-disable-next-line no-console
    console.info("[War Room] Skin preview reset to real time.");
  };
  w.__wrSkinPreviewHelp = () => {
    // eslint-disable-next-line no-console
    console.info(
      "[War Room] Creator skin preview: Foundry Hub → Skin tester. Recovery: __wrResetSkinPreview()"
    );
  };
}

// ── Production resolve + paint ─────────────────────────────────────────

/**
 * Resolve active atmosphere for the current room.
 * Ignores leagues.season_theme_id / settings.seasonThemeId completely.
 * Creator sim (if active) supplies now + week into the production path.
 */
export function resolveAutomaticSeasonTheme(input?: {
  sportId?: string | null;
  trustedWeek?: number | null;
  now?: Date;
  userId?: string | null;
}): SeasonThemeId {
  const sim = getCreatorSkinSim(input?.userId);

  let now = input?.now ?? new Date();
  let week =
    input?.trustedWeek !== undefined ? input.trustedWeek : null;

  if (sim?.active) {
    now = dateFromEasternWallClock(sim.etDate, sim.etTime);
    week = sim.week;
  }

  const sportId =
    input?.sportId ||
    (() => {
      try {
        return getLeague()?.sportId || "cfb";
      } catch {
        return "cfb";
      }
    })();

  // When creator is simulating CFB season skins, force CFB phase path
  // (holiday still wins first via resolveCfbSkin / holiday check)
  if (sim?.active) {
    return resolveCfbSkin({ trustedWeek: week, now });
  }

  // Holiday override for every sport (automatic, not a user pick)
  const holiday = resolveHolidaySkinInEasternTime(now);
  if (holiday) return holiday;

  // CFB season phase skins only
  if (sportId === "cfb") {
    return resolveCfbSeasonSkin(week);
  }

  // NFL / other: pack default (data-sport), no season wash
  return DEFAULT_SEASON_THEME_ID;
}

/** Apply theme on <html>. Never writes league settings / cloud. */
export function applySeasonTheme(
  id: string | null | undefined,
  _opts?: { persistLocal?: boolean }
) {
  if (typeof document === "undefined") return;
  const theme = resolveSeasonThemeId(id);
  const root = document.documentElement;
  if (theme === "default") {
    root.removeAttribute("data-season-theme");
  } else {
    root.setAttribute("data-season-theme", theme);
  }
  // Intentionally do NOT write seasonThemeId into league cache —
  // stored selection must not re-enter resolution.
  try {
    window.dispatchEvent(
      new CustomEvent(SEASON_THEME_EVENT, { detail: theme })
    );
  } catch {
    /* ignore */
  }
}

/**
 * Re-paint from automatic resolver (not stored user choice).
 * Call after nav / view-as-player / league switch.
 */
export function reapplySeasonThemeFromLocal() {
  if (typeof window === "undefined") return;
  let sportId: string | null = "cfb";
  try {
    sportId = getLeague()?.sportId || "cfb";
  } catch {
    sportId = "cfb";
  }
  // Sync path: week unknown until async truth loads — holiday still correct;
  // CFB falls back to Opening Season until applier refreshes with trusted week.
  const id = resolveAutomaticSeasonTheme({
    sportId,
    trustedWeek: null,
  });
  applySeasonTheme(id);
}

/**
 * Full automatic paint with trusted live week (async).
 * Prefer this from SeasonThemeApplier.
 */
export async function paintAutomaticSeasonTheme(opts?: {
  now?: Date;
}): Promise<SeasonThemeId> {
  let sportId = "cfb";
  try {
    sportId = getLeague()?.sportId || "cfb";
  } catch {
    sportId = "cfb";
  }

  let trustedWeek: number | null = null;
  if (sportId === "cfb") {
    try {
      const { loadLeagueTruth } = await import("./league-truth");
      const truth = await loadLeagueTruth({ sportId: "cfb" });
      trustedWeek = truth.trustedLiveWeek;
    } catch {
      try {
        const { loadLeagueActiveWeek } = await import("./cloud");
        const w = await loadLeagueActiveWeek();
        trustedWeek = typeof w === "number" && !Number.isNaN(w) ? w : null;
      } catch {
        trustedWeek = null;
      }
    }
  }

  const id = resolveAutomaticSeasonTheme({
    sportId,
    trustedWeek,
    now: opts?.now,
  });
  applySeasonTheme(id);
  return id;
}

/**
 * Read currently painted theme, or resolve automatically if not painted.
 * Does not read stored user selection.
 */
export function getActiveSeasonThemeIdFromDom(): SeasonThemeId {
  if (typeof document === "undefined") return DEFAULT_SEASON_THEME_ID;
  const attr = document.documentElement.getAttribute("data-season-theme");
  if (attr && isSeasonThemeId(attr)) return attr;
  return resolveAutomaticSeasonTheme({ trustedWeek: null });
}

/** @deprecated name kept for call sites — now automatic, not stored preference */
export function getActiveSeasonThemeId(): SeasonThemeId {
  return getActiveSeasonThemeIdFromDom();
}
