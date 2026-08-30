package com.warroompicks.WarRoom.model

import java.time.Instant
import java.util.UUID

enum class Sport(val id: String) {
    CFB("cfb"), NFL("nfl");

    companion object {
        fun from(value: String?) = entries.firstOrNull { it.id == value?.lowercase() } ?: CFB
    }
}

data class UserSession(
    val userId: UUID,
    val email: String,
    val accessToken: String,
    val refreshToken: String,
    val expiresAtEpochSeconds: Long,
)

data class League(
    val id: UUID,
    val name: String,
    val sport: Sport,
    val inviteCode: String,
    val commissionerId: UUID?,
    val currentWeek: Int,
    val regularSeasonWeeks: Int,
    val championshipTrophyId: String?,
    val memberCount: Int = 0,
) {
    fun isCommissioner(userId: UUID) = commissionerId == userId
}

data class WeekCard(
    val id: UUID,
    val leagueId: UUID,
    val week: Int,
    val status: String,
    val locksAt: Instant?,
    val propQuestion: String?,
    val propOptionA: String? = null,
    val propOptionB: String? = null,
    val propPoints: Int = 1,
)

data class TrophyDesign(val id: String, val name: String, val line: String)

object TrophyCatalog {
    fun designs(sport: Sport): List<TrophyDesign> = if (sport == Sport.NFL) listOf(
        TrophyDesign("nfl_sunday_scepter", "Sunday Scepter", "Eighteen Sundays of evidence, forged into one merciless signal."),
        TrophyDesign("nfl_gridiron_crown", "Gridiron Crown", "Goalposts bent into a crown for the room's final authority."),
        TrophyDesign("nfl_fourth_down_forge", "Fourth-Down Forge", "Four pillars. One suspended season. No safe decision."),
        TrophyDesign("nfl_two_minute_monument", "Two-Minute Monument", "For the champion who stayed dangerous after every warning light."),
        TrophyDesign("nfl_iron_end_zone", "Iron End Zone", "The final territory, defended all season and claimed once."),
        TrophyDesign("nfl_final_whistle", "The Final Whistle", "When this sounds, the arguments become permanent records."),
    ) else listOf(
        TrophyDesign("command_cup", "The Command Cup", "Traditional authority. Excessive brass. Zero civilian oversight."),
        TrophyDesign("golden_gut", "The Golden Gut", "For the champion whose instincts survived contact with evidence."),
        TrophyDesign("the_receipt", "The Receipt", "Every correct call, preserved forever and displayed without mercy."),
        TrophyDesign("insufferable_crown", "Crown of Insufferability", "Victory was not enough. Now everyone must hear about it."),
        TrophyDesign("brass_football", "Big Brass Football", "Subtle as a marching band in a courthouse."),
        TrophyDesign("last_one_standing", "Last One Standing", "One survivor. Many ruined Saturdays. Beautiful work."),
    )
}

data class CardGame(
    val id: UUID,
    val cardId: UUID,
    val awayTeam: String,
    val homeTeam: String,
    val spread: Double,
    val favorite: String?,
    val startsAt: Instant?,
    val awayScore: Int? = null,
    val homeScore: Int? = null,
    val final: Boolean = false,
)

data class OddsGame(
    val id: String,
    val awayTeam: String,
    val homeTeam: String,
    val spread: Double,
    val favorite: String,
    val startsAt: Instant?,
)

data class GameSelection(val gameId: UUID, val side: String, val confidence: Int?)

data class PlayerPick(
    val id: UUID?,
    val cardId: UUID,
    val userId: UUID,
    val selections: List<GameSelection>,
    val bestBetGameId: UUID?,
    val propAnswer: String?,
    val submittedAt: Instant?,
)

data class CurrentPick(
    val id: UUID,
    val selections: List<GameSelection>,
    val bestBetGameId: UUID?,
    val propChoice: String?,
    val lockedAt: Instant?,
    val totalPoints: Int?,
)

data class CertifiedWeekResult(
    val propResult: String?,
    val scoredAt: Instant?,
)

object ScorecardOfficialState {
    fun total(gamePoints: Int, certifiedTotal: Int?): Int = certifiedTotal ?: gamePoints

