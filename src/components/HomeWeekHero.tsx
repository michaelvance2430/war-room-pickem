"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadLeagueActiveWeek,
  loadWeekCard,
  loadMyPicks,
  loadLeagueRoster,
  listScoredWeekNumbers,
} from "@/lib/cloud";
import { getSession, isOps } from "@/lib/league";
import {
  formatCardLockDeadline,
  isCardLockDeadlinePassed,
  weekTitle,
} from "@/lib/dates";

type HeroState = {
  week: number;
  hasCard: boolean;
  gameCount: number;
  lockLabel: string | null;
  frozen: boolean;
  iLocked: boolean;
  rosterCount: number;
  scoredWeeks: number;
  isCommish: boolean;
  isOps: boolean;
  leagueCode: string | null;
};

/**
 * Home hero: one job at a time.
 * Player → make picks / waiting / locked.
 * Commish → publish / score / invite.
 * Flavor stays below; this is the runway.
 */
export default function HomeWeekHero() {
  const [state, setState] = useState<HeroState | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const session = getSession();
        const week = await loadLeagueActiveWeek();
        const card = await loadWeekCard(week);
        const games = card?.games || [];
        const hasCard = games.length > 0;
        const now = Date.now();
        const frozen = hasCard && isCardLockDeadlinePassed(games, now);
        const mine = hasCard ? await loadMyPicks(week) : null;
        const iLocked = !!(mine?.lockedAt && Object.keys(mine.picks || {}).length);
        const roster = await loadLeagueRoster();
        const humans = roster.filter((m) => !m.isBot);
        let scored: number[] = [];
        try {
          scored = await listScoredWeekNumbers();
        } catch {
          scored = [];
        }
        if (cancelled) return;
        setState({
          week,
          hasCard,
          gameCount: games.length,
          lockLabel: hasCard ? formatCardLockDeadline(games) : null,
          frozen,
          iLocked,
          rosterCount: humans.length,
          scoredWeeks: scored.length,
          isCommish: !!session?.isCommissioner,
          isOps: isOps(),
          leagueCode: null,
        });
      } catch {
        if (!cancelled) setState(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return (
      <div className="rounded-2xl border border-border/60 bg-black/40 px-5 py-6 mb-8 animate-pulse">
        <div className="h-4 w-32 bg-border/40 rounded mb-3" />
        <div className="h-7 w-64 bg-border/30 rounded mb-2" />
        <div className="h-4 w-48 bg-border/20 rounded" />
      </div>
    );
  }

  const weekLabel = weekTitle(state.week);

  // —— Player / everyone: primary job ——
  let eyebrow = "This week";
  let title = weekLabel;
  let body = "";
  let primaryHref = "/picks";
  let primaryLabel = "Open My Picks";
  let primaryClass =
    "bg-primary text-black hover:opacity-90";
  let secondaryHref: string | null = "/standings";
  let secondaryLabel = "Standings";

  if (!state.hasCard) {
    eyebrow = "Season not live yet";
    title = "Waiting on the card";
    body = state.isOps
      ? `${weekLabel} has no published games. Share the invite, then build & publish the card so people can lock.`
      : `No picks yet for ${weekLabel}. Your commissioner hasn’t published this week’s card — hang tight.`;
    primaryHref = state.isOps ? "/commissioner" : "/locker-room";
    primaryLabel = state.isOps ? "Publish this week’s card" : "Talk shit in the Locker";
    secondaryHref = state.isOps ? "/locker-room" : "/standings";
    secondaryLabel = state.isOps ? "Locker Room" : "See the board";
  } else if (state.iLocked) {
    eyebrow = state.frozen ? "Card locked" : "You’re in";
    title = state.frozen
      ? `${weekLabel} is frozen`
      : `You’re locked for ${weekLabel}`;
    body = state.frozen
      ? "First kickoff hit. Sit tight for scores — then check the Gazette."
      : `You’re locked before first kickoff${state.lockLabel ? ` (${state.lockLabel})` : ""}. Change nothing if you want First & Final.`;
    primaryHref = "/standings";
    primaryLabel = "Standings";
    primaryClass =
      "border border-primary/50 text-primary hover:bg-primary/10 bg-transparent";
    secondaryHref = "/gazette";
    secondaryLabel = "Gazette";
  } else if (state.frozen) {
    eyebrow = "Too late";
    title = `${weekLabel} already kicked off`;
    body =
      "First kickoff hit and you never locked — you score 0 this week. Don’t ghost next week.";
    primaryHref = "/standings";
    primaryLabel = "Standings";
    primaryClass =
      "border border-danger/50 text-danger hover:bg-danger/10 bg-transparent";
    secondaryHref = "/locker-room";
    secondaryLabel = "Locker Room";
  } else {
    eyebrow = "Do this now";
    title = `Make your ${weekLabel} picks`;
    body = `Lock all ${state.gameCount || 5} games + Best Bet + prop before first kickoff${
      state.lockLabel ? ` (${state.lockLabel})` : ""
    }. After that the whole card freezes.`;
    primaryHref = "/picks";
    primaryLabel = "Make my picks";
    primaryClass = "bg-primary text-black hover:opacity-90 shadow-[0_0_24px_rgba(34,197,94,0.25)]";
    secondaryHref = "/rules";
    secondaryLabel = "Quick rules";
  }

  return (
    <section className="mb-8">
      <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-black/50 to-black/70 p-5 sm:p-6 shadow-[0_0_50px_rgba(34,197,94,0.12)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-2">
          {eyebrow}
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          {title}
        </h2>
        <p className="text-sm text-muted max-w-xl leading-relaxed mb-4">
          {body}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <Link
            href={primaryHref}
            className={`inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold transition ${primaryClass}`}
          >
            {primaryLabel}
          </Link>
          {secondaryHref && (
            <Link
              href={secondaryHref}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-muted hover:text-foreground hover:bg-card/50 transition"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>

        {/* League pulse — honesty, not clutter */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted border-t border-border/50 pt-3">
          <span>
            <span className="text-foreground/80 font-medium">{state.rosterCount}</span>{" "}
            in the room
          </span>
          <span className="text-border">·</span>
          <span>
            Active:{" "}
            <span className="text-foreground/80 font-medium">{weekLabel}</span>
          </span>
          <span className="text-border">·</span>
          <span>
            {state.scoredWeeks === 0
              ? "No weeks scored yet (preseason vibes)"
              : `${state.scoredWeeks} week${state.scoredWeeks === 1 ? "" : "s"} scored`}
          </span>
        </div>

        {/* Commish-only secondary strip — keep ops path without drowning players */}
        {state.isOps && (
          <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-muted">
              <span className="text-primary font-semibold">
                {state.isCommish ? "Commissioner" : "Deputy"}
              </span>
              {" — "}
              {state.hasCard
                ? "Card is live. After games: score the week, then drop Gazette energy."
                : "Your job: invite friends → build card → publish. Use the checklist in Commish tools."}
            </p>
            <Link
              href="/commissioner"
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
            >
              Run this week →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
