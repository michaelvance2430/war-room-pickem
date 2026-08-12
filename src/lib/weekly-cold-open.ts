/**
 * Preseason cold-open — Gazette Network “wanted” package on last year’s champ.
 *
 * ── Multi-league / multi-season contract (product law) ──────────────────
 * - Same experience shell for every room: CFB, NFL, Foundry sandboxes, future sports.
 * - Content is keyed by the *active league’s* sport + defending champ year.
 * - Once per player · league · champ year — crews returning next year re-qualify
 *   when the hardware year advances (new champ year = new package, new “seen”).
 * - Foundry Test Moment always uses getLeague() (switch league to preview CFB vs NFL).
 * - Never hard-code a single league’s joke into the shared reader chrome.
 *
 * Window: calendar week before opening week (CFB Week 0 / NFL Week 1) until open.
 * Subject: Trophy Room defending championship (else prior-season seed for that sport).
 *
 * Copy: CFB inaugural (champ year = PRIOR_SEASON_YEAR) is LOCKED. Later CFB years
 * and all NFL years mix banks by league + season + sport + champ (with pack memory).
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
  masthead: "THE WAR ROOM DISPATCH",
  tagline: "All the news that's fit to roast",
  network: "Dispatch Network",
  desk: "Investigative Desk",
  bugLabel: "DISPATCH · LIVE",
} as const;

/** Foundry / creator: open broadcast without leaving the page. */
export const EVENT_FORCE_WEEKLY_COLD_OPEN = "warroom-force-weekly-cold-open";

/** Founder-approved 2026 production release: Aug 17 at midnight Eastern. */
export const COLD_OPEN_RELEASE_MS = Date.parse("2026-08-17T00:00:00-04:00");

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
  /** Under the wanted carton — sport-specific */
  cartonBanner: string;
  /** Short sport tag for chrome (CFB / NFL) */
  sportTag: string;
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
 * Preseason cold-open window: founder release date until season starts.
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
  return nowMs >= COLD_OPEN_RELEASE_MS && nowMs < openMs;
}

/**
 * Resolve last year’s championship trophy holder for the cold open.
 * Prefers live Trophy Room championships (any sport/league); falls back to
 * sport-specific prior-season seed so empty rooms still get a face.
 *
 * Champ year comes from hardware — returning crews in future seasons re-open
 * Cold Open when a new championship year is on the wall.
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
  hardwareLabel: string;
  room: string;
  dayLabel: string;
  /** e.g. Week 0 / Opening Weekend */
  openLabel: string;
  /** e.g. week before Week 0 */
  weekBeforeLabel: string;
  cartonBanner: string;
  sportTag: string;
};

// ── Independent banks (mix freely; product = lots of unique packages) ─
// Sport-specific nouns always come from CopyCtx (never hard-code crystal on NFL).

const WANTED_BANK: ((c: CopyCtx) => string)[] = [
  () => "Have you seen this man?",
  () => "WANTED: defending champ — season is open for hunting",
  () => "TARGET ACQUIRED · TITLE STILL WARM",
  () => "FACE OF THE ROOM — THE HUNT BEGINS",
  () => "ALERT: reigning champ · bounty on the hardware",
  () => "MILK CARTON MONDAY · COMPETITION BREWING",
  () => "HAVE YOU SEEN THIS TARGET?",
  () => "PERSON OF INTEREST · TROPHY DIVISION",
  (c) =>
    c.sport === "nfl"
      ? "IF FOUND: strip the Super Bowl bragging rights, keep the grudge"
      : "IF FOUND: return the crystal, keep the grudge",
  () => "CHAMP WATCH · EVERYONE IS COMING",
  () => "PUBLIC SERVICE ANNOUNCEMENT · LOAD UP",
  () => "THE BOARD REMEMBERS THIS FACE",
];

const HEADLINE_BANK: ((c: CopyCtx) => string)[] = [
  (c) => `${c.name}: known time traveler — some even say a cheat`,
  (c) => `${c.name} still has the ${c.hardwareShort}. The room wants it back.`,
  (c) => `BREAKING: ${c.name} is the one everyone has to beat`,
  (c) => `Champ watch: ${c.name} walks into a room that wants blood`,
  (c) => `${c.name} put a target on their own back. Season hasn’t started. War has.`,
  (c) => `Room opens fire on ${c.name}: prove it again or hand it over`,
  (c) => `${c.name}’s ${c.year} title still haunts the group chat — and fuels it`,
  (c) => `Is ${c.name} lucky… or already ahead of your first lock?`,
  (c) => `${c.name} enters ${c.year + 1} as prey. The field is hungry.`,
  (c) => `Defending champ ${c.name}: hero last year, bounty this year`,
  (c) => `${c.name} won it. Now every card is a rematch.`,
  (c) => `${c.name} — reigning ${c.hardwareShort} holder, public enemy #1`,
  (c) => `Investigative Desk vs ${c.name}: the chase is the story`,
  (c) => `${c.name} won last year. Kalshi priced the hangover. The room priced the hunt.`,
];

