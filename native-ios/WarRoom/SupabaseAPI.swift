import Foundation

struct AuthSession: Decodable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let user: AuthUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case user
    }
}

struct AuthUser: Decodable, Sendable { let id: UUID; let email: String? }

struct PlatformStatus: Decodable, Sendable {
    let incidentActive: Bool
    let incidentMessage: String
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case incidentActive = "incident_active"
        case incidentMessage = "incident_message"
        case updatedAt = "updated_at"
    }
}

struct CompetitiveLeagueQualification: Decodable, Sendable, Equatable {
    let userId: UUID
    let eligibleCards: Int
    let lockedCards: Int
    let requiredLockedCards: Int
    let qualifies: Bool
}

struct CompetitiveLeagueStatus: Decodable, Sendable, Equatable {
    let leagueId: UUID?
    let sportId: String
    let status: String
    let activeHumanCount: Int
    let totalHumanCount: Int
    let minimumActivePlayers: Int
    let requiredParticipationPercent: Int
    let minimumLockedCards: Int
    let qualification: [CompetitiveLeagueQualification]

    var maximumEligibleCards: Int {
        qualification.map(\.eligibleCards).max() ?? 0
    }

    enum CodingKeys: String, CodingKey {
        case leagueId, sportId, status, activeHumanCount, totalHumanCount
        case minimumActivePlayers, requiredParticipationPercent, minimumLockedCards
        case qualification
    }

    static func foundryDemo(sportId: String) -> CompetitiveLeagueStatus {
        CompetitiveLeagueStatus(
            leagueId: nil,
            sportId: sportId,
            status: "demo",
            activeHumanCount: 0,
            totalHumanCount: 0,
            minimumActivePlayers: CompetitiveLeaguePolicy.minimumActivePlayers,
            requiredParticipationPercent: 75,
            minimumLockedCards: CompetitiveLeaguePolicy.minimumLockedCards,
            qualification: []
        )
    }
}

struct SignUpResponse: Decodable, Sendable {
    let accessToken: String?
    let refreshToken: String?
    let expiresIn: Int?
    let user: AuthUser
    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"; case refreshToken = "refresh_token"
        case expiresIn = "expires_in"; case user
    }
}

struct Standing: Decodable, Identifiable, Sendable {
    let id: UUID
    let userId: UUID
    let totalPoints: Int
    let weeklyPoints: [Int]
    let weeksPlayed: Int
    let displayNameOverride: String?
    let division: String?
    var fieldhouseRegion: String? = nil
    let profiles: Profile?
    let atsCorrect: Int
    let atsTotal: Int
    let currentStreak: Int
    let bestWeek: Int
    let worstWeek: Int
    let perfectWeeks: Int
    let bestBetHits: Int
    let bestBetTotal: Int
    let propHits: Int
    let propTotal: Int
    let isBot: Bool

    var name: String { displayNameOverride ?? profiles?.displayName ?? "Player" }

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case totalPoints = "total_points"
        case weeklyPoints = "weekly_points"
        case weeksPlayed = "weeks_played"
        case displayNameOverride = "display_name_override"
        case division
        case fieldhouseRegion = "fieldhouse_region"
        case profiles
        case atsCorrect = "ats_correct"
        case atsTotal = "ats_total"
        case currentStreak = "current_streak"
        case bestWeek = "best_week"
        case worstWeek = "worst_week"
        case perfectWeeks = "perfect_weeks"
        case bestBetHits = "best_bet_hits"
        case bestBetTotal = "best_bet_total"
        case propHits = "prop_hits"
        case propTotal = "prop_total"
        case isBot = "is_bot"
    }
}

struct Profile: Decodable, Sendable {
    let displayName: String?
    let avatarURL: String?
    let lastSeenAt: String?
    let equippedTitleId: String?
    let equippedBorderId: String?
    let equippedRankId: String?
    let careerRankFloor: String?
    let createdAt: String?
    let birthdayMMDD: String?
    let birthdayLockedAt: String?
    enum CodingKeys: String, CodingKey {
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case lastSeenAt = "last_seen_at"
        case equippedTitleId = "equipped_title_id"
        case equippedBorderId = "equipped_border_id"
        case equippedRankId = "equipped_rank_id"
        case careerRankFloor = "career_rank_floor"
        case createdAt = "created_at"
        case birthdayMMDD = "birthday_mmdd"
        case birthdayLockedAt = "birthday_locked_at"
    }
}

struct PatreonConnectionStatus: Decodable, Sendable, Equatable {
    let connected: Bool
    let patreonUserId: String?
    let displayName: String?
    let avatarURL: String?
    let membershipStatus: String?
    let currentlyEntitledAmountCents: Int?
    let connectedAt: String?
    let verifiedAt: String?
    let needsReauthorization: Bool?
    let foundingSupporterNumber: Int?

    enum CodingKeys: String, CodingKey {
        case connected
        case patreonUserId = "patreon_user_id"
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case membershipStatus = "membership_status"
        case currentlyEntitledAmountCents = "currently_entitled_amount_cents"
        case connectedAt = "connected_at"
        case verifiedAt = "verified_at"
        case needsReauthorization = "needs_reauthorization"
        case foundingSupporterNumber = "founding_supporter_number"
    }

    var badge: String {
        guard connected else { return "NOT CONNECTED" }
        if needsReauthorization == true { return "RECONNECT REQUIRED" }
        switch membershipStatus {
        case "active_patron": return "ACTIVE SUPPORTER"
        case "free_member": return "FREE MEMBER"
        case "declined_patron": return "PAYMENT ISSUE"
        case "former_patron": return "FORMER SUPPORTER"
        default: return "ACCOUNT CONNECTED"
        }
    }

    var recognitionTitle: String? {
        guard let foundingSupporterNumber, (1...10).contains(foundingSupporterNumber) else { return nil }
        return "FOUNDING TEN · #\(String(format: "%02d", foundingSupporterNumber))"
    }
}

private struct PatreonConnectionStart: Decodable {
    let authorizationURL: URL
    enum CodingKeys: String, CodingKey { case authorizationURL = "authorization_url" }
}

struct WeaponServiceSummary: Decodable, Sendable {
    let tacticalNukes: Int
    let deadHands: Int
    let jdams: Int
    let hellfires: Int
    let campaigns: Int
    let totalAuthorizations: Int

    static let empty = WeaponServiceSummary(tacticalNukes: 0, deadHands: 0, jdams: 0, hellfires: 0, campaigns: 0, totalAuthorizations: 0)

    enum CodingKeys: String, CodingKey {
        case tacticalNukes = "tactical_nukes"
        case deadHands = "dead_hands"
        case jdams, hellfires, campaigns
        case totalAuthorizations = "total_authorizations"
    }
}

struct LeagueMembership: Decodable, Identifiable, Sendable {
    let leagueId: UUID
    let role: String?
    let isModerator: Bool?
    let isDeputy: Bool?
    let totalPoints: Int?
    let weeklyPoints: [Int]?
    let weeksPlayed: Int?
    let division: String?
    var fieldhouseRegion: String? = nil
    let joinedAt: String?
    let atsCorrect: Int
    let atsTotal: Int
    let currentStreak: Int
    let bestWeek: Int
    let worstWeek: Int
    let perfectWeeks: Int
    let bestBetHits: Int
    let bestBetTotal: Int
    let propHits: Int
    let propTotal: Int
    let leagues: LeagueSummary
    var id: UUID { leagueId }
    nonisolated func isCommissioner(userId: UUID) -> Bool {
        role == "commissioner" || leagues.commissionerId == userId
    }
    enum CodingKeys: String, CodingKey {
        case leagueId = "league_id"
        case role, leagues
        case isModerator = "is_moderator"
        case isDeputy = "is_deputy"
        case totalPoints = "total_points"
        case weeklyPoints = "weekly_points"
        case weeksPlayed = "weeks_played"
        case division
        case fieldhouseRegion = "fieldhouse_region"
        case joinedAt = "joined_at"
        case atsCorrect = "ats_correct"
        case atsTotal = "ats_total"
        case currentStreak = "current_streak"
        case bestWeek = "best_week"
        case worstWeek = "worst_week"
        case perfectWeeks = "perfect_weeks"
        case bestBetHits = "best_bet_hits"
        case bestBetTotal = "best_bet_total"
        case propHits = "prop_hits"
        case propTotal = "prop_total"
    }
}

struct LeagueSummary: Decodable, Sendable {
    let name: String
    let code: String
    let sportId: String
    let currentWeek: Int
    let commissionerId: UUID
    let crystalBallEnabled: Bool
    let championshipTrophyId: String?
    let mode: String?
    let regularSeasonWeeks: Int
    let maxHumanMembers: Int
    let sportSettings: LeagueSportSettings?
    enum CodingKeys: String, CodingKey {
        case name, code
        case sportId = "sport_id"
        case currentWeek = "current_week"
        case commissionerId = "commissioner_id"
        case crystalBallEnabled = "crystal_ball_enabled"
        case championshipTrophyId = "championship_trophy_id"
        case mode
        case regularSeasonWeeks = "regular_season_weeks"
        case maxHumanMembers = "max_human_members"
        case sportSettings = "sport_settings"
    }
}

struct LeagueSportSettings: Decodable, Sendable {
    let fieldhouseLeague: String?

    enum CodingKeys: String, CodingKey {
        case fieldhouseLeague = "fieldhouse_league"
    }
}

struct LeagueCapacityUpdate: Decodable, Sendable {
    let ok: Bool
    let maxHumanMembers: Int
    let humanCount: Int
    enum CodingKeys: String, CodingKey {
        case ok
        case maxHumanMembers = "max_human_members"
        case humanCount = "human_count"
    }
}

struct CrystalBallPick: Decodable, Sendable {
    let teamName: String
    enum CodingKeys: String, CodingKey { case teamName = "team_name" }
}

struct CfbPostseasonEntry: Decodable, Sendable {
    let leagueId: UUID
    let userId: UUID
    let seasonKey: Int
    let bowlPicks: [String: String]
    let bowlAllocations: [String: Int]
    let deadHand: Bool
    let bowlLockedAt: String?
    let cfpPicks: [String: String]
    let cfpTotalPredictions: [String: Int]
    let cfpLockedAt: String?
    let bowlScore: Int?
    let cfpScore: Int?

    enum CodingKeys: String, CodingKey {
        case leagueId = "league_id"
        case userId = "user_id"
        case seasonKey = "season_key"
        case bowlPicks = "bowl_picks"
        case bowlAllocations = "bowl_allocations"
        case deadHand = "dead_hand"
        case bowlLockedAt = "bowl_locked_at"
        case cfpPicks = "cfp_picks"
        case cfpTotalPredictions = "cfp_total_predictions"
        case cfpLockedAt = "cfp_locked_at"
        case bowlScore = "bowl_score"
        case cfpScore = "cfp_score"
    }
}

struct CfbPostseasonSlate: Decodable, Sendable {
    let leagueId: UUID
    let seasonKey: Int
    let bowlGames: [CfbBowlGame]
    let cfpSeeds: [String]
    let publishedAt: String

    enum CodingKeys: String, CodingKey {
        case leagueId = "league_id"
        case seasonKey = "season_key"
        case bowlGames = "bowl_games"
        case cfpSeeds = "cfp_seeds"
        case publishedAt = "published_at"
    }
}

struct CfbPostseasonResults: Decodable, Sendable {
    let leagueId: UUID
    let seasonKey: Int
    let bowlResults: [String: String]
    let cfpResults: [String: String]

    enum CodingKeys: String, CodingKey {
        case leagueId = "league_id"
        case seasonKey = "season_key"
        case bowlResults = "bowl_results"
        case cfpResults = "cfp_results"
    }
}

struct FoundryCfbPostseasonStanding: Decodable, Identifiable, Sendable {
    let userId: UUID
    let displayName: String
    let deadHand: Bool
    let bowlLocked: Bool
    let cfpLocked: Bool
    let bowlPicks: [String: String]
    let cfpPicks: [String: String]
    let bowlScore: Int?
    let cfpScore: Int?
    let totalScore: Int
    var id: UUID { userId }
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"; case displayName = "display_name"; case deadHand = "dead_hand"
        case bowlLocked = "bowl_locked"; case cfpLocked = "cfp_locked"
        case bowlPicks = "bowl_picks"; case cfpPicks = "cfp_picks"
        case bowlScore = "bowl_score"; case cfpScore = "cfp_score"; case totalScore = "total_score"
    }
}

