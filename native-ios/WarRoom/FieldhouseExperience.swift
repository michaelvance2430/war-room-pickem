import SwiftUI
import Combine
import UserNotifications

struct FieldhouseCardReminder: Equatable {
    let identifier: String
    let fireAt: Date
}

enum FieldhouseCardReminderSchedule {
    static func oneHour(lockAt: Date, now: Date, leagueID: UUID, week: Int) -> FieldhouseCardReminder? {
        let fireAt = lockAt.addingTimeInterval(-60 * 60)
        guard fireAt > now else { return nil }
        return FieldhouseCardReminder(
            identifier: "fieldhouse.card-lock.1h.\(leagueID.uuidString).\(week)",
            fireAt: fireAt
        )
    }
}

enum FieldhouseNotificationScheduler {
    private static let center = UNUserNotificationCenter.current()

    static func cardPublished(leagueID: UUID, leagueName: String, week: Int, lockAt: Date, now: Date = Date()) async {
        let authorization = await center.notificationSettings().authorizationStatus
        guard authorization == .authorized || authorization == .provisional else { return }

        let builtID = "fieldhouse.card-built.\(leagueID.uuidString).\(week)"
        if !UserDefaults.standard.bool(forKey: builtID) {
            let content = notificationContent(
                title: "Week \(week) card built",
                body: "\(leagueName) is open. Make and lock your 10 picks before the first tip.",
                leagueID: leagueID,
                week: week,
                kind: "fieldhouse_card_built"
            )
            do {
                try await center.add(UNNotificationRequest(identifier: builtID, content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false)))
                UserDefaults.standard.set(true, forKey: builtID)
            } catch { }
        }

        if let reminder = FieldhouseCardReminderSchedule.oneHour(lockAt: lockAt, now: now, leagueID: leagueID, week: week) {
            center.removePendingNotificationRequests(withIdentifiers: [reminder.identifier])
            let content = notificationContent(
                title: "1 HOUR · WEEK \(week) LOCKS",
                body: "\(leagueName) closes at first tip. Finish and lock your card.",
                leagueID: leagueID,
                week: week,
                kind: "fieldhouse_card_lock_1h"
            )
            let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: reminder.fireAt)
            try? await center.add(UNNotificationRequest(identifier: reminder.identifier, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)))
        }
    }

    private static func notificationContent(title: String, body: String, leagueID: UUID, week: Int, kind: String) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.categoryIdentifier = "WAR_ROOM_SYSTEM"
        content.threadIdentifier = "league.\(leagueID.uuidString)"
        content.userInfo = [
            "kind": kind,
            "league_id": leagueID.uuidString.lowercased(),
            "destination": "picks",
            "week": week
        ]
        return content
    }
}

private enum FieldhousePreviewIdentity {
    static let leagueID = UUID(uuidString: "F13D0000-0000-4000-8000-000000000001")!
}

enum FieldhouseSeasonCalendar {
    static let eastern = TimeZone(identifier: "America/New_York")!
    static var openingTip: Date {
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = eastern
        components.year = 2026; components.month = 11; components.day = 2; components.hour = 0
        return components.date!
    }

    static func start(of window: Int) -> Date {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = eastern
        return calendar.date(byAdding: .day, value: max(0, window - 1) * 7, to: openingTip)!
    }

    static func fallbackLockDate(for window: Int) -> Date {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = eastern
        return calendar.date(byAdding: .hour, value: 19 + (3 * 24), to: start(of: window))!
    }

    static func lockDate(for window: Int, games: [FieldhouseGame]) -> Date {
        games.map { $0.tipDate(in: window) }.min() ?? fallbackLockDate(for: window)
    }

    static func lockClock(at now: Date, window: Int, games: [FieldhouseGame] = []) -> String {
        let deadline = lockDate(for: window, games: games)
        guard now < deadline else { return "WEEK \(window) PICKS LOCKED" }
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = eastern
        let parts = calendar.dateComponents([.day, .hour, .minute], from: now, to: deadline)
        return "WEEK \(window) PICKS LOCK IN \(max(0, parts.day ?? 0))D \(max(0, parts.hour ?? 0))H \(max(0, parts.minute ?? 0))M"
    }

    static func windowLabel(_ window: Int) -> String {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = eastern
        let start = start(of: window)
        let end = calendar.date(byAdding: .day, value: 6, to: start)!
        let formatter = DateFormatter(); formatter.timeZone = eastern; formatter.dateFormat = "MMM d"
        return "WEEK \(window) · \(formatter.string(from: start).uppercased())–\(formatter.string(from: end).uppercased())"
    }
}

enum WarRoomPostseasonStatus: Equatable {
    case championship(seed: Int)
    case activeNoBrass
    case toilet(seed: Int)
}

enum WarRoomPostseasonRule {
    static let leagueFieldSize = 16
    static let regionalFieldSize = 4

    static func status(rank: Int, playerCount: Int) -> WarRoomPostseasonStatus {
        let count = max(1, playerCount)
        let safeRank = min(max(1, rank), count)
        let field = min(regionalFieldSize, count / 2)
        if safeRank <= field { return .championship(seed: safeRank) }
        if safeRank > count - field { return .toilet(seed: safeRank - (count - field)) }
        return .activeNoBrass
    }

    static func counts(playerCount: Int) -> (championship: Int, activeNoBrass: Int, toilet: Int) {
        let count = max(0, playerCount)
        let field = min(leagueFieldSize, count / 2)
        return (field, count - (field * 2), field)
    }

    static func regionalCounts(playerCount: Int) -> (championship: Int, activeNoBrass: Int, toilet: Int) {
        let count = max(0, playerCount)
        let field = min(regionalFieldSize, count / 2)
        return (field, count - (field * 2), field)
    }
}

enum FieldhouseSeasonPhase: String {
    case preseason = "PRESEASON"
    case regularSeason = "REGULAR SEASON"
    case conferenceChampionships = "CONFERENCE CHAMPIONSHIPS"
    case postseason = "POSTSEASON"
}

enum FieldhouseLeague: String, CaseIterable, Identifiable {
    case ncaam = "NCAAM"
    case ncaaw = "NCAAW"
    var id: String { rawValue }
    var displayName: String { "THE FIELDHOUSE · \(rawValue)" }
    static let activeBuild: FieldhouseLeague = .ncaam
}

struct FieldhouseTrophyOption: Identifiable, Equatable {
    let id: String
    let name: String
    let detail: String
    let asset: String
}

enum FieldhouseTrophyCatalog {
    static let ncaam = [
        FieldhouseTrophyOption(id: "m-iron-rim", name: "The Iron Rim", detail: "Nobody came through the lane clean.", asset: "FieldhouseMTheIronRim"),
        FieldhouseTrophyOption(id: "m-net-cutter", name: "The Net Cutter", detail: "Bring your own ladder.", asset: "FieldhouseMTheNetCutter"),
        FieldhouseTrophyOption(id: "m-hardwood-crown", name: "The Hardwood Crown", detail: "The court belongs to one room.", asset: "FieldhouseMTheHardwoodCrown"),
        FieldhouseTrophyOption(id: "m-final-possession", name: "The Final Possession", detail: "The clock reached zero. You did not.", asset: "FieldhouseMTheFinalPossession"),
        FieldhouseTrophyOption(id: "m-glass-house", name: "The Glass House", detail: "Own the boards. Own the room.", asset: "FieldhouseMTheGlassHouse"),
        FieldhouseTrophyOption(id: "m-fieldhouse-cup", name: "The Fieldhouse Cup", detail: "Old building. Permanent address.", asset: "FieldhouseMTheFieldhouseCup")
    ]
    static let ncaaw = [
        FieldhouseTrophyOption(id: "w-pure-game", name: "The Pure Game", detail: "The version with footwork.", asset: "FieldhouseWThePureGame"),
        FieldhouseTrophyOption(id: "w-extra-pass", name: "The Extra Pass", detail: "Apparently all five players can touch the ball.", asset: "FieldhouseWTheExtraPass"),
        FieldhouseTrophyOption(id: "w-94-feet", name: "Ninety-Four Feet", detail: "Every possession. The entire floor.", asset: "FieldhouseWNinetyFourFeet"),
        FieldhouseTrophyOption(id: "w-nylon-standard", name: "The Nylon Standard", detail: "Backboard optional.", asset: "FieldhouseWTheNylonStandard"),
        FieldhouseTrophyOption(id: "w-forty-minutes", name: "Forty Minutes", detail: "No hero-ball exemption.", asset: "FieldhouseWFortyMinutes"),
        FieldhouseTrophyOption(id: "w-better-bracket", name: "The Better Bracket", detail: "We said what we said.", asset: "FieldhouseWTheBetterBracket")
    ]
    static func options(for league: FieldhouseLeague) -> [FieldhouseTrophyOption] { league == .ncaam ? ncaam : ncaaw }
}

enum FieldhouseLateEntryRule {
    static func entryScore(existingScores: [Int]) -> Int {
        guard !existingScores.isEmpty else { return 0 }
        let sampleCount = max(1, Int(ceil(Double(existingScores.count) * 0.15)))
        let bottom = existingScores.sorted().prefix(sampleCount)
        return Int((Double(bottom.reduce(0, +)) / Double(bottom.count)).rounded())
    }

    static func acceptsEntries(during phase: FieldhouseSeasonPhase) -> Bool { phase != .postseason }
}

enum FieldhouseRegion: String, CaseIterable, Identifiable {
    case east = "EAST"
    case west = "WEST"
    case south = "SOUTH"
    case midwest = "MIDWEST"
    var id: String { rawValue }
}

