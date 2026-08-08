export type NcaaRegion = "East" | "West" | "South" | "Midwest";
export const NCAA_REGIONS: readonly NcaaRegion[] = ["East", "West", "South", "Midwest"];

export type NcaaSlot = { seed: number; teams: readonly string[] };
export type NcaaGame = {
  id: string;
  label: string;
  teamA: string | null;
  teamB: string | null;
  seedA?: number;
  seedB?: number;
};
export type NcaaPicks = Record<string, string>;

// A complete 68-team Foundry field: 64 bracket slots plus four First Four games.
// It is deliberately a projection, not a claim about a real Selection Sunday field.
export const NCAA_FIELD: Record<NcaaRegion, readonly NcaaSlot[]> = {
  East: [
    { seed: 1, teams: ["Duke"] }, { seed: 16, teams: ["Howard", "Norfolk State"] },
    { seed: 8, teams: ["Iowa"] }, { seed: 9, teams: ["Mississippi State"] },
    { seed: 5, teams: ["Clemson"] }, { seed: 12, teams: ["Liberty"] },
    { seed: 4, teams: ["Illinois"] }, { seed: 13, teams: ["Vermont"] },
    { seed: 6, teams: ["Saint Mary's"] }, { seed: 11, teams: ["VCU"] },
    { seed: 3, teams: ["Kentucky"] }, { seed: 14, teams: ["Colgate"] },
    { seed: 7, teams: ["UCLA"] }, { seed: 10, teams: ["New Mexico"] },
    { seed: 2, teams: ["Tennessee"] }, { seed: 15, teams: ["Longwood"] },
  ],
  West: [
    { seed: 1, teams: ["Houston"] }, { seed: 16, teams: ["Montana"] },
    { seed: 8, teams: ["Ohio State"] }, { seed: 9, teams: ["San Diego State"] },
    { seed: 5, teams: ["Oregon"] }, { seed: 12, teams: ["Grand Canyon"] },
    { seed: 4, teams: ["Arizona"] }, { seed: 13, teams: ["Yale"] },
    { seed: 6, teams: ["Wisconsin"] }, { seed: 11, teams: ["Oklahoma", "Indiana"] },
    { seed: 3, teams: ["Gonzaga"] }, { seed: 14, teams: ["UC Irvine"] },
    { seed: 7, teams: ["Texas Tech"] }, { seed: 10, teams: ["Drake"] },
    { seed: 2, teams: ["Kansas"] }, { seed: 15, teams: ["Eastern Washington"] },
  ],
  South: [
    { seed: 1, teams: ["Alabama"] }, { seed: 16, teams: ["Grambling", "Prairie View A&M"] },
    { seed: 8, teams: ["Michigan"] }, { seed: 9, teams: ["Memphis"] },
    { seed: 5, teams: ["Auburn"] }, { seed: 12, teams: ["McNeese"] },
    { seed: 4, teams: ["Baylor"] }, { seed: 13, teams: ["Samford"] },
    { seed: 6, teams: ["Florida"] }, { seed: 11, teams: ["Pittsburgh"] },
    { seed: 3, teams: ["North Carolina"] }, { seed: 14, teams: ["Charleston"] },
    { seed: 7, teams: ["Texas"] }, { seed: 10, teams: ["Nevada"] },
    { seed: 2, teams: ["Purdue"] }, { seed: 15, teams: ["Morehead State"] },
  ],
  Midwest: [
    { seed: 1, teams: ["UConn"] }, { seed: 16, teams: ["Stetson"] },
    { seed: 8, teams: ["Nebraska"] }, { seed: 9, teams: ["TCU"] },
    { seed: 5, teams: ["BYU"] }, { seed: 12, teams: ["James Madison"] },
    { seed: 4, teams: ["Marquette"] }, { seed: 13, teams: ["Akron"] },
    { seed: 6, teams: ["South Carolina"] }, { seed: 11, teams: ["Colorado", "Seton Hall"] },
    { seed: 3, teams: ["Creighton"] }, { seed: 14, teams: ["Oakland"] },
    { seed: 7, teams: ["Dayton"] }, { seed: 10, teams: ["Boise State"] },
    { seed: 2, teams: ["Iowa State"] }, { seed: 15, teams: ["South Dakota State"] },
  ],
};

function playInId(region: NcaaRegion, slot: NcaaSlot) {
  return `first-four:${region}:${slot.seed}`;
}

export function firstFourGames(): NcaaGame[] {
  return NCAA_REGIONS.flatMap((region) => NCAA_FIELD[region]
    .filter((slot) => slot.teams.length === 2)
    .map((slot) => ({ id: playInId(region, slot), label: `${region} · ${slot.seed} seed`, teamA: slot.teams[0], teamB: slot.teams[1], seedA: slot.seed, seedB: slot.seed })));
}

function slotWinner(region: NcaaRegion, slot: NcaaSlot, picks: NcaaPicks): string | null {
  if (slot.teams.length === 1) return slot.teams[0];
  return picks[playInId(region, slot)] || null;
}

export function regionRoundGames(region: NcaaRegion, round: 1 | 2 | 3 | 4, picks: NcaaPicks): NcaaGame[] {
  if (round === 1) {
    const slots = NCAA_FIELD[region];
    return Array.from({ length: 8 }, (_, index) => {
      const a = slots[index * 2]; const b = slots[index * 2 + 1];
      return { id: `${region}:r1:${index}`, label: "Round of 64", teamA: slotWinner(region, a, picks), teamB: slotWinner(region, b, picks), seedA: a.seed, seedB: b.seed };
    });
  }
  const prior = regionRoundGames(region, (round - 1) as 1 | 2 | 3, picks);
  return Array.from({ length: prior.length / 2 }, (_, index) => ({
    id: `${region}:r${round}:${index}`,
    label: round === 2 ? "Round of 32" : round === 3 ? "Sweet 16" : "Elite Eight",
    teamA: picks[prior[index * 2].id] || null,
    teamB: picks[prior[index * 2 + 1].id] || null,
  }));
}

