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

/**
 * Home: first-time Commish season setup track.
 */
export default function CommishSetupBanner() {
  const [show, setShow] = useState(false);
  const [humans, setHumans] = useState(0);
  const [hasCard, setHasCard] = useState(false);
  const [scored, setScored] = useState(0);
  const [code, setCode] = useState("");
  const [leagueName, setLeagueName] = useState("War Room");
  const [leagueId, setLeagueId] = useState("");

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
        if (!isFirstTimeCommish({ leagueId: league.id, scoredWeekCount: scoredWeeks.length })) {
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

  const steps = [
    {
      id: "invite",
      label: "Share the code",
      why: "No code = empty room.",
      done: humans >= 2 || getCommishSetup(leagueId).inviteCopied,
    },
    {
      id: "card",
      label: "Publish first card",
      why: "No card = they can’t pick.",
      done: hasCard,
    },
    {
      id: "score",
      label: "Score a week",
      why: "No score = standings look broken.",
      done: scored > 0,
    },
  ];
  const doneN = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <section className="mb-6 rounded-2xl border-2 border-primary/45 bg-primary/10 p-4 sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">
        First-time commissioner
      </p>
      <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">
        Set up your room · {doneN}/{steps.length}
      </h2>
      <p className="text-xs text-muted mb-4 leading-relaxed">
        You&apos;re the host. Three jobs to become a real Commish — then the
        full toolbox opens up.
      </p>

      <ol className="space-y-2 mb-4">
        {steps.map((s) => (
          <li
            key={s.id}
            className={`rounded-lg border px-3 py-2 flex gap-2 ${
              s.done
                ? "border-primary/30 bg-primary/10"
                : s.id === next?.id
                  ? "border-primary bg-background"
                  : "border-border bg-background/40"
            }`}
          >
            <span className="font-bold text-primary w-5 shrink-0">
              {s.done ? "✓" : s.id === next?.id ? "→" : "○"}
            </span>
            <div>
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="text-[11px] text-muted">Why: {s.why}</p>
            </div>
          </li>
        ))}
      </ol>

      {code && (
        <div className="mb-3">
          <InviteFriends
            leagueName={leagueName}
            code={code}
            leagueId={leagueId}
            compact
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!hasCard && (
          <Link
            href="/commissioner?tab=card&first=1"
            className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold"
          >
            Build first card →
          </Link>
        )}
        {hasCard && scored === 0 && (
          <Link
            href="/commissioner?tab=results"
            className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold"
          >
            Score the week →
          </Link>
        )}
        <Link
          href="/commissioner"
          className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-foreground"
        >
          Full Commish tools
        </Link>
      </div>
    </section>
  );
}
