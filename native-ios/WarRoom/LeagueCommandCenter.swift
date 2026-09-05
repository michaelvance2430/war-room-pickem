import SwiftUI

struct LeagueAttention: Identifiable, Sendable {
    let membership: LeagueMembership
    let unreadLocker: Int
    let unreadAnnouncements: Int
    let playerTasks: [String]
    let commissionerTasks: [String]
    let dataIsCurrent: Bool
    var id: UUID { membership.leagueId }
    var priority: Int { playerTasks.count * 1_000 + commissionerTasks.count * 100 + unreadAnnouncements * 10 + unreadLocker }
    var totalUnread: Int { unreadLocker + unreadAnnouncements }
    var needsPlayerAction: Bool { !playerTasks.isEmpty }
    var needsCommissionerAction: Bool { !commissionerTasks.isEmpty }
}

struct LeagueAttentionSummary: Sendable, Equatable {
    let playerLeagueCount: Int
    let commissionerLeagueCount: Int

    init(playerLeagueCount: Int, commissionerLeagueCount: Int) {
        self.playerLeagueCount = playerLeagueCount
        self.commissionerLeagueCount = commissionerLeagueCount
    }

    init(attention: [LeagueAttention]) {
        playerLeagueCount = attention.filter(\.needsPlayerAction).count
        commissionerLeagueCount = attention.filter(\.needsCommissionerAction).count
    }
}

nonisolated enum LeagueAttentionValueState: Sendable, Equatable {
    case unavailable
    case missing
    case present
}

enum LeagueAttentionTaskClassifier {
    nonisolated static func playerTasks(
        sportID: String,
        week: Int,
        card: LeagueAttentionValueState,
        pick: LeagueAttentionValueState,
        crystalBall: LeagueAttentionValueState,
        favoriteTeam: LeagueAttentionValueState
    ) -> [String] {
        var tasks: [String] = []
        if card == .present, pick == .missing { tasks.append("Make Week \(week) picks") }
        if crystalBall == .missing { tasks.append(sportID.lowercased() == "nfl" ? "Call the Super Bowl champion" : "Lock Crystal Ball") }
        if favoriteTeam == .missing { tasks.append("Choose favorite team") }
        return tasks
    }

    nonisolated static func commissionerTasks(isCommissioner: Bool, week: Int, card: LeagueAttentionValueState, hasTrophy: Bool) -> [String] {
        guard isCommissioner else { return [] }
        var tasks: [String] = []
        if card == .missing { tasks.append("Build Week \(week) card") }
        if !hasTrophy { tasks.append("Choose championship hardware") }
        return tasks
    }
}

enum LeagueAttentionService {
    private struct Probe<Value: Sendable>: Sendable {
        let value: Value?
        let succeeded: Bool
    }

    nonisolated private static func probe<Value: Sendable>(_ operation: @Sendable () async throws -> Value?) async -> Probe<Value> {
        do { return Probe(value: try await operation(), succeeded: true) }
        catch { return Probe(value: nil, succeeded: false) }
    }

