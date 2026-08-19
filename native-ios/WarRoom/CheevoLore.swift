import Foundation

enum CheevoLore {
    static func text(for code: String, revealed: Bool = true) -> String? {
        if code.hasPrefix("egg_") && !revealed { return nil }
        return legendary[code] ?? epic[code] ?? rare[code] ?? easterEgg[code] ?? common[code]
    }

    private static let legendary: [String: String] = [
        "war_room_legend": "You won real War Room hardware. The engraving exists, the witnesses are bitter, and every future argument now begins with somebody pretending the season did not count. It counted. The board remembers.",
        "immortal_streak": "Thirty straight correct against the spread. Probability has filed a missing-person report and the sportsbook has turned your photograph toward the wall. This is no longer a hot streak. It is a disturbance in the natural order.",
        "the_closer": "The season reached its final weekend, the lights got mean, and you still cashed the card. No garbage-time tutorial. No next week. Just the door, the pressure, and you quietly turning the lock.",
        "elite_commish": "Fourteen weeks with the gavel: cards built, questions answered, degenerates located, and nobody successfully overthrew you. This is not the Creator’s crown. This is the scar tissue earned by actually running the room.",
        "egg_impossible": "There is no useful briefing. There is barely evidence. Whatever you did was so statistically rude that the achievement system replaced the explanation with question marks and went home early.",
        "egg_welcome_home": "Ten years in the room. Different seasons, same friends, newer knees, identical terrible confidence in a noon underdog. No points are needed here. Staying was the achievement.",
        "national_nightmare": "You named the national champion before the season finished and kept the receipt while everyone else produced context. Zero standings points. Infinite permission to become unbearable until next August.",
        "championship_ring": "Last one standing in the top half. The ring is engraved, the group chat is archived, and every lucky break has been legally reclassified as championship composure.",
        "toilet_crown": "You survived the bottom bracket and emerged wearing plumbing fixtures as royalty. Is it a championship? Technically. Will everyone respect it? Absolutely not. Wear the crown anyway.",
        "season_sovereign": "When the final music stopped, your name was still at the top. Ten weeks minimum, one season-long occupation, and enough total points to make every ‘I forgot to lock’ excuse sound even worse.",
        "unbreakable": "Twenty correct picks in a row. The shield has dents, the group has theories, and regression to the mean keeps leaving voicemails you refuse to return.",
        "dual_desk_legend": "You finished real campaigns on Saturday and Sunday. Two sports, two calendars, one exhausted brain. Not a tourist. Not a join-button collector. A fully certified dual-desk problem."
    ]

