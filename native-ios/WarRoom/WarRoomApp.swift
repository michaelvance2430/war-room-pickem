import SwiftUI

@main
struct WarRoomApp: App {
    @UIApplicationDelegateAdaptor(WarRoomAppDelegate.self) private var appDelegate
    @StateObject private var auth = AuthStore()

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--fieldhouse-preview") {
                FieldhouseNativePreviewView(
                    initialLeague: ProcessInfo.processInfo.arguments.contains("--fieldhouse-ncaaw") ? .ncaaw : .ncaam
                )
                .environmentObject(auth)
                .task { await auth.restore() }
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
