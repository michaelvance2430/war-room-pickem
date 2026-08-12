/**
 * Founder one-click heaven — stay on Founder, drive a full bot room.
 * Creator only. Operates on the REAL active league (cloud) so Gazette / Board
 * update. Does not require navigating Commissioner.
 *
 * Isolation: every entry path hard-stops unless the active room is an
 * explicitly marked LAB league (foundry-isolation). No soft fallback to
 * production / unmarked rooms.
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
  listScoredWeekNumbers,
  fillLeagueWithBotsToCap,
  applyRandomBotChaosForWeek,
} from "@/lib/cloud";
import { propFromPreset, rotatingPropPreset } from "@/lib/prop-presets";
import { weekTitle } from "@/lib/dates";
import { SIMPLE_BOT_FILL_TARGET } from "@/lib/simple-host";
import { assertFoundryNotQuarantined } from "@/lib/foundry-quarantine";
import { FOUNDRY_LAB_BLOCK_REASON } from "@/lib/foundry-isolation";
import { canWritePermanentCareer } from "@/lib/career-integrity";

export type OneClickLog = {
  ok: boolean;
  message: string;
  steps: string[];
};

/**
 * Creator + ops + explicit LAB room. Failed boundary → hard stop.
 */
function assertFoundryLabRun(source: string): string | null {
  const uid = getSession()?.playerId;
  if (!isAppCreator(uid)) return "Creator only";
  if (!isActuallyOps()) {
    return "Be commissioner (or deputy) of a league first — one-click drives that room.";
  }
  if (!getSession()?.leagueId) return "No active league";

  const gate = assertFoundryNotQuarantined(source);
  if (!gate.ok) {
    return gate.reason || FOUNDRY_LAB_BLOCK_REASON;
  }

  // Independent fail-closed proof: the mutation boundary and the permanent
  // career boundary must agree this is not production before any write starts.
  const careerGate = canWritePermanentCareer({
    source: `${source}.preflight`,
    league: getLeague(),
  });
  if (careerGate.ok) {
    return "LAB boundary mismatch: this room is marked LAB, but Career Integrity still resolves it as production. No Foundry writes were applied.";
  }
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
  const gate = assertFoundryLabRun("founderEnsureFullBotRoster");
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
  const gate = assertFoundryLabRun("founderPostWeek");
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
  const gate = assertFoundryLabRun("founderScoreWeek");
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
    if (!(scored.scoredCount ?? 0)) {
      return {
        ok: false,
        message:
          "Score wrote results but 0 membership standings updated — check picks / bot slips / memberships RLS.",
        steps: [
          ...steps,
          `Scored count: 0`,
          ...(scored.details || []).map(
            (d) => `${d.name}: ${d.points} pts (pick only?)`
          ),
        ],
      };
    }
    steps.push(`Scored ${scored.scoredCount ?? 0} player(s)`);
    // Sample board so Foundry log proves standings pipeline
    try {
      const { loadLeaguePlayers, invalidateCloudWeekCaches } = await import(
        "./cloud"
      );
      invalidateCloudWeekCaches(getSession()?.leagueId);
      const board = await loadLeaguePlayers();
      const withPts = board
        .filter((p) => (p.totalPoints || 0) > 0)
        .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
        .slice(0, 5);
      steps.push(
        withPts.length
          ? `Standings sample: ${withPts
              .map((p) => `${p.name} ${p.totalPoints}`)
              .join(" · ")}`
          : "Standings sample: all 0 pts after score (pipeline still broken)"
      );
    } catch (e) {
      steps.push(
        `Standings sample skip: ${e instanceof Error ? e.message : "fail"}`
      );
    }
    await setLeagueActiveWeek(weekNumber);

    // Foundry: unlock Gazette + cheevo path (not stuck in pre-lock calm)
    try {
      const { prepareFoundryDramaAfterScore } = await import(
        "./foundry-preview"
      );
      const drama = await prepareFoundryDramaAfterScore(weekNumber);
      if (drama.ok) steps.push(drama.message);
      else steps.push(`Drama prep: ${drama.message}`);
    } catch (e) {
      steps.push(
        `Drama prep skip: ${e instanceof Error ? e.message : "failed"}`
      );
    }

    return {
      ok: true,
      message: `${label} scored · ${scored.scoredCount ?? 0} on the board · open Home for The Dispatch`,
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

/**
 * If the founder has no locked cloud slip for the week, lock a random full
 * card so they appear under teams on The Board with the bots.
 * (Shared path lives in seedSelfSimPicksIfEmpty — also runs after bot fill.)
 */
async function founderLockSelfSlipIfEmpty(
  weekNumber: number,
  steps: string[]
): Promise<void> {
  try {
    const { seedSelfSimPicksIfEmpty } = await import("./cloud");
    const res = await seedSelfSimPicksIfEmpty(weekNumber);
    if (res.filled) steps.push("Your slip locked (random sim card)");
    else if (res.ok) steps.push("Your slip already locked");
    else steps.push(`Your slip skip: ${res.error || "failed"}`);
  } catch (e) {
    steps.push(
      `Your slip skip: ${e instanceof Error ? e.message : "failed"}`
    );
  }
}

/**
 * Force The Board open for a week: kickoffs moved to the past so
 * progressive pick reveal unlocks (locked, not scored).
 *
 * Seeds bot slips like real locks (+ your slip if empty). Bots are full
 * players on The Board — same as humans once the room is filled.
 */
export async function founderOpenLockedBoard(
  weekNumber: number
): Promise<OneClickLog> {
  const steps: string[] = [];
  const gate = assertFoundryLabRun("founderOpenLockedBoard");
  if (gate) return { ok: false, message: gate, steps };

  await exitEyesIfNeeded(steps);

  // Ensure full bot roster so “everyone” is a real room, not just you
  const pad = await founderEnsureFullBotRoster();
  steps.push(...pad.steps.map((s) => `roster: ${s}`));
  if (!pad.ok) {
    steps.push(`roster warn: ${pad.message}`);
  }

  // Ensure card + bot picks exist
  let card = await loadWeekCard(weekNumber);
  if (!card?.games?.length) {
    const post = await founderPostWeek(weekNumber);
    steps.push(...post.steps.map((s) => `post: ${s}`));
    if (!post.ok) return { ok: false, message: post.message, steps };
    card = await loadWeekCard(weekNumber);
  }

  // Always re-seed bots (idempotent) so Board has names under each side
  const fill = await seedBotPicksForWeekInCloud(weekNumber);
  if (fill.ok) {
    steps.push(
      `Bot slips locked: ${fill.botsFilled ?? 0}${
        (fill.chaosCount ?? 0) > 0 ? ` · Chaos ${fill.chaosCount}` : ""
      }`
    );
  } else {
    steps.push(
      `Bot picks warning: ${fill.error || "failed"} — Board may look empty`
    );
  }

  await founderLockSelfSlipIfEmpty(weekNumber, steps);

  if (!card?.games?.length || !card.weekCardId) {
    return {
      ok: false,
      message: "No card to unlock — Post week first",
      steps,
    };
  }

  try {
    const { createClient } = await import("./supabase/client");
    const supabase = createClient();
    // First game kicked off ~3h ago; rest every 30 min — progressive reveal demo
    const base = Date.now() - 3 * 3600 * 1000;
    let i = 0;
    for (const g of card.games) {
      const t = new Date(base + i * 30 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("card_games")
        .update({ start_time: t })
        .eq("id", g.id);
      if (error) {
        steps.push(`kickoff update warn ${g.id.slice(0, 8)}: ${error.message}`);
      }
      i += 1;
    }
    steps.push(
      "Kickoffs set in the past — card frozen, Board progressive reveal on"
    );

    await setLeagueActiveWeek(weekNumber);
    try {
      localStorage.setItem("warroom-active-week", String(weekNumber));
    } catch {
      /* ignore */
    }

    const filled = fill.botsFilled ?? 0;
    return {
      ok: true,
      message: `${weekTitle(weekNumber, sport())} Board unlocked (not scored) · ${filled} bot slip(s) · open The Board to compare picks`,
      steps,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Board unlock failed",
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

/**
 * Score the already-playable LAB card, then publish the next one. This is the
 * normal Foundry season loop after a history factory has handed the creator an
 * unlocked card.
 */
export async function founderScoreAndOpenNextWeek(
  weekNumber: number
): Promise<OneClickLog> {
  const steps: string[] = [];
  const score = await founderScoreWeek(weekNumber);
  steps.push(...score.steps.map((step) => `score: ${step}`));
  if (!score.ok) return { ok: false, message: score.message, steps };

  const s = sport();
  const { seasonMaxWeek } = await import("./season-calendar");
  const nextWeek = weekNumber + 1;
  if (nextWeek > seasonMaxWeek(s)) {
    return {
      ok: true,
      message: `${score.message} · season limit reached`,
      steps,
    };
  }

  const next = await founderPostWeek(nextWeek);
  steps.push(...next.steps.map((step) => `next: ${step}`));
  if (!next.ok) {
    return {
      ok: false,
      message: `${score.message}, but ${weekTitle(nextWeek, s)} did not open: ${next.message}`,
      steps,
    };
  }

  return {
    ok: true,
    message: `${weekTitle(weekNumber, s)} scored. ${weekTitle(nextWeek, s)} is now published, unlocked, and ready to play.`,
    steps,
  };
}

export type BuildLabHistoryResult = OneClickLog & {
  fromWeek?: number;
  toWeek?: number;
  finished?: number[];
};

/**
 * LAB only: post+score the first N season weeks to build cloud history for
 * Standings / Board / Gazette QA. This is a season factory, not onboarding:
 * it never enters eyes mode or forges player-progress flags.
 *
 * CFB: weeks 0…N-1 (default N=6 → 0–5).
 * NFL: weeks 1…N (default N=6 → 1–6).
 */
export async function founderBuildFirstWeeksHistory(opts?: {
  /** How many weeks to run (default 6). */
  weekCount?: number;
  onProgress?: (p: { week: number; step: string }) => void;
}): Promise<BuildLabHistoryResult> {
  const steps: string[] = [];
  const gate = assertFoundryLabRun("founderBuildFirstWeeksHistory");
  if (gate) return { ok: false, message: gate, steps };

  const weekCount = Math.max(1, Math.min(18, opts?.weekCount ?? 6));
  const s = sport();
  const { firstSeasonWeek } = await import("./season-calendar");
  const fromWeek = firstSeasonWeek(s);
  const toWeek = fromWeek + weekCount - 1;

  steps.push(
    `Range: ${weekTitle(fromWeek, s)} → ${weekTitle(toWeek, s)} (${weekCount} weeks) · ${s.toUpperCase()}`
  );
  opts?.onProgress?.({
    week: fromWeek,
    step: `Starting ${weekCount}-week LAB history build…`,
  });

  await exitEyesIfNeeded(steps);

  // Full bot field so standings / Board / Gazette have bodies
  const pad = await founderEnsureFullBotRoster();
  steps.push(...pad.steps.map((x) => `roster: ${x}`));
  if (!pad.ok) {
    return {
      ok: false,
      message: pad.message,
      steps,
      fromWeek,
      toWeek,
      finished: [],
    };
  }

  const finished: number[] = [];
  const alreadyScored = new Set(
    await listScoredWeekNumbers().catch(() => [] as number[])
  );
  for (let w = fromWeek; w <= toWeek; w++) {
    if (alreadyScored.has(w)) {
      steps.push(`w${w}: already scored — kept existing history`);
      finished.push(w);
      continue;
    }
    opts?.onProgress?.({
      week: w,
      step: `Post + score ${weekTitle(w, s)}…`,
    });
    const run = await founderPostAndScoreWeek(w);
    steps.push(...run.steps.map((x) => `w${w}: ${x}`));
    if (!run.ok) {
      return {
        ok: false,
        message: `Stopped at ${weekTitle(w, s)}: ${run.message}`,
        steps,
        fromWeek,
        toWeek,
        finished,
      };
    }
    finished.push(w);
  }

  // Leave the LAB room in a genuinely playable state. Scored history alone
  // is not enough: Home correctly refuses to invent an unpublished next card
  // and may fall back to an older published week. Publish the next real card
  // and make it the room's active week so the creator can walk Home → Picks →
  // score → Gazette exactly as a player would.
  const { seasonMaxWeek } = await import("./season-calendar");
  const nextWeek = toWeek + 1;
  if (nextWeek <= seasonMaxWeek(s)) {
    opts?.onProgress?.({
      week: nextWeek,
      step: `Opening playable ${weekTitle(nextWeek, s)}…`,
    });
    const next = await founderPostWeek(nextWeek);
    steps.push(...next.steps.map((x) => `next: ${x}`));
    if (!next.ok) {
      return {
        ok: false,
        message: `History built through ${weekTitle(toWeek, s)}, but the next playable card failed: ${next.message}`,
        steps,
        fromWeek,
        toWeek,
        finished,
      };
    }
    await setLeagueActiveWeek(nextWeek);
    steps.push(`${weekTitle(nextWeek, s)} published and set active for player walkthrough`);
  }

  // Drama on the last week so Gazette path is warm
  try {
    const { prepareFoundryDramaAfterScore } = await import("./foundry-preview");
    const drama = await prepareFoundryDramaAfterScore(toWeek);
    steps.push(drama.ok ? drama.message : `Drama: ${drama.message}`);
  } catch (e) {
    steps.push(
      `Drama skip: ${e instanceof Error ? e.message : "failed"}`
    );
  }

  try {
    localStorage.setItem(
      "warroom-active-week",
      String(nextWeek <= seasonMaxWeek(s) ? nextWeek : toWeek)
    );
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    message:
      nextWeek <= seasonMaxWeek(s)
        ? `Built ${finished.length} scored week(s) through ${weekTitle(toWeek, s)}. ${weekTitle(nextWeek, s)} is now published, unlocked, and ready to play.`
        : `Built ${finished.length} week(s) of LAB history through ${weekTitle(toWeek, s)}. Season limit reached.`,
    steps,
    fromWeek,
    toWeek,
    finished,
  };
}
