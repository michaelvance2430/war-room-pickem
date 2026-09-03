import XCTest
@testable import WarRoom

final class FieldhouseExperienceTests: XCTestCase {
    func testMensAndWomensFieldhouseHaveDistinctSixTrophyCollections() {
        XCTAssertEqual(FieldhouseTrophyCatalog.ncaam.count, 6)
        XCTAssertEqual(FieldhouseTrophyCatalog.ncaaw.count, 6)

        let mensIDs = Set(FieldhouseTrophyCatalog.ncaam.map(\.id))
        let womensIDs = Set(FieldhouseTrophyCatalog.ncaaw.map(\.id))
        let allAssets = FieldhouseTrophyCatalog.ncaam.map(\.asset) + FieldhouseTrophyCatalog.ncaaw.map(\.asset)

        XCTAssertTrue(mensIDs.isDisjoint(with: womensIDs))
        XCTAssertEqual(Set(allAssets).count, 12)
        XCTAssertEqual(FieldhouseLeague.ncaam.displayName, "THE FIELDHOUSE · NCAAM")
        XCTAssertEqual(FieldhouseLeague.ncaaw.displayName, "THE FIELDHOUSE · NCAAW")
    }

    func testChangingFieldhouseLeagueResetsTrophyToThatLeagueCollection() {
        var state = FieldhouseSeasonState()
        XCTAssertEqual(state.league, .ncaam)
        XCTAssertEqual(state.championshipTrophyID, FieldhouseTrophyCatalog.ncaam[0].id)

        state.selectLeague(.ncaaw)
        XCTAssertEqual(state.championshipTrophyID, FieldhouseTrophyCatalog.ncaaw[0].id)
        XCTAssertTrue(FieldhouseTrophyCatalog.ncaaw.map(\.id).contains(state.championshipTrophyID))
        XCTAssertFalse(FieldhouseTrophyCatalog.ncaam.map(\.id).contains(state.championshipTrophyID))
    }

    func testCurrentFieldhouseBuildExposesNCAAMFirst() {
        XCTAssertEqual(FieldhouseLeague.activeBuild, .ncaam)
    }

    func testFieldhouseUsesMondaySundayWindowsAndNamesTheLockWeek() {
        let calendar = Calendar(identifier: .gregorian)
        XCTAssertEqual(calendar.component(.weekday, from: FieldhouseSeasonCalendar.openingTip), 2)
        XCTAssertTrue(FieldhouseSeasonCalendar.windowLabel(1).contains("NOV 2–NOV 8"))
        XCTAssertTrue(FieldhouseSeasonCalendar.lockClock(at: .distantPast, window: 2).hasPrefix("WEEK 2 PICKS LOCK IN"))
    }

    func testRoomPicksDeclassifyAtEachIndividualGameTip() {
        let tip = Date(timeIntervalSince1970: 1_000)
        XCTAssertFalse(FieldhousePickVisibility.canSeeRoomPicks(at: Date(timeIntervalSince1970: 999), gameTip: tip))
        XCTAssertTrue(FieldhousePickVisibility.canSeeRoomPicks(at: tip, gameTip: tip))
    }

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
        XCTAssertFalse(state.publishCard(games: Array(FieldhouseGameCatalog.windowOne.prefix(9)), prop: .teamScores90))
        XCTAssertFalse(state.cardIsPublished)

