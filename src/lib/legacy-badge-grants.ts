/**
 * Prior-season / manual trophy → permanent badges + career cheevo bank.
 * Matched by display name (same approach as profile hardware).
 */

import { grantPermanentBadgeId, getPermanentBadgeIds } from "./permanent-badges";
import { bankCareerBadgeId } from "./career-cheevo";
import { getBadgeDef } from "./badges";

export const WAR_ROOM_LEGEND_ID = "war_room_legend";

type LegacyBadgeGrant = {
  /** Match against player display name */
  pattern: RegExp;
  badgeId: string;
  /** Human note for debugging */
  reason: string;
};

/**
 * Andy (Andrew Visconti) + Bill ball Ben — trophy winners → War Room Legend.
 */
export const LEGACY_BADGE_GRANTS: LegacyBadgeGrant[] = [
  {
    // Andy / Andrew Visconti (avoid bare "and" matching)
    pattern: /\bandy\b|\bandrew\s+visconti\b|\bvisconti\b/i,
    badgeId: WAR_ROOM_LEGEND_ID,
    reason: "Trophy winner — War Room Legend",
  },
  {
    // Bill ball Ben / Ben (prefer full phrase first)
    pattern: /\bbill\s*ball\s*ben\b|\bbillballben\b/i,
    badgeId: WAR_ROOM_LEGEND_ID,
    reason: "Trophy winner — War Room Legend",
  },
];

/**
 * Grant permanent badges for legacy winners and bank career points once.
 * Safe to call on every profile load.
 */
export function applyLegacyBadgeGrants(player: {
  id: string;
  name: string;
}): string[] {
  if (!player?.id || !player?.name) return [];
  const newly: string[] = [];
  const known = new Set(getPermanentBadgeIds(player.id));

  for (const g of LEGACY_BADGE_GRANTS) {
    if (!g.pattern.test(player.name)) continue;
    if (known.has(g.badgeId)) {
      // Still ensure career bank (in case permanent existed without career)
      const def = getBadgeDef(g.badgeId);
      bankCareerBadgeId(player.id, g.badgeId, def?.points ?? 200);
      continue;
    }
    const granted = grantPermanentBadgeId(player.id, g.badgeId);
    if (granted) newly.push(g.badgeId);
    known.add(g.badgeId);
    const def = getBadgeDef(g.badgeId);
    bankCareerBadgeId(player.id, g.badgeId, def?.points ?? 200);
  }

  return newly;
}
