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

/** ET calendar day key (YYYY-MM-DD) for a timestamp. */
export function etDayKeyFromMs(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: ET });
}

/** Earliest kickoff on the whole card (ms), or 0. */
export function firstKickoffOnCardMs(games: Game[]): number {
  const times = games.map(kickoffMs).filter((t) => t > 0);
  return times.length ? Math.min(...times) : 0;
}

/**
 * First kickoff that ET calendar day among games on the card.
 * e.g. first Saturday game freezes all Saturday games.
 */
export function firstKickoffOfEtDayMs(game: Game, allGames: Game[]): number {
  const t = kickoffMs(game);
  if (!t) return 0;
  const day = etDayKeyFromMs(t);
  const sameDay = allGames
    .map(kickoffMs)
    .filter((ms) => ms > 0 && etDayKeyFromMs(ms) === day);
  return sameDay.length ? Math.min(...sameDay) : 0;
}

/**
 * Hard lock for a game: once the **first kickoff that ET day** has started,
 * no more changes to any game on that day.
 * Pass `allGames` (the full card) so same-day slate freezes together.
 */
export function isGameLocked(
  g: Game,
  now = Date.now(),
  allGames?: Game[]
): boolean {
  const slate = allGames?.length ? allGames : [g];
  const dayFirst = firstKickoffOfEtDayMs(g, slate);
  if (dayFirst) return now >= dayFirst;
  const t = kickoffMs(g);
  if (!t) return false;
  return now >= t;
}

/**
 * True once the first kickoff on the card has started.
 * After this, you cannot lock a card if you never locked before.
 */
export function isCardLockDeadlinePassed(
  games: Game[],
  now = Date.now()
): boolean {
  const t = firstKickoffOnCardMs(games);
  if (!t) return false;
  return now >= t;
}

/** Prop locks at the first kickoff on the card. */
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
  const slate = allGames?.length ? allGames : [g];
  const dayFirst = firstKickoffOfEtDayMs(g, slate);
  const full = formatKickoff(g.commenceTime || g.startTime).full;
  const lockAt = dayFirst || kickoffMs(g);
  if (!lockAt) return { locked: false, label: full };
  if (now >= lockAt) {
    return {
      locked: true,
      label: `LOCKED · first kickoff of the day · ${full}`,
    };
  }
  const mins = Math.round((lockAt - now) / 60_000);
  if (mins < 60) {
    return {
      locked: false,
      label: `Day locks in ${mins} min · ${full}`,
    };
  }
  const hrs = Math.round(mins / 60);
  if (hrs < 48) {
    return {
      locked: false,
      label: `Day locks in ~${hrs}h · ${full}`,
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

/**
 * Human labels for pick'em weeks — see season-calendar.ts for full scrub
 * (Week 0 → RS → Conf Champ cut → CFP).
 */
export {
  weekTitle,
  weekSubtitle,
  weekPillHint,
  seasonPhase,
  FULL_SEASON_MAX_WEEK,
  DEFAULT_CUT_LOCK_WEEK,
  DEFAULT_SEASON_WEEKS,
  SEASON_SCRUB_SUMMARY,
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
