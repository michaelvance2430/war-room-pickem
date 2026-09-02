import SwiftUI

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

struct FieldhouseSeasonState {
    var window = 1
    var cardIsPublished = false
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

    var regularHellfiresRemaining: Int { max(0, 2 - regularHellfiresUsed) }
    var postseasonStatus: WarRoomPostseasonStatus {
        WarRoomPostseasonRule.status(rank: rank, playerCount: regionPlayerCount)
    }

    func confidenceAvailable(_ value: Int, for game: Int) -> Bool {
        !confidenceSelections.contains { $0.key != game && $0.value == value }
    }

    mutating func toggleConfidence(_ value: Int, for game: Int) {
        guard confidenceSelections[game] == value || confidenceAvailable(value, for: game) else { return }
        confidenceSelections[game] = confidenceSelections[game] == value ? nil : value
    }
}

struct FieldhouseNativePreviewView: View {
    @State private var desk: FieldhouseDesk = .home
    @State private var state = FieldhouseSeasonState()
    @State private var strikePresentation: StrikePresentation?
    @State private var showingEntrance = true
    @State private var showingSetup = false

    var body: some View {
        ZStack {
            FieldhouseBackdrop().ignoresSafeArea()
            VStack(spacing: 0) {
                if desk != .home {
                    FieldhouseHeader(state: state, canGoBack: true) { desk = .home }
                }
                if desk == .locker {
                    FieldhouseLockerPage().padding(.horizontal, 14)
                } else {
                    ScrollView {
                        Group {
                            switch desk {
                            case .home: FieldhouseHomePage(state: $state, desk: $desk)
                            case .picks: FieldhousePicksPage(state: $state, strikePresentation: $strikePresentation)
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
            FieldhouseBottomNavigation(selection: $desk)
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
                    TextField("Search all \(FieldhouseTeamCatalog.all.count) Division I teams", text: $searchText)
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
            Text("THE FIELDHOUSE").font(.system(size: 31, weight: .black)).fontWidth(.condensed)
            Text("WINDOW \(state.window) · FOUR REGIONS · ONE ROAD TO THE MIDDLE").font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.55))
        }
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 13)
        .background(.black.opacity(0.78)).overlay(alignment: .bottom) { Rectangle().fill(LinearGradient(colors: [.clear, .orange, .clear], startPoint: .leading, endPoint: .trailing)).frame(height: 2) }
    }
}

private struct FieldhouseBottomNavigation: View {
    @Binding var selection: FieldhouseDesk
    var body: some View {
        HStack(spacing: 0) {
            ForEach(FieldhouseDesk.allCases) { desk in
                Button { selection = desk } label: {
                    VStack(spacing: 4) {
                        Image(systemName: desk.icon).font(.system(size: 21, weight: .bold))
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
                Text("FOUR REGIONS · ONE ROAD TO THE MIDDLE")
                    .font(.system(size: 10, weight: .black)).tracking(1.8).foregroundStyle(.white.opacity(0.58))
                Spacer()
                Button(action: enter) {
                    Label("TAKE THE FLOOR", systemImage: "arrow.right.circle.fill")
                        .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(17)
                        .foregroundStyle(.black).background(.orange, in: RoundedRectangle(cornerRadius: 16))
                }.buttonStyle(.plain)
                Text("NCAA DIVISION I · MEN'S AND WOMEN'S COLLEGE BASKETBALL")
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
            Button { } label: {
                FieldhouseAction(kicker: "COMMISSIONER COMMAND", title: "Manage your league", detail: "Cards, players, regions, and season controls.", icon: "person.3.fill")
            }.buttonStyle(.plain)
            FieldhouseHero(
                kicker: state.cardIsPublished ? "THIS WINDOW · CARD LIVE" : "COMMISSIONER ACTION REQUIRED",
                title: state.cardIsPublished ? "MAKE YOUR PICKS" : "BUILD THE CARD",
                detail: state.cardIsPublished ? "Five games. Confidence 5 through 1. One Best Bet. One weekly prop." : "Pull the Division I board, select five games, write the prop, and publish Window \(state.window).",
                icon: state.cardIsPublished ? "checkmark.seal.fill" : "hammer.fill"
            )
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
                    kicker: state.cardIsPublished ? "WINDOW \(state.window) · CARD OPEN" : "COMMISSIONER COMMAND",
                    title: state.cardIsPublished ? "Make Your Picks" : "Build the Card",
                    detail: state.cardIsPublished ? "The hardwood remembers every decision." : "Choose the five-game board and release it to the room.",
                    icon: state.cardIsPublished ? "arrow.right.circle.fill" : "hammer.fill"
                )
            }.buttonStyle(.plain)
            Button { desk = .standings } label: { FieldhouseAction(kicker: "REGIONAL WAR MAP", title: "Battle Toward the Middle", detail: "East, West, South, and Midwest each send survivors inward.", icon: "square.grid.2x2.fill") }.buttonStyle(.plain)
        }
        .sheet(isPresented: $showingLeagueSwitcher) {
            FieldhouseLeagueSwitcher(dismiss: { showingLeagueSwitcher = false })
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showingCardBuilder) {
            FieldhouseCardBuilder(window: state.window) {
                state.cardIsPublished = true
                showingCardBuilder = false
            }
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

private struct FieldhouseCardBuilder: View {
    let window: Int
    let publish: () -> Void
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("WINDOW \(window) · COMMISSIONER").font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(.orange)
                Text("BUILD THE CARD").font(.system(size: 36, weight: .black)).fontWidth(.condensed)
                Text("Select five Division I games, confirm the spreads, then write the three-point floor prop.")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
                ForEach(1...5, id: \.self) { game in
                    HStack { Text("GAME \(game)").font(.caption.weight(.black)); Spacer(); Text("SELECT MATCHUP").font(.caption2.weight(.black)).foregroundStyle(.orange); Image(systemName: "chevron.right") }
                        .padding(14).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 13))
                }
                Button(action: publish) {
                    Text("PUBLISH WINDOW \(window)").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16).foregroundStyle(.black).background(.orange, in: RoundedRectangle(cornerRadius: 15))
                }.buttonStyle(.plain)
                Spacer()
            }.padding().background(FieldhouseBackdrop().ignoresSafeArea()).navigationTitle("Commissioner Command").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .topBarLeading) { Button("CANCEL") { dismiss() }.font(.caption.weight(.black)) } }
        }.preferredColorScheme(.dark)
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
                    Text("THE FIELDHOUSE").font(.system(size: 31, weight: .black)).fontWidth(.condensed)
                    Text("NCAA D1 · WINDOW \(state.window) · REGULAR SEASON")
                        .font(.system(size: 9, weight: .black)).tracking(1.2).foregroundStyle(.white.opacity(0.55))
                }
            }
            Divider().overlay(.orange.opacity(0.45))
            HStack {
                Label("SHOT CLOCK", systemImage: "timer").font(.caption2.weight(.black)).tracking(1.3)
                Spacer()
                Text("3D 04H 12M · FIRST TIP").font(.caption.weight(.black))
            }.foregroundStyle(.orange)
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
    let dismiss: () -> Void
    var body: some View {
        NavigationStack {
            VStack(spacing: 10) {
                ForEach([("CFB", "football.fill", "Saturday Situation Room"), ("NFL", "football.fill", "Sunday War Room"), ("FIELDHOUSE", "basketball.fill", "The Fieldhouse")], id: \.0) { sport, icon, league in
                    Button(action: dismiss) {
                        HStack {
                            Image(systemName: icon).foregroundStyle(sport == "FIELDHOUSE" ? .orange : .green).frame(width: 30)
                            VStack(alignment: .leading) { Text(sport).font(.caption.weight(.black)); Text(league).font(.headline.weight(.black)) }
                            Spacer(); Image(systemName: sport == "FIELDHOUSE" ? "checkmark.circle.fill" : "chevron.right")
                        }.padding(14).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
                    }.buttonStyle(.plain)
                }
                Spacer()
            }.padding().navigationTitle("Switch League").navigationBarTitleDisplayMode(.inline)
        }.preferredColorScheme(.dark)
    }
}