enum FieldhouseTeamCatalog {
    // Snapshot of ESPN's current Division I men's basketball directory (362 programs).
    static let all: [String] = raw.split(separator: "|").map(String.init)
    private static let raw = "Abilene Christian Wildcats|Air Force Falcons|Akron Zips|Alabama A&M Bulldogs|Alabama Crimson Tide|Alabama State Hornets|Alcorn State Braves|American University Eagles|App State Mountaineers|Arizona State Sun Devils|Arizona Wildcats|Arkansas Razorbacks|Arkansas State Red Wolves|Arkansas-Pine Bluff Golden Lions|Army Black Knights|Auburn Tigers|Austin Peay Governors|BYU Cougars|Ball State Cardinals|Baylor Bears|Bellarmine Knights|Belmont Bruins|Bethune-Cookman Wildcats|Binghamton Bearcats|Boise State Broncos|Boston College Eagles|Boston University Terriers|Bowling Green Falcons|Bradley Braves|Brown Bears|Bryant Bulldogs|Bucknell Bison|Buffalo Bulls|Butler Bulldogs|Cal Poly Mustangs|Cal State Bakersfield Roadrunners|Cal State Fullerton Titans|Cal State Northridge Matadors|California Baptist Lancers|California Golden Bears|Campbell Fighting Camels|Canisius Golden Griffins|Central Arkansas Bears|Central Connecticut Blue Devils|Central Michigan Chippewas|Charleston Cougars|Charleston Southern Buccaneers|Charlotte 49ers|Chattanooga Mocs|Chicago State Cougars|Cincinnati Bearcats|Clemson Tigers|Cleveland State Vikings|Coastal Carolina Chanticleers|Colgate Raiders|Colorado Buffaloes|Colorado State Rams|Columbia Lions|Coppin State Eagles|Cornell Big Red|Creighton Bluejays|Dartmouth Big Green|Davidson Wildcats|Dayton Flyers|DePaul Blue Demons|Delaware Blue Hens|Delaware State Hornets|Denver Pioneers|Detroit Mercy Titans|Drake Bulldogs|Drexel Dragons|Duke Blue Devils|Duquesne Dukes|East Carolina Pirates|East Tennessee State Buccaneers|East Texas A&M Lions|Eastern Illinois Panthers|Eastern Kentucky Colonels|Eastern Michigan Eagles|Eastern Washington Eagles|Elon Phoenix|Evansville Purple Aces|Fairfield Stags|Fairleigh Dickinson Knights|Florida A&M Rattlers|Florida Atlantic Owls|Florida Gators|Florida Gulf Coast Eagles|Florida International Panthers|Florida State Seminoles|Fordham Rams|Fresno State Bulldogs|Furman Paladins|Gardner-Webb Runnin' Bulldogs|George Mason Patriots|George Washington Revolutionaries|Georgetown Hoyas|Georgia Bulldogs|Georgia Southern Eagles|Georgia State Panthers|Georgia Tech Yellow Jackets|Gonzaga Bulldogs|Grambling Tigers|Grand Canyon Lopes|Green Bay Phoenix|Hampton Pirates|Harvard Crimson|Hawai'i Rainbow Warriors|High Point Panthers|Hofstra Pride|Holy Cross Crusaders|Houston Christian Huskies|Houston Cougars|Howard Bison|IU Indianapolis Jaguars|Idaho State Bengals|Idaho Vandals|Illinois Fighting Illini|Illinois State Redbirds|Incarnate Word Cardinals|Indiana Hoosiers|Indiana State Sycamores|Iona Gaels|Iowa Hawkeyes|Iowa State Cyclones|Jackson State Tigers|Jacksonville Dolphins|Jacksonville State Gamecocks|James Madison Dukes|Kansas City Roos|Kansas Jayhawks|Kansas State Wildcats|Kennesaw State Owls|Kent State Golden Flashes|Kentucky Wildcats|LSU New Orleans Privateers|LSU Tigers|La Salle Explorers|Lafayette Leopards|Lamar Cardinals|Le Moyne Dolphins|Lehigh Mountain Hawks|Liberty Flames|Lipscomb Bisons|Little Rock Trojans|Long Beach State Beach|Long Island University Sharks|Longwood Lancers|Louisiana Ragin' Cajuns|Louisiana Tech Bulldogs|Louisville Cardinals|Loyola Chicago Ramblers|Loyola Maryland Greyhounds|Loyola Marymount Lions|Maine Black Bears|Manhattan Jaspers|Marist Red Foxes|Marquette Golden Eagles|Marshall Thundering Herd|Maryland Eastern Shore Hawks|Maryland Terrapins|Massachusetts Minutemen|McNeese Cowboys|Memphis Tigers|Mercer Bears|Mercyhurst Lakers|Merrimack Warriors|Miami (OH) RedHawks|Miami Hurricanes|Michigan State Spartans|Michigan Wolverines|Middle Tennessee Blue Raiders|Milwaukee Panthers|Minnesota Golden Gophers|Mississippi State Bulldogs|Mississippi Valley State Delta Devils|Missouri State Bears|Missouri Tigers|Monmouth Hawks|Montana Grizzlies|Montana State Bobcats|Morehead State Eagles|Morgan State Bears|Mount St. Mary's Mountaineers|Murray State Racers|NC State Wolfpack|NJIT Highlanders|Navy Midshipmen|Nebraska Cornhuskers|Nevada Wolf Pack|New Hampshire Wildcats|New Haven Chargers|New Mexico Lobos|New Mexico State Aggies|Niagara Purple Eagles|Nicholls Colonels|Norfolk State Spartans|North Alabama Lions|North Carolina A&T Aggies|North Carolina Central Eagles|North Carolina Tar Heels|North Dakota Fighting Hawks|North Dakota State Bison|North Florida Ospreys|North Texas Mean Green|Northeastern Huskies|Northern Arizona Lumberjacks|Northern Colorado Bears|Northern Illinois Huskies|Northern Iowa Panthers|Northern Kentucky Norse|Northwestern State Demons|Northwestern Wildcats|Notre Dame Fighting Irish|Oakland Golden Grizzlies|Ohio Bobcats|Ohio State Buckeyes|Oklahoma Sooners|Oklahoma State Cowboys|Old Dominion Monarchs|Ole Miss Rebels|Omaha Mavericks|Oral Roberts Golden Eagles|Oregon Ducks|Oregon State Beavers|Pacific Tigers|Penn State Nittany Lions|Pennsylvania Quakers|Pepperdine Waves|Pittsburgh Panthers|Portland Pilots|Portland State Vikings|Prairie View A&M Panthers|Presbyterian Blue Hose|Princeton Tigers|Providence Friars|Purdue Boilermakers|Purdue Fort Wayne Mastodons|Quinnipiac Bobcats|Radford Highlanders|Rhode Island Rams|Rice Owls|Richmond Spiders|Rider Broncs|Robert Morris Colonials|Rutgers Scarlet Knights|SE Louisiana Lions|SIU Edwardsville Cougars|SMU Mustangs|Sacramento State Hornets|Sacred Heart Pioneers|Saint Joseph's Hawks|Saint Louis Billikens|Saint Mary's Gaels|Saint Peter's Peacocks|Sam Houston Bearkats|Samford Bulldogs|San Diego State Aztecs|San Diego Toreros|San Francisco Dons|San José State Spartans|Santa Clara Broncos|Seattle U Redhawks|Seton Hall Pirates|Siena Saints|South Alabama Jaguars|South Carolina Gamecocks|South Carolina State Bulldogs|South Carolina Upstate Spartans|South Dakota Coyotes|South Dakota State Jackrabbits|South Florida Bulls|Southeast Missouri State Redhawks|Southern Illinois Salukis|Southern Jaguars|Southern Miss Golden Eagles|Southern Utah Thunderbirds|St. Bonaventure Bonnies|St. John's Red Storm|St. Thomas Tommies|Stanford Cardinal|Stephen F. Austin Lumberjacks|Stetson Hatters|Stonehill Skyhawks|Stony Brook Seawolves|Syracuse Orange|TCU Horned Frogs|Tarleton State Texans|Temple Owls|Tennessee State Tigers|Tennessee Tech Golden Eagles|Tennessee Volunteers|Texas A&M Aggies|Texas A&M-Corpus Christi Islanders|Texas Longhorns|Texas Southern Tigers|Texas State Bobcats|Texas Tech Red Raiders|The Citadel Bulldogs|Toledo Rockets|Towson Tigers|Troy Trojans|Tulane Green Wave|Tulsa Golden Hurricane|UAB Blazers|UAlbany Great Danes|UC Davis Aggies|UC Irvine Anteaters|UC Riverside Highlanders|UC San Diego Tritons|UC Santa Barbara Gauchos|UCF Knights|UCLA Bruins|UConn Huskies|UIC Flames|UL Monroe Warhawks|UMBC Retrievers|UMass Lowell River Hawks|UNC Asheville Bulldogs|UNC Greensboro Spartans|UNC Wilmington Seahawks|UNLV Rebels|USC Trojans|UT Arlington Mavericks|UT Martin Skyhawks|UT Rio Grande Valley Vaqueros|UTEP Miners|UTSA Roadrunners|Utah State Aggies|Utah Tech Trailblazers|Utah Utes|Utah Valley Wolverines|VCU Rams|VMI Keydets|Valparaiso Beacons|Vanderbilt Commodores|Vermont Catamounts|Villanova Wildcats|Virginia Cavaliers|Virginia Tech Hokies|Wagner Seahawks|Wake Forest Demon Deacons|Washington Huskies|Washington State Cougars|Weber State Wildcats|West Florida Argonauts|West Georgia Wolves|West Virginia Mountaineers|Western Carolina Catamounts|Western Illinois Leathernecks|Western Kentucky Hilltoppers|Western Michigan Broncos|Wichita State Shockers|William & Mary Tribe|Winthrop Eagles|Wisconsin Badgers|Wofford Terriers|Wright State Raiders|Wyoming Cowboys|Xavier Musketeers|Yale Bulldogs|Youngstown State Penguins"
}

enum FieldhouseDesk: String, CaseIterable, Identifiable {
    case home = "Home"
    case picks = "Picks"
    case standings = "Standings"
    case locker = "Locker"
    case profile = "You"
    var id: String { rawValue }
    var icon: String {
        switch self {
        case .home: "house.fill"
        case .picks: "basketball.fill"
        case .standings: "list.number"
        case .locker: "bubble.left.and.bubble.right.fill"
        case .profile: "person.crop.circle.fill"
        }
    }
}

struct FieldhouseGame: Identifiable, Equatable {
    let id: String
    let away: String
    let home: String
    let spread: String
    let tip: String
    let dayOffset: Int
    let tipHour: Int
    let tipMinute: Int

    init(id: String, away: String, home: String, spread: String, tip: String, dayOffset: Int = 3, tipHour: Int = 19, tipMinute: Int = 0) {
        self.id = id
        self.away = away
        self.home = home
        self.spread = spread
        self.tip = tip
        self.dayOffset = dayOffset
        self.tipHour = tipHour
        self.tipMinute = tipMinute
    }

    func tipDate(in window: Int) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = FieldhouseSeasonCalendar.eastern
        let day = calendar.date(byAdding: .day, value: dayOffset, to: FieldhouseSeasonCalendar.start(of: window))!
        return calendar.date(bySettingHour: tipHour, minute: tipMinute, second: 0, of: day)!
    }

    var favoriteTeam: String? {
        let pieces = spread.split(separator: " ")
        guard pieces.count > 1, Double(pieces.last ?? "") != nil else { return nil }
        let favoriteLabel = pieces.dropLast().joined(separator: " ")
        if away.localizedCaseInsensitiveCompare(favoriteLabel) == .orderedSame || away.localizedCaseInsensitiveContains(favoriteLabel) { return away }
        if home.localizedCaseInsensitiveCompare(favoriteLabel) == .orderedSame || home.localizedCaseInsensitiveContains(favoriteLabel) { return home }
        return nil
    }

    var underdogTeam: String? {
        guard let favoriteTeam else { return nil }
        if favoriteTeam == away { return home }
        if favoriteTeam == home { return away }
        return nil
    }

    var favoriteSpread: Double? { Double(spread.split(separator: " ").last ?? "") }
}

enum FieldhousePickVisibility {
    static func canSeeRoomPicks(at now: Date, gameTip: Date) -> Bool { now >= gameTip }
}

enum FieldhouseGamePhase: Equatable {
    case scheduled
    case live(period: String)
    case final
}

struct FieldhouseGameResult: Equatable {
    let gameID: String
    let awayScore: Int
    let homeScore: Int
    let phase: FieldhouseGamePhase

    var isFinal: Bool { phase == .final }

    func straightUpWinner(in game: FieldhouseGame) -> String? {
        guard isFinal, awayScore != homeScore else { return nil }
        return awayScore > homeScore ? game.away : game.home
    }


    func coverWinner(in game: FieldhouseGame) -> String? {
        guard isFinal, let favorite = game.favoriteTeam, let line = game.favoriteSpread,
              let underdog = game.underdogTeam else { return nil }
        let favoriteScore = favorite == game.away ? awayScore : homeScore
        let underdogScore = underdog == game.away ? awayScore : homeScore
        let adjustedFavoriteScore = Double(favoriteScore) + line
        guard adjustedFavoriteScore != Double(underdogScore) else { return nil }
        return adjustedFavoriteScore > Double(underdogScore) ? favorite : underdog
    }
}

enum FieldhousePropEvaluator {
    static func answer(for prop: FieldhousePropKind, games: [FieldhouseGame], results: [String: FieldhouseGameResult]) -> Bool? {
        let completed = games.compactMap { game -> (FieldhouseGame, FieldhouseGameResult)? in
            guard let result = results[game.id], result.isFinal else { return nil }
            return (game, result)
        }
        guard completed.count == games.count, !games.isEmpty else { return nil }

        switch prop {
        case .teamScores90:
            return completed.contains { $0.1.awayScore >= 90 || $0.1.homeScore >= 90 }
        case .gameWithinThree:
            return completed.contains { abs($0.1.awayScore - $0.1.homeScore) <= 3 }
        case .underdogWins:
            return completed.contains { item in item.1.straightUpWinner(in: item.0) == item.0.underdogTeam }
        case .combinedScore150:
            return completed.contains { $0.1.awayScore + $0.1.homeScore >= 150 }
        case .teamScores100:
            return completed.contains { $0.1.awayScore >= 100 || $0.1.homeScore >= 100 }
        case .bothTeamsScore75:
            return completed.contains { $0.1.awayScore >= 75 && $0.1.homeScore >= 75 }
        case .winningMargin20:
            return completed.contains { abs($0.1.awayScore - $0.1.homeScore) >= 20 }
        case .threeUnderdogsWin:
            return completed.filter { item in item.1.straightUpWinner(in: item.0) == item.0.underdogTeam }.count >= 3
        case .sixFavoritesCover:
            return completed.filter { item in item.1.coverWinner(in: item.0) == item.0.favoriteTeam }.count >= 6
        case .everyGameReaches130:
            return completed.allSatisfy { $0.1.awayScore + $0.1.homeScore >= 130 }
        }
    }
}

enum FieldhouseScoreEngine {
    static func points(
        games: [FieldhouseGame],
        results: [String: FieldhouseGameResult],
        selections: [Int: String],
        confidences: [Int: Int],
        bestBetGame: Int?,
        prop: FieldhousePropKind?,
        propAnswer: String?
    ) -> Int {
        var total = 0
        for (index, game) in games.enumerated() {
            guard let result = results[game.id], let winner = result.coverWinner(in: game),
                  selections[index] == winner, let confidence = confidences[index] else { continue }
            total += confidence * (bestBetGame == index ? 2 : 1)
        }
        if let prop, let propAnswer,
           let correctAnswer = FieldhousePropEvaluator.answer(for: prop, games: games, results: results),
           propAnswer == (correctAnswer ? "YES" : "NO") {
            total += 3
        }
        return total
    }
}

enum FieldhouseGameCatalog {
    static let weeklyCardSize = 10
    static let windowOne = [
        FieldhouseGame(id: "gonzaga-duke", away: "Gonzaga Bulldogs", home: "Duke Blue Devils", spread: "Duke -3.5", tip: "THU · 7:00 PM", tipHour: 19),
        FieldhouseGame(id: "auburn-houston", away: "Auburn Tigers", home: "Houston Cougars", spread: "Houston -2.5", tip: "THU · 7:30 PM", tipHour: 19, tipMinute: 30),
        FieldhouseGame(id: "uconn-kansas", away: "UConn Huskies", home: "Kansas Jayhawks", spread: "Kansas -1.5", tip: "THU · 8:00 PM", tipHour: 20),
        FieldhouseGame(id: "iowa-state-tennessee", away: "Iowa State Cyclones", home: "Tennessee Volunteers", spread: "Tennessee -4.5", tip: "THU · 8:30 PM", tipHour: 20, tipMinute: 30),
        FieldhouseGame(id: "baylor-alabama", away: "Baylor Bears", home: "Alabama Crimson Tide", spread: "Alabama -5.5", tip: "THU · 9:00 PM", tipHour: 21),
        FieldhouseGame(id: "purdue-michigan-state", away: "Purdue Boilermakers", home: "Michigan State Spartans", spread: "Purdue -2.5", tip: "THU · 9:30 PM", tipHour: 21, tipMinute: 30),
        FieldhouseGame(id: "kentucky-north-carolina", away: "Kentucky Wildcats", home: "North Carolina Tar Heels", spread: "North Carolina -1.5", tip: "THU · 10:00 PM", tipHour: 22),
        FieldhouseGame(id: "arizona-illinois", away: "Arizona Wildcats", home: "Illinois Fighting Illini", spread: "Arizona -3.5", tip: "THU · 10:30 PM", tipHour: 22, tipMinute: 30),
        FieldhouseGame(id: "marquette-creighton", away: "Marquette Golden Eagles", home: "Creighton Bluejays", spread: "Creighton -1.5", tip: "SAT · 3:30 PM", dayOffset: 5, tipHour: 15, tipMinute: 30),
        FieldhouseGame(id: "ucla-oregon", away: "UCLA Bruins", home: "Oregon Ducks", spread: "UCLA -2.5", tip: "SAT · 6:00 PM", dayOffset: 5, tipHour: 18),
        FieldhouseGame(id: "texas-tech-baylor", away: "Texas Tech Red Raiders", home: "Baylor Bears", spread: "Baylor -3.5", tip: "SUN · 2:00 PM", dayOffset: 6, tipHour: 14),
        FieldhouseGame(id: "villanova-st-johns", away: "Villanova Wildcats", home: "St. John's Red Storm", spread: "St. John's -4.5", tip: "SUN · 5:00 PM", dayOffset: 6, tipHour: 17)
    ]
}

