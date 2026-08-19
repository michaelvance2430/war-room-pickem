import Foundation
import Security

enum KeychainStore {
    private static let service = "com.warroompicks.WarRoom"

#if targetEnvironment(simulator)
    private static func simulatorKey(for account: String) -> String {
        "\(service).simulator.\(account)"
    }
#endif

    static func save(_ value: String, account: String) throws {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)
#if targetEnvironment(simulator)
        if status == errSecMissingEntitlement {
            UserDefaults.standard.set(value, forKey: simulatorKey(for: account))
            return
        }
#endif
        guard status == errSecSuccess else { throw KeychainError(status: status) }
    }

    static func read(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
#if targetEnvironment(simulator)
        if status == errSecMissingEntitlement {
            return UserDefaults.standard.string(forKey: simulatorKey(for: account))
        }
#endif
        guard status == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(account: String) {
        SecItemDelete([
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ] as CFDictionary)
#if targetEnvironment(simulator)
        UserDefaults.standard.removeObject(forKey: simulatorKey(for: account))
#endif
    }

    private struct KeychainError: LocalizedError {
        let status: OSStatus
        var errorDescription: String? { "Secure storage failed (\(status))." }
    }
}
