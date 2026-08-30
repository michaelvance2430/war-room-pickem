package com.warroompicks.WarRoom.core

import com.warroompicks.WarRoom.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.UUID

class ApiException(message: String) : Exception(message)

class SupabaseApi {
    suspend fun joinLeague(token: String, code: String): UUID {
        val json = request("/rest/v1/rpc/join_league_by_code", "POST", token, JSONObject().put("p_code", code.trim().uppercase()))
        if (!json.optBoolean("ok")) throw ApiException("That invite code is not available.")
        return UUID.fromString(json.getString("league_id"))
    }

    suspend fun createLeague(token: String, name: String, sport: Sport, public: Boolean, maxMembers: Int): UUID {
        val created = request(
            "/rest/v1/rpc/create_league_with_commissioner_seat", "POST", token,
            JSONObject().put("p_name", name.trim()).put("p_sport_id", sport.id).put("p_list_as_open", public)
                .put("p_crystal_ball_enabled", true).put("p_current_week", if (sport == Sport.NFL) 1 else 0)
                .put("p_cut_percent", 50).put("p_max_human_members", maxMembers).put("p_late_join_policy", "reinforcement_credit"),
        )
        val id = UUID.fromString(created.getString("league_id"))
        request(
            "/rest/v1/rpc/set_league_lobby_visibility", "POST", token,
            JSONObject().put("p_league_id", id.toString()).put("p_visibility", if (public) "public" else "private"),
        )
        return id
    }
    suspend fun signIn(email: String, password: String): UserSession {
        val body = JSONObject().put("email", email.trim()).put("password", password)
        val json = request("/auth/v1/token?grant_type=password", "POST", body = body)
        return session(json)
    }

    suspend fun registerPushToken(token: String, userId: UUID, deviceToken: String) {
        request(
            "/rest/v1/push_device_tokens?on_conflict=device_token", "POST", token,
            JSONObject().put("user_id", userId.toString()).put("device_token", deviceToken).put("platform", "android").put("environment", "production"),
            prefer = "resolution=merge-duplicates,return=minimal",
        )
    }

    suspend fun signUp(email: String, password: String, displayName: String): UserSession? {
        val body = JSONObject()
            .put("email", email.trim())
            .put("password", password)
            .put("data", JSONObject().put("display_name", displayName.trim()))
        val json = request("/auth/v1/signup", "POST", body = body)
        return json.stringOrNull("access_token")?.let { session(json) }
    }

    suspend fun recover(email: String) {
        request(
            "/auth/v1/recover?redirect_to=${encode("https://app.war-room-picks.com/reset-password")}",
            "POST",
            body = JSONObject().put("email", email.trim()),
        )
    }

    suspend fun updateRecoveredPassword(recoveryToken: String, password: String) {
        raw("/auth/v1/user", "PUT", recoveryToken, JSONObject().put("password", password), null)
    }

    suspend fun refresh(refreshToken: String): UserSession = session(
        request(
            "/auth/v1/token?grant_type=refresh_token",
            "POST",
            body = JSONObject().put("refresh_token", refreshToken),
        )
    )

    suspend fun memberships(token: String, userId: UUID): List<League> {
        val select = "league_id,role,total_points,division,leagues(name,code,sport_id,current_week,regular_season_weeks,championship_trophy_id,commissioner_id,mode)"
        val rows = requestArray("/rest/v1/memberships?select=${encode(select)}&user_id=eq.$userId", token = token)
        return rows.objects().mapNotNull { row ->
            val league = row.optJSONObject("leagues") ?: return@mapNotNull null
            if (league.optString("mode") == "foundry") return@mapNotNull null
            League(
                id = UUID.fromString(row.getString("league_id")),
                name = league.optString("name", "League"),
                sport = Sport.from(league.optString("sport_id")),
                inviteCode = league.optString("code"),
                commissionerId = league.stringOrNull("commissioner_id")?.let(UUID::fromString),
                currentWeek = league.optInt("current_week", if (league.optString("sport_id") == "nfl") 1 else 0),
                regularSeasonWeeks = league.optInt("regular_season_weeks", if (league.optString("sport_id") == "nfl") 18 else 14),
                championshipTrophyId = league.stringOrNull("championship_trophy_id"),
            )
        }
    }

