import SwiftUI

struct LeagueAttention: Identifiable, Sendable {
    let membership: LeagueMembership
    let unreadLocker: Int
    let unreadAnnouncements: Int
    let tasks: [String]
    var id: UUID { membership.leagueId }
    var priority: Int { tasks.count * 100 + unreadAnnouncements * 10 + unreadLocker }
    var totalUnread: Int { unreadLocker + unreadAnnouncements }
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
                            HStack {
                                Text(sportId.uppercased()).font(.caption.weight(.black)).tracking(2).foregroundStyle(.yellow)
                                Rectangle().fill(.yellow.opacity(0.35)).frame(height: 1)
                            }.padding(.top, 4)
                            ForEach(attention.filter { $0.membership.leagues.sportId.lowercased() == sportId }.sorted(by: priorityOrder)) { item in
                                Button { auth.selectLeague(item.id); dismiss() } label: { leagueCard(item) }.buttonStyle(.plain)
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
        let urgent = !item.tasks.isEmpty
        let accent: Color = urgent ? .red : (item.totalUnread > 0 ? .orange : .green)
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
                attentionPill("\(item.tasks.count)", "TASKS", "checklist", item.tasks.isEmpty ? .green : .red)
                attentionPill("\(item.unreadLocker)", "LOCKER", "bubble.left.and.bubble.right.fill", item.unreadLocker == 0 ? .green : .orange)
                attentionPill("\(item.unreadAnnouncements)", "ORDERS", "megaphone.fill", item.unreadAnnouncements == 0 ? .green : .yellow)
            }
            if let first = item.tasks.first { Label(first.uppercased(), systemImage: "exclamationmark.triangle.fill").font(.system(size: 9, weight: .black)).tracking(0.7).foregroundStyle(.red) }
            else if item.totalUnread > 0 { Text("NEW TRAFFIC IS WAITING").font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(.orange) }
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
        let preferred = ["cfb", "nfl", "cbb"]
        return preferred.filter(ids.contains) + ids.filter { !preferred.contains($0) }.sorted()
    }

    private func loadAttention() async {
        guard let token = auth.token, let user = auth.user else { loading = false; return }
        await withTaskGroup(of: LeagueAttention.self) { group in
            for membership in memberships {
                group.addTask {
                    async let card = SupabaseAPI.weekCard(token: token, leagueId: membership.leagueId, weekNumber: membership.leagues.currentWeek)
                    async let pick = SupabaseAPI.playerPick(token: token, leagueId: membership.leagueId, userId: user.id, weekNumber: membership.leagues.currentWeek)
                    async let crystal = SupabaseAPI.crystalBallPick(token: token, leagueId: membership.leagueId, userId: user.id)
                    async let locker = SupabaseAPI.lockerMessages(token: token, leagueId: membership.leagueId)
                    async let announcements = SupabaseAPI.announcements(token: token, leagueId: membership.leagueId)
                    let loadedCard = try? await card
                    let loadedPick = try? await pick
                    let loadedCrystal = try? await crystal
                    let loadedLocker = (try? await locker) ?? []
                    let loadedAnnouncements = (try? await announcements) ?? []
                    var tasks: [String] = []
                    if loadedCard == nil && membership.isCommissioner(userId: user.id) { tasks.append("Build Week \(membership.leagues.currentWeek) card") }
                    if loadedCard != nil && loadedPick == nil { tasks.append("Make Week \(membership.leagues.currentWeek) picks") }
                    if membership.leagues.crystalBallEnabled && loadedCrystal == nil { tasks.append(membership.leagues.sportId.lowercased() == "nfl" ? "Call the Super Bowl champion" : "Lock Crystal Ball") }
                    if membership.isCommissioner(userId: user.id) && membership.leagues.championshipTrophyId == nil { tasks.append("Choose championship hardware") }
                    return LeagueAttention(membership: membership, unreadLocker: LeagueAttentionStore.unreadLockerMessages(loadedLocker, leagueId: membership.leagueId, userId: user.id), unreadAnnouncements: loadedAnnouncements.filter(\.isUnread).count, tasks: tasks)
                }
            }
            var rows: [LeagueAttention] = []
            for await row in group { rows.append(row) }
            attention = rows
        }
        loading = false
    }
}
