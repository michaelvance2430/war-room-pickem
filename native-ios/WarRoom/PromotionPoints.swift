import Foundation

enum PromotionPoints {
    static func points(for code: String) -> Int {
        code == "the_creator" ? 200 : pointsByCode[code, default: 0]
    }

    static func total(for achievements: [ProfileAchievement]) -> Int {
        // Cheevos are career unlocks, not repeatable league currency. The
        // database historically keys them by league, so the same code can have
        // more than one receipt when a player competes in several rooms. Keep
        // those receipts intact, but never let duplicate codes inflate rank.
        Set(achievements.map(\.code)).reduce(0) { $0 + points(for: $1) }
    }

    private static let pointsByCode: [String: Int] = Dictionary(uniqueKeysWithValues: raw.split(separator: "\n").compactMap { line in
        let pair = line.split(separator: "=", maxSplits: 1)
        guard pair.count == 2, let points = Int(pair[1]) else { return nil }
        return (String(pair[0]), points)
    })

    private static let raw = """
bare_minimum_dual=10
best_bet_baby=10
best_bet_assassin=50
best_bet_banker=25
best_bet_marked=10
board_watcher=10
chalk_dust=10
bottom_of_the_barrel=25
built_different_olympian=200
calendar_cosplayer=25
card_complete=10
century_club=10
chalk_eater=10
chalk_streak=25
championship_ring=200
three_ring_circus=50
five_star_dynasty=100
ten_room_terror=200
cheevo_king=25
clean_sheet=25
clutch_gene=25
comeback_kid=50
confidence_king=50
confidence_ladder=10
creator_checked_in=10
dog_tag=10
crew_card_grinder=25
crew_dual_desk=25
crew_midseason_loyal=25
crew_multi_chapter=50
crew_points_furnace=50
crystal_gazed=10
cut_line_escape=25
cut_line_killer=50
division_climber=25
division_dominator=50
division_dweller=10
dog_day_afternoon=10
dog_whisperer=50
double_digit_club=10
dual_desk_legend=200
egg_anniversary=0
egg_birthday=0
egg_christmas=0
egg_curiosity_trophy=0
egg_developer_thanks=0
egg_halloween=0
egg_hidden_headline=0
egg_impossible=0
egg_leap_day=0
egg_lucky_seven=0
egg_mascot_scout=0
egg_never_give_up=0
egg_newyear=0
egg_obsession=0
egg_thanksgiving=0
egg_three_peat=0
egg_veterans=0
egg_vonnaggio_gold=0
egg_welcome_home=0
elite_commish=150
early_bird_special=10
face_of_the_franchise=10
favorite_survivor=10
favorite_child=10
fifty_club=10
first_and_final=25
first_blood=10
four_green_friday=25
full_conference=25
gameday_ready=10
green_light=10
home_cooking_card=10
halfway_hangin=10
hodor_of_hodors=200
home_cookin=25
hot_hand=25
house_dragon_legendary=200
immortal_streak=200
iron_card=50
iron_lungs=25
late_night_lock=10
keys_to_the_war_room=10
knock_knock=10
leaderboard_lookin=25
let_them_cook=25
lock_it_in=10
locker_lurker=10
lone_wolf=10
max_card=50
multi_game_monday=10
national_nightmare=200
neighborhood_creeper=25
news_reader=10
no_takebacks=10
on_the_board=10
parlay_pilot=25
perfect_saturday=50
profile_peeker=10
prop_me_up=10
prop_merchant=10
prop_overlord=50
prop_prophet=25
push_happens=10
rematch_ready=10
ride_with_mine=10
road_snacks=10
rivalry_week=25
hate_week_roll_call=10
grudge_veteran=50
dynasty_of_spite=200
road_dog=25
rules_skimmer=10
saturday_starter=10
season_sovereign=200
seasoned_vet=50
silence_the_room=25
six_pack_saturday=50
six_seven=75
sniper=50
spread_survivor=10
split_decision=10
streak_starter=25
sweep_adjacent=25
ten_streak_terror=50
ten_week_tenant=25
the_816_archivist=200
the_closer=150
the_commissioner=200
the_dr=200
three_pack=10
thursday_night_shift=10
top_shelf_pick=10
the_little_engine=10
the_velvet_rope=10
second_thoughts=10
photo_finish=10
saturday_detention=10
toilet_crown=150
two_week_tour=10
two_wolves_of_prestige=200
unbreakable=200
underdog_believer=25
underdog_spree=25
villain_arc=50
volume_shooter=25
war_room_general=50
war_room_legend=200
war_room_recruit=10
walk_in_warrior=10
welcome_to_the_party=10
week_one_warrior=10
tough_love=10
open_for_business=10
nfl_first_down=10
nfl_sunday_service=10
nfl_monday_night_closer=10
nfl_red_zone_regular=10
nfl_primetime_personnel=10
nfl_division_business=10
nfl_wild_card_applicant=10
nfl_jdam_trainee=10
nfl_conference_caller=10
nfl_super_sunday=10
fieldhouse_tip_off=10
fieldhouse_full_court_press=10
fieldhouse_buzzer_beater=10
fieldhouse_chalk_in_the_paint=10
fieldhouse_bracket_curious=10
fieldhouse_first_four_foreman=10
fieldhouse_cinderella_scout=10
fieldhouse_marching_orders=10
fieldhouse_hardwood_homer=10
fieldhouse_net_result=10
cfb_saturday_school=10
cfb_tailgate_certified=10
cfb_ranked_and_dangerous=10
cfb_upset_alert=10
cfb_noon_whistle=10
cfb_after_dark=10
cfb_grudge_match=10
cfb_title_game_tourist=10
cfb_bowl_curious=10
cfb_bowl_bound=10
worlds_greatest_cavalry_scout=200
"""
}

