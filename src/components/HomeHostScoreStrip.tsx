"use client";

/**
 * Ops-only Home strip: score CTA for later weeks.
 *
 * HARD RULE — never stack with CommishSetupBanner step 3:
 * If the league has zero scored weeks yet, this strip stays hidden.
 * First score belongs entirely to the first-hour host spine.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadWeekCard,
  listScoredWeekNumbers,
} from "@/lib/cloud";
import { isOps } from "@/lib/league";
import { resolvePlayerActiveWeek } from "@/lib/active-week";
import { weekTitle } from "@/lib/dates";
import { isViewAsPlayer } from "@/lib/view-as-player";

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

        // First score of the season → CommishSetupBanner owns that CTA alone
        if (scoredList.length === 0) {
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
            Commish · your one job
          </p>
          <p className="text-sm text-foreground font-semibold leading-snug mt-0.5">
            {label} is still ungraded — score it when the games die
          </p>
        </div>
        <Link
          href="/week-ops?step=score"
          className="shrink-0 flex items-center justify-center px-5 py-3 min-h-[48px] rounded-xl bg-primary text-black text-sm font-extrabold hover:opacity-90 touch-manipulation"
        >
          Score {label} →
        </Link>
      </div>
    </div>
  );
}
