/**
 * Role-aware Picks empty state (no card for the week).
 *
 * STABILITY (P0):
 *   Select exactly ONE message per (day × league × user × role).
 *   Never auto-rotate, never interval-cycle, never re-roll on re-render.
 *
 * Preferred key:
 *   stable = ET date + league_id + user_id + effective role
 *
 * Routing: Build Card (host) vs Go to Locker (player).
 */

export type PicksEmptyCopy = {
  eyebrow: string;
  title: string;
  body: string;
  /** Primary CTA label */
  cta: string;
};

export type PicksEmptyRole = "host" | "player";

/**
 * Host / commissioner / deputy — they can actually build the card.
 * Variety is daily-stable, not a carousel.
 */
export const COMMISH_PICKS_EMPTY_OPTIONS: PicksEmptyCopy[] = [
  {
    eyebrow: "Commish · one job",
    title: "You had one job…",
    body: "The room is staring at a blank week because the card still lives in your head. Build it. Publish it. Let them pick.",
    cta: "Build Card",
  },
  {
    eyebrow: "Your move",
    title: "Your league is waiting on you.",
    body: "Players can’t invent the slate. Until you build this week’s card, My Picks is just a waiting room with your name on the door.",
    cta: "Build Card",
  },
  {
    eyebrow: "Host bottleneck",
    title: "Nothing to pick until you drop a card.",
    body: "They’re ready. You’re the only person who can open the door. Five games, one prop, publish — then the room can breathe.",
    cta: "Build Card",
  },
  {
    eyebrow: "Friendly pressure",
    title: "The players can’t make picks until you build the card.",
    body: "This isn’t a bug. It’s you. Own it, build the week, and stop making the group chat wonder if the app is broken.",
    cta: "Build Card",
  },
  {
    eyebrow: "Commish mirror",
    title: "Blank slate. Your fault. Fixable.",
    body: "War Room doesn’t invent games for you. Open the card builder, pick five, publish. Then you can lock your own picks like a normal human.",
    cta: "Build Card",
  },
  {
    eyebrow: "Host tip",
    title: "No card, no picks, no excuses.",
    body: "You started the room. The room is waiting. Build the card before someone starts a petition in the Locker.",
    cta: "Build Card",
  },
  {
    eyebrow: "Season’s waiting",
    title: "Still no card for this week.",
    body: "Anticipation is great. Indefinite silence is not. Build the week so the rivalry can start arguing about spreads instead of you.",
    cta: "Build Card",
  },
  {
    eyebrow: "Do this now",
    title: "You’re blocking the whole league.",
    body: "Not dramatically — literally. No published card means nobody can lock. Hit Build Card and unstick the room.",
    cta: "Build Card",
  },
];

/**
 * Player (non-ops) — buddy across the room, not support desk.
 * Light roast of the commissioner. CTA always Locker (peer pressure).
 */
export const PLAYER_PICKS_EMPTY_OPTIONS: PicksEmptyCopy[] = [
  {
    eyebrow: "WAITING ON THE COMMISH",
    title: "No card. No picks. Outstanding leadership.",
    body: "Your commissioner hasn’t posted this week’s card yet. Feel free to remind them—in the Locker Room, where everyone can enjoy it.",
    cta: "Call Out the Commish",
  },
  {
    eyebrow: "Empty slate",
    title:
      "No card yet. Apparently your commissioner believes football starts next week.",
    body: "It doesn’t. Season’s open. Nudge them in the Locker — peer pressure is part of the sport.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Empty slate",
    title:
      "No card yet. Maybe remind your commissioner the season didn’t get postponed.",
    body: "Nothing to lock until they publish. Go stir the Locker. Keep it fun. Make them feel the group chat energy.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Buddy note",
    title: "Looks like your commissioner overslept.",
    body: "Or got lost in odds. Either way: no slate, no picks. The Locker is where the room gently (or not so gently) wakes the host up.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Buddy note",
    title: "Commish is still “finalizing” the card. In theory.",
    body: "You’re ready. The week isn’t. Drop a “card when?” in the Locker and keep the room warm until the slate lands.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Group chat energy",
    title: "The host has the keys. The door is still locked.",
    body: "Not your job to invent five games. It is your job to make sure they know people are waiting. Locker’s open.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Waiting (with swagger)",
    title: "Picks are closed for renovation. Host contractor: your commissioner.",
    body: "Hang in the Locker. Roast lightly. Celebrate when the card finally drops like it was always the plan.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Waiting (with swagger)",
    title: "No slate. Your commissioner is speedrunning the silent treatment.",
    body: "Don’t invent urgency that isn’t yours — invent a Locker thread. Friendly peer pressure beats staring at an empty week.",
    cta: "Go to Locker",
  },
];