enum FieldhousePropKind: String, CaseIterable, Identifiable {
    case teamScores90
    case gameWithinThree
    case underdogWins
    case combinedScore150
    case teamScores100
    case bothTeamsScore75
    case winningMargin20
    case threeUnderdogsWin
    case sixFavoritesCover
    case everyGameReaches130

    var id: String { rawValue }
    var question: String {
        switch self {
        case .teamScores90: "Will any team score 90 or more points?"
        case .gameWithinThree: "Will any game finish within 3 points?"
        case .underdogWins: "Will any underdog win outright?"
        case .combinedScore150: "Will any game reach 150 combined points?"
        case .teamScores100: "Will any team score 100 or more points?"
        case .bothTeamsScore75: "Will both teams score 75 or more in any game?"
        case .winningMargin20: "Will any game finish with a 20-point margin?"
        case .threeUnderdogsWin: "Will at least three underdogs win outright?"
        case .sixFavoritesCover: "Will at least six favorites cover the spread?"
        case .everyGameReaches130: "Will every game reach 130 combined points?"
        }
    }
}

struct FieldhouseSeasonState {
    var league: FieldhouseLeague = .activeBuild
    var championshipTrophyID = FieldhouseTrophyCatalog.ncaam[0].id
    // Basketball is double-buffered: one week scores while the next accepts picks.
    var window = 2
    var scoringWindow = 1
    var scoringGames = Array(FieldhouseGameCatalog.windowOne.prefix(FieldhouseGameCatalog.weeklyCardSize))
    var scoringResults: [String: FieldhouseGameResult] = [
        "gonzaga-duke": FieldhouseGameResult(gameID: "gonzaga-duke", awayScore: 78, homeScore: 76, phase: .final),
        "auburn-houston": FieldhouseGameResult(gameID: "auburn-houston", awayScore: 71, homeScore: 74, phase: .final),
        "uconn-kansas": FieldhouseGameResult(gameID: "uconn-kansas", awayScore: 69, homeScore: 75, phase: .final),
        "iowa-state-tennessee": FieldhouseGameResult(gameID: "iowa-state-tennessee", awayScore: 80, homeScore: 78, phase: .final),
        "baylor-alabama": FieldhouseGameResult(gameID: "baylor-alabama", awayScore: 72, homeScore: 84, phase: .final),
        "purdue-michigan-state": FieldhouseGameResult(gameID: "purdue-michigan-state", awayScore: 77, homeScore: 74, phase: .final),
        "kentucky-north-carolina": FieldhouseGameResult(gameID: "kentucky-north-carolina", awayScore: 52, homeScore: 49, phase: .live(period: "2H · 11:42")),
        "arizona-illinois": FieldhouseGameResult(gameID: "arizona-illinois", awayScore: 41, homeScore: 44, phase: .live(period: "HALF")),
        "marquette-creighton": FieldhouseGameResult(gameID: "marquette-creighton", awayScore: 22, homeScore: 18, phase: .live(period: "1H · 7:08")),
        "ucla-oregon": FieldhouseGameResult(gameID: "ucla-oregon", awayScore: 8, homeScore: 12, phase: .live(period: "1H · 15:31"))
    ]
    var scoringSelections: [Int: String] = [
        0: "Gonzaga Bulldogs", 1: "Auburn Tigers", 2: "Kansas Jayhawks", 3: "Tennessee Volunteers",
        4: "Alabama Crimson Tide", 5: "Michigan State Spartans", 6: "Kentucky Wildcats",
        7: "Arizona Wildcats", 8: "Marquette Golden Eagles", 9: "UCLA Bruins"
    ]
    var scoringConfidences: [Int: Int] = Dictionary(uniqueKeysWithValues: (0..<FieldhouseGameCatalog.weeklyCardSize).map { ($0, FieldhouseGameCatalog.weeklyCardSize - $0) })
    var scoringBestBetGame: Int? = 0
    var scoringProp: FieldhousePropKind = .teamScores90
    var scoringPropAnswer = "YES"
    var lastCertifiedWindow: Int?
    var lastCertifiedPoints: Int?
    var phase: FieldhouseSeasonPhase = .regularSeason
    var seasonHasStarted = true
    var cardIsPublished = false
    var publishedGames: [FieldhouseGame] = []
    var publishedProp: FieldhousePropKind?
    var playerCount = 100
    var regionPlayerCount = 25
    var rank = 5
    var regularHellfiresUsed = 0
    var bracketHellfireUsed = false
    var bracketLocked = false
    var selectedRegion: FieldhouseRegion = .midwest
    var favoriteTeam: String?
    var crystalBallChampion: String?
    var sideSelections: [Int: String] = [:]
    var confidenceSelections: [Int: Int] = [:]
    var bestBetGame: Int?
    var propAnswer: String?
    var picksLocked = false
    var hellfireDeployedOnCurrentCard = false

    var regularHellfiresRemaining: Int { max(0, 2 - regularHellfiresUsed) }
    var scoringFinalGames: Int {
        scoringGames.filter { scoringResults[$0.id]?.isFinal == true }.count
    }
    var scoringLiveGames: Int {
        scoringGames.filter {
            guard let result = scoringResults[$0.id] else { return false }
            if case .live = result.phase { return true }
            return false
        }.count
    }
    var scoringPoints: Int {
        FieldhouseScoreEngine.points(
            games: scoringGames,
            results: scoringResults,
            selections: scoringSelections,
            confidences: scoringConfidences,
            bestBetGame: scoringBestBetGame,
            prop: scoringProp,
            propAnswer: scoringPropAnswer
        )
    }
    var scoringPropResult: Bool? {
        FieldhousePropEvaluator.answer(for: scoringProp, games: scoringGames, results: scoringResults)
    }
    var scoringIsComplete: Bool {
        !scoringGames.isEmpty && scoringFinalGames == scoringGames.count && scoringPropResult != nil
    }
    func scoringGamePoints(at index: Int) -> Int? {
        guard scoringGames.indices.contains(index),
              let result = scoringResults[scoringGames[index].id], result.isFinal,
              let winner = result.coverWinner(in: scoringGames[index]),
              let selection = scoringSelections[index], let confidence = scoringConfidences[index] else { return nil }
        guard selection == winner else { return 0 }
        return confidence * (scoringBestBetGame == index ? 2 : 1)
    }
    func roomPicksAreVisible(for gameID: String) -> Bool {
        guard let result = scoringResults[gameID] else { return false }
        switch result.phase {
        case .scheduled: return false
        case .live, .final: return true
        }
    }
    var canRebalanceRegions: Bool { !seasonHasStarted }
    var canSelectChampionshipTrophy: Bool { !seasonHasStarted }
    func hasOutstandingPickTask(at date: Date) -> Bool {
        cardIsPublished && !picksLocked && canEditPicks(at: date)
    }
    var postseasonStatus: WarRoomPostseasonStatus {
        WarRoomPostseasonRule.status(rank: rank, playerCount: regionPlayerCount)
    }
    var cardIsComplete: Bool {
        let count = FieldhouseGameCatalog.weeklyCardSize
        guard cardIsPublished, publishedGames.count == count, sideSelections.count == count,
              confidenceSelections.count == count, Set(confidenceSelections.values) == Set(1...count),
              bestBetGame != nil, propAnswer != nil else { return false }
        return (0..<count).allSatisfy { sideSelections[$0] != nil && confidenceSelections[$0] != nil }
    }

    var pickLockDate: Date { FieldhouseSeasonCalendar.lockDate(for: window, games: publishedGames) }

    func canEditPicks(at date: Date) -> Bool {
        cardIsPublished && date < pickLockDate
    }

    func pickWindowIsClosed(at date: Date) -> Bool {
        cardIsPublished && date >= pickLockDate
    }

    mutating func enforcePickDeadline(at date: Date) {
        if pickWindowIsClosed(at: date), cardIsComplete { picksLocked = true }
    }

    @discardableResult
    mutating func lockPicks(at date: Date) -> Bool {
        guard cardIsComplete, canEditPicks(at: date) else { return false }
        picksLocked = true
        return true
    }

    @discardableResult
    mutating func reopenPicks(at date: Date) -> Bool {
        guard picksLocked, !hellfireDeployedOnCurrentCard, canEditPicks(at: date) else { return false }
        picksLocked = false
        return true
    }

    @discardableResult
    mutating func deployRegularSeasonHellfire(at date: Date) -> Bool {
        guard regularHellfiresRemaining > 0, !picksLocked, canEditPicks(at: date),
              publishedGames.count == FieldhouseGameCatalog.weeklyCardSize,
              publishedGames.allSatisfy({ $0.favoriteTeam != nil }) else { return false }

        sideSelections = Dictionary(uniqueKeysWithValues: publishedGames.enumerated().map {
            ($0.offset, $0.element.favoriteTeam!)
        })
        confidenceSelections = Dictionary(uniqueKeysWithValues: publishedGames.indices.map {
            ($0, FieldhouseGameCatalog.weeklyCardSize - $0)
        })
        bestBetGame = 0
        propAnswer = "YES"
        regularHellfiresUsed += 1
        hellfireDeployedOnCurrentCard = true
        return true
    }

    @discardableResult
    mutating func advanceToNextWindow(at date: Date) -> Bool {
        guard scoringIsComplete, picksLocked, date >= pickLockDate,
              publishedGames.count == FieldhouseGameCatalog.weeklyCardSize,
              let publishedProp, let propAnswer else { return false }

        lastCertifiedWindow = scoringWindow
        lastCertifiedPoints = scoringPoints
        scoringWindow = window
        scoringGames = publishedGames
        scoringResults = Dictionary(uniqueKeysWithValues: publishedGames.map {
            ($0.id, FieldhouseGameResult(gameID: $0.id, awayScore: 0, homeScore: 0, phase: .scheduled))
        })
        scoringSelections = sideSelections
        scoringConfidences = confidenceSelections
        scoringBestBetGame = bestBetGame
        scoringProp = publishedProp
        scoringPropAnswer = propAnswer

        window += 1
        cardIsPublished = false
        publishedGames = []
        self.publishedProp = nil
        sideSelections = [:]
        confidenceSelections = [:]
        bestBetGame = nil
        self.propAnswer = nil
        picksLocked = false
        hellfireDeployedOnCurrentCard = false
        return true
    }

    func confidenceAvailable(_ value: Int, for game: Int) -> Bool {
        !confidenceSelections.contains { $0.key != game && $0.value == value }
    }

    mutating func toggleConfidence(_ value: Int, for game: Int) {
        guard confidenceSelections[game] == value || confidenceAvailable(value, for: game) else { return }
        confidenceSelections[game] = confidenceSelections[game] == value ? nil : value
    }

    mutating func selectLeague(_ newLeague: FieldhouseLeague) {
        league = newLeague
        championshipTrophyID = FieldhouseTrophyCatalog.options(for: newLeague)[0].id
    }

    @discardableResult
    mutating func selectChampionshipTrophy(_ trophyID: String) -> Bool {
        guard canSelectChampionshipTrophy,
              FieldhouseTrophyCatalog.options(for: league).contains(where: { $0.id == trophyID }) else { return false }
        championshipTrophyID = trophyID
        return true
    }

    @discardableResult
    mutating func publishCard(games: [FieldhouseGame], prop: FieldhousePropKind) -> Bool {
        let count = FieldhouseGameCatalog.weeklyCardSize
        guard games.count == count,
              Set(games.map(\.id)).count == count,
              games.allSatisfy({
                  (0...6).contains($0.dayOffset) &&
                  (0...23).contains($0.tipHour) &&
                  (0...59).contains($0.tipMinute) &&
                  $0.favoriteTeam != nil &&
                  ($0.favoriteSpread ?? 0) < 0
              }) else { return false }
        publishedGames = games
        publishedProp = prop
        cardIsPublished = true
        sideSelections = [:]
        confidenceSelections = [:]
        bestBetGame = nil
        propAnswer = nil
        picksLocked = false
        hellfireDeployedOnCurrentCard = false
        return true
    }
}

