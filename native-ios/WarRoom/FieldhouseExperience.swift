import SwiftUI

enum WarRoomPostseasonStatus: Equatable {
    case championship(seed: Int)
    case activeNoBrass
    case toilet(seed: Int)
}

enum WarRoomPostseasonRule {
    static let qualifiersPerConference = 4

    static func status(conferenceRank: Int, conferencePlayerCount: Int) -> WarRoomPostseasonStatus {
        let count = max(1, conferencePlayerCount)
        let safeRank = min(max(1, conferenceRank), count)
        let field = min(qualifiersPerConference, count / 2)
        if safeRank <= field { return .championship(seed: safeRank) }
        if safeRank > count - field { return .toilet(seed: safeRank - (count - field)) }
        return .activeNoBrass
    }

    static func counts(conferencePlayerCount: Int) -> (championship: Int, activeNoBrass: Int, toilet: Int) {
        let count = max(0, conferencePlayerCount)
        let field = min(qualifiersPerConference, count / 2)
        return (field, count - (field * 2), field)
    }

    static func leagueCounts(conferencePlayerCounts: [Int]) -> (championship: Int, activeNoBrass: Int, toilet: Int) {
        var championship = 0
        var activeNoBrass = 0
        var toilet = 0
        for playerCount in conferencePlayerCounts {
            let conference = counts(conferencePlayerCount: playerCount)
            championship += conference.championship
            activeNoBrass += conference.activeNoBrass
            toilet += conference.toilet
        }
        return (championship, activeNoBrass, toilet)
    }
}

enum FieldhouseRegion: String, CaseIterable, Identifiable {
    case east = "EAST"
    case west = "WEST"
    case south = "SOUTH"
    case midwest = "MIDWEST"
    var id: String { rawValue }
}

enum FieldhouseDesk: String, CaseIterable, Identifiable {
    case home = "Home"
    case picks = "Picks"
    case regions = "Regions"
    case brackets = "Brackets"
    case dispatch = "Dispatch"
    case locker = "Locker"
    case profile = "Profile"
    var id: String { rawValue }
    var icon: String {
        switch self {
        case .home: "house.fill"
        case .picks: "basketball.fill"
        case .regions: "square.grid.2x2.fill"
        case .brackets: "point.3.connected.trianglepath.dotted"
        case .dispatch: "newspaper.fill"
        case .locker: "bubble.left.and.bubble.right.fill"
        case .profile: "person.crop.circle.fill"
        }
    }
    var accent: Color {
        switch self {
        case .home: .orange
        case .picks: Color(red: 0.95, green: 0.72, blue: 0.12)
        case .regions: Color(red: 0.18, green: 0.74, blue: 0.72)
        case .brackets: Color(red: 0.88, green: 0.16, blue: 0.23)
        case .dispatch: Color(red: 0.76, green: 0.70, blue: 0.58)
        case .locker: Color(red: 0.55, green: 0.35, blue: 0.88)
        case .profile: Color(red: 0.25, green: 0.55, blue: 0.94)
        }
    }
    var floorTone: Color {
        switch self {
        case .home: Color(red: 0.15, green: 0.055, blue: 0.012)
        case .picks: Color(red: 0.15, green: 0.10, blue: 0.015)
        case .regions: Color(red: 0.015, green: 0.12, blue: 0.11)
        case .brackets: Color(red: 0.14, green: 0.018, blue: 0.025)
        case .dispatch: Color(red: 0.105, green: 0.085, blue: 0.055)
        case .locker: Color(red: 0.075, green: 0.035, blue: 0.13)
        case .profile: Color(red: 0.02, green: 0.065, blue: 0.14)
        }
    }
}

struct FieldhouseSeasonState {
    var week = 1
    var conferencePlayerCounts = [25, 25, 25, 25]
    var conferenceRank = 5
    var regularHellfiresUsed = 0
    var bracketHellfireUsed = false
    var bracketLocked = false
    var bracketPicks: [String: String] = [:]
    var selectedRegion: FieldhouseRegion = .midwest
    var weeklyPicks: [Int: Int] = [:]
    var confidenceByGame = [1: 5, 2: 4, 3: 3, 4: 2, 5: 1]
    var bestBetGame: Int?
    var propAnswer: Bool?
    var weeklyCardLocked = false
    var leagueName = "TEST FIELDHOUSE"
    var commissionerMode = true
    var invitesEnabled = true
    var conferenceAssignment = "MIDWEST"

    var regularHellfiresRemaining: Int { max(0, 2 - regularHellfiresUsed) }
    var weeklyCardComplete: Bool { weeklyPicks.count == 5 && bestBetGame != nil && propAnswer != nil }
    var postseasonStatus: WarRoomPostseasonStatus {
        WarRoomPostseasonRule.status(
            conferenceRank: conferenceRank,
            conferencePlayerCount: conferencePlayerCounts.first ?? 1
        )
    }
}

private struct FieldhouseStanding: Identifiable {
    let id = UUID()
    let rank: Int
    let handle: String
    let record: String
    let points: Int
}

