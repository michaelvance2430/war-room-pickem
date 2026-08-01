"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadWeekCard,
  loadMyPicks,
  loadLeagueRoster,
  loadLeaguePlayers,
} from "@/lib/cloud";
import { getLeague, isOps, isCommissioner, getSession } from "@/lib/league";
import {
  formatCardLockDeadline,
  isCardLockDeadlinePassed,
  weekTitle,
  weekDateRangeLabel,
} from "@/lib/dates";
import {
  resolvePlayerActiveWeek,
  weekProgressLabel,
} from "@/lib/active-week";
import { SEASON_MAX_WEEK } from "@/lib/season-calendar";
import { rankPlayersWithSwings } from "@/lib/fun-board";

type HeroState = {
  week: number;
  hasCard: boolean;
  gameCount: number;
  lockLabel: string | null;
  frozen: boolean;
  iLocked: boolean;
  rosterCount: number;
  scoredWeeks: number;
  /** Active week already scored? */
  weekScored: boolean;
  isCommish: boolean;
  isOps: boolean;
  leagueCode: string | null;
  advancedFromScored: boolean;
  /** Last scored week recap for this player */
  lastWeekRecap: {
    week: number;
    pts: number;
    rank: number;
    field: number;
  } | null;
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
        const {
          week,
          advanced,
          scored,
        } = await resolvePlayerActiveWeek({ persistIfOps: true });
        const card = await loadWeekCard(week);
        const games = card?.games || [];
        const hasCard = games.length > 0;
        const now = Date.now();
        const frozen = hasCard && isCardLockDeadlinePassed(games, now);
        const mine = hasCard ? await loadMyPicks(week) : null;
        const iLocked = !!(
          mine?.lockedAt && Object.keys(mine.picks || {}).length
        );
        const roster = await loadLeagueRoster();
        const humans = roster.filter((m) => !m.isBot);

        // Last scored week: rank + pts for "you finished #X" beat
        let lastWeekRecap: HeroState["lastWeekRecap"] = null;
        try {
          const selfId = getSession()?.playerId;
          const scoredSorted = [...scored].sort((a, b) => b - a);
          const lastScoredWeek = scoredSorted[0];
          if (selfId && lastScoredWeek != null) {
            const players = await loadLeaguePlayers();
            const ranked = rankPlayersWithSwings(
              players,
              getLeague()?.sportId
            ).filter((p) => !p.isMock);
            const me = ranked.find((p) => p.id === selfId);
            if (me && me.lastWeekPts != null && Number.isFinite(me.lastWeekPts)) {
              lastWeekRecap = {
                week: lastScoredWeek,
                pts: Number(me.lastWeekPts),
                rank: me.rank,
                field: ranked.length,
              };
            }
          }
        } catch {
          lastWeekRecap = null;
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
          weekScored: scored.includes(week),
          isCommish: isCommissioner(),
          isOps: isOps(),
          leagueCode: getLeague()?.code || null,
          advancedFromScored: advanced,
          lastWeekRecap,
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

  const sportId = getLeague()?.sportId || "cfb";
  const isNfl = sportId === "nfl";
  const weekLabel = weekTitle(state.week, sportId);
  const progress = weekProgressLabel(state.week);

  // —— Player / everyone: primary job ——
  let eyebrow = progress;
  let title = weekLabel;
  let body = "";
  let primaryHref = "/picks";
  let primaryLabel = "Open My Picks";
  let primaryClass =
    "bg-primary text-black hover:opacity-90";
  let secondaryHref: string | null = "/standings";
  let secondaryLabel = "Standings";

  if (!state.hasCard) {
    if (state.isCommish && state.scoredWeeks === 0) {
      eyebrow = "You’re the host";
      title =
        state.rosterCount < 2
          ? "Share your code — fill the room"
          : "Publish the first card";
      body =
        state.rosterCount < 2
          ? state.leagueCode
            ? `Your code is ${state.leagueCode} — text the crew, then build a card for ${weekLabel}. Demo slate is fine the first time.`
            : `Copy your invite code, text the crew, then build a card for ${weekLabel}. Demo slate is fine the first time.`
          : `${state.rosterCount} in the room. ${weekLabel} has no games yet — open Commish → First card wizard (demo → publish).`;
      primaryHref =
        state.rosterCount < 2
          ? "/commissioner?tab=settings"
          : "/commissioner?tab=card&first=1";
      primaryLabel =
        state.rosterCount < 2
          ? state.leagueCode
            ? `Invite code: ${state.leagueCode}`
            : "Get invite code"
          : "Build first card →";
      secondaryHref =
        state.rosterCount < 2
          ? "/commissioner?tab=card&first=1"
          : "/commissioner";
      secondaryLabel =
        state.rosterCount < 2 ? "Or build first card" : "Commish tools";
    } else {
      eyebrow = "You're in";
      title = state.isOps
        ? "Publish a card so people can pick"
        : "You're in — waiting on the card";
      body = state.isOps
        ? `One job: publish ${weekLabel} (demo week is fine). Then text the crew.`
        : `You're seated. Your host hasn't published ${weekLabel} yet — there's nothing to pick. Hang in the Locker, poke Standings if you want, or check back when they drop a card. First ten minutes = chill.`;
      primaryHref = state.isOps
        ? "/commissioner?tab=card&first=1"
        : "/locker-room";
      primaryLabel = state.isOps
        ? "Publish this week's card →"
        : "Hang in the Locker";
      secondaryHref = state.isOps ? "/locker-room" : "/standings";
      secondaryLabel = state.isOps ? "Locker" : "Peek standings";
    }
  } else if (state.iLocked) {
    eyebrow = state.frozen ? "Card locked" : "You’re in";
    title = state.frozen
      ? `${weekLabel} is frozen`
      : `You’re locked for ${weekLabel}`;
    body = state.frozen
      ? "First kickoff hit. Sit tight for scores — then the Sunday / Monday Gazette drops. That’s the paper the room waits for."
      : `You’re locked before first kickoff${state.lockLabel ? ` (${state.lockLabel})` : ""}. Change nothing if you want First & Final.`;
    // After freeze: paper is the appointment; board still one tap away
    primaryHref = state.frozen ? "/gazette" : "/board";
    primaryLabel = state.frozen ? "Read the paper" : "The Board";
    primaryClass = state.frozen
      ? "bg-red-700 text-white hover:bg-red-600 shadow-[0_0_24px_rgba(185,28,28,0.35)]"
      : "border border-primary/50 text-primary hover:bg-primary/10 bg-transparent";
    secondaryHref = state.frozen ? "/board" : "/locker-room";
    secondaryLabel = state.frozen ? "The Board" : "Locker";
  } else if (state.frozen) {
    eyebrow = "Too late";
    title = `${weekLabel} already kicked off`;
    body =
      "First kickoff hit and you never locked — you score 0 this week. Don’t ghost next week.";
    primaryHref = "/board";
    primaryLabel = "The Board";
    primaryClass =
      "border border-danger/50 text-danger hover:bg-danger/10 bg-transparent";
    secondaryHref = "/locker-room";
    secondaryLabel = "Locker";
  } else {
    eyebrow = "Do this now";
    title = `Lock in ${weekLabel}`;
    body = `Pick all ${state.gameCount || 5} games, set confidence, then Lock it in before first kickoff${
      state.lockLabel ? ` (${state.lockLabel})` : ""
    }. After that the whole card freezes.`;
    primaryHref = "/picks";
    primaryLabel = "Lock it in";
    primaryClass = isNfl
      ? "bg-primary text-black hover:opacity-90 shadow-[0_0_24px_rgba(193,18,31,0.35)]"
      : "bg-primary text-black hover:opacity-90 shadow-[0_0_24px_rgba(34,197,94,0.25)]";
    secondaryHref = "/locker-room";
    secondaryLabel = "Locker";
  }

  // Later weeks only (first score lives on CommishSetupBanner — no twin green buttons).
  // Host: after the room has scored at least once, push score when this week is still open.
  if (
    state.isOps &&
    state.hasCard &&
    !state.weekScored &&
    state.scoredWeeks > 0 &&
    (state.frozen || state.iLocked)
  ) {
    eyebrow = "Host · your one job";
    title = `Score ${weekLabel} when the games die`;
    body =
      "Card’s in. One tap grades the room and drops the paper. Don’t leave them hanging.";
    primaryHref = "/commissioner?tab=results";
    primaryLabel = `Score ${weekLabel} →`;
    primaryClass = isNfl
      ? "bg-primary text-black hover:opacity-90 shadow-[0_0_24px_rgba(193,18,31,0.35)]"
      : "bg-primary text-black hover:opacity-90 shadow-[0_0_24px_rgba(34,197,94,0.25)]";
    secondaryHref = "/board";
    secondaryLabel = "The Board";
  }

  const glow = isNfl
    ? "rgba(193,18,31,0.22)"
    : "rgba(34,197,94,0.12)";

  const sportShort = isNfl ? "NFL" : sportId === "soccer_wwc" ? "WWC" : "CFB";

  return (
    <section className="mb-5 sm:mb-8">
      <div
        className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-black/50 to-black/70 p-4 sm:p-6"
        style={{ boxShadow: `0 0 50px ${glow}` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            {/* Room name lives on HomeSportHeader / HomeRoomContext — avoid double h1 */}
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              {eyebrow}
              <span className="text-muted font-semibold tracking-normal normal-case ml-1.5">
                · {sportShort}
              </span>
            </p>
          </div>
          <span className="text-[11px] font-mono font-bold tabular-nums text-primary/90 border border-primary/35 rounded-full px-2.5 py-0.5 bg-primary/10 shrink-0">
            {progress}
          </span>
        </div>

        {/* NFL: fan-familiar week chrome (sport · week · dates · lock) */}
        {isNfl && (
          <div className="mb-3 rounded-xl border border-primary/25 bg-black/40 px-3 py-2.5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
              🏈 NFL
            </p>
            <p className="text-lg sm:text-xl font-bold text-white leading-tight mt-0.5">
              {weekLabel}
            </p>
            <p className="text-sm text-muted mt-0.5">
              {weekDateRangeLabel(state.week, "nfl") || "Dates TBD"}
            </p>
            <p className="text-sm text-foreground/90 mt-1.5 font-medium">
              Lock:{" "}
              {state.lockLabel
                ? state.lockLabel
                : state.week === 1
                  ? "Thursday · 8:20 PM ET"
                  : "First kickoff on the card"}
            </p>
          </div>
        )}

        <h2 className="text-xl sm:text-3xl font-bold text-white mb-2 leading-tight">
          {title}
        </h2>
        {state.lastWeekRecap && (
          <div className="mb-3 rounded-xl border border-primary/25 bg-black/35 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary mb-0.5">
              Last week · {weekTitle(state.lastWeekRecap.week, sportId)}
            </p>
            <p className="text-sm text-white font-semibold leading-snug">
              You finished{" "}
              <span className="text-primary">
                #{state.lastWeekRecap.rank}
              </span>{" "}
              of {state.lastWeekRecap.field}
              {" · "}
              <span className="text-primary">
                {state.lastWeekRecap.pts >= 0 ? "+" : ""}
                {state.lastWeekRecap.pts}
              </span>{" "}
              pts that card
            </p>
          </div>
        )}
        {state.advancedFromScored && !state.lastWeekRecap && (
          <p className="text-[11px] text-primary/90 mb-2 font-medium">
            Last week is scored — you&apos;re on the next card ({progress}).
          </p>
        )}
        <p className="text-sm text-muted max-w-xl leading-relaxed mb-4">
          {body}
        </p>

        {/* Full-width primary on phone = one-thumb job; hard nav prepare = clean switch */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Link
            href={primaryHref}
            onClick={() => {
              try {
                document.body.style.overflow = "";
              } catch {
                /* ignore */
              }
            }}
            className={`inline-flex items-center justify-center w-full sm:w-auto px-5 py-3.5 sm:py-2.5 min-h-[52px] sm:min-h-0 rounded-xl text-base sm:text-sm font-bold transition touch-manipulation active:scale-[0.98] relative z-10 ${primaryClass}`}
          >
            {primaryLabel}
          </Link>
          {secondaryHref && (
            <Link
              href={secondaryHref}
              onClick={() => {
                try {
                  document.body.style.overflow = "";
                } catch {
                  /* ignore */
                }
              }}
              className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-3 sm:py-2.5 min-h-[48px] sm:min-h-0 rounded-xl text-sm font-medium border border-border text-muted hover:text-foreground hover:bg-card/50 transition touch-manipulation relative z-10"
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
            <span className="text-muted"> ({progress})</span>
          </span>
          <span className="text-border">·</span>
          <span>
            {state.scoredWeeks === 0
              ? "No weeks scored yet (preseason vibes)"
              : `${state.scoredWeeks} of ${SEASON_MAX_WEEK + 1} slots scored`}
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
                ? state.scoredWeeks === 0
                  ? "Card is live. After games: score the week so standings wake up."
                  : "Card is live. After games: score the week, then Gazette."
                : "Invite → First card wizard (demo) → Publish. Advanced tools wait until you score once."}
            </p>
            <Link
              href={
                state.hasCard
                  ? "/commissioner?tab=results"
                  : "/commissioner?tab=card&first=1"
              }
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
            >
              {state.hasCard ? "Score week →" : "First card wizard →"}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