struct SportPoolVoter: Decodable, Identifiable, Sendable {
    let userId: UUID
    let name: String
    var id: UUID { userId }
    enum CodingKeys: String, CodingKey { case userId = "userId"; case name }
}

struct SportPoolPoll: Decodable, Identifiable, Sendable {
    let id: UUID
    let sourceLeagueId: UUID
    let targetSportId: String
    let proposedName: String
    let message: String
    let status: String
    let createdAt: String
    let expiresAt: String
    let yesCount: Int
    let noCount: Int
    let eligibleCount: Int
    let requiredYes: Int
    let myVote: String?
    let yesVoters: [SportPoolVoter]
    let canLaunch: Bool
    let createdLeagueId: UUID?
    let crewOverlapCount: Int?
    let crewRequired: Int?
    let crewQualified: Bool?
}

struct SportPoolLaunch: Decodable, Sendable {
    let ok: Bool
    let leagueId: UUID
    let code: String?
    let sportId: String?
    let name: String?
    let seats: Int
    enum CodingKeys: String, CodingKey {
        case ok, code, name, seats
        case leagueId = "league_id"
        case sportId = "sport_id"
    }
}

struct CfbPostseasonScore: Decodable, Identifiable, Sendable {
    let userId: UUID
    let bowlScore: Int?
    let cfpScore: Int?
    let postseasonTotal: Int
    var id: UUID { userId }
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case bowlScore = "bowl_score"
        case cfpScore = "cfp_score"
        case postseasonTotal = "postseason_total"
    }
}

private struct PickHeader: Decodable, Sendable { let userId: UUID; enum CodingKeys: String, CodingKey { case userId = "user_id" } }
private struct ChaosPickHeader: Decodable, Sendable { let weekNumber: Int; enum CodingKeys: String, CodingKey { case weekNumber = "week_number" } }

struct OddsFeed: Decodable, Sendable {
    let games: [OddsGame]
    let remaining: String?
    let used: String?
    let weekLabel: String?
    let rankLabel: String?
    let windowStartsAt: String?
    let windowEndsAt: String?
}

struct OddsGame: Decodable, Identifiable, Sendable {
    let id: String
    let awayTeam: String
    let homeTeam: String
    let spread: Double
    let favorite: String
    let commenceTime: String?
    let bookmaker: String?
    let awayRank: Int?
    let homeRank: Int?
}

struct FootballScoreFeed: Decodable, Sendable {
    let events: [FootballScoreEvent]
    let remaining: String?
    let used: String?
    let last: String?
    let cachedAt: String?
    let cacheHit: Bool?
    let stale: Bool?
}

struct FootballScoreEvent: Decodable, Identifiable, Sendable {
    let id: String
    let commenceTime: String?
    let completed: Bool
    let homeTeam: String
    let awayTeam: String
    let scores: [FootballTeamScore]
    let lastUpdate: String?
}

struct FootballTeamScore: Decodable, Sendable {
    let name: String
    let score: String
}

struct FieldhouseTournamentRecord: Decodable, Sendable {
    let id: UUID
    let sportId: String
    let seasonKey: Int
    let status: String
    let firstTipAt: String?
    enum CodingKeys: String, CodingKey {
        case id, status
        case sportId = "sport_id"
        case seasonKey = "season_key"
        case firstTipAt = "first_tip_at"
    }
}

struct FieldhouseTournamentTeamRecord: Decodable, Sendable {
    let teamId: String
    let displayName: String
    let region: String
    let seed: Int
    enum CodingKeys: String, CodingKey {
        case region, seed
        case teamId = "team_id"
        case displayName = "display_name"
    }
}

struct FieldhouseTournamentGameRecord: Decodable, Sendable {
    let gameId: String
    let roundKey: String
    let roundOrder: Int
    let ordinal: Int
    let region: String?
    let firstTeamId: String?
    let secondTeamId: String?
    let firstSourceGameId: String?
    let secondSourceGameId: String?
    let startsAt: String?
    let winnerTeamId: String?
    let firstScore: Int?
    let secondScore: Int?
    let firstMoneyline: Int?
    let secondMoneyline: Int?
    let oddsBookmaker: String?
    let oddsUpdatedAt: String?
    enum CodingKeys: String, CodingKey {
        case ordinal, region
        case gameId = "game_id"
        case roundKey = "round_key"
        case roundOrder = "round_order"
        case firstTeamId = "first_team_id"
        case secondTeamId = "second_team_id"
        case firstSourceGameId = "first_source_game_id"
        case secondSourceGameId = "second_source_game_id"
        case startsAt = "starts_at"
        case winnerTeamId = "winner_team_id"
        case firstScore = "first_score"
        case secondScore = "second_score"
        case firstMoneyline = "first_moneyline"
        case secondMoneyline = "second_moneyline"
        case oddsBookmaker = "odds_bookmaker"
        case oddsUpdatedAt = "odds_updated_at"
    }
}

struct FieldhouseRoundEntryRecord: Decodable, Sendable {
    let roundKey: String
    let picks: [String: String]
    let submittedAt: String?
    let lockedAt: String?
    let points: Int
    enum CodingKeys: String, CodingKey {
        case picks, points
        case roundKey = "round_key"
        case submittedAt = "submitted_at"
        case lockedAt = "locked_at"
    }
}

struct FieldhouseRoundSaveResponse: Decodable, Sendable {
    let ok: Bool
    let round: String
    let picks: Int
}

struct FieldhouseFieldImportResponse: Decodable, Sendable {
    let ok: Bool
    let tournamentId: UUID
    let published: Bool
    let teams: Int
    let games: Int
}

struct FieldhouseScheduleSyncResponse: Decodable, Sendable {
    let ok: Bool
    let tournamentId: UUID
    let updatedGames: Int
}

struct FieldhouseBracketEntryRecord: Decodable, Sendable {
    let picks: [String: String]
    let submittedAt: String?
    let lockedAt: String?
    let hellfireUsed: Bool
    enum CodingKeys: String, CodingKey {
        case picks
        case submittedAt = "submitted_at"
        case lockedAt = "locked_at"
        case hellfireUsed = "hellfire_used"
    }
}

struct FieldhousePostseasonTotalRecord: Codable, Equatable, Identifiable, Sendable {
    let tournamentId: UUID
    let leagueId: UUID
    let userId: UUID
    let bracketCorrectPicks: Int
    let bracketRawPoints: Int
    let bracketAdjustedPoints: Int
    let roundPoints: Int
    let totalPoints: Int
    let updatedAt: String

    var id: UUID { userId }

    enum CodingKeys: String, CodingKey {
        case tournamentId = "tournament_id"
        case leagueId = "league_id"
        case userId = "user_id"
        case bracketCorrectPicks = "bracket_correct_picks"
        case bracketRawPoints = "bracket_raw_points"
        case bracketAdjustedPoints = "bracket_adjusted_points"
        case roundPoints = "round_points"
        case totalPoints = "total_points"
        case updatedAt = "updated_at"
    }
}

struct FieldhousePostseasonQualifierRecord: Codable, Equatable, Identifiable, Sendable {
    let tournamentId: UUID
    let leagueId: UUID
    let userId: UUID
    let fieldhouseRegion: String
    let path: String
    let regularRank: Int
    let regularPoints: Int
    let frozenAt: String

    var id: UUID { userId }

    enum CodingKeys: String, CodingKey {
        case tournamentId = "tournament_id"
        case leagueId = "league_id"
        case userId = "user_id"
        case fieldhouseRegion = "fieldhouse_region"
        case path
        case regularRank = "regular_rank"
        case regularPoints = "regular_points"
        case frozenAt = "frozen_at"
    }
}

struct FieldhouseBracketSaveResponse: Decodable, Sendable {
    let ok: Bool
    let locked: Bool
}

enum AppIdentity {
    static let creatorUserIds: Set<UUID> = [UUID(uuidString: "09544d2b-6eca-4131-a321-c000586c9029")!]
    static func isCreator(_ userId: UUID?) -> Bool { userId.map(creatorUserIds.contains) ?? false }
}

struct WeekCard: Decodable, Identifiable, Sendable {
    let id: UUID
    let weekNumber: Int
    let cardKind: String?
    let lockTime: String?
    let propQuestion: String?
    let propOptionA: String?
    let propOptionB: String?
    let propPoints: Int
    let cardGames: [CardGame]

    init(
        id: UUID,
        weekNumber: Int,
        cardKind: String? = nil,
        lockTime: String?,
        propQuestion: String?,
        propOptionA: String?,
        propOptionB: String?,
        propPoints: Int,
        cardGames: [CardGame]
    ) {
        self.id = id
        self.weekNumber = weekNumber
        self.cardKind = cardKind
        self.lockTime = lockTime
        self.propQuestion = propQuestion
        self.propOptionA = propOptionA
        self.propOptionB = propOptionB
        self.propPoints = propPoints
        self.cardGames = cardGames
    }

    enum CodingKeys: String, CodingKey {
        case id
        case weekNumber = "week_number"
        case cardKind = "card_kind"
        case lockTime = "lock_time"
        case propQuestion = "prop_question"
        case propOptionA = "prop_option_a"
        case propOptionB = "prop_option_b"
        case propPoints = "prop_points"
        case cardGames = "card_games"
    }
}

struct CfbAPRanking: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let market: String
    let rank: Int
    let points: Int
    let firstPlaceVotes: Int
    enum CodingKeys: String, CodingKey {
        case id, name, market, rank, points
        case firstPlaceVotes = "fp_votes"
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        name = try values.decode(String.self, forKey: .name)
        market = try values.decode(String.self, forKey: .market)
        rank = try values.decode(Int.self, forKey: .rank)
        points = try values.decode(Int.self, forKey: .points)
        firstPlaceVotes = try values.decodeIfPresent(Int.self, forKey: .firstPlaceVotes) ?? 0
    }
}

struct CfbPollSnapshot: Decodable, Sendable {
    let season: Int
    let pollWeek: Int
    let roomWeek: Int
    let pollName: String
    let effectiveAt: String?
    let fetchedAt: String
    let rankings: [CfbAPRanking]
    let filedCount: Int
    let official: Bool
    let revealAt: String
    let revealed: Bool
    let ownBallot: [String]
    let memberResults: [CfbMemberPollRow]
}

struct CardGame: Decodable, Identifiable, Sendable {
    let id: UUID
    let sortOrder: Int
    let awayTeam: String
    let homeTeam: String
    let spread: Double
    let favorite: String
    let startTime: String?
    var bookmaker: String? = nil
    let awayRank: Int?
    let homeRank: Int?
    let isRivalry: Bool
    let fieldhouseConference: String?

    init(
        id: UUID,
        sortOrder: Int,
        awayTeam: String,
        homeTeam: String,
        spread: Double,
        favorite: String,
        startTime: String?,
        bookmaker: String? = nil,
        awayRank: Int?,
        homeRank: Int?,
        isRivalry: Bool,
        fieldhouseConference: String? = nil
    ) {
        self.id = id
        self.sortOrder = sortOrder
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.spread = spread
        self.favorite = favorite
        self.startTime = startTime
        self.bookmaker = bookmaker
        self.awayRank = awayRank
        self.homeRank = homeRank
        self.isRivalry = isRivalry
        self.fieldhouseConference = fieldhouseConference
    }

    enum CodingKeys: String, CodingKey {
        case id
        case sortOrder = "sort_order"
        case awayTeam = "away_team"
        case homeTeam = "home_team"
        case spread, favorite
        case startTime = "start_time"
        case bookmaker
        case awayRank = "away_rank"
        case homeRank = "home_rank"
        case isRivalry = "is_rivalry"
        case fieldhouseConference = "fieldhouse_conference"
    }
}

struct ScoreWeekResponse: Decodable, Sendable {
    let ok: Bool
    let weekResultId: UUID
    let scoredCount: Int
    let details: [ScoreWeekDetail]
    let dispatchId: UUID?
    let crownName: String?
    let crownPoints: Int?
    let shameName: String?
    let shamePoints: Int?
    let lockerQuote: String?
    let nextWeek: Int?
    let phase: String?
    let nextCardReady: Bool?
}

