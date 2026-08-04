"use client";

/**
 * Sticky room plaque — league name LOUD + League Hub (NFL/CFB) + Share.
 * Multi-league users scan for the room name, not "War Room".
 *
 * Share League is for every authenticated member — not host-only.
 * (First-week chrome uses this component; HomeSportHeader is the later masthead.)
 */

import { useState } from "react";
import Link from "next/link";
import { setViewAsPlayer } from "@/lib/view-as-player";
import HomeSportSwitcher from "@/components/HomeSportSwitcher";
import {
  markInviteCopied,
  shareLeagueInvite,
} from "@/lib/commish-onboarding";

type Props = {
  leagueName: string | null;
  sportId: string;
  isCommish: boolean;
  /** True host (not view-as-player) — show player-view escape */
  actuallyCommish?: boolean;
  leagueCode?: string | null;
  /** Any member can share; not host-only. Default true when code present. */
  canShare?: boolean;
};

export default function HomeRoomContext({
  leagueName,
  sportId,
  isCommish,
  actuallyCommish,
  leagueCode,
  canShare = true,
}: Props) {
  const name = (leagueName || "War Room").trim();
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const showShare = canShare && !!(leagueCode && leagueCode.trim());

  async function onShareLeague() {
    if (!leagueCode || shareBusy) return;
    setShareBusy(true);
    setShareNote(null);
    try {
      const result = await shareLeagueInvite({
        leagueName: name,
        code: leagueCode,
        sportId,
        flavor: "random",
      });
      if (result === "shared" || result === "copied") {
        try {
          const { getLeague } = await import("@/lib/league");
          const id = getLeague()?.id;
          if (id) markInviteCopied(id);
        } catch {
          /* ok */
        }
        setShareNote(result === "shared" ? "Shared" : "Link copied");
        window.setTimeout(() => setShareNote(null), 2200);
      } else {
        setShareNote("Couldn’t share — try again");
      }
    } catch {
      setShareNote("Couldn’t share — try again");
    }
    setShareBusy(false);
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-primary/35 bg-black/55 px-3.5 py-3.5 sm:px-4 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-[0_0_28px_rgba(34,197,94,0.08)]">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          {/* League Hub — same primary entry as HomeSportHeader */}
          <HomeSportSwitcher
            onSwitched={() => {
              window.location.assign("/");
            }}
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            Active room
          </span>
        </div>
        <p className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight break-words">
          {name}
        </p>
        <p className="text-[12px] text-muted mt-1">
          {isCommish ? (
            <span className="text-amber-200 font-semibold">
              You&apos;re hosting · share the room to invite friends
            </span>
          ) : (
            <span>
              You&apos;re a player in this room
              {showShare ? " · share to invite friends" : ""}
            </span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {showShare && (
          <button
            type="button"
            disabled={shareBusy}
            onClick={() => void onShareLeague()}
            className="min-h-[44px] px-3.5 rounded-lg border border-border text-foreground text-xs font-bold touch-manipulation disabled:opacity-50"
          >
            {shareBusy
              ? "…"
              : shareNote
                ? shareNote
                : "Share League"}
          </button>
        )}
        {actuallyCommish && isCommish && (
          <button
            type="button"
            onClick={() => {
              setViewAsPlayer(true);
              window.location.href = "/";
            }}
            className="min-h-[44px] px-3.5 rounded-lg border border-warning/40 text-warning text-xs font-bold touch-manipulation"
          >
            Player view
          </button>
        )}
        {isCommish && (
          <Link
            href="/commissioner"
            className="min-h-[44px] px-3.5 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs font-bold inline-flex items-center touch-manipulation"
          >
            League →
          </Link>
        )}
      </div>
    </div>
  );
}