private enum FieldhouseFixtures {
    static let teams = [
        ("HOME CHALK", "ROAD DOGS"),
        ("BLUE BLOODS", "CITY STATE"),
        ("NORTH TECH", "SOUTHERN A&M"),
        ("CAPITAL U", "LAKE COLLEGE"),
        ("PRAIRIE STATE", "COASTAL TECH")
    ]
    static let standings = [
        FieldhouseStanding(rank: 1, handle: "RIM REAPER", record: "38–12", points: 412),
        FieldhouseStanding(rank: 2, handle: "PRESS BREAK", record: "36–14", points: 398),
        FieldhouseStanding(rank: 3, handle: "THE BIG FUNDAMENTAL", record: "35–15", points: 390),
        FieldhouseStanding(rank: 4, handle: "GLASS CLEANER", record: "33–17", points: 377),
        FieldhouseStanding(rank: 5, handle: "MIKE", record: "32–18", points: 369),
        FieldhouseStanding(rank: 6, handle: "BASELINE BANDIT", record: "31–19", points: 361),
        FieldhouseStanding(rank: 7, handle: "ZONE BUSTER", record: "30–20", points: 355),
        FieldhouseStanding(rank: 8, handle: "SIXTH MAN", record: "29–21", points: 348),
        FieldhouseStanding(rank: 9, handle: "PAINT PATROL", record: "28–22", points: 341),
        FieldhouseStanding(rank: 10, handle: "SHOT CLOCK", record: "27–23", points: 335),
        FieldhouseStanding(rank: 11, handle: "BACKBOARD", record: "26–24", points: 329),
        FieldhouseStanding(rank: 12, handle: "HARDWOOD", record: "25–25", points: 320),
        FieldhouseStanding(rank: 13, handle: "THE WALK-ON", record: "24–26", points: 314),
        FieldhouseStanding(rank: 14, handle: "FULL COURT", record: "23–27", points: 306),
        FieldhouseStanding(rank: 15, handle: "ELBOW JUMPER", record: "22–28", points: 299),
        FieldhouseStanding(rank: 16, handle: "IRON KIND", record: "21–29", points: 291),
        FieldhouseStanding(rank: 17, handle: "BRICK CITY", record: "20–30", points: 284),
        FieldhouseStanding(rank: 18, handle: "FOUL TROUBLE", record: "19–31", points: 276),
        FieldhouseStanding(rank: 19, handle: "BENCH MOB", record: "18–32", points: 268),
        FieldhouseStanding(rank: 20, handle: "AIR BALL", record: "17–33", points: 260),
        FieldhouseStanding(rank: 21, handle: "LATE WHISTLE", record: "16–34", points: 252),
        FieldhouseStanding(rank: 22, handle: "BAD BOUNCE", record: "15–35", points: 244),
        FieldhouseStanding(rank: 23, handle: "COLD STREAK", record: "14–36", points: 236),
        FieldhouseStanding(rank: 24, handle: "TRANSFER PORTAL", record: "13–37", points: 228),
        FieldhouseStanding(rank: 25, handle: "LAST POSSESSION", record: "12–38", points: 220)
    ]
}

struct FieldhouseNativePreviewView: View {
    @State private var desk: FieldhouseDesk = .home
    @State private var state = FieldhouseSeasonState()
    @State private var strikePresentation: StrikePresentation?

    var body: some View {
        ZStack {
            FieldhouseBackdrop(desk: desk).ignoresSafeArea()
            VStack(spacing: 0) {
                FieldhouseHeader(state: state, desk: desk)
                FieldhouseDeskRail(selection: $desk)
                if desk == .brackets {
                    FieldhouseBracketStickyProgress(state: state)
                        .padding(.horizontal, 14)
                        .padding(.bottom, 8)
                        .background(.black.opacity(0.62))
                }
                ScrollView {
                    Group {
                        switch desk {
                        case .home: FieldhouseHomePage(state: $state, desk: $desk)
                        case .picks: FieldhousePicksPage(state: $state, strikePresentation: $strikePresentation)
                        case .regions: FieldhouseRegionsPage(state: $state)
                        case .brackets: FieldhouseBracketsPage(state: $state, strikePresentation: $strikePresentation)
                        case .dispatch: FieldhouseDispatchPage(state: $state)
                        case .locker: FieldhouseLockerPage(state: state)
                        case .profile: FieldhouseProfilePage(state: $state)
                        }
                    }
                    .padding(14).padding(.bottom, 30)
                }
                .id(desk)
            }
        }
        .preferredColorScheme(.dark)
        .fullScreenCover(item: $strikePresentation) { presentation in
            WeaponStrikeVideoView(presentation: presentation) { strikePresentation = nil }
        }
    }
}

private struct FieldhouseBackdrop: View {
    let desk: FieldhouseDesk
    var body: some View {
        ZStack {
            LinearGradient(colors: [.black, desk.floorTone, .black], startPoint: .topLeading, endPoint: .bottomTrailing)
            Canvas { context, size in
                let paint = desk.accent.opacity(0.075)
                for x in stride(from: 0.0, through: size.width, by: 34) {
                    context.fill(Path(CGRect(x: x, y: 0, width: 1, height: size.height)), with: .color(paint))
                }
                context.stroke(Path { path in
                    path.move(to: CGPoint(x: size.width / 2, y: 0)); path.addLine(to: CGPoint(x: size.width / 2, y: size.height))
                    path.addEllipse(in: CGRect(x: size.width / 2 - 92, y: size.height / 2 - 92, width: 184, height: 184))
                }, with: .color(desk.accent.opacity(0.16)), lineWidth: 2)
            }
        }
    }
}

private struct FieldhouseHeader: View {
    let state: FieldhouseSeasonState
    let desk: FieldhouseDesk
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Label("NCAA DIVISION I", systemImage: "basketball.fill").font(.system(size: 9, weight: .black)).tracking(1.8).foregroundStyle(desk.accent)
                Spacer(); Text(desk.rawValue.uppercased()).font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(.white.opacity(0.42))
            }
            Text("THE FIELDHOUSE").font(.system(size: 31, weight: .black)).fontWidth(.condensed)
            Text("REGULAR SEASON · WEEK \(state.week) OF 18 · FOUR REGIONS").font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.55))
        }
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 13)
        .background(.black.opacity(0.78)).overlay(alignment: .bottom) { Rectangle().fill(LinearGradient(colors: [.clear, desk.accent, .clear], startPoint: .leading, endPoint: .trailing)).frame(height: 2) }
    }
}

private struct FieldhouseDeskRail: View {
    @Binding var selection: FieldhouseDesk
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(FieldhouseDesk.allCases) { desk in
                    Button { selection = desk } label: {
                        Label(desk.rawValue, systemImage: desk.icon).font(.caption2.weight(.black)).padding(.horizontal, 11).frame(height: 38)
                            .foregroundStyle(selection == desk ? .black : .white)
                            .background(selection == desk ? desk.accent : Color.white.opacity(0.07), in: Capsule())
                    }.buttonStyle(.plain)
                }
            }.padding(.horizontal, 12).padding(.vertical, 9)
        }.background(.black.opacity(0.62))
    }
}