private struct FieldhousePicksPage: View {
    @Binding var state: FieldhouseSeasonState
    @Binding var strikePresentation: StrikePresentation?
    var body: some View {
        VStack(spacing: 12) {
            FieldhouseHero(kicker: "SATURDAY CARD · WINDOW \(state.window)", title: "FIVE GAMES.\nNO EMPTY POSSESSIONS.", detail: "Pick the spread, assign confidence, mark one Best Bet, and answer the floor prop.", icon: "list.number")
            Button { guard state.regularHellfiresRemaining > 0 else { return }; state.regularHellfiresUsed += 1; strikePresentation = WeaponStrikeCatalog.presentation(for: "cbb") } label: {
                FieldhouseAction(kicker: "HELLFIRE · \(state.regularHellfiresRemaining)/2 AVAILABLE", title: state.regularHellfiresRemaining == 0 ? "Hellfires Expended" : "Deploy Hellfire", detail: "Always visible before the first game. Uses one authorization and fills the card.", icon: "scope")
            }.buttonStyle(.plain).disabled(state.regularHellfiresRemaining == 0).opacity(state.regularHellfiresRemaining == 0 ? 0.45 : 1)
            ForEach(1...5, id: \.self) { game in
                gameCard(game)
            }
            VStack(alignment: .leading, spacing: 9) {
                Text("FLOOR PROP · 3 POINTS").font(.caption2.weight(.black)).tracking(1.4).foregroundStyle(.orange)
                Text("Will either ranked team trail at halftime?").font(.headline.weight(.black))
                HStack(spacing: 9) {
                    propButton("YES")
                    propButton("NO")
                }
            }.padding(15).background(.black.opacity(0.74), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.orange.opacity(0.28)))
        }
    }

    private func gameCard(_ game: Int) -> some View {
        let away = ["Gonzaga", "Auburn", "UConn", "Iowa State", "Baylor"][game - 1]
        let home = ["Duke", "Houston", "Kansas", "Tennessee", "Alabama"][game - 1]
        let selected = state.sideSelections[game]
        return VStack(alignment: .leading, spacing: 11) {
            HStack {
                Text("COURT \(game) · FIRST TIP 7:\(game)0 PM").font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(.orange)
                Spacer()
                Button {
                    state.bestBetGame = state.bestBetGame == game ? nil : game
                } label: {
                    Label("BEST BET", systemImage: state.bestBetGame == game ? "star.fill" : "star")
                        .font(.system(size: 8, weight: .black)).foregroundStyle(state.bestBetGame == game ? .yellow : .white.opacity(0.52))
                }.buttonStyle(.plain)
            }
            HStack(spacing: 8) {
                sideButton(away, game: game, selected: selected)
                Text("AT").font(.caption2.weight(.black)).foregroundStyle(.white.opacity(0.38))
                sideButton(home, game: game, selected: selected)
            }
            HStack(spacing: 7) {
                Text("CONFIDENCE").font(.system(size: 8, weight: .black)).foregroundStyle(.white.opacity(0.48))
                ForEach(1...5, id: \.self) { value in
                    let chosen = state.confidenceSelections[game] == value
                    let available = state.confidenceAvailable(value, for: game)
                    Button {
                        state.toggleConfidence(value, for: game)
                    } label: {
                        Text("\(value)").font(.caption.weight(.black)).frame(width: 32, height: 32)
                            .foregroundStyle(chosen ? .black : (available ? .white : .white.opacity(0.22)))
                            .background(chosen ? Color.orange : Color.white.opacity(0.07), in: Circle())
                    }.buttonStyle(.plain).disabled(!available)
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
        }.buttonStyle(.plain)
    }

    private func propButton(_ answer: String) -> some View {
        Button { state.propAnswer = state.propAnswer == answer ? nil : answer } label: {
            Text(answer).font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(13)
                .foregroundStyle(state.propAnswer == answer ? .black : .white)
                .background(state.propAnswer == answer ? Color.orange : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 11))
        }.buttonStyle(.plain)
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
                    standingRow(rank: index + 1, player: player, points: 87 - (index * 2))
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
