"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadLeagueRoster,
  loadWeekCard,
  listScoredWeekNumbers,
  listPublishedWeekNumbers,
  loadLeagueActiveWeek,
} from "@/lib/cloud";
import { getLeague, isActuallyCommissioner } from "@/lib/league";
import {
  getCommishSetup,
  isFirstTimeCommish,
} from "@/lib/commish-onboarding";
import { weekTitle } from "@/lib/dates";
import {
  COACH_KEYS,
  isCoachOpen,
} from "@/lib/coaching";

/**
 * Soft host companion on Home after contextual coaching has finished
 * invite + card (or those flags are already complete).
 * No multi-step walkthrough — scoring tip only.
 */
export default function CommishSetupBanner() {
  const [showScoreTip, setShowScoreTip] = useState(false);
  const [weekLabel, setWeekLabel] = useState("this week");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isActuallyCommissioner()) {
        setShowScoreTip(false);
        return;
      }
      const league = getLeague();
      if (!league?.id) {
        setShowScoreTip(false);
        return;
      }
      try {
        const scoredWeeks = await listScoredWeekNumbers();
        if (
          !isFirstTimeCommish({
            leagueId: league.id,
            scoredWeekCount: scoredWeeks.length,
          })
        ) {
          if (!cancelled) setShowScoreTip(false);
          return;
        }

        // While contextual coaching still owns invite/build/publish — stay quiet
        const o = { leagueId: league.id };
        if (
          isCoachOpen(COACH_KEYS.COMMISH_INVITE_MEMBERS, o) ||
          isCoachOpen(COACH_KEYS.COMMISH_BUILD_FIRST_CARD, o) ||
          isCoachOpen(COACH_KEYS.COMMISH_PUBLISH_FIRST_CARD, o)
        ) {
          // Only suppress if those keys are still *eligible* (open + world needs them)
          const [roster, week, published] = await Promise.all([
            loadLeagueRoster(),
            loadLeagueActiveWeek(),
            listPublishedWeekNumbers(),
          ]);
          const card = await loadWeekCard(week);
          const humans = roster.filter((m) => !m.isBot).length;
          const invited =
            humans >= 2 || !!getCommishSetup(league.id).inviteCopied;
          const hasCard = !!(card?.games?.length) || published.length > 0;
          if (!invited || !hasCard) {
            if (!cancelled) setShowScoreTip(false);
            return;
          }
        }

        const [week, published] = await Promise.all([
          loadLeagueActiveWeek(),
          listPublishedWeekNumbers(),
        ]);
        const card = await loadWeekCard(week);
        const hasCard = !!(card?.games?.length) || published.length > 0;
        if (!hasCard || scoredWeeks.length > 0) {
          if (!cancelled) setShowScoreTip(false);
          return;
        }
        if (cancelled) return;
        setWeekLabel(weekTitle(week));
        setShowScoreTip(true);
      } catch {
        if (!cancelled) setShowScoreTip(false);
      }
    }
    const t = window.setTimeout(() => void load(), 800);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  if (!showScoreTip) return null;

  return (
    <section
      id="host-start-here"
      className="mb-5 rounded-2xl border border-primary/35 bg-card/95 p-4 sm:p-5"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary mb-1">
        Host tip
      </p>
      <h2 className="text-base font-bold text-foreground mb-1">
        You already ran a week.
      </h2>
      <p className="text-sm text-muted mb-3 leading-relaxed">
        When {weekLabel} games finish, come back and score — standings move,
        paper drops. Not before kickoffs die.
      </p>
      <Link
        href="/commissioner?tab=results"
        className="flex items-center justify-center w-full py-3 min-h-[48px] rounded-xl border border-primary/50 text-primary text-sm font-bold touch-manipulation"
      >
        Score when games are done →
      </Link>
    </section>
  );
}