    nonisolated static func load(memberships: [LeagueMembership], token: String, user: AuthUser) async -> [LeagueAttention] {
        let favoriteBySport = await favoriteTeamStates(memberships: memberships, token: token, userID: user.id)
        let favoriteTaskLeagueBySport = Dictionary(uniqueKeysWithValues: Dictionary(grouping: memberships) {
            $0.leagues.sportId.lowercased()
        }.compactMap { sportID, sportMemberships in
            sportMemberships.sorted { $0.leagues.name.localizedCaseInsensitiveCompare($1.leagues.name) == .orderedAscending }
                .first.map { (sportID, $0.leagueId) }
        })
        return await withTaskGroup(of: LeagueAttention.self) { group in
            for membership in memberships {
                group.addTask {
                    async let cardProbe = probe {
                        try await SupabaseAPI.weekCard(token: token, leagueId: membership.leagueId, weekNumber: membership.leagues.currentWeek)
                    }
                    async let pickProbe = probe {
                        try await SupabaseAPI.playerPick(token: token, leagueId: membership.leagueId, userId: user.id, weekNumber: membership.leagues.currentWeek)
                    }
                    async let crystalProbe = probe {
                        try await SupabaseAPI.crystalBallPick(token: token, leagueId: membership.leagueId, userId: user.id)
                    }
                    async let lockerProbe = probe {
                        try await SupabaseAPI.lockerMessages(token: token, leagueId: membership.leagueId)
                    }
                    async let announcementProbe = probe {
                        try await SupabaseAPI.announcements(token: token, leagueId: membership.leagueId)
                    }

                    let card = await cardProbe
                    let pick = await pickProbe
                    let crystal = await crystalProbe
                    let locker = await lockerProbe
                    let announcements = await announcementProbe
                    let commissioner = membership.isCommissioner(userId: user.id)
                    let cardState = state(for: card)
                    let sportID = membership.leagues.sportId.lowercased()
                    let favoriteState = favoriteTaskLeagueBySport[sportID] == membership.leagueId
                        ? (favoriteBySport[sportID] ?? .unavailable)
                        : .present
                    let playerTasks = LeagueAttentionTaskClassifier.playerTasks(
                        sportID: membership.leagues.sportId,
                        week: membership.leagues.currentWeek,
                        card: cardState,
                        pick: state(for: pick),
                        crystalBall: state(for: crystal),
                        favoriteTeam: favoriteState
                    )
                    let commissionerTasks = LeagueAttentionTaskClassifier.commissionerTasks(
                        isCommissioner: commissioner,
                        week: membership.leagues.currentWeek,
                        card: cardState,
                        hasTrophy: membership.leagues.championshipTrophyId != nil
                    )

                    let lockerMessages = locker.value ?? []
                    let announcementRows = announcements.value ?? []
                    return LeagueAttention(
                        membership: membership,
                        unreadLocker: LeagueAttentionStore.unreadLockerMessages(lockerMessages, leagueId: membership.leagueId, userId: user.id),
                        unreadAnnouncements: announcementRows.filter(\.isUnread).count,
                        playerTasks: playerTasks,
                        commissionerTasks: commissionerTasks,
                        dataIsCurrent: card.succeeded && pick.succeeded && crystal.succeeded && favoriteBySport[sportID] != .unavailable
                    )
                }
            }
            var rows: [LeagueAttention] = []
            for await row in group { rows.append(row) }
            return rows
        }
    }

    nonisolated private static func favoriteTeamStates(memberships: [LeagueMembership], token: String, userID: UUID) async -> [String: LeagueAttentionValueState] {
        let sportIDs = Set(memberships.map { $0.leagues.sportId.lowercased() })
        return await withTaskGroup(of: (String, LeagueAttentionValueState).self) { group in
            for sportID in sportIDs {
                group.addTask {
                    let result = await probe {
                        try await SupabaseAPI.favoriteTeam(token: token, userId: userID, sportId: sportID)
                    }
                    return (sportID, state(for: result))
                }
            }
            var states: [String: LeagueAttentionValueState] = [:]
            for await (sportID, state) in group { states[sportID] = state }
            return states
        }
    }

    nonisolated private static func state<Value: Sendable>(for probe: Probe<Value>) -> LeagueAttentionValueState {
        guard probe.succeeded else { return .unavailable }
        return probe.value == nil ? .missing : .present
    }
}

enum LeagueAttentionStore {
    nonisolated private static func lockerKey(_ leagueId: UUID) -> String { "warroom-locker-seen-\(leagueId.uuidString.lowercased())" }

    nonisolated static func unreadLockerMessages(_ messages: [LockerMessage], leagueId: UUID, userId: UUID) -> Int {
        guard let lastSeen = UserDefaults.standard.string(forKey: lockerKey(leagueId)),
              let lastDate = ISO8601DateFormatter().date(from: lastSeen) else {
            return messages.filter { $0.userId != userId }.count
        }
        return messages.filter { $0.userId != userId && (ISO8601DateFormatter().date(from: $0.createdAt) ?? .distantPast) > lastDate }.count
    }

    static func markLockerRead(leagueId: UUID, messages: [LockerMessage]) {
        let newest = messages.compactMap { ISO8601DateFormatter().date(from: $0.createdAt) }.max() ?? Date()
        UserDefaults.standard.set(ISO8601DateFormatter().string(from: newest), forKey: lockerKey(leagueId))
    }
}

