import XCTest
@testable import WarRoom

@MainActor
final class FieldhouseExperienceTests: XCTestCase {
    func testPostseasonStandingsUseHonestCompetitionRanksForTiedTotals() {
        let leaderA = UUID()
        let leaderB = UUID()
        let third = UUID()
        let fourth = UUID()
        let participants = [leaderA, leaderB, third, fourth]
        let totals = [leaderA: 42, leaderB: 42, third: 37, fourth: 30]

        XCTAssertEqual(
            FieldhousePostseasonRanking.rank(for: leaderA, among: participants, totals: totals),
            FieldhouseCompetitionRank(place: 1, tied: true)
        )
        XCTAssertEqual(
            FieldhousePostseasonRanking.rank(for: leaderB, among: participants, totals: totals)?.headlineLabel,
            "T-1"
        )
        XCTAssertEqual(
            FieldhousePostseasonRanking.rank(for: third, among: participants, totals: totals),
            FieldhouseCompetitionRank(place: 3, tied: false)
        )
        XCTAssertEqual(
            FieldhousePostseasonRanking.rank(for: fourth, among: participants, totals: totals)?.rowLabel,
            "4"
        )
    }

    func testTournamentMoneylinesDecodeWithoutChangingStraightUpResultAuthority() throws {
        let payload = """
        {
          "game_id":"east-r64-1",
          "round_key":"r64",
          "round_order":1,
          "ordinal":0,
          "region":"East",
          "first_team_id":"duke",
          "second_team_id":"vermont",
          "first_source_game_id":null,
          "second_source_game_id":null,
          "starts_at":"2027-03-18T16:00:00Z",
          "winner_team_id":null,
          "first_score":null,
          "second_score":null,
          "first_moneyline":-650,
          "second_moneyline":475,
          "odds_bookmaker":"DraftKings",
          "odds_updated_at":"2027-03-18T04:00:00Z"
        }
        """
        let game = try JSONDecoder().decode(FieldhouseTournamentGameRecord.self, from: Data(payload.utf8))
        XCTAssertEqual(game.firstMoneyline, -650)
        XCTAssertEqual(game.secondMoneyline, 475)
        XCTAssertEqual(game.oddsBookmaker, "DraftKings")
        XCTAssertNil(game.winnerTeamId)
    }

    func testSelectionSundayEligibilityLabelsKeepHardwarePathsExplicit() {
        var state = FieldhouseSeasonState()
        XCTAssertEqual(state.postseasonEligibilityLabel, "SELECTION SUNDAY PENDING")

        state.postseasonEligibilityPath = "championship"
        XCTAssertEqual(state.postseasonEligibilityLabel, "CHAMPIONSHIP FIELD")

        state.postseasonEligibilityPath = "toilet_bowl"
        XCTAssertEqual(state.postseasonEligibilityLabel, "TOILET BOWL FIELD")

        state.postseasonEligibilityPath = "no_brass"
        XCTAssertEqual(state.postseasonEligibilityLabel, "POINTS + CHEEVOS · NO BRASS")
    }

    func testFieldhouseLiveRouteRecognizesBothBasketballLeaguesButRemainsDark() {
        XCTAssertTrue(FieldhouseReleaseGate.supports(sportID: "ncaam"))
        XCTAssertTrue(FieldhouseReleaseGate.supports(sportID: "NCAAW"))
        XCTAssertTrue(FieldhouseReleaseGate.supports(sportID: "cbb"))
        XCTAssertFalse(FieldhouseReleaseGate.supports(sportID: "cfb"))
        XCTAssertFalse(FieldhouseReleaseGate.supports(sportID: "nfl"))
        XCTAssertFalse(FieldhouseReleaseGate.shouldRoute(sportID: "ncaam"))
        XCTAssertFalse(FieldhouseReleaseGate.shouldRoute(sportID: "ncaaw"))
    }

