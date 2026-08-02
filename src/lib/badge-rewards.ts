/**
 * What chasing a cheevo unlocks: points, equipable title, profile border.
 * Used on badge detail so people see the full prize, not just +pts.
 */

import { getEquipableTitleDef } from "./equipable-titles";
import { PROFILE_BORDER_CATALOG } from "./profile-borders";
import type { BadgeDef } from "./types";

export type BadgeRewardSummary = {
  points: number;
  /** Equipable nameplate title, if any */
  title: string | null;
  /** Profile border name, if any */
  border: string | null;
  /** Short chips for UI: ["+25 pts", "Title: …", "Border: …"] */
  chips: string[];
  /** One line for tooltips / compact UI */
  line: string;
};

export function getBadgeRewards(def: BadgeDef): BadgeRewardSummary {
  const titleDef = getEquipableTitleDef(def.id);
  const title = titleDef?.title ?? null;

  const borderDef = PROFILE_BORDER_CATALOG.find(
    (b) => b.unlock.kind === "badge" && b.unlock.badgeId === def.id
  );
  // Creator border is unlock.kind === "creator", not badge id
  const creatorBorder =
    def.creatorOnly || def.id === "the_commissioner"
      ? PROFILE_BORDER_CATALOG.find((b) => b.unlock.kind === "creator")
      : null;
  const border = borderDef?.name ?? creatorBorder?.name ?? null;

  const careerOnly = !!(def.creatorOnly || def.careerOnly);
  const chips: string[] = [
    careerOnly ? `+${def.points} career pts` : `+${def.points} pts`,
  ];
  if (careerOnly) chips.push("Career only");
  if (title) chips.push(`Title: ${title}`);
  if (border) chips.push(`Border: ${border}`);

  let line = careerOnly
    ? `+${def.points} career pts · Career only`
    : `+${def.points} pts`;
  if (title && border) line += ` · Title + Border`;
  else if (title) line += ` · Title`;
  else if (border) line += ` · Border`;

  return { points: def.points, title, border, chips, line };
}
