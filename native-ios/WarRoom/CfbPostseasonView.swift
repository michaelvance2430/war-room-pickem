import SwiftUI

struct CfbPostseasonHubView: View {
    let membership: LeagueMembership
    private var phase: CfbSeasonPhase { .phase(week: membership.leagues.currentWeek, regularSeasonWeeks: membership.leagues.regularSeasonWeeks) }

    var body: some View {
        switch phase {
        case .conferenceChampionships:
            ConferenceChampionshipGateView(membership: membership)
        case .bowlMania, .cfpFirstRound, .cfpQuarterfinals, .cfpSemifinals, .cfpChampionship, .seasonComplete:
            BowlManiaView(membership: membership)
        case .regularSeason:
            ContentUnavailableView("Postseason sealed", systemImage: "lock.shield.fill", description: Text("Finish the regular season before opening Phase II."))
        }
    }
}

private struct ConferenceChampionshipGateView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.01, green: 0.04, blue: 0.13), .black, Color(red: 0.05, green: 0.09, blue: 0.16)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 20) {
                    Image(systemName: "flag.checkered.2.crossed").font(.system(size: 64, weight: .black)).foregroundStyle(.cyan).shadow(color: .cyan, radius: 22)
                    Text("PHASE II").font(.caption.weight(.black)).tracking(4).foregroundStyle(.cyan)
                    Text("CHAMPIONSHIP\nSATURDAY").font(.system(size: 43, weight: .black)).fontWidth(.condensed).multilineTextAlignment(.center)
                    Text("THE PLAYOFF FIELD IS NOT FINAL").font(.headline.weight(.black)).foregroundStyle(.yellow)
                    Text("Conference titles are still being decided. Bowl Mania and the CFP remain sealed until this card is scored and the selection order is official.")
                        .font(.body.weight(.semibold)).foregroundStyle(.white.opacity(0.68)).multilineTextAlignment(.center)
                    VStack(alignment: .leading, spacing: 12) {
                        gateRow("Conference Championship card", "LIVE IN WEEK \(membership.leagues.currentWeek)", true)
                        gateRow("Bowl Board", "SEALED", false)
                        gateRow("12-team CFP", "SEALED", false)
                    }.padding(18).background(.black.opacity(0.54), in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(.cyan.opacity(0.34)))
                    if auth.user.map({ membership.isCommissioner(userId: $0.id) }) == true {
                        NavigationLink { CfbPostseasonSlateBuilderView(membership: membership) } label: {
                            Label("BUILD POSTSEASON FIELD", systemImage: "hammer.fill").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(15).foregroundStyle(.black).background(.cyan, in: RoundedRectangle(cornerRadius: 14))
                        }.buttonStyle(.plain)
                    }
                    Text("Score Championship Saturday to enter Phase III.").font(.caption.weight(.black)).foregroundStyle(.white.opacity(0.42))
                }.padding(24).padding(.top, 44)
            }
        }.navigationTitle("Championship Saturday").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark)
    }

    private func gateRow(_ title: String, _ value: String, _ open: Bool) -> some View {
        HStack { Image(systemName: open ? "checkmark.seal.fill" : "lock.fill").foregroundStyle(open ? .green : .gray); Text(title).font(.footnote.weight(.black)); Spacer(); Text(value).font(.caption2.weight(.black)).foregroundStyle(open ? .green : .gray) }
    }
}

private struct CfbSlateDraft: Identifiable {
    let id: String
    let name: String
    let tier: CfbBowlTier
    let rank: Int
    var away = ""
    var home = ""

    var game: CfbBowlGame { CfbBowlGame(id: id, name: name, tier: tier, rank: rank, away: away.trimmingCharacters(in: .whitespacesAndNewlines), home: home.trimmingCharacters(in: .whitespacesAndNewlines), hostsCfpGame: false) }
}