    suspend fun weekCard(token: String, league: League): Pair<WeekCard, List<CardGame>>? {
        val select = "id,week_number,lock_time,prop_question,prop_option_a,prop_option_b,prop_points,card_games(id,sort_order,away_team,home_team,spread,favorite,start_time)"
        val rows = requestArray("/rest/v1/week_cards?select=${encode(select)}&league_id=eq.${league.id}&week_number=eq.${league.currentWeek}&card_games.order=sort_order.asc&limit=1", token)
        val row = rows.optJSONObject(0) ?: return null
        val id = UUID.fromString(row.getString("id"))
        val card = WeekCard(id, league.id, row.optInt("week_number"), "published", instant(row.stringOrNull("lock_time")), row.stringOrNull("prop_question"))
        val games = row.arrayOrEmpty("card_games").objects().map { game ->
            CardGame(
                id = UUID.fromString(game.getString("id")), cardId = id,
                awayTeam = game.optString("away_team"), homeTeam = game.optString("home_team"),
                spread = game.optDouble("spread"), favorite = game.stringOrNull("favorite"),
                startsAt = instant(game.stringOrNull("start_time")),
            )
        }
        return card to games
    }

    suspend fun liveScores(token: String, league: League, games: List<CardGame>): List<CardGame> {
        if (games.isEmpty()) return games
        val feed = request(
            "/functions/v1/football-scores", "POST", token,
            JSONObject().put("leagueId", league.id.toString()).put("sport", league.sport.id).put("daysFrom", 3),
        )
        val events = feed.arrayOrEmpty("events").objects()
        return games.map { game ->
            val event = events.firstOrNull {
                normalize(it.optString("homeTeam")) == normalize(game.homeTeam) && normalize(it.optString("awayTeam")) == normalize(game.awayTeam)
            } ?: return@map game
            val scores = event.arrayOrEmpty("scores").objects().associate { normalize(it.optString("name")) to it.optString("score").toIntOrNull() }
            game.copy(
                homeScore = scores[normalize(game.homeTeam)], awayScore = scores[normalize(game.awayTeam)],
                final = event.optBoolean("completed"),
            )
        }
    }

    suspend fun footballOdds(token: String, league: League): List<OddsGame> {
        val feed = request(
            "/functions/v1/football-odds", "POST", token,
            JSONObject().put("leagueId", league.id.toString()).put("sport", league.sport.id).put("week", league.currentWeek),
        )
        return feed.arrayOrEmpty("games").objects().map { game ->
            OddsGame(
                game.optString("id"), game.optString("awayTeam"), game.optString("homeTeam"),
                game.optDouble("spread"), game.optString("favorite"), instant(game.stringOrNull("commenceTime")),
            )
        }
    }

    suspend fun publishWeekCard(token: String, league: League, games: List<OddsGame>, prop: String, optionA: String, optionB: String) {
        val rows = JSONArray()
        games.forEachIndexed { index, game ->
            rows.put(JSONObject().put("away_team", game.awayTeam).put("home_team", game.homeTeam).put("spread", game.spread)
                .put("favorite", game.favorite).put("start_time", game.startsAt?.toString()).put("sort_order", index + 1))
        }
        request(
            "/rest/v1/rpc/publish_week_card_atomic", "POST", token,
            JSONObject().put("p_league_id", league.id.toString()).put("p_week_number", league.currentWeek).put("p_games", rows)
                .put("p_prop_question", prop.trim()).put("p_prop_option_a", optionA.trim()).put("p_prop_option_b", optionB.trim()).put("p_prop_points", 1),
        )
    }

