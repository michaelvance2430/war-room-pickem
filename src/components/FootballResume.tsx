"use client";

/**
 * Permanent record — demoted under identity / hardware / season plot.
 * Legacy + OVR live behind a fold. Hardware years stay visible.
 */

import Link from "next/link";
import type { FootballResume as Resume } from "@/lib/player-history";
import { LEGACY_SCORE_VERSION } from "@/lib/player-history";

type Props = {
  resume: Resume;
  playerId: string;
  /** Start collapsed so the profile leads with story, not spreadsheet */
  defaultOpen?: boolean;
};

export default function FootballResume({
  resume,
  playerId,
  defaultOpen = false,
}: Props) {
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
            Hardware years and titles stick. Spreadsheet lives under the fold.
          </p>
        </div>
        <Link
          href={`/museum?player=${encodeURIComponent(playerId)}`}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Museum →
        </Link>
      </div>

      {/* Titles — identity, keep up top */}
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

      {/* Hardware counts with years when we have them */}
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

      {/* Spreadsheet fold — legacy, OVR, raw counters */}
      <details
        className="rounded-xl border border-border/80 bg-background/40"
        open={defaultOpen}
      >
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-muted hover:text-foreground list-none flex items-center justify-between gap-2">
          <span>Deep stats &amp; legacy math</span>
          <span className="text-[10px] uppercase tracking-wide opacity-70">
            optional
          </span>
        </summary>
        <div className="px-3 pb-3 space-y-3 border-t border-border/60 pt-3">
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
            These numbers feed standings and cheevos. They live here so the top
            of the profile can stay about who you are in the room.
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
