import { BadgeDef, BadgeStatus, BadgeTier, Player } from "./types";
import { isAppCreator, withCreatorFlag } from "./creator";
import {
  getBestCommishWeeks,
  IRON_COMMISH_BADGE_ID,
  IRON_COMMISH_TARGET,
  syncCommissionerTenureFromSession,
} from "./commish-tenure";
import {
  FIRST_FINAL_BADGE_ID,
  firstFinalEarned,
  countCleanFirstFinalWeeks,
} from "./first-final";
import {
  getPermanentBadgeIds,
  grantPermanentBadgeId,
  mergePermanentBadges,
} from "./permanent-badges";
import { applyLegacyBadgeGrants, WAR_ROOM_LEGEND_ID } from "./legacy-badge-grants";
import { hasEngagement } from "./engagement";

/** Permanent rare: most achievement points in the league */
export const CHEEVO_KING_ID = "cheevo_king";

/** Legendary creator badge — follows the app owner across every league */
export const CREATOR_BADGE_ID = "the_commissioner";

/** Legendary: ran a league as commissioner 14+ of 18 weeks */
export { IRON_COMMISH_BADGE_ID };

export function hasPermanentBadge(player: Player, badgeId: string): boolean {
  if (player.permanentBadgeIds?.includes(badgeId)) return true;
  return getPermanentBadgeIds(player.id).includes(badgeId);
}

function grantPermanentBadge(player: Player, badgeId: string): Player {
  grantPermanentBadgeId(player.id, badgeId);
  if (hasPermanentBadge(player, badgeId) && player.permanentBadgeIds?.includes(badgeId)) {
    return player;
  }
  return {
    ...player,
    permanentBadgeIds: mergePermanentBadges(player.id, [
      ...(player.permanentBadgeIds || []),
      badgeId,
    ]),
  };
}

/** Attach permanent grants + creator flag (live UUIDs, every league). */
export function withPermanentBadges(player: Player): Player {
  const withPerm = {
    ...player,
    permanentBadgeIds: mergePermanentBadges(player.id, player.permanentBadgeIds),
  };
  return withCreatorFlag(withPerm);
}

/** Point values by tier */
export const TIER_POINTS: Record<BadgeTier, number> = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 150,
};

export const TIER_ORDER: BadgeTier[] = [
  "legendary",
  "epic",
  "rare",
  "common",
];

export const TIER_LABEL: Record<BadgeTier, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

