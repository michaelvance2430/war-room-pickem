import Foundation

struct EasterEggFind: Decodable, Sendable {
    let discoveryId: String
    let foundAt: String

    enum CodingKeys: String, CodingKey {
        case discoveryId = "discovery_id"
        case foundAt = "found_at"
    }
}

struct EasterEggProfile: Decodable, Sendable {
    let createdAt: String
    let birthdayMMDD: String?

    enum CodingKeys: String, CodingKey {
        case createdAt = "created_at"
        case birthdayMMDD = "birthday_mmdd"
    }
}

struct EasterEggRecordResponse: Decodable, Sendable {
    let ok: Bool
    let newFind: Bool?
}

struct NativeAppOpenResponse: Decodable, Sendable {
    let ok: Bool
    let openedOn: String
    let streak: Int
    let awarded: [String]
}

enum EasterEggEngine {
    enum MascotLocation: String, CaseIterable, Sendable {
        case homeCorner = "home_corner"
        case standingsEdge = "standings_edge"
        case gazetteMargin = "gazette_margin"
        case boardScoreboard = "board_scoreboard"
        case lockerBench = "locker_bench"

        var tabIndex: Int? {
            switch self {
            case .homeCorner: return 0
            case .boardScoreboard: return 1
            case .standingsEdge: return 2
            case .lockerBench: return 3
            case .gazetteMargin: return nil
            }
        }
    }
    struct RareGazetteLine: Equatable, Sendable {
        let headline: String
        let deck: String
    }
    static let zeroLeagueId = UUID(uuidString: "00000000-0000-0000-0000-000000000000")!

    static func appOpenDiscoveries(now: Date, profile: EasterEggProfile, calendar: Calendar = .current) -> [String] {
        var ids: [String] = []
        let components = calendar.dateComponents([.month, .day], from: now)
        let month = components.month ?? 0
        let day = components.day ?? 0

        if month == 2 && day == 29 { ids.append("egg_leap_day") }
        if month == 10 && day == 31 { ids.append("egg_halloween") }
        if month == 12 && day == 25 { ids.append("egg_christmas") }
        if month == 1 && day == 1 { ids.append("egg_newyear") }
        if isUSThanksgiving(now, calendar: calendar) { ids.append("egg_thanksgiving") }
        if profile.birthdayMMDD == String(format: "%02d-%02d", month, day) { ids.append("egg_birthday") }

        if let joined = ISO8601DateFormatter.fractionalOrStandard.dateFromEither(profile.createdAt) {
            let joinedParts = calendar.dateComponents([.year, .month, .day], from: joined)
            let currentYear = calendar.component(.year, from: now)
            let fullYears = calendar.dateComponents([.year], from: joined, to: now).year ?? 0
            if joinedParts.month == month, joinedParts.day == day, currentYear > (joinedParts.year ?? currentYear) {
                ids.append("egg_anniversary")
            }
            if fullYears >= 10 {
                ids.append("egg_welcome_home")
            } else if fullYears > 0, fullYears.isMultiple(of: 5), isWithinAnniversaryWindow(now: now, joined: joined, calendar: calendar) {
                ids.append("egg_veterans")
            }
        }
        return ids
    }

    static func isLuckySeven(_ date: Date, calendar: Calendar = .current) -> Bool {
        let parts = calendar.dateComponents([.hour, .minute, .second], from: date)
        return parts.hour == 7 && parts.minute == 7 && parts.second == 7
    }

    static func hasThreePeat(_ years: [Int]) -> Bool {
        let sorted = Array(Set(years)).sorted(by: >)
        guard sorted.count >= 3 else { return false }
        for index in 0...(sorted.count - 3) where sorted[index] - sorted[index + 1] == 1 && sorted[index + 1] - sorted[index + 2] == 1 {
            return true
        }
        return false
    }

    static func rareGazetteLine(leagueId: UUID, week: Int) -> RareGazetteLine? {
        let seed = "\(leagueId.uuidString.lowercased()):w\(week):rare"
        var hash: UInt32 = 0
        for byte in seed.utf8 { hash = hash &* 31 &+ UInt32(byte) }
        guard hash % 25 == 0 else { return nil }
        return rareGazetteLines[Int(hash % UInt32(rareGazetteLines.count))]
    }

    static func gazetteSecretLetter(week: Int) -> Character {
        let letters = Array("NEVERGIVEUP")
        return letters[abs(week) % letters.count]
    }

    static func collectGazetteWeek(_ week: Int, userId: UUID, defaults: UserDefaults = .standard) -> Bool {
        let key = "warroom-gazette-secret-weeks-\(userId.uuidString.lowercased())"
        var weeks = Set(defaults.array(forKey: key) as? [Int] ?? [])
        weeks.insert(week)
        defaults.set(Array(weeks).sorted(), forKey: key)
        return weeks.count >= Array("NEVERGIVEUP").count
    }

