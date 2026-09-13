const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const ts=require('typescript');
const source=fs.readFileSync('supabase/functions/football-odds/index.ts','utf8').replace(/^import .*;\n/gm,'');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
(async()=>{
for(const raw of [[],[{id:'game',commence_time:'2026-09-18T00:15:00Z',away_team:'Away',home_team:'Home',bookmakers:[]}],[{id:'game',commence_time:'2026-09-18T00:15:00Z',away_team:'Away',home_team:'Home',bookmakers:[{title:'Book',markets:[{key:'spreads',outcomes:[{name:'Home',point:-3.5},{name:'Away',point:3.5}]}]}]}]]){
let handler,logs=[];
const context={exports:{},Request,Response,URL,URLSearchParams,Date,Intl,Map,Set,console:{log:(...v)=>logs.push(v),error:()=>{}},normalizeTeam:v=>v.toLowerCase(),isFbsTeam:()=>true,Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://example.invalid':'test'},serve:fn=>handler=fn},fetch:async url=>{
const s=String(url);
if(s.includes('/memberships?'))return Response.json([{role:'commissioner',leagues:{sport_id:'nfl',commissioner_id:'user'}}]);
if(s.endsWith('/auth/v1/user'))return Response.json({id:'user'});
if(s.includes('/sport_card_windows?'))return Response.json([{window_starts_at:'2026-09-17T04:00:00Z',window_ends_at:'2026-09-22T04:00:00Z',first_game_at:'2026-09-18T00:15:00Z',display_label:'Week 2'}]);
return Response.json(raw,{headers:{'x-requests-remaining':'15000'}});
}};
vm.runInNewContext(compiled.outputText,context);
const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({leagueId:'league',sport:'nfl',week:2})}));
assert.equal(response.status,200);
const data=await response.json();assert.equal(data.games.length,raw[0]?.bookmakers.length?1:0);
assert.equal(logs.length,1);const details=JSON.parse(logs[0][1]);assert.equal(details.providerGames,raw.length);assert.equal(details.gamesWithSpreads,data.games.length);
assert(!JSON.stringify(logs).includes('Bearer'));
}
console.log('PASS: empty provider, missing spreads, valid spreads; response preserved and diagnostics verified');
})();
