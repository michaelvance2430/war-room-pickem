#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const FIELDHOUSE_REGIONS = ["East", "West", "South", "Midwest"];
export const REGION_SEED_PAIRS = [[1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]];
export const ROUND_COUNTS = { opening: 12, r64: 32, r32: 16, s16: 8, e8: 4, ff: 2, title: 1 };

const roundOrder = { opening: 0, r64: 1, r32: 2, s16: 3, e8: 4, ff: 5, title: 6 };
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fail = (message) => { throw new Error(message); };

function normalizedRegions(input) {
  if (Array.isArray(input.regions)) return input.regions;
  if (input.regions && typeof input.regions === "object") {
    return FIELDHOUSE_REGIONS.map((name) => ({ name, slots: input.regions[name] }));
  }
  return fail("Input must contain four regions.");
}

function normalizedTeam(raw, region, seed, label) {
  if (!raw || typeof raw !== "object") fail(`${label} requires a team object.`);
  const id = String(raw.id || "").trim();
  const name = String(raw.name || "").trim();
  if (!id || !name) fail(`${label} requires non-empty team id and name.`);
  return { id, name, region, seed };
}

function optionalISO(value, label) {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) fail(`${label} must be an ISO-8601 timestamp.`);
  return date.toISOString();
}

function makeGame({ id, round, ordinal, region = null, first, second, gameTimes, oddsEventIds }) {
  const result = {
    id,
    round,
    ordinal,
    region,
    firstTeamId: first.teamId ?? null,
    secondTeamId: second.teamId ?? null,
    firstSourceGameId: first.sourceGameId ?? null,
    secondSourceGameId: second.sourceGameId ?? null,
    oddsEventId: oddsEventIds[id] ? String(oddsEventIds[id]) : null,
    startsAt: optionalISO(gameTimes[id], `gameTimes.${id}`),
  };
  if ((result.firstTeamId == null) === (result.firstSourceGameId == null)) fail(`${id} needs one first participant source.`);
  if ((result.secondTeamId == null) === (result.secondSourceGameId == null)) fail(`${id} needs one second participant source.`);
  return result;
}

