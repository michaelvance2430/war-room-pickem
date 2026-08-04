/**
 * Last-seen / last logged-in presence.
 * Client bumps profiles.last_seen_at (throttled) when a real member opens the app.
 *
 * Per-account (profiles), not per membership. Standings joins via profiles embed.
 */

import { createClient } from "@/lib/supabase/client";
import { getSession, getLeague } from "@/lib/league";
import { isAppCreator } from "@/lib/creator";

const LOCAL_TOUCH_KEY = "warroom-last-seen-touch-v1";
/**
 * Throttle between presence writes.
 * Online now = 15 min window — heartbeats every ~90s keep active viewers green
 * without spamming Supabase.
 */
const TOUCH_THROTTLE_MS = 90 * 1000; // 90 seconds

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Bump last_seen_at for the signed-in user.
 * Safe to call often — throttled per device.
 * Uses auth.uid() so RLS update succeeds.
 */
export async function touchLastSeen(): Promise<void> {
  const local = getSession();
  if (!local?.playerId) return;

  const now = Date.now();
  if (canUse()) {
    try {
      const raw = localStorage.getItem(LOCAL_TOUCH_KEY);
      if (raw) {
        const prev = parseInt(raw, 10);
        if (!Number.isNaN(prev) && now - prev < TOUCH_THROTTLE_MS) return;
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const supabase = createClient();
    // RLS: profiles update requires auth.uid() === id
    const { data: authData } = await supabase.auth.getSession();
    const uid = authData.session?.user?.id;
    if (!uid) return;

    // Guest / demo ids are not real auth users
    if (uid.startsWith("guest-") || local.playerId.startsWith("guest-")) return;

    const iso = new Date(now).toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ last_seen_at: iso })
      .eq("id", uid);

    if (error) {
      // Column missing or RLS — stay quiet in prod; debug optional
      try {
        if (
          process.env.NODE_ENV === "development" ||
          localStorage.getItem("warroom-runtime-debug") === "1"
        ) {
          console.warn("[last-seen] update failed", error.message);
        }
      } catch {
        /* ok */
      }
      return;
    }

    if (canUse()) {
      try {
        localStorage.setItem(LOCAL_TOUCH_KEY, String(now));
      } catch {
        /* ignore */
      }
    }

    // Creator check-in: stamp this room so peers can earn "Better Than Christmas"
    if (isAppCreator(uid)) {
      try {
        const lid = getLeague()?.id || local.leagueId;
        if (lid) {
          localStorage.setItem(`warroom-creator-checkin:${lid}`, "1");
        }
      } catch {
        /* ok */
      }
    }
  } catch {
    /* offline — ignore */
  }
}

/** Human relative time for last seen (compact). */
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

/**
 * League pulse under a player name — is this room alive?
 *
 * Examples:
 *  Online now
 *  Last seen today
 *  Last seen yesterday
 *  Last seen 3 days ago
 *  Last seen —
 */
export function formatLeaguePulse(
  iso: string | null | undefined,
  nowMs = Date.now()
): { label: string; online: boolean; known: boolean } {
  if (!iso) return { label: "Last seen —", online: false, known: false };
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { label: "Last seen —", online: false, known: false };
  const diff = Math.max(0, nowMs - t);
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  // ~15 min = "online now" for room pulse (not engagement score)
  if (min < 15) return { label: "Online now", online: true, known: true };
  if (min < 60) {
    return { label: `Last seen ${min} min ago`, online: false, known: true };
  }
  if (hr < 24) {
    try {
      const seenDay = new Date(iso).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
      });
      const nowDay = new Date(nowMs).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
      });
      if (seenDay === nowDay) {
        return { label: "Last seen today", online: false, known: true };
      }
    } catch {
      /* fall through */
    }
    return { label: `Last seen ${hr}h ago`, online: false, known: true };
  }
  if (day === 1) return { label: "Last seen yesterday", online: false, known: true };
  if (day < 14) {
    return {
      label: `Last seen ${day} days ago`,
      online: false,
      known: true,
    };
  }
  if (day < 60) {
    const w = Math.floor(day / 7);
    return {
      label: `Last seen ${w} week${w === 1 ? "" : "s"} ago`,
      online: false,
      known: true,
    };
  }
  try {
    const d = new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    return { label: `Last seen ${d}`, online: false, known: true };
  } catch {
    return { label: "Last seen a while ago", online: false, known: true };
  }
}

/** Green dot class when online-now for league pulse */
export function leaguePulseDotClass(online: boolean): string {
  return online ? "text-emerald-400" : "text-muted/50";
}

/** True if seen within window (default 6h = "green" tier). */
export function isRecentlyActive(
  iso: string | null | undefined,
  withinMs = 6 * 60 * 60 * 1000,
  nowMs = Date.now()
): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t <= withinMs;
}

/**
 * Last-in freshness for UI color (scan only — not a score):
 *  - online / fresh (green):  ≤ 15 min online · ≤ 6 hours still green-ish
 *  - warm (yellow):  > 6 and < 18 hours
 *  - stale (muted):    ≥ 18 hours (not red gamification — quiet)
 *  - unknown:        never seen / bad timestamp
 */
export type LastSeenTone = "fresh" | "warm" | "stale" | "unknown";

export function getLastSeenTone(
  iso: string | null | undefined,
  nowMs = Date.now()
): LastSeenTone {
  if (!iso) return "unknown";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown";
  const min = Math.max(0, nowMs - t) / (60 * 1000);
  if (min <= 15) return "fresh"; // online now band
  const hrs = min / 60;
  if (hrs <= 6) return "fresh";
  if (hrs < 18) return "warm";
  return "stale";
}

/** Tailwind classes for last-seen text (standings, board, roster, profile). */
export function lastSeenToneClass(
  iso: string | null | undefined,
  nowMs = Date.now()
): string {
  switch (getLastSeenTone(iso, nowMs)) {
    case "fresh":
      return "text-emerald-400 font-semibold";
    case "warm":
      return "text-amber-400/90 font-medium";
    case "stale":
      return "text-muted font-medium";
    default:
      return "text-muted";
  }
}
