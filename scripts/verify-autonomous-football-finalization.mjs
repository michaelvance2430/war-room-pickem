import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const sourcePath = process.env.FINALIZER_SOURCE || new URL('../supabase/functions/autonomous-football-results/index.ts', import.meta.url);
const source = readFileSync(sourcePath, 'utf8').replace(/^import .*;\n/gm, '').replace(/export function/g, 'function');
const context = { Date, Map, Set, Number, String, Math, JSON, Response, console,
  Deno: { serve: fn => { context.handler = fn; }, env: { get: () => 'test' } } };
vm.createContext(context);
vm.runInContext(stripTypeScriptTypes(source), context);
const now = Date.now();
const game = i => ({ id: `game-${i}`, home_team: `home-${i}`, away_team: `away-${i}`, favorite: 'home', spread: 3.5, start_time: new Date(now - 86400000).toISOString() });
const card = (n, sport = 'cfb') => ({ league_id: 'test', week_number: 5, leagues: { sport_id: sport }, card_games: Array.from({ length: n }, (_, i) => game(i)), prop_question: 'Will any team score 60 or more points?', prop_option_a: 'Yes', prop_option_b: 'No' });

for (const sport of ['cfb', 'nfl']) {
  for (let n = 5; n <= 30; n++) assert.equal(context.isScheduleEligible(card(n, sport), now), true, `${sport}: ${n} games accepted`);
  for (const n of [0, 1, 4, 31]) assert.equal(context.isScheduleEligible(card(n, sport), now), false);
}
for (const sport of ['ncaam', 'ncaaw']) {
  for (const n of [4, 5, 9, 10, 11, 30]) assert.equal(context.isScheduleEligible(card(n, sport), now), n === 10);
}
for (const n of [3, 4, 5, 30]) assert.equal(context.isScheduleEligible({ ...card(n), card_kind: 'conference_championship' }, now), n === 4);
for (const start of [null, 'invalid', new Date(now - 11 * 86400000).toISOString(), new Date(now + 46 * 86400000).toISOString()]) {
  const c = card(30); c.card_games.forEach(g => { g.start_time = start; });
  assert.equal(context.isScheduleEligible(c, now), false);
}
const oneMissingDate = card(30); oneMissingDate.card_games[29].start_time = null;
assert.equal(context.isScheduleEligible(oneMissingDate, now), false);

async function run({ c = card(30), events, missing = false, done = false, high = false, error = false } = {}) {
  events ||= c.card_games.map((g, i) => ({ id: g.id, completed: !(missing && i === c.card_games.length - 1), homeTeam: g.home_team, awayTeam: g.away_team, scores: [{ name: g.home_team, score: high && i === 29 ? '60' : '28' }, { name: g.away_team, score: '6' }] }));
  const calls = [];
  context.createClient = () => ({
    from: table => {
      const value = { data: table === 'week_cards' ? [c] : table === 'week_results' ? (done ? [{ league_id: c.league_id, week_number: c.week_number }] : []) : { events } };
      const chain = { select: () => chain, order: () => chain, limit: async () => value, in: async () => value, eq: () => chain, maybeSingle: async () => value };
      return chain;
    },
    rpc: async (name, args) => {
      if (name === 'claim_live_football_score_refresh') return { data: false };
      assert.equal(name, 'score_league_week_atomic'); calls.push(args);
      return error ? { error: { message: 'test failure' } } : { data: { ok: true } };
    }
  });
  const response = await context.handler({ method: 'POST' });
  return { body: await response.json(), calls };
}

const scored = await run();
assert.equal(scored.body.scored, 1);
assert.equal(scored.calls[0].p_results.length, 30);
assert.equal(scored.calls[0].p_prop_result, 'No');
assert.ok(scored.calls[0].p_results.every(g => g.winner === 'home' && g.home_score === 28 && g.away_score === 6));
assert.equal((await run({ high: true })).calls[0].p_prop_result, 'Yes', 'game 30 must affect the prop');
for (const c of [card(5), card(10), card(9, 'nfl'), card(30, 'nfl')]) assert.equal((await run({ c })).body.scored, 1);
const waiting = await run({ missing: true });
assert.equal(waiting.calls.length, 0); assert.match(waiting.body.waiting[0], /finals-29/);
assert.equal((await run({ done: true })).calls.length, 0);
const unsupported = await run({ c: { ...card(30), prop_question: 'Unrecognized custom prop' } });
assert.equal(unsupported.calls.length, 0); assert.match(unsupported.body.waiting[0], /unsupported-prop/);
const failed = await run({ error: true });
assert.equal(failed.body.scored, 0); assert.match(failed.body.waiting[0], /score-error/);
const championship = await run({ c: { ...card(4), card_kind: 'conference_championship' } });
assert.equal(championship.calls[0].p_prop_result, null);

// Optional local-only production snapshot; never commit player data.
if (process.env.FINALIZER_EVIDENCE) {
  const evidence = JSON.parse(readFileSync(process.env.FINALIZER_EVIDENCE, 'utf8'));
  const actual = await run({ c: evidence.card, events: evidence.cache.events });
  assert.equal(actual.body.scored, 1);
  assert.equal(actual.calls[0].p_results.length, 30);
  assert.equal(actual.calls[0].p_prop_result, evidence.card.prop_option_b);
  console.log('PASS: actual Three and Out snapshot produces 30 results and the No prop. No live writes.');
}
console.log('PASS: CFB/NFL sizes 5–30, invalid sizes/dates, other sport rules, all-finals gate, prop boundaries, scored-week skip, RPC failure.');
