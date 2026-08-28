import XCTest
@testable import WarRoom

@MainActor final class FieldhouseExperienceTests: XCTestCase {
    func testOneHundredPlayerPostseasonCutIsSixteenSixtyEightSixteen() {
        let counts = WarRoomPostseasonRule.leagueCounts(conferencePlayerCounts: [25, 25, 25, 25])
        XCTAssertEqual(counts.championship, 16)
        XCTAssertEqual(counts.activeNoBrass, 68)
        XCTAssertEqual(counts.toilet, 16)
    }

    func testConferenceBoundaryRanksKeepPickingButCannotEarnBrass() {
        XCTAssertEqual(WarRoomPostseasonRule.status(conferenceRank: 4, conferencePlayerCount: 25), .championship(seed: 4))
        XCTAssertEqual(WarRoomPostseasonRule.status(conferenceRank: 5, conferencePlayerCount: 25), .activeNoBrass)
        XCTAssertEqual(WarRoomPostseasonRule.status(conferenceRank: 21, conferencePlayerCount: 25), .activeNoBrass)
        XCTAssertEqual(WarRoomPostseasonRule.status(conferenceRank: 22, conferencePlayerCount: 25), .toilet(seed: 1))
    }

    func testUnevenConferencesStillQualifyIndependently() {
        let counts = WarRoomPostseasonRule.leagueCounts(conferencePlayerCounts: [11, 10, 10, 11])
        XCTAssertEqual(counts.championship, 16)
        XCTAssertEqual(counts.activeNoBrass, 10)
        XCTAssertEqual(counts.toilet, 16)
    }

    func testFieldhouseStartsWithTwoRegularSeasonHellfires() {
        var state = FieldhouseSeasonState()
        XCTAssertEqual(state.regularHellfiresRemaining, 2)
        state.regularHellfiresUsed = 2
        XCTAssertEqual(state.regularHellfiresRemaining, 0)
    }

    func testFieldhouseBracketRequiresAllSixtySevenDecisions() {
        XCTAssertFalse(FieldhouseBracketEngine.isComplete(picks: [:]))
        let complete = Dictionary(uniqueKeysWithValues: (0..<67).map { ("game-\($0)", "team") })
        XCTAssertTrue(FieldhouseBracketEngine.isComplete(picks: complete))
    }

    func testChangingEarlyWinnerClearsEveryDependentDecision() {
        let games = [
            FieldhouseTournamentGame(id: "opening", round: 0, sourceA: "team:a", sourceB: "team:b"),
            FieldhouseTournamentGame(id: "regional", round: 1, sourceA: "game:opening", sourceB: "team:c"),
            FieldhouseTournamentGame(id: "title", round: 2, sourceA: "game:regional", sourceB: "team:d"),
            FieldhouseTournamentGame(id: "unrelated", round: 1, sourceA: "team:e", sourceB: "team:f"),
        ]
        var picks = ["opening": "a", "regional": "a", "title": "a", "unrelated": "e"]
        FieldhouseBracketEngine.clearDownstream(after: "opening", games: games, picks: &picks)
        XCTAssertEqual(picks, ["opening": "a", "unrelated": "e"])
    }
}
