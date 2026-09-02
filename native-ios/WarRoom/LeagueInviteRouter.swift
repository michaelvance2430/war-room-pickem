import Foundation
import LinkPresentation
import SwiftUI
import UIKit

struct PendingLeagueInvite: Codable, Equatable, Identifiable {
    let token: String
    let fallbackCode: String?
    let receivedAt: Date
    var id: String { token }
    var legacyCode: String? { token.hasPrefix("code:") ? String(token.dropFirst(5)) : nil }
}

enum LeagueInviteRouter {
    private static let storageKey = "warroom.pending-league-invite.v2"

    static func invitationURL(token: String) -> URL {
        URL(string: "https://app.war-room-picks.com/invite/\(token.lowercased())")!
    }

    static func legacyInvitationURL(code: String) -> URL {
        var components = URLComponents(string: "https://app.war-room-picks.com/join")!
        components.queryItems = [URLQueryItem(name: "code", value: normalizeCode(code))]
        return components.url!
    }

    static func parse(_ url: URL) -> PendingLeagueInvite? {
        guard url.scheme?.lowercased() == "https",
              url.host?.lowercased() == "app.war-room-picks.com" else { return nil }
        let parts = url.path.split(separator: "/").map(String.init)
        if parts.count == 2, parts[0].lowercased() == "invite" {
            let token = parts[1].lowercased()
            guard token.count == 64, token.allSatisfy(\.isHexDigit) else { return nil }
            return PendingLeagueInvite(token: token, fallbackCode: nil, receivedAt: Date())
        }
        guard parts == ["join"],
              let raw = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?
                .first(where: { $0.name.lowercased() == "code" })?.value else { return nil }
        let code = normalizeCode(raw)
        guard (4...16).contains(code.count), code.allSatisfy({ $0.isLetter || $0.isNumber }) else { return nil }
        return PendingLeagueInvite(token: "code:\(code)", fallbackCode: code, receivedAt: Date())
    }

    static func store(_ invite: PendingLeagueInvite) {
        if let data = try? JSONEncoder().encode(invite) { UserDefaults.standard.set(data, forKey: storageKey) }
    }

    static func pending() -> PendingLeagueInvite? {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let invite = try? JSONDecoder().decode(PendingLeagueInvite.self, from: data) else { return nil }
        guard Date().timeIntervalSince(invite.receivedAt) <= 7 * 24 * 60 * 60 else { clear(); return nil }
        return invite
    }

    static func clear() { UserDefaults.standard.removeObject(forKey: storageKey) }
    private static func normalizeCode(_ code: String) -> String {
        code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    }
}

struct LeagueInviteShareButton<Label: View>: View {
    @EnvironmentObject private var auth: AuthStore
    let leagueId: UUID
    let leagueName: String
    let sportId: String
    let code: String
    @ViewBuilder let label: () -> Label

    @State private var busy = false
    @State private var payload: LeagueInviteSharePayload?
    @State private var errorMessage: String?

    var body: some View {
        Button { Task { await prepareShare() } } label: {
            ZStack {
                label().opacity(busy ? 0.55 : 1)
                if busy { ProgressView().tint(.white) }
            }
        }
        .buttonStyle(.plain)
        .disabled(busy)
        .sheet(item: $payload) { payload in
            ActivityShareSheet(items: [LeagueInviteActivityItem(message: payload.message, url: payload.url, leagueName: leagueName)])
                .presentationDetents([.medium, .large])
        }
        .alert("Invitation unavailable", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: {
            Text(errorMessage ?? "Try again.")
        }
    }

    @MainActor private func prepareShare() async {
        guard let token = auth.token else { return }
        busy = true
        defer { busy = false }
        do {
            let created = try await SupabaseAPI.createLeagueInvite(token: token, leagueId: leagueId)
            let url = URL(string: created.url) ?? LeagueInviteRouter.invitationURL(token: created.token)
            payload = LeagueInviteSharePayload(
                url: url,
                message: LeagueInvitation.message(
                    leagueName: leagueName,
                    sportId: sportId,
                    code: created.code.isEmpty ? code : created.code,
                    invitationURL: url
                )
            )
        } catch {
            errorMessage = "We couldn’t create a secure invitation. Check your connection and try again."
        }
    }
}

private struct LeagueInviteSharePayload: Identifiable {
    let id = UUID()
    let url: URL
    let message: String
}

private struct ActivityShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

private final class LeagueInviteActivityItem: NSObject, UIActivityItemSource {
    let message: String
    let url: URL
    let leagueName: String

