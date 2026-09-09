//
//  WarRoomTests.swift
//  WarRoomTests
//
//  Created by Michael Vance on 8/14/26.
//

import Testing
import Foundation
import UserNotifications
@testable import WarRoom

struct WarRoomTests {
    @Test func apRankingTreatsOmittedFirstPlaceVotesAsZero() throws {
        let data = Data(#"{"id":"team-id","name":"Rebels","market":"Ole Miss","rank":9,"points":921}"#.utf8)
        let ranking = try JSONDecoder().decode(CfbAPRanking.self, from: data)
        #expect(ranking.firstPlaceVotes == 0)
        #expect(ranking.market == "Ole Miss")
    }

    @Test func newLeaguesDefaultToOneHundredPlayerSeats() {
        #expect(LeagueCreationDefaults.maxMembers == 100)
    }

    @Test func lateCreatedFootballLeaguesOpenOnTheCalendarWeek() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = SeasonCardBuildGate.eastern
        let septemberEight = try #require(calendar.date(from: DateComponents(year: 2026, month: 9, day: 8, hour: 12)))
        let octoberSix = try #require(calendar.date(from: DateComponents(year: 2026, month: 10, day: 6, hour: 12)))
        #expect(LeagueWeekPolicy.currentWeek(sportId: "cfb", at: septemberEight) == 2)
        #expect(LeagueWeekPolicy.currentWeek(sportId: "cfb", at: octoberSix) == 6)
        #expect(LeagueWeekPolicy.currentWeek(sportId: "nfl", at: septemberEight) == 1)
    }

    @Test func cfbWeeklyCardsFlexFromFiveThroughTenWhileNFLStaysFive() {
        #expect(WeeklyCardSizePolicy.size(sportId: "cfb", requested: 4) == 5)
        #expect(WeeklyCardSizePolicy.size(sportId: "cfb", requested: 7) == 7)
        #expect(WeeklyCardSizePolicy.size(sportId: "cfb", requested: 11) == 10)
        #expect(WeeklyCardSizePolicy.size(sportId: "nfl", requested: 10) == 5)
    }


    @Test func seasonOpeningPlaysOncePerSportAndWeekNotOncePerLeagueSwitch() {
        let userID = UUID(uuidString: "10000000-0000-0000-0000-000000000001")!
        let cfbWeekOne = SeasonOpeningPolicy.storageKey(userID: userID, sportID: "CFB", week: 1)
        let sameCFBWeek = SeasonOpeningPolicy.storageKey(userID: userID, sportID: "cfb", week: 1)
        let cfbWeekTwo = SeasonOpeningPolicy.storageKey(userID: userID, sportID: "cfb", week: 2)
        let nflWeekOne = SeasonOpeningPolicy.storageKey(userID: userID, sportID: "nfl", week: 1)

        #expect(cfbWeekOne == sameCFBWeek)
        #expect(cfbWeekOne != cfbWeekTwo)
        #expect(cfbWeekOne != nflWeekOne)
        #expect(!cfbWeekOne.contains("league"))
    }

    @Test func everyCardDeskUnlocksExactlyOneWeekBeforeItsScheduledWindow() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = SeasonCardBuildGate.eastern

        let expected: [(String, Int, DateComponents)] = [
            ("cfb", 0, DateComponents(year: 2026, month: 8, day: 20)),
            ("cfb", 1, DateComponents(year: 2026, month: 8, day: 27)),
            ("cfb", 2, DateComponents(year: 2026, month: 9, day: 1)),
            ("nfl", 1, DateComponents(year: 2026, month: 9, day: 3)),
            ("nfl", 2, DateComponents(year: 2026, month: 9, day: 10)),
            ("ncaam", 1, DateComponents(year: 2026, month: 10, day: 26)),
            ("ncaam", 2, DateComponents(year: 2026, month: 11, day: 2)),
            ("ncaaw", 2, DateComponents(year: 2026, month: 11, day: 2)),
        ]

