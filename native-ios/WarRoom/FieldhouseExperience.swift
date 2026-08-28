import SwiftUI

enum WarRoomPostseasonStatus: Equatable {
    case championship(seed: Int)
    case activeNoBrass
    case toilet(seed: Int)
}

enum WarRoomPostseasonRule {
    static let fieldSize = 16

    static func status(rank: Int, playerCount: Int) -> WarRoomPostseasonStatus {
        let count = max(1, playerCount)
        let safeRank = min(max(1, rank), count)
        let field = min(fieldSize, count / 2)
        if safeRank <= field { return .championship(seed: safeRank) }
        if safeRank > count - field { return .toilet(seed: safeRank - (count - field)) }
        return .activeNoBrass
    }

    static func counts(playerCount: Int) -> (championship: Int, activeNoBrass: Int, toilet: Int) {
        let count = max(0, playerCount)
        let field = min(fieldSize, count / 2)
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
}

struct FieldhouseSeasonState {
    var window = 1
    var playerCount = 100
    var rank = 17
    var regularHellfiresUsed = 0
    var bracketHellfireUsed = false
    var bracketLocked = false
    var selectedRegion: FieldhouseRegion = .midwest

    var regularHellfiresRemaining: Int { max(0, 2 - regularHellfiresUsed) }
    var postseasonStatus: WarRoomPostseasonStatus {
        WarRoomPostseasonRule.status(rank: rank, playerCount: playerCount)
    }
}

struct FieldhouseNativePreviewView: View {
    @State private var desk: FieldhouseDesk = .home
    @State private var state = FieldhouseSeasonState()
    @State private var strikePresentation: StrikePresentation?

    var body: some View {
        ZStack {
            FieldhouseBackdrop().ignoresSafeArea()
            VStack(spacing: 0) {
                FieldhouseHeader(state: state)
                FieldhouseDeskRail(selection: $desk)
                ScrollView {
                    Group {
                        switch desk {
                        case .home: FieldhouseHomePage(state: $state, desk: $desk)
                        case .picks: FieldhousePicksPage(state: $state, strikePresentation: $strikePresentation)
                        case .regions: FieldhouseRegionsPage(state: $state)
                        case .brackets: FieldhouseBracketsPage(state: $state, strikePresentation: $strikePresentation)
                        case .dispatch: FieldhouseDispatchPage()
                        case .locker: FieldhouseLockerPage()
                        case .profile: FieldhouseProfilePage(state: state)
                        }
                    }
                    .padding(14).padding(.bottom, 30)
                }
            }
        }
        .preferredColorScheme(.dark)
        .fullScreenCover(item: $strikePresentation) { presentation in
            WeaponStrikeVideoView(presentation: presentation) { strikePresentation = nil }
        }
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
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
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

private struct FieldhouseDeskRail: View {
    @Binding var selection: FieldhouseDesk
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(FieldhouseDesk.allCases) { desk in
                    Button { selection = desk } label: {
                        Label(desk.rawValue, systemImage: desk.icon).font(.caption2.weight(.black)).padding(.horizontal, 11).frame(height: 38)
                            .foregroundStyle(selection == desk ? .black : .white)
                            .background(selection == desk ? Color.orange : Color.white.opacity(0.07), in: Capsule())
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
                FieldhouseMetric(value: "#\(state.rank)", label: "YOUR SEED LINE")
                FieldhouseMetric(value: "\(state.regularHellfiresRemaining)/2", label: "HELLFIRES READY")
            }
            postseasonCard
            Button { desk = .picks } label: { FieldhouseAction(kicker: "WINDOW \(state.window) · CARD OPEN", title: "Make Your Picks", detail: "The hardwood remembers every decision.", icon: "arrow.right.circle.fill") }.buttonStyle(.plain)
            Button { desk = .regions } label: { FieldhouseAction(kicker: "REGIONAL WAR MAP", title: "Battle Toward the Middle", detail: "East, West, South, and Midwest each send survivors inward.", icon: "square.grid.2x2.fill") }.buttonStyle(.plain)
        }
    }

    private var postseasonCard: some View {
        let counts = WarRoomPostseasonRule.counts(playerCount: state.playerCount)
        return VStack(alignment: .leading, spacing: 8) {
            Text("THE 100-PLAYER CUT").font(.caption2.weight(.black)).tracking(1.7).foregroundStyle(.orange)
            HStack { cut("TOP", counts.championship, "CHAMPIONSHIP", .yellow); cut("MIDDLE", counts.activeNoBrass, "PICKS · NO BRASS", .white); cut("BOTTOM", counts.toilet, "TOILET BOWL", .purple) }
            Text("Everyone keeps picking. Only the top 16 and bottom 16 can leave postseason with permanent hardware.").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
        }.padding(16).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.orange.opacity(0.38)))
    }
    private func cut(_ label: String, _ value: Int, _ note: String, _ color: Color) -> some View { VStack(spacing: 3) { Text("\(value)").font(.title2.weight(.black)).foregroundStyle(color); Text(label).font(.system(size: 7, weight: .black)); Text(note).font(.system(size: 6, weight: .black)).foregroundStyle(.white.opacity(0.42)) }.frame(maxWidth: .infinity) }
}