private struct FieldhouseHomePage: View {
    @Binding var state: FieldhouseSeasonState
    @Binding var desk: FieldhouseDesk
    var body: some View {
        VStack(spacing: 13) {
            FieldhouseHero(kicker: "SEASON COMMAND · OPENING TIP", title: "LOCK THE CARD.\nOWN THE FLOOR.", detail: "Five games. Confidence 5 through 1. One Best Bet. One weekly prop.", icon: "basketball.fill")
            HStack(spacing: 10) {
                FieldhouseMetric(value: "#\(state.conferenceRank)", label: "CONFERENCE SEED")
                FieldhouseMetric(value: "\(state.regularHellfiresRemaining)/2", label: "HELLFIRES READY")
            }
            postseasonCard
            seasonRoadmap
            Button { desk = .picks } label: { FieldhouseAction(kicker: "WEEK \(state.week) · CARD OPEN", title: "Make Your Picks", detail: "The hardwood remembers every decision.", icon: "arrow.right.circle.fill") }.buttonStyle(.plain)
            Button { desk = .regions } label: { FieldhouseAction(kicker: "REGIONAL WAR MAP", title: "Battle Toward the Middle", detail: "East, West, South, and Midwest each send survivors inward.", icon: "square.grid.2x2.fill") }.buttonStyle(.plain)
        }
    }

    private var seasonRoadmap: some View {
        VStack(alignment: .leading, spacing: 11) {
            Text("THE ROAD TO MARCH").font(.caption2.weight(.black)).tracking(1.7).foregroundStyle(.orange)
            seasonStop("1", "REGULAR SEASON", "Weeks 1–18", true)
            seasonStop("2", "CONFERENCE CHAMPIONSHIPS", "ACC · BIG 12 · BIG TEN · SEC", false)
            seasonStop("3", "SELECTION SUNDAY", "Field and seeds revealed", false)
            seasonStop("4", "NCAA TOURNAMENT", "First Four → National Championship", false)
        }.padding(16).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.orange.opacity(0.38)))
    }

    private func seasonStop(_ number: String, _ title: String, _ detail: String, _ active: Bool) -> some View {
        HStack(spacing: 11) {
            Text(number).font(.caption.weight(.black)).frame(width: 27, height: 27).foregroundStyle(active ? .black : .white.opacity(0.55)).background(active ? Color.orange : Color.white.opacity(0.08), in: Circle())
            VStack(alignment: .leading, spacing: 1) { Text(title).font(.caption.weight(.black)).foregroundStyle(active ? .orange : .white); Text(detail).font(.caption2).foregroundStyle(.white.opacity(0.5)) }
            Spacer(); Image(systemName: active ? "basketball.fill" : "lock.fill").font(.caption).foregroundStyle(active ? .orange : .white.opacity(0.24))
        }
    }

    private var postseasonCard: some View {
        let counts = WarRoomPostseasonRule.leagueCounts(conferencePlayerCounts: state.conferencePlayerCounts)
        return VStack(alignment: .leading, spacing: 8) {
            Text("THE FOUR-CONFERENCE CUT").font(.caption2.weight(.black)).tracking(1.7).foregroundStyle(.orange)
            HStack { cut("TOP", counts.championship, "CHAMPIONSHIP", .yellow); cut("MIDDLE", counts.activeNoBrass, "PICKS · NO BRASS", .white); cut("BOTTOM", counts.toilet, "TOILET BOWL", .purple) }
            Text("Each conference sends its top 4 and bottom 4. Everyone else keeps making March picks but cannot earn bracket brass.").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
        }.padding(16).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.orange.opacity(0.38)))
    }
    private func cut(_ label: String, _ value: Int, _ note: String, _ color: Color) -> some View { VStack(spacing: 3) { Text("\(value)").font(.title2.weight(.black)).foregroundStyle(color); Text(label).font(.system(size: 7, weight: .black)); Text(note).font(.system(size: 6, weight: .black)).foregroundStyle(.white.opacity(0.42)) }.frame(maxWidth: .infinity) }
}

private struct FieldhousePicksPage: View {
    @Binding var state: FieldhouseSeasonState
    @Binding var strikePresentation: StrikePresentation?
    @State private var confirmingHellfire = false
    @State private var confirmingLock = false
    var body: some View {
        VStack(spacing: 12) {
            FieldhouseHero(kicker: "SATURDAY CARD · WEEK \(state.week) OF 18", title: "FIVE GAMES.\nNO EMPTY POSSESSIONS.", detail: "Pick the spread, assign confidence, mark one Best Bet, and answer the floor prop.", icon: "list.number", accent: Color(red: 0.95, green: 0.72, blue: 0.12))
            ForEach(1...5, id: \.self) { game in
                gameCard(game)
            }
            propCard
            Button { confirmingHellfire = true } label: {
                FieldhouseAction(kicker: "REGULAR SEASON WEAPON · \(state.regularHellfiresRemaining)/2 REMAIN", title: "Deploy Hellfire", detail: "Fills this card with disciplined chalk. You still own the result.", icon: "scope", accent: Color(red: 0.95, green: 0.72, blue: 0.12))
            }.buttonStyle(.plain).disabled(state.regularHellfiresRemaining == 0 || state.weeklyCardLocked).opacity(state.regularHellfiresRemaining == 0 || state.weeklyCardLocked ? 0.45 : 1)
            Button { confirmingLock = true } label: {
                Label(state.weeklyCardLocked ? "WEEK \(state.week) CARD LOCKED" : "LOCK \(state.weeklyPicks.count)/5 PICKS", systemImage: state.weeklyCardLocked ? "lock.fill" : "checkmark.seal.fill")
                    .font(.caption.weight(.black)).tracking(1).frame(maxWidth: .infinity).padding(15)
                    .foregroundStyle(.black).background(state.weeklyCardLocked ? Color.gray : Color.orange, in: RoundedRectangle(cornerRadius: 14))
            }.buttonStyle(.plain).disabled(state.weeklyCardLocked || !state.weeklyCardComplete)
        }
        .alert("DEPLOY HELLFIRE?", isPresented: $confirmingHellfire) {
            Button("CANCEL", role: .cancel) {}
            Button("FILL THIS CARD", role: .destructive) { deployHellfire() }
        } message: { Text("Hellfire replaces every current selection on this weekly card and uses one of your two regular-season authorizations. You may still edit before locking.") }
        .alert("LOCK WEEK \(state.week) CARD?", isPresented: $confirmingLock) {
            Button("KEEP EDITING", role: .cancel) {}
            Button("LOCK CARD", role: .destructive) { state.weeklyCardLocked = true }
        } message: { Text("Your five picks, confidence values, Best Bet, and floor prop will be sealed. This cannot be undone after the deadline.") }
    }