private struct CfbPostseasonSlateBuilderView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let membership: LeagueMembership
    @State private var bowls: [CfbSlateDraft]
    @State private var seeds = Array(repeating: "", count: 12)
    @State private var loading = true
    @State private var publishing = false
    @State private var error: String?
    @State private var published = false

    private var seasonKey: Int { Calendar.current.component(.year, from: Date()) }
    private var complete: Bool {
        bowls.allSatisfy { !$0.away.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !$0.home.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } &&
        seeds.allSatisfy { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } && Set(seeds.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }).count == 12
    }

    init(membership: LeagueMembership) {
        self.membership = membership
        let names = CfbPostseasonRules.marqueeNames + CfbPostseasonRules.sickoNames
        _bowls = State(initialValue: names.enumerated().map { index, name in
            CfbSlateDraft(id: "\(index < 15 ? "marquee" : "sicko")-\(index+1)", name: name, tier: index < 15 ? .marquee : .sicko, rank: index < 15 ? index+1 : index-14)
        })
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [.black, Color(red: 0.02, green: 0.10, blue: 0.13), .black], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("COMMISSIONER CONTROL · \(seasonKey)").font(.caption2.weight(.black)).tracking(2).foregroundStyle(.cyan)
                        Text("BUILD THE FIELD").font(.system(size: 38, weight: .black)).fontWidth(.condensed)
                        Text("Enter the actual teams after the bowl assignments and CFP rankings are official. Publishing replaces every placeholder for this league.").font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.64))
                    }.padding(18).background(.black.opacity(0.75), in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(.cyan.opacity(0.42)))
                    if loading { ProgressView("Recovering postseason orders…").tint(.cyan).frame(maxWidth: .infinity).padding(30) }
                    else {
                        slateSection("THE MARQUEE 15", tier: .marquee, color: .yellow)
                        slateSection("THE SICKO 10", tier: .sicko, color: .green)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("12-TEAM CFP SEEDING").font(.headline.weight(.black)).foregroundStyle(.cyan)
                            ForEach(seeds.indices, id: \.self) { index in
                                HStack { Text("#\(index+1)").font(.headline.weight(.black)).foregroundStyle(.cyan).frame(width: 35); TextField("Official CFP team", text: $seeds[index]).textInputAutocapitalization(.words).padding(12).background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 10)) }
                            }
                        }.padding(16).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 17)).overlay(RoundedRectangle(cornerRadius: 17).stroke(.cyan.opacity(0.34)))
                        if let error { Text(error).font(.footnote.weight(.bold)).foregroundStyle(.red).padding(12).frame(maxWidth: .infinity).background(.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 10)) }
                        Button { Task { await publish() } } label: {
                            Label(published ? "FIELD PUBLISHED" : publishing ? "PUBLISHING FIELD…" : complete ? "PUBLISH BOWL MANIA + CFP" : "COMPLETE ALL 37 TEAMS", systemImage: published ? "checkmark.seal.fill" : "antenna.radiowaves.left.and.right")
                                .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16).foregroundStyle(.black).background(complete ? Color.cyan : Color.gray, in: RoundedRectangle(cornerRadius: 14))
                        }.buttonStyle(.plain).disabled(!complete || publishing || published)
                        Text("Once the first player locks Bowl Mania or the CFP, this field freezes permanently.").font(.caption.weight(.black)).foregroundStyle(.yellow).frame(maxWidth: .infinity)
                    }
                }.padding(16).padding(.bottom, 40)
            }
        }.navigationTitle("Postseason Field").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark).task { await load() }
    }

    private func slateSection(_ title: String, tier: CfbBowlTier, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.headline.weight(.black)).foregroundStyle(color)
            ForEach($bowls) { $bowl in
                if bowl.tier == tier {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("\(bowl.rank). \(bowl.name)").font(.subheadline.weight(.black))
                        HStack { TextField("Away team", text: $bowl.away); Text("VS").font(.caption2.weight(.black)).foregroundStyle(color); TextField("Home team", text: $bowl.home) }
                            .textInputAutocapitalization(.words).padding(11).background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
        }.padding(16).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 17)).overlay(RoundedRectangle(cornerRadius: 17).stroke(color.opacity(0.34)))
    }

    @MainActor private func load() async {
        defer { loading = false }
        guard let token = auth.token else { error = "Your command session expired."; return }
        do {
            guard let slate = try await SupabaseAPI.cfbPostseasonSlate(token: token, leagueId: membership.leagueId, seasonKey: seasonKey) else { return }
            for game in slate.bowlGames {
                guard let index = bowls.firstIndex(where: { $0.id == game.id }) else { continue }
                bowls[index].away = game.away; bowls[index].home = game.home
            }
            seeds = slate.cfpSeeds
        } catch { self.error = error.localizedDescription }
    }

    @MainActor private func publish() async {
        guard let token = auth.token, complete else { return }
        publishing = true; error = nil
        do {
            _ = try await SupabaseAPI.publishCfbPostseasonSlate(token: token, leagueId: membership.leagueId, seasonKey: seasonKey, bowlGames: bowls.map(\.game), cfpSeeds: seeds.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) })
            published = true
        } catch { self.error = error.localizedDescription }
        publishing = false
    }
}