/** Full CFB badge catalog (v1) */
export const BADGE_CATALOG: BadgeDef[] = [
  // —— Legendary ——
  {
    id: "the_commissioner",
    // Equipable nameplate title for Mike V. (id kept for career bank / permanent grants)
    name: "The Creator",
    description:
      "Built War Room Pick'Em. Not a league host. Not a peasant. Career points only — never pads season cheevos or Cheevo King.",
    howToEarn:
      "You can't. Opening a league makes you commissioner of that room — cute. This crown is for the person who built the app. Peasants stay grey.",
    lockedLabel: "Hard locked — peasants don't get this one",
    tier: "legendary",
    points: 250,
    creatorOnly: true,
    icon: "👑",
  },
  {
    id: "war_room_legend",
    name: "War Room Legend",
    description:
      "Trophy hardware. Season champ energy. The board remembers.",
    howToEarn:
      "Win a major War Room trophy (Championship / engraved hardware). Awarded by the room — career points stick forever.",
    tier: "legendary",
    points: 200,
    icon: "🏆",
  },
  {
    id: "immortal_streak",
    name: "Immortal Streak",
    description: "Thirty straight correct. Unholy.",
    howToEarn: "Get 30 correct ATS picks in a row.",
    tier: "legendary",
    points: 200,
    icon: "🔥",
  },
  {
    id: "the_closer",
    name: "The Closer",
    description: "Title weekend. Lights on. Card cashed.",
    howToEarn: "Cash your picks on the CFP / finals slate.",
    tier: "legendary",
    points: 150,
    icon: "🎯",
  },
  {
    id: "elite_commish",
    name: "Elite Commish",
    description:
      "Ran a league with the gavel — 14 of 18 weeks minimum. Real work. Not the game-creator crown.",
    howToEarn:
      "Serve as league commissioner for at least 14 of the 18 season weeks in one league season. Pass the role and the clock stops; keep showing up and the gavel remembers.",
    tier: "legendary",
    points: 150,
    icon: "⚖️",
  },

  // —— Epic ——
  {
    id: "war_room_general",
    name: "War Room General",
    description: "Your league, your week, your throne.",
    howToEarn: "Finish #1 in your league for a week.",
    tier: "epic",
    points: 50,
    icon: "⭐",
  },
  {
    id: "sniper",
    name: "Sniper",
    description: "Fifteen in a row. Cold blood.",
    howToEarn: "Get 15 correct ATS picks in a row.",
    tier: "epic",
    points: 50,
    icon: "🔫",
  },
  {
    id: "max_card",
    name: "Max Card",
    description: "Confidence stacked. Everything hit.",
    howToEarn: "Score 18+ points in a single week (perfect card territory).",
    tier: "epic",
    points: 50,
    icon: "💎",
  },
  {
    id: "perfect_saturday",
    name: "Perfect Saturday",
    description: "Every pick. One Saturday. No misses.",
    howToEarn: "Post a perfect week (18+ pts) at least once.",
    tier: "epic",
    points: 50,
    icon: "✨",
  },
  {
    id: "seasoned_vet",
    name: "Seasoned Vet",
    description: "A thousand correct locks. Campus tour complete.",
    howToEarn: "Reach 1,000 lifetime correct ATS picks.",
    tier: "epic",
    points: 50,
    icon: "🎓",
  },
  {
    id: "villain_arc",
    name: "Villain Arc",
    description: "Same rival. Three straight weeks. Evil.",
    howToEarn: "Beat the same rival three weeks in a row.",
    tier: "epic",
    points: 50,
    icon: "😈",
  },

  // —— Rare ——
  {
    id: "first_and_final",
    name: "First & Final",
    description:
      "Locked the full card before every other human that week — then never touched the slip. Edit once and it's gone.",
    howToEarn:
      "Be the first real player in your league to fully lock a week (sides, confidence, Best Bet, prop). Change any pick after that and you forfeit the badge for that week.",
    tier: "rare",
    points: 25,
    icon: "🔒",
  },
  {
    id: "hot_hand",
    name: "Hot Hand",
    description: "Five correct in a row. Don't cool off.",
    howToEarn: "Get 5 correct ATS picks in a row.",
    tier: "rare",
    points: 25,
    icon: "🖐️",
  },
  {
    id: "clean_sheet",
    name: "Clean Sheet",
    description: "Full card. Zero wrong.",
    howToEarn: "Post a perfect week (18+ pts).",
    tier: "rare",
    points: 25,
    icon: "🧼",
  },
  {
    id: "parlay_pilot",
    name: "Parlay Pilot",
    description: "Best Bet boarded and cashed.",
    howToEarn: "Hit your Best Bet 3 times.",
    tier: "rare",
    points: 25,
    icon: "✈️",
  },
  {
    id: "underdog_believer",
    name: "Underdog Believer",
    description: "Took the dog. Got paid in glory.",
    howToEarn: "Hit 5 underdog ATS picks (tracked via upsets as season grows).",
    tier: "rare",
    points: 25,
    icon: "🐕",
  },
  {
    id: "volume_shooter",
    name: "Volume Shooter",
    description: "A hundred correct. Quantity is a skill.",
    howToEarn: "Reach 100 lifetime correct ATS picks.",
    tier: "rare",
    points: 25,
    icon: "📊",
  },
  {
    id: "iron_lungs",
    name: "Iron Lungs",
    description: "Showed up every week. No ghosting Saturday.",
    howToEarn: "Submit picks for 4 consecutive weeks.",
    tier: "rare",
    points: 25,
    icon: "💪",
  },
  {
    id: "rivalry_week",
    name: "Rivalry Week",
    description: "Hate week. Correct side.",
    howToEarn: "Cash a pick in a designated rivalry game.",
    tier: "rare",
    points: 25,
    icon: "⚔️",
  },
  {
    id: "clutch_gene",
    name: "Clutch Gene",
    description: "Last leg. Still hit.",
    howToEarn: "Hit 5 Best Bets in a season.",
    tier: "rare",
    points: 25,
    icon: "🧊",
  },
  {
    id: "cheevo_king",
    name: "Cheevo King",
    description:
      "Most achievement points in the league. Once you take the crown, you keep it forever — even if someone passes you later.",
    howToEarn:
      "Have the most achievement points in your league (checked whenever profiles/standings load). Awarded forever.",
    tier: "rare",
    points: 25,
    icon: "👑",
  },

  // —— Common ——
  {
    id: "first_blood",
    name: "First Blood",
    description: "You made a pick. Welcome to the chaos.",
    howToEarn: "Make your first pick.",
    tier: "common",
    points: 10,
    icon: "🩸",
  },
  {
    id: "war_room_recruit",
    name: "War Room Recruit",
    description: "Name on the board. You're in.",
    howToEarn: "Complete your profile (display name).",
    tier: "common",
    points: 10,
    icon: "🪖",
  },
  {
    id: "lock_it_in",
    name: "Lock It In",
    description: "Card submitted. No take-backs after kickoff.",
    howToEarn: "Submit a full weekly card.",
    tier: "common",
    points: 10,
    icon: "🔒",
  },
  {
    id: "on_the_board",
    name: "On the Board",
    description: "First correct pick. It begins.",
    howToEarn: "Get your first correct ATS pick.",
    tier: "common",
    points: 10,
    icon: "📌",
  },
  {
    id: "chalk_eater",
    name: "Chalk Eater",
    description: "Took the chalk. It covered. Fine, we all do it.",
    howToEarn: "Get 10 correct ATS picks (favorites count).",
    tier: "common",
    points: 10,
    icon: "🏈",
  },
  {
    id: "saturday_starter",
    name: "Saturday Starter",
    description: "First Saturday in the War Room.",
    howToEarn: "Make picks for your first Saturday slate.",
    tier: "common",
    points: 10,
    icon: "📅",
  },
  {
    id: "green_light",
    name: "Green Light",
    description: "Points on the board. You're not zero.",
    howToEarn: "Score your first weekly points.",
    tier: "common",
    points: 10,
    icon: "💚",
  },
  {
    id: "face_of_the_franchise",
    name: "Face of the Franchise",
    description: "Put a face to the bad beats.",
    howToEarn: "Upload a profile photo.",
    tier: "common",
    points: 10,
    icon: "📸",
  },
  {
    id: "gameday_ready",
    name: "Gameday Ready",
    description: "Multiple weeks. You're a regular now.",
    howToEarn: "Play 3 weeks.",
    tier: "common",
    points: 10,
    icon: "🏟️",
  },

  // —— Legendary (batch 2) ——
  {
    id: "national_nightmare",
    name: "National Nightmare",
    description:
      "Crystal Ball correct. Zero standings points. Infinite smug.",
    howToEarn:
      "Correctly pick the national champion on Crystal Ball (commish crowns the champ).",
    tier: "legendary",
    points: 200,
    icon: "🔮",
  },
  {
    id: "championship_ring",
    name: "Championship Ring",
    description: "Top half. Last one standing. Engraved.",
    howToEarn: "Win the league Championship (Trophy Room).",
    tier: "legendary",
    points: 200,
    icon: "💍",
  },
  {
    id: "toilet_crown",
    name: "Toilet Crown",
    description: "Bottom half. Still a crown. Wear it.",
    howToEarn: "Win the Toilet Bowl (Trophy Room).",
    tier: "legendary",
    points: 150,
    icon: "🚽",
  },
  {
    id: "season_sovereign",
    name: "Season Sovereign",
    description: "Most pick'em points when the music stops.",
    howToEarn:
      "Finish #1 overall with at least 10 weeks played (checked on profile/standings load).",
    tier: "legendary",
    points: 200,
    icon: "👑",
  },
  {
    id: "unbreakable",
    name: "Unbreakable",
    description: "Twenty straight correct. Campus legend.",
    howToEarn: "Get 20 correct ATS picks in a row (hot week streak).",
    tier: "legendary",
    points: 200,
    icon: "🛡️",
  },

  // —— Epic (batch 2) ——
  {
    id: "six_pack_saturday",
    name: "Six-Pack Saturday",
    description: "Five-game card, five correct. Pure.",
    howToEarn: "Post a perfect week (18+ pts / perfect card).",
    tier: "epic",
    points: 50,
    icon: "📦",
  },
  {
    id: "confidence_king",
    name: "Confidence King",
    description: "Maxed the ladder and still cashed big.",
    howToEarn: "Score 16+ points in a single week.",
    tier: "epic",
    points: 50,
    icon: "🎰",
  },
  {
    id: "best_bet_assassin",
    name: "Best Bet Assassin",
    description: "Star hits keep stacking.",
    howToEarn: "Hit 8 Best Bets in a season.",
    tier: "epic",
    points: 50,
    icon: "🗡️",
  },
  {
    id: "prop_overlord",
    name: "Prop Overlord",
    description: "Side quest became main quest.",
    howToEarn: "Hit 8 props in a season.",
    tier: "epic",
    points: 50,
    icon: "📜",
  },
  {
    id: "dog_whisperer",
    name: "Dog Whisperer",
    description: "Underdogs print your name.",
    howToEarn:
      "Hit 10 underdog-style cashes (proxy: 10+ ATS correct with Best Bet volume — full dog tracking later).",
    tier: "epic",
    points: 50,
    icon: "🐕",
  },
  {
    id: "ten_streak_terror",
    name: "Ten-Streak Terror",
    description: "Ten correct without a miss.",
    howToEarn: "Get 10 correct ATS picks in a row (hot week streak).",
    tier: "epic",
    points: 50,
    icon: "⚡",
  },
  {
    id: "division_dominator",
    name: "Division Dominator",
    description: "#1 in your division right now.",
    howToEarn: "Lead your division in season points (checked on load).",
    tier: "epic",
    points: 50,
    icon: "🗺️",
  },
  {
    id: "comeback_kid",
    name: "Comeback Kid",
    description: "Big week after a quiet one.",
    howToEarn: "Score 8+ more points than your previous week at least once.",
    tier: "epic",
    points: 50,
    icon: "📈",
  },
  {
    id: "cut_line_killer",
    name: "Cut Line Killer",
    description: "From danger to clear air.",
    howToEarn: "Sit in the top 25% of the league overall (min 4 players).",
    tier: "epic",
    points: 50,
    icon: "✂️",
  },
  {
    id: "iron_card",
    name: "Iron Card",
    description: "Showed up for every week on the board.",
    howToEarn: "Play 14+ weeks in a season (full-season grind).",
    tier: "epic",
    points: 50,
    icon: "🦾",
  },

  // —— Rare (batch 2) ——
  {
    id: "four_green_friday",
    name: "Four-Green Friday",
    description: "Four correct on one slate. Heating up.",
    howToEarn: "Score 12+ points in a week (strong multi-hit card).",
    tier: "rare",
    points: 25,
    icon: "🟩",
  },
  {
    id: "sweep_adjacent",
    name: "Sweep Adjacent",
    description: "One miss from perfect. Still mean.",
    howToEarn: "Score 15–17 points in a week.",
    tier: "rare",
    points: 25,
    icon: "😤",
  },
  {
    id: "best_bet_banker",
    name: "Best Bet Banker",
    description: "The star paid twice.",
    howToEarn: "Hit Best Bet 2 times in a season.",
    tier: "rare",
    points: 25,
    icon: "⭐",
  },
  {
    id: "prop_prophet",
    name: "Prop Prophet",
    description: "Weekly side quest completed correctly.",
    howToEarn: "Hit 3 props in a season.",
    tier: "rare",
    points: 25,
    icon: "🔮",
  },
  {
    id: "underdog_spree",
    name: "Underdog Spree",
    description: "Dogs paid three times. Chaos agent.",
    howToEarn: "Hit 3 underdog-style cashes (proxy via ATS volume).",
    tier: "rare",
    points: 25,
    icon: "🎲",
  },
  {
    id: "chalk_streak",
    name: "Chalk Streak",
    description: "Favorites only, still correct. Boring. Effective.",
    howToEarn: "Hold a 5-week hot streak (pts ≥ 10).",
    tier: "rare",
    points: 25,
    icon: "📏",
  },
  {
    id: "division_climber",
    name: "Division Climber",
    description: "Top three in your division.",
    howToEarn: "Rank top 3 in your division by season points.",
    tier: "rare",
    points: 25,
    icon: "🪜",
  },
  {
    id: "leaderboard_lookin",
    name: "Leaderboard Lookin’",
    description: "Cracked the overall top half.",
    howToEarn: "Sit in the top 50% of the league overall.",
    tier: "rare",
    points: 25,
    icon: "👀",
  },
  {
    id: "cut_line_escape",
    name: "Cut Line Escape",
    description: "Not in the bottom half anymore.",
    howToEarn: "Sit in the top half of the league overall.",
    tier: "rare",
    points: 25,
    icon: "🏃",
  },
  {
    id: "bottom_of_the_barrel",
    name: "Bottom of the Barrel",
    description:
      "Dead last for a week. Alone. No ties. Pure basement energy.",
    howToEarn:
      "Finish sole last in weekly points among players who scored that week — no ties for last.",
    tier: "rare",
    points: 25,
    icon: "🛢️",
  },
  {
    id: "streak_starter",
    name: "Streak Starter",
    description: "Three correct in a row. Don’t blink.",
    howToEarn: "Get a 3-week hot streak (pts ≥ 10).",
    tier: "rare",
    points: 25,
    icon: "🔥",
  },
  {
    id: "ten_week_tenant",
    name: "Ten-Week Tenant",
    description: "Double-digit weeks played.",
    howToEarn: "Play 10 weeks in a season.",
    tier: "rare",
    points: 25,
    icon: "🏠",
  },
  {
    id: "full_conference",
    name: "Full Conference",
    description: "Cashed across a long stretch of Saturdays.",
    howToEarn: "Score points in 8 different weeks.",
    tier: "rare",
    points: 25,
    icon: "🗓️",
  },
  {
    id: "road_dog",
    name: "Road Dog",
    description: "Took chaos on the road. It paid.",
    howToEarn: "Hit 5 ATS (proxy for road dogs until side tracking lands).",
    tier: "rare",
    points: 25,
    icon: "🚌",
  },
  {
    id: "home_cookin",
    name: "Home Cookin’",
    description: "Home chalk covered for you.",
    howToEarn: "Get 5 correct ATS picks.",
    tier: "rare",
    points: 25,
    icon: "🏡",
  },
  {
    id: "silence_the_room",
    name: "Silence the Room",
    description: "Best week on the board while someone else got zero.",
    howToEarn:
      "Have the highest single-week score in the league while any peer has a 0 that week.",
    tier: "rare",
    points: 25,
    icon: "🤫",
  },

  // —— Common (batch 2) ——
  {
    id: "card_complete",
    name: "Card Complete",
    description: "Sides, confidence, Best Bet, prop — full slip.",
    howToEarn: "Lock a complete weekly card (any week played).",
    tier: "common",
    points: 10,
    icon: "✅",
  },
  {
    id: "prop_merchant",
    name: "Prop Merchant",
    description: "Took a side on the weekly prop.",
    howToEarn: "Record a prop result (hit or miss) — prop_total ≥ 1.",
    tier: "common",
    points: 10,
    icon: "🛒",
  },
  {
    id: "best_bet_marked",
    name: "Best Bet Marked",
    description: "You put your money where the star is.",
    howToEarn: "Set a Best Bet at least once (best_bet_total ≥ 1).",
    tier: "common",
    points: 10,
    icon: "🌟",
  },
  {
    id: "confidence_ladder",
    name: "Confidence Ladder",
    description: "Used 1 through 5 like the manual said.",
    howToEarn: "Play a full week (card with confidences locked).",
    tier: "common",
    points: 10,
    icon: "📶",
  },
  {
    id: "division_dweller",
    name: "Division Dweller",
    description: "You live somewhere on the map.",
    howToEarn: "Be assigned to a division.",
    tier: "common",
    points: 10,
    icon: "🧭",
  },
  {
    id: "week_one_warrior",
    name: "Week One Warrior",
    description: "Survived the first scored week.",
    howToEarn: "Have points on a scored week.",
    tier: "common",
    points: 10,
    icon: "⚔️",
  },
  {
    id: "two_week_tour",
    name: "Two-Week Tour",
    description: "Not a one-and-done tourist.",
    howToEarn: "Play 2 different weeks.",
    tier: "common",
    points: 10,
    icon: "🎟️",
  },
  {
    id: "halfway_hangin",
    name: "Halfway Hangin’",
    description: "Mid-slate, still showing up.",
    howToEarn: "Play 6 weeks in a season.",
    tier: "common",
    points: 10,
    icon: "⏳",
  },
  {
    id: "double_digit_club",
    name: "Double Digit Club",
    description: "Season points left single digits.",
    howToEarn: "Reach 10 season pick'em points.",
    tier: "common",
    points: 10,
    icon: "🔟",
  },
  {
    id: "fifty_club",
    name: "Fifty Club",
    description: "Half a hundred on the board.",
    howToEarn: "Reach 50 season points.",
    tier: "common",
    points: 10,
    icon: "5️⃣",
  },
  {
    id: "century_club",
    name: "Century Club",
    description: "Three digits. Respectable noise.",
    howToEarn: "Reach 100 season points.",
    tier: "common",
    points: 10,
    icon: "💯",
  },
  {
    id: "push_happens",
    name: "Push Happens",
    description: "The line was fair. Annoyingly fair.",
    howToEarn: "Record a push (tracked when scoring lands a push).",
    tier: "common",
    points: 10,
    icon: "⚖️",
  },
  {
    id: "favorite_survivor",
    name: "Favorite Survivor",
    description: "Chalk covered. Group chat shrugs.",
    howToEarn: "Get 3 correct ATS picks.",
    tier: "common",
    points: 10,
    icon: "🦴",
  },
  {
    id: "dog_day_afternoon",
    name: "Dog Day Afternoon",
    description: "Took a plus number. It landed.",
    howToEarn: "Get 1 correct ATS pick (dog proxy until side tracking).",
    tier: "common",
    points: 10,
    icon: "🌤️",
  },
  {
    id: "spread_survivor",
    name: "Spread Survivor",
    description: "Beat the number once.",
    howToEarn: "Win any single ATS pick.",
    tier: "common",
    points: 10,
    icon: "📊",
  },
  {
    id: "multi_game_monday",
    name: "Multi-Game Monday",
    description: "More than one correct that week.",
    howToEarn: "Score 6+ points in a week (multi-hit).",
    tier: "common",
    points: 10,
    icon: "2️⃣",
  },
  {
    id: "three_pack",
    name: "Three-Pack",
    description: "Three greens on the same card.",
    howToEarn: "Score 9+ points in a week.",
    tier: "common",
    points: 10,
    icon: "3️⃣",
  },
  {
    id: "locker_lurker",
    name: "Locker Lurker",
    description: "You said something. Or at least typed.",
    howToEarn: "Post once in Locker Room.",
    tier: "common",
    points: 10,
    icon: "💬",
  },
  {
    id: "news_reader",
    name: "News Reader",
    description: "Opened the commissioner’s noise.",
    howToEarn: "Open Announcements at least once.",
    tier: "common",
    points: 10,
    icon: "📰",
  },
  {
    id: "board_watcher",
    name: "Board Watcher",
    description: "Checked who you’re hunting.",
    howToEarn: "Open Standings.",
    tier: "common",
    points: 10,
    icon: "📋",
  },
  {
    id: "rules_skimmer",
    name: "Rules Skimmer",
    description: "At least you know the lock rule exists.",
    howToEarn: "Open Rules.",
    tier: "common",
    points: 10,
    icon: "📖",
  },
  {
    id: "crystal_gazed",
    name: "Crystal Gazed",
    description: "Peered into the orb.",
    howToEarn: "Make a Crystal Ball pick.",
    tier: "common",
    points: 10,
    icon: "🧿",
  },
  {
    id: "profile_peeker",
    name: "Profile Peeker",
    description: "Stalked a trophy case.",
    howToEarn: "Open another player’s profile.",
    tier: "common",
    points: 10,
    icon: "🕵️",
  },
  {
    id: "late_night_lock",
    name: "Late Night Lock",
    description: "Card in after dark. Still counts.",
    howToEarn: "Lock a full card after 10pm local (device time).",
    tier: "common",
    points: 10,
    icon: "🌙",
  },
  {
    id: "rematch_ready",
    name: "Rematch Ready",
    description: "Back for another Saturday.",
    howToEarn: "Play 2 consecutive weeks (weeksPlayed ≥ 2).",
    tier: "common",
    points: 10,
    icon: "🔁",
  },
];

