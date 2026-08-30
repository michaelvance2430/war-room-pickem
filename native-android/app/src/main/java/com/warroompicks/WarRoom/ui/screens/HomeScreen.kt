package com.warroompicks.WarRoom.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.warroompicks.WarRoom.AppState
import com.warroompicks.WarRoom.model.League
import com.warroompicks.WarRoom.model.Sport
import com.warroompicks.WarRoom.ui.components.*
import com.warroompicks.WarRoom.ui.theme.*
import java.time.Duration
import java.time.Instant

@Composable
fun HomeScreen(state: AppState, selectLeague: (League) -> Unit, openPicks: () -> Unit) {
    val league = state.league ?: return
    var switchOpen by remember { mutableStateOf(false) }
    val identity = if (league.sport == Sport.NFL) "SUNDAY COMMAND" else "SATURDAY SITUATION ROOM"
    val accent = if (league.sport == Sport.NFL) NflCyan else WarGreen
    WarBackdrop(league.sport) {
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                WarHeader("WAR ROOM // LIVE", league.name, "${league.sport.id.uppercase()} / WEEK ${league.currentWeek}", league.sport)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(identity, color = accent, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp, modifier = Modifier.weight(1f))
                    AssistChip(onClick = { switchOpen = !switchOpen }, label = { Text("SWITCH") }, trailingIcon = { Icon(Icons.Default.ExpandMore, null) })
                }
            }
            if (switchOpen) {
                Sport.entries.forEach { sport ->
                    val leagues = state.leagues.filter { it.sport == sport }
                    if (leagues.isNotEmpty()) {
                        item { Text(sport.id.uppercase(), color = if (sport == Sport.NFL) NflCyan else WarYellow, fontWeight = FontWeight.Black, letterSpacing = 2.sp) }
                        items(leagues) { candidate ->
                            CommandPanel("ACTIVE FREQUENCY", candidate.name, "Week ${candidate.currentWeek} · Tap to enter", sport, onClick = { switchOpen = false; selectLeague(candidate) })
                        }
                    }
                }
            }
            item {
                val card = state.card
                when {
                    card == null -> EmptyCommand("The board is dark", "The commissioner has not published Week ${league.currentWeek}.", league.sport)
                    card.locksAt?.isAfter(Instant.now()) == true -> CommandPanel(
                        "CARD IS LIVE", "Week ${card.week} is ready", lockCountdown(card.locksAt), league.sport, onClick = openPicks,
                    )
                    else -> CommandPanel("THE BOARD", "Week ${card.week} scorecard", "Live game scores and your points update here.", league.sport, onClick = openPicks)
                }
            }
            item {
                CommandPanel(
                    if (league.isCommissioner(state.session!!.userId)) "COMMISSIONER VIEW" else "LEAGUE STATUS",
                    "${state.standings.size} players on frequency",
                    if (league.isCommissioner(state.session.userId)) "Manage the card, announcements, trophy and league operations." else "Standings and official league dispatches are live.",
                    league.sport,
                )
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    statusCell("${state.games.size}", "ON SLATE", accent, Modifier.weight(1f))
                    statusCell("${state.standings.size}", "PLAYERS", accent, Modifier.weight(1f))
                    statusCell("${state.messages.size}", "MESSAGES", accent, Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun statusCell(value: String, label: String, accent: Color, modifier: Modifier) {
    Surface(modifier, color = Color.Black.copy(alpha = .82f), shape = MaterialTheme.shapes.small) {
        Column(Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Black)
            Text(label, color = accent, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
        }
    }
}

private fun lockCountdown(lock: Instant): String {
    val seconds = Duration.between(Instant.now(), lock).seconds.coerceAtLeast(0)
    val days = seconds / 86_400
    val hours = seconds % 86_400 / 3_600
    val minutes = seconds % 3_600 / 60
    return "SHOT CLOCK · ${days}d ${hours}h ${minutes}m until the first kickoff"
}
