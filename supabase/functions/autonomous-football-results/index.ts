import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Game = { id:string; away_team:string; home_team:string; spread:number; favorite:"home"|"away"; start_time?:string|null; is_rivalry?:boolean|null };
type Score = { id:string; completed:boolean; homeTeam:string; awayTeam:string; commenceTime?:string|null; lastUpdate?:string|null; scores:{name:string;score:string}[] };
type Final = Game & { homeScore:number; awayScore:number; ats:"home"|"away"|"push" };
type CardRow = { league_id:string; week_number:number; card_kind?:"weekly"|"conference_championship"|null; prop_question?:string|null; prop_option_a?:string|null; prop_option_b?:string|null; leagues:{sport_id?:string|null}|{sport_id?:string|null}[]; card_games:Game[] };
type ScoredRow = { league_id:string; week_number:number };

const DAY_MS=86_400_000;
const SCORE_LOOKBACK_MS=10*DAY_MS;
const SCORE_LOOKAHEAD_MS=45*DAY_MS;
// One Fieldhouse league can legitimately have a live board and its next card
// open at the same time. Keep enough candidates for 100 active leagues across
// every supported sport without letting future cards crowd live cards out.
const MAX_CANDIDATE_CARDS=500;

const required=(name:string)=>{const value=Deno.env.get(name);if(!value)throw new Error(`Missing ${name}`);return value;};
const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
const normalizeScore=(event:any):Score=>({id:String(event?.id||""),completed:event?.completed===true,homeTeam:String(event?.homeTeam||event?.home_team||""),awayTeam:String(event?.awayTeam||event?.away_team||""),commenceTime:event?.commenceTime||event?.commence_time||null,lastUpdate:event?.lastUpdate||event?.last_update||null,scores:Array.isArray(event?.scores)?event.scores.map((row:any)=>({name:String(row?.name||""),score:String(row?.score??"")})):[]});
const mergeWeeklyScores=(cached:any[],fresh:Score[])=>{const cutoff=Date.now()-10*86400000;const retained=cached.map(normalizeScore).filter((event)=>{if(!event.id||!event.completed)return false;const timestamp=Date.parse(event.commenceTime||event.lastUpdate||"");return !Number.isFinite(timestamp)||timestamp>=cutoff;});const merged=new Map(retained.map((event)=>[event.id,event]));fresh.forEach((event)=>{if(event.id)merged.set(event.id,event);});return [...merged.values()];};
const score=(event:Score,team:string)=>Number(event.scores.find((row)=>norm(row.name)===norm(team))?.score);
const total=(game:Final)=>game.homeScore+game.awayScore;
const margin=(game:Final)=>Math.abs(game.homeScore-game.awayScore);
const dog=(game:Final)=>game.ats!=="push"&&game.ats!==game.favorite;
const fav=(game:Final)=>game.ats!=="push"&&game.ats===game.favorite;
const homeWon=(game:Final)=>game.homeScore>game.awayScore;
const awayWon=(game:Final)=>game.awayScore>game.homeScore;
const homeDog=(game:Final)=>game.favorite==="away";
const awayDog=(game:Final)=>game.favorite==="home";
const numericHeader=(value:string|null)=>value==null||value===""?null:Number(value);
const sportForCard=(card:CardRow)=>{const relation=Array.isArray(card.leagues)?card.leagues[0]:card.leagues;const sport=String(relation?.sport_id||"cfb").toLowerCase();return ["ncaam","ncaaw"].includes(sport)?sport:(sport==="nfl"?"nfl":"cfb");};
const cardSize=(card:CardRow)=>card.card_kind==="conference_championship"?4:(["ncaam","ncaaw"].includes(sportForCard(card))?10:5);
const providerSportKey=(sport:string)=>sport==="nfl"?"americanfootball_nfl":sport==="ncaam"?"basketball_ncaab":sport==="ncaaw"?"basketball_wncaab":"americanfootball_ncaaf";

export function isScheduleEligible(card:CardRow,now=Date.now()):boolean{
  const starts=(card.card_games||[]).map((game)=>Date.parse(game.start_time||"")).filter(Number.isFinite);
  if(starts.length!==cardSize(card))return false;
  return Math.max(...starts)>=now-SCORE_LOOKBACK_MS&&Math.min(...starts)<=now+SCORE_LOOKAHEAD_MS;
}

