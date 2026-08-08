#!/usr/bin/env node

/**
 * Foundry season-analysis harness.
 *
 * Purpose:
 * - Run repeated, deterministic confidence-pick seasons without touching cloud data.
 * - Measure whether standings stay competitive without artificial rubber-banding.
 * - Surface suspiciously dominant bot strategies before we trust the live Foundry sims.
 *
 * This is intentionally offline/stateless. It does not import Supabase clients or write to LAB/production.
 * The default rubric mirrors War Room's 5-game confidence card: unique 1..5 confidence values,
 * zero points on a wrong pick, confidence points on a correct pick.
 */

import process from "node:process";

const DEFAULTS = {
  seasons: 20,
  weeks: 15,
  players: 24,
  gamesPerWeek: 5,
  seed: 20260808,
};

function argNumber(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  seasons: Math.max(1, Math.floor(argNumber("seasons", DEFAULTS.seasons))),
  weeks: Math.max(1, Math.floor(argNumber("weeks", DEFAULTS.weeks))),
  players: Math.max(4, Math.floor(argNumber("players", DEFAULTS.players))),
  gamesPerWeek: Math.max(2, Math.floor(argNumber("games", DEFAULTS.gamesPerWeek))),
  seed: Math.floor(argNumber("seed", DEFAULTS.seed)),
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function shuffle(xs, rng) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function percentile(xs, p) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const x = (s.length - 1) * p;
  const lo = Math.floor(x);
  const hi = Math.ceil(x);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (x - lo);
}

function summarize(xs) {
  return {
    avg: mean(xs),
    med: median(xs),
    min: Math.min(...xs),
    max: Math.max(...xs),
    p10: percentile(xs, 0.1),
    p90: percentile(xs, 0.9),
  };
}

const PERSONAS = [
  { key: "chalk", label: "Chalk", skill: 0.82, upsetBias: -0.10, confidenceNoise: 0.08 },
  { key: "sharp", label: "Sharp", skill: 0.88, upsetBias: 0.00, confidenceNoise: 0.05 },
  { key: "contrarian", label: "Contrarian", skill: 0.76, upsetBias: 0.15, confidenceNoise: 0.12 },
  { key: "volatile", label: "Volatile", skill: 0.72, upsetBias: 0.08, confidenceNoise: 0.22 },
  { key: "casual", label: "Casual", skill: 0.68, upsetBias: 0.00, confidenceNoise: 0.28 },
  { key: "homer", label: "Homer", skill: 0.70, upsetBias: 0.03, confidenceNoise: 0.25 },
];

function makePlayers(count) {
  return Array.from({ length: count }, (_, i) => {
    const persona = PERSONAS[i % PERSONAS.length];
    return {
      id: i,
      name: `${persona.label} ${Math.floor(i / PERSONAS.length) + 1}`,
      persona,
      total: 0,
      weekly: [],
    };
  });
}

function makeWeekGames(n, rng) {
  // favorite win probability, intentionally spanning tossups through strong favorites.
  return Array.from({ length: n }, (_, i) => {
    const favoriteWinProb = clamp(0.52 + rng() * 0.34, 0.52, 0.86);
    const favoriteWon = rng() < favoriteWinProb;
    return { id: i, favoriteWinProb, favoriteWon };
  });
}

function playerCard(player, games, rng) {
  const picks = games.map((g) => {
    // 'skill' controls how well player reads the underlying favorite probability.
    // upsetBias nudges toward dogs; noise produces believable human variation.
    const readNoise = (rng() - 0.5) * (1 - player.persona.skill) * 0.7;
    const perceivedFavorite = clamp(g.favoriteWinProb + readNoise - player.persona.upsetBias, 0.05, 0.95);
    const pickFavorite = rng() < perceivedFavorite;
    const confidenceSignal = Math.abs(perceivedFavorite - 0.5) + (rng() - 0.5) * player.persona.confidenceNoise;
    return { pickFavorite, confidenceSignal };
  });

  // Confidence rubric: unique values 1..N, strongest perceived edge gets highest confidence.
  const order = picks
    .map((p, i) => ({ i, s: p.confidenceSignal }))
    .sort((a, b) => a.s - b.s);
  order.forEach((x, rank) => {
    picks[x.i].confidence = rank + 1;
  });

  return picks;
}

