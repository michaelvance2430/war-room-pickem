/**
 * Last-seen / last logged-in presence.
 * Client bumps profiles.last_seen_at (throttled) when someone opens the app.
 */

import { createClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";

const LOCAL_TOUCH_KEY = "warroom-last-seen-touch-v1";
/** Don't write more often than this (ms) */
const TOUCH_THROTTLE_MS = 3 * 60 * 1000; // 3 minutes

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Bump last_seen_at for the signed-in user.
 * Safe to call often — throttled per device.
 */
export async function touchLastSeen(): Promise<void> {
  const session = getSession();
  if (!session?.playerId) return;

  const now = Date.now();
  if (canUse()) {
    try {
      const raw = localStorage.getItem(LOCAL_TOUCH_KEY);
      if (raw) {
        const prev = parseInt(raw, 10);
        if (!Number.isNaN(prev) && now - prev < TOUCH_THROTTLE_MS) return;
      }
      localStorage.setItem(LOCAL_TOUCH_KEY, String(now));
    } catch {
      /* ignore */
    }
  }

  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id || session.playerId;
    const iso = new Date(now).toISOString();
    await supabase
      .from("profiles")
      .update({ last_seen_at: iso })
      .eq("id", uid);
  } catch {
    /* column missing / offline — ignore */
  }
}

/** Human relative time for last seen. */
export function formatLastSeen(
  iso: string | null | undefined,
  nowMs = Date.now()
): string {
  if (!iso) return "Never seen";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Never seen";
  const diff = Math.max(0, nowMs - t);

  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 14) return `${day}d ago`;
  if (day < 60) return `${Math.floor(day / 7)}w ago`;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "A while ago";
  }
}

/** True if seen within window (default 24h). */
export function isRecentlyActive(
  iso: string | null | undefined,
  withinMs = 24 * 60 * 60 * 1000,
  nowMs = Date.now()
): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t <= withinMs;
}