struct FieldhouseNativePreviewView: View {
    @State private var desk: FieldhouseDesk = .home
    @State private var state = FieldhouseSeasonState()
    @State private var strikePresentation: StrikePresentation?
    @State private var showingEntrance = true
    @State private var showingSetup = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            FieldhouseBackdrop().ignoresSafeArea()
            VStack(spacing: 0) {
                if desk != .home {
                    FieldhouseHeader(state: state, canGoBack: true) { desk = .home }
                }
                if desk == .locker {
                    FieldhouseLockerPage().padding(.horizontal, 14)
                } else if desk == .picks {
                    FieldhousePicksPage(state: $state, strikePresentation: $strikePresentation)
                } else {
                    ScrollView {
                        Group {
                            switch desk {
                            case .home: FieldhouseHomePage(state: $state, desk: $desk)
                            case .picks: EmptyView()
                            case .standings: FieldhouseStandingsPage(state: $state)
                            case .locker: EmptyView()
                            case .profile: FieldhouseProfilePage(state: $state)
                            }
                        }
                        .padding(14).padding(.bottom, 30)
                    }
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            TimelineView(.periodic(from: .now, by: 15)) { context in
                FieldhouseBottomNavigation(selection: $desk, hasOutstandingPickTask: state.hasOutstandingPickTask(at: context.date))
            }
        }
        .preferredColorScheme(.dark)
        .fullScreenCover(item: $strikePresentation) { presentation in
            WeaponStrikeVideoView(presentation: presentation) { strikePresentation = nil }
        }
        .fullScreenCover(isPresented: $showingEntrance) {
            FieldhouseEntranceView {
                showingEntrance = false
                showingSetup = state.favoriteTeam == nil || state.crystalBallChampion == nil
            }
        }
        .fullScreenCover(isPresented: $showingSetup) {
            FieldhouseSeasonSetupView(state: $state) { showingSetup = false }
        }
        .onAppear { refreshLifecycle(at: Date()) }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { refreshLifecycle(at: Date()) }
        }
    }

    private func refreshLifecycle(at date: Date) {
        state.enforcePickDeadline(at: date)
        _ = state.advanceToNextWindow(at: date)
    }
}

private struct FieldhouseSeasonSetupView: View {
    @Binding var state: FieldhouseSeasonState
    let finish: () -> Void
    @State private var step = 0
    @State private var pendingTeam: String?
    @State private var searchText = ""
    private var teams: [String] {
        searchText.isEmpty ? FieldhouseTeamCatalog.all : FieldhouseTeamCatalog.all.filter { $0.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        ZStack {
            FieldhouseBackdrop().ignoresSafeArea()
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    if pendingTeam != nil {
                        Button { pendingTeam = nil } label: {
                            Image(systemName: "chevron.left").font(.headline.weight(.black))
                                .frame(width: 40, height: 40).background(.white.opacity(0.10), in: Circle())
                        }.buttonStyle(.plain).accessibilityLabel("Back to team list")
                    }
                    Text(step == 0 ? "COURTSIDE IDENTITY" : "SEALED PROPHECY")
                        .font(.system(size: 10, weight: .black)).tracking(2).foregroundStyle(.orange)
                }
                Text(step == 0 ? "PICK YOUR\nFAVORITE TEAM" : "PICK YOUR\nCHAMPION")
                    .font(.system(size: 42, weight: .black)).fontWidth(.condensed)
                Text(step == 0 ? "This follows your profile across every Fieldhouse league. You can change your favorite team later from You." : "The Crystal Ball is mandatory. This championship call locks when you confirm it.")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
                if pendingTeam == nil {
                    TextField("Search all \(FieldhouseTeamCatalog.all.count) NCAAM Division I teams", text: $searchText)
                        .textInputAutocapitalization(.words).autocorrectionDisabled()
                        .padding(13).background(.white.opacity(0.09), in: RoundedRectangle(cornerRadius: 12))
                    ScrollView {
                        VStack(spacing: 8) {
                            ForEach(teams, id: \.self) { team in
                                Button { pendingTeam = team } label: {
                                    HStack { Image(systemName: "basketball.fill"); Text(team).font(.headline.weight(.black)); Spacer(); Image(systemName: "chevron.right") }
                                        .padding(15).foregroundStyle(.white).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                } else if let pendingTeam {
                    VStack(spacing: 14) {
                        Image(systemName: step == 0 ? "heart.fill" : "sparkles").font(.system(size: 54, weight: .black)).foregroundStyle(.orange)
                        Text(pendingTeam).font(.title2.weight(.black)).multilineTextAlignment(.center)
                        Button("CHANGE SELECTION") { self.pendingTeam = nil }
                            .font(.caption.weight(.black)).foregroundStyle(.orange)
                    }.frame(maxWidth: .infinity).padding(28).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 20))
                }
                Spacer()
                Button {
                    guard let pendingTeam else { return }
                    if step == 0 {
                        state.favoriteTeam = pendingTeam
                        self.pendingTeam = nil
                        searchText = ""
                        step = 1
                    } else {
                        state.crystalBallChampion = pendingTeam
                        finish()
                    }
                } label: {
                    Text(step == 0 ? "CONFIRM FAVORITE TEAM" : "CONFIRM CRYSTAL BALL")
                        .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(17)
                        .foregroundStyle(.black).background(pendingTeam == nil ? Color.gray : Color.orange, in: RoundedRectangle(cornerRadius: 16))
                }.buttonStyle(.plain).disabled(pendingTeam == nil)
            }.padding(22).padding(.top, 22)
        }.preferredColorScheme(.dark)
    }
}

private struct FieldhouseBackdrop: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.035, green: 0.018, blue: 0.008), Color(red: 0.15, green: 0.055, blue: 0.012), .black], startPoint: .topLeading, endPoint: .bottomTrailing)
            Canvas { context, size in
                let paint = Color.orange.opacity(0.075)
                for x in stride(from: 0.0, through: size.width, by: 34) {
                    context.fill(Path(CGRect(x: x, y: 0, width: 1, height: size.height)), with: .color(paint))
                }
                context.stroke(Path { path in
                    path.move(to: CGPoint(x: size.width / 2, y: 0)); path.addLine(to: CGPoint(x: size.width / 2, y: size.height))
                    path.addEllipse(in: CGRect(x: size.width / 2 - 92, y: size.height / 2 - 92, width: 184, height: 184))
                }, with: .color(Color.orange.opacity(0.15)), lineWidth: 2)
            }
        }
    }
}

private struct FieldhouseHeader: View {
    let state: FieldhouseSeasonState
    let canGoBack: Bool
    let back: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                if canGoBack {
                    Button(action: back) {
                        Image(systemName: "chevron.left").font(.headline.weight(.black))
                            .frame(width: 36, height: 36).background(.white.opacity(0.10), in: Circle())
                    }.buttonStyle(.plain).accessibilityLabel("Back to Fieldhouse home")
                }
                Label("COLLEGE BASKETBALL", systemImage: "basketball.fill").font(.system(size: 9, weight: .black)).tracking(1.8).foregroundStyle(.orange)
                Spacer(); Text("NATIVE FIELDHOUSE").font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(.white.opacity(0.42))
            }
            Text(state.league.displayName).font(.system(size: 29, weight: .black)).fontWidth(.condensed)
            Text("WINDOW \(state.window) · FOUR REGIONS · ONE ROAD TO THE MIDDLE").font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.55))
        }
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 13)
        .background(.black.opacity(0.78)).overlay(alignment: .bottom) { Rectangle().fill(LinearGradient(colors: [.clear, .orange, .clear], startPoint: .leading, endPoint: .trailing)).frame(height: 2) }
    }
}

private struct FieldhouseBottomNavigation: View {
    @Binding var selection: FieldhouseDesk
    let hasOutstandingPickTask: Bool
    var body: some View {
        HStack(spacing: 0) {
            ForEach(FieldhouseDesk.allCases) { desk in
                Button { selection = desk } label: {
                    VStack(spacing: 4) {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: desk.icon).font(.system(size: 21, weight: .bold))
                            if desk == .picks && hasOutstandingPickTask {
                                Text("1")
                                    .font(.system(size: 8, weight: .black))
                                    .foregroundStyle(.black)
                                    .frame(width: 16, height: 16)
                                    .background(Color.orange, in: Circle())
                                    .overlay(Circle().stroke(.black, lineWidth: 2))
                                    .offset(x: 10, y: -7)
                                    .accessibilityLabel("One pick task remaining")
                            }
                        }
                        Text(desk.rawValue).font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(selection == desk ? Color.orange : Color.white.opacity(0.78))
                    .frame(maxWidth: .infinity).frame(height: 58)
                    .background(selection == desk ? Color.white.opacity(0.10) : .clear, in: RoundedRectangle(cornerRadius: 18))
                }.buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.14)))
        .padding(.horizontal, 12).padding(.bottom, 4)
    }
}

private struct FieldhouseEntranceView: View {
    let enter: () -> Void
    var body: some View {
        ZStack {
            FieldhouseBackdrop().ignoresSafeArea()
            VStack(spacing: 18) {
                Spacer()
                Image(systemName: "basketball.fill")
                    .font(.system(size: 78, weight: .black)).foregroundStyle(.orange)
                    .shadow(color: .orange.opacity(0.75), radius: 28)
                Text("COURTSIDE PASS").font(.system(size: 12, weight: .black)).tracking(4).foregroundStyle(.orange)
                Text("THE\nFIELDHOUSE").font(.system(size: 58, weight: .black)).fontWidth(.condensed).multilineTextAlignment(.center)
                Text("NCAAM").font(.system(size: 12, weight: .black)).tracking(3).foregroundStyle(.orange)
                Text("FOUR REGIONS · ONE ROAD TO THE MIDDLE")
                    .font(.system(size: 10, weight: .black)).tracking(1.8).foregroundStyle(.white.opacity(0.58))
                Spacer()
                Button(action: enter) {
                    Label("TAKE THE FLOOR", systemImage: "arrow.right.circle.fill")
                        .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(17)
                        .foregroundStyle(.black).background(.orange, in: RoundedRectangle(cornerRadius: 16))
                }.buttonStyle(.plain)
                Text("DIVISION I MEN'S BASKETBALL · SIX TROPHIES · ONE FIELDHOUSE")
                    .font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(.white.opacity(0.42))
            }.padding(24).padding(.bottom, 18)
        }.preferredColorScheme(.dark)
    }
}

private struct FieldhouseHomePage: View {
    @Binding var state: FieldhouseSeasonState
    @Binding var desk: FieldhouseDesk
    @State private var showingLeagueSwitcher = false
    @State private var showingCardBuilder = false
    @State private var showingCommissionerCommand = false
    var body: some View {
        VStack(spacing: 13) {
            FieldhouseHomeMasthead(state: state)
            HStack(spacing: 10) {
                ShareLink(
                    item: URL(string: "https://app.war-room-picks.com/join/FH2026")!,
                    subject: Text("Join The Fieldhouse"),
                    message: Text("Join my Fieldhouse league in War Room Pick'Em. Invite code: FH2026")
                ) {
                    FieldhouseHomeButton(title: "SHARE · FH2026", icon: "square.and.arrow.up")
                }
                Button { showingLeagueSwitcher = true } label: {
                    FieldhouseHomeButton(title: "SWITCH LEAGUE", icon: "antenna.radiowaves.left.and.right")
                }.buttonStyle(.plain)
            }
            Button { showingCommissionerCommand = true } label: {
                FieldhouseAction(kicker: "COMMISSIONER COMMAND", title: "Manage your league", detail: "Cards, players, regions, and season controls.", icon: "person.3.fill")
            }.buttonStyle(.plain)
            Button { desk = .picks } label: {
                FieldhouseAction(
                    kicker: state.scoringIsComplete ? "FINAL HORN · WEEK \(state.scoringWindow)" : "ON THE FLOOR · WEEK \(state.scoringWindow)",
                    title: state.scoringIsComplete ? "\(state.scoringPoints) POINTS · CERTIFIED" : "\(state.scoringFinalGames) FINAL · \(state.scoringLiveGames) LIVE",
                    detail: state.scoringIsComplete ? "Your final receipt and prop result are ready." : "\(state.scoringPoints) points and moving. Tap to open the live board and your scorecard.",
                    icon: state.scoringIsComplete ? "checkmark.seal.fill" : "basketball.fill"
                )
            }.buttonStyle(.plain)
            if let certifiedWindow = state.lastCertifiedWindow, let certifiedPoints = state.lastCertifiedPoints {
                FieldhouseAction(kicker: "LAST CERTIFIED SCORECARD", title: "Week \(certifiedWindow) · \(certifiedPoints) points", detail: "Permanent weekly receipt.", icon: "clipboard.fill")
            }
            HStack(spacing: 10) {
                FieldhouseMetric(value: "#\(state.rank)", label: "YOUR SEED LINE")
                FieldhouseMetric(value: "\(state.regularHellfiresRemaining)/2", label: "HELLFIRES READY")
            }
            postseasonCard
            Button {
                if state.cardIsPublished { desk = .picks }
                else { showingCardBuilder = true }
            } label: {
                FieldhouseAction(
                    kicker: state.cardIsPublished ? "ON DECK · WEEK \(state.window) · PICKS OPEN" : "ON DECK · WEEK \(state.window)",
                    title: state.cardIsPublished ? "Make Your 10 Picks" : "Build Next Week's Card",
                    detail: state.cardIsPublished ? "Ten shared games. One card. Locks at the first selected tip." : "Choose the ten-game board while Week \(state.scoringWindow) keeps scoring.",
                    icon: state.cardIsPublished ? "arrow.right.circle.fill" : "hammer.fill"
                )
            }.buttonStyle(.plain)
            Button { desk = .standings } label: { FieldhouseAction(kicker: "REGIONAL WAR MAP", title: "Battle Toward the Middle", detail: "East, West, South, and Midwest each send survivors inward.", icon: "square.grid.2x2.fill") }.buttonStyle(.plain)
        }
        .sheet(isPresented: $showingLeagueSwitcher) {
            FieldhouseLeagueSwitcher(league: Binding(get: { state.league }, set: { state.selectLeague($0) }), dismiss: { showingLeagueSwitcher = false })
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showingCardBuilder) {
            FieldhouseCardBuilder(window: state.window) { games, prop in
                if state.publishCard(games: games, prop: prop) {
                    showingCardBuilder = false
                    scheduleCardNotifications()
                }
            }
        }
        .sheet(isPresented: $showingCommissionerCommand) {
            FieldhouseCommissionerCommand(state: $state)
        }
    }

