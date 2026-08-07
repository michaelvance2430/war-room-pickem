"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadWeekCard,
  loadBestAvailableWeekCard,
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
import { firstSeasonWeek, SEASON_MAX_WEEK } from "@/lib/season-calendar";
import { isCrystalBallOpeningWeek } from "@/lib/league-hub-actions";

type HeroState = {
  week: number;
  /**
   * True only when a card is *formally published* (publishedAt set).
   * Draft games without publish never count as a playable card.
   */
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
  /** NFL only: missing real team allegiance (never CFB-required on NFL home). */
  needsNflTeam: boolean;
  /**
   * Crystal Ball / Super Bowl required this opening week and not sealed.
   * CFB: Week 0 · NFL: Week 1. Null = unknown (fail closed → don't invent picks).
   */
  needsPridePick: boolean;
  /** Last scored week recap for this player */
  lastWeekRecap: {
    week: number;
    pts: number;
    rank: number;
    field: number;
  } | null;
};

/** Authoritative published-card check — not game count alone. */
function isFormallyPublishedCard(
  card: { publishedAt?: string | null; games?: unknown[] } | null | undefined
): boolean {
  if (!card) return false;
  const at = card.publishedAt;
  if (typeof at !== "string" || !at.trim()) return false;
  return Array.isArray(card.games) && card.games.length > 0;
}

/**
 * Home hero: one job at a time.
 * Player → make picks / waiting / locked.
 * Commish → publish / score / invite.
 * Flavor stays below; this is the runway.
 */
/** Survive Picks → Home remount so hero isn't a pulse skeleton every tab. */
const HERO_TTL_MS = 20_000;
let heroCache: { at: number; leagueId: string; state: HeroState } | null = null;

