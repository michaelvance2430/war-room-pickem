"use client";

/**
 * This season's plot — rival, streak, last card, room rank.
 * Trust: never invent / imply history before a real scored week.
 */

import Link from "next/link";
import type { SeasonPlot } from "@/lib/profile-signature";

type Rival = {
  name: string;
  userId: string;
  blurb: string;
} | null;

type Props = {
  plot: SeasonPlot | null;
  rival: Rival;
  sportId?: string | null;
  /** Official scored week exists for this league (authoritative). */
  storyStarted: boolean;
  isSelf?: boolean;
};

export default function ProfileSeasonPlot({
  plot,
  rival,
  sportId,
  storyStarted,
  isSelf,
}: Props) {
  const nfl = sportId === "nfl";

  if (!storyStarted || !plot) {
    // Profile owns identity/history — never route empty season → /picks.
    // Home owns the next mission (allegiance, Crystal Ball, picks, wait).
    return (
      <section className="rounded-2xl border-2 border-dashed border-primary/30 bg-gradient-to-b from-primary/10 to-card p-5 sm:p-6 mb-6 space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            This season
          </p>
          <h2 className="text-lg font-bold text-foreground mt-0.5">
            Your story starts here
          </h2>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            This section comes alive after your first scored week.
          </p>
        </div>

        <ul className="text-xs text-foreground/85 space-y-1.5 list-disc pl-5 leading-relaxed">
          <li>Current streak</li>
          <li>Best week</li>
          <li>ATS record</li>
          <li>Room rank</li>
          <li>Rivalries</li>
          <li>Season highs</li>
        </ul>

        <p className="text-sm font-semibold text-foreground leading-relaxed">
          No scored weeks yet. Your next assignment is waiting on Home.
        </p>

        {isSelf && (
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center px-4 rounded-xl bg-primary text-black text-sm font-extrabold"
          >
            Back to Home
          </Link>
        )}
      </section>
    );
  }

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
          Rivalries show up once the room has real scored cards to argue about.
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
