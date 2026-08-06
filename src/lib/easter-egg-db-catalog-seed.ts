/**
 * Approved DB catalog seed for true Easter Eggs (not passport stamps).
 * MUST match supabase/D-02-record-easter-egg-find-REVIEW-ONLY.sql seed exactly.
 * P6: parity verifier fails if this set drifts from listEasterEggDefs() or SQL.
 */
export const APPROVED_EASTER_EGG_CATALOG_IDS = [
  "egg_anniversary",
  "egg_curiosity_trophy",
  "egg_vonnaggio_gold",
  "egg_hidden_headline",
  "egg_leap_day",
  "egg_birthday",
  "egg_sibling_supremacy",
  "egg_lucky_seven",
  "egg_obsession",
  "egg_halloween",
  "egg_christmas",
  "egg_thanksgiving",
  "egg_newyear",
  "egg_three_peat",
  "egg_never_give_up",
  "egg_developer_thanks",
  "egg_impossible",
  "egg_mascot_scout",
  "egg_veterans",
  "egg_welcome_home",
] as const;

export type ApprovedEasterEggId = (typeof APPROVED_EASTER_EGG_CATALOG_IDS)[number];

export const APPROVED_EASTER_EGG_CATALOG_COUNT =
  APPROVED_EASTER_EGG_CATALOG_IDS.length;

export function isApprovedEasterEggId(id: string): boolean {
  return (APPROVED_EASTER_EGG_CATALOG_IDS as readonly string[]).includes(id);
}