    suspend fun standings(token: String, league: League): List<Standing> {
        val select = "user_id,total_points,division,display_name_override,profiles(display_name,avatar_url),is_bot"
        val rows = requestArray("/rest/v1/memberships?select=${encode(select)}&league_id=eq.${league.id}&is_bot=eq.false&order=total_points.desc", token)
        val ids = rows.objects().mapNotNull { it.stringOrNull("user_id") }
        val favorites = if (ids.isEmpty()) emptyMap() else {
            val filter = ids.joinToString(",")
            requestArray("/rest/v1/profile_favorite_teams?select=user_id,team_id&sport_id=eq.${league.sport.id}&user_id=in.(${encode(filter)})", token)
                .objects().associate { UUID.fromString(it.getString("user_id")) to it.optString("team_id") }
        }
        return rows.objects().mapIndexed { index, row ->
            val profile = row.optJSONObject("profiles")
            Standing(
                UUID.fromString(row.getString("user_id")),
                row.stringOrNull("display_name_override") ?: profile?.optString("display_name")?.takeIf(String::isNotBlank) ?: "Player",
                row.stringOrNull("division"), row.optDouble("total_points"), index + 1,
                favorites[UUID.fromString(row.getString("user_id"))], profile?.stringOrNull("avatar_url"),
            )
        }
    }

    suspend fun currentPick(token: String, league: League, userId: UUID): CurrentPick? {
        val select = "id,prop_choice,locked_at,total_points,pick_games(card_game_id,side,confidence,is_best_bet)"
        val rows = requestArray("/rest/v1/picks?select=${encode(select)}&league_id=eq.${league.id}&user_id=eq.$userId&week_number=eq.${league.currentWeek}&limit=1", token)
        val row = rows.optJSONObject(0) ?: return null
        val picks = row.arrayOrEmpty("pick_games").objects()
        return CurrentPick(
            id = UUID.fromString(row.getString("id")),
            selections = picks.map { GameSelection(UUID.fromString(it.getString("card_game_id")), it.getString("side"), it.optInt("confidence")) },
            bestBetGameId = picks.firstOrNull { it.optBoolean("is_best_bet") }?.getString("card_game_id")?.let(UUID::fromString),
            propChoice = row.stringOrNull("prop_choice"),
            lockedAt = instant(row.stringOrNull("locked_at")),
            totalPoints = if (row.isNull("total_points")) null else row.optInt("total_points"),
        )
    }

    suspend fun favoriteTeam(token: String, userId: UUID, sport: Sport): String? {
        val rows = requestArray("/rest/v1/profile_favorite_teams?select=team_id&user_id=eq.$userId&sport_id=eq.${sport.id}&limit=1", token)
        return rows.optJSONObject(0)?.stringOrNull("team_id")
    }

    suspend fun saveFavoriteTeam(token: String, userId: UUID, sport: Sport, team: String) {
        request(
            "/rest/v1/profile_favorite_teams?on_conflict=user_id,sport_id", "POST", token,
            JSONObject().put("user_id", userId.toString()).put("sport_id", sport.id).put("team_id", TeamCatalog.slug(team)),
            prefer = "resolution=merge-duplicates,return=minimal",
        )
    }

    suspend fun crystalBall(token: String, leagueId: UUID, userId: UUID): String? {
        val rows = requestArray("/rest/v1/crystal_ball_picks?select=team_name&league_id=eq.$leagueId&user_id=eq.$userId&limit=1", token)
        return rows.optJSONObject(0)?.stringOrNull("team_name")
    }

    suspend fun saveCrystalBall(token: String, leagueId: UUID, userId: UUID, team: String) {
        request(
            "/rest/v1/crystal_ball_picks?on_conflict=league_id,user_id", "POST", token,
            JSONObject().put("league_id", leagueId.toString()).put("user_id", userId.toString()).put("team_name", team),
            prefer = "resolution=merge-duplicates,return=minimal",
        )
    }

    suspend fun selectChampionshipTrophy(token: String, leagueId: UUID, trophyId: String): String {
        val raw = raw(
            "/rest/v1/rpc/select_championship_trophy", "POST", token,
            JSONObject().put("p_league_id", leagueId.toString()).put("p_trophy_id", trophyId), null,
        )
        return raw.trim().trim('"')
    }

