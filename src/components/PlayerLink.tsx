"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  getJustJoinedBadge,
  subscribeJoinBadges,
} from "@/lib/join-badge-store";
import {
  getEquippedTitleLabel,
  subscribeEquippedTitles,
} from "@/lib/equipped-title-store";

/**
 * Name → /profile/[id].
 * Optional equipped badge title (e.g. War Room Legend) + 24h just-joined pill.
 */
export default function PlayerLink({
  id,
  name,
  className = "",
  showYou = false,
  hideJoinBadge = false,
  hideEquippedTitle = false,
}: {
  id: string | null | undefined;
  name: string | null | undefined;
  className?: string;
  showYou?: boolean;
  hideJoinBadge?: boolean;
  hideEquippedTitle?: boolean;
}) {
  const label = name?.trim() || "TBD";

  const joinBadge = useSyncExternalStore(
    subscribeJoinBadges,
    () => (hideJoinBadge || !id ? null : getJustJoinedBadge(id)),
    () => null
  );

  const equippedTitle = useSyncExternalStore(
    subscribeEquippedTitles,
    () => (hideEquippedTitle || !id ? null : getEquippedTitleLabel(id)),
    () => null
  );

  if (!id) {
    return <span className={`text-muted ${className}`.trim()}>{label}</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1 max-w-full">
      <Link
        href={`/profile/${id}`}
        title={
          equippedTitle
            ? `${equippedTitle} ${label} — view profile`
            : `View ${label}'s profile`
        }
        aria-label={
          equippedTitle
            ? `View ${equippedTitle} ${label}'s profile`
            : `View ${label}'s profile`
        }
        className={[
          "inline-flex items-center gap-1 max-w-full min-w-0",
          "font-semibold text-primary",
          "underline decoration-primary decoration-2 underline-offset-[3px]",
          "active:opacity-80 touch-manipulation",
          "py-0.5 -my-0.5",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {equippedTitle && (
          <span
            className="shrink-0 text-[10px] sm:text-[11px] font-black uppercase tracking-wide text-amber-300 no-underline"
            title="Equipped title from Account"
          >
            {equippedTitle}
          </span>
        )}
        <span className="truncate">{label}</span>
        <span
          className="shrink-0 text-[10px] font-bold opacity-80 no-underline leading-none"
          aria-hidden
        >
          ↗
        </span>
        {showYou && (
          <span className="ml-0.5 text-xs text-primary/90 no-underline shrink-0">
            (You)
          </span>
        )}
      </Link>
      {joinBadge && (
        <span
          className="shrink-0 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-sky-400/50 bg-sky-400/15 text-sky-200 leading-none"
          title="Joined this league in the last 24 hours"
        >
          {joinBadge}
        </span>
      )}
    </span>
  );
}
