/**
 * League-earned rewards ledger.
 *
 * PRODUCT RULE: Fun stuff (cheevos, permanent grants, titles, hardware
 * badges) only sticks if you finish the league season. Quit mid-season
 * (not "knocked out" — leave the room) and everything earned while in
 * that league is forfeited. Account-wide discoveries (eggs, etc.) never
 * go on this ledger and always stick.
 */

import { getBadgeDef } from "./badges";
import {
  unbankCareerBadgeId,
  getCareerBadgeIds,
} from "./career-cheevo";
import {
  revokePermanentBadgeId,
  getPermanentBadgeIds,
} from "./permanent-badges";
import {
  clearBadgeEarnMetaForIds,
  listBadgeEarnMetaForPlayer,
} from "./badge-earn-meta";
import { clearBadgeStackSeasonEvents } from "./badge-stacks";
import { isSandboxProtectedBadge } from "./season-mode";
import { defaultSeasonYear } from "./trophies";
import { createClient } from "@/lib/supabase/client";
import { weekDateWindow, SEASON_MAX_WEEK } from "./season-calendar";

const KEY = "warroom-league-earned-v1";

/** Never forfeit these — account discoveries / creator / prior-season lore */
const ALWAYS_KEEP = new Set([
  "the_commissioner",
  "war_room_legend",
  "worlds_greatest_cavalry_scout",
  "neighborhood_creeper",
  "calendar_cosplayer",
]);

