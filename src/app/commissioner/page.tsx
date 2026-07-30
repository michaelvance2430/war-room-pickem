"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { Game, Prop } from "@/lib/types";
import { fetchNcaafOdds } from "@/lib/odds";
import { generateDemoSlate, randomizeDemoResults } from "@/lib/demo-slate";
import { formatMatchupConferences } from "@/lib/fbs-teams";
import { formatRankedTeam } from "@/lib/rankings";
import { scoreWeek, GameResult } from "@/lib/scoring";
import { applyWeekScores } from "@/lib/store";
import {
  isCommissioner,
  getLeague,
  getSession,
  resetLeague,
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
  fillLeagueWithBotsToCap,
  listScoredWeekNumbers,
  loadWeekResultsFromCloud,
  loadLeagueRoster,
  type LeagueRosterMember,
  PickSubmissionStatus,
} from "@/lib/cloud";
import { transferCommissioner } from "@/lib/trophies";
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
} from "@/lib/season-calendar";
import {
  fetchNcaafScores,
  buildResultsFromScores,
} from "@/lib/scores";
import { settlePropFromScores } from "@/lib/prop-settle";
import {
  PROP_PRESETS,
  CUSTOM_PROP_ID,
  propFromPreset,
  matchPresetId,
} from "@/lib/prop-presets";
import { MAX_LEAGUE_PLAYERS } from "@/lib/league-limits";

const ACTIVE_WEEK_KEY = "warroom-active-week";

function storageKeys(week: number) {
  return {
    picks: `warroom-picks-week-${week}`,
    results: `warroom-results-week-${week}`,
    card: `warroom-card-week-${week}`,
  };
}

