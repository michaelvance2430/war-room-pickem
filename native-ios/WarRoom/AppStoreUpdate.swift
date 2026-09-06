import Foundation
import SwiftUI

struct AppStoreRelease: Equatable, Sendable {
    let version: String
    let productURL: URL
}

enum AppStoreUpdatePolicy {
    nonisolated static func isNewer(storeVersion: String, than installedVersion: String) -> Bool {
        let store = numericComponents(storeVersion)
        let installed = numericComponents(installedVersion)
        guard !store.isEmpty, !installed.isEmpty else { return false }

        let count = max(store.count, installed.count)
        for index in 0..<count {
            let storePart = index < store.count ? store[index] : 0
            let installedPart = index < installed.count ? installed[index] : 0
            if storePart != installedPart { return storePart > installedPart }
        }
        return false
    }

    nonisolated private static func numericComponents(_ version: String) -> [Int] {
        let components = version.split(separator: ".", omittingEmptySubsequences: false)
        guard !components.isEmpty,
              components.allSatisfy({ !$0.isEmpty && $0.allSatisfy(\.isNumber) })
        else { return [] }
        return components.compactMap { Int($0) }
    }
}

actor AppStoreUpdateChecker {
    static let shared = AppStoreUpdateChecker()

    private struct LookupResponse: Decodable {
        let results: [LookupResult]
    }

    private struct LookupResult: Decodable {
        let version: String
        let trackViewUrl: URL?
    }

    private let appID = "6802751064"
    private let fallbackProductURL = URL(string: "https://apps.apple.com/app/id6802751064")!
    private var lastCheckAt: Date?
    private var cachedRelease: AppStoreRelease?

    func availableRelease(
        installedVersion: String = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0",
        now: Date = Date()
    ) async -> AppStoreRelease? {
        if let lastCheckAt, now.timeIntervalSince(lastCheckAt) < 21_600 {
            return cachedRelease
        }
        lastCheckAt = now

        guard var components = URLComponents(string: "https://itunes.apple.com/lookup") else {
            cachedRelease = nil
            return nil
        }
        components.queryItems = [
            URLQueryItem(name: "id", value: appID),
            URLQueryItem(name: "country", value: "us")
        ]
        guard let url = components.url else {
            cachedRelease = nil
            return nil
        }

        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 8
            request.cachePolicy = .reloadRevalidatingCacheData
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode),
                  let result = try JSONDecoder().decode(LookupResponse.self, from: data).results.first,
                  AppStoreUpdatePolicy.isNewer(storeVersion: result.version, than: installedVersion)
            else {
                cachedRelease = nil
                return nil
            }
            let release = AppStoreRelease(
                version: result.version,
                productURL: result.trackViewUrl ?? fallbackProductURL
            )
            cachedRelease = release
            return release
        } catch {
            // Update discovery is advisory. A store or network failure must
            // never block the app, manufacture an update, or replace live data.
            return cachedRelease
        }
    }
}

struct AppStoreUpdateBanner: View {
    let release: AppStoreRelease
    let dismiss: () -> Void
    @Environment(\.openURL) private var openURL

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "arrow.down.app.fill")
                .font(.title2.weight(.black))
                .foregroundStyle(.black)
            VStack(alignment: .leading, spacing: 2) {
                Text("WAR ROOM UPDATE AVAILABLE")
                    .font(.system(size: 10, weight: .black))
                    .tracking(1.15)
                Text("Version \(release.version) is live on the App Store.")
                    .font(.caption.weight(.bold))
            }
            .foregroundStyle(.black)
            Spacer(minLength: 4)
            Button("UPDATE") { openURL(release.productURL) }
                .font(.caption.weight(.black))
                .buttonStyle(.borderedProminent)
                .tint(.black)
                .foregroundStyle(.white)
                .accessibilityHint("Opens the War Room Pick'Em App Store page")
            Button(action: dismiss) {
                Image(systemName: "xmark")
                    .font(.caption.weight(.black))
                    .foregroundStyle(.black.opacity(0.72))
                    .padding(6)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss update notice")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.yellow)
        .overlay(alignment: .bottom) { Color.black.opacity(0.32).frame(height: 1) }
        .accessibilityElement(children: .contain)
    }
}
