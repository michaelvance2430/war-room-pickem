import { createClient } from "@/lib/supabase/client";
import { getSession, getLeague, isOps } from "@/lib/league";
import {
  countByDivision,
  countByDivisionStrict,
  formatDivisionCounts,
  isLeagueDivisionBalanced,
  pickLeastPopulatedDivision,
  planMinMoveBalance,
  type DivisionName,
} from "@/lib/divisions";
import { Game, Prop, UserPick } from "@/lib/types";
import { scoreWeek, GameResult } from "@/lib/scoring";
import { weekTitle } from "@/lib/dates";
import { MAX_LEAGUE_PLAYERS, seatsRemaining } from "@/lib/league-limits";

// ── Hot-path TTL cache (nav / home / picks hit these constantly) ───────────

/** Board Phase-1 per-await timing (dev or warroom-runtime-debug=1). */
function wrBoardP1(name: string, phase: "START" | "DONE" | "FAIL" | "CACHE" | "TIMEOUT", ms?: number, extra?: string) {
  try {
    const on =
      (typeof process !== "undefined" && process.env.NODE_ENV === "development") ||
      (typeof window !== "undefined" &&
        localStorage.getItem("warroom-runtime-debug") === "1");
    if (!on) return;
    const pad = name.padEnd(28, ".");
    if (phase === "START") {
      console.log(`[WR-PERF][board-p1] ${pad} START ${extra || ""}`);
    } else if (phase === "CACHE") {
      console.log(`[WR-PERF][board-p1] ${pad} CACHE_HIT ${extra || ""}`);
    } else if (phase === "TIMEOUT") {
      console.log(
        `[WR-PERF][board-p1] ${pad} TIMEOUT ${ms != null ? ms + " ms" : ""} ${extra || ""}`
      );
    } else {
      const d = ms != null ? `${ms} ms` : "";
      console.log(
        `[WR-PERF][board-p1] ${pad} ${d.padStart(10, " ")} ${phase} ${extra || ""}`
      );
    }
  } catch {
    /* ok */
  }
}

/** Race a promise so mobile never hangs forever on a stuck fetch. */
export function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  fallback: T,
  /** Optional label for board-p1 timeout diagnosis */
  timeoutLabel?: string
): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const t0 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      if (timeoutLabel) {
        const elapsed =
          typeof performance !== "undefined"
            ? Math.round(performance.now() - t0)
            : ms;
        wrBoardP1(timeoutLabel, "TIMEOUT", elapsed, `limit=${ms}ms`);
        // If event loop was starved, setTimeout fires far after `ms`
        if (elapsed > ms * 1.25) {
          try {
            void import("./event-loop-probe").then((m) =>
              m.wrTimeoutLate(timeoutLabel, ms, elapsed)
            );
          } catch {
            /* ok */
          }
        }
      }
      resolve(fallback);
    }, ms);
    p.then(
      (v) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(v);
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        if (timeoutLabel) {
          const elapsed =
            typeof performance !== "undefined"
              ? Math.round(performance.now() - t0)
              : ms;
          wrBoardP1(timeoutLabel, "FAIL", elapsed, "promise-reject→fallback");
        }
        resolve(fallback);
      }
    );
  });
}

type CacheEntry<T> = { at: number; value: T };
const cardCache = new Map<string, CacheEntry<CloudCard | null>>();
/** In-flight loadWeekCard — Standings→Picks + retries share one network hop. */
const cardInflight = new Map<string, Promise<CloudCard | null>>();
const publishedCache = new Map<string, CacheEntry<number[]>>();
const scoredCache = new Map<string, CacheEntry<number[]>>();
const activeWeekCache = new Map<string, CacheEntry<number>>();
/** Single-flight: one current_week network GET per league at a time. */
const activeWeekInflight = new Map<string, Promise<number>>();
const playersCache = new Map<
  string,
  CacheEntry<import("./types").Player[]>
>();
/** In-flight loadLeaguePlayers — standings + CrownAndShame share one round-trip. */
const playersInflight = new Map<
  string,
  Promise<import("./types").Player[]>
>();
// Typed as object[] here — LeagueRosterMember is declared later in this file
const rosterCache = new Map<string, CacheEntry<object[]>>();
const rosterInflight = new Map<string, Promise<object[]>>();
/**
 * Bumped on every roster invalidation. In-flight fetches capture the gen at
 * start and must not cacheSet if a newer invalidation landed (Auto Balance
 * race: stale pre-write read finishing after post-write refresh).
 */
const rosterGeneration = new Map<string, number>();
/** Join times for titles — single-flight + short TTL (avoids 404 spam). */
const joinedAtCache = new Map<string, CacheEntry<Map<string, string>>>();
const joinedAtInflight = new Map<string, Promise<Map<string, string>>>();
const JOINED_AT_TTL_MS = 60_000;
/**
 * Session capability for optional league_first_joins table.
 * null = unknown, true = works, false = missing (skip further requests).
 */
let leagueFirstJoinsAvailable: boolean | null = null;

const CARD_TTL_MS = 12_000;
const LIST_TTL_MS = 12_000;
/** Success + failure backoff for current_week reads (no stampede). */
const ACTIVE_WEEK_TTL_MS = 5_000;
/**
 * Was 15s — too short. Production stampede (Mike trace fcd0be18): 200+ concurrent
 * loadLeaguePlayers waiters while one network hop ran; resolve cascade froze UI.
 * Longer TTL + stale-while-revalidate below.
 */
const PLAYERS_TTL_MS = 120_000;
/** Serve stale standings up to this age while one background revalidate runs. */
const PLAYERS_STALE_MS = 10 * 60_000;
const ROSTER_TTL_MS = 60_000;
/** Last good card survives SPA remounts so My Picks paints from Standings. */
const PEEK_CARD_SS_PREFIX = "warroom-peek-card:";
const PEEK_CARD_SS_MAX_MS = 45 * 60_000;

function peekCardStorageKey(leagueId: string, weekNumber: number) {
  return `${PEEK_CARD_SS_PREFIX}${leagueId}:${weekNumber}`;
}

function readPersistedWeekCard(
  leagueId: string,
  weekNumber: number
): CloudCard | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(
      peekCardStorageKey(leagueId, weekNumber)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; card?: CloudCard };
    if (!parsed?.card?.games?.length) return null;
    if (
      typeof parsed.at === "number" &&
      Date.now() - parsed.at > PEEK_CARD_SS_MAX_MS
    ) {
      return null;
    }
    return parsed.card;
  } catch {
    return null;
  }
}

function writePersistedWeekCard(
  leagueId: string,
  weekNumber: number,
  card: CloudCard
) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      peekCardStorageKey(leagueId, weekNumber),
      JSON.stringify({ at: Date.now(), card })
    );
  } catch {
    /* quota / private mode */
  }
}

function clearPersistedWeekCard(leagueId: string, weekNumber?: number) {
  if (typeof window === "undefined") return;
  try {
    if (weekNumber != null) {
      sessionStorage.removeItem(peekCardStorageKey(leagueId, weekNumber));
      return;
    }
    const prefix = `${PEEK_CARD_SS_PREFIX}${leagueId}:`;
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(prefix)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string, ttl: number): T | undefined {
  const e = map.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > ttl) {
    map.delete(key);
    return undefined;
  }
  return e.value;
}

/** Return cached value even if past ttl, up to maxAge (stale-while-revalidate). */
function cacheGetStale<T>(
  map: Map<string, CacheEntry<T>>,
  key: string,
  freshTtl: number,
  maxAge: number
): { value: T; fresh: boolean; ageMs: number } | undefined {
  const e = map.get(key);
  if (!e) return undefined;
  const ageMs = Date.now() - e.at;
  if (ageMs > maxAge) {
    map.delete(key);
    return undefined;
  }
  return { value: e.value, fresh: ageMs <= freshTtl, ageMs };
}

function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, value: T) {
  map.set(key, { at: Date.now(), value });
}

/** After publish / score / card edit — drop stale reads. */
export function invalidateCloudWeekCaches(leagueId?: string | null) {
  try {
    // Feedback-loop detector: clearing playersCache forces every caller to re-network
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logPlayersCacheInvalidate } =
      require("./profile-nav-trace") as typeof import("./profile-nav-trace");
    logPlayersCacheInvalidate(
      leagueId ? `league=${String(leagueId).slice(0, 8)}` : "all-leagues"
    );
  } catch {
    /* ok */
  }
  if (!leagueId) {
    cardCache.clear();
    cardInflight.clear();
    publishedCache.clear();
    scoredCache.clear();
    activeWeekCache.clear();
    activeWeekInflight.clear();
    playersCache.clear();
    playersInflight.clear();
    rosterCache.clear();
    rosterInflight.clear();
    for (const k of [...rosterGeneration.keys()]) {
      rosterGeneration.set(k, (rosterGeneration.get(k) || 0) + 1);
    }
    joinedAtCache.clear();
    joinedAtInflight.clear();
    // Do not reset leagueFirstJoinsAvailable — schema does not change mid-session
    return;
  }
  for (const k of [...cardCache.keys()]) {
    if (k.startsWith(`${leagueId}:`)) cardCache.delete(k);
  }
  for (const k of [...cardInflight.keys()]) {
    if (k.startsWith(`${leagueId}:`)) cardInflight.delete(k);
  }
  clearPersistedWeekCard(leagueId);
  publishedCache.delete(leagueId);
  scoredCache.delete(leagueId);
  activeWeekCache.delete(leagueId);
  activeWeekInflight.delete(leagueId);
  playersCache.delete(leagueId);
  playersInflight.delete(leagueId);
  rosterCache.delete(leagueId);
  rosterInflight.delete(leagueId);
  rosterGeneration.set(
    leagueId,
    (rosterGeneration.get(leagueId) || 0) + 1
  );
  joinedAtCache.delete(leagueId);
  joinedAtInflight.delete(leagueId);
}

/** weekly_points from Postgres may be int[] or a JSON object map. */
function normalizeWeeklyPointsField(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    });
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const keys = Object.keys(obj)
      .map((k) => parseInt(k, 10))
      .filter((k) => !Number.isNaN(k));
    if (!keys.length) return [];
    const max = Math.max(...keys);
    const arr = new Array(max + 1).fill(0);
    for (const k of keys) {
      const n = Number(obj[String(k)]);
      arr[k] = Number.isFinite(n) ? n : 0;
    }
    return arr;
  }
  return [];
}

export interface CloudCard {
  weekCardId: string;
  weekNumber: number;
  games: Game[];
  prop: Prop;
  /** ISO time card was last published/updated — used for live refresh */
  publishedAt?: string | null;
}

/** Stable string so clients can detect when the commissioner changes the card. */
export function cardRevision(card: {
  weekNumber: number;
  publishedAt?: string | null;
  games: Game[];
  prop: Prop;
}): string {
  const gamesKey = card.games
    .map(
      (g) =>
        `${g.id}|${g.awayTeam}|${g.homeTeam}|${g.spread}|${g.favorite}|${g.commenceTime || g.startTime || ""}`
    )
    .join(";");
  return [
    card.weekNumber,
    card.publishedAt || "",
    card.prop.question,
    card.prop.options.join("|"),
    gamesKey,
  ].join("::");
}

/** Ops (commissioner or deputy) set which week everyone should see. */
export async function setLeagueActiveWeek(
  weekNumber: number
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !isOps()) {
    return { ok: false, error: "Commissioner or deputy required" };
  }
  // Eyes: only move local preview week — never leagues.current_week
  try {
    const eyes = await import("./creator-eyes");
    if (eyes.isEyesLocalPlayActive()) {
      try {
        const { writeScopedActiveWeek } = await import(
          "./active-week-storage"
        );
        const { getLeague } = await import("./league");
        writeScopedActiveWeek(weekNumber, {
          userId: session.playerId,
          leagueId: session.leagueId,
          sportId: getLeague()?.sportId,
        });
      } catch {
        /* ignore */
      }
      eyes.applyEyesWeek(weekNumber);
      cacheSet(activeWeekCache, session.leagueId, weekNumber);
      activeWeekInflight.delete(session.leagueId);
      return { ok: true };
    }
  } catch {
    /* real path */
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("leagues")
    .update({ current_week: weekNumber })
    .eq("id", session.leagueId);
  if (error) return { ok: false, error: error.message };
  try {
    const { writeScopedActiveWeek } = await import("./active-week-storage");
    const { getLeague } = await import("./league");
    writeScopedActiveWeek(weekNumber, {
      userId: session.playerId,
      leagueId: session.leagueId,
      sportId: getLeague()?.sportId,
    });
  } catch {
    /* ignore */
  }
  // Fresh week for all readers immediately
  cacheSet(activeWeekCache, session.leagueId, weekNumber);
  activeWeekInflight.delete(session.leagueId);
  // Tenure for Elite Commish — true commissioner only (not deputies)
  if (session.isCommissioner && session.playerId) {
    try {
      const { recordCommissionerWeek } = await import("./commish-tenure");
      recordCommissionerWeek({
        userId: session.playerId,
        leagueId: session.leagueId,
        weekNumber,
      });
    } catch {
      /* ignore */
    }
  }
  return { ok: true };
}

function shouldLogCurrentWeek(): boolean {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    return true;
  }
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("warroom-runtime-debug") === "1";
  } catch {
    return false;
  }
}

function wrCurrentWeekLog(
  msg: string,
  leagueId: string,
  stack?: string
) {
  if (!shouldLogCurrentWeek()) return;
  try {
    if (stack) {
      console.log(`[WR-CURRENT-WEEK] ${msg} league=${leagueId}`, stack);
    } else {
      console.log(`[WR-CURRENT-WEEK] ${msg} league=${leagueId}`);
    }
  } catch {
    /* ok */
  }
}

/**
 * Active pick'em week for the league (local first, cloud refresh, short TTL).
 * Single-flight per leagueId — concurrent callers share one network GET.
 */
export async function loadLeagueActiveWeek(): Promise<number> {
  try {
    const { foundryLiveWeek } = await import("./foundry-live-adapter");
    const week = foundryLiveWeek();
    if (week != null) return week;
  } catch { /* fall through */ }
  try {
    const { profileNavLeagueWork } = await import("./profile-nav-trace");
    profileNavLeagueWork("loadLeagueActiveWeek", "call");
  } catch {
    /* ok */
  }
  // Creator Eyes: stay on the week you're previewing (no standalone Test Mode)
  try {
    const eyes = await import("./creator-eyes");
    if (eyes.isEyesLocalPlayActive()) {
      const { loadCreatorSandbox } = await import("./creator-sandbox");
      const s = loadCreatorSandbox();
      if (s.enabled) return s.weekNumber;
    }
  } catch {
    /* ignore */
  }
  const session = getSession();
  let sportId: string | null = null;
  try {
    const { getLeague } = await import("./league");
    sportId = getLeague()?.sportId || null;
  } catch {
    sportId = null;
  }
  let fallbackWeek = sportId === "nfl" ? 1 : 0;
  try {
    const { readActiveWeekFallback } = await import("./active-week-storage");
    fallbackWeek = readActiveWeekFallback({
      userId: session?.playerId,
      leagueId: session?.leagueId,
      sportId,
    });
  } catch {
    try {
      const { firstSeasonWeek } = await import("./season-calendar");
      fallbackWeek = firstSeasonWeek(sportId);
    } catch {
      /* keep */
    }
  }
  if (!session?.leagueId) return fallbackWeek;

  const leagueId = session.leagueId;
  const cached = cacheGet(activeWeekCache, leagueId, ACTIVE_WEEK_TTL_MS);
  if (cached != null) return cached;

  const existing = activeWeekInflight.get(leagueId);
  if (existing) {
    wrCurrentWeekLog("join-inflight", leagueId);
    return existing;
  }

  const promise = (async (): Promise<number> => {
    let week = fallbackWeek;

    // Diagnostics: count real network attempts only (not joiners)
    try {
      const g = globalThis as unknown as {
        __WR_CW_N?: number;
        __WR_CW_INFLIGHT?: number;
      };
      g.__WR_CW_N = (g.__WR_CW_N || 0) + 1;
      g.__WR_CW_INFLIGHT = (g.__WR_CW_INFLIGHT || 0) + 1;
      const n = g.__WR_CW_N;
      const inflight = g.__WR_CW_INFLIGHT;
      let route = "";
      try {
        route = typeof window !== "undefined" ? window.location.pathname : "";
      } catch {
        /* ok */
      }
      const stack =
        typeof Error !== "undefined"
          ? (new Error().stack || "").split("\n").slice(1, 8).join(" | ")
          : "";
      wrCurrentWeekLog(
        `#${n} NET inflight=${inflight} route=${route} t=${Date.now()}`,
        leagueId,
        stack
      );
    } catch {
      /* ok */
    }

    let failed = false;
    const q0 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    wrBoardP1("leagues.current_week", "START");
    try {
      const supabase = createClient();
      const data = await withTimeout(
        (async () => {
          const { data: row, error } = await supabase
            .from("leagues")
            .select("current_week")
            .eq("id", leagueId)
            .maybeSingle();
          if (error) throw error;
          return row;
        })(),
        6_000,
        null,
        "leagues.current_week"
      );
      const qMs =
        typeof performance !== "undefined"
          ? Math.round(performance.now() - q0)
          : 0;
      if (data === null) {
        // Timeout or empty — treat as soft fail for backoff
        failed = true;
        wrBoardP1("leagues.current_week", "FAIL", qMs, "null/timeout");
      } else if (data.current_week != null) {
        const n = Number(data.current_week);
        if (!Number.isNaN(n)) {
          week = n;
          // Cloud is authoritative — write scoped cache only; never legacy key
          try {
            const { writeScopedActiveWeek, clampWeek } = await import(
              "./active-week-storage"
            );
            week = clampWeek(week, sportId);
            writeScopedActiveWeek(week, {
              userId: session.playerId,
              leagueId,
              sportId,
            });
          } catch {
            /* ignore */
          }
        }
        wrBoardP1("leagues.current_week", "DONE", qMs, `week=${week}`);
      } else {
        wrBoardP1("leagues.current_week", "DONE", qMs, "null-current-week");
      }
    } catch {
      failed = true;
      const qMs =
        typeof performance !== "undefined"
          ? Math.round(performance.now() - q0)
          : 0;
      wrBoardP1("leagues.current_week", "FAIL", qMs, "catch");
      /* use local fallback; cache below = backoff so callers don't stampede */
    } finally {
      try {
        const g = globalThis as unknown as { __WR_CW_INFLIGHT?: number };
        g.__WR_CW_INFLIGHT = Math.max(0, (g.__WR_CW_INFLIGHT || 1) - 1);
      } catch {
        /* ok */
      }
    }

    // Success and failure both cache ≥5s (ACTIVE_WEEK_TTL_MS) — no immediate re-GET
    cacheSet(activeWeekCache, leagueId, week);
    if (failed) {
      wrCurrentWeekLog(`fail-backoff week=${week}`, leagueId);
    }
    wrBoardP1("loadLeagueActiveWeek", "DONE", undefined, `week=${week}`);
    return week;
  })().finally(() => {
    activeWeekInflight.delete(leagueId);
  });

  activeWeekInflight.set(leagueId, promise);
  return promise;
}

export interface ScoreWeekResult {
  ok: boolean;
  scoredCount: number;
  error?: string;
  details?: { name: string; points: number }[];
}

function mapCardGame(row: {
  id: string;
  away_team: string;
  home_team: string;
  spread: number;
  favorite: string;
  start_time: string | null;
  bookmaker: string | null;
  away_rank?: number | null;
  home_rank?: number | null;
}): Game {
  const start = row.start_time || "";
  // If we stored ISO, keep it on commenceTime for date formatting
  const isIso = start.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(start);
  const oddsId = (row as { odds_event_id?: string | null }).odds_event_id;
  return {
    id: row.id,
    awayTeam: row.away_team,
    homeTeam: row.home_team,
    spread: Number(row.spread),
    favorite: row.favorite === "away" ? "away" : "home",
    startTime: start,
    commenceTime: isIso ? start : undefined,
    oddsEventId: oddsId || undefined,
    bookmaker: row.bookmaker || undefined,
    awayRank: row.away_rank ?? null,
    homeRank: row.home_rank ?? null,
  };
}

