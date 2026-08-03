/**
 * Prior-season / lore → permanent legendaries + career cheevo bank.
 *
 * Confirmed 2025–26 season:
 *  - Kahmann → Championship → War Room Legend (+200 career)
 *  - Big Ball Ben / Bill ball Ben → Village Nerd (Crystal Ball) → War Room Legend (+200 career)
 *  - Justin Strayer → Toilet Bowl (profile hardware; toilet crown if linked in Trophy Room)
 *
 * Named lore:
 *  - Tbone Soulstache Rockstar / Football Guru → World Greatest Cavalry Scout
 *    (eggplant on a wooden base · +200 career)
 *  - Maria → The Dr. (doctorate at ~24 · legendary nerd flex · +200 career)
 *  - Marilynnsmum → House Dragon (legendary family lore · +200 career only)
 *
 * Mistaken (hard-revoked whenever we see the name / on every app boot):
 *  - Andrew Visconti / Andy — was incorrectly given Kahmann’s champ seed
 *    (including when he only runs the app as commissioner of his own league)
 */

import {
  grantPermanentBadgeId,
  getPermanentBadgeIds,
  revokePermanentBadgeId,
} from "./permanent-badges";
import { bankCareerBadgeId, unbankCareerBadgeId } from "./career-cheevo";
import { getBadgeDef } from "./badges";
import { getSession } from "./league";

export const WAR_ROOM_LEGEND_ID = "war_room_legend";
export const CAVALRY_SCOUT_BADGE_ID = "worlds_greatest_cavalry_scout";
export const THE_DR_BADGE_ID = "the_dr";
export const HOUSE_DRAGON_BADGE_ID = "house_dragon_legendary";

/**
 * Optional hard UUID pins for House Dragon (preferred over name alone).
 * Filled when Supabase service lookup is available — empty means name match only.
 * Never grant House Dragon to an unknown random “Marilyn” without exact key.
 */
export const HOUSE_DRAGON_USER_IDS: readonly string[] = [
  // Populate after service-role resolve of Marilynnsmum:
  // "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
];

type LegacyBadgeGrant = {
  pattern: RegExp;
  badgeId: string;
  reason: string;
  /** If set, only grant when player.id is in this list (in addition to name OR alone) */
  userIds?: readonly string[];
  /** Name must match after alnum-normalize (e.g. marilynnsmum) */
  exactNormalizedNames?: readonly string[];
};