    suspend fun updateDisplayName(token: String, userId: UUID, displayName: String) {
        raw(
            "/rest/v1/profiles?id=eq.$userId", "PATCH", token,
            JSONObject().put("display_name", displayName.trim()), "return=minimal",
        )
    }

    suspend fun nflPostseasonSlate(token: String, leagueId: UUID, seasonKey: Int): NflPostseasonSlate? {
        val rows = requestArray("/rest/v1/nfl_postseason_slates?select=league_id,season_key,teams,published_at&league_id=eq.$leagueId&season_key=eq.$seasonKey&limit=1", token)
        val row = rows.optJSONObject(0) ?: return null
        return NflPostseasonSlate(
            row.optInt("season_key"),
            row.arrayOrEmpty("teams").objects().map { NflPostseasonTeam(it.optString("id"), it.optString("name"), it.optString("conference"), it.optInt("seed")) },
        )
    }

    suspend fun nflPostseasonEntry(token: String, leagueId: UUID, userId: UUID, seasonKey: Int): NflPostseasonEntry? {
        val select = "picks,used_jdam,locked_at,score"
        val rows = requestArray("/rest/v1/nfl_postseason_entries?select=$select&league_id=eq.$leagueId&user_id=eq.$userId&season_key=eq.$seasonKey&limit=1", token)
        val row = rows.optJSONObject(0) ?: return null
        return NflPostseasonEntry(row.objectStringMap("picks"), row.optBoolean("used_jdam"), instant(row.stringOrNull("locked_at")), if (row.isNull("score")) null else row.optInt("score"))
    }

    suspend fun nflPostseasonResults(token: String, leagueId: UUID, seasonKey: Int): Map<String, String> {
        val rows = requestArray("/rest/v1/nfl_postseason_results?select=winners&league_id=eq.$leagueId&season_key=eq.$seasonKey&limit=1", token)
        return rows.optJSONObject(0)?.objectStringMap("winners").orEmpty()
    }

    suspend fun nflPostseasonScorecard(token: String, leagueId: UUID, userId: UUID, seasonKey: Int): NflPostseasonScorecard? {
        val select = "wild_card_points,divisional_points,conference_points,super_bowl_points,total_points,used_jdam"
        val rows = requestArray("/rest/v1/nfl_postseason_scorecards?select=$select&league_id=eq.$leagueId&user_id=eq.$userId&season_key=eq.$seasonKey&limit=1", token)
        val row = rows.optJSONObject(0) ?: return null
        return NflPostseasonScorecard(row.optInt("wild_card_points"), row.optInt("divisional_points"), row.optInt("conference_points"), row.optInt("super_bowl_points"), row.optInt("total_points"), row.optBoolean("used_jdam"))
    }

    suspend fun lockNflPostseasonBracket(token: String, leagueId: UUID, seasonKey: Int, picks: Map<String, String>, usedJdam: Boolean): NflPostseasonEntry {
        val row = request(
            "/rest/v1/rpc/save_nfl_postseason_bracket", "POST", token,
            JSONObject().put("p_league_id", leagueId.toString()).put("p_season_key", seasonKey).put("p_picks", JSONObject(picks)).put("p_used_jdam", usedJdam),
        )
        return NflPostseasonEntry(row.objectStringMap("picks"), row.optBoolean("used_jdam"), instant(row.stringOrNull("locked_at")), if (row.isNull("score")) null else row.optInt("score"))
    }

    suspend fun cfbPostseasonSlate(token: String, leagueId: UUID, seasonKey: Int): CfbPostseasonSlate? {
        val rows = requestArray("/rest/v1/cfb_postseason_slates?select=league_id,season_key,bowl_games,cfp_seeds,published_at&league_id=eq.$leagueId&season_key=eq.$seasonKey&limit=1", token)
        val row = rows.optJSONObject(0) ?: return null
        val bowls = row.arrayOrEmpty("bowl_games").objects().map { game ->
            CfbBowlGame(game.optString("id"), game.optString("name"), if (game.optString("tier") == "sicko") CfbBowlTier.SICKO else CfbBowlTier.MARQUEE, game.optInt("rank"), game.optString("away"), game.optString("home"))
        }
        val seeds = row.arrayOrEmpty("cfp_seeds").let { array -> (0 until array.length()).map { array.optString(it) } }
        return CfbPostseasonSlate(row.optInt("season_key"), bowls, seeds)
    }