export async function publishWeekCard(opts: {
  weekNumber: number;
  games: Game[];
  prop: Prop;
}): Promise<{ ok: boolean; weekCardId?: string; games?: Game[]; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !isOps()) {
    return { ok: false, error: "Commissioner or deputy required" };
  }
  if (opts.games.length !== 5) {
    return { ok: false, error: "Select exactly 5 games" };
  }

  // Creator eyes: never publish to the real room — local demo card only
  try {
    const eyes = await import("./creator-eyes");
    if (eyes.isEyesLocalPlayActive()) {
      const key = eyes.eyesCardStorageKey(opts.weekNumber);
      const stamped = opts.games.map((g, i) => {
        if (g.commenceTime) return g;
        const t = new Date(Date.now() + (3 + i) * 3600 * 1000);
        return {
          ...g,
          commenceTime: t.toISOString(),
          startTime: t.toISOString(),
        };
      });
      localStorage.setItem(
        key,
        JSON.stringify({
          games: stamped,
          prop: opts.prop,
          weekNumber: opts.weekNumber,
          eyes: true,
          publishedAt: new Date().toISOString(),
        })
      );
      return {
        ok: true,
        weekCardId: `eyes-card-w${opts.weekNumber}`,
        games: stamped,
      };
    }
  } catch {
    /* fall through — real publish */
  }

  const supabase = createClient();
  const leagueId = session.leagueId;

  const rows = opts.games.map((g, i) => ({
    sort_order: i,
    away_team: g.awayTeam,
    home_team: g.homeTeam,
    spread: g.spread,
    favorite: g.favorite,
    start_time: g.commenceTime || g.startTime || null,
    bookmaker: g.bookmaker || null,
    away_rank: g.awayRank ?? null,
    home_rank: g.homeRank ?? null,
  }));
  const { data: published, error: publishError } = await supabase.rpc(
    "publish_week_card_atomic",
    {
      p_league_id: leagueId,
      p_week_number: opts.weekNumber,
      p_games: rows,
      p_prop_question: opts.prop.question,
      p_prop_option_a: opts.prop.options[0],
      p_prop_option_b: opts.prop.options[1],
      p_prop_points: opts.prop.points,
    }
  );
  if (publishError) return { ok: false, error: publishError.message };
  const publishRow = published as {
    week_card_id?: string;
    games?: { id: string; sort_order: number }[];
  } | null;
  const weekCardId = publishRow?.week_card_id;
  if (!weekCardId) return { ok: false, error: "Card publish returned no id" };
  try {
    const { writeScopedActiveWeek } = await import("./active-week-storage");
    const { getLeague } = await import("./league");
    writeScopedActiveWeek(opts.weekNumber, {
      userId: session.playerId,
      leagueId,
      sportId: getLeague()?.sportId,
    });
  } catch {
    /* ignore */
  }
  cacheSet(activeWeekCache, leagueId, opts.weekNumber);
  activeWeekInflight.delete(leagueId);

  const gamesWithIds = opts.games.map((g, i) => {
    const row = publishRow?.games?.find((r) => r.sort_order === i);
    return row
      ? { ...g, id: row.id, oddsEventId: g.oddsEventId || g.id }
      : g;
  });

  try {
    // Always key by the week being published (never hardcode week 1)
    localStorage.setItem(
      `warroom-card-week-${opts.weekNumber}`,
      JSON.stringify({
        games: gamesWithIds,
        prop: opts.prop,
        weekCardId,
        weekNumber: opts.weekNumber,
      })
    );
  } catch {}

  // Human/ops publish clears lazy-commish auto-post streak
  try {
    await supabase
      .from("leagues")
      .update({
        auto_publish_streak: 0,
        last_auto_publish_week: null,
      })
      .eq("id", leagueId);
  } catch {
    /* columns may not exist until lazy-commish-auto-card.sql is run */
  }
  // Best-effort: mark card as not auto if column exists
  try {
    await supabase
      .from("week_cards")
      .update({ auto_published: false })
      .eq("id", weekCardId);
  } catch {
    /* ignore */
  }

  // Museum Phase 1A: allegiance snapshots at publish (prelock; freeze at first kickoff)
  // Never generates museum_events. Soft-fails if migration not applied.
  try {
    const { rebuildAllegianceSnapshotsAfterPublish } = await import(
      "./museum/snapshots"
    );
    const { getLeague } = await import("./league");
    await rebuildAllegianceSnapshotsAfterPublish({
      leagueId,
      weekNumber: opts.weekNumber,
      weekCardId,
      games: gamesWithIds,
      sportId: getLeague()?.sportId || "cfb",
    });
  } catch {
    /* ignore — scoring/picks must not fail on Museum foundation */
  }

  return { ok: true, weekCardId, games: gamesWithIds };
}

/** Commissioner-only: withdraw an unscored, pre-kickoff card and its picks. */
export async function unpublishWeekCard(
  weekNumber: number
): Promise<{
  ok: boolean;
  picksRemoved?: number;
  alreadyClear?: boolean;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner required" };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("unpublish_week_card", {
    p_league_id: session.leagueId,
    p_week_number: weekNumber,
  });
  if (error) {
    const raw = error.message || "";
    const message = /week_already_scored/i.test(raw)
      ? "This week is already scored and cannot be unpublished."
      : /kickoff_started/i.test(raw)
        ? "Kickoff has started. The card is now part of league history."
        : /kickoff_unverifiable/i.test(raw)
          ? "Kickoff could not be verified, so nothing was changed."
          : /commissioner_only/i.test(raw)
            ? "Only the commissioner can unpublish a card."
            : raw || "Could not unpublish the card.";
    return { ok: false, error: message };
  }

  const row = data as {
    ok?: boolean;
    already_clear?: boolean;
    picks_removed?: number;
  } | null;
  if (!row?.ok) {
    return { ok: false, error: "The card was not cleared." };
  }

  invalidateCloudWeekCaches(session.leagueId);
  try {
    localStorage.removeItem(`warroom-card-week-${weekNumber}`);
    localStorage.removeItem(`warroom-picks-week-${weekNumber}`);
    window.dispatchEvent(
      new CustomEvent("warroom-card-unpublished", {
        detail: { leagueId: session.leagueId, weekNumber },
      })
    );
  } catch {
    /* cloud result is authoritative */
  }

  return {
    ok: true,
    alreadyClear: !!row.already_clear,
    picksRemoved: Number(row.picks_removed) || 0,
  };
}

/** Sync peek of memory + sessionStorage — paints My Picks from Standings. */
export function peekCachedWeekCard(
  weekNumber = 1
): CloudCard | null | undefined {
  const session = getSession();
  if (!session?.leagueId) return undefined;
  const key = `${session.leagueId}:${weekNumber}`;
  const mem = cacheGet(cardCache, key, CARD_TTL_MS);
  if (mem !== undefined) return mem;
  const persisted = readPersistedWeekCard(session.leagueId, weekNumber);
  if (persisted?.games?.length) {
    // Re-warm memory so subsequent peeks are free
    cacheSet(cardCache, key, persisted);
    return persisted;
  }
  return undefined;
}

/** Drop one card so the next load hits the network (after timeout / bad null). */
export function bustWeekCardCache(weekNumber?: number, leagueId?: string | null) {
  const lid = leagueId || getSession()?.leagueId;
  if (!lid) {
    cardCache.clear();
    cardInflight.clear();
    return;
  }
  if (weekNumber != null) {
    const k = `${lid}:${weekNumber}`;
    cardCache.delete(k);
    cardInflight.delete(k);
    clearPersistedWeekCard(lid, weekNumber);
    return;
  }
  for (const k of [...cardCache.keys()]) {
    if (k.startsWith(`${lid}:`)) cardCache.delete(k);
  }
  for (const k of [...cardInflight.keys()]) {
    if (k.startsWith(`${lid}:`)) cardInflight.delete(k);
  }
  clearPersistedWeekCard(lid);
}

function buildCloudCardFromRow(
  card: Record<string, unknown>,
  games: Record<string, unknown>[],
  weekNumber: number
): CloudCard {
  const question = ((card.prop_question as string) || "").trim() || "Prop";
  const optionA = ((card.prop_option_a as string) || "").trim() || "Yes";
  const optionB = ((card.prop_option_b as string) || "").trim() || "No";
  const points = (card.prop_points as number) ?? 3;
  const sorted = [...games].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
  );
  return {
    weekCardId: card.id as string,
    weekNumber: (card.week_number as number) ?? weekNumber,
    publishedAt: (card.published_at as string) || null,
    games: sorted.map((row) =>
      mapCardGame(row as Parameters<typeof mapCardGame>[0])
    ),
    prop: {
      id: `prop-w${weekNumber}`,
      question,
      options: [optionA, optionB] as [string, string],
      points,
    },
  };
}

export async function loadWeekCard(weekNumber = 1): Promise<CloudCard | null> {
  try {
    const { foundryLiveCard, isFoundryLivePagesActive } = await import("./foundry-live-adapter");
    if (isFoundryLivePagesActive()) return foundryLiveCard(weekNumber);
  } catch { /* fall through */ }
  const session = getSession();
  if (!session?.leagueId) return null;

  // Creator eyes: local playable demo card for the preview week (no cloud write)
  try {
    const eyes = await import("./creator-eyes");
    if (eyes.isEyesLocalPlayActive()) {
      await eyes.ensureEyesWeekCard(weekNumber);
      const local = eyes.loadEyesLocalCard(weekNumber);
      if (local?.games?.length) {
        return {
          weekCardId: `eyes-card-w${weekNumber}`,
          weekNumber,
          publishedAt: new Date().toISOString(),
          games: local.games,
          prop: local.prop,
        };
      }
    }
  } catch {
    /* fall through to cloud */
  }

  const cacheKey = `${session.leagueId}:${weekNumber}`;
  const hit = cacheGet(cardCache, cacheKey, CARD_TTL_MS);
  if (hit !== undefined) return hit;

  const inflight = cardInflight.get(cacheKey);
  if (inflight) return inflight;

  const work = (async (): Promise<CloudCard | null> => {
    const supabase = createClient();
    type CardRow = Record<string, unknown> | null;
    type FetchResult =
      | { kind: "ok"; row: CardRow }
      | { kind: "timeout" }
      | { kind: "error" };

    // One RTT: card + games (halves mobile Standings→Picks latency)
    const cardRes = await withTimeout<FetchResult>(
      (async () => {
        const { data, error } = await supabase
          .from("week_cards")
          .select("*, card_games(*)")
          .eq("league_id", session.leagueId)
          .eq("week_number", weekNumber)
          .maybeSingle();
        if (error) {
          // Embed may fail on older schemas — fall back to bare card
          const bare = await supabase
            .from("week_cards")
            .select("*")
            .eq("league_id", session.leagueId)
            .eq("week_number", weekNumber)
            .maybeSingle();
          if (bare.error) return { kind: "error" as const };
          return { kind: "ok" as const, row: (bare.data as CardRow) || null };
        }
        return { kind: "ok" as const, row: (data as CardRow) || null };
      })(),
      8_000,
      { kind: "timeout" }
    );

    // Timeout / error: never poison-cache null. Serve last-good card if any.
    if (cardRes.kind === "timeout" || cardRes.kind === "error") {
      const stale = readPersistedWeekCard(session.leagueId, weekNumber);
      return stale;
    }
    if (!cardRes.row) {
      // Real empty: no published card for this week
      cacheSet(cardCache, cacheKey, null);
      return null;
    }
    const card = cardRes.row;

    let gameRows =
      (card.card_games as Record<string, unknown>[] | null | undefined) ||
      null;

    // Nested embed empty/missing — second hop only when needed
    if (!gameRows?.length) {
      type GamesResult =
        | { kind: "ok"; rows: Record<string, unknown>[] | null }
        | { kind: "timeout" }
        | { kind: "error" };

      const gamesRes = await withTimeout<GamesResult>(
        (async () => {
          const { data, error } = await supabase
            .from("card_games")
            .select("*")
            .eq("week_card_id", card.id)
            .order("sort_order", { ascending: true });
          if (error) return { kind: "error" as const };
          return {
            kind: "ok" as const,
            rows: (data as Record<string, unknown>[] | null) || null,
          };
        })(),
        8_000,
        { kind: "timeout" }
      );

      if (gamesRes.kind === "timeout" || gamesRes.kind === "error") {
        const stale = readPersistedWeekCard(session.leagueId, weekNumber);
        return stale;
      }
      gameRows = gamesRes.rows;
    }

    if (!gameRows?.length) {
      // Card exists but no games yet — don't cache null (commish mid-publish)
      const stale = readPersistedWeekCard(session.leagueId, weekNumber);
      return stale;
    }

    const result = buildCloudCardFromRow(card, gameRows, weekNumber);
    cacheSet(cardCache, cacheKey, result);
    writePersistedWeekCard(session.leagueId, weekNumber, result);
    return result;
  })().finally(() => {
    cardInflight.delete(cacheKey);
  });

  cardInflight.set(cacheKey, work);
  return work;
}

/**
 * Weeks that actually exist for player UI (My Picks week bar, Board, etc.).
 * PRODUCT: only weeks with a real card (at least one game). Empty shells /
 * orphan week_card rows do not count — never ghost "Week 1" before it exists.
 */
export async function listPublishedWeekNumbers(): Promise<number[]> {
  try {
    const { foundryLivePublishedWeeks } = await import("./foundry-live-adapter");
    const weeks = foundryLivePublishedWeeks();
    if (weeks) return weeks;
  } catch { /* fall through */ }
  const session = getSession();
  if (!session?.leagueId) return [];
  const hit = cacheGet(publishedCache, session.leagueId, LIST_TTL_MS);
  // Empty [] is valid — only skip cache when undefined (miss / expired)
  if (hit !== undefined) {
    wrBoardP1("listPublishedWeekNumbers", "CACHE", undefined, `n=${hit.length}`);
    return hit;
  }
  try {
    const supabase = createClient();
    type CardRow = {
      week_number: number;
      card_games?: { id: string }[] | null;
    };
    type PubResult =
      | { kind: "ok"; rows: CardRow[] }
      | { kind: "fail" };
    const q0 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    wrBoardP1("week_cards.week_number", "START");
    const data = await withTimeout<PubResult>(
      (async () => {
        // Prefer embed so empty shells (no games) never appear as week pills
        const { data: rows, error } = await supabase
          .from("week_cards")
          .select("week_number, card_games(id)")
          .eq("league_id", session.leagueId)
          .order("week_number", { ascending: true });
        if (error) {
          // Older schema / RLS: bare week_number only
          const bare = await supabase
            .from("week_cards")
            .select("week_number")
            .eq("league_id", session.leagueId)
            .order("week_number", { ascending: true });
          if (bare.error) return { kind: "fail" as const };
          return {
            kind: "ok" as const,
            rows: (bare.data as CardRow[]) || [],
          };
        }
        return {
          kind: "ok" as const,
          rows: (rows as CardRow[]) || [],
        };
      })(),
      8_000,
      { kind: "fail" },
      "week_cards.week_number"
    );
    const qMs =
      typeof performance !== "undefined"
        ? Math.round(performance.now() - q0)
        : 0;
    // Timeout / error: do NOT cache empty — that blocked week fallbacks on phone
    if (data.kind === "fail") {
      wrBoardP1("week_cards.week_number", "FAIL", qMs, "kind=fail");
      wrBoardP1("listPublishedWeekNumbers", "DONE", qMs, "empty-fail");
      return [];
    }
    const nums = data.rows
      .filter((r) => {
        // If embed present: require ≥1 game. Bare rows (no card_games key): keep
        // (legacy fallback) — still better than inventing weeks client-side.
        if (r.card_games === undefined || r.card_games === null) return true;
        return Array.isArray(r.card_games) && r.card_games.length > 0;
      })
      .map((r) => Number(r.week_number))
      .filter((n) => !Number.isNaN(n));
    const out = [...new Set(nums)].sort((a, b) => a - b);
    cacheSet(publishedCache, session.leagueId, out);
    wrBoardP1("week_cards.week_number", "DONE", qMs, `n=${out.length}`);
    wrBoardP1(
      "listPublishedWeekNumbers",
      "DONE",
      qMs,
      `n=${out.length} weeks=[${out.join(",")}] league=${session.leagueId.slice(0, 8)}`
    );
    return out;
  } catch {
    wrBoardP1("listPublishedWeekNumbers", "FAIL", undefined, "catch");
    return [];
  }
}

/**
 * Phone Standings→Picks: find a playable card near the official live week.
 * Never prefers orphan high weeks (e.g. week 7 residue while live is week 0).
 */
export async function loadBestAvailableWeekCard(
  preferredWeek = 1
): Promise<{ card: CloudCard; week: number } | null> {
  const preferred = Number.isFinite(preferredWeek) ? preferredWeek : 1;
  const published = await listPublishedWeekNumbers().catch(() => [] as number[]);

  let trustedPublished = published;
  try {
    const { trustContiguousPublishedAroundLive } = await import(
      "./week-history-trust"
    );
    trustedPublished = trustContiguousPublishedAroundLive(
      published,
      preferred,
      getLeague()?.sportId
    );
  } catch {
    /* keep raw */
  }

  const candidates: number[] = [];
  const push = (w: number) => {
    if (!Number.isFinite(w) || w < 0 || w > 40 || w === 99) return;
    if (!candidates.includes(w)) candidates.push(w);
  };
  // Official live first, then contiguous trusted published only.
  // Never preferred+1 — that pulled future residue cards (Week 1 while live=0).
  push(preferred);
  for (const w of trustedPublished) {
    if (w <= preferred) push(w);
  }
  push(preferred - 1);

  // Cap parallel fan-out — phone radio hates 10 at once
  const batch = candidates.slice(0, 6);
  const results = await Promise.all(
    batch.map(async (w) => {
      try {
        const card = await loadWeekCard(w);
        return { w, card };
      } catch {
        return { w, card: null as CloudCard | null };
      }
    })
  );

  // Prefer preferred week if *formally published* (publishedAt + games)
  const isPublished = (c: CloudCard | null | undefined) =>
    !!(
      c &&
      typeof c.publishedAt === "string" &&
      c.publishedAt.trim() &&
      c.games?.length
    );

  for (const r of results) {
    if (r.w === preferred && isPublished(r.card)) {
      return { card: r.card!, week: r.w };
    }
  }
  // Closest trusted *published* week (never draft-only residue)
  const withPublished = results
    .filter((r) => isPublished(r.card))
    .sort((a, b) => Math.abs(a.w - preferred) - Math.abs(b.w - preferred));
  if (withPublished[0]?.card) {
    return { card: withPublished[0].card!, week: withPublished[0].w };
  }
  return null;
}

export async function savePicksToCloud(opts: {
  weekNumber: number;
  picks: Record<string, UserPick>;
  bestBetId: string | null;
  propChoice: string | null;
  /** Chaos Mode lock — pure random card, 2× week points */
  isChaos?: boolean;
}): Promise<{
  ok: boolean;
  error?: string;
  /** First & Final rare badge outcome for this save */
  firstFinal?: "earned" | "held" | "forfeit" | "not_first" | "ignored";
  /** Career/season pts added (+) or removed (−) for First & Final */
  firstFinalPointsDelta?: number;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) {
    return { ok: false, error: "Not signed into a league" };
  }

  // Foundry uses the production Picks page, but it is an isolated local room.
  // Stop here before creating a Supabase client or touching the live league.
  try {
    const { isFoundryLivePagesActive, saveFoundryLivePicks } = await import("./foundry-live-adapter");
    if (isFoundryLivePagesActive()) {
      if (!Object.keys(opts.picks).length) return { ok: false, error: "No picks to save" };
      return saveFoundryLivePicks(opts.weekNumber, opts.picks)
        ? { ok: true, firstFinal: "ignored", firstFinalPointsDelta: 0 }
        : { ok: false, error: "Foundry week changed. Reload the card." };
    }
  } catch { /* fall through */ }

  // Creator eyes: local picks only (never write real league board)
  try {
    const eyes = await import("./creator-eyes");
    const eyesOn = eyes.isEyesLocalPlayActive();
    if (eyesOn) {
      const pickList = Object.values(opts.picks);
      if (!pickList.length) return { ok: false, error: "No picks to save" };
      const payload = {
        picks: opts.picks,
        bestBetId: opts.bestBetId,
        propChoice: opts.propChoice,
        lockedAt: new Date().toISOString(),
        isChaos: !!opts.isChaos,
      };
      localStorage.setItem(
        eyes.eyesPicksStorageKey(opts.weekNumber),
        JSON.stringify(payload)
      );
      // Eyes preview must not bank real cheevos
      return { ok: true, firstFinal: "ignored" };
    }
  } catch {
    /* fall through to cloud */
  }

  const supabase = createClient();
  // Never await auth.getUser() here — hangs on flaky mobile and freezes lock UX
  const uid = session.playerId;
  const leagueId = session.leagueId;
  const pickList = Object.values(opts.picks);
  if (!pickList.length) return { ok: false, error: "No picks to save" };

  let isFirstSave = false;
  // Chaos spend + badge before write (so flames fire even if column missing)
  if (opts.isChaos) {
    try {
      const { spendChaosUse, CHAOS_BADGE_ID } = await import("./chaos-mode");
      const spent = spendChaosUse(opts.weekNumber, leagueId, uid);
      if (!spent.ok) return { ok: false, error: spent.error };
      const { grantPermanentBadgeId } = await import("./permanent-badges");
      grantPermanentBadgeId(uid, CHAOS_BADGE_ID);
    } catch {
      /* ignore badge */
    }
  }

  const { data: savedPick, error: saveError } = await supabase.rpc(
    "save_week_picks_atomic",
    {
      p_league_id: leagueId,
      p_week_number: opts.weekNumber,
      p_picks: pickList.map((p) => ({
        game_id: p.gameId,
        side: p.pick,
        confidence: p.confidence,
        locked_spread: p.lockedSpread,
        locked_favorite: p.lockedFavorite,
      })),
      p_best_bet_game_id: opts.bestBetId,
      p_prop_choice: opts.propChoice,
      p_is_chaos: !!opts.isChaos,
    }
  );
  if (saveError) return { ok: false, error: saveError.message };
  isFirstSave = !!(savedPick as { first_save?: boolean } | null)?.first_save;

  // —— First & Final rare: first human lock + never change the slip ——
  let firstFinal: "earned" | "held" | "forfeit" | "not_first" | "ignored" =
    "ignored";
  let firstFinalPointsDelta = 0;
  try {
    const {
      onPicksSavedForFirstFinal,
      slipFingerprint,
    } = await import("./first-final");
    const hash = slipFingerprint(opts.picks, opts.bestBetId, opts.propChoice);
    let wasFirstInLeague = false;

    if (isFirstSave) {
      // Try claim table (first insert wins). Requires supabase/first-lock-badge.sql
      const { data: claimRow, error: claimErr } = await supabase
        .from("first_lock_claims")
        .insert({
          league_id: leagueId,
          week_number: opts.weekNumber,
          user_id: uid,
          slip_hash: hash,
          dirty: false,
        })
        .select("user_id")
        .maybeSingle();

      if (!claimErr && claimRow?.user_id === uid) {
        wasFirstInLeague = true;
      } else if (claimErr) {
        // PK conflict = someone else already first, or table missing
        const { data: existingClaim } = await supabase
          .from("first_lock_claims")
          .select("user_id, dirty, slip_hash")
          .eq("league_id", leagueId)
          .eq("week_number", opts.weekNumber)
          .maybeSingle();
        wasFirstInLeague = existingClaim?.user_id === uid;
      }
    } else {
      // Re-save: if we own the claim, mark dirty when slip hash changes
      const { data: existingClaim } = await supabase
        .from("first_lock_claims")
        .select("user_id, dirty, slip_hash")
        .eq("league_id", leagueId)
        .eq("week_number", opts.weekNumber)
        .maybeSingle();
      if (existingClaim?.user_id === uid) {
        wasFirstInLeague = true;
        if (existingClaim.slip_hash !== hash && !existingClaim.dirty) {
          await supabase
            .from("first_lock_claims")
            .update({ dirty: true, slip_hash: hash })
            .eq("league_id", leagueId)
            .eq("week_number", opts.weekNumber)
            .eq("user_id", uid);
        }
      }
    }

    const result = onPicksSavedForFirstFinal({
      userId: uid,
      leagueId,
      weekNumber: opts.weekNumber,
      isFirstSave,
      wasFirstInLeague,
      picks: opts.picks,
      bestBetId: opts.bestBetId,
      propChoice: opts.propChoice,
    });
    firstFinal = result.status;

    // Career points: bank on earn, unbank only when badge fully lost
    // Season pts follow live badge eval (earned → +25, lost → 0 for this badge)
    try {
      const { bankCareerBadgeId, unbankCareerBadgeId } = await import(
        "./career-cheevo"
      );
      const {
        FIRST_FINAL_BADGE_ID,
        firstFinalEarned,
      } = await import("./first-final");
      const PTS = 25;

      if (result.status === "earned") {
        const banked = bankCareerBadgeId(uid, FIRST_FINAL_BADGE_ID, PTS);
        firstFinalPointsDelta = banked.banked ? PTS : 0;
      } else if (result.status === "forfeit") {
        if (!firstFinalEarned(uid)) {
          const un = unbankCareerBadgeId(uid, FIRST_FINAL_BADGE_ID, PTS);
          firstFinalPointsDelta = un.removed ? -PTS : 0;
        }
      }
    } catch {
      /* career bank optional */
    }
  } catch {
    firstFinal = "ignored";
  }

  try {
    const { markEngagement } = await import("./engagement");
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) {
      markEngagement(uid, "locked_after_22");
    }
  } catch {
    /* ignore */
  }

  return { ok: true, firstFinal, firstFinalPointsDelta };
}

