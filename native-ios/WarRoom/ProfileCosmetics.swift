import SwiftUI

struct ProfileCosmeticOption: Identifiable, Hashable {
    let id: String
    let name: String
    let detail: String
    let primary: Color
    let secondary: Color
}

enum ProfileCosmetics {
    private static let titleLabels: [String: String] = [
        "the_creator": "The Creator", "the_commissioner": "The Creator",
        "war_room_legend": "War Room Legend", "worlds_greatest_cavalry_scout": "Cavalry Scout",
        "the_dr": "The Dr.", "house_dragon_legendary": "House Dragon", "hodor_of_hodors": "Hodor",
        "built_different_olympian": "Olympian", "the_816_archivist": "BBQ Sauce",
        "sad_little_brains": "Sad Little Brain", "neighborhood_creeper": "Neighborhood Creeper",
        "championship_ring": "Ring Bearer", "season_sovereign": "Season Sovereign",
        "national_nightmare": "The Oracle", "elite_commish": "Iron Gavel",
        "immortal_streak": "Immortal", "unbreakable": "Unbreakable", "the_closer": "The Closer",
        "sniper": "The Sniper", "ten_streak_terror": "Streak Terror", "war_room_general": "War Room General",
        "max_card": "Max Card", "perfect_saturday": "Perfect Saturday", "six_pack_saturday": "Six-Pack Saturday",
        "nfl_perfect_sunday": "Perfect Sunday", "nfl_primetime_general": "Primetime General",
        "nfl_red_zone_assassin": "Red Zone Assassin", "nfl_film_dont_lie": "Film Don't Lie",
        "nfl_immortal_sunday": "Immortal Sunday", "nfl_super_bowl_desk": "Super Bowl Desk",
        "nfl_late_window_legend": "Late Window Legend", "best_bet_assassin": "Best Bet Assassin",
        "clutch_gene": "Clutch Gene", "division_dominator": "Division Dominator", "cheevo_king": "Cheevo King",
        "seasoned_vet": "Seasoned Vet", "confidence_king": "Confidence King", "first_and_final": "First & Final",
        "silence_the_room": "Silence the Room", "villain_arc": "Villain Arc", "dog_whisperer": "Dog Whisperer",
        "underdog_believer": "Dog Believer", "underdog_spree": "Upset Merchant", "prop_overlord": "Prop Overlord",
        "prop_prophet": "Prop Prophet", "parlay_pilot": "Parlay Pilot", "comeback_kid": "Comeback Kid",
        "cut_line_killer": "Cut Line Killer", "road_dog": "Road Dog", "toilet_crown": "Eater of Trash",
        "bottom_of_the_barrel": "Bottom of the Barrel", "chalk_eater": "Chalk Eater", "chalk_streak": "Public Favorite",
        "division_dweller": "Division Dweller", "locker_lurker": "Locker Lurker", "push_happens": "Push Merchant",
        "cut_line_escape": "Cut Line Escapee", "leaderboard_lookin": "Leaderboard Lookin’", "volume_shooter": "Volume Shooter",
        "iron_lungs": "Never Ghosts", "ten_week_tenant": "Ten-Week Tenant", "home_cookin": "Home Cookin’",
        "hot_hand": "Hot Hand", "clean_sheet": "Clean Sheet", "best_bet_banker": "Best Bet Banker",
        "hate_week_roll_call": "Picked a Fight", "rivalry_week": "Group Chat Muted",
        "grudge_veteran": "Restraining Order", "dynasty_of_spite": "Generational Hater"
    ]

    static func titles(earned: [ProfileAchievement], rank: CareerRank) -> [ProfileCosmeticOption] {
        var options: [ProfileCosmeticOption] = []
        for item in earned {
            let key = item.code == "the_creator" ? "the_commissioner" : item.code
            guard let label = titleLabels[key], !options.contains(where: { $0.id == key }) else { continue }
            options.append(ProfileCosmeticOption(id: key, name: label, detail: item.flavor, primary: .yellow, secondary: .red))
        }
        return options
    }

    static func ranks(upTo rank: CareerRank) -> [CareerRank] {
        guard let index = CareerRanks.all.firstIndex(where: { $0.id == rank.id }) else { return [rank] }
        return Array(CareerRanks.all[...index])
    }

    static func titleName(for id: String?) -> String? {
        guard let id else { return nil }
        if CareerRanks.all.contains(where: { $0.id == id }) { return nil }
        return titleLabels[id]
    }

    private struct BorderRule {
        let id: String; let name: String; let badge: String?; let colors: (Color, Color)
    }

