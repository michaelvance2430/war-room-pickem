import type { Game, Prop } from "./types";
import { matchPresetId, CUSTOM_PROP_ID, PROP_PRESETS } from "./prop-presets";

/** Final box score for one card game (required for auto-prop). */
export type FinalBox = {
  gameId: string;
  homeScore: number;
  awayScore: number;
  /** ATS cover side from locked card spread */
  atsWinner: "home" | "away" | "push";
};

export type PropSettleResult = {
  /** settled = pick option A or B; incomplete = wait; manual = OT/custom */
  status: "settled" | "incomplete" | "manual" | "unknown";
  /** Exact option string from prop.options when settled */
  propResult: string | null;
  /** Short human reason for commissioner report */
  reason: string;
  presetId: string;
};

function yesNo(prop: Prop, yes: boolean): string {
  return yes ? prop.options[0] : prop.options[1];
}

function total(b: FinalBox): number {
  return b.homeScore + b.awayScore;
}

function margin(b: FinalBox): number {
  return Math.abs(b.homeScore - b.awayScore);
}

/**
 * Underdog cover: favorite fails to cover (away covers if home favored, etc.).
 * Push does not count as a dog cover.
 */
function dogCovered(game: Game, box: FinalBox): boolean {
  if (box.atsWinner === "push") return false;
  const dogSide: "home" | "away" =
    game.favorite === "home" ? "away" : "home";
  return box.atsWinner === dogSide;
}

function favoriteCovered(game: Game, box: FinalBox): boolean {
  if (box.atsWinner === "push") return false;
  return box.atsWinner === game.favorite;
}

/**
 * Settle a published prop from final scores + ATS results.
 * Most presets auto-settle. Custom + OT stay manual.
 */