    private func gameCard(_ game: Int) -> some View {
        let matchup = FieldhouseFixtures.teams[game - 1]
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("COURT \(game) · CONFIDENCE \(state.confidenceByGame[game] ?? 0)").font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(.orange)
                Spacer()
                Button { state.bestBetGame = state.bestBetGame == game ? nil : game } label: {
                    Label("BEST BET", systemImage: state.bestBetGame == game ? "star.fill" : "star")
                        .font(.system(size: 8, weight: .black)).foregroundStyle(state.bestBetGame == game ? .yellow : .white.opacity(0.5))
                }.buttonStyle(.plain).disabled(state.weeklyCardLocked)
            }
            HStack(spacing: 8) {
                sideButton(matchup.0 + " −\(game).5", game: game, side: 0)
                sideButton(matchup.1 + " +\(game).5", game: game, side: 1)
            }
        }.padding(14).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(state.bestBetGame == game ? .yellow.opacity(0.65) : .orange.opacity(0.22), lineWidth: state.bestBetGame == game ? 2 : 1))
    }

    private func sideButton(_ title: String, game: Int, side: Int) -> some View {
        Button { state.weeklyPicks[game] = side } label: {
            HStack { Text(title).font(.caption2.weight(.black)).lineLimit(2); Spacer(); Image(systemName: state.weeklyPicks[game] == side ? "checkmark.circle.fill" : "circle") }
                .padding(10).frame(maxWidth: .infinity, minHeight: 50).background(state.weeklyPicks[game] == side ? Color.orange.opacity(0.2) : Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
        }.buttonStyle(.plain).disabled(state.weeklyCardLocked)
    }

    private var propCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("THE FLOOR PROP").font(.system(size: 8, weight: .black)).tracking(1.3).foregroundStyle(.orange)
            Text("Will the five featured games combine for 12 or more made three-pointers in the final five minutes?").font(.subheadline.weight(.bold))
            HStack(spacing: 8) {
                propButton("YES · LET IT FLY", answer: true)
                propButton("NO · CLOSE THE ARC", answer: false)
            }
        }.padding(14).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(.orange.opacity(0.22)))
    }

    private func propButton(_ title: String, answer: Bool) -> some View {
        Button { state.propAnswer = answer } label: {
            Label(title, systemImage: state.propAnswer == answer ? "checkmark.circle.fill" : "circle").font(.system(size: 9, weight: .black)).padding(10).frame(maxWidth: .infinity).background(state.propAnswer == answer ? Color.orange.opacity(0.2) : Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
        }.buttonStyle(.plain).disabled(state.weeklyCardLocked)
    }

    private func deployHellfire() {
        guard state.regularHellfiresRemaining > 0, !state.weeklyCardLocked else { return }
        state.weeklyPicks = Dictionary(uniqueKeysWithValues: (1...5).map { ($0, 0) })
        state.bestBetGame = 1
        state.propAnswer = true
        state.regularHellfiresUsed += 1
        strikePresentation = WeaponStrikeCatalog.presentation(for: "cbb")
    }
}

private struct FieldhouseRegionsPage: View {
    @Binding var state: FieldhouseSeasonState
    private let accent = Color(red: 0.18, green: 0.74, blue: 0.72)
    var body: some View {
        VStack(spacing: 13) {
            FieldhouseHero(kicker: "REGIONAL WAR MAP", title: "BATTLE IN YOUR REGION.\nSURVIVE TO THE MIDDLE.", detail: "Four regional fields advance independently. The center court belongs to the last survivors.", icon: "square.grid.2x2.fill", accent: Color(red: 0.18, green: 0.74, blue: 0.72))
            LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 10) {
                ForEach(FieldhouseRegion.allCases) { region in
                    Button { state.selectedRegion = region } label: {
                        VStack(alignment: .leading, spacing: 10) { HStack { Text(region.rawValue).font(.headline.weight(.black)); Spacer(); Image(systemName: state.selectedRegion == region ? "checkmark.circle.fill" : "circle").foregroundStyle(accent) }; Text("4 Championship seeds\n4 Toilet Bowl seeds").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.55)); HStack(spacing: 3) { ForEach(0..<4, id: \.self) { _ in Circle().fill(accent.opacity(0.8)).frame(width: 8, height: 8) }; Image(systemName: "arrow.right").font(.caption); Circle().fill(.yellow).frame(width: 13, height: 13) } }.padding(14).frame(maxWidth: .infinity, alignment: .leading).background(.black.opacity(0.74), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(state.selectedRegion == region ? accent : .white.opacity(0.12), lineWidth: state.selectedRegion == region ? 2 : 1))
                    }.buttonStyle(.plain)
                }
            }
            regionalStandings
            Text("EAST + WEST + SOUTH + MIDWEST  →  CENTER COURT").font(.caption.weight(.black)).tracking(1).foregroundStyle(accent).padding(14).frame(maxWidth: .infinity).background(accent.opacity(0.1), in: Capsule())
        }
    }

    private var regionalStandings: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack { Text("\(state.selectedRegion.rawValue) CONFERENCE").font(.caption.weight(.black)).tracking(1.2).foregroundStyle(accent); Spacer(); Text("25 PLAYERS").font(.system(size: 8, weight: .black)).foregroundStyle(.white.opacity(0.45)) }.padding(14)
            Text("CHAMPIONSHIP CUT · TOP 4").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.yellow).padding(.horizontal, 14).padding(.bottom, 6)
            ForEach(FieldhouseFixtures.standings) { player in
                standingRow(player)
                if player.rank == 4 { cutLine("CHAMPIONSHIP LINE", .yellow) }
                if player.rank == 21 { cutLine("TOILET BOWL LINE", .purple) }
            }
            Text("TOILET BOWL CUT · BOTTOM 4").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.purple).padding(14)
        }.background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 17)).overlay(RoundedRectangle(cornerRadius: 17).stroke(accent.opacity(0.28)))
    }

    private func standingRow(_ player: FieldhouseStanding) -> some View {
        HStack(spacing: 10) {
            Text("#\(player.rank)").font(.caption.weight(.black)).foregroundStyle(player.rank <= 4 ? .yellow : player.rank >= 22 ? .purple : .white.opacity(0.52)).frame(width: 28, alignment: .leading)
            Text(player.handle).font(.caption.weight(player.handle == "MIKE" ? .black : .bold)).foregroundStyle(player.handle == "MIKE" ? accent : .white)
            Spacer()
            Text(player.record).font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.5))
            Text("\(player.points)").font(.caption.weight(.black)).frame(width: 30, alignment: .trailing)
        }.padding(.horizontal, 14).padding(.vertical, 9).background(player.handle == "MIKE" ? accent.opacity(0.13) : Color.clear)
    }

    private func cutLine(_ label: String, _ color: Color) -> some View {
        HStack(spacing: 8) { Rectangle().fill(color).frame(height: 2); Text(label).font(.system(size: 7, weight: .black)).foregroundStyle(color); Rectangle().fill(color).frame(height: 2) }.padding(.horizontal, 10)
    }
}

