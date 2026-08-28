import XCTest
@testable import WarRoom

final class FieldhouseExperienceTests: XCTestCase {
    func testOneHundredPlayerPostseasonCutIsSixteenSixtyEightSixteen() {
        let counts = WarRoomPostseasonRule.counts(playerCount: 100)
        XCTAssertEqual(counts.championship, 16)
        XCTAssertEqual(counts.activeNoBrass, 68)
        XCTAssertEqual(counts.toilet, 16)
    }

    func testBoundaryRanksKeepPickingButCannotEarnBrass() {
        XCTAssertEqual(WarRoomPostseasonRule.status(rank: 16, playerCount: 100), .championship(seed: 16))
        XCTAssertEqual(WarRoomPostseasonRule.status(rank: 17, playerCount: 100), .activeNoBrass)
        XCTAssertEqual(WarRoomPostseasonRule.status(rank: 84, playerCount: 100), .activeNoBrass)
        XCTAssertEqual(WarRoomPostseasonRule.status(rank: 85, playerCount: 100), .toilet(seed: 1))
    }

    func testFieldhouseStartsWithTwoRegularSeasonHellfires() {
        var state = FieldhouseSeasonState()
        XCTAssertEqual(state.regularHellfiresRemaining, 2)
        state.regularHellfiresUsed = 2
        XCTAssertEqual(state.regularHellfiresRemaining, 0)
    }
}
