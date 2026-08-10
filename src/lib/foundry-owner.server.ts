import "server-only";

/**
 * The private workshop has exactly one owner. Do not reuse the broader client
 * creator helper here: that helper intentionally supports local demo seats and
 * public environment configuration, neither of which is authorization.
 */
const FOUNDRY_OWNER_USER_ID = "09544d2b-6eca-4131-a321-c000586c9029";

export function isFoundryOwnerUserId(userId: string | null | undefined): boolean {
  return userId?.trim().toLowerCase() === FOUNDRY_OWNER_USER_ID;
}