export async function loadMyPicks(weekNumber = 1) {
  try {
    const { foundryLiveMyPicks, isFoundryLivePagesActive } = await import("./foundry-live-adapter");
    if (isFoundryLivePagesActive()) return foundryLiveMyPicks(weekNumber);
  } catch { /* fall through */ }
  const session = getSession();
  if (!session?.leagueId) return null;

  try {
    const eyes = await import("./creator-eyes");
    if (eyes.isEyesLocalPlayActive()) {
      const key = eyes.eyesPicksStorageKey(weekNumber);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw) as {
        picks?: Record<string, UserPick>;
        bestBetId?: string | null;
        propChoice?: string | null;
        lockedAt?: string | null;
        isChaos?: boolean;
      };
      if (!data.picks || !Object.keys(data.picks).length) return null;
      return {
        picks: data.picks,
        bestBetId: data.bestBetId ?? null,
        propChoice: data.propChoice ?? null,
        lockedAt: data.lockedAt ?? null,
        isChaos: !!data.isChaos,
      };
    }
  } catch {
    /* fall through */
  }

  // Prefer session id — auth.getUser() can hang forever on flaky mobile networks
  // and freezes My Picks on a full-page "Loading…".
  const uid = session.playerId;
  if (!uid) return null;

  const supabase = createClient();

  const pick = await withTimeout(
    (async () => {
      const { data } = await supabase
        .from("picks")
        .select("*")
        .eq("league_id", session.leagueId)
        .eq("user_id", uid)
        .eq("week_number", weekNumber)
        .maybeSingle();
      return data;
    })(),
    8_000,
    null
  );
  if (!pick) return null;

  const games = await withTimeout(
    (async () => {
      const { data } = await supabase
        .from("pick_games")
        .select("*")
        .eq("pick_id", pick.id);
      return data;
    })(),
    6_000,
    null
  );
  const picks: Record<string, UserPick> = {};
  for (const g of games || []) {
    picks[g.card_game_id as string] = {
      gameId: g.card_game_id as string,
      pick: g.side === "away" ? "away" : "home",
      confidence: g.confidence as number,
      isBestBet: !!g.is_best_bet,
      lockedSpread: Number(g.locked_spread ?? 0),
      lockedFavorite: g.locked_favorite === "away" ? "away" : "home",
    };
  }
  const isChaos =
    !!(pick as { is_chaos?: boolean }).is_chaos ||
    (await import("./chaos-mode")).isWeekChaosForUser(
      weekNumber,
      session.leagueId,
      uid
    );
  if (isChaos && pick.locked_at) {
    try {
      const { markChaosActive } = await import("./chaos-mode");
      markChaosActive(session.leagueId, uid, weekNumber);
    } catch {
      /* ignore */
    }
  }
  return {
    picks,
    bestBetId: pick.best_bet_game_id as string | null,
    propChoice: pick.prop_choice as string | null,
    lockedAt: pick.locked_at as string | null,
    isChaos,
  };
}

/**
 * Account-wide onboarding truth: how many real cards this player has locked.
 * Capped by callers at two; existing picks RLS limits the query to the owner.
 */
