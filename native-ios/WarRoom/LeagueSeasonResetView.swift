import SwiftUI

private enum LeagueDivision: String, CaseIterable, Identifiable {
    case north = "North"
    case south = "South"
    case east = "East"
    case west = "West"

    var id: String { rawValue }
}

struct LeagueManagementView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    @State private var standings: [Standing] = []
    @State private var loading = true
    @State private var savingMembershipId: UUID?
    @State private var balancing = false
    @State private var showingAutoBalanceConfirmation = false
    @State private var balanceSummary: String?
    @State private var error: String?

    private var identity: SportIdentity { SportIdentity(membership.leagues.sportId) }
    private var accent: Color {
        if identity.isNFL { return .cyan }
        if identity.sportId == "cbb" { return .orange }
        return .green
    }
    private var groupNoun: String {
        if identity.isNFL { return "PRO CONFERENCES" }
        if identity.sportId == "cbb" { return "FIELDHOUSE REGIONS" }
        return "COLLEGE CONFERENCES"
    }

    var body: some View {
        ZStack {
            managementBackdrop
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    rosterSummary
                    if loading {
                        ProgressView("Opening the roster…").tint(accent).frame(maxWidth: .infinity).padding(30)
                    } else if standings.isEmpty {
                        managementPanel {
                            Label("NO PLAYERS FOUND", systemImage: "person.crop.circle.badge.questionmark")
                                .font(.headline.weight(.black)).foregroundStyle(.white)
                        }
                    } else {
                        Text("PLAYER ALIGNMENT").font(.caption.weight(.black)).tracking(1.7).foregroundStyle(accent)
                        Text("Tap a player’s current assignment to move them. Changes save immediately for this league.")
                            .font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
                        LazyVStack(spacing: 10) {
                            ForEach(standings.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }) { standing in
                                playerRow(standing)
                            }
                        }
                        autoBalanceControl
                    }
                    if let error {
                        managementPanel {
                            Label(error, systemImage: "exclamationmark.triangle.fill")
                                .font(.footnote.weight(.bold)).foregroundStyle(.red)
                        }
                    }
                    seasonControls
                }
                .padding(18).padding(.bottom, 42)
            }
            .refreshable { await loadRoster() }
        }
        .navigationTitle("Manage League")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .task { await loadRoster() }
        .alert("Auto-balance the roster?", isPresented: $showingAutoBalanceConfirmation) {
            Button("CANCEL", role: .cancel) {}
            Button("BALANCE (groupNoun)") { Task { await autoBalance() } }
        } message: {
            Text("This evenly redistributes all players across four groups. Existing assignments are preserved whenever the final group sizes allow it. You can still move anyone manually afterward.")
        }
    }

    @ViewBuilder private var managementBackdrop: some View {
        if identity.isNFL {
            NflHomeBackdrop(phase: NflSeasonPhase.phase(week: membership.leagues.currentWeek))
        } else if identity.sportId == "cbb" {
            LinearGradient(colors: [.black, .purple.opacity(0.28), .orange.opacity(0.14), .black], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
        } else {
            LinearGradient(colors: [.black, Color(red: 0.02, green: 0.13, blue: 0.08), .black], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("COMMISSIONER ACCESS", systemImage: identity.isNFL ? "shield.lefthalf.filled" : "star.circle.fill")
                .font(.caption2.weight(.black)).tracking(1.8).foregroundStyle(accent)
            Text("MANAGE\nLEAGUE").font(.system(size: 43, weight: .black)).fontWidth(.condensed).foregroundStyle(.white)
            Text(membership.leagues.name.uppercased()).font(.caption.weight(.black)).tracking(1.2).foregroundStyle(.white.opacity(0.52))
            Text("The permanent front office for your people, alignment, and season controls.")
                .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.68))
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: [.black.opacity(0.9), accent.opacity(0.16)], startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 18))
        .overlay(alignment: .leading) { Rectangle().fill(accent).frame(width: 4).padding(.vertical, 12) }
        .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 18).stroke(accent.opacity(0.46)))
    }

    private var rosterSummary: some View {
        managementPanel {
            VStack(alignment: .leading, spacing: 13) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("ROSTER & \(groupNoun)").font(.caption2.weight(.black)).tracking(1.35).foregroundStyle(accent)
                        Text("\(standings.count) PLAYERS").font(.title3.weight(.black)).foregroundStyle(.white)
                    }
                    Spacer()
                    Image(systemName: "person.3.fill").font(.title2.weight(.black)).foregroundStyle(accent)
                }
                HStack(spacing: 6) {
                    ForEach(LeagueDivision.allCases) { division in
                        VStack(spacing: 3) {
                            Text("\(count(in: division))").font(.headline.weight(.black)).foregroundStyle(.white)
                            Text(identity.divisionLabel(division.rawValue)).font(.system(size: 8, weight: .black)).minimumScaleFactor(0.65).lineLimit(1).foregroundStyle(accent)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 9)
                        .background(accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))
                    }
                }
            }
        }
    }

    private func playerRow(_ standing: Standing) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(accent.opacity(0.14)).frame(width: 40, height: 40)
                Text(String(standing.name.prefix(1)).uppercased()).font(.headline.weight(.black)).foregroundStyle(accent)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(standing.name).font(.subheadline.weight(.black)).foregroundStyle(.white).lineLimit(1)
                Text(standing.isBot ? "FOUNDRY PLAYER" : "ROSTERED PLAYER").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.38))
            }
            Spacer(minLength: 8)
            if savingMembershipId == standing.id {
                ProgressView().tint(accent).frame(width: 92)
            } else {
                Menu {
                    ForEach(LeagueDivision.allCases) { division in
                        Button {
                            Task { await move(standing, to: division) }
                        } label: {
                            if normalizedDivision(standing.division) == division.rawValue {
                                Label(identity.divisionLabel(division.rawValue), systemImage: "checkmark")
                            } else {
                                Text(identity.divisionLabel(division.rawValue))
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 6) {
                        Text(identity.divisionLabel(standing.division)).font(.caption2.weight(.black)).lineLimit(1)
                        Image(systemName: "chevron.up.chevron.down").font(.system(size: 8, weight: .black))
                    }
                    .foregroundStyle(accent).padding(.horizontal, 10).padding(.vertical, 8)
                    .background(accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(accent.opacity(0.38)))
                }
            }
        }
        .padding(13)
        .background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 14))
        .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 14).stroke(.white.opacity(0.1)))
    }

    private var autoBalanceControl: some View {
        managementPanel {
            VStack(alignment: .leading, spacing: 11) {
                HStack(spacing: 11) {
                    Image(systemName: "scale.3d").font(.title2.weight(.black)).foregroundStyle(accent)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("AUTO-BALANCE ROSTER").font(.headline.weight(.black)).foregroundStyle(.white)
                        Text("Even groups. Minimum necessary moves. Manual control remains.")
                            .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.55))
                    }
                }
                Button { showingAutoBalanceConfirmation = true } label: {
                    Label(balancing ? "BALANCING…" : "BALANCE (standings.count) PLAYERS", systemImage: "person.3.sequence.fill")
                        .font(.subheadline.weight(.black)).frame(maxWidth: .infinity).padding(13)
                        .foregroundStyle(identity.isNFL ? .black : .black)
                        .background(balancing ? Color.gray : accent, in: RoundedRectangle(cornerRadius: identity.isNFL ? 5 : 12))
                }
                .buttonStyle(.plain)
                .disabled(balancing || savingMembershipId != nil || standings.isEmpty)
                if let balanceSummary {
                    Label(balanceSummary, systemImage: "checkmark.seal.fill")
                        .font(.caption.weight(.black)).foregroundStyle(accent)
                }
            }
        }
    }

    private var seasonControls: some View {
        VStack(alignment: .leading, spacing: 11) {
            Text("SEASON CONTROL").font(.caption.weight(.black)).tracking(1.7).foregroundStyle(.red)
            NavigationLink { LeagueSeasonResetView(membership: membership) } label: {
                HStack(spacing: 13) {
                    Image(systemName: "arrow.counterclockwise.circle.fill").font(.title2.weight(.black)).foregroundStyle(.red)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("RESET THE SEASON").font(.headline.weight(.black)).foregroundStyle(.white)
                        Text("Preserve the roster and hardware. Erase the active season only.").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.55))
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption.weight(.black)).foregroundStyle(.red)
                }
                .padding(15).background(.red.opacity(0.07), in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 14))
                .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 14).stroke(.red.opacity(0.35)))
            }.buttonStyle(.plain)
        }
    }

    private func managementPanel<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content().padding(15).frame(maxWidth: .infinity, alignment: .leading)
            .background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 15))
            .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 15).stroke(accent.opacity(0.3)))
    }

    private func normalizedDivision(_ division: String?) -> String {
        LeagueDivision.allCases.first { $0.rawValue.caseInsensitiveCompare(division ?? "") == .orderedSame }?.rawValue ?? LeagueDivision.north.rawValue
    }

    private func count(in division: LeagueDivision) -> Int {
        standings.filter { normalizedDivision($0.division) == division.rawValue }.count
    }

    @MainActor private func loadRoster() async {
        guard let token = auth.token else { return }
        loading = standings.isEmpty
        error = nil
        defer { loading = false }
        do { standings = try await SupabaseAPI.standings(token: token, leagueId: membership.leagueId) }
        catch { self.error = error.localizedDescription }
    }

    @MainActor private func move(_ standing: Standing, to division: LeagueDivision) async {
        guard let token = auth.token, normalizedDivision(standing.division) != division.rawValue else { return }
        savingMembershipId = standing.id
        error = nil
        defer { savingMembershipId = nil }
        do {
            try await SupabaseAPI.updateMemberDivision(token: token, leagueId: membership.leagueId, membershipId: standing.id, division: division.rawValue)
            standings = try await SupabaseAPI.standings(token: token, leagueId: membership.leagueId)
        } catch { self.error = error.localizedDescription }
    }

    @MainActor private func autoBalance() async {
        guard let token = auth.token, !standings.isEmpty else { return }
        balancing = true
        error = nil
        balanceSummary = nil
        defer { balancing = false }
        let candidates = standings.map {
            LeagueDivisionBalanceCandidate(membershipId: $0.id, name: $0.name, currentDivision: $0.division)
        }
        let assignments = LeagueDivisionBalancer.assignments(for: candidates)
        let moves = standings.compactMap { standing -> (Standing, String)? in
            guard let division = assignments[standing.id], normalizedDivision(standing.division) != division else { return nil }
            return (standing, division)
        }
        do {
            for (standing, division) in moves {
                try await SupabaseAPI.updateMemberDivision(
                    token: token,
                    leagueId: membership.leagueId,
                    membershipId: standing.id,
                    division: division
                )
            }
            standings = try await SupabaseAPI.standings(token: token, leagueId: membership.leagueId)
            balanceSummary = moves.isEmpty ? "ROSTER ALREADY BALANCED" : "(moves.count) MOVES COMPLETE · GROUPS BALANCED"
        } catch {
            standings = (try? await SupabaseAPI.standings(token: token, leagueId: membership.leagueId)) ?? standings
            self.error = "Auto-balance stopped: \(error.localizedDescription)"
        }
    }
}