    private static let epic: [String: String] = [
        "war_room_general": "You owned the week. For seven glorious days, every bad opinion became strategy and every lucky bounce became leadership. Enjoy the throne before the next slate reminds everyone that power is temporary.",
        "sniper": "Fifteen straight against the spread. No spray, no prayer, no accidental ricochet off a noon kickoff. Just one cold click after another while the rest of the room slowly stopped offering advice.",
        "max_card": "You climbed the entire confidence ladder carrying live ammunition and somehow never stepped on the wrong rung. The card is maxed, the points are obscene, and the group chat has begun reviewing your browser history.",
        "perfect_saturday": "Every pick green. One entire Saturday without a single apology, hedge, or suspiciously late explanation. Screenshot it now—perfection has a very short lease in this building.",
        "seasoned_vet": "One thousand correct ATS picks. You have watched enough football to qualify as campus infrastructure and ignored enough family plans to earn tenure. The knees hurt. The opinions remain loud.",
        "villain_arc": "The same rival, beaten three weeks in a row. Once is football. Twice is a trend. Three times is when their children learn your name and the documentary switches to ominous music.",
        "crew_points_furnace": "You are feeding scorecards into an industrial furnace and heating the entire Crew with other people’s mistakes. The room stays together. The board catches fire. OSHA has declined jurisdiction.",
        "crew_multi_chapter": "Most group chats die after one season and a questionable trade argument. This Crew survived multiple finales, recycled the same grudges, and reported back for another chapter anyway. That is either loyalty or a failure to grow.",
        "six_seven": "A football game ended 6–7 and the internet immediately lost command of the English language. You were on the card when Sixxxxx Seveennnnn escaped containment. Winning the pick was optional. Witnessing history was not.",
        "six_pack_saturday": "The whole card came home green. Crack open the ceremonial six-pack—even if the slate only had five games, because arithmetic stopped mattering the moment you became perfect.",
        "confidence_king": "You did not merely assign confidence points. You placed a crown on every number, marched the ladder into hostile territory, and returned with sixteen or more points. Heavy is the head. Heavier is the group-chat ego.",
        "best_bet_assassin": "Eight Best Bets entered the red circle. Eight did not make it out. No speeches, no fingerprints, just a trail of little stars and several friends asking whether you know something they don’t.",
        "prop_overlord": "The side quest seized the throne. Eight props cashed, the tiny questions became imperial policy, and you now rule a kingdom built entirely from extremely specific nonsense.",
        "dog_whisperer": "Underdogs do not bark at you. They quietly explain the matchup, cover by half a point, and follow you home. The favorites call it luck because fear has many names.",
        "ten_streak_terror": "Ten correct picks without a miss. The streak is now large enough to have weather, gravity, and its own emergency response plan. Everyone nearby is pretending not to notice it.",
        "division_dominator": "You planted a flag at the top of the division and started charging rent. The border is closed, the standings are occupied, and every challenger is being redirected to the complaints department.",
        "comeback_kid": "Last week was evidence for the prosecution. This week you added eight or more points and kicked open the courtroom doors. Redemption achieved. Prior tape remains admissible.",
        "cut_line_killer": "The cut line came looking for a victim and found you holding the scissors. Top quarter secured. Air is cleaner up here, although the people below insist that is just your ego leaking.",
        "iron_card": "Fourteen weeks of showing up, locking in, and absorbing damage. Rain, weddings, bye weeks, bad beats—none of it moved you. The card is iron. Your Sunday availability is deeply concerning."
    ]

