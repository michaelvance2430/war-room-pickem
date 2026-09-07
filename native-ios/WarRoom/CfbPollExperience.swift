import SwiftUI

struct CfbPollTeam: Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let record: String
    let apRank: Int
    let previousAPRank: Int?
    let firstPlaceVotes: Int
}

struct CfbMemberBallot: Equatable, Sendable {
    let voterID: String
    let rankedTeamIDs: [String]

    var isValid: Bool {
        rankedTeamIDs.count == 10 && Set(rankedTeamIDs).count == 10
    }
}

struct CfbMemberPollRow: Identifiable, Equatable, Sendable {
    let id: String
    let rank: Int
    let points: Int
    let firstPlaceVotes: Int
}

enum CfbMemberPollEngine {
    static let officialVoterMinimum = 4

    static func standings(ballots: [CfbMemberBallot]) -> [CfbMemberPollRow] {
        let valid = ballots.filter(\.isValid)
        var points: [String: Int] = [:]
        var firsts: [String: Int] = [:]
        for ballot in valid {
            for (index, teamID) in ballot.rankedTeamIDs.enumerated() {
                points[teamID, default: 0] += 10 - index
                if index == 0 { firsts[teamID, default: 0] += 1 }
            }
        }
        return points.keys.sorted {
            let lhs = points[$0, default: 0]
            let rhs = points[$1, default: 0]
            if lhs != rhs { return lhs > rhs }
            let lhsFirsts = firsts[$0, default: 0]
            let rhsFirsts = firsts[$1, default: 0]
            if lhsFirsts != rhsFirsts { return lhsFirsts > rhsFirsts }
            return $0 < $1
        }.prefix(10).enumerated().map { index, id in
            CfbMemberPollRow(id: id, rank: index + 1, points: points[id, default: 0], firstPlaceVotes: firsts[id, default: 0])
        }
    }

    static func isOfficial(ballots: [CfbMemberBallot]) -> Bool {
        Set(ballots.filter(\.isValid).map(\.voterID)).count >= officialVoterMinimum
    }
}

#if DEBUG
enum CfbPollPreviewTab: String, CaseIterable, Identifiable {
    case card = "WAR ROOM CARD"
    case ap = "AP TOP 25"
    case members = "MEMBERS’ TOP 10"
    var id: String { rawValue }
}

struct CfbPollsPreviewView: View {
    @State private var selectedTab: CfbPollPreviewTab
    @State private var ballot: [String] = []
    @State private var ballotFiled = false
    @State private var revealBallots = false

    init(initialTab: CfbPollPreviewTab = .ap) {
        _selectedTab = State(initialValue: initialTab)
    }

    var body: some View {
        ZStack {
            CfbPollBackdrop()
            VStack(spacing: 0) {
                header
                tabRail
                ScrollView {
                    Group {
                        switch selectedTab {
                        case .card: cardPreview
                        case .ap: apBoard
                        case .members: memberBoard
                        }
                    }
                    .padding(.horizontal, 15).padding(.vertical, 14).padding(.bottom, 28)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("CFB · WEEK 2").font(.system(size: 9, weight: .black)).tracking(1.6).foregroundStyle(.yellow)
                Text("PICKS COMMAND").font(.title2.weight(.black)).fontWidth(.condensed)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("SATURDAY SITUATION ROOM").font(.system(size: 8, weight: .black)).foregroundStyle(.green)
                Text("8 MEMBERS").font(.system(size: 8, weight: .black)).foregroundStyle(.white.opacity(0.45))
            }
        }.padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 12)
    }

