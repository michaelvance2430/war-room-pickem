import Foundation

/// Confirmed career history that predates the native app and is not represented
/// in the current season tables. Identity is UUID-only; display names are never
/// used to award hardware or promotion points.
enum LegacyCareerRecords {
    private static let archiveLeagueId = UUID(uuidString: "00000000-0000-0000-0000-000000000025")!

    private static let andrewVisconti = UUID(uuidString: "be59246d-19e7-42b4-b312-6548bb51a9ab")!
    private static let kahmannAndy = UUID(uuidString: "9e579623-23b7-4f0b-9ae6-683e50bae1dc")!
    private static let bigBallsBen = UUID(uuidString: "fdddf273-2430-42db-9127-b8fa7efc1572")!
    private static let maria = UUID(uuidString: "131b404e-db8e-4adf-86f4-f78aacf2a5bc")!
    private static let marilynsMum = UUID(uuidString: "2efe36cc-b174-4267-a51c-82db41587e45")!
    private static let prestigeWorldwide = UUID(uuidString: "463700da-a4cd-4e82-a0a5-f46ee08acff2")!
    private static let robHarbison = UUID(uuidString: "c2b807c8-eb6d-4a15-8acc-0872af50f85a")!
    private static let tbone = UUID(uuidString: "49822b5e-3647-4fca-a869-9bfcfb0e7932")!
    private static let jStray = UUID(uuidString: "b97a7139-3bf6-456e-9318-48c4e6da5c27")!
    private static let mike = UUID(uuidString: "09544d2b-6eca-4131-a321-c000586c9029")!

    private static let cheevosByUser: [UUID: [ProfileAchievement]] = [
        andrewVisconti: [cheevo("hodor_of_hodors", "The Hodor of Hodors", "There are people who watched Game of Thrones. Then there's Andrew. Scientists are still studying how one man can channel this much Hodor energy without collapsing into a pile of Bran-related lore. If someone yells \"Hold the Door!\", he doesn't ask why — he just nods… and becomes the door. Hodor would be proud. Or confused. Probably both.")],
        kahmannAndy: [
            cheevo("war_room_legend", "War Room Legend", "Trophy hardware. Season champ energy. The board remembers."),
            cheevo("the_816_archivist", "The 816 Archivist", "Every Royals stat. Every Chiefs fact. Every obscure piece of Kansas City sports history nobody asked for—but everyone eventually needs. A man of few words because the numbers already said enough. Unfortunately, all that knowledge still hasn’t explained how to lock down the title. The library is open. The trophy case remains under construction.")
        ],
        bigBallsBen: [cheevo("war_room_legend", "War Room Legend", "Trophy hardware. Season champ energy. The board remembers.")],
        maria: [cheevo("the_dr", "The Dr.", "Doctorate at 24. Walks into the War Room like the rest of us forgot how to read. Spoiler: she's not better than you at spreads — she's just a highly decorated nerd with a framed piece of paper that took longer than a fantasy season. Career points only — never pads season cheevos or Cheevo King.")],
        marilynsMum: [cheevo("house_dragon_legendary", "House Dragon", "Keeper of the chaos. Protector of the family. Somehow keeps the house standing despite occasionally forgetting why she walked into the room. The kingdom runs because she never stops trying—and somehow she still raised two incredible daughters. Long may House Dragon reign.")],
        prestigeWorldwide: [cheevo("two_wolves_of_prestige", "The Two Wolves of Prestige", "Inside Prestige Worldwide are two wolves. One is Super Bowl Ed, desperately trying to break out. The other has 17 master’s degrees, has accomplished nearly everything a human being can accomplish, and is still somehow trapped in a football pool with us. Both wolves are overqualified. Neither submitted picks early. “Culture for Service and Service for Humanity.”")],
        robHarbison: [cheevo("built_different_olympian", "Built Different", "NCAA National Champion. 1996 Olympian. Has accomplished more than most people could fit into three lifetimes. Still drives a 2002 Toyota Tundra with 899,725 miles—because apparently Olympic greatness does not include knowing when to let a truck die. Proof that you can have the cake, eat the cake, win a national championship, represent your country—and still pull into the parking lot sounding like loose change in a clothes dryer.")],
        tbone: [cheevo("worlds_greatest_cavalry_scout", "World Greatest Cavalry Scout", "Recon so elite he finds the underdog, the fridge, and your confidence before kickoff. Official hardware: an eggplant welded to a wooden plinth. Not a vegetable. A doctrine. Do not salute it. It will not salute back. Career points only — never pads season cheevos or Cheevo King.")]
    ]