export function settlePropFromScores(opts: {
  prop: Prop;
  games: Game[];
  boxes: FinalBox[];
  /** Expected games on card (usually 5) */
  expectedGames?: number;
}): PropSettleResult {
  const { prop, games, boxes } = opts;
  const expected = opts.expectedGames ?? (games.length || 5);
  const presetId = matchPresetId(prop);
  const byId = new Map(boxes.map((b) => [b.gameId, b]));

  if (presetId === CUSTOM_PROP_ID) {
    return {
      status: "manual",
      propResult: null,
      reason: "Custom prop — set the result manually.",
      presetId,
    };
  }

  // OT cannot be inferred from final scores alone
  if (presetId === "any-ot") {
    return {
      status: "manual",
      propResult: null,
      reason:
        "Overtime is not in the score feed — set Yes/No manually from the box scores.",
      presetId,
    };
  }

  const finalBoxes: FinalBox[] = [];
  for (const g of games) {
    const b = byId.get(g.id);
    if (b) finalBoxes.push(b);
  }

  const nFinal = finalBoxes.length;
  const allFinal = nFinal >= expected && nFinal >= games.length;

  const settle = (yes: boolean, reason: string): PropSettleResult => ({
    status: "settled",
    propResult: yesNo(prop, yes),
    reason,
    presetId,
  });

  const wait = (reason: string): PropSettleResult => ({
    status: "incomplete",
    propResult: null,
    reason,
    presetId,
  });

  switch (presetId) {
    case "any-total-over-55": {
      if (finalBoxes.some((b) => total(b) >= 56)) {
        return settle(true, "At least one game total ≥ 56.");
      }
      if (!allFinal) {
        return wait(
          `No game over 55.5 yet (${nFinal}/${expected} final). Waiting on remaining games.`
        );
      }
      return settle(false, "Every game total ≤ 55.");
    }

    case "any-total-under-40": {
      if (finalBoxes.some((b) => total(b) <= 40)) {
        return settle(true, "At least one game total ≤ 40.");
      }
      if (!allFinal) {
        return wait(
          `No game under 40.5 yet (${nFinal}/${expected} final). Waiting on remaining games.`
        );
      }
      return settle(false, "Every game total ≥ 41.");
    }

    case "highest-total-over-60": {
      const maxT = finalBoxes.length
        ? Math.max(...finalBoxes.map(total))
        : 0;
      if (maxT >= 61) {
        return settle(true, `Highest total so far is ${maxT} (≥ 61).`);
      }
      if (!allFinal) {
        return wait(
          `Highest total so far ${maxT} (${nFinal}/${expected} final). Waiting…`
        );
      }
      return settle(false, `Highest total was ${maxT} (≤ 60).`);
    }

    case "all-five-combined-over-280": {
      const sum = finalBoxes.reduce((s, b) => s + total(b), 0);
      if (sum >= 281) {
        return settle(true, `Combined totals = ${sum} (≥ 281).`);
      }
      if (!allFinal) {
        // Even if remaining games go huge, we need all five for "all 5 combined"
        // but we can settle YES early if partial sum already ≥ 281 (done above).
        // For NO we need all finals.
        const remaining = expected - nFinal;
        // Max theoretical remaining doesn't help; just wait
        return wait(
          `Combined so far ${sum} from ${nFinal}/${expected} games. Waiting…`
        );
      }
      return settle(false, `Combined totals = ${sum} (≤ 280).`);
    }

    case "any-margin-21": {
      if (finalBoxes.some((b) => margin(b) >= 21)) {
        return settle(true, "At least one margin ≥ 21.");
      }
      if (!allFinal) {
        return wait(
          `No 21+ margin yet (${nFinal}/${expected} final). Waiting…`
        );
      }
      return settle(false, "Every margin ≤ 20.");
    }

    case "any-margin-3-or-less": {
      if (finalBoxes.some((b) => {
        const m = margin(b);
        return m >= 1 && m <= 3;
      })) {
        return settle(true, "At least one margin is 1–3 points.");
      }
      if (!allFinal) {
        return wait(
          `No 1–3 point game yet (${nFinal}/${expected} final). Waiting…`
        );
      }
      return settle(false, "Every margin ≥ 4 (or 0).");
    }

    case "any-dog-covers": {
      let anyDog = false;
      for (const g of games) {
        const b = byId.get(g.id);
        if (!b) continue;
        if (dogCovered(g, b)) {
          anyDog = true;
          break;
        }
      }
      if (anyDog) {
        return settle(true, "At least one underdog covered.");
      }
      if (!allFinal) {
        return wait(
          `No dog cover yet (${nFinal}/${expected} final). Waiting…`
        );
      }
      return settle(false, "No underdog covered (pushes don't count).");
    }

    case "favorites-go-3-2-or-better": {
      let favCovers = 0;
      let decided = 0;
      for (const g of games) {
        const b = byId.get(g.id);
        if (!b) continue;
        decided += 1;
        if (favoriteCovered(g, b)) favCovers += 1;
      }
      if (favCovers >= 3) {
        return settle(true, `Favorites covered ${favCovers} game(s) (≥ 3).`);
      }
      if (!allFinal) {
        const remaining = expected - nFinal;
        if (favCovers + remaining < 3) {
          return settle(
            false,
            `Favorites covered ${favCovers}; only ${remaining} game(s) left — cannot reach 3.`
          );
        }
        return wait(
          `Favorites covered ${favCovers} so far (${nFinal}/${expected} final). Waiting…`
        );
      }
      return settle(
        false,
        `Favorites covered ${favCovers} of ${expected} (≤ 2).`
      );
    }

    case "any-team-under-10": {
      if (
        finalBoxes.some((b) => b.homeScore <= 9 || b.awayScore <= 9)
      ) {
        return settle(true, "At least one team scored ≤ 9.");
      }
      if (!allFinal) {
        return wait(
          `No team ≤ 9 yet (${nFinal}/${expected} final). Waiting…`
        );
      }
      return settle(false, "Every team scored ≥ 10.");
    }

    case "any-team-over-45": {
      if (
        finalBoxes.some((b) => b.homeScore >= 46 || b.awayScore >= 46)
      ) {
        return settle(true, "At least one team scored ≥ 46.");
      }
      if (!allFinal) {
        return wait(
          `No team ≥ 46 yet (${nFinal}/${expected} final). Waiting…`
        );
      }
      return settle(false, "Every team scored ≤ 45.");
    }

    case "both-teams-25-any-game": {
      if (
        finalBoxes.some((b) => b.homeScore >= 25 && b.awayScore >= 25)
      ) {
        return settle(true, "At least one game had both teams ≥ 25.");
      }
      if (!allFinal) {
        return wait(
          `No both-≥25 game yet (${nFinal}/${expected} final). Waiting…`
        );
      }
      return settle(false, "No game had both teams ≥ 25.");
    }

    default: {
      const known = PROP_PRESETS.some((p) => p.id === presetId);
      if (!known) {
        return {
          status: "unknown",
          propResult: null,
          reason: "Unknown prop type — set manually.",
          presetId,
        };
      }
      return {
        status: "manual",
        propResult: null,
        reason: "This prop is not auto-settled yet — set manually.",
        presetId,
      };
    }
  }
}
