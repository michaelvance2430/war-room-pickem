import Foundation

/// Mirrors the server's conservative, score-derived Cheevo rules. The app may use
/// this for previews; only Supabase is allowed to certify and persist an award.
enum CheevoEngine {
    struct Snapshot: Sendable {
        let totalPoints: Int
        let weeklyPoints: [Int]
        let weeksPlayed: Int
        let atsCorrect: Int
        let bestBetHits: Int
        let bestBetTotal: Int
        let propHits: Int
        let propTotal: Int
        let currentCorrectPickStreak: Int
        let underdogCovers: Int
        let homeCovers: Int
        let roadCovers: Int
        let consecutiveSubmittedWeeks: Int
        let submittedInFirstEight: Int
    }

    static func eligibleCodes(for value: Snapshot) -> Set<String> {
        var codes = Set<String>()
        if value.weeksPlayed >= 1 { codes.formUnion(["lock_it_in", "card_complete", "confidence_ladder", "saturday_starter"]) }
        if value.totalPoints > 0 { codes.formUnion(["green_light", "week_one_warrior"]) }
        if value.atsCorrect >= 1 { codes.formUnion(["on_the_board", "spread_survivor"]) }
        if value.bestBetTotal >= 1 { codes.insert("best_bet_marked") }
        if value.propTotal >= 1 { codes.insert("prop_merchant") }
        if value.weeksPlayed >= 2 { codes.formUnion(["two_week_tour", "rematch_ready"]) }
        if value.weeksPlayed >= 3 { codes.insert("gameday_ready") }
        if value.totalPoints >= 10 { codes.insert("double_digit_club") }
        if value.totalPoints >= 50 { codes.insert("fifty_club") }
        if value.totalPoints >= 100 { codes.insert("century_club") }
        if value.currentCorrectPickStreak >= 5 { codes.insert("hot_hand") }
        if value.underdogCovers >= 3 { codes.insert("underdog_spree") }
        if value.underdogCovers >= 5 { codes.insert("underdog_believer") }
        if value.homeCovers >= 5 { codes.insert("home_cookin") }
        if value.roadCovers >= 5 { codes.insert("road_dog") }
        if value.consecutiveSubmittedWeeks >= 6 { codes.insert("iron_lungs") }
        if value.weeksPlayed >= 8 { codes.insert("crew_card_grinder") }
        if value.submittedInFirstEight >= 6 { codes.insert("crew_midseason_loyal") }
        if value.bestBetHits >= 3 { codes.insert("best_bet_banker") }
        if value.bestBetHits >= 5 { codes.insert("parlay_pilot") }
        if value.bestBetHits >= 7 { codes.insert("clutch_gene") }
        if value.propHits >= 5 { codes.insert("prop_prophet") }
        if value.atsCorrect >= 50 { codes.insert("volume_shooter") }
        if value.weeksPlayed >= 10 { codes.insert("ten_week_tenant") }
        if value.weeklyPoints.filter({ $0 > 0 }).count >= 8 { codes.insert("full_conference") }
        if value.weeklyPoints.contains(where: { $0 >= 12 }) { codes.insert("four_green_friday") }
        if value.weeklyPoints.contains(where: { (15...17).contains($0) }) { codes.insert("sweep_adjacent") }
        if value.weeklyPoints.contains(where: { $0 >= 18 }) { codes.insert("clean_sheet") }
        return codes
    }
}