const CATALOG_BY_ID = Object.fromEntries(
  BADGE_CATALOG.map((b) => [b.id, b])
) as Record<string, BadgeDef>;

export function getBadgeDef(id: string): BadgeDef | undefined {
  return CATALOG_BY_ID[id];
}

type EvalResult = {
  earned: boolean;
  progress?: { current: number; target: number } | null;
};

function progress(current: number, target: number): EvalResult {
  return {
    earned: current >= target,
    progress: { current: Math.min(current, target), target },
  };
}

function weeklyArr(player: Player): number[] {
  return Array.isArray(player.weeklyPoints) ? player.weeklyPoints : [];
}

function weeksWithPoints(player: Player): number {
  return weeklyArr(player).filter((w) => (w || 0) > 0).length;
}

/**
 * True if this player was sole last in weekly points for any week index
 * (among peers who have a score that week). Ties for last do not count.
 */
function hadSoleLastPlaceWeek(player: Player, peers: Player[]): boolean {
  const league = peers.length ? peers : [player];
  if (league.length < 2) return false;
  const mine = weeklyArr(player);
  if (!mine.length) return false;

  const maxLen = Math.max(
    0,
    ...league.map((p) => weeklyArr(p).length),
    mine.length
  );

  for (let w = 0; w < maxLen; w++) {
    if (w >= mine.length) continue;
    const myPts = mine[w];
    // Must have a real entry for that week (0 is a valid "last place" score)
    if (myPts == null || Number.isNaN(myPts)) continue;

    const field: number[] = [];
    for (const p of league) {
      const arr = weeklyArr(p);
      if (w >= arr.length) continue;
      const pts = arr[w];
      if (pts == null || Number.isNaN(pts)) continue;
      field.push(pts);
    }
    // Need a real field (you + at least one other)
    if (field.length < 2) continue;

    const min = Math.min(...field);
    if (myPts !== min) continue;
    const lastCount = field.filter((s) => s === min).length;
    if (lastCount === 1) return true;
  }
  return false;
}

