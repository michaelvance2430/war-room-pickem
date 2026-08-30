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
)

data class LockerMessage(
    val id: UUID,
    val userId: UUID,
    val displayName: String,
    val body: String,
    val createdAt: Instant,
    val isAnnouncement: Boolean,
)

data class Profile(
    val userId: UUID,
    val displayName: String,
    val favoriteCfbTeam: String?,
    val favoriteNflTeam: String?,
    val crystalBallTeam: String?,
)
