"use client";

/**
 * Always-on wall for last season’s hardware.
 * CFB: Kahmann · Strayer · Big Ball Ben (2025–26 Excel).
 * NFL: Maria Super Bowl (2025).
 */

import Link from "next/link";
import {
  getPriorSeasonLabel,
  PRIOR_SEASON_YEAR,
} from "@/lib/prior-season-seed";
import type { LeagueTrophy } from "@/lib/trophies";
import { TROPHY_META } from "@/lib/trophies";
import HardwareTrophyIcon from "@/components/HardwareTrophyIcon";
import PlayerLink from "@/components/PlayerLink";
import { resolveLiveTrophyHolder } from "@/lib/trophy-share";
import { getLeague } from "@/lib/league";

type RosterHit = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  isBot?: boolean;
};

export default function LastSeasonHardwareWall({
  plaques,
  rosterHits = [],
  sportId,
}: {
  /** Already merged prior-season trophies (or full trophy list) */
  plaques: LeagueTrophy[];
  rosterHits?: RosterHit[];
  sportId?: string | null;
}) {
  const sid = sportId ?? getLeague()?.sportId ?? "cfb";
  const label = getPriorSeasonLabel(sid);
  const year = PRIOR_SEASON_YEAR;
  const lastYear = plaques
    .filter((t) => t.seasonYear === year)
    .filter((t) =>
      ["championship", "toilet_bowl", "crystal_ball"].includes(t.trophyType)
    )
    .sort((a, b) => {
      const order = ["championship", "toilet_bowl", "crystal_ball"];
      return order.indexOf(a.trophyType) - order.indexOf(b.trophyType);
    });

  if (!lastYear.length) return null;

  const isNfl = sid === "nfl";

  return (
    <section
      className={`mb-8 rounded-2xl border-2 p-4 sm:p-5 ${
        isNfl
          ? "border-red-500/40 bg-gradient-to-br from-red-950/50 via-black/60 to-card"
          : "border-amber-400/45 bg-gradient-to-br from-amber-500/15 via-black/50 to-card"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <p
            className={`text-[10px] font-black uppercase tracking-[0.2em] ${
              isNfl ? "text-red-300" : "text-amber-300"
            }`}
          >
            Last season · on the wall forever
          </p>
          <h2 className="text-lg sm:text-xl font-extrabold text-foreground mt-0.5">
            {isNfl ? `${label} Super Bowl hardware` : `${label} Excel season`}
          </h2>
          <p className="text-xs text-muted mt-1 max-w-lg leading-relaxed">
            {isNfl
              ? "Defending Super Bowl champ of this room. Season reset does not take this down."
              : "Full prior campaign — Champion, Toilet Bowl, Village Nerd. Not optional. Not a sticker."}
          </p>
        </div>
        <Link
          href="/trophy-room"
          className={`text-[11px] font-bold underline shrink-0 ${
            isNfl ? "text-red-200" : "text-amber-200"
          }`}
        >
          Full Trophy Room →
        </Link>
      </div>

      <div
        className={`grid gap-3 ${
          lastYear.length >= 3
            ? "grid-cols-1 sm:grid-cols-3"
            : "grid-cols-1 sm:grid-cols-2"
        }`}
      >
        {lastYear.map((t) => {
          const meta = TROPHY_META[t.trophyType];
          const live = resolveLiveTrophyHolder(
            rosterHits,
            t.winnerUserId,
            t.winnerName
          );
          const kind =
            t.trophyType === "championship" ||
            t.trophyType === "toilet_bowl" ||
            t.trophyType === "crystal_ball"
              ? t.trophyType
              : "championship";
          return (
            <div
              key={t.id}
              className={`rounded-xl border bg-black/40 px-3.5 py-3.5 min-h-[140px] flex flex-col ${
                isNfl ? "border-red-400/30" : "border-amber-400/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <HardwareTrophyIcon
                  kind={kind}
                  sportId={sid}
                  size={48}
                  animate={kind === "championship"}
                />
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider ${
                    isNfl ? "text-red-300/80" : "text-amber-300/80"
                  }`}
                >
                  {year}
                </span>
              </div>
              <p
                className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                  meta?.accent || "text-primary"
                }`}
              >
                {meta?.title || t.trophyType}
              </p>
              <p className="text-base font-extrabold text-foreground mt-1 leading-snug">
                {live.userId ? (
                  <PlayerLink
                    id={live.userId}
                    name={live.name}
                    className="hover:text-primary"
                  />
                ) : (
                  live.name || t.winnerName
                )}
              </p>
              {t.subtitle && (
                <p className="text-[11px] text-muted mt-1 leading-snug">
                  {t.subtitle}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