struct CompleteFoundrySeasonResponse: Decodable, Sendable {
    let ok: Bool
    let fromWeek: Int
    let postseasonWeek: Int
    let weeksProcessed: Int
}

struct StageFoundryRivalryResponse: Decodable, Sendable {
    let ok: Bool
    let fromWeek: Int
    let rivalryWeek: Int
    let weeksProcessed: Int
}

struct SeedFoundryRivalryHistoryResponse: Decodable, Sendable {
    let ok: Bool
    let historyRows: Int
    let pastSeasons: Int
}

struct FoundryLockResponse: Decodable, Sendable {
    let ok: Bool
    let week: Int
    let lockedCards: Int
    let kickoffAt: String
}

struct FoundryPostseasonWeekResponse: Decodable, Sendable {
    let ok: Bool
    let week: Int
    let phase: String
    let lockedCards: Int?
    let scoredCards: Int?
    let nextWeek: Int?
    let dispatchId: UUID?
}

struct FoundryNflPostseasonSeedResponse: Decodable, Sendable {
    let ok: Bool
    let seasonKey: Int
    let botsSeeded: Int
    let decisionCount: Int
}

struct PostseasonScoreComponent: Decodable, Sendable {
    let label: String
    let points: Int
}

struct PostseasonScorecard: Decodable, Identifiable, Sendable {
    let leagueId: UUID
    let userId: UUID
    let seasonKey: Int
    let weekNumber: Int
    let phase: String
    let components: [PostseasonScoreComponent]
    let weeklyTotal: Int
    let seasonTotalBefore: Int
    let seasonTotalAfter: Int
    let rankBefore: Int?
    let rankAfter: Int?
    let createdAt: String
    var weeklyPredictedTotal: Int? = nil
    var weeklyActualTotal: Int? = nil
    var tiebreakDistance: Int? = nil
    var weeklyTiebreakWon: Bool? = nil
    var id: String { "\(leagueId.uuidString)-\(userId.uuidString)-\(seasonKey)-\(weekNumber)" }
    enum CodingKeys: String, CodingKey {
        case phase, components
        case leagueId = "league_id", userId = "user_id", seasonKey = "season_key"
        case weekNumber = "week_number", weeklyTotal = "weekly_total"
        case seasonTotalBefore = "season_total_before", seasonTotalAfter = "season_total_after"
        case rankBefore = "rank_before", rankAfter = "rank_after", createdAt = "created_at"
        case weeklyPredictedTotal = "weekly_predicted_total"
        case weeklyActualTotal = "weekly_actual_total"
        case tiebreakDistance = "tiebreak_distance"
        case weeklyTiebreakWon = "weekly_tiebreak_won"
    }
}

struct FoundrySeasonLifecycle: Decodable, Sendable {
    let leagueId: UUID
    let runNumber: Int
    let stage: String
    let weekNumber: Int
    let updatedAt: String
}

struct ScoreWeekDetail: Decodable, Identifiable, Sendable {
    let userId: UUID
    let name: String
    let points: Int
    var id: UUID { userId }
}

struct FoundryPickReview: Decodable, Identifiable, Sendable {
    let id: UUID
    let userId: UUID
    let totalPoints: Int?
    let propChoice: String?
    let profiles: Profile?
    let pickGames: [PickedGame]
    var name: String { profiles?.displayName ?? "Bot" }
    enum CodingKeys: String, CodingKey {
        case id, profiles
        case userId = "user_id"
        case totalPoints = "total_points"
        case propChoice = "prop_choice"
        case pickGames = "pick_games"
    }
}

struct BoardPick: Decodable, Identifiable, Sendable {
    let id: UUID
    let userId: UUID
    let totalPoints: Int?
    let propChoice: String?
    let displayName: String
    let favoriteTeamId: String?
    let pickGames: [PickedGame]
    var name: String { displayName }

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case totalPoints = "total_points"
        case propChoice = "prop_choice"
        case displayName = "display_name"
        case favoriteTeamId = "favorite_team_id"
        case pickGames = "pick_games"
    }
}

struct FieldhouseLiveBoardPick: Decodable, Identifiable, Sendable {
    let id: UUID
    let userId: UUID
    let totalPoints: Int?
    let propChoice: String?
    let isHellfire: Bool
    let pickGames: [PickedGame]

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case totalPoints = "total_points"
        case propChoice = "prop_choice"
        case isHellfire = "is_hellfire"
        case pickGames = "pick_games"
    }
}

struct PlayerPick: Decodable, Identifiable, Sendable {
    let id: UUID
    let propChoice: String?
    let lockedAt: String?
    let totalPoints: Int?
    let isChaos: Bool
    let pickGames: [PickedGame]

    var isLocked: Bool { lockedAt != nil }

    enum CodingKeys: String, CodingKey {
        case id
        case propChoice = "prop_choice"
        case lockedAt = "locked_at"
        case totalPoints = "total_points"
        case isChaos = "is_chaos"
        case pickGames = "pick_games"
    }
}

struct SeasonPlayerPick: Decodable, Identifiable, Sendable {
    let id: UUID
    let weekNumber: Int
    let propChoice: String?
    let lockedAt: String?
    let totalPoints: Int?
    let isChaos: Bool
    let pickGames: [PickedGame]

    enum CodingKeys: String, CodingKey {
        case id
        case weekNumber = "week_number"
        case propChoice = "prop_choice"
        case lockedAt = "locked_at"
        case totalPoints = "total_points"
        case isChaos = "is_chaos"
        case pickGames = "pick_games"
    }
}

struct CertifiedWeekResult: Decodable, Identifiable, Sendable {
    let id: UUID
    let weekNumber: Int
    let propResult: String?
    let scoredAt: String
    let gameResults: [CertifiedGameResult]

    enum CodingKeys: String, CodingKey {
        case id
        case weekNumber = "week_number"
        case propResult = "prop_result"
        case scoredAt = "scored_at"
        case gameResults = "game_results"
    }
}

struct CertifiedGameResult: Decodable, Sendable {
    let cardGameId: UUID
    let winner: String
    let awayScore: Int?
    let homeScore: Int?
    enum CodingKeys: String, CodingKey {
        case cardGameId = "card_game_id"
        case winner
        case awayScore = "away_score"
        case homeScore = "home_score"
    }
}

struct RegularSeasonScorecard: Identifiable, Sendable {
    let card: WeekCard
    let pick: SeasonPlayerPick
    let result: CertifiedWeekResult
    let seasonTotalBefore: Int
    let seasonTotalAfter: Int
    var id: String { "\(card.id.uuidString)-\(pick.id.uuidString)" }
    var weekNumber: Int { card.weekNumber }
    var totalPoints: Int { pick.totalPoints ?? 0 }
}

struct PickedGame: Decodable, Sendable {
    let cardGameId: UUID
    let side: String
    let confidence: Int
    let isBestBet: Bool

    enum CodingKeys: String, CodingKey {
        case cardGameId = "card_game_id"
        case side, confidence
        case isBestBet = "is_best_bet"
    }
}

struct PickSubmission: Sendable {
    let gameId: UUID
    let side: String
    let confidence: Int
}

struct SavedPickResponse: Decodable, Sendable {
    let pickId: UUID
    let lockedAt: String

    enum CodingKeys: String, CodingKey {
        case pickId = "pick_id"
        case lockedAt = "locked_at"
    }
}

struct LockerMessage: Decodable, Identifiable, Sendable {
    let id: UUID
    let leagueId: UUID
    let userId: UUID
    let body: String
    let createdAt: String
    let profiles: Profile?
    let lockerMessageReactions: [LockerReaction]

    var authorName: String { profiles?.displayName ?? "Player" }

    enum CodingKeys: String, CodingKey {
        case id, body, profiles
        case leagueId = "league_id"
        case userId = "user_id"
        case createdAt = "created_at"
        case lockerMessageReactions = "locker_message_reactions"
    }
}

struct LockerReaction: Decodable, Identifiable, Sendable {
    let id: UUID
    let userId: UUID
    let emoji: String

    enum CodingKeys: String, CodingKey {
        case id, emoji
        case userId = "user_id"
    }
}

struct ProfileAchievement: Decodable, Identifiable, Sendable {
    let leagueId: UUID
    let code: String
    let title: String
    let flavor: String
    let earnedAt: String
    var id: String { "\(leagueId.uuidString)-\(code)" }
    enum CodingKeys: String, CodingKey {
        case code, title, flavor
        case leagueId = "league_id"
        case earnedAt = "earned_at"
    }
}

private struct CareerChampionMilestone: Decodable, Sendable {
    let triggeringLeagueId: UUID
    let achievementCode: String
    let title: String
    let flavor: String
    let achievedAt: String

    var achievement: ProfileAchievement {
        ProfileAchievement(
            leagueId: triggeringLeagueId,
            code: achievementCode,
            title: title,
            flavor: flavor,
            earnedAt: achievedAt
        )
    }

    enum CodingKeys: String, CodingKey {
        case title, flavor
        case triggeringLeagueId = "triggering_league_id"
        case achievementCode = "achievement_code"
        case achievedAt = "achieved_at"
    }
}

struct ProfileTrophy: Decodable, Identifiable, Sendable {
    let id: UUID
    let leagueId: UUID
    let seasonYear: Int
    let trophyType: String
    let winnerName: String
    let winnerUserId: UUID?
    let subtitle: String?
    let notes: String?
    let awardedAt: String
    let trophyDesignId: String?
    enum CodingKeys: String, CodingKey {
        case id, subtitle, notes
        case leagueId = "league_id"
        case seasonYear = "season_year"
        case trophyType = "trophy_type"
        case winnerName = "winner_name"
        case winnerUserId = "winner_user_id"
        case awardedAt = "awarded_at"
        case trophyDesignId = "trophy_design_id"
    }
}

struct LeagueSeasonCloseout: Decodable, Identifiable, Sendable {
    let id: UUID
    let leagueId: UUID
    let seasonKey: Int
    let sportId: String
    let competitionType: String
    let nationalChampion: String
    let leagueChampionId: UUID
    let leagueChampionIds: [UUID]
    let closedAt: String

    nonisolated var authoritativeChampionIds: [UUID] {
        leagueChampionIds.isEmpty ? [leagueChampionId] : leagueChampionIds
    }

    enum CodingKeys: String, CodingKey {
        case id
        case leagueId = "league_id"
        case seasonKey = "season_key"
        case sportId = "sport_id"
        case competitionType = "competition_type"
        case nationalChampion = "national_champion"
        case leagueChampionId = "league_champion_id"
        case leagueChampionIds = "league_champion_ids"
        case closedAt = "closed_at"
    }
}

struct SportSeasonWindow: Codable, Sendable, Equatable {
    let sportId: String
    let seasonKey: Int
    let firstEventAt: String
    let seasonEndsAt: String
    let timingStatus: String
    let displayLabel: String?

    nonisolated var isEstimated: Bool { timingStatus.lowercased() == "estimated" }

    enum CodingKeys: String, CodingKey {
        case sportId = "sport_id"
        case seasonKey = "season_key"
        case firstEventAt = "first_event_at"
        case seasonEndsAt = "season_ends_at"
        case timingStatus = "timing_status"
        case displayLabel = "display_label"
    }
}

struct SportCardWindow: Codable, Sendable, Equatable {
    let sportId: String
    let seasonKey: Int
    let weekNumber: Int
    let windowStartsAt: String?
    let windowEndsAt: String?
    let firstGameAt: String
    let timingStatus: String
    let displayLabel: String?

    nonisolated var isEstimated: Bool { timingStatus.lowercased() == "estimated" }

    enum CodingKeys: String, CodingKey {
        case sportId = "sport_id"
        case seasonKey = "season_key"
        case weekNumber = "week_number"
        case windowStartsAt = "window_starts_at"
        case windowEndsAt = "window_ends_at"
        case firstGameAt = "first_game_at"
        case timingStatus = "timing_status"
        case displayLabel = "display_label"
    }
}

struct FavoriteTeam: Decodable, Sendable {
    let sportId: String
    let teamId: String
    enum CodingKeys: String, CodingKey {
        case sportId = "sport_id"
        case teamId = "team_id"
    }
}

struct FavoriteTeamRecord: Decodable, Sendable {
    let userId: UUID
    let sportId: String
    let teamId: String
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case sportId = "sport_id"
        case teamId = "team_id"
    }
}

