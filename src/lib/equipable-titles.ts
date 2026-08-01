/**
 * Curated nameplate titles from achievements.
 *
 * Not every badge gets a title — only ones worth wearing.
 * Two vibes:
 *   brag  — flex, hardware, lethal
 *   roast — self-own energy you wear on purpose
 *   chaos — weird middle (villain / dog / prop culture)
 *
 * Display: "{title} {Name}" e.g. "War Room Legend Kahmann"
 * or "Eater of Trash Mike"
 */

import type { BadgeStatus, BadgeTier } from "./types";
import { getBadgeDef } from "./badges";

export type TitleVibe = "brag" | "roast" | "chaos";

export type EquipableTitleDef = {
  /** Badge id that unlocks this title */
  badgeId: string;
  /** Nameplate text (before the display name) */
  title: string;
  vibe: TitleVibe;
  /** One-line tease in Account picker */
  blurb: string;
  /**
   * Not choosable in Account — only forced by the app (e.g. Chaos Mode).
   * Still shows on the nameplate when auto-equipped.
   */
  forceOnly?: boolean;
};

/**
 * Explicit allow-list. If it's not here, it is NOT equipable.
 * Keep commons off the nameplate unless they're pure comedy gold.
 */
export const EQUIPABLE_TITLE_CATALOG: EquipableTitleDef[] = [
  // —— Creator / hardware (brag) ——
  {
    badgeId: "the_commissioner",
    title: "The Creator",
    vibe: "brag",
    blurb: "Built the app. Peasants stay grey.",
  },
  {
    badgeId: "war_room_legend",
    title: "War Room Legend",
    vibe: "brag",
    blurb: "Hardware. History. The board remembers.",
  },
  {
    badgeId: "sad_little_brains",
    title: "Sad Little Brain",
    vibe: "roast",
    blurb: "Career last-place champion. Wear it. Own it.",
  },
  {
    badgeId: "let_them_cook",
    title: "Chaos Agent",
    vibe: "chaos",
    blurb:
      "Forced on when you go Chaos — you don’t pick it, you can’t swap it off until the week is done.",
    forceOnly: true,
  },
  {
    badgeId: "neighborhood_creeper",
    title: "Neighborhood Creeper",
    vibe: "chaos",
    blurb:
      "Opened Deep stats & legacy math. Curtains twitching. Spreadsheet in the window.",
  },
  {
    badgeId: "championship_ring",
    title: "Ring Bearer",
    vibe: "brag",
    blurb: "Top half. Last one standing.",
  },
  {
    badgeId: "season_sovereign",
    title: "Season Sovereign",
    vibe: "brag",
    blurb: "Most points when the music stopped.",
  },
  {
    badgeId: "national_nightmare",
    title: "The Oracle",
    vibe: "brag",
    blurb: "Crystal Ball correct. Infinite smug.",
  },
  {
    badgeId: "elite_commish",
    title: "Iron Gavel",
    vibe: "brag",
    blurb: "Actually ran the league. Real work.",
  },
  // —— Commissioner career ladder (14+/18 seasons stacked) ——
  {
    badgeId: "commish_ladder_1",
    title: "First Gavel",
    vibe: "brag",
    blurb: "One qualifying season as commissioner.",
  },
  {
    badgeId: "commish_ladder_2",
    title: "Double Host",
    vibe: "brag",
    blurb: "Two full-ish seasons with the gavel.",
  },
  {
    badgeId: "commish_ladder_3",
    title: "Season Architect",
    vibe: "brag",
    blurb: "Three qualifying seasons. Trust earned.",
  },
  {
    badgeId: "commish_ladder_5",
    title: "Multi-Room Operator",
    vibe: "brag",
    blurb: "Five seasons. Cross-sport welcome.",
  },
  {
    badgeId: "commish_ladder_7",
    title: "Regional Manager",
    vibe: "brag",
    blurb: "Seven seasons. The region reports to you.",
  },
  {
    badgeId: "commish_ladder_10",
    title: "Assistant to the Regional Manager",
    vibe: "brag",
    blurb: "Ten qualifying seasons. Peak commissioner. Respect the stapler.",
  },

  // —— Lethal form (brag) ——
  {
    badgeId: "immortal_streak",
    title: "Immortal",
    vibe: "brag",
    blurb: "Thirty straight. Unholy.",
  },
  {
    badgeId: "unbreakable",
    title: "Unbreakable",
    vibe: "brag",
    blurb: "Twenty straight. Campus myth.",
  },
  {
    badgeId: "the_closer",
    title: "The Closer",
    vibe: "brag",
    blurb: "Title weekend. Card cashed.",
  },
  {
    badgeId: "sniper",
    title: "The Sniper",
    vibe: "brag",
    blurb: "Fifteen in a row. Cold blood.",
  },
  {
    badgeId: "ten_streak_terror",
    title: "Streak Terror",
    vibe: "brag",
    blurb: "Double-digit heater.",
  },
  {
    badgeId: "war_room_general",
    title: "War Room General",
    vibe: "brag",
    blurb: "Owned a week. Throne temporary or not.",
  },
  {
    badgeId: "max_card",
    title: "Max Card",
    vibe: "brag",
    blurb: "Confidence stacked. Everything hit.",
  },
  {
    badgeId: "perfect_saturday",
    title: "Perfect Saturday",
    vibe: "brag",
    blurb: "Clean sheet. No notes.",
  },
  {
    badgeId: "six_pack_saturday",
    title: "Six-Pack Saturday",
    vibe: "brag",
    blurb: "Full card green.",
  },
  // —— NFL primetime titles ——
  {
    badgeId: "nfl_perfect_sunday",
    title: "Perfect Sunday",
    vibe: "brag",
    blurb: "Clean sheet on a primetime card.",
  },
  {
    badgeId: "nfl_primetime_general",
    title: "Primetime General",
    vibe: "brag",
    blurb: "Owned a Sunday. Throne temporary or not.",
  },
  {
    badgeId: "nfl_red_zone_assassin",
    title: "Red Zone Assassin",
    vibe: "brag",
    blurb: "Best Bets stacking. Witnesses present.",
  },
  {
    badgeId: "nfl_film_dont_lie",
    title: "Film Don't Lie",
    vibe: "brag",
    blurb: "Ten-straight. Unholy.",
  },
  {
    badgeId: "nfl_immortal_sunday",
    title: "Immortal Sunday",
    vibe: "brag",
    blurb: "Thirty straight. Close the film room.",
  },
  {
    badgeId: "nfl_super_bowl_desk",
    title: "Super Bowl Desk",
    vibe: "brag",
    blurb: "Title weekend cashed.",
  },
  {
    badgeId: "nfl_late_window_legend",
    title: "Late Window Legend",
    vibe: "brag",
    blurb: "Owned a week when it got loud.",
  },
  {
    badgeId: "best_bet_assassin",
    title: "Best Bet Assassin",
    vibe: "brag",
    blurb: "Doubled up when it mattered.",
  },
  {
    badgeId: "clutch_gene",
    title: "Clutch Gene",
    vibe: "brag",
    blurb: "Last leg still hit.",
  },
  {
    badgeId: "division_dominator",
    title: "Division Dominator",
    vibe: "brag",
    blurb: "Your division is a fiefdom.",
  },
  {
    badgeId: "cheevo_king",
    title: "Cheevo King",
    vibe: "brag",
    blurb: "Most achievement points. Crown sticky.",
  },
  {
    badgeId: "seasoned_vet",
    title: "Seasoned Vet",
    vibe: "brag",
    blurb: "A thousand correct locks.",
  },
  {
    badgeId: "confidence_king",
    title: "Confidence King",
    vibe: "brag",
    blurb: "Stacked the 5s. Paid.",
  },
  {
    badgeId: "first_and_final",
    title: "First & Final",
    vibe: "brag",
    blurb: "Locked first. Never flinched.",
  },
  {
    badgeId: "silence_the_room",
    title: "Silence the Room",
    vibe: "brag",
    blurb: "The take that shut everyone up.",
  },

  // —— Chaos (dogs, props, villain) ——
  {
    badgeId: "villain_arc",
    title: "Villain Arc",
    vibe: "chaos",
    blurb: "Same rival. Three weeks. Evil.",
  },
  {
    badgeId: "dog_whisperer",
    title: "Dog Whisperer",
    vibe: "chaos",
    blurb: "Plus numbers. Paid in glory.",
  },
  {
    badgeId: "underdog_believer",
    title: "Dog Believer",
    vibe: "chaos",
    blurb: "Took the dog. Got loud.",
  },
  {
    badgeId: "underdog_spree",
    title: "Upset Merchant",
    vibe: "chaos",
    blurb: "Dogs on a heater.",
  },
  {
    badgeId: "prop_overlord",
    title: "Prop Overlord",
    vibe: "chaos",
    blurb: "Bonus points are a personality.",
  },
  {
    badgeId: "prop_prophet",
    title: "Prop Prophet",
    vibe: "chaos",
    blurb: "Yes/No oracle of the locker.",
  },
  {
    badgeId: "parlay_pilot",
    title: "Parlay Pilot",
    vibe: "chaos",
    blurb: "Best Bet boarded and cashed.",
  },
  {
    badgeId: "comeback_kid",
    title: "Comeback Kid",
    vibe: "chaos",
    blurb: "Was dead. Then wasn't.",
  },
  {
    badgeId: "cut_line_killer",
    title: "Cut Line Killer",
    vibe: "chaos",
    blurb: "Survived the knife. Barely or boldly.",
  },
  {
    badgeId: "road_dog",
    title: "Road Dog",
    vibe: "chaos",
    blurb: "Away chalk optional. Chaos preferred.",
  },

  // —— Roast / trash energy (wear it proud) ——
  {
    badgeId: "toilet_crown",
    title: "Eater of Trash",
    vibe: "roast",
    blurb: "Toilet Bowl champion. Crown of filth. Wear it.",
  },
  {
    badgeId: "bottom_of_the_barrel",
    title: "Bottom of the Barrel",
    vibe: "roast",
    blurb: "Sole last for a week. Stacks every time you solo the basement.",
  },
  {
    badgeId: "chalk_eater",
    title: "Chalk Eater",
    vibe: "roast",
    blurb: "Took the chalk. It covered. We all do it.",
  },
  {
    badgeId: "chalk_streak",
    title: "Public Favorite",
    vibe: "roast",
    blurb: "Safe picks. Safer group-chat takes.",
  },
  {
    badgeId: "division_dweller",
    title: "Division Dweller",
    vibe: "roast",
    blurb: "You exist in a division. That's the bar.",
  },
  {
    badgeId: "locker_lurker",
    title: "Locker Lurker",
    vibe: "roast",
    blurb: "Said something. Or at least typed.",
  },
  {
    badgeId: "push_happens",
    title: "Push Merchant",
    vibe: "roast",
    blurb: "The line was fair. Annoyingly fair.",
  },
  {
    badgeId: "cut_line_escape",
    title: "Cut Line Escapee",
    vibe: "roast",
    blurb: "Almost trash. Then not. Sweaty.",
  },
  {
    badgeId: "leaderboard_lookin",
    title: "Leaderboard Lookin’",
    vibe: "roast",
    blurb: "Peeking. Not conquering. Yet.",
  },
  {
    badgeId: "volume_shooter",
    title: "Volume Shooter",
    vibe: "roast",
    blurb: "Quantity is a skill. Allegedly.",
  },
  {
    badgeId: "iron_lungs",
    title: "Never Ghosts",
    vibe: "chaos",
    blurb: "Showed up every week. Respect.",
  },
  {
    badgeId: "ten_week_tenant",
    title: "Ten-Week Tenant",
    vibe: "chaos",
    blurb: "Paid rent in picks.",
  },
  {
    badgeId: "home_cookin",
    title: "Home Cookin’",
    vibe: "chaos",
    blurb: "Home dogs and home lines.",
  },
  {
    badgeId: "hot_hand",
    title: "Hot Hand",
    vibe: "brag",
    blurb: "Five correct. Don't cool off.",
  },
  {
    badgeId: "clean_sheet",
    title: "Clean Sheet",
    vibe: "brag",
    blurb: "Full card. Zero wrong.",
  },
  {
    badgeId: "best_bet_banker",
    title: "Best Bet Banker",
    vibe: "brag",
    blurb: "Cashed the double enough times.",
  },
];