const BODY_BANK: ((c: CopyCtx) => string)[] = [
  (c) =>
    `Dispatch Network has it on the record: ${c.nameCall} is a known time traveler. ` +
    `Room veterans have long whispered that the reigning champ (${c.year} ${c.hardware}) ` +
    `somehow always knows next week’s scores before the rest of us lock. ` +
    `Some even say a cheat. Investigative Desk has not recovered a DeLorean — ` +
    `but the pattern is hard to unsee. This is the week-before package: ` +
    `face on the carton, name in the paper, target on their back. ` +
    `Competition is not “starting soon.” It’s already brewing.`,
  (c) =>
    `Preseason drop from the ${c.room} desk: ${c.nameCall} still holds the ${c.year} ${c.hardware}. ` +
    `That means one thing — every card this year is a heist attempt. ` +
    `Witnesses report clean Best Bets, early locks, and a smirk that says “I already saw the box score.” ` +
    `We print faces, not excuses. The room is loading up. Have you seen this man?`,
  (c) =>
    `${c.nameCall} raised the ${c.hardwareShort} last season. Now the carton is out. ` +
    `Sources close to the locker insist it’s skill. Sources closer to the standings insist it’s sorcery. ` +
    `Either way, ${c.dayLabel} energy is building and the room wants a rematch more than a parade. ` +
    `This is not a memorial. It’s a starting gun.`,
  (c) =>
    `Last year’s champion is ${c.nameCall}. This year’s bulletin is simple: remember the face — then beat it. ` +
    `The ${c.year} ${c.hardware} doesn’t defend itself. You do. They do. The board keeps score. ` +
    `Whispers of time travel and props that aged like prophecy only make the chase sweeter. ` +
    `We can’t prove cheat codes. We can open season with a wanted poster.`,
  (c) =>
    `If you forgot who won, the hardware didn’t: ${c.nameCall}, ${c.year}. ` +
    `The War Room does not do quiet title defenses. We do cartons, markets, and group-chat forensics. ` +
    `Some say traveler. Some say cheat. Most are already picking their upset card. ` +
    `This package airs once — then the season starts hunting.`,
  (c) =>
    `Case file ${c.year}-${c.name.replace(/\s+/g, "").slice(0, 12).toUpperCase()}: ` +
    `subject ${c.nameCall} last seen clutching ${c.hardware}. ` +
    `MO includes locking early, talking late, and finishing first. ` +
    `Known associates: confidence points, Best Bets, and a room full of people practicing “I told you so.” ` +
    `Reward for unseating them: eternal bragging rights and a new face on next year’s carton. ` +
    `Excitement is not optional. Competition is the product.`,
  (c) =>
    `Dispatch Network special: the week before ${c.dayLabel}, we put the champ on blast. ` +
    `${c.nameCall} is the defending ${c.hardwareShort} holder. ` +
    `That is not a compliment — it’s a bounty notice. ` +
    `The field is deep. The juice is live. The target is public. ` +
    `What is confirmed: their profile pic is now public domain for roasting — and motivation.`,
  (c) =>
    `${c.room} tradition: last year’s winner gets the preseason carton. ` +
    `This year that’s ${c.nameCall}. They won the ${c.year} ${c.hardware}. ` +
    `The room is jealous. Kalshi is not bullish on a repeat. ` +
    `Some even say a cheat. We say the chase is open — prove the market wrong, or prove the haters right.`,
  (c) =>
    `Anatomy of a target: ${c.nameCall} took home the ${c.year} title hardware. ` +
    `Now every ${c.dayLabel} is a referendum. Veterans swear the picks arrive from the future. ` +
    `Newcomers just see a face and a name — and a reason to lock with bad intentions. ` +
    `Investigative Desk: unconfirmed traveler, unconfirmed cheat, certain they are hunted.`,
  (c) =>
    `Reigning champ ${c.nameCall} walks into ${c.room} with last year’s ${c.hardwareShort} still warm. ` +
    `That’s not a victory lap. That’s blood in the water. ` +
    `Punchline writes itself — unless they three-peat, in which case we print a dynasty special. ` +
    `Until then: carton energy, maximum disrespect, and a season that starts the second you feel the heat.`,
];

