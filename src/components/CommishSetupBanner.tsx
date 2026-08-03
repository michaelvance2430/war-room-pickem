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
import InviteFriends from "@/components/InviteFriends";
import { weekTitle } from "@/lib/dates";
import {
  isOnboardingActive,
  readOnboardingState,
  ONBOARDING_EVENT,
} from "@/lib/onboarding";

/**
 * First-time host companion on Home.
 * Conversation, not a checklist. One action only. No "3 jobs."
 * Scoring stays quiet until a practice week card is live.
 * Hidden while the commissioner conversation engine is active (coach owns the path).
 */
export default function CommishSetupBanner() {
  const [show, setShow] = useState(false);
  const [journeyActive, setJourneyActive] = useState(false);
  const [journeyStepId, setJourneyStepId] = useState<string | null>(null);
  const [humans, setHumans] = useState(0);
  const [hasCard, setHasCard] = useState(false);
  const [code, setCode] = useState("");
  const [leagueName, setLeagueName] = useState("War Room");
  const [leagueId, setLeagueId] = useState("");
  const [weekLabel, setWeekLabel] = useState("this week");

  useEffect(() => {
    function syncJourney() {
      try {
        const s = readOnboardingState();
        const active =
          isOnboardingActive() && s.journeyId === "commissioner";
        setJourneyActive(active);
        setJourneyStepId(active ? s.stepId : null);
      } catch {
        setJourneyActive(false);
        setJourneyStepId(null);
      }
    }
    syncJourney();
    window.addEventListener(ONBOARDING_EVENT, syncJourney);
    return () => window.removeEventListener(ONBOARDING_EVENT, syncJourney);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isActuallyCommissioner()) {
        setShow(false);
        return;
      }
      const league = getLeague();
      if (!league?.id) {
        setShow(false);
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
          if (!cancelled) setShow(false);
          return;
        }
        const [roster, week, published] = await Promise.all([
          loadLeagueRoster(),
          loadLeagueActiveWeek(),
          listPublishedWeekNumbers(),
        ]);
        const card = await loadWeekCard(week);
        if (cancelled) return;
        setLeagueId(league.id);
        setCode(league.code || "");
        setLeagueName(league.name || "War Room");
        setHumans(roster.filter((m) => !m.isBot).length);
        setHasCard(!!(card?.games?.length) || published.length > 0);
        setWeekLabel(weekTitle(week));
        setShow(true);
      } catch {
        if (!cancelled) setShow(false);
      }
    }
    const t = window.setTimeout(() => void load(), 700);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  if (!show) return null;

  // While conversation engine runs: only surface the ONE current action UI
  // (never a second manual / checklist). Welcome + finish stay coach-only.
  if (journeyActive) {
    if (journeyStepId !== "invite" && journeyStepId !== "build_week") {
      return null;
    }
  }

  const invited = humans >= 2 || getCommishSetup(leagueId).inviteCopied;
  // One action only — never a three-step syllabus
  type HostBeat = "invite" | "card" | "soft_score";
  let beat: HostBeat = !invited ? "invite" : !hasCard ? "card" : "soft_score";
  if (journeyActive && journeyStepId === "invite") beat = "invite";
  if (journeyActive && journeyStepId === "build_week") beat = "card";
  // Soft score only after practice week exists AND journey is done
  if (journeyActive && beat === "soft_score") return null;

  return (
    <section
      id="host-start-here"
      className="mb-5 rounded-2xl border-2 border-primary/50 bg-card/95 p-4 sm:p-5 shadow-lg"
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-black">
          Start here
        </span>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
          Host · I&apos;m with you
        </p>
      </div>

      {beat === "invite" && (
        <>
          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">
            Get one friend in the door.
          </h2>
          <p className="text-sm text-muted mb-3 leading-relaxed">
            One share. Drop it in the group chat. That&apos;s the whole job
            right now — not a checklist.
          </p>
          {code ? (
            <InviteFriends
              leagueName={leagueName}
              code={code}
              leagueId={leagueId}
              compact
              startHere
            />
          ) : null}
        </>
      )}

      {beat === "card" && (
        <>
          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">
            Build one practice week.
          </h2>
          <p className="text-sm text-muted mb-3 leading-relaxed">
            {humans} {humans === 1 ? "person" : "people"} in the room. Pull
            Odds, pick 5, Publish. One card — then the room is alive.
          </p>
          <Link
            href="/commissioner?tab=card&first=1"
            className="flex items-center justify-center w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold touch-manipulation active:scale-[0.99]"
          >
            Start here · Build {weekLabel} →
          </Link>
        </>
      )}

      {beat === "soft_score" && (
        <>
          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">
            You already ran a week.
          </h2>
          <p className="text-sm text-muted mb-3 leading-relaxed">
            When the games die, come back and score — standings move, paper
            drops. Not now. Only when kickoffs are done.
          </p>
          <Link
            href="/commissioner?tab=results"
            className="flex items-center justify-center w-full py-3.5 min-h-[48px] rounded-xl border border-primary/50 text-primary text-sm font-bold touch-manipulation"
          >
            I&apos;ll score when games are done →
          </Link>
        </>
      )}
    </section>
  );
}
