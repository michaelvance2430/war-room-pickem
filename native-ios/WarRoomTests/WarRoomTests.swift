//
//  WarRoomTests.swift
//  WarRoomTests
//
//  Created by Michael Vance on 8/14/26.
//

import Testing
import Foundation
@testable import WarRoom

struct WarRoomTests {

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

    @Test func postgresKickoffTimestampDrivesLockedHomeState() {
        let value = "2026-08-16 16:43:41.278784+00"
        #expect(footballKickoffDate(value) != nil)
    }

    @Test func rivalryTracksTheClosestLiveStanding() {
        let player = standing(name: "Mike", points: 100, id: 1)
        let closeBehind = standing(name: "Kahmann", points: 98, id: 2)
        let fartherAhead = standing(name: "Maria", points: 106, id: 3)
        #expect(closestRival(for: player, in: [fartherAhead, player, closeBehind])?.userId == closeBehind.userId)

        let movedMaria = standing(name: "Maria", points: 101, id: 3)
        #expect(closestRival(for: player, in: [closeBehind, movedMaria, player])?.userId == movedMaria.userId)
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
