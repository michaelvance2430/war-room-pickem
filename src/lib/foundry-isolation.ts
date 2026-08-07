/**
 * Foundry isolation — hard boundary so lab tools never mutate production reality.
 *
 * Incident (E0): simulation advanced a production league via real scoring /
 * week-advance paths. Calendar "sandbox mode" is NOT enough (it is true for
 * every room before season open).
 *
 * Law:
 *   Foundry / lab mutations require an EXPLICITLY marked lab league.
 *   Failed boundary check → hard stop. No soft fallback.
 *
 * Explicit lab signals (any one):
 *   - league.mode in foundry | sandbox | demo
 *   - league.is_test / settings.isTest / settings.is_test
 *   - local device mark (warroom-foundry-lab-league-ids-v1)
 *   - guest-* league ids
 *
 * NOT sufficient: preseason calendar alone, creator sticky alone.
 */

import { isAppCreator } from "@/lib/creator";
import { getLeague, getSession, updateLeagueSettings } from "@/lib/league";
import { createClient } from "@/lib/supabase/client";
import type { LeagueMode } from "@/lib/league-mode";

const LAB_LEAGUE_IDS_KEY = "warroom-foundry-lab-league-ids-v1";

export const FOUNDRY_LAB_BLOCK_REASON =
  "LAB boundary: Foundry only runs on explicitly marked test leagues. This room is production (or unmarked). Mark it as LAB on Foundry, or switch to a disposable room. No simulation writes were applied.";

export const FOUNDRY_CREATOR_BLOCK_REASON =
  "LAB boundary: Foundry tools are creator-only.";

export const FOUNDRY_NO_LEAGUE_REASON =
  "LAB boundary: no active league. Open a marked LAB room first.";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readLabIdSet(): Set<string> {
  if (!canUseStorage()) return new Set();
  try {
    const raw = localStorage.getItem(LAB_LEAGUE_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "string" && x.length > 0));
  } catch {
    return new Set();
  }
}

function writeLabIdSet(ids: Set<string>) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(LAB_LEAGUE_IDS_KEY, JSON.stringify([...ids]));
    window.dispatchEvent(new CustomEvent("warroom-foundry-lab-leagues"));
  } catch {
    /* ignore */
  }
}

export function listFoundryLabLeagueIds(): string[] {
  return [...readLabIdSet()];
}

export function isLeagueIdMarkedFoundryLab(leagueId: string | null | undefined): boolean {
  if (!leagueId) return false;
  return readLabIdSet().has(leagueId);
}

/** Persist the server-authoritative LAB mark, then mirror it locally. */
export async function markLeagueAsFoundryLab(
  leagueId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!leagueId) return { ok: false, error: "No active league" };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leagues")
    .update({ mode: "foundry" })
    .eq("id", leagueId)
    .select("id, mode")
    .maybeSingle();
  if (error || data?.mode !== "foundry") {
    return {
      ok: false,
      error: error?.message || "Database did not confirm LAB mode",
    };
  }
  const ids = readLabIdSet();
  ids.add(leagueId);
  writeLabIdSet(ids);
  try {
    const league = getLeague();
    if (league?.id === leagueId) {
      const updated = updateLeagueSettings({ isTest: true, mode: "foundry" });
      if (updated) updated.mode = "foundry";
    }
  } catch {
    /* local settings optional */
  }
  return { ok: true };
}

export async function unmarkLeagueAsFoundryLab(
  leagueId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!leagueId) return { ok: false, error: "No active league" };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leagues")
    .update({ mode: "production" })
    .eq("id", leagueId)
    .select("id, mode")
    .maybeSingle();
  if (error || data?.mode !== "production") {
    return {
      ok: false,
      error: error?.message || "Database did not confirm production mode",
    };
  }
  const ids = readLabIdSet();
  ids.delete(leagueId);
  writeLabIdSet(ids);
  try {
    const league = getLeague();
    if (league?.id === leagueId) {
      const updated = updateLeagueSettings({ isTest: false, mode: "production" });
      if (updated) updated.mode = "production";
    }
  } catch {
    /* ok */
  }
  return { ok: true };
}

export type LabLeagueInput = {
  id?: string | null;
  mode?: unknown;
  is_test?: unknown;
  name?: string | null;
  settings?: {
    mode?: unknown;
    isTest?: unknown;
    is_test?: unknown;
  } | null;
} | null;

/**
 * True only when the league is explicitly a lab/test room.
 * Does NOT use preseason calendar (that would allow every live room before open).
 */
export function isExplicitLabLeague(league?: LabLeagueInput): boolean {
  let lg = league;
  if (!lg) {
    try {
      lg = getLeague() as LabLeagueInput;
    } catch {
      lg = null;
    }
  }
  if (!lg) return false;

  const id = typeof lg.id === "string" ? lg.id : "";
  if (id === "guest-demo-league" || id.startsWith("guest-")) return true;
  const rawMode = lg.mode ?? lg.settings?.mode;
  if (rawMode === "foundry") return true;
  if (rawMode === "guest") return true;

  if (
    lg.is_test === true ||
    lg.settings?.isTest === true ||
    lg.settings?.is_test === true
  ) {
    return true;
  }

  return false;
}

export type FoundryBoundaryResult =
  | { ok: true; leagueId: string; mode: LeagueMode | "lab" }
  | { ok: false; reason: string; code: "no_creator" | "no_league" | "not_lab" };

/**
 * Hard gate for any Foundry / lab path that can mutate league board, bots,
 * week advance, trophies, gazette, moments, or career.
 * Failure = stop. No soft fallback.
 */
export function assertFoundryMutationAllowed(
  source: string,
  league?: LabLeagueInput
): FoundryBoundaryResult {
  const uid = getSession()?.playerId;
  if (!isAppCreator(uid)) {
    logBlock(source, FOUNDRY_CREATOR_BLOCK_REASON);
    return {
      ok: false,
      reason: FOUNDRY_CREATOR_BLOCK_REASON,
      code: "no_creator",
    };
  }

  let lg = league;
  if (!lg) {
    try {
      lg = getLeague() as LabLeagueInput;
    } catch {
      lg = null;
    }
  }
  const leagueId = typeof lg?.id === "string" ? lg.id : "";
  if (!leagueId) {
    logBlock(source, FOUNDRY_NO_LEAGUE_REASON);
    return {
      ok: false,
      reason: FOUNDRY_NO_LEAGUE_REASON,
      code: "no_league",
    };
  }

  if (!isExplicitLabLeague(lg)) {
    logBlock(source, FOUNDRY_LAB_BLOCK_REASON);
    return {
      ok: false,
      reason: FOUNDRY_LAB_BLOCK_REASON,
      code: "not_lab",
    };
  }

  return { ok: true, leagueId, mode: "lab" };
}

function logBlock(source: string, reason: string) {
  try {
    console.warn("[FOUNDRY-ISOLATION] blocked", source, reason);
  } catch {
    /* ok */
  }
}

/** Short LAB label for chrome */
export function foundryLabUiLabel(league?: LabLeagueInput): string {
  if (!isExplicitLabLeague(league)) return "PRODUCTION";
  return "LAB";
}

export function isFoundryLabActiveOnCurrentRoom(): boolean {
  return isExplicitLabLeague(getLeague() as LabLeagueInput);
}
