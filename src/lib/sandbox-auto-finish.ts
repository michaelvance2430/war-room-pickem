/**
 * Sandbox helper: publish demo card → bot picks → random results → score
 * for every week that isn't already scored, through CFP Final.
 */

import { generateDemoSlate, randomizeDemoResults } from "@/lib/demo-slate";
import {
  publishWeekCard,
  saveResultsAndScoreWeek,
  seedBotPicksForWeekInCloud,
  setLeagueActiveWeek,
  listScoredWeekNumbers,
} from "@/lib/cloud";
import { PROP_PRESETS, propFromPreset } from "@/lib/prop-presets";
import { SEASON_MAX_WEEK } from "@/lib/season-calendar";
import { weekTitle } from "@/lib/dates";
import { isOps } from "@/lib/league";

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
 * Finish all unscored weeks from the first gap through SEASON_MAX_WEEK (18).
 * Safe to re-run: already-scored weeks are skipped.
 */
export async function autoFinishRemainingWeeks(opts?: {
  /** If set, only run this week and later (default: first unscored) */
  fromWeek?: number;
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

  const scored = new Set(await listScoredWeekNumbers());
  const finished: number[] = [];
  const skipped: number[] = [];
  const errors: string[] = [];

  const start =
    opts?.fromWeek != null
      ? opts.fromWeek
      : (() => {
          for (let w = 0; w <= SEASON_MAX_WEEK; w++) {
            if (!scored.has(w)) return w;
          }
          return SEASON_MAX_WEEK + 1;
        })();

  if (start > SEASON_MAX_WEEK) {
    return {
      ok: true,
      finished: [],
      skipped: [...scored].sort((a, b) => a - b),
      errors: [],
      message: "Every week 0–18 is already scored. Nothing to do.",
    };
  }

  for (let week = start; week <= SEASON_MAX_WEEK; week++) {
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
      opts?.onProgress?.({ week, label, step: "Demo slate…" });
      const demoGames = generateDemoSlate(week, 5);
      const preset = PROP_PRESETS[week % PROP_PRESETS.length];
      const prop = propFromPreset(preset, week);

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
        // Continue — human picks may still exist; bots optional
        errors.push(
          `${label}: bot picks warning — ${bots.error || "failed"} (scoring anyway)`
        );
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

      finished.push(week);
      scored.add(week);
      await setLeagueActiveWeek(week);
      opts?.onProgress?.({
        week,
        label,
        step: `Done · ${scoredRes.scoredCount} player(s)`,
      });

      // Brief yield so UI can paint progress
      await new Promise((r) => setTimeout(r, 80));
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
  return {
    ok: hardErrors.length === 0,
    finished,
    skipped,
    errors,
    message:
      finished.length === 0 && hardErrors.length
        ? `Stopped early. ${hardErrors[0]}`
        : finished.length === 0
          ? "No weeks left to finish (all scored or nothing selected)."
          : `Finished ${finished.length} week(s): ${finished.map(weekTitle).join(", ")}.${
              hardErrors.length ? ` Issues: ${hardErrors.join(" · ")}` : " Standings + brackets should update — check Champ / Toilet."
            }`,
  };
}
