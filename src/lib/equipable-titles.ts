/**
 * Badge → name title players can equip (e.g. "War Room Legend" before their name).
 * Rare / epic / legendary only — common grind badges stay off the nameplate.
 */

import type { BadgeDef, BadgeStatus, BadgeTier } from "./types";
import { getBadgeDef } from "./badges";

const EQUIPABLE_TIERS: BadgeTier[] = ["rare", "epic", "legendary"];

export function isEquipableTitleBadge(def: BadgeDef | null | undefined): boolean {
  if (!def) return false;
  if (def.creatorOnly) return true;
  return EQUIPABLE_TIERS.includes(def.tier);
}

export function titleLabelForBadgeId(badgeId: string | null | undefined): string | null {
  if (!badgeId) return null;
  const def = getBadgeDef(badgeId);
  if (!def || !isEquipableTitleBadge(def)) return null;
  return def.name;
}

/** Earned equipable titles for Account picker */
export function listEquipableTitlesFromBadges(
  badges: BadgeStatus[]
): { badgeId: string; label: string; tier: BadgeTier }[] {
  const out: { badgeId: string; label: string; tier: BadgeTier }[] = [];
  for (const b of badges) {
    if (!b.earned || !isEquipableTitleBadge(b.def)) continue;
    out.push({
      badgeId: b.def.id,
      label: b.def.name,
      tier: b.def.tier,
    });
  }
  // Legendary first, then epic, rare; alpha within tier
  const order: Record<BadgeTier, number> = {
    legendary: 0,
    epic: 1,
    rare: 2,
    common: 3,
  };
  out.sort((a, b) => {
    const d = order[a.tier] - order[b.tier];
    if (d !== 0) return d;
    return a.label.localeCompare(b.label);
  });
  return out;
}
