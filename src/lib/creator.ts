/**
 * GAME creator identity — Legendary "The Creator" badge / nameplate title.
 *
 * This is NOT league commissioner / who started a league.
 * Friends who create their own league stay grey on this badge.
 * Only the person who built the app (hardcoded / env user ids).
 *
 * Optional env (Vercel / .env.local):
 *   NEXT_PUBLIC_CREATOR_USER_IDS=uuid-here,another-uuid
 */

/** Optional hardcodes if you don't want env (still prefer env on Vercel). */
const HARDCODED_CREATOR_IDS: string[] = [
  // Mike V. — app creator (The Creator legendary)
  "09544d2b-6eca-4131-a321-c000586c9029",
];

function envCreatorIds(): string[] {
  const raw = process.env.NEXT_PUBLIC_CREATOR_USER_IDS || "";
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * True if this user built the game (not "is commissioner of a league").
 * Checked by UUID only — role/commish flags never matter.
 */
export function isAppCreator(userId: string | null | undefined): boolean {
  if (!userId) return false;
  // Local demo seat only
  if (userId === "1") return true;
  if (HARDCODED_CREATOR_IDS.includes(userId)) return true;
  return envCreatorIds().includes(userId);
}

/** Tag player for badge eval / UI (game creator flag, not league role). */
export function withCreatorFlag<T extends { id: string; isCreator?: boolean }>(
  player: T
): T {
  // Always derive from UUID allowlist — never trust a stale isCreator flag
  return { ...player, isCreator: isAppCreator(player.id) };
}