function scoreCard(card, games) {
  let points = 0;
  for (let i = 0; i < card.length; i++) {
    const correct = card[i].pickFavorite === games[i].favoriteWon;
    if (correct) points += card[i].confidence;
  }
  return points;
}

function standings(players) {
  return [...players].sort((a, b) => b.total - a.total || a.id - b.id);
}

function tiedRows(table) {
  let tiedPlayers = 0;
  let tieGroups = 0;
  for (let i = 0; i < table.length; ) {
    let j = i + 1;
    while (j < table.length && table[j].total === table[i].total) j++;
    if (j - i > 1) {
      tieGroups++;
      tiedPlayers += j - i;
    }
    i = j;
  }
  return { tiedPlayers, tieGroups };
}

function cutIndex(playerCount) {
  // War Room's common shape advances top half; this gives us a consistent competitiveness probe.
  return Math.ceil(playerCount / 2) - 1;
}

function snapshot(players, week) {
  const t = standings(players);
  const scores = t.map((p) => p.total);
  const ci = cutIndex(t.length);
  const cutScore = t[ci].total;
  const firstOutScore = t[Math.min(ci + 1, t.length - 1)].total;
  const ties = tiedRows(t);
  const leader = t[0];
  return {
    week,
    top: t[0].total,
    second: t[1].total,
    median: median(scores),
    bottom: t[t.length - 1].total,
    topSecondGap: t[0].total - t[1].total,
    topMedianGap: t[0].total - median(scores),
    topBottomGap: t[0].total - t[t.length - 1].total,
    cutScore,
    cutGap: cutScore - firstOutScore,
    within5: t.filter((p) => Math.abs(p.total - cutScore) <= 5).length,
    within10: t.filter((p) => Math.abs(p.total - cutScore) <= 10).length,
    within15: t.filter((p) => Math.abs(p.total - cutScore) <= 15).length,
    tiedPlayers: ties.tiedPlayers,
    tieGroups: ties.tieGroups,
    leaderId: leader.id,
    leaderPersona: leader.persona.key,
  };
}

function runSeason(seasonIndex) {
  const rng = mulberry32(config.seed + seasonIndex * 7919);
  const players = makePlayers(config.players);
  const weeklySnapshots = [];
  let previousLeader = null;
  let leadChanges = 0;

  for (let week = 1; week <= config.weeks; week++) {
    const games = makeWeekGames(config.gamesPerWeek, rng);
    for (const player of players) {
      const card = playerCard(player, games, rng);
      const score = scoreCard(card, games);
      player.total += score;
      player.weekly.push(score);
    }
    const snap = snapshot(players, week);
    if (previousLeader != null && snap.leaderId !== previousLeader) leadChanges++;
    previousLeader = snap.leaderId;
    weeklySnapshots.push(snap);
  }

  const finalTable = standings(players);
  const final = weeklySnapshots.at(-1);
  const winner = finalTable[0];
  return {
    season: seasonIndex + 1,
    final,
    weeklySnapshots,
    leadChanges,
    winnerPersona: winner.persona.key,
    winnerName: winner.name,
    finalTable: finalTable.map((p, i) => ({ rank: i + 1, name: p.name, persona: p.persona.key, score: p.total })),
  };
}