struct LeagueCommandCenterView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let memberships: [LeagueMembership]
    @State private var attention: [LeagueAttention] = []
    @State private var loading = true
    @State private var expandedSports: Set<String> = []

    var body: some View {
        ZStack {
            LinearGradient(colors: [.black, Color(red: 0.02, green: 0.12, blue: 0.06), .black], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 14) {
                    VStack(alignment: .leading, spacing: 7) {
                        Label("ALL FREQUENCIES", systemImage: "antenna.radiowaves.left.and.right").font(.caption2.weight(.black)).tracking(2).foregroundStyle(.green)
                        Text("LEAGUE COMMAND").font(.system(size: 34, weight: .black)).fontWidth(.condensed)
                        Text("THE LOUDEST FIRE GOES FIRST.").font(.system(size: 9, weight: .black)).tracking(1.5).foregroundStyle(.white.opacity(0.46))
                    }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
                    NavigationLink {
                        LobbyView()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("THE MUSTER").font(.system(size: 8, weight: .black)).tracking(1.6).foregroundStyle(.green)
                                Text("ENTER LOBBY").font(.headline.weight(.black)).foregroundStyle(.white)
                                Text("Browse first. Choose your own room.").font(.caption).foregroundStyle(.white.opacity(0.48))
                            }
                            Spacer()
                            Image(systemName: "person.3.sequence.fill").font(.title2.weight(.black)).foregroundStyle(.green)
                            Image(systemName: "chevron.right").foregroundStyle(.green)
                        }.padding(16).background(.green.opacity(0.10), in: RoundedRectangle(cornerRadius: 18))
                            .overlay(RoundedRectangle(cornerRadius: 18).stroke(.green.opacity(0.45)))
                    }.buttonStyle(.plain)
                    NavigationLink {
                        CreateLeagueView()
                    } label: {
                        Label("CREATE NEW LEAGUE", systemImage: "plus.circle.fill")
                            .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(15)
                            .foregroundStyle(.black).background(.green, in: RoundedRectangle(cornerRadius: 16))
                    }.buttonStyle(.plain)
                    if loading { ProgressView("Scanning every room…").tint(.green).padding(30) }
                    else {
                        ForEach(sportIds, id: \.self) { sportId in
                            let sportRooms = attention.filter { $0.membership.leagues.sportId.lowercased() == sportId }.sorted(by: priorityOrder)
                            Button {
                                withAnimation(.snappy) {
                                    if expandedSports.contains(sportId) { expandedSports.remove(sportId) }
                                    else { expandedSports.insert(sportId) }
                                }
                            } label: {
                                HStack {
                                    Text(sportLabel(sportId)).font(.caption.weight(.black)).tracking(2)
                                    Spacer()
                                    let summary = LeagueAttentionSummary(attention: sportRooms)
                                    if summary.playerLeagueCount > 0 {
                                        attentionPill("\(summary.playerLeagueCount)", "TO DO", "exclamationmark", .red)
                                    }
                                    if summary.commissionerLeagueCount > 0 {
                                        attentionPill("\(summary.commissionerLeagueCount)", "COMMAND", "star.fill", .cyan)
                                    }
                                    Text("\(sportRooms.count)").font(.caption.weight(.black)).monospacedDigit()
                                    Image(systemName: expandedSports.contains(sportId) ? "chevron.up" : "chevron.down")
                                }
                                .foregroundStyle(fieldhouseSportIDs.contains(sportId) ? SportIdentity(sportId).accent : .yellow)
                                .padding(14).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 14))
                            }.buttonStyle(.plain)
                            if expandedSports.contains(sportId) {
                                ForEach(sportRooms) { item in
                                    Button { auth.selectLeague(item.id); dismiss() } label: { leagueCard(item) }.buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }.padding(16).padding(.bottom, 30)
            }
        }
        .navigationTitle("Your Leagues").navigationBarTitleDisplayMode(.inline).task { await loadAttention() }
    }

    private func leagueCard(_ item: LeagueAttention) -> some View {
        let selected = auth.selectedLeagueId == item.id
        let urgent = item.needsPlayerAction
        let accent: Color = urgent ? .red : (item.needsCommissionerAction ? .cyan : (item.totalUnread > 0 ? .orange : .green))
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.membership.leagues.name.uppercased()).font(.title3.weight(.black)).foregroundStyle(.white)
                    Text("\(item.membership.leagues.sportId.uppercased()) · WEEK \(item.membership.leagues.currentWeek)").font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(accent)
                }
                Spacer()
                if selected { Label("ACTIVE", systemImage: "dot.radiowaves.left.and.right").font(.caption2.weight(.black)).foregroundStyle(.green) }
                else { Image(systemName: "arrow.right.circle.fill").foregroundStyle(accent) }
            }
            HStack(spacing: 8) {
                attentionPill("\(item.playerTasks.count)", "TO DO", "checklist", item.playerTasks.isEmpty ? .green : .red)
                if let userID = auth.user?.id, item.membership.isCommissioner(userId: userID) {
                    attentionPill("\(item.commissionerTasks.count)", "COMMAND", "star.fill", item.commissionerTasks.isEmpty ? .green : .cyan)
                }
                attentionPill("\(item.unreadLocker)", "LOCKER", "bubble.left.and.bubble.right.fill", item.unreadLocker == 0 ? .green : .orange)
                attentionPill("\(item.unreadAnnouncements)", "ORDERS", "megaphone.fill", item.unreadAnnouncements == 0 ? .green : .yellow)
            }
            if let first = item.playerTasks.first { Label(first.uppercased(), systemImage: "exclamationmark.triangle.fill").font(.system(size: 9, weight: .black)).tracking(0.7).foregroundStyle(.red) }
            else if let first = item.commissionerTasks.first { Label(first.uppercased(), systemImage: "star.fill").font(.system(size: 9, weight: .black)).tracking(0.7).foregroundStyle(.cyan) }
            else if item.totalUnread > 0 { Text("NEW TRAFFIC IS WAITING").font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(.orange) }
            else if !item.dataIsCurrent { Text("STATUS CHECK UNAVAILABLE · PULL TO RETRY").font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(.yellow) }
            else { Text("ROOM CLEAR · NO ACTION REQUIRED").font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(.green.opacity(0.8)) }
        }
        .padding(16)
        .background(LinearGradient(colors: [.black.opacity(0.92), accent.opacity(0.12)], startPoint: .leading, endPoint: .trailing), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 22, bottomTrailingRadius: 4, topTrailingRadius: 22))
        .overlay(alignment: .leading) { Rectangle().fill(accent).frame(width: urgent ? 4 : 2).padding(.vertical, 11) }
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 22, bottomTrailingRadius: 4, topTrailingRadius: 22).stroke(accent.opacity(selected ? 0.75 : 0.38)))
    }

    private func attentionPill(_ value: String, _ label: String, _ icon: String, _ color: Color) -> some View {
        HStack(spacing: 5) { Image(systemName: icon).font(.caption2); Text(value).font(.caption.weight(.black)).monospacedDigit(); Text(label).font(.system(size: 7, weight: .black)).tracking(0.6) }
            .foregroundStyle(color).padding(.horizontal, 8).padding(.vertical, 7).background(color.opacity(0.10), in: Capsule()).overlay(Capsule().stroke(color.opacity(0.34)))
    }

    private func priorityOrder(_ left: LeagueAttention, _ right: LeagueAttention) -> Bool {
        if left.priority != right.priority { return left.priority > right.priority }
        return left.membership.leagues.name.localizedCaseInsensitiveCompare(right.membership.leagues.name) == .orderedAscending
    }

    private var sportIds: [String] {
        let ids = Set(attention.map { $0.membership.leagues.sportId.lowercased() })
        let preferred = ["cfb", "nfl", "ncaam", "ncaaw", "cbb"]
        return preferred.filter(ids.contains) + ids.filter { !preferred.contains($0) }.sorted()
    }

    private let fieldhouseSportIDs: Set<String> = ["cbb", "ncaam", "ncaaw"]

    private func sportLabel(_ sportID: String) -> String {
        switch sportID {
        case "ncaam": return "THE FIELDHOUSE · NCAAM"
        case "ncaaw": return "THE FIELDHOUSE · NCAAW"
        case "cbb": return "FIELDHOUSE · LEGACY"
        default: return sportID.uppercased()
        }
    }

    private func loadAttention() async {
        guard let token = auth.token, let user = auth.user else { loading = false; return }
        attention = await LeagueAttentionService.load(memberships: memberships, token: token, user: user)
        loading = false
    }
}
