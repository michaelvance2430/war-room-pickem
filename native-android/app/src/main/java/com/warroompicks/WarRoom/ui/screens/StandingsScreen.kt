package com.warroompicks.WarRoom.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
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
                    Text(division.uppercase(), color = accent, fontWeight = FontWeight.Black, letterSpacing = 2.sp, modifier = Modifier.padding(top = 10.dp, bottom = 3.dp))
                }
                itemsIndexed(players, key = { _, player -> player.userId }) { index, player ->
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
                    if (state.standings.size > 32) {
                        when {
                            players.size == 8 && index + 1 == 4 -> CutLine("CHAMPIONSHIP ABOVE · TOILET BOWL BELOW", accent)
                            index + 1 == 4 -> CutLine("CHAMPIONSHIP CUT", accent)
                            index + 1 == players.size - 4 -> CutLine("TOILET BOWL CUT", Color(0xFFB56CFF))
                        }
                    }
                }
            }
        }
    }
}

@Composable private fun CutLine(label: String, color: Color) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        HorizontalDivider(Modifier.weight(1f), color = color)
        Text(label, color = color, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = .7.sp, modifier = Modifier.padding(horizontal = 8.dp))
        HorizontalDivider(Modifier.weight(1f), color = color)
    }
}

private fun formatPoints(value: Double) = if (value % 1.0 == 0.0) value.toInt().toString() else "%.1f".format(value)