    private func scheduleCardNotifications() {
        let week = state.window
        let lockAt = state.pickLockDate
        let leagueName = state.league.displayName
        Task {
            await FieldhouseNotificationScheduler.cardPublished(
                leagueID: FieldhousePreviewIdentity.leagueID,
                leagueName: leagueName,
                week: week,
                lockAt: lockAt
            )
        }
    }

    private var postseasonCard: some View {
        let counts = WarRoomPostseasonRule.counts(playerCount: state.playerCount)
        return VStack(alignment: .leading, spacing: 8) {
            Text("THE REGIONAL CUT · 4 REGIONS OF 25").font(.caption2.weight(.black)).tracking(1.7).foregroundStyle(.orange)
            HStack { cut("TOP", counts.championship, "CHAMPIONSHIP", .yellow); cut("MIDDLE", counts.activeNoBrass, "PICKS · NO BRASS", .white); cut("BOTTOM", counts.toilet, "TOILET BOWL", .purple) }
            Text("Each region sends its top 4 to the Championship and bottom 4 to the Toilet Bowl. Everyone else keeps picking without brass eligibility.").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
        }.padding(16).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.orange.opacity(0.38)))
    }
    private func cut(_ label: String, _ value: Int, _ note: String, _ color: Color) -> some View { VStack(spacing: 3) { Text("\(value)").font(.title2.weight(.black)).foregroundStyle(color); Text(label).font(.system(size: 7, weight: .black)); Text(note).font(.system(size: 6, weight: .black)).foregroundStyle(.white.opacity(0.42)) }.frame(maxWidth: .infinity) }
}

private struct FieldhouseCommissionerCommand: View {
    @Binding var state: FieldhouseSeasonState
    @Environment(\.dismiss) private var dismiss
    @State private var showingCardBuilder = false
    private let demoScores = [87, 82, 79, 76, 74, 72, 69, 66, 63, 61, 58, 55, 53, 49, 45, 42, 39, 35, 31, 28, 24, 19, 16, 12, 8]
    var body: some View {
        NavigationStack {
            ZStack {
                FieldhouseBackdrop().ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 12) {
                        FieldhouseHero(kicker: "COMMISSIONER CONTROL", title: "LEAGUE OPERATIONS", detail: "Players, regions, card state, and season rules from one place.", icon: "person.3.fill")
                        Button {
                            if !state.cardIsPublished { showingCardBuilder = true }
                        } label: {
                            commandRow(
                                "WEEK \(state.window) · ON DECK",
                                detail: state.cardIsPublished ? "Ten games and prop published" : "Choose ten games and an automatic floor prop",
                                icon: "list.bullet.clipboard.fill",
                                status: state.cardIsPublished ? "PICKS OPEN" : "BUILD CARD",
                                color: state.cardIsPublished ? .green : .yellow
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(state.cardIsPublished)
                        commandRow("PLAYERS", detail: "25 active · late entry seed \(FieldhouseLateEntryRule.entryScore(existingScores: demoScores)) points", icon: "person.2.fill", status: FieldhouseLateEntryRule.acceptsEntries(during: state.phase) ? "OPEN" : "CLOSED", color: .green)
                        commandRow("WEEK \(state.scoringWindow) · ON THE FLOOR", detail: "\(state.scoringFinalGames) final · \(state.scoringLiveGames) live", icon: "basketball.fill", status: "SCORING", color: .green)
                        commandRow("REGION ASSIGNMENTS", detail: "East · West · South · Midwest", icon: "square.grid.2x2.fill", status: state.canRebalanceRegions ? "EDIT" : "LOCKED", color: state.canRebalanceRegions ? .orange : .red)
                        commandRow("SEASON PHASE", detail: "Transitions control entry eligibility and regional seeding", icon: "calendar.badge.clock", status: state.phase.rawValue, color: .orange)
                        VStack(alignment: .leading, spacing: 7) {
                            Text("HARD RULES").font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(.orange)
                            Label("Region rebalancing locks when the season begins.", systemImage: "lock.fill")
                            Label("Late entries receive the rounded average of the bottom 15%.", systemImage: "person.badge.plus")
                            Label("New entries close when postseason begins.", systemImage: "calendar.badge.exclamationmark")
                        }.font(.caption.weight(.semibold)).frame(maxWidth: .infinity, alignment: .leading).padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.orange.opacity(0.28)))
                        trophySelector
                    }.padding(14).padding(.bottom, 28)
                }
            }.navigationTitle("Commissioner Command").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .topBarLeading) { Button("DONE") { dismiss() }.font(.caption.weight(.black)) } }
                .sheet(isPresented: $showingCardBuilder) {
                    FieldhouseCardBuilder(window: state.window) { games, prop in
                        if state.publishCard(games: games, prop: prop) {
                            showingCardBuilder = false
                            scheduleCardNotifications()
                        }
                    }
                }
        }.preferredColorScheme(.dark)
    }

    private func scheduleCardNotifications() {
        let week = state.window
        let lockAt = state.pickLockDate
        let leagueName = state.league.displayName
        Task {
            await FieldhouseNotificationScheduler.cardPublished(
                leagueID: FieldhousePreviewIdentity.leagueID,
                leagueName: leagueName,
                week: week,
                lockAt: lockAt
            )
        }
    }

    private func commandRow(_ title: String, detail: String, icon: String, status: String, color: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.title3.weight(.black)).foregroundStyle(.orange).frame(width: 42, height: 42).background(.orange.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 4) { Text(title).font(.headline.weight(.black)); Text(detail).font(.caption).foregroundStyle(.white.opacity(0.52)) }
            Spacer(); Text(status).font(.system(size: 8, weight: .black)).tracking(0.8).foregroundStyle(color).padding(.horizontal, 9).padding(.vertical, 6).background(color.opacity(0.12), in: Capsule())
        }.padding(14).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.orange.opacity(0.22)))
    }

    private var trophySelector: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("\(state.league.rawValue) · CHAMPIONSHIP TROPHY").font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(.orange)
                Spacer()
                Label(state.canSelectChampionshipTrophy ? "SELECT" : "LOCKED", systemImage: state.canSelectChampionshipTrophy ? "hand.tap.fill" : "lock.fill")
                    .font(.system(size: 8, weight: .black)).foregroundStyle(state.canSelectChampionshipTrophy ? .orange : .red)
            }
            Text(state.canSelectChampionshipTrophy ? "Choose the league hardware before the season's first tip." : "The season has tipped. Championship hardware is permanently locked.")
                .font(.caption).foregroundStyle(.white.opacity(0.52))
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(FieldhouseTrophyCatalog.options(for: state.league)) { trophy in
                    let selected = state.championshipTrophyID == trophy.id
                    Button { _ = state.selectChampionshipTrophy(trophy.id) } label: {
                        VStack(spacing: 7) {
                            Image(trophy.asset).resizable().scaledToFit().frame(height: 112)
                            Text(trophy.name.uppercased()).font(.system(size: 9, weight: .black)).multilineTextAlignment(.center)
                            Text(trophy.detail).font(.system(size: 8, weight: .semibold)).foregroundStyle(.white.opacity(0.55)).multilineTextAlignment(.center).lineLimit(2)
                        }
                        .frame(maxWidth: .infinity).padding(10)
                        .background(selected ? .orange.opacity(0.16) : .black.opacity(0.74), in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? .orange : .white.opacity(0.10), lineWidth: selected ? 2 : 1))
                    }.buttonStyle(.plain).disabled(!state.canSelectChampionshipTrophy)
                }
            }
        }
        .padding(14).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(.orange.opacity(0.28)))
    }
}

private struct FieldhouseCardBuilder: View {
    let window: Int
    let publish: ([FieldhouseGame], FieldhousePropKind) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var oddsLoaded = false
    @State private var selectedIDs: Set<String> = []
    @State private var selectedProp: FieldhousePropKind?
    private var selectedGames: [FieldhouseGame] { FieldhouseGameCatalog.windowOne.filter { selectedIDs.contains($0.id) } }
    private let cardSize = FieldhouseGameCatalog.weeklyCardSize
    private var ready: Bool { selectedGames.count == cardSize && selectedProp != nil }
    var body: some View {
        NavigationStack {
            ZStack {
                FieldhouseBackdrop().ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("WINDOW \(window) · COMMISSIONER").font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(.orange)
                        Text("BUILD THE CARD").font(.system(size: 36, weight: .black)).fontWidth(.condensed)
                        Text("Pull the Division I board for this Monday–Sunday window, select exactly ten games, confirm the spreads, then choose an automatically scored three-point floor prop.")
                            .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
                        Button {
                            oddsLoaded = true
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: oddsLoaded ? "checkmark.circle.fill" : "arrow.down.circle.fill")
                                    .font(.title2.weight(.black))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(oddsLoaded ? "ODDS LOADED" : "PULL NCAAM ODDS").font(.headline.weight(.black))
                                    Text(oddsLoaded ? "\(FieldhouseGameCatalog.windowOne.count) eligible games · Monday–Sunday" : "Load eligible Division I games and current spreads")
                                        .font(.caption.weight(.bold)).opacity(0.72)
                                }
                                Spacer()
                                if oddsLoaded { Text("READY").font(.caption2.weight(.black)) }
                            }
                            .frame(maxWidth: .infinity).padding(16)
                            .foregroundStyle(oddsLoaded ? Color.green : Color.black)
                            .background(oddsLoaded ? Color.green.opacity(0.12) : Color.orange, in: RoundedRectangle(cornerRadius: 15))
                            .overlay(RoundedRectangle(cornerRadius: 15).stroke(oddsLoaded ? Color.green.opacity(0.55) : Color.orange))
                        }
                        .buttonStyle(.plain)
                        .disabled(oddsLoaded)

                        if oddsLoaded {
                            ForEach(FieldhouseGameCatalog.windowOne) { game in
                                let selected = selectedIDs.contains(game.id)
                                Button {
                                    if selected { selectedIDs.remove(game.id) }
                                    else if selectedIDs.count < cardSize { selectedIDs.insert(game.id) }
                                } label: {
                                    HStack(spacing: 11) {
                                        Image(systemName: selected ? "checkmark.circle.fill" : "circle").font(.title3).foregroundStyle(selected ? .orange : .white.opacity(0.38))
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text("\(game.away) at \(game.home)").font(.subheadline.weight(.black)).multilineTextAlignment(.leading)
                                            Text("\(game.spread) · \(game.tip)").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.48))
                                        }
                                        Spacer()
                                    }
                                }.buttonStyle(.plain)
                                .disabled(!selected && selectedIDs.count == cardSize)
                                .padding(13).background(selected ? .orange.opacity(0.14) : .black.opacity(0.70), in: RoundedRectangle(cornerRadius: 13)).overlay(RoundedRectangle(cornerRadius: 13).stroke(selected ? .orange : .white.opacity(0.10)))
                            }
                            VStack(alignment: .leading, spacing: 7) {
                                Text("WEEKLY PROP · 3 POINTS · AUTO-SCORED").font(.caption2.weight(.black)).tracking(1.3).foregroundStyle(.orange)
                                Menu {
                                    ForEach(FieldhousePropKind.allCases) { prop in
                                        Button(prop.question) { selectedProp = prop }
                                    }
                                } label: {
                                    HStack(spacing: 10) {
                                        Image(systemName: selectedProp == nil ? "chevron.down.circle" : "checkmark.circle.fill")
                                            .foregroundStyle(selectedProp == nil ? .orange : .green)
                                        Text(selectedProp?.question ?? "CHOOSE AN AUTO-SCORED PROP")
                                            .font(.subheadline.weight(.bold)).multilineTextAlignment(.leading)
                                        Spacer()
                                        Image(systemName: "chevron.up.chevron.down").foregroundStyle(.orange)
                                    }
                                    .padding(14).background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 11))
                                }
                                .buttonStyle(.plain)
                                Text("\(FieldhousePropKind.allCases.count) verified score-and-spread rules available. No manual grading.")
                                    .font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.45))
                            }
                            Button { if let selectedProp { publish(selectedGames, selectedProp) } } label: {
                                Text("PUBLISH WINDOW \(window)").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16)
                                    .foregroundStyle(.black).background(ready ? Color.orange : Color.gray, in: RoundedRectangle(cornerRadius: 15))
                            }.buttonStyle(.plain).disabled(!ready)
                        }
                    }.padding().padding(.bottom, 24)
                }
                .safeAreaInset(edge: .top, spacing: 0) {
                    if oddsLoaded { cardSelectionProgress }
                }
            }.navigationTitle("Commissioner Command").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("CANCEL") { dismiss() }.font(.caption.weight(.black)) } }
        }.preferredColorScheme(.dark)
    }

    private var cardSelectionProgress: some View {
        HStack {
            Label("\(selectedGames.count)/\(cardSize) GAMES SELECTED", systemImage: "list.bullet.clipboard.fill")
                .font(.caption.weight(.black))
            Spacer()
            Text("\(max(0, cardSize - selectedGames.count)) REMAINING")
                .font(.caption.weight(.black))
                .foregroundStyle(selectedGames.count == cardSize ? .green : .orange)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(.black.opacity(0.97))
        .overlay(alignment: .bottom) { Rectangle().fill(.orange.opacity(0.55)).frame(height: 1) }
    }
}

