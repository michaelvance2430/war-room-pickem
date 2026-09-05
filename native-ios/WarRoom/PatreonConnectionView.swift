import AuthenticationServices
import Combine
import SwiftUI
import UIKit

enum PatreonConnectionFeature {
    // Flip only after the private schema, Edge Function, secrets, and full OAuth
    // round trip have been verified. The preview flag keeps local UI review open.
    static let isEnabled = false
    static var shouldShow: Bool {
        isEnabled || ProcessInfo.processInfo.arguments.contains("--patreon-preview")
    }
}

struct PatreonConnectionView: View {
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var oauthSession = PatreonOAuthSession()
    @State private var status: PatreonConnectionStatus?
    @State private var loading = true
    @State private var working = false
    @State private var message: String?
    @State private var showingDisconnectConfirmation = false

    private var accent: Color { .green }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [.black, Color(red: 0.01, green: 0.10, blue: 0.05), .black],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            ScrollView {
                VStack(spacing: 18) {
                    Image(systemName: "heart.circle.fill")
                        .font(.system(size: 62, weight: .black))
                        .foregroundStyle(accent)
                        .shadow(color: accent.opacity(0.45), radius: 18)
                    Text("PATREON CONNECTION")
                        .font(.caption.weight(.black)).tracking(2.2).foregroundStyle(accent)
                    Text(status?.connected == true ? "Accounts Linked" : "Link Your Patreon Account")
                        .font(.system(size: 34, weight: .black)).fontWidth(.condensed)
                        .multilineTextAlignment(.center)
                    Text("Link Patreon to your War Room identity. Supporter recognition is account-wide and never changes picks, scoring, standings, or competitive access.")
                        .font(.body.weight(.semibold)).foregroundStyle(.white.opacity(0.68))
                        .multilineTextAlignment(.center)

                    connectionCard

                    if let message {
                        Label(message, systemImage: "info.circle.fill")
                            .font(.footnote.weight(.bold)).foregroundStyle(.yellow)
                            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                            .background(.yellow.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
                    }

                    if status?.connected == true {
                        Button(role: .destructive) { showingDisconnectConfirmation = true } label: {
                            Label("DISCONNECT PATREON", systemImage: "link.badge.minus")
                                .font(.caption.weight(.black)).tracking(1)
                                .frame(maxWidth: .infinity).padding(.vertical, 14)
                        }
                        .buttonStyle(.bordered).tint(.red)
                        .disabled(working)
                    } else {
                        Button { Task { await connect() } } label: {
                            HStack {
                                if working { ProgressView().tint(.black) }
                                else { Image(systemName: "link") }
                                Text("CONNECT PATREON").font(.headline.weight(.black))
                            }
                            .foregroundStyle(.black).frame(maxWidth: .infinity).padding(.vertical, 15)
                            .background(accent, in: RoundedRectangle(cornerRadius: 14))
                        }
                        .buttonStyle(.plain)
                        .disabled(working || auth.user == nil)
                    }

                }
                .padding(20).padding(.bottom, 28)
            }
        }
        .navigationTitle("Patreon")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .task { await load() }
        .refreshable { await load() }
        .confirmationDialog("Disconnect Patreon?", isPresented: $showingDisconnectConfirmation, titleVisibility: .visible) {
            Button("Disconnect", role: .destructive) { Task { await disconnect() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes the Patreon link from War Room. It does not cancel your Patreon membership.")
        }
    }

    @ViewBuilder private var connectionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            if loading {
                ProgressView("Checking Patreon connection…").tint(accent)
            } else if let status, status.connected {
                HStack(spacing: 13) {
                    AsyncImage(url: status.avatarURL.flatMap(URL.init(string:))) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Image(systemName: "person.crop.circle.fill").resizable().foregroundStyle(.white.opacity(0.25))
                    }
                    .frame(width: 58, height: 58).clipShape(Circle())
                    .overlay(Circle().stroke(accent.opacity(0.7), lineWidth: 2))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(status.displayName ?? "Patreon member").font(.headline.weight(.black))
                        Text(status.badge).font(.caption.weight(.black)).tracking(1).foregroundStyle(badgeColor(status))
                    }
                    Spacer()
                    Image(systemName: status.needsReauthorization == true ? "exclamationmark.triangle.fill" : "checkmark.seal.fill")
                        .font(.title2.weight(.black)).foregroundStyle(badgeColor(status))
                }
                if status.needsReauthorization == true {
                    Text("Patreon could not renew this connection. Disconnect it, then connect again.")
                        .font(.caption.weight(.semibold)).foregroundStyle(.yellow)
                } else {
                    Text("Verified by Patreon. War Room checks the membership on the server; Patreon credentials are never stored in the app.")
                        .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
                }
            } else {
                Label("No Patreon account linked", systemImage: "link.badge.plus")
                    .font(.headline.weight(.black)).foregroundStyle(.white)
                Text(auth.user == nil
                     ? "Sign in to a live War Room account before linking Patreon."
                     : "You will sign in directly with Patreon and approve the connection. War Room never receives your Patreon password.")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
            }
        }
        .padding(17).frame(maxWidth: .infinity, alignment: .leading)
        .background(.black.opacity(0.86), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(accent.opacity(0.38)))
    }

    private func badgeColor(_ status: PatreonConnectionStatus) -> Color {
        switch status.membershipStatus {
        case "active_patron": return .green
        case "declined_patron": return .red
        case "former_patron": return .orange
        default: return status.needsReauthorization == true ? .yellow : .cyan
        }
    }

    @MainActor private func load() async {
        guard auth.user != nil else { loading = false; return }
        do {
            let token = try await auth.validAccessToken()
            status = try await SupabaseAPI.patreonConnection(token: token)
            message = nil
        } catch {
            message = error.localizedDescription
        }
        loading = false
    }

    @MainActor private func connect() async {
        working = true
        message = nil
        defer { working = false }
        do {
            let token = try await auth.validAccessToken()
            let authorizationURL = try await SupabaseAPI.startPatreonConnection(token: token)
            let callback = try await oauthSession.authenticate(at: authorizationURL)
            let components = URLComponents(url: callback, resolvingAgainstBaseURL: false)
            switch components?.queryItems?.first(where: { $0.name == "status" })?.value {
            case "connected":
                await load()
                message = "Patreon connected to your War Room account."
            case "cancelled":
                message = "Patreon connection was cancelled."
            default:
                message = components?.queryItems?.first(where: { $0.name == "message" })?.value ?? "Patreon could not be connected."
            }
        } catch let error as ASWebAuthenticationSessionError where error.code == .canceledLogin {
            message = nil
        } catch {
            message = error.localizedDescription
        }
    }

    @MainActor private func disconnect() async {
        working = true
        defer { working = false }
        do {
            let token = try await auth.validAccessToken()
            try await SupabaseAPI.disconnectPatreon(token: token)
            status = PatreonConnectionStatus(connected: false, patreonUserId: nil, displayName: nil, avatarURL: nil, membershipStatus: nil, currentlyEntitledAmountCents: nil, connectedAt: nil, verifiedAt: nil, needsReauthorization: nil)
            message = "Patreon disconnected. Your Patreon membership was not changed."
        } catch {
            message = error.localizedDescription
        }
    }
}

@MainActor
private final class PatreonOAuthSession: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    func authenticate(at url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "warroom") { [weak self] callback, error in
                self?.session = nil
                if let error { continuation.resume(throwing: error) }
                else if let callback { continuation.resume(returning: callback) }
                else { continuation.resume(throwing: URLError(.badServerResponse)) }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                continuation.resume(throwing: URLError(.cannotLoadFromNetwork))
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