export async function countMyLockedCards(): Promise<number> {
  const uid = getSession()?.playerId;
  if (!uid) return 2;
  try {
    const supabase = createClient();
    const result = await withTimeout(
      (async () => {
        const { count, error } = await supabase
          .from("picks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .not("locked_at", "is", null);
        if (error) return null;
        return count ?? 0;
      })(),
      6_000,
      null
    );
    // Fail closed: never trap an established player in onboarding when cloud
    // counting is unavailable.
    return result === null ? 2 : Math.min(2, result);
  } catch {
    return 2;
  }
}

/** One player's full slip for the week board (after scoring / RLS allows). */
export type WeekBoardSlip = {
  userId: string;
  name: string;
  isBot?: boolean;
  picks: Record<string, UserPick>;
  bestBetId: string | null;
  propChoice: string | null;
  lockedAt: string | null;
  totalPoints: number | null;
  /** Chaos Mode this week — flames on the name */
  isChaos?: boolean;
  /** profiles.last_seen_at — last app open (CFB + NFL) */
  lastSeenAt?: string | null;
};

/**
 * Everyone's locked slips for a week — humans and bots equally.
 * Opens after first kickoff (card locked) or after scoring
 * (RLS: picks-reveal-after-lock.sql). Secret until then.
 *
 * Filler bots are full competitors: never omit is_bot seats from slips.
 */
export async function loadLeagueWeekBoard(weekNumber: number): Promise<{
  ok: boolean;
  slips: WeekBoardSlip[];
  scored: boolean;
  /** True once first kickoff hit (or scored) — board should be open */
  lockedOpen: boolean;
  error?: string;
}> {
  try {
    const { foundryLiveWeekBoard } = await import("./foundry-live-adapter");
    const board = foundryLiveWeekBoard(weekNumber);
    if (board) return board;
  } catch { /* fall through */ }
  const session = getSession();
  if (!session?.leagueId) {
    return {
      ok: false,
      slips: [],
      scored: false,
      lockedOpen: false,
      error: "No league",
    };
  }
  try {
    const supabase = createClient();
    const leagueId = session.leagueId;
    const bt0 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const bperf = (label: string, extra?: string) => {
      try {
        const on =
          (typeof process !== "undefined" &&
            process.env.NODE_ENV === "development") ||
          (typeof window !== "undefined" &&
            localStorage.getItem("warroom-runtime-debug") === "1");
        if (!on) return;
        const ms =
          typeof performance !== "undefined"
            ? Math.round(performance.now() - bt0)
            : 0;
        console.log(`[WR-PERF][board] weekBoard ${label} +${ms}ms`, extra || "");
      } catch {
        /* ok */
      }
    };
    bperf("start", `week=${weekNumber}`);

    const { data: wr } = await supabase
      .from("week_results")
      .select("id, week_number")
      .eq("league_id", leagueId)
      .eq("week_number", weekNumber)
      .maybeSingle();
    const scored = !!wr;
    bperf("week_results-done", `scored=${scored}`);

    // Client-side lock check (first kickoff) for messaging + soft gate
    // NOTE: sequential await after week_results — also often duplicates page-level loadWeekCard
    let lockedOpen = scored;
    try {
      const card = await loadWeekCard(weekNumber);
      bperf("inner-loadWeekCard-done", `games=${card?.games?.length ?? 0}`);
      if (card?.games?.length) {
        const { isCardLockDeadlinePassed } = await import("./dates");
        if (isCardLockDeadlinePassed(card.games)) lockedOpen = true;
      }
    } catch {
      /* ignore */
    }

    const { data: members } = await supabase
      .from("memberships")
      .select("user_id, is_bot, display_name_override, profiles(display_name)")
      .eq("league_id", leagueId);
    bperf("memberships-done", `n=${members?.length ?? 0}`);

    let pickRows: Record<string, unknown>[] | null = null;
    let pickErr: { message?: string } | null = null;
    {
      const res = await supabase
        .from("picks")
        .select(
          "id, user_id, prop_choice, best_bet_game_id, locked_at, total_points, is_chaos"
        )
        .eq("league_id", leagueId)
        .eq("week_number", weekNumber);
      if (res.error && /is_chaos|column/i.test(res.error.message || "")) {
        const res2 = await supabase
          .from("picks")
          .select(
            "id, user_id, prop_choice, best_bet_game_id, locked_at, total_points"
          )
          .eq("league_id", leagueId)
          .eq("week_number", weekNumber);
        pickRows = (res2.data || null) as Record<string, unknown>[] | null;
        pickErr = res2.error;
        bperf("picks-fallback-done", pickErr?.message || `n=${pickRows?.length ?? 0}`);
      } else {
        pickRows = (res.data || null) as Record<string, unknown>[] | null;
        pickErr = res.error;
        bperf("picks-done", pickErr?.message || `n=${pickRows?.length ?? 0}`);
      }
    }

    if (pickErr) {
      bperf("picks-error-return");
      return {
        ok: false,
        slips: [],
        scored,
        lockedOpen,
        error: lockedOpen
          ? `${pickErr.message} — run supabase/picks-reveal-after-lock.sql in Supabase if you haven’t.`
          : "Picks stay secret until the first kickoff on this card (then The Board opens).",
      };
    }

    // If RLS only returns your row (old policies), still try — caller sees partial
    if (!lockedOpen && !isOps()) {
      return {
        ok: false,
        slips: [],
        scored,
        lockedOpen: false,
        error:
          "Picks stay secret until the first kickoff locks the card. Then everyone can open The Board.",
      };
    }

    const pickIds = (pickRows || []).map((p) => p.id as string);
    const gamesByPick = new Map<string, Record<string, UserPick>>();
    if (pickIds.length) {
      const { data: pgs } = await supabase
        .from("pick_games")
        .select(
          "pick_id, card_game_id, side, confidence, is_best_bet, locked_spread, locked_favorite"
        )
        .in("pick_id", pickIds);
      for (const g of pgs || []) {
        const pid = g.pick_id as string;
        const map = gamesByPick.get(pid) || {};
        map[g.card_game_id as string] = {
          gameId: g.card_game_id as string,
          pick: g.side === "away" ? "away" : "home",
          confidence: Number(g.confidence) || 0,
          isBestBet: !!g.is_best_bet,
          lockedSpread: Number(g.locked_spread ?? 0),
          lockedFavorite: g.locked_favorite === "away" ? "away" : "home",
        };
        gamesByPick.set(pid, map);
      }
    }

    const pickByUser = new Map(
      (pickRows || []).map((p) => [p.user_id as string, p])
    );
    const slips: WeekBoardSlip[] = [];

    // Every member with a seat — humans and bots play the same game.
    // Never skip is_bot on The Board (filler bots must show under teams).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveLeagueDisplayName } = require("./display-name") as typeof import("./display-name");
    for (const m of members || []) {
      const userId = m.user_id as string;
      const isBot = !!m.is_bot;
      const profile = m.profiles as { display_name?: string } | null;
      const name = resolveLeagueDisplayName({
        membershipOverride: (m as { display_name_override?: string | null })
          .display_name_override,
        profileDisplayName: profile?.display_name,
        fallback: isBot ? "Bot" : "Player",
      });
      const pick = pickByUser.get(userId);
      if (!pick) {
        slips.push({
          userId,
          name,
          isBot,
          picks: {},
          bestBetId: null,
          propChoice: null,
          lockedAt: null,
          totalPoints: null,
          isChaos: false,
        });
        continue;
      }
      const chaos = !!(pick as { is_chaos?: boolean }).is_chaos;
      if (chaos) {
        try {
          const { markChaosActive } = await import("./chaos-mode");
          markChaosActive(leagueId, userId, weekNumber);
        } catch {
          /* ignore */
        }
      }
      slips.push({
        userId,
        name,
        isBot,
        picks: gamesByPick.get(pick.id as string) || {},
        bestBetId: (pick.best_bet_game_id as string) || null,
        propChoice: (pick.prop_choice as string) || null,
        lockedAt: (pick.locked_at as string) || null,
        totalPoints:
          pick.total_points != null ? Number(pick.total_points) : null,
        isChaos: chaos,
      });
    }

    // Same sort for everyone: week points, then name (no human/bot demotion)
    slips.sort((a, b) => {
      const pa = a.totalPoints ?? -1;
      const pb = b.totalPoints ?? -1;
      if (pb !== pa) return pb - pa;
      return a.name.localeCompare(b.name);
    });

    // Attach last_seen for CFB + NFL boards (same profiles table)
    try {
      const ids = [...new Set(slips.map((s) => s.userId).filter(Boolean))];
      if (ids.length) {
        const { data: seenRows } = await supabase
          .from("profiles")
          .select("id, last_seen_at")
          .in("id", ids);
        if (seenRows?.length) {
          const seen = new Map<string, string | null>();
          for (const row of seenRows) {
            seen.set(
              row.id as string,
              (row.last_seen_at as string | null) || null
            );
          }
          for (const s of slips) {
            s.lastSeenAt = seen.get(s.userId) ?? null;
          }
        }
      }
    } catch {
      /* optional */
    }

    return { ok: true, slips, scored, lockedOpen };
  } catch (e: unknown) {
    return {
      ok: false,
      slips: [],
      scored: false,
      lockedOpen: false,
      error: e instanceof Error ? e.message : "Failed to load board",
    };
  }
}

export type PickSubmissionStatus = {
  userId: string;
  name: string;
  division: string;
  role: "commissioner" | "player";
  /** Has a picks row for this week */
  submitted: boolean;
  /** Full card: 5 sides + confidence + best bet + prop */
  complete: boolean;
  gamePickCount: number;
  hasProp: boolean;
  hasBestBet: boolean;
  lockedAt: string | null;
};

/**
 * Member-safe pulse: how many humans have locked for a week (no sides).
 * Standings competition cards use this — never invent locks.
 */
export async function countLockedPicksForWeek(weekNumber: number): Promise<{
  locked: number;
  expected: number;
} | null> {
  const session = getSession();
  if (!session?.leagueId || !Number.isFinite(weekNumber)) return null;
  try {
    const supabase = createClient();
    const leagueId = session.leagueId;
    const { data: members, error: memErr } = await supabase
      .from("memberships")
      .select("user_id, is_bot")
      .eq("league_id", leagueId);
    if (memErr || !members?.length) return null;
    const humanIds = new Set(
      members
        .filter((m) => !(m as { is_bot?: boolean }).is_bot)
        .map((m) => m.user_id as string)
    );
    if (!humanIds.size) return null;
    const { data: pickRows, error: pickErr } = await supabase
      .from("picks")
      .select("user_id, locked_at")
      .eq("league_id", leagueId)
      .eq("week_number", weekNumber);
    if (pickErr) return null;
    let locked = 0;
    for (const row of pickRows || []) {
      const uid = row.user_id as string;
      if (!humanIds.has(uid)) continue;
      if (row.locked_at) locked += 1;
    }
    return { locked, expected: humanIds.size };
  } catch {
    return null;
  }
}

/**
 * Ops only — who has locked picks for a week.
 * Does not return sides/confidence (privacy). Use for "who hasn't picked".
 */
export async function loadPickSubmissionStatus(
  weekNumber: number,
  expectedGames = 5
): Promise<{ ok: boolean; rows: PickSubmissionStatus[]; error?: string }> {
  try {
    const { foundryLivePickSubmissionStatus } = await import("./foundry-live-adapter");
    const status = foundryLivePickSubmissionStatus(weekNumber);
    if (status) return status;
  } catch { /* fall through */ }
  const session = getSession();
  if (!session?.leagueId || !isOps()) {
    return { ok: false, rows: [], error: "Commissioner or deputy only" };
  }

  const supabase = createClient();
  const leagueId = session.leagueId;

  const { data: members, error: memErr } = await supabase
    .from("memberships")
    .select("user_id, role, division, display_name_override, profiles(display_name)")
    .eq("league_id", leagueId);

  if (memErr) return { ok: false, rows: [], error: memErr.message };

  const { data: pickRows, error: pickErr } = await supabase
    .from("picks")
    .select("id, user_id, prop_choice, best_bet_game_id, locked_at")
    .eq("league_id", leagueId)
    .eq("week_number", weekNumber);

  if (pickErr) return { ok: false, rows: [], error: pickErr.message };

  const pickByUser = new Map(
    (pickRows || []).map((p) => [p.user_id as string, p])
  );
  const pickIds = (pickRows || []).map((p) => p.id as string);

  const countByPickId = new Map<string, number>();
  if (pickIds.length) {
    const { data: pgs } = await supabase
      .from("pick_games")
      .select("pick_id")
      .in("pick_id", pickIds);
    for (const row of pgs || []) {
      const id = row.pick_id as string;
      countByPickId.set(id, (countByPickId.get(id) || 0) + 1);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolveLeagueDisplayName } = require("./display-name") as typeof import("./display-name");
  const rows: PickSubmissionStatus[] = (members || []).map((m) => {
    const profile = m.profiles as { display_name?: string } | null;
    const userId = m.user_id as string;
    const pick = pickByUser.get(userId);
    const gamePickCount = pick ? countByPickId.get(pick.id as string) || 0 : 0;
    const hasProp = !!(pick?.prop_choice);
    const hasBestBet = !!(pick?.best_bet_game_id);
    const complete =
      !!pick &&
      gamePickCount >= expectedGames &&
      hasProp &&
      hasBestBet;

    return {
      userId,
      name: resolveLeagueDisplayName({
        membershipOverride: (m as { display_name_override?: string | null })
          .display_name_override,
        profileDisplayName: profile?.display_name,
      }),
      division: (m.division as string) || "North",
      role: m.role === "commissioner" ? "commissioner" : "player",
      submitted: !!pick,
      complete,
      gamePickCount,
      hasProp,
      hasBestBet,
      lockedAt: (pick?.locked_at as string) || null,
    };
  });

  rows.sort((a, b) => {
    // Incomplete first, then by name
    if (a.complete !== b.complete) return a.complete ? 1 : -1;
    if (a.submitted !== b.submitted) return a.submitted ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return { ok: true, rows };
}

/**
 * Who failed to lock a card for a scored week (Gazette "milk carton" roast).
 * Any league member can call this — returns names only, no sides/confidence.
 * Falls back to empty if RLS blocks pick rows.
 */
export async function loadWeekNoLockNames(
  weekNumber: number,
  expectedGames = 5
): Promise<string[]> {
  try {
    const { foundryLiveNoLockNames } = await import("./foundry-live-adapter");
    const names = foundryLiveNoLockNames(weekNumber);
    if (names) return names;
  } catch { /* fall through */ }
  const session = getSession();
  if (!session?.leagueId) return [];

  try {
    const supabase = createClient();
    const leagueId = session.leagueId;

    const { data: members, error: memErr } = await supabase
      .from("memberships")
      .select("user_id, is_bot, display_name_override, profiles(display_name)")
      .eq("league_id", leagueId);

    if (memErr || !members?.length) return [];

    const { data: pickRows, error: pickErr } = await supabase
      .from("picks")
      .select("id, user_id, prop_choice, best_bet_game_id, locked_at")
      .eq("league_id", leagueId)
      .eq("week_number", weekNumber);

    // Can't see others' picks → caller may use score-based fallback
    if (pickErr) return [];

    const pickByUser = new Map(
      (pickRows || []).map((p) => [p.user_id as string, p])
    );
    const pickIds = (pickRows || []).map((p) => p.id as string);
    const countByPickId = new Map<string, number>();
    if (pickIds.length) {
      const { data: pgs } = await supabase
        .from("pick_games")
        .select("pick_id")
        .in("pick_id", pickIds);
      for (const row of pgs || []) {
        const id = row.pick_id as string;
        countByPickId.set(id, (countByPickId.get(id) || 0) + 1);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveLeagueDisplayName } = require("./display-name") as typeof import("./display-name");
    const ghosts: string[] = [];
    for (const m of members) {
      // Bots play like humans — milk carton if they never locked a full card
      const userId = m.user_id as string;
      const profile = m.profiles as { display_name?: string } | null;
      const name = resolveLeagueDisplayName({
        membershipOverride: (m as { display_name_override?: string | null })
          .display_name_override,
        profileDisplayName: profile?.display_name,
        fallback: m.is_bot ? "Bot" : "Player",
      });
      const pick = pickByUser.get(userId);
      const gamePickCount = pick
        ? countByPickId.get(pick.id as string) || 0
        : 0;
      const locked = !!(pick?.locked_at);
      const complete =
        !!pick &&
        locked &&
        gamePickCount >= expectedGames &&
        !!pick.prop_choice &&
        !!pick.best_bet_game_id;

      // Never locked a full card = milk carton material
      if (!complete) ghosts.push(name);
    }

    return ghosts.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * Ops post a public announcement naming who still needs picks.
 * Does not reveal actual picks — only names + complete/partial/missing.
 */
export async function postMissingPicksAnnouncement(
  weekNumber: number,
  expectedGames = 5
): Promise<{ ok: boolean; error?: string; missingCount?: number }> {
  const session = getSession();
  if (!session?.leagueId || !isOps() || !session.playerId) {
    return { ok: false, error: "Commissioner or deputy required" };
  }

  const status = await loadPickSubmissionStatus(weekNumber, expectedGames);
  if (!status.ok) {
    return { ok: false, error: status.error || "Could not load pick status" };
  }

  const incomplete = status.rows.filter((r) => !r.complete);
  if (!incomplete.length) {
    return {
      ok: false,
      error: "Everyone has a complete card — nothing to announce.",
      missingCount: 0,
    };
  }

  const weekLabel = weekTitle(weekNumber);
  const lines = incomplete.map((r) => {
    if (!r.submitted) return `• ${r.name} — not submitted`;
    const bits = [`${r.gamePickCount} game picks`];
    if (!r.hasBestBet) bits.push("no Best Bet");
    if (!r.hasProp) bits.push("no prop");
    return `• ${r.name} — partial (${bits.join(", ")})`;
  });

  const title = `${weekLabel}: Still need picks`;
  const body = [
    `League call-out — these players still need a complete ${weekLabel} card (all games + confidence + Best Bet + prop):`,
    "",
    ...lines,
    "",
    "Lock them in on My Picks before kickoff.",
  ].join("\n");

  const supabase = createClient();
  const { error } = await supabase.from("announcements").insert({
    league_id: session.leagueId,
    author_id: session.playerId,
    title,
    body,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, missingCount: incomplete.length };
}

/**
 * Remove a week's score mark (week_results + game_results).
 * Commissioner dry-run / accidental Founder score cleanup.
 * Does not delete the published card or player picks.
 */
export async function clearWeekScoreInCloud(
  weekNumber: number
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }
  try {
    const supabase = createClient();
    const { data: wr } = await supabase
      .from("week_results")
      .select("id")
      .eq("league_id", session.leagueId)
      .eq("week_number", weekNumber)
      .maybeSingle();
    if (wr?.id) {
      await supabase.from("game_results").delete().eq("week_result_id", wr.id);
      await supabase.from("week_results").delete().eq("id", wr.id);
    }
    try {
      localStorage.removeItem(`warroom-results-week-${weekNumber}`);
    } catch {
      /* ignore */
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not clear week score",
    };
  }
}

/**
 * Weeks that are truly scored (host finalized results).
 * Requires a week_results row WITH at least one game_results line —
 * empty shells (score clicked with 0 locked picks) must not strike the pill.
 */
export async function listScoredWeekNumbers(): Promise<number[]> {
  try {
    const { foundryLiveScoredWeeks } = await import("./foundry-live-adapter");
    const weeks = foundryLiveScoredWeeks();
    if (weeks) return weeks;
  } catch { /* fall through */ }
  const fn0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const session = getSession();
  if (!session?.leagueId) return [];
  const hit = cacheGet(scoredCache, session.leagueId, LIST_TTL_MS);
  if (hit !== undefined) {
    wrBoardP1("listScoredWeekNumbers", "CACHE", undefined, `n=${hit.length}`);
    return hit;
  }
  try {
    const supabase = createClient();
    type ScoredRows = { id: string; week_number: number }[] | null;

    // ── await #1: week_results ──
    const wr0 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    wrBoardP1("week_results.id,week_number", "START");
    const data = await withTimeout<
      | { kind: "ok"; rows: ScoredRows }
      | { kind: "fail" }
    >(
      (async () => {
        const { data: rows, error } = await supabase
          .from("week_results")
          .select("id, week_number")
          .eq("league_id", session.leagueId);
        if (error) return { kind: "fail" as const };
        return {
          kind: "ok" as const,
          rows: (rows as ScoredRows) || [],
        };
      })(),
      8_000,
      { kind: "fail" },
      "week_results.id,week_number"
    );
    const wrMs =
      typeof performance !== "undefined"
        ? Math.round(performance.now() - wr0)
        : 0;
    // Timeout / error: do not poison-cache empty scored list
    if (data.kind === "fail") {
      wrBoardP1("week_results.id,week_number", "FAIL", wrMs, "kind=fail");
      wrBoardP1(
        "listScoredWeekNumbers",
        "DONE",
        typeof performance !== "undefined"
          ? Math.round(performance.now() - fn0)
          : wrMs,
        "empty-after-wr-fail"
      );
      return [];
    }
    wrBoardP1(
      "week_results.id,week_number",
      "DONE",
      wrMs,
      `rows=${data.rows?.length ?? 0}`
    );
    if (!data.rows?.length) {
      cacheSet(scoredCache, session.leagueId, []);
      wrBoardP1("listScoredWeekNumbers", "DONE", wrMs, "empty-rows");
      return [];
    }

    const ids = data.rows.map((r) => r.id as string).filter(Boolean);
    if (!ids.length) {
      cacheSet(scoredCache, session.leagueId, []);
      wrBoardP1("listScoredWeekNumbers", "DONE", wrMs, "empty-ids");
      return [];
    }

    // ── await #2: game_results (SERIAL after week_results) ──
    const gr0 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    wrBoardP1("game_results.week_result_id", "START", undefined, `ids=${ids.length}`);
    const gr = await withTimeout(
      (async () => {
        const { data: rows, error: grErr } = await supabase
          .from("game_results")
          .select("week_result_id")
          .in("week_result_id", ids);
        if (grErr) return null;
        return rows;
      })(),
      6_000,
      null,
      "game_results.week_result_id"
    );
    const grMs =
      typeof performance !== "undefined"
        ? Math.round(performance.now() - gr0)
        : 0;

    // Trust: never invent scored history from empty week_results shells.
    // If game_results is unreachable, return [] (not a poisoned "all weeks scored").
    if (!gr) {
      wrBoardP1(
        "game_results.week_result_id",
        "FAIL",
        grMs,
        "null/timeout→empty (no shell fallback)"
      );
      const total =
        typeof performance !== "undefined"
          ? Math.round(performance.now() - fn0)
          : wrMs + grMs;
      wrBoardP1(
        "listScoredWeekNumbers",
        "DONE",
        total,
        `empty-after-gr-fail (wr=${wrMs}ms + gr=${grMs}ms SERIAL)`
      );
      // Do not cache empty on timeout — next call may succeed
      return [];
    }
    wrBoardP1(
      "game_results.week_result_id",
      "DONE",
      grMs,
      `rows=${Array.isArray(gr) ? gr.length : 0}`
    );

    const withGames = new Set(
      (gr || []).map((g) => g.week_result_id as string)
    );
    // Only weeks that actually have ATS winners recorded
    let out = data.rows
      .filter((r) => withGames.has(r.id as string))
      .map((r) => Number(r.week_number))
      .filter((n) => !Number.isNaN(n) && n !== 99)
      .sort((a, b) => a - b);

    // Player-facing: drop orphan sim residue (e.g. Week 5 scored while live is 0)
    try {
      const { trustScoredWeeksForPlayerFacing } = await import(
        "./week-history-trust"
      );
      const published = await listPublishedWeekNumbers().catch(
        () => [] as number[]
      );
      const sid = getLeague()?.sportId;
      const active = await loadLeagueActiveWeek().catch(() =>
        sid === "nfl" ? 1 : 0
      );
      out = trustScoredWeeksForPlayerFacing(out, published, active, sid);
    } catch {
      /* keep raw out */
    }

    cacheSet(scoredCache, session.leagueId, out);
    const total =
      typeof performance !== "undefined"
        ? Math.round(performance.now() - fn0)
        : wrMs + grMs;
    wrBoardP1(
      "listScoredWeekNumbers",
      "DONE",
      total,
      `n=${out.length} (wr=${wrMs}ms + gr=${grMs}ms SERIAL)`
    );
    return out;
  } catch {
    wrBoardP1("listScoredWeekNumbers", "FAIL", undefined, "catch");
    return [];
  }
}

/** Load saved ATS covers + prop result for a week (if scored). */
export async function loadWeekResultsFromCloud(
  weekNumber: number
): Promise<{
  results: Record<string, GameResult>;
  propResult: string | null;
  scoredAt: string | null;
} | null> {
  try {
    const { foundryLiveWeekResults, isFoundryLivePagesActive } = await import("./foundry-live-adapter");
    if (isFoundryLivePagesActive()) return foundryLiveWeekResults(weekNumber);
  } catch { /* fall through */ }
  const session = getSession();
  if (!session?.leagueId) return null;
  try {
    const supabase = createClient();
    const { data: wr, error } = await supabase
      .from("week_results")
      .select("id, prop_result, scored_at")
      .eq("league_id", session.leagueId)
      .eq("week_number", weekNumber)
      .maybeSingle();
    if (error || !wr) return null;

    const { data: gr } = await supabase
      .from("game_results")
      .select("card_game_id, winner")
      .eq("week_result_id", wr.id);

    const results: Record<string, GameResult> = {};
    for (const g of gr || []) {
      const w = g.winner as "home" | "away" | "push";
      if (w === "home" || w === "away" || w === "push") {
        results[g.card_game_id as string] = {
          gameId: g.card_game_id as string,
          winner: w,
        };
      }
    }
    return {
      results,
      propResult: (wr.prop_result as string) || null,
      scoredAt: (wr.scored_at as string) || null,
    };
  } catch {
    return null;
  }
}

export async function saveResultsAndScoreWeek(opts: {
  weekNumber: number;
  games: Game[];
  prop: Prop;
  results: Record<string, GameResult>;
  propResult: string | null;
  finalBoxes?: { gameId: string; homeScore: number; awayScore: number }[];
  allowBoredPractice?: boolean;
}): Promise<ScoreWeekResult> {
  const session = getSession();
  if (!session?.leagueId || !isOps()) {
    return { ok: false, scoredCount: 0, error: "Commissioner or deputy only" };
  }

  try {
    const eyes = await import("./creator-eyes");
    if (eyes.isEyesLocalPlayActive()) {
      return {
        ok: false,
        scoredCount: 0,
        error: "PREVIEW mode — scoring is blocked for the real room.",
      };
    }
  } catch {
    /* continue */
  }

  const supplied = opts.games.map((game) => ({
    game_id: game.id,
    winner: opts.results[game.id]?.winner || null,
  }));
  if (
    !opts.games.length ||
    supplied.some(
      (row) =>
        row.winner !== "home" &&
        row.winner !== "away" &&
        row.winner !== "push"
    )
  ) {
    return {
      ok: false,
      scoredCount: 0,
      error: "Enter a cover (home/away/push) for every game before scoring.",
    };
  }
  if (!opts.propResult || !opts.prop.options?.includes(opts.propResult)) {
    return {
      ok: false,
      scoredCount: 0,
      error: "Select the published prop result before scoring.",
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("score_league_week_atomic", {
    p_league_id: session.leagueId,
    p_week_number: opts.weekNumber,
    p_results: supplied,
    p_prop_result: opts.propResult,
  });
  if (error) {
    return { ok: false, scoredCount: 0, error: error.message };
  }

  const payload = (data || {}) as {
    ok?: boolean;
    weekResultId?: string;
    scoredCount?: number;
    details?: { userId?: string; name?: string; points?: number }[];
  };
  if (!payload.ok || !payload.weekResultId) {
    return { ok: false, scoredCount: 0, error: "Atomic scoring did not finish" };
  }

  // Museum durability follows the committed score, but can never invalidate it.
  try {
    const { persistDurableFinalScores } = await import("./museum/final-scores");
    const { freezeAllegianceSnapshotsIfLocked } = await import(
      "./museum/snapshots"
    );
    const { getLeague } = await import("./league");
    await freezeAllegianceSnapshotsIfLocked({
      leagueId: session.leagueId,
      weekNumber: opts.weekNumber,
      games: opts.games,
      forceOpsVerified: true,
    });
    await persistDurableFinalScores({
      leagueId: session.leagueId,
      weekNumber: opts.weekNumber,
      weekResultId: payload.weekResultId,
      games: opts.games,
      finalBoxes: opts.finalBoxes,
      sportId: getLeague()?.sportId || "cfb",
      scoreSource: opts.finalBoxes?.length
        ? "scoring_path_boxes"
        : "scoring_path",
    });
  } catch {
    /* scoring is already committed */
  }

  try {
    localStorage.setItem(
      `warroom-results-week-${opts.weekNumber}`,
      JSON.stringify({ results: opts.results, propResult: opts.propResult })
    );
  } catch {
    /* ignore */
  }

  invalidateCloudWeekCaches(session.leagueId);
  try {
    const { snapshotGazetteAfterScore } = await import("@/lib/gazette");
    const players = await loadLeaguePlayers("scoreWeek.snapshotGazette");
    await snapshotGazetteAfterScore(players, opts.weekNumber);
  } catch {
    /* best-effort */
  }
  try {
    const { autoEngraveAllTrophies } = await import("./auto-trophies");
    const players = await loadLeaguePlayers("scoreWeek.autoTrophies");
    await autoEngraveAllTrophies({ weekNumber: opts.weekNumber, players });
  } catch {
    /* best-effort */
  }
  try {
    const { freezeFairEntryAfterScore } = await import("./fair-entry");
    await freezeFairEntryAfterScore(opts.weekNumber, session.leagueId);
  } catch {
    /* best-effort */
  }

  return {
    ok: true,
    scoredCount: payload.scoredCount || 0,
    details: (payload.details || []).map((row) => ({
      name: row.name || "Player",
      points: Number(row.points) || 0,
    })),
  };
}

/** @deprecated Audit reference only. Production uses atomic database scoring. */
export async function saveResultsAndScoreWeekLegacyUnsafe(opts: {
  weekNumber: number;
  games: Game[];
  prop: Prop;
  results: Record<string, GameResult>;
  propResult: string | null;
  /**
   * Optional final box scores (from Odds API / demo).
   * When any game is 6–7 or 7–6, grant Sixxxxx Seveennnn to everyone who locked.
   */
  finalBoxes?: { gameId: string; homeScore: number; awayScore: number }[];
  /** Pre–Week 0 practice loop: allow scoring when bored-practice is active */
  allowBoredPractice?: boolean;
}): Promise<ScoreWeekResult> {
  const session = getSession();
  let mayScore = !!(session?.leagueId && isOps());
  if (!mayScore && opts.allowBoredPractice && session?.leagueId) {
    try {
      const { isBoredPracticeScoringAllowed } = await import(
        "./bored-practice"
      );
      mayScore = isBoredPracticeScoringAllowed();
    } catch {
      mayScore = false;
    }
  }
  if (!mayScore || !session?.leagueId) {
    return { ok: false, scoredCount: 0, error: "Commissioner or deputy only" };
  }

  // Eyes preview must never score the real league
  try {
    const eyes = await import("./creator-eyes");
    if (eyes.isEyesLocalPlayActive()) {
      return {
        ok: false,
        scoredCount: 0,
        error:
          "PREVIEW mode — scoring is blocked for the real room. Exit eyes (→ Foundry) first, or use Foundry playground post/score on the live room.",
      };
    }
  } catch {
    /* continue */
  }

  const supabase = createClient();
  const leagueId = session.leagueId;
  const weekNumber = opts.weekNumber;

  // ATS winners required before writing
  const resultRowsPreview = opts.games
    .filter((g) => opts.results[g.id]?.winner)
    .map((g) => ({
      card_game_id: g.id,
      winner: opts.results[g.id].winner as string,
    }));
  if (!resultRowsPreview.length) {
    return {
      ok: false,
      scoredCount: 0,
      error: "Enter a cover (home/away/push) for each game before scoring.",
    };
  }

  // Picks first — never create week_results if nobody locked (false "done" pill)
  let allPicks: Record<string, unknown>[] | null = null;
  {
    const res = await supabase
      .from("picks")
      .select("id, user_id, prop_choice, best_bet_game_id, total_points, is_chaos")
      .eq("league_id", leagueId)
      .eq("week_number", weekNumber);
    if (res.error && /is_chaos|column/i.test(res.error.message || "")) {
      const res2 = await supabase
        .from("picks")
        .select("id, user_id, prop_choice, best_bet_game_id, total_points")
        .eq("league_id", leagueId)
        .eq("week_number", weekNumber);
      if (res2.error)
        return { ok: false, scoredCount: 0, error: res2.error.message };
      allPicks = (res2.data || []) as Record<string, unknown>[];
    } else if (res.error) {
      return { ok: false, scoredCount: 0, error: res.error.message };
    } else {
      allPicks = (res.data || []) as Record<string, unknown>[];
    }
  }
  if (!allPicks?.length) {
    return {
      ok: false,
      scoredCount: 0,
      error:
        "No locked picks for this week yet — fill the room (or bot picks) before scoring. Week will not be marked done.",
    };
  }

  const { data: existingRes } = await supabase
    .from("week_results")
    .select("id")
    .eq("league_id", leagueId)
    .eq("week_number", weekNumber)
    .maybeSingle();

  let weekResultId: string;
  if (existingRes?.id) {
    weekResultId = existingRes.id;
    await supabase
      .from("week_results")
      .update({
        prop_result: opts.propResult,
        scored_at: new Date().toISOString(),
      })
      .eq("id", weekResultId);
    await supabase.from("game_results").delete().eq("week_result_id", weekResultId);
  } else {
    const { data: wr, error } = await supabase
      .from("week_results")
      .insert({
        league_id: leagueId,
        week_number: weekNumber,
        prop_result: opts.propResult,
        scored_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !wr) {
      return {
        ok: false,
        scoredCount: 0,
        error: error?.message || "Failed to save results",
      };
    }
    weekResultId = wr.id;
  }

  const resultRows = resultRowsPreview.map((r) => ({
    week_result_id: weekResultId,
    card_game_id: r.card_game_id,
    winner: r.winner,
  }));

  {
    const { error } = await supabase.from("game_results").insert(resultRows);
    if (error) return { ok: false, scoredCount: 0, error: error.message };
  }

  // Museum Phase 1A: durable numeric finals (retry-safe for future generation).
  // Does not create museum_events. ATS winner path above is unchanged.
  try {
    const { persistDurableFinalScores } = await import("./museum/final-scores");
    const { freezeAllegianceSnapshotsIfLocked } = await import(
      "./museum/snapshots"
    );
    const { getLeague } = await import("./league");
    await freezeAllegianceSnapshotsIfLocked({
      leagueId,
      weekNumber,
      games: opts.games,
      forceOpsVerified: true,
    });
    await persistDurableFinalScores({
      leagueId,
      weekNumber,
      weekResultId,
      games: opts.games,
      finalBoxes: opts.finalBoxes,
      sportId: getLeague()?.sportId || "cfb",
      scoreSource: opts.finalBoxes?.length ? "scoring_path_boxes" : "scoring_path",
    });
    // Phase 1A generator stub — always no-op (no events)
    const { tryGenerateFanFavoriteRivalryExhibits } = await import(
      "./museum/generator-stub"
    );
    await tryGenerateFanFavoriteRivalryExhibits({
      leagueId,
      weekNumber,
      weekResultId,
    });
  } catch {
    /* never fail scoring because Museum foundation failed */
  }

  const details: { name: string; points: number }[] = [];
  let scoredCount = 0;

  // Sixxxxx Seveennnn — any final box 6–7 / 7–6 on this slate
  let sixSevenWeek = false;
  try {
    const { anySixSevenFinal } = await import("./scores");
    sixSevenWeek = anySixSevenFinal(opts.finalBoxes);
  } catch {
    sixSevenWeek = false;
  }

  for (const pickRow of allPicks) {
    const pickId = pickRow.id as string;
    const userId = pickRow.user_id as string;
    const { data: pickGames } = await supabase
      .from("pick_games")
      .select("*")
      .eq("pick_id", pickId);

    const picksMap: Record<string, UserPick> = {};
    for (const pg of pickGames || []) {
      picksMap[pg.card_game_id] = {
        gameId: pg.card_game_id,
        pick: pg.side === "away" ? "away" : "home",
        confidence: pg.confidence,
        isBestBet: pg.is_best_bet,
        lockedSpread: Number(pg.locked_spread ?? 0),
        lockedFavorite: pg.locked_favorite === "away" ? "away" : "home",
      };
    }

    const isChaos = !!pickRow.is_chaos;
    const weekScore = scoreWeek(
      picksMap,
      (pickRow.best_bet_game_id as string) || null,
      (pickRow.prop_choice as string) || null,
      opts.games,
      opts.results,
      opts.prop,
      opts.propResult,
      isChaos
    );

    const previousPoints = pickRow.total_points as number | null;
    // Re-score only when this pick already has a non-null total from a prior
    // score pass. Do NOT treat SQL default 0 as "already scored" when nullish
    // was intended — but 0 can mean a real zero week; use weekly_points index.
    let membershipWeekly: number[] = [];

    const { data: membership } = await supabase
      .from("memberships")
      .select("*")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      try {
        console.warn(
          "[score] membership missing — skipping standings update",
          { userId, weekNumber, leagueId }
        );
      } catch {
        /* ok */
      }
      continue;
    }

    membershipWeekly = Array.isArray(membership.weekly_points)
      ? [...(membership.weekly_points as number[])]
      : [];
    // Week 0 → index 0, Week 1 → index 1, … (do NOT use weekNumber-1)
    const idx = weekNumber;
    while (membershipWeekly.length <= idx) membershipWeekly.push(0);
    const priorWeekPts = membershipWeekly[idx] || 0;
    // Re-score when this membership already has points banked for this week index
    // or the pick row already carries a scored total (null = never scored).
    const alreadyScored =
      priorWeekPts > 0 ||
      (previousPoints !== null && previousPoints !== undefined);

    const pickUpdate = await supabase
      .from("picks")
      .update({ total_points: weekScore.totalPoints })
      .eq("id", pickId);
    if (pickUpdate.error) {
      try {
        console.warn("[score] pick total_points update failed", pickUpdate.error);
      } catch {
        /* ok */
      }
    }

    const pts = weekScore.totalPoints;
    const gamesCount = opts.games.length;
    const bestBetHit = weekScore.gameScores.some((g) => g.isBestBet && g.correct);
    const hadBestBet = weekScore.gameScores.some((g) => g.isBestBet);
    const hadPush = weekScore.gameScores.some((g) => g.pushed);
    if (hadPush) {
      try {
        const { markEngagement } = await import("./engagement");
        markEngagement(pickRow.user_id as string, "push_recorded");
      } catch {
        /* ignore */
      }
    }

    // Epic: any slate final is 6–7 / 7–6 (sixxxxx seveennnn).
    // Anyone with a locked card this week — correct or not, ATS irrelevant.
    if (sixSevenWeek) {
      try {
        const { markEngagement } = await import("./engagement");
        markEngagement(userId, "six_seven_final");
        const { grantPermanentBadgeId } = await import("./permanent-badges");
        grantPermanentBadgeId(userId, "six_seven", { leagueId });
      } catch {
        /* ignore */
      }
    }

    let weekly = membershipWeekly;
    let totalPoints = Number(membership.total_points) || 0;
    let atsCorrect = membership.ats_correct || 0;
    let atsTotal = membership.ats_total || 0;
    let bestWeek = membership.best_week || 0;
    let worstWeek = membership.worst_week || 0;
    let perfectWeeks = membership.perfect_weeks || 0;
    let bestBetHits = membership.best_bet_hits || 0;
    let bestBetTotal = membership.best_bet_total || 0;
    let propHits = membership.prop_hits || 0;
    let propTotal = membership.prop_total || 0;
    let weeksPlayed = membership.weeks_played || 0;
    let streak = membership.current_streak || 0;

    if (alreadyScored) {
      const oldPts =
        priorWeekPts ||
        (typeof previousPoints === "number" ? previousPoints : 0);
      totalPoints = Math.max(0, totalPoints - oldPts) + pts;
      weekly[idx] = pts;
    } else {
      weekly[idx] = pts;
      totalPoints += pts;
      atsCorrect += weekScore.correctCount;
      atsTotal += gamesCount + 1;
      bestWeek = Math.max(bestWeek, pts);
      worstWeek = weeksPlayed === 0 ? pts : Math.min(worstWeek || pts, pts);
      if (pts >= 18) perfectWeeks += 1;
      if (hadBestBet) {
        bestBetTotal += 1;
        if (bestBetHit) bestBetHits += 1;
      }
      propTotal += 1;
      if (weekScore.propCorrect) propHits += 1;
      weeksPlayed += 1;
      if (pts >= 10) streak = streak > 0 ? streak + 1 : 1;
      else streak = streak < 0 ? streak - 1 : -1;
    }

    const memUpdate = await supabase
      .from("memberships")
      .update({
        total_points: totalPoints,
        weekly_points: weekly,
        ats_correct: atsCorrect,
        ats_total: atsTotal,
        current_streak: streak,
        best_week: bestWeek,
        worst_week: worstWeek,
        perfect_weeks: perfectWeeks,
        best_bet_hits: bestBetHits,
        best_bet_total: bestBetTotal,
        prop_hits: propHits,
        prop_total: propTotal,
        weeks_played: weeksPlayed,
      })
      .eq("id", membership.id);

    if (memUpdate.error) {
      try {
        console.error(
          "[score] membership standings update FAILED",
          memUpdate.error.message,
          { userId, weekNumber, pts, totalPoints }
        );
      } catch {
        /* ok */
      }
      // Pick total may be saved; standings row failed — do not pretend success
      continue;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", pickRow.user_id)
      .maybeSingle();

    details.push({ name: profile?.display_name || "Player", points: pts });
    scoredCount += 1;
  }

  try {
    localStorage.setItem(
      "warroom-results-week-1",
      JSON.stringify({ results: opts.results, propResult: opts.propResult })
    );
  } catch {}

  // Points just changed — drop standings / week list caches before refresh reads
  try {
    invalidateCloudWeekCaches(getSession()?.leagueId);
  } catch {
    /* ignore */
  }

  // Snapshot Gazette edition for the archive (survives until season reset)
  try {
    const { snapshotGazetteAfterScore } = await import("@/lib/gazette");
    const players = await loadLeaguePlayers("scoreWeek.snapshotGazette");
    await snapshotGazetteAfterScore(players, weekNumber);
  } catch {
    /* best-effort */
  }

  // Auto Trophy Room — champs / toilet / divisions / nerd (no manual form)
  try {
    const { autoEngraveAllTrophies } = await import("./auto-trophies");
    const players = await loadLeaguePlayers("scoreWeek.autoTrophies");
    await autoEngraveAllTrophies({ weekNumber, players });
  } catch {
    /* best-effort */
  }

  // Fair Entry — freeze join bands after official score (idempotent)
  try {
    const { freezeFairEntryAfterScore } = await import("./fair-entry");
    await freezeFairEntryAfterScore(weekNumber, leagueId);
  } catch {
    /* best-effort */
  }

  return { ok: true, scoredCount, details };
}

type StandingsCloudRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  division: string;
  totalPoints: number;
  deploymentCredit: number;
  deploymentCreditBreakdown: import("./types").Player["deploymentCreditBreakdown"];
  eligibleFromWeek: number;
  weeklyPoints: number[];
  atsCorrect: number;
  atsTotal: number;
  currentStreak: number;
  bestWeek: number;
  worstWeek: number;
  perfectWeeks: number;
  bestBetHits: number;
  bestBetTotal: number;
  propHits: number;
  propTotal: number;
  weeksPlayed: number;
  lastSeenAt: string | null;
  /** memberships.joined_at — league pulse "when they entered the room" */
  joinedAt: string | null;
  isBot: boolean;
};

/** PostgREST embed may be object or single-element array. */
function embedProfile(raw: unknown): {
  display_name?: string;
  avatar_url?: string | null;
  last_seen_at?: string | null;
} | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === "object"
      ? (first as {
          display_name?: string;
          avatar_url?: string | null;
          last_seen_at?: string | null;
        })
      : null;
  }
  if (typeof raw === "object") {
    return raw as {
      display_name?: string;
      avatar_url?: string | null;
      last_seen_at?: string | null;
    };
  }
  return null;
}

function mapStandingsRows(rows: Record<string, unknown>[]): StandingsCloudRow[] {
  // Sync attribution — production freeze after memberships/standings response
  let t0 = 0;
  let end: ((fn: string, t0: number, extra?: string) => void) | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tr = require("./profile-nav-trace") as typeof import("./profile-nav-trace");
    if (tr.isProfileNavTraceActive()) {
      t0 = tr.profileNavSyncStart("mapStandingsRows");
      end = tr.profileNavSyncEnd;
    }
  } catch {
    /* ok */
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolveLeagueDisplayName } = require("./display-name") as typeof import("./display-name");
  try {
    return rows
      .map((m: Record<string, unknown>) => {
        const profile = embedProfile(m.profiles);
        return {
          userId: m.user_id as string,
          name: resolveLeagueDisplayName({
            membershipOverride: m.display_name_override as string | null,
            profileDisplayName: profile?.display_name,
            fallback: m.is_bot ? "Bot" : "Player",
          }),
          avatarUrl: (profile?.avatar_url as string | null) || null,
          division: (m.division as string) || "North",
          totalPoints: (m.total_points as number) || 0,
          deploymentCredit: (m.deployment_credit as number) || 0,
          deploymentCreditBreakdown: Array.isArray(m.deployment_credit_breakdown)
            ? (m.deployment_credit_breakdown as StandingsCloudRow["deploymentCreditBreakdown"])
            : [],
          eligibleFromWeek: (m.eligible_from_week as number) || 0,
          weeklyPoints: normalizeWeeklyPointsField(m.weekly_points),
          atsCorrect: (m.ats_correct as number) || 0,
          atsTotal: (m.ats_total as number) || 0,
          currentStreak: (m.current_streak as number) || 0,
          bestWeek: (m.best_week as number) || 0,
          worstWeek: (m.worst_week as number) || 0,
          perfectWeeks: (m.perfect_weeks as number) || 0,
          bestBetHits: (m.best_bet_hits as number) || 0,
          bestBetTotal: (m.best_bet_total as number) || 0,
          propHits: (m.prop_hits as number) || 0,
          propTotal: (m.prop_total as number) || 0,
          weeksPlayed: (m.weeks_played as number) || 0,
          lastSeenAt: (profile?.last_seen_at as string | null) || null,
          joinedAt: (m.joined_at as string | null) || null,
          isBot: !!(m.is_bot as boolean | null | undefined),
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);
  } finally {
    if (end) end("mapStandingsRows", t0, `rows=${rows.length}`);
  }
}

/**
 * Direct profiles.last_seen_at hydrate — does not depend on memberships embed.
 * Fixes silent null when embed omits last_seen_at or column was late-added.
 * Also used for soft presence polls on Standings (no full standings re-score).
 */
export async function hydratePlayersLastSeen(
  players: import("./types").Player[]
): Promise<import("./types").Player[]> {
  if (!players.length) return players;
  const humanIds = [
    ...new Set(
      players.filter((p) => !p.isMock && p.id).map((p) => p.id)
    ),
  ];
  if (!humanIds.length) return players;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, last_seen_at")
      .in("id", humanIds);
    if (error || !data?.length) return players;
    const map = new Map<string, string | null>();
    for (const row of data) {
      map.set(
        row.id as string,
        (row.last_seen_at as string | null) || null
      );
    }
    return players.map((p) => {
      if (p.isMock) return p;
      if (!map.has(p.id)) return p;
      return { ...p, lastSeenAt: map.get(p.id) ?? null };
    });
  } catch {
    return players;
  }
}

export async function loadLeagueStandings(): Promise<StandingsCloudRow[]> {
  try {
    const { profileNavLeagueWork } = await import("./profile-nav-trace");
    profileNavLeagueWork("loadLeagueStandings", "call");
  } catch {
    /* ok */
  }
  const session = getSession();
  if (!session?.leagueId) return [];
  const supabase = createClient();
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const perf = (label: string, extra?: string) => {
    try {
      if (
        typeof process !== "undefined" &&
        process.env.NODE_ENV === "development"
      ) {
        const ms =
          typeof performance !== "undefined"
            ? Math.round(performance.now() - t0)
            : 0;
        console.log(`[WR-PERF][standings] standings-query ${label} +${ms}ms`, extra || "");
      } else if (
        typeof window !== "undefined" &&
        localStorage.getItem("warroom-runtime-debug") === "1"
      ) {
        const ms =
          typeof performance !== "undefined"
            ? Math.round(performance.now() - t0)
            : 0;
        console.log(`[WR-PERF][standings] standings-query ${label} +${ms}ms`, extra || "");
      }
    } catch {
      /* ok */
    }
  };

  // One trip: membership stats + display name + last_seen (no second profiles query)
  perf("primary-start");
  const primary = await withTimeout(
    Promise.resolve(
      supabase
        .from("memberships")
        .select("*, display_name_override, profiles(display_name, avatar_url, last_seen_at)")
        .eq("league_id", session.leagueId)
    ).then((r) => ({
      data: (r.data as Record<string, unknown>[] | null) ?? null,
      error: r.error as { message?: string } | null,
    })),
    8_000,
    {
      data: null as Record<string, unknown>[] | null,
      error: { message: "timeout" } as { message?: string } | null,
    }
  );
  perf(
    "primary-done",
    primary.error
      ? `err=${primary.error.message}`
      : `rows=${primary.data?.length ?? 0}`
  );

  if (!primary.error && primary.data) {
    return mapStandingsRows(primary.data);
  }

  // Older schema / embed fail: name only — WORST CASE +6s after primary 8s
  perf("fallback-start");
  const fallback = await withTimeout(
    Promise.resolve(
      supabase
        .from("memberships")
        .select("*, display_name_override, profiles(display_name, avatar_url)")
        .eq("league_id", session.leagueId)
    ).then((r) => ({
      data: (r.data as Record<string, unknown>[] | null) ?? null,
      error: r.error as { message?: string } | null,
    })),
    6_000,
    {
      data: null as Record<string, unknown>[] | null,
      error: { message: "timeout" } as { message?: string } | null,
    }
  );
  perf(
    "fallback-done",
    fallback.error
      ? `err=${fallback.error.message}`
      : `rows=${fallback.data?.length ?? 0}`
  );
  if (!fallback.data?.length) return [];
  return mapStandingsRows(fallback.data);
}

/**
 * Cloud standings mapped to Player shape for Standings / Power Rankings / Stats.
 *
 * P0 freeze (production fcd0be18): 200+ concurrent waiters joined one inflight
 * load; when it resolved, the microtask/setState stampede froze the main thread
 * for tens of seconds. Mitigations:
 * - Longer fresh TTL + stale-while-revalidate (serve stale, revalidate once)
 * - Single-flight shared promise (unchanged)
 * - Inflight joiners share promise WITHOUT per-waiter finally logging storms
 */
export async function loadLeaguePlayers(
  caller?: string
): Promise<import("./types").Player[]> {
  try {
    const { foundryLivePlayers } = await import("./foundry-live-adapter");
    const players = foundryLivePlayers();
    if (players) return players;
  } catch { /* fall through */ }
  const who = caller || "unknown";

  const session = getSession();
  if (!session?.leagueId) return [];
  const key = session.leagueId;

  // Fresh hit — return immediately (no graph spam unless profile trace)
  const stale = cacheGetStale(
    playersCache,
    key,
    PLAYERS_TTL_MS,
    PLAYERS_STALE_MS
  );
  if (stale?.fresh) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logLoadLeaguePlayersCall, logLoadLeaguePlayersEnd } =
        require("./profile-nav-trace") as typeof import("./profile-nav-trace");
      const s = logLoadLeaguePlayersCall(
        "cache-hit",
        `n=${stale.value.length} caller=${who} ageMs=${stale.ageMs}`
      );
      logLoadLeaguePlayersEnd(s, "cache-hit", `n=${stale.value.length}`);
    } catch {
      /* ok */
    }
    return stale.value;
  }

  // Stale-while-revalidate: return stale immediately, kick ONE background refresh
  if (stale && !stale.fresh) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logLoadLeaguePlayersCall, logLoadLeaguePlayersEnd } =
        require("./profile-nav-trace") as typeof import("./profile-nav-trace");
      const s = logLoadLeaguePlayersCall(
        "cache-hit",
        `STALE n=${stale.value.length} caller=${who} ageMs=${stale.ageMs}`
      );
      logLoadLeaguePlayersEnd(s, "stale-serve", `n=${stale.value.length}`);
    } catch {
      /* ok */
    }
    if (!playersInflight.has(key)) {
      void fetchLeaguePlayersNetwork(key, `${who}+bg-revalidate`).catch(
        () => undefined
      );
    }
    return stale.value;
  }

  // No cache — join single-flight or start network
  const inflight = playersInflight.get(key);
  if (inflight) {
    // Share ONE promise. Do NOT attach per-waiter finally/console (Mike: 200+
    // inflight-join END lines = main-thread stampede when the hop resolves).
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logLoadLeaguePlayersCall, logLoadLeaguePlayersEnd } =
        require("./profile-nav-trace") as typeof import("./profile-nav-trace");
      // Count joiners sparsely for graph (every 25th)
      const s = logLoadLeaguePlayersCall(
        "inflight",
        `caller=${who} join-shared`
      );
      if (s > 0 && s % 25 === 0) {
        logLoadLeaguePlayersEnd(s, "inflight-join-sample");
      } else if (s > 0) {
        // undo depth bump for unsampled joiners so depth stays meaningful
        logLoadLeaguePlayersEnd(s, "inflight-quiet");
      }
    } catch {
      /* ok */
    }
    return inflight;
  }

  return fetchLeaguePlayersNetwork(key, who);
}