private struct BowlManiaView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    @State private var tier: CfbBowlTier = .marquee
    @State private var picks: [String: String] = [:]
    @State private var allocations: [String: Int] = [:]
    @State private var locked = false
    @State private var deadHand = false
    @State private var confirmingDeadHand = false
    @State private var showingCfp = false
    @State private var loading = true
    @State private var saving = false
    @State private var error: String?
    @State private var games: [CfbBowlGame] = []
    @State private var cfpSeeds: [String] = []
    @State private var bowlScore: Int?
    @State private var bowlResultsCount = 0

    private var visibleGames: [CfbBowlGame] { games.filter { $0.tier == tier } }
    private var allocated: Int { allocations.values.reduce(0, +) }
    private var remaining: Int { CfbPostseasonRules.bankroll - allocated }
    private var ready: Bool { picks.count == 25 && allocations.count == 25 && remaining == 0 && allocations.values.allSatisfy { $0 > 0 } }
    private var seasonKey: Int { Calendar.current.component(.year, from: Date()) }
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.22, green: 0.09, blue: 0.01), .black, Color(red: 0.08, green: 0.035, blue: 0.005)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 15) {
                    header
                    if locked { resultStatus }
                    metrics
                    tierPicker
                    if !locked { deadHandButton }
                    if deadHand { deadHandReceipt }
                    if let error { Text(error).font(.footnote.weight(.bold)).foregroundStyle(.red).padding(12).frame(maxWidth: .infinity).background(.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 10)) }
                    if error != nil, auth.user.map({ membership.isCommissioner(userId: $0.id) }) == true {
                        NavigationLink { CfbPostseasonSlateBuilderView(membership: membership) } label: {
                            Label("PUBLISH THE POSTSEASON FIELD", systemImage: "hammer.fill").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(15).foregroundStyle(.black).background(.cyan, in: RoundedRectangle(cornerRadius: 14))
                        }.buttonStyle(.plain)
                    }
                    ForEach(visibleGames) { bowlCard($0) }
                    if tier == .marquee {
                        Button { withAnimation { tier = .sicko } } label: { Label("NEXT: THE SICKO 10", systemImage: "arrow.right.circle.fill").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16).foregroundStyle(.black).background(.green, in: RoundedRectangle(cornerRadius: 14)) }.buttonStyle(.plain)
                    }
                    lockControl
                    if locked {
                        Button { showingCfp = true } label: { Label("ROAD THROUGH THE CFP", systemImage: "trophy.fill").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16).foregroundStyle(.black).background(.yellow, in: RoundedRectangle(cornerRadius: 14)) }.buttonStyle(.plain)
                    }
                    if auth.user.map({ membership.isCommissioner(userId: $0.id) }) == true, !games.isEmpty, cfpSeeds.count == 12 {
                        NavigationLink { CfbPostseasonResultsDeskView(membership: membership, games: games, seeds: cfpSeeds) } label: {
                            Label("COMMISSIONER RESULTS DESK", systemImage: "checkmark.seal.fill").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16).foregroundStyle(.black).background(.cyan, in: RoundedRectangle(cornerRadius: 14))
                        }.buttonStyle(.plain)
                    }
                }.padding(16).padding(.bottom, 40)
            }
        }
        .navigationTitle("Bowl Mania").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark)
        .task { await loadEntry() }
        .confirmationDialog("REMOVE YOURSELF FROM COMMAND?", isPresented: $confirmingDeadHand, titleVisibility: .visible) {
            Button("AUTHORIZE DEAD HAND", role: .destructive) { detonate(); Task { await lockBoard() } }
            Button("Retain free will", role: .cancel) {}
        } message: { Text("The machine chooses all 25 winners, spends all 100 points, and locks the board permanently. 60+ raw earns 1.5×. Below 60 is cut in half.") }
        .navigationDestination(isPresented: $showingCfp) { CfbPlayoffBracketView(membership: membership, seeds: cfpSeeds, bowlGames: games) }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("PHASE III · POSTSEASON").font(.caption2.weight(.black)).tracking(2).foregroundStyle(.yellow)
            Text("BOWL MANIA").font(.system(size: 39, weight: .black)).fontWidth(.condensed)
            Text("Fifteen bowls you want to pick. Ten bowls you have no business knowing. Every game starts at four points. Put all 100 on the board.").font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
        }.padding(18).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(.yellow.opacity(0.42)))
    }

    private var metrics: some View { HStack(spacing: 8) { metric("ALLOCATED", "\(allocated)", allocated == 100 ? .green : .yellow); metric("REMAINING", "\(remaining)", remaining == 0 ? .green : .orange); metric("PICKS", "\(picks.count)/25", picks.count == 25 ? .green : .yellow) } }
    private var resultStatus: some View { HStack { VStack(alignment: .leading, spacing: 3) { Text(bowlScore == nil ? "RESULTS IN PROGRESS" : "BOWL MANIA FINAL").font(.caption2.weight(.black)).tracking(1).foregroundStyle(.yellow); Text(bowlScore.map { "\($0) POINTS" } ?? "\(bowlResultsCount)/25 BOWLS FINAL").font(.title2.weight(.black)) }; Spacer(); Image(systemName: bowlScore == nil ? "clock.badge.checkmark" : "checkmark.seal.fill").font(.title).foregroundStyle(bowlScore == nil ? .yellow : .green) }.padding(15).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(.yellow.opacity(0.35))) }
    private func metric(_ label: String, _ value: String, _ color: Color) -> some View { VStack { Text(value).font(.title3.weight(.black)).foregroundStyle(color); Text(label).font(.system(size: 7, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.44)) }.frame(maxWidth: .infinity).padding(.vertical, 12).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 11)).overlay(RoundedRectangle(cornerRadius: 11).stroke(color.opacity(0.28))) }

    private var tierPicker: some View { HStack(spacing: 8) { tierButton(.marquee, "THE MARQUEE 15", .yellow); tierButton(.sicko, "THE SICKO 10", .green) } }
    private func tierButton(_ value: CfbBowlTier, _ title: String, _ color: Color) -> some View { Button { tier = value } label: { Text(title).font(.caption.weight(.black)).frame(maxWidth: .infinity).padding(14).foregroundStyle(tier == value ? .black : .white).background(tier == value ? color : .black.opacity(0.7), in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(color.opacity(0.5))) }.buttonStyle(.plain) }

    private var deadHandButton: some View { Button { confirmingDeadHand = true } label: { HStack { Image(systemName: "hand.raised.fingers.spread.fill").font(.title); VStack(alignment: .leading) { Text("INITIATE DEAD HAND").font(.headline.weight(.black)); Text("THE MACHINE HAS IDENTIFIED SOMETHING IN BOISE").font(.system(size: 7, weight: .black)).tracking(0.5) }; Spacer(); Image(systemName: "radiation") }.padding(15).foregroundStyle(.red).background(.black, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(.red, lineWidth: 2)).shadow(color: .red.opacity(0.35), radius: 16) }.buttonStyle(.plain) }
    private var deadHandReceipt: some View { Text("DEAD HAND ACTIVE · NO EDITS · NO APPEALS · FURTHER QUESTIONS DISCOURAGED").font(.caption2.weight(.black)).foregroundStyle(.red).frame(maxWidth: .infinity).padding(13).background(.red.opacity(0.12), in: RoundedRectangle(cornerRadius: 11)).overlay(RoundedRectangle(cornerRadius: 11).stroke(.red.opacity(0.55))) }

    private func bowlCard(_ game: CfbBowlGame) -> some View {
        let accent = game.tier == .marquee ? Color.yellow : Color.green
        let selected = picks[game.id]
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                ZStack {
                    Circle().fill(accent.opacity(0.16)).frame(width: 48, height: 48)
                    Circle().stroke(accent.opacity(0.65), lineWidth: 2).frame(width: 48, height: 48)
                    VStack(spacing: 0) {
                        Text(game.tier == .marquee ? "M" : "S").font(.system(size: 9, weight: .black))
                        Text(String(format: "%02d", game.rank)).font(.headline.weight(.black))
                    }.foregroundStyle(accent)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(game.tier == .marquee ? "MARQUEE TARGET" : "SICKO INTELLIGENCE FILE").font(.system(size: 8, weight: .black)).tracking(1.5).foregroundStyle(accent)
                    Text(game.name.uppercased()).font(.title3.weight(.black)).fontWidth(.condensed)
                    Text(selected == nil ? "AWAITING ORDERS" : locked ? "PICK RECEIPT SEALED" : "TARGET ACQUIRED · EDITS OPEN")
                        .font(.system(size: 7, weight: .black)).tracking(1).foregroundStyle(selected == nil ? .white.opacity(0.38) : .green)
                }
                Spacer()
                points(game, accent: accent)
            }

            HStack(spacing: 7) {
                pickButton(game.away, game, side: "AWAY", accent: accent)
                VStack(spacing: 2) {
                    Image(systemName: "bolt.horizontal.circle.fill").font(.title2)
                    Text("VS").font(.system(size: 7, weight: .black)).tracking(1)
                }.foregroundStyle(.orange).frame(width: 34)
                pickButton(game.home, game, side: "HOME", accent: accent)
            }

            HStack(spacing: 7) {
                Image(systemName: locked ? "lock.fill" : "scope").foregroundStyle(selected == nil ? .gray : accent)
                Text(selected.map { "\($0.uppercased()) CARRIES \(allocations[game.id] ?? 0) CONFIDENCE ROUNDS" } ?? "SELECT A SIDE. THEN ARM THE CONFIDENCE MAGAZINE.")
                    .font(.system(size: 8, weight: .black)).tracking(0.5).lineLimit(2)
                Spacer()
            }.foregroundStyle(.white.opacity(0.55)).padding(9).background(.black.opacity(0.58), in: RoundedRectangle(cornerRadius: 9))
        }
        .padding(14)
        .background {
            ZStack {
                Image("BracketWarTable").resizable().scaledToFill().opacity(game.tier == .marquee ? 0.18 : 0.11)
                LinearGradient(colors: [.black.opacity(0.92), accent.opacity(selected == nil ? 0.06 : 0.15), .black.opacity(0.92)], startPoint: .topLeading, endPoint: .bottomTrailing)
            }.clipped()
        }
        .clipShape(RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).stroke(accent.opacity(selected == nil ? 0.30 : 0.72), lineWidth: selected == nil ? 1 : 2))
        .shadow(color: selected == nil ? .clear : accent.opacity(0.18), radius: 16)
    }

    private func points(_ game: CfbBowlGame, accent: Color) -> some View {
        VStack(spacing: 4) {
            Text("CONFIDENCE").font(.system(size: 6, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.42))
            HStack(spacing: 5) {
                Button { adjust(game.id, -1) } label: { Image(systemName: "minus").frame(width: 30, height: 30).background(.white.opacity(0.09), in: RoundedRectangle(cornerRadius: 7)) }.disabled(locked || (allocations[game.id] ?? 1) <= 1)
                Text("\(allocations[game.id] ?? 0)").font(.title3.weight(.black)).foregroundStyle(accent).frame(minWidth: 24)
                Button { adjust(game.id, 1) } label: { Image(systemName: "plus").frame(width: 30, height: 30).background(.white.opacity(0.09), in: RoundedRectangle(cornerRadius: 7)) }.disabled(locked || remaining <= 0)
            }.buttonStyle(.plain)
        }.padding(7).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 10)).overlay(RoundedRectangle(cornerRadius: 10).stroke(accent.opacity(0.34)))
    }
    private func pickButton(_ team: String, _ game: CfbBowlGame, side: String, accent: Color) -> some View {
        let selected = picks[game.id] == team
        return Button { picks[game.id] = team } label: {
            VStack(spacing: 5) {
                HStack { Text(side).font(.system(size: 6, weight: .black)).tracking(1); Spacer(); Image(systemName: selected ? "checkmark.seal.fill" : "circle").font(.caption) }
                Text(team.uppercased()).font(.caption.weight(.black)).lineLimit(2).minimumScaleFactor(0.68).frame(maxWidth: .infinity, minHeight: 38, alignment: .leading)
            }.padding(10).foregroundStyle(selected ? .black : .white)
                .background(selected ? accent : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(selected ? accent : .white.opacity(0.11)))
        }.buttonStyle(.plain).disabled(locked)
    }
    private var lockControl: some View { Button { Task { await lockBoard() } } label: { Text(locked ? "BOWL BOARD LOCKED" : saving ? "SEALING BOWL BOARD…" : ready ? "LOCK BOWL BOARD" : loading ? "RECOVERING BOWL BOARD…" : picks.count < 25 ? "PICK \(25-picks.count) MORE BOWLS" : "ALLOCATE ALL 100 POINTS").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16).foregroundStyle(.black).background(ready || locked ? Color.yellow : Color.gray, in: RoundedRectangle(cornerRadius: 14)) }.buttonStyle(.plain).disabled(!ready || locked || saving || loading) }
    private func adjust(_ id: String, _ delta: Int) { allocations[id] = max(1, (allocations[id] ?? 1) + delta) }
    private func detonate() { for (index, game) in games.enumerated() { picks[game.id] = index.isMultiple(of: 2) ? game.away : game.home }; allocations = Dictionary(uniqueKeysWithValues: games.map { ($0.id, 4) }); deadHand = true; locked = true }

    @MainActor private func loadEntry() async {
        defer { loading = false }
        guard let token = auth.token, let user = auth.user else { error = "Your command session expired. Sign in again."; return }
        do {
            async let loadedSlate = SupabaseAPI.cfbPostseasonSlate(token: token, leagueId: membership.leagueId, seasonKey: seasonKey)
            async let loadedEntry = SupabaseAPI.cfbPostseasonEntry(token: token, leagueId: membership.leagueId, userId: user.id, seasonKey: seasonKey)
            async let loadedResults = SupabaseAPI.cfbPostseasonResults(token: token, leagueId: membership.leagueId, seasonKey: seasonKey)
            let (slate, entry, results) = try await (loadedSlate, loadedEntry, loadedResults)
            if let slate {
                games = slate.bowlGames
                cfpSeeds = slate.cfpSeeds
            } else if membership.leagues.mode == "foundry" {
                let slate = try await SupabaseAPI.publishCfbPostseasonSlate(token: token, leagueId: membership.leagueId, seasonKey: seasonKey, bowlGames: CfbFoundryFixture.games, cfpSeeds: CfbFoundryFixture.cfpSeeds)
                games = slate.bowlGames
                cfpSeeds = slate.cfpSeeds
            } else {
                error = "The commissioner has not published this season’s Bowl Mania and CFP field yet."
                return
            }
            if allocations.isEmpty { allocations = Dictionary(uniqueKeysWithValues: games.map { ($0.id, 4) }) }
            if let entry {
                if !entry.bowlPicks.isEmpty { picks = entry.bowlPicks }
                if !entry.bowlAllocations.isEmpty { allocations = entry.bowlAllocations }
                deadHand = entry.deadHand
                locked = entry.bowlLockedAt != nil
                bowlScore = entry.bowlScore
            }
            bowlResultsCount = results?.bowlResults.count ?? 0
        } catch { self.error = error.localizedDescription }
    }

    @MainActor private func lockBoard() async {
        guard !saving, let token = auth.token else { return }
        saving = true; error = nil
        do {
            let entry = try await SupabaseAPI.lockCfbBowlBoard(token: token, leagueId: membership.leagueId, seasonKey: seasonKey, picks: picks, allocations: allocations, deadHand: deadHand)
            locked = entry.bowlLockedAt != nil
        } catch {
            locked = false
            self.error = error.localizedDescription
        }
        saving = false
    }
}

