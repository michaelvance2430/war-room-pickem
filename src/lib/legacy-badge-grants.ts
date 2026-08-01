/**
 * Prior-season trophy → permanent War Room Legend + career cheevo bank.
 *
 * Confirmed 2025–26 season:
 *  - Kahmann → Championship → War Room Legend (+200 career)
 *  - Big Ball Ben / Bill ball Ben → Village Nerd (Crystal Ball) → War Room Legend (+200 career)
 *  - Justin Strayer → Toilet Bowl (profile hardware; toilet crown if linked in Trophy Room)
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

type LegacyBadgeGrant = {
  pattern: RegExp;
  badgeId: string;
  reason: string;
};

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
  const pts = legendPts();

  // Hard revoke mistaken Visconti/Andy legend
  if (isMistakenLegendName(player.name)) {
    hardRevokeMistakenLegend(player.id);
    known.delete(WAR_ROOM_LEGEND_ID);
    return newly;
  }

  for (const g of LEGACY_BADGE_GRANTS) {
    if (!g.pattern.test(player.name)) continue;
    if (known.has(g.badgeId)) {
      bankCareerBadgeId(player.id, g.badgeId, pts);
      continue;
    }
    const granted = grantPermanentBadgeId(player.id, g.badgeId);
    if (granted) newly.push(g.badgeId);
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