function maxWeekClimb(player: Player): number {
  const w = weeklyArr(player);
  let best = 0;
  for (let i = 1; i < w.length; i++) {
    best = Math.max(best, (w[i] || 0) - (w[i - 1] || 0));
  }
  return best;
}

function hasWeekInRange(player: Player, min: number, max: number): boolean {
  return weeklyArr(player).some((w) => w >= min && w <= max);
}

function hasWeekAtLeast(player: Player, min: number): boolean {
  return weeklyArr(player).some((w) => (w || 0) >= min);
}

function overallSorted(peers: Player[]): Player[] {
  return [...peers].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
}

function overallRank(player: Player, peers: Player[]): number {
  if (!peers.length) return 0;
  const sorted = overallSorted(peers);
  const i = sorted.findIndex((p) => p.id === player.id);
  return i < 0 ? 0 : i + 1;
}

function divisionPeers(player: Player, peers: Player[]): Player[] {
  return peers.filter((p) => p.division === player.division);
}

function divisionRank(player: Player, peers: Player[]): number {
  const div = overallSorted(divisionPeers(player, peers));
  const i = div.findIndex((p) => p.id === player.id);
  return i < 0 ? 0 : i + 1;
}

/** Evaluate whether a player has earned a badge from current stats */
function evaluateBadge(
  badgeId: string,
  player: Player,
  peers: Player[] = []
): EvalResult {
  const streak = Math.max(0, player.currentStreak);
  const bestWeek = player.bestWeek || 0;
  const perfect = player.perfectWeeks || 0;
  const weeks = player.weeksPlayed || weeklyArr(player).length || 0;
  const ats = player.atsCorrect || 0;
  const bb = player.bestBetHits || 0;
  const props = player.propHits || 0;
  const propTot = player.propTotal || 0;
  const bbTot = player.bestBetTotal || 0;
  const total = player.totalPoints || 0;
  const league = peers.length ? peers : [player];
  const n = league.length;
  const rank = overallRank(player, league);
  const dRank = divisionRank(player, league);

  switch (badgeId) {
    case "the_commissioner":
      return { earned: isAppCreator(player.id) };

    case "elite_commish": {
      if (hasPermanentBadge(player, IRON_COMMISH_BADGE_ID)) {
        return { earned: true };
      }
      return progress(getBestCommishWeeks(player.id), IRON_COMMISH_TARGET);
    }

    case "war_room_legend":
    case WAR_ROOM_LEGEND_ID:
      return {
        earned: hasPermanentBadge(player, WAR_ROOM_LEGEND_ID),
      };

    case "immortal_streak":
      return progress(streak, 30);

    case "unbreakable":
      return progress(streak, 20);

    case "the_closer":
      // CFP weeks 15–18: any solid score on late weeks
      return {
        earned: weeklyArr(player).some(
          (pts, i) => i >= 15 && (pts || 0) >= 10
        ),
      };

    case "national_nightmare":
      return {
        earned: hasPermanentBadge(player, "national_nightmare"),
      };

    case "championship_ring":
      return {
        earned: hasPermanentBadge(player, "championship_ring"),
      };

    case "toilet_crown":
      return {
        earned: hasPermanentBadge(player, "toilet_crown"),
      };

    case "season_sovereign":
      return {
        earned:
          n >= 2 &&
          rank === 1 &&
          weeks >= 10 &&
          total > 0,
      };

    case "war_room_general":
      // #1 week: highest single week among peers
      if (n < 2) return { earned: false };
      {
        const myBest = bestWeek;
        if (myBest <= 0) return { earned: false };
        const maxPeer = Math.max(...league.map((p) => p.bestWeek || 0));
        return { earned: myBest >= maxPeer && myBest >= 10 };
      }

    case "sniper":
      return progress(streak, 15);

    case "ten_streak_terror":
      return progress(streak, 10);

    case "max_card":
    case "perfect_saturday":
    case "clean_sheet":
    case "six_pack_saturday":
      return progress(Math.max(perfect, bestWeek >= 18 ? 1 : 0), 1);

    case "confidence_king":
      return progress(hasWeekAtLeast(player, 16) ? 1 : 0, 1);

    case "seasoned_vet":
      return progress(ats, 1000);

    case "villain_arc":
      return { earned: false };

    case "best_bet_assassin":
      return progress(bb, 8);

    case "prop_overlord":
      return progress(props, 8);

    case "dog_whisperer":
      // Proxy until favorite/dog tracked: solid ATS volume
      return progress(ats, 40);

    case "division_dominator":
      return {
        earned: dRank === 1 && divisionPeers(player, league).length >= 2,
      };

    case "comeback_kid":
      return progress(maxWeekClimb(player) >= 8 ? 1 : 0, 1);

    case "cut_line_killer":
      return {
        earned: n >= 4 && rank > 0 && rank <= Math.max(1, Math.ceil(n * 0.25)),
      };

    case "iron_card":
      return progress(weeks, 14);

    case "first_and_final": {
      if (firstFinalEarned(player.id)) return { earned: true };
      return progress(countCleanFirstFinalWeeks(player.id), 1);
    }

    case "hot_hand":
      return progress(streak, 5);

    case "chalk_streak":
    case "streak_starter":
      return progress(streak, badgeId === "chalk_streak" ? 5 : 3);

    case "parlay_pilot":
      return progress(bb, 3);

    case "best_bet_banker":
      return progress(bb, 2);

    case "underdog_believer":
      return progress(Math.min(ats, 5), 5);

    case "underdog_spree":
      return progress(Math.min(ats, 3), 3);

    case "road_dog":
      return progress(ats, 5);

    case "home_cookin":
      return progress(ats, 5);

    case "volume_shooter":
      return progress(ats, 100);

    case "iron_lungs":
      return progress(weeks, 4);

    case "ten_week_tenant":
      return progress(weeks, 10);

    case "full_conference":
      return progress(weeksWithPoints(player), 8);

    case "rivalry_week":
      return { earned: false };

    case "clutch_gene":
      return progress(bb, 5);

    case "prop_prophet":
      return progress(props, 3);

    case "four_green_friday":
      return progress(hasWeekAtLeast(player, 12) ? 1 : 0, 1);

    case "sweep_adjacent":
      return progress(hasWeekInRange(player, 15, 17) ? 1 : 0, 1);

    case "division_climber":
      return {
        earned: dRank > 0 && dRank <= 3 && divisionPeers(player, league).length >= 3,
      };

    case "leaderboard_lookin":
    case "cut_line_escape":
      return {
        earned: n >= 2 && rank > 0 && rank <= Math.ceil(n / 2),
      };

    case "bottom_of_the_barrel":
      return progress(hadSoleLastPlaceWeek(player, league) ? 1 : 0, 1);

    case "silence_the_room": {
      if (n < 2 || bestWeek <= 0) return { earned: false };
      const maxBest = Math.max(...league.map((p) => p.bestWeek || 0));
      const someoneZero = league.some(
        (p) => p.id !== player.id && (p.worstWeek === 0 || weeksWithPoints(p) < weeks)
      );
      // Peer has a zero week while you own the high watermark
      const peerZeroWeek = league.some((p) =>
        weeklyArr(p).some((w) => w === 0 && weeklyArr(p).length > 0)
      );
      return {
        earned:
          bestWeek >= maxBest &&
          bestWeek >= 12 &&
          (someoneZero || peerZeroWeek),
      };
    }

    case "cheevo_king":
      return {
        earned: hasPermanentBadge(player, CHEEVO_KING_ID),
      };

    case "first_blood":
    case "lock_it_in":
    case "saturday_starter":
    case "card_complete":
    case "confidence_ladder":
      return progress(weeks > 0 || (player.atsTotal || 0) > 0 ? 1 : 0, 1);

    case "rematch_ready":
      return progress(weeks, 2);

    case "war_room_recruit":
      return progress(player.name?.trim() ? 1 : 0, 1);

    case "division_dweller":
      return progress(player.division ? 1 : 0, 1);

    case "on_the_board":
    case "spread_survivor":
    case "dog_day_afternoon":
      return progress(ats, 1);

    case "favorite_survivor":
      return progress(ats, 3);

    case "chalk_eater":
      return progress(ats, 10);

    case "green_light":
    case "week_one_warrior":
      return progress(total > 0 ? 1 : 0, 1);

    case "two_week_tour":
      return progress(weeks, 2);

    case "halfway_hangin":
      return progress(weeks, 6);

    case "double_digit_club":
      return progress(total, 10);

    case "fifty_club":
      return progress(total, 50);

    case "century_club":
      return progress(total, 100);

    case "multi_game_monday":
      return progress(hasWeekAtLeast(player, 6) ? 1 : 0, 1);

    case "three_pack":
      return progress(hasWeekAtLeast(player, 9) ? 1 : 0, 1);

    case "prop_merchant":
      return progress(propTot, 1);

    case "best_bet_marked":
      return progress(bbTot, 1);

    case "face_of_the_franchise":
      return progress(player.avatarUrl ? 1 : 0, 1);

    case "gameday_ready":
      return progress(weeks, 3);

    case "locker_lurker":
      return progress(
        hasEngagement(player.id, "posted_locker") ||
          hasEngagement(player.id, "opened_locker")
          ? 1
          : 0,
        1
      );

    case "news_reader":
      return progress(hasEngagement(player.id, "opened_announcements") ? 1 : 0, 1);

    case "board_watcher":
      return progress(hasEngagement(player.id, "opened_standings") ? 1 : 0, 1);

    case "rules_skimmer":
      return progress(hasEngagement(player.id, "opened_rules") ? 1 : 0, 1);

    case "crystal_gazed":
      return progress(
        hasEngagement(player.id, "crystal_ball_picked") ? 1 : 0,
        1
      );

    case "profile_peeker":
      return progress(
        hasEngagement(player.id, "opened_other_profile") ? 1 : 0,
        1
      );

    case "late_night_lock":
      return progress(hasEngagement(player.id, "locked_after_22") ? 1 : 0, 1);

    case "push_happens":
      return progress(hasEngagement(player.id, "push_recorded") ? 1 : 0, 1);

    default:
      return { earned: false };
  }
}