private struct FieldhouseBracketsPage: View {
    @Binding var state: FieldhouseSeasonState
    @Binding var strikePresentation: StrikePresentation?
    @State private var confirmingHellfire = false
    private let slate = FieldhouseTournamentFixture.slate

    var body: some View {
        VStack(spacing: 13) {
            FieldhouseHero(kicker: "NCAA TOURNAMENT · 68 TEAMS · 67 GAMES", title: "THE ROAD TO THE\nNATIONAL TITLE", detail: "A traditional round-by-round bracket from the First Four through the National Championship.", icon: "point.3.connected.trianglepath.dotted", accent: .red)
            tournamentPhaseRail
            bracketBoard
            Button { confirmingHellfire = true } label: {
                FieldhouseAction(kicker: "HELLFIRE · BRACKET WEAPON · ONE SHOT", title: state.bracketHellfireUsed ? "Hellfire Bracket Locked" : "Launch Hellfire Bracket", detail: state.bracketHellfireUsed ? "All 67 picks are sealed. No reroll." : "Hellfire fills a wild but complete bracket, plays the Fieldhouse strike video, then seals every pick.", icon: "scope", accent: .red)
            }.buttonStyle(.plain).disabled(state.bracketLocked).opacity(state.bracketLocked ? 0.55 : 1)
            Button { state.bracketLocked = true } label: {
                Label(state.bracketLocked ? "BRACKET SEALED" : "LOCK ALL 67 DECISIONS", systemImage: state.bracketLocked ? "lock.fill" : "checkmark.seal.fill")
                    .font(.caption.weight(.black)).tracking(1).frame(maxWidth: .infinity).padding(15)
                    .foregroundStyle(.black).background(state.bracketLocked ? Color.gray : Color.orange, in: RoundedRectangle(cornerRadius: 14))
            }.buttonStyle(.plain).disabled(state.bracketLocked || !FieldhouseBracketEngine.isComplete(picks: state.bracketPicks))
            Text("REGULAR SEASON HELLFIRE: 2/2 · BRACKET AI HELLFIRE: 1 TOTAL · NO REROLLS").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.48))
        }
        .alert("LAUNCH HELLFIRE BRACKET?", isPresented: $confirmingHellfire) {
            Button("CANCEL", role: .cancel) {}
            Button("LAUNCH & LOCK", role: .destructive) { launchHellfire() }
        } message: {
            Text("Hellfire will replace every current pick, fill all 67 decisions, and permanently lock your bracket. This cannot be undone and there are no rerolls.")
        }
    }

    private var tournamentPhaseRail: some View {
        HStack(spacing: 5) {
            ForEach(["FIRST FOUR", "R64", "R32", "S16", "E8", "FINAL 4", "TITLE"], id: \.self) { phase in
                Text(phase).font(.system(size: 6, weight: .black)).tracking(0.4).padding(.vertical, 8).frame(maxWidth: .infinity).background(.red.opacity(0.14), in: Capsule()).foregroundStyle(.white.opacity(0.72))
            }
        }
    }

    private var bracketBoard: some View {
        let resolved = FieldhouseBracketEngine.resolvedGames(slate: slate, picks: state.bracketPicks)
        return ScrollView(.horizontal, showsIndicators: true) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(0..<7, id: \.self) { round in
                    VStack(spacing: max(8, CGFloat(round * 5))) {
                        Text(roundName(round)).font(.caption2.weight(.black)).tracking(1).foregroundStyle(.red).frame(maxWidth: .infinity, alignment: .leading)
                        ForEach(resolved.filter { $0.game.round == round }) { game in
                            bracketGame(game).frame(width: 218)
                        }
                    }.frame(width: 218)
                }
            }.padding(.horizontal, 2).padding(.bottom, 8)
        }
        .padding(12).background(Color(red: 0.045, green: 0.045, blue: 0.05).opacity(0.96), in: RoundedRectangle(cornerRadius: 17)).overlay(RoundedRectangle(cornerRadius: 17).stroke(.red.opacity(0.38)))
    }

    private func bracketGame(_ resolved: FieldhouseResolvedGame) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Text(gameLabel(resolved.game)).font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(.red)
                Spacer()
                if let winner = state.bracketPicks[resolved.id] { Label("PICKED", systemImage: "checkmark.circle.fill").font(.system(size: 7, weight: .black)).foregroundStyle(winner.isEmpty ? .clear : .green) }
            }
            if resolved.teams.count == 2 {
                ForEach(resolved.teams) { team in
                    Button { select(team: team, in: resolved.game) } label: {
                        HStack(spacing: 10) {
                            Text("#\(team.seed)").font(.caption.weight(.black)).foregroundStyle(.red).frame(width: 27)
                            Text(team.name.uppercased()).font(.subheadline.weight(.black))
                            Spacer()
                            Image(systemName: state.bracketPicks[resolved.id] == team.id ? "checkmark.circle.fill" : "circle").foregroundStyle(.red)
                        }.padding(11).background(state.bracketPicks[resolved.id] == team.id ? Color.red.opacity(0.16) : Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 10))
                    }.buttonStyle(.plain).disabled(state.bracketLocked)
                }
            } else {
                Label("Waiting on earlier winners", systemImage: "hourglass").font(.caption.weight(.bold)).foregroundStyle(.white.opacity(0.45)).padding(.vertical, 8)
            }
        }.padding(14).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.red.opacity(0.22)))
    }

    private func select(team: FieldhouseTournamentTeam, in game: FieldhouseTournamentGame) {
        guard !state.bracketLocked else { return }
        if state.bracketPicks[game.id] != team.id {
            FieldhouseBracketEngine.clearDownstream(after: game.id, games: slate.games, picks: &state.bracketPicks)
            state.bracketPicks[game.id] = team.id
        }
    }

    private func launchHellfire() {
        guard !state.bracketLocked, !state.bracketHellfireUsed else { return }
        state.bracketPicks = FieldhouseBracketEngine.hellfirePicks(slate: slate)
        state.bracketHellfireUsed = true
        state.bracketLocked = true
        strikePresentation = WeaponStrikeCatalog.presentation(for: "cbb")
    }

    private func roundName(_ round: Int) -> String {
        ["FIRST FOUR", "R64", "R32", "SWEET 16", "ELITE 8", "FINAL FOUR", "TITLE"][round]
    }

    private func gameLabel(_ game: FieldhouseTournamentGame) -> String {
        "\(roundName(game.round)) · \(game.id.replacingOccurrences(of: "-", with: " ").uppercased())"
    }
}

