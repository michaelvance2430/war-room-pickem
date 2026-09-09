import Foundation
import SwiftUI

struct AppStoreRelease: Equatable, Identifiable, Sendable {
    let version: String
    let build: Int?
    let message: String
    let productURL: URL
    let isRequired: Bool
    var id: String { "\(version)-\(build.map(String.init) ?? "store")" }
    var displayVersion: String { build.map { "Version \(version) (\($0))" } ?? "Version \(version)" }
}

enum AppStoreUpdatePolicy {
    nonisolated static func isNewer(build available: Int, than installed: Int) -> Bool { available > installed }

    nonisolated static func isNewer(storeVersion: String, than installedVersion: String) -> Bool {
        let store = numericComponents(storeVersion), installed = numericComponents(installedVersion)
        guard !store.isEmpty, !installed.isEmpty else { return false }
        for index in 0..<max(store.count, installed.count) {
            let lhs = index < store.count ? store[index] : 0
            let rhs = index < installed.count ? installed[index] : 0
            if lhs != rhs { return lhs > rhs }
        }
        return false
    }

    nonisolated private static func numericComponents(_ version: String) -> [Int] {
        let parts = version.split(separator: ".", omittingEmptySubsequences: false)
        guard !parts.isEmpty, parts.allSatisfy({ !$0.isEmpty && $0.allSatisfy(\.isNumber) }) else { return [] }
        return parts.compactMap { Int($0) }
    }
}

actor AppStoreUpdateChecker {
    static let shared = AppStoreUpdateChecker()

    private struct ReleaseChannel: Decodable {
        let recommendedBuild: Int
        let minimumBuild: Int
        let releaseVersion: String
        let message: String?
        let productUrl: URL?
        enum CodingKeys: String, CodingKey {
            case recommendedBuild = "recommended_build", minimumBuild = "minimum_build"
            case releaseVersion = "release_version", message, productUrl = "product_url"
        }
    }
    private struct LookupResponse: Decodable { let results: [LookupResult] }
    private struct LookupResult: Decodable { let version: String; let trackViewUrl: URL? }

    private let appID = "6802751064"
    private let fallbackURL = URL(string: "https://apps.apple.com/app/id6802751064")!
    private var lastCheckAt: Date?
    private var cachedRelease: AppStoreRelease?

    func availableRelease(
        installedVersion: String = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0",
        installedBuild: Int = Int(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0") ?? 0,
        now: Date = Date()
    ) async -> AppStoreRelease? {
        if ProcessInfo.processInfo.arguments.contains("--update-preview") {
            return AppStoreRelease(version: installedVersion, build: installedBuild + 1,
                message: "A new War Room Pick'Em update is ready. Update now to get the latest fixes and features.",
                productURL: fallbackURL,
                isRequired: ProcessInfo.processInfo.arguments.contains("--required-update-preview"))
        }
        if let lastCheckAt, now.timeIntervalSince(lastCheckAt) < 900 { return cachedRelease }
        lastCheckAt = now
        if let release = await backendRelease(installedBuild: installedBuild) {
            cachedRelease = release
            return release
        }
        if let release = await publicStoreRelease(installedVersion: installedVersion) {
            cachedRelease = release
            return release
        }
        cachedRelease = nil
        return nil
    }

    private func backendRelease(installedBuild: Int) async -> AppStoreRelease? {
        var parts = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/app_release_channels"), resolvingAgainstBaseURL: false)!
        parts.queryItems = [
            .init(name: "platform", value: "eq.ios"), .init(name: "enabled", value: "eq.true"),
            .init(name: "select", value: "recommended_build,minimum_build,release_version,message,product_url"), .init(name: "limit", value: "1")
        ]
        guard let url = parts.url else { return nil }
        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 8
            request.cachePolicy = .reloadIgnoringLocalCacheData
            request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(SupabaseConfiguration.publishableKey)", forHTTPHeaderField: "Authorization")
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                  let channel = try JSONDecoder().decode([ReleaseChannel].self, from: data).first,
                  AppStoreUpdatePolicy.isNewer(build: channel.recommendedBuild, than: installedBuild) else { return nil }
            return AppStoreRelease(version: channel.releaseVersion, build: channel.recommendedBuild,
                message: channel.message ?? "A new War Room Pick'Em update is ready.",
                productURL: channel.productUrl ?? fallbackURL,
                isRequired: installedBuild < channel.minimumBuild)
        } catch { return nil }
    }

    private func publicStoreRelease(installedVersion: String) async -> AppStoreRelease? {
        guard var parts = URLComponents(string: "https://itunes.apple.com/lookup") else { return nil }
        parts.queryItems = [.init(name: "id", value: appID), .init(name: "country", value: "us")]
        guard let url = parts.url else { return nil }
        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 8
            request.cachePolicy = .reloadRevalidatingCacheData
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                  let result = try JSONDecoder().decode(LookupResponse.self, from: data).results.first,
                  AppStoreUpdatePolicy.isNewer(storeVersion: result.version, than: installedVersion) else { return nil }
            return AppStoreRelease(version: result.version, build: nil,
                message: "A new War Room Pick'Em update is ready on the App Store.",
                productURL: result.trackViewUrl ?? fallbackURL, isRequired: false)
        } catch { return nil }
    }
}

struct AppStoreUpdatePrompt: View {
    let release: AppStoreRelease
    let dismiss: () -> Void
    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack {
            Color.black.opacity(0.72).ignoresSafeArea()
            VStack(spacing: 18) {
                Image(systemName: "arrow.down.app.fill")
                    .font(.system(size: 38, weight: .black)).foregroundStyle(Color.green)
                VStack(spacing: 7) {
                    Text("UPDATE WAR ROOM PICK'EM").font(.system(size: 19, weight: .black)).multilineTextAlignment(.center)
                    Text(release.displayVersion).font(.caption.weight(.bold)).foregroundStyle(.secondary)
                    Text(release.message).font(.subheadline.weight(.semibold)).multilineTextAlignment(.center).foregroundStyle(.white.opacity(0.82))
                }
                Button { openURL(release.productURL) } label: {
                    Text("UPDATE NOW").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(.vertical, 13)
                }
                .buttonStyle(.borderedProminent).tint(.green).foregroundStyle(.black)
                .accessibilityHint("Opens the War Room Pick'Em App Store page")
                if release.isRequired {
                    Text("THIS UPDATE IS REQUIRED TO CONTINUE").font(.caption2.weight(.black)).tracking(0.7).foregroundStyle(.orange)
                } else {
                    Button("NOT NOW", action: dismiss).font(.caption.weight(.black)).foregroundStyle(.white.opacity(0.72))
                }
            }
            .padding(24).frame(maxWidth: 350)
            .background(Color(uiColor: .secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Color.white.opacity(0.13)) }
            .shadow(color: .black.opacity(0.65), radius: 28, y: 14).padding(.horizontal, 24)
        }
        .zIndex(1000).accessibilityElement(children: .contain)
    }
}
