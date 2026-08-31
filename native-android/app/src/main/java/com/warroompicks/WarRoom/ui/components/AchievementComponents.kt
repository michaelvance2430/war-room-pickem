package com.warroompicks.WarRoom.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.warroompicks.WarRoom.model.Achievement
import com.warroompicks.WarRoom.ui.theme.WarGreen

private enum class AchievementRarity(val label: String, val color: Color, val points: Int) {
    Common("COMMON", WarGreen, 10), Rare("RARE", Color(0xFF28C7E8), 25),
    Epic("EPIC", Color(0xFFB66CFF), 50), Legendary("LEGENDARY", Color(0xFFFFD83D), 200),
}

private val legendaryCodes = setOf("the_commissioner", "war_room_legend", "worlds_greatest_cavalry_scout", "the_dr", "house_dragon_legendary", "hodor_of_hodors", "two_wolves_of_prestige", "built_different_olympian", "the_816_archivist", "immortal_streak", "the_closer", "elite_commish", "egg_impossible", "egg_welcome_home", "national_nightmare", "championship_ring", "toilet_crown", "season_sovereign", "unbreakable", "dual_desk_legend", "dynasty_of_spite")
private val epicCodes = setOf("sniper", "max_card", "perfect_saturday", "seasoned_vet", "villain_arc", "war_room_general", "crew_points_furnace", "crew_multi_chapter", "six_seven", "egg_obsession", "egg_three_peat", "egg_never_give_up", "egg_veterans", "six_pack_saturday", "confidence_king", "best_bet_assassin", "prop_overlord", "dog_whisperer", "ten_streak_terror", "division_dominator", "comeback_kid", "cut_line_killer", "iron_card", "grudge_veteran")
private val rareCodes = setOf("crew_midseason_loyal", "crew_dual_desk", "crew_card_grinder", "neighborhood_creeper", "egg_anniversary", "egg_curiosity_trophy", "egg_vonnaggio_gold", "egg_hidden_headline", "egg_leap_day", "egg_birthday", "egg_lucky_seven", "egg_halloween", "egg_christmas", "egg_thanksgiving", "egg_newyear", "egg_developer_thanks", "egg_mascot_scout", "first_and_final", "hot_hand", "clean_sheet", "parlay_pilot", "underdog_believer", "volume_shooter", "iron_lungs", "rivalry_week", "clutch_gene", "cheevo_king", "let_them_cook", "calendar_cosplayer", "four_green_friday", "sweep_adjacent", "best_bet_banker", "prop_prophet", "underdog_spree", "chalk_streak", "division_climber", "leaderboard_lookin", "cut_line_escape", "bottom_of_the_barrel", "ten_week_tenant", "full_conference", "road_dog", "home_cookin", "silence_the_room", "fifty_club", "century_club")

private fun achievementRarity(code: String): AchievementRarity = when (code.lowercase()) {
    in legendaryCodes -> AchievementRarity.Legendary
    in epicCodes -> AchievementRarity.Epic
    in rareCodes -> AchievementRarity.Rare
    else -> AchievementRarity.Common
}

