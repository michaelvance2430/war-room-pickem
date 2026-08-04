import type { Game } from "./types";

const ET = "America/New_York";

/** Full kickoff for display, always Eastern. */
export function formatKickoff(isoOrLegacy?: string | null): {
  /** e.g. "Sat, Aug 30" */
  dateLine: string;
  /** e.g. "3:30 PM EDT" */
  timeLine: string;
  /** e.g. "Sat, Aug 30 · 3:30 PM EDT" */
  full: string;
} {
  if (!isoOrLegacy) {
    return { dateLine: "TBD", timeLine: "", full: "TBD" };
  }

  const d = new Date(isoOrLegacy);
  if (Number.isNaN(d.getTime())) {
    return {
      dateLine: isoOrLegacy,
      timeLine: "",
      full: isoOrLegacy,
    };
  }

  const dateLine = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: ET,
  });
  const timeLine = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: ET,
  });
  return { dateLine, timeLine, full: `${dateLine} · ${timeLine}` };
}

/** Sort key for kickoff (ms). Non-ISO → 0. */
export function kickoffMs(g: Game): number {
  const raw = g.commenceTime || g.startTime;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Earliest kickoff on the whole card (ms), or 0. */
export function firstKickoffOnCardMs(games: Game[]): number {
  const times = games.map(kickoffMs).filter((t) => t > 0);
  return times.length ? Math.min(...times) : 0;
}

/**
 * True once the first kickoff on the card has started.
 * Entire slate freezes then — all picks must already be locked.
 */
export function isCardLockDeadlinePassed(
  games: Game[],
  now = Date.now()
): boolean {
  const t = firstKickoffOnCardMs(games);
  if (!t) return false;
  return now >= t;
}

/**
 * Hard lock for *editing*: once the **first kickoff on the card** has started,
 * every game is frozen. No late locks, no mid-slate edits.
 * Pass `allGames` (the full card) so the deadline is card-wide.
 */
export function isGameLocked(
  g: Game,
  now = Date.now(),
  allGames?: Game[]
): boolean {
  if (allGames?.length) {
    return isCardLockDeadlinePassed(allGames, now);
  }
  const t = kickoffMs(g);
  if (!t) return false;
  return now >= t;
}

/**
 * Board reveal for one matchup: like fantasy football — you don't see who
 * they took until *that game* has kicked off (or the week is already scored).
 */
export function isGamePickRevealed(
  g: Game,
  now = Date.now(),
  opts?: { weekScored?: boolean }
): boolean {
  if (opts?.weekScored) return true;
  const t = kickoffMs(g);
  if (!t) return false;
  return now >= t;
}

/** Prop locks at the first kickoff on the card (same as the whole slate). */
export function isPropLocked(games: Game[], now = Date.now()): boolean {
  return isCardLockDeadlinePassed(games, now);
}

export function openGameCount(games: Game[], now = Date.now()): number {
  return games.filter((g) => !isGameLocked(g, now, games)).length;
}

export function formatKickoffLockLabel(
  g: Game,
  now = Date.now(),
  allGames?: Game[]
): { locked: boolean; label: string } {
  const full = formatKickoff(g.commenceTime || g.startTime).full;
  const slate = allGames?.length ? allGames : [g];
  const cardFirst = firstKickoffOnCardMs(slate);
  const lockAt = cardFirst || kickoffMs(g);
  if (!lockAt) return { locked: false, label: full };
  if (now >= lockAt) {
    return {
      locked: true,
      label: `LOCKED · card freezes at first kickoff · ${full}`,
    };
  }
  const mins = Math.round((lockAt - now) / 60_000);
  if (mins < 60) {
    return {
      locked: false,
      label: `Card locks in ${mins} min · ${full}`,
    };
  }
  const hrs = Math.round(mins / 60);
  if (hrs < 48) {
    return {
      locked: false,
      label: `Card locks in ~${hrs}h · ${full}`,
    };
  }
  return { locked: false, label: full };
}

/** Human label for the card-wide lock deadline (first kickoff). */
export function formatCardLockDeadline(games: Game[]): string {
  const t = firstKickoffOnCardMs(games);
  if (!t) return "first kickoff";
  return formatKickoff(new Date(t).toISOString()).full;
}

/** League Lock Timer personality — story of the week, not a generic clock. */
export type LeagueLockPhase =
  | "plenty" // ≥ 24h
  | "final_day" // < 24h
  | "locking_soon" // < 1h
  | "last_call" // < 15m
  | "locked";

export type LeagueLockSegment = {
  /** Display value — zero-padded for hours/mins when multi-unit */
  value: string;
  /** Small label under the number */
  unit: string;
};

/** League Lock Timer — time remaining until first kickoff freezes the card. */
export type LeagueLockCountdown = {
  locked: boolean;
  /** No usable kickoff times on the card */
  unknown: boolean;
  msRemaining: number;
  phase: LeagueLockPhase;
  /** Screen-reader / compact: "37d 08h 01m" */
  headline: string;
  /** Large number + small unit pairs for visual breath */
  segments: LeagueLockSegment[];
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function phaseForMs(ms: number): LeagueLockPhase {
  if (ms <= 0) return "locked";
  if (ms < 15 * 60_000) return "last_call";
  if (ms < 60 * 60_000) return "locking_soon";
  if (ms < 24 * 60 * 60_000) return "final_day";
  return "plenty";
}

/**
 * Format remaining time to first kickoff for the League Lock Timer.
 * Quiet urgency — not a generic event countdown.
 */
export function formatLeagueLockCountdown(
  games: Game[],
  now = Date.now()
): LeagueLockCountdown {
  const lockAt = firstKickoffOnCardMs(games);
  if (!lockAt) {
    return {
      locked: false,
      unknown: true,
      msRemaining: 0,
      phase: "plenty",
      headline: "",
      segments: [],
    };
  }
  const ms = lockAt - now;
  if (ms <= 0) {
    return {
      locked: true,
      unknown: false,
      msRemaining: 0,
      phase: "locked",
      headline: "LOCKED",
      segments: [],
    };
  }
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  const secs = Math.floor((ms % 60_000) / 1000);
  const phase = phaseForMs(ms);

  if (days >= 1) {
    return {
      locked: false,
      unknown: false,
      msRemaining: ms,
      phase,
      headline: `${days}d ${pad2(hours)}h ${pad2(mins)}m`,
      segments: [
        { value: String(days), unit: days === 1 ? "DAY" : "DAYS" },
        { value: pad2(hours), unit: "HOURS" },
        { value: pad2(mins), unit: "MIN" },
      ],
    };
  }
  if (totalMin >= 60) {
    return {
      locked: false,
      unknown: false,
      msRemaining: ms,
      phase,
      headline: `${pad2(hours)}h ${pad2(mins)}m`,
      segments: [
        { value: pad2(hours), unit: hours === 1 ? "HOUR" : "HOURS" },
        { value: pad2(mins), unit: "MIN" },
      ],
    };
  }
  // Under one hour
  if (totalMin >= 15) {
    return {
      locked: false,
      unknown: false,
      msRemaining: ms,
      phase,
      headline: `${mins}m`,
      segments: [{ value: String(Math.max(1, mins)), unit: "MIN" }],
    };
  }
  // Last call — minutes + seconds so it breathes
  if (mins > 0) {
    return {
      locked: false,
      unknown: false,
      msRemaining: ms,
      phase,
      headline: `${mins}m ${pad2(secs)}s`,
      segments: [
        { value: String(mins), unit: "MIN" },
        { value: pad2(secs), unit: "SEC" },
      ],
    };
  }
  return {
    locked: false,
    unknown: false,
    msRemaining: ms,
    phase,
    headline: `${secs}s`,
    segments: [{ value: String(secs), unit: "SEC" }],
  };
}

/**
 * Human labels for pick'em weeks — see season-calendar.ts for full scrub
 * (Week 0 → RS → Conf Champ cut → CFP).
 */
export {
  weekTitle,
  weekSubtitle,
  weekPillHint,
  weekDateRangeLabel,
  seasonPhase,
  FULL_SEASON_MAX_WEEK,
  DEFAULT_CUT_LOCK_WEEK,
  DEFAULT_SEASON_WEEKS,
  SEASON_SCRUB_SUMMARY,
  listSeasonWeekNumbers,
  firstSeasonWeek,
  seasonMaxWeek,
  cutLockWeek,
  bracketWeeksForSport,
  NFL_SEASON_SCRUB_SUMMARY,
  NFL_SEASON_MAX_WEEK,
  NFL_CUT_LOCK_WEEK,
} from "./season-calendar";

/** Date span of games on a card, e.g. "Sat, Aug 29 – Sat, Sep 5". */
export function formatCardDateRange(games: Game[]): string {
  const times = games
    .map(kickoffMs)
    .filter((t) => t > 0)
    .sort((a, b) => a - b);
  if (!times.length) return "";

  const first = formatKickoff(new Date(times[0]).toISOString()).dateLine;
  const last = formatKickoff(
    new Date(times[times.length - 1]).toISOString()
  ).dateLine;
  if (first === last) return first;
  return `${first} – ${last}`;
}

/** Group games under a date header for the odds list. */
export function groupGamesByDate(games: Game[]): {
  dateKey: string;
  dateLabel: string;
  games: Game[];
}[] {
  const map = new Map<string, Game[]>();
  const order: string[] = [];

  const sorted = [...games].sort((a, b) => kickoffMs(a) - kickoffMs(b));
  for (const g of sorted) {
    const raw = g.commenceTime || g.startTime || "";
    const d = new Date(raw);
    let key: string;
    let dateLabel: string;
    if (!raw || Number.isNaN(d.getTime())) {
      key = "tbd";
      dateLabel = "Date TBD";
    } else {
      key = d.toLocaleDateString("en-CA", { timeZone: ET }); // YYYY-MM-DD
      dateLabel = d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: ET,
      });
    }
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(g);
    // Keep first-seen label for this key in a side map via games[0]
    (map.get(key) as Game[] & { __label?: string }).__label = dateLabel;
  }

  return order.map((dateKey) => {
    const list = map.get(dateKey)!;
    const first = list[0];
    const raw = first?.commenceTime || first?.startTime;
    const d = raw ? new Date(raw) : null;
    const dateLabel =
      d && !Number.isNaN(d.getTime())
        ? d.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: ET,
          })
        : "Date TBD";
    return { dateKey, dateLabel, games: list };
  });
}
