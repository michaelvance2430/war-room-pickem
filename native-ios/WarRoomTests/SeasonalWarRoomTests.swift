import Foundation
import Testing
@testable import WarRoom

struct SeasonalWarRoomTests {
    private var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "America/New_York")!
        return value
    }

    @Test func halloweenRunsDayBeforeThroughDayAfter() throws {
        #expect(SeasonalSkin.active(on: date(2026, 10, 29), calendar: calendar, arguments: []) == nil)
        #expect(SeasonalSkin.active(on: date(2026, 10, 30), calendar: calendar, arguments: []) == .halloween)
        #expect(SeasonalSkin.active(on: date(2026, 10, 31), calendar: calendar, arguments: []) == .halloween)
        #expect(SeasonalSkin.active(on: date(2026, 11, 1), calendar: calendar, arguments: []) == .halloween)
        #expect(SeasonalSkin.active(on: date(2026, 11, 2), calendar: calendar, arguments: []) == nil)
    }

    @Test func thanksgivingUsesFourthThursdayAndThreeDayWindow() throws {
        #expect(SeasonalSkin.active(on: date(2026, 11, 25), calendar: calendar, arguments: []) == .thanksgiving)
        #expect(SeasonalSkin.active(on: date(2026, 11, 26), calendar: calendar, arguments: []) == .thanksgiving)
        #expect(SeasonalSkin.active(on: date(2026, 11, 27), calendar: calendar, arguments: []) == .thanksgiving)
        #expect(SeasonalSkin.active(on: date(2026, 11, 28), calendar: calendar, arguments: []) == nil)
    }

    @Test func christmasAndNewYearsUseThreeDayWindows() throws {
        #expect(SeasonalSkin.active(on: date(2026, 12, 24), calendar: calendar, arguments: []) == .christmas)
        #expect(SeasonalSkin.active(on: date(2026, 12, 26), calendar: calendar, arguments: []) == .christmas)
        #expect(SeasonalSkin.active(on: date(2026, 12, 31), calendar: calendar, arguments: []) == .newYears)
        #expect(SeasonalSkin.active(on: date(2027, 1, 2), calendar: calendar, arguments: []) == .newYears)
        #expect(SeasonalSkin.active(on: date(2027, 1, 3), calendar: calendar, arguments: []) == nil)
    }

    @Test func simulatorPreviewOverridesCalendar() {
        #expect(SeasonalSkin.active(on: date(2026, 7, 4), calendar: calendar, arguments: ["--preview-christmas"]) == .christmas)
    }

    private func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
    }
}
