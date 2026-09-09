import Foundation
import UserNotifications
import UIKit

struct WarRoomNotificationRoute: Codable, Equatable, Sendable {
    let destination: String
    let leagueId: UUID?
    let week: Int?
    let kind: String?

    init(destination: String, leagueId: UUID? = nil, week: Int? = nil, kind: String? = nil) {
        self.destination = destination
        self.leagueId = leagueId
        self.week = week
        self.kind = kind
    }

    init?(userInfo: [AnyHashable: Any]) {
        guard let destination = userInfo["destination"] as? String else { return nil }
        self.destination = destination
        self.leagueId = (userInfo["league_id"] as? String).flatMap(UUID.init(uuidString:))
        self.kind = userInfo["kind"] as? String
        if let week = userInfo["week"] as? Int { self.week = week }
        else if let week = userInfo["week"] as? NSNumber { self.week = week.intValue }
        else if let week = userInfo["week"] as? String { self.week = Int(week) }
        else { self.week = nil }
    }

    var routesToFieldhousePostseasonOverview: Bool {
        kind == "fieldhouse_selection_sunday" || kind == "fieldhouse_selection_sunday_lock_1h"
    }
}

final class WarRoomAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        if let userInfo = launchOptions?[.remoteNotification] as? [AnyHashable: Any],
           let route = WarRoomNotificationRoute(userInfo: userInfo) {
            WarRoomNotificationCenter.savePendingRoute(route)
        }
        return true
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(token, forKey: WarRoomNotificationCenter.deviceTokenKey)
        NotificationCenter.default.post(name: .warRoomDeviceTokenChanged, object: token)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        #if DEBUG
        print("Remote notification registration failed: \(error.localizedDescription)")
        #endif
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let route = WarRoomNotificationRoute(userInfo: userInfo) {
            WarRoomNotificationCenter.savePendingRoute(route)
            NotificationCenter.default.post(name: .warRoomNotificationDestination, object: route)
        }
        completionHandler()
    }
}

extension Notification.Name {
    static let warRoomNotificationDestination = Notification.Name("warRoom.notification.destination")
    static let warRoomDeviceTokenChanged = Notification.Name("warRoom.notification.device-token")
}

enum WarRoomNotificationCenter {
    private static let center = UNUserNotificationCenter.current()
    static let deviceTokenKey = "warroom.apns.device-token"
    static let pendingDestinationKey = "warroom.notification.pending-route"
    static let preferenceEnabledKey = "warroom.notifications.enabled"
    static let installationIdKey = "warroom.notifications.installation-id"

    static var pushEnvironment: String {
        #if DEBUG
        "development"
        #else
        "production"
        #endif
    }

    static var installationId: UUID {
        if let value = UserDefaults.standard.string(forKey: installationIdKey),
           let id = UUID(uuidString: value) {
            return id
        }
        let id = UUID()
        UserDefaults.standard.set(id.uuidString.lowercased(), forKey: installationIdKey)
        return id
    }

