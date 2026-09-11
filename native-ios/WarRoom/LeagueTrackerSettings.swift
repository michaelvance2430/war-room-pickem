import SwiftUI
import Combine

struct LeagueTrackerSetting: Decodable, Equatable, Sendable, Identifiable {
    let leagueId: UUID
    var hidden: Bool
    let seasonEnded: Bool
    var id: UUID { leagueId }
    var isVisible: Bool { !hidden && !seasonEnded }
    enum CodingKeys: String, CodingKey {
        case leagueId = "league_id", hidden, seasonEnded = "season_ended"
    }
}

enum LeagueTrackerGrouping {
    static func sport(_ id: String) -> String {
        let value = id.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return value.isEmpty ? "OTHER" : value
    }
    static func orderedSports(_ ids: [String]) -> [String] {
        let order = ["CFB", "NFL", "NCAAM", "NCAAW", "CBB"]
        return Set(ids.map(sport)).sorted {
            let left = order.firstIndex(of: $0) ?? order.count
            let right = order.firstIndex(of: $1) ?? order.count
            return left == right ? $0 < $1 : left < right
        }
    }
    static func sorted(_ memberships: [LeagueMembership]) -> [LeagueMembership] {
        memberships.sorted {
            let order = $0.leagues.name.localizedCaseInsensitiveCompare($1.leagues.name)
            return order == .orderedSame ? $0.leagueId.uuidString < $1.leagueId.uuidString : order == .orderedAscending
        }
    }
}

@MainActor final class LeagueTrackerStore: ObservableObject {
    static let shared = LeagueTrackerStore()
    @Published private(set) var settings: [UUID: LeagueTrackerSetting] = [:]
    @Published private(set) var saving: Set<UUID> = []
    @Published private(set) var error: String?
    private var userID: UUID?

    func load(token: String, userID: UUID) async throws {
        if self.userID != userID {
            self.userID = userID
            settings = [:]
            saving = []
            error = nil
        }
        let hiddenBeforeLoad = settings.mapValues(\.hidden)
        do {
            let loaded = try await SupabaseAPI.leagueTrackerSettings(token: token)
            guard self.userID == userID else { return }
            // A refresh started before a save must not undo that save on screen.
            var updated = Dictionary(loaded.map { ($0.leagueId, $0) }, uniquingKeysWith: { first, _ in first })
            for (id, current) in settings where saving.contains(id) || current.hidden != hiddenBeforeLoad[id] {
                updated[id]?.hidden = current.hidden
            }
            settings = updated
            error = nil
        } catch {
            if self.userID == userID { self.error = "Couldn’t refresh league visibility. Try again." }
            throw error
        }
    }

    func setHidden(_ hidden: Bool, leagueID: UUID, token: String, userID: UUID) async {
        guard self.userID == userID, !saving.contains(leagueID),
              let setting = settings[leagueID], !setting.seasonEnded else { return }
        saving.insert(leagueID)
        defer { if self.userID == userID { saving.remove(leagueID) } }
        do {
            try await SupabaseAPI.setLeagueTrackerHidden(token: token, userID: userID, leagueID: leagueID, hidden: hidden)
            guard self.userID == userID else { return }
            settings[leagueID]?.hidden = hidden
            error = nil
        } catch {
            if self.userID == userID { self.error = "Couldn’t save that change. Your league visibility hasn’t changed." }
        }
    }
}

struct LeagueTrackerSettingsView: View {
    @EnvironmentObject private var auth: AuthStore
    @ObservedObject private var tracker = LeagueTrackerStore.shared
    @State private var memberships: [LeagueMembership] = []
    @State private var loading = true
    @State private var loadError: String?
    private var sports: [String] { LeagueTrackerGrouping.orderedSports(memberships.map { $0.leagues.sportId }) }

    var body: some View {
        List {
            Section {
                Text("Choose which leagues appear in My Leagues on Home. Changes save automatically across your devices.")
                    .font(.subheadline)
                Text("Completed seasons are removed automatically. A league returns when a new card is published, unless you’ve hidden it.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            if loading { ProgressView("Loading your leagues…") }
            if let message = loadError ?? tracker.error {
                Section {
                    Text(message).foregroundStyle(.orange)
                    Button("Try again") { Task { await load() } }
                }
            }
            ForEach(sports, id: \.self) { sport in
                Section(sport) {
                    ForEach(LeagueTrackerGrouping.sorted(memberships.filter { LeagueTrackerGrouping.sport($0.leagues.sportId) == sport })) { membership in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(membership.leagues.name).font(.headline)
                            if tracker.settings[membership.leagueId]?.seasonEnded == true {
                                Label("Season complete · removed automatically", systemImage: "checkmark.seal")
                                    .font(.caption).foregroundStyle(.secondary)
                            } else {
                                Toggle("Show in tracker", isOn: Binding(
                                    get: { tracker.settings[membership.leagueId]?.isVisible == true },
                                    set: { visible in
                                        guard let token = auth.token, let userID = auth.user?.id else { return }
                                        Task { await tracker.setHidden(!visible, leagueID: membership.leagueId, token: token, userID: userID) }
                                    }
                                ))
                                .disabled(tracker.settings[membership.leagueId] == nil || tracker.saving.contains(membership.leagueId))
                                .accessibilityLabel("Show \(membership.leagues.name) in tracker")
                                .accessibilityIdentifier("tracker-visibility-\(membership.leagueId)")
                            }
                        }.padding(.vertical, 5)
                    }
                }
            }
            if !loading && memberships.isEmpty && loadError == nil {
                Text("Join a league to see it here.").foregroundStyle(.secondary)
            }
        }
        .navigationTitle("League Tracker")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .task { await load() }
        .refreshable { await load() }
    }

    @MainActor private func load() async {
        guard let token = auth.token, let userID = auth.user?.id else { loading = false; return }
        loading = true
        defer { loading = false }
        do {
            async let loaded = SupabaseAPI.leagueMemberships(token: token, userId: userID)
            try await tracker.load(token: token, userID: userID)
            memberships = try await loaded
            loadError = nil
        } catch { loadError = "Couldn’t load your leagues. Try again." }
    }
}