async function fetchLeaguePlayersNetwork(
  key: string,
  caller: string
): Promise<import("./types").Player[]> {
  let graphSeq = -1;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logLoadLeaguePlayersCall } =
      require("./profile-nav-trace") as typeof import("./profile-nav-trace");
    graphSeq = logLoadLeaguePlayersCall("network", `caller=${caller}`);
  } catch {
    /* ok */
  }

  const existing = playersInflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const cloud = await loadLeagueStandings();
    let mapT0 = 0;
    let mapEnd: ((fn: string, t0: number, extra?: string) => void) | null =
      null;
    try {
      const tr = await import("./profile-nav-trace");
      if (tr.isProfileNavTraceActive()) {
        mapT0 = tr.profileNavSyncStart("loadLeaguePlayers.mapToPlayer");
        mapEnd = tr.profileNavSyncEnd;
      }
    } catch {
      /* ok */
    }
    let players: import("./types").Player[];
    try {
      players = cloud.map((c) => ({
        id: c.userId,
        name: c.name,
        avatarUrl: c.avatarUrl,
        division:
          (c.division as import("./types").Player["division"]) || "North",
        totalPoints: c.totalPoints,
        deploymentCredit: c.deploymentCredit,
        deploymentCreditBreakdown: c.deploymentCreditBreakdown,
        eligibleFromWeek: c.eligibleFromWeek,
        weeklyPoints: c.weeklyPoints || [],
        atsCorrect: c.atsCorrect,
        atsTotal: c.atsTotal,
        currentStreak: c.currentStreak,
        bestWeek: c.bestWeek,
        worstWeek: c.worstWeek,
        perfectWeeks: c.perfectWeeks,
        bestBetHits: c.bestBetHits,
        bestBetTotal: c.bestBetTotal,
        propHits: c.propHits,
        propTotal: c.propTotal,
        weeksPlayed: c.weeksPlayed,
        lastSeenAt: c.lastSeenAt ?? null,
        memberSince: c.joinedAt || undefined,
        isMock: c.isBot,
      }));
    } finally {
      if (mapEnd)
        mapEnd("loadLeaguePlayers.mapToPlayer", mapT0, `n=${cloud.length}`);
    }
    // Presence: always hydrate last_seen from profiles (embed is unreliable)
    players = await hydratePlayersLastSeen(players);
    cacheSet(playersCache, key, players);
    return players;
  })()
    .then((players) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { logLoadLeaguePlayersEnd } =
          require("./profile-nav-trace") as typeof import("./profile-nav-trace");
        logLoadLeaguePlayersEnd(
          graphSeq,
          "network",
          `n=${players.length}`
        );
      } catch {
        /* ok */
      }
      return players;
    })
    .catch((err) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { logLoadLeaguePlayersEnd } =
          require("./profile-nav-trace") as typeof import("./profile-nav-trace");
        logLoadLeaguePlayersEnd(
          graphSeq,
          "network-fail",
          err instanceof Error ? err.message : "fail"
        );
      } catch {
        /* ok */
      }
      throw err;
    })
    .finally(() => {
      playersInflight.delete(key);
    });

  playersInflight.set(key, promise);
  return promise;
}

export type LeagueRosterMember = {
  membershipId: string;
  name: string;
  userId: string;
  division: "North" | "South" | "East" | "West";
  role: "commissioner" | "player";
  totalPoints: number;
  deploymentCredit?: number;
  eligibleFromWeek?: number;
  avatarUrl?: string | null;
  isBot?: boolean;
  isModerator?: boolean;
  lockerMuted?: boolean;
  isDeputy?: boolean;
  /** memberships.joined_at — join-order profile titles */
  joinedAt?: string | null;
  /** profiles.equipped_title_id — badge worn as name title */
  equippedTitleId?: string | null;
  /** profiles.equipped_border_id — avatar ring style */
  equippedBorderId?: string | null;
  /** profiles.last_seen_at — last app open */
  lastSeenAt?: string | null;
};

/** Best-effort: load titles, borders, last_seen for roster user ids. */
async function attachEquippedTitles(
  members: LeagueRosterMember[]
): Promise<LeagueRosterMember[]> {
  if (!members.length) return members;
  try {
    const supabase = createClient();
    const ids = [...new Set(members.map((m) => m.userId).filter(Boolean))];
    if (!ids.length) return members;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, avatar_url, equipped_title_id, equipped_border_id, last_seen_at")
      .in("id", ids);
    if (error || !data?.length) {
      // Columns may be partial — try smaller selects
      try {
        const { data: d2 } = await supabase
          .from("profiles")
          .select("id, equipped_title_id, equipped_border_id")
          .in("id", ids);
        if (d2?.length) {
          const titleMap = new Map<string, string | null>();
          const borderMap = new Map<string, string | null>();
          for (const row of d2) {
            titleMap.set(
              row.id as string,
              (row.equipped_title_id as string | null) || null
            );
            borderMap.set(
              row.id as string,
              (row.equipped_border_id as string | null) || null
            );
          }
          return members.map((m) => ({
            ...m,
            equippedTitleId: titleMap.get(m.userId) ?? m.equippedTitleId ?? null,
            equippedBorderId:
              borderMap.get(m.userId) ?? m.equippedBorderId ?? null,
          }));
        }
      } catch {
        /* fall through */
      }
      return members;
    }
    const titleMap = new Map<string, string | null>();
    const borderMap = new Map<string, string | null>();
    const seenMap = new Map<string, string | null>();
    const avatarMap = new Map<string, string | null>();
    for (const row of data) {
      avatarMap.set(row.id as string, (row.avatar_url as string | null) || null);
      titleMap.set(
        row.id as string,
        (row.equipped_title_id as string | null) || null
      );
      borderMap.set(
        row.id as string,
        (row.equipped_border_id as string | null) || null
      );
      seenMap.set(
        row.id as string,
        (row.last_seen_at as string | null) || null
      );
    }
    return members.map((m) => ({
      ...m,
      avatarUrl: avatarMap.get(m.userId) ?? m.avatarUrl ?? null,
      equippedTitleId: titleMap.get(m.userId) ?? m.equippedTitleId ?? null,
      equippedBorderId: borderMap.get(m.userId) ?? m.equippedBorderId ?? null,
      lastSeenAt: seenMap.get(m.userId) ?? m.lastSeenAt ?? null,
    }));
  } catch {
    return members;
  }
}

