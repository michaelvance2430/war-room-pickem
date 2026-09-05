import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const required = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const sportKey = (sport: string) => sport === "ncaaw" ? "basketball_wncaab" : "basketball_ncaab";
const numericHeader = (value: string | null) => value == null || value === "" ? null : Number(value);

type Team = { team_id: string; display_name: string };
type Game = {
  game_id: string; round_key: string; odds_event_id: string | null;
  first_team_id: string | null; second_team_id: string | null;
  first_source_game_id: string | null; second_source_game_id: string | null;
  starts_at: string | null; winner_team_id: string | null;
};
type Tournament = { id: string; sport_id: "ncaam" | "ncaaw"; status: string; fieldhouse_tournament_games: Game[]; fieldhouse_tournament_teams: Team[] };

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return Response.json({ ok: false, error: "POST required" }, { status: 405 });
  try {
    const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.from("fieldhouse_tournaments").select(
      "id,sport_id,status,fieldhouse_tournament_teams(team_id,display_name),fieldhouse_tournament_games(game_id,round_key,odds_event_id,starts_at,first_team_id,second_team_id,first_source_game_id,second_source_game_id,winner_team_id)"
    ).in("status", ["published", "in_progress"]);
    if (error) throw error;

    let settled = 0;
    const waiting: string[] = [];
    for (const tournament of (data || []) as Tournament[]) {
      const games = new Map(tournament.fieldhouse_tournament_games.map((game) => [game.game_id, game]));
      const now = Date.now();
      const readyPending = tournament.fieldhouse_tournament_games.filter((game) => {
        if (game.winner_team_id) return false;
        const firstID = game.first_team_id || (game.first_source_game_id ? games.get(game.first_source_game_id)?.winner_team_id : null);
        const secondID = game.second_team_id || (game.second_source_game_id ? games.get(game.second_source_game_id)?.winner_team_id : null);
        return Boolean(firstID && secondID);
      });
      const teams = new Map(tournament.fieldhouse_tournament_teams.map((team) => [team.team_id, team]));
      const preTipOddsGames = readyPending.filter((game) => {
        const tip = Date.parse(game.starts_at || "");
        return Number.isFinite(tip) && tip > now && tip <= now + 8 * 24 * 60 * 60_000;
      });
      if (preTipOddsGames.length) {
        const { data: claimedOdds, error: oddsClaimError } = await db.rpc("claim_fieldhouse_tournament_odds_refresh", {
          p_tournament_id: tournament.id,
          p_min_age_seconds: 43_200,
        });
        if (oddsClaimError) {
          waiting.push(`${tournament.id}:odds-claim:${oddsClaimError.message}`);
        } else if (claimedOdds) {
          const oddsURL = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey(tournament.sport_id)}/odds`);
          oddsURL.searchParams.set("apiKey", required("ODDS_API_KEY"));
          oddsURL.searchParams.set("regions", "us");
          oddsURL.searchParams.set("markets", "h2h");
          oddsURL.searchParams.set("oddsFormat", "american");
          oddsURL.searchParams.set("dateFormat", "iso");
          const oddsProvider = await fetch(oddsURL);
          const remaining = numericHeader(oddsProvider.headers.get("x-requests-remaining"));
          const used = numericHeader(oddsProvider.headers.get("x-requests-used"));
          const last = numericHeader(oddsProvider.headers.get("x-requests-last"));
          await db.from("platform_odds_api_usage").insert({
            sport: tournament.sport_id,
            action: "tournament_odds_sync",
            endpoint: "/odds/fieldhouse-tournament",
            provider_remaining: remaining,
            provider_used: used,
            provider_last_cost: last,
            estimated_credit_cost: last ?? 1,
            success: oddsProvider.ok,
            http_status: oddsProvider.status,
            dry_run: false,
          });
          if (oddsProvider.ok) {
            const oddsEvents = await oddsProvider.json();
            for (const game of preTipOddsGames) {
              const firstID = game.first_team_id || (game.first_source_game_id ? games.get(game.first_source_game_id)?.winner_team_id : null);
              const secondID = game.second_team_id || (game.second_source_game_id ? games.get(game.second_source_game_id)?.winner_team_id : null);
              if (!firstID || !secondID) continue;
              const first = teams.get(firstID), second = teams.get(secondID);
              if (!first || !second) continue;
              const event = (Array.isArray(oddsEvents) ? oddsEvents : []).find((row: any) => {
                if (game.odds_event_id && String(row.id) === game.odds_event_id) return true;
                const pair = new Set([norm(String(row.home_team || "")), norm(String(row.away_team || ""))]);
                return pair.has(norm(first.display_name)) && pair.has(norm(second.display_name));
              });
              const bookmaker = event?.bookmakers?.find((book: any) => {
                const market = book.markets?.find((item: any) => item.key === "h2h");
                const names = new Set((market?.outcomes || []).map((outcome: any) => norm(String(outcome.name || ""))));
                return names.has(norm(first.display_name)) && names.has(norm(second.display_name));
              });
              const market = bookmaker?.markets?.find((item: any) => item.key === "h2h");
              const firstPrice = Number(market?.outcomes?.find((outcome: any) => norm(String(outcome.name || "")) === norm(first.display_name))?.price);
              const secondPrice = Number(market?.outcomes?.find((outcome: any) => norm(String(outcome.name || "")) === norm(second.display_name))?.price);
              if (!event || !bookmaker || !Number.isFinite(firstPrice) || !Number.isFinite(secondPrice)) continue;
              const { error: oddsUpdateError } = await db.from("fieldhouse_tournament_games").update({
                odds_event_id: String(event.id),
                first_moneyline: Math.round(firstPrice),
                second_moneyline: Math.round(secondPrice),
                odds_bookmaker: String(bookmaker.title || bookmaker.key || "Sportsbook"),
                odds_updated_at: new Date().toISOString(),
              }).eq("tournament_id", tournament.id).eq("game_id", game.game_id).is("winner_team_id", null).gt("starts_at", new Date().toISOString());
              if (oddsUpdateError) waiting.push(`${tournament.id}:${game.game_id}:odds:${oddsUpdateError.message}`);
            }
            await db.from("fieldhouse_tournaments").update({ odds_fetched_at: new Date().toISOString() }).eq("id", tournament.id);
          } else {
            // A provider outage retries after fifteen minutes without allowing
            // the cron cadence to hammer a paid endpoint every minute.
            await db.from("fieldhouse_tournaments").update({
              odds_refresh_claimed_at: new Date(now - (43_200 - 900) * 1_000).toISOString(),
            }).eq("id", tournament.id);
            waiting.push(`${tournament.id}:odds-provider-${oddsProvider.status}`);
          }
        }
      }
      const missingSchedule = readyPending.filter((game) => !game.starts_at);
      if (missingSchedule.length) waiting.push(...missingSchedule.map((game) => `${tournament.id}:${game.game_id}:official-tip-missing`));
      const pollingGames = readyPending.filter((game) => {
        const tip = Date.parse(game.starts_at || "");
        return Number.isFinite(tip) && tip <= now + 2 * 60_000 && tip >= now - 24 * 60 * 60_000;
      });
      const staleGames = readyPending.filter((game) => {
        const tip = Date.parse(game.starts_at || "");
        return Number.isFinite(tip) && tip < now - 24 * 60 * 60_000;
      });
      if (staleGames.length) waiting.push(...staleGames.map((game) => `${tournament.id}:${game.game_id}:manual-review-over-24h`));
      if (!pollingGames.length) continue;

      const hasLiveWindow = pollingGames.some((game) => Date.parse(game.starts_at || "") >= now - 5 * 60 * 60_000);
      const minimumRefreshSeconds = hasLiveWindow ? 50 : 900;
      const { data: cached } = await db.from("live_football_score_cache").select("events").eq("sport", tournament.sport_id).maybeSingle();
      let events = Array.isArray(cached?.events) ? cached.events : [];
      const { data: claimed } = await db.rpc("claim_live_football_score_refresh", { p_sport: tournament.sport_id, p_min_age_seconds: minimumRefreshSeconds });
      if (claimed) {
        const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey(tournament.sport_id)}/scores`);
        url.searchParams.set("apiKey", required("ODDS_API_KEY"));
        url.searchParams.set("daysFrom", "3");
        url.searchParams.set("dateFormat", "iso");
        const provider = await fetch(url);
        const remaining = numericHeader(provider.headers.get("x-requests-remaining"));
        const used = numericHeader(provider.headers.get("x-requests-used"));
        const last = numericHeader(provider.headers.get("x-requests-last"));
        await db.from("platform_odds_api_usage").insert({ sport: tournament.sport_id, action: "tournament_score_sync", endpoint: "/scores/fieldhouse-tournament", provider_remaining: remaining, provider_used: used, provider_last_cost: last, estimated_credit_cost: last ?? 1, success: provider.ok, http_status: provider.status, dry_run: false });
        if (!provider.ok) throw new Error(`Tournament score provider returned ${provider.status}`);
        events = await provider.json();
        await db.from("live_football_score_cache").update({ events, fetched_at: new Date().toISOString(), provider_remaining: remaining, provider_used: used, provider_last_cost: last, last_http_status: provider.status, last_error: null }).eq("sport", tournament.sport_id);
      }
      for (const game of pollingGames) {
        const firstID = game.first_team_id || (game.first_source_game_id ? games.get(game.first_source_game_id)?.winner_team_id : null);
        const secondID = game.second_team_id || (game.second_source_game_id ? games.get(game.second_source_game_id)?.winner_team_id : null);
        if (!firstID || !secondID) continue;
        const first = teams.get(firstID), second = teams.get(secondID);
        if (!first || !second) continue;
        const event = (Array.isArray(events) ? events : []).find((row: any) => {
          if (game.odds_event_id && String(row.id) === game.odds_event_id) return true;
          const pair = new Set([norm(String(row.home_team || "")), norm(String(row.away_team || ""))]);
          return pair.has(norm(first.display_name)) && pair.has(norm(second.display_name));
        });
        if (!event?.completed || !Array.isArray(event.scores)) continue;
        const scoreFor = (name: string) => Number(event.scores.find((row: any) => norm(String(row.name || "")) === norm(name))?.score);
        const firstScore = scoreFor(first.display_name), secondScore = scoreFor(second.display_name);
        if (!Number.isFinite(firstScore) || !Number.isFinite(secondScore) || firstScore === secondScore) {
          waiting.push(`${tournament.id}:${game.game_id}:invalid-final`); continue;
        }
        const winnerTeamID = firstScore > secondScore ? firstID : secondID;
        const { error: settleError } = await db.rpc("record_fieldhouse_tournament_result", {
          p_tournament_id: tournament.id, p_game_id: game.game_id, p_winner_team_id: winnerTeamID,
          p_first_score: firstScore, p_second_score: secondScore,
          p_completed_at: event.last_update || new Date().toISOString(),
        });
        if (settleError) waiting.push(`${tournament.id}:${game.game_id}:${settleError.message}`);
        else { game.winner_team_id = winnerTeamID; settled += 1; }
      }
    }
    return Response.json({ ok: true, tournaments: (data || []).length, settled, waiting });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
