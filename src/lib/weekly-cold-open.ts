/**
 * Preseason cold-open — Gazette Network “wanted” package on last year’s champ.
 *
 * Window: the calendar week before the season’s opening week starts
 *   (CFB Week 0 / NFL Week 1) through the moment opening week begins.
 * Frequency: once per player · league · champ year (not weekly).
 * Subject: defending championship trophy winner (prior-season seed if needed).
 *
 * Copy never freezes on one bit: independent banks for wanted / headline /
 * body / markets / CTA, mixed by league + season + sport + champ, with
 * per-league memory so consecutive seasons don’t re-serve the same mix.
 */

import { getLeague, getSession } from "@/lib/league";
import {
  firstSeasonWeek,
  weekWindowMs,
} from "@/lib/season-calendar";
import { hasOpeningWeekStarted } from "@/lib/ring-ceremony";
import {
  getPriorSeasonSeeds,
  PRIOR_SEASON_YEAR,
  resolvePriorSport,
} from "@/lib/prior-season-seed";
import type { LeagueTrophy } from "@/lib/trophies";
import { getDefendingChampion } from "@/lib/player-history";

/** Bump when once-per-season semantics change */
const SEEN_KEY = "warroom-cold-open-seen-v2";

/** Per-league pack memory — avoid same slots season after season */
const PACK_MEMORY_KEY = "warroom-cold-open-pack-memory-v1";

/** Shared brand with GazettePaper / buildGazetteEdition */
export const GAZETTE_STATION = {
  callSign: "WRG",
  masthead: "THE WAR ROOM GAZETTE",
  tagline: "All the news that's fit to roast",
  network: "Gazette Network",
  desk: "Investigative Desk",
  bugLabel: "GAZETTE · LIVE",
} as const;

/** Foundry / creator: open broadcast without leaving the page. */
export const EVENT_FORCE_WEEKLY_COLD_OPEN = "warroom-force-weekly-cold-open";

/** Seven days before opening week start → opening week start (exclusive). */
const PRESEASON_LEAD_MS = 7 * 24 * 60 * 60 * 1000;

export type ColdOpenSubject = {
  year: number;
  name: string;
  userId: string | null;
  avatarUrl: string | null;
};

export type WeeklyColdOpenCopy = {
  stamp: string;
  wanted: string;
  headline: string;
  phonetic: string | null;
  body: string;
  kalshi: string;
  cta: string;
  ctaGazette: string;
  hardwareLabel: string;
  /** Closing blurb under the article */
  foot: string;
  /** Debug / Foundry — which mix this room got */
  packId: string;
  /** Once-per-season footer line */
  editionLine: string;
};

export type ColdOpenCopyOpts = {
  sportId?: string | null;
  leagueId?: string | null;
  leagueName?: string | null;
  /** Force a pack salt (Foundry remix / tests) */
  forceSalt?: number;
  /** Don’t write pack memory (preview) */
  preview?: boolean;
};

/** Fire from Foundry — preview only (does not burn the once-per-season flag). */
export function requestWeeklyColdOpenPreview(): void {
  if (typeof window === "undefined") return;
  const fire = () => {
    try {
      window.dispatchEvent(
        new CustomEvent(EVENT_FORCE_WEEKLY_COLD_OPEN, {
          detail: { preview: true },
        })
      );
    } catch {
      /* ignore */
    }
  };
  fire();
  window.setTimeout(fire, 50);
  window.setTimeout(fire, 200);
  window.setTimeout(fire, 500);
}

/**
 * Opening-week start ms for this sport (CFB Week 0 / NFL Week 1).
 */
export function coldOpenSeasonOpenMs(sportId?: string | null): number | null {
  const sid = sportId ?? getLeague()?.sportId;
  const first = firstSeasonWeek(sid);
  const cal = sid === "nfl" ? "nfl" : "cfb";
  const win = weekWindowMs(first, cal);
  return win?.startMs ?? null;
}

/**
 * Preseason cold-open window: week before season starts only.
 * Ends when opening week begins (ring ceremony takes the stage).
 */
export function isWeeklyColdOpenWindowOpen(
  sportId?: string | null,
  nowMs = Date.now()
): boolean {
  const sid = sportId ?? getLeague()?.sportId;
  if (hasOpeningWeekStarted(sid, nowMs)) return false;
  const openMs = coldOpenSeasonOpenMs(sid);
  if (openMs == null) return false;
  const startMs = openMs - PRESEASON_LEAD_MS;
  return nowMs >= startMs && nowMs < openMs;
}