const KALSHI_BANK: ((c: CopyCtx) => string)[] = [
  (c) =>
    `Kalshi odds have ${c.name} definitely not winning this year. Markets price the edge as spent. The board is open — the tape says the field is coming.`,
  (c) =>
    `Markets update: Kalshi has ${c.name} as a fade. Repeat titles are lottery tickets. The room just bought tickets to the hunt.`,
  (c) =>
    `Kalshi: ${c.name} to defend? Traders say “absolutely not.” The room says “watch this.” Only pride pays out either way.`,
  (c) =>
    `According to Kalshi, ${c.name} is not winning it again. According to ${c.name}, the market is a clown. Competition will settle it.`,
  (c) =>
    `Kalshi lists ${c.name} as “definitely not” this year’s champ. Bold. Print it. Frame it. Let the season argue.`,
  (c) =>
    `Contract watch: ${c.name} repeat = longshot. The tape is cold. The target on their back is red hot.`,
  (c) =>
    `Prediction markets buried ${c.name}. History says champs get hunted. Math says the field is deep. Drama says load your card.`,
  (c) =>
    `Kalshi: ${c.name} ❌ this year. Dispatch: face on the carton anyway — because nothing fuels a room like a public fade.`,
  (c) =>
    `Oddsmakers say ${c.name} is not the pick. The carton stays up. Hope is not a strategy. Locking is.`,
  (c) =>
    `Kalshi prices a ${c.name} defense as fantasy. The War Room prices it as fuel. Same headline. Different heart rate.`,
];

const CTA_BANK = [
  "I'm hunting — open the room",
  "Alright — season's on",
  "Load my card energy",
  "Close carton · start beef",
  "The chase is open",
  "Back to the War Room — locks soon",
];

const EDITION_BANK: ((c: CopyCtx) => string)[] = [
  (c) =>
    `Once per season · week before open · ${c.year} champ package · ${c.room} · competition brewing`,
  (c) =>
    `Preseason exclusive · ${c.room} · the hunt is the product`,
  (c) =>
    `Dispatch carton drop · one view · then the season eats the evidence`,
  (c) =>
    `${c.dayLabel} approaches · ${c.name} on notice · you on notice too`,
  (c) =>
    `Edition mix unique to this league + season · new year, new chase`,
];

const FOOT_BANK: ((c: CopyCtx) => string)[] = [
  (c) =>
    c.sport === "nfl"
      ? "One-time preseason drop — the week before Week 1. Heat first. Kickoffs next. The board is waiting."
      : "One-time preseason drop — the week before Week 0. Heat first. Saturdays next. The board is waiting.",
  () =>
    "This carton airs once. Then it’s locks, crowns, and receipts. The room is already awake.",
  (c) =>
    c.sport === "nfl"
      ? "Preseason only. No weekly reruns. Different room, different year, same hunger — take the Super Bowl energy back."
      : "Preseason only. No weekly reruns. Different room, different year, same hunger — take the crystal back.",
  () =>
    "You get one look. Then it’s confidence points and bad intentions. The Dispatch will be back with the scoreboard.",
];

/**
 * Sport lexicon — every player-facing noun for Cold Open.
 * CFB and NFL must never share the wrong hardware / day / open-week words.
 */
function sportBits(sport: "cfb" | "nfl", year: number) {
  if (sport === "nfl") {
    return {
      hardware: "Super Bowl hardware",
      hardwareShort: "Super Bowl title",
      hardwareLabel: `${year} Super Bowl champion`,
      dayLabel: "Sunday",
      openLabel: "Opening Weekend",
      weekBeforeLabel: "the week before Week 1",
      cartonBanner: "Last year's Super Bowl · target on back",
      sportTag: "NFL",
    };
  }
  return {
    hardware: "CFB championship crystal",
    hardwareShort: "CFB crystal",
    hardwareLabel: `${year} CFB War Room champion`,
    dayLabel: "Saturday",
    openLabel: "Week 0",
    weekBeforeLabel: "the week before Week 0",
    cartonBanner: "Last year's CFB championship · target on back",
    sportTag: "CFB",
  };
}

function champPhonetic(
  name: string,
  sport: "cfb" | "nfl"
): string | null {
  // Kahmann bit is CFB room lore — don't force it on NFL packages
  if (sport === "cfb" && isKahmann(name)) {
    return "Kahmann — pronounced COMMON";
  }
  return null;
}

