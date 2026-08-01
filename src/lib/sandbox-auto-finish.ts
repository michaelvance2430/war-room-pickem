/**
 * Sandbox helper: publish demo card → bot picks → random results → score
 * for every week that isn't already scored (CFB → CFP Final, NFL → Super Bowl).
 */

import { generateDemoSlate, randomizeDemoResults } from "@/lib/demo-slate";
import {
  publishWeekCard,
  saveResultsAndScoreWeek,
  seedBotPicksForWeekInCloud,
  setLeagueActiveWeek,
  listScoredWeekNumbers,
  loadLeagueRoster,
  fillLeagueWithBotsToCap,
} from "@/lib/cloud";
import { propFromPreset, rotatingPropPreset } from "@/lib/prop-presets";
import {
  firstSeasonWeek,
  seasonMaxWeek,
} from "@/lib/season-calendar";
import { weekTitle } from "@/lib/dates";
import { getLeague, isOps } from "@/lib/league";
import {
  isPreseasonCommishToolsAllowed,
  preseasonCommishToolsBody,
} from "@/lib/season-mode";

export type AutoFinishProgress = {
  week: number;
  label: string;
  step: string;
};

export type AutoFinishResult = {
  ok: boolean;
  finished: number[];
  skipped: number[];
  errors: string[];
  message: string;
};

/**
 * Finish unscored weeks in a range.
 * - Default: first unscored → sport season end (CFB 18 / NFL 22)
 * - fromWeek / toWeek: run only that inclusive range (one week = same both)
 * Safe to re-run: already-scored weeks are skipped.
 *
 * Pads the roster with trial bots (toward 16) once at the start if the
 * field is thin — full seasons need bodies on the board.
 */
