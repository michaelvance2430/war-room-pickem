import { createClient } from "@/lib/supabase/client";

const BUCKET = "avatars";
const MAX_EDGE = 512;
const MAX_BYTES = 2 * 1024 * 1024;

export type Profile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** Private MM-DD; hard-locked once set (cloud). */
  birthdayMmdd?: string | null;
  birthdayLockedAt?: string | null;
};

export const EVENT_PROFILE_UPDATED = "warroom-profile-updated";

function notifyProfileUpdated(detail?: {
  displayName?: string;
  avatarUrl?: string | null;
}) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_PROFILE_UPDATED, { detail: detail || {} })
    );
  } catch {
    /* ignore */
  }
}

/** Patch local session name so Nav / home update immediately. */
function patchSessionPlayerName(displayName: string) {
  if (typeof window === "undefined" || typeof localStorage === "undefined")
    return;
  try {
    const raw = localStorage.getItem("warroom-session");
    if (!raw) return;
    const session = JSON.parse(raw) as { playerName?: string };
    session.playerName = displayName;
    localStorage.setItem("warroom-session", JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

/**
 * Change display name (what the room sees on the board, Gazette, etc.).
 * Updates profiles + auth metadata + local session.
 */
export async function updateMyDisplayName(
  raw: string
): Promise<{ ok: boolean; displayName?: string; error?: string }> {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Enter a name." };
  if (name.length < 2) {
    return { ok: false, error: "Name needs at least 2 characters." };
  }
  if (name.length > 40) {
    return { ok: false, error: "Keep it under 40 characters." };
  }

  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return { ok: false, error: "Not signed in — log in and try again." };
    }
    const userId = auth.user.id;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name })
        .eq("id", userId);
      if (error) {
        const msg = error.message || "";
        if (/row-level security|violates|policy/i.test(msg)) {
          return {
            ok: false,
            error:
              "Could not update name (permissions). Ask Mike if this keeps happening.",
          };
        }
        return { ok: false, error: msg || "Could not save name." };
      }
    } else {
      const { error } = await supabase.from("profiles").insert({
        id: userId,
        display_name: name,
      });
      if (error) {
        return {
          ok: false,
          error: error.message || "Could not create profile name.",
        };
      }
    }

    // Keep signup metadata in sync (session restore fallback)
    try {
      await supabase.auth.updateUser({
        data: { display_name: name },
      });
    } catch {
      /* non-fatal */
    }

    // Session playerName is active-league resolved name, not always account name
    try {
      const { getSession } = await import("@/lib/league");
      const session = getSession();
      if (session?.leagueId) {
        const { data: mem } = await supabase
          .from("memberships")
          .select("display_name_override")
          .eq("league_id", session.leagueId)
          .eq("user_id", userId)
          .maybeSingle();
        const { resolveLeagueDisplayName } = await import("./display-name");
        const resolved = resolveLeagueDisplayName({
          membershipOverride: (mem as { display_name_override?: string | null } | null)
            ?.display_name_override,
          profileDisplayName: name,
        });
        patchSessionPlayerName(resolved);
      } else {
        patchSessionPlayerName(name);
      }
    } catch {
      patchSessionPlayerName(name);
    }
    notifyProfileUpdated({ displayName: name });
    return { ok: true, displayName: name };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save name",
    };
  }
}

function normalizeBirthdayMmdd(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!/^\d{2}-\d{2}$/.test(s)) return null;
  const [mm, dd] = s.split("-").map(Number);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return s;
}

/** Load current user's profile row. */
export async function loadMyProfile(): Promise<Profile | null> {
  const supabase = createClient();
  // Prefer session id first — auth.getUser() hangs on flaky mobile (Nav freezes)
  let userId: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSession } = require("./league") as typeof import("./league");
    userId = getSession()?.playerId || null;
  } catch {
    userId = null;
  }
  if (!userId) {
    const { data: auth } = await supabase.auth.getSession();
    userId = auth.session?.user?.id || null;
  }
  if (!userId) return null;

  // Prefer full select; fall back if birthday columns not migrated yet
  let data: Record<string, unknown> | null = null;
  {
    const full = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, birthday_mmdd, birthday_locked_at")
      .eq("id", userId)
      .maybeSingle();
    if (
      full.error &&
      /birthday|column|schema cache/i.test(full.error.message || "")
    ) {
      const basic = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      data = (basic.data as Record<string, unknown> | null) || null;
    } else if (!full.error) {
      data = (full.data as Record<string, unknown> | null) || null;
    }
  }

  if (!data) {
    return {
      id: userId,
      displayName: "Player",
      avatarUrl: null,
      birthdayMmdd: null,
      birthdayLockedAt: null,
    };
  }

  return {
    id: data.id as string,
    displayName: (data.display_name as string) || "Player",
    avatarUrl: (data.avatar_url as string) || null,
    birthdayMmdd: normalizeBirthdayMmdd(data.birthday_mmdd),
    birthdayLockedAt: (data.birthday_locked_at as string) || null,
  };
}