    static var appBuild: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown"
    }

    static func authorizationStatusName(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: "not_determined"
        case .denied: "denied"
        case .authorized: "authorized"
        case .provisional: "provisional"
        case .ephemeral: "ephemeral"
        @unknown default: "unknown"
        }
    }

    static var preferenceEnabled: Bool {
        preferenceEnabled(in: .standard)
    }

    static func preferenceEnabled(in defaults: UserDefaults) -> Bool {
        defaults.object(forKey: preferenceEnabledKey) == nil
            ? true
            : defaults.bool(forKey: preferenceEnabledKey)
    }

    static func setPreferenceEnabled(_ enabled: Bool) {
        UserDefaults.standard.set(enabled, forKey: preferenceEnabledKey)
    }

    static func savePendingRoute(_ route: WarRoomNotificationRoute) {
        guard let data = try? JSONEncoder().encode(route) else { return }
        UserDefaults.standard.set(data, forKey: pendingDestinationKey)
        UserDefaults.standard.synchronize()
    }

    static func takePendingRoute() -> WarRoomNotificationRoute? {
        let data = UserDefaults.standard.data(forKey: pendingDestinationKey)
        // An empty tombstone is more reliable than removing a key while the app
        // is launching and CFPreferences is synchronizing across processes.
        UserDefaults.standard.set(Data(), forKey: pendingDestinationKey)
        UserDefaults.standard.synchronize()
        guard let data, !data.isEmpty else { return nil }
        return try? JSONDecoder().decode(WarRoomNotificationRoute.self, from: data)
    }

    static func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    @MainActor
    static func requestAuthorization() async -> Bool {
        do {
            let authorized = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            if authorized {
                setPreferenceEnabled(true)
                UIApplication.shared.registerForRemoteNotifications()
            }
            return authorized
        } catch {
            return false
        }
    }

    @MainActor
    static func disable() {
        setPreferenceEnabled(false)
        center.removeAllPendingNotificationRequests()
        UIApplication.shared.unregisterForRemoteNotifications()
    }

    @MainActor
    static func enableRegistration() {
        setPreferenceEnabled(true)
        UIApplication.shared.registerForRemoteNotifications()
    }

    static func sync(
        leagueId: UUID,
        leagueName: String,
        week: Int,
        card: WeekCard?,
        announcements: [Announcement]
    ) async {
        guard preferenceEnabled else { return }
        let settings = await center.notificationSettings()
        let authorization = settings.authorizationStatus
        guard authorization == .authorized || authorization == .provisional else { return }
        await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }

        if let card {
            await scheduleCardReminders(
                leagueId: leagueId,
                leagueName: leagueName,
                week: week,
                card: card
            )
        }
        await notifyUnreadAnnouncements(leagueId: leagueId, leagueName: leagueName, announcements: announcements)
    }

    private static func scheduleCardReminders(
        leagueId: UUID,
        leagueName: String,
        week: Int,
        card: WeekCard
    ) async {
        guard let lockAt = resolvedLockTime(card), lockAt > Date() else {
            center.removePendingNotificationRequests(withIdentifiers: reminderIds(leagueId: leagueId, week: week))
            return
        }

        let builtId = "card-built.\(leagueId.uuidString).\(week).\(card.id.uuidString)"
        if !UserDefaults.standard.bool(forKey: builtId) {
            let content = content(
                title: "Week \(week) card is live",
                body: "\(leagueName) is ready. Make your picks before the card locks.",
                leagueId: leagueId,
                week: week,
                kind: "card_built"
            )
            do {
                try await center.add(UNNotificationRequest(identifier: builtId, content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false)))
                UserDefaults.standard.set(true, forKey: builtId)
            } catch { }
        }

        for reminder in CardReminderSchedule.pending(lockAt: lockAt, now: Date(), leagueId: leagueId, week: week) {
            center.removePendingNotificationRequests(withIdentifiers: [reminder.identifier])
            let body = reminder.kind == "12h"
                ? "Week \(week) in \(leagueName) is closing soon. Get your picks on the record."
                : "Week \(week) in \(leagueName) locks in one hour. Finish and confirm your card."
            let title = reminder.kind == "12h" ? "Card locks in 12 hours" : "FINAL WARNING · 1 HOUR"
            let notification = content(title: title, body: body, leagueId: leagueId, week: week, kind: "card_lock_\(reminder.kind)")
            let trigger = UNCalendarNotificationTrigger(dateMatching: Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: reminder.fireAt), repeats: false)
            try? await center.add(UNNotificationRequest(identifier: reminder.identifier, content: notification, trigger: trigger))
        }
    }

    private static func notifyUnreadAnnouncements(leagueId: UUID, leagueName: String, announcements: [Announcement]) async {
        // Server push is authoritative. This foreground fallback intentionally emits only the
        // newest unread item so restoring an account cannot flood Notification Center.
        for announcement in announcements.filter(\.isUnread).prefix(1) {
            let identifier = "announcement.\(announcement.id.uuidString)"
            guard !UserDefaults.standard.bool(forKey: identifier) else { continue }
            let preview = announcement.body.count > 180 ? String(announcement.body.prefix(177)) + "…" : announcement.body
            let notification = content(
                title: announcement.title,
                body: "\(leagueName): \(preview)",
                leagueId: leagueId,
                week: nil,
                kind: "announcement"
            )
            do {
                try await center.add(UNNotificationRequest(identifier: identifier, content: notification, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false)))
                UserDefaults.standard.set(true, forKey: identifier)
            } catch { }
        }
    }

    private static func resolvedLockTime(_ card: WeekCard) -> Date? {
        if let lockTime = card.lockTime, let parsed = footballKickoffDate(lockTime) { return parsed }
        return card.cardGames.compactMap { footballKickoffDate($0.startTime) }.min()
    }

    private static func reminderIds(leagueId: UUID, week: Int) -> [String] {
        ["card-lock.12h.\(leagueId.uuidString).\(week)", "card-lock.1h.\(leagueId.uuidString).\(week)"]
    }

    private static func content(title: String, body: String, leagueId: UUID, week: Int?, kind: String) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.categoryIdentifier = "WAR_ROOM_SYSTEM"
        content.threadIdentifier = "league.\(leagueId.uuidString)"
        var userInfo: [String: Any] = [
            "kind": kind,
            "league_id": leagueId.uuidString.lowercased(),
            "destination": kind == "announcement" ? "announcements" : "picks",
        ]
        if let week { userInfo["week"] = week }
        content.userInfo = userInfo
        return content
    }
}

struct CardReminder: Equatable {
    let kind: String
    let identifier: String
    let fireAt: Date
}

enum CardReminderSchedule {
    static func pending(lockAt: Date, now: Date, leagueId: UUID, week: Int) -> [CardReminder] {
        [("12h", 12 * 60 * 60), ("1h", 60 * 60)].compactMap { kind, lead in
            let fireAt = lockAt.addingTimeInterval(-lead)
            guard fireAt > now else { return nil }
            return CardReminder(kind: kind, identifier: "card-lock.\(kind).\(leagueId.uuidString).\(week)", fireAt: fireAt)
        }
    }
}