        XCTAssertTrue(state.publishCard(games: Array(FieldhouseGameCatalog.windowOne.prefix(10)), prop: .teamScores90))
        XCTAssertTrue(state.cardIsPublished)
        XCTAssertEqual(state.publishedGames.count, 10)
        XCTAssertEqual(state.publishedProp, .teamScores90)
    }

    func testPlayerCannotLockUntilEveryRequiredDecisionIsComplete() {
        var state = FieldhouseSeasonState()
        XCTAssertTrue(state.publishCard(games: Array(FieldhouseGameCatalog.windowOne.prefix(10)), prop: .teamScores90))
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

    func testPublishedCardLocksAtItsEarliestExactTip() {
        let games = Array(FieldhouseGameCatalog.windowOne.prefix(10))
        let earliestTip = games.map { $0.tipDate(in: 2) }.min()!
        XCTAssertEqual(FieldhouseSeasonCalendar.lockDate(for: 2, games: games), earliestTip)
        XCTAssertEqual(games[0].tip, "THU · 7:00 PM")
    }

    func testPicksCannotLockOrReopenAfterFirstTip() {
        var state = FieldhouseSeasonState()
        XCTAssertTrue(state.publishCard(games: Array(FieldhouseGameCatalog.windowOne.prefix(10)), prop: .teamScores90))
        for index in 0..<10 {
            state.sideSelections[index] = state.publishedGames[index].home
            state.confidenceSelections[index] = index + 1
        }
        state.bestBetGame = 0
        state.propAnswer = "YES"

        let beforeTip = state.pickLockDate.addingTimeInterval(-1)
        let atTip = state.pickLockDate
        XCTAssertTrue(state.lockPicks(at: beforeTip))
        XCTAssertFalse(state.reopenPicks(at: atTip))
        XCTAssertTrue(state.picksLocked)
    }

    func testEveryCommissionerPropIsStructuredForAutomaticScoring() {
        XCTAssertEqual(FieldhousePropKind.allCases.count, 4)
        XCTAssertEqual(Set(FieldhousePropKind.allCases.map(\.question)).count, FieldhousePropKind.allCases.count)
        XCTAssertTrue(FieldhousePropKind.allCases.allSatisfy { $0.question.hasSuffix("?") })
    }

    func testTenGameHellfireConfidencePatternIsValid() {
        let confidences = Dictionary(uniqueKeysWithValues: (0..<FieldhouseGameCatalog.weeklyCardSize).map {
            ($0, FieldhouseGameCatalog.weeklyCardSize - $0)
        })
        XCTAssertEqual(Set(confidences.values), Set(1...10))
        XCTAssertEqual(confidences.count, 10)
    }

    func testStructuredPropsWaitForEveryFinalThenScoreAutomatically() {
        let games = Array(FieldhouseGameCatalog.windowOne.prefix(2))
        var results = [
            games[0].id: FieldhouseGameResult(gameID: games[0].id, awayScore: 91, homeScore: 86, phase: .final),
            games[1].id: FieldhouseGameResult(gameID: games[1].id, awayScore: 70, homeScore: 69, phase: .live(period: "2H"))
        ]
        XCTAssertNil(FieldhousePropEvaluator.answer(for: .teamScores90, games: games, results: results))

        results[games[1].id] = FieldhouseGameResult(gameID: games[1].id, awayScore: 70, homeScore: 69, phase: .final)
        XCTAssertEqual(FieldhousePropEvaluator.answer(for: .teamScores90, games: games, results: results), true)
        XCTAssertEqual(FieldhousePropEvaluator.answer(for: .gameWithinThree, games: games, results: results), true)
        XCTAssertEqual(FieldhousePropEvaluator.answer(for: .combinedScore150, games: games, results: results), true)
    }

    func testUnderdogPropUsesThePublishedSpreadFavorite() {
        let game = FieldhouseGameCatalog.windowOne[0]
        XCTAssertEqual(game.favoriteTeam, "Duke Blue Devils")
        XCTAssertEqual(game.underdogTeam, "Gonzaga Bulldogs")
        let result = FieldhouseGameResult(gameID: game.id, awayScore: 78, homeScore: 74, phase: .final)
        XCTAssertEqual(FieldhousePropEvaluator.answer(for: .underdogWins, games: [game], results: [game.id: result]), true)
    }

    func testLiveScoreEngineUsesSpreadConfidenceBestBetAndFinalProp() {
        let games = Array(FieldhouseGameCatalog.windowOne.prefix(2))
        let results = [
            games[0].id: FieldhouseGameResult(gameID: games[0].id, awayScore: 78, homeScore: 76, phase: .final),
            games[1].id: FieldhouseGameResult(gameID: games[1].id, awayScore: 80, homeScore: 70, phase: .final)
        ]
        XCTAssertEqual(results[games[0].id]?.coverWinner(in: games[0]), games[0].away)
        XCTAssertEqual(results[games[1].id]?.coverWinner(in: games[1]), games[1].away)

        let points = FieldhouseScoreEngine.points(
            games: games,
            results: results,
            selections: [0: games[0].away, 1: games[1].away],
            confidences: [0: 10, 1: 9],
            bestBetGame: 0,
            prop: .combinedScore150,
            propAnswer: "YES"
        )
        XCTAssertEqual(points, 32)
    }

    func testPreviewLiveBoardPointsAreDerivedFromGameResults() {
        let state = FieldhouseSeasonState()
        XCTAssertEqual(state.scoringFinalGames, 6)
        XCTAssertEqual(state.scoringLiveGames, 4)
        XCTAssertEqual(state.scoringPoints, 34)
    }

    func testCompletedFloorPromotesLockedOnDeckCardAtItsFirstTip() {
        var state = FieldhouseSeasonState()
        state.scoringResults = Dictionary(uniqueKeysWithValues: state.scoringGames.enumerated().map { index, game in
            (game.id, FieldhouseGameResult(gameID: game.id, awayScore: index == 0 ? 91 : 75, homeScore: 70, phase: .final))
        })
        XCTAssertTrue(state.scoringIsComplete)

        let nextGames = Array(FieldhouseGameCatalog.windowOne.prefix(10))
        XCTAssertTrue(state.publishCard(games: nextGames, prop: .gameWithinThree))
        for index in 0..<10 {
            state.sideSelections[index] = nextGames[index].home
            state.confidenceSelections[index] = index + 1
        }
        state.bestBetGame = 0
        state.propAnswer = "NO"
        XCTAssertTrue(state.lockPicks(at: state.pickLockDate.addingTimeInterval(-1)))

        let priorWindow = state.scoringWindow
        let promotedWindow = state.window
        let promotionTip = state.pickLockDate
        XCTAssertFalse(state.advanceToNextWindow(at: promotionTip.addingTimeInterval(-1)))
        XCTAssertTrue(state.advanceToNextWindow(at: promotionTip))
        XCTAssertEqual(state.lastCertifiedWindow, priorWindow)
        XCTAssertEqual(state.scoringWindow, promotedWindow)
        XCTAssertEqual(state.window, promotedWindow + 1)
        XCTAssertFalse(state.cardIsPublished)
        XCTAssertEqual(state.scoringResults.values.filter(\.isFinal).count, 0)
        XCTAssertEqual(state.scoringProp, .gameWithinThree)
        XCTAssertEqual(state.scoringPropAnswer, "NO")
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