private struct FieldhouseBracketStickyProgress: View {
    let state: FieldhouseSeasonState

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().stroke(.white.opacity(0.12), lineWidth: 4)
                Circle()
                    .trim(from: 0, to: CGFloat(state.bracketPicks.count) / 67)
                    .stroke(.orange, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(state.bracketPicks.count)").font(.caption.weight(.black))
            }.frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(state.bracketLocked ? "THE SHEET IS SEALED" : "\(67 - state.bracketPicks.count) DECISIONS REMAIN")
                    .font(.caption.weight(.black)).tracking(1).foregroundStyle(.orange)
                Text(state.bracketLocked ? "Full receipt preserved." : "Complete matchups to unlock the next round.")
                    .font(.caption2.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
            }
            Spacer()
            Image(systemName: state.bracketLocked ? "lock.fill" : "lock.open.fill").foregroundStyle(.orange)
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .background(.black.opacity(0.94), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(.orange.opacity(0.38)))
    }
}

private struct FieldhouseDispatchPage: View {
    @Binding var state: FieldhouseSeasonState
    @State private var section = 0
    private let championships = [
        ("ACC", "CHARLOTTE", "CROWN THE COAST"),
        ("BIG 12", "KANSAS CITY", "SURVIVE THE SPRINT"),
        ("BIG TEN", "INDIANAPOLIS", "OWN THE PAINT"),
        ("SEC", "NASHVILLE", "LAST TEAM STANDING")
    ]
    var body: some View {
        VStack(spacing: 13) {
            FieldhouseHero(kicker: "THE FIELDHOUSE DISPATCH · WEEK \(state.week)", title: "SCORES. STORIES.\nTHE ROAD TO MARCH.", detail: "Weekly results, conference tournament boards, Selection Sunday, and NCAA Tournament updates.", icon: "newspaper.fill", accent: Color(red: 0.76, green: 0.70, blue: 0.58))
            Picker("Dispatch section", selection: $section) { Text("THIS WEEK").tag(0); Text("CHAMPIONSHIPS").tag(1); Text("MARCH").tag(2) }.pickerStyle(.segmented).tint(Color(red: 0.76, green: 0.70, blue: 0.58))
            if section == 0 { weeklyDispatch }
            else if section == 1 { conferenceChampionships }
            else { marchCalendar }
        }
    }
    private var weeklyDispatch: some View {
        VStack(spacing: 10) {
            dispatchStory("FINAL HORN", "THREE RANKED TEAMS GO DOWN", "Road teams covered three of five featured games. The Week \(state.week) Best Bet board finished 61%.", "basketball.fill")
            dispatchStory("REGIONAL MOVEMENT", "MIDWEST TIGHTENS AT THE CUT", "Only 14 points separate seeds 3 through 7 heading into Saturday.", "chart.line.uptrend.xyaxis")
            dispatchStory("NEXT TIP", "WEEK \(min(18, state.week + 1)) CARD", "Five new Division I matchups post after the final scores are certified.", "calendar")
        }
    }
    private var conferenceChampionships: some View {
        VStack(spacing: 10) {
            Text("CONFERENCE CHAMPIONSHIP WEEK").font(.caption.weight(.black)).tracking(1.3).foregroundStyle(Color(red: 0.76, green: 0.70, blue: 0.58)).frame(maxWidth: .infinity, alignment: .leading)
            ForEach(championships, id: \.0) { league in
                HStack(spacing: 12) {
                    Text(league.0).font(.headline.weight(.black)).frame(width: 64, height: 64).foregroundStyle(.black).background(Color(red: 0.76, green: 0.70, blue: 0.58), in: RoundedRectangle(cornerRadius: 12))
                    VStack(alignment: .leading, spacing: 3) { Text(league.2).font(.subheadline.weight(.black)); Text("\(league.1) · CHAMPIONSHIP BRACKET").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.5)); Text("Bracket opens after the regular-season standings are final.").font(.caption2).foregroundStyle(.white.opacity(0.5)) }
                    Spacer(); Image(systemName: "chevron.right").foregroundStyle(Color(red: 0.76, green: 0.70, blue: 0.58))
                }.padding(12).background(Color(red: 0.12, green: 0.105, blue: 0.08).opacity(0.95), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(Color(red: 0.76, green: 0.70, blue: 0.58).opacity(0.28)))
            }
        }
    }
    private var marchCalendar: some View {
        VStack(spacing: 8) {
            marchStop("SELECTION SUNDAY", "68-team field and four regions revealed", "1")
            marchStop("FIRST FOUR", "Four opening games", "2")
            marchStop("FIRST + SECOND ROUNDS", "Round of 64 and Round of 32", "3")
            marchStop("REGIONALS", "Sweet 16 and Elite Eight", "4")
            marchStop("FINAL FOUR", "National Semifinals", "5")
            marchStop("NATIONAL CHAMPIONSHIP", "One bracket survives", "6")
        }
    }
    private func dispatchStory(_ kicker: String, _ title: String, _ detail: String, _ icon: String) -> some View {
        HStack(alignment: .top, spacing: 12) { Image(systemName: icon).foregroundStyle(Color(red: 0.76, green: 0.70, blue: 0.58)).frame(width: 34, height: 34).background(.white.opacity(0.06), in: Circle()); VStack(alignment: .leading, spacing: 4) { Text(kicker).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(Color(red: 0.76, green: 0.70, blue: 0.58)); Text(title).font(.headline.weight(.black)); Text(detail).font(.caption).foregroundStyle(.white.opacity(0.55)) }; Spacer() }.padding(15).background(Color(red: 0.12, green: 0.105, blue: 0.08).opacity(0.95), in: RoundedRectangle(cornerRadius: 15))
    }
    private func marchStop(_ title: String, _ detail: String, _ number: String) -> some View {
        HStack(spacing: 12) { Text(number).font(.headline.weight(.black)).foregroundStyle(.black).frame(width: 38, height: 38).background(Color(red: 0.76, green: 0.70, blue: 0.58), in: Circle()); VStack(alignment: .leading) { Text(title).font(.caption.weight(.black)); Text(detail).font(.caption2).foregroundStyle(.white.opacity(0.5)) }; Spacer() }.padding(12).background(.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 13))
    }
}

