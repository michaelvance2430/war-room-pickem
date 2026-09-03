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

    func testChampionshipTrophyLocksAtSeasonTip() {
        var state = FieldhouseSeasonState()
        state.seasonHasStarted = false
        let alternate = FieldhouseTrophyCatalog.ncaam[1].id
        XCTAssertTrue(state.selectChampionshipTrophy(alternate))
        XCTAssertEqual(state.championshipTrophyID, alternate)

        state.seasonHasStarted = true
        let lockedValue = state.championshipTrophyID
        XCTAssertFalse(state.selectChampionshipTrophy(FieldhouseTrophyCatalog.ncaam[2].id))
        XCTAssertEqual(state.championshipTrophyID, lockedValue)
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

    func testPickTaskBadgeOnlyShowsWhileAnOpenCardNeedsSubmission() {
        var state = FieldhouseSeasonState()
        let games = Array(FieldhouseGameCatalog.windowOne.prefix(FieldhouseGameCatalog.weeklyCardSize))
        XCTAssertTrue(state.publishCard(games: games, prop: .teamScores90))
        let beforeTip = state.pickLockDate.addingTimeInterval(-1)
        XCTAssertTrue(state.hasOutstandingPickTask(at: beforeTip))

        for index in games.indices {
            state.sideSelections[index] = games[index].home
            state.confidenceSelections[index] = index + 1
        }
        state.bestBetGame = 0
        state.propAnswer = "YES"
        XCTAssertTrue(state.lockPicks(at: beforeTip))
        XCTAssertFalse(state.hasOutstandingPickTask(at: beforeTip))

        state.picksLocked = false
        XCTAssertFalse(state.hasOutstandingPickTask(at: state.pickLockDate))
    }

    func testFieldhouseOneHourReminderUsesExactWeekLock() {
        let leagueID = UUID(uuidString: "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE")!
        let now = Date(timeIntervalSince1970: 1_000)
        let lockAt = now.addingTimeInterval(7_200)
        let reminder = FieldhouseCardReminderSchedule.oneHour(lockAt: lockAt, now: now, leagueID: leagueID, week: 8)
        XCTAssertEqual(reminder?.fireAt, now.addingTimeInterval(3_600))
        XCTAssertEqual(reminder?.identifier, "fieldhouse.card-lock.1h.\(leagueID.uuidString).8")
        XCTAssertNil(FieldhouseCardReminderSchedule.oneHour(lockAt: now.addingTimeInterval(3_600), now: now, leagueID: leagueID, week: 8))
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

    func testCommissionerCannotPublishAnUnscorableCard() {
        var games = Array(FieldhouseGameCatalog.windowOne.prefix(FieldhouseGameCatalog.weeklyCardSize))
        games[0] = FieldhouseGame(
            id: games[0].id,
            away: games[0].away,
            home: games[0].home,
            spread: "Unknown Team -3.5",
            tip: games[0].tip,
            dayOffset: games[0].dayOffset,
            tipHour: games[0].tipHour,
            tipMinute: games[0].tipMinute
        )
        var state = FieldhouseSeasonState()
        XCTAssertFalse(state.publishCard(games: games, prop: .teamScores90))
        XCTAssertFalse(state.cardIsPublished)
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

    func testDeadlineAutomaticallySealsCompleteCardButRejectsIncompleteCard() {
        var complete = FieldhouseSeasonState()
        let games = Array(FieldhouseGameCatalog.windowOne.prefix(10))
        XCTAssertTrue(complete.publishCard(games: games, prop: .teamScores90))
        for index in 0..<10 {
            complete.sideSelections[index] = games[index].home
            complete.confidenceSelections[index] = index + 1
        }
        complete.bestBetGame = 0
        complete.propAnswer = "YES"
        let completeDeadline = complete.pickLockDate
        complete.enforcePickDeadline(at: completeDeadline)
        XCTAssertTrue(complete.picksLocked)

        var incomplete = FieldhouseSeasonState()
        XCTAssertTrue(incomplete.publishCard(games: games, prop: .teamScores90))
        incomplete.sideSelections[0] = games[0].home
        let incompleteDeadline = incomplete.pickLockDate
        incomplete.enforcePickDeadline(at: incompleteDeadline)
        XCTAssertFalse(incomplete.picksLocked)
        XCTAssertTrue(incomplete.pickWindowIsClosed(at: incompleteDeadline))
        XCTAssertFalse(incomplete.canEditPicks(at: incompleteDeadline))
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

    func testHellfireUsesEveryPublishedFavoriteAndCannotFireAfterTip() {
        let games = Array(FieldhouseGameCatalog.windowOne.prefix(FieldhouseGameCatalog.weeklyCardSize))
        var state = FieldhouseSeasonState()
        XCTAssertTrue(state.publishCard(games: games, prop: .teamScores90))
        XCTAssertTrue(state.deployRegularSeasonHellfire(at: state.pickLockDate.addingTimeInterval(-1)))
        XCTAssertEqual(state.sideSelections.count, 10)
        XCTAssertTrue(games.indices.allSatisfy { state.sideSelections[$0] == games[$0].favoriteTeam })
        XCTAssertEqual(Set(state.confidenceSelections.values), Set(1...10))
        XCTAssertEqual(state.bestBetGame, 0)
        XCTAssertEqual(state.propAnswer, "YES")
        XCTAssertEqual(state.regularHellfiresRemaining, 1)

        var lateState = FieldhouseSeasonState()
        XCTAssertTrue(lateState.publishCard(games: games, prop: .teamScores90))
        XCTAssertFalse(lateState.deployRegularSeasonHellfire(at: lateState.pickLockDate))
        XCTAssertTrue(lateState.sideSelections.isEmpty)
        XCTAssertEqual(lateState.regularHellfiresRemaining, 2)
    }

    func testUnrelatedResultsCannotFalselyCompleteTheScoringCard() {
        var state = FieldhouseSeasonState()
        state.scoringGames = Array(FieldhouseGameCatalog.windowOne.prefix(2))
        state.scoringResults = [
            state.scoringGames[0].id: FieldhouseGameResult(gameID: state.scoringGames[0].id, awayScore: 80, homeScore: 70, phase: .final),
            "unrelated-game": FieldhouseGameResult(gameID: "unrelated-game", awayScore: 90, homeScore: 60, phase: .final)
        ]
        XCTAssertEqual(state.scoringFinalGames, 1)
        XCTAssertFalse(state.scoringIsComplete)
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
        XCTAssertEqual(state.scoringGamePoints(at: 0), 20)
        XCTAssertEqual(state.scoringGamePoints(at: 1), 0)
        XCTAssertNil(state.scoringGamePoints(at: 6))
        XCTAssertNil(state.scoringPropResult)
        XCTAssertTrue(state.roomPicksAreVisible(for: state.scoringGames[0].id))
    }

    func testRoomPicksStaySealedUntilOfficialGameStateIsLive() {
        var state = FieldhouseSeasonState()
        let game = state.scoringGames[0]
        state.scoringResults[game.id] = FieldhouseGameResult(gameID: game.id, awayScore: 0, homeScore: 0, phase: .scheduled)
        XCTAssertFalse(state.roomPicksAreVisible(for: game.id))
        state.scoringResults[game.id] = FieldhouseGameResult(gameID: game.id, awayScore: 2, homeScore: 0, phase: .live(period: "1H"))
        XCTAssertTrue(state.roomPicksAreVisible(for: game.id))
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
