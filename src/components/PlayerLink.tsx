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
import { readLeague } from "@/lib/session-read";
import { loadLeagueActiveWeek } from "@/lib/cloud";
import { wrProfile, wrProfileRoute } from "@/lib/runtime-iso";
import { startProfileNavTrace } from "@/lib/profile-nav-trace";

/** One in-flight profile navigation at a time (P0 freeze: triple click-received). */
const pendingNav = new Map<string, number>();
const NAV_GUARD_MS = 2_500;

function armProfileNavGuard(profileId: string): boolean {
  const now = Date.now();
  // Drop expired
  for (const [k, t] of pendingNav) {
    if (now - t > NAV_GUARD_MS) pendingNav.delete(k);
  }
  if (pendingNav.has(profileId)) return false;
  pendingNav.set(profileId, now);
  return true;
}

function clearProfileNavGuard(profileId: string) {
  pendingNav.delete(profileId);
}

// Clear when route actually changes away/to profile
if (typeof window !== "undefined") {
  window.addEventListener("warroom-route-change", (ev) => {
    wrProfileRoute(
      "listener:PlayerLink.pendingNavClear",
      `path=${(ev as CustomEvent)?.detail?.pathname || "?"}`
    );
    // Soft clear all after hop so next intentional click works
    window.setTimeout(() => pendingNav.clear(), 400);
  });
}

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
  const [navLocked, setNavLocked] = useState(false);

  // Load week once on mount for Chaos flames. Do NOT re-fetch on every route hop.
  useEffect(() => {
    let cancelled = false;
    void loadLeagueActiveWeek().then((w) => {
      if (!cancelled) setLiveWeek(w);
    });
    function onChaos() {
      setChaosTick((t) => t + 1);
    }
    function onRoute(ev: Event) {
      wrProfileRoute(
        "listener:PlayerLink.onRoute",
        `path=${(ev as CustomEvent)?.detail?.pathname || "?"} id=${id?.slice(0, 8) || "?"}`
      );
      setNavLocked(false);
      if (id) clearProfileNavGuard(id);
    }
    window.addEventListener("warroom-chaos-active", onChaos);
    window.addEventListener("warroom-route-change", onRoute);
    return () => {
      cancelled = true;
      window.removeEventListener("warroom-chaos-active", onChaos);
      window.removeEventListener("warroom-route-change", onRoute);
    };
  }, [id]);

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
    (!!id && isChaosFlamesActive(id, liveWeek, readLeague()?.id));

  if (!id) {
    return <span className={`text-muted ${className}`.trim()}>{label}</span>;
  }

  function onProfileClick(e: React.MouseEvent) {
    if (!id) return;
    if (navLocked || !armProfileNavGuard(id)) {
      e.preventDefault();
      e.stopPropagation();
      wrProfile("click-ignored-duplicate", undefined, id.slice(0, 8));
      return;
    }
    setNavLocked(true);
    const href = `/profile/${id}`;
    // Production black-box trace (Standings → peer profile freeze)
    startProfileNavTrace(id, "player-link");
    wrProfile("click-received", undefined, `PlayerLink→${id.slice(0, 8)}`);
    wrProfileRoute(
      "click",
      `user_id=${id} href=${href} name=${(name || "").slice(0, 24)}`
    );
    try {
      performance.mark?.("wr-profile:click");
      performance.mark?.("wr-profile-route:click");
      if (
        process.env.NODE_ENV === "development" ||
        localStorage.getItem("warroom-runtime-debug") === "1"
      ) {
        // Identity handoff proof: Standings passes user_id, not membership id
        console.log("[WR-PERF][profile] click", {
          user_id: id,
          display_name: name || null,
          href,
          self: id === readLeague()?.commissionerId ? "maybe-commish" : "peer",
        });
      }
    } catch {
      /* ok */
    }
    // Safety: unlock if navigation never completes
    window.setTimeout(() => {
      clearProfileNavGuard(id);
      setNavLocked(false);
    }, NAV_GUARD_MS);
  }

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1 max-w-full ${
        navLocked ? "pointer-events-none opacity-70" : ""
      }`}
    >
      <Link
        href={`/profile/${id}`}
        prefetch={false}
        onClick={onProfileClick}
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
            title="Equipped on Account"
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