private struct FieldhouseLockerPage: View {
    let state: FieldhouseSeasonState
    var body: some View {
        VStack(spacing: 13) {
            FieldhouseHero(kicker: "THE TROPHY ROOM", title: "HARDWARE LIVES HERE.", detail: "Conference finishes, tournament runs, bracket crowns, and permanent Fieldhouse achievements.", icon: "trophy.fill", accent: .purple)
            qualificationCard
            HStack(spacing: 10) { hardware("0", "REGION TITLES", "medal.fill"); hardware("0", "BRACKET CROWNS", "crown.fill") }
            hardwareShelf
            receiptCard
        }
    }
    private var qualificationCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("CURRENT MARCH POSITION").font(.system(size: 8, weight: .black)).tracking(1.3).foregroundStyle(.purple)
            Text("#\(state.conferenceRank) · \(state.selectedRegion.rawValue)").font(.title2.weight(.black))
            Text(state.conferenceRank <= 4 ? "Inside the Championship cut." : state.conferenceRank >= 22 ? "Inside the Toilet Bowl cut." : "Still making March picks · no bracket brass position.").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
        }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(.purple.opacity(0.12), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.purple.opacity(0.42)))
    }
    private func hardware(_ value: String, _ label: String, _ icon: String) -> some View { VStack(spacing: 7) { Image(systemName: icon).font(.title2).foregroundStyle(.purple); Text(value).font(.title.weight(.black)); Text(label).font(.system(size: 7, weight: .black)).foregroundStyle(.white.opacity(0.5)) }.frame(maxWidth: .infinity).padding(15).background(.black.opacity(0.7), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.purple.opacity(0.25))) }
    private var hardwareShelf: some View {
        VStack(alignment: .leading, spacing: 11) { Text("ACHIEVEMENT SHELF").font(.caption2.weight(.black)).tracking(1.3).foregroundStyle(.purple); ForEach([("FIRST CARD", "Lock a complete five-game card"), ("PERFECT FIVE", "Hit every featured matchup"), ("MARCH SURVIVOR", "Reach the Sweet 16")], id: \.0) { item in HStack { Image(systemName: item.0 == "FIRST CARD" && state.weeklyCardLocked ? "checkmark.seal.fill" : "lock.fill").foregroundStyle(.purple); VStack(alignment: .leading) { Text(item.0).font(.caption.weight(.black)); Text(item.1).font(.caption2).foregroundStyle(.white.opacity(0.48)) }; Spacer() }.padding(10).background(.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 11)) } }.padding(15).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 16))
    }
    private var receiptCard: some View { VStack(alignment: .leading, spacing: 5) { Text("SEALED RECEIPTS").font(.caption2.weight(.black)).tracking(1.2).foregroundStyle(.purple); Text(state.weeklyCardLocked ? "Week \(state.week) · five picks · Best Bet · floor prop" : "No weekly card has been sealed yet.").font(.caption.weight(.semibold)); if state.bracketLocked { Text("NCAA Tournament · 67 picks · Hellfire authorized").font(.caption.weight(.semibold)) } }.padding(15).frame(maxWidth: .infinity, alignment: .leading).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.purple.opacity(0.25))) }
}