    func testAuthenticatedSnapshotHydratesTheCorrectLeagueCardAndPlayerChoices() throws {
        let userID = UUID()
        let leagueID = UUID()
        let firstGameID = UUID()
        let secondGameID = UUID()
        let membership = LeagueMembership(
            leagueId: leagueID,
            role: "commissioner",
            isModerator: false,
            isDeputy: false,
            totalPoints: 0,
            weeklyPoints: [],
            weeksPlayed: 0,
            division: "East",
            fieldhouseRegion: "Midwest",
            joinedAt: nil,
            atsCorrect: 0,
            atsTotal: 0,
            currentStreak: 0,
            bestWeek: 0,
            worstWeek: 0,
            perfectWeeks: 0,
            bestBetHits: 0,
            bestBetTotal: 0,
            propHits: 0,
            propTotal: 0,
            leagues: LeagueSummary(
                name: "Women's Fieldhouse",
                code: "WOMEN1",
                sportId: "ncaaw",
                currentWeek: 1,
                commissionerId: userID,
                crystalBallEnabled: true,
                championshipTrophyId: "w-extra-pass",
                mode: nil,
                regularSeasonWeeks: 18,
                maxHumanMembers: 100,
                sportSettings: LeagueSportSettings(fieldhouseLeague: "ncaaw")
            )
        )
        let games = [
            CardGame(id: firstGameID, sortOrder: 0, awayTeam: "UConn Huskies", homeTeam: "South Carolina Gamecocks", spread: -4.5, favorite: "home", startTime: "2026-11-05T00:30:00Z", awayRank: 2, homeRank: 1, isRivalry: false),
            CardGame(id: secondGameID, sortOrder: 1, awayTeam: "Iowa Hawkeyes", homeTeam: "UCLA Bruins", spread: -2.5, favorite: "home", startTime: "2026-11-06T01:00:00Z", awayRank: 8, homeRank: 4, isRivalry: false)
        ]
        var snapshot = FieldhouseAuthenticatedSnapshot(
            membership: membership,
            card: WeekCard(id: UUID(), weekNumber: 1, lockTime: "2026-11-05T00:30:00Z", propQuestion: FieldhousePropKind.teamScores90.question, propOptionA: "YES", propOptionB: "NO", propPoints: 3, cardGames: games),
            pick: PlayerPick(id: UUID(), propChoice: "YES", lockedAt: "2026-11-04T20:00:00Z", totalPoints: nil, isChaos: true, pickGames: [
                PickedGame(cardGameId: firstGameID, side: "away", confidence: 10, isBestBet: true),
                PickedGame(cardGameId: secondGameID, side: "home", confidence: 9, isBestBet: false)
            ]),
            favoriteTeam: FavoriteTeam(sportId: "ncaaw", teamId: "iowa-hawkeyes"),
            crystalBall: CrystalBallPick(teamName: "South Carolina Gamecocks"),
            latestScorecard: RegularSeasonScorecard(
                card: WeekCard(id: UUID(), weekNumber: 0, lockTime: "2026-11-01T00:30:00Z", propQuestion: FieldhousePropKind.teamScores90.question, propOptionA: "YES", propOptionB: "NO", propPoints: 3, cardGames: games),
                pick: SeasonPlayerPick(id: UUID(), weekNumber: 0, propChoice: "YES", lockedAt: "2026-11-01T00:00:00Z", totalPoints: 23, isChaos: false, pickGames: [
                    PickedGame(cardGameId: firstGameID, side: "away", confidence: 10, isBestBet: true),
                    PickedGame(cardGameId: secondGameID, side: "home", confidence: 9, isBestBet: false)
                ]),
                result: CertifiedWeekResult(id: UUID(), weekNumber: 0, propResult: "YES", scoredAt: "2026-11-02T00:00:00Z", gameResults: [
                    CertifiedGameResult(cardGameId: firstGameID, winner: "away", awayScore: 91, homeScore: 88),
                    CertifiedGameResult(cardGameId: secondGameID, winner: "home", awayScore: 70, homeScore: 75)
                ]),
                seasonTotalBefore: 0,
                seasonTotalAfter: 23
            ),
            standings: [
                Standing(id: UUID(), userId: userID, totalPoints: 23, weeklyPoints: [23], weeksPlayed: 1, displayNameOverride: "Riley V.", division: "East", fieldhouseRegion: "Midwest", profiles: nil, atsCorrect: 2, atsTotal: 2, currentStreak: 1, bestWeek: 23, worstWeek: 23, perfectWeeks: 0, bestBetHits: 1, bestBetTotal: 1, propHits: 1, propTotal: 1, isBot: false),
                Standing(id: UUID(), userId: UUID(), totalPoints: 17, weeklyPoints: [17], weeksPlayed: 1, displayNameOverride: "Baseline Bandit", division: "East", fieldhouseRegion: "East", profiles: nil, atsCorrect: 1, atsTotal: 2, currentStreak: 1, bestWeek: 17, worstWeek: 17, perfectWeeks: 0, bestBetHits: 0, bestBetTotal: 1, propHits: 1, propTotal: 1, isBot: false)
            ],
            postseasonTotals: [
                FieldhousePostseasonTotalRecord(
                    tournamentId: UUID(), leagueId: leagueID, userId: userID,
                    bracketCorrectPicks: 27, bracketRawPoints: 39, bracketAdjustedPoints: 39,
                    roundPoints: 8, totalPoints: 47, updatedAt: "2027-03-22T03:00:00Z"
                )
            ]
        )

        let state = FieldhouseStateHydrator.hydrate(
            snapshot: snapshot,
            userID: userID,
            now: Date(timeIntervalSince1970: 0)
        )

        XCTAssertEqual(state.league, .ncaaw)
        XCTAssertTrue(state.isCommissioner)
        XCTAssertEqual(state.championshipTrophyID, "w-extra-pass")
        XCTAssertEqual(state.favoriteTeam, "Iowa Hawkeyes")
        XCTAssertEqual(state.crystalBallChampion, "South Carolina Gamecocks")
        XCTAssertEqual(state.publishedGames.map(\.id), [firstGameID, secondGameID].map { $0.uuidString.lowercased() })
        XCTAssertEqual(state.publishedGames[0].tip, "WED NOV 4 · 7:30 PM EST")
        XCTAssertEqual(state.publishedGames[0].displayTip(in: 1), "WED NOV 4 · 7:30 PM EST")
        XCTAssertEqual(state.publishedGames[0].favoriteTeam, "South Carolina Gamecocks")
        XCTAssertEqual(state.publishedGames[0].favoriteSpread, -4.5)
        XCTAssertEqual(state.sideSelections, [0: "UConn Huskies", 1: "UCLA Bruins"])
        XCTAssertEqual(state.confidenceSelections, [0: 10, 1: 9])
        XCTAssertEqual(state.bestBetGame, 0)
        XCTAssertEqual(state.propAnswer, "YES")
        XCTAssertTrue(state.picksLocked)
        XCTAssertTrue(state.hellfireDeployedOnCurrentCard)
        XCTAssertEqual(state.scoringWindow, 0)
        XCTAssertEqual(state.scoringGames.count, 2)
        XCTAssertEqual(state.scoringResults[firstGameID.uuidString.lowercased()]?.awayScore, 91)
        XCTAssertEqual(state.scoringSelections, [0: "UConn Huskies", 1: "UCLA Bruins"])
        XCTAssertEqual(state.lastCertifiedWindow, 0)
        XCTAssertEqual(state.lastCertifiedPoints, 23)
        XCTAssertEqual(state.playerCount, 2)
        XCTAssertEqual(state.regionPlayerCount, 1)
        XCTAssertEqual(state.rank, 1)
        XCTAssertEqual(state.postseasonBracketCorrectPicks, 27)
        XCTAssertEqual(state.postseasonBracketRawPoints, 39)
        XCTAssertEqual(state.postseasonBracketAdjustedPoints, 39)
        XCTAssertEqual(state.postseasonFreshRoundPoints, 8)
        XCTAssertEqual(state.postseasonTotalPoints, 47)
        XCTAssertEqual(state.postseasonPoints(for: userID), 47)

        snapshot.postseasonTotals = []
        snapshot.roundEntries = [
            FieldhouseRoundEntryRecord(
                roundKey: "r64",
                picks: ["r64-1": "uconn"],
                submittedAt: "2027-03-18T15:00:00Z",
                lockedAt: "2027-03-18T16:00:00Z",
                points: 8
            )
        ]
        let awaitingAuthority = FieldhouseStateHydrator.hydrate(
            snapshot: snapshot,
            userID: userID,
            now: Date(timeIntervalSince1970: 0)
        )
        XCTAssertEqual(awaitingAuthority.postseasonFreshRoundPoints, 0)
        XCTAssertEqual(awaitingAuthority.postseasonTotalPoints, 0)
        XCTAssertEqual(awaitingAuthority.postseasonPoints(for: userID), 0)
        XCTAssertEqual(awaitingAuthority.postseasonScoreFreshnessLabel, "WAITING FOR FIRST OFFICIAL RESULT")
    }

    func testFreshRoundUsesOfficialWinnersToOpenNextRound() {
        let first = FieldhouseOfficialTeam(teamID: "a", displayName: "Alpha", region: "East", seed: 1)
        let second = FieldhouseOfficialTeam(teamID: "b", displayName: "Bravo", region: "East", seed: 16)
        let third = FieldhouseOfficialTeam(teamID: "c", displayName: "Charlie", region: "East", seed: 8)
        let fourth = FieldhouseOfficialTeam(teamID: "d", displayName: "Delta", region: "East", seed: 9)
        let games = [
            FieldhouseOfficialGame(gameID: "r64-1", roundKey: "r64", roundOrder: 1, ordinal: 0, region: "East", firstTeamID: "a", secondTeamID: "b", firstSourceGameID: nil, secondSourceGameID: nil, startsAt: "2027-03-18T16:00:00Z", winnerTeamID: "a"),
            FieldhouseOfficialGame(gameID: "r64-2", roundKey: "r64", roundOrder: 1, ordinal: 1, region: "East", firstTeamID: "c", secondTeamID: "d", firstSourceGameID: nil, secondSourceGameID: nil, startsAt: "2027-03-18T18:00:00Z", winnerTeamID: "d"),
            FieldhouseOfficialGame(gameID: "r32-1", roundKey: "r32", roundOrder: 2, ordinal: 0, region: "East", firstTeamID: nil, secondTeamID: nil, firstSourceGameID: "r64-1", secondSourceGameID: "r64-2", startsAt: "2027-03-20T16:00:00Z", winnerTeamID: nil)
        ]
        let field = FieldhouseOfficialField(tournamentID: UUID(), sportID: "ncaam", seasonKey: 2027, status: "in_progress", firstTipAt: "2027-03-18T16:00:00Z", teams: [first, second, third, fourth], games: games)
        let matchups = FieldhouseBracketEngine.roundMatchups(key: "r32", field: field)
        XCTAssertEqual(matchups.first?.teams.map(\.id), ["a", "d"])
        XCTAssertEqual(FieldhouseBracketEngine.liveRoundKey(field: field, now: ISO8601DateFormatter().date(from: "2027-03-19T00:00:00Z")!), "r32")
    }