const byBadgeId = new Map(
  EQUIPABLE_TITLE_CATALOG.map((t) => [t.badgeId, t] as const)
);

export function getEquipableTitleDef(
  badgeId: string | null | undefined
): EquipableTitleDef | null {
  if (!badgeId) return null;
  return byBadgeId.get(badgeId) || null;
}

export function isEquipableTitleBadgeId(badgeId: string): boolean {
  return byBadgeId.has(badgeId);
}

/** Resolve nameplate string for a badge id (null if not equipable). */
export function titleLabelForBadgeId(
  badgeId: string | null | undefined
): string | null {
  const t = getEquipableTitleDef(badgeId);
  if (t) return t.title;
  // Creator badge id always resolves even if catalog lags
  const def = badgeId ? getBadgeDef(badgeId) : undefined;
  if (def?.creatorOnly) return def.name;
  return null;
}

/** @deprecated use isEquipableTitleBadgeId — kept for old imports */
export function isEquipableTitleBadge(def: {
  id: string;
  creatorOnly?: boolean;
} | null | undefined): boolean {
  if (!def) return false;
  if (def.creatorOnly) return true;
  return isEquipableTitleBadgeId(def.id);
}

export type EquipableTitleOption = {
  badgeId: string;
  label: string;
  vibe: TitleVibe;
  blurb: string;
  tier: BadgeTier;
};

