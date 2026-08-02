/**
 * Start / finish bored practice — 100% client-side, never touches live weeks.
 */

import { getLeague } from "@/lib/league";
import { generateDemoSlate } from "@/lib/demo-slate";
import { propFromPreset, rotatingPropPreset } from "@/lib/prop-presets";
import {
  BORED_PRACTICE_WEEK,
  isBoredPracticeWindowOpen,
  markBoredPracticeStarted,
  saveBoredLocalCard,
  saveBoredLocalPicks,
  scoreBoredPracticeLocally,
  type BoredLocalCard,
} from "@/lib/bored-practice";

export async function startBoredPracticeWeek(): Promise<{
  ok: boolean;
  weekNumber?: number;
  runId?: number;
  message: string;
  goToPicks?: boolean;
  /** Always use this — hard nav so picks page cannot keep stale live picks */
  picksHref?: string;
}> {
  if (!isBoredPracticeWindowOpen()) {
    return {
      ok: false,
      message: "Practice is closed — opening week already kicked off.",
    };
  }

  const league = getLeague();
  const sid = league?.sportId === "nfl" ? "nfl" : "cfb";
  const state = markBoredPracticeStarted(sid);

  // Fresh demo slate — never loads live season cards / never publishWeekCard
  // Unique seed + runId so game IDs never collide with a prior practice run
  const seed = (Date.now() % 100000) + state.runId * 9973;
  const games = generateDemoSlate(seed, 5, sid).map((g, i) => {
    // Kickoffs far enough out that lock deadline never freezes the practice card
    const t = new Date(Date.now() + (24 + i) * 3600 * 1000);
    return {
      ...g,
      id: `bored-local-${state.runId}-${seed}-${i}`,
      oddsEventId: `bored-local-${state.runId}-${seed}-${i}`,
      commenceTime: t.toISOString(),
      startTime: t.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
        timeZone: "America/New_York",
      }),
    };
  });
  const prop = propFromPreset(rotatingPropPreset(seed % 20, sid), seed % 20);
  prop.id = `bored-prop-${state.runId}-${seed}`;

  const card: BoredLocalCard = {
    weekNumber: BORED_PRACTICE_WEEK,
    runId: state.runId,
    games,
    prop,
    sportId: sid,
  };
  saveBoredLocalCard(card);
  // Hard blank card — never carry picks from last practice / live season
  saveBoredLocalPicks({
    runId: state.runId,
    picks: {},
    bestBetId: null,
    propChoice: null,
    lockedAt: null,
  });

  return {
    ok: true,
    weekNumber: BORED_PRACTICE_WEEK,
    runId: state.runId,
    goToPicks: true,
    picksHref: `/picks?week=${BORED_PRACTICE_WEEK}&practice=1&run=${state.runId}&fresh=1`,
    message:
      "Blank fake week ready. Not the live season. You fill every pick — then we grade it.",
  };
}

/** After lock in practice mode — local score + done modal. Never cloud. */
export async function autoScoreBoredPracticeIfActive(
  weekNumber: number
): Promise<{ ok: boolean; message?: string }> {
  if (weekNumber !== BORED_PRACTICE_WEEK) {
    return { ok: false };
  }
  const res = scoreBoredPracticeLocally();
  if (!res.ok) {
    return {
      ok: false,
      message: res.message || "Couldn’t finish practice week.",
    };
  }
  return {
    ok: true,
    message: "Practice week complete.",
  };
}