    suspend fun cfbPostseasonEntry(token: String, leagueId: UUID, userId: UUID, seasonKey: Int): CfbPostseasonEntry? {
        val select = "bowl_picks,bowl_allocations,dead_hand,bowl_locked_at,cfp_picks,cfp_locked_at,bowl_score,cfp_score"
        val rows = requestArray("/rest/v1/cfb_postseason_entries?select=$select&league_id=eq.$leagueId&user_id=eq.$userId&season_key=eq.$seasonKey&limit=1", token)
        val row = rows.optJSONObject(0) ?: return null
        return CfbPostseasonEntry(
            row.objectStringMap("bowl_picks"), row.objectIntMap("bowl_allocations"), row.optBoolean("dead_hand"), instant(row.stringOrNull("bowl_locked_at")),
            row.objectStringMap("cfp_picks"), instant(row.stringOrNull("cfp_locked_at")),
            if (row.isNull("bowl_score")) null else row.optInt("bowl_score"), if (row.isNull("cfp_score")) null else row.optInt("cfp_score"),
        )
    }

    suspend fun cfbPostseasonResults(token: String, leagueId: UUID, seasonKey: Int): CfbPostseasonResults {
        val rows = requestArray("/rest/v1/cfb_postseason_results?select=bowl_results,cfp_results&league_id=eq.$leagueId&season_key=eq.$seasonKey&limit=1", token)
        val row = rows.optJSONObject(0) ?: return CfbPostseasonResults(emptyMap(), emptyMap())
        return CfbPostseasonResults(row.objectStringMap("bowl_results"), row.objectStringMap("cfp_results"))
    }

    suspend fun lockCfbBowlBoard(token: String, leagueId: UUID, seasonKey: Int, picks: Map<String, String>, allocations: Map<String, Int>, deadHand: Boolean): CfbPostseasonEntry {
        val row = request(
            "/rest/v1/rpc/save_cfb_bowl_board", "POST", token,
            JSONObject().put("p_league_id", leagueId.toString()).put("p_season_key", seasonKey).put("p_picks", JSONObject(picks)).put("p_allocations", JSONObject(allocations)).put("p_dead_hand", deadHand),
        )
        return row.toCfbEntry()
    }

    suspend fun lockCfbPlayoffBracket(token: String, leagueId: UUID, seasonKey: Int, picks: Map<String, String>): CfbPostseasonEntry {
        val row = request(
            "/rest/v1/rpc/save_cfb_playoff_bracket", "POST", token,
            JSONObject().put("p_league_id", leagueId.toString()).put("p_season_key", seasonKey).put("p_picks", JSONObject(picks)),
        )
        return row.toCfbEntry()
    }

    suspend fun publishNflPostseasonSlate(token: String, leagueId: UUID, seasonKey: Int, teams: List<NflPostseasonTeam>) {
        val encoded = JSONArray().apply { teams.forEach { put(JSONObject().put("id", it.id).put("name", it.name).put("conference", it.conference).put("seed", it.seed)) } }
        raw("/rest/v1/rpc/publish_nfl_postseason_slate", "POST", token, JSONObject().put("p_league_id", leagueId.toString()).put("p_season_key", seasonKey).put("p_teams", encoded), null)
    }

    suspend fun saveNflPostseasonResults(token: String, leagueId: UUID, seasonKey: Int, winners: Map<String, String>): Map<String, String> {
        val row = request("/rest/v1/rpc/save_nfl_postseason_results", "POST", token, JSONObject().put("p_league_id", leagueId.toString()).put("p_season_key", seasonKey).put("p_winners", JSONObject(winners)))
        return row.objectStringMap("winners")
    }

