/**
 * Eligible active humans for postseason freeze (pure).
 */

import type { PostseasonMemberInput } from "./types";

/**
 * Active human memberships only.
 * Excludes bots, mocks, fixtures, departed, inactive.
 */
export function filterEligibleActiveHumans(
  members: readonly PostseasonMemberInput[]
): PostseasonMemberInput[] {
  return members.filter((m) => {
    if (!m?.userId) return false;
    if (m.isBot) return false;
    if (m.isMock) return false;
    if (m.isFixture) return false;
    if (m.departed) return false;
    if (m.isActive === false) return false;
    return true;
  });
}

export function countEligibleActiveHumans(
  members: readonly PostseasonMemberInput[]
): number {
  return filterEligibleActiveHumans(members).length;
}
