/**
 * Bored practice — fully isolated from the live season.
 * Client-only fake week (not week 0 / not league active week).
 * Re-do until Week 0 kickoff, then the button dies.
 */

import { getLeague } from "@/lib/league";
import { hasOpeningWeekStarted } from "@/lib/ring-ceremony";
import type { Game, Prop, UserPick } from "@/lib/types";
import { scoreWeek, type GameResult } from "@/lib/scoring";

/** Not a real season index — never used as league current_week */
export const BORED_PRACTICE_WEEK = 99;

const ACTIVE_KEY = "warroom-bored-practice-active-v1";
const CARD_KEY = "warroom-bored-practice-card-v1";
const PICKS_KEY = "warroom-bored-practice-picks-v1";
const RESULTS_KEY = "warroom-bored-practice-results-v1";
const PENDING_DONE_KEY = "warroom-bored-practice-pending-done-v1";
export const EVENT_BORED_PRACTICE_DONE = "warroom-bored-practice-done";
/** Fired when practice mode starts or fully exits — app shell chrome listens */
export const EVENT_PRACTICE_MODE = "warroom-practice-mode";

function dispatchPracticeMode(active: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_PRACTICE_MODE, { detail: { active } })
    );
  } catch {
    /* ok */
  }
}

export type BoredPracticeState = {
  leagueId: string;
  weekNumber: number;
  runId: number;
  startedAt: string;
  sportId: string;
};

export type BoredLocalCard = {
  weekNumber: number;
  runId: number;
  games: Game[];
  prop: Prop;
  sportId: string;
  leagueId?: string;
};

export type BoredLocalPicks = {
  runId: number;
  picks: Record<string, UserPick>;
  bestBetId: string | null;
  propChoice: string | null;
  lockedAt: string | null;
  leagueId?: string;
};

export type BoredLocalResults = {
  runId: number;
  results: Record<string, GameResult>;
  propResult: string | null;
  scoredAt: string;
};

export type BoredPracticeRecap = {
  runId: number;
  totalPoints: number;
  correctCount: number;
  games: number;
  botRank: number;
  botField: number;
  weekLabel: string;
  /** Fake gazette teaser for the “next week feel” modal */
  gazetteHeadline: string;
  gazetteDeck: string;
  boardTease: string;
};

function canUse() {
  return typeof window !== "undefined";
}

function lid() {
  return getLeague()?.id || "local";
}

/** Practice button only before opening week kickoff. */
export function isBoredPracticeWindowOpen(sportId?: string | null): boolean {
  const sid = sportId ?? getLeague()?.sportId;
  return !hasOpeningWeekStarted(sid);
}

export function isBoredPracticeWeek(week: number): boolean {
  return week === BORED_PRACTICE_WEEK;
}