    suspend fun publishCfbPostseasonSlate(token: String, leagueId: UUID, seasonKey: Int, bowlGames: List<CfbBowlGame>, seeds: List<String>) {
        val bowls = JSONArray().apply { bowlGames.forEach { game -> put(JSONObject().put("id", game.id).put("name", game.name).put("tier", game.tier.name.lowercase()).put("rank", game.rank).put("away", game.away).put("home", game.home).put("hosts_cfp", false)) } }
        val cfp = JSONArray().apply { seeds.forEach(::put) }
        raw("/rest/v1/rpc/publish_cfb_postseason_slate", "POST", token, JSONObject().put("p_league_id", leagueId.toString()).put("p_season_key", seasonKey).put("p_bowl_games", bowls).put("p_cfp_seeds", cfp), null)
    }

    suspend fun saveCfbPostseasonResults(token: String, leagueId: UUID, seasonKey: Int, bowlResults: Map<String, String>, cfpResults: Map<String, String>): CfbPostseasonResults {
        val raw = raw(
            "/rest/v1/cfb_postseason_results?on_conflict=league_id,season_key", "POST", token,
            JSONObject().put("league_id", leagueId.toString()).put("season_key", seasonKey).put("bowl_results", JSONObject(bowlResults)).put("cfp_results", JSONObject(cfpResults)),
            "resolution=merge-duplicates,return=representation",
        )
        val row = JSONArray(raw).optJSONObject(0) ?: throw ApiException("Postseason results were not returned.")
        return CfbPostseasonResults(row.objectStringMap("bowl_results"), row.objectStringMap("cfp_results"))
    }

    suspend fun lockerMessages(token: String, leagueId: UUID): List<LockerMessage> {
        val select = "id,user_id,body,created_at,profiles(display_name,avatar_url)"
        val rows = requestArray("/rest/v1/locker_messages?select=${encode(select)}&league_id=eq.$leagueId&order=created_at.asc&limit=100", token)
        return rows.objects().mapNotNull { row ->
            val body = row.optString("body")
            if (body.startsWith("WR_")) return@mapNotNull null
            LockerMessage(
                UUID.fromString(row.getString("id")), UUID.fromString(row.getString("user_id")),
                row.optJSONObject("profiles")?.optString("display_name") ?: "Player", body,
                instant(row.stringOrNull("created_at")) ?: Instant.EPOCH, false,
                row.optJSONObject("profiles")?.stringOrNull("avatar_url"),
            )
        }
    }

    suspend fun history(token: String, leagueId: UUID, userId: UUID): List<HistoryWeek> {
        val rows = requestArray("/rest/v1/picks?select=week_number,total_points,locked_at&league_id=eq.$leagueId&user_id=eq.$userId&locked_at=not.is.null&order=week_number.desc", token)
        return rows.objects().map { HistoryWeek(it.optInt("week_number"), it.optInt("total_points"), instant(it.stringOrNull("locked_at"))) }
    }

    suspend fun trophies(token: String, userId: UUID): List<Trophy> {
        val rows = requestArray("/rest/v1/league_trophies?select=id,season_year,trophy_type,winner_name,subtitle&winner_user_id=eq.$userId&order=season_year.desc", token)
        return rows.objects().map { Trophy(UUID.fromString(it.getString("id")), it.optInt("season_year"), it.optString("trophy_type"), it.optString("winner_name"), it.stringOrNull("subtitle")) }
    }

    suspend fun postLockerMessage(token: String, leagueId: UUID, userId: UUID, body: String) {
        request(
            "/rest/v1/locker_messages", "POST", token,
            JSONObject().put("league_id", leagueId.toString()).put("user_id", userId.toString()).put("body", body.trim()),
            prefer = "return=minimal",
        )
    }

    suspend fun announcements(token: String, leagueId: UUID): List<Announcement> {
        val select = "id,title,body,created_at,profiles!announcements_author_id_fkey(display_name)"
        val rows = requestArray("/rest/v1/announcements?select=${encode(select)}&league_id=eq.$leagueId&order=created_at.desc&limit=25", token)
        return rows.objects().map { row ->
            Announcement(
                UUID.fromString(row.getString("id")), row.optString("title"), row.optString("body"),
                row.optJSONObject("profiles")?.optString("display_name") ?: "Commissioner",
                instant(row.stringOrNull("created_at")) ?: Instant.EPOCH,
            )
        }
    }

