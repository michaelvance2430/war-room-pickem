/**
 * App creator identity — Legendary "The Commissioner" badge.
 * Same person in every league, not tied to commissioner role.
 *
 * Set on Vercel (and .env.local):
 *   NEXT_PUBLIC_CREATOR_USER_IDS=uuid-here,another-uuid
 *
 * Find your id: Account page → copy User ID, or Supabase → Authentication → Users.
 */

/** Optional hardcodes if you don't want env (still prefer env on Vercel). */
const HARDCODED_CREATOR_IDS: string[] = [
  // Mike V. — app creator (The Commissioner legendary)
  "09544d2b-6eca-4131-a321-c000586c9029",
];

function envCreatorIds(): string[] {
  const raw = process.env.NEXT_PUBLIC_CREATOR_USER_IDS || "";
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True if this user id is the app creator (any league). */
export function isAppCreator(userId: string | null | undefined): boolean {
  if (!userId) return false;
  // Local demo commissioner seat
  if (userId === "1") return true;
  if (HARDCODED_CREATOR_IDS.includes(userId)) return true;
  return envCreatorIds().includes(userId);
}

/** Tag player for badge eval / UI. */
export function withCreatorFlag<T extends { id: string; isCreator?: boolean }>(
  player: T
): T {
  if (isAppCreator(player.id)) {
    return { ...player, isCreator: true };
  }
  return player;
}
