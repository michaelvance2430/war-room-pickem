import Foundation
import UserNotifications
import UIKit

final class WarRoomAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        if let userInfo = launchOptions?[.remoteNotification] as? [AnyHashable: Any],
           let destination = userInfo["destination"] as? String {
            WarRoomNotificationCenter.savePendingDestination(destination)
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
        if let destination = userInfo["destination"] as? String {
            WarRoomNotificationCenter.savePendingDestination(destination)
            NotificationCenter.default.post(name: .warRoomNotificationDestination, object: destination)
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
    static let pendingDestinationKey = "warroom.notification.pending-destination"

    static func savePendingDestination(_ destination: String) {
        UserDefaults.standard.set(destination, forKey: pendingDestinationKey)
        UserDefaults.standard.synchronize()
    }

    static func takePendingDestination() -> String? {
        let destination = UserDefaults.standard.string(forKey: pendingDestinationKey)
        // An empty tombstone is more reliable than removing a key while the app
        // is launching and CFPreferences is synchronizing across processes.
        UserDefaults.standard.set("", forKey: pendingDestinationKey)
        UserDefaults.standard.synchronize()
        guard let destination, !destination.isEmpty else { return nil }
        return destination
    }

    static func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    @MainActor
    static func requestAuthorization() async -> Bool {
        do {
            let authorized = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            if authorized { UIApplication.shared.registerForRemoteNotifications() }
            return authorized
        } catch {
            return false
        }
    }

    static func sync(
        leagueId: UUID,
        leagueName: String,
        week: Int,
        card: WeekCard?,
        announcements: [Announcement]
    ) async {
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
