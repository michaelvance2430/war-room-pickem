/**
 * Founder one-click heaven — stay on Founder, drive a full bot room.
 * Creator only. Operates on the REAL active league (cloud) so Gazette / Board
 * update. Does not require navigating Commissioner.
 */

import { isAppCreator } from "@/lib/creator";
import { getLeague, getSession, isActuallyOps } from "@/lib/league";
import { generateDemoSlate, randomizeDemoResults } from "@/lib/demo-slate";
import {
  publishWeekCard,
  saveResultsAndScoreWeek,
  seedBotPicksForWeekInCloud,
  setLeagueActiveWeek,
  loadWeekCard,
  loadLeagueRoster,
  fillLeagueWithBotsToCap,
  applyRandomBotChaosForWeek,
} from "@/lib/cloud";
import { propFromPreset, rotatingPropPreset } from "@/lib/prop-presets";
import { weekTitle } from "@/lib/dates";
import { SIMPLE_BOT_FILL_TARGET } from "@/lib/simple-host";

export type OneClickLog = {
  ok: boolean;
  message: string;
  steps: string[];
};

function assertCreator(): string | null {
  const uid = getSession()?.playerId;
  if (!isAppCreator(uid)) return "Creator only";
  if (!isActuallyOps()) {
    return "Be commissioner (or deputy) of a league first — one-click drives that room.";
  }
  if (!getSession()?.leagueId) return "No active league";
  return null;
}

function sport(): "cfb" | "nfl" {
  return getLeague()?.sportId === "nfl" ? "nfl" : "cfb";
}

/** Leave eyes local-play so cloud posts hit the real room. */
async function exitEyesIfNeeded(steps: string[]): Promise<void> {
  try {
    const eyes = await import("./creator-eyes");
    if (eyes.isCreatorEyesActive()) {
      eyes.setCreatorEyesMode("off");
      steps.push("Exited eyes mode (using real league)");
    }
  } catch {
    /* ignore */
  }
}

/**
 * Full bot field + optional spice (locker, crystal ball, chaos).
 * Safe to re-run — only fills empty seats.
 */
export async function founderEnsureFullBotRoster(opts?: {
  targetTotal?: number;
}): Promise<OneClickLog> {
  const steps: string[] = [];
  const gate = assertCreator();
  if (gate) return { ok: false, message: gate, steps };

  await exitEyesIfNeeded(steps);
  const target = opts?.targetTotal ?? SIMPLE_BOT_FILL_TARGET;

  try {
    const roster = await loadLeagueRoster();
    steps.push(`Roster before: ${roster.length}`);
    if (roster.length < target) {
      const pad = await fillLeagueWithBotsToCap({
        targetTotal: target,
        midSeasonReplacement: true,
      });
      if (!pad.ok) {
        return {
          ok: false,
          message: pad.error || "Bot pad failed",
          steps,
        };
      }
      steps.push(
        `Added ${pad.added ?? 0} bot(s) · total bots ${pad.totalBots ?? "?"}`
      );
    } else {
      steps.push(`Already ≥ ${target} players — no pad needed`);
    }

    const s = sport();
    const week = Number(localStorage.getItem("warroom-active-week")) || 1;

    try {
      const { seedBotCrystalBallPicks } = await import("./crystal-ball");
      const cb = await seedBotCrystalBallPicks({ sportId: s });
      if (cb.ok && (cb.inserted ?? 0) > 0) {
        steps.push(`Crystal Ball: ${cb.inserted} bot picks`);
      }
    } catch {
      steps.push("Crystal Ball seed skipped");
    }

    try {
      const { seedBotLockerTalk } = await import("./bot-locker-talk");
      const talk = await seedBotLockerTalk({
        weekNumber: week,
        weekLabel: weekTitle(week, s),
        sportId: s,
        count: 10,
        force: true,
      });
      if (talk.ok && (talk.inserted ?? 0) > 0) {
        steps.push(`Locker: ${talk.inserted} shit-talk posts`);
      }
    } catch {
      steps.push("Locker seed skipped");
    }

    const after = await loadLeagueRoster();
    const bots = after.filter((m) => m.isBot).length;
    return {
      ok: true,
      message: `Full field ready · ${after.length} players (${bots} bots)`,
      steps,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Roster pad failed",
      steps,
    };
  }
}

/**
 * Publish demo card + lock bot picks (+ locker spice) for one week.
 */
