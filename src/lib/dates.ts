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

/**
 * Hard lock: once kickoff has started (now >= commence), no more changes.
 * No exceptions — not for commissioner, not for late edits.
 */
export function isGameLocked(g: Game, now = Date.now()): boolean {
  const t = kickoffMs(g);
  if (!t) return false; // unknown kickoff stays open (shouldn't happen on live cards)
  return now >= t;
}

/** Prop locks at the first kickoff on the card. */
export function isPropLocked(games: Game[], now = Date.now()): boolean {
  const times = games.map(kickoffMs).filter((t) => t > 0);
  if (!times.length) return false;
  return now >= Math.min(...times);
}

export function openGameCount(games: Game[], now = Date.now()): number {
  return games.filter((g) => !isGameLocked(g, now)).length;
}

export function formatKickoffLockLabel(
  g: Game,
  now = Date.now()
): { locked: boolean; label: string } {
  const t = kickoffMs(g);
  const full = formatKickoff(g.commenceTime || g.startTime).full;
  if (!t) return { locked: false, label: full };
  if (now >= t) return { locked: true, label: `LOCKED · ${full}` };
  const mins = Math.round((t - now) / 60_000);
  if (mins < 60) {
    return { locked: false, label: `Locks in ${mins} min · ${full}` };
  }
  const hrs = Math.round(mins / 60);
  if (hrs < 48) {
    return { locked: false, label: `Locks in ~${hrs}h · ${full}` };
  }
  return { locked: false, label: full };
}

/**
 * Human label for a pick'em week.
 * Week 0 and Week 1 are separate cards — run them as two different weeks
 * if you want (e.g. Week 0 this Saturday, only Week 1 next week).
 */
export function weekTitle(weekNumber: number): string {
  if (weekNumber === 0) return "Week 0";
  return `Week ${weekNumber}`;
}

export function weekSubtitle(weekNumber: number): string {
  if (weekNumber === 0) {
    return "Early openers only — its own card, picks, and scores (separate from Week 1)";
  }
  if (weekNumber === 1) {
    return "Week 1 only — separate from Week 0. Pick 5 games for this week’s card";
  }
  return "Regular-season slate";
}

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
