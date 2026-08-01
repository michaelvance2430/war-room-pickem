/**
 * Gazette copy engine — unique templates per league-season, then forever via
 * combinatorial lines (no AI required).
 *
 * - First pass through a bank: each week gets an unused template index.
 * - Rebuilding the same week reuses that week's assignment (stable re-score).
 * - When the bank is exhausted: combinatorial generators (or a fresh cycle).
 */

import { getLeague } from "./league";
import { defaultSeasonYear } from "./trophies";

const STORAGE_KEY = "warroom-gazette-copy-v1";

type BankState = {
  /** Template indices already used this season (first-pass uniqueness) */
  used: number[];
  /** weekIndex → template index (stable rebuilds) */
  byWeek: Record<string, number>;
  /** How many combo generations we've minted this season */
  comboGen: number;
};

type LeagueYearState = Record<string, BankState>; // bankKey → state
type RootStore = Record<string, LeagueYearState>; // `${leagueId}:${year}` → …

function canStore(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readStore(): RootStore {
  if (!canStore()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as RootStore;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeStore(store: RootStore) {
  if (!canStore()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota — keep going without persistence */
  }
}

function seasonKey(leagueId: string, year: number): string {
  return `${leagueId}:${year}`;
}

function weekKey(weekIndex: number, offset: number): string {
  return `${weekIndex}:${offset}`;
}

function emptyBank(): BankState {
  return { used: [], byWeek: {}, comboGen: 0 };
}

function getBank(
  store: RootStore,
  leagueId: string,
  year: number,
  bankKey: string
): BankState {
  const sk = seasonKey(leagueId, year);
  if (!store[sk]) store[sk] = {};
  if (!store[sk][bankKey]) store[sk][bankKey] = emptyBank();
  const b = store[sk][bankKey];
  if (!Array.isArray(b.used)) b.used = [];
  if (!b.byWeek || typeof b.byWeek !== "object") b.byWeek = {};
  if (typeof b.comboGen !== "number") b.comboGen = 0;
  return b;
}

export type BankPickResult = {
  /** Index into the bank when mode === "bank" */
  index: number;
  mode: "bank" | "combo";
  /** Salt for combinatorial generators */
  comboSalt: number;
};

/**
 * Pick a template slot for this league / season / bank / week.
 * Stable across rebuilds of the same week.
 */
export function pickBankSlot(opts: {
  bankKey: string;
  bankLen: number;
  weekIndex: number;
  offset?: number;
  leagueId?: string | null;
  seasonYear?: number;
}): BankPickResult {
  const bankLen = Math.max(0, opts.bankLen | 0);
  const weekIndex = opts.weekIndex | 0;
  const offset = opts.offset ?? 0;
  const leagueId =
    opts.leagueId || getLeague()?.id || "local";
  const year = opts.seasonYear ?? defaultSeasonYear();
  const wk = weekKey(weekIndex, offset);

  if (bankLen <= 0) {
    return { index: 0, mode: "combo", comboSalt: weekIndex * 17 + offset };
  }

  const store = readStore();
  const bank = getBank(store, leagueId, year, opts.bankKey);

  // Stable: same week always gets the same slot
  if (bank.byWeek[wk] != null && Number.isFinite(bank.byWeek[wk])) {
    const idx = bank.byWeek[wk]!;
    if (idx >= 0 && idx < bankLen) {
      return { index: idx, mode: "bank", comboSalt: 0 };
    }
    // Combo assignment stored as negative: -1 - salt
    if (idx < 0) {
      const salt = -idx - 1;
      return { index: 0, mode: "combo", comboSalt: salt };
    }
  }

  const used = new Set(bank.used.filter((i) => i >= 0 && i < bankLen));
  const preferred =
    (((weekIndex + offset) % bankLen) + bankLen) % bankLen;

  // First-pass uniqueness: walk from preferred until free
  for (let step = 0; step < bankLen; step++) {
    const tryIdx = (preferred + step) % bankLen;
    if (!used.has(tryIdx)) {
      bank.used.push(tryIdx);
      bank.byWeek[wk] = tryIdx;
      writeStore(store);
      return { index: tryIdx, mode: "bank", comboSalt: 0 };
    }
  }

  // Bank exhausted this season → combinatorial forever
  bank.comboGen = (bank.comboGen || 0) + 1;
  const salt =
    weekIndex * 997 +
    offset * 131 +
    bank.comboGen * 17 +
    hashStr(`${leagueId}:${year}:${opts.bankKey}:${wk}`);
  bank.byWeek[wk] = -1 - (salt >>> 0);
  writeStore(store);
  return { index: 0, mode: "combo", comboSalt: salt >>> 0 };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Wipe copy memory for a league (season reset). */
export function clearGazetteCopyForLeague(leagueId: string): void {
  if (!leagueId || !canStore()) return;
  const store = readStore();
  const prefix = `${leagueId}:`;
  for (const k of Object.keys(store)) {
    if (k.startsWith(prefix) || k === leagueId) delete store[k];
  }
  writeStore(store);
}

// ── Combinatorial “forever” banks (hand-authored slots, infinite mix) ──

const CROWN_OPEN = [
  "STOP THE PRESSES",
  "BREAKING",
  "OFFICIAL",
  "WAR ROOM WIRE",
  "HOT OFF THE DESK",
  "ABSOLUTE UNIT ALERT",
  "PRINT IT HUGE",
  "LEAGUE MEMO",
] as const;

const CROWN_VERB = [
  "COOKS",
  "FLAMES",
  "OWNS",
  "DROPS",
  "STACKS",
  "NUKES",
  "SURGERIES",
  "LECTURES",
] as const;

const CROWN_TAIL = [
  "LEAGUE IN SHAMBLES",
  "ZERO APOLOGIES",
  "EVERYONE ELSE IS TYPING",
  "STANDINGS GRAPH ON FIRE",
  "CONFIDENCE LOOKS EASY",
  "VEGAS WANTS A REFUND",
  "MAIN CHARACTER ENERGY",
  "CAP TIPPED MANDATORY",
] as const;

const SHAME_OPEN = [
  "WALL OF SHAME",
  "PAPER BAG DEPT",
  "EMERGENCY BROADCAST",
  "LOWLIGHT REEL",
  "FRAUD WATCH",
  "TOILET BOWL SCOUTING",
  "GPS TO THE CUT",
  "CRIME SCENE UNIT",
] as const;

const SHAME_VERB = [
  "FLATLINES",
  "SCRAPES",
  "GHOSTS",
  "MISSES",
  "SELF-DESTRUCTS",
  "SPEEDRUNS SHAME",
  "INVENTS NEW WAYS TO LOSE",
  "BRINGS A BUTTER KNIFE TO A GUNFIGHT",
] as const;

function pickSlot<T extends readonly string[]>(
  arr: T,
  salt: number,
  mult: number
): string {
  return arr[(salt * mult) % arr.length]!;
}

export type HN = (n: string, pts: number) => string;
export type DK = (pts: number) => string;

export function comboCrownHeadline(salt: number): HN {
  return (n, pts) => {
    const open = pickSlot(CROWN_OPEN, salt, 1);
    const verb = pickSlot(CROWN_VERB, salt, 3);
    const tail = pickSlot(CROWN_TAIL, salt, 7);
    const style = salt % 4;
    const N = n.toUpperCase();
    if (style === 0) return `${open}: ${N} ${verb} FOR ${pts} — ${tail}`;
    if (style === 1) return `${N} ${verb} (${pts} PTS) — ${tail}`;
    if (style === 2) return `${open} · ${N} AT ${pts} · ${tail}`;
    return `${N} POSTS ${pts}: ${verb}. ${tail}`;
  };
}

export function comboCrownDeck(salt: number): DK {
  const bits = [
    (pts: number) =>
      `${pts} on the card. Tip the cap or start a conspiracy group chat.`,
    (pts: number) =>
      `A ${pts}-point clinic. The rest of the room is writing apology essays.`,
    (pts: number) =>
      `${pts} hits different when you locked it like you had the answer key.`,
    (pts: number) =>
      `Hot take ticker cannot keep up. ${pts} broke the teleprompter again.`,
    (pts: number) =>
      `Season résumé just got a bold bullet: ${pts} this week. Everyone else: italics.`,
    (pts: number) =>
      `${pts}. That is not luck — that is a public service announcement.`,
  ];
  return bits[salt % bits.length]!;
}

export function comboShameHeadline(salt: number): HN {
  return (n, pts) => {
    const open = pickSlot(SHAME_OPEN, salt, 1);
    const verb = pickSlot(SHAME_VERB, salt, 5);
    const N = n.toUpperCase();
    const style = salt % 3;
    if (style === 0) return `${open} HIRES ${N} (${pts} PTS)`;
    if (style === 1) return `${N} ${verb} AT ${pts} — SEND SNACKS`;
    return `${open}: ${N} WITH A CRISP ${pts}`;
  };
}

export function comboShameDeck(salt: number): DK {
  const bits = [
    (pts: number) =>
      `${pts} points. That is not a strategy. That is a cry for help.`,
    (pts: number) =>
      `A ${pts}-spot on the ledger. Brown paper bag still in stock.`,
    (pts: number) =>
      `${pts}. Toilet Bowl just sent a friend request. Accept it.`,
    (pts: number) =>
      `Lowlight reel locked at ${pts}. Locker Room is open for comments.`,
    (pts: number) =>
      `${pts} points. Go touch grass. Then touch a better dog.`,
    (pts: number) =>
      `Scientists baffled how ${pts} fits on a five-game card. We are not.`,
  ];
  return bits[salt % bits.length]!;
}

export function comboSoloHeadline(salt: number): HN {
  return (n, pts) => {
    const N = n.toUpperCase();
    const lines = [
      `${N} IS BOTH THE STORY AND THE SUBPLOT (${pts})`,
      `ONE-PERSON NEWS CYCLE: ${N} AT ${pts}`,
      `${N} SWEPT THE AWARDS AND THE APOLOGIES (${pts})`,
      `RANGE IS A SKILL: ${N} OWNS THE WHOLE PAPER (${pts})`,
      `FULL EDITION ENERGY: JUST ${N} (${pts} PTS)`,
      `CROWN AND BAG SHARE A HOUSE: ${N} (${pts})`,
    ];
    return lines[salt % lines.length]!;
  };
}

export function comboSoloDeck(salt: number): DK {
  const bits = [
    () => `Lonely at the top (and the bottom). Range is a skill.`,
    (pts: number) => `${pts} is the whole edition. Everyone else is classified ads.`,
    () => `When the league is small, you are the crown and the bag. Congrats?`,
    (pts: number) => `Single-name news day. ${pts} did double duty.`,
    () => `The paper only needed one byline. Awkward. Accurate.`,
    (pts: number) => `${pts} wore every hat. The rest of the room wore nothing.`,
  ];
  return bits[salt % bits.length]! as DK;
}

/** Generic forever spice when a bank has no dedicated combo. */
export function comboSpicePrefix(salt: number): string {
  const tags = [
    "DESK NOTE",
    "LATE EDITION",
    "REPRINT WITH FEELING",
    "SECOND CYCLE",
    "EXTRA EXTRA",
    "WIRE UPDATE",
    "REVISED COPY",
    "SEASON DEEP CUT",
  ];
  return tags[salt % tags.length]!;
}

/**
 * Pick from a bank of functions; on exhaust, use combo or spice-wrap a bank item.
 */
export function pickFromFnBank<T extends (...args: never[]) => string>(
  bankKey: string,
  list: T[],
  weekIndex: number,
  offset: number,
  combo?: (salt: number) => T
): T {
  const slot = pickBankSlot({
    bankKey,
    bankLen: list.length,
    weekIndex,
    offset,
  });
  if (slot.mode === "bank") {
    return list[slot.index]!;
  }
  if (combo) {
    return combo(slot.comboSalt);
  }
  // Spice-wrap a cycled bank item so it still reads “new”
  const base = list[slot.comboSalt % list.length]!;
  const prefix = comboSpicePrefix(slot.comboSalt);
  return ((...args: never[]) => {
    const core = base(...args);
    if (core.startsWith(prefix)) return core;
    return `${prefix}: ${core}`;
  }) as T;
}
