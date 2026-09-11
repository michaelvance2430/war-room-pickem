import Foundation

/// Records the action only. The database validates shared-room access and awards
/// Profile Peeker once; opening your own profile never qualifies.
struct ProfileVisitReceipt: Encodable {
    let viewerId: UUID
    let viewedUserId: UUID

    init?(viewerId: UUID, viewedUserId: UUID) {
        guard viewerId != viewedUserId else { return nil }
        self.viewerId = viewerId
        self.viewedUserId = viewedUserId
    }

    enum CodingKeys: String, CodingKey {
        case viewerId = "viewer_id"
        case viewedUserId = "viewed_user_id"
    }
}
