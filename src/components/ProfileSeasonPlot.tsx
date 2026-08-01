"use client";

/**
 * This season's plot — rival, streak, last card, room rank.
 * Intimate. Not a second standings grid.
 */

import Link from "next/link";
import type { SeasonPlot } from "@/lib/profile-signature";

type Rival = {
  name: string;
  userId: string;
  blurb: string;
} | null;

type Props = {
  plot: SeasonPlot;
  rival: Rival;
  sportId?: string | null;
};

export default function ProfileSeasonPlot({ plot, rival, sportId }: Props) {
  const nfl = sportId === "nfl";

  return (
    <section className="rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/10 to-card p-5 sm:p-6 mb-6 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          This season
        </p>
        <h2 className="text-lg font-bold text-foreground mt-0.5">
          The plot so far
        </h2>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          {nfl
            ? "How the Sundays are going — not every number on the ledger."
            : "How the Saturdays are going — not every number on the ledger."}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <PlotChip
          label="Streak"
          value={plot.streakLabel}
          accent={plot.streakHot}
          danger={plot.streakCold}
        />
        <PlotChip
          label="Room rank"
          value={
            plot.roomRank != null && plot.roomSize > 0
              ? `${plot.roomRank} / ${plot.roomSize}`
              : "—"
          }
        />
        <PlotChip label="ATS" value={plot.atsLabel} />
        <PlotChip
          label="Perfect"
          value={String(plot.perfectWeeks)}
          accent={plot.perfectWeeks > 0}
        />
      </div>

      <div className="rounded-xl border border-border bg-background/70 px-3 py-3 space-y-1">
        <p className="text-sm text-foreground font-medium">
          {plot.lastWeekLabel}
        </p>
        {plot.bestWeekPts != null && (
          <p className="text-xs text-muted">
            Career-high week on the board:{" "}
            <span className="text-foreground font-semibold">
              {plot.bestWeekPts} pts
            </span>
            {plot.lastWeekPts != null &&
            plot.bestWeekPts === plot.lastWeekPts
              ? " · that was last card"
              : ""}
          </p>
        )}
      </div>

      {rival && (
        <div className="rounded-xl border border-border bg-background/70 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
            Season rival
          </p>
          <p className="text-sm font-semibold mt-0.5">
            <Link
              href={`/profile/${rival.userId}`}
              className="text-primary hover:underline"
            >
              {rival.name}
            </Link>
          </p>
          <p className="text-xs text-muted mt-0.5 leading-relaxed">
            {rival.blurb}
          </p>
        </div>
      )}

      {!rival && (
        <p className="text-xs text-muted italic">
          No rival yet — need another body on the board with a card in.
        </p>
      )}
    </section>
  );
}

function PlotChip({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg bg-background/80 border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={`text-sm font-bold tabular-nums truncate ${
          danger
            ? "text-danger"
            : accent
              ? "text-primary"
              : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
