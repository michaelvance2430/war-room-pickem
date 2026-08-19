import SwiftUI

struct FootballTeam: Identifiable, Hashable {
    let name: String
    let shortName: String
    let conference: String
    let aliases: String

    var id: String { name }
    var mark: String { shortName.split(separator: " ").compactMap(\.first).prefix(3).map(String.init).joined() }
    var searchText: String { "\(name) \(shortName) \(conference) \(aliases)".lowercased() }
    var color: Color {
        let colors: [Color] = [.red, .orange, .yellow, .green, .cyan, .blue, .indigo, .purple]
        return colors[abs(name.unicodeScalars.reduce(0) { ($0 &* 31) &+ Int($1.value) }) % colors.count]
    }
}

enum FootballTeamCatalog {
    static func teams(for sportId: String) -> [FootballTeam] {
        sportId.lowercased() == "nfl" ? nfl : cfb
    }

    static func team(forTeamId teamId: String?, sportId: String) -> FootballTeam? {
        guard let teamId else { return nil }
        let wanted = normalizedTeamId(teamId)
        return teams(for: sportId).first { candidate in
            normalizedTeamId(candidate.name) == wanted || normalizedTeamId(candidate.shortName) == wanted
        }
    }

    static func normalizedTeamId(_ value: String) -> String {
        let slug = value.lowercased()
            .replacingOccurrences(of: "&", with: "and")
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "-")
        if slug.hasPrefix("cfb-") || slug.hasPrefix("nfl-") {
            return String(slug.dropFirst(4))
        }
        return slug
    }

    static func matches(_ displayedTeam: String, favorite: FootballTeam) -> Bool {
        let displayed = normalizedTeamId(displayedTeam)
        let identities = [
            favorite.name,
            favorite.shortName,
            "\(favorite.name) \(favorite.shortName)",
        ] + favorite.aliases.split(separator: " ").map(String.init)
        for identity in identities where normalizedTeamId(identity) == displayed { return true }
        return false
    }

    private static func team(_ name: String, _ short: String, _ conference: String, _ aliases: String = "") -> FootballTeam {
        FootballTeam(name: name, shortName: short, conference: conference, aliases: aliases)
    }

    static let nfl: [FootballTeam] = [
        team("Arizona Cardinals", "Cardinals", "NFC West", "Arizona"), team("Atlanta Falcons", "Falcons", "NFC South", "Atlanta"),
        team("Baltimore Ravens", "Ravens", "AFC North", "Baltimore"), team("Buffalo Bills", "Bills", "AFC East", "Buffalo"),
        team("Carolina Panthers", "Panthers", "NFC South", "Carolina"), team("Chicago Bears", "Bears", "NFC North", "Chicago"),
        team("Cincinnati Bengals", "Bengals", "AFC North", "Cincinnati"), team("Cleveland Browns", "Browns", "AFC North", "Cleveland"),
        team("Dallas Cowboys", "Cowboys", "NFC East", "Dallas"), team("Denver Broncos", "Broncos", "AFC West", "Denver"),
        team("Detroit Lions", "Lions", "NFC North", "Detroit"), team("Green Bay Packers", "Packers", "NFC North", "Green Bay"),
        team("Houston Texans", "Texans", "AFC South", "Houston"), team("Indianapolis Colts", "Colts", "AFC South", "Indianapolis"),
        team("Jacksonville Jaguars", "Jaguars", "AFC South", "Jacksonville Jags"), team("Kansas City Chiefs", "Chiefs", "AFC West", "Kansas City KC"),
        team("Las Vegas Raiders", "Raiders", "AFC West", "Las Vegas Oakland"), team("Los Angeles Chargers", "Chargers", "AFC West", "LA San Diego"),
        team("Los Angeles Rams", "Rams", "NFC West", "LA St Louis"), team("Miami Dolphins", "Dolphins", "AFC East", "Miami"),
        team("Minnesota Vikings", "Vikings", "NFC North", "Minnesota"), team("New England Patriots", "Patriots", "AFC East", "New England Pats"),
        team("New Orleans Saints", "Saints", "NFC South", "New Orleans"), team("New York Giants", "Giants", "NFC East", "NYG New York"),
        team("New York Jets", "Jets", "AFC East", "NYJ New York"), team("Philadelphia Eagles", "Eagles", "NFC East", "Philadelphia Philly"),
        team("Pittsburgh Steelers", "Steelers", "AFC North", "Pittsburgh"), team("San Francisco 49ers", "49ers", "NFC West", "San Francisco Niners"),
        team("Seattle Seahawks", "Seahawks", "NFC West", "Seattle"), team("Tampa Bay Buccaneers", "Buccaneers", "NFC South", "Tampa Bucs"),
        team("Tennessee Titans", "Titans", "AFC South", "Tennessee"), team("Washington Commanders", "Commanders", "NFC East", "Washington")
    ]

    static let cfb: [FootballTeam] = [
        team("Boston College", "Eagles", "ACC", "BC"), team("California", "Golden Bears", "ACC", "Cal"), team("Clemson", "Tigers", "ACC"),
        team("Duke", "Blue Devils", "ACC"), team("Florida State", "Seminoles", "ACC", "FSU"), team("Georgia Tech", "Yellow Jackets", "ACC"),
        team("Louisville", "Cardinals", "ACC", "UofL"), team("Miami", "Hurricanes", "ACC", "Miami Florida The U"), team("NC State", "Wolfpack", "ACC", "North Carolina State"),
        team("North Carolina", "Tar Heels", "ACC", "UNC"), team("Pittsburgh", "Panthers", "ACC", "Pitt"), team("SMU", "Mustangs", "ACC", "Southern Methodist"),
        team("Syracuse", "Orange", "ACC"), team("Virginia", "Cavaliers", "ACC", "UVA"), team("Virginia Tech", "Hokies", "ACC", "VT"),
        team("Wake Forest", "Demon Deacons", "ACC", "Wake"), team("Stanford", "Cardinal", "ACC"),
        team("Illinois", "Fighting Illini", "Big Ten"), team("Indiana", "Hoosiers", "Big Ten", "IU"), team("Iowa", "Hawkeyes", "Big Ten"),
        team("Maryland", "Terrapins", "Big Ten", "Terps"), team("Michigan", "Wolverines", "Big Ten"), team("Michigan State", "Spartans", "Big Ten", "MSU"),
        team("Minnesota", "Golden Gophers", "Big Ten"), team("Nebraska", "Cornhuskers", "Big Ten", "Huskers"), team("Northwestern", "Wildcats", "Big Ten"),
        team("Ohio State", "Buckeyes", "Big Ten", "OSU"), team("Oregon", "Ducks", "Big Ten", "UO"), team("Penn State", "Nittany Lions", "Big Ten", "PSU"),
        team("Purdue", "Boilermakers", "Big Ten"), team("Rutgers", "Scarlet Knights", "Big Ten"), team("UCLA", "Bruins", "Big Ten"),
        team("USC", "Trojans", "Big Ten", "Southern California"), team("Washington", "Huskies", "Big Ten", "UW"), team("Wisconsin", "Badgers", "Big Ten"),
        team("Arizona", "Wildcats", "Big 12"), team("Arizona State", "Sun Devils", "Big 12", "ASU"), team("Baylor", "Bears", "Big 12"),
        team("BYU", "Cougars", "Big 12", "Brigham Young"), team("Cincinnati", "Bearcats", "Big 12", "UC"), team("Colorado", "Buffaloes", "Big 12", "Buffs"),
        team("Houston", "Cougars", "Big 12", "UH"), team("Iowa State", "Cyclones", "Big 12", "ISU"), team("Kansas", "Jayhawks", "Big 12", "KU"),
        team("Kansas State", "Wildcats", "Big 12", "K State KSU"), team("Oklahoma State", "Cowboys", "Big 12", "OSU"), team("TCU", "Horned Frogs", "Big 12", "Texas Christian"),
        team("Texas Tech", "Red Raiders", "Big 12", "TTU"), team("UCF", "Knights", "Big 12", "Central Florida"), team("Utah", "Utes", "Big 12"),
        team("West Virginia", "Mountaineers", "Big 12", "WVU"),
        team("Alabama", "Crimson Tide", "SEC", "Bama"), team("Arkansas", "Razorbacks", "SEC", "Hogs"), team("Auburn", "Tigers", "SEC"),
        team("Florida", "Gators", "SEC", "UF"), team("Georgia", "Bulldogs", "SEC", "UGA Dawgs"), team("Kentucky", "Wildcats", "SEC", "UK"),
        team("LSU", "Tigers", "SEC", "Louisiana State"), team("Mississippi State", "Bulldogs", "SEC", "MSU"), team("Missouri", "Tigers", "SEC", "Mizzou"),
        team("Oklahoma", "Sooners", "SEC", "OU"), team("Ole Miss", "Rebels", "SEC", "Mississippi"), team("South Carolina", "Gamecocks", "SEC", "USC"),
        team("Tennessee", "Volunteers", "SEC", "Vols"), team("Texas", "Longhorns", "SEC", "UT"), team("Texas A&M", "Aggies", "SEC", "TAMU"), team("Vanderbilt", "Commodores", "SEC", "Vandy"),
        team("Connecticut", "Huskies", "Independent", "UConn"), team("Notre Dame", "Fighting Irish", "Independent", "ND"),
        team("Air Force", "Falcons", "Mountain West"), team("Hawaii", "Rainbow Warriors", "Mountain West"), team("Nevada", "Wolf Pack", "Mountain West"),
        team("New Mexico", "Lobos", "Mountain West"), team("New Mexico State", "Aggies", "C-USA", "NMSU"), team("North Dakota State", "Bison", "Mountain West", "NDSU"),
        team("Northern Illinois", "Huskies", "Mountain West", "NIU"), team("San Jose State", "Spartans", "Mountain West", "SJSU"),
        team("UNLV", "Rebels", "Mountain West"), team("UTEP", "Miners", "Mountain West", "Texas El Paso"), team("Wyoming", "Cowboys", "Mountain West"),
        team("Charlotte", "49ers", "American", "UNC Charlotte"), team("East Carolina", "Pirates", "American", "ECU"), team("Florida Atlantic", "Owls", "American", "FAU"),
        team("Army", "Black Knights", "American", "West Point"), team("Memphis", "Tigers", "American"), team("Navy", "Midshipmen", "American"), team("North Texas", "Mean Green", "American", "UNT"),
        team("Rice", "Owls", "American"), team("South Florida", "Bulls", "American", "USF"), team("Temple", "Owls", "American"),
        team("Tulane", "Green Wave", "American"), team("Tulsa", "Golden Hurricane", "American"), team("UAB", "Blazers", "American", "Alabama Birmingham"),
        team("UTSA", "Roadrunners", "American", "Texas San Antonio"),
        team("Appalachian State", "Mountaineers", "Sun Belt", "App State"), team("Arkansas State", "Red Wolves", "Sun Belt"), team("Coastal Carolina", "Chanticleers", "Sun Belt"),
        team("Georgia Southern", "Eagles", "Sun Belt"), team("Georgia State", "Panthers", "Sun Belt"), team("James Madison", "Dukes", "Sun Belt", "JMU"),
        team("Louisiana", "Ragin' Cajuns", "Sun Belt", "ULL"), team("Louisiana-Monroe", "Warhawks", "Sun Belt", "ULM"), team("Marshall", "Thundering Herd", "Sun Belt"),
        team("Old Dominion", "Monarchs", "Sun Belt", "ODU"), team("South Alabama", "Jaguars", "Sun Belt"), team("Southern Miss", "Golden Eagles", "Sun Belt", "Southern Mississippi"),
        team("Troy", "Trojans", "Sun Belt"),
        team("Akron", "Zips", "MAC"), team("Ball State", "Cardinals", "MAC"), team("Bowling Green", "Falcons", "MAC", "BGSU"), team("Buffalo", "Bulls", "MAC"),
        team("Central Michigan", "Chippewas", "MAC", "CMU"), team("Eastern Michigan", "Eagles", "MAC", "EMU"), team("Kent State", "Golden Flashes", "MAC"),
        team("Massachusetts", "Minutemen", "MAC", "UMass"), team("Miami (OH)", "RedHawks", "MAC", "Miami Ohio"), team("Ohio", "Bobcats", "MAC"),
        team("Toledo", "Rockets", "MAC"), team("Western Michigan", "Broncos", "MAC", "WMU"),
        team("Delaware", "Blue Hens", "C-USA"), team("FIU", "Panthers", "C-USA", "Florida International"), team("Jacksonville State", "Gamecocks", "C-USA", "Jax State"),
        team("Kennesaw State", "Owls", "C-USA"), team("Liberty", "Flames", "C-USA"), team("Louisiana Tech", "Bulldogs", "C-USA", "LA Tech"),
        team("Middle Tennessee", "Blue Raiders", "C-USA", "MTSU"), team("Missouri State", "Bears", "C-USA"),
        team("Sam Houston", "Bearkats", "C-USA", "SHSU"), team("Western Kentucky", "Hilltoppers", "C-USA", "WKU"),
        team("Boise State", "Broncos", "Pac-12"), team("Colorado State", "Rams", "Pac-12", "CSU"), team("Fresno State", "Bulldogs", "Pac-12"),
        team("Oregon State", "Beavers", "Pac-12", "OSU"), team("San Diego State", "Aztecs", "Pac-12", "SDSU"), team("Texas State", "Bobcats", "Pac-12"),
        team("Utah State", "Aggies", "Pac-12", "USU"), team("Washington State", "Cougars", "Pac-12", "Wazzu WSU")
    ]
}