export function generateOfficialField(input, { publishReady = false } = {}) {
  if (!input || typeof input !== "object") fail("Field input must be one JSON object.");
  const sportId = String(input.sportId || "").toLowerCase();
  if (!['ncaam', 'ncaaw'].includes(sportId)) fail("sportId must be ncaam or ncaaw.");
  const seasonKey = Number(input.seasonKey);
  if (!Number.isInteger(seasonKey) || seasonKey < 2026 || seasonKey > 2200) fail("seasonKey is invalid.");
  const gameTimes = input.gameTimes && typeof input.gameTimes === "object" ? input.gameTimes : {};
  const oddsEventIds = input.oddsEventIds && typeof input.oddsEventIds === "object" ? input.oddsEventIds : {};
  const regionInputs = normalizedRegions(input);
  const names = regionInputs.map((region) => region?.name);
  if (names.length !== 4 || new Set(names).size !== 4 || FIELDHOUSE_REGIONS.some((name) => !names.includes(name))) {
    fail(`Regions must be exactly: ${FIELDHOUSE_REGIONS.join(", ")}.`);
  }

  const teams = [];
  const slotsByRegion = new Map();
  let openingSlotCount = 0;
  for (const regionName of FIELDHOUSE_REGIONS) {
    const region = regionInputs.find((value) => value.name === regionName);
    if (!Array.isArray(region?.slots) || region.slots.length !== 16) fail(`${regionName} must contain 16 seed slots.`);
    const slots = new Map();
    for (const rawSlot of region.slots) {
      const seed = Number(rawSlot?.seed);
      if (!Number.isInteger(seed) || seed < 1 || seed > 16 || slots.has(seed)) fail(`${regionName} must contain each seed 1 through 16 exactly once.`);
      const hasTeam = rawSlot.team != null;
      const hasOpening = rawSlot.opening != null;
      if (hasTeam === hasOpening) fail(`${regionName} seed ${seed} needs either team or opening, never both.`);
      if (hasTeam) {
        const team = normalizedTeam(rawSlot.team, regionName, seed, `${regionName} seed ${seed}`);
        teams.push(team);
        slots.set(seed, { seed, team });
      } else {
        if (!Array.isArray(rawSlot.opening) || rawSlot.opening.length !== 2) fail(`${regionName} seed ${seed} Opening Round slot requires two teams.`);
        const opening = rawSlot.opening.map((team, index) => normalizedTeam(team, regionName, seed, `${regionName} seed ${seed} opening team ${index + 1}`));
        teams.push(...opening);
        slots.set(seed, { seed, opening });
        openingSlotCount += 1;
      }
    }
    if (slots.size !== 16) fail(`${regionName} must contain each seed 1 through 16 exactly once.`);
    slotsByRegion.set(regionName, slots);
  }
  if (openingSlotCount !== 12) fail(`A 76-team field requires exactly 12 Opening Round slots; found ${openingSlotCount}.`);
  if (teams.length !== 76) fail(`A 76-team field requires exactly 76 teams; found ${teams.length}.`);
  const teamIDs = teams.map((team) => team.id);
  if (new Set(teamIDs).size !== teamIDs.length) fail("Every team id must be globally unique.");
  const normalizedTeamNames = teams.map((team) => team.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
  if (new Set(normalizedTeamNames).size !== normalizedTeamNames.length) fail("Every team name must be globally unique.");

  const games = [];
  const openingFeed = new Map();
  for (const regionName of FIELDHOUSE_REGIONS) {
    const regionSlug = slug(regionName);
    const slots = slotsByRegion.get(regionName);
    for (const seed of [...slots.keys()].sort((a, b) => a - b)) {
      const slot = slots.get(seed);
      if (!slot.opening) continue;
      const id = `${regionSlug}.opening.${seed}`;
      games.push(makeGame({
        id, round: "opening", ordinal: games.length, region: regionName,
        first: { teamId: slot.opening[0].id }, second: { teamId: slot.opening[1].id }, gameTimes, oddsEventIds,
      }));
      openingFeed.set(`${regionName}:${seed}`, id);
    }
  }

  const regionalRoundGames = new Map();
  let r64Ordinal = 0;
  for (const regionName of FIELDHOUSE_REGIONS) {
    const regionSlug = slug(regionName);
    const slots = slotsByRegion.get(regionName);
    const r64 = REGION_SEED_PAIRS.map(([firstSeed, secondSeed], index) => {
      const participant = (seed) => {
        const slot = slots.get(seed);
        return slot.team ? { teamId: slot.team.id } : { sourceGameId: openingFeed.get(`${regionName}:${seed}`) };
      };
      const id = `${regionSlug}.r64.${index + 1}`;
      games.push(makeGame({ id, round: "r64", ordinal: r64Ordinal++, region: regionName, first: participant(firstSeed), second: participant(secondSeed), gameTimes, oddsEventIds }));
      return id;
    });
    const r32 = makeSourceRound(regionName, regionSlug, "r32", r64, games, gameTimes, oddsEventIds);
    const s16 = makeSourceRound(regionName, regionSlug, "s16", r32, games, gameTimes, oddsEventIds);
    const e8 = makeSourceRound(regionName, regionSlug, "e8", s16, games, gameTimes, oddsEventIds);
    regionalRoundGames.set(regionName, e8[0]);
  }

  const finalFourPairs = [["East", "West"], ["South", "Midwest"]];
  const finalFour = finalFourPairs.map(([firstRegion, secondRegion], index) => {
    const id = `national.ff.${index + 1}`;
    games.push(makeGame({
      id, round: "ff", ordinal: index,
      first: { sourceGameId: regionalRoundGames.get(firstRegion) },
      second: { sourceGameId: regionalRoundGames.get(secondRegion) }, gameTimes, oddsEventIds,
    }));
    return id;
  });
  games.push(makeGame({
    id: "national.title.1", round: "title", ordinal: 0,
    first: { sourceGameId: finalFour[0] }, second: { sourceGameId: finalFour[1] }, gameTimes, oddsEventIds,
  }));

  validateGeneratedField({ teams, games });
  if (publishReady) {
    const placeholders = teams.filter((team) => /^replace\b/i.test(team.name) || /^replace\b/i.test(team.id));
    if (placeholders.length) fail(`Publish-ready field still contains ${placeholders.length} placeholder teams.`);
    const firstWeekend = games.filter((game) => game.round === "opening" || game.round === "r64");
    const missingTimes = firstWeekend.filter((game) => !game.startsAt).map((game) => game.id);
    if (missingTimes.length) fail(`Publish-ready field is missing ${missingTimes.length} Opening/First Round tip times: ${missingTimes.join(", ")}`);
  }
  return { sportId, seasonKey, teams, games };
}

function makeSourceRound(regionName, regionSlug, round, prior, games, gameTimes, oddsEventIds) {
  const created = [];
  for (let index = 0; index < prior.length; index += 2) {
    const id = `${regionSlug}.${round}.${index / 2 + 1}`;
    const ordinal = games.filter((game) => game.round === round).length;
    games.push(makeGame({
      id, round, ordinal, region: regionName,
      first: { sourceGameId: prior[index] }, second: { sourceGameId: prior[index + 1] }, gameTimes, oddsEventIds,
    }));
    created.push(id);
  }
  return created;
}

export function validateGeneratedField(field) {
  if (field.teams.length !== 76 || field.games.length !== 75) fail("Generated field must contain 76 teams and 75 games.");
  const gameIDs = field.games.map((game) => game.id);
  if (new Set(gameIDs).size !== gameIDs.length) fail("Generated game ids must be unique.");
  for (const [round, expected] of Object.entries(ROUND_COUNTS)) {
    const actual = field.games.filter((game) => game.round === round).length;
    if (actual !== expected) fail(`${round} requires ${expected} games; found ${actual}.`);
  }
  const gameByID = new Map(field.games.map((game) => [game.id, game]));
  const sourceUsage = new Map();
  for (const game of field.games) {
    for (const source of [game.firstSourceGameId, game.secondSourceGameId].filter(Boolean)) {
      const prior = gameByID.get(source);
      if (!prior || roundOrder[prior.round] !== roundOrder[game.round] - 1) fail(`${game.id} has invalid source ${source}.`);
      if (["r32", "s16", "e8"].includes(game.round) && prior.region !== game.region) fail(`${game.id} crosses regional paths before the Final Four.`);
      sourceUsage.set(source, (sourceUsage.get(source) || 0) + 1);
    }
  }
  for (const game of field.games) {
    const expected = game.round === "title" ? 0 : 1;
    if ((sourceUsage.get(game.id) || 0) !== expected) fail(`${game.id} must feed exactly ${expected} next-round game.`);
  }
  for (const region of FIELDHOUSE_REGIONS) {
    const regional = field.games.filter((game) => game.round === "r64" && game.region === region);
    if (regional.length !== 8) fail(`${region} requires eight First Round games.`);
  }
  const leafUsage = new Map();
  for (const game of field.games.filter((value) => value.round === "opening" || value.round === "r64")) {
    for (const id of [game.firstTeamId, game.secondTeamId].filter(Boolean)) leafUsage.set(id, (leafUsage.get(id) || 0) + 1);
  }
  const invalidUsage = field.teams.filter((team) => leafUsage.get(team.id) !== 1);
  if (invalidUsage.length) fail(`Each team must enter exactly one leaf path: ${invalidUsage.map((team) => team.id).join(", ")}`);
  return true;
}

export function makeScaffold(sportId = "ncaam", seasonKey = 2027) {
  const openingSeeds = {
    East: new Set([11, 12, 15, 16]),
    West: new Set([11, 12, 16]),
    South: new Set([11, 12, 16]),
    Midwest: new Set([11, 16]),
  };
  const regions = FIELDHOUSE_REGIONS.map((name) => ({
    name,
    slots: Array.from({ length: 16 }, (_, index) => {
      const seed = index + 1;
      const base = `${slug(name)}-${seed}`;
      if (openingSeeds[name].has(seed)) {
        return { seed, opening: [
          { id: `${base}-a`, name: `REPLACE ${name} ${seed}A` },
          { id: `${base}-b`, name: `REPLACE ${name} ${seed}B` },
        ] };
      }
      return { seed, team: { id: base, name: `REPLACE ${name} ${seed}` } };
    }),
  }));
  return { sportId, seasonKey, regions, gameTimes: {}, oddsEventIds: {} };
}

function runCLI(argv) {
  if (argv[0] === "--scaffold") {
    const [, sportId = "ncaam", season = "2027", output] = argv;
    if (!output) fail("Usage: --scaffold <ncaam|ncaaw> <season> <output.json>");
    writeFileSync(output, `${JSON.stringify(makeScaffold(sportId, Number(season)), null, 2)}\n`);
    console.log(`Wrote Selection Sunday scaffold to ${output}`);
    return;
  }
  const [inputPath, outputPath, ...flags] = argv;
  if (!inputPath || !outputPath) fail("Usage: <input.json> <output.json> [--publish-ready]");
  const input = JSON.parse(readFileSync(inputPath, "utf8"));
  const field = generateOfficialField(input, { publishReady: flags.includes("--publish-ready") });
  writeFileSync(outputPath, `${JSON.stringify(field, null, 2)}\n`);
  console.log(`Validated ${field.teams.length} teams and ${field.games.length} games; wrote ${outputPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { runCLI(process.argv.slice(2)); }
  catch (error) { console.error(`Fieldhouse field error: ${error.message}`); process.exitCode = 1; }
}