    private var tabRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(CfbPollPreviewTab.allCases) { tab in
                    Button { withAnimation(.easeOut(duration: 0.18)) { selectedTab = tab } } label: {
                        Text(tab.rawValue).font(.system(size: 9, weight: .black)).tracking(0.6)
                            .foregroundStyle(selectedTab == tab ? .black : .white.opacity(0.66))
                            .padding(.horizontal, 13).frame(height: 34)
                            .background(selectedTab == tab ? Color.yellow : Color.black.opacity(0.72), in: Capsule())
                            .overlay(Capsule().stroke(.yellow.opacity(selectedTab == tab ? 0 : 0.35)))
                    }.buttonStyle(.plain)
                }
            }.padding(.horizontal, 15)
        }.padding(.bottom, 8)
    }

    private var apBoard: some View {
        VStack(spacing: 12) {
            pollHero(kicker: "THE NATIONAL MEASURE", title: "AP TOP 25", detail: "The official weekly poll. Reference only—these rankings never change your card or score.", color: .yellow)
            VStack(spacing: 0) {
                ForEach(Self.teams) { team in
                    nationalRow(team)
                    if team.id != Self.teams.last?.id { Divider().overlay(.white.opacity(0.08)) }
                }
            }.pollPanel(color: .yellow)
            sourceNotice
        }
    }

    private var memberBoard: some View {
        let results = CfbMemberPollEngine.standings(ballots: Self.ballots)
        return VStack(spacing: 12) {
            pollHero(kicker: "YOUR ROOM · YOUR ARGUMENT", title: "MEMBERS’ TOP 10", detail: "The room’s collective ranking. Bragging rights only—zero standings points and zero Cheevos.", color: .green)
            HStack(spacing: 9) {
                pollStatus(value: "6/8", label: "BALLOTS FILED", color: .green)
                pollStatus(value: "OFFICIAL", label: "4 REQUIRED", color: .yellow)
                pollStatus(value: "SAT 12:00", label: "REVEAL", color: .red)
            }
            VStack(spacing: 0) {
                ForEach(results) { row in
                    memberRow(row)
                    if row.id != results.last?.id { Divider().overlay(.white.opacity(0.08)) }
                }
            }.pollPanel(color: .green)
            Button { revealBallots.toggle() } label: {
                Label(revealBallots ? "HIDE INDIVIDUAL BALLOTS" : "OPEN INDIVIDUAL BALLOTS", systemImage: "person.3.fill")
                    .font(.caption.weight(.black)).frame(maxWidth: .infinity).padding(.vertical, 13)
            }.buttonStyle(.bordered).tint(.green)
            if revealBallots { individualBallots }
            ballotBuilder
        }
    }

    private var cardPreview: some View {
        VStack(spacing: 12) {
            pollHero(kicker: "WEEK 2 · PICKS OPEN", title: "WAR ROOM CARD", detail: "Your existing five-game ATS card stays exactly where it belongs. The polls never touch scoring.", color: .green)
            ForEach(1...5, id: \.self) { game in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("GAME (game)").font(.system(size: 9, weight: .black)).foregroundStyle(.yellow)
                        Text(Self.matchups[game - 1]).font(.headline.weight(.black))
                    }
                    Spacer(); Text("PICK").font(.caption2.weight(.black)).foregroundStyle(.green)
                }.padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(.green.opacity(0.28)))
            }
        }
    }

    private func nationalRow(_ team: CfbPollTeam) -> some View {
        HStack(spacing: 12) {
            Text("\(team.apRank)").font(.title3.weight(.black)).foregroundStyle(.yellow).frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(team.name.uppercased()).font(.subheadline.weight(.black))
                Text(team.record).font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.45))
            }
            Spacer()
            movement(current: team.apRank, previous: team.previousAPRank)
            if team.firstPlaceVotes > 0 {
                Text("\(team.firstPlaceVotes) FPV").font(.system(size: 8, weight: .black)).foregroundStyle(.yellow.opacity(0.75))
            }
        }.padding(.horizontal, 13).padding(.vertical, 11)
    }

    private func memberRow(_ row: CfbMemberPollRow) -> some View {
        let team = Self.teams.first { $0.id == row.id }
        let prior = Self.previousMemberRanks[row.id]
        return HStack(spacing: 12) {
            Text("\(row.rank)").font(.title3.weight(.black)).foregroundStyle(.green).frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text((team?.name ?? row.id).uppercased()).font(.subheadline.weight(.black))
                Text("AP #\(team?.apRank ?? 0) · \(row.points) BALLOT PTS").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.45))
            }
            Spacer()
            movement(current: row.rank, previous: prior)
            if row.firstPlaceVotes > 0 { Text("\(row.firstPlaceVotes) #1").font(.system(size: 8, weight: .black)).foregroundStyle(.yellow) }
        }.padding(.horizontal, 13).padding(.vertical, 11)
    }

    private var ballotBuilder: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(ballotFiled ? "MY BALLOT · FILED" : "BUILD MY TOP 10").font(.caption.weight(.black)).foregroundStyle(ballotFiled ? .green : .yellow)
                    Text(ballotFiled ? "Visible after the room poll reveals." : "Tap ten teams in order. First tap gets your No. 1 vote.")
                        .font(.caption2.weight(.semibold)).foregroundStyle(.white.opacity(0.48))
                }
                Spacer(); Text("\(ballot.count)/10").font(.headline.weight(.black)).foregroundStyle(.yellow)
            }
            if !ballotFiled {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(Self.teams) { team in
                        let position = ballot.firstIndex(of: team.id).map { $0 + 1 }
                        Button { toggleBallot(team.id) } label: {
                            HStack {
                                Text(position.map(String.init) ?? "–").font(.caption.weight(.black)).foregroundStyle(position == nil ? .white.opacity(0.3) : .black)
                                    .frame(width: 23, height: 23).background(position == nil ? Color.white.opacity(0.06) : Color.yellow, in: Circle())
                                Text(team.id).font(.caption.weight(.black)); Spacer()
                            }.padding(9).background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 9))
                        }.buttonStyle(.plain)
                    }
                }
                Button { ballotFiled = ballot.count == 10 } label: {
                    Label("FILE MY BALLOT", systemImage: "checkmark.seal.fill").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(.vertical, 12)
                }.buttonStyle(.borderedProminent).tint(ballot.count == 10 ? .green : .gray).disabled(ballot.count != 10)
            }
        }.pollPanel(color: ballotFiled ? .green : .yellow)
    }

    private var individualBallots: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("THE RECEIPTS").font(.caption2.weight(.black)).tracking(1.4).foregroundStyle(.green)
            ForEach(Array(Self.ballots.prefix(4)), id: \.voterID) { ballot in
                VStack(alignment: .leading, spacing: 4) {
                    Text(ballot.voterID.uppercased()).font(.caption.weight(.black))
                    Text(ballot.rankedTeamIDs.enumerated().map { "\($0.offset + 1). \($0.element)" }.joined(separator: "  ·  "))
                        .font(.system(size: 9, weight: .bold)).foregroundStyle(.white.opacity(0.52))
                }
            }
        }.pollPanel(color: .green)
    }

    private var sourceNotice: some View {
        HStack(alignment: .top, spacing: 9) {
            Image(systemName: "checkmark.shield.fill").foregroundStyle(.yellow)
            Text("AP rankings must come from a verified weekly source. War Room will never infer the poll from odds or fabricate a missing week.")
                .font(.caption2.weight(.semibold)).foregroundStyle(.white.opacity(0.5))
        }.padding(13).background(.black.opacity(0.68), in: RoundedRectangle(cornerRadius: 12))
    }

    private func pollHero(kicker: String, title: String, detail: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(kicker).font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(color)
            Text(title).font(.system(size: 29, weight: .black)).fontWidth(.condensed)
            Text(detail).font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
        }.frame(maxWidth: .infinity, alignment: .leading).pollPanel(color: color)
    }

    private func pollStatus(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.caption.weight(.black)).foregroundStyle(color)
            Text(label).font(.system(size: 7, weight: .black)).foregroundStyle(.white.opacity(0.42))
        }.frame(maxWidth: .infinity).padding(.vertical, 11).background(.black.opacity(0.75), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(color.opacity(0.3)))
    }

    @ViewBuilder private func movement(current: Int, previous: Int?) -> some View {
        if let previous {
            if previous > current { Label("\(previous - current)", systemImage: "arrowtriangle.up.fill").foregroundStyle(.green) }
            else if previous < current { Label("\(current - previous)", systemImage: "arrowtriangle.down.fill").foregroundStyle(.red) }
            else { Text("—").foregroundStyle(.white.opacity(0.28)) }
        } else { Text("NEW").foregroundStyle(.yellow) }
    }

    private func toggleBallot(_ id: String) {
        if let index = ballot.firstIndex(of: id) { ballot.remove(at: index) }
        else if ballot.count < 10 { ballot.append(id) }
    }

    private static let matchups = ["Ohio State -7.5 vs Texas", "Georgia -3.0 at Alabama", "Oregon -10.5 vs Michigan", "Notre Dame -4.5 at Miami", "LSU -2.5 vs Clemson"]
    private static let teams: [CfbPollTeam] = [
        .init(id: "OSU", name: "Ohio State", record: "1–0", apRank: 1, previousAPRank: 2, firstPlaceVotes: 38),
        .init(id: "TEX", name: "Texas", record: "1–0", apRank: 2, previousAPRank: 1, firstPlaceVotes: 19),
        .init(id: "UGA", name: "Georgia", record: "1–0", apRank: 3, previousAPRank: 3, firstPlaceVotes: 4),
        .init(id: "ORE", name: "Oregon", record: "1–0", apRank: 4, previousAPRank: 5, firstPlaceVotes: 0),
        .init(id: "PSU", name: "Penn State", record: "1–0", apRank: 5, previousAPRank: 4, firstPlaceVotes: 0),
        .init(id: "ND", name: "Notre Dame", record: "1–0", apRank: 6, previousAPRank: 7, firstPlaceVotes: 0),
        .init(id: "BAMA", name: "Alabama", record: "1–0", apRank: 7, previousAPRank: 6, firstPlaceVotes: 0),
        .init(id: "LSU", name: "LSU", record: "1–0", apRank: 8, previousAPRank: 9, firstPlaceVotes: 0),
        .init(id: "CLEM", name: "Clemson", record: "1–0", apRank: 9, previousAPRank: 8, firstPlaceVotes: 0),
        .init(id: "MIA", name: "Miami", record: "1–0", apRank: 10, previousAPRank: 12, firstPlaceVotes: 0),
        .init(id: "TENN", name: "Tennessee", record: "1–0", apRank: 11, previousAPRank: 10, firstPlaceVotes: 0),
        .init(id: "MICH", name: "Michigan", record: "1–0", apRank: 12, previousAPRank: 11, firstPlaceVotes: 0),
        .init(id: "ASU", name: "Arizona State", record: "1–0", apRank: 13, previousAPRank: nil, firstPlaceVotes: 0),
        .init(id: "SC", name: "South Carolina", record: "1–0", apRank: 14, previousAPRank: 13, firstPlaceVotes: 0),
        .init(id: "FLA", name: "Florida", record: "1–0", apRank: 15, previousAPRank: 15, firstPlaceVotes: 0),
        .init(id: "ILL", name: "Illinois", record: "1–0", apRank: 16, previousAPRank: 18, firstPlaceVotes: 0),
        .init(id: "MISS", name: "Ole Miss", record: "1–0", apRank: 17, previousAPRank: 16, firstPlaceVotes: 0),
        .init(id: "TTU", name: "Texas Tech", record: "1–0", apRank: 18, previousAPRank: 17, firstPlaceVotes: 0),
        .init(id: "BYU", name: "BYU", record: "1–0", apRank: 19, previousAPRank: 20, firstPlaceVotes: 0),
        .init(id: "KSU", name: "Kansas State", record: "1–0", apRank: 20, previousAPRank: 19, firstPlaceVotes: 0),
        .init(id: "OU", name: "Oklahoma", record: "1–0", apRank: 21, previousAPRank: 21, firstPlaceVotes: 0),
        .init(id: "ISU", name: "Iowa State", record: "1–0", apRank: 22, previousAPRank: 23, firstPlaceVotes: 0),
        .init(id: "AUB", name: "Auburn", record: "1–0", apRank: 23, previousAPRank: nil, firstPlaceVotes: 0),
        .init(id: "MIZ", name: "Missouri", record: "1–0", apRank: 24, previousAPRank: 22, firstPlaceVotes: 0),
        .init(id: "UTAH", name: "Utah", record: "1–0", apRank: 25, previousAPRank: 25, firstPlaceVotes: 0)
    ]
    private static let ballots: [CfbMemberBallot] = [
        .init(voterID: "Mike", rankedTeamIDs: ["UGA", "OSU", "ORE", "TEX", "ND", "LSU", "BAMA", "MIA", "CLEM", "TENN"]),
        .init(voterID: "Maria", rankedTeamIDs: ["OSU", "TEX", "UGA", "ORE", "PSU", "ND", "BAMA", "LSU", "MIA", "CLEM"]),
        .init(voterID: "Andy", rankedTeamIDs: ["ORE", "OSU", "UGA", "TEX", "LSU", "ND", "BAMA", "CLEM", "MIA", "MICH"]),
        .init(voterID: "Ben", rankedTeamIDs: ["TEX", "UGA", "OSU", "ORE", "BAMA", "LSU", "ND", "CLEM", "MIA", "TENN"]),
        .init(voterID: "JStray", rankedTeamIDs: ["UGA", "ORE", "OSU", "TEX", "ND", "PSU", "LSU", "BAMA", "MIA", "CLEM"]),
        .init(voterID: "Riley", rankedTeamIDs: ["OSU", "UGA", "TEX", "ORE", "PSU", "BAMA", "ND", "LSU", "CLEM", "MIA"])
    ]
    private static let previousMemberRanks = ["OSU": 2, "UGA": 1, "TEX": 3, "ORE": 5, "PSU": 4, "ND": 6, "BAMA": 7, "LSU": 9, "CLEM": 8, "MIA": 10]
}

private struct CfbPollBackdrop: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.02, green: 0.10, blue: 0.04), .black, Color(red: 0.08, green: 0.04, blue: 0.01)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            RadialGradient(colors: [.green.opacity(0.18), .clear], center: .top, startRadius: 5, endRadius: 430).ignoresSafeArea()
            GeometryReader { proxy in
                Path { path in
                    path.move(to: CGPoint(x: proxy.size.width / 2, y: 0)); path.addLine(to: CGPoint(x: proxy.size.width / 2, y: proxy.size.height))
                }.stroke(.white.opacity(0.045), lineWidth: 2)
            }.ignoresSafeArea()
        }
    }
}

private extension View {
    func pollPanel(color: Color) -> some View {
        padding(14).background(.black.opacity(0.8), in: RoundedRectangle(cornerRadius: 15))
            .overlay(RoundedRectangle(cornerRadius: 15).stroke(color.opacity(0.35)))
    }
}
#endif
