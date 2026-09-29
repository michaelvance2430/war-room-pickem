import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const load=(path)=>{
 const source=readFileSync(path,'utf8').replace(/^import .*;\n/gm,'').replace(/export function/g,'function');
 const context={Date,Map,Set,Number,String,Math,JSON,Response,console,Deno:{serve:fn=>{context.handler=fn},env:{get:()=> 'test'}}};
 vm.createContext(context);vm.runInContext(stripTypeScriptTypes(source),context);return context;
};
const after=load(new URL('../supabase/functions/autonomous-football-results/index.ts',import.meta.url));
const game=i=>({id:`game-${i}`,home_team:`home-${i}`,away_team:`away-${i}`,favorite:'home',spread:3.5,start_time:new Date(Date.now()-86400000).toISOString()});
const card=(n,sport='nfl')=>({league_id:'test',week_number:2,leagues:{sport_id:sport},card_games:Array.from({length:n},(_,i)=>game(i)),prop_question:'Will any game be decided by 21 or more points?',prop_option_a:'Yes',prop_option_b:'No'});
for(const n of [5,9,16,30])assert.equal(after.isScheduleEligible(card(n)),true);
for(const n of [0,4,31])assert.equal(after.isScheduleEligible(card(n)),false);
const badDate=card(9);badDate.card_games[0].start_time='bad';assert.equal(after.isScheduleEligible(badDate),false);
for(const sport of ['cfb','ncaam','ncaaw'])for(const n of [4,5,9,10,11,30])assert.equal(after.isScheduleEligible(card(n,sport)),sport === 'cfb' ? n >= 5 && n <= 10 : n === 10);
async function run({missing=false,done=false}={}){
 const c=card(9);const events=c.card_games.map((g,i)=>({id:g.id,completed:!(missing&&i===8),homeTeam:g.home_team,awayTeam:g.away_team,scores:[{name:g.home_team,score:'28'},{name:g.away_team,score:'6'}]}));
 const calls=[];
 after.createClient=()=>({from:(table)=>{const value={data:table==='week_cards'?[c]:table==='week_results'?(done?[{league_id:'test',week_number:2}]:[]):{events}};const chain={select:()=>chain,order:()=>chain,limit:async()=>value,in:async()=>value,eq:()=>chain,maybeSingle:async()=>value};return chain;},rpc:async(name,args)=>{if(name==='claim_live_football_score_refresh')return {data:false};calls.push(args);return {data:{ok:true}};}});
 const response=await after.handler({method:'POST'});return {body:await response.json(),calls};
}
const scored=await run();assert.equal(scored.body.scored,1);assert.equal(scored.calls[0].p_results.length,9);assert.equal(scored.calls[0].p_prop_result,'Yes');assert.ok(scored.calls[0].p_results.every(g=>g.winner==='home'));
const waiting=await run({missing:true});assert.equal(waiting.body.scored,0);assert.equal(waiting.calls.length,0);assert.match(waiting.body.waiting[0],/finals-8/);
const done=await run({done:true});assert.equal(done.calls.length,0);assert.equal(done.body.scored,0);
console.log('PASS: valid NFL sizes, invalid sizes/dates, other sports unchanged; nine finals score once, eight finals wait, scored weeks skipped.');
