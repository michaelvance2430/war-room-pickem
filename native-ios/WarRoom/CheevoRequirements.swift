import Foundation

enum CheevoRequirements {
    static func text(for code: String) -> String {
        byCode[code == "the_creator" ? "the_commissioner" : code] ?? "Requirement details are still classified."
    }

    private static let byCode: [String: String] = Dictionary(uniqueKeysWithValues: raw.split(separator: "\n").compactMap { line in
        let pair = line.split(separator: "|", maxSplits: 1).map(String.init)
        guard pair.count == 2 else { return nil }
        return (pair[0], pair[1])
    })

    private static let raw = """
the_commissioner|You can't. Opening a league makes you commissioner of that room — cute. This crown is for the person who built the app. Peasants stay grey.
war_room_legend|Win a major War Room trophy (Championship / engraved hardware). Awarded by the room — career points stick forever.
worlds_greatest_cavalry_scout|You don't earn this. The cavalry either is you — or it isn't. Seeded for Tbone Soulstache Rockstar / Football Guru. Peasants: admire the wood grain and move along.
the_dr|You don't grind this. You survive graduate school while the rest of the Crew argues about Sunday. Seeded for Maria. Peasants: genuflect, then fade the favorite.
house_dragon_legendary|Commissioner-issued lore. Not a grind. Not available to the field. Seeded for Marilynnsmum alone.
hodor_of_hodors|Awarded to the one true Hodor. Some legends are chosen. Some are born. This one never had a choice.
two_wolves_of_prestige|Commissioner-issued lore. One of one. Account-wide. Seeded for Prestige Worldwide alone.
built_different_olympian|Commissioner-issued lore. One of one. Account-wide. Seeded for Rob Harbison alone.
the_816_archivist|Commissioner-issued lore. One of one. Account-wide. Seeded for Kahmann alone.
sad_little_brains|Hold the league record for sole last-place weeks all-time (min 3, no ties for the record). Lifetime. Sticky. Deeply unserious.
immortal_streak|Get 30 correct ATS picks in a row.
the_closer|Cash your picks on the CFP / finals slate.
elite_commish|Serve as league commissioner for at least 14 of the 18 season weeks in one league season. Pass the role and the clock stops; keep showing up and the gavel remembers.
war_room_general|Finish #1 in your league for a week. Can earn every week you top the board.
sniper|Get 15 correct ATS picks in a row.
max_card|Score 18+ points in a single week (perfect card territory). Multi-earn.
perfect_saturday|Post a perfect week (18+ pts). Can earn more than once.
seasoned_vet|Reach 1,000 lifetime correct ATS picks.
villain_arc|Beat the same rival three weeks in a row.
crew_points_furnace|Lead your league in total season points (or share the lead). Shows on profile as Crew commitment.
crew_multi_chapter|Complete 2+ Crew chapters (season finales) with the same Crew.
first_and_final|Be the first real player in your league to fully lock a week (sides, confidence, Best Bet, prop). Change any pick after that and you forfeit the badge for that week.
hot_hand|Get 5 correct ATS picks in a row.
clean_sheet|Post a perfect week (18+ pts).
parlay_pilot|Hit your Best Bet 5 times in a season.
underdog_believer|Cash 5 actual underdog picks against the spread in a season.
volume_shooter|Reach 50 correct ATS picks in a season.
crew_midseason_loyal|Submit at least 6 of the first 8 weekly cards.
crew_dual_desk|Your Crew has chapters in both CFB and NFL.
crew_card_grinder|Post 8 complete locked weekly cards in a season.
iron_lungs|Submit complete cards for 6 consecutive weeks.
hate_week_roll_call|Complete and lock all five picks on the CFB Week 13 Rivalry Card.
rivalry_week|Cash at least one pick in a commissioner-designated rivalry game.
grudge_veteran|Cash a designated rivalry pick in 2 distinct CFB seasons. Multiple leagues in one season still count as one season.
dynasty_of_spite|Cash a designated rivalry pick in 3 distinct CFB seasons and hit a rivalry Best Bet in at least one of them. Cannot be earned in one season.
clutch_gene|Hit 7 Best Bets in a season.
cheevo_king|Have the most achievement points in your league (checked whenever profiles/standings load). Awarded forever.
let_them_cook|Lock a Chaos Mode card (robots cook — pure RNG, 2× week points, 2 per season). Permanent flex.
neighborhood_creeper|Open Deep stats & legacy math on your own profile. One-time permanent. Equip the title if you want the room to know.
calendar_cosplayer|No spoilers. Dress for the season. Curiosity only.
egg_anniversary|No spoilers. Curiosity only.
egg_curiosity_trophy|No spoilers. Curiosity only.
egg_vonnaggio_gold|No spoilers. Curiosity only.
egg_hidden_headline|No spoilers. Curiosity only.
egg_leap_day|No spoilers. Curiosity only.
egg_birthday|No spoilers. Curiosity only.
egg_lucky_seven|No spoilers. Curiosity only.
egg_obsession|No spoilers. Curiosity only.
egg_halloween|No spoilers. Curiosity only.
egg_christmas|No spoilers. Curiosity only.
egg_thanksgiving|No spoilers. Curiosity only.
egg_newyear|No spoilers. Curiosity only.
egg_three_peat|No spoilers. Curiosity only.
egg_never_give_up|No spoilers. Curiosity only.
egg_developer_thanks|No spoilers. Curiosity only.
egg_impossible|???
egg_mascot_scout|No spoilers. Curiosity only.
egg_veterans|No spoilers. Curiosity only.
egg_welcome_home|No spoilers. Curiosity only.
first_blood|Make your first pick.
war_room_recruit|Complete your profile (display name).
creator_checked_in|Be in a league that includes the app Creator, and he has to actually show up (last seen in the app). Everyone in that room gets this common flex — not a personal visit from Santa.
lock_it_in|Submit a full weekly card.
on_the_board|Get your first correct ATS pick.
chalk_eater|Get 10 correct ATS picks (favorites count).
saturday_starter|Make picks for your first Saturday slate.
green_light|Score your first weekly points.
face_of_the_franchise|Upload a profile photo.
gameday_ready|Play 3 weeks.
national_nightmare|Correctly pick the national champion on Crystal Ball (commish crowns the champ).
championship_ring|Win the league Championship (Trophy Room).
toilet_crown|Win the Toilet Bowl (Trophy Room).
season_sovereign|Finish #1 overall with at least 10 weeks played (checked on profile/standings load).
unbreakable|Get 20 correct ATS picks in a row (hot week streak).
dual_desk_legend|Play at least 10 weeks in a CFB league AND 10 weeks in an NFL league (career high-water on each desk). Join alone is common; finish both is legendary.
six_seven|Be on the card the week any War Room slate game ends 6–7 or 7–6. Anyone who locked that week gets it — you do NOT need to pick the winner. Either score order. CFB + NFL.
six_pack_saturday|Post a perfect week (18+ pts / perfect card).
confidence_king|Score 16+ points in a single week.
best_bet_assassin|Hit 8 Best Bets in a season.
prop_overlord|Hit 8 props in a season.
dog_whisperer|Hit 10 underdog-style cashes (proxy: 10+ ATS correct with Best Bet volume — full dog tracking later).
ten_streak_terror|Get 10 correct ATS picks in a row (hot week streak).
division_dominator|Lead your division in season points (checked on load).
comeback_kid|Score 8+ more points than your previous week at least once.
cut_line_killer|Sit in the top 25% of the league overall (min 4 players).
iron_card|Play 14+ weeks in a season (full-season grind).
four_green_friday|Score 12+ points in a week (strong multi-hit card).
sweep_adjacent|Score 15–17 points in a week.
best_bet_banker|Hit 3 Best Bets in a season.
prop_prophet|Hit 5 props in a season.
underdog_spree|Cash 3 actual underdog picks against the spread in a season.
chalk_streak|Hold a 5-week hot streak (pts ≥ 10).
division_climber|Rank top 3 in your division by season points.
leaderboard_lookin|Sit in the top 50% of the league overall.
cut_line_escape|Sit in the top half of the league overall.
bottom_of_the_barrel|Finish sole last in weekly points among players who scored that week — no ties for last. Can earn every week you solo the basement.
streak_starter|Get a 3-week hot streak (pts ≥ 10).
ten_week_tenant|Play 10 weeks in a season.
full_conference|Score points in 8 different weeks.
road_dog|Cash 5 actual road-team picks against the spread in a season.
home_cookin|Cash 5 actual home-team picks against the spread in a season.
silence_the_room|Have the highest single-week score in the league while any peer has a 0 that week.
card_complete|Lock a complete weekly card (any week played).
prop_merchant|Record a prop result (hit or miss) — prop_total ≥ 1.
best_bet_marked|Set a Best Bet at least once (best_bet_total ≥ 1).
confidence_ladder|Play a full week (card with confidences locked).
division_dweller|Be assigned to a division.
week_one_warrior|Have points on a scored week.
two_week_tour|Play 2 different weeks.
halfway_hangin|Play 6 weeks in a season.
double_digit_club|Reach 10 season pick'em points.
fifty_club|Reach 50 season points.
century_club|Reach 100 season points.
push_happens|Record a push (tracked when scoring lands a push).
favorite_survivor|Get 3 correct ATS picks.
dog_day_afternoon|Get 1 correct ATS pick (dog proxy until side tracking).
spread_survivor|Win any single ATS pick.
multi_game_monday|Score 6+ points in a week (multi-hit).
three_pack|Score 9+ points in a week.
locker_lurker|Post once in Locker Room.
news_reader|Open Announcements at least once.
board_watcher|Open Standings.
rules_skimmer|Open Rules.
crystal_gazed|Make a Crystal Ball pick.
profile_peeker|Open another player’s profile.
late_night_lock|Lock a full card after 10pm local (device time).
rematch_ready|Play 2 consecutive weeks (weeksPlayed ≥ 2).
bare_minimum_dual|Join (or play in) leagues for 2 different sports — e.g. CFB + NFL. More sports unlock more cheevos later.
keys_to_the_war_room|Create your first league.
open_for_business|List a league you commission as public in the Lobby.
the_velvet_rope|List a league you commission as private and request-only in the Lobby.
walk_in_warrior|Join a public room directly through the Lobby.
knock_knock|Submit your first request to join a private room.
welcome_to_the_party|Approve your first private-room membership request as commissioner.
favorite_child|Choose a favorite team for either CFB or NFL.
ride_with_mine|Lock a weekly card that includes a pick on your favorite team.
tough_love|Lock a weekly card that picks against your favorite team.
early_bird_special|Lock a complete card at least 24 hours before the first game on it begins.
no_takebacks|Lock a complete card without changing any selection after its first complete save.
second_thoughts|Change at least one selection and save the card again before it locks.
top_shelf_pick|Hit the selection carrying confidence 5.
the_little_engine|Hit the selection carrying confidence 1.
best_bet_baby|Hit your first Best Bet.
prop_me_up|Hit your first weekly prop.
home_cooking_card|Lock all five selections on the home sides.
road_snacks|NFL only: lock all five selections on the road sides of a weekly card.
dog_tag|Lock at least one actual underdog on a weekly card.
chalk_dust|Lock at least three actual favorites on a weekly card.
split_decision|NFL only: finish an official five-game card exactly 3–2 against the spread.
lone_wolf|Be the only person in a room of at least four players on the correct side of one game.
photo_finish|NFL only: cash an against-the-spread selection by exactly half a point.
thursday_night_shift|NFL only: correctly pick a Thursday game.
saturday_detention|CFB only: correctly pick a Saturday night game beginning at 6 p.m. local venue time or later.
nfl_first_down|NFL only: make your first NFL selection.
nfl_sunday_service|NFL only: lock your first complete Sunday card.
nfl_monday_night_closer|NFL only: correctly pick a Monday Night Football game.
nfl_red_zone_regular|NFL only: cash three against-the-spread selections in one official week.
nfl_primetime_personnel|NFL only: correctly pick a Sunday or Monday primetime game.
nfl_division_business|NFL only: correctly pick a matchup between teams in the same division.
nfl_wild_card_applicant|NFL only: submit your first Wild Card postseason card.
nfl_jdam_trainee|NFL only: deploy your first JDAM during the postseason.
nfl_conference_caller|NFL only: correctly predict either conference champion.
nfl_super_sunday|NFL only: submit a locked Super Bowl winner before kickoff.
fieldhouse_tip_off|Fieldhouse only: make your first college-basketball selection.
fieldhouse_full_court_press|Fieldhouse only: lock your first complete weekly card.
fieldhouse_buzzer_beater|Fieldhouse only: cash a spread selection decided by half a point.
fieldhouse_chalk_in_the_paint|Fieldhouse only: lock at least three favorites on one card.
fieldhouse_bracket_curious|Fieldhouse only: open the tournament bracket for the first time.
fieldhouse_first_four_foreman|Fieldhouse only: lock every First Four selection.
fieldhouse_cinderella_scout|Fieldhouse only: correctly pick a double-digit seed to win outright.
fieldhouse_marching_orders|Fieldhouse only: submit your first complete tournament bracket.
fieldhouse_hardwood_homer|Fieldhouse only: lock a pick on your selected favorite team.
fieldhouse_net_result|Fieldhouse only: earn your first correct official selection.
cfb_saturday_school|CFB only: make your first college-football selection.
cfb_tailgate_certified|CFB only: lock your first complete Saturday card.
cfb_ranked_and_dangerous|CFB only: correctly pick a game featuring two ranked teams.
cfb_upset_alert|CFB only: correctly pick an underdog to beat a ranked opponent.
cfb_noon_whistle|CFB only: correctly pick a game from the noon Eastern kickoff window.
cfb_after_dark|CFB only: correctly pick a game beginning at 8 p.m. Eastern or later.
cfb_grudge_match|CFB only: cash one commissioner-designated rivalry game.
cfb_title_game_tourist|CFB only: submit your first Conference Championship selection.
cfb_bowl_curious|CFB only: open the Bowl Board for the first time.
cfb_bowl_bound|CFB only: submit your first complete Bowl Board.
"""
}
