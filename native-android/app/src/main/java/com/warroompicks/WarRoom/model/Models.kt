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