enum CompetitiveLeaguePolicy {
    static let minimumActivePlayers = 8
    static let minimumLockedCards = 4

    /// Seventy-five percent, rounded up. Integer math keeps the rule identical
    /// in Swift and Postgres without floating-point drift.
    static func requiredLockedCards(eligibleCards: Int) -> Int {
        guard eligibleCards > 0 else { return 0 }
        return (eligibleCards * 3 + 3) / 4
    }

    static func playerQualifies(lockedCards: Int, eligibleCards: Int) -> Bool {
        guard lockedCards >= minimumLockedCards else { return false }
        return lockedCards >= requiredLockedCards(eligibleCards: eligibleCards)
    }

    static func isOfficial(activePlayers: Int) -> Bool {
        activePlayers >= minimumActivePlayers
    }
}

struct CompetitiveLeagueBannerCopy: Equatable, Sendable {
    let title: String
    let detail: String
    let isHardwareEligible: Bool
}

enum CompetitiveLeagueBannerPolicy {
    static func copy(
        status: CompetitiveLeagueStatus,
        seasonIsFrozen: Bool,
        forceDemo: Bool = false
    ) -> CompetitiveLeagueBannerCopy {
        let minimum = status.minimumActivePlayers
        let active = forceDemo ? 0 : status.activeHumanCount
        let needed = max(0, minimum - active)
        let hardwareEligible = !forceDemo && CompetitiveLeaguePolicy.isOfficial(activePlayers: active)
        let earlySeason = status.maximumEligibleCards < status.minimumLockedCards

        // Before four cards have been scored, nobody can satisfy the permanent
        // active-player definition yet. Judge the room's current track by its
        // human roster instead of falsely labeling every legitimate league Demo.
        if !seasonIsFrozen && earlySeason && !forceDemo {
            let humans = status.totalHumanCount
            if humans >= minimum {
                return CompetitiveLeagueBannerCopy(
                    title: "HARDWARE TRACK · \(humans) PLAYERS",
                    detail: "This room clears the eight-player floor. Final active status begins after four scored cards; players must lock at least 75% of their eligible season.",
                    isHardwareEligible: true
                )
            }

            let rosterNeeded = max(0, minimum - humans)
            let noun = rosterNeeded == 1 ? "PLAYER" : "PLAYERS"
            return CompetitiveLeagueBannerCopy(
                title: "DEMO TRACK · NEED \(rosterNeeded) MORE \(noun)",
                detail: "Eight human players are required before this room can enter the hardware track. Final active status begins after four scored cards and requires 75% participation.",
                isHardwareEligible: false
            )
        }

        if hardwareEligible {
            return CompetitiveLeagueBannerCopy(
                title: seasonIsFrozen
                    ? "OFFICIAL LEAGUE · PROFILE HARDWARE ENABLED"
                    : "HARDWARE TRACK · \(active) ACTIVE PLAYERS",
                detail: seasonIsFrozen
                    ? "This season cleared the eight-active-player requirement and can award permanent profile hardware."
                    : "Currently on pace for permanent profile hardware. Active players must lock at least 75% of their eligible cards, with a four-card minimum.",
                isHardwareEligible: true
            )
        }

        let noun = needed == 1 ? "PLAYER" : "PLAYERS"
        return CompetitiveLeagueBannerCopy(
            title: seasonIsFrozen
                ? "DEMO LEAGUE · NO PERMANENT HARDWARE"
                : "DEMO TRACK · NEED \(needed) MORE ACTIVE \(noun)",
            detail: earlySeason
                ? "Eight active players are required. Active status begins after four scored cards, then requires picks in at least 75% of each player’s eligible season."
                : "\(active) of \(minimum) active players currently qualify. Existing members can still qualify by locking at least 75% of their eligible cards, with a four-card minimum.",
            isHardwareEligible: false
        )
    }
}
