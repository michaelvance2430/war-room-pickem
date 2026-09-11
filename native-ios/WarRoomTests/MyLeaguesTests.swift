import Foundation
import Testing
@testable import WarRoom

struct MyLeaguesTests {
    let gameID = UUID()
    func card(start: String = "2026-09-12T16:00:00Z") -> WeekCard {
        WeekCard(id: UUID(), weekNumber: 3, lockTime: "2026-09-01T00:00:00Z", propQuestion: "Prop", propOptionA: "YES", propOptionB: "NO", propPoints: 3, cardGames: [CardGame(id: gameID, sortOrder: 0, awayTeam: "Alabama", homeTeam: "Georgia", spread: 7, favorite: "home", startTime: start, awayRank: nil, homeRank: nil, isRivalry: false)])
    }
    func pick(total: Int? = nil, locked: Bool = true, chaos: Bool = false) -> PlayerPick {
        PlayerPick(id: UUID(), propChoice: "YES", lockedAt: locked ? "2026-09-12T16:00:00Z" : nil, totalPoints: total, isChaos: chaos, pickGames: [PickedGame(cardGameId: gameID, side: "home", confidence: 5, isBestBet: true)])
    }
    @Test func rankPreservesTiesAndSkipsPositions() {
        let user = UUID(), other = UUID(), third = UUID()
        #expect(MyLeaguesScoring.rank(userID: user, totals: [user: 20, other: 20, third: 10]) == "T-1 / 3")
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

}
