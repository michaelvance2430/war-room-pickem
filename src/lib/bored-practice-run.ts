/**
 * Start / score one bored-practice week (re-do friendly).
 */

import { getLeague, isOps } from "@/lib/league";
import { firstSeasonWeek } from "@/lib/season-calendar";
import {
  clearWeekScoreInCloud,
  loadWeekCard,
  publishWeekCard,
  saveResultsAndScoreWeek,
  seedBotPicksForWeekInCloud,
  setLeagueActiveWeek,
} from "@/lib/cloud";
import { generateDemoSlate, randomizeDemoResults } from "@/lib/demo-slate";
import { propFromPreset, rotatingPropPreset } from "@/lib/prop-presets";
import { isPreseasonCommishToolsAllowed } from "@/lib/season-mode";
import {
  getBoredPracticeState,
  isBoredPracticeScoringAllowed,
  isBoredPracticeWindowOpen,
  markBoredPracticeStarted,
  queueBoredPracticeDoneModal,
} from "@/lib/bored-practice";

export async function startBoredPracticeWeek(): Promise<{
  ok: boolean;
  weekNumber?: number;
  message: string;
  goToPicks?: boolean;
}> {
  if (!isBoredPracticeWindowOpen()) {
    return {
      ok: false,
      message: "Practice is closed — Week 0 already kicked off.",
    };
  }

  const league = getLeague();
  const sid = league?.sportId === "nfl" ? "nfl" : "cfb";
  const week = firstSeasonWeek(sid);

  // Always mark this run so lock → auto-score knows it's practice
  markBoredPracticeStarted(week);

  const existing = await loadWeekCard(week);
  if (existing?.games?.length) {
    // Re-do path: clear prior score so they can lock / score again
    if (isOps()) {
      await clearWeekScoreInCloud(week).catch(() => undefined);
    }
    await setLeagueActiveWeek(week).catch(() => undefined);
    return {
      ok: true,
      weekNumber: week,
      goToPicks: true,
      message: "Fake week ready. Lock your card.",
    };
  }

  if (!isOps() || !isPreseasonCommishToolsAllowed()) {
    return {
      ok: false,
      message:
        "No card yet. Ask your host to tap I’m bored (or publish a demo week). You can re-do as many times as you want after that.",
    };
  }

  // Fresh demo card + bots
  await clearWeekScoreInCloud(week).catch(() => undefined);
  const games = generateDemoSlate(week, 5, sid);
  const prop = propFromPreset(rotatingPropPreset(week, sid), week);
  const pub = await publishWeekCard({ weekNumber: week, games, prop });
  if (!pub.ok) {
    return { ok: false, message: pub.error || "Couldn’t publish fake week." };
  }
  await seedBotPicksForWeekInCloud(week).catch(() => undefined);
  await setLeagueActiveWeek(week).catch(() => undefined);
  markBoredPracticeStarted(week);

  return {
    ok: true,
    weekNumber: week,
    goToPicks: true,
    message: "Fake week is live. Lock a card. Bots already did.",
  };
}

/**
 * After the player locks a practice week — auto-score so the loop completes.
 * Host or allowed practice scoring path.
 */
export async function autoScoreBoredPracticeIfActive(
  weekNumber: number
): Promise<{ ok: boolean; message?: string }> {
  const active = getBoredPracticeState();
  if (!active || active.weekNumber !== weekNumber) {
    return { ok: false };
  }
  if (!isBoredPracticeScoringAllowed()) {
    return {
      ok: false,
      message: "Practice locked — host can score the week to finish the loop.",
    };
  }

  const card = await loadWeekCard(weekNumber);
  if (!card?.games?.length || !card.prop) {
    return { ok: false, message: "No practice card to score." };
  }

  const { results, propResult, finalBoxes } = randomizeDemoResults(
    card.games,
    card.prop.options
  );

  const scored = await saveResultsAndScoreWeek({
    weekNumber,
    games: card.games,
    prop: card.prop,
    results,
    propResult,
    finalBoxes,
    allowBoredPractice: true,
  });

  if (!scored.ok) {
    return { ok: false, message: scored.error || "Score failed" };
  }

  queueBoredPracticeDoneModal(active.runId);
  return { ok: true, message: "Practice week scored." };
}