private struct FieldhouseHomeMasthead: View {
    let state: FieldhouseSeasonState
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("FIELDHOUSE // LIVE", systemImage: "circle.fill")
                    .font(.system(size: 10, weight: .black)).tracking(1.8).foregroundStyle(.orange)
                Spacer()
                Text("COMMAND").font(.caption.weight(.black)).tracking(1.2)
                    .foregroundStyle(.black).padding(.horizontal, 16).padding(.vertical, 9).background(.yellow, in: Capsule())
            }
            HStack(spacing: 14) {
                Image(systemName: "basketball.fill").font(.system(size: 38, weight: .black)).foregroundStyle(.black)
                    .frame(width: 68, height: 68).background(.orange, in: RoundedRectangle(cornerRadius: 17))
                VStack(alignment: .leading, spacing: 4) {
                    Text(state.league.displayName).font(.system(size: 28, weight: .black)).fontWidth(.condensed)
                    Text("\(state.league.rawValue) · \(FieldhouseSeasonCalendar.windowLabel(state.window)) · \(state.phase.rawValue)")
                        .font(.system(size: 9, weight: .black)).tracking(1.2).foregroundStyle(.white.opacity(0.55))
                }
            }
            Divider().overlay(.orange.opacity(0.45))
            TimelineView(.periodic(from: .now, by: 60)) { context in
                HStack {
                    Label("SHOT CLOCK", systemImage: "timer").font(.caption2.weight(.black)).tracking(1.3)
                    Spacer()
                    Text(FieldhouseSeasonCalendar.lockClock(at: context.date, window: state.window, games: state.publishedGames)).font(.caption.weight(.black))
                }.foregroundStyle(.orange)
            }
        }
        .padding(18)
        .background(LinearGradient(colors: [.orange.opacity(0.25), .black.opacity(0.86)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(.orange.opacity(0.58), lineWidth: 1.5))
    }
}

private struct FieldhouseHomeButton: View {
    let title: String
    let icon: String
    var body: some View {
        Label(title, systemImage: icon).font(.system(size: 10, weight: .black)).tracking(0.6)
            .foregroundStyle(.orange).frame(maxWidth: .infinity).padding(.vertical, 17)
            .background(.black.opacity(0.80), in: RoundedRectangle(cornerRadius: 15))
            .overlay(RoundedRectangle(cornerRadius: 15).stroke(.orange.opacity(0.34)))
    }
}

private struct FieldhouseLeagueSwitcher: View {
    @Binding var league: FieldhouseLeague
    let dismiss: () -> Void
    var body: some View {
        NavigationStack {
            VStack(spacing: 10) {
                ForEach([("CFB", "football.fill", "Saturday Situation Room"), ("NFL", "football.fill", "Sunday War Room")], id: \.0) { sport, icon, title in
                    Button(action: dismiss) {
                        HStack {
                            Image(systemName: icon).foregroundStyle(.green).frame(width: 30)
                            VStack(alignment: .leading) { Text(sport).font(.caption.weight(.black)); Text(title).font(.headline.weight(.black)) }
                            Spacer(); Image(systemName: "chevron.right")
                        }.padding(14).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
                    }.buttonStyle(.plain)
                }
                ForEach([FieldhouseLeague.activeBuild]) { option in
                    Button { league = option; dismiss() } label: {
                        HStack {
                            Image(systemName: "basketball.fill").foregroundStyle(.orange).frame(width: 30)
                            VStack(alignment: .leading) { Text(option.rawValue).font(.caption.weight(.black)); Text(option.displayName).font(.headline.weight(.black)) }
                            Spacer(); Image(systemName: league == option ? "checkmark.circle.fill" : "chevron.right")
                        }.padding(14).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
                    }.buttonStyle(.plain)
                }
                Spacer()
            }.padding().navigationTitle("Switch League").navigationBarTitleDisplayMode(.inline)
        }.preferredColorScheme(.dark)
    }
}

private enum FieldhousePicksLane: String {
    case liveBoard
    case makePicks
}

private struct FieldhousePicksPage: View {
    @Binding var state: FieldhouseSeasonState
    @Binding var strikePresentation: StrikePresentation?
    @State private var confirmingLock = false
    @State private var confirmingHellfire = false
    @State private var lane: FieldhousePicksLane = .liveBoard
    @State private var now = Date()
    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 7) {
                laneSelector
                if lane == .makePicks && state.cardIsPublished && !state.picksLocked && !state.pickWindowIsClosed(at: now) {
                    pickProgressHeader
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(.black.opacity(0.97))
            .overlay(alignment: .bottom) { Rectangle().fill(.orange.opacity(0.28)).frame(height: 1) }
            .zIndex(2)

            ScrollView {
                VStack(spacing: 12) {
                    if lane == .liveBoard {
                        liveBoard
                    } else if state.picksLocked {
                        lockedUpcomingBoard
                    } else if state.pickWindowIsClosed(at: now) {
                        expiredUpcomingBoard
                    } else if !state.cardIsPublished || state.publishedGames.count != FieldhouseGameCatalog.weeklyCardSize {
                        FieldhouseHero(kicker: "WEEK \(state.window) · ON DECK", title: "CARD NOT POSTED YET", detail: "Week \(state.scoringWindow) remains on the floor while the commissioner builds the next ten-game card.", icon: "hourglass")
                    } else {
                        makePicksContent
                    }
                }
                .padding(.horizontal, 14).padding(.top, 8).padding(.bottom, 30)
            }
        }
        .alert("Lock these picks?", isPresented: $confirmingLock) {
            Button("NOT YET", role: .cancel) {}
            Button("LOCK PICKS") { _ = state.lockPicks(at: Date()) }
        } message: {
            Text("Your card is complete. You can reopen and change it only before the first tip.")
        }
        .alert("Deploy Hellfire?", isPresented: $confirmingHellfire) {
            Button("CANCEL", role: .cancel) {}
            Button("DEPLOY HELLFIRE", role: .destructive) { deployHellfire() }
        } message: {
            Text("This cannot be undone. One of your two regular-season Hellfires will be permanently spent. Hellfire fills all ten favorites, confidence points, Best Bet, and the prop. You may still adjust those picks before the first tip, but the Hellfire will not be returned.")
        }
        .onReceive(Timer.publish(every: 15, on: .main, in: .common).autoconnect()) { date in
            now = date
            state.enforcePickDeadline(at: date)
            _ = state.advanceToNextWindow(at: date)
        }
    }

    private var makePicksContent: some View {
        VStack(spacing: 12) {
            FieldhouseHero(kicker: "ON DECK · WEEK \(state.window)", title: "TEN GAMES.\nNO EMPTY POSSESSIONS.", detail: "Pick the spread, assign confidence 1–10, mark one Best Bet, and answer the floor prop.", icon: "list.number")
                Button { confirmingHellfire = true } label: {
                    FieldhouseAction(kicker: "HELLFIRE · \(state.regularHellfiresRemaining)/2 AVAILABLE", title: state.regularHellfiresRemaining == 0 ? "Hellfires Expended" : "Deploy Hellfire", detail: "Always visible before the first game. Uses one authorization and fills the card.", icon: "scope")
                }.buttonStyle(.plain).disabled(state.regularHellfiresRemaining == 0 || state.picksLocked || !state.canEditPicks(at: now)).opacity(state.regularHellfiresRemaining == 0 || state.picksLocked || !state.canEditPicks(at: now) ? 0.45 : 1)
                ForEach(Array(state.publishedGames.enumerated()), id: \.element.id) { index, game in
                    gameCard(index: index, game: game)
                }
                VStack(alignment: .leading, spacing: 9) {
                    Text("FLOOR PROP · 3 POINTS").font(.caption2.weight(.black)).tracking(1.4).foregroundStyle(.orange)
                    Text(state.publishedProp?.question ?? "PROP NOT PUBLISHED").font(.headline.weight(.black))
                    HStack(spacing: 9) { propButton("YES"); propButton("NO") }
                }.padding(15).background(.black.opacity(0.74), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.orange.opacity(0.28)))
                if state.picksLocked {
                    VStack(spacing: 9) {
                        Label("WINDOW \(state.window) PICKS LOCKED", systemImage: "lock.fill").font(.headline.weight(.black)).foregroundStyle(.green)
                        Button("REOPEN PICKS BEFORE FIRST TIP") { _ = state.reopenPicks(at: Date()) }
                            .font(.caption.weight(.black)).foregroundStyle(.orange)
                    }.frame(maxWidth: .infinity).padding(16).background(.black.opacity(0.80), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.green.opacity(0.45)))
                } else {
                    Button { confirmingLock = true } label: {
                        Label("LOCK WINDOW \(state.window) PICKS", systemImage: "lock.fill").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(17)
                            .foregroundStyle(.black).background(state.cardIsComplete ? Color.orange : Color.gray, in: RoundedRectangle(cornerRadius: 15))
                    }.buttonStyle(.plain).disabled(!state.cardIsComplete)
                    if !state.cardIsComplete {
                        Text("Pick all ten games, use confidence 1–10 once each, mark one Best Bet, and answer the prop.")
                            .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.52)).multilineTextAlignment(.center)
                    }
                }
        }
    }

    private var pickProgressHeader: some View {
        let made = state.sideSelections.count
        let remaining = max(0, FieldhouseGameCatalog.weeklyCardSize - made)
        let confidenceReady = state.confidenceSelections.count == FieldhouseGameCatalog.weeklyCardSize
        return VStack(spacing: 7) {
            HStack {
                Text("\(made)/\(FieldhouseGameCatalog.weeklyCardSize) PICKS MADE").font(.caption.weight(.black))
                Spacer()
                Text("\(remaining) REMAINING").font(.caption.weight(.black)).foregroundStyle(remaining == 0 ? .green : .orange)
            }
            HStack(spacing: 8) {
                requirementChip("CONFIDENCE", ready: confidenceReady)
                requirementChip("BEST BET", ready: state.bestBetGame != nil)
                requirementChip("PROP", ready: state.propAnswer != nil)
            }
        }
        .padding(11)
        .background(.black, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(.orange.opacity(0.55)))
        .shadow(color: .black.opacity(0.7), radius: 8, y: 4)
    }

    private func requirementChip(_ title: String, ready: Bool) -> some View {
        Label(title, systemImage: ready ? "checkmark.circle.fill" : "circle")
            .font(.system(size: 7, weight: .black)).foregroundStyle(ready ? .green : .white.opacity(0.48))
            .frame(maxWidth: .infinity).padding(.vertical, 5)
            .background(.white.opacity(0.05), in: Capsule())
    }

    private var laneSelector: some View {
        HStack(spacing: 8) {
            laneButton(.liveBoard, week: state.scoringWindow, title: "LIVE BOARD", icon: "dot.radiowaves.left.and.right")
            laneButton(.makePicks, week: state.window, title: state.picksLocked ? "LOCKED BOARD" : (state.pickWindowIsClosed(at: now) ? "WINDOW CLOSED" : "MAKE PICKS"), icon: state.picksLocked || state.pickWindowIsClosed(at: now) ? "lock.fill" : "checkmark.seal.fill")
        }
        .padding(6)
        .background(.black.opacity(0.84), in: RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).stroke(.orange.opacity(0.34)))
    }

    private func laneButton(_ target: FieldhousePicksLane, week: Int, title: String, icon: String) -> some View {
        Button { lane = target } label: {
            VStack(spacing: 4) {
                Text("WEEK \(week)").font(.system(size: 8, weight: .black)).tracking(1.2)
                Label(title, systemImage: icon).font(.caption.weight(.black))
            }
            .foregroundStyle(lane == target ? .black : .white.opacity(0.62))
            .frame(maxWidth: .infinity).padding(.vertical, 11)
            .background(lane == target ? Color.orange : .clear, in: RoundedRectangle(cornerRadius: 12))
        }.buttonStyle(.plain)
    }

    private var liveBoard: some View {
        VStack(spacing: 10) {
            FieldhouseHero(
                kicker: state.scoringIsComplete ? "FINAL HORN · AUTOMATICALLY CERTIFIED" : "ON THE FLOOR · WEEK \(state.scoringWindow)",
                title: state.scoringIsComplete ? "WEEK \(state.scoringWindow) IS FINAL" : (state.scoringLiveGames > 0 ? "THE BOARD IS LIVE" : "THE BOARD IS LOCKED"),
                detail: "\(state.scoringFinalGames) final · \(state.scoringLiveGames) live · your scorecard: \(state.scoringPoints) points",
                icon: state.scoringIsComplete ? "checkmark.seal.fill" : "basketball.fill"
            )
            ForEach(Array(state.scoringGames.enumerated()), id: \.element.id) { index, game in
                let result = state.scoringResults[game.id]
                let isFinal = result?.isFinal == true
                let coverWinner = result?.coverWinner(in: game)
                HStack(spacing: 10) {
                    Image(systemName: isFinal ? "checkmark.circle.fill" : "dot.radiowaves.left.and.right")
                        .foregroundStyle(isFinal ? .green : .orange)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("\(game.away) at \(game.home)").font(.caption.weight(.black))
                        Text("\(game.spread) · \(resultStatus(result))")
                            .font(.system(size: 8, weight: .black)).foregroundStyle(.white.opacity(0.48))
                        if let coverWinner {
                            Text("COVERING · \(coverWinner.uppercased())")
                                .font(.system(size: 8, weight: .black)).foregroundStyle(.green)
                        }
                        if let gamePoints = state.scoringGamePoints(at: index) {
                            Text("YOUR PICK · \(state.scoringSelections[index] ?? "—") · CONF \(state.scoringConfidences[index] ?? 0)\(state.scoringBestBetGame == index ? " · BEST BET ×2" : "")")
                                .font(.system(size: 8, weight: .black)).foregroundStyle(gamePoints > 0 ? .green : .red)
                        }
                        if state.roomPicksAreVisible(for: game.id) {
                            Text("ROOM PICKS · \(14 + index) \(game.away.uppercased()) · \(11 + index) \(game.home.uppercased())")
                                .font(.system(size: 7, weight: .black)).foregroundStyle(.cyan)
                        } else {
                            Text("ROOM PICKS SEALED UNTIL \(game.tip)")
                                .font(.system(size: 7, weight: .black)).foregroundStyle(.white.opacity(0.38))
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        if let result { Text("\(result.awayScore)–\(result.homeScore)").font(.headline.weight(.black)) }
                        Text(isFinal ? "FINAL" : periodLabel(result))
                            .font(.caption2.weight(.black)).foregroundStyle(isFinal ? .green : .orange)
                        if let gamePoints = state.scoringGamePoints(at: index) {
                            Text("+\(gamePoints)").font(.headline.weight(.black)).foregroundStyle(gamePoints > 0 ? .green : .white.opacity(0.35))
                        }
                    }
                }
                .padding(13).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 13))
                .overlay(RoundedRectangle(cornerRadius: 13).stroke(.white.opacity(0.10)))
            }
            scoringPropReceipt
        }
    }

    private var scoringPropReceipt: some View {
        let result = state.scoringPropResult
        let correctCall = result.map { state.scoringPropAnswer == ($0 ? "YES" : "NO") }
        return VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text("FLOOR PROP · 3 POINTS").font(.caption2.weight(.black)).tracking(1.3).foregroundStyle(.orange)
                Spacer()
                Text(result == nil ? "PENDING" : (result == true ? "YES" : "NO"))
                    .font(.caption.weight(.black)).foregroundStyle(result == nil ? .orange : .green)
            }
            Text(state.scoringProp.question).font(.subheadline.weight(.black))
            Text(result == nil ? "Resolves automatically after all ten games are final." : "YOUR CALL · \(state.scoringPropAnswer) · \(correctCall == true ? "+3" : "+0")")
                .font(.caption2.weight(.black)).foregroundStyle(correctCall == true ? .green : .white.opacity(0.50))
        }
        .padding(14).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke((result == nil ? Color.orange : Color.green).opacity(0.35)))
    }

    private func resultStatus(_ result: FieldhouseGameResult?) -> String {
        guard let result else { return "SCHEDULED" }
        switch result.phase {
        case .scheduled: return "SCHEDULED"
        case .live: return "LIVE"
        case .final: return "FINAL"
        }
    }

    private func periodLabel(_ result: FieldhouseGameResult?) -> String {
        guard let result else { return "SOON" }
        if case let .live(period) = result.phase { return period }
        return result.isFinal ? "FINAL" : "SOON"
    }

    private var lockedUpcomingBoard: some View {
        VStack(spacing: 10) {
            FieldhouseHero(
                kicker: "WEEK \(state.window) · LOCKED · AWAITING TIP",
                title: "YOUR BOARD IS SET",
                detail: "Your picks remain visible to you. Room selections declassify one matchup at a time when each game tips.",
                icon: "lock.shield.fill"
            )
            ForEach(Array(state.publishedGames.enumerated()), id: \.element.id) { index, game in
                HStack(spacing: 10) {
                    Image(systemName: "lock.fill").foregroundStyle(.orange)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(game.away) at \(game.home)").font(.caption.weight(.black))
                        Text("YOUR PICK · \(state.sideSelections[index] ?? "—") · CONF \(state.confidenceSelections[index] ?? 0)")
                            .font(.system(size: 8, weight: .black)).foregroundStyle(.white.opacity(0.58))
                    }
                    Spacer()
                    Text("ROOM SEALED").font(.system(size: 8, weight: .black)).foregroundStyle(.orange)
                }
                .padding(13).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 13))
                .overlay(RoundedRectangle(cornerRadius: 13).stroke(.orange.opacity(0.22)))
            }
            Button(state.hellfireDeployedOnCurrentCard ? "HELLFIRE CARD CANNOT REOPEN" : "REOPEN PICKS BEFORE FIRST TIP") { _ = state.reopenPicks(at: Date()) }
                .font(.caption.weight(.black)).foregroundStyle(.orange)
                .frame(maxWidth: .infinity).padding(15)
                .background(.black.opacity(0.80), in: RoundedRectangle(cornerRadius: 15))
                .overlay(RoundedRectangle(cornerRadius: 15).stroke(.orange.opacity(0.35)))
                .disabled(state.hellfireDeployedOnCurrentCard || !state.canEditPicks(at: Date()))
                .opacity(!state.hellfireDeployedOnCurrentCard && state.canEditPicks(at: Date()) ? 1 : 0.45)
        }
    }

    private var expiredUpcomingBoard: some View {
        VStack(spacing: 12) {
            FieldhouseHero(
                kicker: "WEEK \(state.window) · WINDOW CLOSED",
                title: "CARD NOT SUBMITTED",
                detail: "The first selected game has tipped. This card is sealed and incomplete picks cannot be changed or scored.",
                icon: "exclamationmark.lock.fill"
            )
            Text("The next card opens with Week \(state.window + 1).")
                .font(.caption.weight(.black)).foregroundStyle(.white.opacity(0.55))
        }
    }

    private func gameCard(index: Int, game matchup: FieldhouseGame) -> some View {
        let selected = state.sideSelections[index]
        return VStack(alignment: .leading, spacing: 11) {
            HStack {
                Text("COURT \(index + 1) · FIRST TIP \(matchup.tip)").font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(.orange)
                Spacer()
                Button {
                    state.bestBetGame = state.bestBetGame == index ? nil : index
                } label: {
                    Label("BEST BET", systemImage: state.bestBetGame == index ? "star.fill" : "star")
                        .font(.system(size: 8, weight: .black)).foregroundStyle(state.bestBetGame == index ? .yellow : .white.opacity(0.52))
                }.buttonStyle(.plain).disabled(state.picksLocked || !state.canEditPicks(at: now))
            }
            HStack(spacing: 8) {
                sideButton(matchup.away, game: index, selected: selected)
                Text("AT").font(.caption2.weight(.black)).foregroundStyle(.white.opacity(0.38))
                sideButton(matchup.home, game: index, selected: selected)
            }
            Text(matchup.spread).font(.caption.weight(.black)).foregroundStyle(.white.opacity(0.52))
            HStack(spacing: 7) {
                Text("CONFIDENCE").font(.system(size: 8, weight: .black)).foregroundStyle(.white.opacity(0.48))
                ForEach(1...FieldhouseGameCatalog.weeklyCardSize, id: \.self) { value in
                    let chosen = state.confidenceSelections[index] == value
                    let available = state.confidenceAvailable(value, for: index)
                    Button {
                        state.toggleConfidence(value, for: index)
                    } label: {
                        Text("\(value)").font(.caption.weight(.black)).frame(width: 32, height: 32)
                            .foregroundStyle(chosen ? .black : (available ? .white : .white.opacity(0.22)))
                            .background(chosen ? Color.orange : Color.white.opacity(0.07), in: Circle())
                    }.buttonStyle(.plain).disabled(!available || state.picksLocked || !state.canEditPicks(at: now))
                }
            }
        }.padding(14).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(selected == nil ? .white.opacity(0.12) : .orange.opacity(0.42)))
    }

    private func sideButton(_ team: String, game: Int, selected: String?) -> some View {
        Button { state.sideSelections[game] = selected == team ? nil : team } label: {
            Text(team.uppercased()).font(.caption.weight(.black)).minimumScaleFactor(0.7).lineLimit(1)
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .foregroundStyle(selected == team ? .black : .white)
                .background(selected == team ? Color.orange : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 11))
        }.buttonStyle(.plain).disabled(state.picksLocked || !state.canEditPicks(at: now))
    }

    private func propButton(_ answer: String) -> some View {
        Button { state.propAnswer = state.propAnswer == answer ? nil : answer } label: {
            Text(answer).font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(13)
                .foregroundStyle(state.propAnswer == answer ? .black : .white)
                .background(state.propAnswer == answer ? Color.orange : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 11))
        }.buttonStyle(.plain).disabled(state.picksLocked || !state.canEditPicks(at: now))
    }

    private func deployHellfire() {
        guard state.deployRegularSeasonHellfire(at: now) else { return }
        strikePresentation = WeaponStrikeCatalog.presentation(for: "cbb")
    }
}

