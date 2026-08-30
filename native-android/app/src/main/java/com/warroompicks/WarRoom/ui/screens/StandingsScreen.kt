package com.warroompicks.WarRoom.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.warroompicks.WarRoom.AppState
import com.warroompicks.WarRoom.model.Sport
import com.warroompicks.WarRoom.ui.components.WarBackdrop
import com.warroompicks.WarRoom.ui.components.WarHeader
import com.warroompicks.WarRoom.ui.components.PlayerAvatar
import com.warroompicks.WarRoom.ui.theme.*

@Composable
fun StandingsScreen(state: AppState) {
    val league = state.league ?: return
    val accent = if (league.sport == Sport.NFL) NflCyan else WarGreen
    WarBackdrop(league.sport) {
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            item { WarHeader(if (league.sport == Sport.NFL) "SUNDAY POWER INDEX" else "PERMANENT RECORD", if (league.sport == Sport.NFL) "THE LEAGUE TABLE" else "HALL OF RECKONING", "Live totals refresh while the games are being played.", league.sport) }
            val grouped = state.standings.groupBy { it.division ?: "Unassigned" }
            grouped.forEach { (division, players) ->
                item {
                    Text(divisionLabel(league.sport, division), color = accent, fontWeight = FontWeight.Black, letterSpacing = 2.sp, modifier = Modifier.padding(top = 10.dp, bottom = 3.dp))
                }
                items(players, key = { it.userId }) { player ->
                    Surface(color = PanelBlack, shape = MaterialTheme.shapes.medium) {
                        Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("${player.rank}", color = accent, fontSize = 22.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(38.dp))
                            PlayerAvatar(player.displayName, player.avatarUrl, accent)
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(player.displayName, color = Color.White, fontWeight = FontWeight.Black)
                                player.favoriteTeam?.let { Text(it, color = Muted, fontSize = 10.sp) }
                            }
                            Text(formatPoints(player.points), color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Black)
                            Text(" PTS", color = accent, fontSize = 8.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
    }
}

private fun divisionLabel(sport: Sport, value: String): String = when (sport) {
    Sport.NFL -> when (value.lowercase()) { "north" -> "AFC EAST"; "south" -> "AFC WEST"; "east" -> "NFC EAST"; "west" -> "NFC WEST"; else -> value.uppercase() }
    Sport.CFB -> when (value.lowercase()) { "north" -> "SEC"; "south" -> "BIG TEN"; "east" -> "ACC"; "west" -> "BIG 12"; else -> value.uppercase() }
}

private fun formatPoints(value: Double) = if (value % 1.0 == 0.0) value.toInt().toString() else "%.1f".format(value)
