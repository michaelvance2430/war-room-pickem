"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Nav from "@/components/Nav";
import PicksHowToModal from "@/components/PicksHowToModal";
import FirstFinalModal from "@/components/FirstFinalModal";
import { Game, UserPick, Prop } from "@/lib/types";
import { getSession, getLeague } from "@/lib/league";
import Link from "next/link";
import {
  loadWeekCard,
  savePicksToCloud,
  loadMyPicks,
  loadLeagueActiveWeek,
  listPublishedWeekNumbers,
  listScoredWeekNumbers,
  loadWeekResultsFromCloud,
  cardRevision,
  type CloudCard,
} from "@/lib/cloud";
import { resolvePlayerActiveWeek } from "@/lib/active-week";
import { createClient } from "@/lib/supabase/client";
import { scoreWeek, type GameResult } from "@/lib/scoring";
import {
  formatRankedTeam,
  getRankedMatchupTier,
  rankedMatchupBadge,
  rankedMatchupShellClass,
} from "@/lib/rankings";
import {
  formatKickoff,
  formatCardDateRange,
  formatCardLockDeadline,
  weekTitle,
  weekSubtitle,
  isGameLocked,
  isPropLocked,
  isCardLockDeadlinePassed,
  openGameCount,
  formatKickoffLockLabel,
} from "@/lib/dates";

function formatSpread(
  spread: number,
  favorite: "home" | "away",
  side: "home" | "away"
) {
  const isFavorite = favorite === side;
  if (isFavorite) {
    return spread < 0 ? `${spread}` : `-${Math.abs(spread)}`;
  }
  return `+${Math.abs(spread)}`;
}

const EMPTY_PROP: Prop = {
  id: "prop",
  question: "",
  options: ["A", "B"],
  points: 3,
};

const POLL_MS = 12_000;

