/**
 * Display-name validation + league vs account identity resolution.
 */

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;

export type DisplayNameValidation =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * Normalize a display name or league alias.
 * Returns null for blank (use account name / clear override).
 */
export function validateDisplayNameInput(
  raw: string | null | undefined
): DisplayNameValidation {
  if (raw == null) return { ok: true, value: null };
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: true, value: null };
  if (name.length < DISPLAY_NAME_MIN) {
    return { ok: false, error: "Name needs at least 2 characters." };
  }
  if (name.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: "Keep it under 40 characters." };
  }
  return { ok: true, value: name };
}

/**
 * League context: alias override, else account name.
 * Never invents a name — falls back to "Player".
 */
export function resolveLeagueDisplayName(opts: {
  membershipOverride?: string | null;
  profileDisplayName?: string | null;
  fallback?: string;
}): string {
  const override = (opts.membershipOverride || "").trim();
  if (override) return override;
  const account = (opts.profileDisplayName || "").trim();
  if (account) return account;
  return opts.fallback || "Player";
}

/** Prefer null when alias equals account name (avoid duplicate storage). */
export function normalizeOverrideForStorage(
  alias: string | null | undefined,
  accountDisplayName: string | null | undefined
): string | null {
  const v = validateDisplayNameInput(alias);
  if (!v.ok) return null;
  if (v.value == null) return null;
  const account = (accountDisplayName || "").trim();
  if (account && v.value.toLowerCase() === account.toLowerCase()) {
    return null;
  }
  return v.value;
}
