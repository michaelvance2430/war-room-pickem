import SwiftUI

@main
struct WarRoomApp: App {
    @UIApplicationDelegateAdaptor(WarRoomAppDelegate.self) private var appDelegate
    @StateObject private var auth = AuthStore()

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--fieldhouse-preview") {
                FieldhouseNativePreviewView()
            } else {
                RootView()
                    .environmentObject(auth)
                    .task { await auth.restore() }
            }
            #else
            RootView()
                .environmentObject(auth)
                .task { await auth.restore() }
            #endif
        }
    }
}
