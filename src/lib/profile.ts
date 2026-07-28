import { createClient } from "@/lib/supabase/client";

const BUCKET = "avatars";
const MAX_EDGE = 512;
const MAX_BYTES = 2 * 1024 * 1024;

export type Profile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

/** Load current user's profile row. */
export async function loadMyProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !data) {
    const meta = auth.user.user_metadata?.display_name as string | undefined;
    return {
      id: auth.user.id,
      displayName: meta || auth.user.email?.split("@")[0] || "Player",
      avatarUrl: null,
    };
  }

  return {
    id: data.id as string,
    displayName: (data.display_name as string) || "Player",
    avatarUrl: (data.avatar_url as string) || null,
  };
}

/** Resize image in browser → JPEG blob under size limit. */
export async function prepareAvatarFile(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPG, PNG, or WebP).");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image is too large (max 8 MB before resize).");
  }

  const bitmap = await createImageBitmap(file);
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
 */
export async function uploadMyAvatar(
  file: File
): Promise<{ ok: boolean; avatarUrl?: string; error?: string }> {
  try {
    const supabase = createClient();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth.user) {
      return { ok: false, error: "Not signed in — log out and log back in." };
    }

    const userId = auth.user.id;
    const blob = await prepareAvatarFile(file);
    const path = `${userId}/avatar.jpg`;

    // --- Step 1: storage upload ---
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        upsert: true,
        contentType: "image/jpeg",
        cacheControl: "3600",
      });

    if (upErr) {
      const msg = upErr.message || "";
      if (/row-level security|violates|policy/i.test(msg)) {
        return {
          ok: false,
          error:
            "Storage blocked (RLS). In Supabase run the FULL file supabase/avatars-rls-fix.sql, then try again.",
        };
      }
      if (/bucket|not found/i.test(msg)) {
        return {
          ok: false,
          error:
            "Avatars bucket missing. Run supabase/avatars-rls-fix.sql in Supabase.",
        };
      }
      return { ok: false, error: `Upload failed: ${msg}` };
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const displayName =
      (auth.user.user_metadata?.display_name as string) ||
      auth.user.email?.split("@")[0] ||
      "Player";

    // --- Step 2: save URL on profile (update, then insert if needed) ---
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
              "Profile update blocked (RLS). Run supabase/avatars-rls-fix.sql (profiles policies).",
          };
        }
        if (/avatar_url|column/i.test(msg)) {
          return {
            ok: false,
            error: "avatar_url column missing. Run supabase/avatars-rls-fix.sql.",
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
              "Profile insert blocked (RLS). Run supabase/avatars-rls-fix.sql (Users insert own profile).",
          };
        }
        return { ok: false, error: `Profile create failed: ${msg}` };
      }
    }

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
  return { ok: true };
}

/** Initials for placeholder avatar. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
