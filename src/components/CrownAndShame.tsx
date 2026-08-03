"use client";

/**
 * Crown & Wall of Shame — only after an official scored week.
 * Constitution: never invent achievement.
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

      if (playersProp && playersProp.length > 0) {
        setData(weekCrownAndShame(playersProp));
        return;
      }
      try {
        const players = await loadLeaguePlayers();
        if (!cancelled) setData(weekCrownAndShame(players));
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

  // Zero scored weeks — honest empty (not fake crown names)
  if (!seasonStarted || !data) {
    return (
      <div
        className={`rounded-xl border-2 border-dashed border-border bg-card/60 p-5 ${className}`}
      >
        <h2 className="font-semibold text-sm mb-1">Crown &amp; Wall of Shame</h2>
        <p className="text-sm text-muted leading-relaxed">
          <span className="text-primary font-semibold">No Crown Yet.</span>{" "}
          Week 1 decides who gets to wear it.{" "}
          <span className="text-toilet font-semibold">Wall of Shame</span> is
          still under construction — somebody will earn it soon enough.
        </p>
        <p className="text-xs text-muted mt-2 leading-relaxed">
          War Room never awards what hasn&apos;t been earned.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <Link href="/picks" className="text-primary font-semibold hover:underline">
            Make picks →
          </Link>
          <Link href="/standings" className="text-primary hover:underline">
            Standings →
          </Link>
        </div>
      </div>
    );
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
            Archive →
          </Link>
          <Link href="/standings" className="text-primary hover:underline">
            Standings →
          </Link>
        </span>
      </div>
    </div>
  );
}
