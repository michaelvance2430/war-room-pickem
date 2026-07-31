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
  seedTrialBotsInCloud,
  clearTrialBotsInCloud,
  seedBotPicksForWeekInCloud,
  applyRandomBotChaosForWeek,
  fillLeagueWithBotsToCap,
  listScoredWeekNumbers,
  loadWeekResultsFromCloud,
  loadLeagueRoster,
  setMemberModeration,
  refreshStaffSessionFlags,
  type LeagueRosterMember,
  PickSubmissionStatus,
} from "@/lib/cloud";
import { transferCommissioner } from "@/lib/trophies";
import { recordCommissionerWeek } from "@/lib/commish-tenure";
import CommishWeekChecklist from "@/components/CommishWeekChecklist";
import SportPoolCommishPanel from "@/components/SportPoolCommishPanel";
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
} from "@/lib/season-calendar";
import { autoFinishRemainingWeeks } from "@/lib/sandbox-auto-finish";
import {
  isPreseasonCommishToolsAllowed,
  PRESEASON_COMMISH_TOOLS_TITLE,
  preseasonCommishToolsBody,
} from "@/lib/season-mode";
import { getSeasonOpenLabel } from "@/lib/season-countdown";
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
  SEASON_THEME_PRESETS,
  DEFAULT_SEASON_THEME_ID,
  applySeasonTheme,
  resolveSeasonThemeId,
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
  /** Build Card: jump to ranked matchups first */
  const [rankHeatFilter, setRankHeatFilter] =
    useState<RankHeatFilter>("heat");
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
      const ft =
        !!owner &&
        !!lg?.id &&
        isFirstTimeCommish({ leagueId: lg.id, scoredWeekCount: scoredCount });
      setFirstTime(ft);
      setAdvancedOpen(!ft);

      // URL ?tab=card&first=1 or first-time owner → land on Build Card
      const tabParam = searchParams.get("tab");
      const firstParam = searchParams.get("first");
      if (
        tabParam === "card" ||
        tabParam === "results" ||
        tabParam === "settings" ||
        tabParam === "picks"
      ) {
        if (tabParam === "settings" && !owner) setTab("card");
        else setTab(tabParam);
      } else if (ft || firstParam === "1") {
        setTab("card");
      } else if (owner) {
        setTab("settings");
      } else {
        setTab("card");
      }

      if (lg) {
        setLeague(lg);
        setLeagueNameEdit(lg.name);
        setCutPercent(lg.settings?.cutPercent ?? 50);
        setCrystalBallEnabled(lg.settings?.crystalBallEnabled !== false);
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
        setPassRoster(
          roster.filter(
            (m) => !m.isBot && m.userId !== session?.playerId
          )
        );
        // Sensible default: add enough to reach ideal 16 if under; else a few
        const open = Math.max(0, MAX_LEAGUE_PLAYERS - roster.length);
        const toIdeal = Math.max(0, 16 - roster.length);
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
    setCardSaved(false);
    setBotReport(
      `Demo slate ready for ${weekTitle(activeWeek)} (5 fake ${sport === "nfl" ? "NFL" : "CFB"} games). Or use “Publish demo week” for one tap.`
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
    setDemoBusy(false);
    if (botFill.ok && (botFill.botsFilled || 0) > 0) {
      const chaos =
        (botFill.chaosCount ?? 0) > 0
          ? ` · 💥 ${botFill.chaosCount} Chaos`
          : "";
      setBotReport(
        `Demo week published · ${botFill.botsFilled} bot(s) locked picks${chaos}. Enter Results → Randomize & score.`
      );
      void refreshPickStatus(activeWeek);
    } else {
      setBotReport(
        `Demo week published for ${weekTitle(activeWeek)}. Bots will pick if seats exist — then Randomize & score.`
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
    const { results: r, propResult: pr } = randomizeDemoResults(
      publishedGames,
      propOpts
    );
    setResults(r);
    setPropResult(pr);
    setResultsSaved(false);
    setScoreReport(
      `Randomized covers + prop for ${weekTitle(activeWeek)}. Or use “Randomize & score” for one tap.`
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
    const { results: r, propResult: pr } = randomizeDemoResults(
      publishedGames,
      propOpts
    );
    setResults(r);
    setPropResult(pr);
    setResultsSaved(false);
    setScoreReport(`Randomized ${weekTitle(activeWeek)} — scoring…`);
    await handleSaveResults({ results: r, propResult: pr });
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
   * mode: exact count | grow to target total (16 ideal / 32 max).
   */
  async function handleAddBots(opts: {
    addCount?: number;
    targetTotal?: number;
    label: string;
  }) {
    if (!requirePreseasonTools()) return;
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
    if (
      !confirm(
        `${opts.label}\n\n` +
          "• Only fills EMPTY seats (never removes humans or existing bots)\n" +
          "• Soft cap 32 · Ideal pad target is often 16 (clean 8+8 brackets)\n" +
          "• New bots auto-pick if this week’s card is published"
      )
    ) {
      return;
    }
    setBotReport(null);
    setBotBusy(true);
    const hasCard = publishedGames.length > 0;
    const res = await fillLeagueWithBotsToCap({
      ...(hasCard ? { weekNumber: activeWeek } : {}),
      ...(opts.addCount != null ? { addCount: opts.addCount } : {}),
      ...(opts.targetTotal != null ? { targetTotal: opts.targetTotal } : {}),
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
    if ((res.botsFilled ?? 0) > 0) {
      parts.push(
        `locked ${res.botsFilled} bot slip(s) for ${weekTitle(activeWeek)}`
      );
    } else if (!hasCard) {
      parts.push("publish a week so bots get picks (or Fill bot picks)");
    }
    setBotReport(parts.join(" · ") + ".");
  }

  async function handleFillBotPicks() {
    if (!requirePreseasonTools()) return;
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
    if (
      !confirm(
        "Remove ALL trial bots and their picks?\n\nReal players who signed up stay in the league."
      )
    ) {
      return;
    }
    setBotReport(null);
    setBotBusy(true);
    const res = await clearTrialBotsInCloud();
    setBotBusy(false);
    if (!res.ok) {
      setBotReport(res.error || "Failed to clear bots");
      return;
    }
    if ((res.removed ?? 0) === 0) {
      setBotReport(
        "No trial bots found to remove (0). If you still see bot names on Players, run supabase/clear-trial-bots-now.sql in Supabase SQL Editor once — that force-wipes @warroom.trial bots."
      );
      return;
    }
    setBotReport(
      `Removed ${res.removed ?? 0} trial bot(s). Real members unchanged. Check Players to confirm.`
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
      setResultsSaved(false);

      const lines = built.details
        .map((d) => {
          if (d.status === "final") {
            return `✓ ${d.label}: ${d.scoreLine} → ${d.winner?.toUpperCase()} covers`;
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
        `Auto-filled ${built.filled} of ${publishedGames.length} games (last 3 days of scores).\n${lines}${propLine}`
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
    });

    setResultsSaved(true);
    setScoring(false);

    if (!cloud.ok) {
      setScoreReport(cloud.error || "Cloud scoring failed");
      applyWeekScores();
      return;
    }

    // Lock this week after a successful score pass
    setResultsLocked(true);
    setScoredAtLabel(new Date().toLocaleString());
    void refreshScoredWeeks();

    if (cloud.scoredCount === 0) {
      setScoreReport(
        cloud.error ||
          `Saved results for ${weekTitle(activeWeek)} (locked). No locked picks found yet — fill bot picks first.`
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
        ? `${weekTitle(activeWeek)} scored & locked · ${cloud.scoredCount} player(s). You're a real Commish now — Advanced tools unlocked.${advanceNote} ${lines}`
        : `${weekTitle(activeWeek)} scored & locked · ${cloud.scoredCount} player(s).${advanceNote} ${lines}`
    );
  }

  /**
   * Sandbox auto-run: demo card → bots → random results → score
   * for a chosen inclusive week range (one week up to full 0–18).
   */
  async function handleAutoFinishRange(opts?: {
    from?: number;
    to?: number;
    skipConfirm?: boolean;
  }) {
    if (!requirePreseasonTools()) return;
    let from = opts?.from ?? autoFromWeek;
    let to = opts?.to ?? autoToWeek;
    from = Math.max(0, Math.min(SEASON_MAX_WEEK, from));
    to = Math.max(0, Math.min(SEASON_MAX_WEEK, to));
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
    const full = from === 0 && to === SEASON_MAX_WEEK;
    if (
      !opts?.skipConfirm &&
      !confirm(
        one
          ? `Auto-score ${weekTitle(from)} only?\n\n` +
              "Demo card → bot picks → random results → score.\n" +
              "Sandbox / dry-run."
          : full
            ? `Run ENTIRE season (Week 0 → CFP Final)?\n\n` +
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
    const firstUnscored = (() => {
      for (let w = 0; w <= SEASON_MAX_WEEK; w++) {
        if (!scoredWeeks.includes(w)) return w;
      }
      return null;
    })();
    if (firstUnscored == null) {
      setAutoSeasonReport(
        "All weeks 0–18 are already scored. Season complete — open Champ / Toilet / Trophies."
      );
      return;
    }
    setAutoFromWeek(firstUnscored);
    setAutoToWeek(SEASON_MAX_WEEK);
    await handleAutoFinishRange({
      from: firstUnscored,
      to: SEASON_MAX_WEEK,
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
   * Wipe picks / cards / results / scores. Keep every member.
   * Triple confirmation so it can't fire mid-season by accident.
   */
  async function handleResetSeason() {
    setSeasonResetReport(null);

    const { isSandboxMode } = await import("@/lib/season-mode");
    const sandbox = isSandboxMode();
    const ok1 = confirm(
      "RESET SEASON?\n\n" +
        "This will DELETE:\n" +
        "• All week cards & games\n" +
        "• All player picks\n" +
        "• All results & season scores/stats\n" +
        "• League announcements\n" +
        (sandbox
          ? "• Sandbox Trophy Room engravings (dry-run rings)\n" +
            "• Sim achievement points / First & Final / Elite Commish on this device\n"
          : "") +
        "\nThis will KEEP:\n" +
        "• Every player who joined\n" +
        "• Divisions, roles, league code & settings\n" +
        "• Profile photos\n" +
        (sandbox
          ? "• Real prior-season Legends only (Kahmann / Bill ball Ben / creator)\n"
          : "• Trophy Room history + career cheevos (real season)\n") +
        "\nAlso clears Gazette Archive headlines for this season.\n\n" +
        (sandbox
          ? "SANDBOX MODE: fake weeks do not stick after reset.\n\n"
          : "REAL SEASON: career cheevos stay after reset.\n\n") +
        "Continue?"
    );
    if (!ok1) return;

    const ok2 = confirm(
      "Last chance.\n\n" +
        "This cannot be undone.\n" +
        "Players stay in the league with zeroed scores.\n\n" +
        "Reset the season now?"
    );
    if (!ok2) return;

    const typed = window.prompt(
      'Type RESET (all caps) to confirm season reset.\n\nAnything else cancels.'
    );
    if (typed !== "RESET") {
      setSeasonResetReport("Season reset cancelled — you must type RESET exactly.");
      return;
    }

    setResettingSeason(true);
    const result = await resetSeasonInCloud();
    setResettingSeason(false);

    if (!result.ok) {
      setSeasonResetReport(result.error || "Season reset failed");
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
        `Reset ran but ${stillScored.length} scored week(s) still exist (${stillScored.join(", ")}). ` +
          "Run supabase/reset-season.sql in Supabase SQL Editor, then reset again."
      );
      return;
    }

    const kept = result.membersKept ?? "?";
    const picks = result.picksDeleted ?? 0;
    const cards = result.cardsDeleted ?? 0;
    const results = result.resultsDeleted ?? 0;
    setSeasonResetReport(
      `Season reset complete. Kept ${kept} member(s). Removed ${cards} card(s), ${picks} pick sheet(s), ${results} scored week(s). Scores zeroed. Ready for Week 0 — re-add bots, then Run season.`
    );
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
                ? "Your first week as host"
                : "Commissioner Tools"
              : "Deputy Ops"}
          </h1>
          <p className="text-sm text-muted">
            {isOwner
              ? firstTime
                ? "Invite → publish a card (demo is fine) → score once. Advanced tools unlock after."
                : "Settings • Build card • Who\u2019s in • Results"
              : "Build card • Who\u2019s in • Results (settings stay with the commissioner)"}
          </p>
          {firstTime && isOwner && (
            <div className="mt-3 rounded-xl border-2 border-primary/50 bg-primary/10 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
                First-time mode
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                Stick to the checklist.{" "}
                <strong className="text-primary">Demo slate</strong> costs zero
                odds credits — perfect for a practice week with bots or just
                you. Full toolbox (bots bulk, reset, pass) stays under Settings
                → Advanced until you score a real week.
              </p>
            </div>
          )}
          <div className="mt-3 rounded-xl border-2 border-warning bg-warning/15 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-warning">View as player</p>
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
                scores ≈ 2). Updates after each Pull Odds or Sync final scores.
                Demo slate uses zero credits. Upgrade mid-season by replacing{" "}
                <code className="text-foreground">ODDS_API_KEY</code> in Vercel
                and redeploying — league scores/picks are untouched.
              </p>
            </div>
          )}
          {oddsCreditsRemaining == null && (
            <p className="mt-2 text-[11px] text-muted">
              Odds API credit balance appears after you{" "}
              <strong className="text-foreground">Pull Odds</strong> or{" "}
              <strong className="text-foreground">Sync final scores</strong>{" "}
              once.
            </p>
          )}
        </div>

        <CommishWeekChecklist
          onGoTab={(t) => {
            setTab(t);
            if (t === "picks") void refreshPickStatus();
            if (t === "results") void refreshPublishedProp(activeWeek);
          }}
        />

        <div id="commish-tab-panel" className="scroll-mt-20">
        <div className="flex flex-wrap gap-2 mb-6">
          {isOwner && (
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

        {tab === "settings" && isOwner && league && (
          <div className="space-y-6">
            <SportPoolCommishPanel />

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
                    Holiday / season background
                  </p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Every sport pack includes this.{" "}
                    <strong className="text-foreground">Sport default</strong>{" "}
                    = this league&apos;s pack look (CFB green, NFL primetime,
                    etc.). Holidays (Halloween, Thanksgiving, Christmas, New
                    Year…) wash <strong className="text-foreground">every
                    page</strong> for the whole room — same picker for CFB, NFL,
                    and future packs. We can add more seasons anytime.
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
                    {SEASON_THEME_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[11px] text-muted leading-relaxed">
                  {SEASON_THEME_PRESETS.find((p) => p.id === seasonThemeId)
                    ?.blurb || ""}{" "}
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
                    Shortcut here: finish everything left through CFP Final.
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
                    ? "Finish remaining → CFP Final"
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
              className={`rounded-xl border p-5 space-y-3 ${
                preseasonToolsOk
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              <h2
                className={`font-semibold ${
                  preseasonToolsOk ? "text-primary" : "text-muted"
                }`}
              >
                Pad league with bots
                {!preseasonToolsOk && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-muted border border-border px-1.5 py-0.5 rounded">
                    Pre-season only
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                {preseasonToolsOk ? (
                  <>
                    Optional. Adds bots to{" "}
                    <strong className="text-foreground">empty seats only</strong>{" "}
                    (max {MAX_LEAGUE_PLAYERS}). Real humans stay. Choose a count
                    so you can round out brackets without stuffing the room to
                    32.
                  </>
                ) : (
                  <>
                    Trial bots are a pre-season practice tool (learn the
                    Commish role before {getSeasonOpenLabel(league?.sportId)}). Add / fill locked
                    now — Clear bots still works if leftovers remain.
                  </>
                )}
              </p>
              <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-[11px] text-muted leading-relaxed">
                <p className="text-foreground font-medium text-xs mb-1">
                  Ideal roster sizes (dual brackets)
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>
                    <strong className="text-foreground">16 total</strong> —
                    sweet spot (8 Champ + 8 Toilet, clean byes)
                  </li>
                  <li>
                    <strong className="text-foreground">8</strong> — minimum
                    that still feels like a league (4+4)
                  </li>
                  <li>
                    <strong className="text-foreground">32</strong> — hard max
                    (16+16, full CFP window)
                  </li>
                  <li>12–24 is the usual friend-group range</li>
                </ul>
                {rosterCount != null && (
                  <p className="mt-2 text-foreground/90">
                    Now: <strong>{rosterCount}</strong> players ·{" "}
                    <strong>
                      {Math.max(0, MAX_LEAGUE_PLAYERS - rosterCount)}
                    </strong>{" "}
                    open
                    {rosterCount < 16
                      ? ` · need ${16 - rosterCount} more to hit 16`
                      : rosterCount < 32
                        ? " · already past ideal 16"
                        : " · full"}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block text-xs text-muted">
                  Add this many bots
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
                    className="mt-1 w-24 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono"
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
                  className={`px-4 py-2 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-50 ${
                    !preseasonToolsOk ? "opacity-45" : ""
                  }`}
                >
                  {botBusy
                    ? "Working…"
                    : preseasonToolsOk
                      ? `Add ${botAddCount} bot${botAddCount === 1 ? "" : "s"}`
                      : "Add bots (locked)"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={botBusy}
                  onClick={() =>
                    void handleAddBots({
                      targetTotal: 16,
                      label:
                        "Fill roster toward 16 (ideal 8+8 brackets)? Only adds what’s missing.",
                    })
                  }
                  className={`px-3 py-1.5 rounded-lg border border-primary/50 text-primary text-xs font-medium hover:bg-primary/10 disabled:opacity-50 ${
                    !preseasonToolsOk ? "opacity-45" : ""
                  }`}
                >
                  Fill to 16 (ideal)
                </button>
                <button
                  type="button"
                  disabled={botBusy}
                  onClick={() =>
                    void handleAddBots({
                      targetTotal: 32,
                      label:
                        "Fill roster to 32 (max / 16+16 brackets)? Only empty seats.",
                    })
                  }
                  className={`px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-card-hover disabled:opacity-50 ${
                    !preseasonToolsOk ? "opacity-45" : ""
                  }`}
                >
                  Fill to 32 (max)
                </button>
                <button
                  type="button"
                  disabled={botBusy}
                  onClick={() => void handleFillBotPicks()}
                  className={`px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-card-hover disabled:opacity-50 ${
                    !preseasonToolsOk ? "opacity-45" : ""
                  }`}
                >
                  Fill bot picks (this week)
                </button>
                <button
                  type="button"
                  disabled={botBusy}
                  onClick={() => void handleBotChaosReroll()}
                  className={`px-3 py-1.5 rounded-lg border border-orange-500/50 text-orange-200 text-xs font-medium hover:bg-orange-500/10 disabled:opacity-50 ${
                    !preseasonToolsOk ? "opacity-45" : ""
                  }`}
                  title="~22% of bots lock Chaos (2× week). Needs bot-chaos-sim.sql once."
                >
                  💥 Bot Chaos (~1 in 5)
                </button>
                <button
                  type="button"
                  disabled={botBusy}
                  onClick={() => void handleClearBots()}
                  className="px-3 py-1.5 rounded-lg border border-warning text-warning text-xs font-medium hover:bg-warning/10 disabled:opacity-50"
                >
                  Clear bots
                </button>
              </div>
              <p className="text-[11px] text-muted">
                Setup once if buttons fail:{" "}
                <code className="text-foreground">supabase/trial-bots.sql</code>
                , optional{" "}
                <code className="text-foreground">supabase/bot-picks-smarter.sql</code>
                ,{" "}
                <code className="text-foreground">supabase/bot-chaos-sim.sql</code>{" "}
                (random bot Chaos for sims),{" "}
                <code className="text-foreground">supabase/league-capacity-32.sql</code>
                .
              </p>
              {botReport && (
                <p
                  className={`text-xs leading-relaxed ${
                    botReport.toLowerCase().includes("fail") ||
                    botReport.toLowerCase().includes("missing")
                      ? "text-danger"
                      : "text-primary"
                  }`}
                >
                  {botReport}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-amber-400/30 bg-card p-5 space-y-3">
              <h2 className="font-semibold text-amber-300">Trophy Room</h2>
              <p className="text-xs text-muted leading-relaxed">
                Engrave Championship, Toilet Bowl, and Village Nerd (Crystal
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
                Stepping down? Hand the keys to another member. They become
                commissioner; you stay as a player.{" "}
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

            <div className="rounded-xl border border-warning/40 bg-card p-5 space-y-3">
              <h2 className="font-semibold text-warning">Reset season</h2>
              <p className="text-xs text-muted leading-relaxed">
                After testing (or before kickoff of the real season): wipe all
                cards, picks, results, and scores.{" "}
                <span className="text-foreground font-medium">
                  Everyone who joined stays in the league
                </span>{" "}
                with zeroed stats. League code, settings, divisions, profile
                photos, and{" "}
                <span className="text-foreground font-medium">Trophy Room</span>{" "}
                history are kept. Requires typing{" "}
                <span className="font-mono text-foreground">RESET</span> to
                confirm — hard to do by accident mid-season.
              </p>
              <button
                type="button"
                disabled={resettingSeason}
                onClick={() => void handleResetSeason()}
                className="px-4 py-2 rounded-lg border border-warning text-warning text-sm font-medium hover:bg-warning/10 disabled:opacity-50"
              >
                {resettingSeason
                  ? "Resetting season…"
                  : "Reset season (keep players)"}
              </button>
              {seasonResetReport && (
                <p
                  className={`text-xs leading-relaxed ${
                    seasonResetReport.toLowerCase().includes("complete")
                      ? "text-primary"
                      : "text-danger"
                  }`}
                >
                  {seasonResetReport}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-danger/40 bg-card p-5 space-y-3">
              <h2 className="font-semibold text-danger">Danger zone</h2>
              <p className="text-xs text-muted">
                Permanently deletes the whole league for everyone. Not the same
                as reset season.
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
                {listSeasonWeekNumbers(league?.sportId).map(
                  (w) => {
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
                  }
                )}
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
                        · all open FBS games (no week date filter) · assign any
                        5 to {weekTitle(activeWeek)} for season testing
                      </>
                    ) : (
                      <>
                        FBS only · filtered to{" "}
                        <span className="text-foreground font-medium">
                          {weekDateRangeLabel(activeWeek) ||
                            weekTitle(activeWeek)}
                        </span>{" "}
                        (Week 0 ≠ Week 1)
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
                availableGames.every((g) => g.bookmaker === "demo-sim") && (
                  <p className="text-xs text-warning mt-2 font-medium">
                    Demo slate loaded ({availableGames.length} fake games,
                    pre-selected). Hit Publish below.
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
                  {availableGames.length} FBS games
                  {rankLabel ? ` • Ranks: ${rankLabel}` : ""}
                  {" · "}
                  <span className="text-amber-300/90">Gold</span> both top 10
                  {" · "}
                  <span className="text-violet-300/90">Violet</span> both top 25
                  {" · "}
                  <span className="text-emerald-300/90">Green</span> one top 25
                </p>
                {(() => {
                  const heatCounts = countRankHeat(availableGames);
                  const filtered = sortGamesRankHeatFirst(
                    filterGamesByRankHeat(availableGames, rankHeatFilter)
                  );
                  const chips: {
                    id: RankHeatFilter;
                    label: string;
                    count: number;
                    accent: string;
                  }[] = [
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
                    {
                      id: "all",
                      label: "All games",
                      count: availableGames.length,
                      accent: "border-border text-muted",
                    },
                  ];
                  const dateGroups =
                    rankHeatFilter === "all"
                      ? groupGamesByDate(sortGamesRankHeatFirst(availableGames)).map(
                          (g) => ({
                            ...g,
                            games: sortGamesRankHeatFirst(g.games),
                          })
                        )
                      : [
                          {
                            dateKey: "heat",
                            dateLabel:
                              rankHeatFilter === "heat"
                                ? "Ranked matchups first"
                                : rankHeatFilter === "legendary"
                                  ? "Both Top 10"
                                  : rankHeatFilter === "top25"
                                    ? "Both Top 25"
                                    : "One team Top 25",
                            games: filtered,
                          },
                        ];
                  return (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1.5">
                        Find good games
                      </p>
                      <div className="phone-h-scroll sm:flex-wrap sm:overflow-visible gap-1.5 mb-3">
                        {chips.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            disabled={c.count === 0 && c.id !== "all"}
                            onClick={() => setRankHeatFilter(c.id)}
                            className={`px-3 py-2 min-h-[40px] rounded-full text-[11px] font-bold border transition touch-manipulation disabled:opacity-40 ${
                              rankHeatFilter === c.id
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
                      {filtered.length === 0 && rankHeatFilter !== "all" ? (
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
                          {rankHeatFilter !== "all"
                            ? " · best first"
                            : " · ranked first within day"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.games.map((g) => {
                          const selected = selectedIds.has(g.id);
                          const kick = formatKickoff(
                            g.commenceTime || g.startTime
                          );
                          const favLabel = formatRankedTeam(
                            g.favorite === "home" ? g.homeTeam : g.awayTeam,
                            g.favorite === "home" ? g.homeRank : g.awayRank
                          );
                          const confLine = formatMatchupConferences(
                            g.awayTeam,
                            g.homeTeam
                          );
                          const rankTier = getRankedMatchupTier(
                            g.awayRank,
                            g.homeRank
                          );
                          const rankBadge = rankedMatchupBadge(rankTier);
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
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {selected && (
                                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-black bg-primary px-1.5 py-0.5 rounded shrink-0">
                                        ✓ On card
                                      </span>
                                    )}
                                    <div
                                      className={`font-medium truncate ${
                                        rankTier === "legendary"
                                          ? "text-amber-100"
                                          : rankTier === "top25"
                                            ? "text-violet-100"
                                            : rankTier === "ranked"
                                              ? "text-emerald-100"
                                              : ""
                                      }`}
                                    >
                                      {formatRankedTeam(g.awayTeam, g.awayRank)}{" "}
                                      @{" "}
                                      {formatRankedTeam(g.homeTeam, g.homeRank)}
                                    </div>
                                    {rankBadge && (
                                      <span className={rankBadge.className}>
                                        {rankBadge.label}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-primary mt-0.5">
                                    {kick.full}
                                  </div>
                                  <div className="text-[11px] text-muted mt-0.5">
                                    {confLine}
                                    {g.bookmaker
                                      ? `${confLine ? " • " : ""}${g.bookmaker}`
                                      : ""}
                                  </div>
                                </div>
                                <span className="text-sm text-primary shrink-0 font-semibold">
                                  {favLabel}{" "}
                                  {g.spread < 0
                                    ? g.spread
                                    : `-${Math.abs(g.spread)}`}
                                </span>
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
            {firstTime && (
              <div className="rounded-xl border-2 border-primary/45 bg-primary/10 p-4 mb-6 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  Practice path
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  Demo card? Enter winners (or Sync if you used real odds), set
                  the prop result, then{" "}
                  <strong className="text-primary">
                    Save Results &amp; Score League
                  </strong>
                  . That one click wakes standings and unlocks Advanced tools.
                </p>
              </div>
            )}
            {/* Sandbox auto-score: one week … full season (pre-season only) */}
            <div
              className={`rounded-xl border p-5 mb-6 space-y-3 ${
                preseasonToolsOk
                  ? "border-warning/50 bg-warning/10"
                  : "border-border bg-card"
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
                    const start =
                      scoredWeeks.length === 0
                        ? 0
                        : Math.min(
                            SEASON_MAX_WEEK,
                            Math.max(...scoredWeeks) + 1
                          );
                    setAutoFromWeek(start);
                    setAutoToWeek(Math.min(SEASON_MAX_WEEK, start));
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
                    const start =
                      scoredWeeks.length === 0
                        ? 0
                        : Math.min(
                            SEASON_MAX_WEEK,
                            Math.max(...scoredWeeks) + 1
                          );
                    setAutoFromWeek(start);
                    setAutoToWeek(SEASON_MAX_WEEK);
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
                    setAutoFromWeek(0);
                    setAutoToWeek(SEASON_MAX_WEEK);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-warning/50 text-warning text-xs font-medium hover:bg-warning/10 disabled:opacity-50"
                >
                  Full 0 → Final
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
                        if (
                          confirm(
                            `Unlock ${weekTitle(activeWeek)} for re-scoring?\n\nUse only for dry runs.`
                          )
                        ) {
                          setResultsLocked(false);
                          setScoreReport(
                            `${weekTitle(activeWeek)} unlocked — edit covers and score again.`
                          );
                        }
                      }}
                      className="px-4 py-2 rounded-lg border border-border text-muted text-sm font-medium"
                    >
                      Unlock to re-score
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
