import Foundation
import Testing
@testable import WarRoom

@MainActor struct MyLeaguesTests {
    let gameID = UUID()
    func card(start: String = "2026-09-12T16:00:00Z") -> WeekCard {
        WeekCard(id: UUID(), weekNumber: 3, lockTime: "2026-09-01T00:00:00Z", propQuestion: "Prop", propOptionA: "YES", propOptionB: "NO", propPoints: 3, cardGames: [CardGame(id: gameID, sortOrder: 0, awayTeam: "Alabama", homeTeam: "Georgia", spread: 7, favorite: "home", startTime: start, awayRank: nil, homeRank: nil, isRivalry: false)])
    }
    func pick(total: Int? = nil, locked: Bool = true, chaos: Bool = false) -> PlayerPick {
        PlayerPick(id: UUID(), propChoice: "YES", lockedAt: locked ? "2026-09-12T16:00:00Z" : nil, totalPoints: total, isChaos: chaos, pickGames: [PickedGame(cardGameId: gameID, side: "home", confidence: 5, isBestBet: true)])
    }
    @Test func rankPreservesTiesAndSkipsPositions() {
        let user = UUID(), other = UUID(), third = UUID()
        #expect(MyLeaguesScoring.rank(userID: user, totals: [user: 20, other: 20, third: 10]) == "T1 / 3")
        #expect(MyLeaguesScoring.rank(userID: third, totals: [user: 20, other: 20, third: 10]) == "3 / 3")
        #expect(MyLeaguesScoring.rank(userID: UUID(), totals: [user: 20]) == "—")
    }
    @Test func lockBeforeKickoffStillShowsTBD() {
        let now = ISO8601DateFormatter().date(from: "2026-09-11T12:00:00Z")!
        #expect(MyLeaguesScoring.points(card: card(), pick: pick(), result: nil, winners: [:], now: now) == "TBD")
    }
    @Test func startedWithoutScoredGamesShowsZero() {
        let now = ISO8601DateFormatter().date(from: "2026-09-12T17:00:00Z")!
        #expect(MyLeaguesScoring.points(card: card(), pick: pick(), result: nil, winners: [:], now: now) == "0")
    }
    @Test func onlyCompletedGamesCountAndPushesCountWithoutPoints() {
        func event(completed: Bool, home: Int) -> FootballScoreEvent {
            FootballScoreEvent(id: "game", commenceTime: "2026-09-12T16:00:00Z", completed: completed, homeTeam: "Georgia", awayTeam: "Alabama", scores: [FootballTeamScore(name: "Georgia", score: String(home)), FootballTeamScore(name: "Alabama", score: "0")], lastUpdate: nil)
        }
        #expect(MyLeaguesScoring.resolvedWinners(card: card(), result: nil, events: [event(completed: false, home: 21)]).isEmpty)
        let winners = MyLeaguesScoring.resolvedWinners(card: card(), result: nil, events: [event(completed: true, home: 7)])
        #expect(winners.count == 1)
        #expect(winners[gameID] == "push")
        #expect(MyLeaguesScoring.points(card: card(), pick: pick(), result: nil, winners: winners) == "0")
    }
    @Test func officialTotalWinsAndUnlockedPicksDoNotEarnPoints() {
        let winners = [gameID: "home"]
        #expect(MyLeaguesScoring.points(card: card(), pick: pick(total: 26), result: nil, winners: winners) == "26")
        #expect(MyLeaguesScoring.points(card: card(), pick: pick(locked: false), result: nil, winners: winners) == "0")
        #expect(MyLeaguesScoring.points(card: card(), pick: pick(chaos: true), result: nil, winners: winners) == "20")
    }
    @Test func officialResultsExcludeOtherCardsAndDeduplicateGames() {
        let result = CertifiedWeekResult(id: UUID(), weekNumber: 3, propResult: nil, scoredAt: "2026-09-12T20:00:00Z", gameResults: [CertifiedGameResult(cardGameId: gameID, winner: "away", awayScore: nil, homeScore: nil), CertifiedGameResult(cardGameId: gameID, winner: "away", awayScore: nil, homeScore: nil), CertifiedGameResult(cardGameId: UUID(), winner: "home", awayScore: nil, homeScore: nil)])
        #expect(MyLeaguesScoring.resolvedWinners(card: card(), result: result, events: []).count == 1)
    }
    @Test func sportsHaveStableOrderWithoutMixingBasketballLeagues() {
        #expect(LeagueTrackerGrouping.orderedSports(["nfl", "CFB", "ncaaw", "cfb", "ncaam", "golf"]) == ["CFB", "NFL", "NCAAM", "NCAAW", "GOLF"])
    }
    @Test func hiddenLeaguesCanReturnButCompletedSeasonsCannotBeForcedOn() throws {
        let id = UUID()
        var active = LeagueTrackerSetting(leagueId: id, hidden: true, seasonEnded: false)
        #expect(!active.isVisible)
        active.hidden = false
        #expect(active.isVisible)
        let completed = LeagueTrackerSetting(leagueId: id, hidden: false, seasonEnded: true)
        #expect(!completed.isVisible)
        let json = "{\"league_id\":\"\(id)\",\"hidden\":false,\"season_ended\":true}"
        #expect(try JSONDecoder().decode(LeagueTrackerSetting.self, from: Data(json.utf8)) == completed)
    }