private struct FieldhousePicksPage: View {
    @Binding var state: FieldhouseSeasonState
    @Binding var strikePresentation: StrikePresentation?
    var body: some View {
        VStack(spacing: 12) {
            FieldhouseHero(kicker: "SATURDAY CARD · WINDOW \(state.window)", title: "FIVE GAMES.\nNO EMPTY POSSESSIONS.", detail: "Pick the spread, assign confidence, mark one Best Bet, and answer the floor prop.", icon: "list.number")
            ForEach(1...5, id: \.self) { game in
                HStack { VStack(alignment: .leading) { Text("COURT \(game)").font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(.orange); Text(game.isMultiple(of: 2) ? "ROAD DOGS  +\(game + 1).5" : "HOME CHALK  −\(game).5").font(.headline.weight(.black)); Text("Confidence \(6 - game) · tap a side").font(.caption).foregroundStyle(.secondary) }; Spacer(); Image(systemName: "basketball.fill").foregroundStyle(.orange) }.padding(14).background(.black.opacity(0.7), in: RoundedRectangle(cornerRadius: 13)).overlay(RoundedRectangle(cornerRadius: 13).stroke(.orange.opacity(0.22)))
            }
            Button { guard state.regularHellfiresRemaining > 0 else { return }; state.regularHellfiresUsed += 1; strikePresentation = WeaponStrikeCatalog.presentation(for: "cbb") } label: {
                FieldhouseAction(kicker: "REGULAR SEASON WEAPON · \(state.regularHellfiresRemaining)/2 REMAIN", title: "Deploy Hellfire", detail: "Fills this card with disciplined chalk. You still own the result.", icon: "scope")
            }.buttonStyle(.plain).disabled(state.regularHellfiresRemaining == 0).opacity(state.regularHellfiresRemaining == 0 ? 0.45 : 1)
        }
    }
}