function isMissingTableError(err: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null | undefined): boolean {
  if (!err) return false;
  const code = String(err.code || "");
  const blob = `${err.message || ""} ${err.details || ""} ${err.hint || ""}`;
  return (
    code === "PGRST205" || // table not in schema cache
    code === "PGRST202" || // function not found (record_league_first_join)
    code === "42P01" ||
    /could not find the table|could not find the function|relation .* does not exist|schema cache/i.test(
      blob
    )
  );
}

/**
 * Load join times for profile titles.
 * Prefer permanent first-join (survives leave/rejoin); fall back to memberships.joined_at.
 * Never re-queries league_first_joins after a proven missing-table 404.
 */
async function loadJoinedAtByUser(
  leagueId: string
): Promise<Map<string, string>> {
  const cached = cacheGet(joinedAtCache, leagueId, JOINED_AT_TTL_MS);
  if (cached) return new Map(cached);

  const existing = joinedAtInflight.get(leagueId);
  if (existing) return existing;

  const promise = (async () => {
    const map = new Map<string, string>();
    try {
      const supabase = createClient();

      // Permanent first join — skip entirely if table known missing
      if (leagueFirstJoinsAvailable !== false) {
        const { data: firsts, error: firstErr } = await supabase
          .from("league_first_joins")
          .select("user_id, first_joined_at")
          .eq("league_id", leagueId);
        if (firstErr && isMissingTableError(firstErr)) {
          leagueFirstJoinsAvailable = false;
        } else if (!firstErr) {
          leagueFirstJoinsAvailable = true;
          if (firsts?.length) {
            for (const row of firsts) {
              const uid = row.user_id as string;
              const at = row.first_joined_at as string | null;
              if (uid && at) map.set(uid, at);
            }
          }
        }
      }

      // Memberships: fill gaps + never replace an earlier first-join
      const { data } = await supabase
        .from("memberships")
        .select("user_id, joined_at")
        .eq("league_id", leagueId);
      for (const row of data || []) {
        const uid = row.user_id as string;
        const at = row.joined_at as string | null;
        if (!uid || !at) continue;
        const prev = map.get(uid);
        if (!prev || new Date(at).getTime() < new Date(prev).getTime()) {
          map.set(uid, at);
        }
      }
    } catch {
      /* optional */
    }
    cacheSet(joinedAtCache, leagueId, map);
    return map;
  })().finally(() => {
    joinedAtInflight.delete(leagueId);
  });

  joinedAtInflight.set(leagueId, promise);
  return promise;
}

/**
 * Stamp permanent first-join for this user in the league.
 * Leave/rejoin cannot wipe OG / cool titles.
 * Requires supabase/join-order.sql (safe no-op if missing).
 */
export async function recordLeagueFirstJoin(
  leagueId?: string
): Promise<{ ok: boolean; firstJoinedAt?: string }> {
  const session = getSession();
  const lid = leagueId || session?.leagueId;
  if (!lid || !session?.playerId) return { ok: false };

  // Table/RPC not on this project — skip without Network 404 spam
  if (leagueFirstJoinsAvailable === false) return { ok: false };

  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id || session.playerId;

    // Prefer RPC (restores memberships.joined_at to original)
    const { data: rpcAt, error: rpcErr } = await supabase.rpc(
      "record_league_first_join",
      { p_league_id: lid, p_user_id: uid }
    );
    if (!rpcErr && rpcAt) {
      leagueFirstJoinsAvailable = true;
      joinedAtCache.delete(lid);
      return { ok: true, firstJoinedAt: String(rpcAt) };
    }
    if (rpcErr && isMissingTableError(rpcErr)) {
      // Function missing often co-travels with missing table
      leagueFirstJoinsAvailable = false;
      return { ok: false };
    }

    // Direct insert if RPC not installed yet
    const now = new Date().toISOString();
    const { error: insErr } = await supabase.from("league_first_joins").insert({
      league_id: lid,
      user_id: uid,
      first_joined_at: now,
    });
    if (insErr) {
      if (isMissingTableError(insErr)) {
        leagueFirstJoinsAvailable = false;
        return { ok: false };
      }
      if (!/duplicate|unique|23505/i.test(insErr.message || "")) {
        return { ok: false };
      }
    } else {
      leagueFirstJoinsAvailable = true;
    }

    const { data: row, error: selErr } = await supabase
      .from("league_first_joins")
      .select("first_joined_at")
      .eq("league_id", lid)
      .eq("user_id", uid)
      .maybeSingle();
    if (selErr && isMissingTableError(selErr)) {
      leagueFirstJoinsAvailable = false;
      return { ok: false };
    }

    const at = (row?.first_joined_at as string) || now;
    // Best-effort restore membership joined_at
    await supabase
      .from("memberships")
      .update({ joined_at: at })
      .eq("league_id", lid)
      .eq("user_id", uid);

    joinedAtCache.delete(lid);
    return { ok: true, firstJoinedAt: at };
  } catch {
    return { ok: false };
  }
}

/** Live league roster from Supabase memberships (not local mock players). */
export async function loadLeagueRoster(): Promise<LeagueRosterMember[]> {
  try {
    const { foundryLiveRoster } = await import("./foundry-live-adapter");
    const roster = foundryLiveRoster();
    if (roster) return roster;
  } catch { /* fall through */ }
  try {
    const { profileNavLeagueWork } = await import("./profile-nav-trace");
    profileNavLeagueWork("loadLeagueRoster", "call");
  } catch {
    /* ok */
  }
  const session = getSession();
  if (!session?.leagueId) return [];
  const key = session.leagueId;

  const hit = cacheGet(rosterCache, key, ROSTER_TTL_MS);
  // Empty roster is valid — only miss when undefined
  if (hit !== undefined) {
    try {
      const { profileNavLeagueWork } = await import("./profile-nav-trace");
      profileNavLeagueWork(
        "loadLeagueRoster",
        "cache-hit",
        `n=${(hit as LeagueRosterMember[]).length}`
      );
    } catch {
      /* ok */
    }
    return hit as LeagueRosterMember[];
  }

  const inflight = rosterInflight.get(key);
  if (inflight) return inflight as Promise<LeagueRosterMember[]>;

  // Cap total roster work — stuck RPC froze Home hero + RoomDataHydrator
  const promise = withTimeout(
    loadLeagueRosterFresh(key),
    8_000,
    [] as LeagueRosterMember[]
  ).finally(() => {
    rosterInflight.delete(key);
  });
  rosterInflight.set(key, promise as Promise<object[]>);
  return promise;
}

async function loadLeagueRosterFresh(
  leagueId: string
): Promise<LeagueRosterMember[]> {
  const supabase = createClient();
  // Capture at start — post-write invalidation must not be overwritten by
  // this response if it was planned against a pre-write snapshot.
  const genAtStart = rosterGeneration.get(leagueId) || 0;
  const commitRoster = (mapped: LeagueRosterMember[]) => {
    if ((rosterGeneration.get(leagueId) || 0) === genAtStart) {
      cacheSet(rosterCache, leagueId, mapped);
    }
    return mapped;
  };

  // Preferred: security-definer roster (includes bots reliably)
  // Do NOT await league_first_joins first — that was a 2-query waterfall before
  // the roster RPC even started (every hydrator paid for it).
  {
    const { data, error } = await supabase.rpc("get_league_roster", {
      p_league_id: leagueId,
    });
    if (!error && Array.isArray(data) && data.length) {
      let mapT0 = 0;
      let mapEnd: ((fn: string, t0: number, extra?: string) => void) | null =
        null;
      try {
        const tr = await import("./profile-nav-trace");
        if (tr.isProfileNavTraceActive()) {
          mapT0 = tr.profileNavSyncStart("loadLeagueRoster.mapRpc");
          mapEnd = tr.profileNavSyncEnd;
        }
      } catch {
        /* ok */
      }
      let mapped: LeagueRosterMember[];
      try {
        mapped = (data as Record<string, unknown>[])
        .map((m) => {
          const role = m.role === "commissioner" ? "commissioner" : "player";
          const division =
            (m.division as LeagueRosterMember["division"]) || "North";
          const userId = m.user_id as string;
          // RPC returns already-resolved display_name (alias ?? account)
          return {
            membershipId: m.membership_id as string,
            userId,
            name: (m.display_name as string) || "Player",
            division,
            role: role as "commissioner" | "player",
            totalPoints: (m.total_points as number) || 0,
            avatarUrl: (m.avatar_url as string | null) || null,
            isBot: !!m.is_bot,
            isModerator: !!m.is_moderator,
            lockerMuted: !!m.locker_muted,
            isDeputy: !!m.is_deputy,
            joinedAt: (m.joined_at as string | null) || null,
            equippedTitleId:
              (m.equipped_title_id as string | null) || null,
          } satisfies LeagueRosterMember;
        })
        .sort((a, b) => {
          // Humans first, then bots; alpha within each
          if (!!a.isBot !== !!b.isBot) return a.isBot ? 1 : -1;
          return a.name.localeCompare(b.name);
        });
      } finally {
        if (mapEnd) {
          mapEnd(
            "loadLeagueRoster.mapRpc",
            mapT0,
            `n=${(data as unknown[]).length}`
          );
        }
      }

      // Fill missing join times + titles/borders in parallel (not serial)
      const needsJoin = mapped.some((m) => !m.joinedAt);
      const [joinedMap, withTitles] = await Promise.all([
        needsJoin
          ? loadJoinedAtByUser(leagueId)
          : Promise.resolve(new Map<string, string>()),
        attachEquippedTitles(mapped),
      ]);
      mapped = withTitles;
      if (needsJoin && joinedMap.size) {
        mapped = mapped.map((m) => ({
          ...m,
          joinedAt: m.joinedAt || joinedMap.get(m.userId) || null,
        }));
      }
      return commitRoster(mapped);
    }
  }

  // Fallback: direct table select
  let rows: Record<string, unknown>[] | null = null;
  {
    const res = await supabase
      .from("memberships")
      .select(
        "id, user_id, role, division, total_points, deployment_credit, eligible_from_week, joined_at, is_bot, is_moderator, locker_muted, is_deputy, display_name_override, profiles(display_name, avatar_url)"
      )
      .eq("league_id", leagueId);
    if (res.error && /is_bot|display_name_override|schema cache|column/i.test(res.error.message || "")) {
      const res2 = await supabase
        .from("memberships")
        .select(
          "id, user_id, role, division, total_points, deployment_credit, eligible_from_week, joined_at, is_bot, is_moderator, locker_muted, is_deputy, profiles(display_name, avatar_url)"
        )
        .eq("league_id", leagueId);
      if (res2.error) {
        console.error("loadLeagueRoster fallback failed", res2.error);
      }
      rows = (res2.data as Record<string, unknown>[] | null) || null;
    } else if (res.error) {
      console.error("loadLeagueRoster failed", res.error);
      // Last resort without embeds
      const res3 = await supabase
        .from("memberships")
        .select("id, user_id, role, division, total_points, joined_at")
        .eq("league_id", leagueId);
      rows = (res3.data as Record<string, unknown>[] | null) || null;
    } else {
      rows = (res.data as Record<string, unknown>[] | null) || null;
    }
  }

  if (!rows?.length) {
    return commitRoster([]);
  }

  // Resolve names if embed missing
  const needsNames = rows.some((m) => !m.profiles);
  let nameById = new Map<string, string>();
  if (needsNames) {
    const ids = rows.map((m) => m.user_id as string).filter(Boolean);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    for (const p of profs || []) {
      nameById.set(p.id as string, (p.display_name as string) || "Player");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolveLeagueDisplayName } = require("./display-name") as typeof import("./display-name");
  let mapped: LeagueRosterMember[] = rows
    .map((m: Record<string, unknown>) => {
      const profile = m.profiles as {
        display_name?: string;
        avatar_url?: string | null;
        equipped_title_id?: string | null;
      } | null;
      const role: LeagueRosterMember["role"] =
        m.role === "commissioner" ? "commissioner" : "player";
      const division = (m.division as LeagueRosterMember["division"]) || "North";
      const uid = m.user_id as string;
      return {
        membershipId: m.id as string,
        userId: uid,
        name: resolveLeagueDisplayName({
          membershipOverride: m.display_name_override as string | null,
          profileDisplayName:
            profile?.display_name || nameById.get(uid) || null,
          fallback: m.is_bot ? "Bot" : "Player",
        }),
        division,
        role,
        totalPoints: (m.total_points as number) || 0,
        deploymentCredit: (m.deployment_credit as number) || 0,
        eligibleFromWeek: (m.eligible_from_week as number) || 0,
        avatarUrl: profile?.avatar_url || null,
        isBot: !!m.is_bot,
        isModerator: !!m.is_moderator,
        lockerMuted: !!m.locker_muted,
        isDeputy: !!m.is_deputy,
        joinedAt: (m.joined_at as string | null) || null,
        equippedTitleId: profile?.equipped_title_id ?? null,
      } satisfies LeagueRosterMember;
    })
    .sort((a, b) => {
      if (!!a.isBot !== !!b.isBot) return a.isBot ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

  const needsJoin = mapped.some((m) => !m.joinedAt);
  const [joinedMap, withTitles] = await Promise.all([
    needsJoin
      ? loadJoinedAtByUser(leagueId)
      : Promise.resolve(new Map<string, string>()),
    attachEquippedTitles(mapped),
  ]);
  mapped = withTitles;
  if (needsJoin && joinedMap.size) {
    mapped = mapped.map((m) => ({
      ...m,
      joinedAt: m.joinedAt || joinedMap.get(m.userId) || null,
    }));
  }
  return commitRoster(mapped);
}

/** Commissioner appoints mods/deputies; staff can mute for Locker Room. */
export async function setMemberModeration(opts: {
  userId: string;
  isModerator?: boolean | null;
  lockerMuted?: boolean | null;
  isDeputy?: boolean | null;
}): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId) return { ok: false, error: "No league" };
  if (opts.isDeputy != null && !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can appoint deputies" };
  }
  if (opts.isModerator != null && !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can appoint moderators" };
  }
  if (
    opts.lockerMuted != null &&
    !session.isCommissioner &&
    !session.isModerator
  ) {
    return { ok: false, error: "Commissioner or moderator only" };
  }
  // Need at least one permitted action path
  if (!session.isCommissioner && !session.isModerator) {
    return { ok: false, error: "Commissioner or moderator only" };
  }
  const supabase = createClient();
  const patch: Record<string, boolean> = {};
  if (opts.isDeputy != null) patch.is_deputy = opts.isDeputy;
  if (opts.isModerator != null) patch.is_moderator = opts.isModerator;
  if (opts.lockerMuted != null) patch.locker_muted = opts.lockerMuted;

  // Commissioner: prefer direct update (make + remove deputy/mod/mute).
  // Works once columns exist; avoids stale RPC signature issues.
  if (session.isCommissioner && Object.keys(patch).length) {
    const { error: upErr } = await supabase
      .from("memberships")
      .update(patch)
      .eq("league_id", session.leagueId)
      .eq("user_id", opts.userId);
    if (!upErr) return { ok: true };
    // Fall through to RPC if column missing / RLS blocks
    if (!/column|schema cache|is_deputy|is_moderator|locker_muted/i.test(upErr.message || "")) {
      // still try RPC below
    } else {
      return {
        ok: false,
        error:
          `Roles incomplete (${upErr.message}). Run supabase/staff-roles-setup.sql in Supabase SQL Editor once.`,
      };
    }
  }

  const { data, error } = await supabase.rpc("set_member_moderation", {
    p_league_id: session.leagueId,
    p_user_id: opts.userId,
    p_is_moderator: opts.isModerator ?? null,
    p_locker_muted: opts.lockerMuted ?? null,
    p_is_deputy: opts.isDeputy ?? null,
  });
  if (!error) {
    if (data && (data as { ok?: boolean }).ok === false) {
      return { ok: false, error: "Moderation update failed" };
    }
    return { ok: true };
  }

  if (/function|does not exist|schema cache|p_is_deputy|could not find/i.test(error.message || "")) {
    return {
      ok: false,
      error:
        `Roles not set up (${error.message}). Run supabase/staff-roles-setup.sql in Supabase SQL Editor once.`,
    };
  }
  return { ok: false, error: error.message };
}

/** Refresh isModerator / isDeputy on the local session from memberships. */
export async function refreshStaffSessionFlags(): Promise<void> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) return;
  if (session.isCommissioner) return;
  const supabase = createClient();
  let data: { is_moderator?: boolean; is_deputy?: boolean } | null = null;
  {
    const res = await supabase
      .from("memberships")
      .select("is_moderator, is_deputy, locker_muted")
      .eq("league_id", session.leagueId)
      .eq("user_id", session.playerId)
      .maybeSingle();
    if (res.error && /is_deputy|column|schema/i.test(res.error.message || "")) {
      const res2 = await supabase
        .from("memberships")
        .select("is_moderator, locker_muted")
        .eq("league_id", session.leagueId)
        .eq("user_id", session.playerId)
        .maybeSingle();
      data = res2.data as { is_moderator?: boolean } | null;
    } else {
      data = res.data as { is_moderator?: boolean; is_deputy?: boolean } | null;
    }
  }
  if (!data) return;
  try {
    const raw = localStorage.getItem("warroom-session");
    if (!raw) return;
    const s = JSON.parse(raw) as Record<string, unknown>;
    s.isModerator = !!data.is_moderator;
    s.isDeputy = !!data.is_deputy;
    localStorage.setItem("warroom-session", JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** True only when PostgREST cannot see the RPC (not permission / runtime errors). */
function rpcMissing(msg: string) {
  const m = msg.toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("could not find the function") ||
    /function public\.\w+.*does not exist/i.test(msg) ||
    /function \w+.*does not exist/i.test(msg)
  );
}

function trialBotsSetupHint(raw: string) {
  if (rpcMissing(raw)) {
    return (
      "Trial bots not visible to the API yet. In Supabase SQL Editor run " +
      "supabase/trial-bots-verify.sql (grants + notify pgrst reload schema), " +
      "wait 10s, hard-refresh the site. Raw: " +
      raw
    );
  }
  return raw;
}

/**
 * Mid-season replacement bots enter at the league-average of real humans
 * so they stay competitive (challenge for the rest of the field).
 * Pre-season practice bots stay at 0.
 */
async function boostNewBotsToLeagueAverage(beforeBotUserIds: Set<string>): Promise<{
  boosted: number;
  avgPoints: number;
  avgWeeks: number;
}> {
  const session = getSession();
  if (!session?.leagueId) return { boosted: 0, avgPoints: 0, avgWeeks: 0 };

  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("memberships")
    .select("id, user_id, total_points, weeks_played, is_bot")
    .eq("league_id", session.leagueId);

  if (error || !rows?.length) {
    return { boosted: 0, avgPoints: 0, avgWeeks: 0 };
  }

  type Mem = {
    id: string;
    user_id: string;
    total_points?: number | null;
    weeks_played?: number | null;
    is_bot?: boolean | null;
  };
  const list = rows as Mem[];
  const humans = list.filter((r) => !r.is_bot);
  // League average of real players (the competitive pack)
  if (!humans.length) return { boosted: 0, avgPoints: 0, avgWeeks: 0 };

  const avgPoints = Math.round(
    humans.reduce((s, r) => s + (Number(r.total_points) || 0), 0) /
      humans.length
  );
  const avgWeeks = Math.round(
    humans.reduce((s, r) => s + (Number(r.weeks_played) || 0), 0) /
      humans.length
  );

  const newBots = list.filter(
    (r) => !!r.is_bot && r.user_id && !beforeBotUserIds.has(r.user_id)
  );
  if (!newBots.length) {
    return { boosted: 0, avgPoints, avgWeeks };
  }

  let boosted = 0;
  for (const bot of newBots) {
    const { error: upErr } = await supabase
      .from("memberships")
      .update({
        total_points: avgPoints,
        weeks_played: avgWeeks,
      })
      .eq("id", bot.id);
    if (!upErr) boosted += 1;
  }
  return { boosted, avgPoints, avgWeeks };
}

/** Add trial bots up to league capacity (32). Requires trial-bots.sql. */
export async function seedTrialBotsInCloud(
  count = 50,
  opts?: {
    /**
     * Mid-season: allow pad bots for empty seats after people leave.
     * New bots get league-average points so they can still compete.
     */
    midSeasonReplacement?: boolean;
  }
): Promise<{
  ok: boolean;
  added?: number;
  totalBots?: number;
  seatsRemaining?: number;
  /** Mid-season: points assigned to each new bot */
  avgPoints?: number;
  error?: string;
}> {
  try {
    // Host preseason/mid-season bot pad is a real commissioner tool.
    // Full LAB isolation lives on Foundry entry (one-click / lab UI).
    // Emergency kill switch still blocks everything.
    const { isFoundryQuarantined, FOUNDRY_QUARANTINE_REASON } = await import(
      "./foundry-quarantine"
    );
    if (isFoundryQuarantined()) {
      return { ok: false, error: FOUNDRY_QUARANTINE_REASON };
    }
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Foundry boundary unavailable — trial bot pad blocked",
    };
  }
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }

  let midSeason = !!opts?.midSeasonReplacement;
  try {
    const { isPreseasonCommishToolsAllowed, preseasonCommishToolsBody } =
      await import("./season-mode");
    if (!isPreseasonCommishToolsAllowed()) {
      // Live season: only replacement bots (cover leavers), not free practice pads
      if (!midSeason) {
        return {
          ok: false,
          error:
            preseasonCommishToolsBody().replace(/\n+/g, " ") +
            " Mid-season: use replacement bots from Commissioner → Pad bots (enter at league average).",
        };
      }
    } else {
      midSeason = false; // preseason: bots start at 0
    }
  } catch {
    /* if import fails, fall through */
  }

  // Respect public 32-player cap — only empty seats, never replace humans/bots
  const roster = await loadLeagueRoster();
  const seats = seatsRemaining(roster.length);
  const existingBots = roster.filter((m) => m.isBot).length;
  const beforeBotUserIds = new Set(
    roster.filter((m) => m.isBot).map((m) => m.userId)
  );
  if (seats <= 0) {
    return {
      ok: true,
      added: 0,
      totalBots: existingBots,
      seatsRemaining: 0,
      error: undefined,
    };
  }
  // How many NEW bots we want (empty seats only; cap request size)
  const wantAdd = Math.min(count, seats, MAX_LEAGUE_PLAYERS);
  /**
   * seed_trial_bots evolved:
   * - Older SQL: p_count is target *total bot count* → need = p_count - existing bots
   * - Newer SQL (league-capacity-32): p_count is max to add, also capped by empty seats
   * Passing existingBots + wantAdd works for both (new SQL min()s with seats left).
   */
  const pCount = existingBots + wantAdd;

  const supabase = createClient();
  const { data, error } = await supabase.rpc("seed_trial_bots", {
    p_league_id: session.leagueId,
    p_count: pCount,
  });
  if (error) {
    return { ok: false, error: trialBotsSetupHint(error.message || "RPC failed") };
  }
  const row = (data || {}) as {
    ok?: boolean;
    added?: number;
    totalBots?: number;
    error?: string;
  };
  if (row.ok === false) {
    return { ok: false, error: row.error || "seed_trial_bots returned not ok" };
  }

  const added = row.added ?? 0;
  let avgPoints: number | undefined;
  if (midSeason && added > 0) {
    const boost = await boostNewBotsToLeagueAverage(beforeBotUserIds);
    avgPoints = boost.avgPoints;
  }

  return {
    ok: true,
    added,
    totalBots: row.totalBots ?? 0,
    seatsRemaining: seats - added,
    avgPoints,
  };
}