/**
 * One-time hard lock for private MM-DD birthday.
 * Rejects if already set (no self-serve edit / no clear).
 */
export async function lockMyBirthdayOnce(
  raw: string
): Promise<{
  ok: boolean;
  birthdayMmdd?: string;
  error?: string;
  locked?: boolean;
}> {
  const mmdd = normalizeBirthdayMmdd(raw);
  if (!mmdd) {
    return { ok: false, error: "Use MM-DD (e.g. 07-31)." };
  }

  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return { ok: false, error: "Not signed in — log in and try again." };
    }
    const userId = auth.user.id;

    const existing = await loadMyProfile();
    if (existing?.birthdayMmdd) {
      return {
        ok: false,
        locked: true,
        birthdayMmdd: existing.birthdayMmdd,
        error:
          "Birthday is locked. Wrong date? Message War Room support — no self-serve edits.",
      };
    }

    const lockedAt = new Date().toISOString();
    const { data: row, error } = await supabase
      .from("profiles")
      .update({
        birthday_mmdd: mmdd,
        birthday_locked_at: lockedAt,
      })
      .eq("id", userId)
      .is("birthday_mmdd", null)
      .select("birthday_mmdd, birthday_locked_at")
      .maybeSingle();

    if (error) {
      const msg = error.message || "";
      if (/hard-locked|P0001|birthday is hard-locked/i.test(msg)) {
        return {
          ok: false,
          locked: true,
          error:
            "Birthday is locked. Wrong date? Message War Room support — no self-serve edits.",
        };
      }
      if (/birthday|column|schema cache/i.test(msg)) {
        return {
          ok: false,
          error:
            "Birthday cloud column not live yet. Ask Mike to run profiles-birthday-hard-lock.sql.",
        };
      }
      if (/row-level security|violates|policy/i.test(msg)) {
        return {
          ok: false,
          error: "Could not save birthday (permissions). Ask Mike.",
        };
      }
      return { ok: false, error: msg || "Could not save birthday." };
    }

    // Race: another tab locked first
    if (!row?.birthday_mmdd) {
      const again = await loadMyProfile();
      if (again?.birthdayMmdd) {
        return {
          ok: false,
          locked: true,
          birthdayMmdd: again.birthdayMmdd,
          error:
            "Birthday is locked. Wrong date? Message War Room support — no self-serve edits.",
        };
      }
      // Profile row may be missing birthday columns still null — try upsert path
      const { error: upErr } = await supabase.from("profiles").upsert(
        {
          id: userId,
          display_name:
            existing?.displayName ||
            (auth.user.user_metadata?.display_name as string) ||
            "Player",
          birthday_mmdd: mmdd,
          birthday_locked_at: lockedAt,
        },
        { onConflict: "id" }
      );
      if (upErr) {
        return {
          ok: false,
          error: upErr.message || "Could not save birthday.",
        };
      }
    }

    // Mirror into local egg state so Gazette day-of works offline
    try {
      const { setPlayerBirthday } = await import("@/lib/easter-eggs");
      setPlayerBirthday(userId, mmdd);
    } catch {
      /* ok */
    }

    return { ok: true, birthdayMmdd: mmdd };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save birthday",
    };
  }
}

/**
 * Pull cloud birthday into local egg state after login.
 * Cloud is source of truth once locked — never re-prompt if set.
 * If only localStorage has a birthday (legacy), one-shot migrate into cloud lock.
 */