export default function PicksPage() {
  /** League's official pick week (commissioner-controlled). */
  const [activeWeek, setActiveWeek] = useState(1);
  /** Week the user is viewing (may be past = read-only). */
  const [viewWeek, setViewWeek] = useState(1);
  const [publishedWeeks, setPublishedWeeks] = useState<number[]>([]);
  const [scoredWeeks, setScoredWeeks] = useState<number[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [picks, setPicks] = useState<Record<string, UserPick>>({});
  const [bestBetId, setBestBetId] = useState<string | null>(null);
  const [propChoice, setPropChoice] = useState<string | null>(null);
  const [usedConfidence, setUsedConfidence] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prop, setProp] = useState<Prop>(EMPTY_PROP);
  const [hasCard, setHasCard] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [cardNotice, setCardNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [switching, setSwitching] = useState(false);
  /** Covers + prop after week is scored (past-week review) */
  const [weekResults, setWeekResults] = useState<Record<string, GameResult>>(
    {}
  );
  const [weekPropResult, setWeekPropResult] = useState<string | null>(null);
  const [weekScoredAt, setWeekScoredAt] = useState<string | null>(null);
  const [firstFinalModal, setFirstFinalModal] = useState<{
    mode: "earned" | "forfeit";
    weekNumber: number;
    pointsRemoved?: number;
  } | null>(null);

  const revisionRef = useRef<string>("");
  const viewWeekRef = useRef(1);
  const picksRef = useRef(picks);
  const bestBetRef = useRef(bestBetId);
  const propChoiceRef = useRef(propChoice);
  const savedRef = useRef(saved);
  picksRef.current = picks;
  bestBetRef.current = bestBetId;
  propChoiceRef.current = propChoice;
  savedRef.current = saved;
  viewWeekRef.current = viewWeek;

  const loadPicksIntoState = useCallback(
    async (cloud: CloudCard, week: number) => {
      const mine = await loadMyPicks(week);
      if (mine) {
        const validIds = new Set(cloud.games.map((g) => g.id));
        const filtered: Record<string, UserPick> = {};
        for (const [id, p] of Object.entries(mine.picks || {})) {
          if (validIds.has(id)) filtered[id] = p;
        }
        picksRef.current = filtered;
        setPicks(filtered);
        const bb =
          mine.bestBetId && validIds.has(mine.bestBetId)
            ? mine.bestBetId
            : null;
        bestBetRef.current = bb;
        setBestBetId(bb);
        const propOk =
          mine.propChoice && cloud.prop.options.includes(mine.propChoice)
            ? mine.propChoice
            : null;
        propChoiceRef.current = propOk;
        setPropChoice(propOk);
        setSaved(
          !!mine.lockedAt &&
            Object.keys(filtered).length === cloud.games.length
        );
        const used = Object.values(filtered)
          .map((p) => p.confidence)
          .filter((c) => c > 0);
        setUsedConfidence(used);
      } else {
        picksRef.current = {};
        bestBetRef.current = null;
        propChoiceRef.current = null;
        setPicks({});
        setBestBetId(null);
        setPropChoice(null);
        setSaved(false);
        setUsedConfidence([]);
      }
    },
    []
  );

  const applyCard = useCallback(
    async (
      cloud: CloudCard,
      opts: { isInitial: boolean; forceReloadPicks?: boolean }
    ) => {
      const rev = cardRevision(cloud);
      const changed = !!revisionRef.current && revisionRef.current !== rev;

      setHasCard(true);
      setGames(cloud.games);
      setProp(cloud.prop);
      setLoadError(null);

      if (opts.isInitial || opts.forceReloadPicks || !revisionRef.current) {
        revisionRef.current = rev;
        await loadPicksIntoState(cloud, cloud.weekNumber);
        return;
      }

      if (!changed) return;

      revisionRef.current = rev;
      const validIds = new Set(cloud.games.map((g) => g.id));
      const prev = picksRef.current;
      const kept: Record<string, UserPick> = {};
      for (const [id, p] of Object.entries(prev)) {
        if (validIds.has(id)) kept[id] = p;
      }
      const dropped = Object.keys(prev).length - Object.keys(kept).length;
      picksRef.current = kept;
      setPicks(kept);

      let bb = bestBetRef.current;
      if (bb && !validIds.has(bb)) {
        bb = null;
        bestBetRef.current = null;
        setBestBetId(null);
      }

      if (
        propChoiceRef.current &&
        !cloud.prop.options.includes(propChoiceRef.current)
      ) {
        propChoiceRef.current = null;
        setPropChoice(null);
      }

      const used = Object.values(kept)
        .map((p) => p.confidence)
        .filter((c) => c > 0);
      setUsedConfidence(used);

      if (dropped > 0 || Object.keys(kept).length < cloud.games.length) {
        setSaved(false);
        setCardNotice(
          "Commissioner updated this week’s games. Your card refreshed automatically — re-check open picks and Save again."
        );
      } else {
        setCardNotice(
          "Commissioner updated the card (lines/prop). Review open games and Save if needed."
        );
      }
    },
    [loadPicksIntoState]
  );

  const refreshPublishedList = useCallback(async () => {
    const [weeks, scored] = await Promise.all([
      listPublishedWeekNumbers(),
      listScoredWeekNumbers(),
    ]);
    setPublishedWeeks(weeks);
    setScoredWeeks(scored);
    return weeks;
  }, []);

  /**
   * Load a specific week into the UI.
   * Explicit week picks (Jump to week) never redirect away — even if empty.
   * Initial load lands on live active week.
   */
  const loadWeek = useCallback(
    async (
      week: number,
      opts: {
        isInitial?: boolean;
        forceReloadPicks?: boolean;
        /** User chose this week in the browser — do not fallback elsewhere */
        explicit?: boolean;
      } = {}
    ) => {
      const session = getSession();
      const league = getLeague();
      if (!session?.leagueId) {
        if (opts.isInitial) {
          setLoadError(
            "No league selected. Go home and join or create a league."
          );
          setLoaded(true);
        }
        return null;
      }

      if (opts.isInitial) {
        setLeagueName(league?.name || "");
        setLoadError(null);
      }

      try {
        // After a week is scored, home + picks auto-advance past it
        const resolved = await resolvePlayerActiveWeek({
          persistIfOps: true,
        });
        const active = resolved.week;
        setActiveWeek(active);

        let target = week;
        let cloud = await loadWeekCard(target);

        // Initial only: land on advanced active week (or first published)
        if (opts.isInitial) {
          target = active;
          cloud = await loadWeekCard(target);
          if (!cloud?.games?.length) {
            const published = await refreshPublishedList();
            const fallback = published.includes(active)
              ? active
              : published[published.length - 1] ?? active;
            target = fallback;
            cloud = await loadWeekCard(target);
          } else {
            void refreshPublishedList();
          }
        } else if (opts.explicit) {
          // Stay on requested week even if no card (show empty state)
          void refreshPublishedList();
        } else if (!cloud?.games?.length) {
          const published = await refreshPublishedList();
          const fallback = published.includes(active)
            ? active
            : published[published.length - 1] ?? active;
          target = fallback;
          cloud = await loadWeekCard(target);
        } else {
          void refreshPublishedList();
        }

        setViewWeek(target);
        viewWeekRef.current = target;

        // Load covers for scored weeks (your card + hit/miss)
        try {
          const res = await loadWeekResultsFromCloud(target);
          if (res) {
            setWeekResults(res.results);
            setWeekPropResult(res.propResult);
            setWeekScoredAt(res.scoredAt);
          } else {
            setWeekResults({});
            setWeekPropResult(null);
            setWeekScoredAt(null);
          }
        } catch {
          setWeekResults({});
          setWeekPropResult(null);
          setWeekScoredAt(null);
        }

        if (!cloud || !cloud.games.length) {
          setHasCard(false);
          setGames([]);
          if (opts.isInitial) setLoaded(true);
          return null;
        }

        await applyCard(cloud, {
          isInitial: !!opts.isInitial,
          forceReloadPicks: opts.forceReloadPicks || !!opts.explicit,
        });
        return cloud;
      } catch (e: unknown) {
        if (opts.isInitial) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load weekly card"
          );
        }
        return null;
      } finally {
        if (opts.isInitial) setLoaded(true);
      }
    },
    [applyCard, refreshPublishedList]
  );

  /** Poll / realtime: refresh current view week + active week number only. */
  const softRefresh = useCallback(async () => {
    const active = await loadLeagueActiveWeek();
    setActiveWeek(active);
    void refreshPublishedList();
    // Only re-pull card for the week you're looking at
    const cloud = await loadWeekCard(viewWeekRef.current);
    if (cloud?.games?.length) {
      await applyCard(cloud, { isInitial: false });
    }
  }, [applyCard, refreshPublishedList]);

  async function selectWeek(week: number) {
    if (week === viewWeek && hasCard) return;
    setSwitching(true);
    setSaveError(null);
    setCardNotice(null);
    revisionRef.current = "";
    try {
      await loadWeek(week, { forceReloadPicks: true, explicit: true });
    } finally {
      setSwitching(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const active = await loadLeagueActiveWeek();
      setActiveWeek(active);
      await loadWeek(active, { isInitial: true });
    })();

    const poll = setInterval(() => {
      void softRefresh();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void softRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const tick = window.setInterval(() => setNow(Date.now()), 30_000);

    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null =
      null;
    try {
      const session = getSession();
      if (session?.leagueId) {
        const supabase = createClient();
        channel = supabase
          .channel(`week-card-${session.leagueId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "week_cards",
              filter: `league_id=eq.${session.leagueId}`,
            },
            () => {
              void softRefresh();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "card_games",
            },
            () => {
              void softRefresh();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "leagues",
              filter: `id=eq.${session.leagueId}`,
            },
            () => {
              void softRefresh();
            }
          )
          .subscribe();
      }
    } catch {
      /* polling still works */
    }

    return () => {
      clearInterval(poll);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (channel) {
        try {
          const supabase = createClient();
          void supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  // Viewing past week, or any week that isn't the league active week → full read-only
  const isPastOrOtherWeek = viewWeek !== activeWeek;
  /** Can edit anything on this view? Only active week. */
  const weekEditable = !isPastOrOtherWeek;
  /** First kickoff on the card has started — must already be locked or you're out. */
  const cardDeadlinePassed = isCardLockDeadlinePassed(games, now);
  /** True if they previously saved/locked this week (from cloud). */
  const hadLockedCard = saved;
  /**
   * After first kickoff on the card: entire slate freezes.
   * Never locked → cannot lock (0 pts). Already locked → read-only.
   */
  const missedLockWindow =
    weekEditable && cardDeadlinePassed && !hadLockedCard && hasCard;
  const cardFrozen = weekEditable && cardDeadlinePassed && hasCard;
  const propLockedNow = isPropLocked(games, now) || cardFrozen;
  const openCount = openGameCount(games, now);
  const allGamesLocked = games.length > 0 && openCount === 0;
  const canEditProp = weekEditable && !propLockedNow && !cardFrozen;
  const fullyLocked =
    isPastOrOtherWeek ||
    cardFrozen ||
    (allGamesLocked && (!prop.question || propLockedNow));

  const confidenceOptions = [1, 2, 3, 4, 5];

  function selectSide(gameId: string, side: "home" | "away") {
    if (!weekEditable || cardFrozen) return;
    const game = games.find((g) => g.id === gameId);
    if (!game || isGameLocked(game, now, games)) return;

    setSaved(false);
    setPicks((prev) => ({
      ...prev,
      [gameId]: {
        gameId,
        pick: side,
        confidence: prev[gameId]?.confidence ?? 0,
        isBestBet: bestBetId === gameId,
        lockedSpread: game.spread,
        lockedFavorite: game.favorite,
      },
    }));
  }

  function selectConfidence(gameId: string, conf: number) {
    if (!weekEditable || cardFrozen) return;
    const game = games.find((g) => g.id === gameId);
    if (!game || isGameLocked(game, now, games)) return;
    if (!picks[gameId]?.pick) return;
    const takenByOther = Object.entries(picks).some(
      ([id, p]) => id !== gameId && p.confidence === conf
    );
    if (takenByOther) return;

    setSaved(false);
    setPicks((prev) => {
      const next = {
        ...prev,
        [gameId]: {
          gameId,
          pick: prev[gameId]?.pick ?? "home",
          confidence: conf,
          isBestBet: bestBetId === gameId,
          lockedSpread: game?.spread ?? prev[gameId]?.lockedSpread ?? 0,
          lockedFavorite:
            game?.favorite ?? prev[gameId]?.lockedFavorite ?? "home",
        },
      };
      const used = Object.values(next)
        .map((p) => p.confidence)
        .filter((c) => c >= 1 && c <= 5);
      setUsedConfidence(used);
      return next;
    });
  }

  function toggleBestBet(gameId: string) {
    if (!weekEditable || cardFrozen) return;
    const game = games.find((g) => g.id === gameId);
    if (!game || isGameLocked(game, now, games)) return;
    // Can't move BB off a locked game
    if (bestBetId && bestBetId !== gameId) {
      const prevG = games.find((g) => g.id === bestBetId);
      if (prevG && isGameLocked(prevG, now, games)) return;
    }

    setSaved(false);
    if (bestBetId === gameId) {
      setBestBetId(null);
      setPicks((prev) => {
        const existing = prev[gameId];
        if (!existing) return prev;
        return { ...prev, [gameId]: { ...existing, isBestBet: false } };
      });
    } else {
      setPicks((prev) => {
        const next = { ...prev };
        if (bestBetId && next[bestBetId]) {
          next[bestBetId] = { ...next[bestBetId], isBestBet: false };
        }
        next[gameId] = {
          gameId,
          pick: next[gameId]?.pick ?? "home",
          confidence: next[gameId]?.confidence ?? 0,
          isBestBet: true,
          lockedSpread: game.spread,
          lockedFavorite: game.favorite,
        };
        return next;
      });
      setBestBetId(gameId);
    }
  }

  async function savePicks() {
    if (saving || !hasCard || !weekEditable) return;
    setSaving(true);
    setSaveError(null);

    // Refresh active week card only
    const latest = await loadWeekCard(activeWeek);
    if (!latest?.games?.length) {
      setSaveError("Could not load the current week card. Try again.");
      setSaving(false);
      return;
    }
    if (latest.weekNumber !== activeWeek) {
      setSaveError("Week mismatch — refresh and try again.");
      setSaving(false);
      return;
    }

    const cardGames = latest.games;
    const prevCloud = await loadMyPicks(activeWeek);
    const tick = Date.now();
    const alreadyLocked = !!prevCloud?.lockedAt;

    // First kickoff on the card: entire slate freezes — no new locks, no edits
    if (isCardLockDeadlinePassed(cardGames, tick)) {
      if (!alreadyLocked) {
        setSaveError(
          `Too late. First kickoff was ${formatCardLockDeadline(cardGames)}. All picks must be locked before then. You cannot lock after first kickoff — you score 0 this week.`
        );
        setSaving(false);
        return;
      }
      setSaveError(
        `Card is frozen. First kickoff was ${formatCardLockDeadline(cardGames)}. No more changes.`
      );
      setSaving(false);
      return;
    }

    const lockedPicks: Record<string, UserPick> = {};
    for (const g of cardGames) {
      const p = picksRef.current[g.id];
      if (!p) continue;
      lockedPicks[g.id] = {
        ...p,
        lockedSpread: g.spread,
        lockedFavorite: g.favorite,
        isBestBet: false,
      };
    }

    let nextBest = bestBetRef.current;
    if (nextBest && !lockedPicks[nextBest]) nextBest = null;
    for (const id of Object.keys(lockedPicks)) {
      lockedPicks[id] = {
        ...lockedPicks[id],
        isBestBet: id === nextBest,
      };
    }

    const nextProp = propChoiceRef.current;

    // Full card required before first kickoff
    if (Object.keys(lockedPicks).length !== cardGames.length) {
      setSaveError("Pick a side and confidence for every game before first kickoff.");
      setSaving(false);
      return;
    }
    const confs = cardGames
      .map((g) => lockedPicks[g.id].confidence)
      .sort((a, b) => a - b);
    const expected = [1, 2, 3, 4, 5].slice(0, cardGames.length);
    if (confs.join() !== expected.join()) {
      setSaveError("Use each confidence 1–5 exactly once.");
      setSaving(false);
      return;
    }
    if (!nextBest) {
      setSaveError("Mark one Best Bet.");
      setSaving(false);
      return;
    }
    if (!nextProp) {
      setSaveError("Pick a prop option.");
      setSaving(false);
      return;
    }

    const result = await savePicksToCloud({
      weekNumber: activeWeek,
      picks: lockedPicks,
      bestBetId: nextBest,
      propChoice: nextProp,
    });

    if (!result.ok) {
      setSaveError(result.error || "Cloud save failed — try again");
      setSaving(false);
      return;
    }

    setPicks(lockedPicks);
    setBestBetId(nextBest);
    setPropChoice(nextProp);
    setSaved(true);
    try {
      sessionStorage.setItem("warroom-tut-picks-saved", "1");
      const { completePlayerTutorial, isPlayerTutorialActive } = await import(
        "@/lib/player-tutorial"
      );
      if (isPlayerTutorialActive()) completePlayerTutorial();
    } catch {
      /* ignore */
    }

    // First & Final: full popup (earn warning / forfeit point loss)
    if (result.firstFinal === "earned") {
      setFirstFinalModal({ mode: "earned", weekNumber: activeWeek });
      setCardNotice(
        `🔒 First & Final active for Week ${activeWeek} — change any pick and you lose +25 season & career.`
      );
    } else if (result.firstFinal === "forfeit") {
      const removed = Math.abs(result.firstFinalPointsDelta ?? 25);
      setFirstFinalModal({
        mode: "forfeit",
        weekNumber: activeWeek,
        pointsRemoved: result.firstFinalPointsDelta
          ? Math.abs(result.firstFinalPointsDelta)
          : 0,
      });
      setCardNotice(
        (result.firstFinalPointsDelta ?? 0) < 0
          ? `First & Final voided — −${removed} season & career cheevo pts.`
          : `Week ${activeWeek} first-lock voided (you still have another clean week).`
      );
    } else {
      setCardNotice(null);
    }
    setSaving(false);
    await applyCard(latest, { isInitial: false, forceReloadPicks: true });
  }

  const allGamesPicked =
    hasCard &&
    weekEditable &&
    !cardFrozen &&
    games.length > 0 &&
    games.every(
      (g) => picks[g.id]?.pick && (picks[g.id]?.confidence ?? 0) > 0
    ) &&
    propChoice !== null &&
    bestBetId !== null;

  // Walk-the-dog tutorial: card filled → coach advances to Save
  useEffect(() => {
    if (!allGamesPicked) return;
    try {
      sessionStorage.setItem("warroom-tut-picks-filled", "1");
    } catch {
      /* ignore */
    }
  }, [allGamesPicked]);

  // Weeks shown: published + scored + active (so past scored weeks stay clickable)
  const weekPills = [
    ...new Set(
      [...publishedWeeks, ...scoredWeeks, activeWeek].filter((w) => w >= 0)
    ),
  ].sort((a, b) => a - b);

  const viewIsScored = scoredWeeks.includes(viewWeek);
  const myWeekScore =
    hasCard &&
    viewIsScored &&
    Object.keys(weekResults).length > 0 &&
    Object.keys(picks).length > 0
      ? scoreWeek(
          picks,
          bestBetId,
          propChoice,
          games,
          weekResults,
          prop,
          weekPropResult
        )
      : null;

  if (!loaded) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <PicksHowToModal />
        <main className="flex-1 flex items-center justify-center text-muted">
          Loading…
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <PicksHowToModal />
      {firstFinalModal && (
        <FirstFinalModal
          mode={firstFinalModal.mode}
          weekNumber={firstFinalModal.weekNumber}
          pointsRemoved={firstFinalModal.pointsRemoved}
          onClose={() => setFirstFinalModal(null)}
        />
      )}

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {/* Crystal-clear week banner */}
        <div
          className={`rounded-xl border px-4 py-3 mb-4 ${
            weekEditable
              ? "border-primary/50 bg-primary/10"
              : "border-border bg-card"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                weekEditable ? "text-primary" : "text-muted"
              }`}
            >
              {weekEditable ? "You are picking" : "Viewing only"}
            </span>
            {weekEditable ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-black font-semibold">
                LIVE
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted">
                READ-ONLY
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold">
            {weekTitle(viewWeek)}
            {weekEditable ? " Picks" : " — your card"}
          </h1>
          <p className="text-sm text-muted mt-1">
            {leagueName ? `${leagueName} · ` : ""}
            {weekEditable
              ? missedLockWindow
                ? "First kickoff hit and you never locked — card closed for you (0 pts)."
                : cardFrozen
                  ? "First kickoff hit — entire card is frozen. No more changes."
                  : `All picks must be locked before first kickoff (${formatCardLockDeadline(games)}).`
              : viewWeek < activeWeek
                ? `Past week · league is on ${weekTitle(activeWeek)}. You can review but not change picks.`
                : `Not the active week (league is on ${weekTitle(activeWeek)}). Read-only.`}
          </p>
          {games.length > 0 && (
            <p className="text-xs text-muted mt-1">
              {formatCardDateRange(games) || weekSubtitle(viewWeek)}
              {weekEditable && !cardFrozen && (
                <>
                  {" · "}
                  Lock deadline: {formatCardLockDeadline(games)}
                </>
              )}
            </p>
          )}
        </div>

        {/* Week browser */}
        {weekPills.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-3 mb-6">
            <p className="text-[10px] uppercase tracking-wider text-muted mb-2 font-semibold">
              Jump to week
            </p>
            <div className="flex flex-wrap gap-2">
              {weekPills.map((w) => {
                const isView = w === viewWeek;
                const isActive = w === activeWeek;
                const isScored = scoredWeeks.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    disabled={switching}
                    onClick={() => void selectWeek(w)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      isView && isActive
                        ? "bg-primary text-black"
                        : isView
                          ? "bg-card-hover border-2 border-primary text-foreground"
                          : isActive
                            ? "border border-primary/50 text-primary hover:bg-primary/10"
                            : isScored
                              ? "border border-border text-foreground hover:bg-card-hover"
                              : "border border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {weekTitle(w)}
                    {isActive ? " · live" : isScored ? " · scored" : ""}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted mt-2">
              Tap any week to review.{" "}
              <span className="text-primary font-medium">Live</span> accepts
              new picks.{" "}
              <span className="text-foreground font-medium">Scored</span> weeks
              show your results — and{" "}
              <Link
                href={`/board?week=${viewWeek}`}
                className="text-primary font-medium hover:underline"
              >
                The Board
              </Link>{" "}
              shows everyone&apos;s cards after scoring.
            </p>
          </div>
        )}

        {loadError && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
            {loadError}
          </div>
        )}

        {cardNotice && weekEditable && (
          <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary flex items-start justify-between gap-3">
            <span>{cardNotice}</span>
            <button
              type="button"
              className="text-xs shrink-0 underline"
              onClick={() => setCardNotice(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {!loadError && !hasCard && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
              Not broken — no card yet
            </p>
            <p className="font-medium mb-2">
              No card for {weekTitle(viewWeek)} yet
            </p>
            <p className="text-sm text-muted mb-4 max-w-md mx-auto leading-relaxed">
              {viewWeek === activeWeek
                ? "The commissioner has to publish this week’s games before anyone can lock picks. Hang in the Locker or check Standings until the card goes live."
                : "This week was never published (or was cleared)."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {viewWeek !== activeWeek && (
                <button
                  type="button"
                  onClick={() => void selectWeek(activeWeek)}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Go to live {weekTitle(activeWeek)} →
                </button>
              )}
              <a
                href="/locker-room"
                className="text-sm text-muted hover:text-foreground underline-offset-2 hover:underline"
              >
                Locker Room
              </a>
              <a
                href="/"
                className="text-sm text-muted hover:text-foreground underline-offset-2 hover:underline"
              >
                Home
              </a>
            </div>
          </div>
        )}

        {hasCard && (
          <>
            {isPastOrOtherWeek && (
              <div className="mb-4 rounded-lg border border-border bg-card-hover px-4 py-3 text-sm text-muted space-y-2">
                <p>
                  🔒 Read-only archive of {weekTitle(viewWeek)}. Switch to{" "}
                  <button
                    type="button"
                    className="text-primary underline font-medium"
                    onClick={() => void selectWeek(activeWeek)}
                  >
                    {weekTitle(activeWeek)} (live)
                  </button>{" "}
                  to make picks.
                </p>
                {viewIsScored && (
                  <p>
                    <Link
                      href={`/board?week=${viewWeek}`}
                      className="text-primary font-semibold hover:underline"
                    >
                      Open The Board → see everyone&apos;s picks for{" "}
                      {weekTitle(viewWeek)}
                    </Link>
                  </p>
                )}
                {myWeekScore && (
                  <p className="text-foreground font-medium">
                    Your score:{" "}
                    <span className="text-primary text-lg tabular-nums">
                      {myWeekScore.totalPoints}
                    </span>{" "}
                    pts · {myWeekScore.correctCount}/{games.length} ATS
                    {weekPropResult ? (
                      <>
                        {" "}
                        · prop{" "}
                        {propChoice === weekPropResult ? "✓" : "✗"}
                      </>
                    ) : null}
                  </p>
                )}
              </div>
            )}

            {weekEditable && viewIsScored === false && scoredWeeks.length > 0 && (
              <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
                <Link
                  href={`/board?week=${scoredWeeks[scoredWeeks.length - 1]}`}
                  className="text-primary font-semibold hover:underline"
                >
                  See last week&apos;s Board (everyone&apos;s picks) →
                </Link>
              </div>
            )}

            {missedLockWindow && (
              <div className="mb-4 rounded-xl border-2 border-danger/60 bg-danger/15 px-4 py-3">
                <p className="text-sm font-bold text-danger">
                  🥛 Too late — first kickoff already hit
                </p>
                <p className="text-xs text-danger/90 mt-1.5 leading-relaxed">
                  All picks must be locked before{" "}
                  <strong>{formatCardLockDeadline(games)}</strong>. You never
                  locked. After first kickoff you <strong>cannot</strong> lock.
                  You score <strong>0</strong> this week. No makeups. Gazette
                  may put you on the milk carton.
                </p>
              </div>
            )}

            {weekEditable && cardFrozen && !missedLockWindow && (
              <div className="mb-4 rounded-lg border border-border bg-card-hover px-4 py-2 text-sm text-muted">
                🔒 First kickoff hit — entire card is frozen. No more changes.
              </div>
            )}

            {saveError && (
              <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
                {saveError}
              </div>
            )}
            {saved && weekEditable && !cardFrozen && (
              <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary">
                ✓ Card locked. You can still edit until{" "}
                <strong>first kickoff</strong> (
                {formatCardLockDeadline(games)}). After that the whole card
                freezes.
              </div>
            )}

            <div className="space-y-4 mb-8">
              {games.map((game) => {
                const pick = picks[game.id];
                const isBest = bestBetId === game.id;
                const displaySpread = pick?.lockedSpread ?? game.spread;
                const displayFavorite = pick?.lockedFavorite ?? game.favorite;
                const locked =
                  !weekEditable || cardFrozen || isGameLocked(game, now, games);
                const kick = formatKickoffLockLabel(game, now, games);
                const rankTier = getRankedMatchupTier(
                  game.awayRank,
                  game.homeRank
                );
                const rankBadge = rankedMatchupBadge(rankTier);
                const cover = weekResults[game.id];
                const gameScore = myWeekScore?.gameScores.find(
                  (s) => s.gameId === game.id
                );

                return (
                  <div
                    key={game.id}
                    className={`rounded-xl border bg-card p-4 transition ${rankedMatchupShellClass(
                      rankTier,
                      { bestBet: isBest }
                    )} ${locked && !rankTier ? "opacity-95" : ""} ${
                      gameScore?.correct
                        ? "ring-1 ring-primary/40"
                        : gameScore && cover && !gameScore.pushed
                          ? "ring-1 ring-danger/30"
                          : ""
                    }`}
                  >
                    <div className="mb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <div
                            className={`font-medium text-sm ${
                              rankTier === "legendary"
                                ? "text-amber-100"
                                : rankTier === "top25"
                                  ? "text-violet-100"
                                  : ""
                            }`}
                          >
                            {formatRankedTeam(game.awayTeam, game.awayRank)} @{" "}
                            {formatRankedTeam(game.homeTeam, game.homeRank)}
                          </div>
                          {rankBadge && (
                            <span className={rankBadge.className}>
                              {rankBadge.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {cover?.winner && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-primary border border-primary/40 px-1.5 py-0.5 rounded">
                              {cover.winner === "push"
                                ? "Push"
                                : cover.winner === "away"
                                  ? "Away covers"
                                  : "Home covers"}
                            </span>
                          )}
                          {gameScore && cover && (
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                gameScore.pushed
                                  ? "border border-border text-muted"
                                  : gameScore.correct
                                    ? "bg-primary/20 text-primary"
                                    : "bg-danger/15 text-danger"
                              }`}
                            >
                              {gameScore.pushed
                                ? "Push"
                                : gameScore.correct
                                  ? `+${gameScore.points}`
                                  : "Miss"}
                            </span>
                          )}
                          {locked && !cover && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-muted border border-border px-1.5 py-0.5 rounded">
                              Locked
                            </span>
                          )}
                          {isBest && (
                            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              BEST BET (2×)
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={`text-xs mt-1 ${
                          kick.locked ? "text-muted" : "text-primary"
                        }`}
                      >
                        {kick.label}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => selectSide(game.id, "away")}
                        className={`p-3 rounded-lg border text-left transition disabled:cursor-not-allowed ${
                          pick?.pick === "away"
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-muted disabled:opacity-70"
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                          Away
                        </div>
                        <div className="font-medium">
                          {formatRankedTeam(game.awayTeam, game.awayRank)}
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          {formatSpread(displaySpread, displayFavorite, "away")}
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => selectSide(game.id, "home")}
                        className={`p-3 rounded-lg border text-left transition disabled:cursor-not-allowed ${
                          pick?.pick === "home"
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-muted disabled:opacity-70"
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                          Home
                        </div>
                        <div className="font-medium">
                          {formatRankedTeam(game.homeTeam, game.homeRank)}
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          {formatSpread(displaySpread, displayFavorite, "home")}
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex gap-1.5 items-center">
                        {!pick?.pick && !locked && (
                          <span className="text-xs text-muted mr-2">
                            Pick a team first
                          </span>
                        )}
                        {confidenceOptions.map((c) => {
                          const usedElsewhere = Object.entries(picks).some(
                            ([id, p]) => id !== game.id && p.confidence === c
                          );
                          return (
                            <button
                              key={c}
                              type="button"
                              disabled={
                                locked || usedElsewhere || !pick?.pick
                              }
                              onClick={() => selectConfidence(game.id, c)}
                              className={`w-8 h-8 rounded text-sm font-medium transition ${
                                pick?.confidence === c
                                  ? "bg-primary text-black"
                                  : usedElsewhere || locked
                                    ? "bg-border text-muted cursor-not-allowed opacity-50"
                                    : "bg-card-hover hover:bg-border"
                              }`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => toggleBestBet(game.id)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          isBest
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border text-muted"
                        }`}
                      >
                        {isBest ? "★ Best Bet" : "Set Best Bet"}
                      </button>
                    </div>

                    {saved && pick && weekEditable && (
                      <div className="text-xs text-muted mt-2">
                        Saved line snapshot:{" "}
                        {formatSpread(
                          pick.lockedSpread,
                          pick.lockedFavorite,
                          pick.pick
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              className={`rounded-xl border bg-card p-4 mb-8 ${
                !canEditProp ? "border-border opacity-95" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-xs text-muted">
                  Weekly Prop • {prop.points} pts
                </div>
                {!canEditProp && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted border border-border px-1.5 py-0.5 rounded">
                    Locked
                  </span>
                )}
              </div>
              <div className="font-medium mb-3 leading-snug">{prop.question}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {prop.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={!canEditProp}
                    onClick={() => {
                      if (!canEditProp) return;
                      setSaved(false);
                      setPropChoice(opt);
                    }}
                    className={`min-h-[52px] p-3.5 rounded-lg border text-base sm:text-sm transition touch-manipulation disabled:cursor-not-allowed ${
                      propChoice === opt
                        ? "border-primary bg-primary/15 text-primary font-semibold ring-2 ring-primary/40"
                        : "border-border hover:border-muted disabled:opacity-70"
                    }`}
                  >
                    {propChoice === opt ? "✓ " : ""}
                    {opt}
                  </button>
                ))}
              </div>
              {weekEditable && propLockedNow && (
                <p className="text-[11px] text-muted mt-2">
                  Prop locked at the first kickoff on this card.
                </p>
              )}
              {weekEditable && canEditProp && !propChoice && (
                <p className="text-[11px] text-warning mt-2">
                  Tap one answer, then Save Picks.
                </p>
              )}
            </div>

            {weekEditable ? (
              <>
                <button
                  type="button"
                  onClick={() => void savePicks()}
                  disabled={!allGamesPicked || saving || fullyLocked}
                  className="w-full py-3 rounded-xl bg-primary text-black font-semibold disabled:opacity-50"
                >
                  {saving
                    ? "Saving…"
                    : fullyLocked
                      ? "Picks locked"
                      : saved
                        ? "Update open picks"
                        : "Save Picks"}
                </button>
                {!allGamesPicked && !fullyLocked && (
                  <p className="text-xs text-muted text-center mt-2">
                    Need: side + unique confidence on every open game, one Best
                    Bet, and a prop (until first kickoff).
                  </p>
                )}
              </>
            ) : (
              <p className="text-center text-sm text-muted py-3 rounded-xl border border-dashed border-border">
                Archive view — no changes allowed.{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => void selectWeek(activeWeek)}
                >
                  Open {weekTitle(activeWeek)} live picks
                </button>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
