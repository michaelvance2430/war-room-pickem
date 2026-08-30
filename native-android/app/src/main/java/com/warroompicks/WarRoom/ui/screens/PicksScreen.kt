package com.warroompicks.WarRoom.ui.screens

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.warroompicks.WarRoom.AppState
import com.warroompicks.WarRoom.model.*
import com.warroompicks.WarRoom.ui.components.WarBackdrop
import com.warroompicks.WarRoom.ui.components.WarHeader
import com.warroompicks.WarRoom.ui.theme.*
import java.util.UUID

@Composable
fun PicksScreen(
    state: AppState,
    lockPicks: (List<GameSelection>, UUID?, String?) -> Unit,
    lockNflPostseason: (Map<String, String>, Boolean) -> Unit,
    lockCfbBowl: (Map<String, String>, Map<String, Int>, Boolean) -> Unit,
    lockCfbPlayoff: (Map<String, String>) -> Unit,
    publishNflPostseason: (List<NflPostseasonTeam>) -> Unit,
    saveNflPostseasonResults: (Map<String, String>) -> Unit,
    publishCfbPostseason: (List<CfbBowlGame>, List<String>) -> Unit,
    saveCfbPostseasonResults: (Map<String, String>, Map<String, String>) -> Unit,
) {
    val league = state.league ?: return
    if (league.sport == Sport.NFL && league.currentWeek >= 19) {
        NflPostseasonScreen(state, lockNflPostseason, publishNflPostseason, saveNflPostseasonResults)
        return
    }
    if (league.sport == Sport.CFB && league.currentWeek >= league.regularSeasonWeeks + 2) {
        CfbPostseasonScreen(state, lockCfbBowl, lockCfbPlayoff, publishCfbPostseason, saveCfbPostseasonResults)
        return
    }
    val card = state.card
    val accent = if (league.sport == Sport.NFL) NflCyan else WarGreen
    var sides by remember(card?.id) { mutableStateOf<Map<UUID, String>>(emptyMap()) }
    var confidence by remember(card?.id) { mutableStateOf<Map<UUID, Int>>(emptyMap()) }
    var bestBet by remember(card?.id) { mutableStateOf<UUID?>(null) }
    var prop by remember(card?.id) { mutableStateOf<String?>(null) }
    var confirming by remember(card?.id) { mutableStateOf(false) }
    val used = confidence.values.toSet()
    val lockedPick = state.currentPick?.takeIf { it.lockedAt != null }

    WarBackdrop(league.sport) {
        LazyColumn(contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { WarHeader(if (league.sport == Sport.NFL) "SUNDAY DECISION DESK" else "SATURDAY DECISION DESK", "MAKE YOUR PICKS", "Everything begins blank. Confirm every decision.", league.sport) }
            if (card == null) {
                item { Text("The commissioner has not published this week's card.", color = Color.White) }
            } else if (lockedPick != null) {
                item {
                    Surface(color = PanelBlack, shape = RoundedCornerShape(13.dp), modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(18.dp)) {
                            Text("CARD LOCKED", color = accent, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                            Text("${lockedPick.totalPoints ?: 0} POINTS", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Black)
                            Text("Your weekly scorecard updates as official results arrive.", color = Muted)
                        }
                    }
                }
                itemsIndexed(state.games, key = { _, game -> game.id }) { index, game ->
                    val selection = lockedPick.selections.firstOrNull { it.gameId == game.id }
                    val team = if (selection?.side == "away") game.awayTeam else game.homeTeam
                    Surface(color = PanelBlack, shape = RoundedCornerShape(10.dp)) {
                        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("${index + 1}", color = accent, fontWeight = FontWeight.Black, modifier = Modifier.width(30.dp))
                            Text(team, color = Color.White, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                            if (lockedPick.bestBetGameId == game.id) Text("★ ", color = WarYellow)
                            Text("${selection?.confidence ?: 0} PTS", color = accent, fontWeight = FontWeight.Black)
                        }
                        if (game.homeScore != null || game.awayScore != null) {
                            Text(
                                "${game.awayTeam} ${game.awayScore ?: 0}  ·  ${game.homeTeam} ${game.homeScore ?: 0}${if (game.final) "  FINAL" else "  LIVE"}",
                                color = if (game.final) Muted else WarGreen,
                                fontSize = 10.sp, fontWeight = FontWeight.Black,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 5.dp),
                            )
                        }
                    }
                }
            } else {
                itemsIndexed(state.games, key = { _, game -> game.id }) { index, game ->
                    Surface(color = PanelBlack, shape = RoundedCornerShape(13.dp), modifier = Modifier.fillMaxWidth().border(1.dp, accent.copy(alpha = .35f), RoundedCornerShape(13.dp))) {
                        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("DECISION ${index + 1}", color = accent, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                sideButton(game.awayTeam, sides[game.id] == "away", Modifier.weight(1f), accent) { sides = sides + (game.id to "away") }
                                sideButton(game.homeTeam, sides[game.id] == "home", Modifier.weight(1f), accent) { sides = sides + (game.id to "home") }
                            }
                            Text(spreadLine(game), color = Muted, fontSize = 11.sp)
                            Text("CONFIDENCE", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                state.games.indices.map { it + 1 }.forEach { value ->
                                    val chosenHere = confidence[game.id] == value
                                    val unavailable = value in used && !chosenHere
                                    FilterChip(
                                        selected = chosenHere,
                                        enabled = !unavailable,
                                        onClick = { confidence = if (chosenHere) confidence - game.id else confidence + (game.id to value) },
                                        label = { Text("$value") },
                                    )
                                }
                            }
                            Row(
                                Modifier.fillMaxWidth().clickable { bestBet = if (bestBet == game.id) null else game.id }.padding(vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Default.Star, null, tint = if (bestBet == game.id) WarYellow else Muted)
                                Spacer(Modifier.width(8.dp))
                                Text(if (bestBet == game.id) "BEST BET SELECTED" else "MAKE THIS MY BEST BET", color = if (bestBet == game.id) WarYellow else Color.White, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                }
                card.propQuestion?.let { question ->
                    item {
                        Surface(color = PanelBlack, shape = RoundedCornerShape(13.dp)) {
                            Column(Modifier.padding(15.dp)) {
                                Text("PROP ORDER", color = WarYellow, fontWeight = FontWeight.Black)
                                Text(question, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf("A", "B").forEach { answer ->
                                        FilterChip(selected = prop == answer, onClick = { prop = if (prop == answer) null else answer }, label = { Text(answer) })
                                    }
                                }
                            }
                        }
                    }
                }
                item {
                    Button(
                        onClick = { confirming = true },
                        enabled = !state.busy,
                        modifier = Modifier.fillMaxWidth().height(58.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = Color.Black),
                    ) { Text("REVIEW & LOCK CARD", fontWeight = FontWeight.Black) }
                    Text("This cannot be undone after confirmation.", color = Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }
    }
    if (confirming && lockedPick == null) {
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text("LOCK WEEK ${card?.week}?") },
            text = { Text("Review complete. Once confirmed, this card cannot be undone after the lock deadline.") },
            dismissButton = { TextButton(onClick = { confirming = false }) { Text("GO BACK") } },
            confirmButton = {
                Button(onClick = {
                    confirming = false
                    lockPicks(state.games.mapNotNull { game -> sides[game.id]?.let { GameSelection(game.id, it, confidence[game.id]) } }, bestBet, prop)
                }) { Text("CONFIRM & LOCK", fontWeight = FontWeight.Black) }
            },
        )
    }
}

@Composable
private fun sideButton(name: String, selected: Boolean, modifier: Modifier, accent: Color, onClick: () -> Unit) {
    Surface(onClick = onClick, modifier = modifier, color = if (selected) accent else Color.White.copy(alpha = .07f), shape = RoundedCornerShape(8.dp)) {
        Text(name, color = if (selected) Color.Black else Color.White, fontWeight = FontWeight.Black, modifier = Modifier.padding(13.dp), maxLines = 2)
    }
}

private fun spreadLine(game: CardGame): String = game.favorite?.let { "$it ${if (game.spread > 0) "+" else ""}${game.spread}" } ?: "Spread pending"