const seasons = Array.from({ length: config.seasons }, (_, i) => runSeason(i));
const finals = seasons.map((s) => s.final);

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function printSummary(label, xs) {
  const s = summarize(xs);
  console.log(`${label.padEnd(28)} avg ${fmt(s.avg).padStart(6)} | med ${fmt(s.med).padStart(6)} | p10 ${fmt(s.p10).padStart(6)} | p90 ${fmt(s.p90).padStart(6)} | min ${fmt(s.min).padStart(4)} | max ${fmt(s.max).padStart(4)}`);
}

console.log("\nWAR ROOM · FOUNDRY SEASON ANALYSIS");
console.log("==================================");
console.log(`Seasons: ${config.seasons} · Weeks: ${config.weeks} · Players: ${config.players} · Games/week: ${config.gamesPerWeek} · Seed: ${config.seed}`);
console.log("Rubric: unique confidence 1..N; correct pick earns confidence points; wrong pick earns 0.\n");

printSummary("Champion / top score", finals.map((x) => x.top));
printSummary("Median score", finals.map((x) => x.median));
printSummary("Bottom score", finals.map((x) => x.bottom));
printSummary("1st → 2nd gap", finals.map((x) => x.topSecondGap));
printSummary("1st → median gap", finals.map((x) => x.topMedianGap));
printSummary("Top → bottom spread", finals.map((x) => x.topBottomGap));
printSummary("Cut-line gap", finals.map((x) => x.cutGap));
printSummary("Players ±5 of cut", finals.map((x) => x.within5));
printSummary("Players ±10 of cut", finals.map((x) => x.within10));
printSummary("Players ±15 of cut", finals.map((x) => x.within15));
printSummary("Tied players", finals.map((x) => x.tiedPlayers));
printSummary("Tie groups", finals.map((x) => x.tieGroups));
printSummary("Lead changes", seasons.map((x) => x.leadChanges));

const checkpoints = [...new Set([5, 9, Math.max(1, config.weeks - 2), config.weeks].filter((w) => w <= config.weeks))];
console.log("\nCOMPETITIVENESS CHECKPOINTS");
console.log("---------------------------");
for (const week of checkpoints) {
  const ss = seasons.map((s) => s.weeklySnapshots[week - 1]);
  console.log(`Week ${week}`);
  console.log(`  avg top→bottom: ${fmt(mean(ss.map((x) => x.topBottomGap)))} · avg cut gap: ${fmt(mean(ss.map((x) => x.cutGap)))} · avg ±10 of cut: ${fmt(mean(ss.map((x) => x.within10)))} · avg tied players: ${fmt(mean(ss.map((x) => x.tiedPlayers)))}`);
}

const winnerCounts = Object.fromEntries(PERSONAS.map((p) => [p.key, 0]));
for (const s of seasons) winnerCounts[s.winnerPersona]++;
console.log("\nWINNERS BY PERSONA");
console.log("-------------------");
for (const p of PERSONAS) {
  const wins = winnerCounts[p.key];
  console.log(`${p.label.padEnd(12)} ${String(wins).padStart(3)} / ${config.seasons} (${(wins / config.seasons * 100).toFixed(1)}%)`);
}

console.log("\nSEASON FINALS");
console.log("-------------");
for (const s of seasons) {
  console.log(`#${String(s.season).padStart(2, "0")} ${s.winnerName.padEnd(18)} top ${String(s.final.top).padStart(3)} · median ${fmt(s.final.median).padStart(5)} · bottom ${String(s.final.bottom).padStart(3)} · 1→2 ${String(s.final.topSecondGap).padStart(2)} · cut ${String(s.final.cutGap).padStart(2)} · ties ${String(s.final.tiedPlayers).padStart(2)} · lead changes ${String(s.leadChanges).padStart(2)}`);
}

const sharpShare = winnerCounts.sharp / config.seasons;
if (sharpShare > 0.35) {
  console.log("\n⚠️  Sharp persona wins >35% of seasons. Inspect bot advantage before trusting Foundry balance.");
}

console.log("\nTip: rerun with --seasons 100 or --seasons 500 after validating the first 20-season distribution.\n");