    private static let borderRules: [BorderRule] = [
        .init(id: "plain", name: "Plain Ring", badge: nil, colors: (.gray, .white)),
        .init(id: "recruit", name: "Recruit Steel", badge: "war_room_recruit", colors: (.gray, .white)),
        .init(id: "first_blood", name: "First Blood", badge: "first_blood", colors: (.red, .black)),
        .init(id: "lock_it_in", name: "Lock Green", badge: "lock_it_in", colors: (.green, .mint)),
        .init(id: "on_the_board", name: "On the Board", badge: "on_the_board", colors: (.blue, .cyan)),
        .init(id: "face", name: "Face Card", badge: "face_of_the_franchise", colors: (.purple, .pink)),
        .init(id: "chalk", name: "Chalk Dust", badge: "chalk_eater", colors: (.white, .gray)),
        .init(id: "hot_hand", name: "Hot Hand", badge: "hot_hand", colors: (.orange, .red)),
        .init(id: "clean_sheet", name: "Clean Sheet", badge: "clean_sheet", colors: (.cyan, .white)),
        .init(id: "iron_lungs", name: "Iron Lungs", badge: "iron_lungs", colors: (.teal, .green)),
        .init(id: "barrel", name: "Barrel Bottom", badge: "bottom_of_the_barrel", colors: (.brown, .yellow)),
        .init(id: "dog", name: "Dog Collar", badge: "underdog_believer", colors: (.green, .yellow)),
        .init(id: "cheevo", name: "Cheevo Crown", badge: "cheevo_king", colors: (.yellow, .orange)),
        .init(id: "sniper", name: "Sniper Scope", badge: "sniper", colors: (.pink, .red)),
        .init(id: "general", name: "General Stars", badge: "war_room_general", colors: (.indigo, .white)),
        .init(id: "villain", name: "Villain Arc", badge: "villain_arc", colors: (.purple, .black)),
        .init(id: "generational_spite", name: "Inherited Grudge", badge: "dynasty_of_spite", colors: (.yellow, .red)),
        .init(id: "prop", name: "Prop Overlord", badge: "prop_overlord", colors: (.pink, .purple)),
        .init(id: "toilet", name: "Porcelain Throne", badge: "toilet_crown", colors: (.purple, .pink)),
        .init(id: "ring", name: "Championship Gold", badge: "championship_ring", colors: (.yellow, .white)),
        .init(id: "legend", name: "War Room Legend", badge: "war_room_legend", colors: (.orange, .yellow)),
        .init(id: "immortal", name: "Immortal Flame", badge: "immortal_streak", colors: (.orange, .red))
    ]

    static func borders(userId: UUID, earned: [ProfileAchievement]) -> [ProfileCosmeticOption] {
        let ids = Set(earned.map(\.code))
        var rows = borderRules.filter { $0.badge == nil || ids.contains($0.badge!) }.map {
            ProfileCosmeticOption(id: $0.id, name: $0.name, detail: $0.badge == nil ? "Standard issue" : "Unlocked by \($0.badge!.replacingOccurrences(of: "_", with: " ").capitalized)", primary: $0.colors.0, secondary: $0.colors.1)
        }
        if AppIdentity.isCreator(userId) {
            rows += [
                .init(id: "creator_flame", name: "Living Flame", detail: "Creator only", primary: .orange, secondary: .red),
                .init(id: "creator_forge", name: "Molten Forge", detail: "Creator only", primary: .yellow, secondary: .orange),
                .init(id: "creator_circuit", name: "Creator Circuit", detail: "Creator only", primary: .green, secondary: .cyan)
            ]
        }
        return rows
    }

    static func border(_ id: String?) -> ProfileCosmeticOption {
        let all = borderRules.map { ProfileCosmeticOption(id: $0.id, name: $0.name, detail: "", primary: $0.colors.0, secondary: $0.colors.1) }
        return all.first { $0.id == id } ?? ProfileCosmeticOption(id: id ?? "plain", name: "Profile Ring", detail: "", primary: id?.contains("creator") == true ? .orange : .gray, secondary: id == "creator_circuit" ? .green : .yellow)
    }
}

struct ProfileBorderModifier: ViewModifier {
    let borderId: String?
    func body(content: Content) -> some View {
        let border = ProfileCosmetics.border(borderId)
        content
            .padding(4)
            .background(Circle().fill(LinearGradient(colors: [border.primary, border.secondary, border.primary], startPoint: .topLeading, endPoint: .bottomTrailing)))
            .shadow(color: border.primary.opacity(borderId == nil || borderId == "plain" ? 0.15 : 0.75), radius: borderId == nil || borderId == "plain" ? 2 : 10)
    }
}
