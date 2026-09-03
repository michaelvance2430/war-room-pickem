import XCTest
@testable import WarRoom

final class FieldhouseExperienceTests: XCTestCase {
    func testFavoriteAndCrystalBallCatalogContainsFullDivisionOneDirectory() {
        XCTAssertEqual(FieldhouseTeamCatalog.all.count, 362)
        XCTAssertTrue(FieldhouseTeamCatalog.all.contains("Abilene Christian Wildcats"))
        XCTAssertTrue(FieldhouseTeamCatalog.all.contains("UConn Huskies"))
        XCTAssertTrue(FieldhouseTeamCatalog.all.contains("Youngstown State Penguins"))
    }

    func testOneHundredPlayerPostseasonCutIsSixteenSixtyEightSixteen() {
        let counts = WarRoomPostseasonRule.counts(playerCount: 100)
        XCTAssertEqual(counts.championship, 16)
        XCTAssertEqual(counts.activeNoBrass, 68)
        XCTAssertEqual(counts.toilet, 16)
    }

    func testBoundaryRanksAreCalculatedInsideEachRegion() {
        let counts = WarRoomPostseasonRule.regionalCounts(playerCount: 25)
        XCTAssertEqual(counts.championship, 4)
        XCTAssertEqual(counts.activeNoBrass, 17)
        XCTAssertEqual(counts.toilet, 4)
        XCTAssertEqual(WarRoomPostseasonRule.status(rank: 4, playerCount: 25), .championship(seed: 4))
        XCTAssertEqual(WarRoomPostseasonRule.status(rank: 5, playerCount: 25), .activeNoBrass)
        XCTAssertEqual(WarRoomPostseasonRule.status(rank: 21, playerCount: 25), .activeNoBrass)
        XCTAssertEqual(WarRoomPostseasonRule.status(rank: 22, playerCount: 25), .toilet(seed: 1))
    }

    func testFieldhouseStartsWithTwoRegularSeasonHellfires() {
        var state = FieldhouseSeasonState()
        XCTAssertEqual(state.regularHellfiresRemaining, 2)
        state.regularHellfiresUsed = 2
        XCTAssertEqual(state.regularHellfiresRemaining, 0)
    }

    func testWeeklyCardStartsBlankAndConfidenceCanBeDeselected() {
        var state = FieldhouseSeasonState()
        XCTAssertFalse(state.cardIsPublished)
        XCTAssertTrue(state.sideSelections.isEmpty)
        XCTAssertTrue(state.confidenceSelections.isEmpty)
        XCTAssertNil(state.bestBetGame)
        XCTAssertNil(state.propAnswer)

        state.toggleConfidence(10, for: 1)
        XCTAssertEqual(state.confidenceSelections[1], 10)
        XCTAssertFalse(state.confidenceAvailable(10, for: 2))
        state.toggleConfidence(10, for: 1)
        XCTAssertNil(state.confidenceSelections[1])
        XCTAssertTrue(state.confidenceAvailable(10, for: 2))
    }

    func testCommissionerCannotPublishAnIncompleteCard() {
        var state = FieldhouseSeasonState()
        XCTAssertFalse(state.publishCard(games: Array(FieldhouseGameCatalog.windowOne.prefix(9)), prop: "Will a ranked team trail at halftime?"))
        XCTAssertFalse(state.cardIsPublished)
        XCTAssertFalse(state.publishCard(games: Array(FieldhouseGameCatalog.windowOne.prefix(10)), prop: "   "))
        XCTAssertFalse(state.cardIsPublished)

        XCTAssertTrue(state.publishCard(games: Array(FieldhouseGameCatalog.windowOne.prefix(10)), prop: "Will a ranked team trail at halftime?"))
        XCTAssertTrue(state.cardIsPublished)
        XCTAssertEqual(state.publishedGames.count, 10)
        XCTAssertEqual(state.publishedProp, "Will a ranked team trail at halftime?")
    }

    func testPlayerCannotLockUntilEveryRequiredDecisionIsComplete() {
        var state = FieldhouseSeasonState()
        XCTAssertTrue(state.publishCard(games: Array(FieldhouseGameCatalog.windowOne.prefix(10)), prop: "Will a ranked team trail at halftime?"))
        XCTAssertFalse(state.cardIsComplete)
        for index in 0..<10 {
            state.sideSelections[index] = state.publishedGames[index].home
            state.confidenceSelections[index] = index + 1
        }
        state.bestBetGame = 0
        XCTAssertFalse(state.cardIsComplete)
        state.propAnswer = "YES"
        XCTAssertTrue(state.cardIsComplete)
    }

    func testSeasonStartLocksRegionRebalancing() {
        var state = FieldhouseSeasonState()
        XCTAssertFalse(state.canRebalanceRegions)
        state.seasonHasStarted = false
        XCTAssertTrue(state.canRebalanceRegions)
    }

    func testLateEntryUsesBottomFifteenPercentAndClosesAtPostseason() {
        let scores = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]
        XCTAssertEqual(FieldhouseLateEntryRule.entryScore(existingScores: scores), 15)
        XCTAssertTrue(FieldhouseLateEntryRule.acceptsEntries(during: .conferenceChampionships))
        XCTAssertFalse(FieldhouseLateEntryRule.acceptsEntries(during: .postseason))
    }
}
