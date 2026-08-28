import SwiftUI

enum CfbWeekTimeline {
    /// ESPN's 2026 regular-season week buckets roll Tuesday through Monday.
    /// Week 2 begins Tuesday, September 8; Week 14 contains conference titles.
    static func espnWeek(week: Int, weekTwoTuesday: Date, calendar: Calendar = .current) -> (start: Date, end: Date)? {
        guard (2...14).contains(week),
              let start = calendar.date(byAdding: .day, value: (week - 2) * 7, to: weekTwoTuesday),
              let end = calendar.date(byAdding: .day, value: 6, to: start) else { return nil }
        return (start, end)
    }
}

struct RivalryMatchup: Equatable {
    let name: String
    let glyph: String
}

/// The commissioner sees these as red-lit games during ESPN Week 13. The
/// match uses team names rather than feed IDs because sportsbooks use several
/// ID systems, while the published card stores the durable rivalry flag.
enum RivalryMatchupCatalog {
    private struct Pair {
        let first: [String]
        let second: [String]
        let rivalry: RivalryMatchup
    }

    private static let pairs: [Pair] = [
        .init(first: ["alabama"], second: ["auburn"], rivalry: .init(name: "Iron Bowl", glyph: "🪓")),
        .init(first: ["michigan"], second: ["ohio state"], rivalry: .init(name: "The Game", glyph: "🧤")),
        .init(first: ["florida"], second: ["florida state"], rivalry: .init(name: "Sunshine Showdown", glyph: "🐊")),
        .init(first: ["georgia"], second: ["georgia tech"], rivalry: .init(name: "Clean, Old-Fashioned Hate", glyph: "🐝")),
        .init(first: ["clemson"], second: ["south carolina"], rivalry: .init(name: "Palmetto Bowl", glyph: "🌴")),
        .init(first: ["louisville"], second: ["kentucky"], rivalry: .init(name: "Governor's Cup", glyph: "🥃")),
        .init(first: ["ole miss", "mississippi rebels"], second: ["mississippi state"], rivalry: .init(name: "Egg Bowl", glyph: "🥚")),
        .init(first: ["texas"], second: ["texas a&m", "texas am"], rivalry: .init(name: "Lone Star Showdown", glyph: "🤠")),
        .init(first: ["iowa"], second: ["nebraska"], rivalry: .init(name: "Heroes Game", glyph: "🌽")),
        .init(first: ["north carolina", "unc"], second: ["nc state", "north carolina state"], rivalry: .init(name: "Carolina Grudge", glyph: "🐏")),
        .init(first: ["virginia"], second: ["virginia tech"], rivalry: .init(name: "Commonwealth Cup", glyph: "⚔️")),
        .init(first: ["arizona"], second: ["arizona state"], rivalry: .init(name: "Territorial Cup", glyph: "🌵")),
        .init(first: ["tennessee"], second: ["vanderbilt"], rivalry: .init(name: "Tennessee Hate Week", glyph: "🎻")),
        .init(first: ["kansas"], second: ["kansas state"], rivalry: .init(name: "Sunflower Showdown", glyph: "🌻")),
        .init(first: ["washington"], second: ["washington state"], rivalry: .init(name: "Apple Cup", glyph: "🍎")),
        .init(first: ["oregon"], second: ["oregon state"], rivalry: .init(name: "Oregon Rivalry", glyph: "🦆")),
        .init(first: ["usc", "southern california"], second: ["ucla"], rivalry: .init(name: "Victory Bell", glyph: "🔔")),
        .init(first: ["notre dame"], second: ["usc", "southern california"], rivalry: .init(name: "Jeweled Shillelagh", glyph: "☘️"))
    ]

    static func match(away: String, home: String) -> RivalryMatchup? {
        let away = normalized(away)
        let home = normalized(home)
        return pairs.first { pair in
            (matches(away, aliases: pair.first) && matches(home, aliases: pair.second))
            || (matches(home, aliases: pair.first) && matches(away, aliases: pair.second))
        }?.rivalry
    }

    private static func matches(_ team: String, aliases: [String]) -> Bool {
        aliases.contains { team == $0 || team.hasSuffix(" \($0)") || team.hasPrefix("\($0) ") }
    }

    private static func normalized(_ value: String) -> String {
        value.lowercased()
            .replacingOccurrences(of: "&", with: "and")
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }
}

enum RivalryWeekCheevoPolicy {
    static func codes(cardCompleted: Bool, hitSeasons: Int, bestBetHitSeasons: Int) -> Set<String> {
        var codes: Set<String> = []
        if cardCompleted { codes.insert("hate_week_roll_call") }
        if hitSeasons >= 1 { codes.insert("rivalry_week") }
        if hitSeasons >= 2 { codes.insert("grudge_veteran") }
        if hitSeasons >= 3 && bestBetHitSeasons >= 1 { codes.insert("dynasty_of_spite") }
        return codes
    }
}

