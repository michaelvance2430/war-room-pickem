"use client";

/**
 * Ops-only Home strip: one primary path to score the week.
 * Does not run scoring on Home — lands on Results with the host primary.
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
  const [week, setWeek] = useState(1);
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
        const card = await loadWeekCard(w);
        if (cancelled) return;
        if (!card?.games?.length) {
          setShow(false);
          return;
        }
        const scoredList =
          scored.length > 0 ? scored : await listScoredWeekNumbers();
        if (scoredList.includes(w)) {
          setShow(false);
          return;
        }
        setWeek(w);
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
    <div className="mb-5 rounded-xl border-2 border-primary/45 bg-primary/10 px-4 py-3.5 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
        Host · score when games are done
      </p>
      <p className="text-xs text-muted leading-relaxed">
        {label} has a card and isn&apos;t scored yet. One job when the games
        finish:
      </p>
      <Link
        href="/commissioner?tab=results"
        className="flex items-center justify-center w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black text-sm font-extrabold hover:opacity-90"
      >
        Score {label} →
      </Link>
    </div>
  );
}
