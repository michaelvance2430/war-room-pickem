import Foundation

enum FieldhouseSeasonCalendar {
    /// The tournament belongs to the calendar year in which March is played.
    static func seasonKey(for date: Date = Date(), calendar: Calendar = .current) -> Int {
        calendar.component(.year, from: date)
    }
}

struct FieldhouseTournamentTeam: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let name: String
    let region: String
    let seed: Int
}

struct FieldhouseTournamentGame: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let round: Int
    let sourceA: String
    let sourceB: String

    enum CodingKeys: String, CodingKey {
        case id, round
        case sourceA = "sourceA"
        case sourceB = "sourceB"
    }
}

struct FieldhouseTournamentSlate: Decodable, Sendable {
    let leagueId: UUID
    let seasonKey: Int
    let teams: [FieldhouseTournamentTeam]
    let games: [FieldhouseTournamentGame]
    let publishedAt: String

    enum CodingKeys: String, CodingKey {
        case leagueId = "league_id"
        case seasonKey = "season_key"
        case teams, games
        case publishedAt = "published_at"
    }
}

struct FieldhouseTournamentEntry: Decodable, Sendable {
    let leagueId: UUID
    let userId: UUID
    let seasonKey: Int
    let picks: [String: String]
    let usedHellfire: Bool
    let lockedAt: String?
    let score: Int?

    enum CodingKeys: String, CodingKey {
        case leagueId = "league_id"
        case userId = "user_id"
        case seasonKey = "season_key"
        case picks
        case usedHellfire = "used_hellfire"
        case lockedAt = "locked_at"
        case score
    }
}

struct FieldhouseTournamentResults: Decodable, Sendable {
    let winners: [String: String]
}

struct FieldhouseTournamentScorecard: Decodable, Sendable {
    let firstFourPoints: Int
    let round64Points: Int
    let round32Points: Int
    let sweet16Points: Int
    let elite8Points: Int
    let finalFourPoints: Int
    let titlePoints: Int
    let totalPoints: Int
    let usedHellfire: Bool

    enum CodingKeys: String, CodingKey {
        case firstFourPoints = "first_four_points"
        case round64Points = "round_64_points"
        case round32Points = "round_32_points"
        case sweet16Points = "sweet_16_points"
        case elite8Points = "elite_8_points"
        case finalFourPoints = "final_four_points"
        case titlePoints = "title_points"
        case totalPoints = "total_points"
        case usedHellfire = "used_hellfire"
    }
}

struct FieldhouseResolvedGame: Identifiable, Hashable, Sendable {
    let game: FieldhouseTournamentGame
    let teams: [FieldhouseTournamentTeam]
    var id: String { game.id }
}

enum FieldhouseBracketEngine {
    static let decisionCount = 67

    static func resolvedGames(
        slate: FieldhouseTournamentSlate,
        picks: [String: String]
    ) -> [FieldhouseResolvedGame] {
        let teamsById = Dictionary(uniqueKeysWithValues: slate.teams.map { ($0.id, $0) })
        return slate.games
            .sorted { ($0.round, $0.id) < ($1.round, $1.id) }
            .map { game in
                let teams = [game.sourceA, game.sourceB].compactMap { source -> FieldhouseTournamentTeam? in
                    if source.hasPrefix("team:") {
                        return teamsById[String(source.dropFirst(5))]
                    }
                    guard source.hasPrefix("game:"),
                          let winnerId = picks[String(source.dropFirst(5))] else { return nil }
                    return teamsById[winnerId]
                }
                return FieldhouseResolvedGame(game: game, teams: teams)
            }
    }

    static func isComplete(picks: [String: String]) -> Bool {
        picks.count == decisionCount
    }

    static func clearDownstream(
        after changedGameId: String,
        games: [FieldhouseTournamentGame],
        picks: inout [String: String]
    ) {
        var invalidated = Set([changedGameId])
        var changed = true
        while changed {
            changed = false
            for game in games where !invalidated.contains(game.id) {
                let sources = [game.sourceA, game.sourceB]
                if sources.contains(where: { source in
                    source.hasPrefix("game:") && invalidated.contains(String(source.dropFirst(5)))
                }) {
                    invalidated.insert(game.id)
                    changed = true
                }
            }
        }
        invalidated.subtract([changedGameId])
        invalidated.forEach { picks.removeValue(forKey: $0) }
    }

    static func hellfirePicks(slate: FieldhouseTournamentSlate) -> [String: String] {
        var picks: [String: String] = [:]
        for _ in 0..<7 {
            let openGames = resolvedGames(slate: slate, picks: picks)
                .filter { $0.teams.count == 2 && picks[$0.id] == nil }
            for game in openGames {
                picks[game.id] = game.teams.randomElement()?.id
            }
        }
        return picks
    }
}
