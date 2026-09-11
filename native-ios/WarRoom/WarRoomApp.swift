import SwiftUI

@main
struct WarRoomApp: App {
    @UIApplicationDelegateAdaptor(WarRoomAppDelegate.self) private var appDelegate
    @StateObject private var auth = AuthStore()

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--dispatch-navigation-preview") {
                NavigationStack {
                    NavigationLink("Open Dispatch") {
                        GazetteView(previewSport: ProcessInfo.processInfo.arguments.contains("--dispatch-nfl") ? "nfl" : "cfb")
                    }.navigationTitle("Dispatch preview")
                }.environmentObject(auth)
            } else { productionRoot }
            #else
            productionRoot
            #endif
        }
    }

    private var productionRoot: some View {
        RootView()
            .environmentObject(auth)
            .task {
                    await auth.restore()

                    // If iOS still has no notification decision, "Not now" should
                    // never become "never ask again." Clear the stale primer gate
                    // so ContentView can offer the notification primer again.
                    if auth.user != nil,
                       await WarRoomNotificationCenter.authorizationStatus() == .notDetermined {
                        UserDefaults.standard.set(false, forKey: "warroom.notifications.primer-seen")
                    }
                }
    }
}
