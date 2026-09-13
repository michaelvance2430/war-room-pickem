import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import { PROP_PRESETS, propFromPreset, slateSizedPreset, matchPresetId } from '../src/lib/prop-presets';
import { settlePropFromScores } from '../src/lib/prop-settle';
const preset = (id: string) => PROP_PRESETS.find(p => p.id === id)!;
const games = (n: number) => Array.from({length:n}, (_,i) => ({id:String(i), home:'Home', away:'Away', favorite:'home' as const, spread:3.5}));
const boxes = (n: number, wins = 0) => Array.from({length:n}, (_,i) => ({gameId:String(i), homeScore:i<wins?24:10, awayScore:20, atsWinner:i<wins?'home' as const:'away' as const}));
for (let n=1;n<=30;n++) {
  for (const p of PROP_PRESETS) {
    const resolved = slateSizedPreset(p,n);
    assert(!/\bfive\b/i.test(resolved.question), `${p.id} has stale slate wording`);
    const prop = propFromPreset(p,1,n);
    assert.equal(slateSizedPreset(preset(matchPresetId({...prop,id:'database-prop'})),n).question,resolved.question);
    assert.equal(prop.question,resolved.question);
    if(p.settle === 'auto') assert.equal(settlePropFromScores({prop,games:games(n) as any,boxes:boxes(n)}).status,'settled',p.id);
  }
  const count=Math.ceil(n*3/5);
  const prop=propFromPreset(preset('tm-favorites-3-covers'),1,n);
  for(const successes of [count-1,count]) {
    const result=settlePropFromScores({prop,games:games(n) as any,boxes:boxes(n,successes)});
    assert.equal(result.propResult,prop.options[successes>=count?0:1]);
  }
}
const p=preset('tm-combined-280');
const old={id:`prop-${p.id}-w1`,question:p.question,options:p.options,points:p.points};
const sized=propFromPreset(p,1,21);
assert.equal(settlePropFromScores({prop:old,games:games(21) as any,boxes:boxes(21)}).propResult,old.options[0]);
assert.equal(settlePropFromScores({prop:sized,games:games(21) as any,boxes:boxes(21)}).propResult,sized.options[1]);
const oldCountPreset=preset('tm-favorites-3-covers');
const oldCount={id:'historical',question:oldCountPreset.question,options:oldCountPreset.options,points:oldCountPreset.points};
assert.equal(settlePropFromScores({prop:oldCount,games:games(21) as any,boxes:boxes(21,3)}).propResult,oldCount.options[0]);

const player=PROP_PRESETS.find(p=>p.question.includes('200 or more yards'))!;
assert(slateSizedPreset(player,21).question.includes('200 or more yards'));
// Exercise the exact production edge-function evaluator without starting its server or using credentials.
let source=readFileSync('supabase/functions/autonomous-football-results/index.ts','utf8');
source=source.replace(/^import .*;\n/gm,'').split('Deno.serve(')[0].replace(/export /g,'');
const js=ts.transpileModule(source+'\nglobalThis.grade=settleAutomaticProp;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const context:any={};vm.runInNewContext(js,context);
let fixtureJSON: string;
if (process.argv[2]) fixtureJSON = readFileSync(process.argv[2], 'utf8');
else {
  const temp = mkdtempSync(join(tmpdir(), 'warroom-props-'));
  try {
    const content = readFileSync('native-ios/WarRoom/ContentView.swift', 'utf8');
    const start = content.indexOf('private struct AutomaticPropPreset');
    const bankStart = content.indexOf('private let automaticFootballProps', start);
    const end = content.indexOf('\n]\n', bankStart) + 3;
    const bank = content.slice(start, end).replace(/private /g, '');
    const fieldhouse = readFileSync('native-ios/WarRoom/FieldhouseExperience.swift', 'utf8');
    const kindStart = fieldhouse.indexOf('enum FieldhousePropKind');
    const kind = fieldhouse.slice(kindStart, fieldhouse.indexOf('\n}\n', kindStart) + 3);
    writeFileSync(join(temp, 'Fixtures.swift'), 'import Foundation\n' + bank + '\n' + kind + `
struct Fixture: Codable { let size: Int; let question: String }
@main struct Generate {
 static func main() throws {
  var fixtures: [Fixture] = []
  for size in 1...30 {
   for prop in automaticFootballProps { fixtures.append(Fixture(size:size,question:prop.sized(size).question)) }
   for prop in FieldhousePropKind.allCases { fixtures.append(Fixture(size:size,question:prop.question(cardSize:size))) }
  }
  print(String(data:try JSONEncoder().encode(fixtures),encoding:.utf8)!)
 }
}
`);
    execFileSync('xcrun', ['swiftc', '-module-cache-path', join(temp, 'modules'), 'native-ios/WarRoom/AutomaticPropCopyPolicy.swift', join(temp, 'Fixtures.swift'), '-o', join(temp, 'fixtures')]);
    fixtureJSON = execFileSync(join(temp, 'fixtures'), {encoding:'utf8'});
  } finally { rmSync(temp, {recursive:true, force:true}); }
}
const nativeFixtures=JSON.parse(fixtureJSON);
for(const fixture of nativeFixtures) {
  const finals=boxes(fixture.size).map((b,i)=>({...games(fixture.size)[i],homeScore:b.homeScore,awayScore:b.awayScore,ats:b.atsWinner,home_team:'Home',away_team:'Away',is_rivalry:true}));
  assert.notEqual(context.grade(fixture.question,finals),null,fixture.question);
}
const unsupported = new Set<string>();
for (const n of [1,5,10,21,30]) {
 for (const p of PROP_PRESETS.filter(p=>p.settle === 'auto')) {
  const finals=boxes(n).map((b,i)=>({...games(n)[i],homeScore:b.homeScore,awayScore:b.awayScore,ats:b.atsWinner}));
  if(context.grade(propFromPreset(p,1,n).question,finals) === null) unsupported.add(p.id);
 }
}
assert.deepEqual([...unsupported], []);
for(const n of [1,4,5,10,21,30]) {
  const count=Math.ceil(n*3/5);
  for(const successes of [count-1,count]) {
    const finals=boxes(n,successes).map((b,i)=>({...games(n)[i],homeScore:b.homeScore,awayScore:b.awayScore,ats:b.atsWinner}));
    assert.equal(context.grade(`On this ${n}-game card, will at least ${count} favorites cover?`,finals),successes>=count);
  }
}
console.log(`PASS: ${PROP_PRESETS.length} web presets across 1–30 games; ${nativeFixtures.length} native/edge fixtures; count boundaries and historical totals`);
