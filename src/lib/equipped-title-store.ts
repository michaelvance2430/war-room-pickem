/**
 * Equipped name titles across the league.
 * Self: localStorage + profiles.equipped_title_id (cloud when column exists).
 * Peers: hydrated from roster/profile rows.
 */

import { createClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";
import {
  isEquipableTitleBadgeId,
  titleLabelForBadgeId,
} from "./equipable-titles";

const LOCAL_KEY = "warroom-equipped-title-v1";

type LocalMap = Record<string, string | null>; // userId → badgeId

type Store = {
  /** userId → display title string */
  byUser: Map<string, string>;
};

const store: Store = {
  byUser: new Map(),
};

const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readLocal(): LocalMap {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as LocalMap;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeLocal(map: LocalMap) {
  if (!canUse()) return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function subscribeEquippedTitles(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getEquippedTitleLabel(
  userId: string | null | undefined
): string | null {
  if (!userId) return null;
  return store.byUser.get(userId) || null;
}

export function getLocalEquippedBadgeId(userId: string): string | null {
  if (!userId) return null;
  const v = readLocal()[userId];
  return v || null;
}

function setStoreLabel(userId: string, label: string | null) {
  if (!userId) return;
  if (label) store.byUser.set(userId, label);
  else store.byUser.delete(userId);
  notify();
}

/** Seed/overwrite many peers (from roster). Keeps self local override if stronger. */
export function hydrateEquippedTitles(
  rows: { userId: string; badgeId?: string | null; label?: string | null }[]
) {
  const session = getSession();
  const selfId = session?.playerId || "";

  for (const r of rows) {
    if (!r.userId) continue;
    // Self: prefer local storage (source of truth until cloud catches up)
    if (selfId && r.userId === selfId) {
      const localId = getLocalEquippedBadgeId(selfId);
      const label = titleLabelForBadgeId(localId) || r.label || titleLabelForBadgeId(r.badgeId);
      if (label) store.byUser.set(selfId, label);
      else store.byUser.delete(selfId);
      continue;
    }
    const label = r.label || titleLabelForBadgeId(r.badgeId || null);
    if (label) store.byUser.set(r.userId, label);
    else store.byUser.delete(r.userId);
  }
  notify();
}

/**
 * Force equip (Chaos Mode) — bypasses Chaos title lock checks.
 * Used when the app takes control of the nameplate.
 */
export async function setMyEquippedTitleForced(
  badgeId: string | null
): Promise<{ ok: boolean; error?: string; label?: string | null }> {
  return setMyEquippedTitle(badgeId, { force: true });
}

/** Equip or clear title for the signed-in user. */
export async function setMyEquippedTitle(
  badgeId: string | null,
  opts?: { force?: boolean }
): Promise<{ ok: boolean; error?: string; label?: string | null }> {
  const session = getSession();
  const userId = session?.playerId;
  if (!userId) return { ok: false, error: "Not signed in" };

  // Chaos week: nameplate is out of your hands
  if (!opts?.force) {
    try {
      const { isChaosTitleLocked, CHAOS_TITLE_BADGE_ID } = await import(
        "./chaos-mode"
      );
      if (isChaosTitleLocked(userId)) {
        return {
          ok: false,
          error:
            "Chaos Mode owns your title this week — Chaos Agent stays on. No swaps until the week is done.",
        };
      }
      // Chaos Agent is never a free Account pick
      if (badgeId === CHAOS_TITLE_BADGE_ID) {
        return {
          ok: false,
          error:
            "Chaos Agent isn’t choosable. It only equips when you go Chaos — and it sticks until the week ends.",
        };
      }
    } catch {
      /* ignore */
    }
  }

  if (
    badgeId &&
    !isEquipableTitleBadgeId(badgeId) &&
    badgeId !== "the_commissioner" &&
    badgeId !== "let_them_cook"
  ) {
    return { ok: false, error: "That achievement doesn’t come with a nameplate title." };
  }
  if (badgeId?.startsWith("rank_")) {
    try {
      const [{ careerRankByTitleId, resolveCareerRank }, { getAchievementPoints, withPermanentBadges }, { loadLeaguePlayers }, { listLeagueSeasonCounts }, { getSportsPlayed }, { loadWeaponServiceSummary }] = await Promise.all([
        import("./career-ranks"), import("./badges"), import("./cloud"), import("./league-seasons"), import("./sports-played"), import("./weapon-service-record"),
      ]);
      const requested = careerRankByTitleId(badgeId);
      const player = (await loadLeaguePlayers("setMyEquippedTitle.rank")).find((entry) => entry.id === userId);
      if (!requested || !player) return { ok: false, error: "That rank has not been earned." };
      const weaponService = await loadWeaponServiceSummary(userId);
      const unlocked = resolveCareerRank({ achievementPoints: getAchievementPoints(withPermanentBadges(player)), seasons: listLeagueSeasonCounts(userId).reduce((sum, room) => sum + room.seasons, 0), sports: Math.max(1, getSportsPlayed(userId).length), tacticalNukes: weaponService.tacticalNukes }).unlocked;
      if (!unlocked.some((rank) => rank.id === requested.id)) return { ok: false, error: "Promotion orders denied. That rank has not been earned." };
    } catch {
      return { ok: false, error: "Could not verify promotion orders." };
    }
  }
  const label = badgeId ? titleLabelForBadgeId(badgeId) : null;
  if (badgeId && !label) {
    return { ok: false, error: "That badge can’t be used as a title." };
  }

  const local = readLocal();
  local[userId] = badgeId;
  writeLocal(local);
  setStoreLabel(userId, label);

  // Cloud (optional until SQL runs)
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id || userId;
    const { error } = await supabase
      .from("profiles")
      .update({ equipped_title_id: badgeId })
      .eq("id", uid);
    if (error) {
      // Column missing or RLS — local still works for this browser
      if (!/column|schema cache|equipped_title/i.test(error.message || "")) {
        return {
          ok: true,
          label,
          error: `Saved on this device. Cloud: ${error.message}`,
        };
      }
    }
  } catch {
    /* local only */
  }

  return { ok: true, label };
}

/** Load my equipped title from cloud into local + store. */
export async function syncMyEquippedTitleFromCloud(): Promise<string | null> {
  const session = getSession();
  const userId = session?.playerId;
  if (!userId) return null;

  // Prefer local if set
  const localId = getLocalEquippedBadgeId(userId);
  if (localId) {
    const label = titleLabelForBadgeId(localId);
    if (label) {
      setStoreLabel(userId, label);
      return localId;
    }
  }

  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id || userId;
    const { data, error } = await supabase
      .from("profiles")
      .select("equipped_title_id")
      .eq("id", uid)
      .maybeSingle();
    if (error || !data) return null;
    const badgeId = (data.equipped_title_id as string | null) || null;
    if (!badgeId) {
      setStoreLabel(userId, null);
      return null;
    }
    const local = readLocal();
    local[userId] = badgeId;
    writeLocal(local);
    const label = titleLabelForBadgeId(badgeId);
    setStoreLabel(userId, label);
    return badgeId;
  } catch {
    return null;
  }
}
