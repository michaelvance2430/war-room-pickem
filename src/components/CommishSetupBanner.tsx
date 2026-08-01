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

/**
 * First-time host: three obvious jobs only. Phone-first KISS.
 * 1 Share · 2 Publish · 3 Score (later)
 */
export default function CommishSetupBanner() {
  const [show, setShow] = useState(false);
  const [humans, setHumans] = useState(0);
  const [hasCard, setHasCard] = useState(false);
  const [scored, setScored] = useState(0);
  const [code, setCode] = useState("");
  const [leagueName, setLeagueName] = useState("War Room");
  const [leagueId, setLeagueId] = useState("");
  const [weekLabel, setWeekLabel] = useState("this week");

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
        setScored(scoredWeeks.length);
        setWeekLabel(weekTitle(week));
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

  const invited = humans >= 2 || getCommishSetup(leagueId).inviteCopied;
  const step: "invite" | "card" | "score" | "done" = !invited
    ? "invite"
    : !hasCard
      ? "card"
      : scored === 0
        ? "score"
        : "done";

  if (step === "done") return null;

  return (
    <section className="mb-5 rounded-2xl border-2 border-primary/50 bg-primary/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          Host · don&apos;t overthink it
        </p>
        <p className="text-[10px] font-semibold tabular-nums text-muted">
          Step {step === "invite" ? 1 : step === "card" ? 2 : 3} of 3
        </p>
      </div>
      <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">
        {step === "invite" && "Text the group chat already"}
        {step === "card" && "Give them something to pick"}
        {step === "score" && `Score ${weekLabel} when the chaos ends`}
      </h2>
      <p className="text-sm text-muted mb-3 leading-relaxed">
        {step === "invite" &&
          "Share the link. One tap. If they don’t join, that’s a them problem."}
        {step === "card" &&
          `${humans} in the room staring at nothing. Hit demo publish for ${weekLabel} — one tap, no odds API required, no excuses.`}
        {step === "score" &&
          "Card’s live. When games are done: one tap scores the room and drops the paper. That’s the whole host flex."}
      </p>

      {/* Progress dots */}
      <div className="flex gap-2 mb-4">
        {(["invite", "card", "score"] as const).map((s, i) => {
          const done =
            (s === "invite" && invited) ||
            (s === "card" && hasCard) ||
            (s === "score" && scored > 0);
          const current = step === s;
          return (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                done
                  ? "bg-primary"
                  : current
                    ? "bg-primary/50"
                    : "bg-border"
              }`}
              title={`Step ${i + 1}`}
            />
          );
        })}
      </div>

      {step === "invite" && code && (
        <InviteFriends
          leagueName={leagueName}
          code={code}
          leagueId={leagueId}
          compact
        />
      )}

      {step === "card" && (
        <Link
          href="/commissioner?tab=card&first=1"
          className="flex items-center justify-center w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold touch-manipulation active:scale-[0.99]"
        >
          Publish {weekLabel} (stop stalling) →
        </Link>
      )}

      {step === "score" && (
        <div className="flex flex-col gap-2">
          <Link
            href="/commissioner?tab=results"
            className="flex items-center justify-center w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold touch-manipulation"
          >
            Score {weekLabel} →
          </Link>
          <Link
            href="/picks"
            className="flex items-center justify-center w-full py-2.5 min-h-[44px] text-sm font-semibold text-muted hover:text-foreground touch-manipulation"
          >
            Wait — did I lock my own picks?
          </Link>
        </div>
      )}

      {step !== "score" && (
        <p className="text-[11px] text-muted mt-3 text-center">
          Fancy host toys wait until you score once. Keep it dumb for now.
        </p>
      )}
    </section>
  );
}