export default function HomeWeekHero() {
  const lid = getLeague()?.id || "";
  const [state, setState] = useState<HeroState | null>(() => {
    if (
      heroCache &&
      heroCache.leagueId === lid &&
      Date.now() - heroCache.at < HERO_TTL_MS
    ) {
      return heroCache.state;
    }
    return null;
  });

  useEffect(() => {
    let cancelled = false;

    function paintDegraded(week = 1) {
      const localWeek = (() => {
        try {
          const s = localStorage.getItem("warroom-active-week");
          const n = s != null ? parseInt(s, 10) : week;
          return Number.isFinite(n) ? n : week;
        } catch {
          return week;
        }
      })();
      const sid = getLeague()?.sportId || "cfb";
      const first = firstSeasonWeek(sid);
      let w = localWeek;
      if (sid === "nfl" && w <= 0) w = first;
      const degraded: HeroState = {
        week: w,
        hasCard: false,
        gameCount: 0,
        lockLabel: null,
        frozen: false,
        iLocked: false,
        rosterCount: 0,
        scoredWeeks: 0,
        weekScored: false,
        isCommish: isCommissioner(),
        isOps: isOps(),
        leagueCode: getLeague()?.code || null,
        advancedFromScored: false,
        needsNflTeam: false,
        needsPridePick: false,
        lastWeekRecap: null,
      };
      setState(degraded);
    }

    // Never leave Home hero as pulse forever (desktop Commish→Home return)
    const failSafe = window.setTimeout(() => {
      if (cancelled) return;
      setState((prev) => {
        if (prev) return prev;
        try {
          const s = localStorage.getItem("warroom-active-week");
          const n = s != null ? parseInt(s, 10) : 1;
          const w = Number.isFinite(n) ? n : 1;
          const sid = getLeague()?.sportId || "cfb";
          const first = firstSeasonWeek(sid);
          let ww = w;
          if (sid === "nfl" && ww <= 0) ww = first;
          return {
            week: ww,
            hasCard: false,
            gameCount: 0,
            lockLabel: null,
            frozen: false,
            iLocked: false,
            rosterCount: 0,
            scoredWeeks: 0,
            weekScored: false,
            isCommish: isCommissioner(),
            isOps: isOps(),
            leagueCode: getLeague()?.code || null,
            advancedFromScored: false,
            needsNflTeam: false,
            needsPridePick: false,
            lastWeekRecap: null,
          };
        } catch {
          return {
            week: firstSeasonWeek(getLeague()?.sportId || "cfb"),
            hasCard: false,
            gameCount: 0,
            lockLabel: null,
            frozen: false,
            iLocked: false,
            rosterCount: 0,
            scoredWeeks: 0,
            weekScored: false,
            isCommish: isCommissioner(),
            isOps: isOps(),
            leagueCode: getLeague()?.code || null,
            advancedFromScored: false,
            needsNflTeam: false,
            needsPridePick: false,
            lastWeekRecap: null,
          };
        }
      });
    }, 2_000);

    async function load() {
      try {
        // Active week + scored list (cached loaders)
        const { week: rawWeek, advanced, scored } = await resolvePlayerActiveWeek({
          persistIfOps: true,
        });
        if (cancelled) return;

        const sport = getLeague()?.sportId || "cfb";
        // NFL never lives on Week 0 — clamp stale CFB stamps
        const first = firstSeasonWeek(sport);
        const week =
          sport === "nfl" && rawWeek <= 0 ? first : Math.max(first, rawWeek);

        // First paint: card + picks + NFL allegiance only (no full roster wait)
        let needsNflTeam = false;
        let [card, mine, nflNeed] = await Promise.all([
          loadWeekCard(week),
          loadMyPicks(week).catch(() => null),
          sport === "nfl"
            ? import("@/lib/favorite-teams")
                .then((m) => m.needsNflAllegiance())
                .catch(() => false)
            : Promise.resolve(false),
        ]);
        needsNflTeam = !!nflNeed;
        if (cancelled) return;

        // Wrong active-week stamp? Prefer another *published* card (never draft-only)
        // Never invent a CFB Week 0 card for NFL rooms.
        let liveWeek = week;
        if (!isFormallyPublishedCard(card)) {
          const best = await loadBestAvailableWeekCard(week).catch(() => null);
          if (
            best?.card &&
            isFormallyPublishedCard(best.card) &&
            !(sport === "nfl" && best.week <= 0)
          ) {
            card = best.card;
            liveWeek = best.week;
            mine = await loadMyPicks(liveWeek).catch(() => null);
          } else {
            // Keep local draft out of player "has card" truth
            card = isFormallyPublishedCard(card) ? card : null;
          }
        }

        // Pride pick: local seal first; cloud only if still unknown (opening week)
        let needsPridePick = false;
        const league = getLeague();
        const crystalOn = league?.settings?.crystalBallEnabled !== false;
        if (
          !needsNflTeam &&
          crystalOn &&
          isCrystalBallOpeningWeek(sport, liveWeek)
        ) {
          try {
            const { peekLocalCrystalBall } = await import(
              "@/lib/crystal-ball"
            );
            const local = peekLocalCrystalBall();
            if (local?.myTeam) {
              needsPridePick = false;
            } else {
              const { createClient, hasSupabaseConfig } = await import(
                "@/lib/supabase/client"
              );
              const session = getSession();
              if (
                hasSupabaseConfig() &&
                session?.playerId &&
                session?.leagueId
              ) {
                const supabase = createClient();
                const { data, error } = await supabase
                  .from("crystal_ball_picks")
                  .select("user_id")
                  .eq("league_id", session.leagueId)
                  .eq("user_id", session.playerId)
                  .maybeSingle();
                if (error) {
                  needsPridePick = true;
                } else {
                  needsPridePick = !data;
                }
              } else {
                needsPridePick = true;
              }
            }
          } catch {
            needsPridePick = true;
          }
        }

        const games = card?.games || [];
        const hasCard = isFormallyPublishedCard(card);
        const now = Date.now();
        const frozen = hasCard && isCardLockDeadlinePassed(games, now);
        if (cancelled) return;
        const iLocked = !!(
          mine?.lockedAt && Object.keys(mine.picks || {}).length
        );

        // Paint CTA runway now — roster count + recap fill in after
        const next: HeroState = {
          week: liveWeek,
          hasCard,
          gameCount: games.length,
          lockLabel: hasCard ? formatCardLockDeadline(games) : null,
          frozen,
          iLocked,
          rosterCount:
            heroCache?.leagueId === (getLeague()?.id || "")
              ? heroCache.state.rosterCount
              : 0,
          scoredWeeks: scored.length,
          weekScored: scored.includes(liveWeek),
          isCommish: isCommissioner(),
          isOps: isOps(),
          leagueCode: getLeague()?.code || null,
          advancedFromScored: advanced,
          needsNflTeam,
          needsPridePick,
          lastWeekRecap:
            heroCache?.leagueId === (getLeague()?.id || "")
              ? heroCache.state.lastWeekRecap
              : null,
        };
        setState(next);
        window.clearTimeout(failSafe);
        heroCache = {
          at: Date.now(),
          leagueId: getLeague()?.id || "",
          state: next,
        };

        // Secondary: roster headcount (does not block Make Picks / lock CTA)
        void loadLeagueRoster()
          .then((roster) => {
            if (cancelled) return;
            const humans = roster.filter((m) => !m.isBot);
            setState((prev) => {
              if (!prev) return prev;
              const merged = { ...prev, rosterCount: humans.length };
              heroCache = {
                at: Date.now(),
                leagueId: getLeague()?.id || "",
                state: merged,
              };
              return merged;
            });
          })
          .catch(() => {
            /* roster optional for first paint */
          });

        // Last scored week recap — only a week *before* the card you're on.
        try {
          const selfId = getSession()?.playerId;
          const priorScored = scored
            .filter((w) => Number.isFinite(w) && w < week)
            .sort((a, b) => b - a);
          const lastScoredWeek = priorScored[0];
          if (selfId != null && lastScoredWeek != null && scored.length > 0) {
            const players = await loadLeaguePlayers();
            if (cancelled) return;
            const field = players.filter(
              (p) => !p.isMock && (p.weeksPlayed || 0) > 0
            );
            const withPts = field
              .map((p) => {
                const pts =
                  p.weeklyPoints?.length
                    ? p.weeklyPoints[p.weeklyPoints.length - 1]
                    : null;
                return {
                  id: p.id,
                  pts:
                    pts != null && Number.isFinite(pts) ? Number(pts) : null,
                };
              })
              .filter(
                (x): x is { id: string; pts: number } => x.pts != null
              )
              .sort((a, b) => b.pts - a.pts || a.id.localeCompare(b.id));
            const meIdx = withPts.findIndex((x) => x.id === selfId);
            if (meIdx >= 0) {
              const recap = {
                week: lastScoredWeek,
                pts: withPts[meIdx]!.pts,
                rank: meIdx + 1,
                field: withPts.length,
              };
              setState((prev) => {
                if (!prev) return prev;
                const merged = { ...prev, lastWeekRecap: recap };
                heroCache = {
                  at: Date.now(),
                  leagueId: getLeague()?.id || "",
                  state: merged,
                };
                return merged;
              });
            }
          }
        } catch {
          /* recap optional */
        }
      } catch {
        if (!cancelled) paintDegraded();
      } finally {
        window.clearTimeout(failSafe);
      }
    }
    void load();

    // Live update when commissioner publishes (same browser or after cache bust)
    function reloadHero() {
      try {
        heroCache = null;
        const lid = getLeague()?.id;
        if (lid) {
          void import("@/lib/cloud").then((m) => {
            m.invalidateCloudWeekCaches(lid);
          });
        }
      } catch {
        /* ok */
      }
      void load();
    }

    function onPublished() {
      reloadHero();
    }
    function onVis() {
      if (document.visibilityState === "visible") reloadHero();
    }
    function onFocus() {
      reloadHero();
    }

    window.addEventListener("warroom-card-published", onPublished);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    // While waiting on a card, soft-poll so players don't need a manual refresh
    const poll = window.setInterval(() => {
      if (cancelled) return;
      setState((prev) => {
        if (prev && prev.hasCard) return prev;
        void load();
        return prev;
      });
    }, 20_000);

    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
      window.clearInterval(poll);
      window.removeEventListener("warroom-card-published", onPublished);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
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

  // —— Primary job (never default to /picks without a published card) ——
  let eyebrow = progress;
  let title = weekLabel;
  let body = "";
  let primaryHref: string | null = null;
  let primaryLabel = "";
  let primaryClass = "bg-primary text-black hover:opacity-90";
  let secondaryHref: string | null = null;
  let secondaryLabel = "";

  // —— Priority: NFL allegiance → Super Bowl/Crystal Ball → published card / wait ——
  // Never invent CFB allegiance on NFL; never invent Make Picks without publish.
  if (!state.isOps && state.needsNflTeam) {
    eyebrow = "Required · NFL";
    title = "Pick your NFL team";
    body =
      "Your team is who you identify with — not your Super Bowl prediction. Choose a real club before weekly work.";
    primaryHref = "/declare-allegiance?sport=nfl&next=/";
    primaryLabel = "Choose NFL Team";
    primaryClass = "bg-primary text-black hover:opacity-90 shadow-[0_0_24px_rgba(193,18,31,0.35)]";
    secondaryHref = null;
  } else if (!state.isOps && state.needsPridePick) {
    eyebrow = isNfl ? "Super Bowl pride pick" : "Crystal Ball";
    title = isNfl
      ? "Make your Super Bowl prediction"
      : "Lock your Crystal Ball pick";
    body = isNfl
      ? "Separate from your NFL team allegiance. Zero points. Do this before weekly picks when pride pick is on."
      : "Who wins the national title? Zero points. Answer before the opening card freezes.";
    primaryHref = "/crystal-ball";
    primaryLabel = isNfl ? "Make Super Bowl Pick" : "Lock Crystal Ball";
    primaryClass = isNfl
      ? "bg-primary text-black hover:opacity-90 shadow-[0_0_24px_rgba(193,18,31,0.35)]"
      : "bg-primary text-black hover:opacity-90 shadow-[0_0_24px_rgba(34,197,94,0.25)]";
    secondaryHref = null;
  } else if (!state.hasCard) {
    // Host (commish or deputy): build/publish — never the sarcastic player wait
    if (state.isOps) {
      if (state.isCommish && state.scoredWeeks === 0) {
        eyebrow = "You’re the commish";
        title =
          state.rosterCount < 2
            ? "Share the league — fill the room"
            : "Publish the first card";
        body =
          state.rosterCount < 2
            ? `Use Share League up top — friends open a link (code is built in). Then build a card for ${weekLabel}.`
            : `${state.rosterCount} in the room. ${weekLabel} has no published card yet — build five games, add a prop, publish.`;
        primaryHref = "/week-ops?step=1";
        primaryLabel = "Build first card →";
        secondaryHref = "/locker-room";
        secondaryLabel =
          state.rosterCount < 2 ? "Locker while you wait" : "Locker";
      } else {
        eyebrow = "Host · your move";
        title = "Publish a card so people can pick";
        body = `One job: build and publish ${weekLabel}. Until then the room has nothing to lock.`;
        primaryHref = "/week-ops?step=1";
        primaryLabel = "Build this week's card →";
        secondaryHref = "/locker-room";
        secondaryLabel = "Locker";
      }
    } else {
      // Regular player: truthful commissioner-wait (not Make Picks / not Step 1)
      eyebrow = "WAITING ON THE COMMISH";
      title = "No card. No picks. Outstanding leadership.";
      body =
        "Your commissioner hasn’t posted this week’s card yet. Feel free to remind them—in the Locker Room, where everyone can enjoy it.";
      primaryHref = "/locker-room";
      primaryLabel = "Call Out the Commish";
      primaryClass = isNfl
        ? "bg-primary text-black hover:opacity-90 shadow-[0_0_24px_rgba(193,18,31,0.35)]"
        : "bg-primary text-black hover:opacity-90 shadow-[0_0_24px_rgba(34,197,94,0.25)]";
      secondaryHref = null;
      secondaryLabel = "";
    }
  } else if (state.iLocked) {
    // Caught up — status only. Nav owns destinations (no Board/Locker duplicates).
    eyebrow = state.frozen ? "Games are on" : "You're caught up";
    title = state.frozen
      ? `${weekLabel} is live — sit tight`
      : `You're locked for ${weekLabel}`;
    body = state.frozen
      ? "Football's running. Standings move when the card is scored — then the Gazette drops. Nothing fake to do until something real happens."
      : `You're done for now${state.lockLabel ? ` · lock was ${state.lockLabel}` : ""}. Enjoy the wait. Come back when kickoff hits, the Gazette drops, or the room has something worth talking about.`;
    primaryHref = null;
    secondaryHref = null;
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

  // Score CTA is HomeCommishMissionButton only (no twin Host Tip coaching cards).
  // Host: after the room has scored at least once, push score when this week is still open.
  if (
    state.isOps &&
    state.hasCard &&
    !state.weekScored &&
    state.scoredWeeks > 0 &&
    (state.frozen || state.iLocked)
  ) {
    eyebrow = "Commish · your one job";
    title = `Score ${weekLabel} when the games die`;
    body =
      "Card’s in. One tap grades the room and drops the paper. Don’t leave them hanging.";
    primaryHref = "/week-ops?step=score";
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

        {/* Actions only when there is a real job — never duplicate global nav */}
        {primaryHref && (
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
        )}

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
              ? "Season breathing · no scores yet"
              : `${state.scoredWeeks} of ${SEASON_MAX_WEEK + 1} slots scored`}
          </span>
        </div>

      </div>
    </section>
  );
}