    func standing(_ points: Int, name: String = "Player") -> Standing {
        Standing(id: UUID(), userId: UUID(), totalPoints: points, weeklyPoints: [], weeksPlayed: 0,
            displayNameOverride: name, division: nil, profiles: nil, atsCorrect: 0, atsTotal: 0,
            currentStreak: 0, bestWeek: points, worstWeek: 0, perfectWeeks: 0, bestBetHits: 0,
            bestBetTotal: 0, propHits: 0, propTotal: 0, isBot: false)
    }

    @Test func liveRankReproducesFifthToSeventhWithoutATie() {
        let rows = [standing(29), standing(27), standing(26), standing(22), standing(21, name: "Bagz"), standing(19), standing(19)]
        let user = rows[4].userId
        #expect(MyLeaguesScoring.rank(userID: user, totals: LeagueStandingsRanking.totals(rows)) == "5 / 7")
        let liveTotals = [31, 29, 28, 27, 23, 26, 24]
        let projections = Dictionary(uniqueKeysWithValues: zip(rows, liveTotals).map { ($0.0.userId, $0.1) })
        let totals = LeagueStandingsRanking.totals(rows, projections: projections)
        let ordered = LeagueStandingsRanking.ordered(rows, totals: totals, achievementPoints: [:])
        #expect(ordered.last?.userId == user)
        #expect(LeagueStandingsRanking.rank(userID: user, totals: totals)?.label == "7")
        #expect(MyLeaguesScoring.rank(userID: user, totals: totals) == "7 / 7")
    }

    @Test func achievementsBreakPointsTiesBeforeShowingT() {
        let first = UUID(), second = UUID(), third = UUID(), fourth = UUID()
        let totals = [first: 27, second: 23, third: 23, fourth: 20]
        #expect(MyLeaguesScoring.rank(userID: third, totals: totals, achievementPoints: [second: 100, third: 50]) == "3 / 4")
        #expect(MyLeaguesScoring.rank(userID: third, totals: totals, achievementPoints: [second: 100, third: 100]) == "T2 / 4")
        #expect(MyLeaguesScoring.rank(userID: fourth, totals: totals, achievementPoints: [second: 100, third: 100]) == "4 / 4")
    }

    @Test func sharedProjectionAddsEarnedPointsOnlyOnceAndIgnoresFutureGames() {
        let player = standing(21)
        let board = BoardPick(id: UUID(), userId: player.userId, totalPoints: nil, propChoice: nil,
            displayName: "Player", favoriteTeamId: nil,
            pickGames: [PickedGame(cardGameId: gameID, side: "home", confidence: 1, isBestBet: true)])
        let event = FootballScoreEvent(id: "live", commenceTime: "2026-09-12T16:00:00Z", completed: false,
            homeTeam: "Georgia", awayTeam: "Alabama", scores: [FootballTeamScore(name: "Georgia", score: "14"), FootballTeamScore(name: "Alabama", score: "0")], lastUpdate: nil)
        let before = ISO8601DateFormatter().date(from: "2026-09-12T15:00:00Z")!
        let after = ISO8601DateFormatter().date(from: "2026-09-12T17:00:00Z")!
        #expect(LeagueStandingsRanking.projectedTotals(card: card(), standings: [player], picks: [board], events: [event], now: before)[player.userId] == 21)
        #expect(LeagueStandingsRanking.projectedTotals(card: card(), standings: [player], picks: [board], events: [event], now: after)[player.userId] == 23)
        let certified = BoardPick(id: board.id, userId: player.userId, totalPoints: 2, propChoice: nil, displayName: "Player", favoriteTeamId: nil, pickGames: board.pickGames)
        #expect(LeagueStandingsRanking.projectedTotals(card: card(), standings: [player], picks: [certified], events: [event], now: after)[player.userId] == 21)
        #expect(LeagueStandingsRanking.totals([player], postseason: [player.userId: 5], projections: [player.userId: 23])[player.userId] == 28)
    }

}