    suspend fun postAnnouncement(token: String, leagueId: UUID, authorId: UUID, title: String, body: String) {
        request(
            "/rest/v1/announcements", "POST", token,
            JSONObject().put("league_id", leagueId.toString()).put("author_id", authorId.toString()).put("title", title.trim()).put("body", body.trim()),
            prefer = "return=minimal",
        )
    }

    suspend fun savePick(
        token: String,
        league: League,
        card: WeekCard,
        selections: List<GameSelection>,
        bestBet: UUID,
        propChoice: String,
    ) {
        val picks = JSONArray()
        selections.forEach { picks.put(JSONObject().put("game_id", it.gameId.toString()).put("side", it.side).put("confidence", it.confidence)) }
        request(
            "/rest/v1/rpc/save_week_picks_atomic", "POST", token,
            JSONObject()
                .put("p_league_id", league.id.toString()).put("p_week_number", card.week)
                .put("p_picks", picks).put("p_best_bet_game_id", bestBet.toString())
                .put("p_prop_choice", propChoice).put("p_is_chaos", false),
        )
    }

    private fun session(json: JSONObject): UserSession {
        val user = json.getJSONObject("user")
        return UserSession(
            UUID.fromString(user.getString("id")), user.optString("email"),
            json.getString("access_token"), json.getString("refresh_token"),
            Instant.now().epochSecond + json.optLong("expires_in", 3600),
        )
    }

    private suspend fun requestArray(path: String, token: String) = withContext(Dispatchers.IO) {
        val value = raw(path, "GET", token, null, null)
        JSONArray(value.ifBlank { "[]" })
    }

    private suspend fun request(path: String, method: String, token: String? = null, body: JSONObject? = null, prefer: String? = null) = withContext(Dispatchers.IO) {
        val value = raw(path, method, token, body, prefer)
        JSONObject(value.ifBlank { "{}" })
    }

    private fun raw(path: String, method: String, token: String?, body: JSONObject?, prefer: String?): String {
        val connection = URI(SupabaseConfig.BASE_URL + path).toURL().openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = 15_000
        connection.readTimeout = 25_000
        connection.setRequestProperty("apikey", SupabaseConfig.PUBLISHABLE_KEY)
        connection.setRequestProperty("Accept", "application/json")
        if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")
        if (prefer != null) connection.setRequestProperty("Prefer", prefer)
        if (body != null) {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(body.toString().toByteArray()) }
        }
        val code = connection.responseCode
        val text = (if (code in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
        connection.disconnect()
        if (code !in 200..299) {
            val message = runCatching { JSONObject(text).optString("msg").ifBlank { JSONObject(text).optString("message") } }.getOrNull()
            throw ApiException(message?.ifBlank { null } ?: "War Room request failed ($code).")
        }
        return text
    }

    private fun encode(value: String) = URLEncoder.encode(value, StandardCharsets.UTF_8.toString())
    private fun instant(value: String?) = value?.let { runCatching { Instant.parse(it) }.getOrNull() }
    private fun normalize(value: String) = value.lowercase().replace(Regex("[^a-z0-9]"), "")

    private fun JSONObject.objectStringMap(key: String): Map<String, String> {
        val value = optJSONObject(key) ?: return emptyMap()
        return value.keys().asSequence().associateWith { value.optString(it) }
    }

    private fun JSONObject.objectIntMap(key: String): Map<String, Int> {
        val value = optJSONObject(key) ?: return emptyMap()
        return value.keys().asSequence().associateWith { value.optInt(it) }
    }

    private fun JSONObject.toCfbEntry() = CfbPostseasonEntry(
        objectStringMap("bowl_picks"), objectIntMap("bowl_allocations"), optBoolean("dead_hand"), instant(stringOrNull("bowl_locked_at")),
        objectStringMap("cfp_picks"), instant(stringOrNull("cfp_locked_at")),
        if (isNull("bowl_score")) null else optInt("bowl_score"), if (isNull("cfp_score")) null else optInt("cfp_score"),
    )
}