    func testFreshRoundCannotAdvanceUntilEveryPriorRoundWinnerIsOfficial() {
        let teams = [
            FieldhouseOfficialTeam(teamID: "a", displayName: "Alpha", region: "East", seed: 1),
            FieldhouseOfficialTeam(teamID: "b", displayName: "Bravo", region: "East", seed: 16),
            FieldhouseOfficialTeam(teamID: "c", displayName: "Charlie", region: "East", seed: 8),
            FieldhouseOfficialTeam(teamID: "d", displayName: "Delta", region: "East", seed: 9)
        ]
        let games = [
            FieldhouseOfficialGame(gameID: "r64-1", roundKey: "r64", roundOrder: 1, ordinal: 0, region: "East", firstTeamID: "a", secondTeamID: "b", firstSourceGameID: nil, secondSourceGameID: nil, startsAt: "2027-03-18T16:00:00Z", winnerTeamID: "a"),
            FieldhouseOfficialGame(gameID: "r64-2", roundKey: "r64", roundOrder: 1, ordinal: 1, region: "East", firstTeamID: "c", secondTeamID: "d", firstSourceGameID: nil, secondSourceGameID: nil, startsAt: "2027-03-18T18:00:00Z", winnerTeamID: nil),
            FieldhouseOfficialGame(gameID: "r32-1", roundKey: "r32", roundOrder: 2, ordinal: 0, region: "East", firstTeamID: nil, secondTeamID: nil, firstSourceGameID: "r64-1", secondSourceGameID: "r64-2", startsAt: "2027-03-20T16:00:00Z", winnerTeamID: nil)
        ]
        let field = FieldhouseOfficialField(
            tournamentID: UUID(), sportID: "ncaam", seasonKey: 2027,
            status: "in_progress", firstTipAt: "2027-03-18T16:00:00Z",
            teams: teams, games: games
        )

        let afterFirstRoundTips = ISO8601DateFormatter().date(from: "2027-03-19T00:00:00Z")!
        XCTAssertEqual(FieldhouseBracketEngine.liveRoundKey(field: field, now: afterFirstRoundTips), "r64")
        XCTAssertTrue(FieldhouseBracketEngine.roundMatchups(key: "r32", field: field).first?.teams.map(\.id) == ["a"])
    }

    func testTournamentScorecardActivatesOnlyAfterAPlayerFilesPostseasonPicks() {
        var state = FieldhouseSeasonState()
        state.officialPostseasonField = .previewRound(for: .ncaam)
        state.postseasonTotalPoints = 47

        XCTAssertTrue(state.postseasonIsActive)
        XCTAssertFalse(state.postseasonScorecardIsActive)

        state.bracketSubmitted = true
        XCTAssertTrue(state.postseasonScorecardIsActive)
        let now = ISO8601DateFormatter().date(from: "2027-03-17T16:00:00Z")!
        XCTAssertTrue(state.postseasonLockLabel(at: now).hasPrefix("FIRST ROUND LOCKS IN"))
    }

    func testSelectionSundayCountsBracketAndFreshRoundAsTwoPickTasks() {
        var state = FieldhouseSeasonState()
        state.officialPostseasonField = .previewRound(for: .ncaam)
        let beforeTip = ISO8601DateFormatter().date(from: "2027-03-18T15:59:59Z")!

        XCTAssertEqual(state.outstandingPickTaskCount(at: beforeTip), 2)
        XCTAssertTrue(state.hasOutstandingPickTask(at: beforeTip))

        state.bracketSubmitted = true
        XCTAssertEqual(state.outstandingPickTaskCount(at: beforeTip), 1)

        state.postseasonRoundSubmitted.insert("r64")
        XCTAssertEqual(state.outstandingPickTaskCount(at: beforeTip), 0)
        XCTAssertFalse(state.hasOutstandingPickTask(at: beforeTip))
    }

    func testPostseasonRefreshRecognizesUnsavedBracketEdits() {
        var verified = FieldhouseSeasonState()
        verified.postseasonBracketPicks = ["r64-east-1": "duke"]
        verified.bracketSubmitted = true

        var current = verified
        XCTAssertFalse(FieldhouseStateReconciler.bracketDraftIsDirty(current: current, verified: verified))

        current.postseasonBracketPicks["r64-east-1"] = "vermont"
        XCTAssertTrue(FieldhouseStateReconciler.bracketDraftIsDirty(current: current, verified: verified))
    }

    func testPostseasonRefreshRecognizesUnsavedRoundEdits() {
        var verified = FieldhouseSeasonState()
        verified.postseasonRoundPicks = ["r64": ["r64-east-1": "duke"]]
        verified.postseasonRoundSubmitted = ["r64"]

        var current = verified
        XCTAssertFalse(FieldhouseStateReconciler.roundDraftIsDirty(current: current, verified: verified))

        current.postseasonRoundPicks["r64"]?["r64-east-1"] = "vermont"
        XCTAssertTrue(FieldhouseStateReconciler.roundDraftIsDirty(current: current, verified: verified))
    }

    func testPostseasonTasksAndBracketLockCloseExactlyAtFirstTip() {
        var state = FieldhouseSeasonState()
        state.officialPostseasonField = .previewRound(for: .ncaam)
        let beforeTip = ISO8601DateFormatter().date(from: "2027-03-18T15:59:59Z")!
        let atTip = ISO8601DateFormatter().date(from: "2027-03-18T16:00:00Z")!

        XCTAssertFalse(state.postseasonBracketIsLocked(at: beforeTip))
        XCTAssertTrue(state.postseasonBracketIsLocked(at: atTip))
        XCTAssertEqual(state.outstandingPickTaskCount(at: atTip), 0)

        state.bracketLocked = true
        XCTAssertTrue(state.postseasonBracketIsLocked(at: beforeTip))
    }

    func testFreshRoundBecomesReadOnlyBoardAtFirstTip() {
        var state = FieldhouseSeasonState()
        state.officialPostseasonField = .previewRound(for: .ncaam)
        let beforeTip = ISO8601DateFormatter().date(from: "2027-03-18T15:59:59Z")!
        let atTip = ISO8601DateFormatter().date(from: "2027-03-18T16:00:00Z")!

        XCTAssertFalse(state.postseasonRoundIsLocked("r64", at: beforeTip))
        XCTAssertTrue(state.postseasonRoundIsLocked("r64", at: atTip))

        state.postseasonRoundLocked.insert("r64")
        XCTAssertTrue(state.postseasonRoundIsLocked("r64", at: beforeTip))
    }

    func testFreshRoundWaitsForEveryOfficialTipTime() {
        var state = FieldhouseSeasonState()
        var field = FieldhouseOfficialField.previewRound(for: .ncaam)
        XCTAssertTrue(state.postseasonRoundScheduleIsReady("r64") == false)

        state.officialPostseasonField = field
        XCTAssertTrue(state.postseasonRoundScheduleIsReady("r64"))

        let first = field.games[0]
        let missingTime = FieldhouseOfficialGame(
            gameID: first.gameID,
            roundKey: first.roundKey,
            roundOrder: first.roundOrder,
            ordinal: first.ordinal,
            region: first.region,
            firstTeamID: first.firstTeamID,
            secondTeamID: first.secondTeamID,
            firstSourceGameID: first.firstSourceGameID,
            secondSourceGameID: first.secondSourceGameID,
            startsAt: nil,
            winnerTeamID: first.winnerTeamID,
            firstScore: first.firstScore,
            secondScore: first.secondScore
        )
        field = FieldhouseOfficialField(
            tournamentID: field.tournamentID,
            sportID: field.sportID,
            seasonKey: field.seasonKey,
            status: field.status,
            firstTipAt: field.firstTipAt,
            teams: field.teams,
            games: [missingTime] + Array(field.games.dropFirst())
        )
        state.officialPostseasonField = field
        XCTAssertFalse(state.postseasonRoundScheduleIsReady("r64"))
    }

