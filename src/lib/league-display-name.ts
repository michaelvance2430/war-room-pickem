/**
 * Client API for per-league display name overrides.
 * Never writes profiles.display_name.
 */

import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  normalizeOverrideForStorage,
  resolveLeagueDisplayName,
  validateDisplayNameInput,
} from "@/lib/display-name";
import { getSession } from "@/lib/league";
import { loadMyProfile } from "@/lib/profile";

export type SetLeagueDisplayNameResult =
  | { ok: true; override: string | null; resolved: string }
  | { ok: false; error: string };

/**
 * Set or clear the caller's alias in one league.
 * Pass null / blank to use account name.
 */
export async function setMyLeagueDisplayName(
  leagueId: string,
  aliasOrNull: string | null
): Promise<SetLeagueDisplayNameResult> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Not configured." };
  }
  if (!leagueId) {
    return { ok: false, error: "Missing league." };
  }

  // Eyes / Foundry local play must not write real memberships
  try {
    const eyes = await import("@/lib/creator-eyes");
    if (eyes.isEyesLocalPlayActive() || eyes.isCreatorEyesActive()) {
      return { ok: false, error: "Cannot change league name in preview mode." };
    }
  } catch {
    /* ok */
  }

  const validated = validateDisplayNameInput(aliasOrNull);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  let accountName = "Player";
  try {
    const prof = await loadMyProfile();
    accountName = prof?.displayName || "Player";
  } catch {
    /* ok */
  }

  const toStore = normalizeOverrideForStorage(validated.value, accountName);

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("set_my_league_display_name", {
      p_league_id: leagueId,
      p_alias: toStore,
    });
    if (error) {
      if (/function|does not exist|schema cache/i.test(error.message || "")) {
        return {
          ok: false,
          error:
            "League names not ready. Run supabase/membership-display-name-override.sql in Supabase.",
        };
      }
      return { ok: false, error: error.message || "Could not save league name." };
    }
    const row = (data || {}) as {
      display_name_override?: string | null;
      ok?: boolean;
    };
    const override =
      row.display_name_override === undefined
        ? toStore
        : row.display_name_override;
    const resolved = resolveLeagueDisplayName({
      membershipOverride: override,
      profileDisplayName: accountName,
    });

    // Session playerName is active-league only
    try {
      const session = getSession();
      if (session?.leagueId === leagueId && typeof window !== "undefined") {
        const raw = localStorage.getItem("warroom-session");
        if (raw) {
          const s = JSON.parse(raw) as { playerName?: string; leagueId?: string };
          if (s.leagueId === leagueId) {
            s.playerName = resolved;
            localStorage.setItem("warroom-session", JSON.stringify(s));
          }
        }
      }
    } catch {
      /* ignore */
    }

    try {
      // Drop memberships cache so Account / switchers see new alias
      const { invalidateMembershipsCache } = await import(
        "@/lib/session-restore"
      );
      invalidateMembershipsCache?.();
    } catch {
      /* optional */
    }

    try {
      window.dispatchEvent(
        new CustomEvent("warroom-league-display-name-updated", {
          detail: { leagueId, override, resolved },
        })
      );
    } catch {
      /* ignore */
    }

    return { ok: true, override, resolved };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save league name.",
    };
  }
}

/** Ensure profile row exists without overwriting display_name. */
export async function ensureProfileRowExists(
  userId: string,
  seedName?: string
): Promise<void> {
  if (!hasSupabaseConfig() || !userId) return;
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (data?.id) return;
    const name =
      (seedName || "").trim().replace(/\s+/g, " ") || "Player";
    await supabase.from("profiles").insert({
      id: userId,
      display_name: name.slice(0, 40) || "Player",
    });
  } catch {
    /* ignore — membership may still work if trigger created profile */
  }
}