/**
 * Add bots for empty seats only (never replaces humans/existing bots).
 *
 * - addCount: how many NEW bots to try to add (capped by open seats)
 * - targetTotal: optional "fill until league has N players" (e.g. 16 ideal, 32 max)
 * - weekNumber: if set and a card exists, lock bot picks for that week
 * - midSeasonReplacement: live season cover for leavers; bots enter at league avg pts
 *
 * Ideal totals for clean dual brackets: 8 (4+4), 16 (8+8), 32 (16+16).
 */
export async function fillLeagueWithBotsToCap(opts?: {
  weekNumber?: number;
  /** Exact number of new bots to add (preferred when set). */
  addCount?: number;
  /** Grow roster toward this total size (e.g. 16 or 32). */
  targetTotal?: number;
  /** Live season: pad empty seats after people left; bots start at league average. */
  midSeasonReplacement?: boolean;
}): Promise<{
  ok: boolean;
  added?: number;
  totalBots?: number;
  botsFilled?: number;
  /** Crystal Ball / Super Bowl pride picks written for bots */
  crystalFilled?: number;
  seatsBefore?: number;
  rosterBefore?: number;
  rosterAfter?: number;
  /** Mid-season: points each new bot received */
  avgPoints?: number;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }

  let midSeason = !!opts?.midSeasonReplacement;
  try {
    const { isPreseasonCommishToolsAllowed, preseasonCommishToolsBody } =
      await import("./season-mode");
    if (!isPreseasonCommishToolsAllowed()) {
      if (!midSeason) {
        return {
          ok: false,
          error:
            preseasonCommishToolsBody().replace(/\n+/g, " ") +
            " Mid-season: use replacement bots (league average points).",
        };
      }
    } else {
      midSeason = false;
    }
  } catch {
    /* fall through */
  }

  async function seedCrystalBallForBots(): Promise<number> {
    // Crystal ball pride picks are a pre-season smoke tool — skip mid-season
    if (midSeason) return 0;
    try {
      const { seedBotCrystalBallPicks } = await import("./crystal-ball");
      const cb = await seedBotCrystalBallPicks();
      if (cb.ok) return cb.inserted ?? 0;
    } catch {
      /* optional */
    }
    return 0;
  }

  const roster = await loadLeagueRoster();
  const rosterBefore = roster.length;
  const seatsBefore = seatsRemaining(rosterBefore);
  if (seatsBefore <= 0) {
    const crystalFilled = await seedCrystalBallForBots();
    return {
      ok: true,
      added: 0,
      totalBots: roster.filter((m) => m.isBot).length,
      botsFilled: 0,
      crystalFilled,
      seatsBefore: 0,
      rosterBefore,
      rosterAfter: rosterBefore,
    };
  }

  let want = seatsBefore; // default: fill to 32
  if (opts?.addCount != null && Number.isFinite(opts.addCount)) {
    want = Math.max(0, Math.floor(opts.addCount));
  } else if (opts?.targetTotal != null && Number.isFinite(opts.targetTotal)) {
    const target = Math.min(
      MAX_LEAGUE_PLAYERS,
      Math.max(0, Math.floor(opts.targetTotal))
    );
    want = Math.max(0, target - rosterBefore);
  }
  want = Math.min(want, seatsBefore);

  if (want <= 0) {
    const crystalFilled = await seedCrystalBallForBots();
    return {
      ok: true,
      added: 0,
      totalBots: roster.filter((m) => m.isBot).length,
      botsFilled: 0,
      crystalFilled,
      seatsBefore,
      rosterBefore,
      rosterAfter: rosterBefore,
    };
  }

  const seed = await seedTrialBotsInCloud(want, {
    midSeasonReplacement: midSeason,
  });
  if (!seed.ok) {
    return { ok: false, error: seed.error || "Failed to add bots" };
  }

  let botsFilled = 0;
  // Mid-season: fill picks for the open week so bots can play going forward
  if (opts?.weekNumber != null) {
    const card = await loadWeekCard(opts.weekNumber);
    if (card && card.games.length > 0) {
      const fill = await seedBotPicksForWeekInCloud(opts.weekNumber);
      if (fill.ok) botsFilled = fill.botsFilled ?? 0;
      else if (seed.added === 0 && (seed.totalBots ?? 0) === 0) {
        return { ok: false, error: fill.error || "No bots to fill picks" };
      }
    }
  }

  const crystalFilled = await seedCrystalBallForBots();

  const added = seed.added ?? 0;
  return {
    ok: true,
    added,
    totalBots: seed.totalBots ?? 0,
    botsFilled,
    crystalFilled,
    seatsBefore,
    rosterBefore,
    rosterAfter: rosterBefore + added,
    avgPoints: seed.avgPoints,
  };
}

/** Known trial-bot display names (from seed_trial_bots). */
const TRIAL_BOT_NAMES = new Set(
  [
    "DJ Chaos",
    "Couch QB",
    "Line Shopper",
    "Fade Master",
    "Late Lock",
    "Sunday Scaries",
    "Vegas Vic",
    "Confidence King",
    "Dog Walker",
    "Pick Wizard",
    "Spread Sheet",
    "Over Under",
    "Locksmith",
    "Parlay Pete",
    "Unit Manager",
    "Prime Time",
    "Red Zone Ron",
    "Blown Cover",
    "Juice Box",
    "Steam Chaser",
    "Home Cooker",
    "Road Warrior",
    "Weather Guy",
    "Injury Report",
    "Sharp Adjacent",
    "Public Heat",
    "Contrarian Cat",
    "Midweek Mike",
    "Kickoff Kate",
    "Prop Queen",
    "ATS Andy",
    "Moneyline Max",
    "Teaser Tina",
    "Hedge Fund",
    "Live Bet Larry",
    "Closing Line",
    "Opening Line",
    "Bad Beat Bill",
    "Lucky Bounce",
    "No Look Nick",
    "Deep Dive Dana",
    "Rivalry Rex",
    "Division Dom",
    "Prime Rib",
    "Noonball",
    "Late Window",
    "TNF Terror",
    "MNF Machine",
    "Bye Week Bob",
    "Commissioner Bot",
  ].map((n) => n.toLowerCase())
);

/**
 * Remove trial bots only — real logged-in players stay.
 * 1) Tries clear_trial_bots RPC if installed
 * 2) Always falls back to commissioner membership deletes for is_bot + known bot names
 *    (works even when the RPC was never run / is broken)
 */
export async function clearTrialBotsInCloud(): Promise<{
  ok: boolean;
  removed?: number;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }
  // Fairness: no clearing bots after season is live / weeks scored
  try {
    const { areBotsRosterLocked, botsLockedMessage } = await import(
      "./simple-host"
    );
    if (await areBotsRosterLocked()) {
      return { ok: false, error: botsLockedMessage() };
    }
  } catch {
    /* if helper missing, allow clear (legacy) */
  }
  const supabase = createClient();
  let removed = 0;
  let rpcNote = "";

  // Preferred path: security-definer wipe (also deletes orphan bot auth users)
  try {
    const { data, error } = await supabase.rpc("clear_trial_bots", {
      p_league_id: session.leagueId,
    });
    if (!error && data && (data as { ok?: boolean }).ok !== false) {
      removed = Math.max(
        removed,
        Number((data as { removed?: number }).removed) || 0
      );
    } else if (error) {
      rpcNote = error.message || "";
    }
  } catch {
    /* fall through to membership delete */
  }

  // Fallback / second pass: remove anyone still on the roster who looks like a bot
  const roster = await loadLeagueRoster();
  const targets = roster.filter(
    (m) =>
      m.userId !== session.playerId &&
      (m.isBot === true || TRIAL_BOT_NAMES.has(m.name.trim().toLowerCase()))
  );

  const failures: string[] = [];
  for (const bot of targets) {
    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("league_id", session.leagueId)
      .eq("user_id", bot.userId);
    if (error) {
      failures.push(`${bot.name}: ${error.message}`);
    } else {
      removed += 1;
    }
  }

  if (removed === 0 && targets.length === 0 && !rpcNote) {
    return {
      ok: true,
      removed: 0,
    };
  }

  if (removed === 0 && failures.length > 0) {
    return {
      ok: false,
      error:
        "Could not delete bot memberships (permission). Run supabase/clear-trial-bots-now.sql in Supabase SQL Editor, or run supabase/commissioner-remove-member.sql once. " +
        failures[0],
    };
  }

  if (removed === 0 && rpcNote && targets.length === 0) {
    return {
      ok: false,
      error:
        "No bots found via app, and database clear failed. Run supabase/clear-trial-bots-now.sql in Supabase SQL Editor (pastes wipe all @warroom.trial bots). " +
        rpcNote,
    };
  }

  return { ok: true, removed };
}

/**
 * Sandbox / season sim: if YOU have no locked slip for the week, lock a
 * random full card (same idea as bot slips). Without this, bot-only fills
 * score everyone but the host — you always finish last with 0 pts.
 *
 * Never overwrites an already-locked human slip.
 */
export async function seedSelfSimPicksIfEmpty(
  weekNumber: number
): Promise<{ ok: boolean; filled: boolean; error?: string }> {
  try {
    const { assertFoundryNotQuarantined } = await import("./foundry-quarantine");
    const q = assertFoundryNotQuarantined("seedSelfSimPicksIfEmpty");
    if (!q.ok) return { ok: false, filled: false, error: q.reason };
  } catch (e) {
    return {
      ok: false,
      filled: false,
      error:
        e instanceof Error
          ? e.message
          : "LAB isolation unavailable — self sim pick blocked",
    };
  }
  const session = getSession();
  if (!session?.leagueId || !session.playerId) {
    return { ok: false, filled: false, error: "Not signed into a league" };
  }

  try {
    const card = await loadWeekCard(weekNumber);
    if (!card?.games?.length || !card.prop?.options?.length) {
      return { ok: false, filled: false, error: "No published card" };
    }

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id || session.playerId;
    const { data: existing } = await supabase
      .from("picks")
      .select("id, locked_at")
      .eq("league_id", session.leagueId)
      .eq("user_id", uid)
      .eq("week_number", weekNumber)
      .maybeSingle();
    if (existing?.locked_at) {
      return { ok: true, filled: false };
    }

    const games = card.games;
    const n = games.length;
    const confs = Array.from({ length: n }, (_, i) => i + 1);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = confs[i];
      confs[i] = confs[j];
      confs[j] = t;
    }
    const bestIdx = Math.floor(Math.random() * n);
    const picks: Record<string, UserPick> = {};
    games.forEach((g, i) => {
      const side: "home" | "away" = Math.random() < 0.5 ? "home" : "away";
      const fav =
        g.favorite === "away" || g.favorite === "home" ? g.favorite : "home";
      picks[g.id] = {
        gameId: g.id,
        pick: side,
        confidence: confs[i],
        isBestBet: i === bestIdx,
        lockedSpread: Number(g.spread ?? 0),
        lockedFavorite: fav,
      };
    });
    const opts = card.prop.options;
    const propChoice =
      opts[Math.random() < 0.5 ? 0 : Math.min(1, opts.length - 1)] || opts[0];

    const saved = await savePicksToCloud({
      weekNumber,
      picks,
      bestBetId: games[bestIdx]?.id || null,
      propChoice,
    });
    if (!saved.ok) {
      return {
        ok: false,
        filled: false,
        error: saved.error || "Could not lock your sim slip",
      };
    }
    return { ok: true, filled: true };
  } catch (e) {
    return {
      ok: false,
      filled: false,
      error: e instanceof Error ? e.message : "Self sim picks failed",
    };
  }
}

/** Auto-lock valid pick slips for every bot for a published week. */
export async function seedBotPicksForWeekInCloud(
  weekNumber: number,
  opts?: { chaosChance?: number; skipChaos?: boolean; skipSelf?: boolean }
): Promise<{
  ok: boolean;
  botsFilled?: number;
  selfFilled?: boolean;
  chaosCount?: number;
  chaosNames?: string[];
  error?: string;
}> {
  try {
    // Dual-use: mid-season host replacement bots need this on production rooms.
    // Foundry post/score still hard-gated at one-click + lab UI.
    // Emergency kill switch blocks; self-sim + chaos stay LAB-only below.
    const { isFoundryQuarantined, FOUNDRY_QUARANTINE_REASON } = await import(
      "./foundry-quarantine"
    );
    if (isFoundryQuarantined()) {
      return { ok: false, error: FOUNDRY_QUARANTINE_REASON };
    }
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Foundry boundary unavailable — bot pick seed blocked",
    };
  }
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc("seed_bot_picks_for_week", {
    p_league_id: session.leagueId,
    p_week_number: weekNumber,
  });
  if (error) {
    return { ok: false, error: trialBotsSetupHint(error.message || "RPC failed") };
  }
  const row = (data || {}) as {
    ok?: boolean;
    botsFilled?: number;
    error?: string;
  };
  if (row.ok === false) {
    return { ok: false, error: row.error || "Failed to fill bot picks" };
  }

  const botsFilled = row.botsFilled ?? 0;

  // You are not a bot — RPC skips humans. Lock a sim slip so you aren't 0 pts.
  let selfFilled = false;
  if (!opts?.skipSelf) {
    const self = await seedSelfSimPicksIfEmpty(weekNumber);
    selfFilled = !!self.filled;
  }

  if (opts?.skipChaos || botsFilled === 0) {
    return { ok: true, botsFilled, selfFilled, chaosCount: 0 };
  }

  // ~1 in 5 bots go Chaos so you can see 2× impact + Gazette detonation
  const chaos = await applyRandomBotChaosForWeek(weekNumber, {
    chance: opts?.chaosChance ?? 22,
  });
  return {
    ok: true,
    botsFilled,
    selfFilled,
    chaosCount: chaos.ok ? chaos.chaosCount ?? 0 : 0,
    chaosNames: chaos.names,
    error: chaos.ok ? undefined : chaos.error,
  };
}

/**
 * Sandbox: randomly arm Chaos Mode on trial bots that already locked this week.
 * Needs supabase/bot-chaos-sim.sql once. Scoring multiplies those weeks by 2×.
 */
export async function applyRandomBotChaosForWeek(
  weekNumber: number,
  opts?: { chance?: number }
): Promise<{
  ok: boolean;
  chaosCount?: number;
  names?: string[];
  error?: string;
}> {
  try {
    const { assertFoundryNotQuarantined } = await import("./foundry-quarantine");
    const q = assertFoundryNotQuarantined("applyRandomBotChaosForWeek");
    if (!q.ok) return { ok: false, error: q.reason };
  } catch (e) {
    // Fail closed — never soft-fall through isolation
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "LAB isolation unavailable — bot chaos blocked",
    };
  }
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }
  const chance = Math.max(0, Math.min(100, opts?.chance ?? 22));
  const supabase = createClient();
  const { data, error } = await supabase.rpc("apply_random_bot_chaos", {
    p_league_id: session.leagueId,
    p_week_number: weekNumber,
    p_chance: chance,
  });
  if (error) {
    if (/apply_random_bot_chaos|function|schema cache|does not exist/i.test(error.message || "")) {
      return {
        ok: false,
        error:
          "Bot Chaos sim needs supabase/bot-chaos-sim.sql run once in Supabase SQL Editor.",
      };
    }
    return { ok: false, error: error.message };
  }
  const row = (data || {}) as {
    ok?: boolean;
    chaosCount?: number;
    names?: string[];
    error?: string;
  };
  if (row.ok === false) {
    return { ok: false, error: row.error || "Failed to arm bot chaos" };
  }
  return {
    ok: true,
    chaosCount: row.chaosCount ?? 0,
    names: Array.isArray(row.names) ? row.names : [],
  };
}

/**
 * Drop roster cache so the next load is authoritative from Supabase.
 * Use after any memberships.division write (manual move or Auto Balance).
 * Also drops standings players cache for that league (division fields).
 */
export function invalidateRosterCache(leagueId?: string | null) {
  if (!leagueId) {
    rosterCache.clear();
    rosterInflight.clear();
    for (const k of [...rosterGeneration.keys()]) {
      rosterGeneration.set(k, (rosterGeneration.get(k) || 0) + 1);
    }
    playersCache.clear();
    playersInflight.clear();
    return;
  }
  rosterCache.delete(leagueId);
  rosterInflight.delete(leagueId);
  rosterGeneration.set(
    leagueId,
    (rosterGeneration.get(leagueId) || 0) + 1
  );
  // Division changes must not leave standings/players views on stale divisions
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logPlayersCacheInvalidate } =
      require("./profile-nav-trace") as typeof import("./profile-nav-trace");
    logPlayersCacheInvalidate(
      `roster-invalidate league=${String(leagueId).slice(0, 8)}`
    );
  } catch {
    /* ok */
  }
  playersCache.delete(leagueId);
  playersInflight.delete(leagueId);
}

/** Narrow event — same-device remounts can re-read without a global storm. */
export const EVENT_ROSTER_DIVISIONS_UPDATED =
  "warroom-roster-divisions-updated";

export function emitRosterDivisionsUpdated(
  leagueId: string,
  roster?: LeagueRosterMember[] | null
) {
  if (typeof window === "undefined" || !leagueId) return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_ROSTER_DIVISIONS_UPDATED, {
        detail: { leagueId, roster: roster || null },
      })
    );
  } catch {
    /* ignore */
  }
}

/** Seed cache with a verified roster (post Auto Balance). Respects generation. */
export function seedRosterCache(
  leagueId: string,
  roster: LeagueRosterMember[]
) {
  if (!leagueId) return;
  cacheSet(rosterCache, leagueId, roster);
}

/** Force a network roster read (bypasses TTL cache; ignores stale inflight). */
export async function loadLeagueRosterFreshForced(): Promise<
  LeagueRosterMember[]
> {
  const session = getSession();
  if (!session?.leagueId) return [];
  const leagueId = session.leagueId;
  invalidateRosterCache(leagueId);
  // Call fresh loader directly — do not join a concurrent loadLeagueRoster
  // inflight that may have started before the write batch.
  return withTimeout(
    loadLeagueRosterFresh(leagueId),
    8_000,
    [] as LeagueRosterMember[]
  );
}

/**
 * True when the league has a published card whose first game start_time
 * has already passed (server-authoritative times, client clock for compare).
 * Auto Balance must not run when locked.
 */