    func testPostseasonAcceptsSupabaseFractionalSecondTimestamps() {
        let base = FieldhouseOfficialField.previewRound(for: .ncaaw)
        let games = base.games.map { game in
            FieldhouseOfficialGame(
                gameID: game.gameID,
                roundKey: game.roundKey,
                roundOrder: game.roundOrder,
                ordinal: game.ordinal,
                region: game.region,
                firstTeamID: game.firstTeamID,
                secondTeamID: game.secondTeamID,
                firstSourceGameID: game.firstSourceGameID,
                secondSourceGameID: game.secondSourceGameID,
                startsAt: "2027-03-18T16:00:00.123Z",
                winnerTeamID: game.winnerTeamID
            )
        }
        var state = FieldhouseSeasonState()
        state.officialPostseasonField = FieldhouseOfficialField(
            tournamentID: base.tournamentID,
            sportID: base.sportID,
            seasonKey: base.seasonKey,
            status: base.status,
            firstTipAt: "2027-03-18T16:00:00.123Z",
            teams: base.teams,
            games: games
        )
        state.postseasonScoreUpdatedAt = "2027-03-18T18:30:45.456+00:00"
        let beforeTip = ISO8601DateFormatter().date(from: "2027-03-18T15:59:59Z")!
        let afterTip = ISO8601DateFormatter().date(from: "2027-03-18T16:00:01Z")!

        XCTAssertTrue(state.postseasonRoundScheduleIsReady("r64"))
        XCTAssertFalse(state.postseasonBracketIsLocked(at: beforeTip))
        XCTAssertTrue(state.postseasonBracketIsLocked(at: afterTip))
        XCTAssertTrue(state.postseasonRoundIsLocked("r64", at: afterTip))
        XCTAssertEqual(state.activePostseasonRound(at: afterTip), "r64")
        XCTAssertFalse(state.postseasonScoreFreshnessLabel.contains("WAITING"))
    }

    func testCardWritePlanTranslatesTeamFavoriteToSharedHomeAwayContract() throws {
        var state = FieldhouseSeasonState()
        state.isCommissioner = true
        var games = Array(FieldhouseGameCatalog.windowOne.prefix(FieldhouseGameCatalog.weeklyCardSize))
        let first = games[0]
        games[0] = FieldhouseGame(
            id: first.id, away: first.away, home: first.home, spread: first.spread,
            tip: first.tip, dayOffset: first.dayOffset, tipHour: first.tipHour,
            tipMinute: first.tipMinute, bookmaker: "DraftKings"
        )
        XCTAssertTrue(state.publishCard(games: games, prop: .teamScores90))

        let plan = try FieldhouseCardWritePlan(state: state)

        XCTAssertEqual(plan.games.count, FieldhouseGameCatalog.weeklyCardSize)
        XCTAssertEqual(plan.prop, .teamScores90)
        for (index, payload) in plan.games.enumerated() {
            let game = games[index]
            XCTAssertEqual(payload["sort_order"] as? Int, index)
            XCTAssertEqual(payload["away_team"] as? String, game.away)
            XCTAssertEqual(payload["home_team"] as? String, game.home)
            XCTAssertEqual(payload["favorite"] as? String, game.favoriteTeam == game.away ? "away" : "home")
            XCTAssertNotNil(payload["start_time"] as? String)
            XCTAssertEqual(payload["bookmaker"] as? String, index == 0 ? "DraftKings" : "Fieldhouse")
        }
    }

    func testPublishedFieldhouseCardRetainsBookmakerProvenance() throws {
        let gameID = UUID()
        let payload = """
        {
          "id": "\(gameID.uuidString)",
          "sort_order": 0,
          "away_team": "UConn Huskies",
          "home_team": "Duke Blue Devils",
          "spread": -3.5,
          "favorite": "home",
          "start_time": "2026-11-05T00:30:00Z",
          "bookmaker": "DraftKings",
          "away_rank": 2,
          "home_rank": 1,
          "is_rivalry": false
        }
        """

        let decoded = try JSONDecoder().decode(CardGame.self, from: Data(payload.utf8))

        XCTAssertEqual(decoded.bookmaker, "DraftKings")
        XCTAssertEqual(FieldhouseGame(cardGame: decoded, window: 1).bookmaker, "DraftKings")
    }

    func testAuthenticatedSnapshotHydratesChampionshipWeekAsFourStraightUpGames() {
        let userID = UUID()
        let membership = LeagueMembership(
            leagueId: UUID(), role: "commissioner", isModerator: false, isDeputy: false,
            totalPoints: 0, weeklyPoints: [], weeksPlayed: 18, division: "East",
            fieldhouseRegion: "East", joinedAt: nil,
            atsCorrect: 0, atsTotal: 0, currentStreak: 0, bestWeek: 0, worstWeek: 0,
            perfectWeeks: 0, bestBetHits: 0, bestBetTotal: 0, propHits: 0, propTotal: 0,
            leagues: LeagueSummary(
                name: "Men's Fieldhouse", code: "MEN1", sportId: "ncaam",
                currentWeek: 19, commissionerId: userID, crystalBallEnabled: true,
                championshipTrophyId: nil, mode: nil, regularSeasonWeeks: 18,
                maxHumanMembers: 100,
                sportSettings: LeagueSportSettings(fieldhouseLeague: "ncaam")
            )
        )
        let cardGames = FieldhouseChampionshipConference.allCases.enumerated().map { index, conference in
            CardGame(
                id: UUID(), sortOrder: index, awayTeam: "Away \(index)", homeTeam: "Home \(index)",
                spread: 0, favorite: "home", startTime: "2027-03-13T\(18 + index):00:00Z",
                awayRank: nil, homeRank: nil, isRivalry: false,
                fieldhouseConference: conference.rawValue
            )
        }
        let snapshot = FieldhouseAuthenticatedSnapshot(
            membership: membership,
            card: WeekCard(
                id: UUID(), weekNumber: 19,
                cardKind: FieldhouseCardKind.conferenceChampionship.rawValue,
                lockTime: "2027-03-13T18:00:00Z",
                propQuestion: nil, propOptionA: nil, propOptionB: nil, propPoints: 0,
                cardGames: cardGames
            ),
            pick: nil, favoriteTeam: nil, crystalBall: nil
        )

        let state = FieldhouseStateHydrator.hydrate(
            snapshot: snapshot, userID: userID, now: Date(timeIntervalSince1970: 0)
        )

        XCTAssertEqual(state.phase, .conferenceChampionships)
        XCTAssertEqual(state.cardKind, .conferenceChampionship)
        XCTAssertEqual(state.publishedGames.count, 4)
        XCTAssertEqual(
            state.publishedGames.compactMap(\.championshipConference),
            FieldhouseChampionshipConference.allCases
        )
        XCTAssertNil(state.publishedProp)
        XCTAssertFalse(state.cardKind.requiresProp)
        XCTAssertFalse(state.cardKind.allowsHellfire)
        XCTAssertTrue(state.sideSelections.isEmpty)
        XCTAssertTrue(state.confidenceSelections.isEmpty)
    }

    func testAuthenticatedSnapshotWithoutACardClearsOnlyLeagueCardState() {
        let userID = UUID()
        var cached = FieldhouseSeasonState()
        cached.favoriteTeam = "Duke Blue Devils"
        cached.cardIsPublished = true
        cached.publishedGames = Array(FieldhouseGameCatalog.windowOne.prefix(10))
        cached.sideSelections = [0: "Duke Blue Devils"]
        let membership = LeagueMembership(
            leagueId: UUID(), role: "member", isModerator: false, isDeputy: false,
            totalPoints: 0, weeklyPoints: [], weeksPlayed: 0, division: "West", joinedAt: nil,
            atsCorrect: 0, atsTotal: 0, currentStreak: 0, bestWeek: 0, worstWeek: 0,
            perfectWeeks: 0, bestBetHits: 0, bestBetTotal: 0, propHits: 0, propTotal: 0,
            leagues: LeagueSummary(name: "Men's Fieldhouse", code: "MEN1", sportId: "ncaam", currentWeek: 1, commissionerId: UUID(), crystalBallEnabled: true, championshipTrophyId: nil, mode: nil, regularSeasonWeeks: 18, maxHumanMembers: 100, sportSettings: LeagueSportSettings(fieldhouseLeague: "ncaam"))
        )
        let snapshot = FieldhouseAuthenticatedSnapshot(membership: membership, card: nil, pick: nil, favoriteTeam: FavoriteTeam(sportId: "ncaam", teamId: "purdue-boilermakers"), crystalBall: nil)

        let state = FieldhouseStateHydrator.hydrate(snapshot: snapshot, userID: userID, cached: cached, now: Date(timeIntervalSince1970: 0))

        XCTAssertEqual(state.favoriteTeam, "Purdue Boilermakers")
        XCTAssertFalse(state.cardIsPublished)
        XCTAssertTrue(state.publishedGames.isEmpty)
        XCTAssertTrue(state.sideSelections.isEmpty)
        XCTAssertFalse(state.picksLocked)
        XCTAssertTrue(state.scoringGames.isEmpty)
        XCTAssertTrue(state.scoringResults.isEmpty)
        XCTAssertTrue(state.scoringSelections.isEmpty)
        XCTAssertNil(state.lastCertifiedWindow)
        XCTAssertNil(state.lastCertifiedPoints)
    }

