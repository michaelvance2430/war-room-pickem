import Foundation

enum NflSeasonCalendar {
    /// NFL seasons are named for the year in which Week 1 begins. January,
    /// February, and March still belong to the prior fall's campaign.
    static func seasonKey(for date: Date = Date(), calendar: Calendar = .current) -> Int {
        let year = calendar.component(.year, from: date)
        return calendar.component(.month, from: date) <= 3 ? year - 1 : year
    }
}

struct NflPostseasonTeam: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let name: String
    let conference: String
    let seed: Int
}

struct NflPostseasonSlate: Decodable, Sendable {
    let leagueId: UUID
    let seasonKey: Int
    let teams: [NflPostseasonTeam]
    let publishedAt: String
    enum CodingKeys: String, CodingKey {
        case leagueId = "league_id"; case seasonKey = "season_key"; case teams; case publishedAt = "published_at"
    }
}

struct NflPostseasonEntry: Decodable, Sendable {
    let leagueId: UUID
    let userId: UUID
    let seasonKey: Int
    let picks: [String: String]
    let usedJdam: Bool
    let lockedAt: String?
    let score: Int?
    enum CodingKeys: String, CodingKey {
        case leagueId = "league_id"; case userId = "user_id"; case seasonKey = "season_key"
        case picks; case usedJdam = "used_jdam"; case lockedAt = "locked_at"; case score
    }
}

struct NflPostseasonResults: Decodable, Sendable {
    let winners: [String: String]
}

struct NflPostseasonScorecard: Decodable, Sendable {
    let wildCardPoints: Int
    let divisionalPoints: Int
    let conferencePoints: Int
    let superBowlPoints: Int
    let totalPoints: Int
    let usedJdam: Bool
    enum CodingKeys: String, CodingKey {
        case wildCardPoints = "wild_card_points"; case divisionalPoints = "divisional_points"
        case conferencePoints = "conference_points"; case superBowlPoints = "super_bowl_points"
        case totalPoints = "total_points"; case usedJdam = "used_jdam"
    }
}

struct NflBracketGame: Identifiable, Hashable {
    let id: String
    let title: String
    let round: String
    let teams: [NflPostseasonTeam]
}

enum NflBracketEngine {
    static let requiredKeys = [
        "AFC-WC-2-7", "AFC-WC-3-6", "AFC-WC-4-5", "NFC-WC-2-7", "NFC-WC-3-6", "NFC-WC-4-5",
        "AFC-DIV-1", "AFC-DIV-2", "NFC-DIV-1", "NFC-DIV-2", "AFC-CONF", "NFC-CONF", "SUPER-BOWL",
    ]

    static func games(teams: [NflPostseasonTeam], picks: [String: String]) -> [NflBracketGame] {
        var games: [NflBracketGame] = []
        for conference in ["AFC", "NFC"] {
            let field = teams.filter { $0.conference == conference }
            func seed(_ value: Int) -> NflPostseasonTeam? { field.first { $0.seed == value } }
            for pair in [(2,7),(3,6),(4,5)] {
                games.append(.init(id: "\(conference)-WC-\(pair.0)-\(pair.1)", title: "#\(pair.0) vs #\(pair.1)", round: "WILD CARD", teams: [seed(pair.0),seed(pair.1)].compactMap { $0 }))
            }
            let wc = games.filter { $0.id.hasPrefix("\(conference)-WC") }.compactMap { winner($0, picks: picks) }.sorted { $0.seed < $1.seed }
            if wc.count == 3, let lowest = wc.max(by: { $0.seed < $1.seed }), let one = seed(1) {
                games.append(.init(id: "\(conference)-DIV-1", title: "#1 vs lowest remaining", round: "DIVISIONAL", teams: [one,lowest]))
                games.append(.init(id: "\(conference)-DIV-2", title: "Remaining seeds", round: "DIVISIONAL", teams: wc.filter { $0 != lowest }))
            } else {
                games.append(.init(id: "\(conference)-DIV-1", title: "#1 vs lowest remaining", round: "DIVISIONAL", teams: []))
                games.append(.init(id: "\(conference)-DIV-2", title: "Remaining seeds", round: "DIVISIONAL", teams: []))
            }
            let div = games.filter { $0.id.hasPrefix("\(conference)-DIV") }.compactMap { winner($0, picks: picks) }
            games.append(.init(id: "\(conference)-CONF", title: "\(conference) Championship", round: "CONFERENCE", teams: div))
        }
        let champions = games.filter { $0.id.hasSuffix("-CONF") }.compactMap { winner($0, picks: picks) }
        games.append(.init(id: "SUPER-BOWL", title: "AFC Champion vs NFC Champion", round: "SUPER BOWL", teams: champions))
        return games
    }

    static func winner(_ game: NflBracketGame, picks: [String: String]) -> NflPostseasonTeam? {
        guard let id = picks[game.id] else { return nil }
        return game.teams.first { $0.id == id }
    }

    static func clearedDownstream(after gameId: String, picks: inout [String: String]) {
        if gameId.contains("-WC-") {
            let conference = String(gameId.prefix(3))
            picks.keys.filter { $0.hasPrefix("\(conference)-DIV") || $0 == "\(conference)-CONF" || $0 == "SUPER-BOWL" }.forEach { picks.removeValue(forKey: $0) }
        } else if gameId.contains("-DIV-") {
            picks.removeValue(forKey: "\(gameId.prefix(3))-CONF"); picks.removeValue(forKey: "SUPER-BOWL")
        } else if gameId.hasSuffix("-CONF") { picks.removeValue(forKey: "SUPER-BOWL") }
    }

    static func jdamPicks(teams: [NflPostseasonTeam]) -> [String: String] {
        var output: [String: String] = [:]
        for _ in 0..<4 {
            let available = games(teams: teams, picks: output).filter { $0.teams.count == 2 && output[$0.id] == nil }
            for game in available { output[game.id] = game.teams.randomElement()?.id }
        }
        return output
    }
}
