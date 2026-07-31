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

  // Explicit manual presets (players / odd / some funny)
  const presetMeta = PROP_PRESETS.find((p) => p.id === presetId);
  if (presetMeta?.settle === "manual" || presetId === "fn-any-ot" || presetId === "any-ot") {
    return {
      status: "manual",
      propResult: null,
      reason:
        presetMeta?.category === "players"
          ? "Player prop — set Yes/No from the official box score."
          : presetMeta?.category === "odd"
            ? "Odd box-score prop — set Yes/No after you check the wire."
            : "Set Yes/No manually (not in the score feed).",
      presetId,
    };
  }

  switch (presetId) {
    // —— Teams: totals ——
    case "tm-any-total-over-55":
    case "any-total-over-55": {
      if (finalBoxes.some((b) => total(b) >= 56)) {
        return settle(true, "At least one game total ≥ 56.");
      }
      if (!allFinal) {
        return wait(
          `No game over 55.5 yet (${nFinal}/${expected} final). Waiting…`
        );
      }
      return settle(false, "Every game total ≤ 55.");
    }

    case "tm-any-total-under-40":
    case "any-total-under-40": {
      if (finalBoxes.some((b) => total(b) <= 40)) {
        return settle(true, "At least one game total ≤ 40.");
      }
      if (!allFinal) {
        return wait(
          `No game under 40.5 yet (${nFinal}/${expected} final). Waiting…`
        );
      }
      return settle(false, "Every game total ≥ 41.");
    }

    case "tm-highest-total-60":
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

    case "tm-combined-280":
    case "all-five-combined-over-280": {
      const sum = finalBoxes.reduce((s, b) => s + total(b), 0);
      if (sum >= 281) {
        return settle(true, `Combined totals = ${sum} (≥ 281).`);
      }
      if (!allFinal) {
        return wait(
          `Combined so far ${sum} from ${nFinal}/${expected} games. Waiting…`
        );
      }
      return settle(false, `Combined totals = ${sum} (≤ 280).`);
    }

    case "fn-combined-under-200": {
      const sum = finalBoxes.reduce((s, b) => s + total(b), 0);
      if (!allFinal) {
        return wait(
          `Combined so far ${sum} from ${nFinal}/${expected}. Waiting…`
        );
      }
      return settle(sum <= 200, `Combined totals = ${sum}.`);
    }

    // —— Teams: margins ——
    case "tm-any-margin-21":
    case "any-margin-21": {
      if (finalBoxes.some((b) => margin(b) >= 21)) {
        return settle(true, "At least one margin ≥ 21.");
      }
      if (!allFinal) {
        return wait(`No 21+ margin yet (${nFinal}/${expected} final). Waiting…`);
      }
      return settle(false, "Every margin ≤ 20.");
    }

    case "tm-spreads-3-of-5-under-7": {
      const close = finalBoxes.filter((b) => {
        const m = margin(b);
        return m >= 1 && m <= 7;
      }).length;
      if (close >= 3) {
        return settle(true, `${close} games decided by ≤ 7.`);
      }
      if (!allFinal) {
        const rem = expected - nFinal;
        if (close + rem < 3) {
          return settle(false, `Only ${close} close games; cannot reach 3.`);
        }
        return wait(`${close} close (≤7) so far. Waiting…`);
      }
      return settle(false, `Only ${close} games with margin ≤ 7.`);
    }

    case "tm-spreads-3-of-5-under-3":
    case "any-margin-3-or-less": {
      const close = finalBoxes.filter((b) => {
        const m = margin(b);
        return m >= 1 && m <= 3;
      }).length;
      if (close >= 3 && presetId === "tm-spreads-3-of-5-under-3") {
        return settle(true, `${close} games decided by ≤ 3.`);
      }
      if (presetId === "any-margin-3-or-less") {
        if (close >= 1) return settle(true, "At least one margin is 1–3.");
        if (!allFinal) return wait("No 1–3 margin yet. Waiting…");
        return settle(false, "Every margin ≥ 4 (or 0).");
      }
      if (!allFinal) {
        const rem = expected - nFinal;
        if (close + rem < 3) {
          return settle(false, `Only ${close} one-score nail-biters; can't reach 3.`);
        }
        return wait(`${close} games margin ≤ 3 so far. Waiting…`);
      }
      return settle(false, `Only ${close} games with margin ≤ 3.`);
    }

    // —— Teams: covers ——
    case "tm-any-spread-cover-dog":
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
      if (anyDog) return settle(true, "At least one underdog covered.");
      if (!allFinal) return wait("No dog cover yet. Waiting…");
      return settle(false, "No underdog covered (pushes don't count).");
    }

    case "tm-favorites-3-covers":
    case "favorites-go-3-2-or-better": {
      let favCovers = 0;
      for (const g of games) {
        const b = byId.get(g.id);
        if (!b) continue;
        if (favoriteCovered(g, b)) favCovers += 1;
      }
      if (favCovers >= 3) {
        return settle(true, `Favorites covered ${favCovers} (≥ 3).`);
      }
      if (!allFinal) {
        const rem = expected - nFinal;
        if (favCovers + rem < 3) {
          return settle(
            false,
            `Favorites covered ${favCovers}; only ${rem} left — cannot reach 3.`
          );
        }
        return wait(`Favorites covered ${favCovers} so far. Waiting…`);
      }
      return settle(false, `Favorites covered ${favCovers} of ${expected} (≤ 2).`);
    }

    case "fn-all-favorites-cover": {
      if (!allFinal) return wait("Need all finals for chalk sweep.");
      let all = true;
      for (const g of games) {
        const b = byId.get(g.id);
        if (!b || !favoriteCovered(g, b)) {
          all = false;
          break;
        }
      }
      return settle(all, all ? "Favorites covered all 5." : "Chalk failed at least once.");
    }

    case "fn-all-dogs-cover": {
      if (!allFinal) return wait("Need all finals for dog sweep.");
      let all = true;
      for (const g of games) {
        const b = byId.get(g.id);
        if (!b || !dogCovered(g, b)) {
          all = false;
          break;
        }
      }
      return settle(all, all ? "Dogs covered all 5." : "Not a full dog sweep.");
    }

    // —— Teams / funny: scoring ——
    case "tm-any-team-under-10":
    case "any-team-under-10": {
      if (finalBoxes.some((b) => b.homeScore <= 9 || b.awayScore <= 9)) {
        return settle(true, "At least one team scored ≤ 9.");
      }
      if (!allFinal) return wait("No team ≤ 9 yet. Waiting…");
      return settle(false, "Every team scored ≥ 10.");
    }

    case "tm-any-team-over-45":
    case "any-team-over-45": {
      if (finalBoxes.some((b) => b.homeScore >= 46 || b.awayScore >= 46)) {
        return settle(true, "At least one team scored ≥ 46.");
      }
      if (!allFinal) return wait("No team ≥ 46 yet. Waiting…");
      return settle(false, "Every team scored ≤ 45.");
    }

    case "tm-both-teams-25":
    case "both-teams-25-any-game": {
      if (finalBoxes.some((b) => b.homeScore >= 25 && b.awayScore >= 25)) {
        return settle(true, "At least one game had both teams ≥ 25.");
      }
      if (!allFinal) return wait("No both-≥25 game yet. Waiting…");
      return settle(false, "No game had both teams ≥ 25.");
    }

    case "fn-any-shutout": {
      if (finalBoxes.some((b) => b.homeScore === 0 || b.awayScore === 0)) {
        return settle(true, "Someone scored 0.");
      }
      if (!allFinal) return wait("No shutout yet. Waiting…");
      return settle(false, "Everyone scored ≥ 1.");
    }

    case "fn-any-50-burger": {
      if (finalBoxes.some((b) => b.homeScore >= 50 || b.awayScore >= 50)) {
        return settle(true, "Someone dropped 50+.");
      }
      if (!allFinal) return wait("No 50-burger yet. Waiting…");
      return settle(false, "Nobody hit 50.");
    }

    case "fn-same-score-tie": {
      if (finalBoxes.some((b) => b.homeScore === b.awayScore)) {
        return settle(true, "At least one final was a tie.");
      }
      if (!allFinal) return wait("No tie yet. Waiting…");
      return settle(false, "Every game had a winner.");
    }

    case "fn-home-teams-sweep": {
      if (!allFinal) return wait("Need all finals for home sweep.");
      const allHome = finalBoxes.every((b) => b.homeScore > b.awayScore);
      return settle(allHome, allHome ? "Home went 5–0." : "Home lost at least one.");
    }

    case "fn-road-teams-sweep": {
      if (!allFinal) return wait("Need all finals for road sweep.");
      const allRoad = finalBoxes.every((b) => b.awayScore > b.homeScore);
      return settle(allRoad, allRoad ? "Road went 5–0." : "Road lost at least one.");
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
