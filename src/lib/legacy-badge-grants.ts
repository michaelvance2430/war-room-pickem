/**
 * Prior-season trophy → permanent War Room Legend + career cheevo bank.
 *
 * Confirmed 2025:
 *  - Kahmann → Championship → War Room Legend (+200 career)
 *  - Bill ball Ben → Village Nerd (Crystal Ball) → War Room Legend (+200 career)
 *
 * Mistaken (revoked if present):
 *  - Andrew Visconti / Andy — was incorrectly given Kahmann’s champ seed
 */

import {
  grantPermanentBadgeId,
  getPermanentBadgeIds,
  revokePermanentBadgeId,
} from "./permanent-badges";
import { bankCareerBadgeId, unbankCareerBadgeId } from "./career-cheevo";
import { getBadgeDef } from "./badges";

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
    reason: "2025 Championship — War Room Legend",
  },
  {
    pattern: /\bbill\s*ball\s*ben\b|\bbillballben\b/i,
    badgeId: WAR_ROOM_LEGEND_ID,
    reason: "2025 Village Nerd — War Room Legend",
  },
];

/** Names that should never hold a seeded War Room Legend */
const REVOKE_LEGEND_PATTERNS: RegExp[] = [
  /\bandy\b|\bandrew\s+visconti\b|\bvisconti\b/i,
];

/**
 * Grant permanent badges for legacy winners and bank career points once.
 * Safe to call on every profile load. Also strips mistaken legends.
 */
export function applyLegacyBadgeGrants(player: {
  id: string;
  name: string;
}): string[] {
  if (!player?.id || !player?.name) return [];
  const newly: string[] = [];
  const known = new Set(getPermanentBadgeIds(player.id));
  const pts = getBadgeDef(WAR_ROOM_LEGEND_ID)?.points ?? 200;

  // Strip mistaken Visconti/Andy legend (was incorrectly given Kahmann’s seed)
  const isConfirmedLegend = LEGACY_BADGE_GRANTS.some((g) =>
    g.pattern.test(player.name)
  );
  if (
    !isConfirmedLegend &&
    REVOKE_LEGEND_PATTERNS.some((p) => p.test(player.name))
  ) {
    if (known.has(WAR_ROOM_LEGEND_ID)) {
      revokePermanentBadgeId(player.id, WAR_ROOM_LEGEND_ID);
      unbankCareerBadgeId(player.id, WAR_ROOM_LEGEND_ID, pts);
      known.delete(WAR_ROOM_LEGEND_ID);
    }
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
