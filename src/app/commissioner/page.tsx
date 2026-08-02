"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import PlayerLink from "@/components/PlayerLink";
import FirstCardWizard from "@/components/FirstCardWizard";
import {
  isFirstTimeCommish,
  markFirstCardPublished,
  markPracticeWeekDone,
  markCommishGraduated,
  markInviteCopied,
  buildInviteShareText,
} from "@/lib/commish-onboarding";
import { Game, Prop } from "@/lib/types";
import { fetchFootballOdds } from "@/lib/odds";
import { generateDemoSlate, randomizeDemoResults } from "@/lib/demo-slate";
import { formatMatchupConferences } from "@/lib/fbs-teams";
import { formatMatchupNflDivisions } from "@/lib/nfl-teams";
import {
  formatRankedTeam,
  getRankedMatchupTier,
  rankedMatchupBadge,
  rankedMatchupShellClass,
  sortGamesRankHeatFirst,
  filterGamesByRankHeat,
  countRankHeat,
  type RankHeatFilter,
} from "@/lib/rankings";
import { scoreWeek, GameResult } from "@/lib/scoring";
import { applyWeekScores } from "@/lib/store";
import {
  isCommissioner,
  isOps,
  getLeague,
  getSession,
  resetLeague,
  updateLeagueSettings,
  League,
} from "@/lib/league";
import {
  syncLeagueFromCloud,
  saveLeagueToCloud,
  regenerateCodeInCloud,
} from "@/lib/league-sync";
import {
  publishWeekCard,
  loadWeekCard,
  saveResultsAndScoreWeek,
  loadPickSubmissionStatus,
  postMissingPicksAnnouncement,
  setLeagueActiveWeek,
  resetSeasonInCloud,
  startNextSeasonInCloud,
  seedTrialBotsInCloud,
  clearTrialBotsInCloud,
  seedBotPicksForWeekInCloud,
  applyRandomBotChaosForWeek,
  fillLeagueWithBotsToCap,
  listScoredWeekNumbers,
  clearWeekScoreInCloud,
  loadWeekResultsFromCloud,
  loadLeagueRoster,
  setMemberModeration,
  refreshStaffSessionFlags,
  type LeagueRosterMember,
  PickSubmissionStatus,
} from "@/lib/cloud";
import { transferCommissioner } from "@/lib/trophies";
import { recordCommissionerWeek } from "@/lib/commish-tenure";
import { seedBotLockerTalk } from "@/lib/bot-locker-talk";
import {
  getCommishPreviewOpt,
  setCommishPreviewOpt,
  requestRingCeremonyPreview,
} from "@/lib/ring-ceremony";
import OpenRoomBotsNudge from "@/components/OpenRoomBotsNudge";
import OpenRoomLeaveNudge from "@/components/OpenRoomLeaveNudge";
import CommishWeekChecklist from "@/components/CommishWeekChecklist";
import SportPoolCommishPanel from "@/components/SportPoolCommishPanel";
import SandboxHopOptIn from "@/components/SandboxHopOptIn";
import { setViewAsPlayer } from "@/lib/view-as-player";
import {
  formatKickoff,
  formatCardDateRange,
  groupGamesByDate,
  weekTitle,
  weekSubtitle,
} from "@/lib/dates";
import {
  SEASON_MAX_WEEK,
  weekDateRangeLabel,
  listSeasonWeekNumbers,
  firstSeasonWeek,
  seasonMaxWeek,
} from "@/lib/season-calendar";
import { autoFinishRemainingWeeks } from "@/lib/sandbox-auto-finish";
import {
  isPreseasonCommishToolsAllowed,
  PRESEASON_COMMISH_TOOLS_TITLE,
  preseasonCommishToolsBody,
} from "@/lib/season-mode";
import { getSeasonOpenLabel } from "@/lib/season-countdown";
import {
  SIMPLE_BOT_FILL_TARGET,
  areBotsRosterLocked,
  botsLockedMessage,
  canShowDeepHostTools,
  isSimpleHostSurface,
  simpleFillEmptySeatsWithBots,
  simpleRemoveFillerBots,
} from "@/lib/simple-host";
import { advanceLeagueAfterScore } from "@/lib/active-week";
import {
  fetchFootballScores,
  buildResultsFromScores,
} from "@/lib/scores";
import { settlePropFromScores } from "@/lib/prop-settle";
import {
  PROP_PRESETS,
  CUSTOM_PROP_ID,
  propFromPreset,
  matchPresetId,
  presetsForCategory,
  categoryForPresetId,
  defaultPropPreset,
  rotatingPropPreset,
  propCategoriesForSport,
  type PropCategory,
} from "@/lib/prop-presets";
import { MAX_LEAGUE_PLAYERS } from "@/lib/league-limits";
import {
  HOME_TAGLINE_MAX_CHARS,
  DEFAULT_HOME_TAGLINE_ID,
  homeTaglinePresetsForSport,
  resolveHomeTagline,
} from "@/lib/home-tagline";
import {
  DEFAULT_SEASON_THEME_ID,
  applySeasonTheme,
  resolveSeasonThemeId,
  seasonThemePresetsForSport,
  type SeasonThemeId,
} from "@/lib/season-theme";

const ACTIVE_WEEK_KEY = "warroom-active-week";

function storageKeys(week: number) {
  return {
    picks: `warroom-picks-week-${week}`,
    results: `warroom-results-week-${week}`,
    card: `warroom-card-week-${week}`,
  };
}

/**
 * Week chip styles for commissioner pickers.
 * Scored weeks: muted + diagonal strike (still clickable / view-locked).
 */
function weekChipClass(opts: {
  active: boolean;
  scored: boolean;
  /** Conference championship / cut week accent when not scored */
  cutHint?: boolean;
}): string {
  const { active, scored, cutHint } = opts;
  const base =
    "relative px-3 py-1.5 rounded-full text-xs font-medium transition select-none";

  if (scored && active) {
    return `${base} week-pill-passed bg-stone-500/35 text-stone-200 border border-stone-400/50 ring-2 ring-primary/50`;
  }
  if (scored) {
    return `${base} week-pill-passed bg-stone-600/25 text-stone-400 border border-stone-500/40 hover:text-stone-300 hover:border-stone-400/50`;
  }
  if (active) {
    return cutHint
      ? `${base} bg-primary text-black ring-2 ring-warning/60`
      : `${base} bg-primary text-black`;
  }
  if (cutHint) {
    return `${base} bg-card-hover border border-warning/50 text-warning hover:text-warning`;
  }
  return `${base} bg-card-hover border border-border text-muted hover:text-foreground`;
}

function CommissionerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  /** True only for league owner — settings, bots, reset, pass, deputies */
  const [isOwner, setIsOwner] = useState(false);
  const [tab, setTab] = useState<"card" | "results" | "settings" | "picks">("card");
  const [firstTime, setFirstTime] = useState(false);
  const [showFirstWizard, setShowFirstWizard] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  /** Full week chip strip is dense — collapsed by default */
  const [showAllWeekChips, setShowAllWeekChips] = useState(false);
  const [league, setLeague] = useState<League | null>(null);
  const [leagueNameEdit, setLeagueNameEdit] = useState("");
  const [cutPercent, setCutPercent] = useState(50);
  const [crystalBallEnabled, setCrystalBallEnabled] = useState(true);
  /** List league in Join open room lobby */
  const [isOpenRoom, setIsOpenRoom] = useState(false);
  const [openRoomBusy, setOpenRoomBusy] = useState(false);
  const [openRoomNote, setOpenRoomNote] = useState<string | null>(null);
  const [homeTaglineId, setHomeTaglineId] = useState(DEFAULT_HOME_TAGLINE_ID);
  const [homeTaglineCustom, setHomeTaglineCustom] = useState("");
  const [seasonThemeId, setSeasonThemeId] = useState<SeasonThemeId>(
    DEFAULT_SEASON_THEME_ID
  );
  /** CFB week number: 0 = openers … 18 = CFP Final (fixed length). */
  const [activeWeek, setActiveWeek] = useState(1);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [publishedGames, setPublishedGames] = useState<Game[]>([]);
  /** Draft prop on Build Card (may differ until you re-publish). */
  const [prop, setProp] = useState<Prop>(() =>
    propFromPreset(defaultPropPreset("cfb"), 1)
  );
  const [propCategory, setPropCategory] = useState<PropCategory>(
    () => defaultPropPreset("cfb").category
  );
  const [propPresetId, setPropPresetId] = useState(
    () => defaultPropPreset("cfb").id
  );
  /**
   * Prop last published for activeWeek — Enter Results + scoring use this only.
   * Never overwritten by Build Card dropdown clicks.
   */
  const [publishedProp, setPublishedProp] = useState<Prop | null>(null);
  const [propRefreshing, setPropRefreshing] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [customOptA, setCustomOptA] = useState("Yes");
  const [customOptB, setCustomOptB] = useState("No");
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [oddsError, setOddsError] = useState<string | null>(null);
  const [rankLabel, setRankLabel] = useState<string | null>(null);
  /** The Odds API free/paid quota (from response headers after pull/sync). */
  const [oddsCreditsRemaining, setOddsCreditsRemaining] = useState<
    string | null
  >(null);
  const [oddsCreditsUsed, setOddsCreditsUsed] = useState<string | null>(null);
  const [oddsCreditsLast, setOddsCreditsLast] = useState<string | null>(null);
  const [cardSaved, setCardSaved] = useState(false);
  const [results, setResults] = useState<Record<string, GameResult>>({});
  const [propResult, setPropResult] = useState<string | null>(null);
  /** Final boxes from Odds API / demo — used for Sixxxxx Seveennnn cheevo */
  const [finalBoxes, setFinalBoxes] = useState<
    { gameId: string; homeScore: number; awayScore: number }[]
  >([]);
  const [resultsSaved, setResultsSaved] = useState(false);
  const [demoScore, setDemoScore] = useState<{ totalPoints: number } | null>(null);
  const [hasPlayerPicks, setHasPlayerPicks] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoreReport, setScoreReport] = useState<string | null>(null);
  const [syncingScores, setSyncingScores] = useState(false);
  const [syncReport, setSyncReport] = useState<string | null>(null);
  const [pickStatus, setPickStatus] = useState<PickSubmissionStatus[]>([]);
  const [pickStatusLoading, setPickStatusLoading] = useState(false);
  const [pickStatusError, setPickStatusError] = useState<string | null>(null);
  const [postingNudge, setPostingNudge] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);
  const [resettingSeason, setResettingSeason] = useState(false);
  const [seasonResetReport, setSeasonResetReport] = useState<string | null>(
    null
  );
  const [botBusy, setBotBusy] = useState(false);
  const [botReport, setBotReport] = useState<string | null>(null);
  /** Fairness: bots locked once season live / week scored */
  const [botsLocked, setBotsLocked] = useState(false);
  const [botCount, setBotCount] = useState(0);
  const [deepHostTools, setDeepHostTools] = useState(false);
  const [simpleHost, setSimpleHost] = useState(true);
  /** One-tap demo publish busy flag (generate + publish + bots). */
  const [demoBusy, setDemoBusy] = useState(false);
  /** Real season: explain why demo/bot/auto-score tools are locked. */
  const [preseasonToolsPopup, setPreseasonToolsPopup] = useState(false);
  const preseasonToolsOk = isPreseasonCommishToolsAllowed();
  /** How many bots to add (not total roster). Default 6 = common “round out to ~16”. */
  const [botAddCount, setBotAddCount] = useState(6);
  const [rosterCount, setRosterCount] = useState<number | null>(null);
  /** Skip week date filter on Pull Odds — all open FBS games for season dry-run. */
  const [dryRunOdds, setDryRunOdds] = useState(false);
  /** Build Card: default All games; ranked buckets are opt-in filters */
  const [rankHeatFilter, setRankHeatFilter] =
    useState<RankHeatFilter>("all");
  /** Weeks already scored (locked for results entry unless unlocked). */
  const [scoredWeeks, setScoredWeeks] = useState<number[]>([]);
  const [resultsLocked, setResultsLocked] = useState(false);
  const [scoredAtLabel, setScoredAtLabel] = useState<string | null>(null);
  const [passRoster, setPassRoster] = useState<LeagueRosterMember[]>([]);
  const [passToUserId, setPassToUserId] = useState("");
  const [passBusy, setPassBusy] = useState(false);
  const [passReport, setPassReport] = useState<string | null>(null);
  const [deputyBusyId, setDeputyBusyId] = useState<string | null>(null);
  const [deputyReport, setDeputyReport] = useState<string | null>(null);
  const [autoSeasonBusy, setAutoSeasonBusy] = useState(false);
  const [autoSeasonReport, setAutoSeasonReport] = useState<string | null>(null);
  /** Commish-only: personal ring ceremony preview (never league-wide) */
  const [ringPreviewOpt, setRingPreviewOpt] = useState(false);
  /** After listing open room — nudge host to pad bots */
  const [openRoomBotsNudge, setOpenRoomBotsNudge] = useState(false);
  /** Inclusive range for sandbox auto-score (one week … full season) */
  const [autoFromWeek, setAutoFromWeek] = useState(0);
  const [autoToWeek, setAutoToWeek] = useState(SEASON_MAX_WEEK);

  useEffect(() => {
    async function load() {
      await refreshStaffSessionFlags();
      const owner = isCommissioner();
      const ops = isOps();
      setIsOwner(owner);
      setAllowed(ops);
      if (!ops) return;

      const lg = (await syncLeagueFromCloud()) || getLeague();
      let scoredCount = 0;
      try {
        scoredCount = (await listScoredWeekNumbers()).length;
      } catch {
        scoredCount = 0;
      }
      let eyesNewCommish = false;
      try {
        const { getCreatorEyesMode } = await import("@/lib/creator-eyes");
        eyesNewCommish = getCreatorEyesMode() === "new_commissioner";
      } catch {
        eyesNewCommish = false;
      }
      const ft =
        eyesNewCommish ||
        (!!owner &&
          !!lg?.id &&
          isFirstTimeCommish({ leagueId: lg.id, scoredWeekCount: scoredCount }));
      setFirstTime(ft);
      const deep = canShowDeepHostTools(getSession()?.playerId);
      setDeepHostTools(deep);
      setSimpleHost(
        eyesNewCommish ||
          (!!lg?.id &&
            isSimpleHostSurface({
              leagueId: lg.id,
              scoredWeekCount: scoredCount,
              userId: getSession()?.playerId,
            }))
      );
      // New hosts / eyes: stay simple. Creators normal: advanced open.
      setAdvancedOpen(deep && !eyesNewCommish && !ft);
      try {
        setBotsLocked(await areBotsRosterLocked());
      } catch {
        setBotsLocked(false);
      }

      // URL ?tab=card&first=1 or first-time owner → land on Build Card
      const tabParam = searchParams.get("tab");
      const firstParam = searchParams.get("first");
      const hash =
        typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
      if (
        tabParam === "card" ||
        tabParam === "results" ||
        tabParam === "settings" ||
        tabParam === "picks"
      ) {
        if (tabParam === "settings" && !owner) setTab("card");
        else setTab(tabParam);
      } else if (ft || firstParam === "1" || eyesNewCommish) {
        // Simple host / first hour: always land on Build Card
        setTab("card");
      } else if (owner) {
        setTab("settings");
      } else {
        setTab("card");
      }
      // Deep link from open-room bots nudge
      if (owner && (hash === "commish-bots" || tabParam === "settings")) {
        if (hash === "commish-bots") {
          setTab("settings");
          setAdvancedOpen(true);
          window.setTimeout(() => {
            try {
              document
                .getElementById("commish-bots")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            } catch {
              /* ignore */
            }
          }, 400);
        }
      }

      if (lg) {
        setLeague(lg);
        setLeagueNameEdit(lg.name);
        setCutPercent(lg.settings?.cutPercent ?? 50);
        setCrystalBallEnabled(lg.settings?.crystalBallEnabled !== false);
        try {
          setRingPreviewOpt(getCommishPreviewOpt());
        } catch {
          setRingPreviewOpt(false);
        }
        // Open-room listing (cloud column; optional until SQL runs)
        try {
          const { createClient, hasSupabaseConfig } = await import(
            "@/lib/supabase/client"
          );
          if (hasSupabaseConfig() && lg.id) {
            const sb = createClient();
            const { data: row } = await sb
              .from("leagues")
              .select("is_open")
              .eq("id", lg.id)
              .maybeSingle();
            setIsOpenRoom(!!(row as { is_open?: boolean } | null)?.is_open);
          }
        } catch {
          setIsOpenRoom(false);
        }
        setHomeTaglineId(
          lg.settings?.homeTaglineId || DEFAULT_HOME_TAGLINE_ID
        );
        setHomeTaglineCustom(lg.settings?.homeTaglineCustom || "");
        setSeasonThemeId(
          resolveSeasonThemeId(lg.settings?.seasonThemeId)
        );
        applySeasonTheme(lg.settings?.seasonThemeId);
      }
      let week = 1;
      try {
        const saved = localStorage.getItem(ACTIVE_WEEK_KEY);
        if (saved != null && saved !== "") week = parseInt(saved, 10);
        if (Number.isNaN(week)) week = 1;
      } catch {
        /* ignore */
      }
      // NFL has no Week 0 — don't land on an empty preseason slot
      const minW = firstSeasonWeek(lg?.sportId);
      if (week < minW) week = minW;
      setActiveWeek(week);
      if (owner) {
        const sess = getSession();
        if (sess?.playerId && sess.leagueId) {
          recordCommissionerWeek({
            userId: sess.playerId,
            leagueId: sess.leagueId,
            weekNumber: week,
          });
        }
      }
      await loadWeekState(week);
      try {
        const session = getSession();
        const roster = await loadLeagueRoster();
        setRosterCount(roster.length);
        setBotCount(roster.filter((m) => m.isBot).length);
        setPassRoster(
          roster.filter(
            (m) => !m.isBot && m.userId !== session?.playerId
          )
        );
        // Sensible default: add enough to reach ideal 16 if under; else a few
        const open = Math.max(0, MAX_LEAGUE_PLAYERS - roster.length);
        const toIdeal = Math.max(0, SIMPLE_BOT_FILL_TARGET - roster.length);
        if (toIdeal > 0 && toIdeal <= open) setBotAddCount(toIdeal);
        else if (open > 0) setBotAddCount(Math.min(6, open));
      } catch {
        /* ignore */
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot + URL tab/first
  }, [searchParams]);

  /** Sync Build Card draft controls from a known prop (publish / full week load). */
  function applyDraftFromProp(loaded: Prop) {
    setProp(loaded);
    const pid = matchPresetId(loaded);
    if (pid !== CUSTOM_PROP_ID) {
      setPropCategory(categoryForPresetId(pid));
    }
    const presetId = matchPresetId(loaded);
    setPropPresetId(presetId);
    if (presetId === CUSTOM_PROP_ID) {
      setCustomQuestion(loaded.question || "");
      setCustomOptA(loaded.options?.[0] || "Yes");
      setCustomOptB(loaded.options?.[1] || "No");
    }
  }

  /** Set the frozen published prop used by Enter Results + scoring. */
  function setPublishedPropFromCard(loaded: Prop, week: number) {
    setPublishedProp({
      id: loaded.id || `prop-w${week}`,
      question: (loaded.question || "").trim(),
      options: [
        (loaded.options?.[0] || "Yes").trim(),
        (loaded.options?.[1] || "No").trim(),
      ] as [string, string],
      points: loaded.points ?? 3,
    });
  }

  /**
   * Full load for a week: cloud card → local cache.
   * Updates both draft (Build) and publishedProp (Results).
   */
  async function refreshScoredWeeks() {
    const weeks = await listScoredWeekNumbers();
    setScoredWeeks(weeks);
    return weeks;
  }

  async function loadWeekState(week: number) {
    setCardSaved(false);
    setPublishedGames([]);
    setPublishedProp(null);
    setResults({});
    setPropResult(null);
    setFinalBoxes([]);
    setResultsSaved(false);
    setDemoScore(null);
    setScoreReport(null);
    setSelectedIds(new Set());
    setResultsLocked(false);
    setScoredAtLabel(null);
    // Draft default only until we know this week's published card
    {
      const def = defaultPropPreset(leagueFootballSport());
      setProp(propFromPreset(def, week));
      setPropPresetId(def.id);
      setPropCategory(def.category);
    }

    const keys = storageKeys(week);
    let loadedProp: Prop | null = null;

    const scored = await refreshScoredWeeks();
    const cloud = await loadWeekCard(week);
    if (cloud) {
      setPublishedGames(cloud.games);
      applyDraftFromProp(cloud.prop);
      setPublishedPropFromCard(cloud.prop, week);
      loadedProp = cloud.prop;
      setCardSaved(true);
      try {
        localStorage.setItem(
          keys.card,
          JSON.stringify({
            games: cloud.games,
            prop: cloud.prop,
            weekCardId: cloud.weekCardId,
            weekNumber: week,
          })
        );
      } catch {
        /* ignore */
      }
    } else {
      try {
        const cardRaw = localStorage.getItem(keys.card);
        if (cardRaw) {
          const data = JSON.parse(cardRaw);
          // Ignore cache written for a different week (old cloud.ts bug)
          if (
            data.weekNumber != null &&
            Number(data.weekNumber) !== week
          ) {
            /* stale wrong-week cache — skip */
          } else {
            if (data.games) setPublishedGames(data.games);
            if (data.prop?.question) {
              applyDraftFromProp(data.prop);
              setPublishedPropFromCard(data.prop, week);
              loadedProp = data.prop;
            }
            setCardSaved(true);
          }
        }
      } catch {
        /* ignore */
      }
    }
    // Prefer cloud week_results (source of truth after scoring)
    const cloudResults = await loadWeekResultsFromCloud(week);
    if (cloudResults && Object.keys(cloudResults.results).length > 0) {
      setResults(cloudResults.results);
      setPropResult(cloudResults.propResult);
      setResultsSaved(true);
      if (scored.includes(week) || cloudResults.scoredAt) {
        setResultsLocked(true);
        setScoredAtLabel(
          cloudResults.scoredAt
            ? new Date(cloudResults.scoredAt).toLocaleString()
            : "scored"
        );
      }
      try {
        localStorage.setItem(
          keys.results,
          JSON.stringify({
            results: cloudResults.results,
            propResult: cloudResults.propResult,
          })
        );
      } catch {
        /* ignore */
      }
    } else {
      try {
        const resRaw = localStorage.getItem(keys.results);
        if (resRaw) {
          const data = JSON.parse(resRaw);
          setResults(data.results || {});
          const savedPropResult = data.propResult || null;
          if (
            savedPropResult &&
            loadedProp &&
            !loadedProp.options?.includes(savedPropResult)
          ) {
            setPropResult(null);
            setResultsSaved(false);
          } else {
            setPropResult(savedPropResult);
            setResultsSaved(true);
          }
          if (scored.includes(week)) {
            setResultsLocked(true);
            setScoredAtLabel("scored");
          }
        } else if (scored.includes(week)) {
          setResultsLocked(true);
        }
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Re-pull published prop/games when opening Enter Results.
   * Does NOT touch Build Card draft — so browsing Results never
   * overwrites an un-published prop you're still editing.
   */
  async function refreshPublishedProp(week: number) {
    setPropRefreshing(true);
    try {
      const cloud = await loadWeekCard(week);
      if (cloud?.prop?.question) {
        setPublishedGames(cloud.games);
        setPublishedPropFromCard(cloud.prop, week);
        setCardSaved(true);
        // Drop a saved prop answer if it doesn't match this card's options
        setPropResult((prev) => {
          const opts = cloud.prop.options || [];
          if (prev && !opts.includes(prev)) return null;
          return prev;
        });
        try {
          localStorage.setItem(
            storageKeys(week).card,
            JSON.stringify({
              games: cloud.games,
              prop: cloud.prop,
              weekCardId: cloud.weekCardId,
              weekNumber: week,
            })
          );
        } catch {
          /* ignore */
        }
        return;
      }
      try {
        const cardRaw = localStorage.getItem(storageKeys(week).card);
        if (!cardRaw) {
          setPublishedProp(null);
          return;
        }
        const data = JSON.parse(cardRaw);
        if (data.weekNumber != null && Number(data.weekNumber) !== week) {
          setPublishedProp(null);
          return;
        }
        if (data.games) setPublishedGames(data.games);
        if (data.prop?.question) {
          setPublishedPropFromCard(data.prop, week);
        } else {
          setPublishedProp(null);
        }
      } catch {
        /* keep existing publishedProp if any */
      }
    } finally {
      setPropRefreshing(false);
    }
  }

  async function changeActiveWeek(week: number) {
    setActiveWeek(week);
    // Don't show the previous week's odds list on the new week
    setAvailableGames([]);
    setSelectedIds(new Set());
    setOddsError(null);
    try {
      localStorage.setItem(ACTIVE_WEEK_KEY, String(week));
    } catch {
      /* ignore */
    }
    // Push active week to cloud so every player's My Picks follows it
    void setLeagueActiveWeek(week);
    // Elite Commish progress — only the actual commissioner (not deputies)
    const sess = getSession();
    if (sess?.isCommissioner && sess.playerId && sess.leagueId) {
      recordCommissionerWeek({
        userId: sess.playerId,
        leagueId: sess.leagueId,
        weekNumber: week,
      });
    }
    await loadWeekState(week);
    if (tab === "picks") await refreshPickStatus(week);
  }

  async function refreshPickStatus(week = activeWeek) {
    setPickStatusLoading(true);
    setPickStatusError(null);
    setNudgeMessage(null);
    const expected = publishedGames.length || 5;
    const res = await loadPickSubmissionStatus(week, expected);
    if (!res.ok) {
      setPickStatusError(res.error || "Failed to load pick status");
      setPickStatus([]);
    } else {
      setPickStatus(res.rows);
    }
    setPickStatusLoading(false);
  }

  async function announceMissingPicks() {
    const incomplete = pickStatus.filter((r) => !r.complete);
    if (!incomplete.length) {
      setNudgeMessage("Everyone is in — nothing to announce.");
      return;
    }
    const names = incomplete.map((r) => r.name).join(", ");
    if (
      !confirm(
        `Post an announcement naming who still needs picks for ${weekTitle(activeWeek)}?\n\n${names}`
      )
    ) {
      return;
    }

    setPostingNudge(true);
    setNudgeMessage(null);
    const expected = publishedGames.length || 5;
    const res = await postMissingPicksAnnouncement(activeWeek, expected);
    setPostingNudge(false);

    if (!res.ok) {
      setNudgeMessage(res.error || "Failed to post announcement");
      return;
    }
    setNudgeMessage(
      `Announcement posted — ${res.missingCount} player(s) called out. Check Announcements.`
    );
    await refreshPickStatus();
  }

  function applyOddsQuota(q: {
    remaining?: string | null;
    used?: string | null;
    last?: string | null;
  }) {
    if (q.remaining != null) setOddsCreditsRemaining(q.remaining);
    if (q.used != null) setOddsCreditsUsed(q.used);
    if (q.last != null) setOddsCreditsLast(q.last);
  }

  function leagueFootballSport(): "cfb" | "nfl" {
    return getLeague()?.sportId === "nfl" ? "nfl" : "cfb";
  }

  /** Sport-aware season ends (NFL Super Bowl = 22, CFB CFP = 18). */
  function leagueSeasonMax(): number {
    return seasonMaxWeek(getLeague()?.sportId);
  }

  function leagueSeasonMin(): number {
    return firstSeasonWeek(getLeague()?.sportId);
  }

  async function pullOdds() {
    setLoadingOdds(true);
    setOddsError(null);
    const sport = leagueFootballSport();
    try {
      const {
        games,
        rankLabel: pollLabel,
        weekFilter,
        unfilteredCount,
        dryRun,
        remaining,
        used,
        last,
      } = await fetchFootballOdds(sport, activeWeek, { dryRun: dryRunOdds });
      applyOddsQuota({ remaining, used, last });
      setRankLabel(pollLabel || null);
      if (!games.length) {
        setAvailableGames([]);
        setSelectedIds(new Set());
        const range = weekFilter || weekTitle(activeWeek);
        const label = sport === "nfl" ? "NFL" : "NCAA FBS";
        setOddsError(
          dryRun
            ? `No open ${label} games with spreads right now (dry run). Use Generate demo slate instead.`
            : unfilteredCount && unfilteredCount > 0
              ? `No ${label} games with spreads in the ${weekTitle(activeWeek)} window (${range}). Use Generate demo slate for a full fake season.`
              : `No real ${label} lines for ${weekTitle(activeWeek)}. Use Generate demo slate to simulate.`
        );
        return;
      }
      setAvailableGames(games);
      setSelectedIds(new Set());
      // Always land on All games after pull — ranked chips are opt-in
      setRankHeatFilter("all");
      setOddsError(null);
    } catch (e: unknown) {
      const err = e as Error & {
        remaining?: string | null;
        used?: string | null;
      };
      if (err.remaining != null || err.used != null) {
        applyOddsQuota({ remaining: err.remaining, used: err.used });
      }
      setOddsError(err.message || "Failed to pull odds");
      setAvailableGames([]);
      setSelectedIds(new Set());
    } finally {
      setLoadingOdds(false);
    }
  }

  /** Show locked-tool popup when real season has started; returns true if pre-season tools may run. */
  function requirePreseasonTools(): boolean {
    if (isPreseasonCommishToolsAllowed()) return true;
    setPreseasonToolsPopup(true);
    return false;
  }

  /** Fake 5-game card for season simulation — no Odds API. */
  function generateDemoCard() {
    if (!requirePreseasonTools()) return;
    setOddsError(null);
    const sport = leagueFootballSport();
    setRankLabel(sport === "nfl" ? "demo-nfl-sim" : "demo-sim");
    const games = generateDemoSlate(activeWeek, 5, sport);
    setAvailableGames(games);
    setSelectedIds(new Set(games.map((g) => g.id)));
    // Demo / NFL games have no AP ranks — "Good teams" bucket is empty by design
    setRankHeatFilter("all");
    setCardSaved(false);
    setBotReport(
      `Demo slate ready for ${weekTitle(activeWeek)} (5 fake ${sport === "nfl" ? "NFL" : "CFB"} games, all selected). Scroll down to see them, or use “Publish demo week” for one tap.`
    );
  }

  /**
   * One tap: demo slate → default/current prop → publish → bot picks.
   * Skips Generate + Publish as separate clicks.
   */
  async function publishDemoWeek() {
    if (!requirePreseasonTools()) return;
    if (demoBusy) return;
    setDemoBusy(true);
    setOddsError(null);
    setBotReport(null);
    const sport = leagueFootballSport();
    setRankLabel(sport === "nfl" ? "demo-nfl-sim" : "demo-sim");

    const games = generateDemoSlate(activeWeek, 5, sport);
    setAvailableGames(games);
    setSelectedIds(new Set(games.map((g) => g.id)));
    // Unranked demo slate — show All games, not empty "Good teams"
    setRankHeatFilter("all");
    setCardSaved(false);

    // Prefer the draft prop on the form; fall back to a rotating sport preset.
    let propToPublish = prop;
    if (propPresetId === CUSTOM_PROP_ID) {
      if (!customQuestion.trim()) {
        propToPublish = propFromPreset(
          rotatingPropPreset(activeWeek, sport),
          activeWeek
        );
      } else {
        propToPublish = {
          id: `prop-custom-w${activeWeek}`,
          question: customQuestion.trim(),
          options: [
            customOptA.trim() || "Yes",
            customOptB.trim() || "No",
          ] as [string, string],
          points: 3,
        };
      }
    } else {
      const preset = PROP_PRESETS.find((p) => p.id === propPresetId);
      propToPublish = preset
        ? propFromPreset(preset, activeWeek)
        : propFromPreset(rotatingPropPreset(activeWeek, sport), activeWeek);
    }
    applyDraftFromProp(propToPublish);

    games.sort((a, b) => {
      const ta = new Date(a.commenceTime || a.startTime || 0).getTime();
      const tb = new Date(b.commenceTime || b.startTime || 0).getTime();
      return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
    });

    const result = await publishWeekCard({
      weekNumber: activeWeek,
      games,
      prop: propToPublish,
    });
    const keys = storageKeys(activeWeek);
    if (!result.ok) {
      setPublishedGames(games);
      setPublishedPropFromCard(propToPublish, activeWeek);
      localStorage.setItem(
        keys.card,
        JSON.stringify({
          games,
          prop: propToPublish,
          weekNumber: activeWeek,
        })
      );
      setCardSaved(true);
      setDemoBusy(false);
      setBotReport(
        result.error ||
          `Published ${weekTitle(activeWeek)} demo locally (cloud failed).`
      );
      return;
    }

    const published = result.games || games;
    setPublishedGames(published);
    setPublishedPropFromCard(propToPublish, activeWeek);
    setCardSaved(true);
    setShowFirstWizard(false);
    try {
      const lid = getSession()?.leagueId || getLeague()?.id;
      if (lid) {
        markFirstCardPublished(lid);
        markPracticeWeekDone(lid);
      }
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem(ACTIVE_WEEK_KEY, String(activeWeek));
      localStorage.setItem(
        keys.card,
        JSON.stringify({
          games: published,
          prop: propToPublish,
          weekCardId: result.weekCardId,
          weekNumber: activeWeek,
        })
      );
    } catch {
      /* ignore */
    }
    void setLeagueActiveWeek(activeWeek);

    const botFill = await seedBotPicksForWeekInCloud(activeWeek);
    // Pre-season only: bots talk trash so Locker badges / unseen work
    let lockerBit = "";
    try {
      const talk = await seedBotLockerTalk({
        weekNumber: activeWeek,
        weekLabel: weekTitle(activeWeek),
        sportId: sport,
        count: 8,
      });
      if (talk.ok && (talk.inserted || 0) > 0) {
        lockerBit = ` · 💬 ${talk.inserted} locker posts`;
      } else if (talk.error && /bot-locker-sim/i.test(talk.error)) {
        lockerBit = " · (run bot-locker-sim.sql for locker talk)";
      }
    } catch {
      /* optional */
    }
    setDemoBusy(false);
    if (botFill.ok && (botFill.botsFilled || 0) > 0) {
      const chaos =
        (botFill.chaosCount ?? 0) > 0
          ? ` · 💥 ${botFill.chaosCount} Chaos`
          : "";
      setBotReport(
        `Demo week published · ${botFill.botsFilled} bot(s) locked picks${chaos}${lockerBit}. Enter Results → Randomize & score. Check Locker for unread.`
      );
      void refreshPickStatus(activeWeek);
    } else {
      setBotReport(
        `Demo week published for ${weekTitle(activeWeek)}${lockerBit}. Bots will pick if seats exist — then Randomize & score.`
      );
    }
    try {
      const { notifyCardPublished } = await import("@/lib/first-session");
      notifyCardPublished({
        weekNumber: activeWeek,
        weekLabel: weekTitle(activeWeek),
      });
    } catch {
      /* ignore */
    }
  }

  function randomizeResultsForDryRun() {
    if (!requirePreseasonTools()) return;
    if (resultsLocked) {
      setScoreReport("Unlock this week before randomizing results.");
      return;
    }
    if (!publishedGames.length) {
      setScoreReport("Publish a card first.");
      return;
    }
    const propOpts =
      publishedProp?.options || prop.options || (["Yes", "No"] as [string, string]);
    const { results: r, propResult: pr, finalBoxes: boxes } =
      randomizeDemoResults(publishedGames, propOpts);
    setResults(r);
    setPropResult(pr);
    setFinalBoxes(boxes);
    setResultsSaved(false);
    const sixSeven = boxes.some(
      (b) =>
        (b.homeScore === 6 && b.awayScore === 7) ||
        (b.homeScore === 7 && b.awayScore === 6)
    );
    setScoreReport(
      `Randomized covers + prop for ${weekTitle(activeWeek)}.${
        sixSeven ? " 6️⃣7️⃣ Sixxxxx Seveennnn on the slate." : ""
      } Or use “Randomize & score” for one tap.`
    );
  }

  /**
   * One tap: random covers + prop → save & score league.
   * Skips Randomize + Save as separate clicks.
   */
  async function randomizeAndScoreWeek() {
    if (!requirePreseasonTools()) return;
    if (resultsLocked) {
      setScoreReport("Unlock this week before scoring.");
      return;
    }
    if (!publishedGames.length) {
      setScoreReport("Publish a card first (Build Card → Publish demo week).");
      return;
    }
    if (!publishedProp?.question) {
      setScoreReport(
        "Published prop missing. Re-publish the card, then try again."
      );
      return;
    }
    const propOpts =
      publishedProp.options || (["Yes", "No"] as [string, string]);
    const { results: r, propResult: pr, finalBoxes: boxes } =
      randomizeDemoResults(publishedGames, propOpts);
    setResults(r);
    setPropResult(pr);
    setFinalBoxes(boxes);
    setResultsSaved(false);
    setScoreReport(`Randomized ${weekTitle(activeWeek)} — scoring…`);
    await handleSaveResults({
      results: r,
      propResult: pr,
      finalBoxes: boxes,
    });
  }

  function toggleGame(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  }

  function applyPropPreset(id: string) {
    setPropPresetId(id);
    if (id === CUSTOM_PROP_ID) {
      setProp({
        id: `prop-custom-w${activeWeek}`,
        question: customQuestion.trim() || "Custom prop — edit before publish",
        options: [
          customOptA.trim() || "Yes",
          customOptB.trim() || "No",
        ] as [string, string],
        points: 3,
      });
      return;
    }
    const preset = PROP_PRESETS.find((p) => p.id === id);
    if (preset) {
      setPropCategory(preset.category);
      setProp(propFromPreset(preset, activeWeek));
    }
  }

  function applyPropCategory(cat: PropCategory) {
    setPropCategory(cat);
    const list = presetsForCategory(cat, leagueFootballSport());
    const first = list[0];
    if (first) applyPropPreset(first.id);
  }

  function syncCustomProp() {
    if (propPresetId !== CUSTOM_PROP_ID) return;
    setProp({
      id: `prop-custom-w${activeWeek}`,
      question: customQuestion.trim() || "Custom prop",
      options: [
        customOptA.trim() || "Yes",
        customOptB.trim() || "No",
      ] as [string, string],
      points: 3,
    });
  }

  async function publishCard() {
    const selected = availableGames.filter((g) => selectedIds.has(g.id));
    if (selected.length !== 5) return;

    let propToPublish = prop;
    if (propPresetId === CUSTOM_PROP_ID) {
      if (!customQuestion.trim()) {
        alert("Enter a custom prop question before publishing.");
        return;
      }
      propToPublish = {
        id: `prop-custom-w${activeWeek}`,
        question: customQuestion.trim(),
        options: [
          customOptA.trim() || "Yes",
          customOptB.trim() || "No",
        ] as [string, string],
        points: 3,
      };
      setProp(propToPublish);
    } else {
      const preset = PROP_PRESETS.find((p) => p.id === propPresetId);
      if (preset) {
        propToPublish = propFromPreset(preset, activeWeek);
        setProp(propToPublish);
      }
    }

    // Sort selected by kickoff so the card reads chronologically
    selected.sort((a, b) => {
      const ta = new Date(a.commenceTime || a.startTime || 0).getTime();
      const tb = new Date(b.commenceTime || b.startTime || 0).getTime();
      return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
    });
    const result = await publishWeekCard({
      weekNumber: activeWeek,
      games: selected,
      prop: propToPublish,
    });
    const keys = storageKeys(activeWeek);
    if (!result.ok) {
      alert(result.error || "Failed to publish to cloud");
      setPublishedGames(selected);
      applyDraftFromProp(propToPublish);
      setPublishedPropFromCard(propToPublish, activeWeek);
      localStorage.setItem(
        keys.card,
        JSON.stringify({
          games: selected,
          prop: propToPublish,
          weekNumber: activeWeek,
        })
      );
      setCardSaved(true);
      return;
    }
    const games = result.games || selected;
    setPublishedGames(games);
    applyDraftFromProp(propToPublish);
    setPublishedPropFromCard(propToPublish, activeWeek);
    setCardSaved(true);
    setShowFirstWizard(false);
    try {
      const lid = getSession()?.leagueId || getLeague()?.id;
      if (lid) markFirstCardPublished(lid);
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem(ACTIVE_WEEK_KEY, String(activeWeek));
      localStorage.setItem(
        keys.card,
        JSON.stringify({
          games,
          prop: propToPublish,
          weekCardId: result.weekCardId,
          weekNumber: activeWeek,
        })
      );
    } catch {
      /* ignore */
    }
    // Active week already written in publishWeekCard; double-ensure for clients
    void setLeagueActiveWeek(activeWeek);

    // Trial bots auto-fill valid slips for this card (no-op if no bots / SQL missing)
    const botFill = await seedBotPicksForWeekInCloud(activeWeek);
    if (botFill.ok && (botFill.botsFilled || 0) > 0) {
      const chaos =
        (botFill.chaosCount ?? 0) > 0
          ? ` · 💥 ${botFill.chaosCount} Chaos`
          : "";
      setBotReport(
        `Published ${weekTitle(activeWeek)}. ${botFill.botsFilled} trial bot(s) locked fake picks${chaos}.`
      );
      void refreshPickStatus(activeWeek);
    }
    try {
      const { notifyCardPublished } = await import("@/lib/first-session");
      notifyCardPublished({
        weekNumber: activeWeek,
        weekLabel: weekTitle(activeWeek),
      });
    } catch {
      /* ignore */
    }
  }

  /**
   * Add bots for empty seats only.
   * Pre-season: practice pad at 0 pts.
   * Mid-season: replacement bots enter at league average (stay competitive).
   * mode: exact count | grow to target total (16 ideal / 32 max).
   */
  async function handleAddBots(opts: {
    addCount?: number;
    targetTotal?: number;
    label: string;
  }) {
    const midSeason = !isPreseasonCommishToolsAllowed();
    const n =
      opts.addCount != null
        ? opts.addCount
        : opts.targetTotal != null && rosterCount != null
          ? Math.max(0, opts.targetTotal - rosterCount)
          : 0;
    if (n <= 0 && opts.targetTotal == null) {
      setBotReport("Pick how many bots to add (1 or more).");
      return;
    }
    const confirmBody = midSeason
      ? `${opts.label}\n\n` +
        "Mid-season replacement bots (cover for people who left):\n" +
        "• Only fills EMPTY seats (never removes humans or existing bots)\n" +
        "• New bots enter at the LEAGUE AVERAGE of points so they stay competitive\n" +
        "• Soft cap 32 · they can still challenge for the win\n" +
        "• New bots lock picks if this week’s card is published"
      : `${opts.label}\n\n` +
        "• Only fills EMPTY seats (never removes humans or existing bots)\n" +
        "• Soft cap 32 · Ideal pad target is often 16 (clean 8+8 brackets)\n" +
        "• New bots auto-pick if this week’s card is published";
    if (!confirm(confirmBody)) {
      return;
    }
    setBotReport(null);
    setBotBusy(true);
    const hasCard = publishedGames.length > 0;
    const res = await fillLeagueWithBotsToCap({
      ...(hasCard ? { weekNumber: activeWeek } : {}),
      ...(opts.addCount != null ? { addCount: opts.addCount } : {}),
      ...(opts.targetTotal != null ? { targetTotal: opts.targetTotal } : {}),
      ...(midSeason ? { midSeasonReplacement: true } : {}),
    });
    setBotBusy(false);
    if (!res.ok) {
      setBotReport(res.error || "Failed to add bots");
      return;
    }
    if (res.rosterAfter != null) setRosterCount(res.rosterAfter);
    if ((res.added ?? 0) === 0) {
      setBotReport(
        (res.seatsBefore ?? 0) === 0
          ? `League already full (${MAX_LEAGUE_PLAYERS}/${MAX_LEAGUE_PLAYERS}). Remove a bot on Players to free a seat.`
          : `No bots added (already at target or no open seats). Roster: ${res.rosterBefore ?? "?"} · open: ${res.seatsBefore ?? 0}.`
      );
      return;
    }
    void refreshPickStatus(activeWeek);
    const parts: string[] = [
      `Added ${res.added} bot(s)`,
      `roster ${res.rosterBefore} → ${res.rosterAfter}`,
      `${res.totalBots} bots in league`,
    ];
    if (midSeason && res.avgPoints != null) {
      parts.push(
        `started at league avg ${res.avgPoints} pts (competitive mid-season pad)`
      );
    }
    if ((res.botsFilled ?? 0) > 0) {
      parts.push(
        `locked ${res.botsFilled} bot slip(s) for ${weekTitle(activeWeek)}`
      );
    } else if (!hasCard) {
      parts.push("publish a week so bots get picks (or Fill bot picks)");
    }
    if ((res.crystalFilled ?? 0) > 0) {
      parts.push(
        `🔮 ${res.crystalFilled} bot Crystal Ball / Super Bowl picks`
      );
    }
    // Pre-season only: bot locker smoke posts
    if (!midSeason) {
      try {
        const talk = await seedBotLockerTalk({
          weekNumber: activeWeek,
          weekLabel: weekTitle(activeWeek),
          sportId: leagueFootballSport(),
          count: 6,
        });
        if (talk.ok && (talk.inserted || 0) > 0) {
          parts.push(`💬 ${talk.inserted} locker shit-talk posts`);
        }
      } catch {
        /* optional */
      }
    }
    setBotReport(parts.join(" · ") + ".");
  }

  async function handleSeedBotCrystalBall() {
    if (!requirePreseasonTools()) return;
    setBotReport(null);
    setBotBusy(true);
    try {
      const { seedBotCrystalBallPicks } = await import("@/lib/crystal-ball");
      const res = await seedBotCrystalBallPicks({
        sportId: leagueFootballSport(),
      });
      setBotBusy(false);
      if (!res.ok) {
        setBotReport(res.error || "Failed to seed bot Crystal Ball picks");
        return;
      }
      setBotReport(
        (res.inserted ?? 0) > 0
          ? `🔮 ${res.inserted} bot(s) locked Crystal Ball / Super Bowl picks. Open Crystal Ball to see the board.`
          : res.error ||
              "No bot Crystal Ball picks written (pride pick off, or no bots)."
      );
    } catch (e) {
      setBotBusy(false);
      setBotReport(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleSeedBotLockerTalk() {
    if (!requirePreseasonTools()) return;
    setBotReport(null);
    setBotBusy(true);
    const res = await seedBotLockerTalk({
      weekNumber: activeWeek,
      weekLabel: weekTitle(activeWeek),
      sportId: leagueFootballSport(),
      count: 10,
    });
    setBotBusy(false);
    if (!res.ok) {
      setBotReport(res.error || "Failed to seed locker talk");
      return;
    }
    setBotReport(
      `💬 ${res.inserted ?? 0} bot locker posts for ${weekTitle(activeWeek)} (demo only). Open Locker — nav badge should light up if you haven't been there.`
    );
  }

  async function handleFillBotPicks() {
    // Allowed mid-season so replacement bots can lock the open week
    setBotReport(null);
    setBotBusy(true);
    const res = await seedBotPicksForWeekInCloud(activeWeek);
    setBotBusy(false);
    if (!res.ok) {
      setBotReport(res.error || "Failed to fill bot picks");
      return;
    }
    const chaosBit =
      (res.chaosCount ?? 0) > 0
        ? ` · 💥 ${res.chaosCount} went Chaos${
            res.chaosNames?.length
              ? ` (${res.chaosNames.slice(0, 4).join(", ")}${
                  (res.chaosNames.length || 0) > 4 ? "…" : ""
                })`
              : ""
          } — 2× week when scored`
        : res.error
          ? ` · Chaos sim: ${res.error}`
          : "";
    setBotReport(
      `Filled ${res.botsFilled ?? 0} bot pick slip(s) for ${weekTitle(activeWeek)}.${chaosBit}`
    );
    void refreshPickStatus(activeWeek);
  }

  /** Re-roll who goes nuclear without re-seeding all picks */
  async function handleBotChaosReroll() {
    if (!requirePreseasonTools()) return;
    setBotReport(null);
    setBotBusy(true);
    const res = await applyRandomBotChaosForWeek(activeWeek, { chance: 22 });
    setBotBusy(false);
    if (!res.ok) {
      setBotReport(res.error || "Bot Chaos failed");
      return;
    }
    setBotReport(
      (res.chaosCount ?? 0) > 0
        ? `💥 ${res.chaosCount} bot(s) went Chaos for ${weekTitle(activeWeek)}${
            res.names?.length
              ? `: ${res.names.slice(0, 6).join(", ")}`
              : ""
          }. Randomize & score to see 2× impact + Gazette.`
        : `No bots armed Chaos this roll (chance ~22%). Try again or Fill bot picks first.`
    );
    void refreshPickStatus(activeWeek);
  }

  async function handleClearBots() {
    if (botsLocked) {
      setBotReport(botsLockedMessage());
      return;
    }
    if (
      !confirm(
        "Remove filler bots and their picks?\n\nReal players who signed up stay in the league."
      )
    ) {
      return;
    }
    setBotReport(null);
    setBotBusy(true);
    const res = await simpleRemoveFillerBots();
    setBotBusy(false);
    if (!res.ok) {
      setBotReport(res.error || "Failed to clear bots");
      if (res.locked) setBotsLocked(true);
      return;
    }
    if ((res.removed ?? 0) === 0) {
      setBotReport("No filler bots to remove.");
      setBotCount(0);
      return;
    }
    setBotCount(0);
    try {
      const roster = await loadLeagueRoster();
      setRosterCount(roster.length);
      setBotCount(roster.filter((m) => m.isBot).length);
    } catch {
      /* ignore */
    }
    setBotReport(
      `Removed ${res.removed ?? 0} filler bot(s). Real members unchanged.`
    );
    void refreshPickStatus(activeWeek);
  }

  /** Simple host: one yes — fill empty seats toward 16 (or mid-season replacements). */
  async function handleSimpleFillBots() {
    setBotReport(null);
    setBotBusy(true);
    const hasCard = publishedGames.length > 0;
    const res = await simpleFillEmptySeatsWithBots({
      targetTotal: SIMPLE_BOT_FILL_TARGET,
      ...(hasCard ? { weekNumber: activeWeek } : {}),
    });
    setBotBusy(false);
    if (!res.ok) {
      setBotReport(res.error || "Could not add filler bots");
      return;
    }
    if (res.rosterAfter != null) setRosterCount(res.rosterAfter);
    try {
      const roster = await loadLeagueRoster();
      setRosterCount(roster.length);
      setBotCount(roster.filter((m) => m.isBot).length);
      setBotsLocked(await areBotsRosterLocked());
    } catch {
      /* ignore */
    }
    if ((res.added ?? 0) === 0) {
      setBotReport(
        rosterCount != null && rosterCount >= SIMPLE_BOT_FILL_TARGET
          ? `Room already at ${rosterCount} — no empty seats to fill toward ${SIMPLE_BOT_FILL_TARGET}.`
          : "No empty seats to fill right now."
      );
      return;
    }
    const mid = !preseasonToolsOk;
    setBotReport(
      mid
        ? `Added ${res.added} bot(s) at league average points so they stay competitive. They stay for the season.`
        : `Added ${res.added} filler bot(s) toward a full room (~${SIMPLE_BOT_FILL_TARGET}). You can remove them until the season starts.`
    );
    void refreshPickStatus(activeWeek);
  }

  function setGameWinner(gameId: string, side: "home" | "away" | "push") {
    if (resultsLocked) return;
    setResults((prev) => ({ ...prev, [gameId]: { gameId, winner: side } }));
    setResultsSaved(false);
    setDemoScore(null);
  }

  /**
   * Pull final scores from The Odds API and auto-fill ATS winners
   * using the locked home spread on each card game.
   * Also auto-settles most preset props from those finals.
   */
  async function syncFinalScores(andScore = false) {
    if (!publishedGames.length) {
      setSyncReport("Publish a week card first.");
      return;
    }
    setSyncingScores(true);
    setSyncReport(null);
    try {
      const scoreRes = await fetchFootballScores(leagueFootballSport(), 3);
      applyOddsQuota({
        remaining: scoreRes.remaining,
        used: scoreRes.used,
        last: scoreRes.last,
      });
      const events = scoreRes.events;
      const built = buildResultsFromScores(publishedGames, events);
      setResults((prev) => ({ ...prev, ...built.results }));
      setFinalBoxes(built.boxes);
      setResultsSaved(false);

      const sixSevenHit = built.boxes.some(
        (b) =>
          (b.homeScore === 6 && b.awayScore === 7) ||
          (b.homeScore === 7 && b.awayScore === 6)
      );

      const lines = built.details
        .map((d) => {
          if (d.status === "final") {
            const meme =
              d.homeScore != null &&
              d.awayScore != null &&
              ((d.homeScore === 6 && d.awayScore === 7) ||
                (d.homeScore === 7 && d.awayScore === 6))
                ? " · 6️⃣7️⃣ SIXXXXX SEVENNNNN"
                : "";
            return `✓ ${d.label}: ${d.scoreLine} → ${d.winner?.toUpperCase()} covers${meme}`;
          }
          if (d.status === "live") return `… ${d.label}: still live`;
          if (d.status === "unmatched") return `? ${d.label}: no score feed match`;
          return `– ${d.label}: not started / no score yet`;
        })
        .join("\n");

      let propLine = "";
      let autoPropResult: string | null = null;
      const propForSettle = publishedProp;
      if (propForSettle?.question) {
        const settled = settlePropFromScores({
          prop: propForSettle,
          games: publishedGames,
          boxes: built.boxes,
          expectedGames: publishedGames.length,
        });
        if (settled.status === "settled" && settled.propResult) {
          autoPropResult = settled.propResult;
          setPropResult(settled.propResult);
          propLine = `\n\nProp auto-settled: ${settled.propResult}\n(${settled.reason})`;
        } else if (settled.status === "incomplete") {
          propLine = `\n\nProp not ready yet: ${settled.reason}`;
        } else if (settled.status === "manual") {
          propLine = `\n\nProp needs a manual click: ${settled.reason}`;
        } else {
          propLine = `\n\nProp: ${settled.reason}`;
        }
      } else {
        propLine =
          "\n\nNo published prop on file — publish the card prop first.";
      }

      setSyncReport(
        `Auto-filled ${built.filled} of ${publishedGames.length} games (last 3 days of scores).${
          sixSevenHit ? "\n\n6️⃣7️⃣ SIXXXXX SEVENNNNN is live on this slate." : ""
        }\n${lines}${propLine}`
      );

      const mergedResults = { ...results, ...built.results };
      if (andScore && built.filled === publishedGames.length) {
        setSyncingScores(false);
        void handleSaveResults({
          results: mergedResults,
          propResult:
            autoPropResult ??
            (propResult &&
            publishedProp?.options?.includes(propResult)
              ? propResult
              : null),
          finalBoxes: built.boxes,
        });
        return;
      }
    } catch (e: unknown) {
      setSyncReport(
        e instanceof Error ? e.message : "Failed to sync scores"
      );
    } finally {
      setSyncingScores(false);
    }
  }

  async function handleSaveResults(override?: {
    results?: Record<string, GameResult>;
    propResult?: string | null;
    finalBoxes?: { gameId: string; homeScore: number; awayScore: number }[];
  }) {
    if (scoring) return;
    if (resultsLocked) {
      setScoreReport(
        "This week is locked. Click “Unlock to re-score” first (dry-run)."
      );
      setScoring(false);
      return;
    }
    setScoring(true);
    setScoreReport(null);
    const keys = storageKeys(activeWeek);
    const resultsToUse = override?.results ?? results;
    const propResultToUse =
      override && "propResult" in override
        ? override.propResult ?? null
        : propResult;
    const boxesToUse = override?.finalBoxes ?? finalBoxes;

    localStorage.setItem(
      keys.results,
      JSON.stringify({ results: resultsToUse, propResult: propResultToUse })
    );

    // Local demo score for this browser's picks
    try {
      const raw = localStorage.getItem(keys.picks);
      if (raw) {
        const data = JSON.parse(raw);
        const scored = scoreWeek(
          data.picks || {},
          data.bestBetId || null,
          data.propChoice || null,
          publishedGames,
          resultsToUse,
          publishedProp || prop,
          propResultToUse
        );
        setDemoScore({ totalPoints: scored.totalPoints });
        setHasPlayerPicks(true);
      } else {
        setHasPlayerPicks(false);
      }
    } catch {
      setHasPlayerPicks(false);
    }

    const propForScoring = publishedProp;
    if (!propForScoring?.question) {
      setScoring(false);
      setScoreReport(
        "Published prop missing for this week. Open Build Card, confirm the prop, and Publish again."
      );
      return;
    }

    if (
      !propResultToUse ||
      !propForScoring.options?.includes(propResultToUse)
    ) {
      setScoring(false);
      setScoreReport(
        "Prop result not set (or doesn't match the published options). Sync scores again or click Yes/No manually."
      );
      return;
    }

    const cloud = await saveResultsAndScoreWeek({
      weekNumber: activeWeek,
      games: publishedGames,
      prop: propForScoring,
      results: resultsToUse,
      propResult: propResultToUse,
      finalBoxes: boxesToUse,
    });

    setResultsSaved(true);
    setScoring(false);

    if (!cloud.ok) {
      setScoreReport(cloud.error || "Cloud scoring failed");
      applyWeekScores();
      return;
    }

    // Practice is fully client-side now — never piggyback on live score.

    // Lock this week after a successful score pass
    setResultsLocked(true);
    setScoredAtLabel(new Date().toLocaleString());
    void refreshScoredWeeks();

    const sixSevenNote = boxesToUse.some(
      (b) =>
        (b.homeScore === 6 && b.awayScore === 7) ||
        (b.homeScore === 7 && b.awayScore === 6)
    )
      ? " · 6️⃣7️⃣ Sixxxxx Seveennnn granted to locked cards"
      : "";

    if (cloud.scoredCount === 0) {
      setScoreReport(
        cloud.error ||
          `Saved results for ${weekTitle(activeWeek)} (locked). No locked picks found yet — fill bot picks first.${sixSevenNote}`
      );
      applyWeekScores();
      return;
    }

    // First real score = graduate out of first-time mode (Advanced unlocks)
    try {
      const lid = getSession()?.leagueId || getLeague()?.id;
      if (lid && firstTime) {
        markCommishGraduated(lid);
        setFirstTime(false);
        setAdvancedOpen(true);
      }
    } catch {
      /* ignore */
    }

    // Auto-advance league week so player homes/picks move to next card
    let advanceNote = "";
    try {
      const adv = await advanceLeagueAfterScore(activeWeek);
      if (adv.ok && adv.next != null && adv.next !== activeWeek) {
        advanceNote = ` · League advanced to ${weekTitle(adv.next)}`;
        setActiveWeek(adv.next);
      }
    } catch {
      /* ignore */
    }

    const lines = (cloud.details || [])
      .map((d) => `${d.name}: ${d.points} pts`)
      .join(" · ");
    setScoreReport(
      firstTime
        ? `${weekTitle(activeWeek)} scored & locked · ${cloud.scoredCount} player(s). You're a real Commish now — Advanced tools unlocked.${advanceNote}${sixSevenNote} ${lines}`
        : `${weekTitle(activeWeek)} scored & locked · ${cloud.scoredCount} player(s).${advanceNote}${sixSevenNote} ${lines}`
    );
  }

  /**
   * Sandbox auto-run: demo card → bots → random results → score
   * for a chosen inclusive week range (CFB 0–18, NFL 1–22).
   */
  async function handleAutoFinishRange(opts?: {
    from?: number;
    to?: number;
    skipConfirm?: boolean;
  }) {
    if (!requirePreseasonTools()) return;
    const minW = leagueSeasonMin();
    const maxW = leagueSeasonMax();
    let from = opts?.from ?? autoFromWeek;
    let to = opts?.to ?? autoToWeek;
    from = Math.max(minW, Math.min(maxW, from));
    to = Math.max(minW, Math.min(maxW, to));
    if (to < from) {
      setAutoSeasonReport("End week must be ≥ start week.");
      return;
    }

    const inRange: number[] = [];
    for (let w = from; w <= to; w++) {
      if (!scoredWeeks.includes(w)) inRange.push(w);
    }
    if (!inRange.length) {
      setAutoSeasonReport(
        from === to
          ? `${weekTitle(from)} is already scored.`
          : `Nothing left to run in ${weekTitle(from)} → ${weekTitle(to)} (all scored).`
      );
      return;
    }

    const one = from === to;
    const full = from === minW && to === maxW;
    if (
      !opts?.skipConfirm &&
      !confirm(
        one
          ? `Auto-score ${weekTitle(from)} only?\n\n` +
              "Demo card → bot picks → random results → score.\n" +
              "Sandbox / dry-run."
          : full
            ? leagueFootballSport() === "nfl"
              ? `Run ENTIRE NFL season (Week 1 → Super Bowl)?\n\n` +
                `• ${inRange.length} unscored week(s)\n` +
                "• Pads bots toward 16 if thin\n" +
                "• Demo card → bots → random results → score each week\n" +
                "• Leave this tab open until finished\n\n" +
                "Sandbox / dry-run only."
              : `Run ENTIRE season (Week 0 → CFP Final)?\n\n` +
                `• ${inRange.length} unscored week(s)\n` +
                "• Pads bots toward 16 if thin\n" +
                "• Demo card → bots → random results → score each week\n" +
                "• Leave this tab open until finished\n\n" +
                "Sandbox / dry-run only."
            : `Auto-score ${weekTitle(from)} → ${weekTitle(to)}?\n\n` +
              `• ${inRange.length} unscored week(s) in range\n` +
              "• Already-scored weeks skipped\n" +
              "• Leave this tab open until done\n\n" +
              "Sandbox / dry-run."
      )
    ) {
      return;
    }

    setAutoSeasonBusy(true);
    setAutoSeasonReport(
      one
        ? `Running ${weekTitle(from)}…`
        : `Running ${weekTitle(from)} → ${weekTitle(to)}…`
    );
    const res = await autoFinishRemainingWeeks({
      fromWeek: from,
      toWeek: to,
      padRosterTo: one ? 0 : 16,
      onProgress: (p) => {
        setAutoSeasonReport(`${p.label}: ${p.step}`);
      },
    });
    setAutoSeasonBusy(false);
    setAutoSeasonReport(res.message);
    await refreshScoredWeeks();
    const nextWeek = res.finished[res.finished.length - 1];
    if (nextWeek != null) {
      setActiveWeek(nextWeek);
      try {
        localStorage.setItem(ACTIVE_WEEK_KEY, String(nextWeek));
      } catch {
        /* ignore */
      }
      await loadWeekState(nextWeek);
    }
  }

  /** Back-compat: full remaining season */
  async function handleAutoFinishSeason() {
    const minW = leagueSeasonMin();
    const maxW = leagueSeasonMax();
    const firstUnscored = (() => {
      for (let w = minW; w <= maxW; w++) {
        if (!scoredWeeks.includes(w)) return w;
      }
      return null;
    })();
    if (firstUnscored == null) {
      setAutoSeasonReport(
        leagueFootballSport() === "nfl"
          ? "All NFL weeks (1–22) are already scored. Season complete — open Champ / Toilet / Trophies."
          : "All weeks 0–18 are already scored. Season complete — open Champ / Toilet / Trophies."
      );
      return;
    }
    setAutoFromWeek(firstUnscored);
    setAutoToWeek(maxW);
    await handleAutoFinishRange({
      from: firstUnscored,
      to: maxW,
    });
  }

  async function saveSettings() {
    setSettingsError(null);
    const result = await saveLeagueToCloud({
      name: leagueNameEdit,
      settings: {
        cutPercent,
        gamesPerWeek: 5,
        crystalBallEnabled,
        homeTaglineId,
        homeTaglineCustom: homeTaglineCustom.slice(0, HOME_TAGLINE_MAX_CHARS),
        seasonThemeId,
        // Season length is fixed at SEASON_MAX_WEEK in the app (not saved to DB)
      },
    });
    if (result.ok && result.league) {
      setLeague(result.league);
      applySeasonTheme(result.league.settings?.seasonThemeId || seasonThemeId);
      setSettingsSaved(true);
      setSettingsError(null);
      setTimeout(() => setSettingsSaved(false), 1500);
    } else {
      setSettingsError(result.error || "Failed to save settings");
    }
  }

  async function handleRegenCode() {
    if (!confirm("Generate a new code? The old code will stop working.")) return;
    const result = await regenerateCodeInCloud();
    if (result.ok && result.league) setLeague(result.league);
    else alert(result.error || "Failed to regenerate code");
  }

  function handleReset() {
    if (!confirm("Delete this league and all local data?")) return;
    resetLeague();
    router.push("/join");
  }

  async function handlePassCommissioner() {
    setPassReport(null);
    if (!passToUserId) {
      setPassReport("Pick a player to become the new commissioner.");
      return;
    }
    const target = passRoster.find((m) => m.userId === passToUserId);
    const name = target?.name || "this player";
    if (
      !confirm(
        `Pass commissioner to ${name}?\n\n` +
          "You become a regular player.\n" +
          "They get full commissioner tools.\n" +
          "Trophy Room stays with the league (not with you).\n\n" +
          "This cannot be undone unless they pass it back."
      )
    ) {
      return;
    }
    const typed = window.prompt(
      `Type PASS to confirm transferring commissioner to ${name}.`
    );
    if (typed !== "PASS") {
      setPassReport("Cancelled — type PASS exactly to confirm.");
      return;
    }
    setPassBusy(true);
    const result = await transferCommissioner(passToUserId);
    setPassBusy(false);
    if (!result.ok) {
      setPassReport(result.error || "Transfer failed");
      return;
    }
    setPassReport(
      `Done. ${result.newCommissionerName || name} is now commissioner. Redirecting…`
    );
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1200);
  }

  /**
   * Decade room: open the next season in THIS league.
   * Same wipe as reset — framed for year-over-year, not "delete everything."
   * Triple confirmation so it can't fire mid-season by accident.
   */
  async function handleStartNextSeason(opts?: { advancedResetLabel?: boolean }) {
    setSeasonResetReport(null);
    const advanced = !!opts?.advancedResetLabel;

    const { isSandboxMode } = await import("@/lib/season-mode");
    const sandbox = isSandboxMode();
    const roomName = league?.name?.trim() || "this room";
    const ok1 = confirm(
      (advanced ? "RESET SEASON (same room)?\n\n" : "START NEXT SEASON?\n\n") +
        `Room: ${roomName}\n` +
        "Same league forever — friends come back to THIS clubhouse.\n\n" +
        "This will CLEAR the live board:\n" +
        "• Week cards & games\n" +
        "• All picks (humans + bots)\n" +
        "• Results & season standings stats\n" +
        "• Crystal Ball / pride picks for this run\n" +
        "• This season’s Gazette, announcements, locker board\n" +
        (sandbox
          ? "• Sandbox dry-run Trophy engravings on this device\n"
          : "") +
        "\nThis will KEEP (decade room):\n" +
        "• Every member (humans + bots until you clear bots)\n" +
        "• League code, name, settings, divisions, roles\n" +
        "• Commissioner ownership\n" +
        "• Profile photos\n" +
        (sandbox
          ? "• Real prior-season Legends only\n"
          : "• Trophy Room history (all prior years) + career cheevos\n") +
        "\n" +
        (sandbox
          ? "SANDBOX: trial stats zero out.\n\n"
          : "REAL: board zeros; the wall of hardware stays.\n\n") +
        "Continue?"
    );
    if (!ok1) return;

    const ok2 = confirm(
      "Last chance.\n\n" +
        "Cannot undo. Players stay in the room with a clean season board.\n" +
        "Trophy Room is NOT deleted.\n\n" +
        (advanced ? "Reset the season now?" : "Start the next season now?")
    );
    if (!ok2) return;

    const phrase = advanced ? "RESET" : "NEXT";
    const typed = window.prompt(
      advanced
        ? 'Type RESET (all caps) to confirm.\n\nAnything else cancels.'
        : 'Type NEXT (all caps) to open the next season in this same room.\n\nAnything else cancels.'
    );
    if (typed !== phrase) {
      setSeasonResetReport(
        advanced
          ? "Cancelled — type RESET exactly."
          : "Cancelled — type NEXT exactly to start the next season."
      );
      return;
    }

    setResettingSeason(true);
    const result = advanced
      ? await resetSeasonInCloud()
      : await startNextSeasonInCloud();
    setResettingSeason(false);

    if (!result.ok) {
      setSeasonResetReport(result.error || "Could not start next season");
      return;
    }

    // Clear UI state for a clean slate (including scored-week chips + sandbox banner)
    setPublishedGames([]);
    setSelectedIds(new Set());
    setResults({});
    setPropResult(null);
    setCardSaved(false);
    setResultsSaved(false);
    setDemoScore(null);
    setScoreReport(null);
    setSyncReport(null);
    setPickStatus([]);
    setScoredWeeks([]);
    setResultsLocked(false);
    setScoredAtLabel(null);
    setAutoSeasonReport(null);
    setAutoSeasonBusy(false);
    setBotReport(null);
    setActiveWeek(0);
    try {
      localStorage.setItem(ACTIVE_WEEK_KEY, "0");
    } catch {
      /* ignore */
    }
    await loadWeekState(0);
    // Confirm cloud really has no scored weeks (drives sandbox "season complete" text)
    const stillScored = await refreshScoredWeeks();
    if (stillScored.length > 0) {
      setSeasonResetReport(
        `Wipe ran but ${stillScored.length} scored week(s) still exist (${stillScored.join(", ")}). ` +
          "Run supabase/reset-season.sql in Supabase SQL Editor, then try again."
      );
      return;
    }

    const kept = result.membersKept ?? "?";
    const picks = result.picksDeleted ?? 0;
    const cards = result.cardsDeleted ?? 0;
    const results = result.resultsDeleted ?? 0;
    const openWeek =
      leagueFootballSport() === "nfl" ? "Week 1" : "Week 0";
    setSeasonResetReport(
      `Next season open in ${roomName}. Kept ${kept} member(s). ` +
        `Cleared ${cards} card(s), ${picks} pick sheet(s), ${results} scored week(s). ` +
        `Trophy Room stays. Ready for ${openWeek} — publish a card and text the crew.`
    );
  }

  /** @deprecated name — same as start next season (advanced confirm word) */
  async function handleResetSeason() {
    return handleStartNextSeason({ advancedResetLabel: true });
  }

  function copyCode() {
    if (!league) return;
    navigator.clipboard?.writeText(league.code);
    try {
      const lid = getSession()?.leagueId || league.id;
      if (lid) markInviteCopied(lid);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copyInviteText() {
    if (!league) return;
    const text = buildInviteShareText({
      leagueName: league.name || "War Room",
      code: league.code,
      sportId: league.sportId,
      inviterName: getSession()?.playerName,
    });
    try {
      await navigator.clipboard.writeText(text);
      const lid = getSession()?.leagueId || league.id;
      if (lid) markInviteCopied(lid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const allResultsIn =
    publishedGames.length > 0 &&
    !!publishedProp?.question &&
    publishedGames.every((g) => results[g.id]?.winner) &&
    propResult !== null &&
    !!publishedProp.options?.includes(propResult);

  if (allowed === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 flex items-center justify-center text-muted">
          Loading…
        </main>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md text-center rounded-xl border border-border bg-card p-6">
            <h1 className="text-xl font-bold mb-2">Ops only</h1>
            <p className="text-sm text-muted mb-3">
              Only the league commissioner or an appointed deputy can open these
              tools. If you turned on{" "}
              <span className="text-foreground font-medium">View as player</span>
              , exit that mode on Account (or the yellow bar) to use Commish
              again.
            </p>
            <a
              href="/account"
              className="text-sm text-primary font-semibold hover:underline"
            >
              Account → View as player
            </a>
          </div>
        </main>
      </div>
    );
  }

  const session = getSession();

  async function toggleDeputy(m: LeagueRosterMember) {
    if (!isOwner || m.role === "commissioner" || m.userId === session?.playerId)
      return;
    const next = !m.isDeputy;
    if (
      !confirm(
        next
          ? `Make ${m.name} a deputy commissioner?\n\nThey can build the weekly card, enter results, score weeks, and nudge picks. They cannot change settings, reset the season, or pass ownership.`
          : `Remove deputy from ${m.name}?\n\nThey lose Ops access (card / results) immediately.`
      )
    ) {
      return;
    }
    setDeputyBusyId(m.userId);
    setDeputyReport(null);
    const res = await setMemberModeration({
      userId: m.userId,
      isDeputy: next,
    });
    setDeputyBusyId(null);
    if (!res.ok) {
      setDeputyReport(res.error || "Failed");
      return;
    }
    // Optimistic flip so Remove ↔ Make works even if roster RPC is stale
    setPassRoster((prev) =>
      prev
        .map((x) =>
          x.userId === m.userId ? { ...x, isDeputy: next } : x
        )
        .sort((a, b) => {
          if (!!a.isDeputy !== !!b.isDeputy) return a.isDeputy ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
    );
    setDeputyReport(
      next
        ? `${m.name} is now a deputy — they can run picks & results. Use “Remove deputy” anytime to revoke.`
        : `${m.name} is no longer a deputy.`
    );
    // Background refresh (best-effort)
    void loadLeagueRoster().then((roster) => {
      setPassRoster(
        roster
          .filter((x) => !x.isBot && x.userId !== session?.playerId)
          .sort((a, b) => {
            if (!!a.isDeputy !== !!b.isDeputy) return a.isDeputy ? -1 : 1;
            return a.name.localeCompare(b.name);
          })
      );
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <OpenRoomLeaveNudge />
      <OpenRoomBotsNudge
        open={openRoomBotsNudge}
        onClose={() => setOpenRoomBotsNudge(false)}
      />
      {preseasonToolsPopup && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preseason-tools-title"
          onClick={() => setPreseasonToolsPopup(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-warning/40 bg-card p-5 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-warning">
              Real season live
            </p>
            <h2
              id="preseason-tools-title"
              className="text-lg font-bold text-foreground"
            >
              {PRESEASON_COMMISH_TOOLS_TITLE}
            </h2>
            <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
              {preseasonCommishToolsBody()}
            </p>
            <p className="text-xs text-muted leading-relaxed">
              Live path: Pull Odds → publish → friends pick → Sync final scores
              → Save &amp; Score.
            </p>
            <button
              type="button"
              onClick={() => setPreseasonToolsPopup(false)}
              className="w-full py-3 rounded-xl font-bold bg-primary text-black min-h-[48px]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {isOwner
              ? firstTime
                ? "Commish · first hour"
                : "Commish"
              : "Deputy Ops"}
          </h1>
          <p className="text-sm text-muted">
            {isOwner
              ? firstTime
                ? "Invite → publish a card (demo is fine) → score once. Advanced tools unlock after."
                : "Settings · Build card · Who\u2019s in · Results"
              : "Build card · Who\u2019s in · Results (settings stay with the commish)"}
          </p>
          {(firstTime || simpleHost) && isOwner && (
            <div className="mt-3 rounded-xl border-2 border-primary/50 bg-primary/10 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
                Commish · first hour
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                Three jobs:{" "}
                <strong className="text-primary">Build Card</strong>
                {" · "}
                <strong className="text-primary">Who&apos;s in</strong>
                {" · "}
                <strong className="text-primary">Enter Results</strong>
                . Demo slate costs zero odds credits. Settings stay buried until
                you score a week.
              </p>
            </div>
          )}
          {/* Player view + odds: not day-one noise */}
          {!(firstTime || simpleHost) && (
            <>
              <div className="mt-3 rounded-xl border-2 border-warning bg-warning/15 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-warning">
                    View as player
                  </p>
                  <p className="text-xs text-muted">
                    Hide Commish tools and see the app like your league mates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewAsPlayer(true);
                    router.push("/");
                  }}
                  className="shrink-0 px-4 py-2 rounded-lg bg-warning text-black text-sm font-bold"
                >
                  Enter player view →
                </button>
              </div>
              {oddsCreditsRemaining != null && (
                <div
                  className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
                    Number(oddsCreditsRemaining) <= 20
                      ? "border-warning/50 bg-warning/10 text-warning"
                      : Number(oddsCreditsRemaining) === 0
                        ? "border-danger/50 bg-danger/10 text-danger"
                        : "border-primary/30 bg-primary/5 text-foreground"
                  }`}
                >
                  <p className="font-semibold">
                    Odds API credits left:{" "}
                    <span className="font-mono text-lg">
                      {oddsCreditsRemaining}
                    </span>
                    {oddsCreditsUsed != null && (
                      <span className="text-muted font-normal text-xs ml-2">
                        (used this period: {oddsCreditsUsed}
                        {oddsCreditsLast != null
                          ? ` · last call: ${oddsCreditsLast}`
                          : ""}
                        )
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted mt-1 leading-relaxed">
                    Free plan is usually 500 credits/month (Pull Odds ≈ 1, Sync
                    scores ≈ 2). Demo slate uses zero credits.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {!(firstTime || simpleHost) && (
          <CommishWeekChecklist
            onGoTab={(t) => {
              setTab(t);
              if (t === "picks") void refreshPickStatus();
              if (t === "results") void refreshPublishedProp(activeWeek);
            }}
          />
        )}

        <div id="commish-tab-panel" className="scroll-mt-20">
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Simple host: Card · Who's in · Results only. Settings buried. */}
          {isOwner && !(firstTime || simpleHost) && (
            <button
              type="button"
              onClick={() => setTab("settings")}
              className={
                tab === "settings"
                  ? "px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-black"
                  : "px-4 py-1.5 rounded-full text-sm font-medium bg-card border border-border text-muted"
              }
            >
              Settings
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab("card")}
            className={
              tab === "card"
                ? "px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-black"
                : "px-4 py-1.5 rounded-full text-sm font-medium bg-card border border-border text-muted"
            }
          >
            Build Card
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("picks");
              void refreshPickStatus();
            }}
            className={
              tab === "picks"
                ? "px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-black"
                : "px-4 py-1.5 rounded-full text-sm font-medium bg-card border border-border text-muted"
            }
          >
            Who&apos;s in
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("results");
              // Always re-load published prop so Finalize Scores matches the card
              void refreshPublishedProp(activeWeek);
            }}
            className={
              tab === "results"
                ? "px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-black"
                : "px-4 py-1.5 rounded-full text-sm font-medium bg-card border border-border text-muted"
            }
          >
            Enter Results
          </button>
        </div>
        {isOwner && (firstTime || simpleHost) && (
          <p className="text-[11px] text-muted mb-4 -mt-2">
            Need bots, open room, or advanced tools?{" "}
            <button
              type="button"
              onClick={() => {
                setTab("settings");
                setAdvancedOpen(true);
              }}
              className="text-primary font-semibold underline-offset-2 hover:underline"
            >
              League settings
            </button>
          </p>
        )}

        {tab === "settings" && isOwner && league && (
          <div className="space-y-6">
            {simpleHost && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted leading-relaxed">
                <p className="font-bold text-primary text-sm">
                  Simple host mode
                </p>
                <p className="mt-1">
                  Your jobs: <strong className="text-foreground">invite</strong>
                  , <strong className="text-foreground">post the card</strong>,{" "}
                  <strong className="text-foreground">fill seats?</strong>,{" "}
                  <strong className="text-foreground">score the week</strong>.
                  Extra tools open after you score your first week.
                </p>
              </div>
            )}
            {/* Optional sandbox hop — never auto-on from Build card / Host visit */}
            <SandboxHopOptIn />
            {/* Multi-sport pool after first week — not day-one noise */}
            {!simpleHost && <SportPoolCommishPanel />}

            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold">League</h2>
              <div>
                <label className="text-xs text-muted block mb-1">League name</label>
                <input
                  value={leagueNameEdit}
                  onChange={(e) => setLeagueNameEdit(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Invite code</label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[8rem] font-mono text-2xl tracking-[0.25em] text-primary font-bold">
                    {league.code}
                  </div>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="px-3 py-2 text-xs rounded-lg border border-border"
                  >
                    {copied ? "Copied!" : "Copy code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyInviteText()}
                    className="px-3 py-2 text-xs rounded-lg border border-primary/40 text-primary font-semibold"
                  >
                    Copy invite text
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenCode}
                    className="px-3 py-2 text-xs rounded-lg border border-border"
                  >
                    New code
                  </button>
                </div>
                {firstTime && (
                  <p className="text-[11px] text-muted mt-2 leading-relaxed">
                    Text the invite to the group chat first — empty room is the
                    #1 first-week failure mode.
                  </p>
                )}
              </div>
              <div className="text-sm text-muted">
                Commissioner:{" "}
                <span className="text-foreground font-medium">
                  {session?.playerName || "You"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold">Season rules</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted block mb-1">
                    Cut line (% to Toilet Bowl)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={75}
                    value={cutPercent}
                    onChange={(e) => setCutPercent(parseInt(e.target.value) || 50)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-xs text-muted mb-1">Season length</p>
                  <p className="text-sm font-semibold text-foreground">
                    {league?.sportId === "nfl"
                      ? "NFL Weeks 1–18 + playoffs (19–22)"
                      : `Weeks 0–${SEASON_MAX_WEEK}`}
                  </p>
                  <p className="text-[11px] text-muted mt-1 leading-relaxed">
                    {league?.sportId === "nfl" ? (
                      <>
                        Matches the real NFL: Weeks 1–18 regular season
                        (Thu–Mon) · <span className="text-warning">cut after
                        Week 18</span> · then Wild Card / Divisional /
                        Conference / Super Bowl. Same week numbers fans know —
                        no made-up map.
                      </>
                    ) : (
                      <>
                        Fixed CFB map: Week 0 openers · 1–13 regular ·{" "}
                        <span className="text-warning">14 Conf Champ (CUT)</span>{" "}
                        · 15–18 CFP (R1 / QF / SF / Final). Not configurable.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Crystal Ball
                  </p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    {league?.sportId === "nfl"
                      ? "Pride pick tab (0 points). Off by default for NFL — turn on only if you want a Super Bowl–style flex pick. Hide anytime."
                      : "Preseason tab: pick who wins the national title (0 points). Correct picks earn a sarcastic Witch/Wizard achievement. Turn off to hide the tab for everyone in this league."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={crystalBallEnabled}
                  onClick={() => setCrystalBallEnabled((v) => !v)}
                  className={`relative shrink-0 w-12 h-7 rounded-full transition ${
                    crystalBallEnabled ? "bg-primary" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-black transition ${
                      crystalBallEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <p className="w-full text-xs font-medium text-muted">
                  {crystalBallEnabled ? "On — tab visible" : "Off — tab hidden"}
                </p>
              </div>

              <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-amber-200">
                      Ring ceremony
                    </p>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      Sport-specific opening ritual (NFL stage / CFB campus /
                      WWC pitch).{" "}
                      <strong className="text-foreground">
                        Preview is you only
                      </strong>{" "}
                      — never launches a test to the whole league. Real
                      ceremony still fires for everyone only in the opening
                      week window.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ringPreviewOpt}
                    onClick={() => {
                      const next = !ringPreviewOpt;
                      setRingPreviewOpt(next);
                      setCommishPreviewOpt(next);
                    }}
                    className={`relative shrink-0 w-12 h-7 rounded-full transition ${
                      ringPreviewOpt ? "bg-amber-400" : "bg-border"
                    }`}
                    title="Personal preview only"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-black transition ${
                        ringPreviewOpt ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs font-medium text-muted">
                  {ringPreviewOpt
                    ? "On — show me a personal preview once per browser session"
                    : "Off — only real opening-week ceremony for the room"}
                </p>
                <button
                  type="button"
                  onClick={() => requestRingCeremonyPreview({ force: true })}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-amber-400/50 bg-amber-400/15 text-amber-100 text-sm font-bold min-h-[44px] hover:bg-amber-400/25"
                >
                  Play ring ceremony now (preview · you only)
                </button>
              </div>

              <div className="rounded-xl border border-border bg-background p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Open room listing
                  </p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    When on, people using{" "}
                    <strong className="text-foreground">Join open room</strong>{" "}
                    can land here. We fill this room first (fast team build),
                    then the next open league. Auto-unlists when full. Run{" "}
                    <span className="font-mono text-[10px]">
                      supabase/open-rooms.sql
                    </span>{" "}
                    once if the toggle errors.
                  </p>
                  {openRoomNote && (
                    <p className="text-xs text-primary mt-2">{openRoomNote}</p>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOpenRoom}
                  disabled={openRoomBusy}
                  onClick={() => {
                    void (async () => {
                      if (!league?.id) return;
                      setOpenRoomBusy(true);
                      setOpenRoomNote(null);
                      const next = !isOpenRoom;
                      try {
                        const { setLeagueOpenListing } = await import(
                          "@/lib/open-room"
                        );
                        const res = await setLeagueOpenListing(league.id, next);
                        if (!res.ok) {
                          setOpenRoomNote(res.error || "Could not update");
                          return;
                        }
                        setIsOpenRoom(next);
                        setOpenRoomNote(
                          next
                            ? "Listed — open lobby can find you"
                            : "Unlisted from open lobby"
                        );
                        if (next) setOpenRoomBotsNudge(true);
                      } catch (e: unknown) {
                        setOpenRoomNote(
                          e instanceof Error ? e.message : "Could not update"
                        );
                      } finally {
                        setOpenRoomBusy(false);
                      }
                    })();
                  }}
                  className={`relative shrink-0 w-12 h-7 rounded-full transition ${
                    isOpenRoom ? "bg-primary" : "bg-border"
                  } disabled:opacity-50`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-black transition ${
                      isOpenRoom ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <p className="w-full text-xs font-medium text-muted">
                  {isOpenRoom
                    ? "On — open lobby can seat people here"
                    : "Off — code invite only"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Room skin / background
                  </p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    <strong className="text-foreground">War Room Colors</strong>{" "}
                    is the classic black + green clubhouse (NFL rooms keep
                    navy/crimson as their pack default). CFB hosts can also
                    pick campus skins. Holidays wash every page for the whole
                    room.
                  </p>
                </div>
                <label className="block text-xs text-muted">
                  Theme
                  <select
                    value={seasonThemeId}
                    onChange={(e) => {
                      const id = resolveSeasonThemeId(e.target.value);
                      setSeasonThemeId(id);
                      // Paint + stash on local league so View as player still sees it
                      applySeasonTheme(id);
                      updateLeagueSettings({ seasonThemeId: id });
                    }}
                    className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  >
                    {seasonThemePresetsForSport(league?.sportId).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[11px] text-muted leading-relaxed">
                  {seasonThemePresetsForSport(league?.sportId).find(
                    (p) => p.id === seasonThemeId
                  )?.blurb || ""}{" "}
                  Preview applies immediately (and sticks if you{" "}
                  <strong className="text-foreground">View as player</strong>
                  ). Hit{" "}
                  <strong className="text-foreground">Save settings</strong> so
                  the rest of the league gets it.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Home page tagline
                  </p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Line under &quot;Welcome to the War Room&quot; for everyone
                    in this league. Change anytime and Save settings.
                  </p>
                </div>
                <label className="block text-xs text-muted">
                  Preset
                  <select
                    value={homeTaglineId}
                    onChange={(e) => setHomeTaglineId(e.target.value)}
                    className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  >
                    {homeTaglinePresetsForSport(league?.sportId).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                {homeTaglineId === "custom" && (
                  <label className="block text-xs text-muted">
                    Your line ({HOME_TAGLINE_MAX_CHARS} characters max)
                    <textarea
                      value={homeTaglineCustom}
                      onChange={(e) =>
                        setHomeTaglineCustom(
                          e.target.value.slice(0, HOME_TAGLINE_MAX_CHARS)
                        )
                      }
                      rows={2}
                      maxLength={HOME_TAGLINE_MAX_CHARS}
                      placeholder="Type a home page line…"
                      className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
                    />
                    <span className="text-[11px] text-muted mt-1 block">
                      {HOME_TAGLINE_MAX_CHARS - homeTaglineCustom.length} left
                    </span>
                  </label>
                )}
                <div className="rounded-lg border border-border/80 bg-card px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted mb-1">
                    Preview
                  </p>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {resolveHomeTagline({
                      homeTaglineId,
                      homeTaglineCustom,
                      sportId: league?.sportId,
                    })}
                  </p>
                </div>
              </div>

              <button
                onClick={() => void saveSettings()}
                className={
                  settingsSaved
                    ? "w-full py-3 rounded-xl font-semibold bg-primary/20 text-primary border border-primary"
                    : "w-full py-3 rounded-xl font-semibold bg-primary text-black"
                }
              >
                {settingsSaved ? "Settings saved" : "Save settings"}
              </button>
              {settingsError && (
                <p className="text-sm text-danger">{settingsError}</p>
              )}
            </div>

            {firstTime && (
              <button
                type="button"
                onClick={() => setAdvancedOpen((o) => !o)}
                className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold flex justify-between items-center"
              >
                <span>Advanced (bots, reset, pass commissioner…)</span>
                <span className="text-xs text-muted">
                  {advancedOpen ? "Hide" : "Show"}
                </span>
              </button>
            )}

            {(advancedOpen || !firstTime) && (
            <>
            <div
              className={`rounded-xl border p-5 space-y-3 ${
                preseasonToolsOk
                  ? "border-warning/40 bg-warning/5"
                  : "border-border bg-card opacity-90"
              }`}
            >
              <h2
                className={`font-semibold ${
                  preseasonToolsOk ? "text-warning" : "text-muted"
                }`}
              >
                Sandbox: auto-score range
                {!preseasonToolsOk && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-muted border border-border px-1.5 py-0.5 rounded">
                    Pre-season only
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                {preseasonToolsOk ? (
                  <>
                    Full control (one week → full season) lives on{" "}
                    <strong className="text-foreground">Enter Results</strong>.
                    Shortcut here: finish everything left through{" "}
                    {leagueFootballSport() === "nfl"
                      ? "Super Bowl"
                      : "CFP Final"}
                    .
                  </>
                ) : (
                  <>
                    Practice auto-run locked after season open (
                    {getSeasonOpenLabel(league?.sportId)}). Tap below for why.
                  </>
                )}
              </p>
              <button
                type="button"
                disabled={autoSeasonBusy}
                onClick={() => void handleAutoFinishSeason()}
                className={`w-full py-3 rounded-xl font-semibold bg-warning text-black disabled:opacity-50 ${
                  !preseasonToolsOk ? "opacity-45" : ""
                }`}
              >
                {autoSeasonBusy
                  ? "Season running… keep this tab open"
                  : preseasonToolsOk
                    ? leagueFootballSport() === "nfl"
                      ? "Finish remaining → Super Bowl"
                      : "Finish remaining → CFP Final"
                    : "Finish remaining (locked)"}
              </button>
              <button
                type="button"
                disabled={autoSeasonBusy}
                onClick={() => setTab("results")}
                className="w-full py-2 rounded-xl border border-border text-sm text-muted hover:text-foreground"
              >
                Open range picker on Enter Results →
              </button>
              {autoSeasonReport && (
                <p
                  className={`text-xs leading-relaxed ${
                    /fail|error|stopped|0 players/i.test(autoSeasonReport)
                      ? "text-danger"
                      : "text-primary"
                  }`}
                >
                  {autoSeasonReport}
                </p>
              )}
            </div>

            <div
              id="commish-bots"
              className="rounded-xl border border-primary/40 bg-primary/5 p-5 space-y-3 scroll-mt-24"
            >
              <h2 className="font-semibold text-primary">Fill empty seats?</h2>
              <p className="text-xs text-muted leading-relaxed">
                Optional. Add filler bots so the room feels full (empty seats
                only — real friends stay).{" "}
                <strong className="text-foreground">
                  Once the season starts, bots stay
                </strong>{" "}
                so nobody can clear them to climb the board.
              </p>
              {rosterCount != null && (
                <p className="text-xs text-foreground">
                  Roster: <strong>{rosterCount}</strong>
                  {botCount > 0 ? (
                    <>
                      {" "}
                      · <strong>{botCount}</strong> filler bot
                      {botCount === 1 ? "" : "s"}
                    </>
                  ) : null}
                  {" · "}
                  {Math.max(0, MAX_LEAGUE_PLAYERS - rosterCount)} open
                </p>
              )}

              {botsLocked ? (
                <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5 text-xs text-muted leading-relaxed">
                  <p className="font-semibold text-foreground">
                    Bots locked for fairness
                  </p>
                  <p className="mt-1">{botsLockedMessage()}</p>
                  {botCount > 0 && (
                    <p className="mt-1 text-foreground">
                      {botCount} bot{botCount === 1 ? "" : "s"} still on the
                      roster.
                    </p>
                  )}
                  {!preseasonToolsOk && (
                    <button
                      type="button"
                      disabled={botBusy}
                      onClick={() => void handleSimpleFillBots()}
                      className="mt-3 w-full py-2.5 min-h-[44px] rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-50"
                    >
                      {botBusy
                        ? "Working…"
                        : "Someone left? Fill empty seats with bots"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={botBusy}
                    onClick={() => void handleSimpleFillBots()}
                    className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-50"
                  >
                    {botBusy
                      ? "Working…"
                      : botCount > 0
                        ? `Yes — fill empty seats (toward ${SIMPLE_BOT_FILL_TARGET})`
                        : `Yes — fill empty seats with bots`}
                  </button>
                  {botCount > 0 && (
                    <button
                      type="button"
                      disabled={botBusy}
                      onClick={() => void handleClearBots()}
                      className="w-full py-2.5 min-h-[44px] rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
                    >
                      No / remove filler bots
                    </button>
                  )}
                  <p className="text-[11px] text-muted leading-relaxed">
                    Bots take real standings seats until you remove them
                    (pre-lock only). After kickoff or the first scored week,
                    filler bots stay for fairness.
                  </p>
                </div>
              )}

              {botReport && (
                <p
                  className={`text-xs leading-relaxed ${
                    botReport.toLowerCase().includes("fail") ||
                    botReport.toLowerCase().includes("honest") ||
                    botReport.toLowerCase().includes("can’t") ||
                    botReport.toLowerCase().includes("can't")
                      ? "text-danger"
                      : "text-primary"
                  }`}
                >
                  {botReport}
                </p>
              )}

              {/* Creator-only deep bot lab (not for normal hosts) */}
              {deepHostTools && (
                <details className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <summary className="text-xs font-bold text-amber-200 cursor-pointer">
                    Creator advanced bot tools
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="block text-[11px] text-muted">
                        Add N bots
                        <input
                          type="number"
                          min={1}
                          max={MAX_LEAGUE_PLAYERS}
                          value={botAddCount}
                          onChange={(e) =>
                            setBotAddCount(
                              Math.max(
                                1,
                                Math.min(
                                  MAX_LEAGUE_PLAYERS,
                                  parseInt(e.target.value, 10) || 1
                                )
                              )
                            )
                          }
                          className="mt-1 w-20 bg-background border border-border rounded-lg px-2 py-1.5 text-sm font-mono"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={botBusy}
                        onClick={() =>
                          void handleAddBots({
                            addCount: botAddCount,
                            label: `Add ${botAddCount} bot(s)?`,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-primary text-black text-xs font-semibold disabled:opacity-50"
                      >
                        Add {botAddCount}
                      </button>
                      <button
                        type="button"
                        disabled={botBusy}
                        onClick={() =>
                          void handleAddBots({
                            targetTotal: 32,
                            label: "Fill to 32?",
                          })
                        }
                        className="px-3 py-1.5 rounded-lg border border-border text-xs disabled:opacity-50"
                      >
                        Fill 32
                      </button>
                      <button
                        type="button"
                        disabled={botBusy}
                        onClick={() => void handleFillBotPicks()}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs disabled:opacity-50"
                      >
                        Fill picks
                      </button>
                      <button
                        type="button"
                        disabled={botBusy || botsLocked}
                        onClick={() => void handleClearBots()}
                        className="px-3 py-1.5 rounded-lg border border-warning text-warning text-xs disabled:opacity-50"
                      >
                        Clear bots
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={botBusy}
                        onClick={() => void handleBotChaosReroll()}
                        className="px-2.5 py-1 rounded border border-orange-500/40 text-orange-200 text-[11px] disabled:opacity-50"
                      >
                        Bot Chaos
                      </button>
                      <button
                        type="button"
                        disabled={botBusy}
                        onClick={() => void handleSeedBotLockerTalk()}
                        className="px-2.5 py-1 rounded border border-emerald-500/40 text-emerald-200 text-[11px] disabled:opacity-50"
                      >
                        Bot locker
                      </button>
                      <button
                        type="button"
                        disabled={botBusy}
                        onClick={() => void handleSeedBotCrystalBall()}
                        className="px-2.5 py-1 rounded border border-violet-500/40 text-violet-200 text-[11px] disabled:opacity-50"
                      >
                        Bot Crystal Ball
                      </button>
                    </div>
                    <p className="text-[10px] text-muted">
                      Prefer Founder → Test Mode for UI jumps without a real
                      roster.
                    </p>
                  </div>
                </details>
              )}
            </div>

            <div className="rounded-xl border border-amber-400/30 bg-card p-5 space-y-3">
              <h2 className="font-semibold text-amber-300">Trophy Room</h2>
              <p className="text-xs text-muted leading-relaxed">
                Auto-engraves Championship, Toilet Bowl, conference titles, and Village Nerd (Crystal
                Ball) winners by season year. History lives on this league —
                season reset does not wipe it, and it stays when you pass
                commissioner.
              </p>
              <a
                href="/trophy-room"
                className="inline-block px-4 py-2 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-200 text-sm font-medium hover:bg-amber-400/25"
              >
                Open Trophy Room →
              </a>
            </div>

            <div className="rounded-xl border border-primary/40 bg-card p-5 space-y-3">
              <h2 className="font-semibold text-primary">Deputy commissioners</h2>
              <p className="text-xs text-muted leading-relaxed">
                When you&apos;re unavailable, a deputy can{" "}
                <strong className="text-foreground">build the card</strong>,{" "}
                <strong className="text-foreground">enter results</strong>,{" "}
                <strong className="text-foreground">score the week</strong>, and{" "}
                <strong className="text-foreground">nudge missing picks</strong>
                . They cannot change settings, reset the season, manage bots, or
                pass ownership. (Troll tools stay on{" "}
                <a href="/moderation" className="text-amber-300 hover:underline">
                  Mod
                </a>
                .)
              </p>
              {passRoster.length === 0 ? (
                <p className="text-xs text-muted">
                  Add another real player first, then appoint them here.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {passRoster.map((m) => (
                    <li
                      key={m.userId}
                      className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${
                        m.isDeputy ? "bg-primary/5 -mx-2 px-2 rounded-lg" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium">
                          <PlayerLink id={m.userId} name={m.name} />
                        </span>
                        {m.isDeputy && (
                          <span className="ml-1.5 text-[10px] uppercase text-primary border border-primary/40 px-1 rounded">
                            Deputy
                          </span>
                        )}
                        {m.isModerator && (
                          <span className="ml-1.5 text-[10px] uppercase text-amber-300 border border-amber-400/40 px-1 rounded">
                            Mod
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={deputyBusyId === m.userId}
                        onClick={() => void toggleDeputy(m)}
                        className={
                          m.isDeputy
                            ? "text-xs px-2.5 py-1 rounded-lg border border-danger/50 text-danger hover:bg-danger/10 disabled:opacity-50"
                            : "text-xs px-2.5 py-1 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50"
                        }
                      >
                        {m.isDeputy ? "Remove deputy" : "Make deputy"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {deputyReport && (
                <p
                  className={`text-xs leading-relaxed ${
                    /fail|error|incomplete|not set up/i.test(deputyReport)
                      ? "text-danger"
                      : "text-primary"
                  }`}
                >
                  {deputyReport}
                </p>
              )}
              <p className="text-[11px] text-muted">
                Same button toggles both ways:{" "}
                <strong className="text-foreground">Make deputy</strong> →{" "}
                <strong className="text-foreground">Remove deputy</strong>. Setup
                once if it fails:{" "}
                <code className="text-foreground">supabase/staff-roles-setup.sql</code>
                .
              </p>
            </div>

            <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-3">
              <h2 className="font-semibold text-primary">Pass commissioner</h2>
              <p className="text-xs text-muted leading-relaxed">
                Stepping down?{" "}
                <span className="text-foreground font-medium">
                  Nobody is forced
                </span>
                — only pass when someone is ready to jump in so the room can
                finish the season. They become commissioner; you stay as a
                player.{" "}
                <span className="text-foreground font-medium">
                  Trophy Room travels with the league
                </span>
                , not with you. Requires typing{" "}
                <span className="font-mono text-foreground">PASS</span>.
              </p>
              {passRoster.length === 0 ? (
                <p className="text-xs text-muted">
                  Need at least one other real player (not a trial bot) in the
                  league to pass the role.
                </p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <label className="block text-xs text-muted flex-1">
                    New commissioner
                    <select
                      value={passToUserId}
                      onChange={(e) => setPassToUserId(e.target.value)}
                      className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">— Select player —</option>
                      {passRoster.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={passBusy || !passToUserId}
                    onClick={() => void handlePassCommissioner()}
                    className="px-4 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50"
                  >
                    {passBusy ? "Passing…" : "Pass commissioner"}
                  </button>
                </div>
              )}
              {passReport && (
                <p
                  className={`text-xs leading-relaxed ${
                    passReport.toLowerCase().includes("done")
                      ? "text-primary"
                      : "text-danger"
                  }`}
                >
                  {passReport}
                </p>
              )}
              <p className="text-[11px] text-muted">
                One-time setup: run{" "}
                <code className="text-foreground">supabase/trophy-room.sql</code>{" "}
                in Supabase SQL Editor if pass fails.
              </p>
            </div>

            <div className="rounded-xl border-2 border-primary/45 bg-primary/10 p-5 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Decade room
              </p>
              <h2 className="font-semibold text-foreground text-lg">
                Start next season
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                Same league, same code, same friends — new year on the board.
                Use this after a season ends (or when trial runs are done) so the
                crew comes back to{" "}
                <span className="text-foreground font-medium">
                  this clubhouse
                </span>
                , not a brand-new room.
              </p>
              <ul className="text-[11px] text-muted space-y-1 leading-relaxed list-disc pl-4">
                <li>
                  <span className="text-foreground font-medium">Keeps:</span>{" "}
                  members, invite code, commissioner, divisions,{" "}
                  <span className="text-foreground font-medium">
                    Trophy Room / Museum years
                  </span>
                </li>
                <li>
                  <span className="text-foreground font-medium">Clears:</span>{" "}
                  cards, picks, standings, this season&apos;s Gazette / Crystal
                  Ball / locker noise
                </li>
              </ul>
              <button
                type="button"
                disabled={resettingSeason}
                onClick={() => void handleStartNextSeason()}
                className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-extrabold hover:opacity-90 disabled:opacity-50 touch-manipulation"
              >
                {resettingSeason
                  ? "Opening next season…"
                  : "Start next season (same room)"}
              </button>
              <p className="text-[10px] text-muted">
                Confirm by typing{" "}
                <span className="font-mono text-foreground">NEXT</span> — hard
                to do by accident mid-season.
              </p>
              {seasonResetReport && (
                <p
                  className={`text-xs leading-relaxed ${
                    /open|complete|kept/i.test(seasonResetReport)
                      ? "text-primary"
                      : "text-danger"
                  }`}
                >
                  {seasonResetReport}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-warning/35 bg-card p-4 space-y-2">
              <h3 className="text-sm font-semibold text-warning">
                Advanced · same wipe
              </h3>
              <p className="text-[11px] text-muted leading-relaxed">
                Identical board clear (type{" "}
                <span className="font-mono text-foreground">RESET</span>). Prefer{" "}
                <strong className="text-foreground">Start next season</strong>{" "}
                above — same room, clearer story.
              </p>
              <button
                type="button"
                disabled={resettingSeason}
                onClick={() => void handleResetSeason()}
                className="px-3 py-2 rounded-lg border border-warning/60 text-warning text-xs font-medium hover:bg-warning/10 disabled:opacity-50"
              >
                {resettingSeason ? "Working…" : "Reset season (keep players)"}
              </button>
            </div>

            <div className="rounded-xl border border-danger/40 bg-card p-5 space-y-3">
              <h2 className="font-semibold text-danger">Danger zone</h2>
              <p className="text-xs text-muted">
                Permanently deletes the whole league for everyone — kills the
                decade room. Not the same as starting next season.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-lg border border-danger text-danger text-sm"
              >
                Delete league and reset app
              </button>
            </div>
            </>
            )}
          </div>
        )}

        {tab === "card" && (
          <div>
            {showFirstWizard &&
              publishedGames.length === 0 &&
              (firstTime || searchParams.get("first") === "1") && (
                <FirstCardWizard
                  weekLabel={weekTitle(activeWeek)}
                  hasDraftGames={selectedIds.size > 0}
                  hasProp={!!(prop?.question?.trim())}
                  busy={demoBusy}
                  cardPublished={cardSaved && publishedGames.length > 0}
                  onDemoPublish={() => void publishDemoWeek()}
                  onDemo={() => {
                    generateDemoCard();
                    try {
                      const lid = getSession()?.leagueId || getLeague()?.id;
                      if (lid) markPracticeWeekDone(lid);
                    } catch {
                      /* ignore */
                    }
                  }}
                  onPublish={() => void publishCard()}
                  onDismiss={() => setShowFirstWizard(false)}
                />
              )}
            {/* First hour: wizard only — full Build Card after publish or “Use full tools” */}
            {showFirstWizard &&
              publishedGames.length === 0 &&
              (firstTime || searchParams.get("first") === "1") && (
                <p className="text-xs text-muted mb-6 leading-relaxed text-center">
                  Full odds tools stay hidden until you publish a card or tap{" "}
                  <strong className="text-foreground">Use full tools</strong>{" "}
                  above. Keep the first hour simple.
                </p>
              )}
            {!(
              showFirstWizard &&
              publishedGames.length === 0 &&
              (firstTime || searchParams.get("first") === "1")
            ) && (
            <>
            {!(firstTime && publishedGames.length === 0) && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 mb-4 text-xs text-foreground leading-relaxed">
              <p className="font-bold text-amber-200">
                Lazy commissioner protection
              </p>
              <p className="mt-1 text-muted">
                Post the card by <strong className="text-foreground">48 hours before first kickoff</strong>.
                Miss it and War Room auto-selects 5 games + a prop so the room can still pick.
                Miss <strong className="text-foreground">two weeks in a row</strong> and the gavel
                goes to whoever is in <strong className="text-foreground">1st place</strong>.
                Publishing yourself clears the strike count.
              </p>
            </div>
            )}
            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <h2 className="font-semibold mb-1">Pick&apos;em week</h2>
              <p className="text-xs text-muted mb-3">
                {weekSubtitle(activeWeek)}. Games on different dates are fine —
                each shows its own kickoff below the matchup.{" "}
                <span className="text-stone-400">
                  Scored weeks look muted with a diagonal strike — still
                  viewable, locked for edits until unlock.
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(showAllWeekChips
                  ? listSeasonWeekNumbers(league?.sportId)
                  : [
                      ...new Set(
                        listSeasonWeekNumbers(league?.sportId).filter(
                          (w) =>
                            w === activeWeek ||
                            w === activeWeek - 1 ||
                            w === activeWeek + 1
                        )
                      ),
                    ].sort((a, b) => a - b)
                ).map((w) => {
                    const scored = scoredWeeks.includes(w);
                    const nfl = league?.sportId === "nfl";
                    const hint = nfl
                      ? w === 18
                        ? " · CUT"
                        : w === 19
                          ? " · WC"
                          : w === 20
                            ? " · Div"
                            : w === 21
                              ? " · Conf"
                              : w === 22
                                ? " · SB"
                                : ""
                      : w === 14
                        ? " · CUT"
                        : w === 0
                          ? " · openers"
                          : w >= 15
                            ? " · CFP"
                            : "";
                    return (
                      <button
                        key={w}
                        type="button"
                        title={
                          scored
                            ? `${weekTitle(w)} — scored (view / locked)`
                            : weekTitle(w)
                        }
                        onClick={() => changeActiveWeek(w)}
                        className={weekChipClass({
                          active: activeWeek === w,
                          scored,
                          cutHint: w === 14,
                        })}
                      >
                        {weekTitle(w)}
                        {hint}
                        {scored ? " · done" : ""}
                      </button>
                    );
                  })}
                <button
                  type="button"
                  onClick={() => setShowAllWeekChips((v) => !v)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border text-muted hover:text-foreground"
                >
                  {showAllWeekChips ? "Fewer weeks" : "All weeks"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-semibold">
                    Pull Live Odds — {weekTitle(activeWeek)}
                  </h2>
                  <p className="text-xs text-muted">
                    {dryRunOdds ? (
                      <>
                        <span className="text-warning font-semibold">
                          DRY RUN
                        </span>{" "}
                        · all open{" "}
                        {leagueFootballSport() === "nfl" ? "NFL" : "FBS"} games
                        (no week date filter) · assign any 5 to{" "}
                        {weekTitle(activeWeek)} for season testing
                      </>
                    ) : (
                      <>
                        {leagueFootballSport() === "nfl" ? "NFL" : "FBS only"} ·
                        filtered to{" "}
                        <span className="text-foreground font-medium">
                          {weekDateRangeLabel(
                            activeWeek,
                            leagueFootballSport()
                          ) || weekTitle(activeWeek)}
                        </span>
                        {leagueFootballSport() === "nfl"
                          ? " (official NFL week window)"
                          : " (Week 0 ≠ Week 1)"}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void publishDemoWeek()}
                    disabled={demoBusy}
                    aria-disabled={!preseasonToolsOk}
                    className={`px-4 py-2 rounded-lg bg-warning text-black text-sm font-bold hover:bg-warning/90 disabled:opacity-50 ${
                      !preseasonToolsOk ? "opacity-45" : ""
                    }`}
                    title={
                      preseasonToolsOk
                        ? "One tap: fake 5 games + prop + publish + bots pick"
                        : "Pre-season practice only — tap for why"
                    }
                  >
                    {demoBusy
                      ? "Publishing demo…"
                      : preseasonToolsOk
                        ? "Publish demo week"
                        : "Publish demo week (locked)"}
                  </button>
                  <button
                    type="button"
                    onClick={generateDemoCard}
                    aria-disabled={!preseasonToolsOk}
                    className={`px-4 py-2 rounded-lg border border-warning text-warning text-sm font-semibold hover:bg-warning/10 ${
                      !preseasonToolsOk ? "opacity-45" : ""
                    }`}
                    title={
                      preseasonToolsOk
                        ? "Load fake games only — then edit / Publish manually"
                        : "Pre-season practice only — tap for why"
                    }
                  >
                    Generate demo slate
                  </button>
                  <button
                    type="button"
                    onClick={() => void pullOdds()}
                    disabled={loadingOdds}
                    className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-medium disabled:opacity-50"
                  >
                    {loadingOdds ? "Pulling..." : "Pull Odds"}
                  </button>
                </div>
              </div>
              <div
                className={`rounded-lg border px-3 py-2.5 mb-2 ${
                  preseasonToolsOk
                    ? "border-warning/40 bg-warning/5"
                    : "border-border bg-background/60"
                }`}
              >
                <p
                  className={`text-xs font-semibold mb-0.5 ${
                    preseasonToolsOk ? "text-warning" : "text-muted"
                  }`}
                >
                  {preseasonToolsOk
                    ? "Pre-season practice — minimal clicks"
                    : `Pre-season tools locked · season open ${getSeasonOpenLabel(league?.sportId)}`}
                </p>
                <p className="text-[11px] text-muted leading-relaxed">
                  {preseasonToolsOk ? (
                    <>
                      <strong className="text-foreground">
                        Publish demo week
                      </strong>{" "}
                      = one tap (5 fake games + prop + bots). Then Enter Results
                      →{" "}
                      <strong className="text-foreground">
                        Randomize &amp; score
                      </strong>
                      . Need many weeks? Use Auto-score range under Results.
                    </>
                  ) : (
                    <>
                      Demo weeks, trial bots, and auto-score were for learning
                      the Commish role before doors opened. Tap a locked button
                      for the full note. Live path: Pull Odds → publish → Sync
                      final scores.
                    </>
                  )}
                </p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border bg-background px-3 py-2.5 mb-2">
                <input
                  type="checkbox"
                  checked={dryRunOdds}
                  onChange={(e) => {
                    setDryRunOdds(e.target.checked);
                    setAvailableGames([]);
                    setSelectedIds(new Set());
                    setOddsError(null);
                  }}
                  className="mt-0.5 accent-primary"
                />
                <span className="text-xs leading-relaxed">
                  <span className="font-semibold text-foreground">
                    Dry run: show all open real games
                  </span>
                  <span className="text-muted block mt-0.5">
                    Optional. Pull Odds without week date filter. Prefer{" "}
                    <strong className="text-foreground">Generate demo slate</strong>{" "}
                    if you just want fake games for testing.
                  </span>
                </span>
              </label>
              {oddsError && (
                <p className="text-sm text-danger mt-2">{oddsError}</p>
              )}
              {availableGames.length > 0 &&
                availableGames.every(
                  (g) =>
                    g.bookmaker === "demo-sim" || g.bookmaker === "demo-nfl-sim"
                ) && (
                  <p className="text-xs text-warning mt-2 font-medium">
                    Demo slate loaded ({availableGames.length} fake games,
                    pre-selected). Scroll down — or hit Publish / Publish demo
                    week.
                  </p>
                )}
            </div>

            {availableGames.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 mb-6">
                <h2 className="font-semibold mb-1">
                  Select 5 Games for {weekTitle(activeWeek)} (
                  {selectedIds.size}/5)
                </h2>
                <p className="text-xs text-muted mb-2">
                  {availableGames.length}{" "}
                  {leagueFootballSport() === "nfl" ? "NFL" : "FBS"} games
                  {rankLabel ? ` • Ranks: ${rankLabel}` : ""}
                  {leagueFootballSport() === "nfl" ? (
                    <> · NFL has no AP heat ranks — use All games</>
                  ) : (
                    <>
                      {" · "}
                      <span className="text-amber-300/90">Gold</span> both top
                      10{" · "}
                      <span className="text-violet-300/90">Violet</span> both
                      top 25{" · "}
                      <span className="text-emerald-300/90">Green</span> one top
                      25
                    </>
                  )}
                </p>
                {(() => {
                  const heatCounts = countRankHeat(availableGames);
                  const isDemoSlate = availableGames.every(
                    (g) =>
                      g.bookmaker === "demo-sim" ||
                      g.bookmaker === "demo-nfl-sim"
                  );
                  const noRankHeat =
                    isDemoSlate ||
                    leagueFootballSport() === "nfl" ||
                    (heatCounts.heat === 0 &&
                      heatCounts.ranked === 0 &&
                      heatCounts.top25 === 0 &&
                      heatCounts.legendary === 0);
                  // If user is stuck on an empty heat bucket, show all games
                  const effectiveFilter: RankHeatFilter =
                    noRankHeat && rankHeatFilter !== "all"
                      ? "all"
                      : rankHeatFilter;
                  const filtered = sortGamesRankHeatFirst(
                    filterGamesByRankHeat(availableGames, effectiveFilter)
                  );
                  const chips: {
                    id: RankHeatFilter;
                    label: string;
                    count: number;
                    accent: string;
                  }[] = [
                    {
                      id: "all",
                      label: "All games",
                      count: availableGames.length,
                      accent: "border-border text-muted",
                    },
                    {
                      id: "heat",
                      label: "Good teams",
                      count: heatCounts.heat,
                      accent: "border-primary/50 text-primary",
                    },
                    {
                      id: "legendary",
                      label: "Top 10",
                      count: heatCounts.legendary,
                      accent: "border-amber-400/50 text-amber-200",
                    },
                    {
                      id: "top25",
                      label: "Both 25",
                      count: heatCounts.top25,
                      accent: "border-violet-400/50 text-violet-200",
                    },
                    {
                      id: "ranked",
                      label: "One ranked",
                      count: heatCounts.ranked,
                      accent: "border-emerald-400/50 text-emerald-200",
                    },
                  ];
                  const dateGroups =
                    effectiveFilter === "all"
                      ? groupGamesByDate(
                          sortGamesRankHeatFirst(availableGames)
                        ).map((g) => ({
                          ...g,
                          games: sortGamesRankHeatFirst(g.games),
                        }))
                      : [
                          {
                            dateKey: "heat",
                            dateLabel:
                              effectiveFilter === "heat"
                                ? "Ranked matchups first"
                                : effectiveFilter === "legendary"
                                  ? "Both Top 10"
                                  : effectiveFilter === "top25"
                                    ? "Both Top 25"
                                    : "One team Top 25",
                            games: filtered,
                          },
                        ];
                  return (
                    <>
                      {!noRankHeat && (
                        <>
                          <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1.5">
                            Filter slate · default is All games
                          </p>
                          <div className="phone-h-scroll sm:flex-wrap sm:overflow-visible gap-1.5 mb-3">
                            {chips.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                disabled={c.count === 0 && c.id !== "all"}
                                onClick={() => setRankHeatFilter(c.id)}
                                className={`px-3 py-2 min-h-[40px] rounded-full text-[11px] font-bold border transition touch-manipulation disabled:opacity-40 ${
                                  effectiveFilter === c.id
                                    ? "bg-primary/15 border-primary text-primary"
                                    : c.accent
                                }`}
                              >
                                {c.label}
                                <span className="ml-1 opacity-80 tabular-nums">
                                  {c.count}
                                </span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      {noRankHeat && (
                        <p className="text-[11px] text-warning mb-2">
                          {isDemoSlate
                            ? "Demo slate — all 5 fake games listed below (already selected)."
                            : "No AP ranks on this slate — showing all games."}
                        </p>
                      )}
                      {filtered.length === 0 && effectiveFilter !== "all" ? (
                        <p className="text-sm text-muted py-6 text-center border border-dashed border-border rounded-xl">
                          No games in this bucket. Try{" "}
                          <button
                            type="button"
                            className="text-primary font-semibold underline"
                            onClick={() => setRankHeatFilter("all")}
                          >
                            All games
                          </button>
                          .
                        </p>
                      ) : null}
                {/* Games only in nested scroll — prop lives outside so mobile can change it */}
                <div className="space-y-4 max-h-[28rem] overflow-y-auto mt-2 overscroll-contain">
                  {dateGroups.map((group) => (
                    <div key={group.dateKey}>
                      <div className="sticky top-0 bg-card/95 backdrop-blur py-1.5 mb-2 border-b border-border z-10">
                        <span className="text-xs font-semibold text-primary">
                          {group.dateLabel}
                        </span>
                        <span className="text-[11px] text-muted ml-2">
                          {group.games.length} game
                          {group.games.length === 1 ? "" : "s"}
                          {effectiveFilter !== "all"
                            ? " · best first"
                            : noRankHeat
                              ? ""
                              : " · ranked first within day"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.games.map((g) => {
                          const selected = selectedIds.has(g.id);
                          const kick = formatKickoff(
                            g.commenceTime || g.startTime
                          );
                          const favName =
                            g.favorite === "home" ? g.homeTeam : g.awayTeam;
                          const favRank =
                            g.favorite === "home" ? g.homeRank : g.awayRank;
                          // Short mascot-ish for spread chip (phone width)
                          const favShort =
                            (favName || "")
                              .replace(/^#\d+\s*/, "")
                              .trim()
                              .split(/\s+/)
                              .slice(-1)[0] || favName;
                          const spreadNum =
                            g.spread < 0 ? g.spread : -Math.abs(g.spread);
                          // NFL → AFC/NFC divisions; CFB → NCAA conferences
                          // (never run FBS matcher on NFL — Pittsburgh → ACC, etc.)
                          const confLine =
                            leagueFootballSport() === "nfl"
                              ? formatMatchupNflDivisions(
                                  g.awayTeam,
                                  g.homeTeam
                                )
                              : formatMatchupConferences(
                                  g.awayTeam,
                                  g.homeTeam
                                );
                          const rankTier = getRankedMatchupTier(
                            g.awayRank,
                            g.homeRank
                          );
                          const rankBadge = rankedMatchupBadge(rankTier);
                          const titleTone =
                            rankTier === "legendary"
                              ? "text-amber-100"
                              : rankTier === "top25"
                                ? "text-violet-100"
                                : rankTier === "ranked"
                                  ? "text-emerald-100"
                                  : "text-foreground";
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => toggleGame(g.id)}
                              className={`w-full text-left p-3 rounded-lg border transition ${rankedMatchupShellClass(
                                rankTier,
                                { selected }
                              )}`}
                            >
                              {/* Phone: stack both teams full-width — no single-line truncate */}
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                  {selected && (
                                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-black bg-primary px-1.5 py-0.5 rounded shrink-0">
                                      ✓ On card
                                    </span>
                                  )}
                                  {rankBadge && (
                                    <span className={rankBadge.className}>
                                      {rankBadge.label}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className="shrink-0 text-xs sm:text-sm font-bold text-primary tabular-nums bg-primary/10 border border-primary/25 rounded-lg px-2 py-1"
                                  title={formatRankedTeam(favName, favRank)}
                                >
                                  <span className="hidden sm:inline">
                                    {formatRankedTeam(favName, favRank)}{" "}
                                  </span>
                                  <span className="sm:hidden">
                                    {favRank ? `#${favRank} ` : ""}
                                    {favShort}{" "}
                                  </span>
                                  {spreadNum}
                                </span>
                              </div>
                              <div
                                className={`space-y-0.5 font-semibold leading-snug ${titleTone}`}
                              >
                                <p className="text-[13px] sm:text-sm break-words">
                                  {formatRankedTeam(g.awayTeam, g.awayRank)}
                                </p>
                                <p className="text-[13px] sm:text-sm break-words">
                                  <span className="text-muted font-medium">
                                    @{" "}
                                  </span>
                                  {formatRankedTeam(g.homeTeam, g.homeRank)}
                                </p>
                              </div>
                              <div className="text-xs text-primary mt-1.5">
                                {kick.full}
                              </div>
                              <div className="text-[11px] text-muted mt-0.5">
                                {confLine}
                                {g.bookmaker
                                  ? `${confLine ? " · " : ""}${g.bookmaker}`
                                  : ""}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Weekly prop — category dropdown → question list */}
            {availableGames.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 mb-6 space-y-3">
                <div>
                  <h3 className="font-semibold text-sm">Weekly prop</h3>
                  <p className="text-xs text-muted mt-0.5">
                    Category → question
                    {leagueFootballSport() === "nfl"
                      ? " (NFL bank)"
                      : " (college bank)"}
                    . Worth {prop.points} pts. Publish to put it on the card.
                  </p>
                  {publishedProp?.question &&
                    publishedProp.question !== prop.question && (
                      <p className="text-[11px] text-warning mt-1">
                        Draft differs from published prop. Players still see
                        the published one until you Publish again.
                      </p>
                    )}
                </div>

                <label className="block text-xs text-muted">
                  Prop type
                  <select
                    value={propCategory}
                    onChange={(e) =>
                      applyPropCategory(e.target.value as PropCategory)
                    }
                    className="mt-1 w-full min-h-[48px] bg-background border border-border rounded-lg px-3 py-3 text-base focus:outline-none focus:border-primary"
                  >
                    {propCategoriesForSport(leagueFootballSport()).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[11px] text-muted -mt-1">
                  {
                    propCategoriesForSport(leagueFootballSport()).find(
                      (c) => c.id === propCategory
                    )?.blurb
                  }
                </p>

                <label className="block text-xs text-muted">
                  Question
                  <select
                    value={
                      propPresetId === CUSTOM_PROP_ID
                        ? CUSTOM_PROP_ID
                        : propPresetId
                    }
                    onChange={(e) => applyPropPreset(e.target.value)}
                    className="mt-1 w-full min-h-[48px] bg-background border border-border rounded-lg px-3 py-3 text-base focus:outline-none focus:border-primary"
                  >
                    {presetsForCategory(
                      propCategory,
                      leagueFootballSport()
                    ).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.settle === "manual" ? "📝 " : "⚡ "}
                        {p.label}
                      </option>
                    ))}
                    <option value={CUSTOM_PROP_ID}>
                      Custom prop (write your own)…
                    </option>
                  </select>
                </label>

                <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border overscroll-contain">
                  {presetsForCategory(
                    propCategory,
                    leagueFootballSport()
                  ).map((p) => {
                    const active = propPresetId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPropPreset(p.id)}
                        className={`w-full text-left px-3 py-3 min-h-[48px] text-sm transition active:bg-primary/15 ${
                          active
                            ? "bg-primary/15 text-primary font-semibold"
                            : "bg-background text-foreground hover:bg-card-hover"
                        }`}
                      >
                        <span className="block">
                          {active ? "✓ " : ""}
                          {p.label}
                        </span>
                        <span className="block text-[10px] text-muted font-normal mt-0.5">
                          {p.settle === "auto"
                            ? "Auto-scores from finals"
                            : "You set Yes/No after games (box score)"}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => applyPropPreset(CUSTOM_PROP_ID)}
                    className={`w-full text-left px-3 py-3 min-h-[48px] text-sm transition active:bg-primary/15 ${
                      propPresetId === CUSTOM_PROP_ID
                        ? "bg-primary/15 text-primary font-semibold"
                        : "bg-background text-foreground hover:bg-card-hover"
                    }`}
                  >
                    {propPresetId === CUSTOM_PROP_ID ? "✓ " : ""}
                    Custom prop (write your own)…
                  </button>
                </div>

                <p className="text-[11px] text-muted">
                  ⚡ Teams / most Funny auto-settle from scores. 📝 Players &amp;
                  Odd need a box-score check (no player-stat feed yet).
                </p>

                {propPresetId === CUSTOM_PROP_ID ? (
                  <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                    <input
                      type="text"
                      value={customQuestion}
                      onChange={(e) => {
                        setCustomQuestion(e.target.value);
                        // Live sync so phone users don&apos;t need blur
                        const q = e.target.value;
                        setProp({
                          id: `prop-custom-w${activeWeek}`,
                          question: q.trim() || "Custom prop",
                          options: [
                            customOptA.trim() || "Yes",
                            customOptB.trim() || "No",
                          ] as [string, string],
                          points: 3,
                        });
                      }}
                      onBlur={syncCustomProp}
                      placeholder="Prop question"
                      className="w-full min-h-[48px] bg-card border border-border rounded-lg px-3 py-3 text-base"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={customOptA}
                        onChange={(e) => {
                          setCustomOptA(e.target.value);
                          setProp({
                            id: `prop-custom-w${activeWeek}`,
                            question:
                              customQuestion.trim() || "Custom prop",
                            options: [
                              e.target.value.trim() || "Yes",
                              customOptB.trim() || "No",
                            ] as [string, string],
                            points: 3,
                          });
                        }}
                        onBlur={syncCustomProp}
                        placeholder="Option A"
                        className="min-h-[48px] bg-card border border-border rounded-lg px-3 py-3 text-base"
                      />
                      <input
                        type="text"
                        value={customOptB}
                        onChange={(e) => {
                          setCustomOptB(e.target.value);
                          setProp({
                            id: `prop-custom-w${activeWeek}`,
                            question:
                              customQuestion.trim() || "Custom prop",
                            options: [
                              customOptA.trim() || "Yes",
                              e.target.value.trim() || "No",
                            ] as [string, string],
                            points: 3,
                          });
                        }}
                        onBlur={syncCustomProp}
                        placeholder="Option B"
                        className="min-h-[48px] bg-card border border-border rounded-lg px-3 py-3 text-base"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-background px-3 py-3 text-sm">
                    <p className="text-foreground leading-snug">
                      {prop.question}
                    </p>
                    <p className="text-xs text-muted mt-1.5">
                      Choices: {prop.options[0]} · {prop.options[1]}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  disabled={selectedIds.size !== 5}
                  onClick={() => void publishCard()}
                  className={
                    selectedIds.size === 5
                      ? "w-full py-3.5 rounded-xl font-semibold bg-primary text-black min-h-[48px]"
                      : "w-full py-3.5 rounded-xl font-semibold bg-border text-muted cursor-not-allowed min-h-[48px]"
                  }
                >
                  Publish / Update {weekTitle(activeWeek)} Card
                </button>
              </div>
            )}

            {cardSaved && (
              <div className="rounded-xl border border-primary/40 bg-card p-4 text-sm text-primary">
                {weekTitle(activeWeek)} card saved ({publishedGames.length}{" "}
                games
                {formatCardDateRange(publishedGames)
                  ? ` · ${formatCardDateRange(publishedGames)}`
                  : ""}
                ). Everyone&apos;s My Picks refreshes automatically when you
                publish or change games — no need to tell them to reload.
              </div>
            )}
            </>
            )}
          </div>
        )}

        {tab === "picks" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-semibold">
                    Who&apos;s in — {weekTitle(activeWeek)}
                  </h2>
                  <p className="text-xs text-muted mt-1">
                    Shows who submitted a full card. You never see their
                    sides, confidence, or prop choice here — only status.
                    Post an announcement any day/time you want.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => refreshPickStatus()}
                    disabled={pickStatusLoading || postingNudge}
                    className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
                  >
                    {pickStatusLoading ? "Refreshing…" : "Refresh"}
                  </button>
                  <button
                    type="button"
                    onClick={() => announceMissingPicks()}
                    disabled={
                      pickStatusLoading ||
                      postingNudge ||
                      pickStatus.filter((r) => !r.complete).length === 0
                    }
                    className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-medium disabled:opacity-50"
                  >
                    {postingNudge
                      ? "Posting…"
                      : "Announce who hasn't picked"}
                  </button>
                </div>
              </div>

              {nudgeMessage && (
                <div
                  className={`text-sm mb-3 rounded-lg border px-3 py-2 ${
                    nudgeMessage.toLowerCase().includes("failed") ||
                    nudgeMessage.toLowerCase().includes("error")
                      ? "border-danger/40 bg-danger/10 text-danger"
                      : "border-primary/40 bg-primary/10 text-primary"
                  }`}
                >
                  {nudgeMessage}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                {listSeasonWeekNumbers(league?.sportId).map(
                  (w) => {
                    const scored = scoredWeeks.includes(w);
                    return (
                      <button
                        key={w}
                        type="button"
                        title={
                          scored
                            ? `${weekTitle(w)} — scored (view / locked)`
                            : weekTitle(w)
                        }
                        onClick={() => changeActiveWeek(w)}
                        className={weekChipClass({
                          active: activeWeek === w,
                          scored,
                        })}
                      >
                        {weekTitle(w)}
                        {scored ? " · done" : ""}
                      </button>
                    );
                  }
                )}
              </div>

              {pickStatusError && (
                <div className="text-sm text-danger mb-3">
                  {pickStatusError}
                  {pickStatusError.toLowerCase().includes("policy") ||
                  pickStatusError.toLowerCase().includes("permission") ||
                  pickStatusError.toLowerCase().includes("rls") ? (
                    <span className="block text-xs mt-1 text-muted">
                      Run supabase/picks-privacy.sql in Supabase if you
                      haven&apos;t yet.
                    </span>
                  ) : null}
                </div>
              )}

              {!pickStatusLoading && pickStatus.length > 0 && (
                <div className="flex flex-wrap gap-3 text-xs mb-4">
                  <span className="text-primary">
                    Complete: {pickStatus.filter((r) => r.complete).length}
                  </span>
                  <span className="text-warning">
                    Partial:{" "}
                    {
                      pickStatus.filter((r) => r.submitted && !r.complete)
                        .length
                    }
                  </span>
                  <span className="text-danger">
                    Missing: {pickStatus.filter((r) => !r.submitted).length}
                  </span>
                  <span className="text-muted">
                    of {pickStatus.length} players
                  </span>
                </div>
              )}

              {pickStatusLoading && (
                <p className="text-sm text-muted py-6 text-center">
                  Loading…
                </p>
              )}

              {!pickStatusLoading && pickStatus.length === 0 && !pickStatusError && (
                <p className="text-sm text-muted py-6 text-center">
                  No members found. Invite players from Players.
                </p>
              )}

              {!pickStatusLoading && pickStatus.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {pickStatus.map((r) => (
                    <li
                      key={r.userId}
                      className="flex items-center gap-3 px-3 py-2.5 bg-card hover:bg-card-hover"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          <PlayerLink id={r.userId} name={r.name} />
                          {r.role === "commissioner" && (
                            <span className="text-primary text-xs ml-1">
                              Commish
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted">
                          {r.division}
                          {r.submitted
                            ? ` · ${r.gamePickCount} game picks`
                            : ""}
                          {r.submitted && !r.hasProp ? " · no prop" : ""}
                          {r.submitted && !r.hasBestBet ? " · no best bet" : ""}
                        </div>
                      </div>
                      {r.complete ? (
                        <span className="text-xs font-medium text-primary shrink-0">
                          ✓ In
                        </span>
                      ) : r.submitted ? (
                        <span className="text-xs font-medium text-warning shrink-0">
                          Partial
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-danger shrink-0">
                          Not in
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === "results" && (
          <div>
            {/* Ship A: one primary host action */}
            <div className="rounded-xl border-2 border-primary/50 bg-primary/10 p-4 mb-6 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Score this week
              </p>
              <p className="text-xs text-muted leading-relaxed">
                {preseasonToolsOk
                  ? "Practice: one tap randomizes covers + prop and scores the room."
                  : "Live: pull finals from the score feed, settle what we can, then score the league. Fix any gaps below if needed."}
              </p>
              <button
                type="button"
                disabled={
                  scoring ||
                  syncingScores ||
                  !publishedGames.length ||
                  resultsLocked
                }
                onClick={() => {
                  if (!publishedGames.length) {
                    setScoreReport(
                      "Publish a card first (Build Card), then come back here."
                    );
                    return;
                  }
                  if (resultsLocked) {
                    setScoreReport(
                      "This week is already scored. Unlock only for dry runs."
                    );
                    return;
                  }
                  if (preseasonToolsOk) {
                    if (!requirePreseasonTools()) return;
                    void randomizeAndScoreWeek();
                    return;
                  }
                  // Live: sync + score when complete
                  void syncFinalScores(true);
                }}
                className="w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold disabled:opacity-50 shadow-[0_0_24px_rgba(34,197,94,0.2)]"
              >
                {scoring || syncingScores
                  ? "Working…"
                  : resultsLocked
                    ? `${weekTitle(activeWeek)} already scored ✓`
                    : preseasonToolsOk
                      ? `Score ${weekTitle(activeWeek)} (practice)`
                      : `Score ${weekTitle(activeWeek)}`}
              </button>
              {(scoreReport || syncReport) && (
                <p className="text-xs text-muted whitespace-pre-wrap max-h-28 overflow-y-auto">
                  {scoreReport || syncReport}
                </p>
              )}
            </div>

            {firstTime && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 mb-6 text-xs text-muted leading-relaxed">
                Use the green button above. That&apos;s the whole host job after
                games finish.
              </div>
            )}

            {/* Advanced: sandbox auto-score + manual tools */}
            <details
              className={`rounded-xl border p-4 mb-6 ${
                preseasonToolsOk
                  ? "border-warning/50 bg-warning/5"
                  : "border-border bg-card"
              }`}
            >
              <summary className="text-sm font-semibold cursor-pointer text-muted">
                Advanced scoring tools
              </summary>
            <div
              className={`mt-3 space-y-3 ${
                preseasonToolsOk ? "" : ""
              }`}
            >
              <h2
                className={`font-semibold ${
                  preseasonToolsOk ? "text-warning" : "text-muted"
                }`}
              >
                Auto-score weeks (sandbox)
                {!preseasonToolsOk && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-muted border border-border px-1.5 py-0.5 rounded">
                    Pre-season only
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                {preseasonToolsOk ? (
                  <>
                    Pick a range. Each unscored week gets: demo card → bot picks
                    → random results → score. Already-scored weeks are skipped.
                    Leave this tab open while it runs.
                  </>
                ) : (
                  <>
                    Locked after season open ({getSeasonOpenLabel(league?.sportId)}). This was a
                    pre-season trainer for the Commish role — not for live
                    weeks. Tap Run below for the full note.
                  </>
                )}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-muted">
                  From
                  <select
                    value={autoFromWeek}
                    disabled={autoSeasonBusy || !preseasonToolsOk}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setAutoFromWeek(v);
                      if (v > autoToWeek) setAutoToWeek(v);
                    }}
                    className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground disabled:opacity-50"
                  >
                    {listSeasonWeekNumbers(league?.sportId).map(
                      (w) => (
                        <option key={w} value={w}>
                          {weekTitle(w)}
                          {scoredWeeks.includes(w) ? " · scored" : ""}
                        </option>
                      )
                    )}
                  </select>
                </label>
                <label className="block text-xs text-muted">
                  Through
                  <select
                    value={autoToWeek}
                    disabled={autoSeasonBusy || !preseasonToolsOk}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setAutoToWeek(v);
                      if (v < autoFromWeek) setAutoFromWeek(v);
                    }}
                    className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground disabled:opacity-50"
                  >
                    {listSeasonWeekNumbers(league?.sportId).map(
                      (w) => (
                        <option key={w} value={w}>
                          {weekTitle(w)}
                          {scoredWeeks.includes(w) ? " · scored" : ""}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={autoSeasonBusy || !preseasonToolsOk}
                  onClick={() => {
                    if (!requirePreseasonTools()) return;
                    setAutoFromWeek(activeWeek);
                    setAutoToWeek(activeWeek);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-card-hover disabled:opacity-50"
                >
                  This week only
                </button>
                <button
                  type="button"
                  disabled={autoSeasonBusy || !preseasonToolsOk}
                  onClick={() => {
                    if (!requirePreseasonTools()) return;
                    const minW = leagueSeasonMin();
                    const maxW = leagueSeasonMax();
                    const start =
                      scoredWeeks.length === 0
                        ? minW
                        : Math.min(
                            maxW,
                            Math.max(minW, Math.max(...scoredWeeks) + 1)
                          );
                    setAutoFromWeek(start);
                    setAutoToWeek(Math.min(maxW, start));
                  }}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-card-hover disabled:opacity-50"
                >
                  Next unscored
                </button>
                <button
                  type="button"
                  disabled={autoSeasonBusy || !preseasonToolsOk}
                  onClick={() => {
                    if (!requirePreseasonTools()) return;
                    const minW = leagueSeasonMin();
                    const maxW = leagueSeasonMax();
                    const start =
                      scoredWeeks.length === 0
                        ? minW
                        : Math.min(
                            maxW,
                            Math.max(minW, Math.max(...scoredWeeks) + 1)
                          );
                    setAutoFromWeek(start);
                    setAutoToWeek(maxW);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-card-hover disabled:opacity-50"
                >
                  Rest of season
                </button>
                <button
                  type="button"
                  disabled={autoSeasonBusy || !preseasonToolsOk}
                  onClick={() => {
                    if (!requirePreseasonTools()) return;
                    setAutoFromWeek(leagueSeasonMin());
                    setAutoToWeek(leagueSeasonMax());
                  }}
                  className="px-3 py-1.5 rounded-lg border border-warning/50 text-warning text-xs font-medium hover:bg-warning/10 disabled:opacity-50"
                >
                  {leagueFootballSport() === "nfl"
                    ? "Full 1 → Super Bowl"
                    : "Full 0 → Final"}
                </button>
              </div>

              <button
                type="button"
                disabled={autoSeasonBusy}
                onClick={() => void handleAutoFinishRange()}
                className={`w-full py-3.5 rounded-xl font-bold bg-warning text-black text-sm disabled:opacity-50 ${
                  !preseasonToolsOk ? "opacity-45" : ""
                }`}
              >
                {autoSeasonBusy
                  ? "Running… keep this tab open"
                  : !preseasonToolsOk
                    ? "Auto-score (locked) — tap for why"
                    : autoFromWeek === autoToWeek
                      ? `Auto-score ${weekTitle(autoFromWeek)} only`
                      : `Auto-score ${weekTitle(autoFromWeek)} → ${weekTitle(autoToWeek)}`}
              </button>
              {autoSeasonReport && (
                <p
                  className={`text-xs leading-relaxed font-medium ${
                    /fail|error|stopped|0 players/i.test(autoSeasonReport)
                      ? "text-danger"
                      : "text-foreground"
                  }`}
                >
                  {autoSeasonReport}
                </p>
              )}
            </div>
            </details>

            {/* Week picker for scoring */}
            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <h2 className="font-semibold mb-1">Score which week?</h2>
              <p className="text-xs text-muted mb-3">
                Select a week with a published card.{" "}
                <strong className="text-foreground">Scored weeks lock</strong>{" "}
                so you don&apos;t overwrite them by accident. Unlock only to
                re-score a dry run.
              </p>
              <div className="flex flex-wrap gap-2">
                {listSeasonWeekNumbers(league?.sportId).map(
                  (w) => {
                    const scored = scoredWeeks.includes(w);
                    return (
                      <button
                        key={w}
                        type="button"
                        title={
                          scored
                            ? `${weekTitle(w)} — scored (view / locked)`
                            : weekTitle(w)
                        }
                        onClick={() => void changeActiveWeek(w)}
                        className={weekChipClass({
                          active: activeWeek === w,
                          scored,
                          cutHint: w === 14,
                        })}
                      >
                        {weekTitle(w)}
                        {scored ? " · done" : ""}
                      </button>
                    );
                  }
                )}
              </div>
              <p className="text-[11px] text-muted mt-3">
                <span className="text-stone-400">Muted + diagonal</span> = week
                already scored (still open to view; unlock to re-score). Dry-run:
                publish → bot picks → results → score → next week.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-semibold mb-1">
                    Enter Results — {weekTitle(activeWeek)}
                    {resultsLocked && (
                      <span className="ml-2 text-xs font-bold uppercase tracking-wide text-ok border border-ok/40 px-2 py-0.5 rounded-full">
                        Locked
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted">
                    {weekSubtitle(activeWeek)}
                    {formatCardDateRange(publishedGames)
                      ? ` · ${formatCardDateRange(publishedGames)}`
                      : ""}
                  </p>
                  {resultsLocked && scoredAtLabel && (
                    <p className="text-[11px] text-ok mt-1 font-medium">
                      Scored {scoredAtLabel}. View only unless you unlock.
                    </p>
                  )}
                  <p className="text-[11px] text-muted mt-1">
                    Auto-sync uses The Odds API finals (last 3 days) + your
                    locked spreads for ATS. Prop still needs a manual pick.
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void randomizeAndScoreWeek()}
                    disabled={
                      preseasonToolsOk &&
                      (!publishedGames.length || resultsLocked || scoring)
                    }
                    className={`px-4 py-2 rounded-lg bg-warning text-black text-sm font-bold hover:bg-warning/90 disabled:opacity-50 ${
                      !preseasonToolsOk ? "opacity-45" : ""
                    }`}
                    title={
                      preseasonToolsOk
                        ? "One tap: random covers + prop + score the league"
                        : "Pre-season practice only — tap for why"
                    }
                  >
                    {scoring
                      ? "Scoring…"
                      : !preseasonToolsOk
                        ? "Randomize & score (locked)"
                        : resultsLocked
                          ? "Week scored ✓"
                          : "Randomize & score"}
                  </button>
                  <button
                    type="button"
                    onClick={randomizeResultsForDryRun}
                    disabled={
                      preseasonToolsOk &&
                      (!publishedGames.length || resultsLocked)
                    }
                    className={`px-4 py-2 rounded-lg border border-warning text-warning text-sm font-semibold hover:bg-warning/10 disabled:opacity-50 ${
                      !preseasonToolsOk ? "opacity-45" : ""
                    }`}
                    title={
                      preseasonToolsOk
                        ? "Fill random covers only — then Save & Score yourself"
                        : "Pre-season practice only — tap for why"
                    }
                  >
                    Randomize results
                  </button>
                  <button
                    type="button"
                    onClick={() => syncFinalScores(false)}
                    disabled={
                      syncingScores ||
                      !publishedGames.length ||
                      resultsLocked
                    }
                    className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-medium disabled:opacity-50"
                  >
                    {syncingScores ? "Syncing…" : "Sync final scores"}
                  </button>
                  {resultsLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          if (
                            !confirm(
                              `Clear the “done” mark on ${weekTitle(activeWeek)}?\n\n` +
                                "Removes week results so the pill is not struck through.\n" +
                                "Does NOT delete the published card or player picks.\n" +
                                "Use for dry runs / accidental Founder score."
                            )
                          ) {
                            return;
                          }
                          const res = await clearWeekScoreInCloud(activeWeek);
                          if (!res.ok) {
                            setScoreReport(
                              res.error || "Could not clear week score"
                            );
                            return;
                          }
                          setResultsLocked(false);
                          setResults({});
                          setPropResult(null);
                          setResultsSaved(false);
                          setScoredAtLabel(null);
                          await refreshScoredWeeks();
                          setScoreReport(
                            `${weekTitle(activeWeek)} cleared — no longer marked done. Card & picks kept.`
                          );
                        })();
                      }}
                      className="px-4 py-2 rounded-lg border border-border text-muted text-sm font-medium"
                    >
                      Clear done · unlock week
                    </button>
                  )}
                </div>
              </div>
              {syncReport && (
                <pre className="text-xs text-muted whitespace-pre-wrap mb-4 rounded-lg border border-border bg-background p-3 max-h-40 overflow-y-auto">
                  {syncReport}
                </pre>
              )}
              {!publishedGames.length ? (
                <p className="text-sm text-danger py-4">
                  No published card for {weekTitle(activeWeek)}. Go to{" "}
                  <strong>Build Card</strong>, select this week, publish 5
                  games, then fill bot picks.
                </p>
              ) : (
              <div className={`space-y-4 ${resultsLocked ? "opacity-90" : ""}`}>
                {publishedGames.map((game) => {
                  const res = results[game.id];
                  const kick = formatKickoff(
                    game.commenceTime || game.startTime
                  );
                  return (
                    <div key={game.id} className="border border-border rounded-lg p-4">
                      <div className="font-medium">
                        {game.awayTeam} @ {game.homeTeam}
                      </div>
                      <div className="text-xs text-primary mb-3">{kick.full}</div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          disabled={resultsLocked}
                          onClick={() => setGameWinner(game.id, "away")}
                          className={
                            res?.winner === "away"
                              ? "py-2 rounded-lg text-sm border border-primary bg-primary/10 text-primary disabled:opacity-80"
                              : "py-2 rounded-lg text-sm border border-border disabled:opacity-50 disabled:cursor-not-allowed"
                          }
                        >
                          {game.awayTeam}
                        </button>
                        <button
                          type="button"
                          disabled={resultsLocked}
                          onClick={() => setGameWinner(game.id, "push")}
                          className={
                            res?.winner === "push"
                              ? "py-2 rounded-lg text-sm border border-primary bg-primary/10 text-primary disabled:opacity-80"
                              : "py-2 rounded-lg text-sm border border-border disabled:opacity-50 disabled:cursor-not-allowed"
                          }
                        >
                          Push
                        </button>
                        <button
                          type="button"
                          disabled={resultsLocked}
                          onClick={() => setGameWinner(game.id, "home")}
                          className={
                            res?.winner === "home"
                              ? "py-2 rounded-lg text-sm border border-primary bg-primary/10 text-primary disabled:opacity-80"
                              : "py-2 rounded-lg text-sm border border-border disabled:opacity-50 disabled:cursor-not-allowed"
                          }
                        >
                          {game.homeTeam}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <h2 className="font-semibold mb-2">Prop Result</h2>
              <p className="text-xs text-muted mb-1">
                Locked from the published {weekTitle(activeWeek)} card. Most
                presets auto-fill when you Sync final scores (custom + OT are
                manual).
              </p>
              {propRefreshing ? (
                <p className="text-sm text-muted">Loading published prop…</p>
              ) : publishedProp?.question ? (
                <>
                  <p className="text-sm text-foreground mb-3">
                    {publishedProp.question}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {publishedProp.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        disabled={resultsLocked}
                        onClick={() => {
                          if (resultsLocked) return;
                          setPropResult(opt);
                          setResultsSaved(false);
                        }}
                        className={
                          propResult === opt
                            ? "py-2.5 rounded-lg text-sm border border-primary bg-primary/10 text-primary disabled:opacity-80"
                            : "py-2.5 rounded-lg text-sm border border-border disabled:opacity-50 disabled:cursor-not-allowed"
                        }
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {propResult && (
                    <p className="text-[11px] text-primary mt-2">
                      Selected: {propResult}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-danger">
                  No published prop for this week. Go to Build Card, pick the
                  prop, and press Publish before entering results.
                </p>
              )}
            </div>

            <button
              disabled={!allResultsIn || resultsLocked || scoring}
              onClick={() => void handleSaveResults()}
              className={
                !allResultsIn || resultsLocked || scoring
                  ? "w-full py-3 rounded-xl font-semibold mb-6 bg-border text-muted cursor-not-allowed"
                  : "w-full py-3 rounded-xl font-semibold mb-6 bg-primary text-black"
              }
            >
              {scoring
                ? "Scoring…"
                : resultsLocked
                  ? `${weekTitle(activeWeek)} locked ✓`
                  : resultsSaved
                    ? "Save Results & Score League"
                    : "Save Results & Score League"}
            </button>

            {scoreReport && (
              <div className="rounded-xl border border-primary/40 bg-card p-4 text-sm text-primary mb-4">
                {scoreReport}
              </div>
            )}
            {demoScore && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold mb-3">Your Picks Scored</h3>
                <div className="text-2xl font-bold text-primary">
                  {demoScore.totalPoints} pts
                </div>
              </div>
            )}
            {resultsSaved && !hasPlayerPicks && (
              <p className="text-sm text-muted mt-3">
                No picks found. Lock picks first, then re-save results.
              </p>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

export default function CommissionerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          Loading Commish tools…
        </div>
      }
    >
      <CommissionerPageInner />
    </Suspense>
  );
}