private struct CfbResultGame: Identifiable {
    let id: String
    let label: String
    let first: String
    let second: String
}

private struct CfbPostseasonResultsDeskView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    let games: [CfbBowlGame]
    let seeds: [String]
    @State private var tier: CfbBowlTier = .marquee
    @State private var bowlResults: [String: String] = [:]
    @State private var cfpResults: [String: String] = [:]
    @State private var savedBowlKeys: Set<String> = []
    @State private var savedCfpKeys: Set<String> = []
    @State private var loading = true
    @State private var saving = false
    @State private var error: String?

    private var seasonKey: Int { Calendar.current.component(.year, from: Date()) }
    private var changed: Bool { Set(bowlResults.keys) != savedBowlKeys || Set(cfpResults.keys) != savedCfpKeys }
    private var playoffGames: [CfbResultGame] {
        guard seeds.count == 12 else { return [] }
        return [
            CfbResultGame(id:"r1a",label:"FIRST ROUND · 5/12",first:seeds[4],second:seeds[11]),
            CfbResultGame(id:"r1b",label:"FIRST ROUND · 8/9",first:seeds[7],second:seeds[8]),
            CfbResultGame(id:"r1c",label:"FIRST ROUND · 7/10",first:seeds[6],second:seeds[9]),
            CfbResultGame(id:"r1d",label:"FIRST ROUND · 6/11",first:seeds[5],second:seeds[10]),
            CfbResultGame(id:"q1",label:"QUARTERFINAL 1",first:seeds[3],second:cfpResults["r1a"] ?? "TBD"),
            CfbResultGame(id:"q2",label:"QUARTERFINAL 2",first:seeds[0],second:cfpResults["r1b"] ?? "TBD"),
            CfbResultGame(id:"q3",label:"QUARTERFINAL 3",first:seeds[1],second:cfpResults["r1c"] ?? "TBD"),
            CfbResultGame(id:"q4",label:"QUARTERFINAL 4",first:seeds[2],second:cfpResults["r1d"] ?? "TBD"),
            CfbResultGame(id:"s1",label:"SEMIFINAL 1",first:cfpResults["q1"] ?? "TBD",second:cfpResults["q2"] ?? "TBD"),
            CfbResultGame(id:"s2",label:"SEMIFINAL 2",first:cfpResults["q3"] ?? "TBD",second:cfpResults["q4"] ?? "TBD"),
            CfbResultGame(id:"final",label:"NATIONAL CHAMPIONSHIP",first:cfpResults["s1"] ?? "TBD",second:cfpResults["s2"] ?? "TBD")
        ]
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [.black, Color(red: 0.02, green: 0.11, blue: 0.14), .black], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 15) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("COMMISSIONER AUTHORITY · PERMANENT RECORD").font(.caption2.weight(.black)).tracking(1.6).foregroundStyle(.cyan)
                        Text("RESULTS DESK").font(.system(size: 39, weight: .black)).fontWidth(.condensed)
                        Text("Record only official finals. Saved winners cannot be changed. New CFP rounds unlock from the winners already on file.").font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
                    }.padding(18).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(.cyan.opacity(0.42)))
                    if loading { ProgressView("Opening official ledger…").tint(.cyan).frame(maxWidth: .infinity).padding(35) }
                    else {
                        HStack(spacing: 8) { deskTab(.marquee,"MARQUEE 15",.yellow); deskTab(.sicko,"SICKO 10",.green) }
                        ForEach(games.filter { $0.tier == tier }) { game in resultCard(id: game.id, label: game.name, first: game.away, second: game.home, result: bowlResults, savedKeys: savedBowlKeys, isCfp: false) }
                        VStack(alignment: .leading, spacing: 12) {
                            Text("ROAD THROUGH THE CFP").font(.headline.weight(.black)).foregroundStyle(.cyan)
                            Text("1 · 2 · 4 · 8 POINTS BY ROUND").font(.caption2.weight(.black)).tracking(1.2).foregroundStyle(.white.opacity(0.42))
                            ForEach(playoffGames) { game in resultCard(id: game.id, label: game.label, first: game.first, second: game.second, result: cfpResults, savedKeys: savedCfpKeys, isCfp: true) }
                        }.padding(15).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 17)).overlay(RoundedRectangle(cornerRadius: 17).stroke(.cyan.opacity(0.34)))
                        if let error { Text(error).font(.footnote.weight(.bold)).foregroundStyle(.red).padding(12).frame(maxWidth: .infinity).background(.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 10)) }
                        Button { Task { await save() } } label: {
                            Label(saving ? "CERTIFYING RESULTS…" : changed ? "CERTIFY NEW RESULTS" : "NO NEW RESULTS TO CERTIFY", systemImage: "checkmark.seal.fill").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16).foregroundStyle(.black).background(changed ? Color.cyan : Color.gray, in: RoundedRectangle(cornerRadius: 14))
                        }.buttonStyle(.plain).disabled(!changed || saving)
                    }
                }.padding(16).padding(.bottom, 40)
            }
        }.navigationTitle("Results Desk").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark).task { await load() }
    }

    private func deskTab(_ value: CfbBowlTier, _ title: String, _ color: Color) -> some View { Button { tier=value } label: { Text(title).font(.caption.weight(.black)).frame(maxWidth:.infinity).padding(13).foregroundStyle(tier==value ? .black:.white).background(tier==value ? color:.black.opacity(0.7),in:RoundedRectangle(cornerRadius:11)) }.buttonStyle(.plain) }

    private func resultCard(id: String, label: String, first: String, second: String, result: [String:String], savedKeys: Set<String>, isCfp: Bool) -> some View {
        let saved = savedKeys.contains(id)
        let unavailable = first == "TBD" || second == "TBD"
        return VStack(alignment:.leading,spacing:8) { HStack { Text(label).font(.subheadline.weight(.black)); Spacer(); if saved { Label("RECORDED",systemImage:"lock.fill").font(.system(size:7,weight:.black)).foregroundStyle(.green) } }; HStack(spacing:8) { resultButton(first,id:id,result:result,saved:saved,isCfp:isCfp); resultButton(second,id:id,result:result,saved:saved,isCfp:isCfp) } }.padding(12).background(.black.opacity(0.78),in:RoundedRectangle(cornerRadius:13)).overlay(RoundedRectangle(cornerRadius:13).stroke(unavailable ? Color.gray.opacity(0.2):Color.white.opacity(0.12))).opacity(unavailable ? 0.42:1)
    }

    private func resultButton(_ team:String,id:String,result:[String:String],saved:Bool,isCfp:Bool)->some View { Button { if isCfp { chooseCfp(team,id) } else { bowlResults[id]=team } } label:{ Text(team.uppercased()).font(.caption.weight(.black)).lineLimit(2).minimumScaleFactor(0.7).frame(maxWidth:.infinity,minHeight:44).foregroundStyle(result[id]==team ? .black:.white).background(result[id]==team ? Color.green:Color.white.opacity(0.07),in:RoundedRectangle(cornerRadius:9)) }.buttonStyle(.plain).disabled(saved || team=="TBD") }

    private func chooseCfp(_ team: String, _ id: String) {
        cfpResults[id]=team
        for downstream in ["q1","q2","q3","q4","s1","s2","final"] {
            guard !savedCfpKeys.contains(downstream), let pick=cfpResults[downstream] else { continue }
            let game=playoffGames.first(where:{$0.id==downstream})
            if game.map({ pick != $0.first && pick != $0.second }) == true { cfpResults[downstream]=nil }
        }
    }

    @MainActor private func load() async { defer { loading=false }; guard let token=auth.token else { error="Your command session expired."; return }; do { if let row=try await SupabaseAPI.cfbPostseasonResults(token:token,leagueId:membership.leagueId,seasonKey:seasonKey) { bowlResults=row.bowlResults; cfpResults=row.cfpResults; savedBowlKeys=Set(bowlResults.keys); savedCfpKeys=Set(cfpResults.keys) } } catch { self.error=error.localizedDescription } }
    @MainActor private func save() async { guard changed,let token=auth.token else{return}; saving=true;error=nil;do{let row=try await SupabaseAPI.saveCfbPostseasonResults(token:token,leagueId:membership.leagueId,seasonKey:seasonKey,bowlResults:bowlResults,cfpResults:cfpResults);bowlResults=row.bowlResults;cfpResults=row.cfpResults;savedBowlKeys=Set(bowlResults.keys);savedCfpKeys=Set(cfpResults.keys)}catch{self.error=error.localizedDescription};saving=false }
}