    private static let rare: [String: String] = [
        "neighborhood_creeper": "You opened Deep Stats on yourself and stared through the blinds at your own numbers. Nobody was spying on you. Somehow that makes this worse.",
        "crew_midseason_loyal": "Week 8 arrived and you were still in the room. The tourists left, the injury reports became novels, and somebody started saying ‘there’s a lot of football left’ with a straight face. You stayed. Loyalty or poor judgment—the anchor does not care.",
        "crew_dual_desk": "The same Crew opened a Saturday desk and a Sunday desk because one weekly collapse was no longer enough. College chaos on one channel. Professional disappointment on the other. Two helmets, one radio, absolutely no quiet weekends.",
        "crew_card_grinder": "Eight cards through the machine. Picks were mangled, confidence points became confetti, and yet your name kept appearing on the board. Talent is negotiable. Attendance has receipts.",
        "first_and_final": "First human to seal the full card, then disciplined enough to keep your nervous little fingers off it. No midnight tinkering. No weather-panic edit. You submitted evidence and refused to contaminate the scene.",
        "hot_hand": "Five straight winners and suddenly every casual thought feels like classified intelligence. The hand is glowing, the room is watching, and this is usually when a person decides to get creative. Do not get creative.",
        "clean_sheet": "A full card with no blood on it. Every selection survived, every excuse remained unused, and the weekly autopsy was canceled for lack of a body. Frame the sheet before football remembers who you are.",
        "parlay_pilot": "Five Best Bets boarded the aircraft. Five landed without becoming a federal incident. Your wings are temporary, your confidence is dangerous, and air-traffic control has asked you to stop calling the group chat ‘the tower.’",
        "underdog_believer": "Five times you looked at the smaller number, ignored the respectable choice, and followed the dog into traffic. Five times it came back carrying the points. The favorites are larger. The believer is louder.",
        "volume_shooter": "Fifty correct picks in one season. Accuracy matters, but so does creating a quantity of evidence too large for anyone to dismiss politely. The machine is overheating. The takes remain fully automatic.",
        "iron_lungs": "Six straight weeks without disappearing. You kept breathing through bad beats, late scratches, and at least one card that should have required medical supervision. The lungs are iron. The Saturdays are spoken for.",
        "hate_week_roll_call": "You saw five old grudges, picked all five, and politely moved the Thanksgiving gravy boat out of punching range. Attendance certified. Conflict initiated.",
        "rivalry_week": "You cashed a rivalry pick and the family group chat immediately became a restricted airspace. Notifications muted. Victory lap still visible from orbit.",
        "grudge_veteran": "Two different seasons, same irrational anger. The referee issued a restraining order, the rivalry ignored it, and your receipts have now been entered as repeat-offender evidence.",
        "dynasty_of_spite": "Three seasons of certified hate plus a Best Bet planted directly in enemy territory. The grudge is now hereditary. A crowned possum has been appointed executor of the estate.",
        "clutch_gene": "Seven Best Bets under pressure and the heart never flinched. Ice in the arteries, stars on the chest, and a pulse that somehow gets calmer when everyone else starts typing in all caps.",
        "cheevo_king": "You collected more achievement points than anyone in the room and the vault quietly produced a crown. Once claimed, it stays claimed. Future challengers may pass your total; they cannot erase the evidence that you got there first.",
        "let_them_cook": "You handed the entire card to a robot chef powered by random numbers and poor supervision. It seasoned nothing, respected no matchup, and doubled the consequences. Whatever comes out of that oven belongs to you.",
        "calendar_cosplayer": "You discovered the vault has a wardrobe department. One helmet, four seasonal identities, and permanent proof that you investigated decorations more carefully than at least one injury report.",
        "four_green_friday": "Four lamps went green before Saturday even finished stretching. You walked into the weekend carrying twelve points and the dangerous belief that the remaining games would behave themselves.",
        "sweep_adjacent": "One lousy mark survived the broom. The rest of the card is spotless, the evidence tray is full, and you are absolutely entitled to stare at the lone miss until it becomes personal.",
        "best_bet_banker": "Three stars deposited. Three stars cleared. The vault is not impressed by your financial metaphors, but it did accept the receipts and quietly raise your credit limit for irresponsible confidence.",
        "prop_prophet": "Five weekly side quests answered correctly through means the investigation has classified as ‘probably guessing.’ The orb is active. The visions are specific. None of this qualifies as responsible research.",
        "underdog_spree": "Three actual underdogs came home carrying points and absolutely no respect for the market. The kennel door is open. The chalk has begun checking under the bed.",
        "chalk_streak": "Five straight weeks of ten-plus points. The chalkboard is smoking, the erasers have unionized, and your safest opinions have become a public nuisance.",
        "division_climber": "Top three in the division. The ladder shook, somebody above you panicked, and you kept climbing with both hands full of receipts.",
        "leaderboard_lookin": "You reached the top half and immediately began staring upward like rent was due. Respectability achieved. Satisfaction remains unavailable.",
        "cut_line_escape": "The cut line snapped shut one spot behind you. No heroics, no margin, just a clean getaway while somebody else explains the math.",
        "bottom_of_the_barrel": "Sole possession of the weekly basement. No tie, no roommate, no plausible witness to blame. The barrel has your mail forwarded.",
        "ten_week_tenant": "Ten weekly cards and the room has stopped calling you a guest. Your name is on the lease. Your security deposit was lost to a noon kickoff.",
        "full_conference": "Points in eight separate weeks. You toured the whole conference, collected stamps, and left every campus with at least one bad opinion.",
        "road_dog": "Five road teams covered while everyone else begged for home cooking. The suitcase is dented, the bus smells terrible, and the points still traveled.",
        "home_cookin": "Five home teams covered and the kitchen is now serving confidence by the ladle. Visiting teams may use the side entrance.",
        "silence_the_room": "You posted the week’s high score while somebody else laid a zero. One side of the room became extremely quiet. The screenshot supplied the rest.",
        "fifty_club": "Fifty season points. The velvet rope is imaginary, the drinks are warm, and you are still telling everyone you made the list.",
        "century_club": "One hundred season points. Three digits on the board and suddenly every fortunate bounce is being described as veteran composure."
    ]