export function scoreRefreshPlan(cards:CardRow[],now=Date.now()):{minAgeSeconds:number;daysFrom:number}|null{
  const starts=cards.flatMap((card)=>card.card_games||[]).map((game)=>Date.parse(game.start_time||"")).filter(Number.isFinite);
  if(!starts.length)return null;
  const liveWindow=starts.some((start)=>now>=start-5*60_000&&now<=start+6*60*60_000);
  // Keep autonomous scoring near-live without paying for a provider request
  // every cron minute. All leagues for a sport share this cache claim.
  if(liveWindow)return {minAgeSeconds:300,daysFrom:1};
  const last=Math.max(...starts);
  if(now<=last+6*60*60_000)return null;
  if(now<=last+3*86_400_000)return {minAgeSeconds:15*60,daysFrom:3};
  return {minAgeSeconds:6*60*60,daysFrom:3};
}

export function settleAutomaticProp(question:string,finals:Final[]):boolean|null{
  const q=norm(question);if(![5,10].includes(finals.length))return null;
  if(q.includes("any team score 90 or more"))return finals.some((g)=>g.homeScore>=90||g.awayScore>=90);
  if(q.includes("any game finish within 3 points"))return finals.some((g)=>margin(g)<=3);
  if(q.includes("any underdog win outright"))return finals.some((g)=>(homeDog(g)&&homeWon(g))||(awayDog(g)&&awayWon(g)));
  if(q.includes("any game reach 150 combined points"))return finals.some((g)=>total(g)>=150);
  if(q.includes("any team score 100 or more"))return finals.some((g)=>g.homeScore>=100||g.awayScore>=100);
  if(q.includes("both teams score 75 or more in any game"))return finals.some((g)=>g.homeScore>=75&&g.awayScore>=75);
  if(q.includes("any game finish with a 20 point margin"))return finals.some((g)=>margin(g)>=20);
  if(q.includes("at least three underdogs win outright"))return finals.filter((g)=>(homeDog(g)&&homeWon(g))||(awayDog(g)&&awayWon(g))).length>=3;
  if(q.includes("at least six favorites cover the spread"))return finals.filter(fav).length>=6;
  if(q.includes("every game reach 130 combined points"))return finals.every((g)=>total(g)>=130);
  if(q.includes("at least 3")&&q.includes("decided by 7 or fewer"))return finals.filter((g)=>margin(g)>=1&&margin(g)<=7).length>=3;
  if(q.includes("at least 3")&&q.includes("decided by 3 or fewer"))return finals.filter((g)=>margin(g)>=1&&margin(g)<=3).length>=3;
  if(q.includes("underdog")&&q.includes("cover")&&!q.includes("every underdog")&&!q.includes("14 or more"))return finals.some(dog);
  if(q.includes("favorites cover")&&q.includes("at least 3"))return finals.filter(fav).length>=3;
  if(q.includes("combined score of 56 or more"))return finals.some((g)=>total(g)>=56);
  if(q.includes("combined score of 40 or fewer"))return finals.some((g)=>total(g)<=40);
  if(q.includes("highest combined final score")&&q.includes("61 or more"))return Math.max(...finals.map(total))>=61;
  if(q.includes("sum of")&&q.includes("five")&&q.includes("combined final scores")&&q.includes("281 or more"))return finals.reduce((sum,g)=>sum+total(g),0)>=281;
  if(q.includes("decided by 21 or more"))return finals.some((g)=>margin(g)>=21);
  if(q.includes("finish with 9 or fewer"))return finals.some((g)=>g.homeScore<=9||g.awayScore<=9);
  if(q.includes("finish with 46 or more"))return finals.some((g)=>g.homeScore>=46||g.awayScore>=46);
  if((q.includes("both teams scoring at least 25")||q.includes("both home and away scoring 25 or more")))return finals.some((g)=>g.homeScore>=25&&g.awayScore>=25);
  if(q.includes("favorite cover all five"))return finals.every(fav);
  if(q.includes("every underdog cover all five"))return finals.every(dog);
  if(q.includes("exactly 0 points"))return finals.some((g)=>g.homeScore===0||g.awayScore===0);
  if(q.includes("score 50 or more"))return finals.some((g)=>g.homeScore>=50||g.awayScore>=50);
  if(q.includes("equal home and away scores"))return finals.some((g)=>g.homeScore===g.awayScore);
  if(q.includes("sum of")&&q.includes("five combined final scores")&&q.includes("200 or fewer"))return finals.reduce((sum,g)=>sum+total(g),0)<=200;
  if(q.includes("home team win all five"))return finals.every(homeWon);
  if(q.includes("away team win all five"))return finals.every(awayWon);
  if(q.includes("combined score of 71 or more"))return finals.some((g)=>total(g)>=71);
  if(q.includes("finish with 56 or more"))return finals.some((g)=>g.homeScore>=56||g.awayScore>=56);
  if(q.includes("decided by 35 or more"))return finals.some((g)=>margin(g)>=35);
  if((q.includes("both teams scoring at least 30")||q.includes("both home and away scoring 30 or more")))return finals.some((g)=>g.homeScore>=30&&g.awayScore>=30);
  if(q.includes("score 60 or more"))return finals.some((g)=>g.homeScore>=60||g.awayScore>=60);
  if(q.includes("underdog listed at 14 or more cover"))return finals.some((g)=>Math.abs(Number(g.spread))>=14&&dog(g));
  if(q.includes("at least 2 home underdogs win"))return finals.filter((g)=>homeDog(g)&&homeWon(g)).length>=2;
  if(q.includes("at least 2 rivalry underdogs win"))return finals.filter((g)=>g.is_rivalry&&((homeDog(g)&&homeWon(g))||(awayDog(g)&&awayWon(g)))).length>=2;
  if(q.includes("designated rivalry game be decided by 3"))return finals.some((g)=>g.is_rivalry&&margin(g)<=3);
  if(q.includes("combined score of 35 or fewer"))return finals.some((g)=>total(g)<=35);
  if(q.includes("finish with 13 or fewer"))return finals.some((g)=>g.homeScore<=13||g.awayScore<=13);
  if(q.includes("combined score of 51 or more"))return finals.some((g)=>total(g)>=51);
  if(q.includes("decided by 14 or more"))return finals.some((g)=>margin(g)>=14);
  if(q.includes("finish with exactly 3"))return finals.some((g)=>g.homeScore===3||g.awayScore===3);
  if(q.includes("finish with exactly 17"))return finals.some((g)=>g.homeScore===17||g.awayScore===17);
  if(q.includes("at least 2 underdogs win straight up"))return finals.filter((g)=>(homeDog(g)&&homeWon(g))||(awayDog(g)&&awayWon(g))).length>=2;
  return null;
}