    fun propStatus(choice: String?, officialResult: String?, points: Int): String {
        if (officialResult == null) return "PENDING"
        return if (choice == officialResult) "HIT +$points" else "MISS +0"
    }

    fun propOptions(card: WeekCard): List<String> = listOfNotNull(
        card.propOptionA?.takeIf(String::isNotBlank),
        card.propOptionB?.takeIf(String::isNotBlank),
    )
}

data class Standing(
    val userId: UUID,
    val displayName: String,
    val division: String?,
    val points: Double,
    val rank: Int,
    val favoriteTeam: String?,
    val avatarUrl: String? = null,
)

data class LockerMessage(
    val id: UUID,
    val userId: UUID,
    val displayName: String,
    val body: String,
    val createdAt: Instant,
    val isAnnouncement: Boolean,
    val avatarUrl: String? = null,
)

data class HistoryWeek(val week: Int, val points: Int, val lockedAt: Instant?)

data class Trophy(
    val id: UUID,
    val seasonYear: Int,
    val type: String,
    val winnerName: String,
    val subtitle: String?,
)

data class NflPostseasonTeam(val id: String, val name: String, val conference: String, val seed: Int)
data class NflPostseasonSlate(val seasonKey: Int, val teams: List<NflPostseasonTeam>)
data class NflPostseasonEntry(val picks: Map<String, String>, val usedJdam: Boolean, val lockedAt: Instant?, val score: Int?)
data class NflPostseasonScorecard(
    val wildCardPoints: Int, val divisionalPoints: Int, val conferencePoints: Int,
    val superBowlPoints: Int, val totalPoints: Int, val usedJdam: Boolean,
)
data class NflBracketGame(val id: String, val title: String, val round: String, val teams: List<NflPostseasonTeam>)

object NflBracketEngine {
    val requiredKeys = listOf(
        "AFC-WC-2-7", "AFC-WC-3-6", "AFC-WC-4-5", "NFC-WC-2-7", "NFC-WC-3-6", "NFC-WC-4-5",
        "AFC-DIV-1", "AFC-DIV-2", "NFC-DIV-1", "NFC-DIV-2", "AFC-CONF", "NFC-CONF", "SUPER-BOWL",
    )

    fun games(teams: List<NflPostseasonTeam>, picks: Map<String, String>): List<NflBracketGame> {
        val games = mutableListOf<NflBracketGame>()
        listOf("AFC", "NFC").forEach { conference ->
            val field = teams.filter { it.conference == conference }
            fun seed(value: Int) = field.firstOrNull { it.seed == value }
            listOf(2 to 7, 3 to 6, 4 to 5).forEach { pair ->
                games += NflBracketGame("$conference-WC-${pair.first}-${pair.second}", "#${pair.first} vs #${pair.second}", "WILD CARD", listOfNotNull(seed(pair.first), seed(pair.second)))
            }
            val wildCardWinners = games.filter { it.id.startsWith("$conference-WC") }.mapNotNull { winner(it, picks) }.sortedBy { it.seed }
            if (wildCardWinners.size == 3 && seed(1) != null) {
                val lowest = wildCardWinners.maxBy { it.seed }
                games += NflBracketGame("$conference-DIV-1", "#1 vs lowest remaining", "DIVISIONAL", listOf(seed(1)!!, lowest))
                games += NflBracketGame("$conference-DIV-2", "Remaining seeds", "DIVISIONAL", wildCardWinners.filter { it != lowest })
            } else {
                games += NflBracketGame("$conference-DIV-1", "#1 vs lowest remaining", "DIVISIONAL", emptyList())
                games += NflBracketGame("$conference-DIV-2", "Remaining seeds", "DIVISIONAL", emptyList())
            }
            val divisionalWinners = games.filter { it.id.startsWith("$conference-DIV") }.mapNotNull { winner(it, picks) }
            games += NflBracketGame("$conference-CONF", "$conference Championship", "CONFERENCE", divisionalWinners)
        }
        val champions = games.filter { it.id.endsWith("-CONF") }.mapNotNull { winner(it, picks) }
        games += NflBracketGame("SUPER-BOWL", "AFC Champion vs NFC Champion", "SUPER BOWL", champions)
        return games
    }