export async function founderPostWeek(weekNumber: number): Promise<OneClickLog> {
  const steps: string[] = [];
  const gate = assertCreator();
  if (gate) return { ok: false, message: gate, steps };

  await exitEyesIfNeeded(steps);
  const pad = await founderEnsureFullBotRoster();
  steps.push(...pad.steps.map((s) => `roster: ${s}`));
  if (!pad.ok) return { ok: false, message: pad.message, steps };

  const s = sport();
  const label = weekTitle(weekNumber, s);

  try {
    const games = generateDemoSlate(weekNumber, 5, s);
    const prop = propFromPreset(rotatingPropPreset(weekNumber, s), weekNumber);

    steps.push(`Publishing ${label}…`);
    const pub = await publishWeekCard({
      weekNumber,
      games,
      prop,
    });
    if (!pub.ok || !pub.games?.length) {
      return {
        ok: false,
        message: pub.error || "Publish failed",
        steps,
      };
    }
    steps.push(`Card live · ${pub.games.length} games`);

    const bots = await seedBotPicksForWeekInCloud(weekNumber);
    if (bots.ok) {
      steps.push(
        `Bot picks locked: ${bots.botsFilled ?? 0}${
          (bots.chaosCount ?? 0) > 0 ? ` · Chaos ${bots.chaosCount}` : ""
        }`
      );
    } else {
      steps.push(`Bot picks warning: ${bots.error || "failed"}`);
    }

    try {
      await applyRandomBotChaosForWeek(weekNumber, { chance: 22 });
      steps.push("Chaos re-roll applied");
    } catch {
      /* optional */
    }

    try {
      const { seedBotLockerTalk } = await import("./bot-locker-talk");
      const talk = await seedBotLockerTalk({
        weekNumber,
        weekLabel: label,
        sportId: s,
        count: 8,
        force: true,
      });
      if (talk.ok) steps.push(`Locker: ${talk.inserted ?? 0} posts`);
    } catch {
      /* optional */
    }

    await setLeagueActiveWeek(weekNumber);
    try {
      localStorage.setItem("warroom-active-week", String(weekNumber));
    } catch {
      /* ignore */
    }

    return {
      ok: true,
      message: `${label} posted · bots locked · room is live`,
      steps,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Post week failed",
      steps,
    };
  }
}

/**
 * Randomize results + score an existing published week (needs card + picks).
 */
export async function founderScoreWeek(weekNumber: number): Promise<OneClickLog> {
  const steps: string[] = [];
  const gate = assertCreator();
  if (gate) return { ok: false, message: gate, steps };

  await exitEyesIfNeeded(steps);
  const s = sport();
  const label = weekTitle(weekNumber, s);

  try {
    // Make sure bots have slips
    const fill = await seedBotPicksForWeekInCloud(weekNumber);
    if (fill.ok) {
      steps.push(`Bot slips: ${fill.botsFilled ?? 0}`);
    }

    const card = await loadWeekCard(weekNumber);
    if (!card?.games?.length || !card.prop) {
      return {
        ok: false,
        message: `No card for ${label} — Post week first`,
        steps,
      };
    }

    const { results, propResult } = randomizeDemoResults(
      card.games,
      card.prop.options
    );
    steps.push("Randomized ATS + prop results");

    const scored = await saveResultsAndScoreWeek({
      weekNumber,
      games: card.games,
      prop: card.prop,
      results,
      propResult,
    });
    if (!scored.ok) {
      return {
        ok: false,
        message: scored.error || "Score failed",
        steps,
      };
    }
    steps.push(`Scored ${scored.scoredCount ?? 0} player(s)`);
    await setLeagueActiveWeek(weekNumber);

    return {
      ok: true,
      message: `${label} scored · ${scored.scoredCount ?? 0} on the board · check Gazette`,
      steps,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Score week failed",
      steps,
    };
  }
}

/** Post demo card + bot world + score in one tap. */
export async function founderPostAndScoreWeek(
  weekNumber: number
): Promise<OneClickLog> {
  const steps: string[] = [];
  const post = await founderPostWeek(weekNumber);
  steps.push(...post.steps.map((s) => `post: ${s}`));
  if (!post.ok) return { ok: false, message: post.message, steps };

  const score = await founderScoreWeek(weekNumber);
  steps.push(...score.steps.map((s) => `score: ${s}`));
  if (!score.ok) {
    return {
      ok: false,
      message: `Posted OK, score failed: ${score.message}`,
      steps,
    };
  }

  return {
    ok: true,
    message: score.message,
    steps,
  };
}