private struct FieldhouseProfilePage: View {
    @Binding var state: FieldhouseSeasonState
    @State private var showingCommissioner = false
    var body: some View {
        VStack(spacing: 13) {
            FieldhouseHero(kicker: "FIELDHOUSE IDENTITY", title: "YOUR HARDWOOD RECORD", detail: "Division I picks, regional standing, Hellfire history, bracket results, and league command.", icon: "person.text.rectangle.fill", accent: Color(red: 0.25, green: 0.55, blue: 0.94))
            profileCard
            HStack(spacing: 10) { blueMetric("\(state.regularHellfiresRemaining)/2", "HELLFIRES READY"); blueMetric("#\(state.conferenceRank)", "\(state.selectedRegion.rawValue) SEED") }
            seasonHistory
            if state.commissionerMode {
                Button { showingCommissioner = true } label: { FieldhouseAction(kicker: "COMMISSIONER ONLY", title: "League Setup", detail: "Manage the league identity, invites, and regional assignment.", icon: "person.3.fill", accent: Color(red: 0.25, green: 0.55, blue: 0.94)) }.buttonStyle(.plain)
            }
        }
        .sheet(isPresented: $showingCommissioner) { FieldhouseCommissionerSetup(state: $state) }
    }
    private var profileCard: some View { HStack(spacing: 13) { Text("MR").font(.title2.weight(.black)).foregroundStyle(.black).frame(width: 58, height: 58).background(Color(red: 0.25, green: 0.55, blue: 0.94), in: Circle()); VStack(alignment: .leading, spacing: 3) { Text("MIKE").font(.title3.weight(.black)); Text(state.leagueName).font(.caption.weight(.black)).foregroundStyle(Color(red: 0.25, green: 0.55, blue: 0.94)); Text("COMMISSIONER · NCAA DIVISION I").font(.caption2).foregroundStyle(.white.opacity(0.48)) }; Spacer() }.padding(15).background(.blue.opacity(0.1), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.blue.opacity(0.35))) }
    private func blueMetric(_ value: String, _ label: String) -> some View { VStack(spacing: 4) { Text(value).font(.title.weight(.black)).foregroundStyle(Color(red: 0.25, green: 0.55, blue: 0.94)); Text(label).font(.system(size: 8, weight: .black)).foregroundStyle(.white.opacity(0.5)) }.frame(maxWidth: .infinity).padding(15).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 15)) }
    private var seasonHistory: some View { VStack(alignment: .leading, spacing: 10) { Text("SEASON LEDGER").font(.caption2.weight(.black)).tracking(1.3).foregroundStyle(.blue); ledger("REGULAR SEASON", "Week \(state.week) of 18", state.weeklyCardLocked ? "CARD SEALED" : "CARD OPEN"); ledger("CONFERENCE CHAMPIONSHIPS", "ACC · Big 12 · Big Ten · SEC", "UPCOMING"); ledger("NCAA TOURNAMENT", state.bracketLocked ? "67 decisions recorded" : "Bracket not yet sealed", state.bracketLocked ? "SEALED" : "UPCOMING") }.padding(15).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.blue.opacity(0.25))) }
    private func ledger(_ phase: String, _ detail: String, _ status: String) -> some View { HStack { VStack(alignment: .leading) { Text(phase).font(.caption.weight(.black)); Text(detail).font(.caption2).foregroundStyle(.white.opacity(0.46)) }; Spacer(); Text(status).font(.system(size: 7, weight: .black)).foregroundStyle(.blue).padding(6).background(.blue.opacity(0.12), in: Capsule()) } }
}

private struct FieldhouseCommissionerSetup: View {
    @Binding var state: FieldhouseSeasonState
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            Form {
                Section("League identity") { TextField("League name", text: $state.leagueName); LabeledContent("Sport", value: "NCAA Division I Men's Basketball") }
                Section("Regional alignment") { Picker("Your region", selection: $state.selectedRegion) { ForEach(FieldhouseRegion.allCases) { Text($0.rawValue).tag($0) } }; LabeledContent("Format", value: "4 regions · 25 players each") }
                Section("Membership") { Toggle("Accept new invitations", isOn: $state.invitesEnabled); LabeledContent("Current field", value: "100 players") }
                Section("Season format") { LabeledContent("Regular season", value: "18 weeks"); LabeledContent("Conference championships", value: "ACC · Big 12 · Big Ten · SEC"); LabeledContent("March field", value: "Top 4 + bottom 4 per region") }
                Section { Text("Foundry preview only. These controls do not change the live league or production database.").font(.caption).foregroundStyle(.secondary) }
            }.navigationTitle("League Setup").toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }.preferredColorScheme(.dark)
    }
}

private struct FieldhouseHero: View { let kicker: String; let title: String; let detail: String; let icon: String; var accent: Color = .orange; var body: some View { VStack(alignment: .leading, spacing: 10) { Label(kicker, systemImage: icon).font(.system(size: 9, weight: .black)).tracking(1.5).foregroundStyle(accent); Text(title).font(.system(size: 29, weight: .black)).fontWidth(.condensed); Text(detail).font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.62)) }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(LinearGradient(colors: [accent.opacity(0.24), .black.opacity(0.86)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 19)).overlay(RoundedRectangle(cornerRadius: 19).stroke(accent.opacity(0.52))) } }
private struct FieldhouseAction: View { let kicker: String; let title: String; let detail: String; let icon: String; var accent: Color = .orange; var body: some View { HStack(spacing: 13) { Image(systemName: icon).font(.title2.weight(.black)).foregroundStyle(accent).frame(width: 45, height: 45).background(accent.opacity(0.12), in: Circle()); VStack(alignment: .leading, spacing: 4) { Text(kicker).font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(accent); Text(title).font(.headline.weight(.black)); Text(detail).font(.caption).foregroundStyle(.white.opacity(0.55)) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(accent) }.padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.3))) } }
private struct FieldhouseMetric: View { let value: String; let label: String; var body: some View { VStack(spacing: 4) { Text(value).font(.title.weight(.black)).foregroundStyle(.orange); Text(label).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.5)) }.frame(maxWidth: .infinity).padding(15).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.orange.opacity(0.24))) } }
