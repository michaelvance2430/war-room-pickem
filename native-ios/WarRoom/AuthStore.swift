import Foundation
import Combine

@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var user: AuthUser?
    @Published private(set) var token: String?
    @Published private(set) var isRestoring = true
    @Published var errorMessage: String?
    @Published var noticeMessage: String?
    @Published private(set) var selectedLeagueId: UUID? = UserDefaults.standard.string(forKey: "warroom-selected-league").flatMap(UUID.init(uuidString:))

    private let tokenAccount = "supabase-access-token"
    private let refreshAccount = "supabase-refresh-token"
    private var refreshTask: Task<String, Error>?

    func restore() async {
        defer { isRestoring = false }
        guard let saved = KeychainStore.read(account: tokenAccount) else { return }
        do {
            user = try await SupabaseAPI.currentUser(token: saved)
            token = saved
        } catch {
            guard let refresh = KeychainStore.read(account: refreshAccount) else {
                clearSession()
                return
            }
            do {
                let session = try await SupabaseAPI.refreshSession(refreshToken: refresh)
                try persist(session)
            } catch {
                clearSession()
            }
        }
    }

    func signIn(email: String, password: String) async {
        errorMessage = nil
        noticeMessage = nil
        do {
            let session = try await SupabaseAPI.signIn(email: email, password: password)
            try persist(session)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createAccount(email: String, password: String, displayName: String) async {
        errorMessage = nil
        noticeMessage = nil
        do {
            let response = try await SupabaseAPI.signUp(email: email, password: password, displayName: displayName)
            if let access = response.accessToken, let refresh = response.refreshToken {
                try persist(AuthSession(accessToken: access, refreshToken: refresh, expiresIn: response.expiresIn ?? 3600, user: response.user))
            } else {
                noticeMessage = "Account created. Check your email, confirm it, then sign in."
            }
        } catch { errorMessage = error.localizedDescription }
    }

    func sendPasswordReset(email: String) async {
        errorMessage = nil
        noticeMessage = nil
        do {
            try await SupabaseAPI.sendPasswordReset(email: email)
            noticeMessage = "Password reset sent. Check your email for the secure link."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() {
        clearSession()
    }

    func deleteAccount(password: String) async throws {
        guard let token else { throw AccountDeletionError.missingSession }
        try await SupabaseAPI.deleteAccount(token: token, password: password)
        clearSession()
    }

    func refreshAccessToken() async throws -> String {
        if let refreshTask { return try await refreshTask.value }
        guard let refresh = KeychainStore.read(account: refreshAccount) else {
            clearSession()
            throw AuthRefreshError.missingRefreshToken
        }
        let task = Task { @MainActor in
            let session = try await SupabaseAPI.refreshSession(refreshToken: refresh)
            try persist(session)
            return session.accessToken
        }
        refreshTask = task
        defer { refreshTask = nil }
        do { return try await task.value }
        catch {
            if refreshCredentialIsInvalid(error) { clearSession() }
            throw error
        }
    }

    /// Returns a token with enough life for a complete request. Supabase access
    /// tokens are JWTs, so the expiry can be checked locally without a network call.
    func validAccessToken(minimumValidity: TimeInterval = 300) async throws -> String {
        guard let token else { throw AuthRefreshError.missingAccessToken }
        guard let expiration = jwtExpiration(token) else { return token }
        if expiration.timeIntervalSinceNow > minimumValidity { return token }
        return try await refreshAccessToken()
    }

    /// RootView owns this task for the signed-in session. It renews credentials
    /// before they expire even when the player leaves the app open all afternoon.
    func maintainSession() async {
        while !Task.isCancelled, user != nil {
            do {
                _ = try await validAccessToken()
                errorMessage = nil
            } catch {
                if user != nil { errorMessage = "Your session could not be renewed. We’ll try again automatically." }
            }
            try? await Task.sleep(for: .seconds(60))
        }
    }

    func selectLeague(_ id: UUID) {
        selectedLeagueId = id
        UserDefaults.standard.set(id.uuidString, forKey: "warroom-selected-league")
    }

    private func persist(_ session: AuthSession) throws {
        try KeychainStore.save(session.accessToken, account: tokenAccount)
        try KeychainStore.save(session.refreshToken, account: refreshAccount)
        token = session.accessToken
        user = session.user
    }

    private func clearSession() {
        KeychainStore.delete(account: tokenAccount)
        KeychainStore.delete(account: refreshAccount)
        token = nil
        user = nil
    }

    private enum AuthRefreshError: LocalizedError {
        case missingAccessToken
        case missingRefreshToken
        var errorDescription: String? { "Your login expired. Sign in again to reopen the War Room." }
    }

    private func refreshCredentialIsInvalid(_ error: Error) -> Bool {
        let message = error.localizedDescription.lowercased()
        return message.contains("invalid refresh")
            || message.contains("refresh token not found")
            || message.contains("refresh token has expired")
    }

    private func jwtExpiration(_ token: String) -> Date? {
        let pieces = token.split(separator: ".")
        guard pieces.count > 1 else { return nil }
        var payload = String(pieces[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        let remainder = payload.count % 4
        if remainder > 0 { payload += String(repeating: "=", count: 4 - remainder) }
        guard let data = Data(base64Encoded: payload),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let expiration = object["exp"] as? TimeInterval
        else { return nil }
        return Date(timeIntervalSince1970: expiration)
    }

    private enum AccountDeletionError: LocalizedError {
        case missingSession
        var errorDescription: String? { "Your login expired. Sign in again before deleting your account." }
    }
}
