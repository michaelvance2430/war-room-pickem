/**
 * Sandbox helper: publish demo card → bot picks → random results → score
 * for every week that isn't already scored, through CFP Final.
 *
 * Use this to run an entire CFB season dry-run without clicking each week.
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
 *
 * Pads the roster with trial bots (toward 16) once at the start if the
 * field is thin — full seasons need bodies on the board.
 */
export async function autoFinishRemainingWeeks(opts?: {
  /** If set, only run this week and later (default: first unscored) */
  fromWeek?: number;
  /** Grow roster toward this size before week 0 (default 16) */
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
      message: "Every week 0–18 is already scored. Season complete — check Champ / Toilet / Trophies.",
    };
  }

  // Pad bots so the season has a full field (skip if already ≥ target)
  const padTo = opts?.padRosterTo ?? 16;
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
      opts?.onProgress?.({
        week,
        label,
        step: `Week ${week} of ${SEASON_MAX_WEEK} — demo slate…`,
      });
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
  const allDone =
    finished.length + skipped.length > 0 &&
    [...Array(SEASON_MAX_WEEK + 1).keys()].every(
      (w) => scored.has(w) || finished.includes(w)
    );

  return {
    ok: hardErrors.length === 0,
    finished,
    skipped,
    errors,
    message:
      finished.length === 0 && hardErrors.length
        ? `Stopped early. ${hardErrors[0]}`
        : finished.length === 0
          ? "No weeks left to finish — season already complete. Open Champ / Toilet / Trophies."
          : `Season run: finished ${finished.length} week(s) (${finished.map(weekTitle).join(", ")}).${
              hardErrors.length
                ? ` Issues: ${hardErrors.join(" · ")}`
                : allDone || last === SEASON_MAX_WEEK
                  ? " Full map through CFP Final. Check Standings, Champ, Toilet, Trophies."
                  : " More weeks may remain if something stopped early."
            }`,
  };
}