/** Strip to a–z0–9 for username-style equality */
export function normalizeDisplayKey(name: string): string {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export const LEGACY_BADGE_GRANTS: LegacyBadgeGrant[] = [
  {
    pattern: /\bkahmann\b/i,
    badgeId: WAR_ROOM_LEGEND_ID,
    reason: "2025–26 Championship — War Room Legend",
  },
  {
    pattern: /\bbig\s*ball\s*ben\b|\bbill\s*ball\s*ben\b|\bbillballben\b/i,
    badgeId: WAR_ROOM_LEGEND_ID,
    reason: "2025–26 Village Nerd — War Room Legend",
  },
  {
    // Tbone / T-Bone Soulstache / Rockstar / Football Guru
    pattern:
      /\bt-?\s*bone\b|\bsoulstache\b|\bfootball\s*guru\b|\brockstar\b.*\bguru\b|\bguru\b.*\brockstar\b/i,
    badgeId: CAVALRY_SCOUT_BADGE_ID,
    reason: "World Greatest Cavalry Scout — eggplant on wood, no refunds",
  },
  {
    // Maria (defending Super Bowl / Vonnagio gold energy) — PhD at ~24
    // Avoid matching middle names; \bMaria\b covers "Maria", "Maria V.", etc.
    pattern: /\bmaria\b/i,
    badgeId: THE_DR_BADGE_ID,
    reason: "The Dr. — doctorate at 24, War Room still a nerd cage match",
  },
  {
    // House Dragon — Marilynnsmum only (exact key after normalize)
    pattern: /^marilynnsmum$/i,
    badgeId: HOUSE_DRAGON_BADGE_ID,
    reason: "House Dragon — legendary family lore",
    userIds: HOUSE_DRAGON_USER_IDS,
    exactNormalizedNames: ["marilynnsmum"],
  },
];

/** Names that should never hold a seeded War Room Legend */
export const REVOKE_LEGEND_PATTERNS: RegExp[] = [
  /\bandy\b/i,
  /\bandrew\s+visconti\b/i,
  /\bvisconti\b/i,
];

export function isMistakenLegendName(name: string): boolean {
  if (!name?.trim()) return false;
  if (LEGACY_BADGE_GRANTS.some((g) => g.pattern.test(name))) return false;
  return REVOKE_LEGEND_PATTERNS.some((p) => p.test(name));
}

function legendPts() {
  return getBadgeDef(WAR_ROOM_LEGEND_ID)?.points ?? 200;
}

/**
 * Hard strip: permanent badge + career bank for this user id.
 * Call whenever we know this person is Visconti/Andy.
 */
export function hardRevokeMistakenLegend(playerId: string): boolean {
  if (!playerId) return false;
  const known = getPermanentBadgeIds(playerId);
  if (!known.includes(WAR_ROOM_LEGEND_ID)) {
    // Still unbank in case badge list and career bank drifted
    unbankCareerBadgeId(playerId, WAR_ROOM_LEGEND_ID, legendPts());
    return false;
  }
  revokePermanentBadgeId(playerId, WAR_ROOM_LEGEND_ID);
  unbankCareerBadgeId(playerId, WAR_ROOM_LEGEND_ID, legendPts());
  return true;
}

function legacyGrantMatches(
  player: { id: string; name: string },
  g: LegacyBadgeGrant
): boolean {
  // UUID pin (if any listed) is sufficient and preferred
  if (g.userIds && g.userIds.length > 0) {
    if (g.userIds.includes(player.id)) return true;
    // When pins exist, refuse name-only for this grant (wrong-account safety)
    // unless also exact-normalized match (allows pin empty → name path)
  }
  if (g.exactNormalizedNames && g.exactNormalizedNames.length > 0) {
    const key = normalizeDisplayKey(player.name);
    if (!g.exactNormalizedNames.includes(key)) return false;
    // If UUID pins are configured, require pin OR exact name (pin already returned)
    if (g.userIds && g.userIds.length > 0) {
      return g.userIds.includes(player.id);
    }
    return true;
  }
  return g.pattern.test(player.name);
}

/**
 * Grant permanent badges for legacy winners and bank career points once.
 * Safe to call on every profile load. Also strips mistaken legends hard.
 */
export function applyLegacyBadgeGrants(player: {
  id: string;
  name: string;
}): string[] {
  if (!player?.id || !player?.name) return [];
  const newly: string[] = [];
  const known = new Set(getPermanentBadgeIds(player.id));

  // Hard revoke mistaken Visconti/Andy legend
  if (isMistakenLegendName(player.name)) {
    hardRevokeMistakenLegend(player.id);
    known.delete(WAR_ROOM_LEGEND_ID);
    return newly;
  }

  for (const g of LEGACY_BADGE_GRANTS) {
    if (!legacyGrantMatches(player, g)) continue;
    const pts = getBadgeDef(g.badgeId)?.points ?? legendPts();
    if (known.has(g.badgeId)) {
      bankCareerBadgeId(player.id, g.badgeId, pts);
      // Already permanent but never saw the unlock modal → still pop once on login
      try {
        const {
          readCelebratedIds,
          queuePendingBadgeCelebration,
        } = require("./badge-celebration") as typeof import("./badge-celebration");
        if (!readCelebratedIds(player.id).includes(g.badgeId)) {
          queuePendingBadgeCelebration(player.id, [g.badgeId]);
        }
      } catch {
        /* ignore */
      }
      continue;
    }
    const granted = grantPermanentBadgeId(player.id, g.badgeId);
    if (granted) {
      newly.push(g.badgeId);
      // Popup on next login / this session — permanent alone would skip celebration
      try {
        const { queuePendingBadgeCelebration } =
          require("./badge-celebration") as typeof import("./badge-celebration");
        queuePendingBadgeCelebration(player.id, [g.badgeId]);
      } catch {
        /* ignore */
      }
    }
    known.add(g.badgeId);
    bankCareerBadgeId(player.id, g.badgeId, pts);
  }

  return newly;
}

/**
 * Run on every app boot (Home, Nav, Account) so a commissioner who never
 * opens their own profile still loses a mistaken Legend grant.
 * Also scrub any roster members we can see (his own league mates loading him).
 */
export function sanitizeLegacyLegendsOnBoot(opts?: {
  playerId?: string | null;
  playerName?: string | null;
  roster?: { id: string; name: string }[];
}): void {
  try {
    const session = getSession();
    const selfId = opts?.playerId || session?.playerId || null;
    const selfName = opts?.playerName || session?.playerName || null;

    if (selfId && selfName) {
      applyLegacyBadgeGrants({ id: selfId, name: selfName });
    } else if (selfId && isMistakenLegendName(selfName || "")) {
      hardRevokeMistakenLegend(selfId);
    }

    // Extra: if display name is missing but session name was Visconti earlier
    if (selfId && selfName && isMistakenLegendName(selfName)) {
      hardRevokeMistakenLegend(selfId);
    }

    for (const p of opts?.roster || []) {
      if (p?.id && p?.name) applyLegacyBadgeGrants(p);
    }
  } catch {
    /* ignore */
  }
}