    func testAuthenticatedMemberWhoMissedPicksStillGetsTheRealLiveBoard() {
        let userID = UUID()
        let gameID = UUID()
        let membership = LeagueMembership(
            leagueId: UUID(), role: "member", isModerator: false, isDeputy: false,
            totalPoints: 0, weeklyPoints: [], weeksPlayed: 0, division: "West", joinedAt: nil,
            atsCorrect: 0, atsTotal: 0, currentStreak: 0, bestWeek: 0, worstWeek: 0,
            perfectWeeks: 0, bestBetHits: 0, bestBetTotal: 0, propHits: 0, propTotal: 0,
            leagues: LeagueSummary(name: "Men's Fieldhouse", code: "MEN1", sportId: "ncaam", currentWeek: 2, commissionerId: UUID(), crystalBallEnabled: true, championshipTrophyId: nil, mode: nil, regularSeasonWeeks: 18, maxHumanMembers: 100, sportSettings: LeagueSportSettings(fieldhouseLeague: "ncaam"))
        )
        let scoringCard = WeekCard(
            id: UUID(), weekNumber: 1, lockTime: "2026-11-05T00:30:00Z",
            propQuestion: FieldhousePropKind.teamScores90.question,
            propOptionA: "YES", propOptionB: "NO", propPoints: 3,
            cardGames: [
                CardGame(id: gameID, sortOrder: 0, awayTeam: "UConn Huskies", homeTeam: "Duke Blue Devils", spread: -3.5, favorite: "home", startTime: "2026-11-05T00:30:00Z", awayRank: 2, homeRank: 1, isRivalry: false)
            ]
        )
        let snapshot = FieldhouseAuthenticatedSnapshot(
            membership: membership, card: nil, pick: nil, favoriteTeam: nil,
            crystalBall: nil, scoringCard: scoringCard, scoringPick: nil
        )

        let state = FieldhouseStateHydrator.hydrate(
            snapshot: snapshot, userID: userID, now: Date(timeIntervalSince1970: 0)
        )

        XCTAssertEqual(state.scoringWindow, 1)
        XCTAssertEqual(state.scoringGames.map(\.id), [gameID.uuidString.lowercased()])
        XCTAssertTrue(state.scoringSelections.isEmpty)
        XCTAssertTrue(state.scoringConfidences.isEmpty)
        XCTAssertEqual(state.scoringPoints, 0)
    }

    func testAuthenticatedPickWritePlanUsesAllTenStableGameIDsAndHellfireReceipt() throws {
        var state = FieldhouseSeasonState()
        state.publishedGames = (0..<10).map { index in
            FieldhouseGame(
                id: UUID().uuidString.lowercased(),
                away: "Away \(index)",
                home: "Home \(index)",
                spread: "Home \(index) -2.5",
                tip: "SAT 7:00 PM EST"
            )
        }
        state.cardIsPublished = true
        state.publishedProp = .teamScores90
        state.sideSelections = Dictionary(uniqueKeysWithValues: state.publishedGames.enumerated().map { ($0.offset, $0.element.home) })
        state.confidenceSelections = Dictionary(uniqueKeysWithValues: (0..<10).map { ($0, $0 + 1) })
        state.bestBetGame = 4
        state.propAnswer = "NO"
        state.hellfireDeployedOnCurrentCard = true

        let plan = try FieldhousePickWritePlan(state: state)

        XCTAssertEqual(plan.picks.count, 10)
        XCTAssertEqual(plan.bestBetGameID.uuidString.lowercased(), state.publishedGames[4].id)
        XCTAssertEqual(plan.propChoice, "NO")
        XCTAssertTrue(plan.usedHellfire)
        XCTAssertEqual(plan.picks.map(\.confidence), Array(1...10))
        XCTAssertEqual(plan.picks.map(\.side), Array(repeating: "home", count: 10))
    }

    func testAuthenticatedPickWritePlanRejectsPreviewOnlyGameIDs() {
        var state = FieldhouseSeasonState()
        XCTAssertTrue(state.publishCard(games: Array(FieldhouseGameCatalog.windowOne.prefix(10)), prop: .teamScores90))
        state.sideSelections = Dictionary(uniqueKeysWithValues: state.publishedGames.enumerated().map { ($0.offset, $0.element.home) })
        state.confidenceSelections = Dictionary(uniqueKeysWithValues: (0..<10).map { ($0, $0 + 1) })
        state.bestBetGame = 0
        state.propAnswer = "YES"

        XCTAssertThrowsError(try FieldhousePickWritePlan(state: state))
    }

    func testFieldhouseStateRoundTripsWithoutCrossingAccountOrLeagueBoundaries() throws {
        let suiteName = "FieldhouseStateStoreTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = FieldhouseStateStore(defaults: defaults)
        let userA = UUID()
        let userB = UUID()
        let leagueA = UUID()
        let leagueB = UUID()
        let scope = FieldhouseStateScope(userID: userA, leagueID: leagueA)

        var state = FieldhouseSeasonState()
        state.favoriteTeam = "Duke Blue Devils"
        state.crystalBallChampion = "UConn Huskies"
        state.sideSelections[0] = "Gonzaga Bulldogs"
        state.confidenceSelections[0] = 10
        store.save(state, scope: scope)

        XCTAssertEqual(store.load(scope: scope), state)
        XCTAssertNil(store.load(scope: FieldhouseStateScope(userID: userB, leagueID: leagueA)))
        XCTAssertNil(store.load(scope: FieldhouseStateScope(userID: userA, leagueID: leagueB)))

        store.remove(scope: scope)
        XCTAssertNil(store.load(scope: scope))
    }

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