    private static let easterEgg: [String: String] = [
        "egg_anniversary": "One year of friendship, football, and aggressively documented bad judgment. The calendar remembered even if the standings did not.",
        "egg_curiosity_trophy": "You tapped the shiny thing because leaving mysteries alone has never been your strength. Curiosity survived. Dignity remains day-to-day.",
        "egg_vonnaggio_gold": "Family vacation achieved championship status through a ruling nobody outside the family understands. The medal is real enough for the group chat.",
        "egg_hidden_headline": "You found the story the editor buried where responsible readers would never look. Ink on your fingers. Nonsense in your bloodstream.",
        "egg_leap_day": "You opened the room on the calendar’s bonus square. Time itself gave you an extra day to make the same terrible pick.",
        "egg_birthday": "Another year older, allegedly wiser, and still assigning five confidence points to emotional attachment. Blow out the candles before kickoff.",
        "egg_lucky_seven": "Seven arrived wearing sunglasses and refusing to explain itself. Do not investigate luck. It becomes shy around paperwork.",
        "egg_obsession": "You checked often enough that the app considered filing a wellness report. The authorities were notified and immediately joined the league.",
        "egg_halloween": "The room put on a costume. Your picks were already frightening enough, but the seasonal commitment has been noted.",
        "egg_christmas": "A tiny holiday miracle: you opened the app instead of pretending to help in the kitchen. The candy cane has receipts.",
        "egg_thanksgiving": "Turkey, football, and one relative explaining why the spread is free money. The gravy boat knows how this ends.",
        "egg_newyear": "New year, new discipline, same five-point favorite selected entirely on vibes. Resolution officially broken before halftime.",
        "egg_three_peat": "Three in a row turned coincidence into dynasty propaganda. The commemorative documentary is already too long.",
        "egg_never_give_up": "The board tried to bury you. You kept returning with a shovel, a locked card, and absolutely no respect for the evidence.",
        "egg_developer_thanks": "You believed while the wires were exposed and the paint was wet. The builder noticed. The bug tracker also knows your name.",
        "egg_mascot_scout": "You located the creature in the margins. Film study calls it irrelevant. The mascot department calls it elite reconnaissance.",
        "egg_veterans": "The old guard walked back into the room carrying ancient grudges and passwords they nearly remembered. Stand at ease. The stories are starting again."
    ]

