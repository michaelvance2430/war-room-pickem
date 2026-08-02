"use client";

/**
 * Founder / platform tools ONLY — never mount in league rooms, Crew foxhole,
 * or player profiles. Mike plays as a normal seat; no "Creator was here" stamp
 * in leagues he is part of.
 *
 * Uses profiles.last_seen_at when needed on Foundry / platform status.
 */

import { formatLastSeen, isRecentlyActive } from "@/lib/last-seen";
import { isAppCreator } from "@/lib/creator";

const DAY_MS = 24 * 60 * 60 * 1000;

type Props = {
  userId?: string | null;
  lastSeenAt?: string | null;
  /** Compact chip vs full banner */
  variant?: "chip" | "banner";
  className?: string;
};

export function creatorActiveInLast24h(
  userId?: string | null,
  lastSeenAt?: string | null
): boolean {
  if (!isAppCreator(userId)) return false;
  return isRecentlyActive(lastSeenAt, DAY_MS);
}

export default function CreatorLiveStamp({
  userId,
  lastSeenAt,
  variant = "chip",
  className = "",
}: Props) {
  if (!creatorActiveInLast24h(userId, lastSeenAt)) return null;

  const when = formatLastSeen(lastSeenAt);

  if (variant === "banner") {
    return (
      <div
        className={`rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-sm ${className}`}
        role="status"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
          Creator live
        </p>
        <p className="text-foreground font-semibold mt-0.5">
          The Creator was here in the last 24 hours
        </p>
        <p className="text-xs text-muted mt-0.5">Last in: {when}</p>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-primary/45 bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary ${className}`}
      title={`Creator last in: ${when}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
      </span>
      Creator · last 24h · {when}
    </span>
  );
}