        for (sport, week, components) in expected {
            let unlock = try #require(SeasonCardBuildGate.unlockDate(sportId: sport, week: week))
            let actual = calendar.dateComponents([.year, .month, .day], from: unlock)
            #expect(actual.year == components.year)
            #expect(actual.month == components.month)
            #expect(actual.day == components.day)
            #expect(!SeasonCardBuildGate.allowsBuild(sportId: sport, week: week, at: unlock.addingTimeInterval(-1)))
            #expect(SeasonCardBuildGate.allowsBuild(sportId: sport, week: week, at: unlock))
            #expect(SeasonCardBuildGate.lockedMessage(sportId: sport, week: week).contains("PAGE OPENS"))
        }
        #expect(!SeasonCardBuildGate.allowsBuild(sportId: "unsupported", week: 1, at: .distantFuture))
        #expect(!SeasonCardBuildGate.allowsBuild(sportId: "cfb", week: 99, at: .distantFuture))
    }

    @Test func patreonStatusNeverTurnsSupportIntoGameplayAuthority() throws {
        let active = try JSONDecoder().decode(PatreonConnectionStatus.self, from: Data("""
        {"connected":true,"membership_status":"active_patron","currently_entitled_amount_cents":500,"founding_supporter_number":2}
        """.utf8))
        let unlinked = try JSONDecoder().decode(PatreonConnectionStatus.self, from: Data("""
        {"connected":false}
        """.utf8))
        #expect(active.badge == "ACTIVE SUPPORTER")
        #expect(active.recognitionTitle == "FOUNDING TEN · #02")
        #expect(unlinked.badge == "NOT CONNECTED")
        #expect(unlinked.recognitionTitle == nil)
    }

    @Test func leagueAttentionKeepsPlayerAndCommissionerWorkSeparate() {
        let playerTasks = LeagueAttentionTaskClassifier.playerTasks(
            sportID: "cfb",
            week: 3,
            card: .present,
            pick: .missing,
            crystalBall: .present,
            favoriteTeam: .present
        )
        let commissionerTasks = LeagueAttentionTaskClassifier.commissionerTasks(
            isCommissioner: true,
            week: 3,
            card: .present,
            hasTrophy: false
        )
        #expect(playerTasks == ["Make Week 3 picks"])
        #expect(commissionerTasks == ["Choose championship hardware"])
    }

    @Test func leagueAttentionNeverInventsTasksWhenStatusCannotLoad() {
        let playerTasks = LeagueAttentionTaskClassifier.playerTasks(
            sportID: "nfl",
            week: 2,
            card: .unavailable,
            pick: .unavailable,
            crystalBall: .unavailable,
            favoriteTeam: .unavailable
        )
        let commissionerTasks = LeagueAttentionTaskClassifier.commissionerTasks(
            isCommissioner: true,
            week: 2,
            card: .unavailable,
            hasTrophy: true
        )
        #expect(playerTasks.isEmpty)
        #expect(commissionerTasks.isEmpty)
    }

    @Test func leagueAttentionUsesSportSpecificChampionLanguage() {
        #expect(LeagueAttentionTaskClassifier.playerTasks(
            sportID: "nfl", week: 1, card: .missing, pick: .missing, crystalBall: .missing, favoriteTeam: .present
        ) == ["Call the Super Bowl champion"])
        #expect(LeagueAttentionTaskClassifier.playerTasks(
            sportID: "ncaaw", week: 1, card: .missing, pick: .missing, crystalBall: .missing, favoriteTeam: .present
        ) == ["Lock Crystal Ball"])
    }

    @Test func leagueInviteRouterAcceptsOnlyWarRoomJoinLinks() throws {
        let token = String(repeating: "a", count: 64)
        let valid = try #require(URL(string: "https://app.war-room-picks.com/invite/\(token)"))
        #expect(LeagueInviteRouter.parse(valid)?.token == token)
        #expect(LeagueInviteRouter.parse(URL(string: "https://app.war-room-picks.com/join?code=h54ksj")!)?.legacyCode == "H54KSJ")
        #expect(LeagueInviteRouter.parse(URL(string: "https://example.com/join?code=H54KSJ")!) == nil)
        #expect(LeagueInviteRouter.parse(URL(string: "https://app.war-room-picks.com/join?code=bad-code!")!) == nil)
        #expect(LeagueInviteRouter.parse(URL(string: "https://app.war-room-picks.com/other?code=H54KSJ")!) == nil)
    }

    @Test func rankedTeamsUseDistinctTopTenAndTopTwentyFiveTiers() {
        #expect(RankedTeamTier(rank: 1) == .topTen)
        #expect(RankedTeamTier(rank: 10) == .topTen)
        #expect(RankedTeamTier(rank: 11) == .ranked)
        #expect(RankedTeamTier(rank: 25) == .ranked)
        #expect(RankedTeamTier(rank: 26) == .unranked)
        #expect(RankedTeamTier(rank: nil) == .unranked)
    }

    @Test func resultNotificationPreservesExactDispatchRoute() throws {
        let leagueId = UUID(uuidString: "76730ee3-d440-4a91-9616-a768ffc03189")!
        let route = try #require(WarRoomNotificationRoute(userInfo: [
            "destination": "results",
            "league_id": leagueId.uuidString.lowercased(),
            "week": 0,
        ]))
        #expect(route.destination == "results")
        #expect(route.leagueId == leagueId)
        #expect(route.week == 0)
        #expect(try JSONDecoder().decode(WarRoomNotificationRoute.self, from: JSONEncoder().encode(route)) == route)
    }

    @Test func selectionSundayNotificationKeepsBothPostseasonTasksVisible() throws {
        let leagueId = UUID(uuidString: "76730ee3-d440-4a91-9616-a768ffc03189")!
        let selectionSunday = try #require(WarRoomNotificationRoute(userInfo: [
            "destination": "picks",
            "league_id": leagueId.uuidString.lowercased(),
            "kind": "fieldhouse_selection_sunday",
        ]))
        let laterRound = try #require(WarRoomNotificationRoute(userInfo: [
            "destination": "picks",
            "league_id": leagueId.uuidString.lowercased(),
            "kind": "fieldhouse_round_open",
        ]))

        #expect(selectionSunday.routesToFieldhousePostseasonOverview)
        #expect(!laterRound.routesToFieldhousePostseasonOverview)
        #expect(try JSONDecoder().decode(WarRoomNotificationRoute.self, from: JSONEncoder().encode(selectionSunday)) == selectionSunday)
    }

    @Test func notificationPreferencePreservesExistingUsersAndExplicitOptOut() throws {
        let suite = "warroom-tests-notifications-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        #expect(WarRoomNotificationCenter.preferenceEnabled(in: defaults))
        defaults.set(false, forKey: WarRoomNotificationCenter.preferenceEnabledKey)
        #expect(!WarRoomNotificationCenter.preferenceEnabled(in: defaults))
        defaults.set(true, forKey: WarRoomNotificationCenter.preferenceEnabledKey)
        #expect(WarRoomNotificationCenter.preferenceEnabled(in: defaults))
    }

    @Test func notificationAuthorizationStatusUsesStableBackendValues() {
        #expect(WarRoomNotificationCenter.authorizationStatusName(.notDetermined) == "not_determined")
        #expect(WarRoomNotificationCenter.authorizationStatusName(.denied) == "denied")
        #expect(WarRoomNotificationCenter.authorizationStatusName(.authorized) == "authorized")
        #expect(WarRoomNotificationCenter.authorizationStatusName(.provisional) == "provisional")
        #expect(WarRoomNotificationCenter.authorizationStatusName(.ephemeral) == "ephemeral")
    }

    @Test func dispatchAlwaysExposesExactlyFourOrderedPages() {
        #expect(DispatchPageCatalog.names == ["FRONT", "SPORTS", "RIVALRIES", "BACK"])
    }

    @Test func newestUnseenDispatchOpensOnlyOncePerMemberAndLeague() throws {
        let userId = UUID(uuidString: "10000000-0000-0000-0000-000000000001")!
        let leagueId = UUID(uuidString: "20000000-0000-0000-0000-000000000001")!
        let suite = "warroom-tests-dispatch-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let data = Data("""
        [{"id":"30000000-0000-0000-0000-000000000002","week_number":1,"week_label":"Week 1","volume_label":"Vol. 1","payload":{},"created_at":"2026-09-07T05:00:00Z"},
         {"id":"30000000-0000-0000-0000-000000000001","week_number":0,"week_label":"Week 0","volume_label":"Vol. 0","payload":{},"created_at":"2026-08-30T05:00:00Z"}]
        """.utf8)
        let editions = try JSONDecoder().decode([GazetteEditionRow].self, from: data)

        let first = try #require(DispatchPresentationPolicy.newestUnread(
            editions: editions,
            userId: userId,
            leagueId: leagueId,
            defaults: defaults
        ))
        #expect(first.weekNumber == 1)
        DispatchPresentationPolicy.markSeen(first, userId: userId, leagueId: leagueId, defaults: defaults)
        #expect(DispatchPresentationPolicy.newestUnread(
            editions: editions,
            userId: userId,
            leagueId: leagueId,
            defaults: defaults
        ) == nil)
    }

    @Test func careerTrophiesCollapseDuplicateHardwareForTheSameSeason() {
        let ben = UUID(uuidString: "fdddf273-2430-42db-9127-b8fa7efc1572")!
        let league = UUID(uuidString: "20000000-0000-0000-0000-000000000001")!
        let first = ProfileTrophy(id: UUID(), leagueId: league, seasonYear: 2025, trophyType: "crystal_ball", winnerName: "Big Balls Ben", winnerUserId: ben, subtitle: "Crystal Ball prophet", notes: nil, awardedAt: "2025-12-31T23:59:59Z", trophyDesignId: nil)
        let duplicate = ProfileTrophy(id: UUID(), leagueId: league, seasonYear: 2025, trophyType: "crystal_ball", winnerName: "Big Balls Ben", winnerUserId: ben, subtitle: "Crystal Ball prophet", notes: nil, awardedAt: "2025-12-31T23:59:59Z", trophyDesignId: nil)

        let trophies = LegacyCareerRecords.trophies(for: ben, merging: [first, duplicate])

        #expect(trophies.filter { $0.seasonYear == 2025 && $0.trophyType == "crystal_ball" }.count == 1)
    }

    @Test func careerTrophiesPreserveHardwareWonInSeparateLiveLeagues() {
        let player = UUID()
        let firstLeague = ProfileTrophy(id: UUID(), leagueId: UUID(), seasonYear: 2027, trophyType: "championship", winnerName: "Player", winnerUserId: player, subtitle: nil, notes: nil, awardedAt: "2027-04-06T23:00:00Z", trophyDesignId: "m-fieldhouse-cup")
        let secondLeague = ProfileTrophy(id: UUID(), leagueId: UUID(), seasonYear: 2027, trophyType: "championship", winnerName: "Player", winnerUserId: player, subtitle: nil, notes: nil, awardedAt: "2027-04-06T23:00:00Z", trophyDesignId: "m-fieldhouse-cup")

        let trophies = LegacyCareerRecords.trophies(for: player, merging: [firstLeague, secondLeague])

        #expect(trophies.count == 2)
    }

    @Test func bettingLinesAlwaysResolveWithoutATie() {
        #expect(noPushSpread(3) == 3.5)
        #expect(noPushSpread(-4) == 4.5)
        #expect(noPushSpread(7.5) == 7.5)
        #expect(noPushSpread(2.24) == 2.5)
        #expect(isNoPushSpread(3.5))
        #expect(isNoPushSpread(-10.5))
        #expect(!isNoPushSpread(3))
        #expect(!isNoPushSpread(7.25))
        #expect(favoriteSpreadLabel(favorite: "USC", spread: 39.5) == "USC -39.5")
        #expect(favoriteSpreadLabel(favorite: "USC", spread: -39.5) == "USC -39.5")
    }

    @Test func leagueAutoBalanceIsEvenAndMinimizesMoves() {
        let players = (0..<11).map { index in
            LeagueDivisionBalanceCandidate(
                membershipId: UUID(uuidString: String(format: "00000000-0000-0000-0000-%012d", index + 1))!,
                name: "Player \(index + 1)",
                currentDivision: index < 4 ? "North" : (index < 7 ? "South" : (index < 9 ? "East" : "West"))
            )
        }
        let assignments = LeagueDivisionBalancer.assignments(for: players)
        let counts = Dictionary(grouping: assignments.values, by: { $0 }).mapValues(\.count)
        #expect(counts["North"] == 3)
        #expect(counts["South"] == 3)
        #expect(counts["East"] == 3)
        #expect(counts["West"] == 2)
        #expect(assignments[players[0].membershipId] == "North")
        #expect(assignments[players[4].membershipId] == "South")
    }

    @Test func leagueAutoBalanceAssignsEveryPlayerDeterministically() {
        let players = (0..<6).map { index in
            LeagueDivisionBalanceCandidate(
                membershipId: UUID(uuidString: String(format: "10000000-0000-0000-0000-%012d", index + 1))!,
                name: "Player \(index + 1)",
                currentDivision: nil
            )
        }
        let first = LeagueDivisionBalancer.assignments(for: players)
        let second = LeagueDivisionBalancer.assignments(for: players.reversed())
        #expect(first == second)
        #expect(first.count == players.count)
        let counts = Dictionary(grouping: first.values, by: { $0 }).mapValues(\.count)
        #expect((counts.values.max() ?? 0) - (counts.values.min() ?? 0) <= 1)
    }

    @Test func leagueAutoBalanceSupportsOneHundredPlayers() {
        let players = (0..<100).map { index in
            LeagueDivisionBalanceCandidate(
                membershipId: UUID(uuidString: String(format: "20000000-0000-0000-0000-%012d", index + 1))!,
                name: "Player \(index + 1)",
                currentDivision: nil
            )
        }
        let assignments = LeagueDivisionBalancer.assignments(for: players)
        let counts = Dictionary(grouping: assignments.values, by: { $0 }).mapValues(\.count)
        #expect(assignments.count == 100)
        #expect(LeagueDivisionBalancer.divisions.allSatisfy { counts[$0] == 25 })
    }

    @Test func cfbWeeksTwoThroughFourteenMatchEspnTuesdayBuckets() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let weekTwo = try #require(calendar.date(from: DateComponents(year: 2026, month: 9, day: 8)))
        let weekSix = try #require(CfbWeekTimeline.espnWeek(week: 6, weekTwoTuesday: weekTwo, calendar: calendar))
        #expect(calendar.dateComponents([.year,.month,.day], from: weekSix.start) == DateComponents(year: 2026, month: 10, day: 6))
        #expect(calendar.dateComponents([.year,.month,.day], from: weekSix.end) == DateComponents(year: 2026, month: 10, day: 12))
        let weekFourteen = try #require(CfbWeekTimeline.espnWeek(week: 14, weekTwoTuesday: weekTwo, calendar: calendar))
        #expect(calendar.dateComponents([.year,.month,.day], from: weekFourteen.start) == DateComponents(year: 2026, month: 12, day: 1))
        #expect(calendar.dateComponents([.year,.month,.day], from: weekFourteen.end) == DateComponents(year: 2026, month: 12, day: 7))
    }

    @Test func rivalryCatalogRecognizesNamedGrudgesWithoutFalsePositives() throws {
        #expect(RivalryMatchupCatalog.match(away: "Auburn Tigers", home: "Alabama Crimson Tide")?.name == "Iron Bowl")
        #expect(RivalryMatchupCatalog.match(away: "Ohio State Buckeyes", home: "Michigan Wolverines")?.name == "The Game")
        #expect(RivalryMatchupCatalog.match(away: "Kentucky Wildcats", home: "Louisville Cardinals")?.name == "Governor's Cup")
        #expect(RivalryMatchupCatalog.match(away: "Alabama Crimson Tide", home: "Georgia Bulldogs") == nil)
    }

    @Test func epicAndLegendaryRivalryCheevosRequireDistinctSeasons() {
        let oneSeason = RivalryWeekCheevoPolicy.codes(cardCompleted: true, hitSeasons: 1, bestBetHitSeasons: 1)
        #expect(oneSeason.contains("hate_week_roll_call"))
        #expect(oneSeason.contains("rivalry_week"))
        #expect(!oneSeason.contains("grudge_veteran"))
        #expect(!oneSeason.contains("dynasty_of_spite"))

        let twoSeasons = RivalryWeekCheevoPolicy.codes(cardCompleted: true, hitSeasons: 2, bestBetHitSeasons: 1)
        #expect(twoSeasons.contains("grudge_veteran"))
        #expect(!twoSeasons.contains("dynasty_of_spite"))

        let threeWithoutBestBet = RivalryWeekCheevoPolicy.codes(cardCompleted: true, hitSeasons: 3, bestBetHitSeasons: 0)
        #expect(!threeWithoutBestBet.contains("dynasty_of_spite"))
        #expect(RivalryWeekCheevoPolicy.codes(cardCompleted: true, hitSeasons: 3, bestBetHitSeasons: 1).contains("dynasty_of_spite"))
    }

    @Test func lockerSafetyRejectsAbuseButAllowsFootballTrashTalk() {
        #expect(LockerContentSafety.violation(in: "Your lock was terrible") == nil)
        #expect(LockerContentSafety.violation(in: "GO DIE") != nil)
        #expect(LockerContentSafety.violation(in: "kys") != nil)
    }

    @Test func appOpenEasterEggDates() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let profile = EasterEggProfile(createdAt: "2024-12-25T12:00:00Z", birthdayMMDD: "12-25")
        let christmas = try #require(calendar.date(from: DateComponents(year: 2026, month: 12, day: 25, hour: 12)))
        let ids = EasterEggEngine.appOpenDiscoveries(now: christmas, profile: profile, calendar: calendar)
        #expect(ids.contains("egg_christmas"))
        #expect(ids.contains("egg_birthday"))
        #expect(ids.contains("egg_anniversary"))

        let thanksgiving = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 26, hour: 12)))
        #expect(EasterEggEngine.appOpenDiscoveries(now: thanksgiving, profile: profile, calendar: calendar).contains("egg_thanksgiving"))
    }

    @Test func luckySevenRequiresTheExactSecond() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let exact = try #require(calendar.date(from: DateComponents(year: 2026, month: 9, day: 5, hour: 7, minute: 7, second: 7)))
        let late = try #require(calendar.date(from: DateComponents(year: 2026, month: 9, day: 5, hour: 7, minute: 7, second: 8)))
        #expect(EasterEggEngine.isLuckySeven(exact, calendar: calendar))
        #expect(!EasterEggEngine.isLuckySeven(late, calendar: calendar))
    }

    @Test func threePeatRequiresConsecutiveUniqueYears() {
        #expect(EasterEggEngine.hasThreePeat([2026, 2025, 2024]))
        #expect(EasterEggEngine.hasThreePeat([2026, 2026, 2025, 2024]))
        #expect(!EasterEggEngine.hasThreePeat([2026, 2024, 2023]))
    }

    @Test func gazetteSecretLettersFollowTheOriginalCycle() {
        #expect(EasterEggEngine.gazetteSecretLetter(week: 0) == "N")
        #expect(EasterEggEngine.gazetteSecretLetter(week: 1) == "E")
        #expect(EasterEggEngine.gazetteSecretLetter(week: 10) == "P")
        #expect(EasterEggEngine.gazetteSecretLetter(week: 11) == "N")
    }

    @Test func mascotOnlyAppearsOnItsDeterministicRotation() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let visible = try #require(calendar.date(from: DateComponents(year: 2026, month: 8, day: 18, hour: 12)))
        let hidden = try #require(calendar.date(byAdding: .day, value: 1, to: visible))
        #expect(EasterEggEngine.mascotLocation(on: visible, calendar: calendar) != nil)
        #expect(EasterEggEngine.mascotLocation(on: hidden, calendar: calendar) == nil)
    }

    @Test func cheevosLandAcrossTheSeasonInsteadOfAtFirstKickoff() {
        let weekFour = CheevoEngine.Snapshot(totalPoints: 44, weeklyPoints: [9, 12, 10, 13], weeksPlayed: 4, atsCorrect: 12, bestBetHits: 2, bestBetTotal: 4, propHits: 2, propTotal: 4, currentCorrectPickStreak: 4, underdogCovers: 2, homeCovers: 3, roadCovers: 2, consecutiveSubmittedWeeks: 4, submittedInFirstEight: 4)
        let early = CheevoEngine.eligibleCodes(for: weekFour)
        #expect(!early.contains("iron_lungs"))
        #expect(!early.contains("best_bet_banker"))
        #expect(!early.contains("crew_midseason_loyal"))

        let weekEight = CheevoEngine.Snapshot(totalPoints: 91, weeklyPoints: [9, 12, 10, 13, 8, 14, 11, 14], weeksPlayed: 8, atsCorrect: 26, bestBetHits: 3, bestBetTotal: 8, propHits: 5, propTotal: 8, currentCorrectPickStreak: 5, underdogCovers: 5, homeCovers: 5, roadCovers: 5, consecutiveSubmittedWeeks: 8, submittedInFirstEight: 8)
        let middle = CheevoEngine.eligibleCodes(for: weekEight)
        #expect(middle.contains("iron_lungs"))
        #expect(middle.contains("crew_card_grinder"))
        #expect(middle.contains("crew_midseason_loyal"))
        #expect(middle.contains("best_bet_banker"))
        #expect(middle.contains("prop_prophet"))
        #expect(!middle.contains("parlay_pilot"))
        #expect(!middle.contains("clutch_gene"))
    }

    @Test func dogAndVenueCheevosRequireRealSideSpecificCovers() {
        let snapshot = CheevoEngine.Snapshot(totalPoints: 100, weeklyPoints: [10], weeksPlayed: 8, atsCorrect: 50, bestBetHits: 0, bestBetTotal: 0, propHits: 0, propTotal: 0, currentCorrectPickStreak: 0, underdogCovers: 0, homeCovers: 0, roadCovers: 0, consecutiveSubmittedWeeks: 0, submittedInFirstEight: 0)
        let codes = CheevoEngine.eligibleCodes(for: snapshot)
        #expect(codes.contains("volume_shooter"))
        #expect(!codes.contains("underdog_spree"))
        #expect(!codes.contains("underdog_believer"))
        #expect(!codes.contains("home_cookin"))
        #expect(!codes.contains("road_dog"))
    }

    @Test func competitiveLeagueRequiresFourPlayersAtSeventyFivePercent() {
        #expect(CompetitiveLeaguePolicy.requiredLockedCards(eligibleCards: 10) == 8)
        #expect(CompetitiveLeaguePolicy.requiredLockedCards(eligibleCards: 9) == 7)
        #expect(!CompetitiveLeaguePolicy.playerQualifies(lockedCards: 7, eligibleCards: 10))
        #expect(CompetitiveLeaguePolicy.playerQualifies(lockedCards: 8, eligibleCards: 10))
        #expect(!CompetitiveLeaguePolicy.playerQualifies(lockedCards: 1, eligibleCards: 1))
        #expect(!CompetitiveLeaguePolicy.isOfficial(activePlayers: 1))
        #expect(!CompetitiveLeaguePolicy.isOfficial(activePlayers: 3))
        #expect(CompetitiveLeaguePolicy.isOfficial(activePlayers: 4))
    }

    @Test func tenSoloLeagueChampionshipsNeverEnterTheHardwareTrack() {
        let farmedRooms = Array(repeating: 1, count: 10)
        #expect(farmedRooms.allSatisfy { !CompetitiveLeaguePolicy.isOfficial(activePlayers: $0) })
        #expect(farmedRooms.filter(CompetitiveLeaguePolicy.isOfficial(activePlayers:)).isEmpty)
    }

    @Test func competitiveLeagueBannerNeverConfusesMembersWithActivePlayers() {
        let status = CompetitiveLeagueStatus(
            leagueId: UUID(), sportId: "cfb", status: "demo",
            activeHumanCount: 3, totalHumanCount: 14,
            minimumActivePlayers: 4, requiredParticipationPercent: 75,
            minimumLockedCards: 4,
            qualification: [
                CompetitiveLeagueQualification(
                    userId: UUID(), eligibleCards: 6, lockedCards: 5,
                    requiredLockedCards: 5, qualifies: true
                )
            ]
        )
        let copy = CompetitiveLeagueBannerPolicy.copy(status: status, seasonIsFrozen: false)
        #expect(copy.title == "DEMO TRACK · NEED 1 MORE ACTIVE PLAYER")
        #expect(copy.detail.contains("3 of 4 active players currently qualify"))
        #expect(!copy.detail.contains("14 of 4"))
        #expect(!copy.isHardwareEligible)
    }

    @Test func competitiveLeagueBannerDoesNotCallLargeRoomsDemoBeforeFourScoredCards() {
        let status = CompetitiveLeagueStatus(
            leagueId: UUID(), sportId: "cfb", status: "demo",
            activeHumanCount: 0, totalHumanCount: 43,
            minimumActivePlayers: 4, requiredParticipationPercent: 75,
            minimumLockedCards: 4,
            qualification: [
                CompetitiveLeagueQualification(
                    userId: UUID(), eligibleCards: 1, lockedCards: 1,
                    requiredLockedCards: 1, qualifies: false
                )
            ]
        )
        let copy = CompetitiveLeagueBannerPolicy.copy(status: status, seasonIsFrozen: false)
        #expect(copy.title == "HARDWARE TRACK · 43 PLAYERS")
        #expect(copy.detail.contains("Final active status begins after four scored cards"))
        #expect(copy.isHardwareEligible)
    }

    @Test func competitiveLeagueBannerOnlyPromisesHardwareAfterTheThreshold() {
        let status = CompetitiveLeagueStatus(
            leagueId: UUID(), sportId: "nfl", status: "official",
            activeHumanCount: 4, totalHumanCount: 12,
            minimumActivePlayers: 4, requiredParticipationPercent: 75,
            minimumLockedCards: 4,
            qualification: [
                CompetitiveLeagueQualification(
                    userId: UUID(), eligibleCards: 6, lockedCards: 5,
                    requiredLockedCards: 5, qualifies: true
                )
            ]
        )
        let tracking = CompetitiveLeagueBannerPolicy.copy(status: status, seasonIsFrozen: false)
        let frozen = CompetitiveLeagueBannerPolicy.copy(status: status, seasonIsFrozen: true)
        #expect(tracking.title == "HARDWARE TRACK · 4 ACTIVE PLAYERS")
        #expect(frozen.title == "OFFICIAL LEAGUE · PROFILE HARDWARE ENABLED")
        #expect(frozen.isHardwareEligible)
    }

    @Test func duplicateLeagueCheevosNeverMultiplyCareerRankPoints() {
        let firstLeague = UUID()
        let secondLeague = UUID()
        let rows = [
            ProfileAchievement(leagueId: firstLeague, code: "championship_ring", title: "Championship Ring", flavor: "First room", earnedAt: "2026-12-01T00:00:00Z"),
            ProfileAchievement(leagueId: secondLeague, code: "championship_ring", title: "Championship Ring", flavor: "Second room", earnedAt: "2027-12-01T00:00:00Z"),
        ]
        #expect(PromotionPoints.total(for: rows) == 200)

        let merged = LegacyCareerRecords.achievements(for: UUID(), merging: rows)
        #expect(merged.count == 1)
        #expect(merged.first?.leagueId == secondLeague)
    }

    @Test func repeatChampionMilestonesStackWithoutDuplicatingTheBaseRing() {
        let league = UUID()
        let rows = [
            ProfileAchievement(leagueId: league, code: "championship_ring", title: "Championship Ring", flavor: "Base ring", earnedAt: "2027-01-01T00:00:00Z"),
            ProfileAchievement(leagueId: league, code: "three_ring_circus", title: "Three-Ring Circus", flavor: "Three titles", earnedAt: "2028-01-01T00:00:00Z"),
            ProfileAchievement(leagueId: league, code: "five_star_dynasty", title: "Five-Star Dynasty", flavor: "Five titles", earnedAt: "2029-01-01T00:00:00Z"),
            ProfileAchievement(leagueId: league, code: "ten_room_terror", title: "Ten-Room Terror", flavor: "Ten titles", earnedAt: "2030-01-01T00:00:00Z"),
        ]

        #expect(PromotionPoints.total(for: rows) == 550)
        #expect(ProfileCosmetics.titleName(for: "three_ring_circus") == "Three-Time Champion")
        #expect(ProfileCosmetics.titleName(for: "five_star_dynasty") == "Five-Star Dynasty")
        #expect(ProfileCosmetics.titleName(for: "ten_room_terror") == "Ten-Room Terror")
    }

    @Test func favoriteTeamIdsResolveForBoardLoyalty() {
        #expect(FootballTeamCatalog.team(forTeamId: "ohio-state", sportId: "cfb")?.name == "Ohio State")
        #expect(FootballTeamCatalog.team(forTeamId: "cfb-notre-dame", sportId: "cfb")?.name == "Notre Dame")
        #expect(FootballTeamCatalog.team(forTeamId: "unlv", sportId: "cfb")?.name == "UNLV")
    }

    @Test func favoriteTeamLookupStaysInsideTheLeagueSport() {
        #expect(FootballTeamCatalog.team(forTeamId: "bills", sportId: "nfl")?.name == "Buffalo Bills")
        #expect(FootballTeamCatalog.team(forTeamId: "bills", sportId: "cfb") == nil)
    }

    @Test func boardRecognizesFullSchoolAndMascotNames() {
        let louisville = FootballTeamCatalog.team(forTeamId: "louisville", sportId: "cfb")!
        let hawaii = FootballTeamCatalog.team(forTeamId: "hawaii", sportId: "cfb")!
        #expect(FootballTeamCatalog.matches("Louisville Cardinals", favorite: louisville))
        #expect(FootballTeamCatalog.matches("Hawaii Rainbow Warriors", favorite: hawaii))
    }

    @Test func loginRequiresCommunityTermsForExistingAndNewAccounts() {
        #expect(!loginSubmissionIsAllowed(
            creating: false,
            validEmail: true,
            validPassword: true,
            validDisplayName: true,
            acceptedCommunityTerms: false
        ))
        #expect(loginSubmissionIsAllowed(
            creating: false,
            validEmail: true,
            validPassword: true,
            validDisplayName: true,
            acceptedCommunityTerms: true
        ))
        #expect(!loginSubmissionIsAllowed(
            creating: true,
            validEmail: true,
            validPassword: true,
            validDisplayName: false,
            acceptedCommunityTerms: true
        ))
        #expect(loginSubmissionIsAllowed(
            creating: true,
            validEmail: true,
            validPassword: true,
            validDisplayName: true,
            acceptedCommunityTerms: true
        ))
    }

    @Test func boardDeclassifiesEachGameAtItsOwnKickoff() {
        let noon = "2026-09-05T16:00:00Z"
        let five = "2026-09-05T21:00:00Z"
        let sevenThirty = "2026-09-05T23:30:00Z"
        let fourPM = ISO8601DateFormatter().date(from: "2026-09-05T20:00:00Z")!

        #expect(boardGameIsDeclassified(startTime: noon, at: fourPM, weekScored: false))
        #expect(!boardGameIsDeclassified(startTime: five, at: fourPM, weekScored: false))
        #expect(!boardGameIsDeclassified(startTime: sevenThirty, at: fourPM, weekScored: false))
        #expect(boardGameIsDeclassified(startTime: sevenThirty, at: fourPM, weekScored: true))
    }

    @Test func liveBoardRefreshNeverReplacesVisibleCards() {
        #expect(boardRefreshPresentation(lockedCardCount: 12, loading: true, errorMessage: nil) == .content)
        #expect(boardRefreshPresentation(lockedCardCount: 12, loading: false, errorMessage: "Score feed delayed") == .content)
        #expect(boardRefreshPresentation(lockedCardCount: 0, loading: true, errorMessage: nil) == .initialLoading)
        #expect(boardRefreshPresentation(lockedCardCount: 0, loading: false, errorMessage: "Board unavailable") == .blockingError)
        #expect(boardRefreshPresentation(lockedCardCount: 0, loading: false, errorMessage: nil) == .empty)
    }

    @Test func gameBoardSeparatesWaitingLiveAndFinalGames() {
        #expect(boardGameStage(score: nil) == .waiting)
        #expect(boardGameStage(score: SyncedFootballScore(homeScore: 14, awayScore: 10, completed: false)) == .live)
        #expect(boardGameStage(score: SyncedFootballScore(homeScore: 24, awayScore: 17, completed: true)) == .final)
    }

    @Test func startedFootballEventWithoutScoresStillAppearsLive() {
        let event = FootballScoreEvent(
            id: "live-no-score",
            commenceTime: "2026-09-06T23:45:00Z",
            completed: false,
            homeTeam: "Ole Miss Rebels",
            awayTeam: "Louisville Cardinals",
            scores: [],
            lastUpdate: nil
        )
        let now = ISO8601DateFormatter().date(from: "2026-09-06T23:53:00Z")!
        let score = syncedFootballScore(event: event, now: now)

        #expect(score != nil)
        #expect(score?.scoreAvailable == false)
        #expect(boardGameStage(score: score) == .live)
    }

    @Test func futureFootballEventWithoutScoresRemainsWaiting() {
        let event = FootballScoreEvent(
            id: "future-no-score",
            commenceTime: "2026-09-07T23:45:00Z",
            completed: false,
            homeTeam: "Ole Miss Rebels",
            awayTeam: "Louisville Cardinals",
            scores: [],
            lastUpdate: nil
        )
        let now = ISO8601DateFormatter().date(from: "2026-09-06T23:53:00Z")!

        #expect(syncedFootballScore(event: event, now: now) == nil)
    }

    @Test func finalGameHighlightsTheTeamThatCoveredNotTheStraightUpWinner() {
        let game = CardGame(
            id: UUID(),
            sortOrder: 0,
            awayTeam: "Alabama Crimson Tide",
            homeTeam: "Georgia Bulldogs",
            spread: 7.5,
            favorite: "home",
            startTime: "2026-09-05T16:00:00Z",
            awayRank: 3,
            homeRank: 1,
            isRivalry: false
        )
        let score = SyncedFootballScore(homeScore: 3, awayScore: 0, completed: true)

        #expect(footballCoverWinnerSide(game: game, score: score) == "away")
        #expect(footballCoverWinnerSide(game: game, score: SyncedFootballScore(homeScore: 10, awayScore: 0, completed: true)) == "home")
        #expect(footballCoverWinnerSide(game: game, score: SyncedFootballScore(homeScore: 10, awayScore: 0, completed: false)) == nil)
    }

    @Test func postgresKickoffTimestampDrivesLockedHomeState() {
        let value = "2026-08-16 16:43:41.278784+00"
        #expect(footballKickoffDate(value) != nil)
    }

    @Test func submittedPickKickoffIncludesDayDateTimeAndZone() throws {
        let eastern = try #require(TimeZone(identifier: "America/New_York"))
        let label = try #require(footballKickoffLabel("2026-09-05T16:00:00Z", timeZone: eastern))
        #expect(label == "SAT, SEP 5 · 12:00 PM EDT")
        #expect(footballKickoffLabel(nil, timeZone: eastern) == nil)
    }

    @Test func rivalryTracksTheClosestLiveStanding() {
        let player = standing(name: "Mike", points: 100, id: 1)
        let closeBehind = standing(name: "Kahmann", points: 98, id: 2)
        let fartherAhead = standing(name: "Maria", points: 106, id: 3)
        #expect(closestRival(for: player, in: [fartherAhead, player, closeBehind])?.userId == closeBehind.userId)

        let movedMaria = standing(name: "Maria", points: 101, id: 3)
        #expect(closestRival(for: player, in: [closeBehind, movedMaria, player])?.userId == movedMaria.userId)
    }

    @Test func cardReminderScheduleUsesTwelveAndOneHourWarnings() throws {
        let leagueId = try #require(UUID(uuidString: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE"))
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let lockAt = now.addingTimeInterval(24 * 60 * 60)
        let reminders = CardReminderSchedule.pending(lockAt: lockAt, now: now, leagueId: leagueId, week: 4)
        #expect(reminders.map(\.kind) == ["12h", "1h"])
        #expect(reminders[0].fireAt == lockAt.addingTimeInterval(-12 * 60 * 60))
        #expect(reminders[1].fireAt == lockAt.addingTimeInterval(-60 * 60))
        #expect(CardReminderSchedule.pending(lockAt: now.addingTimeInterval(30 * 60), now: now, leagueId: leagueId, week: 4).isEmpty)
    }

    @Test func liveScorecardUsesCertifiedAuthorityWhenWeekIsOfficial() {
        #expect(LiveScorecardOfficialState.total(gamePoints: 8, certifiedTotal: nil) == 8)
        #expect(LiveScorecardOfficialState.total(gamePoints: 8, certifiedTotal: 11) == 11)
        #expect(LiveScorecardOfficialState.propStatus(choice: "Yes", officialResult: nil, points: 3) == "PENDING")
        #expect(LiveScorecardOfficialState.propStatus(choice: "Yes", officialResult: "Yes", points: 3) == "HIT +3")
        #expect(LiveScorecardOfficialState.propStatus(choice: "No", officialResult: "Yes", points: 3) == "MISS +0")
    }

    @Test func nflJdamMissesTheBoundaryAtSevenOfThirteen() {
        #expect(NflJdamScoring.decisionCount == 13)
        #expect(NflJdamScoring.successThreshold == 8)
        #expect(NflJdamScoring.multiplier(correctPicks: 7, usedJdam: true) == 0.5)
        #expect(NflJdamScoring.adjustedPoints(rawPoints: 17, correctPicks: 7, usedJdam: true) == 9)
    }

    @Test func nflJdamClearsTheBoundaryAtEightOfThirteen() {
        #expect(NflJdamScoring.multiplier(correctPicks: 8, usedJdam: true) == 1.5)
        #expect(NflJdamScoring.adjustedPoints(rawPoints: 17, correctPicks: 8, usedJdam: true) == 26)
        #expect(NflJdamScoring.adjustedPoints(rawPoints: 17, correctPicks: 13, usedJdam: false) == 17)
    }

    @Test func nflPostseasonHardwarePresentationUsesOnlyTheAuthoritativeCurrentReceipt() throws {
        let league = UUID()
        let user = UUID()
        let expected = ProfileTrophy(id: UUID(), leagueId: league, seasonYear: 2026, trophyType: "championship", winnerName: "Riley V", winnerUserId: user, subtitle: nil, notes: nil, awardedAt: "2027-02-15T04:00:00Z", trophyDesignId: "nfl_gridiron_crown")
        let wrongLeague = ProfileTrophy(id: UUID(), leagueId: UUID(), seasonYear: 2026, trophyType: "championship", winnerName: "Riley V", winnerUserId: user, subtitle: nil, notes: nil, awardedAt: "2027-02-15T04:00:00Z", trophyDesignId: "nfl_gridiron_crown")
        let wrongSeason = ProfileTrophy(id: UUID(), leagueId: league, seasonYear: 2025, trophyType: "toilet_bowl", winnerName: "Riley V", winnerUserId: user, subtitle: nil, notes: nil, awardedAt: "2026-02-15T04:00:00Z", trophyDesignId: "toilet_bowl")

        let selected = try #require(NflPostseasonHardwareSelector.award(
            from: [wrongLeague, wrongSeason, expected],
            leagueID: league,
            seasonKey: 2026,
            userID: user
        ))

        #expect(selected.id == expected.id)
        #expect(NflPostseasonHardwareSelector.title(for: selected) == "NFL FINAL THIRTEEN CHAMPION")
        #expect(NflPostseasonHardwareSelector.presentationKey(for: selected).contains(selected.id.uuidString.lowercased()))
    }

    private func standing(name: String, points: Int, id: Int) -> Standing {
        Standing(
            id: UUID(uuidString: String(format: "00000000-0000-0000-0000-%012d", id))!,
            userId: UUID(uuidString: String(format: "10000000-0000-0000-0000-%012d", id))!,
            totalPoints: points,
            weeklyPoints: [points],
            weeksPlayed: 5,
            displayNameOverride: name,
            division: nil,
            profiles: nil,
            atsCorrect: 1,
            atsTotal: 1,
            currentStreak: 1,
            bestWeek: points,
            worstWeek: points,
            perfectWeeks: 0,
            bestBetHits: 0,
            bestBetTotal: 0,
            propHits: 0,
            propTotal: 0,
            isBot: true
        )
    }

}