function ats(game:Game,home:number,away:number):"home"|"away"|"push"{
  const favoriteMargin=game.favorite==="home"?home-away:away-home;
  const line=Math.abs(Number(game.spread));
  if(Math.abs(favoriteMargin-line)<0.0001)return "push";
  if(favoriteMargin>line)return game.favorite;
  return game.favorite==="home"?"away":"home";
}

Deno.serve(async(request:Request)=>{
  if(request.method!=="POST")return new Response("Method not allowed",{status:405});
  try{
    const db=createClient(required("SUPABASE_URL"),required("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:cards,error}=await db.from("week_cards").select("id,league_id,week_number,card_kind,prop_question,prop_option_a,prop_option_b,published_at,leagues!inner(sport_id),card_games(id,away_team,home_team,spread,favorite,start_time,is_rivalry,fieldhouse_conference)").order("published_at",{ascending:false}).limit(MAX_CANDIDATE_CARDS);
    if(error)throw error;
    const cardRows=((cards||[]) as CardRow[]).filter((card)=>isScheduleEligible(card));
    const leagueIds=[...new Set(cardRows.map((card:CardRow)=>card.league_id))];
    const {data:scored}=leagueIds.length?await db.from("week_results").select("league_id,week_number").in("league_id",leagueIds):{data:[]};
    const done=new Set(((scored||[]) as ScoredRow[]).map((row:ScoredRow)=>`${row.league_id}:${row.week_number}`));
    const pending=cardRows.filter((card:CardRow)=>!done.has(`${card.league_id}:${card.week_number}`));
    const feeds=new Map<string,Score[]>();let scoredCount=0;const waiting:string[]=[];
    const cardsBySport=new Map<string,CardRow[]>();
    for(const card of pending){const sport=sportForCard(card);cardsBySport.set(sport,[...(cardsBySport.get(sport)||[]),card]);}
    for(const [sport,sportCards] of cardsBySport){
      const {data:cache}=await db.from("live_football_score_cache").select("events").eq("sport",sport).maybeSingle();
      const cachedEvents=Array.isArray(cache?.events)?cache.events:[];
      const plan=scoreRefreshPlan(sportCards);
      if(!plan){feeds.set(sport,cachedEvents.map(normalizeScore));continue;}
      const {data:claimed}=await db.rpc("claim_live_football_score_refresh",{p_sport:sport,p_min_age_seconds:plan.minAgeSeconds});
      if(!claimed){feeds.set(sport,cachedEvents.map(normalizeScore));continue;}
      const sportKey=providerSportKey(sport);
      const url=new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/scores`);
      url.searchParams.set("apiKey",required("ODDS_API_KEY"));url.searchParams.set("daysFrom",String(plan.daysFrom));url.searchParams.set("dateFormat","iso");
      const response=await fetch(url);const remaining=numericHeader(response.headers.get("x-requests-remaining")),used=numericHeader(response.headers.get("x-requests-used")),last=numericHeader(response.headers.get("x-requests-last"));
      await db.from("platform_odds_api_usage").insert({league_id:null,user_id:null,sport,action:"score_sync",endpoint:"/scores/autonomous",provider_remaining:remaining,provider_used:used,provider_last_cost:last,estimated_credit_cost:last??1,success:response.ok,http_status:response.status,error_code:response.ok?null:`Scores provider ${sport} returned ${response.status}`,duration_ms:0,dry_run:false});
      if(!response.ok)throw new Error(`Scores provider ${sport} returned ${response.status}`);
      const raw=await response.json();const fresh=(Array.isArray(raw)?raw:[]).map(normalizeScore);const events=mergeWeeklyScores(cachedEvents,fresh);feeds.set(sport,events);
      await db.from("live_football_score_cache").update({events,fetched_at:new Date().toISOString(),provider_remaining:remaining,provider_used:used,provider_last_cost:last,last_http_status:response.status,last_error:null}).eq("sport",sport);
    }
    for(const card of pending){
      const sport=sportForCard(card);
      const expected=cardSize(card);
      const games=(card.card_games||[]) as Game[];if(games.length!==expected){waiting.push(`${card.league_id}:${card.week_number}:invalid-card`);continue;}
      const finals:Final[]=[];
      for(const game of games){
        const event=feeds.get(sport)?.find((row)=>norm(row.homeTeam)===norm(game.home_team)&&norm(row.awayTeam)===norm(game.away_team));
        if(!event?.completed)continue;
        const home=score(event,game.home_team),away=score(event,game.away_team);if(!Number.isFinite(home)||!Number.isFinite(away))continue;
        finals.push({...game,homeScore:home,awayScore:away,ats:ats(game,home,away)});
      }
      if(finals.length!==expected){waiting.push(`${card.league_id}:${card.week_number}:finals-${finals.length}`);continue;}
      const championship=card.card_kind==="conference_championship";
      const yes=championship?null:settleAutomaticProp(card.prop_question||"",finals);if(!championship&&yes==null){waiting.push(`${card.league_id}:${card.week_number}:unsupported-prop`);continue;}
      const {data:receipt,error:scoreError}=await db.rpc("score_league_week_atomic",{p_league_id:card.league_id,p_week_number:card.week_number,p_results:finals.map((game)=>({game_id:game.id,winner:championship?(game.homeScore>game.awayScore?"home":"away"):game.ats,away_score:game.awayScore,home_score:game.homeScore})),p_prop_result:championship?null:(yes?card.prop_option_a:card.prop_option_b)});
      if(scoreError||!receipt?.ok){waiting.push(`${card.league_id}:${card.week_number}:score-error:${scoreError?.message||"no-receipt"}`);continue;}scoredCount+=1;
    }
    return Response.json({ok:true,inspected:pending.length,scored:scoredCount,waiting});
  }catch(error){const message=error instanceof Error?error.message:JSON.stringify(error);console.error(message);return Response.json({ok:false,error:message||"Autonomous scoring failed"},{status:500});}
});