private struct FieldhouseRegionsPage: View {
    @Binding var state: FieldhouseSeasonState
    var body: some View {
        VStack(spacing: 13) {
            FieldhouseHero(kicker: "REGIONAL WAR MAP", title: "BATTLE IN YOUR REGION.\nSURVIVE TO THE MIDDLE.", detail: "Four regional fields advance independently. The center court belongs to the last survivors.", icon: "square.grid.2x2.fill")
            LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 10) {
                ForEach(FieldhouseRegion.allCases) { region in
                    Button { state.selectedRegion = region } label: {
                        VStack(alignment: .leading, spacing: 10) { HStack { Text(region.rawValue).font(.headline.weight(.black)); Spacer(); Image(systemName: state.selectedRegion == region ? "checkmark.circle.fill" : "circle").foregroundStyle(.orange) }; Text("4 Championship seeds\n4 Toilet Bowl seeds").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.55)); HStack(spacing: 3) { ForEach(0..<4, id: \.self) { _ in Circle().fill(.orange.opacity(0.8)).frame(width: 8, height: 8) }; Image(systemName: "arrow.right").font(.caption); Circle().fill(.yellow).frame(width: 13, height: 13) } }.padding(14).frame(maxWidth: .infinity, alignment: .leading).background(.black.opacity(0.74), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(state.selectedRegion == region ? .orange : .white.opacity(0.12), lineWidth: state.selectedRegion == region ? 2 : 1))
                    }.buttonStyle(.plain)
                }
            }
            Text("EAST + WEST + SOUTH + MIDWEST  →  CENTER COURT").font(.caption.weight(.black)).tracking(1).foregroundStyle(.orange).padding(14).frame(maxWidth: .infinity).background(.orange.opacity(0.1), in: Capsule())
        }
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
private struct FieldhouseLockerPage: View { var body: some View { VStack(spacing: 13) { FieldhouseHero(kicker: "THE FIELDHOUSE TUNNEL", title: "TALK BEFORE THE HORN.", detail: "League-wide chatter, reactions, receipts, and pure hardwood language.", icon: "bubble.left.and.bubble.right.fill"); ForEach(["That bracket has six exits and you found all seven.", "Midwest to the middle. Book it.", "Two Hellfires and still down twelve."], id: \.self) { Text($0).font(.subheadline.weight(.bold)).padding(15).frame(maxWidth: .infinity, alignment: .leading).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 15)).overlay(alignment: .leading) { Rectangle().fill(.orange).frame(width: 3).padding(.vertical, 8) } } } } }
private struct FieldhouseProfilePage: View { let state: FieldhouseSeasonState; var body: some View { VStack(spacing: 13) { FieldhouseHero(kicker: "FIELDHOUSE PASSPORT", title: "HARDWOOD SERVICE RECORD", detail: "Regional finishes, bracket crowns, Hellfire authorizations, Cheevos, and permanent brass.", icon: "person.text.rectangle.fill"); HStack(spacing: 10) { FieldhouseMetric(value: "\(state.regularHellfiresUsed)", label: "HELLFIRES"); FieldhouseMetric(value: "\(state.rank)", label: "SEED LINE") }; FieldhouseAction(kicker: "PERMANENT HARDWARE", title: "Championship · Toilet Bowl · Bracket Crown", detail: "Only postseason qualifiers can add Championship or Toilet Bowl brass.", icon: "trophy.fill") } } }

private struct FieldhouseHero: View { let kicker: String; let title: String; let detail: String; let icon: String; var body: some View { VStack(alignment: .leading, spacing: 10) { Label(kicker, systemImage: icon).font(.system(size: 9, weight: .black)).tracking(1.5).foregroundStyle(.orange); Text(title).font(.system(size: 29, weight: .black)).fontWidth(.condensed); Text(detail).font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.62)) }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(LinearGradient(colors: [.orange.opacity(0.24), .black.opacity(0.86)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 19)).overlay(RoundedRectangle(cornerRadius: 19).stroke(.orange.opacity(0.52))) } }
private struct FieldhouseAction: View { let kicker: String; let title: String; let detail: String; let icon: String; var body: some View { HStack(spacing: 13) { Image(systemName: icon).font(.title2.weight(.black)).foregroundStyle(.orange).frame(width: 45, height: 45).background(.orange.opacity(0.12), in: Circle()); VStack(alignment: .leading, spacing: 4) { Text(kicker).font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(.orange); Text(title).font(.headline.weight(.black)); Text(detail).font(.caption).foregroundStyle(.white.opacity(0.55)) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(.orange) }.padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.orange.opacity(0.3))) } }
private struct FieldhouseMetric: View { let value: String; let label: String; var body: some View { VStack(spacing: 4) { Text(value).font(.title.weight(.black)).foregroundStyle(.orange); Text(label).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.5)) }.frame(maxWidth: .infinity).padding(15).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.orange.opacity(0.24))) } }