export function regionChampion(region: NcaaRegion, picks: NcaaPicks): string | null {
  return picks[regionRoundGames(region, 4, picks)[0].id] || null;
}

export function finalFourGames(picks: NcaaPicks): NcaaGame[] {
  return [
    { id: "national:semifinal:0", label: "Final Four", teamA: regionChampion("East", picks), teamB: regionChampion("West", picks) },
    { id: "national:semifinal:1", label: "Final Four", teamA: regionChampion("South", picks), teamB: regionChampion("Midwest", picks) },
  ];
}

export function nationalChampionshipGame(picks: NcaaPicks): NcaaGame {
  const semis = finalFourGames(picks);
  return { id: "national:championship", label: "National Championship", teamA: picks[semis[0].id] || null, teamB: picks[semis[1].id] || null };
}

export function sanitizeNcaaPicks(picks: NcaaPicks): NcaaPicks {
  const next: NcaaPicks = {};
  const games = [...firstFourGames()];
  for (const game of games) if (picks[game.id] === game.teamA || picks[game.id] === game.teamB) next[game.id] = picks[game.id];
  for (const region of NCAA_REGIONS) for (const round of [1, 2, 3, 4] as const) for (const game of regionRoundGames(region, round, next)) if (picks[game.id] === game.teamA || picks[game.id] === game.teamB) next[game.id] = picks[game.id];
  for (const game of finalFourGames(next)) if (picks[game.id] === game.teamA || picks[game.id] === game.teamB) next[game.id] = picks[game.id];
  const title = nationalChampionshipGame(next); if (picks[title.id] === title.teamA || picks[title.id] === title.teamB) next[title.id] = picks[title.id];
  return next;
}

export function ncaaPickCount(picks: NcaaPicks): number {
  return Object.keys(sanitizeNcaaPicks(picks)).length;
}

export function ncaaGameWeight(gameId: string): number {
  if (gameId.startsWith("first-four:")) return 1;
  if (gameId.includes(":r1:")) return 1;
  if (gameId.includes(":r2:")) return 2;
  if (gameId.includes(":r3:")) return 4;
  if (gameId.includes(":r4:")) return 8;
  if (gameId.startsWith("national:semifinal:")) return 16;
  if (gameId === "national:championship") return 32;
  return 0;
}

export function ncaaScore(picks: NcaaPicks, results: NcaaPicks): number {
  const validPicks = sanitizeNcaaPicks(picks);
  return Object.entries(results).reduce(
    (total, [gameId, winner]) => total + (validPicks[gameId] === winner ? ncaaGameWeight(gameId) : 0),
    0
  );
}

function deterministicWinner(game: NcaaGame, salt: number): string | null {
  if (!game.teamA || !game.teamB) return null;
  const hash = [...`${game.id}:${salt}`].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381);
  return hash % 5 === 0 ? game.teamB : game.teamA;
}

/** Build a coherent full bracket, useful for fictional Foundry players. */
export function generateNcaaPicks(salt: number): NcaaPicks {
  let picks: NcaaPicks = {};
  const choose = (game: NcaaGame) => {
    const winner = deterministicWinner(game, salt);
    if (winner) picks = sanitizeNcaaPicks({ ...picks, [game.id]: winner });
  };
  firstFourGames().forEach(choose);
  for (const region of NCAA_REGIONS) {
    for (const round of [1, 2, 3, 4] as const) regionRoundGames(region, round, picks).forEach(choose);
  }
  finalFourGames(picks).forEach(choose);
  choose(nationalChampionshipGame(picks));
  return picks;
}

/**
 * Reveal real (fictional Foundry) results through one postseason window.
 * 0 = none, 1 = First Four/R64, 2 = R32, 3 = S16/E8, 4 = Final Four/title.
 */
export function simulateNcaaResultsThroughWindow(window: number, salt = 2026): NcaaPicks {
  let results: NcaaPicks = {};
  const choose = (game: NcaaGame) => {
    const winner = deterministicWinner(game, salt);
    if (winner) results = sanitizeNcaaPicks({ ...results, [game.id]: winner });
  };
  if (window >= 1) {
    firstFourGames().forEach(choose);
    for (const region of NCAA_REGIONS) regionRoundGames(region, 1, results).forEach(choose);
  }
  if (window >= 2) for (const region of NCAA_REGIONS) regionRoundGames(region, 2, results).forEach(choose);
  if (window >= 3) for (const region of NCAA_REGIONS) {
    regionRoundGames(region, 3, results).forEach(choose);
    regionRoundGames(region, 4, results).forEach(choose);
  }
  if (window >= 4) {
    finalFourGames(results).forEach(choose);
    choose(nationalChampionshipGame(results));
  }
  return results;
}

export function ncaaResultsWindow(results: NcaaPicks): number {
  if (results["national:championship"]) return 4;
  if (NCAA_REGIONS.some((region) => results[`${region}:r4:0`])) return 3;
  if (NCAA_REGIONS.some((region) => results[`${region}:r2:0`])) return 2;
  if (NCAA_REGIONS.some((region) => results[`${region}:r1:0`])) return 1;
  return 0;
}
