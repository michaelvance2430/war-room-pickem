import Foundation

enum CfbSeasonPhase: String, Codable, Sendable {
    case regularSeason = "regular_season"
    case conferenceChampionships = "conference_championships"
    case bowlMania = "bowl_mania"
    case cfpFirstRound = "cfp_first_round"
    case cfpQuarterfinals = "cfp_quarterfinals"
    case cfpSemifinals = "cfp_semifinals"
    case cfpChampionship = "cfp_championship"
    case seasonComplete = "season_complete"

    static func phase(week: Int, regularSeasonWeeks: Int) -> Self {
        if week <= regularSeasonWeeks { return .regularSeason }
        if week == regularSeasonWeeks + 1 { return .conferenceChampionships }
        if week == regularSeasonWeeks + 2 { return .bowlMania }
        if week == regularSeasonWeeks + 3 { return .cfpFirstRound }
        if week == regularSeasonWeeks + 4 { return .cfpQuarterfinals }
        if week == regularSeasonWeeks + 5 { return .cfpSemifinals }
        if week == regularSeasonWeeks + 6 { return .cfpChampionship }
        return .seasonComplete
    }

    var isPostseasonScoring: Bool {
        switch self {
        case .bowlMania, .cfpFirstRound, .cfpQuarterfinals, .cfpSemifinals, .cfpChampionship: true
        default: false
        }
    }

    var isCfp: Bool {
        switch self {
        case .cfpFirstRound, .cfpQuarterfinals, .cfpSemifinals, .cfpChampionship, .seasonComplete: true
        default: false
        }
    }
}

enum CfbBowlTier: String, Codable, Sendable { case marquee, sicko }

struct CfbBowlCandidate: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let name: String
    let tier: CfbBowlTier
    let rank: Int
    let hostsCfpGame: Bool
}

struct CfbBowlGame: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let name: String
    let tier: CfbBowlTier
    let rank: Int
    let away: String
    let home: String
    let hostsCfpGame: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, tier, rank, away, home
        case hostsCfpGame = "hosts_cfp"
    }
}

enum CfbPostseasonRules {
    static let bowlGameCount = 25
    static let marqueeCount = 15
    static let sickoCount = 10
    static let bankroll = 100
    static let cfpTeamCount = 12
    static let cfpGameCount = 11

    static let marqueeNames = [
        "Citrus Bowl", "Alamo Bowl", "Music City Bowl", "Gator Bowl", "Texas Bowl",
        "ReliaQuest Bowl", "Las Vegas Bowl", "Sun Bowl", "Pop-Tarts Bowl", "Holiday Bowl",
        "Liberty Bowl", "Duke's Mayo Bowl", "Pinstripe Bowl", "Independence Bowl", "Armed Forces Bowl"
    ]

    static let sickoNames = [
        "68 Ventures Bowl", "Salute to Veterans Bowl", "Cure Bowl", "Myrtle Beach Bowl", "Frisco Bowl",
        "Famous Idaho Potato Bowl", "New Orleans Bowl", "New Mexico Bowl", "Birmingham Bowl", "First Responder Bowl"
    ]

    static func selectBoard(from candidates: [CfbBowlCandidate]) throws -> [CfbBowlCandidate] {
        let eligible = candidates.filter { !$0.hostsCfpGame }
        let marquee = eligible.filter { $0.tier == .marquee }.sorted(by: bowlOrder).prefix(marqueeCount)
        let sicko = eligible.filter { $0.tier == .sicko }.sorted(by: bowlOrder).prefix(sickoCount)
        guard marquee.count == marqueeCount, sicko.count == sickoCount else { throw CfbPostseasonError.incompleteBowlPool }
        return Array(marquee) + Array(sicko)
    }

    static func validateAllocation(_ allocation: [String: Int], board: [CfbBowlCandidate]) throws {
        guard board.count == bowlGameCount else { throw CfbPostseasonError.incompleteBowlPool }
        guard Set(allocation.keys) == Set(board.map(\.id)) else { throw CfbPostseasonError.missingBowlAllocation }
        guard allocation.values.allSatisfy({ $0 > 0 }) else { throw CfbPostseasonError.invalidBowlAllocation }
        guard allocation.values.reduce(0, +) == bankroll else { throw CfbPostseasonError.invalidBankroll }
    }

    static func deadHandScore(raw: Int) -> Int {
        raw >= 60 ? Int((Double(raw) * 1.5).rounded()) : Int((Double(raw) * 0.5).rounded())
    }

    static func cfpPoints(round: Int) -> Int { [1, 2, 4, 8][safe: round] ?? 0 }

    nonisolated private static func bowlOrder(_ lhs: CfbBowlCandidate, _ rhs: CfbBowlCandidate) -> Bool {
        lhs.rank == rhs.rank ? lhs.name < rhs.name : lhs.rank < rhs.rank
    }
}

enum CfbPostseasonError: Error { case incompleteBowlPool, missingBowlAllocation, invalidBowlAllocation, invalidBankroll }

private extension Array {
    subscript(safe index: Index) -> Element? { indices.contains(index) ? self[index] : nil }
}