/** Earned + equipable titles for Account picker */
export function listEquipableTitlesFromBadges(
  badges: BadgeStatus[]
): EquipableTitleOption[] {
  const earned = new Set(
    badges.filter((b) => b.earned).map((b) => b.def.id)
  );
  const out: EquipableTitleOption[] = [];

  for (const t of EQUIPABLE_TITLE_CATALOG) {
    if (!earned.has(t.badgeId)) continue;
    // Chaos Agent etc. — never a free pick in Account
    if (t.forceOnly) continue;
    const def = getBadgeDef(t.badgeId);
    out.push({
      badgeId: t.badgeId,
      label: t.title,
      vibe: t.vibe,
      blurb: t.blurb,
      tier: def?.tier || "rare",
    });
  }

  // Creator-only badge always if earned (catalog already has it)
  const order: Record<BadgeTier, number> = {
    legendary: 0,
    epic: 1,
    rare: 2,
    common: 3,
  };
  const vibeOrder: Record<TitleVibe, number> = {
    brag: 0,
    chaos: 1,
    roast: 2,
  };
  out.sort((a, b) => {
    const td = order[a.tier] - order[b.tier];
    if (td !== 0) return td;
    const vd = vibeOrder[a.vibe] - vibeOrder[b.vibe];
    if (vd !== 0) return vd;
    return a.label.localeCompare(b.label);
  });
  return out;
}

export function titleVibeLabel(vibe: TitleVibe): string {
  if (vibe === "brag") return "Flex";
  if (vibe === "roast") return "Trash energy";
  return "Chaos";
}