private enum CfbFoundryFixture {
    static let games: [CfbBowlGame] = {
        let names = CfbPostseasonRules.marqueeNames + CfbPostseasonRules.sickoNames
        let schools = ["North Georgia","Great Lakes State","Coastal Tech","Heartland A&M","Blue Ridge","Western Plains","Metro State","Gulf Coast","Piedmont","Desert Valley","Lake City","Central Commonwealth","Atlantic Tech","Prairie State","River Valley","Mountain A&M","Capital University","Southern Tech","Iron City","Pacific State","Eastern Plains","North Coast","Magnolia State","Frontier Tech","Appalachian Tech","Bayou State","Midland","Coastal A&M","Red River","Great Basin","Delta Tech","Lakeshore","Pine State","Sun Coast","Western Commonwealth","Port City","Canyon State","Tidewater Tech","Ozark A&M","North Valley","Eastern Shore","High Plains","Gulf Tech","Mountain State","Central Lakes","Lowcountry A&M","Prairie Tech","Coastal State","Valley Forge","Southern Plains"]
        return names.enumerated().map { index, name in CfbBowlGame(id: "\(index < 15 ? "marquee" : "sicko")-\(index+1)", name: name, tier: index < 15 ? .marquee : .sicko, rank: index < 15 ? index+1 : index-14, away: schools[index*2], home: schools[index*2+1], hostsCfpGame: false) }
    }()
    static let cfpSeeds = (1...12).map { "FOUNDRY CFP SEED \($0)" }
}

