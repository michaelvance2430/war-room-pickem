/**
 * League join-order profile titles.
 *
 * Commissioner opens the room → special title.
 * First 4 humans who join after → badass.
 * Next 4 → cool.
 * Next 4 → lesser.
 * Everyone else → Bottom Feeder.
 *
 * Rank is by memberships.joined_at (humans only; bots excluded).
 */

export type JoinTitleMember = {
  userId: string;
  role?: "commissioner" | "player" | string;
  isBot?: boolean;
  /** ISO joined_at from memberships */
  joinedAt?: string | null;
};

/** First 4 joiners after the commissioner */
export const BADASS_JOIN_TITLES = [
  "Day-One Demon",
  "Original Sin",
  "Charter Menace",
  "Founding Assassin",
] as const;

/** Joiners 5–8 */
export const COOL_JOIN_TITLES = [
  "Early Money",
  "Inner Circle",
  "First Wave",
  "Table Stakes",
] as const;

/** Joiners 9–12 */
export const LESSER_JOIN_TITLES = [
  "Late RSVP",
  "Warm Body",
  "Plus-One",
  "Participation Trophy",
] as const;

export const BOTTOM_FEEDER_TITLE = "Bottom Feeder";
export const COMMISSIONER_JOIN_TITLE = "Opened the Room";
export const BOT_JOIN_TITLE = "Rental Muscle";

/**
 * Map userId → funny join title for this league roster.
 * Stable: same order every time for the same joined_at set.
 */
export function computeJoinTitles(
  members: JoinTitleMember[]
): Map<string, string> {
  const map = new Map<string, string>();
  if (!members.length) return map;

  for (const m of members) {
    if (m.isBot) {
      map.set(m.userId, BOT_JOIN_TITLE);
      continue;
    }
    if (m.role === "commissioner") {
      map.set(m.userId, COMMISSIONER_JOIN_TITLE);
    }
  }

  // Humans who joined after / aren't commissioner — by join time
  const joiners = members
    .filter((m) => !m.isBot && m.role !== "commissioner")
    .slice()
    .sort((a, b) => {
      const ta = a.joinedAt ? new Date(a.joinedAt).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.joinedAt ? new Date(b.joinedAt).getTime() : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      // Stable tie-break
      return a.userId.localeCompare(b.userId);
    });

  joiners.forEach((m, index) => {
    // index 0–3 badass, 4–7 cool, 8–11 lesser, 12+ bottom feeder
    if (index < 4) {
      map.set(m.userId, BADASS_JOIN_TITLES[index]);
    } else if (index < 8) {
      map.set(m.userId, COOL_JOIN_TITLES[index - 4]);
    } else if (index < 12) {
      map.set(m.userId, LESSER_JOIN_TITLES[index - 8]);
    } else {
      map.set(m.userId, BOTTOM_FEEDER_TITLE);
    }
  });

  return map;
}

export function joinTitleForUser(
  members: JoinTitleMember[],
  userId: string
): string | null {
  if (!userId) return null;
  return computeJoinTitles(members).get(userId) ?? null;
}

/** Short blurb for tier (optional UI). */
export function joinTitleTierLabel(title: string): string | null {
  if (title === COMMISSIONER_JOIN_TITLE) return "Commissioner";
  if ((BADASS_JOIN_TITLES as readonly string[]).includes(title))
    return "OG wave";
  if ((COOL_JOIN_TITLES as readonly string[]).includes(title))
    return "Early wave";
  if ((LESSER_JOIN_TITLES as readonly string[]).includes(title))
    return "Late wave";
  if (title === BOTTOM_FEEDER_TITLE) return "The rest";
  if (title === BOT_JOIN_TITLE) return "Bot";
  return null;
}
