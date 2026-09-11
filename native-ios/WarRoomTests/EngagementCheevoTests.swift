import Foundation
import Testing
@testable import WarRoom

@MainActor struct EngagementCheevoTests {
    @Test func reportedActivityAwardsEachAddTenPointsOnlyOnceAcrossRooms() {
        let codes = ["face_of_the_franchise", "knock_knock", "profile_peeker", "crystal_gazed", "locker_lurker"]
        let rows = codes.flatMap { code in
            [UUID(), UUID()].map { ProfileAchievement(leagueId: $0, code: code, title: code, flavor: "", earnedAt: "") }
        }
        for code in codes { #expect(PromotionPoints.points(for: code) == 10) }
        #expect(PromotionPoints.total(for: rows) == 50)
        #expect(PromotionPoints.total(for: rows.filter { $0.code != "profile_peeker" }) == 40)
    }

    @Test func viewingSelfDoesNotCreateAnAwardRequest() {
        let user = UUID()
        #expect(ProfileVisitReceipt(viewerId: user, viewedUserId: user) == nil)
    }

    @Test func profileVisitRecordsViewerAndTargetWithoutClientAwardClaims() throws {
        let viewer = UUID(), target = UUID()
        let receipt = try #require(ProfileVisitReceipt(viewerId: viewer, viewedUserId: target))
        let json = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(receipt)) as? [String: String])
        #expect(json.count == 2)
        #expect(json["viewer_id"]?.lowercased() == viewer.uuidString.lowercased())
        #expect(json["viewed_user_id"]?.lowercased() == target.uuidString.lowercased())
    }
}