export async function autoFinishRemainingWeeks(opts?: {
  /** Inclusive start (default: first unscored) */
  fromWeek?: number;
  /** Inclusive end (default: sport max week). One week: set fromWeek === toWeek. */
  toWeek?: number;
  /** Grow roster toward this size before the run (default 16; set 0 to skip pad) */
  padRosterTo?: number;
  onProgress?: (p: AutoFinishProgress) => void;
}): Promise<AutoFinishResult> {
  if (!isOps()) {
    return {
      ok: false,
      finished: [],
      skipped: [],
      errors: ["Commissioner or deputy only"],
      message: "Ops only",
    };
  }

  if (!isPreseasonCommishToolsAllowed()) {
    return {
      ok: false,
      finished: [],
      skipped: [],
      errors: ["Pre-season only"],
      message: preseasonCommishToolsBody().replace(/\n+/g, " "),
    };
  }

  const sportId = getLeague()?.sportId;
  const minW = firstSeasonWeek(sportId);
  const maxW = seasonMaxWeek(sportId);
  const scored = new Set(await listScoredWeekNumbers());
  const finished: number[] = [];
  const skipped: number[] = [];
  const errors: string[] = [];

  const start =
    opts?.fromWeek != null
      ? Math.max(minW, Math.min(maxW, opts.fromWeek))
      : (() => {
          for (let w = minW; w <= maxW; w++) {
            if (!scored.has(w)) return w;
          }
          return maxW + 1;
        })();

  const end =
    opts?.toWeek != null
      ? Math.max(minW, Math.min(maxW, opts.toWeek))
      : maxW;

  if (start > maxW) {
    return {
      ok: true,
      finished: [],
      skipped: [...scored].sort((a, b) => a - b),
      errors: [],
      message:
        sportId === "nfl"
          ? "Every NFL week (1–22) is already scored. Season complete — check Champ / Toilet / Trophies."
          : "Every week 0–18 is already scored. Season complete — check Champ / Toilet / Trophies.",
    };
  }

  if (end < start) {
    return {
      ok: false,
      finished: [],
      skipped: [],
      errors: ["End week must be ≥ start week"],
      message: "Pick a range that goes forward (from ≤ to).",
    };
  }

  // Pad bots so the season has a full field (skip if already ≥ target or pad disabled)
  const padTo = opts?.padRosterTo ?? 16;
  if (padTo > 0) {
  try {
    const roster = await loadLeagueRoster();
    if (roster.length < padTo) {
      opts?.onProgress?.({
        week: start,
        label: "Roster",
        step: `Padding bots toward ${padTo} (have ${roster.length})…`,
      });
      const pad = await fillLeagueWithBotsToCap({ targetTotal: padTo });
      if (!pad.ok) {
        errors.push(
          `Bot pad warning — ${pad.error || "failed"}. Continuing with ${roster.length} players.`
        );
      } else if ((pad.added || 0) > 0) {
        opts?.onProgress?.({
          week: start,
          label: "Roster",
          step: `Added ${pad.added} bot(s).`,
        });
      }
    }
  } catch (e) {
    errors.push(
      `Bot pad warning — ${e instanceof Error ? e.message : "failed"}`
    );
  }
  }

  for (let week = start; week <= end; week++) {
    const label = weekTitle(week);
    if (scored.has(week)) {
      skipped.push(week);
      opts?.onProgress?.({
        week,
        label,
        step: "Already scored — skip",
      });
      continue;
    }

    try {
      opts?.onProgress?.({
        week,
        label,
        step: `Week ${week} of ${end} (range ${start}–${end}) — demo slate…`,
      });
      const sport =
        (await import("./league")).getLeague()?.sportId === "nfl"
          ? "nfl"
          : "cfb";
      const demoGames = generateDemoSlate(week, 5, sport);
      const prop = propFromPreset(rotatingPropPreset(week, sport), week);

      opts?.onProgress?.({ week, label, step: "Publishing card…" });
      const pub = await publishWeekCard({
        weekNumber: week,
        games: demoGames,
        prop,
      });
      if (!pub.ok || !pub.games?.length) {
        errors.push(`${label}: publish failed — ${pub.error || "unknown"}`);
        break;
      }
      const games = pub.games;

      opts?.onProgress?.({ week, label, step: "Bot picks…" });
      const bots = await seedBotPicksForWeekInCloud(week);
      if (!bots.ok) {
        errors.push(
          `${label}: bot picks warning — ${bots.error || "failed"} (scoring anyway)`
        );
      }

      try {
        opts?.onProgress?.({ week, label, step: "Bot locker talk…" });
        const { seedBotLockerTalk } = await import("./bot-locker-talk");
        await seedBotLockerTalk({
          weekNumber: week,
          weekLabel: label,
          sportId: sport,
          count: 6,
          force: true,
        });
      } catch {
        /* optional demo spice */
      }

      opts?.onProgress?.({ week, label, step: "Random results…" });
      const { results, propResult } = randomizeDemoResults(games, prop.options);

      opts?.onProgress?.({ week, label, step: "Scoring league…" });
      const scoredRes = await saveResultsAndScoreWeek({
        weekNumber: week,
        games,
        prop,
        results,
        propResult,
      });
      if (!scoredRes.ok) {
        errors.push(`${label}: score failed — ${scoredRes.error || "unknown"}`);
        break;
      }
      if ((scoredRes.scoredCount || 0) === 0) {
        errors.push(
          `${label}: scored 0 players — add trial bots (Settings) or lock picks, then re-run.`
        );
        // Still mark week done so we don't loop forever; standings may be empty
      }

      finished.push(week);
      scored.add(week);
      await setLeagueActiveWeek(week);
      opts?.onProgress?.({
        week,
        label,
        step: `Done · ${scoredRes.scoredCount} player(s)  (${finished.length} new week(s) this run)`,
      });

      // Yield so React can paint progress between weeks
      await new Promise((r) => setTimeout(r, 120));
    } catch (e) {
      errors.push(
        `${label}: ${e instanceof Error ? e.message : "unexpected error"}`
      );
      break;
    }
  }

  const last = finished[finished.length - 1];
  if (last != null) {
    await setLeagueActiveWeek(last);
  }

  const hardErrors = errors.filter((e) => !/warning/i.test(e));
  const rangeComplete =
    finished.length +
      skipped.filter((w) => w >= start && w <= end).length >=
    end - start + 1;

  return {
    ok: hardErrors.length === 0,
    finished,
    skipped,
    errors,
    message:
      finished.length === 0 && hardErrors.length
        ? `Stopped early. ${hardErrors[0]}`
        : finished.length === 0
          ? start === end
            ? `${weekTitle(start)} was already scored (or nothing to run).`
            : `No unscored weeks in ${weekTitle(start)} → ${weekTitle(end)}. Already done or empty range.`
          : `Auto-run: finished ${finished.length} week(s) (${finished.map((w) => weekTitle(w)).join(", ")}).${
              hardErrors.length
                ? ` Issues: ${hardErrors.join(" · ")}`
                : rangeComplete
                  ? start === end
                    ? ` ${weekTitle(start)} complete.`
                    : ` Range ${weekTitle(start)} → ${weekTitle(end)} complete.`
                  : " Stopped before the full range finished."
            }`,
  };
}