    func testOnlyCommissionersCanBuildAnUnpublishedPlayerCard() {
        var state = FieldhouseSeasonState()
        state.isCommissioner = false
        XCTAssertFalse(state.cardIsPublished)
        XCTAssertFalse(state.canBuildCard)
        state.isCommissioner = true
        XCTAssertTrue(state.canBuildCard)
        XCTAssertTrue(state.publishCard(games: Array(FieldhouseGameCatalog.windowOne.prefix(10)), prop: .teamScores90))
        XCTAssertFalse(state.canBuildCard)
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
        XCTAssertEqual(state.outstandingPickTaskCount(at: beforeTip), 1)
        XCTAssertTrue(state.hasOutstandingPickTask(at: beforeTip))

        for index in games.indices {
            state.sideSelections[index] = games[index].home
            state.confidenceSelections[index] = index + 1
        }
        state.bestBetGame = 0
        state.propAnswer = "YES"
        XCTAssertTrue(state.lockPicks(at: beforeTip))
        XCTAssertEqual(state.outstandingPickTaskCount(at: beforeTip), 0)
        XCTAssertFalse(state.hasOutstandingPickTask(at: beforeTip))
        XCTAssertTrue(state.playerPicksAreComplete)

        state.picksLocked = false
        XCTAssertFalse(state.playerPicksAreComplete)
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

    func testNCAAWUsesVerifiedDivisionOneNamesWithoutMensOnlyPrograms() {
        let teams = FieldhouseTeamCatalog.teams(for: .ncaaw)
        XCTAssertEqual(teams.count, 362)
        XCTAssertTrue(teams.contains("Tennessee Lady Volunteers"))
        XCTAssertTrue(teams.contains("Oklahoma State Cowgirls"))
        XCTAssertTrue(teams.contains("Penn State Lady Lions"))
        XCTAssertTrue(teams.contains("Lindenwood Lions"))
        XCTAssertFalse(teams.contains("Tennessee Volunteers"))
        XCTAssertFalse(teams.contains("The Citadel Bulldogs"))
        XCTAssertEqual(Set(teams).count, teams.count)
    }

    func testNCAAMAndNCAAWShareRulesButKeepSeparateIdentity() {
        let men = FieldhouseSeasonState()
        var women = FieldhouseSeasonState()
        women.selectLeague(.ncaaw)

        XCTAssertEqual(men.regularHellfiresRemaining, women.regularHellfiresRemaining)
        XCTAssertEqual(men.window, women.window)
        XCTAssertEqual(men.postseasonStatus, women.postseasonStatus)
        XCTAssertNotEqual(men.league, women.league)
        XCTAssertNotEqual(men.championshipTrophyID, women.championshipTrophyID)
        XCTAssertEqual(FieldhouseTrophyCatalog.options(for: men.league).count, 6)
        XCTAssertEqual(FieldhouseTrophyCatalog.options(for: women.league).count, 6)
    }

    func testNCAAWUsesItsOwnBoardWithoutForkingGameplayRules() {
        let men = FieldhouseGameCatalog.games(for: .ncaam)
        let women = FieldhouseGameCatalog.games(for: .ncaaw)

        XCTAssertEqual(men.count, women.count)
        XCTAssertEqual(women.count, 12)
        XCTAssertTrue(women.contains { $0.away == "Oklahoma State Cowgirls" })
        XCTAssertTrue(women.contains { $0.home == "Tennessee Lady Volunteers" })
        XCTAssertFalse(women.contains { $0.home == "Tennessee Volunteers" })
        XCTAssertTrue(Set(men.map(\.id)).isDisjoint(with: Set(women.map(\.id))))

        var state = FieldhouseSeasonState()
        state.selectLeague(.ncaaw)
        XCTAssertEqual(state.scoringGames, Array(women.prefix(FieldhouseGameCatalog.weeklyCardSize)))
        XCTAssertEqual(state.scoringGames.count, FieldhouseGameCatalog.weeklyCardSize)
    }

    func testMensAndWomensPreviewNotificationsUseDifferentLeagueIdentities() {
        XCTAssertNotEqual(
            FieldhousePreviewIdentity.leagueID(for: .ncaam),
            FieldhousePreviewIdentity.leagueID(for: .ncaaw)
        )
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

    func testRegionalCutsRecalculateForDifferentLeagueSizes() {
        let elevenPlayerRegion = WarRoomPostseasonRule.regionalCounts(playerCount: 11)
        XCTAssertEqual(elevenPlayerRegion.championship, 4)
        XCTAssertEqual(elevenPlayerRegion.activeNoBrass, 3)
        XCTAssertEqual(elevenPlayerRegion.toilet, 4)

        let sixPlayerRegion = WarRoomPostseasonRule.regionalCounts(playerCount: 6)
        XCTAssertEqual(sixPlayerRegion.championship, 3)
        XCTAssertEqual(sixPlayerRegion.activeNoBrass, 0)
        XCTAssertEqual(sixPlayerRegion.toilet, 3)
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

    func testFieldhouseRejectsWholeNumberSpreadsSoAWeeklyGameCannotPush() {
        XCTAssertTrue(FieldhouseSpreadRule.isHalfPoint(-7.5))
        XCTAssertFalse(FieldhouseSpreadRule.isHalfPoint(-7.0))

        var games = Array(FieldhouseGameCatalog.windowOne.prefix(FieldhouseGameCatalog.weeklyCardSize))
        let original = games[0]
        games[0] = FieldhouseGame(
            id: original.id,
            away: original.away,
            home: original.home,
            spread: "\(original.home) -7.0",
            tip: original.tip,
            dayOffset: original.dayOffset,
            tipHour: original.tipHour,
            tipMinute: original.tipMinute
        )
        var state = FieldhouseSeasonState()
        XCTAssertFalse(state.publishCard(games: games, prop: .teamScores90))
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
        XCTAssertEqual(FieldhousePropKind.allCases.count, 10)
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
        XCTAssertTrue(state.hellfireDeployedOnCurrentCard)
        XCTAssertTrue(state.picksLocked)
        let originalConfidences = state.confidenceSelections
        state.toggleConfidence(10, for: 1)
        XCTAssertEqual(state.confidenceSelections, originalConfidences)
        XCTAssertFalse(state.reopenPicks(at: state.pickLockDate.addingTimeInterval(-1)))

        var lateState = FieldhouseSeasonState()
        XCTAssertTrue(lateState.publishCard(games: games, prop: .teamScores90))
        XCTAssertFalse(lateState.deployRegularSeasonHellfire(at: lateState.pickLockDate))
        XCTAssertTrue(lateState.sideSelections.isEmpty)
        XCTAssertEqual(lateState.regularHellfiresRemaining, 2)
    }

    func testPublishingANewCardClearsThePriorCardHellfireRestriction() {
        let games = Array(FieldhouseGameCatalog.windowOne.prefix(FieldhouseGameCatalog.weeklyCardSize))
        var state = FieldhouseSeasonState()
        state.hellfireDeployedOnCurrentCard = true
        XCTAssertTrue(state.publishCard(games: games, prop: .teamScores90))
        XCTAssertFalse(state.hellfireDeployedOnCurrentCard)
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
        XCTAssertTrue(FieldhousePropKind.allCases.allSatisfy {
            FieldhousePropEvaluator.answer(for: $0, games: games, results: results) != nil
        })
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

    func testRegularSeasonHellfireDoublesCorrectGamePointsWithoutPenalizingMisses() {
        let games = Array(FieldhouseGameCatalog.windowOne.prefix(2))
        let results = [
            games[0].id: FieldhouseGameResult(gameID: games[0].id, awayScore: 78, homeScore: 76, phase: .final),
            games[1].id: FieldhouseGameResult(gameID: games[1].id, awayScore: 71, homeScore: 74, phase: .final)
        ]
        let points = FieldhouseScoreEngine.points(
            games: games,
            results: results,
            selections: [0: games[0].away, 1: games[1].away],
            confidences: [0: 10, 1: 9],
            bestBetGame: 0,
            prop: nil,
            propAnswer: nil,
            gameMultiplier: 2
        )
        XCTAssertEqual(points, 40)
    }

    func testLiveStandingsProjectionUsesRevealedPicksAndFieldhouseHellfireWithoutChangingCertifiedTotal() {
        let userID = UUID()
        let gameID = UUID()
        let game = FieldhouseGame(
            id: gameID.uuidString.lowercased(),
            away: "Team A",
            home: "Team B",
            spread: "Team B -3.5",
            tip: "MON · 7:00 PM"
        )
        let standing = Standing(
            id: UUID(), userId: userID, totalPoints: 40, weeklyPoints: [40], weeksPlayed: 1,
            displayNameOverride: "Riley V.", division: "East", fieldhouseRegion: "East", profiles: nil,
            atsCorrect: 1, atsTotal: 1, currentStreak: 1, bestWeek: 40, worstWeek: 40,
            perfectWeeks: 0, bestBetHits: 1, bestBetTotal: 1, propHits: 0, propTotal: 0, isBot: false
        )
        let liveSlip = FieldhouseLiveBoardPick(
            id: UUID(), userId: userID, totalPoints: nil, propChoice: nil, isHellfire: true,
            pickGames: [PickedGame(cardGameId: gameID, side: "home", confidence: 5, isBestBet: true)]
        )
        let liveResult = FieldhouseGameResult(
            gameID: game.id, awayScore: 60, homeScore: 75, phase: .live(period: "2H")
        )

        let projected = FieldhouseLiveStandingsEngine.projectedTotals(
            standings: [standing], board: [liveSlip], games: [game], results: [game.id: liveResult], prop: nil
        )
        XCTAssertEqual(projected[userID], 60)
        XCTAssertEqual(standing.totalPoints, 40)

        let certifiedSlip = FieldhouseLiveBoardPick(
            id: liveSlip.id, userId: userID, totalPoints: 20, propChoice: nil, isHellfire: true,
            pickGames: liveSlip.pickGames
        )
        let certified = FieldhouseLiveStandingsEngine.projectedTotals(
            standings: [standing], board: [certifiedSlip], games: [game], results: [game.id: liveResult], prop: nil
        )
        XCTAssertEqual(certified[userID], 40)
    }

    func testLiveRoomPickCountsComeOnlyFromDeclassifiedServerPicks() {
        let firstGameID = UUID()
        let secondGameID = UUID()
        let games = [
            FieldhouseGame(id: firstGameID.uuidString.lowercased(), away: "Alpha", home: "Bravo", spread: "Bravo -3.5", tip: "MON · 7:00 PM"),
            FieldhouseGame(id: secondGameID.uuidString.lowercased(), away: "Charlie", home: "Delta", spread: "Charlie -1.5", tip: "TUE · 8:00 PM")
        ]
        let board = [
            FieldhouseLiveBoardPick(
                id: UUID(), userId: UUID(), totalPoints: nil, propChoice: nil, isHellfire: false,
                pickGames: [PickedGame(cardGameId: firstGameID, side: "away", confidence: 1, isBestBet: false)]
            ),
            FieldhouseLiveBoardPick(
                id: UUID(), userId: UUID(), totalPoints: nil, propChoice: nil, isHellfire: false,
                pickGames: [PickedGame(cardGameId: firstGameID, side: "home", confidence: 2, isBestBet: false)]
            )
        ]

        let counts = FieldhouseRoomPickEngine.counts(board: board, games: games)

        XCTAssertEqual(counts[games[0].id], FieldhouseRoomPickCount(away: 1, home: 1))
        XCTAssertEqual(counts[games[1].id], FieldhouseRoomPickCount())
    }

    func testPostseasonHellfireUsesSixtyPercentRiskRewardRule() {
        XCTAssertEqual(
            FieldhousePostseasonScoreEngine.adjustedPoints(
                rawPoints: 80, correctPicks: 45, totalPicks: 75, usedHellfire: true
            ),
            120
        )
        XCTAssertEqual(
            FieldhousePostseasonScoreEngine.adjustedPoints(
                rawPoints: 80, correctPicks: 44, totalPicks: 75, usedHellfire: true
            ),
            40
        )
        XCTAssertEqual(
            FieldhousePostseasonScoreEngine.adjustedPoints(
                rawPoints: 80, correctPicks: 44, totalPicks: 75, usedHellfire: false
            ),
            80
        )
    }

    func testTournamentScorecardKeepsBracketAndFreshPointsSeparatedByRound() {
        var state = FieldhouseSeasonState()
        let preview = FieldhouseOfficialField.previewRound(for: .ncaam)
        let games = preview.games.enumerated().map { index, game in
            FieldhouseOfficialGame(
                gameID: game.gameID, roundKey: game.roundKey, roundOrder: game.roundOrder,
                ordinal: game.ordinal, region: game.region, firstTeamID: game.firstTeamID,
                secondTeamID: game.secondTeamID, firstSourceGameID: game.firstSourceGameID,
                secondSourceGameID: game.secondSourceGameID, startsAt: game.startsAt,
                winnerTeamID: index == 0 ? game.firstTeamID : nil,
                firstScore: index == 0 ? 88 : nil,
                secondScore: index == 0 ? 72 : nil
            )
        }
        let field = FieldhouseOfficialField(
            tournamentID: preview.tournamentID, sportID: preview.sportID, seasonKey: preview.seasonKey,
            status: preview.status, firstTipAt: preview.firstTipAt, teams: preview.teams, games: games
        )
        state.officialPostseasonField = field
        guard let game = field.games.first(where: { $0.roundKey == "r64" }),
              let winner = game.winnerTeamID else {
            return XCTFail("Preview field must include a final first-round game")
        }
        state.postseasonBracketPicks[game.gameID] = winner
        state.postseasonRoundPicks["r64"] = [game.gameID: winner]
        state.postseasonRoundSubmitted.insert("r64")

        let receipt = state.postseasonRoundReceipt(for: "r64")
        XCTAssertEqual(receipt?.bracketHits, 1)
        XCTAssertEqual(receipt?.bracketPoints, 1)
        XCTAssertEqual(receipt?.freshHits, 1)
        XCTAssertEqual(receipt?.freshCardFiled, true)
        XCTAssertEqual(receipt?.games.first?.firstScore, 88)
        XCTAssertEqual(receipt?.games.first?.secondScore, 72)
        XCTAssertEqual(receipt?.games.first?.bracketPickName, receipt?.games.first?.firstTeam.name)
        XCTAssertEqual(receipt?.games.first?.bracketPoints, 1)
        XCTAssertEqual(receipt?.games.first?.freshPoints, 1)
        XCTAssertEqual(FieldhousePostseasonScoreEngine.bracketWeight(for: "title"), 32)
    }

    func testTournamentScorecardIdentifiesServerFreshnessWithoutInventingAnUpdate() {
        var state = FieldhouseSeasonState()
        XCTAssertEqual(state.postseasonScoreFreshnessLabel, "WAITING FOR FIRST OFFICIAL RESULT")

        state.postseasonScoreUpdatedAt = "2026-04-07T03:15:00Z"
        XCTAssertTrue(state.postseasonScoreFreshnessLabel.hasPrefix("SERVER UPDATED "))
        XCTAssertFalse(state.postseasonScoreFreshnessLabel.contains("WAITING"))
    }

    func testExpandedTournamentContainsSeventyFiveBracketDecisions() {
        XCTAssertEqual(FieldhousePostseasonRound.allCases.map(\.gameCount).reduce(0, +), 75)
        XCTAssertEqual(FieldhousePostseasonRound.openingRound.gameCount, 12)
        XCTAssertEqual(FieldhousePostseasonRound.roundOf64.gameCount, 32)
        XCTAssertEqual(FieldhousePostseasonRound.championship.gameCount, 1)
    }

    func testBracketAndRoundPicksBothBuildThePostseasonTrophyScore() {
        let score = FieldhousePostseasonScore(bracketPredictionPoints: 42, roundPickPoints: 31)
        XCTAssertEqual(score.trophyPoints, 73)
    }

    func testRegionalRaceOnlyEliminatesAPlayerWhenAComebackIsImpossible() {
        XCTAssertTrue(FieldhouseRegionalRaceRule.isMathematicallyAlive(score: 74, leaderScore: 94, remainingAvailablePoints: 20))
        XCTAssertFalse(FieldhouseRegionalRaceRule.isMathematicallyAlive(score: 73, leaderScore: 94, remainingAvailablePoints: 20))
    }

    func testBuyInOrdersPlayersInsideTheirRegionAndUsesRegularSeasonRankAsTiebreaker() {
        struct Entry { let name: String; let buyIn: Int; let regularRank: Int }
        let entries = [
            Entry(name: "A", buyIn: 8, regularRank: 3),
            Entry(name: "B", buyIn: 10, regularRank: 4),
            Entry(name: "C", buyIn: 8, regularRank: 1)
        ]
        let ordered = FieldhouseRegionalRaceRule.orderedSeeds(
            entries,
            buyInPoints: { $0.buyIn },
            regularSeasonRank: { $0.regularRank }
        )
        XCTAssertEqual(ordered.map(\.name), ["B", "C", "A"])
    }

    func testEveryPostseasonRegionHasDistinctHardware() {
        XCTAssertEqual(Set(FieldhouseRegion.allCases.map(\.regionalTrophyAsset)).count, 4)
        XCTAssertEqual(Set(FieldhouseRegion.allCases.map(\.regionalTrophyName)).count, 4)
    }

    func testBracketDecisionMapContainsAllSeventyFiveGames() {
        XCTAssertEqual(FieldhouseBracketEngine.allDecisionIDs.count, 75)
        XCTAssertEqual(Set(FieldhouseBracketEngine.allDecisionIDs).count, 75)
        XCTAssertEqual(FieldhouseBracketEngine.openingGames().count, 12)
    }

    func testHellfireProducesACompleteImmutableBracketPayload() {
        let picks = FieldhouseBracketEngine.hellfirePicks(league: .ncaam)
        XCTAssertEqual(FieldhouseBracketEngine.progress(picks: picks, league: .ncaam), 75)
        XCTAssertNotNil(FieldhouseBracketEngine.nationalChampion(picks: picks))
        for region in FieldhouseRegion.allCases {
            XCTAssertNotNil(FieldhouseBracketEngine.regionalChampion(region, picks: picks, league: .ncaam))
        }
    }

    func testChangingAnEarlyPickClearsInvalidDownstreamPath() {
        var picks = FieldhouseBracketEngine.hellfirePicks(league: .ncaam)
        let opening = FieldhouseBracketEngine.openingGames().first!
        let previous = picks[opening.id]
        let replacement = opening.teams.first(where: { $0.id != previous })!
        FieldhouseBracketEngine.choose(replacement, in: opening, picks: &picks, league: .ncaam)
        XCTAssertEqual(picks[opening.id], replacement.id)
        XCTAssertLessThan(FieldhouseBracketEngine.progress(picks: picks, league: .ncaam), 75)
    }

    func testWomenBracketUsesTheSameSeventyFiveDecisionStructure() {
        let picks = FieldhouseBracketEngine.hellfirePicks(league: .ncaaw)
        XCTAssertEqual(FieldhouseBracketEngine.progress(picks: picks, league: .ncaaw), 75)
        XCTAssertEqual(Set(picks.keys), Set(FieldhouseBracketEngine.allDecisionIDs))
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
        state.hellfireDeployedOnCurrentCard = true

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
        XCTAssertTrue(state.scoringUsedHellfire)
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

    func testChampionshipWeekRequiresExactlyTheFourApprovedConferenceGames() {
        var state = FieldhouseSeasonState()
        state.phase = .conferenceChampionships
        state.window = state.regularSeasonWeeks + 1

        let complete = FieldhouseGameCatalog.championshipGames(for: .ncaam)
        XCTAssertTrue(state.publishChampionshipCard(games: complete))
        XCTAssertEqual(state.cardKind, .conferenceChampionship)
        XCTAssertEqual(state.publishedGames.compactMap(\.championshipConference), [.acc, .big12, .big10, .sec])
        XCTAssertNil(state.publishedProp)

        var missingConference = complete
        missingConference[3] = missingConference[3].assigned(to: .acc)
        var invalidState = FieldhouseSeasonState()
        invalidState.phase = .conferenceChampionships
        XCTAssertFalse(invalidState.publishChampionshipCard(games: missingConference))
        XCTAssertFalse(invalidState.publishChampionshipCard(games: Array(complete.prefix(3))))
    }

    func testChampionshipWeekStartsBlankAndLocksWithFourUniqueConfidencesWithoutProp() throws {
        var state = FieldhouseSeasonState()
        state.phase = .conferenceChampionships
        state.window = state.regularSeasonWeeks + 1
        let games = FieldhouseChampionshipConference.allCases.enumerated().map { index, conference in
            FieldhouseGame(
                id: UUID().uuidString.lowercased(),
                away: "Away \(index)", home: "Home \(index)", spread: "Away \(index) -3.5",
                tip: "SAT · \(index + 1):00 PM", dayOffset: 5, tipHour: 13 + index,
                championshipConference: conference
            )
        }
        XCTAssertTrue(state.publishChampionshipCard(games: games))
        XCTAssertTrue(state.sideSelections.isEmpty)
        XCTAssertTrue(state.confidenceSelections.isEmpty)
        XCTAssertNil(state.bestBetGame)
        XCTAssertNil(state.propAnswer)

        for index in games.indices {
            state.sideSelections[index] = games[index].home
            state.confidenceSelections[index] = index + 1
        }
        state.bestBetGame = 3
        XCTAssertTrue(state.cardIsComplete)

        let plan = try FieldhousePickWritePlan(state: state)
        XCTAssertEqual(plan.picks.count, 4)
        XCTAssertEqual(Set(plan.picks.map(\.confidence)), Set(1...4))
        XCTAssertNil(plan.propChoice)
        XCTAssertFalse(plan.usedHellfire)
        XCTAssertTrue(state.lockPicks(at: state.pickLockDate.addingTimeInterval(-1)))
    }

    func testChampionshipWeekScoresStraightUpAndCapsAtFourteenPoints() {
        let game = FieldhouseGame(
            id: UUID().uuidString.lowercased(),
            away: "Alabama Crimson Tide", home: "Georgia Bulldogs",
            spread: "Georgia Bulldogs -7.5", tip: "SUN · 3:00 PM",
            championshipConference: .sec
        )
        let result = FieldhouseGameResult(
            gameID: game.id, awayScore: 70, homeScore: 71, phase: .final
        )
        XCTAssertEqual(result.coverWinner(in: game), "Alabama Crimson Tide")
        XCTAssertEqual(result.straightUpWinner(in: game), "Georgia Bulldogs")
        XCTAssertEqual(
            FieldhouseScoreEngine.points(
                games: [game], results: [game.id: result], selections: [0: game.home],
                confidences: [0: 4], bestBetGame: 0, prop: nil, propAnswer: nil,
                cardKind: .conferenceChampionship
            ),
            8
        )

        let games = FieldhouseGameCatalog.championshipGames(for: .ncaaw)
        let results = Dictionary(uniqueKeysWithValues: games.map {
            ($0.id, FieldhouseGameResult(gameID: $0.id, awayScore: 71, homeScore: 70, phase: .final))
        })
        XCTAssertEqual(
            FieldhouseScoreEngine.points(
                games: games, results: results,
                selections: Dictionary(uniqueKeysWithValues: games.indices.map { ($0, games[$0].away) }),
                confidences: [0: 1, 1: 2, 2: 3, 3: 4], bestBetGame: 3,
                prop: nil, propAnswer: nil, gameMultiplier: 2,
                cardKind: .conferenceChampionship
            ),
            14
        )
    }

    func testChampionshipWeekRejectsHellfireAndDoesNotOpenAnotherCardAfterPromotion() {
        var state = FieldhouseSeasonState()
        state.phase = .conferenceChampionships
        state.window = state.regularSeasonWeeks + 1
        state.scoringResults = Dictionary(uniqueKeysWithValues: state.scoringGames.map {
            ($0.id, FieldhouseGameResult(gameID: $0.id, awayScore: 80, homeScore: 70, phase: .final))
        })
        let games = FieldhouseGameCatalog.championshipGames(for: .ncaam)
        XCTAssertTrue(state.publishChampionshipCard(games: games))
        XCTAssertFalse(state.deployRegularSeasonHellfire(at: state.pickLockDate.addingTimeInterval(-1)))
        for index in games.indices {
            state.sideSelections[index] = games[index].away
            state.confidenceSelections[index] = index + 1
        }
        state.bestBetGame = 3
        XCTAssertTrue(state.lockPicks(at: state.pickLockDate.addingTimeInterval(-1)))
        XCTAssertTrue(state.advanceToNextWindow(at: state.pickLockDate))
        XCTAssertEqual(state.scoringCardKind, .conferenceChampionship)
        XCTAssertEqual(state.window, state.regularSeasonWeeks + 1)
        XCTAssertFalse(state.canBuildCard)
    }
}