    init(message: String, url: URL, leagueName: String) {
        self.message = message
        self.url = url
        self.leagueName = leagueName
    }

    func activityViewControllerPlaceholderItem(_ activityViewController: UIActivityViewController) -> Any { message }
    func activityViewController(_ activityViewController: UIActivityViewController, itemForActivityType activityType: UIActivity.ActivityType?) -> Any? { message }
    func activityViewController(_ activityViewController: UIActivityViewController, subjectForActivityType activityType: UIActivity.ActivityType?) -> String {
        "Join \(leagueName) on War Room Pick’Em"
    }
    func activityViewControllerLinkMetadata(_ activityViewController: UIActivityViewController) -> LPLinkMetadata? {
        let metadata = LPLinkMetadata()
        metadata.title = "Join \(leagueName) on War Room Pick’Em"
        metadata.originalURL = url
        metadata.url = url
        return metadata
    }
}

struct LeagueInvitePreview: Decodable, Equatable {
    let ok: Bool
    let status: String
    let leagueId: UUID?
    let leagueName: String?
    let sportId: String?
    let commissionerName: String?
    let memberCount: Int?
    let maxMembers: Int?
    let code: String?
    let alreadyMember: Bool?

    enum CodingKeys: String, CodingKey {
        case ok, status, code
        case leagueId = "league_id"
        case leagueName = "league_name"
        case sportId = "sport_id"
        case commissionerName = "commissioner_name"
        case memberCount = "member_count"
        case maxMembers = "max_members"
        case alreadyMember = "already_member"
    }
}

struct DirectLeagueInviteView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let invite: PendingLeagueInvite
    @State private var loading = true
    @State private var joining = false
    @State private var preview: LeagueInvitePreview?
    @State private var errorMessage: String?

    private var accent: Color { preview?.sportId?.lowercased() == "nfl" ? .cyan : .green }
    private var visibleCode: String? { preview?.code ?? invite.fallbackCode ?? invite.legacyCode }