export async function hydrateBirthdayFromCloud(
  playerId?: string | null
): Promise<string | null> {
  try {
    const profile = await loadMyProfile();
    const cloud = profile?.birthdayMmdd || null;
    const uid = playerId || profile?.id;
    if (uid && cloud) {
      const { setPlayerBirthday } = await import("@/lib/easter-eggs");
      setPlayerBirthday(uid, cloud);
      return cloud;
    }
    // Legacy: was only in localStorage — lock it to cloud so login never re-asks
    if (uid) {
      const { getPlayerBirthday, setPlayerBirthday } = await import(
        "@/lib/easter-eggs"
      );
      const local = getPlayerBirthday(uid);
      if (local) {
        const locked = await lockMyBirthdayOnce(local);
        if (locked.ok && locked.birthdayMmdd) {
          setPlayerBirthday(uid, locked.birthdayMmdd);
          return locked.birthdayMmdd;
        }
        // SQL not applied yet — keep local so Account still shows the date
        return local;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Resize image in browser → JPEG blob under size limit. */
export async function prepareAvatarFile(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") && file.type !== "") {
    throw new Error("Please choose an image file (JPG, PNG, or WebP).");
  }
  // iPhone HEIC often fails in canvas — ask for a normal photo
  if (/heic|heif/i.test(file.type) || /\.heic$/i.test(file.name)) {
    throw new Error(
      "HEIC photos aren't supported. In iPhone Photos, share as JPEG, or take a screenshot and upload that."
    );
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image is too large (max 8 MB before resize).");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "Could not read that image. Try a JPG or PNG (not HEIC/Live Photo)."
    );
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let quality = 0.88;
  let blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );

  while (blob && blob.size > MAX_BYTES && quality > 0.45) {
    quality -= 0.1;
    blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
  }

  if (!blob) throw new Error("Could not process image");
  if (blob.size > MAX_BYTES) {
    throw new Error("Image is still too large after compression.");
  }
  return blob;
}

/**
 * Upload avatar for the signed-in user and save public URL on profiles.
 * Path: avatars/{userId}/avatar.jpg
 * Works for every authenticated player (not just commissioner).
 */
export async function uploadMyAvatar(
  file: File
): Promise<{ ok: boolean; avatarUrl?: string; error?: string }> {
  try {
    const supabase = createClient();

    // Prefer a fresh session so storage JWT is valid for non-commissioners too
    const { data: refreshed, error: refreshErr } =
      await supabase.auth.refreshSession();
    let user = refreshed.session?.user ?? null;
    if (!user) {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr || !auth.user) {
        return {
          ok: false,
          error: "Not signed in — log out and log back in, then try again.",
        };
      }
      user = auth.user;
    }
    if (refreshErr && !user) {
      return {
        ok: false,
        error: "Session expired — log out and log back in.",
      };
    }

    const userId = user.id;
    const blob = await prepareAvatarFile(file);
    // Path must start with auth.uid() for storage RLS
    const path = `${userId}/avatar.jpg`;

    // Ensure profile row exists before we attach avatar_url
    const displayName =
      (user.user_metadata?.display_name as string) ||
      user.email?.split("@")[0] ||
      "Player";

    const { error: ensureErr } = await supabase.from("profiles").upsert(
      {
        id: userId,
        display_name: displayName,
      },
      { onConflict: "id" }
    );
    if (ensureErr) {
      const msg = ensureErr.message || "";
      if (/row-level security|violates|policy/i.test(msg)) {
        return {
          ok: false,
          error:
            "Profile access blocked. Commissioner: run supabase/avatars-everyone.sql in Supabase SQL Editor.",
        };
      }
      // Non-fatal if row already exists and upsert is picky — continue
    }

    // Remove first so we always do a clean INSERT (avoids upsert policy quirks)
    await supabase.storage.from(BUCKET).remove([path]);

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "3600",
    });

    if (upErr) {
      const msg = upErr.message || "";
      if (/row-level security|violates|policy|unauthorized|403|jwt/i.test(msg)) {
        return {
          ok: false,
          error:
            "Photo upload blocked for your account. Commissioner must run supabase/avatars-everyone.sql in Supabase (SQL Editor), then everyone can re-try.",
        };
      }
      if (/bucket|not found/i.test(msg)) {
        return {
          ok: false,
          error:
            "Avatars bucket missing. Run supabase/avatars-everyone.sql in Supabase.",
        };
      }
      if (/mime|type|not supported/i.test(msg)) {
        return {
          ok: false,
          error: "Image type not allowed. Use JPG or PNG.",
        };
      }
      return { ok: false, error: `Upload failed: ${msg}` };
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;

    // Save URL on profile (update preferred; insert if missing)
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", userId);

      if (updateErr) {
        const msg = updateErr.message || "";
        if (/row-level security|violates|policy/i.test(msg)) {
          return {
            ok: false,
            error:
              "Profile update blocked. Run supabase/avatars-everyone.sql (profiles policies).",
          };
        }
        if (/avatar_url|column/i.test(msg)) {
          return {
            ok: false,
            error: "avatar_url column missing. Run supabase/avatars-everyone.sql.",
          };
        }
        return { ok: false, error: `Profile save failed: ${msg}` };
      }
    } else {
      const { error: insertErr } = await supabase.from("profiles").insert({
        id: userId,
        display_name: displayName,
        avatar_url: avatarUrl,
      });

      if (insertErr) {
        const msg = insertErr.message || "";
        if (/row-level security|violates|policy/i.test(msg)) {
          return {
            ok: false,
            error:
              "Profile insert blocked. Run supabase/avatars-everyone.sql.",
          };
        }
        return { ok: false, error: `Profile create failed: ${msg}` };
      }
    }

    try {
      const { invalidateRosterCache } = await import("./cloud");
      invalidateRosterCache();
    } catch {
      /* the saved cloud profile remains authoritative */
    }
    notifyProfileUpdated({ avatarUrl });
    return { ok: true, avatarUrl };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Upload failed",
    };
  }
}

export async function removeMyAvatar(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Not signed in" };

  const path = `${auth.user.id}/avatar.jpg`;
  await supabase.storage.from(BUCKET).remove([path]);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", auth.user.id);

  if (error) return { ok: false, error: error.message };
  try {
    const { invalidateRosterCache } = await import("./cloud");
    invalidateRosterCache();
  } catch {
    /* the saved cloud profile remains authoritative */
  }
  notifyProfileUpdated({ avatarUrl: null });
  return { ok: true };
}

/** Initials for placeholder avatar. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
