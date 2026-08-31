import SwiftUI
import Combine

enum AppLinks {
    static let privacy = URL(string: "https://app.war-room-picks.com/privacy")!
    static let terms = URL(string: "https://app.war-room-picks.com/terms")!
    static let support = URL(string: "https://app.war-room-picks.com/support")!
    static let patreon = URL(string: "https://www.patreon.com/c/WarRoomPickem?utm_campaign=creatorshare_creator")!
    static let supportEmail = "support@war-room-picks.com"

    static func issueReport(sportId: String, leagueName: String) -> URL {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "Unknown"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "Unknown"
        let system = ProcessInfo.processInfo.operatingSystemVersionString
        var components = URLComponents()
        components.scheme = "mailto"
        components.path = supportEmail
        components.queryItems = [
            URLQueryItem(name: "subject", value: "War Room Field Report — \(sportId.uppercased())"),
            URLQueryItem(
                name: "body",
                value: """
                WHAT HAPPENED OR WHAT SHOULD WE BUILD?


                WHAT DID YOU EXPECT?


                HOW CAN WE RECREATE IT? (OPTIONAL)


                — APP DETAILS —
                League: \(leagueName)
                Sport: \(sportId.uppercased())
                Version: \(version) (Build \(build))
                System: \(system)
                """
            )
        ]
        return components.url ?? URL(string: "mailto:\(supportEmail)")!
    }
}

enum LockerContentSafety {
    static let blockedPhrases = [
        "go die", "kill yourself", "kys", "nigger", "faggot", "retard"
    ]

    static func violation(in body: String) -> String? {
        let normalized = body
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .lowercased()
        return blockedPhrases.first { normalized.contains($0) }
    }
}

@MainActor
final class LockerSafetyStore: ObservableObject {
    @Published private(set) var blockedUserIDs: Set<UUID>
    private let key = "warroom-blocked-locker-users"

    init() {
        blockedUserIDs = Set(
            UserDefaults.standard.stringArray(forKey: key)?.compactMap(UUID.init(uuidString:)) ?? []
        )
    }

    func block(_ userID: UUID) {
        blockedUserIDs.insert(userID)
        persist()
    }

    func unblock(_ userID: UUID) {
        blockedUserIDs.remove(userID)
        persist()
    }

    private func persist() {
        UserDefaults.standard.set(blockedUserIDs.map(\.uuidString).sorted(), forKey: key)
    }
}

struct SafetyAndSupportView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var showingDeleteConfirmation = false
    @State private var deleting = false
    @State private var deletionError: String?
    @State private var deletionPassword = ""

    var body: some View {
        List {
            Section("Policies") {
                Link("Privacy Policy", destination: AppLinks.privacy)
                Link("Terms of Use", destination: AppLinks.terms)
                Link("Support", destination: AppLinks.support)
            }

            Section("Locker Room Safety") {
                Text("Press and hold another player’s message to report it or block that player. Blocked players are hidden from your Locker Room.")
                Link("Contact \(AppLinks.supportEmail)", destination: URL(string: "mailto:\(AppLinks.supportEmail)")!)
            }

            Section("Account") {
                Text("Deleting your account removes your login and personal profile information. Completed league results remain as anonymized historical records so past standings do not change.")
                SecureField("Confirm your password", text: $deletionPassword)
                    .textContentType(.password)
                if let deletionError {
                    Text(deletionError).foregroundStyle(.red)
                }
                Button("Delete Account", role: .destructive) {
                    showingDeleteConfirmation = true
                }
                .disabled(deleting || deletionPassword.isEmpty)
            }
        }
        .navigationTitle("Privacy & Safety")
        .confirmationDialog(
            "Permanently delete your account?",
            isPresented: $showingDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete Account Permanently", role: .destructive) {
                Task { await deleteAccount() }
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("This cannot be undone. Your login and personal profile will be removed.")
        }
    }

    private func deleteAccount() async {
        deleting = true
        deletionError = nil
        do {
            try await auth.deleteAccount(password: deletionPassword)
            deletionPassword = ""
        } catch {
            deletionError = error.localizedDescription
        }
        deleting = false
    }
}