struct FavoriteTeamPickerView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let sportId: String
    @Binding var selectedTeamId: String?
    @State private var search = ""
    @State private var savingId: String?
    @State private var errorMessage: String?

    private var identity: SportIdentity { SportIdentity(sportId) }
    private var teams: [FootballTeam] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let all = FootballTeamCatalog.teams(for: sportId)
        return query.isEmpty ? all : all.filter { $0.searchText.contains(query) }
    }

    var body: some View {
        ZStack {
            if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) } else { Color.black.ignoresSafeArea() }
            ScrollView {
                LazyVStack(spacing: 9, pinnedViews: [.sectionHeaders]) {
                    Section {
                        ForEach(teams) { team in
                            Button { Task { await select(team) } } label: {
                                HStack(spacing: 12) {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 10).fill(team.color.opacity(0.18))
                                        RoundedRectangle(cornerRadius: 10).stroke(team.color.opacity(0.7))
                                        Text(team.mark).font(.caption.weight(.black)).foregroundStyle(team.color)
                                    }.frame(width: 46, height: 46)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(team.name.uppercased()).font(.headline.weight(.black)).foregroundStyle(.white)
                                        Text(team.conference.uppercased()).font(.caption2.weight(.black)).tracking(1).foregroundStyle(.white.opacity(0.48))
                                    }
                                    Spacer()
                                    if savingId == team.id { ProgressView().tint(identity.accent) }
                                    else if FootballTeamCatalog.team(forTeamId: selectedTeamId, sportId: sportId) == team {
                                        Image(systemName: "heart.fill").foregroundStyle(identity.accent)
                                    }
                                }
                                .padding(12).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16))
                                .overlay(RoundedRectangle(cornerRadius: 16).stroke(FootballTeamCatalog.team(forTeamId: selectedTeamId, sportId: sportId) == team ? identity.accent : .white.opacity(0.1)))
                            }
                            .buttonStyle(.plain).disabled(savingId != nil)
                            .accessibilityLabel("Choose \(team.name) as your favorite team")
                        }
                    } header: {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(identity.isNFL ? "DECLARE YOUR NFL LOYALTY" : "DECLARE YOUR COLLEGE LOYALTY")
                                .font(.title2.weight(.black)).fontWidth(.condensed)
                            HStack {
                                Image(systemName: "magnifyingglass").foregroundStyle(identity.accent)
                                TextField("Search teams", text: $search).textInputAutocapitalization(.words).autocorrectionDisabled()
                            }
                            .padding(12).background(.black.opacity(0.94), in: RoundedRectangle(cornerRadius: 13))
                            .overlay(RoundedRectangle(cornerRadius: 13).stroke(identity.accent.opacity(0.55)))
                            if let errorMessage { Text(errorMessage).font(.caption.weight(.bold)).foregroundStyle(.red) }
                        }
                        .padding(.vertical, 12).background(.black.opacity(0.96))
                    }
                }.padding(.horizontal, 16).padding(.bottom, 30)
            }
        }
        .navigationTitle("Favorite Team").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark)
    }

    @MainActor private func select(_ team: FootballTeam) async {
        guard let token = auth.token, let user = auth.user else { return }
        savingId = team.id; errorMessage = nil
        do {
            try await SupabaseAPI.saveFavoriteTeam(token: token, userId: user.id, sportId: sportId, teamId: team.name)
            selectedTeamId = FootballTeamCatalog.normalizedTeamId(team.name)
            dismiss()
        } catch { errorMessage = error.localizedDescription }
        savingId = nil
    }
}