function readJson<T>(key: string): T | null {
  if (!canUse()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, val: unknown | null) {
  if (!canUse()) return;
  try {
    if (val == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignore */
  }
}

export function getBoredPracticeState(): BoredPracticeState | null {
  const s = readJson<BoredPracticeState>(ACTIVE_KEY);
  if (!s) return null;
  if (s.leagueId !== lid()) return null;
  if (!isBoredPracticeWindowOpen(s.sportId)) {
    clearBoredPracticeAll();
    return null;
  }
  return s;
}

export function isBoredPracticeActive(): boolean {
  return !!getBoredPracticeState();
}

export function markBoredPracticeStarted(
  sportId?: string | null
): BoredPracticeState {
  const prev = getBoredPracticeState();
  const sid = sportId || getLeague()?.sportId || prev?.sportId || "cfb";
  const next: BoredPracticeState = {
    leagueId: lid(),
    weekNumber: BORED_PRACTICE_WEEK,
    runId: (prev?.runId || 0) + 1,
    startedAt: new Date().toISOString(),
    sportId: sid === "nfl" ? "nfl" : "cfb",
  };
  writeJson(ACTIVE_KEY, next);
  writeJson(PICKS_KEY, null);
  writeJson(RESULTS_KEY, null);
  try {
    sessionStorage.removeItem(PENDING_DONE_KEY);
  } catch {
    /* ok */
  }
  dispatchPracticeMode(true);
  return next;
}

export function saveBoredLocalCard(card: BoredLocalCard) {
  writeJson(CARD_KEY, { ...card, leagueId: lid() });
}

export function loadBoredLocalCard(): BoredLocalCard | null {
  const card = readJson<BoredLocalCard & { leagueId?: string }>(CARD_KEY);
  if (!card) return null;
  if (card.leagueId && card.leagueId !== lid()) return null;
  const active = getBoredPracticeState();
  if (active && card.runId !== active.runId) return null;
  return card;
}

export function saveBoredLocalPicks(picks: BoredLocalPicks) {
  writeJson(PICKS_KEY, { ...picks, leagueId: lid() });
}

export function loadBoredLocalPicks(): BoredLocalPicks | null {
  const p = readJson<BoredLocalPicks & { leagueId?: string }>(PICKS_KEY);
  if (!p) return null;
  if (p.leagueId && p.leagueId !== lid()) return null;
  const active = getBoredPracticeState();
  if (active && p.runId !== active.runId) return null;
  return p;
}

export function saveBoredLocalResults(res: BoredLocalResults) {
  writeJson(RESULTS_KEY, { ...res, leagueId: lid() });
}

export function loadBoredLocalResults(): BoredLocalResults | null {
  const r = readJson<BoredLocalResults & { leagueId?: string }>(RESULTS_KEY);
  if (!r) return null;
  const active = getBoredPracticeState();
  if (active && r.runId !== active.runId) return null;
  return r;
}

export function clearBoredPracticeAll() {
  writeJson(ACTIVE_KEY, null);
  writeJson(CARD_KEY, null);
  writeJson(PICKS_KEY, null);
  writeJson(RESULTS_KEY, null);
  clearBoredPracticeDoneModal();
  dispatchPracticeMode(false);
}

/**
 * Leave practice completely — live season again.
 * Call before navigating to clean /picks or Home from any exit CTA.
 * Storage alone must never re-open the fake card on live routes.
 */
export function exitBoredPracticeToLive(): void {
  clearBoredPracticeAll();
}

/**
 * True only when URL explicitly opts into practice (?practice=1 or week=99).
 * Live /picks (no query) must NEVER auto-latch onto leftover practice storage.
 * That’s what locked users into graded fake weeks after Home showed real Week 1.
 */
export function isBoredPracticeUrl(
  search?: string | null
): boolean {
  if (typeof window === "undefined" && search == null) return false;
  try {
    const sp = new URLSearchParams(
      search ??
        (typeof window !== "undefined" ? window.location.search : "")
    );
    if (sp.get("practice") === "1") return true;
    const w = sp.get("week");
    if (w === "99" || w === String(BORED_PRACTICE_WEEK)) return true;
    return false;
  } catch {
    return false;
  }
}

function buildGazetteTease(
  totalPoints: number,
  botRank: number,
  botField: number,
  correctCount: number,
  games: number
): Pick<BoredPracticeRecap, "gazetteHeadline" | "gazetteDeck" | "boardTease"> {
  const name = "YOU";
  if (botRank === 1) {
    return {
      gazetteHeadline: `${name} STOMPS FAKE BOTS, DEMANDS A PARADE`,
      gazetteDeck: `${totalPoints} pts on a dry-run card. When the real week scores, this is the front-page energy — minus the robots.`,
      boardTease: `Board would put you #1 of ${botField} (practice bots). Real room = real names and real salt.`,
    };
  }
  if (botRank >= botField - 1) {
    return {
      gazetteHeadline: `TOILET WATCH: ${name} NEEDS A REBOOT`,
      gazetteDeck: `${correctCount}/${games} right, ${totalPoints} pts. Even the fake paper is roasting you. Try again before Week 0.`,
      boardTease: `You’d be near the bottom of the Board. That’s the shame lane — also how the room bonds.`,
    };
  }
  if (totalPoints >= 12) {
    return {
      gazetteHeadline: `SOLID CARD: ${name} IN THE MIX (BARELY FAMOUS)`,
      gazetteDeck: `${totalPoints} pts · ${correctCount}/${games}. Real Gazette drops after the commish scores — same vibe, meaner nicknames.`,
      boardTease: `Roughly #${botRank} of ${botField} on a fake field. Live Board updates when results post.`,
    };
  }
  return {
    gazetteHeadline: `WEEKLY PAPER: PRACTICE EDITION (NOBODY CARED)`,
    gazetteDeck: `${totalPoints} pts locked in. After a real week, Home lights up with Gazette, Board swings, and Locker trash.`,
    boardTease: `Practice rank #${botRank} of ${botField}. Next real Monday you’ll open the paper — this one doesn’t count.`,
  };
}

export function queueBoredPracticeDoneModal(recap: BoredPracticeRecap) {
  if (!canUse()) return;
  try {
    sessionStorage.setItem(
      PENDING_DONE_KEY,
      JSON.stringify({ ...recap, at: Date.now() })
    );
    window.dispatchEvent(new CustomEvent(EVENT_BORED_PRACTICE_DONE));
  } catch {
    /* ignore */
  }
}

function normalizeRecap(
  p: BoredPracticeRecap & { at?: number }
): BoredPracticeRecap | null {
  if (p.at && Date.now() - p.at > 60 * 60_000) return null;
  // Back-compat if old recap missing tease fields
  if (!p.gazetteHeadline) {
    const t = buildGazetteTease(
      p.totalPoints,
      p.botRank,
      p.botField,
      p.correctCount,
      p.games
    );
    return { ...p, ...t };
  }
  return p;
}

/**
 * Peek pending done modal without consuming.
 * Strict Mode remounts would lose the recap if we always take() on mount.
 */
export function peekBoredPracticeDoneModal(): BoredPracticeRecap | null {
  if (!canUse()) return null;
  try {
    const raw = sessionStorage.getItem(PENDING_DONE_KEY);
    if (!raw) return null;
    return normalizeRecap(JSON.parse(raw) as BoredPracticeRecap & { at?: number });
  } catch {
    return null;
  }
}

/** Consume pending done modal (call on dismiss / do-it-again). */
export function takeBoredPracticeDoneModal(): BoredPracticeRecap | null {
  if (!canUse()) return null;
  try {
    const raw = sessionStorage.getItem(PENDING_DONE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_DONE_KEY);
    return normalizeRecap(JSON.parse(raw) as BoredPracticeRecap & { at?: number });
  } catch {
    return null;
  }
}

export function clearBoredPracticeDoneModal() {
  if (!canUse()) return;
  try {
    sessionStorage.removeItem(PENDING_DONE_KEY);
  } catch {
    /* ok */
  }
}

/** Local auto-score of the practice card (never touches live week_results). */
export function scoreBoredPracticeLocally(): {
  ok: boolean;
  recap?: BoredPracticeRecap;
  message?: string;
} {
  const active = getBoredPracticeState();
  const card = loadBoredLocalCard();
  const mine = loadBoredLocalPicks();
  if (!active || !card || !mine?.lockedAt) {
    return { ok: false, message: "Practice card not locked yet." };
  }

  // Random ATS outcomes for the fake slate only
  const results: Record<string, GameResult> = {};
  for (const g of card.games) {
    const r = Math.random();
    const winner: "home" | "away" | "push" =
      r < 0.08 ? "push" : r < 0.54 ? "home" : "away";
    results[g.id] = { gameId: g.id, winner };
  }
  const propResult =
    card.prop.options[Math.random() < 0.5 ? 0 : 1] || card.prop.options[0];

  saveBoredLocalResults({
    runId: active.runId,
    results,
    propResult,
    scoredAt: new Date().toISOString(),
  });

  const scored = scoreWeek(
    mine.picks,
    mine.bestBetId,
    mine.propChoice,
    card.games,
    results,
    card.prop,
    propResult,
    false
  );

  // Fake bot field for rank vibe
  const botField = 12;
  const myPts = scored.totalPoints;
  let better = 0;
  for (let i = 0; i < botField - 1; i++) {
    const botPts = Math.floor(Math.random() * 22);
    if (botPts > myPts) better += 1;
  }
  const botRank = better + 1;

  const tease = buildGazetteTease(
    myPts,
    botRank,
    botField,
    scored.correctCount,
    card.games.length
  );

  const recap: BoredPracticeRecap = {
    runId: active.runId,
    totalPoints: myPts,
    correctCount: scored.correctCount,
    games: card.games.length,
    botRank,
    botField,
    weekLabel: "Practice week",
    ...tease,
  };
  queueBoredPracticeDoneModal(recap);
  return { ok: true, recap };
}

export function isBoredPracticeScoringAllowed(): boolean {
  // Local score always allowed while practice window open
  return isBoredPracticeActive() && isBoredPracticeWindowOpen();
}
