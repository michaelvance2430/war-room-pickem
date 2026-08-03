"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getJustJoinedBadge,
  subscribeJoinBadges,
} from "@/lib/join-badge-store";
import {
  getEquippedTitleLabel,
  subscribeEquippedTitles,
} from "@/lib/equipped-title-store";
import { isChaosFlamesActive } from "@/lib/chaos-mode";
import { getLeague } from "@/lib/league";
import { loadLeagueActiveWeek } from "@/lib/cloud";

/**
 * Name → /profile/[id].
 * Equipped title + just-joined pill + Chaos flames when dad went Chaos this week.
 */
export default function PlayerLink({
  id,
  name,
  className = "",
  showYou = false,
  hideJoinBadge = false,
  hideEquippedTitle = false,
  /** Force chaos flames (e.g. board slip already knows) */
  chaosFlames,
}: {
  id: string | null | undefined;
  name: string | null | undefined;
  className?: string;
  showYou?: boolean;
  hideJoinBadge?: boolean;
  hideEquippedTitle?: boolean;
  chaosFlames?: boolean;
}) {
  const label = name?.trim() || "TBD";
  const [liveWeek, setLiveWeek] = useState(0);
  const [chaosTick, setChaosTick] = useState(0);

  // Load week once on mount for Chaos flames. Do NOT re-fetch on every
  // warroom-route-change — that × roster size caused current_week request storms.
  // loadLeagueActiveWeek is single-flight + TTL cached in cloud.ts.
  useEffect(() => {
    let cancelled = false;
    void loadLeagueActiveWeek().then((w) => {
      if (!cancelled) setLiveWeek(w);
    });
    function onChaos() {
      setChaosTick((t) => t + 1);
    }
    window.addEventListener("warroom-chaos-active", onChaos);
    return () => {
      cancelled = true;
      window.removeEventListener("warroom-chaos-active", onChaos);
    };
  }, []);

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

  void chaosTick;
  const flames =
    chaosFlames === true ||
    (!!id && isChaosFlamesActive(id, liveWeek, getLeague()?.id));

  if (!id) {
    return <span className={`text-muted ${className}`.trim()}>{label}</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1 max-w-full">
      <Link
        href={`/profile/${id}`}
        title={
          flames
            ? `${label} went CHAOS this week — pure random card, doubles if it hits`
            : equippedTitle
              ? `${equippedTitle} ${label} — view profile`
              : `View ${label}'s profile`
        }
        aria-label={
          flames
            ? `${label} Chaos Mode this week — view profile`
            : equippedTitle
              ? `View ${equippedTitle} ${label}'s profile`
              : `View ${label}'s profile`
        }
        className={[
          "inline-flex items-center gap-1 max-w-full min-w-0",
          "font-semibold text-primary",
          "underline decoration-primary decoration-2 underline-offset-[3px]",
          "active:opacity-80 touch-manipulation",
          "py-0.5 -my-0.5",
          flames
            ? "chaos-flames rounded-md px-1.5 py-0.5 text-orange-200 decoration-orange-400"
            : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {flames && (
          <span className="shrink-0 text-sm leading-none" aria-hidden>
            🔥
          </span>
        )}
        {equippedTitle && (
          <span
            className="shrink-0 text-[10px] sm:text-[11px] font-black uppercase tracking-wide text-amber-300 no-underline"
            title="Equipped title from Account"
          >
            {equippedTitle}
          </span>
        )}
        <span className="truncate">{label}</span>
        {flames && (
          <span
            className="shrink-0 text-[9px] font-extrabold uppercase tracking-wide text-orange-300 no-underline"
            title="Chaos Mode — robots cooked this card"
          >
            CHAOS
          </span>
        )}
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