    var body: some View {
        NavigationStack {
            ZStack {
                Image("MusterBackdrop").resizable().scaledToFill().ignoresSafeArea().opacity(0.48)
                LinearGradient(colors: [.black.opacity(0.28), .black], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                VStack(spacing: 18) {
                    if loading { ProgressView("Opening your invitation…").tint(.yellow) }
                    else if let preview, preview.ok { invitation(preview) }
                    else {
                        Image(systemName: "envelope.badge.fill").font(.system(size: 48, weight: .black)).foregroundStyle(.red)
                        Text(errorMessage ?? safeFailureCopy).font(.headline.weight(.bold)).multilineTextAlignment(.center)
                        Button("TRY AGAIN") { Task { await loadPreview() } }.buttonStyle(.borderedProminent).tint(.yellow)
                    }
                }.padding(24)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { cancel() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("Close invitation").disabled(joining)
                }
            }
        }
        .interactiveDismissDisabled(joining)
        .preferredColorScheme(.dark)
        .task { await loadPreview() }
    }

    @ViewBuilder private func invitation(_ preview: LeagueInvitePreview) -> some View {
        Image(systemName: "envelope.open.fill").font(.system(size: 54, weight: .black)).foregroundStyle(.yellow)
        Text("LEAGUE INVITATION").font(.caption.weight(.black)).tracking(2).foregroundStyle(accent)
        Text(preview.leagueName ?? "WAR ROOM")
            .font(.system(size: 31, weight: .black)).fontWidth(.condensed).multilineTextAlignment(.center)
        Text("\((preview.sportId ?? "football").uppercased()) · COMMISSIONER \(preview.commissionerName ?? "Commissioner")")
            .font(.caption.weight(.black)).tracking(1).foregroundStyle(.white.opacity(0.62)).multilineTextAlignment(.center)
        if let count = preview.memberCount, let maximum = preview.maxMembers {
            Text("\(count) / \(maximum) IN THE ROOM")
                .font(.headline.weight(.black)).foregroundStyle(preview.status == "full" ? .red : accent)
        }
        if let visibleCode {
            VStack(spacing: 5) {
                Text("FALLBACK CODE").font(.system(size: 8, weight: .black)).tracking(1.8).foregroundStyle(.secondary)
                Text(visibleCode).font(.title.weight(.black).monospaced()).tracking(3).foregroundStyle(.yellow)
            }.padding(16).frame(maxWidth: .infinity).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 16))
        }
        if let errorMessage {
            Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                .font(.footnote.weight(.bold)).foregroundStyle(.red).multilineTextAlignment(.center)
        }
        Button { Task { await join() } } label: {
            HStack {
                Spacer()
                if joining { ProgressView().tint(.black) }
                else { Label(actionTitle(preview), systemImage: "door.left.hand.open").fontWeight(.black) }
                Spacer()
            }.padding(16).foregroundStyle(.black)
                .background(preview.status == "full" ? Color.gray : Color.yellow, in: RoundedRectangle(cornerRadius: 15))
        }.buttonStyle(.plain).disabled(joining || preview.status == "full")
        Text(preview.status == "full" ? "This room is full. Ask the commissioner to open a seat." : "Nothing changes until you confirm.")
            .font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.62)).multilineTextAlignment(.center)
    }

    private var safeFailureCopy: String {
        switch preview?.status {
        case "expired": return "This invitation has expired. Ask for a new link."
        case "unavailable": return "This room is no longer available."
        default: return "This invitation is not valid. Ask for a new link."
        }
    }

    private func actionTitle(_ preview: LeagueInvitePreview) -> String {
        preview.alreadyMember == true ? "OPEN LEAGUE" : "JOIN LEAGUE"
    }

    @MainActor private func loadPreview() async {
        loading = true
        errorMessage = nil
        defer { loading = false }
        do {
            if let code = invite.legacyCode {
                preview = LeagueInvitePreview(ok: true, status: "available", leagueId: nil, leagueName: "WAR ROOM INVITATION", sportId: nil, commissionerName: nil, memberCount: nil, maxMembers: nil, code: code, alreadyMember: nil)
            } else {
                preview = try await SupabaseAPI.previewLeagueInvite(token: auth.token, inviteToken: invite.token)
            }
        } catch {
            errorMessage = "We couldn’t verify this invitation. Check your connection and try again."
        }
    }

    @MainActor private func join() async {
        guard let authToken = auth.token else { return }
        joining = true
        errorMessage = nil
        do {
            let leagueId: UUID
            if let code = invite.legacyCode {
                leagueId = try await SupabaseAPI.joinLeagueByCode(token: authToken, code: code)
            } else {
                leagueId = try await SupabaseAPI.joinLeagueByInvite(token: authToken, inviteToken: invite.token)
            }
            auth.selectLeague(leagueId)
            LeagueInviteRouter.clear()
            dismiss()
        } catch {
            let raw = error.localizedDescription.lowercased()
            errorMessage = raw.contains("full") ? "This room is full. Ask the commissioner to open a seat."
                : raw.contains("expired") ? "This invitation has expired. Ask for a new link."
                : raw.contains("invalid") ? "This invitation is not valid. Ask for a new link."
                : "We couldn’t verify this invitation. Try again."
        }
        joining = false
    }

    private func cancel() { LeagueInviteRouter.clear(); dismiss() }
}

struct CreatedLeagueInvite: Decodable {
    let ok: Bool
    let token: String
    let code: String
    let url: String
}

private struct JoinedLeagueInvite: Decodable {
    let ok: Bool
    let leagueId: UUID
    enum CodingKeys: String, CodingKey { case ok; case leagueId = "league_id" }
}

extension SupabaseAPI {
    static func createLeagueInvite(token: String, leagueId: UUID) async throws -> CreatedLeagueInvite {
        try await build20RPC("create_league_invite", token: token, body: ["p_league_id": leagueId.uuidString.lowercased()])
    }

    static func previewLeagueInvite(token: String?, inviteToken: String) async throws -> LeagueInvitePreview {
        try await build20RPC("preview_league_invite", token: token, body: ["p_token": inviteToken])
    }

    static func joinLeagueByInvite(token: String, inviteToken: String) async throws -> UUID {
        let payload: JoinedLeagueInvite = try await build20RPC("join_league_by_invite", token: token, body: ["p_token": inviteToken])
        guard payload.ok else { throw LeagueInviteRequestError(message: "invalid_invitation") }
        return payload.leagueId
    }

    private static func build20RPC<T: Decodable>(_ name: String, token: String?, body: [String: Any]) async throws -> T {
        let url = SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/\(name)")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            throw LeagueInviteRequestError(message: raw?["message"] as? String ?? "Invitation request failed.")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

private struct LeagueInviteRequestError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}