private struct CfbPlayoffBracketView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    let seeds: [String]
    let bowlGames: [CfbBowlGame]
    @State private var picks: [String: String] = [:]
    @State private var locked = false
    @State private var loading = true
    @State private var saving = false
    @State private var error: String?
    @State private var cfpScore: Int?
    @State private var cfpResultsCount = 0
    @State private var foundryStandings: [FoundryCfbPostseasonStanding] = []
    private let order = ["r1a","r1b","r1c","r1d","q1","q2","q3","q4","s1","s2","final"]
    private var complete: Bool { order.allSatisfy { picks[$0] != nil } }
    private var seasonKey: Int { Calendar.current.component(.year, from: Date()) }
    private var championshipTrophyAsset: String {
        switch membership.leagues.championshipTrophyId {
        case "golden_gut": "GoldenGutArtifact"
        case "the_receipt": "TheReceiptArtifact"
        case "insufferable_crown": "InsufferableCrownArtifact"
        case "brass_football": "BigBrassFootballArtifact"
        case "last_one_standing": "LastOneStandingArtifact"
        default: "ChampionshipArtifact"
        }
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [.black, Color(red: 0.03, green: 0.07, blue: 0.12), .black], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("SEPARATE SCORING · SAME PHASE III").font(.caption2.weight(.black)).tracking(2).foregroundStyle(.cyan)
                        Text("ROAD THROUGH THE CFP").font(.system(size: 34, weight: .black)).fontWidth(.condensed)
                        Text("Fixed 12-team field · 11 games · no reseeding · every path fights toward the commissioner-selected hardware.").font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
                    }.padding(18).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(.yellow.opacity(0.38)))
                    HStack(spacing: 7) { stage("R1", 4); stage("QF", 8); stage("SF", 10); stage("TITLE", 11) }
                    Text("‹  SWIPE THE WAR TABLE  ›").font(.caption2.weight(.black)).tracking(1.4).foregroundStyle(.green).frame(maxWidth: .infinity)
                    bracket
                    Button { Task { await lockBracket() } } label: {
                        VStack(spacing: 4) {
                            Text(locked ? "CFP BRACKET SEALED" : saving ? "SEALING CFP BRACKET…" : loading ? "RECOVERING CFP BRACKET…" : complete ? "LOCK THIS CHAMPIONSHIP BRACKET" : "\(11-picks.count) DECISIONS REMAIN")
                                .font(.headline.weight(.black))
                            if complete && !locked { Text("NO BACK BUTTON. SEAL IT RIGHT HERE.").font(.system(size: 8, weight: .black)).tracking(1) }
                        }.frame(maxWidth: .infinity).padding(16).foregroundStyle(.black).background(complete || locked ? Color.yellow : Color.gray, in: RoundedRectangle(cornerRadius: 14))
                    }.buttonStyle(.plain).disabled(!complete || locked || loading || saving)
                    if let error { Text(error).font(.footnote.weight(.bold)).foregroundStyle(.red).padding(12).frame(maxWidth: .infinity).background(.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 10)) }
                    if locked { resultStatus }
                    if !foundryStandings.isEmpty { foundryScoreboard }
                }.padding(16).padding(.bottom, 36)
            }
        }.navigationTitle("The CFP").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark).task { await loadEntry() }
    }

    private func stage(_ title: String, _ count: Int) -> some View {
        let done = picks.count >= count
        return Text(title).font(.system(size: 8, weight: .black)).tracking(1).frame(maxWidth: .infinity).padding(.vertical, 9).foregroundStyle(done ? .black : .white.opacity(0.5)).background(done ? Color.green : Color.white.opacity(0.07), in: Capsule())
    }

    private var resultStatus: some View { HStack { VStack(alignment: .leading, spacing: 3) { Text(cfpScore == nil ? "PLAYOFF RESULTS" : "CFP BRACKET FINAL").font(.caption2.weight(.black)).tracking(1).foregroundStyle(.cyan); Text(cfpScore.map { "\($0) / 28 POINTS" } ?? "\(cfpResultsCount)/11 GAMES FINAL").font(.title2.weight(.black)) }; Spacer(); Image(systemName: cfpScore == nil ? "clock.badge.checkmark" : "checkmark.seal.fill").font(.title).foregroundStyle(cfpScore == nil ? .cyan : .green) }.padding(15).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(.cyan.opacity(0.35))) }
    private var foundryScoreboard: some View { VStack(alignment: .leading, spacing: 10) { Text("FOUNDRY POSTSEASON BOARD").font(.headline.weight(.black)).foregroundStyle(.green); ForEach(Array(foundryStandings.enumerated()), id: \.element.id) { index, row in HStack { Text("\(index+1)").font(.caption.weight(.black)).foregroundStyle(.green).frame(width: 24); VStack(alignment: .leading, spacing: 2) { HStack { Text(row.displayName).font(.subheadline.weight(.black)); if row.deadHand { Image(systemName: "hand.raised.fingers.spread.fill").font(.caption).foregroundStyle(.red) } }; Text("BOWL \(row.bowlScore.map(String.init) ?? "—") · CFP \(row.cfpScore.map(String.init) ?? "—")").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.48)) }; Spacer(); Text("\(row.totalScore)").font(.title3.weight(.black)).foregroundStyle(index == 0 ? .yellow : .white) }.padding(.vertical, 5); if index < foundryStandings.count-1 { Divider().overlay(.white.opacity(0.08)) } } }.padding(16).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.green.opacity(0.34))) }

    private var bracket: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .center, spacing: 16) {
                column("FIRST ROUND · LEFT") { game("r1a", "CAMPUS PLAYOFF", seeds[4], seeds[11]); game("r1b", "CAMPUS PLAYOFF", seeds[7], seeds[8]) }
                arrow
                column("QUARTERFINALS · LEFT") { game("q1", "ROSE BOWL", seeds[3], winner("r1a")); game("q2", "SUGAR BOWL", seeds[0], winner("r1b")) }
                arrow
                column("SEMIFINAL · LEFT") { game("s1", "ORANGE BOWL", winner("q1"), winner("q2")) }
                arrow
                VStack(spacing: 12) {
                    Text("THE OBJECTIVE").font(.system(size: 8, weight: .black)).tracking(2).foregroundStyle(.orange)
                    Image(championshipTrophyAsset).resizable().scaledToFit().frame(height: 150).shadow(color: .yellow.opacity(0.65), radius: 28)
                    Text("NATIONAL CHAMPIONSHIP").font(.headline.weight(.black)).foregroundStyle(.yellow)
                    game("final", "CFP NATIONAL CHAMPIONSHIP", winner("s1"), winner("s2"))
                    if let champion = picks["final"] { Text("\(champion) · CHAMPION").font(.caption.weight(.black)).foregroundStyle(.green) }
                }.frame(width: 270).padding(18)
                    .background(LinearGradient(colors: [.black.opacity(0.94), .yellow.opacity(0.18), .black.opacity(0.94)], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 20))
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(.yellow.opacity(0.72), lineWidth: 2))
                    .shadow(color: .yellow.opacity(0.25), radius: 26)
                reverseArrow
                column("SEMIFINAL · RIGHT") { game("s2", "COTTON BOWL", winner("q3"), winner("q4")) }
                reverseArrow
                column("QUARTERFINALS · RIGHT") { game("q3", "PEACH BOWL", seeds[1], winner("r1c")); game("q4", "FIESTA BOWL", seeds[2], winner("r1d")) }
                reverseArrow
                column("FIRST ROUND · RIGHT") { game("r1c", "CAMPUS PLAYOFF", seeds[6], seeds[9]); game("r1d", "CAMPUS PLAYOFF", seeds[5], seeds[10]) }
            }.padding(.horizontal, 30).padding(.vertical, 50).frame(minWidth: 1980, minHeight: 660)
                .background {
                    ZStack {
                        Image("BracketWarTable").resizable().scaledToFill().opacity(0.46)
                        LinearGradient(colors: [.black.opacity(0.78), Color(red: 0.02, green: 0.20, blue: 0.13).opacity(0.34), .black.opacity(0.78)], startPoint: .leading, endPoint: .trailing)
                        RadialGradient(colors: [.yellow.opacity(0.16), .clear], center: .center, startRadius: 20, endRadius: 520)
                    }.clipped()
                }
        }.clipShape(RoundedRectangle(cornerRadius: 19)).overlay(RoundedRectangle(cornerRadius: 19).stroke(.cyan.opacity(0.30)))
    }

    private var arrow: some View { HStack(spacing: 2) { Rectangle().frame(height: 2); Image(systemName: "chevron.right.2") }.font(.title3.weight(.black)).foregroundStyle(.green).shadow(color: .green, radius: 7).frame(width: 48) }
    private var reverseArrow: some View { HStack(spacing: 2) { Image(systemName: "chevron.left.2"); Rectangle().frame(height: 2) }.font(.title3.weight(.black)).foregroundStyle(.green).shadow(color: .green, radius: 7).frame(width: 48) }
    private func column<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View { VStack(spacing: 12) { Text(title).font(.caption.weight(.black)).tracking(1.4).foregroundStyle(.cyan); content() }.frame(width: 220).padding(12).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(.green.opacity(0.28))).shadow(color: .green.opacity(0.16), radius: 14) }
    private func winner(_ id: String) -> String { picks[id] ?? "TBD" }

    private func game(_ id: String, _ bowlName: String, _ first: String, _ second: String) -> some View {
        VStack(spacing: 7) {
            Text(bowlName).font(.system(size: 8, weight: .black)).tracking(0.8).foregroundStyle(id == "final" ? .black : .black)
                .padding(.horizontal, 10).padding(.vertical, 5).frame(maxWidth: .infinity)
                .background(id == "final" ? Color.yellow : Color.orange, in: Capsule())
            team(first, id); team(second, id)
        }.padding(10).background(.black.opacity(0.88), in: RoundedRectangle(cornerRadius: 11)).overlay(RoundedRectangle(cornerRadius: 11).stroke(id == "final" ? .yellow.opacity(0.55) : .green.opacity(0.34)))
    }
    private func team(_ name: String, _ game: String) -> some View {
        Button { choose(name, game) } label: { Text(name).font(.caption.weight(.black)).lineLimit(1).frame(maxWidth: .infinity, minHeight: 38).foregroundStyle(picks[game] == name ? .black : .white).background(picks[game] == name ? Color.green : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 8)) }.buttonStyle(.plain).disabled(locked || name == "TBD")
    }
    private func choose(_ team: String, _ game: String) {
        picks[game] = team
        let legal: [String: Set<String>] = [
            "q1":[seeds[3],winner("r1a")], "q2":[seeds[0],winner("r1b")], "q3":[seeds[1],winner("r1c")], "q4":[seeds[2],winner("r1d")],
            "s1":[winner("q1"),winner("q2")], "s2":[winner("q3"),winner("q4")], "final":[winner("s1"),winner("s2")]
        ]
        for id in ["q1","q2","q3","q4","s1","s2","final"] where picks[id].map({ !(legal[id]?.contains($0) ?? false) }) == true { picks[id] = nil }
    }

    @MainActor private func loadEntry() async {
        defer { loading = false }
        guard let token = auth.token, let user = auth.user else { error = "Your command session expired. Sign in again."; return }
        do {
            async let loadedEntry = SupabaseAPI.cfbPostseasonEntry(token: token, leagueId: membership.leagueId, userId: user.id, seasonKey: seasonKey)
            async let loadedResults = SupabaseAPI.cfbPostseasonResults(token: token, leagueId: membership.leagueId, seasonKey: seasonKey)
            let (entry, results) = try await (loadedEntry, loadedResults)
            if let entry { if !entry.cfpPicks.isEmpty { picks = entry.cfpPicks }; locked = entry.cfpLockedAt != nil; cfpScore = entry.cfpScore }
            cfpResultsCount = results?.cfpResults.count ?? 0
            if membership.leagues.mode == "foundry" { foundryStandings = try await SupabaseAPI.foundryCfbPostseasonStandings(token: token, leagueId: membership.leagueId, seasonKey: seasonKey) }
        } catch { self.error = error.localizedDescription }
    }

    @MainActor private func lockBracket() async {
        guard !saving, let token = auth.token else { return }
        saving = true; error = nil
        do {
            let entry = try await SupabaseAPI.lockCfbPlayoffBracket(token: token, leagueId: membership.leagueId, seasonKey: seasonKey, picks: picks)
            locked = entry.cfpLockedAt != nil
        } catch { self.error = error.localizedDescription }
        saving = false
    }

}
