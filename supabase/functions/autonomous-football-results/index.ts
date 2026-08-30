import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Game = { id:string; away_team:string; home_team:string; spread:number; favorite:"home"|"away"; is_rivalry?:boolean|null };
type Score = { id:string; completed:boolean; home_team:string; away_team:string; scores?:{name:string;score:string}[] };
type Final = Game & { homeScore:number; awayScore:number; ats:"home"|"away"|"push" };
type CardRow = { league_id:string; week_number:number; prop_question?:string|null; prop_option_a:string; prop_option_b:string; leagues:{sport_id?:string|null}|{sport_id?:string|null}[]; card_games:Game[] };
type ScoredRow = { league_id:string; week_number:number };

const required=(name:string)=>{const value=Deno.env.get(name);if(!value)throw new Error(`Missing ${name}`);return value;};
const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
const score=(event:Score,team:string)=>Number(event.scores?.find((row)=>norm(row.name)===norm(team))?.score);
const total=(game:Final)=>game.homeScore+game.awayScore;
const margin=(game:Final)=>Math.abs(game.homeScore-game.awayScore);
const dog=(game:Final)=>game.ats!=="push"&&game.ats!==game.favorite;
const fav=(game:Final)=>game.ats!=="push"&&game.ats===game.favorite;
const homeWon=(game:Final)=>game.homeScore>game.awayScore;
const awayWon=(game:Final)=>game.awayScore>game.homeScore;
const homeDog=(game:Final)=>game.favorite==="away";
const awayDog=(game:Final)=>game.favorite==="home";

export function settleAutomaticProp(question:string,finals:Final[]):boolean|null{
  const q=norm(question);if(finals.length!==5)return null;
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
    const cutoff=new Date(Date.now()-10*86400000).toISOString();
    const {data:cards,error}=await db.from("week_cards").select("id,league_id,week_number,prop_question,prop_option_a,prop_option_b,published_at,leagues!inner(sport_id),card_games(id,away_team,home_team,spread,favorite,start_time,is_rivalry)").gte("published_at",cutoff).order("published_at").limit(100);
    if(error)throw error;
    const cardRows=(cards||[]) as CardRow[];
    const leagueIds=[...new Set(cardRows.map((card:CardRow)=>card.league_id))];
    const {data:scored}=leagueIds.length?await db.from("week_results").select("league_id,week_number").in("league_id",leagueIds):{data:[]};
    const done=new Set(((scored||[]) as ScoredRow[]).map((row:ScoredRow)=>`${row.league_id}:${row.week_number}`));
    const pending=cardRows.filter((card:CardRow)=>!done.has(`${card.league_id}:${card.week_number}`));
    const feeds=new Map<string,Score[]>();let scoredCount=0;const waiting:string[]=[];
    for(const card of pending){
      const relation=Array.isArray(card.leagues)?card.leagues[0]:card.leagues;
      const sport=relation?.sport_id==="nfl"?"nfl":"cfb";
      if(!feeds.has(sport)){
        const {data:claimed}=await db.rpc("claim_live_football_score_refresh",{p_sport:sport,p_min_age_seconds:50});
        if(!claimed){
          const {data:cache}=await db.from("live_football_score_cache").select("events").eq("sport",sport).maybeSingle();
          feeds.set(sport,(cache?.events||[]) as Score[]);
        }else{
          const sportKey=sport==="nfl"?"americanfootball_nfl":"americanfootball_ncaaf";
          const url=new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/scores`);
          url.searchParams.set("apiKey",required("ODDS_API_KEY"));url.searchParams.set("daysFrom","3");url.searchParams.set("dateFormat","iso");
          const response=await fetch(url);if(!response.ok)throw new Error(`Scores provider ${sport} returned ${response.status}`);
          const events=(await response.json()) as Score[];feeds.set(sport,events);
          await db.from("live_football_score_cache").update({events,fetched_at:new Date().toISOString(),last_http_status:response.status,last_error:null}).eq("sport",sport);
        }
      }
      const games=(card.card_games||[]) as Game[];if(games.length!==5){waiting.push(`${card.league_id}:${card.week_number}:invalid-card`);continue;}
      const finals:Final[]=[];
      for(const game of games){
        const event=feeds.get(sport)?.find((row)=>norm(row.home_team)===norm(game.home_team)&&norm(row.away_team)===norm(game.away_team));
        if(!event?.completed)continue;
        const home=score(event,game.home_team),away=score(event,game.away_team);if(!Number.isFinite(home)||!Number.isFinite(away))continue;
        finals.push({...game,homeScore:home,awayScore:away,ats:ats(game,home,away)});
      }
      if(finals.length!==5){waiting.push(`${card.league_id}:${card.week_number}:finals-${finals.length}`);continue;}
      const yes=settleAutomaticProp(card.prop_question||"",finals);if(yes==null){waiting.push(`${card.league_id}:${card.week_number}:unsupported-prop`);continue;}
      const {data:receipt,error:scoreError}=await db.rpc("score_league_week_atomic",{p_league_id:card.league_id,p_week_number:card.week_number,p_results:finals.map((game)=>({game_id:game.id,winner:game.ats})),p_prop_result:yes?card.prop_option_a:card.prop_option_b});
      if(scoreError||!receipt?.ok){waiting.push(`${card.league_id}:${card.week_number}:score-error:${scoreError?.message||"no-receipt"}`);continue;}scoredCount+=1;
    }
    return Response.json({ok:true,inspected:pending.length,scored:scoredCount,waiting});
  }catch(error){const message=error instanceof Error?error.message:JSON.stringify(error);console.error(message);return Response.json({ok:false,error:message||"Autonomous scoring failed"},{status:500});}
});