private fun achievementIcon(code: String): ImageVector = when (code.lowercase()) {
    "first_blood" -> Icons.Default.Bloodtype
    "war_room_recruit" -> Icons.Default.MilitaryTech
    "creator_checked_in" -> Icons.Default.CardGiftcard
    "lock_it_in", "no_takebacks" -> Icons.Default.Lock
    "on_the_board" -> Icons.Default.Leaderboard
    "chalk_eater", "chalk_dust" -> Icons.Default.SportsFootball
    "saturday_starter", "week_one_warrior" -> Icons.Default.CalendarMonth
    "green_light" -> Icons.Default.Traffic
    "face_of_the_franchise", "profile_peeker" -> Icons.Default.AccountCircle
    "gameday_ready" -> Icons.Default.Backpack
    "streak_starter" -> Icons.Default.LocalFireDepartment
    "card_complete" -> Icons.Default.FactCheck
    "prop_merchant", "prop_me_up" -> Icons.Default.ReceiptLong
    "best_bet_marked", "best_bet_baby" -> Icons.Default.Star
    "confidence_ladder" -> Icons.Default.BarChart
    "division_dweller" -> Icons.Default.Home
    "two_week_tour", "bare_minimum_dual" -> Icons.Default.Filter2
    "halfway_hangin" -> Icons.Default.Timelapse
    "double_digit_club" -> Icons.Default.LooksTwo
    "push_happens", "split_decision" -> Icons.Default.CompareArrows
    "favorite_survivor" -> Icons.Default.Security
    "dog_day_afternoon", "dog_tag" -> Icons.Default.Pets
    "spread_survivor" -> Icons.Default.Straighten
    "multi_game_monday", "late_night_lock" -> Icons.Default.NightsStay
    "three_pack" -> Icons.Default.Filter3
    "locker_lurker" -> Icons.Default.Visibility
    "news_reader" -> Icons.Default.Newspaper
    "board_watcher" -> Icons.Default.Visibility
    "rules_skimmer" -> Icons.Default.MenuBook
    "crystal_gazed" -> Icons.Default.AutoAwesome
    "rematch_ready", "second_thoughts" -> Icons.Default.Replay
    "keys_to_the_war_room" -> Icons.Default.Key
    "open_for_business" -> Icons.Default.DoorFront
    "walk_in_warrior" -> Icons.Default.DirectionsWalk
    "knock_knock" -> Icons.Default.PanTool
    "welcome_to_the_party" -> Icons.Default.Celebration
    "favorite_child", "ride_with_mine" -> Icons.Default.Favorite
    "tough_love" -> Icons.Default.HeartBroken
    "early_bird_special" -> Icons.Default.WbSunny
    "top_shelf_pick" -> Icons.Default.Looks5
    "the_little_engine" -> Icons.Default.Train
    "home_cooking_card" -> Icons.Default.Restaurant
    "road_snacks" -> Icons.Default.DirectionsCar
    else -> Icons.Default.WorkspacePremium
}

fun achievementPoints(code: String): Int = when {
    code.lowercase().startsWith("egg_") -> 0
    code.equals("the_creator", true) -> 200
    code.equals("elite_commish", true) -> 150
    else -> achievementRarity(code).points
}

@Composable
fun AchievementArtifact(achievement: Achievement, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    val rarity = achievementRarity(achievement.code)
    val accent = rarity.color
    val action = if (onClick == null) modifier else modifier.clickable(onClick = onClick)
    Column(
        action
            .background(Brush.verticalGradient(listOf(Color(0xFF122317), Color.Black)), RoundedCornerShape(18.dp))
            .border(1.dp, accent.copy(alpha = .48f), RoundedCornerShape(18.dp))
            .padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Box(
            Modifier.fillMaxWidth().aspectRatio(1f)
                .background(Brush.radialGradient(listOf(accent.copy(alpha = .34f), Color(0xFF050706))), RoundedCornerShape(16.dp))
                .border(1.dp, accent.copy(alpha = .65f), RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier.fillMaxSize(.58f).background(Color.Black.copy(alpha = .62f), CircleShape)
                    .border(3.dp, accent, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(achievementIcon(achievement.code), null, tint = accent, modifier = Modifier.fillMaxSize(.55f))
            }
            Text("${rarity.label} // ${achievement.code.replace('_', ' ').uppercase()}", color = accent, fontSize = 8.sp, fontWeight = FontWeight.Black, modifier = Modifier.align(Alignment.TopStart).padding(10.dp), maxLines = 1)
            Text("✓ PERMANENT RECORD", color = accent, fontSize = 8.sp, fontWeight = FontWeight.Black, modifier = Modifier.align(Alignment.BottomStart).padding(10.dp))
        }
        Text(achievement.title.uppercase(), color = Color.White, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, maxLines = 2)
        Text("${achievementPoints(achievement.code)} PROMOTION POINTS", color = accent, fontSize = 9.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
fun AchievementDetail(achievement: Achievement, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(color = Color(0xFF050706), shape = RoundedCornerShape(24.dp), border = androidx.compose.foundation.BorderStroke(1.dp, WarGreen.copy(alpha = .6f))) {
            Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("SECURED PERSONNEL RECORD", color = WarGreen, fontSize = 9.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                    IconButton(onClick = onDismiss) { Icon(Icons.Default.Close, "Close achievement", tint = Color.White) }
                }
                AchievementArtifact(achievement, Modifier.fillMaxWidth())
                Text("ACHIEVEMENT UNLOCKED", color = WarGreen, fontSize = 10.sp, fontWeight = FontWeight.Black)
                Text(achievement.flavor, color = Color.White.copy(alpha = .72f), textAlign = TextAlign.Center, fontWeight = FontWeight.SemiBold)
                Text("PERMANENT RECORD SAVED", color = WarGreen, fontSize = 10.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}