struct Announcement: Decodable, Identifiable, Sendable {
    let id: UUID
    let leagueId: UUID
    let authorId: UUID
    let title: String
    let body: String
    let createdAt: String
    let profiles: Profile?
    let announcementReads: [AnnouncementRead]

    nonisolated var authorName: String { profiles?.displayName ?? "Commissioner" }
    nonisolated var isUnread: Bool { announcementReads.isEmpty }

    enum CodingKeys: String, CodingKey {
        case id, title, body, profiles
        case leagueId = "league_id"
        case authorId = "author_id"
        case createdAt = "created_at"
        case announcementReads = "announcement_reads"
    }
}

struct AnnouncementRead: Decodable, Sendable {
    let userId: UUID
    enum CodingKeys: String, CodingKey { case userId = "user_id" }
}

struct GazetteStory: Decodable, Sendable {
    let names: [String]?
    let pts: Int?
    let headline: String?
    let deck: String?
    let kind: String?
}

struct GazetteWeather: Decodable, Sendable { let kicker: String?; let body: String? }
private struct DormantLeagueWeekPayload: Decodable, Sendable { let week: Int }
struct GazetteSideStory: Decodable, Sendable { let kicker: String?; let headline: String?; let body: String? }
struct GazettePullQuote: Decodable, Sendable { let text: String?; let by: String? }
struct GazettePromotionOrder: Decodable, Sendable { let name: String?; let from: String?; let to: String?; let deck: String? }

struct GazettePayload: Decodable, Sendable {
    let weekIndex: Int?
    let weekLabel: String?
    let volumeLabel: String?
    let coverageLine: String?
    let crown: GazetteStory?
    let shame: GazetteStory?
    let standingsDeadlock: GazetteStory?
    let noLock: GazetteStory?
    let crystalBallMiss: GazetteStory?
    let swing: GazetteStory?
    let rivalryWatch: GazetteStory?
    let chaosDetonation: GazetteStory?
    let emergencyProtocol: String?
    let promotionOrders: [GazettePromotionOrder]?
    let masthead: String?
    let tagline: String?
    let printedLine: String?
    let weather: GazetteWeather?
    let classifieds: [String]?
    let pullQuote: GazettePullQuote?
    let sideStories: [GazetteSideStory]?
    let ritualName: String?
    let sportId: String?
    let stampLine: String?
    let eventLine: String?
}

struct GazetteEditionRow: Decodable, Identifiable, Sendable {
    let id: UUID
    let weekNumber: Int
    let weekLabel: String
    let volumeLabel: String
    let payload: GazettePayload
    let createdAt: String
    enum CodingKeys: String, CodingKey {
        case id, payload
        case weekNumber = "week_number"
        case weekLabel = "week_label"
        case volumeLabel = "volume_label"
        case createdAt = "created_at"
    }
}

