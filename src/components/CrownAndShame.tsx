"use client";

/**
 * Crown & Wall of Shame — only after an official scored week.
 * Constitution: never invent achievement. Never show placeholder points.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import { loadLeaguePlayers } from "@/lib/cloud";
import { weekCrownAndShame, type CrownShame } from "@/lib/fun-board";
import { hasOfficialScoredWeek } from "@/lib/season-scored";
import type { Player } from "@/lib/types";

type Props = {
  className?: string;
  /** When parent already loaded standings, skip a second cloud round-trip for players. */
  players?: Player[];
};

function EmptyCrownShame({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border-2 border-dashed border-border bg-card/60 overflow-hidden ${className}`}
    >
      <div className="px-4 py-2.5 border-b border-border/80 bg-card/80">
        <h2 className="font-semibold text-sm">Crown &amp; Wall of Shame</h2>
        <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
          Season begins after the first scored week. Nobody has earned glory —
          or embarrassment — yet.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="p-4 sm:border-r border-border bg-primary/5">
          <div className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 font-bold">
            👑 This week&apos;s crown
          </div>
          <div className="text-lg font-bold text-foreground">No Crown Yet</div>
          <div className="text-sm text-muted font-semibold mt-0.5">—</div>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            Week 1 decides the first Crown. Check back after games are scored.
          </p>
        </div>
        <div className="p-4 bg-toilet/5 border-t sm:border-t-0 border-border">
          <div className="text-[10px] uppercase tracking-[0.15em] text-toilet mb-2 font-bold">
            🧻 Wall of shame
          </div>
          <div className="text-lg font-bold text-foreground">Nobody… yet</div>
          <div className="text-sm text-muted font-semibold mt-0.5">—</div>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            Someone will be roasted after the first scored week. Don&apos;t
            volunteer early.
          </p>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-border bg-card/50 text-[11px] text-muted flex flex-wrap justify-between gap-2">
        <span>War Room never awards what hasn&apos;t been earned.</span>
        <Link href="/picks" className="text-primary font-semibold hover:underline">
          Make picks →
        </Link>
      </div>
    </div>
  );
}

export default function CrownAndShame({
  className = "",
  players: playersProp,
}: Props) {
  const [data, setData] = useState<CrownShame | null | undefined>(undefined);
  const [seasonStarted, setSeasonStarted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const scored = await hasOfficialScoredWeek();
      if (cancelled) return;
      setSeasonStarted(scored);
      if (!scored) {
        setData(null);
        return;
      }

      try {
        const players =
          playersProp && playersProp.length > 0
            ? playersProp
            : await loadLeaguePlayers("CrownAndShame.load");
        if (cancelled) return;
        // Double gate: cloud scored weeks + real weeksPlayed on memberships
        const crown = weekCrownAndShame(players);
        setData(crown);
      } catch {
        if (!cancelled) setData(null);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [playersProp]);

  if (data === undefined || seasonStarted === null) {
    return (
      <div
        className={`rounded-xl border border-border bg-card/80 p-4 text-sm text-muted ${className}`}
      >
        Loading the crown jewels…
      </div>
    );
  }

  // Zero official history — entertaining empty, never fake points
  if (!seasonStarted || !data) {
    return <EmptyCrownShame className={className} />;
  }

  return (
    <div
      className={`rounded-xl border border-border overflow-hidden ${className}`}
    >
      <div className="px-4 py-2.5 border-b border-border bg-card flex items-center justify-between gap-2">
        <h2 className="font-semibold text-sm">Crown &amp; Wall of Shame</h2>
        <span className="text-[10px] uppercase tracking-wider text-muted">
          {data.weekLabel}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="p-4 sm:border-r border-border bg-primary/5">
          <div className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 font-bold">
            🐐 This week&apos;s crown
          </div>
          <div className="text-lg font-bold text-foreground truncate">
            <PlayerLink
              id={data.crown.player.id}
              name={data.crown.player.name}
            />
          </div>
          <div className="text-sm text-primary font-semibold mt-0.5">
            {data.crown.pts} pts
          </div>
          <p className="text-xs text-muted mt-2">
            {data.samePerson
              ? "Only name on the board — absolute monarchy."
              : "Biggest haul on the last scored card. Tip the cap."}
          </p>
        </div>
        <div className="p-4 bg-toilet/5 border-t sm:border-t-0 border-border">
          <div className="text-[10px] uppercase tracking-[0.15em] text-toilet mb-2 font-bold">
            🛍️ Wall of shame
          </div>
          <div className="text-lg font-bold text-foreground truncate">
            <PlayerLink
              id={data.shame.player.id}
              name={data.shame.player.name}
            />
          </div>
          <div className="text-sm text-toilet font-semibold mt-0.5">
            {data.shame.pts} pts
          </div>
          <p className="text-xs text-muted mt-2">
            {data.samePerson
              ? "Also you. Range is a skill."
              : "Lowest total last card. Brown paper bag energy. Bounce back."}
          </p>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-border bg-card/50 text-[11px] text-muted flex flex-wrap justify-between gap-2">
        <span>Latest scored week · older covers in the archive</span>
        <span className="flex gap-3">
          <Link href="/gazette" className="text-primary hover:underline">
            Gazette →
          </Link>
          <Link href="/board" className="text-primary hover:underline">
            Board →
          </Link>
        </span>
      </div>
    </div>
  );
}
