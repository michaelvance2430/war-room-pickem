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
        guard let refresh = KeychainStore.read(account: refreshAccount) else {
            clearSession()
            throw AuthRefreshError.missingRefreshToken
        }
        do {
            let session = try await SupabaseAPI.refreshSession(refreshToken: refresh)
            try persist(session)
            return session.accessToken
        } catch {
            clearSession()
            throw error
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
        case missingRefreshToken
        var errorDescription: String? { "Your login expired. Sign in again to reopen the Foundry." }
    }

    private enum AccountDeletionError: LocalizedError {
        case missingSession
        var errorDescription: String? { "Your login expired. Sign in again before deleting your account." }
    }
}
