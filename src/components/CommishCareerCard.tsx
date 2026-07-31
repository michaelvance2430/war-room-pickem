"use client";

import { useEffect, useState } from "react";
import {
  COMMISH_LADDER,
  TOP_COMMISH_TITLE,
  ladderRungForSeasons,
  nextLadderRung,
  syncCommishLadderGrants,
} from "@/lib/commish-ladder";
import {
  getBestCommishWeeks,
  getQualifyingCommishSeasons,
  IRON_COMMISH_TARGET,
  syncCommissionerTenureFromSession,
} from "@/lib/commish-tenure";

type Props = {
  userId: string;
  /** Compact for profile sidebar */
  compact?: boolean;
};

/**
 * Profile: how many 14/18 commissioner seasons — ladder up to
 * Assistant to the Regional Manager.
 */
export default function CommishCareerCard({ userId, compact }: Props) {
  const [seasons, setSeasons] = useState(0);
  const [bestWeeks, setBestWeeks] = useState(0);
  const [title, setTitle] = useState<string | null>(null);
  const [nextLabel, setNextLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    try {
      syncCommissionerTenureFromSession();
      syncCommishLadderGrants(userId);
    } catch {
      /* ignore */
    }
    const s = getQualifyingCommishSeasons(userId);
    const b = getBestCommishWeeks(userId);
    setSeasons(s);
    setBestWeeks(b);
    const rung = ladderRungForSeasons(s);
    setTitle(rung?.title || null);
    const next = nextLadderRung(s);
    setNextLabel(
      next
        ? `${next.title} at ${next.seasons} season${next.seasons === 1 ? "" : "s"}`
        : TOP_COMMISH_TITLE
    );
  }, [userId]);

  if (!userId) return null;

  return (
    <div
      className={`rounded-xl border border-border bg-card ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
        Commissioner career
      </p>
      <p className="text-sm font-bold text-foreground">
        {seasons} qualifying season{seasons === 1 ? "" : "s"}
        <span className="text-muted font-normal text-xs ml-1">
          (14+ of 18 weeks each)
        </span>
      </p>
      {title ? (
        <p className="text-base font-extrabold text-primary mt-1">{title}</p>
      ) : (
        <p className="text-sm text-muted mt-1">
          No locked title yet
          {bestWeeks > 0
            ? ` — best run ${bestWeeks}/${IRON_COMMISH_TARGET} weeks this season`
            : ""}
        </p>
      )}
      {seasons < 10 && (
        <p className="text-xs text-muted mt-2 leading-relaxed">
          Next: {nextLabel}
        </p>
      )}
      {seasons >= 10 && (
        <p className="text-xs text-primary mt-2 leading-relaxed">
          Peak: {TOP_COMMISH_TITLE}. That&apos;s the top of the mountain.
        </p>
      )}

      {!compact && (
        <ol className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
          {COMMISH_LADDER.map((r) => {
            const earned = seasons >= r.seasons;
            return (
              <li
                key={r.badgeId}
                className={`text-xs flex items-start gap-2 ${
                  earned ? "text-foreground" : "text-muted"
                }`}
              >
                <span className="shrink-0 w-5 text-center" aria-hidden>
                  {earned ? r.icon : "·"}
                </span>
                <span>
                  <span className={earned ? "font-semibold" : ""}>
                    {r.seasons}× — {r.title}
                  </span>
                  {earned ? " ✓" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