private struct FieldhouseStandingsPage: View {
    @Binding var state: FieldhouseSeasonState
    @State private var showingOverall = false
    private let players = ["Riley V.", "Full Court Mess", "Bracket Buster", "The Sixth Man", "Baseline Bandit", "March Sadness", "Bank Shot", "Coach's Favorite", "Paint Patrol", "Buzzer Beater", "Zone Defense", "Heat Check", "One Shining Mistake", "Fast Break", "The Transfer Portal", "Double Bonus", "Shot Clock", "Backboard Damage", "Cinderella Story", "Technical Foul", "Bubble Trouble", "Air Ball", "Traveling", "Bench Mob", "Wooden Spoon"]
    var body: some View {
        VStack(spacing: 13) {
            FieldhouseHero(kicker: "FIELDHOUSE STANDINGS", title: "REGIONAL SEED LINES", detail: "Live points, regional position, and both postseason cuts in the same format used across War Room.", icon: "list.number")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    standingsChip("OVERALL", selected: showingOverall) { showingOverall = true }
                    ForEach(FieldhouseRegion.allCases) { region in
                        standingsChip(region.rawValue, selected: !showingOverall && state.selectedRegion == region) {
                            showingOverall = false; state.selectedRegion = region
                        }
                    }
                }
            }
            VStack(spacing: 8) {
                ForEach(Array(players.enumerated()), id: \.offset) { index, player in
                    standingRow(rank: index + 1, player: player, points: index == 0 ? 87 + state.scoringPoints : 87 - (index * 2))
                    if !showingOverall && index == 3 { cutLine("CHAMPIONSHIP CUT", color: .yellow) }
                    if !showingOverall && index == 20 { cutLine("TOILET BOWL CUT", color: .purple) }
                }
            }
            Text("EAST + WEST + SOUTH + MIDWEST  →  CENTER COURT").font(.caption.weight(.black)).tracking(1).foregroundStyle(.orange).padding(14).frame(maxWidth: .infinity).background(.orange.opacity(0.1), in: Capsule())
            VStack(alignment: .leading, spacing: 12) {
                Text("CHAMPIONSHIP WEEK · POWER FOUR").font(.caption2.weight(.black)).tracking(1.6).foregroundStyle(.orange)
                Text("FOUR TROPHIES BEFORE THE BRACKET").font(.title2.weight(.black)).fontWidth(.condensed)
                ForEach(["ACC CHAMPIONSHIP", "BIG 12 CHAMPIONSHIP", "BIG TEN CHAMPIONSHIP", "SEC CHAMPIONSHIP"], id: \.self) { title in
                    HStack {
                        Image(systemName: "trophy.fill").foregroundStyle(.yellow)
                        Text(title).font(.subheadline.weight(.black))
                        Spacer()
                        Text("PICK").font(.caption2.weight(.black)).foregroundStyle(.orange)
                        Image(systemName: "chevron.right")
                    }
                    .padding(13).background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(16).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(.orange.opacity(0.32)))
            FieldhouseBracketPreview(state: $state)
        }
    }

    private func standingsChip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.system(size: 10, weight: .black)).tracking(1)
                .foregroundStyle(selected ? .black : .white.opacity(0.72))
                .padding(.horizontal, 13).padding(.vertical, 9)
                .background(selected ? Color.orange : Color.black.opacity(0.72), in: Capsule())
                .overlay(Capsule().stroke(.orange.opacity(selected ? 1 : 0.28)))
        }.buttonStyle(.plain)
    }

    private func standingRow(rank: Int, player: String, points: Int) -> some View {
        HStack(spacing: 12) {
            Text("\(rank)").font(.title3.weight(.black)).foregroundStyle(rank <= 4 ? .yellow : .white.opacity(0.58)).frame(width: 30)
            Circle().fill(.orange.opacity(0.18)).frame(width: 42, height: 42).overlay(Text(String(player.prefix(1))).font(.headline.weight(.black)).foregroundStyle(.orange))
            VStack(alignment: .leading, spacing: 3) {
                Text(player).font(.headline.weight(.black))
                Text(showingOverall ? "FIELDHOUSE OVERALL" : "\(state.selectedRegion.rawValue) REGION").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.44))
            }
            Spacer(); Text("\(points)").font(.title2.weight(.black)).foregroundStyle(.orange)
        }.padding(12).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(.orange.opacity(0.18)))
    }

    private func cutLine(_ title: String, color: Color) -> some View {
        HStack { Rectangle().fill(color).frame(height: 1); Text(title).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(color); Rectangle().fill(color).frame(height: 1) }
    }
}