    static func mascotLocation(on date: Date = Date(), calendar: Calendar = .current) -> MascotLocation? {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        let seed = (parts.year ?? 0) * 1000 + max(0, (parts.month ?? 1) - 1) * 50 + (parts.day ?? 0)
        guard seed % 3 == 0 else { return nil }
        return MascotLocation.allCases[seed % MascotLocation.allCases.count]
    }

    static func recordMascotLocation(_ location: MascotLocation, userId: UUID, defaults: UserDefaults = .standard) -> (isFirst: Bool, total: Int) {
        let key = "warroom-mascot-finds-\(userId.uuidString.lowercased())"
        var locations = Set(defaults.stringArray(forKey: key) ?? [])
        let isFirst = locations.insert(location.rawValue).inserted
        defaults.set(Array(locations).sorted(), forKey: key)
        return (isFirst, locations.count)
    }

    static func hasFoundMascot(_ location: MascotLocation, userId: UUID, defaults: UserDefaults = .standard) -> Bool {
        Set(defaults.stringArray(forKey: "warroom-mascot-finds-\(userId.uuidString.lowercased())") ?? []).contains(location.rawValue)
    }

    static func achievement(for find: EasterEggFind) -> ProfileAchievement? {
        guard let title = titles[find.discoveryId], let lore = CheevoLore.text(for: find.discoveryId, revealed: true) else { return nil }
        return ProfileAchievement(leagueId: zeroLeagueId, code: find.discoveryId, title: title, flavor: lore, earnedAt: find.foundAt)
    }

    private static func isUSThanksgiving(_ date: Date, calendar: Calendar) -> Bool {
        let parts = calendar.dateComponents([.month, .weekday, .weekdayOrdinal], from: date)
        return parts.month == 11 && parts.weekday == 5 && parts.weekdayOrdinal == 4
    }

    private static func isWithinAnniversaryWindow(now: Date, joined: Date, calendar: Calendar) -> Bool {
        let parts = calendar.dateComponents([.month, .day], from: joined)
        guard let anniversary = calendar.date(from: DateComponents(year: calendar.component(.year, from: now), month: parts.month, day: parts.day)) else { return false }
        return abs(now.timeIntervalSince(anniversary)) < 8 * 86_400
    }

    private static let titles: [String: String] = [
        "egg_anniversary": "One Year of Bad Picks", "egg_curiosity_trophy": "Curiosity Didn't Kill the Cat",
        "egg_vonnaggio_gold": "Family Vacay Gold", "egg_hidden_headline": "Ink Stain",
        "egg_leap_day": "Time Traveler", "egg_birthday": "Local Legend Aged Up",
        "egg_lucky_seven": "Lucky Seven",
        "egg_obsession": "Authorities Concerned", "egg_halloween": "Boo!",
        "egg_christmas": "Candy Cane Edition", "egg_thanksgiving": "Gravy Boat",
        "egg_newyear": "Resolution Already Broken", "egg_three_peat": "Dynasty Ink",
        "egg_never_give_up": "Never Give Up", "egg_developer_thanks": "Believer",
        "egg_impossible": "???", "egg_mascot_scout": "Mascot Spotter",
        "egg_veterans": "The Veterans Have Returned", "egg_welcome_home": "Welcome Home"
    ]

    private static let rareGazetteLines: [RareGazetteLine] = [
        .init(headline: "Local Commissioner Still Blaming Referees", deck: "Sources confirm the spread was the real problem."),
        .init(headline: "Area Man Convinced This Is His Year", deck: "Historical data unavailable for comment. Dignity declined interview."),
        .init(headline: "Group Chat Declares Martial Law After Week Scores", deck: "No injuries reported. Several egos listed as day-to-day."),
        .init(headline: "Scientists Baffled by Confidence Ranking Choices", deck: "Peer review suggested ‘touch grass.’ Peer was muted."),
        .init(headline: "War Room Printer Jams Itself Out of Mercy", deck: "Ink cites emotional labor. Paper files for asylum."),
        .init(headline: "Breaking: Someone’s Uncle Has a Lock", deck: "The uncle was wrong. The legend continues."),
        .init(headline: "League Votes to Ban Vibes-Based Analytics", deck: "Measure fails 1–11. The vibe lobby celebrates.")
    ]
}

private extension ISO8601DateFormatter {
    static let fractionalOrStandard: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    func dateFromEither(_ value: String) -> Date? {
        if let date = date(from: value) { return date }
        let plain = ISO8601DateFormatter()
        return plain.date(from: value)
    }
}