export async function isDivisionAutoBalanceLocked(
  leagueId?: string | null
): Promise<{
  locked: boolean;
  firstKickoffIso?: string | null;
  reason?: string;
}> {
  const session = getSession();
  const lid = leagueId || session?.leagueId;
  if (!lid) return { locked: false };

  try {
    const supabase = createClient();
    const { data: cards, error: cErr } = await supabase
      .from("week_cards")
      .select("id, published_at")
      .eq("league_id", lid)
      .not("published_at", "is", null);
    if (cErr) {
      // Fail closed for Auto Balance when we cannot prove preseason
      return {
        locked: true,
        reason: "Could not verify season start — Auto Balance locked for safety.",
      };
    }
    const cardIds = (cards || [])
      .map((c) => (c as { id?: string }).id)
      .filter(Boolean) as string[];
    if (!cardIds.length) {
      return { locked: false };
    }

    const { data: games, error: gErr } = await supabase
      .from("card_games")
      .select("start_time")
      .in("week_card_id", cardIds);
    if (gErr) {
      return {
        locked: true,
        reason: "Could not verify kickoff times — Auto Balance locked for safety.",
      };
    }

    let earliestMs = Number.POSITIVE_INFINITY;
    let earliestIso: string | null = null;
    for (const g of games || []) {
      const raw = (g as { start_time?: string | null }).start_time;
      if (!raw) continue;
      const t = new Date(raw).getTime();
      if (Number.isNaN(t) || t <= 0) continue;
      if (t < earliestMs) {
        earliestMs = t;
        earliestIso = new Date(t).toISOString();
      }
    }
    if (!Number.isFinite(earliestMs) || earliestMs === Number.POSITIVE_INFINITY) {
      // Published card but no parseable kicks — do not allow reshuffle
      return {
        locked: true,
        reason:
          "Published card has no kickoff times — Auto Balance is locked until kickoffs are set.",
      };
    }
    if (Date.now() >= earliestMs) {
      return {
        locked: true,
        firstKickoffIso: earliestIso,
        reason:
          "Divisions are locked — the season has started (first published kickoff has passed).",
      };
    }
    return { locked: false, firstKickoffIso: earliestIso };
  } catch {
    return {
      locked: true,
      reason: "Could not verify season start — Auto Balance locked for safety.",
    };
  }
}

export async function updateMemberDivision(
  userId: string,
  division: "North" | "South" | "East" | "West"
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  // Commissioner or deputy only — never self-service for regular players
  if (!session?.leagueId || !isOps()) {
    return {
      ok: false,
      error: "Only the commissioner or a deputy can change divisions",
    };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ division })
    .eq("league_id", session.leagueId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  invalidateRosterCache(session.leagueId);
  return { ok: true };
}

/**
 * Next division for a new join (least populated). Call before insert.
 * Does not require ops — join path only.
 */
export async function nextDivisionForJoin(
  leagueId: string
): Promise<DivisionName> {
  const supabase = createClient();
  const { data } = await supabase
    .from("memberships")
    .select("division")
    .eq("league_id", leagueId);
  return pickLeastPopulatedDivision(countByDivision(data || []));
}

export async function removeLeagueMember(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId) {
    return { ok: false, error: "No league" };
  }
  if (!session.isCommissioner && !session.isModerator) {
    return { ok: false, error: "Only the commissioner or a moderator can remove players" };
  }
  if (userId === session.playerId) {
    return { ok: false, error: "Can't remove yourself (use Account to leave or delete the league)" };
  }

  // Fairness: cannot kick filler bots after season lock
  try {
    const roster = await loadLeagueRoster();
    const target = roster.find((m) => m.userId === userId);
    if (target?.isBot) {
      const { areBotsRosterLocked, botsLockedMessage } = await import(
        "./simple-host"
      );
      if (await areBotsRosterLocked()) {
        return { ok: false, error: botsLockedMessage() };
      }
    }
  } catch {
    /* continue */
  }

  const supabase = createClient();

  // Preferred: staff RPC (bypasses pick RLS, works for mods + commish)
  {
    const { data, error } = await supabase.rpc("staff_remove_member", {
      p_league_id: session.leagueId,
      p_user_id: userId,
    });
    if (!error) {
      if (data && (data as { ok?: boolean }).ok === false) {
        return { ok: false, error: "Remove failed" };
      }
      return { ok: true };
    }
    if (!rpcMissing(error.message || "")) {
      return { ok: false, error: error.message };
    }
    // fall through if SQL not deployed yet
  }

  // Fallback: commissioner-only direct deletes (legacy)
  if (!session.isCommissioner) {
    return {
      ok: false,
      error:
        "Moderation not set up — run supabase/moderation.sql in Supabase SQL Editor once.",
    };
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("commissioner_id")
    .eq("id", session.leagueId)
    .maybeSingle();

  if (league?.commissioner_id === userId) {
    return { ok: false, error: "Can't remove the commissioner" };
  }

  // Drop their picks so standings don't keep ghost scores (bots or humans)
  await supabase
    .from("picks")
    .delete()
    .eq("league_id", session.leagueId)
    .eq("user_id", userId);

  try {
    await supabase
      .from("crystal_ball_picks")
      .delete()
      .eq("league_id", session.leagueId)
      .eq("user_id", userId);
  } catch {
    /* table may not exist / RLS */
  }

  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("league_id", session.leagueId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type AutoBalanceResult = {
  ok: boolean;
  error?: string;
  /** Verified post-save counts N/S/E/W */
  verifiedCounts?: Record<DivisionName, number>;
  verifiedLabel?: string;
  moveCount?: number;
  alreadyBalanced?: boolean;
  locked?: boolean;
  /** True when some row writes may have applied before failure */
  partial?: boolean;
  updated?: number;
  /**
   * Authoritative roster after successful balance/verify.
   * Callers must replace client roster state with this (or a fresh re-fetch).
   */
  roster?: LeagueRosterMember[];
  /**
   * Writes completed but post-save roster read failed — do not show balanced UI;
   * offer Retry Refresh.
   */
  savedButRefreshFailed?: boolean;
};

/**
 * Preview min-move Auto Balance (read-only). Fresh roster, no writes.
 */
export async function previewAutoBalanceDivisions(): Promise<{
  ok: boolean;
  error?: string;
  locked?: boolean;
  alreadyBalanced?: boolean;
  moveCount?: number;
  beforeLabel?: string;
  afterLabel?: string;
  beforeCounts?: Record<DivisionName, number>;
  afterCounts?: Record<DivisionName, number>;
  total?: number;
  sportId?: string;
  moves?: Array<{
    userId: string;
    name: string;
    from: DivisionName | null;
    to: DivisionName;
  }>;
}> {
  const session = getSession();
  if (!session?.leagueId || !isOps()) {
    return {
      ok: false,
      error: "Only the commissioner or a deputy can auto-balance",
    };
  }
  const lock = await isDivisionAutoBalanceLocked(session.leagueId);
  if (lock.locked) {
    return {
      ok: false,
      locked: true,
      error: lock.reason || "Divisions are locked for the season.",
    };
  }

  const roster = await loadLeagueRosterFreshForced();
  if (!roster.length) return { ok: false, error: "No players in this league" };
  if (roster.some((m) => m.isBot)) {
    return {
      ok: false,
      error: "Remove legacy bot seats before balancing the real roster.",
    };
  }

  const sportId = getLeague()?.sportId || "cfb";
  const plan = planMinMoveBalance(
    roster.map((m) => ({
      id: m.membershipId,
      division: m.division,
    })),
    { sportId }
  );
  const byMembershipId = new Map(roster.map((m) => [m.membershipId, m]));

  return {
    ok: true,
    alreadyBalanced: plan.alreadyBalanced,
    moveCount: plan.moveCount,
    beforeLabel: formatDivisionCounts(plan.beforeCounts),
    afterLabel: formatDivisionCounts(plan.afterCounts),
    beforeCounts: plan.beforeCounts,
    afterCounts: plan.afterCounts,
    total: roster.length,
    sportId,
    moves: plan.moves.map((move) => {
      const member = byMembershipId.get(move.id);
      return {
        userId: member?.userId || "",
        name: member?.name || "Player",
        from: move.from,
        to: move.to,
      };
    }),
  };
}

/**
 * Min-move Auto Balance with fresh input, optional sequential writes,
 * cache bust, and post-save verification. Not a DB transaction —
 * success only when a fresh read proves invariants.
 */
export async function autoBalanceDivisions(): Promise<AutoBalanceResult> {
  const session = getSession();
  if (!session?.leagueId || !isOps()) {
    return {
      ok: false,
      error: "Only the commissioner or a deputy can auto-balance",
    };
  }
  const leagueId = session.leagueId;

  const lock = await isDivisionAutoBalanceLocked(leagueId);
  if (lock.locked) {
    return {
      ok: false,
      locked: true,
      error: lock.reason || "Divisions are locked for the season.",
    };
  }

  // A. Fresh authoritative roster
  let roster: LeagueRosterMember[];
  try {
    roster = await loadLeagueRosterFreshForced();
  } catch {
    return { ok: false, error: "Could not load roster" };
  }
  if (!roster.length) return { ok: false, error: "No players in this league" };
  if (roster.some((m) => m.isBot)) {
    return {
      ok: false,
      error: "Remove legacy bot seats before balancing the real roster.",
    };
  }

  // Reject missing membership ids (cannot plan safely)
  if (roster.some((m) => !m.membershipId)) {
    return {
      ok: false,
      error: "Roster is missing membership ids — cannot balance safely.",
    };
  }

  const sportId = getLeague()?.sportId || "cfb";
  const plan = planMinMoveBalance(
    roster.map((m) => ({
      id: m.membershipId,
      division: m.division,
    })),
    { sportId }
  );

  if (plan.alreadyBalanced || plan.moveCount === 0) {
    // No writes — still verify live state
    invalidateRosterCache(leagueId);
    const check = await loadLeagueRosterFreshForced();
    if (!check.length) {
      return {
        ok: false,
        error: "Could not re-read roster to verify balance. Tap Retry Refresh.",
        savedButRefreshFailed: true,
      };
    }
    const { counts, invalid } = countByDivisionStrict(
      check.map((m) => ({ division: m.division }))
    );
    if (
      !isLeagueDivisionBalanced(counts, check.length, {
        sportId,
        invalid,
      })
    ) {
      return {
        ok: false,
        error: `League is not balanced on re-read (${formatDivisionCounts(counts)}). Try again.`,
        verifiedCounts: counts,
        roster: check,
      };
    }
    seedRosterCache(leagueId, check);
    emitRosterDivisionsUpdated(leagueId, check);
    return {
      ok: true,
      alreadyBalanced: true,
      moveCount: 0,
      updated: 0,
      verifiedCounts: counts,
      verifiedLabel: formatDivisionCounts(counts),
      roster: check,
    };
  }

  const supabase = createClient();
  let updated = 0;
  let partial = false;

  // C. Sequential writes (no transactional RPC in production). Stop on first error.
  for (const move of plan.moves) {
    const { data, error } = await supabase
      .from("memberships")
      .update({ division: move.to })
      .eq("id", move.id)
      .eq("league_id", leagueId)
      .select("id")
      .maybeSingle();

    if (error) {
      invalidateRosterCache(leagueId);
      return {
        ok: false,
        partial: updated > 0,
        updated,
        error:
          updated > 0
            ? `Auto Balance stopped after ${updated} move(s): ${error.message}. Assignments may be partially updated — review divisions before trying again.`
            : error.message,
      };
    }
    if (!data?.id) {
      invalidateRosterCache(leagueId);
      return {
        ok: false,
        partial: updated > 0,
        updated,
        error:
          updated > 0
            ? `Auto Balance stopped after ${updated} move(s): a membership update matched no row. Assignments may be partially updated — review divisions.`
            : "A membership update matched no row (permission or missing id).",
      };
    }
    updated += 1;
    partial = true;
  }

  // D + E. Invalidate, fresh read, verify invariants + plan match
  invalidateRosterCache(leagueId);
  let verified: LeagueRosterMember[];
  try {
    verified = await loadLeagueRosterFreshForced();
  } catch {
    return {
      ok: false,
      partial: true,
      updated,
      savedButRefreshFailed: true,
      moveCount: plan.moveCount,
      error:
        "Assignments were saved, but the roster could not be reloaded. Tap Retry Refresh — do not assume the on-screen columns are current.",
    };
  }

  if (!verified.length) {
    return {
      ok: false,
      partial: true,
      updated,
      savedButRefreshFailed: true,
      moveCount: plan.moveCount,
      error:
        "Assignments were saved, but the roster re-read returned empty. Tap Retry Refresh.",
    };
  }

  const { counts, invalid } = countByDivisionStrict(
    verified.map((m) => ({ division: m.division }))
  );

  if (verified.length !== roster.length) {
    seedRosterCache(leagueId, verified);
    emitRosterDivisionsUpdated(leagueId, verified);
    return {
      ok: false,
      partial: true,
      updated,
      verifiedCounts: counts,
      roster: verified,
      error: `Roster size changed during balance (${roster.length} → ${verified.length}). Review divisions.`,
    };
  }

  if (invalid > 0) {
    seedRosterCache(leagueId, verified);
    emitRosterDivisionsUpdated(leagueId, verified);
    return {
      ok: false,
      partial: true,
      updated,
      verifiedCounts: counts,
      roster: verified,
      error: `Verification failed: ${invalid} membership(s) still have invalid division. Counts: ${formatDivisionCounts(counts)}.`,
    };
  }

  if (
    !isLeagueDivisionBalanced(counts, verified.length, {
      sportId,
      invalid,
    })
  ) {
    seedRosterCache(leagueId, verified);
    emitRosterDivisionsUpdated(leagueId, verified);
    return {
      ok: false,
      partial: true,
      updated,
      verifiedCounts: counts,
      roster: verified,
      error: `Verification failed — not balanced. Actual: ${formatDivisionCounts(counts)}.`,
    };
  }

  // Plan match: every membership id at planned division
  const planned = new Map(plan.assignments.map((a) => [a.id, a.division]));
  for (const m of verified) {
    const want = planned.get(m.membershipId);
    if (!want || m.division !== want) {
      seedRosterCache(leagueId, verified);
      emitRosterDivisionsUpdated(leagueId, verified);
      return {
        ok: false,
        partial: true,
        updated,
        verifiedCounts: counts,
        roster: verified,
        error: `Verification failed — saved assignment does not match the approved plan. Actual: ${formatDivisionCounts(counts)}.`,
      };
    }
  }

  seedRosterCache(leagueId, verified);
  emitRosterDivisionsUpdated(leagueId, verified);

  return {
    ok: true,
    updated,
    moveCount: plan.moveCount,
    verifiedCounts: counts,
    verifiedLabel: formatDivisionCounts(counts),
    alreadyBalanced: false,
    roster: verified,
  };
}

export type ResetSeasonResult = {
  ok: boolean;
  error?: string;
  membersKept?: number;
  picksDeleted?: number;
  cardsDeleted?: number;
  resultsDeleted?: number;
  /** Decade-room framing: same league, new board */
  nextSeasonReady?: boolean;
  message?: string;
};

/**
 * Start the next season in the SAME league (decade clubhouse).
 *
 * Wipes the live board (cards, picks, results, season stats, this season's
 * Gazette / Crystal Ball / locker noise). Keeps:
 *  - league id, code, name, settings, commissioner
 *  - every membership (humans + bots until host clears)
 *  - Trophy Room engravings (multi-year hardware)
 *  - Museum / career permanence outside this season's board
 *
 * This is the intentional year-over-year path — not "delete league."
 */
export async function startNextSeasonInCloud(): Promise<ResetSeasonResult> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return {
      ok: false,
      error: "Only the commissioner can start the next season",
    };
  }

  // Stamp room loyalty for humans who finished enough weeks before wipe
  try {
    const scored = await listScoredWeekNumbers();
    if (scored.length >= 6) {
      const roster = await loadLeagueRoster();
      const { recordSeasonInLeague } = await import("./league-seasons");
      const { defaultSeasonYear } = await import("./trophies");
      const year = defaultSeasonYear();
      const league = getLeague();
      for (const m of roster) {
        if (m.isBot) continue;
        recordSeasonInLeague({
          playerId: m.userId,
          leagueId: session.leagueId,
          seasonYear: year,
          code: league?.code,
          weeksPlayed: scored.length,
        });
      }
    }
  } catch {
    /* loyalty stamp optional */
  }

  const result = await resetSeasonInCloud();
  if (!result.ok) return result;

  return {
    ...result,
    nextSeasonReady: true,
    message:
      "Next season is open in this same room. Players, code, and Trophy Room stay. Publish a card when you're ready.",
  };
}

/**
 * Wipe season data (picks, cards, results, scores, Crystal Ball, etc.) but KEEP all members.
 * Commissioner only. **Single authority:** SECURITY DEFINER `reset_league_season`.
 *
 * No client-side DELETE fallback (H-08B revoked authenticated DELETE on crystal_ball_picks;
 * partial client wipes produced fake success). On RPC failure → honest error only.
 */
export async function resetSeasonInCloud(): Promise<ResetSeasonResult> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can reset the season" };
  }

  const supabase = createClient();
  const leagueId = session.leagueId;

  const { data, error } = await supabase.rpc("reset_league_season", {
    p_league_id: leagueId,
  });

  if (error) {
    const msg = error.message || "";
    if (
      error.code === "PGRST202" ||
      /could not find the function|schema cache|does not exist/i.test(msg)
    ) {
      return {
        ok: false,
        error:
          "Season reset is not available on this database (reset_league_season missing). Run supabase/reset-season.sql in Supabase, then try again. No partial wipe was applied.",
      };
    }
    if (/not authenticated/i.test(msg)) {
      return { ok: false, error: "Sign in to reset the season." };
    }
    if (/only the commissioner/i.test(msg)) {
      return {
        ok: false,
        error: "Only the commissioner can reset the season",
      };
    }
    return {
      ok: false,
      error: msg || "Failed to reset season. No partial wipe was applied.",
    };
  }

  const row = (typeof data === "string"
    ? (JSON.parse(data) as Record<string, unknown>)
    : (data as Record<string, unknown> | null)) || {};

  if (row.ok === false) {
    return {
      ok: false,
      error:
        String(row.error || row.message || "Season reset was rejected by the server."),
    };
  }

  // Read-only post-check: if board/CB rows remain, do not claim success
  // (older RPC / partial failure). Never client-DELETE to "finish" the job.
  try {
    const leftoverWeeks = await listScoredWeekNumbers();
    const { count: cbPicksLeft, error: cbErr } = await supabase
      .from("crystal_ball_picks")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId);
    let cbResultsLeft = 0;
    const { count: cbResCount, error: cbResErr } = await supabase
      .from("crystal_ball_result")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId);
    if (!cbResErr) cbResultsLeft = cbResCount ?? 0;
    // Missing CB tables: treat as cleared (RPC already no-op'd via undefined_table)
    const cbUnreadable =
      (cbErr &&
        !/schema cache|does not exist|PGRST|42P01/i.test(cbErr.message || "")) ||
      (cbResErr &&
        !/schema cache|does not exist|PGRST|42P01/i.test(
          cbResErr.message || ""
        ));
    if (cbUnreadable) {
      return {
        ok: false,
        error:
          "Season reset returned success but Crystal Ball could not be verified. Refresh and check the board before continuing.",
      };
    }
    if (
      leftoverWeeks.length > 0 ||
      (cbPicksLeft ?? 0) > 0 ||
      cbResultsLeft > 0
    ) {
      return {
        ok: false,
        error:
          "Season reset did not fully clear this league (scored weeks or Crystal Ball data remain). No client wipe was applied — re-run reset or check the reset_league_season function on the server.",
      };
    }
  } catch {
    return {
      ok: false,
      error:
        "Season reset could not be verified after the server call. Refresh and confirm the board is clear before continuing.",
    };
  }

  const result: ResetSeasonResult = {
    ok: true,
    membersKept:
      typeof row.membersKept === "number"
        ? row.membersKept
        : Number(row.membersKept) || undefined,
    picksDeleted:
      typeof row.picksDeleted === "number"
        ? row.picksDeleted
        : Number(row.picksDeleted) || undefined,
    cardsDeleted:
      typeof row.cardsDeleted === "number"
        ? row.cardsDeleted
        : Number(row.cardsDeleted) || undefined,
    resultsDeleted:
      typeof row.resultsDeleted === "number"
        ? row.resultsDeleted
        : Number(row.resultsDeleted) || undefined,
  };

  // Local device caches only — no cloud DELETEs
  try {
    for (let w = 0; w <= 22; w++) {
      localStorage.removeItem(`warroom-card-week-${w}`);
      localStorage.removeItem(`warroom-results-week-${w}`);
      localStorage.removeItem(`warroom-picks-week-${w}`);
    }
    try {
      const { writeScopedActiveWeek, LEGACY_ACTIVE_WEEK_KEY } = await import(
        "./active-week-storage"
      );
      writeScopedActiveWeek(0, {
        userId: getSession()?.playerId,
        leagueId,
        sportId: getLeague()?.sportId || "cfb",
      });
      localStorage.removeItem(LEGACY_ACTIVE_WEEK_KEY);
    } catch {
      /* ignore */
    }
    cacheSet(activeWeekCache, leagueId, 0);
    activeWeekInflight.delete(leagueId);
    localStorage.removeItem(`warroom-crystal-ball-${leagueId}`);
    try {
      const { savePlayers } = await import("./store");
      savePlayers([]);
    } catch {
      /* ignore */
    }
    const prefixes = [
      "warroom-gazette-seen-v1:",
      "warroom-ring-ceremony-seen",
      "warroom-badge-celebrated",
      "warroom-first-final",
    ];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (prefixes.some((p) => k.startsWith(p))) localStorage.removeItem(k);
    }
    try {
      const { clearGazetteCopyForLeague } = await import(
        "./gazette-copy-engine"
      );
      clearGazetteCopyForLeague(leagueId);
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }

  try {
    const { afterSeasonResetLocalCleanup } = await import("./sandbox-wipe");
    const roster = await loadLeagueRoster();
    await afterSeasonResetLocalCleanup({
      leagueId,
      playerIds: roster.map((m) => m.userId),
    });
  } catch {
    /* best-effort local only */
  }

  try {
    invalidateCloudWeekCaches(leagueId);
  } catch {
    /* ignore */
  }

  return result;
}