export default function CommissionerPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"card" | "results" | "settings" | "picks">("settings");
  const [league, setLeague] = useState<League | null>(null);
  const [leagueNameEdit, setLeagueNameEdit] = useState("");
  const [cutPercent, setCutPercent] = useState(50);
  const [crystalBallEnabled, setCrystalBallEnabled] = useState(true);
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
    propFromPreset(PROP_PRESETS[0], 1)
  );
  const [propPresetId, setPropPresetId] = useState(PROP_PRESETS[0].id);
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
  /** Skip week date filter on Pull Odds — all open FBS games for season dry-run. */
  const [dryRunOdds, setDryRunOdds] = useState(false);
  /** Weeks already scored (locked for results entry unless unlocked). */
  const [scoredWeeks, setScoredWeeks] = useState<number[]>([]);
  const [resultsLocked, setResultsLocked] = useState(false);
  const [scoredAtLabel, setScoredAtLabel] = useState<string | null>(null);
  const [passRoster, setPassRoster] = useState<LeagueRosterMember[]>([]);
  const [passToUserId, setPassToUserId] = useState("");
  const [passBusy, setPassBusy] = useState(false);
  const [passReport, setPassReport] = useState<string | null>(null);

  useEffect(() => {
    setAllowed(isCommissioner());
    async function load() {
      const lg = (await syncLeagueFromCloud()) || getLeague();
      if (lg) {
        setLeague(lg);
        setLeagueNameEdit(lg.name);
        setCutPercent(lg.settings?.cutPercent ?? 50);
        setCrystalBallEnabled(lg.settings?.crystalBallEnabled !== false);
      }
      let week = 1;
      try {
        const saved = localStorage.getItem(ACTIVE_WEEK_KEY);
        if (saved != null && saved !== "") week = parseInt(saved, 10);
        if (Number.isNaN(week)) week = 1;
      } catch {
        /* ignore */
      }
      setActiveWeek(week);
      await loadWeekState(week);
      try {
        const session = getSession();
        const roster = await loadLeagueRoster();
        setPassRoster(
          roster.filter(
            (m) => !m.isBot && m.userId !== session?.playerId
          )
        );
      } catch {
        /* ignore */
      }
    }
    load();
  }, []);

  /** Sync Build Card draft controls from a known prop (publish / full week load). */
  function applyDraftFromProp(loaded: Prop) {
    setProp(loaded);
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
    setProp(propFromPreset(PROP_PRESETS[0], week));
    setPropPresetId(PROP_PRESETS[0].id);

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

  async function pullOdds() {
    setLoadingOdds(true);
    setOddsError(null);
    try {
      const {
        games,
        rankLabel: pollLabel,
        weekFilter,
        unfilteredCount,
        dryRun,
      } = await fetchNcaafOdds(activeWeek, { dryRun: dryRunOdds });
      setRankLabel(pollLabel || null);
      if (!games.length) {
        setAvailableGames([]);
        setSelectedIds(new Set());
        const range = weekFilter || weekTitle(activeWeek);
        setOddsError(
          dryRun
            ? "No open NCAA FBS games with spreads right now (dry run). Use Generate demo slate instead."
            : unfilteredCount && unfilteredCount > 0
              ? `No FBS games with spreads in the ${weekTitle(activeWeek)} window (${range}). Use Generate demo slate for a full fake season.`
              : `No real lines for ${weekTitle(activeWeek)}. Use Generate demo slate to simulate.`
        );
        return;
      }
      setAvailableGames(games);
      setSelectedIds(new Set());
      setOddsError(null);
    } catch (e: unknown) {
      setOddsError(e instanceof Error ? e.message : "Failed to pull odds");
      setAvailableGames([]);
      setSelectedIds(new Set());
    } finally {
      setLoadingOdds(false);
    }
  }

  /** Fake 5-game card for season simulation — no Odds API. */
  function generateDemoCard() {
    setOddsError(null);
    setRankLabel("demo-sim");
    const games = generateDemoSlate(activeWeek, 5);
    setAvailableGames(games);
    setSelectedIds(new Set(games.map((g) => g.id)));
    setCardSaved(false);
    setBotReport(
      `Demo slate ready for ${weekTitle(activeWeek)} (5 fake games). Publish, then bots will pick. Enter Results → Randomize results → Score.`
    );
  }

  function randomizeResultsForDryRun() {
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
      `Randomized covers + prop for ${weekTitle(activeWeek)}. Hit Save Results & Score League.`
    );
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
    if (preset) setProp(propFromPreset(preset, activeWeek));
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
      setBotReport(
        `Published ${weekTitle(activeWeek)}. ${botFill.botsFilled} trial bot(s) locked fake picks.`
      );
      void refreshPickStatus(activeWeek);
    }
  }

  /** Fill empty seats with bots up to 32 + auto-lock picks if card is live. */
  async function handleFillLeagueWithBots() {
    if (
      !confirm(
        "Fill empty seats with bots up to 32?\n\n" +
          "• Real players stay\n" +
          "• Bots get persona-based auto picks when a week is published\n" +
          "• Use in sandbox or to pad a small league — remove anytime with Clear bots"
      )
    ) {
      return;
    }
    setBotReport(null);
    setBotBusy(true);
    const hasCard = publishedGames.length > 0;
    const res = await fillLeagueWithBotsToCap(
      hasCard ? { weekNumber: activeWeek } : undefined
    );
    setBotBusy(false);
    if (!res.ok) {
      setBotReport(res.error || "Failed to fill with bots");
      return;
    }
    if ((res.added ?? 0) === 0 && (res.botsFilled ?? 0) === 0) {
      setBotReport(
        `Already at capacity or no bots needed (32 max). Bots in league: ${res.totalBots ?? 0}.`
      );
      return;
    }
    void refreshPickStatus(activeWeek);
    const parts: string[] = [];
    if ((res.added ?? 0) > 0) {
      parts.push(
        `Added ${res.added} bot(s) (${res.totalBots} bots total · filled empty seats toward 32)`
      );
    } else {
      parts.push(`No new bots (${res.totalBots ?? 0} already in league)`);
    }
    if ((res.botsFilled ?? 0) > 0) {
      parts.push(
        `locked ${res.botsFilled} bot slip(s) for ${weekTitle(activeWeek)}`
      );
    } else if (!hasCard) {
      parts.push(
        "publish a week card next — bots auto-pick on publish (or use Fill bot picks)"
      );
    }
    setBotReport(parts.join(" · ") + ".");
  }

  async function handleSeedBots() {
    void handleFillLeagueWithBots();
  }

  async function handleFillBotPicks() {
    setBotReport(null);
    setBotBusy(true);
    const res = await seedBotPicksForWeekInCloud(activeWeek);
    setBotBusy(false);
    if (!res.ok) {
      setBotReport(res.error || "Failed to fill bot picks");
      return;
    }
    setBotReport(
      `Filled ${res.botsFilled ?? 0} bot pick slip(s) for ${weekTitle(activeWeek)}.`
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
      const events = await fetchNcaafScores(3);
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

    const lines = (cloud.details || [])
      .map((d) => `${d.name}: ${d.points} pts`)
      .join(" · ");
    setScoreReport(
      `${weekTitle(activeWeek)} scored & locked · ${cloud.scoredCount} player(s). ${lines}`
    );
  }

  async function saveSettings() {
    setSettingsError(null);
    const result = await saveLeagueToCloud({
      name: leagueNameEdit,
      settings: {
        cutPercent,
        gamesPerWeek: 5,
        crystalBallEnabled,
        // Season length is fixed at SEASON_MAX_WEEK in the app (not saved to DB)
      },
    });
    if (result.ok && result.league) {
      setLeague(result.league);
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

    const ok1 = confirm(
      "RESET SEASON?\n\n" +
        "This will DELETE:\n" +
        "• All week cards & games\n" +
        "• All player picks\n" +
        "• All results & season scores/stats\n" +
        "• League announcements\n\n" +
        "This will KEEP:\n" +
        "• Every player who joined\n" +
        "• Divisions, roles, league code & settings\n" +
        "• Profile photos\n" +
        "• Trophy Room (past champions / toilet / nerd awards)\n\n" +
        "Use this after testing, before the real season.\n\n" +
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

    // Clear UI state for a clean slate
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
    setActiveWeek(0);
    try {
      localStorage.setItem(ACTIVE_WEEK_KEY, "0");
    } catch {
      /* ignore */
    }
    await loadWeekState(0);

    const kept = result.membersKept ?? "?";
    const picks = result.picksDeleted ?? 0;
    const cards = result.cardsDeleted ?? 0;
    setSeasonResetReport(
      `Season reset complete. Kept ${kept} member(s). Removed ${cards} week card(s) and ${picks} pick sheet(s). Scores are zeroed. Ready for Week 0.`
    );
  }

  function copyCode() {
    if (!league) return;
    navigator.clipboard?.writeText(league.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
            <h1 className="text-xl font-bold mb-2">Commissioner only</h1>
            <p className="text-sm text-muted">
              Only the league commissioner can open these tools.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const session = getSession();

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Commissioner Tools</h1>
          <p className="text-sm text-muted">
            Settings • Build card • Who&apos;s in • Results
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setTab("settings")}
            className={
              tab === "settings"
                ? "px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-black"
                : "px-4 py-1.5 rounded-full text-sm font-medium bg-card border border-border text-muted"
            }
          >
            Settings
          </button>
          <button
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

        {tab === "settings" && league && (
          <div className="space-y-6">
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
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-2xl tracking-[0.25em] text-primary font-bold">
                    {league.code}
                  </div>
                  <button
                    onClick={copyCode}
                    className="px-3 py-2 text-xs rounded-lg border border-border"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={handleRegenCode}
                    className="px-3 py-2 text-xs rounded-lg border border-border"
                  >
                    New code
                  </button>
                </div>
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
                    Always weeks 0–{SEASON_MAX_WEEK}
                  </p>
                  <p className="text-[11px] text-muted mt-1 leading-relaxed">
                    Fixed CFB map: Week 0 openers · 1–13 regular ·{" "}
                    <span className="text-warning">14 Conf Champ (CUT)</span> ·
                    15–18 CFP (R1 / QF / SF / Final). Not configurable.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Crystal Ball
                  </p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Preseason tab: pick who wins the national title (0 points).
                    Correct picks earn a sarcastic Witch/Wizard achievement.
                    Turn off to hide the tab for everyone in this league.
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

            <div className="rounded-xl border border-primary/40 bg-primary/5 p-5 space-y-3">
              <h2 className="font-semibold text-primary">
                Pad league with bots (to 32)
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                Optional. Fills{" "}
                <strong className="text-foreground">empty seats only</strong> up
                to the {MAX_LEAGUE_PLAYERS}-player cap. Real humans stay;
                bots never block a real join until the room is full. Great for
                sandbox testing or padding a small group so brackets feel full.
              </p>
              <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-[11px] text-muted leading-relaxed space-y-1">
                <p className="text-foreground font-medium text-xs">
                  How bots pick (coded guidance)
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>
                    Valid slip every week: all games, confidence 1–N, one Best
                    Bet, one prop
                  </li>
                  <li>
                    <span className="text-foreground">Chalk</span> personas
                    (Public Heat, Locksmith…) lean favorites
                  </li>
                  <li>
                    <span className="text-foreground">Dog / Fade</span> personas
                    lean underdogs
                  </li>
                  <li>
                    <span className="text-foreground">Sharp / Closing</span> mix
                    with a slight dog lean on big spreads
                  </li>
                  <li>Everyone else ~58% favorite — noisy public money</li>
                  <li>
                    Auto-lock on <strong className="text-foreground">Publish</strong>{" "}
                    week card (or use Fill bot picks)
                  </li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={botBusy}
                  onClick={() => void handleFillLeagueWithBots()}
                  className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-50"
                >
                  {botBusy ? "Working…" : "Fill empty seats with bots (to 32)"}
                </button>
                <button
                  type="button"
                  disabled={botBusy}
                  onClick={() => void handleFillBotPicks()}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-card-hover disabled:opacity-50"
                >
                  Fill bot picks (this week)
                </button>
                <button
                  type="button"
                  disabled={botBusy}
                  onClick={() => void handleClearBots()}
                  className="px-4 py-2 rounded-lg border border-warning text-warning text-sm font-medium hover:bg-warning/10 disabled:opacity-50"
                >
                  Clear bots (keep real players)
                </button>
              </div>
              <p className="text-[11px] text-muted">
                Setup once if buttons fail:{" "}
                <code className="text-foreground">supabase/trial-bots.sql</code>
                , then optional{" "}
                <code className="text-foreground">supabase/bot-picks-smarter.sql</code>{" "}
                for persona-based leans. Also run{" "}
                <code className="text-foreground">supabase/league-capacity-32.sql</code>{" "}
                so bots can&apos;t exceed 32.
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
          </div>
        )}

        {tab === "card" && (
          <div>
            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <h2 className="font-semibold mb-1">Pick&apos;em week</h2>
              <p className="text-xs text-muted mb-3">
                {weekSubtitle(activeWeek)}. Games on different dates are fine —
                each shows its own kickoff below the matchup.
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: SEASON_MAX_WEEK + 1 }, (_, i) => i).map(
                  (w) => {
                    const hint =
                      w === 14
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
                        onClick={() => changeActiveWeek(w)}
                        className={
                          activeWeek === w
                            ? w === 14
                              ? "px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-black ring-2 ring-warning/60"
                              : "px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-black"
                            : w === 14
                              ? "px-3 py-1.5 rounded-full text-xs font-medium bg-card-hover border border-warning/50 text-warning hover:text-warning"
                              : "px-3 py-1.5 rounded-full text-xs font-medium bg-card-hover border border-border text-muted hover:text-foreground"
                        }
                      >
                        {weekTitle(w)}
                        {hint}
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
                    onClick={generateDemoCard}
                    className="px-4 py-2 rounded-lg border border-warning text-warning text-sm font-semibold hover:bg-warning/10"
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
              <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5 mb-2">
                <p className="text-xs font-semibold text-warning mb-0.5">
                  Full-season simulation (no real games needed)
                </p>
                <p className="text-[11px] text-muted leading-relaxed">
                  <strong className="text-foreground">Generate demo slate</strong>{" "}
                  creates 5 fake FBS matchups for this week → Publish → bots pick
                  → Enter Results →{" "}
                  <strong className="text-foreground">Randomize results</strong>{" "}
                  → Score → next week. Repeat through Conf Champ / CFP.
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
                  {availableGames.length} FBS games • Grouped by kickoff date
                  (ET)
                  {rankLabel ? ` • Ranks: ${rankLabel}` : ""}
                </p>
                <div className="space-y-4 max-h-[28rem] overflow-y-auto mt-4">
                  {groupGamesByDate(availableGames).map((group) => (
                    <div key={group.dateKey}>
                      <div className="sticky top-0 bg-card/95 backdrop-blur py-1.5 mb-2 border-b border-border">
                        <span className="text-xs font-semibold text-primary">
                          {group.dateLabel}
                        </span>
                        <span className="text-[11px] text-muted ml-2">
                          {group.games.length} game
                          {group.games.length === 1 ? "" : "s"}
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
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => toggleGame(g.id)}
                              className={
                                selected
                                  ? "w-full text-left p-3 rounded-lg border border-primary bg-primary/10"
                                  : "w-full text-left p-3 rounded-lg border border-border"
                              }
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">
                                    {formatRankedTeam(g.awayTeam, g.awayRank)}{" "}
                                    @{" "}
                                    {formatRankedTeam(g.homeTeam, g.homeRank)}
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
                                <span className="text-sm text-primary shrink-0">
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
                {/* Weekly prop picker */}
                <div className="mt-6 pt-5 border-t border-border space-y-3">
                  <div>
                    <h3 className="font-semibold text-sm">Weekly prop</h3>
                    <p className="text-xs text-muted">
                      Pick a fun preset (or custom). Worth {prop.points} pts.
                      Must Publish to lock this onto the card / Enter Results.
                    </p>
                    {publishedProp?.question &&
                      publishedProp.question !== prop.question && (
                        <p className="text-[11px] text-warning mt-1">
                          Draft differs from published prop. Players still see
                          the published one until you Publish again.
                        </p>
                      )}
                  </div>
                  <select
                    value={propPresetId}
                    onChange={(e) => applyPropPreset(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                  >
                    {PROP_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                    <option value={CUSTOM_PROP_ID}>Custom prop (write your own)…</option>
                  </select>
                  <p className="text-[11px] text-muted">
                    All presets refer only to the five games on this week&apos;s
                    card. Worded so finals settle arguments.
                  </p>

                  {propPresetId === CUSTOM_PROP_ID ? (
                    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                      <input
                        type="text"
                        value={customQuestion}
                        onChange={(e) => {
                          setCustomQuestion(e.target.value);
                        }}
                        onBlur={syncCustomProp}
                        placeholder="Prop question"
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={customOptA}
                          onChange={(e) => setCustomOptA(e.target.value)}
                          onBlur={syncCustomProp}
                          placeholder="Option A"
                          className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={customOptB}
                          onChange={(e) => setCustomOptB(e.target.value)}
                          onBlur={syncCustomProp}
                          placeholder="Option B"
                          className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                      <p className="text-foreground">{prop.question}</p>
                      <p className="text-xs text-muted mt-1">
                        Choices: {prop.options[0]} · {prop.options[1]}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={selectedIds.size !== 5}
                  onClick={publishCard}
                  className={
                    selectedIds.size === 5
                      ? "w-full mt-4 py-3 rounded-xl font-semibold bg-primary text-black"
                      : "w-full mt-4 py-3 rounded-xl font-semibold bg-border text-muted cursor-not-allowed"
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
                {Array.from({ length: SEASON_MAX_WEEK + 1 }, (_, i) => i).map(
                  (w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => changeActiveWeek(w)}
                      className={
                        activeWeek === w
                          ? "px-3 py-1 rounded-full text-xs font-medium bg-primary text-black"
                          : "px-3 py-1 rounded-full text-xs font-medium bg-card-hover border border-border text-muted"
                      }
                    >
                      {weekTitle(w)}
                    </button>
                  )
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
                          {r.name}
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
                {Array.from({ length: SEASON_MAX_WEEK + 1 }, (_, i) => i).map(
                  (w) => {
                    const scored = scoredWeeks.includes(w);
                    const selected = activeWeek === w;
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => void changeActiveWeek(w)}
                        className={
                          selected
                            ? scored
                              ? "px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-black ring-2 ring-ok/50"
                              : "px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-black"
                            : scored
                              ? "px-3 py-1.5 rounded-full text-xs font-medium bg-ok/15 border border-ok/40 text-ok"
                              : "px-3 py-1.5 rounded-full text-xs font-medium bg-card-hover border border-border text-muted hover:text-foreground"
                        }
                      >
                        {weekTitle(w)}
                        {scored ? " ✓" : ""}
                      </button>
                    );
                  }
                )}
              </div>
              <p className="text-[11px] text-muted mt-3">
                Dry-run tip: Build Card → publish week → Fill bot picks → Enter
                Results → set covers → Score → next week.
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
                    onClick={randomizeResultsForDryRun}
                    disabled={!publishedGames.length || resultsLocked}
                    className="px-4 py-2 rounded-lg border border-warning text-warning text-sm font-semibold hover:bg-warning/10 disabled:opacity-50"
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
      </main>
    </div>
  );
}
