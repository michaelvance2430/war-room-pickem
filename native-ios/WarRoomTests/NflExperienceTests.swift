import Testing
import Foundation
@testable import WarRoom

struct NflExperienceTests {
    private var field: [NflPostseasonTeam] {
        ["AFC","NFC"].flatMap { conference in
            (1...7).map { seed in .init(id: "\(conference.lowercased())-\(seed)", name: "\(conference) Team \(seed)", conference: conference, seed: seed) }
        }
    }

    @Test func nflStartsAtWeekOne() {
        #expect(SportIdentity("nfl").openingWeek == 1)
        #expect(NflSeasonPhase.phase(week: 1) == .regularSeason)
        #expect(NflSeasonPhase.phase(week: 18) == .regularSeason)
        #expect(NflSeasonPhase.phase(week: 19) == .wildCard)
    }

    @Test func nflCalendarHasTwentyTwoPlayableWeeksAndOneBroadcastBreak() {
        #expect(NflSeasonTimeline.regularSeasonWeeks == 18)
        #expect(NflSeasonTimeline.playoffRounds == 4)
        #expect(NflSeasonTimeline.playableWeeks == 22)
        #expect(NflSeasonTimeline.elapsedCalendarWeeks == 23)
        #expect(NflSeasonTimeline.hasConferenceChampionshipBye)
        #expect(NflSeasonPhase.phase(week: 22) == .superBowl)
    }

    @Test func nflWeekTurnsOverTuesdayAndMondayNightClosesTheSlate() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let thursday = calendar.date(from: DateComponents(year: 2026, month: 9, day: 10))!
        let operational = NflSeasonTimeline.operationalWeek(containing: thursday, calendar: calendar)
        #expect(operational.map { calendar.component(.weekday, from: $0.start) } == 3)
        #expect(operational.map { calendar.component(.weekday, from: $0.end) } == 2)
        let slate = NflSeasonTimeline.regularSeasonSlate(week: 1, openingThursday: thursday, calendar: calendar)
        #expect(slate.map { calendar.component(.weekday, from: $0.start) } == 5)
        #expect(slate.map { calendar.component(.weekday, from: $0.end) } == 2)
    }

    @Test func postseasonStaysAttachedToTheFallSeasonAcrossNewYear() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let january = calendar.date(from: DateComponents(year: 2027, month: 1, day: 18))!
        let august = calendar.date(from: DateComponents(year: 2026, month: 8, day: 19))!
        #expect(NflSeasonCalendar.seasonKey(for: january, calendar: calendar) == 2026)
        #expect(NflSeasonCalendar.seasonKey(for: august, calendar: calendar) == 2026)
    }

    @Test func finalThirteenContainsExactlyThirteenDecisions() {
        #expect(NflBracketEngine.requiredKeys.count == 13)
        #expect(Set(NflBracketEngine.requiredKeys).count == 13)
    }

    @Test func jdamCompletesAValidBracket() {
        let picks = NflBracketEngine.jdamPicks(teams: field)
        #expect(Set(picks.keys) == Set(NflBracketEngine.requiredKeys))
        let games = NflBracketEngine.games(teams: field, picks: picks)
        #expect(games.first { $0.id == "SUPER-BOWL" }?.teams.count == 2)
        #expect(games.first { $0.id == "SUPER-BOWL" }.flatMap { NflBracketEngine.winner($0, picks: picks) } != nil)
    }

    @Test func divisionalRoundReseedsLowestWildCardSurvivorToOneSeed() {
        var picks = ["AFC-WC-2-7":"afc-7", "AFC-WC-3-6":"afc-3", "AFC-WC-4-5":"afc-4"]
        let games = NflBracketEngine.games(teams: field, picks: picks)
        let oneSeedGame = games.first { $0.id == "AFC-DIV-1" }
        #expect(oneSeedGame?.teams.map(\.seed) == [1,7])
        NflBracketEngine.clearedDownstream(after: "AFC-WC-2-7", picks: &picks)
        #expect(picks["AFC-DIV-1"] == nil)
        #expect(picks["AFC-CONF"] == nil)
    }

    @Test func nflFavoriteIdsNormalizeWithoutLeagueBranding() {
        #expect(FootballTeamCatalog.normalizedTeamId("NFL - Kansas City Chiefs") == "kansas-city-chiefs")
        #expect(FootballTeamCatalog.team(forTeamId: "kansas-city-chiefs", sportId: "nfl")?.name == "Kansas City Chiefs")
    }

    @Test func nflFoundryNeverFallsBackToCfb() {
        #expect(FoundryLabPolicy.accepts(mode: "foundry", sportId: "nfl", preferredSportId: "nfl"))
        #expect(!FoundryLabPolicy.accepts(mode: "foundry", sportId: "cfb", preferredSportId: "nfl"))
        #expect(!FoundryLabPolicy.accepts(mode: "production", sportId: "nfl", preferredSportId: "nfl"))
        #expect(WeaponStrikeCatalog.presentation(for: "nfl") == nil)
    }
}