/** @deprecated Prefer resolvePicksEmptyCopy with stable key. Locked primary was index 0. */
export const ACTIVE_COMMISH_PICKS_EMPTY_INDEX = 0;

/** sessionStorage cache so re-renders never re-hash mid-visit */
const EMPTY_COPY_CACHE_PREFIX = "warroom-picks-empty-copy-v2:";

function etDayKey(now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value || "0";
    const m = parts.find((p) => p.type === "month")?.value || "0";
    const d = parts.find((p) => p.type === "day")?.value || "0";
    return `${y}-${m}-${d}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Stable hash → non-negative int */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Daily-stable key: same person, league, role → same message all day.
 * Changes only when the calendar day (ET) rolls, or role/league/user changes.
 */
export function picksEmptyStableKey(opts: {
  role: PicksEmptyRole;
  leagueId?: string | null;
  userId?: string | null;
  now?: Date;
}): string {
  const day = etDayKey(opts.now ?? new Date());
  const league = opts.leagueId || "no-league";
  const user = opts.userId || "anon";
  return `${day}|${league}|${user}|${opts.role}`;
}

function pickFromPool(
  pool: PicksEmptyCopy[],
  stableKey: string
): PicksEmptyCopy {
  const n = pool.length;
  if (n <= 0) {
    return {
      eyebrow: "Empty slate",
      title: "No card yet.",
      body: "Come back when the host publishes.",
      cta: "Go to Locker",
    };
  }
  if (n === 1) return pool[0]!;
  return pool[hashStr(stableKey) % n]!;
}

/**
 * Resolve one empty-state message for the given role + identity.
 * Pure given inputs — no Math.random on the hot path, no clocks except day bucket.
 *
 * When sessionStorage is available, memoizes the chosen copy for this stable key
 * so even if callers re-invoke, the same object shape is returned for the visit/day.
 */
export function resolvePicksEmptyCopy(opts: {
  role: PicksEmptyRole;
  leagueId?: string | null;
  userId?: string | null;
  now?: Date;
}): PicksEmptyCopy {
  const key = picksEmptyStableKey(opts);
  const pool =
    opts.role === "host"
      ? COMMISH_PICKS_EMPTY_OPTIONS
      : PLAYER_PICKS_EMPTY_OPTIONS;

  if (typeof window !== "undefined") {
    try {
      const cacheKey = EMPTY_COPY_CACHE_PREFIX + key;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as PicksEmptyCopy;
        if (
          parsed &&
          typeof parsed.title === "string" &&
          typeof parsed.body === "string"
        ) {
          return parsed;
        }
      }
      const chosen = pickFromPool(pool, key);
      sessionStorage.setItem(cacheKey, JSON.stringify(chosen));
      return chosen;
    } catch {
      /* fall through — pure hash still stable for the day */
    }
  }

  return pickFromPool(pool, key);
}

/** @deprecated use resolvePicksEmptyCopy({ role: "host", ... }) */
export function resolveCommishPicksEmptyCopy(opts?: {
  leagueId?: string | null;
  userId?: string | null;
}): PicksEmptyCopy {
  return resolvePicksEmptyCopy({
    role: "host",
    leagueId: opts?.leagueId,
    userId: opts?.userId,
  });
}

/** @deprecated use resolvePicksEmptyCopy({ role: "player", ... }) */
export function resolvePlayerPicksEmptyCopy(opts?: {
  leagueId?: string | null;
  userId?: string | null;
}): PicksEmptyCopy {
  return resolvePicksEmptyCopy({
    role: "player",
    leagueId: opts?.leagueId,
    userId: opts?.userId,
  });
}

/** @deprecated — player index was visit-salted; use resolvePicksEmptyCopy */
export function resolvePlayerPicksEmptyIndex(now = new Date()): number {
  const key = picksEmptyStableKey({
    role: "player",
    leagueId: null,
    userId: null,
    now,
  });
  const n = PLAYER_PICKS_EMPTY_OPTIONS.length;
  if (n <= 1) return 0;
  return hashStr(key) % n;
}

/** Build Card destination — same host path used elsewhere. */
export const PICKS_EMPTY_BUILD_CARD_HREF = "/week-ops";
export const PICKS_EMPTY_LOCKER_HREF = "/locker-room";
