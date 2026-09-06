import Testing
@testable import WarRoom

struct AppStoreUpdateTests {
    @Test func newerSemanticVersionTriggersUpdate() {
        #expect(AppStoreUpdatePolicy.isNewer(storeVersion: "3.4", than: "3.3"))
        #expect(AppStoreUpdatePolicy.isNewer(storeVersion: "4.0.0", than: "3.99.99"))
        #expect(AppStoreUpdatePolicy.isNewer(storeVersion: "3.3.1", than: "3.3"))
    }

    @Test func equalOrOlderVersionDoesNotTriggerUpdate() {
        #expect(!AppStoreUpdatePolicy.isNewer(storeVersion: "3.3", than: "3.3.0"))
        #expect(!AppStoreUpdatePolicy.isNewer(storeVersion: "3.2.9", than: "3.3"))
        #expect(!AppStoreUpdatePolicy.isNewer(storeVersion: "invalid", than: "3.3"))
        #expect(!AppStoreUpdatePolicy.isNewer(storeVersion: "3.foo", than: "2.9"))
        #expect(!AppStoreUpdatePolicy.isNewer(storeVersion: "3.4", than: "3..3"))
    }
}