function sortBadges(statuses: BadgeStatus[]): BadgeStatus[] {
  const tierRank = (t: BadgeTier) => TIER_ORDER.indexOf(t);
  return [...statuses].sort((a, b) => {
    // Earned legendaries first, then by tier, then name
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    const tr = tierRank(a.def.tier) - tierRank(b.def.tier);
    if (tr !== 0) return tr;
    return a.def.name.localeCompare(b.def.name);
  });
}

/**
 * Full badge shelf for a profile.
 * Pass leaguePeers when available so rank/division badges evaluate correctly.
 */
export function getPlayerBadges(
  player: Player,
  leaguePeers?: Player[]
): BadgeStatus[] {
  // Credit active week if YOU are the league commissioner (tenure tracker)
  try {
    syncCommissionerTenureFromSession();
  } catch {
    /* ignore */
  }
  // Prior-season trophy winners (Kahmann champ, Bill ball Ben nerd) → permanent + career bank
  try {
    applyLegacyBadgeGrants(player);
  } catch {
    /* ignore */
  }
  const p = withPermanentBadges(player);
  // Ensure creator always has the legendary permanently recorded for this id
  if (isAppCreator(p.id)) {
    grantPermanentBadgeId(p.id, CREATOR_BADGE_ID);
  }
  // Elite Commish sticks forever once 14/18 is hit
  if (getBestCommishWeeks(p.id) >= IRON_COMMISH_TARGET) {
    grantPermanentBadgeId(p.id, IRON_COMMISH_BADGE_ID);
  }
  const peers =
    leaguePeers && leaguePeers.length
      ? leaguePeers.map((x) => withPermanentBadges(x))
      : [p];
  const statuses: BadgeStatus[] = BADGE_CATALOG.map((def) => {
    try {
      const result = evaluateBadge(def.id, p, peers);
      const permanent = hasPermanentBadge(p, def.id);
      const earned = result.earned || permanent;
      return {
        def,
        earned,
        earnedAt: earned ? p.memberSince ?? null : null,
        progress: earned ? null : result.progress ?? null,
      };
    } catch {
      return {
        def,
        earned: hasPermanentBadge(p, def.id),
        earnedAt: null,
        progress: null,
      };
    }
  });
  return sortBadges(statuses);
}

