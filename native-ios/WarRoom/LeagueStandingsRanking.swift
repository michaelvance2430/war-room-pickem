import Foundation

/// Shared by the league table and cross-league tracker. Display order within a
/// tie does not turn equal league scores and achievement points into different ranks.
enum LeagueStandingsRanking {
    struct Rank: Equatable {
        let position: Int
        let tied: Bool
        var label: String { "\(tied ? "T" : "")\(position)" }
    }

    static func rank(userID: UUID, totals: [UUID: Int], achievementPoints: [UUID: Int] = [:]) -> Rank? {
        guard let own = totals[userID] else { return nil }
        let ownAchievements = achievementPoints[userID, default: 0]
        return Rank(position: totals.filter { $0.value > own || ($0.value == own && achievementPoints[$0.key, default: 0] > ownAchievements) }.count + 1,
                    tied: totals.filter { $0.value == own && achievementPoints[$0.key, default: 0] == ownAchievements }.count > 1)
    }

    static func achievementPoints(_ achievements: [ProfileAchievement], userID: UUID) -> Int {
        let creator = AppIdentity.isCreator(userID) && !achievements.contains { $0.code == "the_commissioner" || $0.code == "the_creator" }
        return PromotionPoints.total(for: achievements) + (creator ? PromotionPoints.points(for: "the_creator") : 0)
    }

    static func ordered(_ rows: [Standing], totals: [UUID: Int], achievementPoints: [UUID: Int]) -> [Standing] {
        rows.sorted {
            let left = totals[$0.userId, default: 0], right = totals[$1.userId, default: 0]
            if left != right { return left > right }
            let leftAchievements = achievementPoints[$0.userId, default: 0], rightAchievements = achievementPoints[$1.userId, default: 0]
            if leftAchievements != rightAchievements { return leftAchievements > rightAchievements }
            let names = $0.name.localizedCaseInsensitiveCompare($1.name)
            return names == .orderedSame ? $0.userId.uuidString < $1.userId.uuidString : names == .orderedAscending
        }
    }

    static func totals(_ rows: [Standing], postseason: [UUID: Int] = [:], projections: [UUID: Int]? = nil) -> [UUID: Int] {
        Dictionary(rows.map { ($0.userId, (projections?[$0.userId] ?? $0.totalPoints) + postseason[$0.userId, default: 0]) },
                   uniquingKeysWith: { first, _ in first })
    }

    static func projectedTotals(card: WeekCard, standings: [Standing], picks: [BoardPick], events: [FootballScoreEvent], now: Date = Date()) -> [UUID: Int] {
        var totals: [UUID: Int] = [:]
        for standing in standings {
            // Certified week totals are already included in the season total.
            guard let pick = picks.first(where: { $0.userId == standing.userId }), pick.totalPoints == nil else {
                totals[standing.userId] = standing.totalPoints
                continue
            }
            var weekPoints = 0
            for selected in pick.pickGames {
                guard let game = card.cardGames.first(where: { $0.id == selected.cardGameId }),
                      let start = footballKickoffDate(game.startTime), start <= now,
                      let event = events.first(where: {
                          normalizedFootballTeam($0.homeTeam) == normalizedFootballTeam(game.homeTeam)
                          && normalizedFootballTeam($0.awayTeam) == normalizedFootballTeam(game.awayTeam)
                          && footballKickoffDate($0.commenceTime).map { abs($0.timeIntervalSince(start)) < 86_400 } == true
                      }),
                      let home = event.scores.first(where: { normalizedFootballTeam($0.name) == normalizedFootballTeam(event.homeTeam) }).flatMap({ Int($0.score) }),
                      let away = event.scores.first(where: { normalizedFootballTeam($0.name) == normalizedFootballTeam(event.awayTeam) }).flatMap({ Int($0.score) }) else { continue }
                let favorite = game.favorite.lowercased() == "away" ? "away" : "home"
                let margin = card.cardKind == "conference_championship"
                    ? Double(home - away)
                    : Double(favorite == "away" ? away - home : home - away) - abs(game.spread)
                guard abs(margin) >= 0.0001 else { continue }
                let winner = card.cardKind == "conference_championship"
                    ? (margin > 0 ? "home" : "away")
                    : (margin > 0 ? favorite : (favorite == "home" ? "away" : "home"))
                if winner == selected.side.lowercased() {
                    weekPoints += selected.confidence * (selected.isBestBet ? 2 : 1)
                }
            }
            totals[standing.userId] = standing.totalPoints + weekPoints
        }
        return totals
    }
}

/// One refresh shares in-flight achievement lookups across leagues. No ranking
/// data is retained across refreshes or accounts.
@MainActor final class LeagueRankingContext {
    private var requests: [UUID: Task<Int, Error>] = [:]

    func points(token: String, userID: UUID) async throws -> Int {
        if let request = requests[userID] { return try await request.value }
        let request = Task {
            let achievements = try await SupabaseAPI.profileAchievements(token: token, userId: userID)
            return LeagueStandingsRanking.achievementPoints(achievements, userID: userID)
        }
        requests[userID] = request
        return try await request.value
    }
}
