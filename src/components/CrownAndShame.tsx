"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLeaguePlayers } from "@/lib/cloud";
import { weekCrownAndShame, type CrownShame } from "@/lib/fun-board";

type Props = {
  className?: string;
};

export default function CrownAndShame({ className = "" }: Props) {
  const [data, setData] = useState<CrownShame | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadLeaguePlayers()
      .then((players) => {
        if (!cancelled) setData(weekCrownAndShame(players));
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (data === undefined) {
    return (
      <div
        className={`rounded-xl border border-border bg-card/80 p-4 text-sm text-muted ${className}`}
      >
        Loading the crown jewels…
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className={`rounded-xl border border-border bg-card/80 p-5 ${className}`}
      >
        <h2 className="font-semibold text-sm mb-1">Crown &amp; Wall of Shame</h2>
        <p className="text-sm text-muted">
          After the first week is scored, the week&apos;s{" "}
          <span className="text-primary">🐐 high scorer</span> and{" "}
          <span className="text-toilet">🛍️ low scorer</span> land here.
        </p>
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
            {data.crown.player.name}
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
            {data.shame.player.name}
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
      <div className="px-4 py-2 border-t border-border bg-card/50 text-[11px] text-muted flex justify-between gap-2">
        <span>Resets every time a week is scored</span>
        <Link href="/standings" className="text-primary hover:underline">
          Standings →
        </Link>
      </div>
    </div>
  );
}
