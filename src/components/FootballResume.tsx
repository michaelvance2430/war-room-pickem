"use client";

/**
 * Permanent record — demoted under identity / hardware / season plot.
 * Deep stats & legacy math live behind a fold (discoverable, not day-1 noise).
 * Opening the fold on your own profile can earn Neighborhood Creeper.
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import type { FootballResume as Resume } from "@/lib/player-history";
import { LEGACY_SCORE_VERSION } from "@/lib/player-history";
import { getSession } from "@/lib/league";
import {
  getPermanentBadgeIds,
  grantPermanentBadgeId,
} from "@/lib/permanent-badges";
import { getBadgeDef } from "@/lib/badges";
import { bankCareerBadgeId } from "@/lib/career-cheevo";
import type { BadgeStatus } from "@/lib/types";

export const NEIGHBORHOOD_CREEPER_ID = "neighborhood_creeper";

type Props = {
  resume: Resume;
  playerId: string;
  /** Viewing your own profile — can earn Creeper + stronger CTA */
  isSelf?: boolean;
  /** Start collapsed so the profile leads with story, not spreadsheet */
  defaultOpen?: boolean;
};

export default function FootballResume({
  resume,
  playerId,
  isSelf = false,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [creeperJustEarned, setCreeperJustEarned] = useState(false);

  const tryGrantCreeper = useCallback(() => {
    if (!isSelf) return;
    const session = getSession();
    if (!session?.playerId || session.playerId !== playerId) return;
    if (getPermanentBadgeIds(playerId).includes(NEIGHBORHOOD_CREEPER_ID)) {
      return;
    }

    const granted = grantPermanentBadgeId(playerId, NEIGHBORHOOD_CREEPER_ID);
    if (!granted) return;

    try {
      bankCareerBadgeId(playerId, NEIGHBORHOOD_CREEPER_ID);
    } catch {
      /* ignore */
    }

    setCreeperJustEarned(true);
    const def = getBadgeDef(NEIGHBORHOOD_CREEPER_ID);
    if (def) {
      const status: BadgeStatus = {
        def,
        earned: true,
        earnedAt: new Date().toISOString(),
      };
      try {
        window.dispatchEvent(
          new CustomEvent("warroom-badge-force-celebrate", {
            detail: { badges: [status] },
          })
        );
      } catch {
        /* ignore */
      }
    }
  }, [isSelf, playerId]);

  function onToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const next = e.currentTarget.open;
    setOpen(next);
    if (next) tryGrantCreeper();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            Permanent record
          </p>
          <h2 className="text-lg font-bold text-foreground mt-0.5">
            Season résumé
          </h2>
          <p className="text-xs text-muted mt-1 max-w-md leading-relaxed">
            Hardware years and titles stick. The nerd fold is where legacy math
            lives — open it if you&apos;re nosy.
          </p>
        </div>
        <Link
          href={`/museum?player=${encodeURIComponent(playerId)}`}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Museum →
        </Link>
      </div>

      {resume.titles.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
            Earned titles
          </p>
          <div className="flex flex-wrap gap-2">
            {resume.titles.map((t) => (
              <span
                key={t.id}
                title={t.blurb}
                className="text-xs font-semibold px-2.5 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary"
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat
          label="Championships"
          value={
            resume.championships > 0
              ? resume.champYears.length
                ? `${resume.championships} · ${resume.champYears.join(", ")}`
                : String(resume.championships)
              : "0"
          }
          accent={resume.championships > 0}
        />
        <Stat
          label="Toilet titles"
          value={
            resume.toiletTitles > 0
              ? resume.toiletYears.length
                ? `${resume.toiletTitles} · ${resume.toiletYears.join(", ")}`
                : String(resume.toiletTitles)
              : "0"
          }
        />
        <Stat
          label="Village Nerd"
          value={
            resume.crystalBalls > 0
              ? resume.nerdYears.length
                ? `${resume.crystalBalls} · ${resume.nerdYears.join(", ")}`
                : String(resume.crystalBalls)
              : "0"
          }
        />
        <Stat label="Member since" value={resume.memberSinceLabel} />
      </div>

      {resume.dynastyYears.length > 1 && (
        <p className="text-xs text-amber-200/90 mb-3 font-medium">
          Dynasty years · {resume.dynastyYears.join(" · ")}
        </p>
      )}

      {/* Deep stats fold — brighter so people actually find it */}
      <details
        className="rounded-xl border-2 border-amber-400/45 bg-gradient-to-br from-amber-500/10 via-card to-background shadow-[0_0_24px_rgba(251,191,36,0.08)] group"
        open={open}
        onToggle={onToggle}
      >
        <summary className="cursor-pointer px-3.5 py-3 list-none flex items-center justify-between gap-3 select-none">
          <div className="min-w-0 flex items-start gap-2.5">
            <span className="text-xl shrink-0" aria-hidden>
              📊
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-100 leading-tight">
                Deep stats &amp; legacy math
              </p>
              <p className="text-[11px] text-muted mt-0.5 leading-snug">
                {open
                  ? "Legacy score, ATS, streaks, the whole spreadsheet."
                  : `Peek: legacy ${resume.legacy.total.toLocaleString()} · OVR ${resume.overallRating} · tap to open`}
              </p>
              {isSelf && !open && (
                <p className="text-[10px] text-amber-200/80 mt-1 font-medium">
                  Curious? Open the fold. There might be a title in it for you.
                </p>
              )}
            </div>
          </div>
          <span
            className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${
              open
                ? "border-amber-400/50 text-amber-200 bg-amber-500/15"
                : "border-amber-400/60 text-black bg-amber-400 animate-pulse"
            }`}
          >
            {open ? "Open" : "Tap"}
          </span>
        </summary>

        <div className="px-3.5 pb-3.5 space-y-3 border-t border-amber-400/25 pt-3">
          {creeperJustEarned && (
            <div className="rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-xs text-violet-100 leading-relaxed">
              <span className="font-bold">Neighborhood Creeper unlocked.</span>{" "}
              You opened the fold. Equip the title on Account if you want the
              room to know you were peeking.
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
                Legacy score · {LEGACY_SCORE_VERSION}
              </p>
              <p className="text-2xl font-black text-amber-300/90 tabular-nums">
                {resume.legacy.total.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
                Season card OVR
              </p>
              <p className="text-xl font-black text-foreground/80 tabular-nums">
                {resume.overallRating}
              </p>
            </div>
          </div>

          {resume.legacy.parts.length > 0 && (
            <ul className="text-[11px] text-muted space-y-1 rounded-lg border border-border px-3 py-2">
              {resume.legacy.parts.map((part) => (
                <li key={part.key} className="flex justify-between gap-3">
                  <span>{part.label}</span>
                  <span className="font-mono text-amber-200/80">
                    +{part.points.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat label="Season record" value={resume.seasonRecordLabel} />
            <Stat
              label="Season ATS"
              value={
                resume.seasonAtsPct != null ? `${resume.seasonAtsPct}%` : "—"
              }
            />
            <Stat label="Perfect weeks" value={String(resume.perfectWeeks)} />
            <Stat label="Current streak" value={resume.currentStreakLabel} />
            <Stat
              label="Achievements"
              value={`${resume.badgesEarned} / ${resume.badgesTotal || "?"}`}
            />
            <Stat
              label="Career cheevo"
              value={String(resume.careerCheevoPoints)}
            />
            <Stat
              label="Pick’em pts"
              value={String(resume.seasonPickemPoints)}
            />
          </div>
          <p className="text-[10px] text-muted leading-relaxed">
            Standings stay on Standings. This fold is for people who like the
            numbers behind the story.
          </p>
        </div>
      </details>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-background/80 border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={`text-sm font-semibold truncate ${
          accent ? "text-amber-300" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
