export type NflConference = "AFC" | "NFC";
export type NflPlayoffTeam = { id: string; name: string; seed: number; conference: NflConference };
export type NflPlayoffGame = { id: string; label: string; teams: readonly [NflPlayoffTeam, NflPlayoffTeam] };
export type NflPlayoffPicks = Record<string, string>;

export const NFL_PLAYOFF_TEAMS: readonly NflPlayoffTeam[] = (["AFC", "NFC"] as const).flatMap((conference) =>
  ["Command", "Forge", "Wolves", "Sentinels", "Outlaws", "Aviators", "Sharks"].map((name, index) => ({ id: `${conference.toLowerCase()}-${index + 1}`, name: `${conference} ${name}`, seed: index + 1, conference }))
);

const byId = new Map(NFL_PLAYOFF_TEAMS.map((team) => [team.id, team]));
const team = (id?: string) => id ? byId.get(id) : undefined;
const conferenceTeams = (conference: NflConference) => NFL_PLAYOFF_TEAMS.filter((entry) => entry.conference === conference);

export function nflPlayoffGames(picks: NflPlayoffPicks): NflPlayoffGame[] {
  const games: NflPlayoffGame[] = [];
  for (const conference of ["AFC", "NFC"] as const) {
    const field = conferenceTeams(conference);
    games.push(
      { id: `${conference}:wc:2-7`, label: `${conference} Wild Card`, teams: [field[1], field[6]] },
      { id: `${conference}:wc:3-6`, label: `${conference} Wild Card`, teams: [field[2], field[5]] },
      { id: `${conference}:wc:4-5`, label: `${conference} Wild Card`, teams: [field[3], field[4]] },
    );
    const survivors = [`${conference}:wc:2-7`, `${conference}:wc:3-6`, `${conference}:wc:4-5`].map((id) => team(picks[id])).filter((entry): entry is NflPlayoffTeam => !!entry);
    if (survivors.length === 3) {
      const sorted = [...survivors].sort((a, b) => a.seed - b.seed);
      games.push(
        { id: `${conference}:div:1`, label: `${conference} Divisional`, teams: [field[0], sorted[2]] },
        { id: `${conference}:div:2`, label: `${conference} Divisional`, teams: [sorted[0], sorted[1]] },
      );
      const finalists = [`${conference}:div:1`, `${conference}:div:2`].map((id) => team(picks[id])).filter((entry): entry is NflPlayoffTeam => !!entry);
      if (finalists.length === 2) games.push({ id: `${conference}:title`, label: `${conference} Championship`, teams: [finalists[0], finalists[1]] });
    }
  }
  const conferenceWinners = [team(picks["AFC:title"]), team(picks["NFC:title"])];
  if (conferenceWinners.every(Boolean)) games.push({ id: "super-bowl", label: "The Super Bowl", teams: conferenceWinners as [NflPlayoffTeam, NflPlayoffTeam] });
  return games;
}

export function sanitizeNflPlayoffPicks(picks: NflPlayoffPicks): NflPlayoffPicks {
  const next = { ...picks };
  for (let pass = 0; pass < 4; pass++) {
    const legal = new Map(nflPlayoffGames(next).map((game) => [game.id, game.teams.map((entry) => entry.id)]));
    for (const [id, pick] of Object.entries(next)) if (!legal.get(id)?.includes(pick)) delete next[id];
  }
  return next;
}

export function generateNflPlayoffPicks(seed = 1, strike = false): NflPlayoffPicks {
  let picks: NflPlayoffPicks = {};
  for (let index = 0; index < 13; index++) {
    const game = nflPlayoffGames(picks).find((entry) => !picks[entry.id]);
    if (!game) break;
    const underdog = [...game.teams].sort((a, b) => b.seed - a.seed)[0];
    const choice = strike && game.id.includes(":wc:") && index < 5 ? underdog : game.teams[(seed + index * 7) % 2];
    picks = { ...picks, [game.id]: choice.id };
  }
  return picks;
}

export function nflBracketComplete(picks: NflPlayoffPicks): boolean {
  return Object.keys(sanitizeNflPlayoffPicks(picks)).length === 13 && !!picks["super-bowl"];
}

export function authorizeFoundryJdam(original: NflPlayoffPicks): { picks: NflPlayoffPicks; targets: string[]; changedCount: number } {
  const picks = generateNflPlayoffPicks(44, true);
  const changed = Object.keys(picks).filter((id) => original[id] !== picks[id]);
  return { picks, targets: [...changed.filter((id) => id.includes(":wc:")), ...changed].filter((id, index, all) => all.indexOf(id) === index).slice(0, 3), changedCount: changed.length };
}
