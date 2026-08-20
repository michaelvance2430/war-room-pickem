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
    enum CodingKeys: String, CodingKey {
        case name, code
        case sportId = "sport_id"
        case currentWeek = "current_week"
        case commissionerId = "commissioner_id"
        case crystalBallEnabled = "crystal_ball_enabled"
        case championshipTrophyId = "championship_trophy_id"
        case mode
        case regularSeasonWeeks = "regular_season_weeks"
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
    let myVote: String?
    let yesVoters: [SportPoolVoter]
    let canLaunch: Bool
    let createdLeagueId: UUID?
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

enum AppIdentity {
    static let creatorUserIds: Set<UUID> = [UUID(uuidString: "09544d2b-6eca-4131-a321-c000586c9029")!]
    static func isCreator(_ userId: UUID?) -> Bool { userId.map(creatorUserIds.contains) ?? false }
}

struct WeekCard: Decodable, Identifiable, Sendable {
    let id: UUID
    let weekNumber: Int
    let lockTime: String?
    let propQuestion: String?
    let propOptionA: String?
    let propOptionB: String?
    let propPoints: Int
    let cardGames: [CardGame]

    enum CodingKeys: String, CodingKey {
        case id
        case weekNumber = "week_number"
        case lockTime = "lock_time"
        case propQuestion = "prop_question"
        case propOptionA = "prop_option_a"
        case propOptionB = "prop_option_b"
        case propPoints = "prop_points"
        case cardGames = "card_games"
    }
}

struct CardGame: Decodable, Identifiable, Sendable {
    let id: UUID
    let sortOrder: Int
    let awayTeam: String
    let homeTeam: String
    let spread: Double
    let favorite: String
    let startTime: String?
    let awayRank: Int?
    let homeRank: Int?
    let isRivalry: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case sortOrder = "sort_order"
        case awayTeam = "away_team"
        case homeTeam = "home_team"
        case spread, favorite
        case startTime = "start_time"
        case awayRank = "away_rank"
        case homeRank = "home_rank"
        case isRivalry = "is_rivalry"
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
    var id: String { "\(leagueId.uuidString)-\(userId.uuidString)-\(seasonKey)-\(weekNumber)" }
    enum CodingKeys: String, CodingKey {
        case phase, components
        case leagueId = "league_id", userId = "user_id", seasonKey = "season_key"
        case weekNumber = "week_number", weeklyTotal = "weekly_total"
        case seasonTotalBefore = "season_total_before", seasonTotalAfter = "season_total_after"
        case rankBefore = "rank_before", rankAfter = "rank_after", createdAt = "created_at"
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
        components.queryItems = [URLQueryItem(name: "redirect_to", value: "https://app.war-room-picks.com/reset-password")]
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
            URLQueryItem(name: "select", value: "league_id,role,is_moderator,is_deputy,total_points,weekly_points,weeks_played,division,joined_at,ats_correct,ats_total,current_streak,best_week,worst_week,perfect_weeks,best_bet_hits,best_bet_total,prop_hits,prop_total,leagues(name,code,sport_id,current_week,regular_season_weeks,commissioner_id,crystal_ball_enabled,championship_trophy_id,mode)"),
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
            URLQueryItem(name: "select", value: "id,week_number,lock_time,prop_question,prop_option_a,prop_option_b,prop_points,card_games(id,sort_order,away_team,home_team,spread,favorite,start_time,away_rank,home_rank,is_rivalry)"),
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

    static func lockCfbPlayoffBracket(token: String, leagueId: UUID, seasonKey: Int, picks: [String: String]) async throws -> CfbPostseasonEntry {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/save_cfb_playoff_bracket"), token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_league_id": leagueId.uuidString.lowercased(),
            "p_season_key": seasonKey,
            "p_picks": picks,
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
        components.queryItems=[URLQueryItem(name:"select",value:"wild_card_points,divisional_points,conference_points,super_bowl_points,total_points,used_jdam"),URLQueryItem(name:"league_id",value:"eq.\(leagueId.uuidString.lowercased())"),URLQueryItem(name:"user_id",value:"eq.\(userId.uuidString.lowercased())"),URLQueryItem(name:"season_key",value:"eq.\(seasonKey)"),URLQueryItem(name:"limit",value:"1")]
        return try await send(authorizedRequest(url:components.url!,token:token),as:[NflPostseasonScorecard].self).first
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

    static func scoreLeagueWeek(token: String, leagueId: UUID, weekNumber: Int, results: [UUID: String], propResult: String) async throws -> ScoreWeekResponse {
        var request = authorizedRequest(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/process_foundry_week"), token: token)
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

    static func saveWeekPicks(
        token: String,
        leagueId: UUID,
        weekNumber: Int,
        picks: [PickSubmission],
        bestBetGameId: UUID,
        propChoice: String,
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
            "p_prop_choice": propChoice,
            "p_is_chaos": isChaos,
        ])
        return try await send(request, as: SavedPickResponse.self)
    }

    static func standings(token: String, leagueId: UUID) async throws -> [Standing] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/memberships"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,user_id,total_points,weekly_points,weeks_played,display_name_override,division,ats_correct,ats_total,current_streak,best_week,worst_week,perfect_weeks,best_bet_hits,best_bet_total,prop_hits,prop_total,is_bot,profiles(display_name,avatar_url,last_seen_at,equipped_title_id,equipped_border_id,equipped_rank_id,career_rank_floor)"),
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
        let live = try await liveRequest
        let eggs = (try? await eggRequest)?.compactMap(EasterEggEngine.achievement(for:)) ?? []
        return LegacyCareerRecords.achievements(for: userId, merging: live + eggs)
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
        return LegacyCareerRecords.trophies(for: userId, merging: live)
    }

    static func leagueTrophies(token: String, leagueId: UUID) async throws -> [ProfileTrophy] {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/league_trophies"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,league_id,season_year,trophy_type,winner_name,winner_user_id,subtitle,notes,awarded_at,trophy_design_id"),
            URLQueryItem(name: "league_id", value: "eq.\(leagueId.uuidString.lowercased())"),
            URLQueryItem(name: "order", value: "season_year.desc"),
        ]
        return try await send(authorizedRequest(url: components.url!, token: token), as: [ProfileTrophy].self)
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
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/leagues"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "id", value: "eq.\(leagueId.uuidString.lowercased())")]
        var request = authorizedRequest(url: components.url!, token: token)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["championship_trophy_id": trophyId])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIError.self, from: data).message) ?? "The hardware vault refused that selection. Dramatic, even for us."
            throw RequestError(message: message)
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
