"use client";

import Link from "next/link";
import type { FootballResume as Resume } from "@/lib/player-history";
import { LEGACY_SCORE_VERSION } from "@/lib/player-history";

type Props = {
  resume: Resume;
  playerId: string;
};

export default function FootballResume({ resume, playerId }: Props) {
  return (
    <section className="rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-400/10 to-card p-5 sm:p-6 mb-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Football resume
          </p>
          <h2 className="text-lg font-bold text-foreground mt-0.5">
            Permanent record
          </h2>
          <p className="text-xs text-muted mt-1 max-w-md leading-relaxed">
            Titles stick. Season stats update live. Multi-year ATS deepens as
            seasons freeze into history.
          </p>
        </div>
        <Link
          href={`/museum?player=${encodeURIComponent(playerId)}`}
          className="text-xs font-semibold text-amber-300 hover:text-amber-200 border border-amber-400/40 rounded-lg px-3 py-2"
        >
          Open Museum →
        </Link>
      </div>

      {/* Legacy score hero */}
      <div className="rounded-xl border border-amber-400/40 bg-background/80 px-4 py-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
            Legacy score · {LEGACY_SCORE_VERSION}
          </p>
          <p className="text-4xl font-black text-amber-300 tabular-nums tracking-tight">
            {resume.legacy.total.toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
            Season card rating
          </p>
          <p className="text-3xl font-black text-foreground tabular-nums">
            {resume.overallRating}
          </p>
        </div>
      </div>

      {resume.legacy.parts.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer font-semibold text-foreground/90">
            How legacy is calculated
          </summary>
          <ul className="mt-2 space-y-1 border border-border rounded-lg bg-background/60 px-3 py-2">
            {resume.legacy.parts.map((part) => (
              <li key={part.key} className="flex justify-between gap-3">
                <span>{part.label}</span>
                <span className="font-mono text-amber-200/90">
                  +{part.points.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Titles */}
      {resume.titles.length > 0 && (
        <div>
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

      {/* Resume grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat label="Member since" value={resume.memberSinceLabel} />
        <Stat
          label="Championships"
          value={String(resume.championships)}
          accent={resume.championships > 0}
        />
        <Stat label="Toilet titles" value={String(resume.toiletTitles)} />
        <Stat label="Village Nerd" value={String(resume.crystalBalls)} />
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
        {resume.dynastyYears.length > 0 && (
          <Stat
            label="Dynasty years"
            value={resume.dynastyYears.join(" · ")}
            accent
          />
        )}
      </div>

      {resume.rival && (
        <div className="rounded-lg border border-border bg-background/70 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
            Season rival
          </p>
          <p className="text-sm font-semibold mt-0.5">
            <Link
              href={`/profile/${resume.rival.userId}`}
              className="text-primary hover:underline"
            >
              {resume.rival.name}
            </Link>
          </p>
          <p className="text-xs text-muted mt-0.5">{resume.rival.blurb}</p>
        </div>
      )}

      {/* Mini player card */}
      <div className="rounded-xl border-2 border-amber-400/50 bg-background p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
            Season card
          </p>
          <p className="text-lg font-black">{resume.name}</p>
          <p className="text-xs text-muted">
            {resume.seasonAtsPct != null
              ? `${resume.seasonAtsPct}% ATS`
              : "No ATS yet"}
            {resume.championships > 0 ? " · Champion hardware" : ""}
          </p>
        </div>
        <div className="text-center shrink-0">
          <p className="text-[10px] text-muted uppercase">OVR</p>
          <p className="text-3xl font-black text-amber-300 tabular-nums">
            {resume.overallRating}
          </p>
        </div>
      </div>
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