enum SupabaseAPI {
    static func platformStatus(token: String) async throws -> PlatformStatus? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/platform_status"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "incident_active,incident_message,updated_at"),
            URLQueryItem(name: "id", value: "eq.1"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [PlatformStatus].self).first
    }

    static func setPlatformStatus(token: String, active: Bool, message: String) async throws -> PlatformStatus {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/platform_status"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "id", value: "eq.1")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "incident_active": active,
            "incident_message": message,
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ])
        guard let saved = try await send(request, as: [PlatformStatus].self).first,
              saved.incidentActive == active,
              saved.incidentMessage == message else {
            throw RequestError(message: "The server did not confirm the app announcement.")
        }
        return saved
    }

    static func signIn(email: String, password: String) async throws -> AuthSession {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "password")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["email": email, "password": password])
        return try await send(request, as: AuthSession.self)
    }

    static func signUp(email: String, password: String, displayName: String) async throws -> SignUpResponse {
        var request = URLRequest(url: SupabaseConfiguration.baseURL.appending(path: "auth/v1/signup"))
        request.httpMethod = "POST"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["email": email, "password": password, "data": ["display_name": displayName]]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await send(request, as: SignUpResponse.self)
    }

    static func sendPasswordReset(email: String) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "auth/v1/recover"), resolvingAgainstBaseURL: false)!
        // Keep password recovery in the browser. The app.war-room-picks.com
        // host is a Universal Link, so iOS opens the native app before the web
        // reset page can exchange the recovery token. The native login screen
        // cannot complete that exchange and strands the player back at login.
        components.queryItems = [URLQueryItem(name: "redirect_to", value: "https://www.war-room-picks.com/reset-password")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["email": email])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "The reset email could not be sent. Try again."
            throw RequestError(message: message)
        }
    }

    static func currentUser(token: String) async throws -> AuthUser {
        var request = URLRequest(url: SupabaseConfiguration.baseURL.appending(path: "auth/v1/user"))
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return try await send(request, as: AuthUser.self)
    }

    static func refreshSession(refreshToken: String) async throws -> AuthSession {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["refresh_token": refreshToken])
        return try await send(request, as: AuthSession.self)
    }

    static func leagueMemberships(token: String, userId: UUID, includeFoundry: Bool = false) async throws -> [LeagueMembership] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/memberships"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "league_id,role,is_moderator,is_deputy,total_points,weekly_points,weeks_played,division,fieldhouse_region,joined_at,ats_correct,ats_total,current_streak,best_week,worst_week,perfect_weeks,best_bet_hits,best_bet_total,prop_hits,prop_total,leagues(name,code,sport_id,sport_settings,current_week,regular_season_weeks,commissioner_id,crystal_ball_enabled,championship_trophy_id,mode,max_human_members)"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
        ]
        var request = URLRequest(url: components.url!)
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let rows: [LeagueMembership] = try await send(request, as: [LeagueMembership].self)
        return includeFoundry ? rows : rows.filter { $0.leagues.mode != "foundry" }
    }

    static func activeLeague(token: String, userId: UUID, preferredLeagueId: UUID? = nil) async throws -> LeagueMembership {
        let rows = try await leagueMemberships(token: token, userId: userId)
        if let preferredLeagueId, let preferred = rows.first(where: { $0.leagueId == preferredLeagueId }) { return preferred }
        guard let membership = rows.first else { throw RequestError(message: "This account has no league membership.") }
        return membership
    }

    static func weekCard(token: String, leagueId: UUID, weekNumber: Int) async throws -> WeekCard? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/week_cards"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,week_number,card_kind,lock_time,prop_question,prop_option_a,prop_option_b,prop_points,card_games(id,sort_order,away_team,home_team,spread,favorite,start_time,away_rank,home_rank,is_rivalry,fieldhouse_conference)"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "week_number", value: "eq.\(weekNumber)"),
            URLQueryItem(name: "card_games.order", value: "sort_order.asc"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        var request = authorizedRequest(url: components.url!, token: token)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await send(request, as: [WeekCard].self).first
    }

    static func playerPick(token: String, leagueId: UUID, userId: UUID, weekNumber: Int) async throws -> PlayerPick? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/picks"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,prop_choice,locked_at,total_points,is_chaos,pick_games(card_game_id,side,confidence,is_best_bet)"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "week_number", value: "eq.\(weekNumber)"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        let request = authorizedRequest(url: components.url!, token: token)
        return try await send(request, as: [PlayerPick].self).first
    }

    static func cfbPolls(token: String, leagueId: UUID, week: Int, rankedTeamIds: [String]? = nil) async throws -> CfbPollSnapshot {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "functions/v1/cfb-polls"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: Any] = [
            "action": rankedTeamIds == nil ? "load" : "save",
            "leagueId": leagueId.uuidString.lowercased(),
            "week": week,
            "season": Calendar.current.component(.year, from: Date()),
        ]
        if let rankedTeamIds { body["rankedTeamIds"] = rankedTeamIds }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await send(request, as: CfbPollSnapshot.self)
    }

    static func myLeaguesWeekResult(token: String, leagueId: UUID, week: Int) async throws -> CertifiedWeekResult? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/week_results"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,week_number,prop_result,scored_at,game_results(card_game_id,winner,away_score,home_score)"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "week_number", value: "eq.\(week)"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [CertifiedWeekResult].self).first
    }

    static func regularSeasonScorecards(token: String, leagueId: UUID, userId: UUID) async throws -> [RegularSeasonScorecard] {
        var pickComponents = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/picks"), resolvingAgainstBaseURL: false)!
        pickComponents.queryItems = [
            URLQueryItem(name: "select", value: "id,week_number,prop_choice,locked_at,total_points,is_chaos,pick_games(card_game_id,side,confidence,is_best_bet)"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "locked_at", value: "not.is.null"),
            URLQueryItem(name: "total_points", value: "not.is.null"),
            URLQueryItem(name: "order", value: "week_number.desc"),
        ]

        var resultComponents = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/week_results"), resolvingAgainstBaseURL: false)!
        resultComponents.queryItems = [
            URLQueryItem(name: "select", value: "id,week_number,prop_result,scored_at,game_results(card_game_id,winner,away_score,home_score)"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "week_number.desc"),
        ]

        var cardComponents = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/week_cards"), resolvingAgainstBaseURL: false)!
        cardComponents.queryItems = [
            URLQueryItem(name: "select", value: "id,week_number,card_kind,lock_time,prop_question,prop_option_a,prop_option_b,prop_points,card_games(id,sort_order,away_team,home_team,spread,favorite,start_time,away_rank,home_rank,is_rivalry,fieldhouse_conference)"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "card_games.order", value: "sort_order.asc"),
            URLQueryItem(name: "order", value: "week_number.desc"),
        ]

        let pickURL = pickComponents.url!
        let resultURL = resultComponents.url!
        let cardURL = cardComponents.url!
        async let picks: [SeasonPlayerPick] = send(authorizedRequest(url: pickURL, token: token), as: [SeasonPlayerPick].self)
        async let results: [CertifiedWeekResult] = send(authorizedRequest(url: resultURL, token: token), as: [CertifiedWeekResult].self)
        async let cards: [WeekCard] = send(authorizedRequest(url: cardURL, token: token), as: [WeekCard].self)
        let (loadedPicks, loadedResults, loadedCards) = try await (picks, results, cards)
        let resultsByWeek = Dictionary(uniqueKeysWithValues: loadedResults.map { ($0.weekNumber, $0) })
        let cardsByWeek = Dictionary(uniqueKeysWithValues: loadedCards.map { ($0.weekNumber, $0) })
        let rows = loadedPicks.compactMap { pick -> RegularSeasonScorecard? in
            guard let result = resultsByWeek[pick.weekNumber], let card = cardsByWeek[pick.weekNumber] else { return nil }
            return RegularSeasonScorecard(card: card, pick: pick, result: result, seasonTotalBefore: 0, seasonTotalAfter: 0)
        }
        var running = 0
        let withTotals = rows.sorted { $0.weekNumber < $1.weekNumber }.map { row in
            let before = running
            running += row.totalPoints
            return RegularSeasonScorecard(
                card: row.card,
                pick: row.pick,
                result: row.result,
                seasonTotalBefore: before,
                seasonTotalAfter: running
            )
        }
        return withTotals.sorted { $0.weekNumber > $1.weekNumber }
    }

    static func tacticalNukesUsed(token: String, leagueId: UUID, userId: UUID) async throws -> Int {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/picks"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "week_number"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "is_chaos", value: "eq.true"),
        ]
        return Set(try await send(authorizedRequest(url: components.url!, token: token), as: [ChaosPickHeader].self).map(\.weekNumber)).count
    }

    static func weekSubmittedUserIds(token: String, leagueId: UUID, weekNumber: Int) async throws -> Set<UUID> {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/get_week_lock_status"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_week_number": weekNumber
        ])
        return Set(try await send(request, as: [PickHeader].self).map(\.userId))
    }

    static func foundryPickReviews(token: String, leagueId: UUID, weekNumber: Int) async throws -> [FoundryPickReview] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/picks"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,user_id,total_points,prop_choice,profiles(display_name),pick_games(card_game_id,side,confidence,is_best_bet)"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "week_number", value: "eq.\(weekNumber)"),
            URLQueryItem(name: "order", value: "total_points.desc"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [FoundryPickReview].self)
    }

    static func weekBoard(token: String, leagueId: UUID, weekNumber: Int) async throws -> [BoardPick] {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/get_week_board"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_week_number": weekNumber
        ])
        return try await send(request, as: [BoardPick].self)
    }

    static func fieldhouseLiveBoard(token: String, leagueId: UUID, weekNumber: Int) async throws -> [FieldhouseLiveBoardPick] {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/get_fieldhouse_live_board"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_week_number": weekNumber
        ])
        return try await send(request, as: [FieldhouseLiveBoardPick].self)
    }

    static func crystalBallPick(token: String, leagueId: UUID, userId: UUID) async throws -> CrystalBallPick? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/crystal_ball_picks"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "team_name"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [CrystalBallPick].self).first
    }

    static func cfbPostseasonEntry(token: String, leagueId: UUID, userId: UUID, seasonKey: Int) async throws -> CfbPostseasonEntry? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/cfb_postseason_entries"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "league_id,user_id,season_key,bowl_picks,bowl_allocations,dead_hand,bowl_locked_at,cfp_picks,cfp_locked_at,bowl_score,cfp_score"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "season_key", value: "eq.\(seasonKey)"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [CfbPostseasonEntry].self).first
    }

    static func cfbPostseasonSlate(token: String, leagueId: UUID, seasonKey: Int) async throws -> CfbPostseasonSlate? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/cfb_postseason_slates"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "league_id,season_key,bowl_games,cfp_seeds,published_at"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "season_key", value: "eq.\(seasonKey)"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [CfbPostseasonSlate].self).first
    }

    static func publishCfbPostseasonSlate(token: String, leagueId: UUID, seasonKey: Int, bowlGames: [CfbBowlGame], cfpSeeds: [String]) async throws -> CfbPostseasonSlate {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/publish_cfb_postseason_slate"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let encoder = JSONEncoder()
        let bowls = try JSONSerialization.jsonObject(with: encoder.encode(bowlGames))
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_season_key": seasonKey,
            "p_bowl_games": bowls,
            "p_cfp_seeds": cfpSeeds,
        ])
        return try await send(request, as: CfbPostseasonSlate.self)
    }

    static func cfbPostseasonResults(token: String, leagueId: UUID, seasonKey: Int) async throws -> CfbPostseasonResults? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/cfb_postseason_results"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "league_id,season_key,bowl_results,cfp_results"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "season_key", value: "eq.\(seasonKey)"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [CfbPostseasonResults].self).first
    }

    static func saveCfbPostseasonResults(token: String, leagueId: UUID, seasonKey: Int, bowlResults: [String: String], cfpResults: [String: String]) async throws -> CfbPostseasonResults {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/cfb_postseason_results"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "on_conflict", value: "league_id,season_key")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=merge-duplicates,return=representation", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "league_id": leagueId.uuidString.lowercased(), "season_key": seasonKey,
            "bowl_results": bowlResults, "cfp_results": cfpResults,
        ])
        guard let row = try await send(request, as: [CfbPostseasonResults].self).first else { throw RequestError(message: "Postseason results were not returned.") }
        return row
    }

    static func foundryCfbPostseasonStandings(token: String, leagueId: UUID, seasonKey: Int) async throws -> [FoundryCfbPostseasonStanding] {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/get_foundry_cfb_postseason_standings"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_league_id": leagueId.uuidString.lowercased(), "p_season_key": seasonKey])
        return try await send(request, as: [FoundryCfbPostseasonStanding].self)
    }

    static func cfbPostseasonScoreboard(token: String, leagueId: UUID, seasonKey: Int) async throws -> [CfbPostseasonScore] {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/get_cfb_postseason_scoreboard"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_league_id": leagueId.uuidString.lowercased(), "p_season_key": seasonKey])
        return try await send(request, as: [CfbPostseasonScore].self)
    }

    static func sportPoolPoll(token: String, leagueId: UUID) async throws -> SportPoolPoll? {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/get_sport_pool_poll"), token: token)
        request.httpMethod = "POST"; request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_source_league_id": leagueId.uuidString.lowercased()])
        let (data,response)=try await URLSession.shared.data(for:request)
        guard let http=response as? HTTPURLResponse,(200..<300).contains(http.statusCode) else { throw RequestError(message:"The run-it-back vote could not be opened.") }
        if data == Data("null".utf8) { return nil }
        return try JSONDecoder().decode(SportPoolPoll.self,from:data)
    }

    static func createSportPoolPoll(token: String, leagueId: UUID, targetSport: String, name: String, message: String) async throws -> SportPoolPoll {
        var request=authorizedRequest(url:SupabaseConfiguration.baseURL.appending(path:"rest/v1/rpc/create_sport_pool_poll"),token:token)
        request.httpMethod="POST";request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        request.httpBody=try JSONSerialization.data(withJSONObject:["p_source_league_id":leagueId.uuidString.lowercased(),"p_target_sport_id":targetSport,"p_proposed_name":name,"p_message":message])
        return try await send(request,as:SportPoolPoll.self)
    }

    static func voteSportPool(token: String, pollId: UUID, response: String) async throws {
        var request=authorizedRequest(url:SupabaseConfiguration.baseURL.appending(path:"rest/v1/rpc/vote_sport_pool"),token:token)
        request.httpMethod="POST";request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        request.httpBody=try JSONSerialization.data(withJSONObject:["p_poll_id":pollId.uuidString.lowercased(),"p_response":response])
        let (_,response)=try await URLSession.shared.data(for:request);guard let http=response as? HTTPURLResponse,(200..<300).contains(http.statusCode) else{throw RequestError(message:"Your vote did not stick. Democracy remains under investigation.")}
    }

    static func seedFoundrySportPoolVotes(token: String, pollId: UUID) async throws {
        var request=authorizedRequest(url:SupabaseConfiguration.baseURL.appending(path:"rest/v1/rpc/seed_bot_sport_pool_votes"),token:token)
        request.httpMethod="POST";request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        request.httpBody=try JSONSerialization.data(withJSONObject:["p_poll_id":pollId.uuidString.lowercased()])
        let (_,response)=try await URLSession.shared.data(for:request);guard let http=response as? HTTPURLResponse,(200..<300).contains(http.statusCode) else{throw RequestError(message:"Foundry recruits refused to answer the poll.")}
    }

    static func launchSportPoolLeague(token: String, pollId: UUID) async throws -> SportPoolLaunch {
        var request=authorizedRequest(url:SupabaseConfiguration.baseURL.appending(path:"rest/v1/rpc/launch_sport_pool_league"),token:token)
        request.httpMethod="POST";request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        request.httpBody=try JSONSerialization.data(withJSONObject:["p_poll_id":pollId.uuidString.lowercased()])
        return try await send(request,as:SportPoolLaunch.self)
    }

    static func resetLeagueSeason(token: String, leagueId: UUID, confirmationName: String) async throws {
        var request=authorizedRequest(url:SupabaseConfiguration.baseURL.appending(path:"rest/v1/rpc/reset_league_season_guarded"),token:token)
        request.httpMethod="POST";request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        request.httpBody=try JSONSerialization.data(withJSONObject:["p_league_id":leagueId.uuidString.lowercased(),"p_confirm_name":confirmationName])
        let (data,response)=try await URLSession.shared.data(for:request);guard let http=response as? HTTPURLResponse,(200..<300).contains(http.statusCode) else{let message=(try? JSONDecoder().decode(APIError.self,from:data).message) ?? "Season reset refused to fire.";throw RequestError(message:message)}
    }

    static func setLeagueCapacity(token: String, leagueId: UUID, maxHumanMembers: Int) async throws -> LeagueCapacityUpdate {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/set_league_capacity"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_max_human_members": maxHumanMembers,
        ])
        return try await send(request, as: LeagueCapacityUpdate.self)
    }

    static func lockCfbBowlBoard(token: String, leagueId: UUID, seasonKey: Int, picks: [String: String], allocations: [String: Int], deadHand: Bool) async throws -> CfbPostseasonEntry {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/save_cfb_bowl_board"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_season_key": seasonKey,
            "p_picks": picks,
            "p_allocations": allocations,
            "p_dead_hand": deadHand,
        ])
        return try await send(request, as: CfbPostseasonEntry.self)
    }

    static func lockCfbPlayoffBracket(token: String, leagueId: UUID, seasonKey: Int, picks: [String: String], totalPredictions: [String: Int]) async throws -> CfbPostseasonEntry {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/save_cfb_playoff_bracket"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_season_key": seasonKey,
            "p_picks": picks,
            "p_total_predictions": totalPredictions,
        ])
        return try await send(request, as: CfbPostseasonEntry.self)
    }

    static func nflPostseasonSlate(token: String, leagueId: UUID, seasonKey: Int) async throws -> NflPostseasonSlate? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/nfl_postseason_slates"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "select", value: "league_id,season_key,teams,published_at"), URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"), URLQueryItem(name: "season_key", value: "eq.\(seasonKey)"), URLQueryItem(name: "limit", value: "1")]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [NflPostseasonSlate].self).first
    }

    static func publishNflPostseasonSlate(token: String, leagueId: UUID, seasonKey: Int, teams: [NflPostseasonTeam]) async throws -> NflPostseasonSlate {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/publish_nfl_postseason_slate"), token: token)
        request.httpMethod = "POST"; request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let encoded = try JSONEncoder().encode(teams); let json = try JSONSerialization.jsonObject(with: encoded)
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_league_id":leagueId.uuidString.lowercased(),"p_season_key":seasonKey,"p_teams":json])
        return try await send(request, as: NflPostseasonSlate.self)
    }

    static func seedFoundryNflPostseason(token: String, leagueId: UUID, seasonKey: Int) async throws -> FoundryNflPostseasonSeedResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/seed_foundry_nfl_postseason"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_season_key": seasonKey,
        ])
        return try await send(request, as: FoundryNflPostseasonSeedResponse.self)
    }

    static func nflPostseasonEntry(token: String, leagueId: UUID, userId: UUID, seasonKey: Int) async throws -> NflPostseasonEntry? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/nfl_postseason_entries"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name:"select",value:"league_id,user_id,season_key,picks,used_jdam,locked_at,score"),URLQueryItem(name:"league_id",value:"eq.\(leagueId.uuidString.lowercased())"),URLQueryItem(name:"user_id",value:"eq.\(userId.uuidString.lowercased())"),URLQueryItem(name:"season_key",value:"eq.\(seasonKey)"),URLQueryItem(name:"limit",value:"1")]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [NflPostseasonEntry].self).first
    }

    static func lockNflPostseasonBracket(token: String, leagueId: UUID, seasonKey: Int, picks: [String:String], usedJdam: Bool) async throws -> NflPostseasonEntry {
        var request=authorizedRequest(url:SupabaseConfiguration.baseURL.appending(path:"rest/v1/rpc/save_nfl_postseason_bracket"),token:token)
        request.httpMethod="POST";request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        request.httpBody=try JSONSerialization.data(withJSONObject:["p_league_id":leagueId.uuidString.lowercased(),"p_season_key":seasonKey,"p_picks":picks,"p_used_jdam":usedJdam])
        return try await send(request,as:NflPostseasonEntry.self)
    }

    static func nflPostseasonResults(token: String, leagueId: UUID, seasonKey: Int) async throws -> NflPostseasonResults? {
        var components=URLComponents(url:SupabaseConfiguration.baseURL.appending(path:"rest/v1/nfl_postseason_results"),resolvingAgainstBaseURL:false)!
        components.queryItems=[URLQueryItem(name:"select",value:"winners"),URLQueryItem(name:"league_id",value:"eq.\(leagueId.uuidString.lowercased())"),URLQueryItem(name:"season_key",value:"eq.\(seasonKey)"),URLQueryItem(name:"limit",value:"1")]
        return try await send(authorizedRequest(url:components.url!,token:token),as:[NflPostseasonResults].self).first
    }

    static func saveNflPostseasonResults(token:String,leagueId:UUID,seasonKey:Int,winners:[String:String]) async throws -> NflPostseasonResults {
        var request=authorizedRequest(url:SupabaseConfiguration.baseURL.appending(path:"rest/v1/rpc/save_nfl_postseason_results"),token:token)
        request.httpMethod="POST";request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        request.httpBody=try JSONSerialization.data(withJSONObject:["p_league_id":leagueId.uuidString.lowercased(),"p_season_key":seasonKey,"p_winners":winners])
        return try await send(request,as:NflPostseasonResults.self)
    }

    static func nflPostseasonScorecard(token:String,leagueId:UUID,userId:UUID,seasonKey:Int) async throws -> NflPostseasonScorecard? {
        var components=URLComponents(url:SupabaseConfiguration.baseURL.appending(path:"rest/v1/nfl_postseason_scorecards"),resolvingAgainstBaseURL:false)!
        components.queryItems=[URLQueryItem(name:"select",value:"wild_card_points,divisional_points,conference_points,super_bowl_points,correct_picks,raw_points,adjusted_points,total_points,used_jdam,jdam_multiplier"),URLQueryItem(name:"league_id",value:"eq.\(leagueId.uuidString.lowercased())"),URLQueryItem(name:"user_id",value:"eq.\(userId.uuidString.lowercased())"),URLQueryItem(name:"season_key",value:"eq.\(seasonKey)"),URLQueryItem(name:"limit",value:"1")]
        return try await send(authorizedRequest(url:components.url!,token:token),as:[NflPostseasonScorecard].self).first
    }

    static func nflPostseasonFieldStatus(token: String, leagueId: UUID, userId: UUID, seasonKey: Int) async throws -> NflPostseasonFieldStatus? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/nfl_postseason_field_status"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "season_status,active_human_count,total_human_count,field,seed,division_snapshot,regular_season_points"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "season_key", value: "eq.\(seasonKey)"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [NflPostseasonFieldStatus].self).first
    }

    static func competitiveLeagueStatus(token: String, leagueId: UUID) async throws -> CompetitiveLeagueStatus {
        var request = authorizedRequest(
            url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/league_competitive_status"),
            token: token
        )
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased()
        ])
        return try await send(request, as: CompetitiveLeagueStatus.self)
    }

    static func saveCrystalBallPick(token: String, leagueId: UUID, userId: UUID, teamName: String) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/crystal_ball_picks"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "on_conflict", value: "league_id,user_id")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "league_id": leagueId.uuidString.lowercased(), "user_id": userId.uuidString.lowercased(), "team_name": teamName
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "The crystal ball remains cloudy. Try again."
            throw RequestError(message: message)
        }
    }

    static func publishWeekCard(token: String, leagueId: UUID, weekNumber: Int, games: [[String: Any]], propQuestion: String, propA: String, propB: String, propPoints: Int) async throws {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/publish_week_card_atomic"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(), "p_week_number": weekNumber, "p_games": games,
            "p_prop_question": propQuestion, "p_prop_option_a": propA, "p_prop_option_b": propB, "p_prop_points": propPoints,
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "The card refused to publish. Dramatic, but fixable."
            throw RequestError(message: message)
        }
    }

    static func publishFieldhouseChampionshipCard(
        token: String,
        leagueId: UUID,
        weekNumber: Int,
        games: [[String: Any]]
    ) async throws {
        var request = authorizedRequest(
            url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/publish_fieldhouse_championship_card"),
            token: token
        )
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_week_number": weekNumber,
            "p_games": games,
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "Championship Week refused to publish. Check all four conference games."
            throw RequestError(message: message)
        }
    }

    static func unpublishWeekCard(token: String, leagueId: UUID, weekNumber: Int) async throws {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/unpublish_week_card"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_week_number": weekNumber,
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "The card refused to reset. Even chaos has paperwork."
            throw RequestError(message: message)
        }
    }

    static func scoreLeagueWeek(token: String, leagueId: UUID, weekNumber: Int, results: [UUID: String], propResult: String, foundryMode: Bool) async throws -> ScoreWeekResponse {
        let rpc = foundryMode ? "process_foundry_week" : "score_league_week_atomic"
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/\(rpc)"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_week_number": weekNumber,
            "p_results": results.map { ["game_id": $0.key.uuidString.lowercased(), "winner": $0.value] },
            "p_prop_result": propResult,
        ])
        return try await send(request, as: ScoreWeekResponse.self)
    }

    static func lockFoundryWeek(token: String, leagueId: UUID, weekNumber: Int) async throws -> FoundryLockResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/lock_foundry_week"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_week_number": weekNumber,
        ])
        return try await send(request, as: FoundryLockResponse.self)
    }

    static func scoreFoundryWeekSimulated(token: String, leagueId: UUID, weekNumber: Int) async throws -> ScoreWeekResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/score_foundry_week_simulated"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_week_number": weekNumber,
        ])
        return try await send(request, as: ScoreWeekResponse.self)
    }

    static func lockFoundryPostseasonWeek(token: String, leagueId: UUID, seasonKey: Int) async throws -> FoundryPostseasonWeekResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/lock_foundry_postseason_week"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_league_id": leagueId.uuidString.lowercased(), "p_season_key": seasonKey])
        return try await send(request, as: FoundryPostseasonWeekResponse.self)
    }

    static func scoreFoundryPostseasonWeek(token: String, leagueId: UUID, seasonKey: Int) async throws -> FoundryPostseasonWeekResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/score_foundry_postseason_week"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_league_id": leagueId.uuidString.lowercased(), "p_season_key": seasonKey])
        return try await send(request, as: FoundryPostseasonWeekResponse.self)
    }

    static func postseasonScorecards(token: String, leagueId: UUID, seasonKey: Int, userId: UUID? = nil) async throws -> [PostseasonScorecard] {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/get_postseason_scorecards"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var payload: [String: Any] = [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_season_key": seasonKey
        ]
        if let userId { payload["p_user_id"] = userId.uuidString.lowercased() }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        return try await send(request, as: [PostseasonScorecard].self)
    }

    static func foundrySeasonLifecycle(token: String, leagueId: UUID) async throws -> FoundrySeasonLifecycle {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/get_foundry_season_lifecycle"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_league_id": leagueId.uuidString.lowercased()])
        return try await send(request, as: FoundrySeasonLifecycle.self)
    }

    static func advanceFoundryPresentation(token: String, leagueId: UUID, expectedStage: String) async throws -> FoundrySeasonLifecycle {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/advance_foundry_presentation"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_expected_stage": expectedStage,
        ])
        return try await send(request, as: FoundrySeasonLifecycle.self)
    }

    static func resetFoundryLab(token: String, leagueId: UUID) async throws {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/reset_foundry_lab"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_league_id": leagueId.uuidString.lowercased()])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "Foundry restore failed safely."
            throw RequestError(message: message)
        }
    }

    static func bootstrapFoundryWeek(token: String, leagueId: UUID, weekNumber: Int) async throws {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/bootstrap_foundry_week"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_week_number": weekNumber,
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "Foundry week bootstrap failed safely."
            throw RequestError(message: message)
        }
    }

    static func completeFoundryRegularSeason(token: String, leagueId: UUID) async throws -> CompleteFoundrySeasonResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/complete_foundry_regular_season"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_league_id": leagueId.uuidString.lowercased()])
        return try await send(request, as: CompleteFoundrySeasonResponse.self)
    }

    static func stageFoundryRivalryWeek(token: String, leagueId: UUID) async throws -> StageFoundryRivalryResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/stage_foundry_rivalry_week"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_league_id": leagueId.uuidString.lowercased()])
        return try await send(request, as: StageFoundryRivalryResponse.self)
    }

    static func seedFoundryRivalryHistory(token: String, leagueId: UUID) async throws -> SeedFoundryRivalryHistoryResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/seed_foundry_rivalry_history"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_league_id": leagueId.uuidString.lowercased()])
        return try await send(request, as: SeedFoundryRivalryHistoryResponse.self)
    }

    static func footballOdds(token: String, leagueId: UUID, sportId: String, weekNumber: Int) async throws -> OddsFeed {
        var request = URLRequest(url: SupabaseConfiguration.baseURL.appending(path: "functions/v1/football-odds"))
        request.httpMethod = "POST"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "leagueId": leagueId.uuidString.lowercased(),
            "sport": sportId.lowercased() == "nfl" ? "nfl" : "cfb",
            "week": weekNumber,
        ])
        return try await send(request, as: OddsFeed.self)
    }

    static func syncDormantLeagueWeek(token: String, leagueId: UUID) async throws -> Int {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/sync_dormant_league_week"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_league_id": leagueId.uuidString.lowercased()])
        return try await send(request, as: DormantLeagueWeekPayload.self).week
    }

    static func fieldhouseOdds(token: String, leagueId: UUID, sportId: String, window: Int) async throws -> OddsFeed {
        var request = URLRequest(url: SupabaseConfiguration.baseURL.appending(path: "functions/v1/fieldhouse-odds"))
        request.httpMethod = "POST"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "leagueId": leagueId.uuidString.lowercased(),
            "sport": sportId.lowercased(),
            "window": window,
        ])
        return try await send(request, as: OddsFeed.self)
    }

    static func fieldhouseOfficialField(token: String, sportId: String, seasonKey: Int) async throws -> FieldhouseOfficialField? {
        var tournamentComponents = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/fieldhouse_tournaments"), resolvingAgainstBaseURL: false)!
        tournamentComponents.queryItems = [
            URLQueryItem(name: "select", value: "id,sport_id,season_key,status,first_tip_at"),
            URLQueryItem(name: "sport_id", value: "eq.\(sportId.lowercased())"),
            URLQueryItem(name: "season_key", value: "eq.\(seasonKey)"),
            URLQueryItem(name: "status", value: "neq.draft"),
            URLQueryItem(name: "limit", value: "1")
        ]
        guard let tournament = try await send(authorizedRequest(url: tournamentComponents.url!, token: token), as: [FieldhouseTournamentRecord].self).first else { return nil }

        var teamComponents = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/fieldhouse_tournament_teams"), resolvingAgainstBaseURL: false)!
        teamComponents.queryItems = [
            URLQueryItem(name: "select", value: "team_id,display_name,region,seed"),
            URLQueryItem(name: "tournament_id", value: "eq.\(tournament.id.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "region.asc,seed.asc,team_id.asc")
        ]
        var gameComponents = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/fieldhouse_tournament_games"), resolvingAgainstBaseURL: false)!
        gameComponents.queryItems = [
            URLQueryItem(name: "select", value: "game_id,round_key,round_order,ordinal,region,first_team_id,second_team_id,first_source_game_id,second_source_game_id,starts_at,winner_team_id,first_score,second_score,first_moneyline,second_moneyline,odds_bookmaker,odds_updated_at"),
            URLQueryItem(name: "tournament_id", value: "eq.\(tournament.id.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "round_order.asc,ordinal.asc")
        ]
        let teamURL = teamComponents.url!
        let gameURL = gameComponents.url!
        async let teams = send(authorizedRequest(url: teamURL, token: token), as: [FieldhouseTournamentTeamRecord].self)
        async let games = send(authorizedRequest(url: gameURL, token: token), as: [FieldhouseTournamentGameRecord].self)
        let loadedTeams = try await teams
        let loadedGames = try await games
        guard loadedTeams.count == 76, loadedGames.count == 75 else { throw RequestError(message: "The official Fieldhouse bracket is incomplete.") }
        return FieldhouseOfficialField(
            tournamentID: tournament.id, sportID: tournament.sportId, seasonKey: tournament.seasonKey,
            status: tournament.status, firstTipAt: tournament.firstTipAt,
            teams: loadedTeams.map { .init(teamID: $0.teamId, displayName: $0.displayName, region: $0.region, seed: $0.seed) },
            games: loadedGames.map { .init(gameID: $0.gameId, roundKey: $0.roundKey, roundOrder: $0.roundOrder, ordinal: $0.ordinal, region: $0.region, firstTeamID: $0.firstTeamId, secondTeamID: $0.secondTeamId, firstSourceGameID: $0.firstSourceGameId, secondSourceGameID: $0.secondSourceGameId, startsAt: $0.startsAt, winnerTeamID: $0.winnerTeamId, firstScore: $0.firstScore, secondScore: $0.secondScore, firstMoneyline: $0.firstMoneyline, secondMoneyline: $0.secondMoneyline, oddsBookmaker: $0.oddsBookmaker, oddsUpdatedAt: $0.oddsUpdatedAt) }
        )
    }

    static func fieldhouseRoundEntries(token: String, tournamentId: UUID, leagueId: UUID, userId: UUID) async throws -> [FieldhouseRoundEntryRecord] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/fieldhouse_round_entries"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "round_key,picks,submitted_at,locked_at,points"),
            URLQueryItem(name: "tournament_id", value: "eq.\(tournamentId.uuidString.lowercased())"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())")
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [FieldhouseRoundEntryRecord].self)
    }

    static func fieldhouseBracketEntry(token: String, tournamentId: UUID, leagueId: UUID, userId: UUID) async throws -> FieldhouseBracketEntryRecord? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/fieldhouse_bracket_entries"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "picks,submitted_at,locked_at,hellfire_used"),
            URLQueryItem(name: "tournament_id", value: "eq.\(tournamentId.uuidString.lowercased())"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "limit", value: "1")
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [FieldhouseBracketEntryRecord].self).first
    }

    static func fieldhousePostseasonTotals(token: String, tournamentId: UUID, leagueId: UUID) async throws -> [FieldhousePostseasonTotalRecord] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/fieldhouse_postseason_totals"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "tournament_id,league_id,user_id,bracket_correct_picks,bracket_raw_points,bracket_adjusted_points,round_points,total_points,updated_at"),
            URLQueryItem(name: "tournament_id", value: "eq.\(tournamentId.uuidString.lowercased())"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "total_points.desc,bracket_adjusted_points.desc,user_id.asc")
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [FieldhousePostseasonTotalRecord].self)
    }

    static func fieldhousePostseasonQualifier(token: String, tournamentId: UUID, leagueId: UUID, userId: UUID) async throws -> FieldhousePostseasonQualifierRecord? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/fieldhouse_postseason_qualifiers"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "tournament_id,league_id,user_id,fieldhouse_region,path,regular_rank,regular_points,frozen_at"),
            URLQueryItem(name: "tournament_id", value: "eq.\(tournamentId.uuidString.lowercased())"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "limit", value: "1")
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [FieldhousePostseasonQualifierRecord].self).first
    }

    static func saveFieldhouseBracket(token: String, leagueId: UUID, seasonKey: Int, picks: [String: String], hellfire: Bool) async throws -> FieldhouseBracketSaveResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/save_fieldhouse_bracket"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(), "p_season_key": seasonKey,
            "p_picks": picks, "p_hellfire": hellfire
        ])
        return try await send(request, as: FieldhouseBracketSaveResponse.self)
    }

    static func saveFieldhouseRoundPicks(token: String, leagueId: UUID, seasonKey: Int, roundKey: String, picks: [String: String]) async throws -> FieldhouseRoundSaveResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/save_fieldhouse_round_picks"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(), "p_season_key": seasonKey,
            "p_round_key": roundKey, "p_picks": picks
        ])
        return try await send(request, as: FieldhouseRoundSaveResponse.self)
    }

    static func importFieldhouseOfficialField(token: String, sportId: String, seasonKey: Int, fieldData: Data, publish: Bool) async throws -> FieldhouseFieldImportResponse {
        let decoded = try JSONSerialization.jsonObject(with: fieldData)
        guard let field = decoded as? [String: Any] else { throw RequestError(message: "The official field file must contain one JSON object.") }
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/import_fieldhouse_official_field"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_sport_id": sportId.lowercased(), "p_season_key": seasonKey,
            "p_field": field, "p_publish": publish
        ])
        return try await send(request, as: FieldhouseFieldImportResponse.self)
    }

    static func syncFieldhouseOfficialSchedule(token: String, sportId: String, seasonKey: Int, fieldData: Data) async throws -> FieldhouseScheduleSyncResponse {
        let decoded = try JSONSerialization.jsonObject(with: fieldData)
        guard let field = decoded as? [String: Any], let games = field["games"] as? [[String: Any]], games.count == 75 else {
            throw RequestError(message: "Schedule sync requires the complete generated 75-game field file.")
        }
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/sync_fieldhouse_official_schedule"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_sport_id": sportId.lowercased(), "p_season_key": seasonKey, "p_games": games
        ])
        return try await send(request, as: FieldhouseScheduleSyncResponse.self)
    }

    static func footballScores(token: String, leagueId: UUID, sportId: String, weekNumber: Int, daysFrom: Int = 3) async throws -> FootballScoreFeed {
        var request = URLRequest(url: SupabaseConfiguration.baseURL.appending(path: "functions/v1/football-scores"))
        request.httpMethod = "POST"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "leagueId": leagueId.uuidString.lowercased(),
            "sport": ["nfl", "ncaam", "ncaaw"].contains(sportId.lowercased()) ? sportId.lowercased() : "cfb",
            "week": weekNumber,
            "daysFrom": min(3, max(1, daysFrom)),
        ])
        return try await send(request, as: FootballScoreFeed.self)
    }

    static func saveWeekPicks(
        token: String,
        leagueId: UUID,
        weekNumber: Int,
        picks: [PickSubmission],
        bestBetGameId: UUID,
        propChoice: String?,
        isChaos: Bool = false
    ) async throws -> SavedPickResponse {
        var request = authorizedRequest(
            url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/save_week_picks_atomic"),
            token: token
        )
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_week_number": weekNumber,
            "p_picks": picks.map {
                [
                    "game_id": $0.gameId.uuidString.lowercased(),
                    "side": $0.side,
                    "confidence": $0.confidence,
                ]
            },
            "p_best_bet_game_id": bestBetGameId.uuidString.lowercased(),
            "p_prop_choice": propChoice ?? NSNull(),
            "p_is_chaos": isChaos,
        ])
        return try await send(request, as: SavedPickResponse.self)
    }

    static func standings(token: String, leagueId: UUID) async throws -> [Standing] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/memberships"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,user_id,total_points,weekly_points,weeks_played,display_name_override,division,fieldhouse_region,ats_correct,ats_total,current_streak,best_week,worst_week,perfect_weeks,best_bet_hits,best_bet_total,prop_hits,prop_total,is_bot,profiles(display_name,avatar_url,last_seen_at,equipped_title_id,equipped_border_id,equipped_rank_id,career_rank_floor)"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "total_points.desc"),
        ]
        var request = URLRequest(url: components.url!)
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return try await send(request, as: [Standing].self)
    }

    static func updateMemberDivision(token: String, leagueId: UUID, membershipId: UUID, division: String) async throws {
        let validDivisions = Set(["North", "South", "East", "West"])
        guard validDivisions.contains(division) else { throw RequestError(message: "That conference assignment is invalid.") }
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/memberships"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "id", value: "eq.\(membershipId.uuidString.lowercased())"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "select", value: "id,division"),
        ]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["division": division])
        let updated = try await send(request, as: [MembershipDivisionUpdate].self)
        guard updated.first?.id == membershipId, updated.first?.division == division else {
            throw RequestError(message: "The server did not confirm that conference move.")
        }
    }

    static func profile(token: String, userId: UUID) async throws -> Profile? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/profiles"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "display_name,avatar_url,last_seen_at,equipped_title_id,equipped_border_id,equipped_rank_id,career_rank_floor,created_at,birthday_mmdd,birthday_locked_at"),
            URLQueryItem(name: "id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [Profile].self).first
    }

    static func weaponServiceSummary(token: String, userId: UUID) async throws -> WeaponServiceSummary {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/weapon_service_totals"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "tactical_nukes,dead_hands,jdams,hellfires,campaigns,total_authorizations"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "limit", value: "1")
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [WeaponServiceSummary].self).first ?? .empty
    }

    static func updateProfileCosmetics(token: String, userId: UUID, titleId: String?, borderId: String?) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/profiles"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "id", value: "eq.\(userId.uuidString.lowercased())")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        let titleValue: Any = titleId.map { $0 as Any } ?? NSNull()
        let borderValue: Any = borderId.map { $0 as Any } ?? NSNull()
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "equipped_title_id": titleValue,
            "equipped_border_id": borderValue
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "Personnel records refused the new loadout."
            throw RequestError(message: message)
        }
    }

    static func lockBirthday(token: String, userId: UUID, monthDay: String) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/profiles"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "id", value: "eq.\(userId.uuidString.lowercased())")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["birthday_mmdd": monthDay])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "Birthday lock refused. The records clerk is suspicious."
            throw RequestError(message: message)
        }
    }

    static func updateProfileRankDisplay(token: String, userId: UUID, rankId: String?) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/profiles"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "id", value: "eq.\(userId.uuidString.lowercased())")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["equipped_rank_id": rankId.map { $0 as Any } ?? NSNull()])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "Personnel records refused the rank display."
            throw RequestError(message: message)
        }
    }

    static func profileAchievements(token: String, userId: UUID) async throws -> [ProfileAchievement] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/achievements"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "league_id,code,title,flavor,earned_at"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "earned_at.desc"),
        ]
        let achievementsURL = components.url!
        async let liveRequest = send(authorizedRequest(url: achievementsURL, token: token), as: [ProfileAchievement].self)
        async let eggRequest = easterEggFinds(token: token, userId: userId)
        async let milestoneRequest = careerChampionMilestones(token: token, userId: userId)
        let live = try await liveRequest
        let eggs = (try? await eggRequest)?.compactMap(EasterEggEngine.achievement(for:)) ?? []
        let milestones = (try? await milestoneRequest)?.map(\.achievement) ?? []
        return LegacyCareerRecords.achievements(for: userId, merging: live + eggs + milestones)
    }

    private static func careerChampionMilestones(token: String, userId: UUID) async throws -> [CareerChampionMilestone] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/career_champion_milestones"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "triggering_league_id,achievement_code,title,flavor,achieved_at"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "threshold.asc"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [CareerChampionMilestone].self)
    }

    static func easterEggProfile(token: String, userId: UUID) async throws -> EasterEggProfile {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/profiles"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "created_at,birthday_mmdd"),
            URLQueryItem(name: "id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "limit", value: "1")
        ]
        let rows = try await send(authorizedRequest(url: components.url!, token: token), as: [EasterEggProfile].self)
        guard let profile = rows.first else { throw RequestError(message: "Personnel anniversary record is missing.") }
        return profile
    }

    static func easterEggFinds(token: String, userId: UUID) async throws -> [EasterEggFind] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/easter_egg_finds"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "discovery_id,found_at"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "found_at.desc")
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [EasterEggFind].self)
    }

    static func recordEasterEggFind(token: String, discoveryId: String) async throws -> EasterEggRecordResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/record_easter_egg_find"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_discovery_id": discoveryId,
            "p_player_name": "",
            "p_total_eggs": 0
        ])
        return try await send(request, as: EasterEggRecordResponse.self)
    }

    static func recordNativeAppOpen(token: String) async throws -> NativeAppOpenResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/record_native_app_open"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data("{}".utf8)
        return try await send(request, as: NativeAppOpenResponse.self)
    }

    static func profileTrophies(token: String, userId: UUID) async throws -> [ProfileTrophy] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/league_trophies"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,league_id,season_year,trophy_type,winner_name,winner_user_id,subtitle,notes,awarded_at,trophy_design_id"),
            URLQueryItem(name: "winner_user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "season_year.desc"),
        ]
        let live = try await send(authorizedRequest(url: components.url!, token: token), as: [ProfileTrophy].self)
        async let fieldhouse = projectedTrophies(token: token, resource: "fieldhouse_profile_trophies", filter: "winner_user_id", value: userId.uuidString.lowercased())
        async let nfl = projectedTrophies(token: token, resource: "nfl_profile_trophies", filter: "winner_user_id", value: userId.uuidString.lowercased())
        return LegacyCareerRecords.trophies(for: userId, merging: live + (await fieldhouse) + (await nfl))
    }

    static func leagueTrophies(token: String, leagueId: UUID) async throws -> [ProfileTrophy] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/league_trophies"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,league_id,season_year,trophy_type,winner_name,winner_user_id,subtitle,notes,awarded_at,trophy_design_id"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "season_year.desc"),
        ]
        let live = try await send(authorizedRequest(url: components.url!, token: token), as: [ProfileTrophy].self)
        async let fieldhouse = projectedTrophies(token: token, resource: "fieldhouse_profile_trophies", filter: "league_id", value: leagueId.uuidString.lowercased())
        async let nfl = projectedTrophies(token: token, resource: "nfl_profile_trophies", filter: "league_id", value: leagueId.uuidString.lowercased())
        return (live + (await fieldhouse) + (await nfl)).sorted { $0.seasonYear > $1.seasonYear }
    }

    static func latestLeagueSeasonCloseout(token: String, leagueId: UUID, sportId: String) async throws -> LeagueSeasonCloseout? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/league_season_closeouts"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,league_id,season_key,sport_id,competition_type,national_champion,league_champion_id,league_champion_ids,closed_at"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "sport_id", value: "eq.\(SportIdentity(sportId).sportId)"),
            URLQueryItem(name: "competition_type", value: "eq.league"),
            URLQueryItem(name: "order", value: "season_key.desc,closed_at.desc"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [LeagueSeasonCloseout].self).first
    }

    static func nextSportSeasonWindow(token: String, sportId: String, after date: Date = Date()) async throws -> SportSeasonWindow? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/sport_season_windows"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "sport_id,season_key,first_event_at,season_ends_at,timing_status,display_label"),
            URLQueryItem(name: "sport_id", value: "eq.\(SportIdentity(sportId).sportId)"),
            URLQueryItem(name: "first_event_at", value: "gt.\(ISO8601DateFormatter().string(from: date))"),
            URLQueryItem(name: "order", value: "first_event_at.asc"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [SportSeasonWindow].self).first
    }

    static func relevantSportSeasonWindow(token: String, sportId: String, at date: Date = Date()) async throws -> SportSeasonWindow? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/sport_season_windows"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "sport_id,season_key,first_event_at,season_ends_at,timing_status,display_label"),
            URLQueryItem(name: "sport_id", value: "eq.\(SportIdentity(sportId).sportId)"),
            URLQueryItem(name: "season_ends_at", value: "gte.\(ISO8601DateFormatter().string(from: date))"),
            URLQueryItem(name: "order", value: "first_event_at.asc"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [SportSeasonWindow].self).first
    }

    static func sportCardWindow(token: String, sportId: String, seasonKey: Int, week: Int) async throws -> SportCardWindow? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/sport_card_windows"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "sport_id,season_key,week_number,window_starts_at,window_ends_at,first_game_at,timing_status,display_label"),
            URLQueryItem(name: "sport_id", value: "eq.\(SportIdentity(sportId).sportId)"),
            URLQueryItem(name: "season_key", value: "eq.\(seasonKey)"),
            URLQueryItem(name: "week_number", value: "eq.\(week)"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [SportCardWindow].self).first
    }

    /// Fieldhouse permits honest co-champions, while the legacy football shelf
    /// has a one-winner-per-trophy key. This projection is optional until the
    /// review-only Build 21 schema is installed, so existing CFB/NFL profiles
    /// remain available during a staged rollout.
    private static func projectedTrophies(token: String, resource: String, filter: String, value: String) async -> [ProfileTrophy] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/\(resource)"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,league_id,season_year,trophy_type,winner_name,winner_user_id,subtitle,notes,awarded_at,trophy_design_id"),
            URLQueryItem(name: filter, value: "eq.\(value)"),
            URLQueryItem(name: "order", value: "season_year.desc"),
        ]
        return (try? await send(authorizedRequest(url: components.url!, token: token), as: [ProfileTrophy].self)) ?? []
    }

    static func favoriteTeam(token: String, userId: UUID, sportId: String = "cfb") async throws -> FavoriteTeam? {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/profile_favorite_teams"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "sport_id,team_id"),
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "sport_id", value: "eq.\(sportId)"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [FavoriteTeam].self).first
    }

    static func favoriteTeams(token: String, userIds: [UUID], sportId: String) async throws -> [FavoriteTeamRecord] {
        guard !userIds.isEmpty else { return [] }
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/profile_favorite_teams"), resolvingAgainstBaseURL: false)!
        let ids = userIds.map { $0.uuidString.lowercased() }.joined(separator: ",")
        components.queryItems = [
            URLQueryItem(name: "select", value: "user_id,sport_id,team_id"),
            URLQueryItem(name: "user_id", value: "in.(\(ids))"),
            URLQueryItem(name: "sport_id", value: "eq.\(sportId.lowercased())"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [FavoriteTeamRecord].self)
    }

    static func saveFavoriteTeam(token: String, userId: UUID, sportId: String, teamId: String) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/profile_favorite_teams"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "on_conflict", value: "user_id,sport_id")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "user_id": userId.uuidString.lowercased(),
            "sport_id": sportId.lowercased(),
            "team_id": FootballTeamCatalog.normalizedTeamId(teamId),
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "Your team loyalty could not be filed."
            throw RequestError(message: message)
        }
    }

    static func selectChampionshipTrophy(token: String, leagueId: UUID, trophyId: String) async throws {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/select_championship_trophy"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_trophy_id": trophyId,
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "The hardware vault refused that selection. Dramatic, even for us."
            throw RequestError(message: message)
        }
        let saved = try JSONDecoder().decode(String.self, from: data)
        guard saved == trophyId else {
            throw RequestError(message: "The hardware vault did not confirm that selection. Try again.")
        }
    }

    static func updateDisplayName(token: String, userId: UUID, displayName: String) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/profiles"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "id", value: "eq.\(userId.uuidString.lowercased())")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["display_name": displayName])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "Could not save that name. Apparently identity is complicated."
            throw RequestError(message: message)
        }
    }

    static func touchLastSeen(token: String, userId: UUID) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/profiles"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "id", value: "eq.\(userId.uuidString.lowercased())")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["last_seen_at": ISO8601DateFormatter().string(from: Date())])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "Could not update last seen. The surveillance department is embarrassed."
            throw RequestError(message: message)
        }
    }

    static func lockerMessages(token: String, leagueId: UUID) async throws -> [LockerMessage] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/locker_messages"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,league_id,user_id,body,created_at,profiles(display_name,avatar_url,equipped_border_id),locker_message_reactions(id,user_id,emoji)"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "created_at.desc"),
            URLQueryItem(name: "limit", value: "100"),
        ]
        let rows = try await send(authorizedRequest(url: components.url!, token: token), as: [LockerMessage].self)
        return rows
            .filter { !$0.body.hasPrefix("WR_RX|") && !$0.body.hasPrefix("WR_FUN|") && !$0.body.hasPrefix("WR_IMG|") }
            .reversed()
    }

    static func postLockerMessage(token: String, leagueId: UUID, userId: UUID, body: String) async throws {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/locker_messages"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "league_id": leagueId.uuidString.lowercased(),
            "user_id": userId.uuidString.lowercased(),
            "body": body,
        ])
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw RequestError(message: "The room rejected that one. Try again.")
        }
    }

    static func deleteAccount(token: String, password: String) async throws {
        var request = URLRequest(url: SupabaseConfiguration.baseURL.appending(path: "functions/v1/delete-account"))
        request.httpMethod = "POST"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "password": password,
            "confirmation": "BURN THE DOSSIER",
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message)
                ?? "Account deletion is temporarily unavailable. Contact \(AppLinks.supportEmail) for help."
            throw RequestError(message: message)
        }
    }

    static func patreonConnection(token: String) async throws -> PatreonConnectionStatus {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "functions/v1/patreon-oauth"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "action", value: "status")]
        return try await send(authorizedRequest(url: components.url!, token: token), as: PatreonConnectionStatus.self)
    }

    static func startPatreonConnection(token: String) async throws -> URL {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "functions/v1/patreon-oauth"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "action", value: "start")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data("{}".utf8)
        return try await send(request, as: PatreonConnectionStart.self).authorizationURL
    }

    static func disconnectPatreon(token: String) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "functions/v1/patreon-oauth"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "action", value: "disconnect")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data("{}".utf8)
        _ = try await send(request, as: PatreonConnectionStatus.self)
    }

    static func reportLockerMessage(token: String, messageId: UUID, reason: String = "abuse") async throws {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/report_locker_message"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_message_id": messageId.uuidString.lowercased(),
            "p_reason": reason,
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message)
                ?? "The report could not be filed. Contact \(AppLinks.supportEmail)."
            throw RequestError(message: message)
        }
    }

    static func setLockerReaction(
        token: String,
        messageId: UUID,
        userId: UUID,
        emoji: String,
        isRemoving: Bool
    ) async throws {
        let baseURL = SupabaseConfiguration.baseURL.appending(path: "rest/v1/locker_message_reactions")
        var request: URLRequest
        if isRemoving {
            var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
            components.queryItems = [
                URLQueryItem(name: "message_id", value: "eq.\(messageId.uuidString.lowercased())"),
                URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
                URLQueryItem(name: "emoji", value: "eq.\(emoji)"),
            ]
            request = authorizedRequest(url: components.url!, token: token)
            request.httpMethod = "DELETE"
        } else {
            request = authorizedRequest(url: baseURL, token: token)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: [
                "message_id": messageId.uuidString.lowercased(),
                "user_id": userId.uuidString.lowercased(),
                "emoji": emoji,
            ])
        }
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "Reaction denied. The emoji appeals court is closed."
            throw RequestError(message: message)
        }
    }

    static func announcements(token: String, leagueId: UUID) async throws -> [Announcement] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/announcements"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,league_id,author_id,title,body,created_at,profiles!announcements_author_id_fkey(display_name),announcement_reads(user_id)"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "created_at.desc"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [Announcement].self)
    }

    static func gazetteEditions(token: String, leagueId: UUID) async throws -> [GazetteEditionRow] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/gazette_editions"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,week_number,week_label,volume_label,payload,created_at"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "week_number.desc"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [GazetteEditionRow].self)
    }

    static func markAnnouncementsRead(token: String, userId: UUID, announcementIds: [UUID]) async throws {
        guard !announcementIds.isEmpty else { return }
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/announcement_reads"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "on_conflict", value: "announcement_id,user_id")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=ignore-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: announcementIds.map {
            ["announcement_id": $0.uuidString.lowercased(), "user_id": userId.uuidString.lowercased()]
        })
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "Could not clear the unread badge. It has become emotionally attached."
            throw RequestError(message: message)
        }
    }

    static func postAnnouncement(
        token: String,
        leagueId: UUID,
        authorId: UUID,
        title: String,
        body: String
    ) async throws {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/announcements"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "league_id": leagueId.uuidString.lowercased(),
            "author_id": authorId.uuidString.lowercased(),
            "title": title,
            "body": body,
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "The announcement stayed in the locker. Try again."
            throw RequestError(message: message)
        }
    }

    static func registerPushDevice(token: String, userId: UUID, deviceToken: String, environment: String) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/push_device_tokens"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "on_conflict", value: "device_token")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "user_id": userId.uuidString.lowercased(),
            "device_token": deviceToken,
            "platform": "ios",
            "environment": environment,
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "This device could not register for alerts."
            throw RequestError(message: message)
        }
    }

    static func syncNotificationPreference(
        token: String,
        userId: UUID,
        installationId: UUID,
        authorizationStatus: String,
        preferenceEnabled: Bool,
        environment: String,
        appBuild: String
    ) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/push_notification_preferences"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "on_conflict", value: "user_id,installation_id")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "user_id": userId.uuidString.lowercased(),
            "installation_id": installationId.uuidString.lowercased(),
            "platform": "ios",
            "environment": environment,
            "authorization_status": authorizationStatus,
            "preference_enabled": preferenceEnabled,
            "app_build": appBuild,
            "last_seen_at": ISO8601DateFormatter().string(from: Date()),
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "Notification status could not be synchronized."
            throw RequestError(message: message)
        }
    }

    static func unregisterPushDevice(token: String, userId: UUID, deviceToken: String) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/push_device_tokens"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId.uuidString.lowercased())"),
            URLQueryItem(name: "device_token", value: "eq.\(deviceToken)"),
        ]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "DELETE"
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "This device could not disable alerts."
            throw RequestError(message: message)
        }
    }

    private static func send<T: Decodable>(_ request: URLRequest, as: T.Type) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "The server rejected the request."
            throw RequestError(message: message)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private static func authorizedRequest(url: URL, token: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return request
    }

    private struct APIError: Decodable {
        let message: String?
        enum CodingKeys: String, CodingKey { case message, error }
        init(from decoder: Decoder) throws {
            let values = try decoder.container(keyedBy: CodingKeys.self)
            message = try values.decodeIfPresent(String.self, forKey: .message)
                ?? values.decodeIfPresent(String.self, forKey: .error)
        }
    }
    private struct MembershipDivisionUpdate: Decodable {
        let id: UUID
        let division: String
    }
    private struct RequestError: LocalizedError { let message: String; var errorDescription: String? { message } }
}