type LeagueMap = Record<string, string[]>; // leagueId → badgeIds
type Store = Record<string, LeagueMap>; // playerId → …

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): Store {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeAll(map: Store) {
  if (!canUse()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function isEggOrAlwaysKeep(badgeId: string): boolean {
  if (!badgeId) return true;
  if (ALWAYS_KEEP.has(badgeId)) return true;
  if (badgeId.startsWith("egg_")) return true;
  if (isSandboxProtectedBadge(badgeId) && ALWAYS_KEEP.has(badgeId)) return true;
  // Eggs are sandbox-protected; keep all egg_* always
  return false;
}

/** Active league from session (best-effort). */
export function activeLeagueIdForEarn(): string | null {
  try {
    const { getSession } = require("./league") as typeof import("./league");
    return getSession()?.leagueId || null;
  } catch {
    return null;
  }
}

/**
 * Record that this badge was earned while in this league.
 * No-ops for eggs / always-keep ids.
 */
export function recordLeagueEarnedBadge(
  playerId: string,
  leagueId: string | null | undefined,
  badgeId: string
): void {
  if (!playerId || !leagueId || !badgeId || !canUse()) return;
  if (isEggOrAlwaysKeep(badgeId)) return;

  const all = readAll();
  if (!all[playerId]) all[playerId] = {};
  const list = all[playerId][leagueId] || [];
  if (list.includes(badgeId)) return;
  all[playerId][leagueId] = [...list, badgeId];
  writeAll(all);
}

export function listLeagueEarnedBadges(
  playerId: string,
  leagueId: string
): string[] {
  if (!playerId || !leagueId) return [];
  return [...(readAll()[playerId]?.[leagueId] || [])];
}

export function clearLeagueEarnedLedger(
  playerId: string,
  leagueId: string
): string[] {
  if (!playerId || !leagueId) return [];
  const all = readAll();
  const list = all[playerId]?.[leagueId] || [];
  if (!list.length) return [];
  if (all[playerId]) {
    delete all[playerId][leagueId];
    if (!Object.keys(all[playerId]).length) delete all[playerId];
  }
  writeAll(all);
  return list;
}

/**
 * Opening week / doors open for this sport (CFB Aug 23 · NFL Kickoff).
 */
export function isOpeningWeekStarted(
  sportId?: string | null,
  now = Date.now()
): boolean {
  try {
    const { isSeasonOpen } =
      require("./season-countdown") as typeof import("./season-countdown");
    return isSeasonOpen(now, sportId);
  } catch {
    return true;
  }
}

/**
 * Blue Falcon + cheevo forfeit when leaving a live season early:
 * - Season doors / opening week have STARTED, AND
 * - Season is not finished yet
 *
 * Before opening week (preseason practice): clean leave — no Blue Falcon.
 * After the season ends: keep cheevos / hardware.
 * Knocked out of brackets but still in the room: never a leave forfeit.
 */
export function leaveAppliesPenalties(opts: {
  sportId?: string | null;
  seasonFinished: boolean;
  now?: number;
}): boolean {
  if (opts.seasonFinished) return false;
  // Only after opening week has begun — not for preseason ghosting out of dry-runs
  return isOpeningWeekStarted(opts.sportId, opts.now ?? Date.now());
}

/**
 * Season is "finished" for keep-rewards purposes when:
 * - Championship hardware is engraved for the current season year, OR
 * - Calendar is past the final week window (CFP / Super Bowl slate end).
 *
 * Knocked out of brackets but still in the room does NOT forfeit —
 * only leaving the membership early does.
 */
export async function isLeagueSeasonFinishedForRewards(
  leagueId: string,
  sportId?: string | null
): Promise<boolean> {
  if (!leagueId) return false;

  const year = defaultSeasonYear();

  // Engraved championship = official end ceremony ran
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("league_trophies")
      .select("id")
      .eq("league_id", leagueId)
      .eq("trophy_type", "championship")
      .eq("season_year", year)
      .maybeSingle();
    if (data?.id) return true;
  } catch {
    /* table may be missing */
  }

  // Past final week calendar end
  try {
    const win = weekDateWindow(SEASON_MAX_WEEK, sportId || "cfb");
    if (win?.endDate) {
      const end = new Date(`${win.endDate}T23:59:59`);
      if (Number.isFinite(end.getTime()) && Date.now() > end.getTime()) {
        return true;
      }
    }
  } catch {
    /* ignore */
  }

  return false;
}

export type EarlyLeaveForfeitResult = {
  /** Season already finished — rewards kept */
  kept: boolean;
  forfeitedBadgeIds: string[];
  message: string;
};

/**
 * Strip cheevos / permanent grants / career bank / earn meta earned in
 * this league. Call BEFORE deleting membership (needs league queries).
 */
export async function forfeitRewardsOnEarlyLeave(opts: {
  playerId: string;
  leagueId: string;
  sportId?: string | null;
}): Promise<EarlyLeaveForfeitResult> {
  const { playerId, leagueId, sportId } = opts;
  if (!playerId || !leagueId) {
    return {
      kept: true,
      forfeitedBadgeIds: [],
      message: "Nothing to forfeit.",
    };
  }

  const finished = await isLeagueSeasonFinishedForRewards(leagueId, sportId);
  if (finished) {
    // Still clear ledger row (season done; bank stays)
    clearLeagueEarnedLedger(playerId, leagueId);
    return {
      kept: true,
      forfeitedBadgeIds: [],
      message:
        "Season finished — your cheevos and hardware from this league stay.",
    };
  }

  // Before opening week: free leave — no forfeit / no Blue Falcon
  if (!leaveAppliesPenalties({ sportId, seasonFinished: false })) {
    clearLeagueEarnedLedger(playerId, leagueId);
    return {
      kept: true,
      forfeitedBadgeIds: [],
      message:
        "Left before opening week — clean exit. No Blue Falcon. Cheevos stay.",
    };
  }

  // Collect badge ids: ledger + earn meta stamped with this leagueId
  const fromLedger = listLeagueEarnedBadges(playerId, leagueId);
  const fromMeta: string[] = [];
  const year = defaultSeasonYear();
  let onlyThisLeague = true;
  try {
    const supabase = createClient();
    const { count } = await supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("user_id", playerId);
    // Still a member of this one (+ maybe others). count includes this league.
    onlyThisLeague = (count ?? 1) <= 1;
  } catch {
    onlyThisLeague = true;
  }

  try {
    const metas = listBadgeEarnMetaForPlayer(playerId);
    for (const [badgeId, meta] of Object.entries(metas)) {
      if (meta.leagueId === leagueId) {
        fromMeta.push(badgeId);
        continue;
      }
      // Pre-tracking stamps: if this is their only room and earn is this season,
      // treat as league-earned so early leave still bites.
      if (
        onlyThisLeague &&
        !meta.leagueId &&
        meta.seasonYear === year &&
        !isEggOrAlwaysKeep(badgeId)
      ) {
        fromMeta.push(badgeId);
      }
    }
  } catch {
    /* ignore */
  }

  const candidates = new Set([...fromLedger, ...fromMeta]);
  const forfeited: string[] = [];

  for (const badgeId of candidates) {
    if (isEggOrAlwaysKeep(badgeId)) continue;
    // Prior-season legend that wasn't earned in this league ledger stays
    if (
      badgeId === "war_room_legend" &&
      !fromLedger.includes(badgeId) &&
      !fromMeta.includes(badgeId)
    ) {
      continue;
    }

    forfeited.push(badgeId);

    try {
      const pts = getBadgeDef(badgeId)?.points ?? 0;
      unbankCareerBadgeId(playerId, badgeId, pts);
    } catch {
      /* ignore */
    }
    try {
      revokePermanentBadgeId(playerId, badgeId);
    } catch {
      /* ignore */
    }
    try {
      clearBadgeStackSeasonEvents(playerId, badgeId, year);
    } catch {
      /* ignore */
    }
  }

  try {
    clearBadgeEarnMetaForIds(playerId, forfeited);
  } catch {
    /* ignore */
  }

  clearLeagueEarnedLedger(playerId, leagueId);

  // First & Final claims for this league
  try {
    const { clearFirstFinalForUserInLeague } = await import("./first-final");
    clearFirstFinalForUserInLeague(playerId, leagueId);
  } catch {
    /* ignore */
  }

  // Unequip title if it was a forfeited badge
  try {
    const { getLocalEquippedBadgeId, setMyEquippedTitle } = await import(
      "./equipped-title-store"
    );
    const eq = getLocalEquippedBadgeId(playerId);
    if (eq && forfeited.includes(eq)) {
      await setMyEquippedTitle(null, { force: true });
    }
  } catch {
    /* ignore */
  }

  // Quiet re-check: permanent list may still hold protected
  void getPermanentBadgeIds(playerId);
  void getCareerBadgeIds(playerId);

  return {
    kept: false,
    forfeitedBadgeIds: forfeited,
    message:
      forfeited.length > 0
        ? `Left early — forfeited ${forfeited.length} cheevo(s) / hardware from this league. Finish the season to keep the fun stuff.`
        : "Left early. Any future unlocks in a league only stick if you finish.",
  };
}
