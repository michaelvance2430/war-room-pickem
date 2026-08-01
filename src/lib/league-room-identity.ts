/**
 * Stable room identity for multi-season achievements.
 *
 * PRODUCT RULE: Never key loyalty / "X seasons in the same league" off the
 * display name — commissioners can rename the room anytime. The durable key is
 * the league UUID (`leagues.id`). Invite code is optional metadata only
 * (codes can be recycled if a league is deleted; UUID never is).
 */

export type RoomIdentity = {
  /** Primary key — always leagues.id */
  leagueId: string;
  /** Invite code snapshot (optional; for debug/display only) */
  code?: string | null;
  /** Display name snapshot (never used as identity) */
  name?: string | null;
};

/** Canonical identity string for maps / storage. Always UUID. */
export function roomIdentityKey(
  leagueId: string | null | undefined
): string | null {
  const id = (leagueId || "").trim();
  return id || null;
}

/**
 * Build identity from league session / row.
 * Prefer `id`; never fall back to name. Code is metadata only.
 */
export function resolveRoomIdentity(opts: {
  leagueId?: string | null;
  id?: string | null;
  code?: string | null;
  name?: string | null;
}): RoomIdentity | null {
  const leagueId = roomIdentityKey(opts.leagueId || opts.id);
  if (!leagueId) return null;
  return {
    leagueId,
    code: opts.code?.trim() || null,
    name: opts.name?.trim() || null,
  };
}

/**
 * Season run key for "this room, this year".
 * Format: `${leagueId}:${seasonYear}` — never includes name or code.
 */
export function roomSeasonKey(
  leagueId: string,
  seasonYear: number
): string {
  return `${leagueId}:${seasonYear}`;
}

/** Parse roomSeasonKey → { leagueId, seasonYear } */
export function parseRoomSeasonKey(
  key: string
): { leagueId: string; seasonYear: number } | null {
  const i = key.lastIndexOf(":");
  if (i <= 0) return null;
  const leagueId = key.slice(0, i);
  const year = parseInt(key.slice(i + 1), 10);
  if (!leagueId || !Number.isFinite(year)) return null;
  return { leagueId, seasonYear: year };
}