function champNameCall(name: string, sport: "cfb" | "nfl"): string {
  if (sport === "cfb" && isKahmann(name)) {
    return `${name} (say it with us — COMMON)`;
  }
  if (sport === "nfl" && isMaria(name)) {
    return `${name} (defending Super Bowl energy)`;
  }
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
  const nameCall =
    isKahmann(ctx.name)
      ? `${ctx.name} (say it with us — COMMON)`
      : ctx.nameCall;
  const bits = sportBits("cfb", ctx.year);

  return {
    stamp: `${GAZETTE_STATION.callSign} · ${GAZETTE_STATION.desk}`,
    wanted: "Have you seen this man?",
    headline: `${ctx.name}: known time traveler — some even say a cheat`,
    phonetic: champPhonetic(ctx.name, "cfb"),
    body:
      `Dispatch Network has it on the record: ${nameCall} is a known time traveler. ` +
      `Room veterans have long whispered that the reigning CFB champ (${ctx.year} ${bits.hardware}) ` +
      `somehow always knows next Saturday’s scores before the rest of us lock. ` +
      `Some even say a cheat. Investigative Desk has not recovered a DeLorean — ` +
      `but the pattern is hard to unsee. This is the ${bits.weekBeforeLabel} package: ` +
      `face on the carton, name in the paper, target on their back. ` +
      `Week 0 hasn’t hit — and the competition is already brewing. ` +
      `Every college card this year is a heist attempt. Every Best Bet is a statement. ` +
      `If you’re new: this is the person the whole room wants to unseat. ` +
      `If you’re not: you already know. Load up.`,
    kalshi:
      `Kalshi odds have ${ctx.name} definitely not winning this CFB season. Markets price the time-travel edge as spent. The board is open — the field is hungry — the tape says the hunt is on.`,
    cta: "I'm hunting — open the room",
    ctaGazette: "Open The Dispatch",
    hardwareLabel: bits.hardwareLabel,
    cartonBanner: bits.cartonBanner,
    sportTag: bits.sportTag,
    foot:
      "One-time CFB preseason drop — the week before Week 0. Heat first. Saturdays next. After Week 1 is scored, The Dispatch drops as Week 2 opens with crowns, shame, and receipts.",
    packId: CFB_INAUGURAL_COLD_OPEN_PACK_ID,
    editionLine: `Once per season · week before Week 0 · ${ctx.year} CFB champ · ${ctx.room} · inaugural (locked) · competition brewing`,
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
    nameCall: champNameCall(name, sport),
    year,
    sport,
    hardware: bits.hardware,
    hardwareShort: bits.hardwareShort,
    hardwareLabel: bits.hardwareLabel,
    room,
    dayLabel: bits.dayLabel,
    openLabel: bits.openLabel,
    weekBeforeLabel: bits.weekBeforeLabel,
    cartonBanner: bits.cartonBanner,
    sportTag: bits.sportTag,
  };

  // ── LOCKED: CFB inaugural only (never runs for NFL) ──
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

  const bodyIdx =
    bi === 0 && hi === 0 && wi === 0
      ? hashStr(baseSeed + "|nudge") % BODY_BANK.length
      : bi;

  let body = BODY_BANK[bodyIdx]!(ctx);
  let headline = HEADLINE_BANK[hi]!(ctx);
  // CFB-only Kahmann spice
  if (sport === "cfb" && isKahmann(name) && !/COMMON/i.test(body)) {
    body +=
      " Pronunciation desk reminds the nation: Kahmann — COMMON. File it.";
  }
  // NFL-only Maria Super Bowl spice
  if (sport === "nfl" && isMaria(name) && hi % 2 === 0) {
    headline = `${name} still walks first — Super Bowl carton, week-before-Week-1 edition`;
  }

  const packId = `${sport}-w${wi}-h${hi}-b${bodyIdx}-k${ki}-c${ci}`;

  return {
    stamp: `${GAZETTE_STATION.callSign} · ${GAZETTE_STATION.desk}`,
    wanted: WANTED_BANK[wi]!(ctx),
    headline,
    phonetic: champPhonetic(name, sport),
    body,
    kalshi: KALSHI_BANK[ki]!(ctx),
    cta: CTA_BANK[ci]!,
    ctaGazette: "Open The Dispatch",
    hardwareLabel: bits.hardwareLabel,
    cartonBanner: bits.cartonBanner,
    sportTag: bits.sportTag,
    foot: FOOT_BANK[fi]!(ctx),
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