struct LeagueSeasonResetView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    @State private var confirmation = ""
    @State private var showingFinalWarning = false
    @State private var resetting = false
    @State private var complete = false
    @State private var error: String?
    private var identity: SportIdentity { SportIdentity(membership.leagues.sportId) }

    var body: some View {
        ZStack {
            if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) }
            else { LinearGradient(colors:[.black,.red.opacity(0.22),.black],startPoint:.top,endPoint:.bottom).ignoresSafeArea() }
            ScrollView { VStack(alignment:.leading,spacing:17) {
                Label("COMMISSIONER FIRE CONTROL",systemImage:"exclamationmark.octagon.fill").font(.caption.weight(.black)).tracking(1.8).foregroundStyle(.red)
                Text("RESET THE\nSEASON").font(.system(size:42,weight:.black)).fontWidth(.condensed)
                Text("This is a new-season restart—not a rage button. The roster, trophies, ranks, permanent cheevos, Locker Room, and weapon history survive.").font(.body.weight(.semibold)).foregroundStyle(.white.opacity(0.68))
                VStack(alignment:.leading,spacing:9) {
                    resetRow("ERASED", identity.isNFL ? "Cards, picks, scores, standings totals, Dispatch editions, and NFL playoff brackets" : "Cards, picks, scores, standings totals, Dispatch editions, Crystal Ball picks, and postseason boards",.red)
                    resetRow("PRESERVED","Players, trophies, cheevos, ranks, profile schwag, Locker Room, and weapon history",identity.isNFL ? .cyan : .green)
                    resetRow("RESTARTS AT","Week \(identity.openingWeek) with the existing league and commissioner",identity.isNFL ? .blue : .yellow)
                }.commandPanel(accent: identity.isNFL ? .cyan : .green, cornerRadius: identity.isNFL ? 6 : 15)
                Text("TYPE THE EXACT LEAGUE NAME").font(.caption2.weight(.black)).tracking(1.3).foregroundStyle(.red)
                Text(membership.leagues.name).font(.headline.weight(.black))
                TextField("League name",text:$confirmation).textInputAutocapitalization(.never).autocorrectionDisabled().textFieldStyle(.roundedBorder)
                Button { showingFinalWarning=true } label: { Label(resetting ? "RESETTING…":"ARM SEASON RESET",systemImage:"lock.open.fill").font(.headline.weight(.black)).frame(maxWidth:.infinity).padding(16).foregroundStyle(.white).background(confirmation==membership.leagues.name ? Color.red:.gray,in:RoundedRectangle(cornerRadius:14)) }.buttonStyle(.plain).disabled(confirmation != membership.leagues.name || resetting || complete)
                if complete { Label("SEASON RESET · WEEK \(identity.openingWeek) READY",systemImage:"checkmark.seal.fill").font(.headline.weight(.black)).foregroundStyle(identity.isNFL ? .cyan : .green).frame(maxWidth:.infinity).padding(16).background((identity.isNFL ? Color.blue : Color.green).opacity(0.12),in:RoundedRectangle(cornerRadius:identity.isNFL ? 6 : 14)) }
                if let error { Text(error).font(.footnote.weight(.bold)).foregroundStyle(.red).commandPanel(accent: identity.isNFL ? .cyan : .green, cornerRadius: identity.isNFL ? 6 : 15) }
            }.padding(20).padding(.bottom,40) }
        }.navigationTitle("Season Reset").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark)
        .alert("Erase the active season?",isPresented:$showingFinalWarning) {
            Button("CANCEL",role:.cancel){}
            Button("RESET TO WEEK \(identity.openingWeek)",role:.destructive){Task{await reset()}}
        } message:{Text(identity.isNFL ? "This permanently clears the active season’s cards, picks, scores, Dispatch, and NFL playoff data. It cannot be undone." : "This permanently clears the active season’s cards, picks, scores, Dispatch, Crystal Ball, and postseason data. It cannot be undone.")}
    }
    private func resetRow(_ label:String,_ detail:String,_ color:Color)->some View { HStack(alignment:.top) { Text(label).font(.caption2.weight(.black)).foregroundStyle(color).frame(width:74,alignment:.leading);Text(detail).font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.64)) } }
    @MainActor private func reset() async { guard let token=auth.token else{return};resetting=true;error=nil;defer{resetting=false};do{try await SupabaseAPI.resetLeagueSeason(token:token,leagueId:membership.leagueId,confirmationName:confirmation);complete=true}catch{self.error=error.localizedDescription} }
}
