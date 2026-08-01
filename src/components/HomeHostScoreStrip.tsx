"use client";

/**
 * Ops-only Home strip: one primary path to score the week.
 * Hidden while first-hour CommishSetupBanner still owns the host spine
 * (invite → card → first score) so we never double the green score button.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadWeekCard,
  listScoredWeekNumbers,
} from "@/lib/cloud";
import { getLeague, isOps } from "@/lib/league";
import { resolvePlayerActiveWeek } from "@/lib/active-week";
import { weekTitle } from "@/lib/dates";
import { isViewAsPlayer } from "@/lib/view-as-player";
import { isFirstTimeCommish } from "@/lib/commish-onboarding";

export default function HomeHostScoreStrip() {
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isOps() || isViewAsPlayer()) {
        setShow(false);
        return;
      }
      try {
        const { week: w, scored } = await resolvePlayerActiveWeek();
        const scoredList =
          scored.length > 0 ? scored : await listScoredWeekNumbers();

        // First-hour setup banner already has the score CTA — don’t stack
        const league = getLeague();
        if (
          league?.id &&
          isFirstTimeCommish({
            leagueId: league.id,
            scoredWeekCount: scoredList.length,
          })
        ) {
          if (!cancelled) setShow(false);
          return;
        }

        const card = await loadWeekCard(w);
        if (cancelled) return;
        if (!card?.games?.length) {
          setShow(false);
          return;
        }
        if (scoredList.includes(w)) {
          setShow(false);
          return;
        }
        setLabel(weekTitle(w));
        setShow(true);
      } catch {
        if (!cancelled) setShow(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <div className="mb-5 rounded-xl border border-primary/35 bg-primary/8 px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Host · your one job
          </p>
          <p className="text-sm text-foreground font-semibold leading-snug mt-0.5">
            {label} is still ungraded — score it when the games die
          </p>
        </div>
        <Link
          href="/commissioner?tab=results"
          className="shrink-0 flex items-center justify-center px-5 py-3 min-h-[48px] rounded-xl bg-primary text-black text-sm font-extrabold hover:opacity-90 touch-manipulation"
        >
          Score {label} →
        </Link>
      </div>
    </div>
  );
}
