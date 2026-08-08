"use client";

/**
 * Account dual-allegiance outer frame.
 *
 * Styling is owned ONLY by the explicit sportId prop ("cfb" | "nfl").
 * Never reads activeLeagueId, session sport, sport tab, or local stamps.
 * CSS tokens: .sport-allegiance-frame[data-sport=…] mirrors
 * :root (CFB green) and html[data-sport=nfl] / NFL_SUNDAY_COLORS.
 */

import type { ReactNode } from "react";
import BrandMark from "@/components/BrandMark";
import NflBrandMark from "@/components/NflBrandMark";
import { getSportPack } from "@/lib/sports/registry";
import type { CanonicalTeam } from "@/lib/teams/cfb-catalog";

export type AllegianceSportId = "cfb" | "nfl" | "cbb";

type Props = {
  /** Explicit sport — sole source of frame styling */
  sportId: AllegianceSportId;
  title: string;
  blurb: string;
  children: ReactNode;
  className?: string;
};

/**
 * Outer sport frame + label chip. Children hold team crest / actions.
 */
export default function SportAllegianceCard({
  sportId,
  title,
  blurb,
  children,
  className = "",
}: Props) {
  const pack = getSportPack(sportId);
  const label = pack.shortLabel || (sportId === "nfl" ? "NFL" : "CFB");

  return (
    <section
      data-sport={sportId}
      className={`sport-allegiance-frame p-4 sm:p-5 space-y-3 min-w-0 ${className}`}
      aria-labelledby={`allegiance-${sportId}-title`}
    >
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className="sport-allegiance-chip">
          {sportId === "nfl" ? (
            <NflBrandMark size={14} className="rounded shrink-0" />
          ) : (
            <BrandMark size={14} variant="force" className="rounded shrink-0" />
          )}
          {label}
        </span>
      </div>

      <div className="min-w-0">
        <h2
          id={`allegiance-${sportId}-title`}
          className="font-semibold text-foreground mb-0.5"
        >
          {title}
        </h2>
        <p className="text-xs text-muted leading-relaxed">{blurb}</p>
      </div>

      <div className="space-y-3 min-w-0">{children}</div>
    </section>
  );
}

/** Inner team strip — team colors for crest only; does not recolor the sport frame. */
export function AllegianceTeamStrip({
  team,
  emptyTitle,
  emptyBlurb,
}: {
  team: CanonicalTeam | null;
  emptyTitle: string;
  emptyBlurb?: string;
}) {
  if (!team) {
    return (
      <div className="rounded-xl border border-border bg-background/40 px-3 py-3 min-w-0">
        <p className="font-bold text-foreground">{emptyTitle}</p>
        {emptyBlurb ? (
          <p className="text-xs text-muted mt-0.5">{emptyBlurb}</p>
        ) : null}
      </div>
    );
  }

  const primary = team.colors.primary || "var(--primary)";
  const secondary = team.colors.secondary || primary;
  const monogram = team.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-xl border border-border bg-background/50 px-3 py-3 flex items-center gap-3 min-w-0">
      <span
        className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-[11px] font-black tracking-tight border-2 text-white"
        style={{
          background: `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`,
          borderColor: primary,
          textShadow: "0 1px 2px rgba(0,0,0,0.55)",
        }}
        aria-hidden
      >
        {monogram}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-foreground truncate">{team.name}</p>
        {team.conference ? (
          <p className="text-xs text-muted truncate">{team.conference}</p>
        ) : null}
      </div>
      {/* Accent bar — team identity without washing the outer sport frame */}
      <span
        className="w-1.5 self-stretch min-h-[2.5rem] rounded-full shrink-0 opacity-90"
        style={{ backgroundColor: primary }}
        aria-hidden
      />
    </div>
  );
}

/** Shared class for primary actions inside a sport frame */
export const ALLEGIANCE_CTA_CLASS =
  "sport-allegiance-cta w-full sm:w-auto flex-1 py-3 min-h-[48px] rounded-xl bg-primary text-sm font-bold disabled:opacity-40 touch-manipulation";

export const ALLEGIANCE_SECONDARY_CLASS =
  "w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl border border-border text-sm font-semibold text-foreground touch-manipulation";