/// The vocabulary and visual grammar for one football desk. Keeping these
/// decisions together prevents a shared screen from quietly falling back to
/// college language when it is opened from an NFL league.
struct SportIdentity {
    let sportId: String

    init(_ sportId: String?) {
        let normalized = sportId?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "cfb"
        self.sportId = normalized.isEmpty ? "cfb" : normalized
    }

    var isNFL: Bool { sportId == "nfl" }
    var isFieldhouse: Bool { sportId == "cbb" }
    var accent: Color { isFieldhouse ? .orange : (isNFL ? .cyan : .yellow) }
    var secondaryAccent: Color { isFieldhouse ? .yellow : (isNFL ? .blue : .green) }
    var gameDay: String { isNFL ? "SUNDAY" : "SATURDAY" }
    var openingWeek: Int { isNFL ? 1 : (isFieldhouse ? 1 : 0) }

    var boardKicker: String { isFieldhouse ? "TIP-OFF RECEIPTS" : (isNFL ? "SUNDAY INTELLIGENCE" : "DECLASSIFIED") }
    var boardTitle: String { isFieldhouse ? "THE FLOOR\nBOARD" : (isNFL ? "THE SUNDAY BOARD" : "THE BOARD") }
    var boardDetail: String { isFieldhouse ? "TIP-OFF HIT. EVERY CARD IS NOW ON THE FLOOR." : (isNFL ? "KICKOFF HIT. EVERY PRO CARD IS NOW EVIDENCE." : "KICKOFF HIT. EVERY CARD IS NOW EVIDENCE.") }
    var standingsKicker: String { isFieldhouse ? "REGIONAL SEED LINE" : (isNFL ? "SUNDAY POWER INDEX" : "PERMANENT RECORD") }
    var standingsTitle: String { isFieldhouse ? "ROAD TO\nTHE MIDDLE" : (isNFL ? "THE LEAGUE\nTABLE" : "HALL OF\nRECKONING") }
    var standingsDetail: String { isFieldhouse ? "FOUR REGIONS. THIRTY-TWO BRASS POSITIONS." : (isNFL ? "18 WEEKS. NO COMMITTEE. JUST RECEIPTS." : "GLORY ABOVE. EXCUSES BELOW.") }
    var untestedCampaign: String { isFieldhouse ? "BEFORE TIP · YOUR SEED LINE IS UNTESTED" : (isNFL ? "PREGAME · WEEK 1 REPUTATION UNTESTED" : "PRESEASON · REPUTATION CURRENTLY UNTESTED") }
    var emptyCabinet: String { isFieldhouse ? "BEFORE TIP. THE FIELDHOUSE IS WATCHING." : (isNFL ? "PREGAME. THE SUNDAY DESK IS WATCHING." : "PRESEASON. THE CABINET IS JUDGING YOU.") }

    func divisionLabel(_ division: String?) -> String {
        let stored = division?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "north"
        switch sportId {
        case "nfl":
            switch stored {
            case "south": return "AFC WEST"
            case "east": return "NFC EAST"
            case "west": return "NFC WEST"
            default: return "AFC EAST"
            }
        case "cbb":
            switch stored {
            case "south": return "SOUTH"
            case "east": return "EAST"
            case "west": return "WEST"
            default: return "MIDWEST"
            }
        case "cfb":
            switch stored {
            case "south": return "BIG TEN"
            case "east": return "ACC"
            case "west": return "BIG 12"
            default: return "SEC"
            }
        default:
            return stored.uppercased()
        }
    }

    func cheevoTitle(code: String, fallback: String) -> String {
        guard isNFL else { return fallback }
        switch code {
        case "saturday_starter": return "Sunday Starter"
        case "perfect_saturday": return "Perfect Sunday"
        case "six_pack_saturday": return "Six-Pack Sunday"
        case "full_conference": return "Full Slate"
        default: return fallback
        }
    }

    func localizedCheevoCopy(_ text: String) -> String {
        if isFieldhouse {
            return text
                .replacingOccurrences(of: "football", with: "basketball")
                .replacingOccurrences(of: "Football", with: "Basketball")
                .replacingOccurrences(of: "kickoff", with: "tip-off")
                .replacingOccurrences(of: "Kickoff", with: "Tip-off")
                .replacingOccurrences(of: "conference", with: "region")
                .replacingOccurrences(of: "Conference", with: "Region")
                .replacingOccurrences(of: "campus", with: "court")
                .replacingOccurrences(of: "Sundays", with: "Saturdays")
                .replacingOccurrences(of: "Sunday", with: "Saturday")
        }
        guard isNFL else { return text }
        return text
            .replacingOccurrences(of: "Saturdays", with: "Sundays")
            .replacingOccurrences(of: "Saturday", with: "Sunday")
            .replacingOccurrences(of: "conference", with: "league")
            .replacingOccurrences(of: "Conference", with: "League")
            .replacingOccurrences(of: "campus", with: "stadium")
            .replacingOccurrences(of: "College", with: "Pro")
            .replacingOccurrences(of: "college", with: "pro")
    }
}
