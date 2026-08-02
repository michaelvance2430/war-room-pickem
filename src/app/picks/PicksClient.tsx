"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import PicksHowToModal from "@/components/PicksHowToModal";
import PicksPreOpenOddsModal from "@/components/PicksPreOpenOddsModal";
import FirstFinalModal from "@/components/FirstFinalModal";
import PicksSavedModal, {
  type PicksSavedModalDetail,
} from "@/components/PicksSavedModal";
import { Game, UserPick, Prop } from "@/lib/types";
import { getSession, getLeague } from "@/lib/league";
import Link from "next/link";
import {
  loadWeekCard,
  loadBestAvailableWeekCard,
  peekCachedWeekCard,
  bustWeekCardCache,
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
import {
  CHAOS_USES_PER_SEASON,
  forceEquipChaosTitle,
  generateChaosCard,
  getChaosUsesRemaining,
  isWeekChaosForUser,
  spendChaosUse,
} from "@/lib/chaos-mode";
import { canSurfaceChaosMode } from "@/lib/first-week";
import {
  isQuietPicksPath,
  quietPicksBonusHint,
  quietPicksBonusStartsOpen,
  quietPicksIntro,
} from "@/lib/picks-progressive";
import { isEyesLocalPlayActive } from "@/lib/creator-eyes";

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

/** Soft card poll — was 12s and felt like the page never settled */
const POLL_MS = 45_000;
/** Min gap between soft refreshes (focus/realtime storms) */
const SOFT_REFRESH_GAP_MS = 12_000;

export default function PicksClient() {
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
  /**
   * Shell always ready — never full-page "Loading…" forever.
   * Card content uses cardBusy instead.
   */
  const [loaded, setLoaded] = useState(true);
  /** Chaos Mode: robots filled the card; edits void the double (use already spent on lock) */
  const [chaosArmed, setChaosArmed] = useState(false);
  const [chaosConfirm, setChaosConfirm] = useState(false);
  const [chaosRemaining, setChaosRemaining] = useState(CHAOS_USES_PER_SEASON);
  const [chaosLockedWeek, setChaosLockedWeek] = useState(false);
  const [prop, setProp] = useState<Prop>(EMPTY_PROP);
  const [hasCard, setHasCard] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Card fetch in flight — shell is always painted; this only gates skeleton */
  const [cardBusy, setCardBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [cardNotice, setCardNotice] = useState<string | null>(null);
  /** Tooltip / flash when confidence tapped before a winner side */
  const [confTipGameId, setConfTipGameId] = useState<string | null>(null);
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
  /** Loud "YES you're saved" after lock / re-save */
  const [picksSavedModal, setPicksSavedModal] =
    useState<PicksSavedModalDetail | null>(null);
  /** First-time path: quieter chrome until first lock */
  const [quietPicks, setQuietPicks] = useState(true);
  /** Quiet first card: prop open by default so lock isn't blocked by a hidden control */
  const [bonusOpen, setBonusOpen] = useState(() => quietPicksBonusStartsOpen());
  const [eyesPreview, setEyesPreview] = useState(false);
  /** Client-only bored practice — never touches live season cards */
  const [practiceMode, setPracticeMode] = useState(false);
  /** True after local practice score — show W/L on the card */
  const [practiceScored, setPracticeScored] = useState(false);
  /**
   * Practice gate from window URL — avoid useSearchParams (Suspense hang on
   * some mobile Safari / PWA soft navigations from Standings).
   */
  const [practiceFromUrl, setPracticeFromUrl] = useState(false);

  const revisionRef = useRef<string>("");
  const viewWeekRef = useRef(1);
  const picksRef = useRef(picks);
  const bestBetRef = useRef(bestBetId);
  const propChoiceRef = useRef(propChoice);
  const savedRef = useRef(saved);
  /** Mount-once softRefresh must read current practice flag (not a stale false). */
  const practiceModeRef = useRef(false);
  const hasCardRef = useRef(false);
  const savingRef = useRef(false);
  const lastSoftRefreshAt = useRef(0);
  picksRef.current = picks;
  bestBetRef.current = bestBetId;
  propChoiceRef.current = propChoice;
  savedRef.current = saved;
  viewWeekRef.current = viewWeek;
  practiceModeRef.current = practiceMode;
  hasCardRef.current = hasCard;
  savingRef.current = saving;

  /** Hard leave practice — wipe client practice state and go live. */
  const leavePractice = useCallback((href: string) => {
    void import("@/lib/bored-practice").then((m) => {
      m.exitBoredPracticeToLive();
      window.location.assign(href);
    });
  }, []);

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
        if (mine.lockedAt) {
          void import("@/lib/first-week").then((m) =>
            m.markHasLockedPicksOnce(getSession()?.playerId)
          );
        }
        const used = Object.values(filtered)
          .map((p) => p.confidence)
          .filter((c) => c > 0);
        setUsedConfidence(used);
        const wasChaos =
          !!(mine as { isChaos?: boolean }).isChaos ||
          isWeekChaosForUser(week);
        setChaosLockedWeek(wasChaos);
        setChaosArmed(wasChaos);
      } else {
        picksRef.current = {};
        bestBetRef.current = null;
        propChoiceRef.current = null;
        setPicks({});
        setBestBetId(null);
        setPropChoice(null);
        setSaved(false);
        setUsedConfidence([]);
        setChaosLockedWeek(false);
        setChaosArmed(false);
      }
      setChaosRemaining(getChaosUsesRemaining());
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
      let session = getSession();
      let league = getLeague();

      // Phone: Standings works but Picks can race before local session is readable
      if (!session?.leagueId && opts.isInitial) {
        try {
          const { restoreSessionFromCloud } = await import(
            "@/lib/session-restore"
          );
          const restored = await Promise.race([
            restoreSessionFromCloud(),
            new Promise<{ status: "no_auth" }>((r) =>
              window.setTimeout(() => r({ status: "no_auth" }), 3_500)
            ),
          ]);
          if (restored.status === "restored") {
            session = getSession();
            league = getLeague();
          }
        } catch {
          /* keep null */
        }
      }

      if (!session?.leagueId) {
        if (opts.isInitial) {
          setLoadError(
            "No league selected. Go home and join or create a league."
          );
          setCardBusy(false);
        }
        return null;
      }

      const localWeek = (() => {
        try {
          const s = localStorage.getItem("warroom-active-week");
          const n = s != null ? parseInt(s, 10) : week;
          return Number.isFinite(n) ? n : week;
        } catch {
          return week;
        }
      })();

      let target = opts.explicit ? week : opts.isInitial ? localWeek : week;

      if (opts.isInitial) {
        setLeagueName(league?.name || "");
        setLoadError(null);
        setActiveWeek(localWeek);
        setViewWeek(localWeek);
        viewWeekRef.current = localWeek;
      }

      // Instant paint from warm cache / sessionStorage (Standings → Picks)
      const cached = peekCachedWeekCard(target);
      if (cached?.games?.length) {
        setHasCard(true);
        setGames(cached.games);
        setProp(cached.prop);
        setViewWeek(cached.weekNumber);
        viewWeekRef.current = cached.weekNumber;
        setCardBusy(false);
        setLoadError(null);
        // Background refresh picks — don't block games
        void applyCard(cached, {
          isInitial: !!opts.isInitial,
          forceReloadPicks: true,
        }).catch(() => {});
      } else if (opts.isInitial || opts.explicit) {
        setCardBusy(true);
      }

      try {
        // Parallel: resolve week + published list
        const [resolved, published] = await Promise.all([
          resolvePlayerActiveWeek({ persistIfOps: false }).catch(() => ({
            week: localWeek,
            leagueWeek: localWeek,
            advanced: false,
            scored: [] as number[],
          })),
          listPublishedWeekNumbers().catch(() => [] as number[]),
        ]);

        setActiveWeek(resolved.week);
        if (resolved.scored?.length) setScoredWeeks(resolved.scored);
        if (published.length) setPublishedWeeks(published);

        if (opts.isInitial) {
          target = resolved.week;
        }

        let cloud: CloudCard | null = null;

        if (opts.explicit) {
          // User picked a specific week — load that only
          cloud = await loadWeekCard(target);
          if (!cloud?.games?.length) {
            bustWeekCardCache(target);
            cloud = await loadWeekCard(target);
          }
        } else {
          // Initial / soft: shotgun any published card (fixes wrong-week hang)
          const best = await loadBestAvailableWeekCard(target);
          if (best?.card?.games?.length) {
            cloud = best.card;
            target = best.week;
          } else {
            // Bust + one more full search
            bustWeekCardCache();
            await new Promise((r) => window.setTimeout(r, 350));
            const retry = await loadBestAvailableWeekCard(target);
            if (retry?.card?.games?.length) {
              cloud = retry.card;
              target = retry.week;
            }
          }
        }

        setViewWeek(target);
        viewWeekRef.current = target;
        try {
          localStorage.setItem("warroom-active-week", String(target));
        } catch {
          /* ok */
        }

        if (!cloud?.games?.length) {
          // Keep any painted cache; only show empty when we never had games
          if (!cached?.games?.length) {
            setHasCard(false);
            setGames([]);
            setWeekResults({});
            setWeekPropResult(null);
            setWeekScoredAt(null);
          }
          setCardBusy(false);
          return null;
        }

        // Paint games NOW — never wait on picks/results
        setHasCard(true);
        setGames(cloud.games);
        setProp(cloud.prop);
        setLoadError(null);
        setCardBusy(false);

        void loadWeekResultsFromCloud(target)
          .then((res) => {
            if (viewWeekRef.current !== target) return;
            if (res) {
              setWeekResults(res.results);
              setWeekPropResult(res.propResult);
              setWeekScoredAt(res.scoredAt);
            } else {
              setWeekResults({});
              setWeekPropResult(null);
              setWeekScoredAt(null);
            }
          })
          .catch(() => {});

        void applyCard(cloud, {
          isInitial: !!opts.isInitial,
          forceReloadPicks: opts.forceReloadPicks || !!opts.explicit,
        }).catch(() => {});

        return cloud;
      } catch (e: unknown) {
        if (opts.isInitial && !cached?.games?.length) {
          setLoadError(
            e instanceof Error ? e.message : "Couldn’t load this week’s games."
          );
        }
        setCardBusy(false);
        return null;
      } finally {
        setCardBusy(false);
      }
    },
    [applyCard]
  );

  /** Poll / realtime: refresh current view week + active week number only. */
  const softRefresh = useCallback(async () => {
    // Private practice must never pull live cards / active week
    if (practiceModeRef.current) return;
    // Don't yank the card while the user is locking picks
    if (savingRef.current) return;
    const now = Date.now();
    if (now - lastSoftRefreshAt.current < SOFT_REFRESH_GAP_MS) return;
    lastSoftRefreshAt.current = now;

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
    setCardBusy(true);
    setSaveError(null);
    setCardNotice(null);
    revisionRef.current = "";
    try {
      await loadWeek(week, { forceReloadPicks: true, explicit: true });
    } finally {
      setSwitching(false);
      setCardBusy(false);
    }
  }

  // Practice flag from real URL (no useSearchParams)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setPracticeFromUrl(
        sp.get("practice") === "1" || sp.get("week") === "99"
      );
    } catch {
      setPracticeFromUrl(false);
    }
  }, []);

  // Client nav from /picks?practice=1 → /picks (Nav "Picks"): drop fake card.
  useEffect(() => {
    if (!practiceModeRef.current) return;
    if (practiceFromUrl) return;
    leavePractice("/picks");
  }, [practiceFromUrl, leavePractice]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null =
      null;

    // Kill leftover scroll locks from Standings modals / sheets
    try {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    } catch {
      /* ok */
    }

    // Fail-safe: keep retrying a few times — never "pull to reopen"
    let failSafeAttempts = 0;
    const failSafe = window.setInterval(() => {
      if (cancelled) return;
      if (hasCardRef.current) {
        window.clearInterval(failSafe);
        return;
      }
      failSafeAttempts += 1;
      if (failSafeAttempts > 4) {
        window.clearInterval(failSafe);
        setCardBusy(false);
        return;
      }
      try {
        bustWeekCardCache();
      } catch {
        /* ok */
      }
      void loadWeek(viewWeekRef.current, {
        isInitial: true,
        forceReloadPicks: true,
      });
    }, 3_500);

    void (async () => {
      // Bored practice: ONLY via explicit URL (?practice=1 or week=99).
      let practice = false;
      try {
        const { isBoredPracticeUrl } = await import("@/lib/bored-practice");
        practice = isBoredPracticeUrl();
      } catch {
        /* ok */
      }

      if (practice) {
        try {
          const {
            BORED_PRACTICE_WEEK,
            loadBoredLocalCard,
            loadBoredLocalPicks,
            loadBoredLocalResults,
            isBoredPracticeActive,
            exitBoredPracticeToLive,
          } = await import("@/lib/bored-practice");
          if (!isBoredPracticeActive()) {
            exitBoredPracticeToLive();
            if (typeof window !== "undefined") {
              const u = new URL(window.location.href);
              u.searchParams.delete("practice");
              u.searchParams.delete("run");
              u.searchParams.delete("fresh");
              if (u.searchParams.get("week") === "99") {
                u.searchParams.delete("week");
              }
              window.history.replaceState({}, "", u.pathname + u.search);
            }
          } else {
            const card = loadBoredLocalCard();
            if (card?.games?.length) {
              setPracticeMode(true);
              practiceModeRef.current = true;
              setActiveWeek(BORED_PRACTICE_WEEK);
              setViewWeek(BORED_PRACTICE_WEEK);
              viewWeekRef.current = BORED_PRACTICE_WEEK;
              setGames(card.games);
              setProp(card.prop);
              setHasCard(true);
              setLeagueName("Practice (not live)");
              setPublishedWeeks([]);
              setScoredWeeks([]);
              setLoadError(null);
              setCardNotice(null);
              setChaosArmed(false);
              setChaosLockedWeek(false);
              setChaosConfirm(false);
              setCardBusy(false);

              const mine = loadBoredLocalPicks();
              const validIds = new Set(card.games.map((g) => g.id));
              const locked =
                !!mine?.lockedAt &&
                mine.runId === card.runId &&
                Object.keys(mine.picks || {}).some((id) => validIds.has(id));

              if (locked && mine) {
                const filtered: Record<string, (typeof mine.picks)[string]> =
                  {};
                for (const [id, p] of Object.entries(mine.picks || {})) {
                  if (validIds.has(id)) filtered[id] = p;
                }
                setPicks(filtered);
                picksRef.current = filtered;
                setBestBetId(
                  mine.bestBetId && validIds.has(mine.bestBetId)
                    ? mine.bestBetId
                    : null
                );
                bestBetRef.current =
                  mine.bestBetId && validIds.has(mine.bestBetId)
                    ? mine.bestBetId
                    : null;
                setPropChoice(mine.propChoice);
                propChoiceRef.current = mine.propChoice;
                setSaved(true);
                savedRef.current = true;
                const used = Object.values(filtered)
                  .map((p) => p.confidence)
                  .filter((c) => c > 0);
                setUsedConfidence(used);
                const localRes = loadBoredLocalResults();
                if (localRes?.results && localRes.runId === card.runId) {
                  setWeekResults(localRes.results);
                  setWeekPropResult(localRes.propResult);
                  setWeekScoredAt(localRes.scoredAt);
                  setPracticeScored(true);
                }
              } else {
                setPicks({});
                picksRef.current = {};
                setBestBetId(null);
                setPropChoice(null);
                setSaved(false);
                setUsedConfidence([]);
              }
              window.clearInterval(failSafe);
              return;
            }
          }
        } catch {
          /* fall through */
        }
      }

      if (cancelled) return;
      setPracticeMode(false);
      practiceModeRef.current = false;
      try {
        // Instant local week label while cloud loads
        try {
          const s = localStorage.getItem("warroom-active-week");
          const n = s != null ? parseInt(s, 10) : 1;
          if (Number.isFinite(n)) {
            setActiveWeek(n);
            setViewWeek(n);
            viewWeekRef.current = n;
          }
        } catch {
          /* ignore */
        }
        await loadWeek(viewWeekRef.current, { isInitial: true });
      } catch {
        setLoadError(null);
        setCardBusy(false);
        // One more silent retry — app recovers itself
        if (!cancelled) {
          window.setTimeout(() => {
            if (cancelled) return;
            void loadWeek(viewWeekRef.current, {
              isInitial: true,
              forceReloadPicks: true,
            });
          }, 600);
        }
      } finally {
        // Only stop auto-retry when games are on screen
        if (hasCardRef.current) window.clearInterval(failSafe);
      }
    })();

    const poll = setInterval(() => {
      if (practiceModeRef.current) return;
      void softRefresh();
    }, POLL_MS);

    const onVisible = () => {
      if (practiceModeRef.current) return;
      if (document.visibilityState === "visible") void softRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const tick = window.setInterval(() => setNow(Date.now()), 30_000);

    // Defer realtime — subscribing on open can freeze mobile WebViews
    const subTimer = window.setTimeout(() => {
      if (cancelled || practiceModeRef.current) return;
      try {
        const session = getSession();
        if (!session?.leagueId) return;
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
          .subscribe();
      } catch {
        /* poll still works */
      }
    }, 2_500);

    return () => {
      cancelled = true;
      window.clearInterval(failSafe);
      window.clearTimeout(subTimer);
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
  // Practice always stays on week 99 for both active + view (never live active week).
  const isPastOrOtherWeek = practiceMode
    ? false
    : viewWeek !== activeWeek;
  /** Can edit anything on this view? Active week, or open practice card. */
  const weekEditable = practiceMode
    ? hasCard && !practiceScored && !saved
    : !isPastOrOtherWeek;
  /** Practice: never freeze on kickoff — only after local lock/score. */
  const cardDeadlinePassed = practiceMode
    ? false
    : isCardLockDeadlinePassed(games, now);
  /** True if they previously saved/locked this week (from cloud or practice). */
  const hadLockedCard = saved;
  /**
   * After first kickoff on the card: entire slate freezes.
   * Never locked → cannot lock (0 pts). Already locked → read-only.
   * Practice: freeze only after lock so the week can finish cleanly.
   */
  const missedLockWindow =
    !practiceMode &&
    weekEditable &&
    cardDeadlinePassed &&
    !hadLockedCard &&
    hasCard;
  const cardFrozen = practiceMode
    ? saved || practiceScored
    : weekEditable && cardDeadlinePassed && hasCard;
  const propLockedNow =
    practiceMode
      ? saved || practiceScored
      : isPropLocked(games, now) || cardFrozen;
  const openCount = practiceMode
    ? saved || practiceScored
      ? 0
      : games.length
    : openGameCount(games, now);
  const allGamesLocked = games.length > 0 && openCount === 0;
  const canEditProp =
    practiceMode
      ? !saved && !practiceScored
      : weekEditable && !propLockedNow && !cardFrozen;
  /** Practice stays editable until lock (weekEditable handles post-lock). */
  const fullyLocked = practiceMode
    ? saved || practiceScored
    : isPastOrOtherWeek ||
      cardFrozen ||
      (allGamesLocked && (!prop.question || propLockedNow));

  const confidenceOptions = [1, 2, 3, 4, 5];

  function selectSide(gameId: string, side: "home" | "away") {
    if (!weekEditable || cardFrozen) return;
    // Chaos committed = no human control (no undo)
    if (chaosArmed || chaosLockedWeek) return;
    const game = games.find((g) => g.id === gameId);
    if (!game || isGameLocked(game, now, games)) return;

    setSaved(false);
    setConfTipGameId(null);
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
    if (!weekEditable || cardFrozen || chaosArmed || chaosLockedWeek) return;
    const game = games.find((g) => g.id === gameId);
    if (!game || isGameLocked(game, now, games)) return;

    // Must pick a winner (side) before confidence
    if (!picks[gameId]?.pick) {
      setConfTipGameId(gameId);
      return;
    }

    setConfTipGameId(null);

    // Tap selected number again → deselect (free that confidence for another game)
    if (picks[gameId]?.confidence === conf) {
      setSaved(false);
      setPicks((prev) => {
        const next = {
          ...prev,
          [gameId]: {
            ...prev[gameId],
            gameId,
            pick: prev[gameId].pick,
            confidence: 0,
            isBestBet: bestBetId === gameId,
            lockedSpread: game.spread,
            lockedFavorite: game.favorite,
          },
        };
        const used = Object.values(next)
          .map((p) => p.confidence)
          .filter((c) => c >= 1 && c <= 5);
        setUsedConfidence(used);
        return next;
      });
      return;
    }

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
    if (!weekEditable || cardFrozen || chaosArmed || chaosLockedWeek) return;
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
    // Practice: allow lock while still open (weekEditable may flip after score)
    const canPracticeLock =
      practiceMode && hasCard && !saved && !practiceScored;
    if (saving || !hasCard) return;
    if (!practiceMode && !weekEditable) return;
    if (practiceMode && !canPracticeLock) return;
    setSaving(true);
    setSaveError(null);

    // —— Private bored practice (client-only, no live season) ——
    if (practiceMode) {
      try {
        const {
          loadBoredLocalCard,
          saveBoredLocalPicks,
          loadBoredLocalResults,
          getBoredPracticeState,
          scoreBoredPracticeLocally,
        } = await import("@/lib/bored-practice");
        const card = loadBoredLocalCard();
        const state = getBoredPracticeState();
        if (!card?.games?.length || !state) {
          setSaveError(
            "Practice card missing — go Home and tap I’m bored again."
          );
          setSaving(false);
          return;
        }
        const cardGames = card.games;
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
        if (Object.keys(lockedPicks).length !== cardGames.length) {
          setSaveError("Pick a side and confidence for every game.");
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
          setBonusOpen(true);
          setSaveError("Bonus is required — pick a prop side, then lock.");
          setSaving(false);
          return;
        }
        saveBoredLocalPicks({
          runId: state.runId,
          picks: lockedPicks,
          bestBetId: nextBest,
          propChoice: nextProp,
          lockedAt: new Date().toISOString(),
        });
        setPicks(lockedPicks);
        picksRef.current = lockedPicks;
        setBestBetId(nextBest);
        bestBetRef.current = nextBest;
        setPropChoice(nextProp);
        propChoiceRef.current = nextProp;
        setSaved(true);
        savedRef.current = true;
        try {
          const { markHasLockedPicksOnce } = await import("@/lib/first-week");
          markHasLockedPicksOnce(getSession()?.playerId);
          const { completePlayerTutorial, isPlayerTutorialActive } =
            await import("@/lib/player-tutorial");
          if (isPlayerTutorialActive()) completePlayerTutorial();
        } catch {
          /* ok */
        }
        // Instant local score → done modal (never cloud, never live week)
        const scored = scoreBoredPracticeLocally();
        if (!scored.ok) {
          setSaveError(scored.message || "Couldn’t finish practice week.");
          setSaving(false);
          return;
        }
        const localRes = loadBoredLocalResults();
        if (localRes?.results) {
          setWeekResults(localRes.results);
          setWeekPropResult(localRes.propResult);
          setWeekScoredAt(localRes.scoredAt);
        }
        setPracticeScored(true);
        // No generic “saved” popup — BoredPracticeDoneModal is the ending
        setPicksSavedModal(null);
        setSaving(false);
        return;
      } catch (e) {
        setSaveError(
          e instanceof Error ? e.message : "Practice lock failed"
        );
        setSaving(false);
        return;
      }
    }

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
      setBonusOpen(true);
      setSaveError(
        "Bonus is required — pick one side on the prop below, then lock."
      );
      setSaving(false);
      try {
        document
          .getElementById("weekly-prop-card")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        /* ignore */
      }
      return;
    }

    const result = await savePicksToCloud({
      weekNumber: activeWeek,
      picks: lockedPicks,
      bestBetId: nextBest,
      propChoice: nextProp,
      isChaos: chaosArmed || chaosLockedWeek,
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
    if (chaosArmed || chaosLockedWeek) {
      setChaosLockedWeek(true);
      setChaosArmed(true);
      setChaosRemaining(getChaosUsesRemaining());
    }
    try {
      sessionStorage.setItem("warroom-tut-picks-saved", "1");
      const { completePlayerTutorial, isPlayerTutorialActive } = await import(
        "@/lib/player-tutorial"
      );
      if (isPlayerTutorialActive()) completePlayerTutorial();
    } catch {
      /* ignore */
    }
    // First-week unlock: cheevo popups + deep home tiles after first lock
    try {
      const { markHasLockedPicksOnce } = await import("@/lib/first-week");
      markHasLockedPicksOnce(getSession()?.playerId);
    } catch {
      /* ignore */
    }

    // Easter egg: Lucky Seven (7:07:07 lock) — zero points
    try {
      const { checkLuckySevenLock, EVENT_EASTER_EGG } = await import(
        "@/lib/easter-eggs"
      );
      const moment = checkLuckySevenLock(getSession()?.playerId || "");
      if (moment) {
        window.dispatchEvent(
          new CustomEvent(EVENT_EASTER_EGG, { detail: moment })
        );
      }
    } catch {
      /* ignore */
    }

    const lockLabel = formatCardLockDeadline(cardGames);
    const weekLabel =
      weekTitle(activeWeek, getLeague()?.sportId) || `Week ${activeWeek}`;

    // Always confirm save loudly — First & Final note rides in the same modal
    if (result.firstFinal === "earned") {
      setCardNotice(
        `🔒 First & Final active for Week ${activeWeek} — change any pick and you lose +25 season & career.`
      );
    } else if (result.firstFinal === "forfeit") {
      const removed = Math.abs(result.firstFinalPointsDelta ?? 25);
      setCardNotice(
        (result.firstFinalPointsDelta ?? 0) < 0
          ? `First & Final voided — −${removed} season & career cheevo pts.`
          : `Week ${activeWeek} first-lock voided (you still have another clean week).`
      );
    } else {
      setCardNotice(null);
    }

    // One clear popup: YES saved (+ optional First & Final note). No double stack.
    setFirstFinalModal(null);
    setPicksSavedModal({
      weekLabel,
      lockDeadlineLabel: lockLabel || null,
      isUpdate: alreadyLocked,
      firstFinal:
        result.firstFinal === "earned" || result.firstFinal === "forfeit"
          ? result.firstFinal
          : null,
      firstFinalPointsRemoved:
        result.firstFinal === "forfeit"
          ? Math.abs(result.firstFinalPointsDelta ?? 0) || undefined
          : undefined,
    });

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

  // Keep quiet mode in sync (unlocks after first lock)
  useEffect(() => {
    setQuietPicks(isQuietPicksPath());
    try {
      setEyesPreview(isEyesLocalPlayActive());
    } catch {
      setEyesPreview(false);
    }
  }, [saved, loaded, fullyLocked]);

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

  const viewIsScored =
    practiceMode && practiceScored
      ? true
      : scoredWeeks.includes(viewWeek);
  const myWeekScore =
    hasCard &&
    (viewIsScored || (practiceMode && Object.keys(weekResults).length > 0)) &&
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

  return (
    <div className="min-h-screen flex flex-col">
      {!practiceMode && <PicksPreOpenOddsModal />}
      <PicksHowToModal />
      <PicksSavedModal
        detail={picksSavedModal}
        onClose={() => setPicksSavedModal(null)}
      />
      {firstFinalModal && (
        <FirstFinalModal
          mode={firstFinalModal.mode}
          weekNumber={firstFinalModal.weekNumber}
          pointsRemoved={firstFinalModal.pointsRemoved}
          onClose={() => setFirstFinalModal(null)}
        />
      )}

      <main className="flex-1 max-w-3xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-8 phone-picks-main">
        {eyesPreview && (
          <div className="mb-4 rounded-lg border border-sky-400/50 bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-100 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>PREVIEW · local card · not your real standings</span>
      <Link href="/founder#eyes" className="underline">
              Foundry eyes
            </Link>
      <button
              type="button"
              className="underline font-extrabold"
              onClick={() => {
                void import("@/lib/creator-eyes").then((m) => {
                  m.setCreatorEyesMode("off");
                  window.location.href = "/founder#eyes";
                });
              }}
            >
              Exit → Foundry
            </button>
      </div>
        )}

        {practiceMode && (
          <div className="mb-4 rounded-xl border-2 border-dashed border-amber-400/70 bg-amber-500/10 px-4 py-3.5 space-y-3">
      <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300 mb-1">
                I&apos;m bored · fake week · not your real card
              </p>
      <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                {practiceScored || saved
                  ? "This graded card is practice only. Real Week 1 (or live week) lives behind Exit. Nav “Picks” without practice in the URL also drops you into the real season."
                  : "These games are made up. Lock the card; we grade it on your phone only. Real week cards and standings stay untouched."}
              </p>
      </div>
            <div className="flex flex-col sm:flex-row gap-2">
      <button
                type="button"
                onClick={() => leavePractice("/picks")}
                className="min-h-[48px] px-4 rounded-xl bg-primary text-black text-sm font-extrabold touch-manipulation"
              >
                Exit practice → real picks
              </button>
      <button
                type="button"
                onClick={() => leavePractice("/")}
                className="min-h-[48px] px-4 rounded-xl border border-amber-400/50 text-amber-100 text-sm font-bold touch-manipulation"
              >
                Home (live season)
              </button>
      </div>
          </div>
        )}

        {quietPicks && !practiceMode && weekEditable && hasCard && !cardFrozen && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted leading-relaxed">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary mb-1">
              First lock · don&apos;t overthink it
            </p>
      <p className="text-foreground/90">{quietPicksIntro()}</p>
      </div>
        )}

        {/* Progress bubble — sticky under nav so it stays visible while picking */}
        {hasCard && weekEditable && !cardFrozen && games.length > 0 && (
          <div
            className="sticky z-[45] mb-4 -mx-1 px-1"
            style={{
              // Sit just under sticky Nav header (+ safe area)
              top: "calc(env(safe-area-inset-top, 0px) + 3.35rem)",
            }}
          >
      <div
              className={`rounded-2xl border px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md ${
                allGamesPicked
                  ? "border-primary/45 bg-primary/15"
                  : "border-border/70 bg-card/75"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                  This card
                </p>
                {allGamesPicked ? (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    Ready to lock ↓
                  </p>
                ) : (
                  <p className="text-[10px] font-medium text-muted/90 truncate">
                    {(() => {
                      const need: string[] = [];
                      if (
                        games.filter((g) => picks[g.id]?.pick).length <
                        games.length
                      )
                        need.push("sides");
                      if (
                        games.filter((g) => (picks[g.id]?.confidence ?? 0) > 0)
                          .length < games.length
                      )
                        need.push("conf");
                      if (!bestBetId) need.push("Best Bet");
                      if (prop.question && !propChoice) need.push("prop");
                      return need.length
                        ? `Left: ${need.join(" · ")}`
                        : "Almost";
                    })()}
                  </p>
                )}
              </div>
      <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                {(
                  [
                    {
                      key: "sides",
                      done:
                        games.filter((g) => picks[g.id]?.pick).length >=
                        games.length,
                      label: `${games.filter((g) => picks[g.id]?.pick).length}/${games.length} sides`,
                    },
                    {
                      key: "conf",
                      done:
                        games.filter((g) => (picks[g.id]?.confidence ?? 0) > 0)
                          .length >= games.length,
                      label: `${
                        games.filter((g) => (picks[g.id]?.confidence ?? 0) > 0)
                          .length
                      }/${games.length} conf`,
                    },
                    {
                      key: "bb",
                      done: !!bestBetId,
                      label: bestBetId ? "Best Bet ✓" : "Best Bet —",
                    },
                    ...(prop.question
                      ? [
                          {
                            key: "prop",
                            done: !!propChoice,
                            label: propChoice ? "Prop ✓" : "Prop —",
                          },
                        ]
                      : []),
                  ] as { key: string; done: boolean; label: string }[]
                ).map((chip) => (
                  <span
                    key={chip.key}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold tabular-nums border ${
                      chip.done
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border/60 bg-black/30 text-foreground/85"
                    }`}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
              {(() => {
                const used = usedConfidence.filter((c) => c >= 1 && c <= 5);
                const left = [1, 2, 3, 4, 5].filter((c) => !used.includes(c));
                if (left.length === 0 || left.length === 5) return null;
                return (
                  <p className="text-[11px] text-muted mt-1.5">
                    Confidence left:{" "}
                    <span className="text-foreground font-semibold tabular-nums">
                      {left.join(", ")}
                    </span>
      </p>
                );
              })()}
              {allGamesPicked && (
                <p className="text-[11px] text-primary font-semibold mt-1.5">
                  Card full — hit Lock at the bottom.
                </p>
              )}
            </div>
      </div>
        )}

        {/* Chaos Mode — mid-season spice (week 2+); hide on quiet first path + practice */}
        {!practiceMode &&
          weekEditable &&
          hasCard &&
          !cardFrozen &&
          !missedLockWindow &&
          !quietPicks &&
          canSurfaceChaosMode(activeWeek, {
            alreadyChaosThisWeek: chaosArmed || chaosLockedWeek,
          }) && (
          <div className="rounded-xl border-2 border-orange-500/50 bg-gradient-to-br from-orange-950/50 via-red-950/30 to-black/40 px-4 py-3 mb-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300 mb-1">
              🤖 Chaos Mode · pure RNG
            </p>
      <p className="text-sm text-foreground/90 leading-snug">
              Tired of thinking? Let the machines cook. Completely random sides,
              confidence, Best Bet, and prop —{" "}
              <strong className="text-orange-200">no edge</strong>. Correct week{" "}
              <strong className="text-orange-200">doubles</strong>. Your name
              gets <strong className="text-orange-200">🔥 CHAOS flames</strong>{" "}
              so the whole room knows.{" "}
              <span className="text-muted">
                {chaosRemaining}/{CHAOS_USES_PER_SEASON} left this season.
              </span>
      </p>
            {(chaosArmed || chaosLockedWeek) && (
              <p className="text-xs font-bold text-orange-300 mt-2">
                🔥 Chaos is live — no undo. Card frozen to the robots. Title
                locked as Chaos Agent. Hit Save/lock so the room sees it.
              </p>
            )}
            {weekEditable &&
              !chaosArmed &&
              !chaosLockedWeek &&
              chaosRemaining > 0 &&
              !fullyLocked && (
                <button
                  type="button"
                  onClick={() => setChaosConfirm(true)}
                  className="mt-3 w-full py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white text-sm font-extrabold touch-manipulation shadow-lg"
                >
                  Let them cook 🔥 ({chaosRemaining} left)
                </button>
              )}
            {chaosRemaining <= 0 && !chaosLockedWeek && (
              <p className="text-[11px] text-muted mt-2">
                No Chaos charges left this season. Hand-pick like a human.
              </p>
            )}
          </div>
        )}

        {chaosConfirm && (
          <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
              type="button"
              className="absolute inset-0 bg-black/75"
              aria-label="Close"
              onClick={() => setChaosConfirm(false)}
            />
            <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-2 border-orange-500/60 bg-card p-5 space-y-3 max-h-[90vh] overflow-y-auto">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">
                Chaos Mode · no take-backs
              </p>
      <h2 className="text-xl font-black">Are you sure?</h2>
      <p className="text-sm text-orange-200/90 font-semibold leading-snug">
                Once you go Chaos, it is out of your hands. No undo. No edits.
                The room will see the flames.
              </p>
      <ul className="text-sm text-muted space-y-1.5 list-disc pl-4">
                <li>Pure random — coin flips only (no AI edge)</li>
      <li>Legal card filled for you — you cannot change it</li>
      <li>
                  Title forced to{" "}
                  <strong className="text-orange-200">Chaos Agent</strong> —
                  you can&apos;t pick or swap it off this week
                </li>
      <li>
                  <strong className="text-foreground">2× week points</strong>{" "}
                  when scored · uses{" "}
                  <strong className="text-foreground">1 of 2</strong> season
                  charges now
                </li>
      <li>🔥 CHAOS on your name everywhere until the week is done</li>
      </ul>
              <button
                type="button"
                onClick={() => {
                  const spent = spendChaosUse(activeWeek);
                  if (!spent.ok) {
                    setSaveError(spent.error || "No Chaos left");
                    setChaosConfirm(false);
                    return;
                  }
                  void forceEquipChaosTitle();
                  const filled = generateChaosCard({ games, prop });
                  setPicks(filled.picks);
                  setBestBetId(filled.bestBetId);
                  setPropChoice(filled.propChoice);
                  const used = Object.values(filled.picks)
                    .map((p) => p.confidence)
                    .filter((c) => c > 0);
                  setUsedConfidence(used);
                  setChaosArmed(true);
                  setChaosLockedWeek(true);
                  setChaosRemaining(spent.remaining);
                  setSaved(false);
                  setChaosConfirm(false);
                }}
                className="w-full py-3.5 min-h-[52px] rounded-xl bg-orange-600 text-white font-extrabold"
              >
                Yes — go Chaos, no undo
              </button>
      <button
                type="button"
                onClick={() => setChaosConfirm(false)}
                className="w-full py-3 min-h-[48px] rounded-xl border border-border text-muted font-semibold"
              >
                Cancel — keep control
              </button>
      </div>
          </div>
        )}

        {/* Crystal-clear week banner — practice vs live never share chrome */}
        <div
          className={`rounded-xl border px-4 py-3 mb-4 ${
            practiceMode
              ? "border-2 border-dashed border-amber-400/70 bg-amber-500/10"
              : weekEditable
                ? chaosArmed || chaosLockedWeek
                  ? "border-orange-500/50 bg-orange-500/10"
                  : "border-primary/50 bg-primary/10"
                : "border-border bg-card"
          }`}
        >
      <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                practiceMode
                  ? "text-amber-300"
                  : weekEditable
                    ? "text-primary"
                    : "text-muted"
              }`}
            >
              {practiceMode
                ? practiceScored || saved
                  ? "Fake week · finished · not the season"
                  : "Fake week · go cook · not the season"
                : weekEditable
                  ? "You are cooking"
                  : "Just looking"}
            </span>
            {practiceMode ? (
              <span className="text-xs px-2 py-0.5 rounded-full border border-amber-400/60 text-amber-100 font-semibold bg-amber-500/15">
                FAKE · NOT LIVE
              </span>
            ) : weekEditable ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-black font-semibold">
                LIVE SEASON
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted">
                READ-ONLY
              </span>
            )}
          </div>
      <h1 className="text-2xl font-bold">
            {practiceMode
              ? practiceScored || saved
                ? "Practice week — you survived"
                : "Practice week picks"
              : `${weekTitle(viewWeek)}${weekEditable ? " Picks" : " — your card"}`}
          </h1>
      <p className="text-sm text-muted mt-1">
            {practiceMode
              ? practiceScored || saved
                ? "Graded on your phone only. Real standings never noticed. Exit practice for your real card."
                : "Private dry-run. Lock when ready — we grade it and show how the room wakes up."
              : `${leagueName ? `${leagueName} · ` : ""}${
                  weekEditable
                    ? missedLockWindow
                      ? "First kickoff hit and you never locked. Card closed. 0 pts. The Gazette remembers."
                      : cardFrozen
                        ? "First kickoff hit — entire card is frozen. No more hero edits."
                        : `Lock everything before first kickoff (${formatCardLockDeadline(games)}) or cry later.`
                    : viewWeek < activeWeek
                      ? `Past week · league is on ${weekTitle(activeWeek)}. Look, don’t touch.`
                      : `Not the active week (league is on ${weekTitle(activeWeek)}). Read-only. Enjoy the archive.`
                }`}
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

        {/* Week browser — never show live weeks during private practice */}
        {!practiceMode && weekPills.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-3 mb-6">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-2 font-semibold">
              Jump to week
            </p>
      <div className="phone-h-scroll sm:flex-wrap sm:overflow-visible">
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
                    className={`px-3.5 py-2.5 min-h-[40px] rounded-full text-xs font-semibold transition touch-manipulation ${
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
              show your results.{" "}
              <Link
                href={`/board?week=${viewWeek}`}
                className="text-primary font-medium hover:underline"
              >
                The Board
              </Link>{" "}
              shows everyone&apos;s cards after first kickoff locks the week.
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

        {!loadError && !hasCard && cardBusy && (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
      <div className="mx-auto w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm font-semibold text-foreground">
              Loading {weekTitle(viewWeek)}…
            </p>
      <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
              Pulling the card for you — hang tight.
            </p>
      </div>
        )}

        {!loadError && !hasCard && !cardBusy && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
              No card yet
            </p>
      <p className="font-medium mb-2">
              No games for {weekTitle(viewWeek)} yet
            </p>
      <p className="text-sm text-muted mb-4 max-w-md mx-auto leading-relaxed">
              {viewWeek === activeWeek
                ? "Your commish hasn’t published this week’s card. Nothing for you to fix — when it’s live, open My Picks again."
                : "This week wasn’t published (or was cleared)."}
            </p>
      <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCardBusy(true);
                  setLoadError(null);
                  void loadWeek(viewWeek, {
                    forceReloadPicks: true,
                    explicit: true,
                  });
                }}
                className="px-4 py-2.5 min-h-[44px] rounded-xl bg-primary text-black text-sm font-bold"
              >
                Check again
              </button>
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
                {(viewIsScored ||
                  (hasCard && isCardLockDeadlinePassed(games, now))) && (
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

            {weekEditable &&
              hasCard &&
              isCardLockDeadlinePassed(games, now) && (
                <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
      <Link
                    href={`/board?week=${viewWeek}`}
                    className="text-primary font-semibold hover:underline"
                  >
                    First kickoff hit — The Board is open (everyone&apos;s picks) →
                  </Link>
      </div>
              )}
            {weekEditable &&
              !isCardLockDeadlinePassed(games, now) &&
              scoredWeeks.length > 0 && (
                <div className="mb-4 rounded-lg border border-border bg-card-hover px-4 py-2 text-sm">
      <Link
                    href={`/board?week=${scoredWeeks[scoredWeeks.length - 1]}`}
                    className="text-primary font-semibold hover:underline"
                  >
                    See last week&apos;s Board →
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
                                  : rankTier === "ranked"
                                    ? "text-emerald-100"
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

                    <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
      <button
                        type="button"
                        disabled={locked}
                        onClick={() => selectSide(game.id, "away")}
                        className={`min-h-[72px] p-3 sm:p-3.5 rounded-xl border text-left transition touch-manipulation active:scale-[0.98] disabled:cursor-not-allowed ${
                          pick?.pick === "away"
                            ? "border-primary bg-primary/15 ring-2 ring-primary/40"
                            : "border-border hover:border-muted disabled:opacity-70"
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                          Away
                        </div>
      <div className="font-semibold text-[15px] sm:text-base leading-snug">
                          {formatRankedTeam(game.awayTeam, game.awayRank)}
                        </div>
      <div className="text-sm text-muted mt-1 font-medium">
                          {formatSpread(displaySpread, displayFavorite, "away")}
                        </div>
      </button>

                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => selectSide(game.id, "home")}
                        className={`min-h-[72px] p-3 sm:p-3.5 rounded-xl border text-left transition touch-manipulation active:scale-[0.98] disabled:cursor-not-allowed ${
                          pick?.pick === "home"
                            ? "border-primary bg-primary/15 ring-2 ring-primary/40"
                            : "border-border hover:border-muted disabled:opacity-70"
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                          Home
                        </div>
      <div className="font-semibold text-[15px] sm:text-base leading-snug">
                          {formatRankedTeam(game.homeTeam, game.homeRank)}
                        </div>
      <div className="text-sm text-muted mt-1 font-medium">
                          {formatSpread(displaySpread, displayFavorite, "home")}
                        </div>
      </button>
                    </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                          Confidence
                        </span>
      <div className="flex gap-2 items-center">
                          {confidenceOptions.map((c) => {
                            const usedElsewhere = Object.entries(picks).some(
                              ([id, p]) => id !== game.id && p.confidence === c
                            );
                            const selected = pick?.confidence === c;
                            const needSide = !pick?.pick && !locked;
                            return (
                              <button
                                key={c}
                                type="button"
                                disabled={locked || usedElsewhere}
                                title={
                                  needSide
                                    ? "You must pick a winner before assigning confidence points."
                                    : selected
                                      ? "Tap again to clear this confidence"
                                      : usedElsewhere
                                        ? "Already used on another game"
                                        : `Confidence ${c}`
                                }
                                aria-label={
                                  needSide
                                    ? "Pick a winner before assigning confidence"
                                    : selected
                                      ? `Clear confidence ${c}`
                                      : `Set confidence ${c}`
                                }
                                onClick={() => selectConfidence(game.id, c)}
                                className={`w-11 h-11 min-w-[44px] rounded-xl text-base font-bold transition touch-manipulation active:scale-95 ${
                                  selected
                                    ? "bg-primary text-black shadow-[0_0_12px_rgba(34,197,94,0.35)]"
                                    : usedElsewhere || locked
                                      ? "bg-border text-muted cursor-not-allowed opacity-50"
                                      : needSide
                                        ? "bg-card-hover hover:bg-border border border-border opacity-80"
                                        : "bg-card-hover hover:bg-border border border-border"
                                }`}
                              >
                                {c}
                              </button>
                            );
                          })}
                        </div>
                        {confTipGameId === game.id && !pick?.pick && !locked && (
                          <p
                            role="tooltip"
                            className="text-xs text-amber-200 font-medium leading-snug max-w-xs"
                          >
                            You must pick a winner before assigning confidence
                            points.
                          </p>
                        )}
                      </div>
      <button
                        type="button"
                        disabled={locked}
                        onClick={() => toggleBestBet(game.id)}
                        className={`min-h-[44px] text-sm px-4 py-2.5 rounded-xl border font-semibold transition touch-manipulation disabled:cursor-not-allowed disabled:opacity-60 self-stretch sm:self-auto ${
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
              id="weekly-prop-card"
              className={`rounded-xl border bg-card p-4 mb-8 ${
                !canEditProp ? "border-border opacity-95" : "border-border"
              }`}
            >
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 text-left"
                onClick={() => setBonusOpen((o) => !o)}
                disabled={!quietPicks}
              >
                <div>
      <div className="text-xs text-muted">
                    {quietPicks ? "Bonus" : "Weekly Prop"} · {prop.points} pts
                    {propChoice ? (
                      <span className="text-primary font-semibold"> · set</span>
                    ) : quietPicks ? (
                      <span className="text-warning"> · needed</span>
                    ) : null}
                  </div>
                  {(!quietPicks || bonusOpen || propChoice) && (
                    <div className="font-medium mt-1 leading-snug">
                      {prop.question}
                    </div>
                  )}
                </div>
                {quietPicks && (
                  <span className="text-xs text-primary font-bold shrink-0">
                    {bonusOpen || propChoice ? "Hide" : "Open"}
                  </span>
                )}
                {!canEditProp && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted border border-border px-1.5 py-0.5 rounded">
                    Locked
                  </span>
                )}
              </button>
              {quietPicks && !bonusOpen && !propChoice && (
                <p className="text-[11px] text-muted mt-2">
                  {quietPicksBonusHint()}
                </p>
              )}
              {(!quietPicks || bonusOpen || !!propChoice) && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {prop.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        disabled={!canEditProp || chaosArmed || chaosLockedWeek}
                        onClick={() => {
                          if (!canEditProp || chaosArmed || chaosLockedWeek)
                            return;
                          setSaved(false);
                          setPropChoice(opt);
                          setBonusOpen(true);
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
                      Bonus locked at the first kickoff on this card.
                    </p>
                  )}
                  {weekEditable && canEditProp && !propChoice && (
                    <p className="text-[11px] text-warning mt-2">
                      Tap one answer, then Lock it in.
                    </p>
                  )}
                </>
              )}
            </div>

            {practiceMode && (practiceScored || saved) ? (
              <div className="rounded-xl border-2 border-dashed border-amber-400/60 bg-amber-500/10 px-4 py-4 space-y-2 text-center">
      <p className="text-sm font-bold text-foreground">
                  Fake week graded
                  {weekScoredAt
                    ? ` · ${Object.keys(weekResults).length} games roasted`
                    : ""}
                </p>
      <p className="text-xs text-muted leading-relaxed">
                  Practice is over for this run. Leave to open live season picks
                  — or tour Board / Gazette (still leaves practice).
                </p>
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => leavePractice("/picks")}
                    className="flex-1 py-3 min-h-[48px] rounded-xl bg-primary text-black text-sm font-extrabold flex items-center justify-center touch-manipulation"
                  >
                    Real picks
                  </button>
      <button
                    type="button"
                    onClick={() => leavePractice("/")}
                    className="flex-1 py-3 min-h-[48px] rounded-xl border border-amber-400/50 text-amber-100 text-sm font-bold flex items-center justify-center touch-manipulation"
                  >
                    Home
                  </button>
      <button
                    type="button"
                    onClick={() => leavePractice("/board")}
                    className="flex-1 py-3 min-h-[48px] rounded-xl border border-border text-sm font-bold text-foreground flex items-center justify-center touch-manipulation"
                  >
                    Peek Board
                  </button>
      </div>
              </div>
            ) : weekEditable || (practiceMode && !saved) ? (
              <div className="phone-sticky-action">
      <button
                  type="button"
                  onClick={() => void savePicks()}
                  disabled={!allGamesPicked || saving || fullyLocked}
                  className="w-full py-3.5 sm:py-3 rounded-xl bg-primary text-black text-base font-bold disabled:opacity-50 min-h-[52px] touch-manipulation shadow-lg shadow-primary/20"
                >
                  {saving
                    ? practiceMode
                      ? "Grading your fake week…"
                      : "Locking…"
                    : fullyLocked || chaosLockedWeek
                      ? chaosLockedWeek
                        ? "🔥 Chaos locked"
                        : "Locked in"
                      : chaosArmed
                        ? "Lock Chaos card 🔥"
                        : saved
                          ? "Update open picks"
                          : practiceMode
                            ? "Lock & finish this fake week"
                            : "Lock it in"}
                </button>
                {!allGamesPicked && !fullyLocked && (
                  <p className="text-xs text-muted text-center mt-2 px-1">
                    {!propChoice
                      ? "Almost — pick the bonus (prop) answer, then lock."
                      : !bestBetId
                        ? "Almost — mark one Best Bet, then lock."
                        : quietPicks || practiceMode
                          ? "Need: side + confidence on every game, one Best Bet, and the bonus."
                          : "Need: side + unique confidence on every open game, one Best Bet, and a bonus pick."}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-sm text-muted py-3 rounded-xl border border-dashed border-border">
                Archive view — no changes allowed.{" "}
                <button
                  type="button"
                  className="text-primary underline min-h-[44px] px-1"
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


