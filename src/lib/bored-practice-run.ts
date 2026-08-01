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
  message: string;
  goToPicks?: boolean;
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
  const seed = Date.now() % 100000;
  const games = generateDemoSlate(seed, 5, sid).map((g, i) => {
    // Kickoffs far enough out that lock deadline never freezes the practice card
    const t = new Date(Date.now() + (24 + i) * 3600 * 1000);
    return {
      ...g,
      id: `bored-local-${state.runId}-${i}`,
      oddsEventId: `bored-local-${state.runId}-${i}`,
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
  prop.id = `bored-prop-${state.runId}`;

  const card: BoredLocalCard = {
    weekNumber: BORED_PRACTICE_WEEK,
    runId: state.runId,
    games,
    prop,
    sportId: sid,
  };
  saveBoredLocalCard(card);
  // Clear picks for this run
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
    goToPicks: true,
    message:
      "Private practice week ready — not the live season. Lock the card; we’ll score it and show you how the room wakes up.",
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