/**
 * Resolve last year’s championship trophy holder for the cold open.
 * Prefers live Trophy Room championships; falls back to prior-season seed.
 */
export function resolveColdOpenSubject(
  trophies: LeagueTrophy[],
  sportId?: string | null
): Omit<ColdOpenSubject, "avatarUrl"> | null {
  const sport = resolvePriorSport(sportId);
  const d = getDefendingChampion(trophies);
  if (d?.name) {
    return {
      year: d.year,
      name: d.name,
      userId: d.userId,
    };
  }
  const seed = getPriorSeasonSeeds(sport).find(
    (s) => s.trophyType === "championship"
  );
  if (!seed) return null;
  return {
    year: PRIOR_SEASON_YEAR,
    name: seed.winnerName,
    userId: null,
  };
}

// ── Hash + pack memory (season / league variety) ──────────────────────

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type PackMemoryRoot = Record<
  string,
  Record<string, { recent: number[]; bySeason: Record<string, number> }>
>;

function readPackMemory(): PackMemoryRoot {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PACK_MEMORY_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as PackMemoryRoot;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writePackMemory(store: PackMemoryRoot) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PACK_MEMORY_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

/**
 * Pick a bank index that:
 * 1) is stable for the same league + season + champ + bank
 * 2) avoids the last few indices used in this league for that bank
 * 3) shifts when the preferred slot was already used recently
 */
function pickBankIndex(opts: {
  bankKey: string;
  bankLen: number;
  seed: string;
  leagueId: string;
  seasonKey: string;
  remember: boolean;
}): number {
  const { bankKey, bankLen, seed, leagueId, seasonKey, remember } = opts;
  if (bankLen <= 0) return 0;

  const store = readPackMemory();
  if (!store[leagueId]) store[leagueId] = {};
  if (!store[leagueId][bankKey]) {
    store[leagueId][bankKey] = { recent: [], bySeason: {} };
  }
  const mem = store[leagueId][bankKey];
  if (!Array.isArray(mem.recent)) mem.recent = [];
  if (!mem.bySeason || typeof mem.bySeason !== "object") mem.bySeason = {};

  // Stable within a season (rebuilds / multiple previews same season)
  if (
    mem.bySeason[seasonKey] != null &&
    Number.isFinite(mem.bySeason[seasonKey])
  ) {
    const locked = mem.bySeason[seasonKey]! % bankLen;
    return ((locked % bankLen) + bankLen) % bankLen;
  }

  const preferred = hashStr(seed) % bankLen;
  const recent = new Set(
    mem.recent.filter((i) => i >= 0 && i < bankLen).slice(-Math.min(4, bankLen - 1))
  );

  let chosen = preferred;
  for (let step = 0; step < bankLen; step++) {
    const tryIdx = (preferred + step) % bankLen;
    if (!recent.has(tryIdx)) {
      chosen = tryIdx;
      break;
    }
  }

  if (remember) {
    mem.bySeason[seasonKey] = chosen;
    mem.recent = [...mem.recent.filter((i) => i !== chosen), chosen].slice(-8);
    // Drop ancient season locks if the map grows
    const keys = Object.keys(mem.bySeason);
    if (keys.length > 12) {
      for (const k of keys.slice(0, keys.length - 12)) {
        delete mem.bySeason[k];
      }
    }
    writePackMemory(store);
  }

  return chosen;
}

function isKahmann(name: string): boolean {
  return /\bkahmann\b/i.test(name || "");
}

function isMaria(name: string): boolean {
  return /\bmaria\b/i.test(name || "");
}

type CopyCtx = {
  name: string;
  nameCall: string;
  year: number;
  sport: "cfb" | "nfl";
  hardware: string;
  hardwareShort: string;
  room: string;
  dayLabel: string;
};

// ── Independent banks (mix freely; product = lots of unique packages) ─

const WANTED_BANK = [
  "Have you seen this man?",
  "WANTED: defending champ — approach with snacks",
  "MISSING: humility. LAST SEEN WITH THE HARDWARE",
  "FACE OF THE ROOM — CASE FILE OPEN",
  "ALERT: reigning champ still at large",
  "MILK CARTON MONDAY (PRESEASON EDITION)",
  "HAVE YOU SEEN THIS TARGET?",
  "PERSON OF INTEREST · TROPHY DIVISION",
  "IF FOUND: return crystal, keep the ego",
  "SIDE OF THE CARTON · CHAMP WATCH",
  "PUBLIC SERVICE ANNOUNCEMENT",
  "THE BOARD REMEMBERS THIS FACE",
];

const HEADLINE_BANK: ((c: CopyCtx) => string)[] = [
  (c) => `${c.name}: known time traveler — some even say a cheat`,
  (c) => `${c.name} and the case of the suspiciously perfect card`,
  (c) => `Is ${c.name} lucky… or running next week’s scores early?`,
  (c) => `${c.name} still has the ${c.hardwareShort}. The room has questions.`,
  (c) => `Defending champ ${c.name}: hero, villain, or time-zone tourist?`,
  (c) => `${c.name} put a target on their own back. Gazette filed the photo.`,
  (c) => `BREAKING: ${c.name} enters ${c.year + 1} as the one everyone hunts`,
  (c) => `${c.name} — reigning ${c.hardwareShort} holder, alleged score psychic`,
  (c) => `Room opens fire on ${c.name}: “prove it again or hand it over”`,
  (c) => `${c.name}’s ${c.year} title still haunts the group chat`,
  (c) => `Investigative Desk vs ${c.name}: DeLorean still not recovered`,
  (c) => `${c.name} won last year. Kalshi already priced the hangover.`,
  (c) => `Champ watch: ${c.name} walks into a room that wants blood`,
  (c) => `${c.name} is the face on the carton. Season hasn’t started. Drama has.`,
];

const BODY_BANK: ((c: CopyCtx) => string)[] = [
  (c) =>
    `Gazette Network has it on the record: ${c.nameCall} is a known time traveler. ` +
    `Room veterans have long whispered that the reigning champ (${c.year} ${c.hardware}) ` +
    `somehow always knows next week’s scores before the rest of us lock. ` +
    `Some even say a cheat. Investigative Desk has not recovered a DeLorean — ` +
    `but the pattern is hard to unsee. This is the week-before package: ` +
    `face on the carton, name in the paper, target on their back.`,
  (c) =>
    `Preseason drop from the ${c.room} desk: ${c.nameCall} still holds the ${c.year} ${c.hardware}. ` +
    `That means one thing — every card this year is a heist attempt. ` +
    `Witnesses report suspiciously clean Best Bets, early locks, and a smirk that says “I already saw the box score.” ` +
    `We print faces, not excuses. Have you seen this man?`,
  (c) =>
    `${c.nameCall} raised the ${c.hardwareShort} last season. Now the carton is out. ` +
    `Sources close to the locker insist it’s skill. Sources closer to the standings insist it’s sorcery. ` +
    `Either way, ${c.dayLabel} energy is building and the room wants a rematch more than a parade. ` +
    `Gazette Investigative Desk: open case, zero mercy, full roast.`,
  (c) =>
    `Last year’s champion is ${c.nameCall}. This year’s bulletin is simple: remember the face. ` +
    `The ${c.year} ${c.hardware} doesn’t defend itself — the board does. ` +
    `Whispers of time travel, spreads that “felt familiar,” and a prop pick that aged like prophecy. ` +
    `We can’t prove cheat codes. We can print a wanted poster.`,
  (c) =>
    `If you forgot who won, the hardware didn’t: ${c.nameCall}, ${c.year}. ` +
    `The War Room does not do quiet title defenses. We do milk cartons, Kalshi screenshots, and group-chat forensics. ` +
    `Some say traveler. Some say cheat. Most say “good luck surviving week one with that target.” ` +
    `This package airs once — then the season starts hunting.`,
  (c) =>
    `Case file ${c.year}-${c.name.replace(/\s+/g, "").slice(0, 12).toUpperCase()}: ` +
    `subject ${c.nameCall} last seen clutching ${c.hardware}. ` +
    `MO includes locking early, talking late, and finishing first. ` +
    `Known associates: confidence points, Best Bets, and a room full of people practicing their “I told you so.” ` +
    `Reward for unseating them: eternal bragging rights and a new face on next year’s carton.`,
  (c) =>
    `Gazette Network special: the week before ${c.dayLabel}, we put the champ on blast. ` +
    `${c.nameCall} is the defending ${c.hardwareShort} holder. ` +
    `That is not a compliment — it’s a bounty. ` +
    `Reports of time-zone tourism and “lucky” props remain unconfirmed. ` +
    `What is confirmed: their profile pic is now public domain for roasting.`,
  (c) =>
    `${c.room} tradition holds: last year’s winner gets the preseason carton. ` +
    `This year that’s ${c.nameCall}. No ticker. No pop-up words. Just the facts we can print without a lawyer — ` +
    `they won the ${c.year} ${c.hardware}, the room is jealous, and Kalshi is not bullish on a repeat. ` +
    `Some even say a cheat. We say: prove them wrong… or don’t.`,
  (c) =>
    `Anatomy of a target: ${c.nameCall} took home the ${c.year} title hardware. ` +
    `Now every Saturday/Sunday is a referendum. Veterans swear the picks arrive from the future. ` +
    `Newcomers just see a face and a name. ` +
    `Investigative Desk position: unknown if traveler, unconfirmed if cheat, certain if hunted.`,
  (c) =>
    `Stop us if you’ve heard this one: reigning champ ${c.nameCall} walks into ${c.room} ` +
    `with last year’s ${c.hardwareShort} still warm. ` +
    `Punchline writes itself — unless they three-peat, in which case we print a dynasty special. ` +
    `Until then: carton energy, full article, zero animation, maximum disrespect wrapped in newsprint gold.`,
];

const KALSHI_BANK: ((c: CopyCtx) => string)[] = [
  (c) =>
    `Kalshi odds have ${c.name} definitely not winning this year. Markets price the time-travel edge as spent. The board is open — the tape says no.`,
  (c) =>
    `Markets update: Kalshi has ${c.name} as a fade. Repeat titles are priced like lottery tickets with worse juice.`,
  (c) =>
    `Kalshi board: ${c.name} to defend? Traders say “absolutely not.” The room says “watch this.” Only one gets paid in pride.`,
  (c) =>
    `According to Kalshi, ${c.name} is not winning it again. According to ${c.name}, the market is a clown. We’ll keep score.`,
  (c) =>
    `Kalshi lists ${c.name} as “definitely not” this year’s champ. Bold claim. Print it. Frame it. Revisit in January.`,
  (c) =>
    `Contract watch: ${c.name} repeat = longshot. The tape is cold. The target on their back is not.`,
  (c) =>
    `Prediction markets (Kalshi) have ${c.name} buried. History says champs get hunted. Math says the field is deep. Drama says tune in.`,
  (c) =>
    `Kalshi: ${c.name} ❌ this year. Gazette: still putting their face on the carton just in case the market is wrong and annoying.`,
  (c) =>
    `Oddsmakers have spoken — ${c.name} is not the pick to win it all. The carton stays up anyway. Hope is not a strategy; locking is.`,
  (c) =>
    `Kalshi prices a ${c.name} defense as fantasy. The War Room prices it as motivation. Same headline, different bankroll.`,
];

const CTA_BANK = [
  "Cool — back to the room",
  "Alright, hunt season",
  "Got it — open the board",
  "Close carton · start beef",
  "Enough news — lock soon",
  "Back to the group chat",
];

const EDITION_BANK: ((c: CopyCtx) => string)[] = [
  (c) =>
    `Once per season · week before open · ${c.year} champ package · ${c.room}`,
  (c) =>
    `Preseason exclusive · ${c.room} · not the same bit as last year`,
  (c) =>
    `Gazette carton drop · one view · then the season eats the evidence`,
  (c) =>
    `${c.dayLabel} approaches · ${c.name} on notice · you on notice too`,
  (c) =>
    `Edition mix unique to this league + season · don’t expect a rerun`,
];

const FOOT_BANK = [
  "One-time preseason drop — the week before kickoff. When the host scores a week, the full Gazette still drops with crowns, shame, and the works.",
  "This carton airs once. Ring ceremony still walks opening week. Paper still drops after score. The roast economy is diversified.",
  "Preseason only. No weekly reruns. Different room, different year, different mix — Gazette Network does not do syndication of the same roast.",
  "You get one look. Then it’s hardware, locks, and the board. The Gazette will be back with receipts.",
];

function sportBits(sport: "cfb" | "nfl", year: number) {
  if (sport === "nfl") {
    return {
      hardware: "Super Bowl hardware",
      hardwareShort: "Super Bowl title",
      hardwareLabel: `${year} Super Bowl champion`,
      dayLabel: "Sunday",
    };
  }
  return {
    hardware: "championship crystal",
    hardwareShort: "crystal",
    hardwareLabel: `${year} War Room champion`,
    dayLabel: "Saturday",
  };
}

function champPhonetic(name: string): string | null {
  if (isKahmann(name)) return "Kahmann — pronounced COMMON";
  return null;
}

function champNameCall(name: string): string {
  if (isKahmann(name)) return `${name} (say it with us — COMMON)`;
  if (isMaria(name)) return `${name} (defending Super Bowl energy)`;
  return name;
}

/**
 * CFB inaugural cold open — LOCKED.
 *
 * Foundry-approved first package for the upcoming CFB season
 * (defending champ year = PRIOR_SEASON_YEAR / 2025 Excel hardware).
 *
 * Foundry preview + live players always get this exact copy.
 * Do NOT rotate, rehash, or rewrite without explicit product sign-off.
 * Later CFB seasons (champ year > 2025) use the variety banks below.
 */
export const CFB_INAUGURAL_COLD_OPEN_PACK_ID = "cfb-inaugural-locked-v1";

export function isCfbInauguralColdOpenLocked(
  sportId?: string | null,
  champYear?: number
): boolean {
  const sport = resolvePriorSport(sportId);
  const year = champYear ?? PRIOR_SEASON_YEAR;
  return sport === "cfb" && year === PRIOR_SEASON_YEAR;
}

/** Frozen inaugural CFB package — the one locked from Foundry sign-off. */
function buildCfbInauguralLockedCopy(ctx: CopyCtx): WeeklyColdOpenCopy {
  const nameCall = isKahmann(ctx.name)
    ? `${ctx.name} (say it with us — COMMON)`
    : ctx.nameCall;

  return {
    stamp: `${GAZETTE_STATION.callSign} · ${GAZETTE_STATION.desk}`,
    wanted: "Have you seen this man?",
    headline: `${ctx.name}: known time traveler — some even say a cheat`,
    phonetic: champPhonetic(ctx.name),
    body:
      `Gazette Network has it on the record: ${nameCall} is a known time traveler. ` +
      `Room veterans have long whispered that the reigning champ (${ctx.year} ${ctx.hardware}) ` +
      `somehow always knows next week’s scores before the rest of us lock. ` +
      `Some even say a cheat. Investigative Desk has not recovered a DeLorean — ` +
      `but the pattern is hard to unsee. This is the week-before package: ` +
      `face on the carton, name in the paper, target on their back.`,
    kalshi:
      `Kalshi odds have ${ctx.name} definitely not winning this year. Markets price the time-travel edge as spent. The board is open — the tape says no.`,
    cta: "Cool — back to the room",
    ctaGazette: "Open the Gazette",
    hardwareLabel: `${ctx.year} War Room champion`,
    foot:
      "One-time preseason drop — the week before kickoff. When the host scores a week, the full Gazette still drops with crowns, shame, and the works.",
    packId: CFB_INAUGURAL_COLD_OPEN_PACK_ID,
    editionLine: `Once per season · week before open · ${ctx.year} champ package · ${ctx.room} · inaugural CFB (locked)`,
  };
}

/**
 * Mix banks with a seed that changes by league, season, sport, and champ.
 * Per-league memory keeps consecutive seasons from replaying the same slots.
 *
 * Exception: CFB inaugural (2025 champ year) is hard-locked — see
 * buildCfbInauguralLockedCopy. Foundry + live always match.
 */
export function getWeeklyColdOpenCopy(
  subject: { name: string; year?: number; userId?: string | null },
  opts?: ColdOpenCopyOpts | string | null
): WeeklyColdOpenCopy {
  // Back-compat: old call site passed sportId as 2nd arg
  const o: ColdOpenCopyOpts =
    typeof opts === "string" || opts == null
      ? { sportId: opts as string | null | undefined }
      : opts;

  const league = getLeague();
  const name = (subject.name || "Last year's champ").trim();
  const sport = resolvePriorSport(o.sportId ?? league?.sportId);
  const year = subject.year ?? PRIOR_SEASON_YEAR;
  const leagueId = o.leagueId || league?.id || "local";
  const room = (o.leagueName || league?.name || "War Room").trim();
  const bits = sportBits(sport, year);

  const ctx: CopyCtx = {
    name,
    nameCall: champNameCall(name),
    year,
    sport,
    hardware: bits.hardware,
    hardwareShort: bits.hardwareShort,
    room,
    dayLabel: bits.dayLabel,
  };

  // ── LOCKED: upcoming CFB season’s first cold open (Foundry-approved) ──
  // forceSalt must not break the lock — this is the package for this league year.
  if (isCfbInauguralColdOpenLocked(sport, year)) {
    return buildCfbInauguralLockedCopy(ctx);
  }

  const champKey = (subject.userId || name).toLowerCase().replace(/\s+/g, "-");
  const seasonKey = `${year}:${sport}:${champKey}`;
  const baseSeed = [
    leagueId,
    seasonKey,
    sport,
    name.toLowerCase(),
    o.forceSalt != null ? `salt${o.forceSalt}` : "",
  ].join("|");

  const remember = !o.preview && typeof window !== "undefined";

  const pick = (bankKey: string, bankLen: number, lane: string) =>
    pickBankIndex({
      bankKey,
      bankLen,
      seed: `${baseSeed}|${lane}|${o.forceSalt ?? 0}`,
      leagueId,
      seasonKey: `${seasonKey}:${lane}`,
      remember,
    });

  const wi = pick("wanted", WANTED_BANK.length, "w");
  const hi = pick("headline", HEADLINE_BANK.length, "h");
  const bi = pick("body", BODY_BANK.length, "b");
  const ki = pick("kalshi", KALSHI_BANK.length, "k");
  const ci = pick("cta", CTA_BANK.length, "c");
  const ei = pick("edition", EDITION_BANK.length, "e");
  const fi = pick("foot", FOOT_BANK.length, "f");

  // Extra anti-collision: if all banks somehow land on 0 for a new season,
  // nudge body by league hash (rare; memory usually handles it).
  const bodyIdx =
    bi === 0 && hi === 0 && wi === 0
      ? hashStr(baseSeed + "|nudge") % BODY_BANK.length
      : bi;

  // Champ-specific spice layered on top of the rotating bank (never the whole package)
  let body = BODY_BANK[bodyIdx]!(ctx);
  let headline = HEADLINE_BANK[hi]!(ctx);
  if (isKahmann(name) && !/COMMON/i.test(body)) {
    body +=
      " Pronunciation desk reminds the nation: Kahmann — COMMON. File it.";
  }
  if (isMaria(name) && sport === "nfl" && hi % 2 === 0) {
    headline = `${name} still walks first — Super Bowl carton, preseason edition`;
  }

  const packId = `w${wi}-h${hi}-b${bodyIdx}-k${ki}-c${ci}`;

  return {
    stamp: `${GAZETTE_STATION.callSign} · ${GAZETTE_STATION.desk}`,
    wanted: WANTED_BANK[wi]!,
    headline,
    phonetic: champPhonetic(name),
    body,
    kalshi: KALSHI_BANK[ki]!(ctx),
    cta: CTA_BANK[ci]!,
    ctaGazette: "Open the Gazette",
    hardwareLabel: bits.hardwareLabel,
    foot: FOOT_BANK[fi]!,
    packId,
    editionLine: EDITION_BANK[ei]!(ctx),
  };
}

/** How many unique wanted/headline/body/kalshi combos exist before combo wrap. */
export function coldOpenMixCapacity(): number {
  return (
    WANTED_BANK.length *
    HEADLINE_BANK.length *
    BODY_BANK.length *
    KALSHI_BANK.length
  );
}

export function coldOpenSeenKey(
  leagueId: string,
  playerId: string,
  champYear: number
): string {
  return `${SEEN_KEY}:${leagueId}:${playerId}:${champYear}`;
}

export function hasSeenWeeklyColdOpen(
  playerId: string,
  leagueId: string,
  champYear: number
): boolean {
  if (typeof window === "undefined") return true;
  try {
    return (
      localStorage.getItem(coldOpenSeenKey(leagueId, playerId, champYear)) ===
      "1"
    );
  } catch {
    return true;
  }
}

export function markWeeklyColdOpenSeen(
  playerId: string,
  leagueId: string,
  champYear: number
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      coldOpenSeenKey(leagueId, playerId, champYear),
      "1"
    );
  } catch {
    /* ignore */
  }
}

/**
 * Sync gate only — modal still loads trophies + roster before showing.
 * True when calendar window is open and this player hasn't seen this champ year.
 */
export function shouldShowWeeklyColdOpen(
  nowMs = Date.now(),
  opts?: { champYear?: number }
): boolean {
  if (typeof window === "undefined") return false;
  const session = getSession();
  const league = getLeague();
  if (!session?.playerId || !league?.id) return false;
  if (!isWeeklyColdOpenWindowOpen(league.sportId, nowMs)) return false;
  if (opts?.champYear != null) {
    if (hasSeenWeeklyColdOpen(session.playerId, league.id, opts.champYear)) {
      return false;
    }
  }
  return true;
}