private struct FieldhouseBracketPreview: View {
    @Binding var state: FieldhouseSeasonState
    private let rounds = ["ROUND OF 64", "ROUND OF 32", "SWEET 16", "ELITE 8", "FINAL FOUR", "TITLE GAME"]
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("POSTSEASON TRANSITION · MARCH").font(.caption2.weight(.black)).tracking(1.6).foregroundStyle(.orange)
            Text("THE ROAD TO CENTER COURT").font(.title2.weight(.black)).fontWidth(.condensed)
            Text("Your regional finish seeds the standard national bracket. Championship and Toilet Bowl fields are pulled from each region—never overall league standings.")
                .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
            ForEach(Array(rounds.enumerated()), id: \.offset) { index, round in
                HStack(spacing: 10) {
                    Text("\(index + 1)").font(.caption.weight(.black)).foregroundStyle(.black)
                        .frame(width: 25, height: 25).background(.orange, in: Circle())
                    Text(round).font(.subheadline.weight(.black))
                    Spacer()
                    Image(systemName: index == rounds.count - 1 ? "trophy.fill" : "arrow.down")
                        .foregroundStyle(index == rounds.count - 1 ? .yellow : .orange)
                }
            }
            HStack { Label("BRACKET HELLFIRE", systemImage: "scope"); Spacer(); Text(state.bracketHellfireUsed ? "0/1" : "1/1") }
                .font(.caption.weight(.black)).foregroundStyle(.orange)
                .padding(12).background(.orange.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
        }
        .padding(16).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.orange.opacity(0.42)))
    }
}

private struct FieldhouseBracketsPage: View {
    @Binding var state: FieldhouseSeasonState
    @Binding var strikePresentation: StrikePresentation?
    var body: some View {
        VStack(spacing: 13) {
            FieldhouseHero(kicker: "MARCH COMMAND · 67 DECISIONS", title: "THE NATIONAL BRACKET", detail: "First Four through the title game. Lock the whole sheet before the first tip.", icon: "point.3.connected.trianglepath.dotted")
            ForEach(FieldhouseRegion.allCases) { region in
                HStack { Text(region.rawValue).font(.headline.weight(.black)); Spacer(); Text("ROUND OF 64 → SWEET 16 → ELITE 8").font(.system(size: 7, weight: .black)).foregroundStyle(.orange); Image(systemName: "chevron.right.2").foregroundStyle(.yellow) }.padding(15).background(.black.opacity(0.74), in: RoundedRectangle(cornerRadius: 13)).overlay(RoundedRectangle(cornerRadius: 13).stroke(.orange.opacity(0.25)))
            }
            Button { guard !state.bracketHellfireUsed else { return }; state.bracketHellfireUsed = true; state.bracketLocked = true; strikePresentation = WeaponStrikeCatalog.presentation(for: "cbb") } label: {
                FieldhouseAction(kicker: "BRACKET WEAPON · ONE SHOT", title: state.bracketHellfireUsed ? "Hellfire Bracket Locked" : "Launch the AI Crazy Pick", detail: state.bracketHellfireUsed ? "All 67 picks are sealed. No reroll." : "AI fills a wild but complete bracket, plays the Fieldhouse strike video, then seals every pick.", icon: "wand.and.stars")
            }.buttonStyle(.plain).disabled(state.bracketHellfireUsed)
            Text("REGULAR SEASON HELLFIRE: 2/2 · BRACKET AI HELLFIRE: 1 TOTAL · NO REROLLS").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.48))
        }
    }
}

private struct FieldhouseDispatchPage: View { var body: some View { VStack(spacing: 13) { FieldhouseHero(kicker: "THE FIELDHOUSE DISPATCH", title: "FINAL SCORES.\nFULL RECEIPTS.", detail: "Regional movement, busted chalk, buzzer beaters, and the weekly floor report.", icon: "newspaper.fill"); FieldhouseAction(kicker: "FRONT PAGE", title: "THE PAINT BELONGED TO NOBODY", detail: "Three favorites fell. One Best Bet survived. The Midwest is already hostile.", icon: "doc.text.image.fill") } } }
private struct FieldhouseLockerPage: View {
    private static let bottomAnchor = "fieldhouse-locker-bottom"
    @State private var draft = ""
    @State private var messages = [
        ("Full Court Mess", "That bracket has six exits and you found all seven."),
        ("Midwest to the Middle", "Book it. This region belongs to us."),
        ("Riley V.", "Two Hellfires and still down twelve is nasty work."),
        ("Bracket Buster", "Receipts are permanent. Keep talking.")
    ]

    var body: some View {
        VStack(spacing: 8) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 6) {
                            Label("FIELDHOUSE LIVE WIRE", systemImage: "bolt.fill").font(.caption2.weight(.black)).tracking(2).foregroundStyle(.orange)
                            Text("THE LOCKER\nROOM").font(.system(size: 36, weight: .black)).fontWidth(.condensed).lineSpacing(-4)
                            Text("NO PRESS. NO PR TEAM. NO ALIBIS.").font(.system(size: 9, weight: .black)).tracking(1.5).foregroundStyle(.red)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(18).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 18)).overlay(alignment: .leading) { Rectangle().fill(.orange).frame(width: 4).padding(.vertical, 12) }
                        ForEach(Array(messages.enumerated()), id: \.offset) { _, message in
                            VStack(alignment: .leading, spacing: 5) {
                                Text(message.0.uppercased()).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.orange)
                                Text(message.1).font(.subheadline.weight(.semibold))
                                HStack(spacing: 12) { Text("🔥 2"); Text("😂 1"); Text("🏀") }.font(.caption).foregroundStyle(.white.opacity(0.55))
                            }.frame(maxWidth: .infinity, alignment: .leading).padding(13).background(.black.opacity(0.74), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.orange.opacity(0.20)))
                        }
                        Color.clear.frame(height: 1).id(Self.bottomAnchor)
                    }.padding(.top, 8)
                }
                .onAppear { DispatchQueue.main.async { proxy.scrollTo(Self.bottomAnchor, anchor: .bottom) } }
                .onChange(of: messages.count) { _, _ in proxy.scrollTo(Self.bottomAnchor, anchor: .bottom) }
            }
            HStack(alignment: .bottom, spacing: 9) {
                TextField("Deliver a questionable take…", text: $draft, axis: .vertical)
                    .lineLimit(1...3).padding(12).background(.black.opacity(0.84), in: RoundedRectangle(cornerRadius: 14))
                Button {
                    let clean = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !clean.isEmpty else { return }
                    messages.append(("YOU", clean)); draft = ""
                } label: {
                    Image(systemName: "paperplane.fill").font(.headline).foregroundStyle(.black).frame(width: 46, height: 46).background(.orange, in: Circle())
                }.buttonStyle(.plain)
            }.padding(.vertical, 8)
        }
    }
}
private struct FieldhouseProfilePage: View {
    @Binding var state: FieldhouseSeasonState
    @State private var editingFavorite = false
    @State private var earnedExpanded = false
    @State private var searchText = ""
    private var teams: [String] {
        searchText.isEmpty ? FieldhouseTeamCatalog.all : FieldhouseTeamCatalog.all.filter { $0.localizedCaseInsensitiveContains(searchText) }
    }
    var body: some View {
        VStack(spacing: 13) {
            VStack(alignment: .leading, spacing: 14) {
                Text("FIELDHOUSE PERSONNEL FILE").font(.caption2.weight(.black)).tracking(1.7).foregroundStyle(.orange)
                HStack(spacing: 14) {
                    Circle().fill(.orange.opacity(0.18)).frame(width: 72, height: 72)
                        .overlay(Text("RV").font(.title.weight(.black)).foregroundStyle(.orange))
                        .overlay(Circle().stroke(.orange, lineWidth: 3))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Riley V.").font(.title2.weight(.black))
                        Text("warroom@example.com").font(.caption).foregroundStyle(.white.opacity(0.48))
                        Text("CHANGE PROFILE PHOTO").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.orange)
                    }
                }
            }.frame(maxWidth: .infinity, alignment: .leading).padding(18).background(.black.opacity(0.80), in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(.orange.opacity(0.32)))
            HStack(spacing: 10) {
                FieldhouseMetric(value: "\(state.regularHellfiresUsed)", label: "HELLFIRES")
                FieldhouseMetric(value: "\(state.rank)", label: "REGIONAL SEED")
            }
            profileSection("WAR ROOM ACCOUNT NAME", icon: "person.fill") {
                VStack(alignment: .leading, spacing: 5) { Text("Riley V.").font(.headline.weight(.black)); Text("Used across every sport and league.").font(.caption).foregroundStyle(.white.opacity(0.48)) }
            }
            profileSection("CLASSIFIED BIRTHDAY FILE", icon: "lock.shield.fill") {
                VStack(alignment: .leading, spacing: 5) { Text("Birthday not sealed").font(.headline.weight(.black)); Text("Only month and day are stored.").font(.caption).foregroundStyle(.white.opacity(0.48)) }
            }
            VStack(alignment: .leading, spacing: 12) {
                Text("FAVORITE TEAM · EDITABLE ANYTIME").font(.caption2.weight(.black)).tracking(1.4).foregroundStyle(.orange)
                Button { editingFavorite.toggle() } label: {
                    HStack {
                        Image(systemName: "heart.fill").foregroundStyle(.orange)
                        Text(state.favoriteTeam ?? "Choose a favorite team").font(.headline.weight(.black))
                        Spacer(); Image(systemName: editingFavorite ? "chevron.up" : "pencil")
                    }
                }.buttonStyle(.plain)
                if editingFavorite {
                    TextField("Search all Division I teams", text: $searchText)
                        .textInputAutocapitalization(.words).autocorrectionDisabled()
                        .padding(12).background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
                    ScrollView {
                        LazyVStack(spacing: 7) {
                            ForEach(teams, id: \.self) { team in
                                Button { state.favoriteTeam = team; editingFavorite = false; searchText = "" } label: {
                                    HStack {
                                        Text(team).font(.subheadline.weight(.bold)); Spacer()
                                        if state.favoriteTeam == team { Image(systemName: "checkmark.circle.fill").foregroundStyle(.orange) }
                                    }.padding(11).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                    .frame(maxHeight: 280)
                }
            }.padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.orange.opacity(0.3)))
            FieldhouseAction(kicker: "CRYSTAL BALL · SEALED", title: state.crystalBallChampion ?? "Champion not selected", detail: "The original championship prediction stays on your permanent profile.", icon: "sparkles")
            profileSection("ACTIVE LOADOUT", icon: "slider.horizontal.3") {
                VStack(spacing: 10) {
                    profileRow("EQUIPPED TITLE", value: "Floor General")
                    profileRow("STANDINGS INSIGNIA", value: "Regional Seed")
                    profileRow("AVATAR BORDER", value: "Courtside Orange")
                }
            }
            FieldhouseAction(kicker: "PERMANENT HARDWARE", title: "Championship · Toilet Bowl · Bracket Crown", detail: "Only regional postseason qualifiers can add Championship or Toilet Bowl brass.", icon: "trophy.fill")
            VStack(alignment: .leading, spacing: 12) {
                Button { withAnimation(.snappy) { earnedExpanded.toggle() } } label: {
                    HStack {
                        Label("EARNED SCHWAG", systemImage: "medal.fill").font(.headline.weight(.black)).foregroundStyle(.orange)
                        Spacer(); Text("3").font(.caption.weight(.black)); Image(systemName: earnedExpanded ? "chevron.up" : "chevron.down")
                    }
                }.buttonStyle(.plain)
                if earnedExpanded {
                    ForEach(["FIRST TIP · MADE YOUR FIRST PICK", "HARDWOOD HOMER · PICKED YOUR FAVORITE", "HEAT CHECK · HIT A BEST BET"], id: \.self) { item in
                        HStack { Image(systemName: "basketball.fill").foregroundStyle(.orange); Text(item).font(.caption.weight(.black)); Spacer() }
                            .padding(11).background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 11))
                    }
                }
            }.padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.orange.opacity(0.3)))
        }
    }

    private func profileSection<Content: View>(_ title: String, icon: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            Label(title, systemImage: icon).font(.caption2.weight(.black)).tracking(1.2).foregroundStyle(.orange)
            content()
        }.frame(maxWidth: .infinity, alignment: .leading).padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.orange.opacity(0.3)))
    }

    private func profileRow(_ title: String, value: String) -> some View {
        HStack { VStack(alignment: .leading) { Text(title).font(.system(size: 8, weight: .black)).foregroundStyle(.white.opacity(0.45)); Text(value).font(.subheadline.weight(.black)) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(.orange) }
    }
}

private struct FieldhouseHero: View { let kicker: String; let title: String; let detail: String; let icon: String; var body: some View { VStack(alignment: .leading, spacing: 10) { Label(kicker, systemImage: icon).font(.system(size: 9, weight: .black)).tracking(1.5).foregroundStyle(.orange); Text(title).font(.system(size: 29, weight: .black)).fontWidth(.condensed); Text(detail).font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.62)) }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(LinearGradient(colors: [.orange.opacity(0.24), .black.opacity(0.86)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 19)).overlay(RoundedRectangle(cornerRadius: 19).stroke(.orange.opacity(0.52))) } }
private struct FieldhouseAction: View { let kicker: String; let title: String; let detail: String; let icon: String; var body: some View { HStack(spacing: 13) { Image(systemName: icon).font(.title2.weight(.black)).foregroundStyle(.orange).frame(width: 45, height: 45).background(.orange.opacity(0.12), in: Circle()); VStack(alignment: .leading, spacing: 4) { Text(kicker).font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(.orange); Text(title).font(.headline.weight(.black)); Text(detail).font(.caption).foregroundStyle(.white.opacity(0.55)) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(.orange) }.padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.orange.opacity(0.3))) } }
private struct FieldhouseMetric: View { let value: String; let label: String; var body: some View { VStack(spacing: 4) { Text(value).font(.title.weight(.black)).foregroundStyle(.orange); Text(label).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.5)) }.frame(maxWidth: .infinity).padding(15).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.orange.opacity(0.24))) } }