/**
 * Sum of points from earned badges.
 * forRanking: exclude Cheevo King (can't pad its own race) and creator-only
 * badges (career flex only — not the season cheevo race).
 */
export function getAchievementPoints(
  player: Player,
  opts?: { forRanking?: boolean }
): number {
  return getPlayerBadges(player)
    .filter((b) => b.earned)
    .filter((b) => {
      if (!opts?.forRanking) return true;
      if (b.def.id === CHEEVO_KING_ID) return false;
      if (b.def.creatorOnly) return false;
      return true;
    })
    .reduce((sum, b) => sum + b.def.points, 0);
}

/**
 * Grant Cheevo King forever to whoever currently has the most
 * achievement points in the league (real players preferred).
 * Already-crowned players keep it even if they fall behind later.
 *
 * Returns updated roster (same array reference if nothing changed).
 */
export function syncLeagueCheevoKing(players: Player[]): Player[] {
  if (!players.length) return players;

  // Prefer humans over demo NPCs when both exist
  const humans = players.filter((p) => !p.isMock);
  const pool = humans.length >= 1 ? humans : players;

  const scored = pool.map((p) => ({
    id: p.id,
    pts: getAchievementPoints(p, { forRanking: true }),
  }));

  const maxPts = Math.max(...scored.map((s) => s.pts), 0);
  // Need at least some cheevos before crowning anyone
  if (maxPts <= 0) return players;

  const leaderIds = new Set(
    scored.filter((s) => s.pts === maxPts).map((s) => s.id)
  );

  let changed = false;
  const next = players.map((p) => {
    if (!leaderIds.has(p.id)) return p;
    if (hasPermanentBadge(p, CHEEVO_KING_ID)) return p;
    changed = true;
    return grantPermanentBadge(p, CHEEVO_KING_ID);
  });

  return changed ? next : players;
}

/** Count earned by tier */
export function countEarnedByTier(
  player: Player
): Record<BadgeTier, number> {
  const counts: Record<BadgeTier, number> = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };
  for (const b of getPlayerBadges(player)) {
    if (b.earned) counts[b.def.tier]++;
  }
  return counts;
}

export function formatMemberSince(iso?: string): string {
  if (!iso) return "Recently joined";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Recently joined";
  }
}

export function memberDuration(iso?: string): string {
  if (!iso) return "New recruit";
  try {
    const start = new Date(iso).getTime();
    const now = Date.now();
    const days = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    if (days < 30) return days <= 1 ? "Joined today" : `${days} days in`;
    const months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? "1 month in" : `${months} months in`;
    const years = Math.floor(months / 12);
    return years === 1 ? "1 year in" : `${years} years in`;
  } catch {
    return "New recruit";
  }
}