    static func achievements(for userId: UUID, merging live: [ProfileAchievement]) -> [ProfileAchievement] {
        var result = live
        let known = Set(live.map(\.code))
        result.append(contentsOf: (cheevosByUser[userId] ?? []).filter { !known.contains($0.code) })
        return result.sorted { $0.earnedAt > $1.earnedAt }
    }

    static func minimumRankFloor(for _: UUID, liveFloor: String?) -> String? {
        // The saved profile floor is authoritative. Historical awards contribute
        // promotion points, but never silently force a different displayed rank.
        liveFloor
    }

    static func trophies(for userId: UUID, merging live: [ProfileTrophy]) -> [ProfileTrophy] {
        var seen = Set<String>()
        var result = live.filter { trophy in
            let key = "\(trophy.winnerUserId?.uuidString.lowercased() ?? userId.uuidString.lowercased())|\(trophy.seasonYear)|\(trophy.trophyType.lowercased())"
            return seen.insert(key).inserted
        }
        let seeds = legacyTrophies.filter { $0.winnerUserId == userId }
        for trophy in seeds where !result.contains(where: { $0.seasonYear == trophy.seasonYear && $0.trophyType == trophy.trophyType }) {
            result.append(trophy)
        }
        return result.sorted { $0.seasonYear > $1.seasonYear }
    }

    private static func cheevo(_ code: String, _ title: String, _ flavor: String) -> ProfileAchievement {
        ProfileAchievement(leagueId: archiveLeagueId, code: code, title: title, flavor: flavor, earnedAt: "2025-12-31T23:59:59Z")
    }

    private static let legacyTrophies: [ProfileTrophy] = [
        trophy("00000000-0000-0000-0000-000000025001", kahmannAndy, 2025, "championship", "Kahmann", "War Room Champion · 2025–26", "Full 2025–26 season. The board still remembers.", "command_cup"),
        trophy("00000000-0000-0000-0000-000000025002", jStray, 2025, "toilet_bowl", "JStray", "Bottom-half crown · 2025–26", "Still a crown. Wear it proudly.", nil),
        trophy("00000000-0000-0000-0000-000000025003", bigBallsBen, 2025, "crystal_ball", "Big Balls Ben", "Crystal Ball prophet · 2025–26", "Zero standings points. Infinite smug.", nil),
        trophy("00000000-0000-0000-0000-000000025004", maria, 2025, "championship", "Maria", "Super Bowl Champion · 2025", "Defending Super Bowl champion. Permanent career history.", "nfl_sunday_scepter"),
        trophy("00000000-0000-0000-0000-000000026001", mike, 2026, "nfc_championship", "Mike Vance", "NFC Champion · 2026", "Conference hardware—not the Super Bowl. Permanent career history.", "nfl_gridiron_crown"),
        trophy("00000000-0000-0000-0000-000000026002", maria, 2026, "afc_championship", "Maria", "AFC Champion · 2026", "Conference hardware en route to the Super Bowl. Permanent career history.", "nfl_gridiron_crown")
    ]

    private static func trophy(_ id: String, _ winner: UUID, _ year: Int, _ type: String, _ name: String, _ subtitle: String, _ notes: String, _ design: String?) -> ProfileTrophy {
        ProfileTrophy(id: UUID(uuidString: id)!, leagueId: archiveLeagueId, seasonYear: year, trophyType: type, winnerName: name, winnerUserId: winner, subtitle: subtitle, notes: notes, awardedAt: "\(year)-12-31T23:59:59Z", trophyDesignId: design)
    }
}