    private static let common: [String: String] = [
        "first_blood": "Your first pick entered the system. It may be brilliant. It may be evidence. Either way, the file is open.",
        "war_room_recruit": "A name has been attached to the damage. Welcome aboard, recruit. Orientation ended when you tapped Save.",
        "creator_checked_in": "The Creator appeared in your room and everybody received a tiny present. It is better than Christmas because nobody had to assemble it.",
        "lock_it_in": "The full card is sealed. Five opinions entered. Plausible deniability left through the emergency exit.",
        "on_the_board": "One ATS win. The scoreboard moved and your confidence immediately became disproportionate.",
        "chalk_eater": "Ten favorites survived your appetite. There is white dust everywhere and not one adventurous thought in sight.",
        "saturday_starter": "Your first Saturday slate is locked. Coffee ready. Television occupied. Family availability downgraded.",
        "green_light": "The first weekly points turned green. This is how the problem introduces itself.",
        "face_of_the_franchise": "You uploaded a face to go with the takes. Accountability has never looked so well cropped.",
        "gameday_ready": "Three weeks played. The warm-up period is over and the excuses are entering midseason form.",
        "streak_starter": "Three strong weeks in a row. Small enough to deny, large enough to mention without being asked.",
        "card_complete": "Every matchup picked, every confidence number used, every future complaint properly documented.",
        "prop_merchant": "One prop entered the ledger. The side hustle is open and the inventory is mostly opinions.",
        "best_bet_marked": "You placed a star beside one pick and asked it to carry twice the emotional weight.",
        "confidence_ladder": "One through five, neatly arranged from mild concern to nationally televised regret.",
        "division_dweller": "The league assigned you a neighborhood. Property values responded immediately.",
        "week_one_warrior": "You scored in an official week. The campaign ribbon is small because the season is not.",
        "two_week_tour": "You returned for a second week despite having access to the first week’s evidence.",
        "halfway_hangin": "Six weeks played and still attached to the season by both hands and one questionable Best Bet.",
        "double_digit_club": "Ten season points opened the velvet rope. The club is crowded and the dress code is confidence.",
        "push_happens": "The hook showed up at the last second and your side survived by half a point. Clean result. Maximum complaining.",
        "favorite_survivor": "Three favorites covered without stepping on a rake. Conservative does not mean painless.",
        "dog_day_afternoon": "Your first real underdog covered. Somewhere, a tiny helmeted mutt just learned your name.",
        "spread_survivor": "One pick escaped the number alive. Do not confuse survival with control of the situation.",
        "multi_game_monday": "Six points made it through the weekend. Monday arrived with fewer apologies than usual.",
        "three_pack": "Nine weekly points bundled together and carried out before the slate could ask questions.",
        "locker_lurker": "You finally posted in the Locker Room. Surveillance has been upgraded to participation.",
        "news_reader": "You opened the announcement instead of asking the commissioner what it said. Literacy ribbon awarded.",
        "board_watcher": "You checked the standings. It was research when you moved up and obsession when you moved down.",
        "rules_skimmer": "You opened the rules and moved your eyes across several of the words. Legal considers this sufficient.",
        "crystal_gazed": "You predicted the future before the future had a chance to object. The orb kept the receipt.",
        "profile_peeker": "You inspected another player’s dossier for competitive reasons that looked exactly like snooping.",
        "late_night_lock": "The card was sealed after 10 p.m., when judgment gets sleepy and underdogs begin making persuasive speeches.",
        "rematch_ready": "Two consecutive weeks submitted. The first beating apparently created questions instead of answers.",
        "bare_minimum_dual": "You joined two sports and achieved the absolute minimum definition of versatility. Saturday met Sunday. Neither accepted responsibility."
        ,"keys_to_the_war_room": "Somebody handed you the keys, which is concerning because the room contains live spreads, sharp objects, and adults with notifications enabled."
        ,"open_for_business": "The doors are open, the neon sign is buzzing, and complete strangers may now judge your room name before judging your picks."
        ,"the_velvet_rope": "The room is visible, the rope is up, and the commissioner has begun practicing the phrase ‘we will review your application.’"
        ,"walk_in_warrior": "No invitation. No escort. You walked straight through the Lobby and claimed a chair before anyone could check the guest list."
        ,"knock_knock": "You knocked on a private room carrying nothing but optimism and a profile picture. Security has been notified."
        ,"welcome_to_the_party": "You approved a new recruit and expanded the number of people who can screenshot your worst takes. Leadership."
        ,"favorite_child": "One team received the little blue star. Every future decision involving them is now officially compromised."
        ,"ride_with_mine": "Your favorite team made the card and you climbed aboard. Seat belts are optional; emotional damage is standard."
        ,"tough_love": "You looked your favorite team directly in the logo and faded them. Loyalty survived. Trust did not."
        ,"early_bird_special": "The card was locked a full day early. Either this is preparation or you desperately needed to stop tinkering."
        ,"no_takebacks": "First instincts entered the vault untouched. The evidence suggests discipline. Your friends suspect the app froze."
        ,"second_thoughts": "A pick changed before lock. Film was reviewed, panic was respected, and the original opinion was quietly relocated."
        ,"top_shelf_pick": "Five confidence points went on the highest shelf and came back alive. Please refrain from calling it a system."
        ,"the_little_engine": "The tiny one-point pick climbed the hill, cashed the ticket, and immediately demanded locomotive-sized respect."
        ,"best_bet_baby": "Your first Best Bet hit. A small star was born and has already requested a larger trailer."
        ,"prop_me_up": "The side quest paid. One prop stood upright long enough for you to claim this was the plan."
        ,"home_cooking_card": "Five home teams, one card, and enough home cooking to trigger a grease inspection."
        ,"road_snacks": "Five NFL road teams packed a bag. Sunday now smells like gas-station pretzels and unreasonable confidence."
        ,"dog_tag": "You put one underdog on the card and issued it a tiny metal tag. If found, return with points."
        ,"chalk_dust": "Three favorites entered. The card is covered in white dust and smells faintly of responsible decision-making."
        ,"split_decision": "Three NFL wins, two losses, and a Sunday judges’ card declaring you technically competent."
        ,"lone_wolf": "The whole room went one way. You went the other and returned howling with the receipt."
        ,"photo_finish": "Half an NFL point separated genius from public humiliation. Fortunately, the camera caught your good side."
        ,"thursday_night_shift": "You punched the NFL clock on Thursday night and left with points before the weekend even found its pants."
        ,"saturday_detention": "The CFB slate ran late, you stayed after class, and the final exam was apparently against the spread."
        ,"nfl_first_down": "The chains moved once. The drive is alive and your offensive coordinator is already taking too much credit."
        ,"nfl_sunday_service": "Five NFL picks entered the sanctuary. Please rise, silence your phones, and fade responsibly."
        ,"nfl_monday_night_closer": "The entire week came down to Monday night and you shut the door with the confidence of a backup safety celebrating an overthrow."
        ,"nfl_red_zone_regular": "Three NFL picks crossed the stripe. The red-zone channel has begun charging you rent."
        ,"nfl_primetime_personnel": "The lights got brighter, the commercials got longer, and your pick somehow survived national television."
        ,"nfl_division_business": "Familiar enemies handled familiar business while you quietly billed the points to the correct department."
        ,"nfl_wild_card_applicant": "Your postseason paperwork has been received. References were not contacted because none of them trust your bracket."
        ,"nfl_jdam_trainee": "One JDAM left the rack. The target may be questionable, but the paperwork is devastatingly complete."
        ,"nfl_conference_caller": "You called one conference champion before the confetti did. The losing voicemail has been deleted."
        ,"nfl_super_sunday": "A Super Bowl winner is locked. The snacks are staged and the future apology has been prewritten."
        ,"fieldhouse_tip_off": "The ball went up, your first Fieldhouse opinion went in, and the hardwood immediately requested liability protection."
        ,"fieldhouse_full_court_press": "A complete Fieldhouse card is applying pressure from baseline to bad decision. No easy inbound passes remain."
        ,"fieldhouse_buzzer_beater": "Half a point fell through the net as time expired. Please stop reenacting the shot in the kitchen."
        ,"fieldhouse_chalk_in_the_paint": "Three favorites clogged the lane. The paint is full of chalk, elbows, and sensible expectations."
        ,"fieldhouse_bracket_curious": "You opened the bracket just to look. Forty-seven minutes later you were researching a twelve seed’s bench depth."
        ,"fieldhouse_first_four_foreman": "The opening games are framed, inspected, and somehow already threatening the rest of your bracket."
        ,"fieldhouse_cinderella_scout": "You found the glass slipper before the broadcast crew learned the mascot’s name."
        ,"fieldhouse_marching_orders": "The bracket is submitted. Sixty-three future arguments now have assigned positions."
        ,"fieldhouse_hardwood_homer": "Your favorite team took the floor and your objectivity was escorted from the Fieldhouse."
        ,"fieldhouse_net_result": "Your first Fieldhouse winner found nylon. One basket of confidence is now dangerously full."
        ,"cfb_saturday_school": "Your first CFB pick is enrolled. Tuition was paid entirely in confidence and parking remains impossible."
        ,"cfb_tailgate_certified": "The card is locked, the grill is lit, and somebody has begun explaining why eleven in the morning is not too early."
        ,"cfb_ranked_and_dangerous": "Two ranked teams entered the poll-shaped cage. Your pick left with the number still attached."
        ,"cfb_upset_alert": "The underdog toppled a ranked opponent and every television graphic started flashing on your behalf."
        ,"cfb_noon_whistle": "The early window cashed before half the country found the remote. Breakfast points count exactly the same."
        ,"cfb_after_dark": "The campus lights came on, normal football clock behavior disappeared, and your late-night pick survived the fog."
        ,"cfb_grudge_match": "Two schools brought a century of resentment. You brought one correct side and absolutely no interest in reconciliation."
        ,"cfb_title_game_tourist": "You arrived at Conference Championship weekend wearing neutral colors and carrying highly non-neutral opinions."
        ,"cfb_bowl_curious": "You opened the Bowl Board just to look and somehow formed an opinion about a sponsor you have never heard of."
        ,"cfb_bowl_bound": "The entire Bowl Board is locked. Luggage packed, confidence allocated, December productivity officially canceled."
    ]
}