    fun winner(game: NflBracketGame, picks: Map<String, String>) = picks[game.id]?.let { id -> game.teams.firstOrNull { it.id == id } }

    fun select(current: Map<String, String>, gameId: String, teamId: String): Map<String, String> {
        val next = current.toMutableMap().apply { this[gameId] = teamId }
        when {
            "-WC-" in gameId -> {
                val conference = gameId.take(3)
                next.keys.filter { it.startsWith("$conference-DIV") || it == "$conference-CONF" || it == "SUPER-BOWL" }.toList().forEach(next::remove)
            }
            "-DIV-" in gameId -> { next.remove("${gameId.take(3)}-CONF"); next.remove("SUPER-BOWL") }
            gameId.endsWith("-CONF") -> next.remove("SUPER-BOWL")
        }
        return next
    }
}

enum class CfbBowlTier { MARQUEE, SICKO }
data class CfbBowlGame(val id: String, val name: String, val tier: CfbBowlTier, val rank: Int, val away: String, val home: String)
data class CfbPostseasonSlate(val seasonKey: Int, val bowlGames: List<CfbBowlGame>, val cfpSeeds: List<String>)
data class CfbPostseasonEntry(
    val bowlPicks: Map<String, String>, val bowlAllocations: Map<String, Int>, val deadHand: Boolean,
    val bowlLockedAt: Instant?, val cfpPicks: Map<String, String>, val cfpLockedAt: Instant?,
    val bowlScore: Int?, val cfpScore: Int?,
)
data class CfbPostseasonResults(val bowlResults: Map<String, String>, val cfpResults: Map<String, String>)
data class CfbBracketGame(val id: String, val label: String, val first: String, val second: String)

object CfbBracketEngine {
    val order = listOf("r1a", "r1b", "r1c", "r1d", "q1", "q2", "q3", "q4", "s1", "s2", "final")
    fun games(seeds: List<String>, picks: Map<String, String>): List<CfbBracketGame> {
        if (seeds.size != 12) return emptyList()
        fun winner(id: String) = picks[id] ?: "TBD"
        return listOf(
            CfbBracketGame("r1a", "FIRST ROUND · 5/12", seeds[4], seeds[11]), CfbBracketGame("r1b", "FIRST ROUND · 8/9", seeds[7], seeds[8]),
            CfbBracketGame("r1c", "FIRST ROUND · 7/10", seeds[6], seeds[9]), CfbBracketGame("r1d", "FIRST ROUND · 6/11", seeds[5], seeds[10]),
            CfbBracketGame("q1", "ROSE BOWL", seeds[3], winner("r1a")), CfbBracketGame("q2", "SUGAR BOWL", seeds[0], winner("r1b")),
            CfbBracketGame("q3", "PEACH BOWL", seeds[1], winner("r1c")), CfbBracketGame("q4", "FIESTA BOWL", seeds[2], winner("r1d")),
            CfbBracketGame("s1", "ORANGE BOWL", winner("q1"), winner("q2")), CfbBracketGame("s2", "COTTON BOWL", winner("q3"), winner("q4")),
            CfbBracketGame("final", "CFP NATIONAL CHAMPIONSHIP", winner("s1"), winner("s2")),
        )
    }
    fun select(seeds: List<String>, current: Map<String, String>, gameId: String, team: String): Map<String, String> {
        val next = current.toMutableMap().apply { this[gameId] = team }
        games(seeds, next).filter { it.id !in listOf("r1a", "r1b", "r1c", "r1d") }.forEach { game ->
            if (next[game.id] != null && next[game.id] !in setOf(game.first, game.second)) next.remove(game.id)
        }
        return next
    }
}

data class Announcement(
    val id: UUID,
    val title: String,
    val body: String,
    val authorName: String,
    val createdAt: Instant,
)

data class Profile(
    val userId: UUID,
    val displayName: String,
    val favoriteCfbTeam: String?,
    val favoriteNflTeam: String?,
    val crystalBallTeam: String?,
)
