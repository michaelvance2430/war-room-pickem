package com.warroompicks.WarRoom.ui.screens

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
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

@Composable
fun CfbPostseasonScreen(state: AppState, lockBowl: (Map<String, String>, Map<String, Int>, Boolean) -> Unit, lockCfp: (Map<String, String>) -> Unit) {
    val slate = state.cfbPostseasonSlate
    val entry = state.cfbPostseasonEntry
    var page by remember { mutableStateOf("bowl") }
    var tier by remember { mutableStateOf(CfbBowlTier.MARQUEE) }
    var bowlPicks by remember(entry?.bowlLockedAt, slate?.seasonKey) { mutableStateOf(entry?.bowlPicks.orEmpty()) }
    var allocations by remember(entry?.bowlLockedAt, slate?.seasonKey) {
        mutableStateOf(entry?.bowlAllocations?.takeIf { it.isNotEmpty() } ?: slate?.bowlGames?.associate { it.id to 4 }.orEmpty())
    }
    var cfpPicks by remember(entry?.cfpLockedAt, slate?.seasonKey) { mutableStateOf(entry?.cfpPicks.orEmpty()) }
    var confirmBowl by remember { mutableStateOf(false) }
    var confirmDeadHand by remember { mutableStateOf(false) }
    var confirmCfp by remember { mutableStateOf(false) }
    val bowlLocked = entry?.bowlLockedAt != null
    val cfpLocked = entry?.cfpLockedAt != null
    val allocated = allocations.values.sum()
    val bowlReady = slate != null && bowlPicks.size == slate.bowlGames.size && allocations.keys == bowlPicks.keys && allocated == 100 && allocations.values.all { it > 0 }
    val cfpGames = CfbBracketEngine.games(slate?.cfpSeeds.orEmpty(), cfpPicks)
    val cfpReady = CfbBracketEngine.order.all { cfpPicks[it] != null }

    WarBackdrop(Sport.CFB) {
        LazyColumn(contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { WarHeader("PHASE III · POSTSEASON", if (page == "bowl") "BOWL MANIA" else "ROAD THROUGH THE CFP", if (page == "bowl") "25 bowls · 100 confidence points · one permanent board" else "12 teams · 11 games · no reseeding", Sport.CFB) }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(page == "bowl", { page = "bowl" }, { Text("BOWL MANIA") }, modifier = Modifier.weight(1f))
                    FilterChip(page == "cfp", { page = "cfp" }, { Text("12-TEAM CFP") }, modifier = Modifier.weight(1f))
                }
            }
            if (slate == null) {
                item { cfbPanel("THE FIELD IS NOT OFFICIAL YET", "The commissioner must publish the 25 bowl matchups and official 12-team CFP field.", WarYellow) }
            } else if (page == "bowl") {
                entry?.bowlScore?.let { item { cfbPanel("BOWL MANIA FINAL", "$it POINTS · permanent postseason receipt", WarYellow) } }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        metric("ALLOCATED", "$allocated", Modifier.weight(1f)); metric("REMAINING", "${100 - allocated}", Modifier.weight(1f)); metric("PICKS", "${bowlPicks.size}/25", Modifier.weight(1f))
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(tier == CfbBowlTier.MARQUEE, { tier = CfbBowlTier.MARQUEE }, { Text("MARQUEE 15") }, modifier = Modifier.weight(1f))
                        FilterChip(tier == CfbBowlTier.SICKO, { tier = CfbBowlTier.SICKO }, { Text("SICKO 10") }, modifier = Modifier.weight(1f))
                    }
                }
                items(slate.bowlGames.filter { it.tier == tier }, key = { it.id }) { game ->
                    BowlCard(game, bowlPicks[game.id], allocations[game.id] ?: 0, 100 - allocated, bowlLocked,
                        choose = { bowlPicks = bowlPicks + (game.id to it) },
                        adjust = { delta -> allocations = allocations + (game.id to ((allocations[game.id] ?: 1) + delta).coerceAtLeast(1)) })
                }
                if (!bowlLocked) {
                    item { Button(onClick = { confirmBowl = true }, enabled = bowlReady && !state.busy, modifier = Modifier.fillMaxWidth().height(56.dp)) { Text("LOCK BOWL BOARD", fontWeight = FontWeight.Black) } }
                    item { OutlinedButton(onClick = { confirmDeadHand = true }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.Red)) { Text("INITIATE DEAD HAND", fontWeight = FontWeight.Black) } }
                } else item { cfbPanel(if (entry?.deadHand == true) "DEAD HAND BOARD SEALED" else "BOWL BOARD SEALED", "Cloud receipt secured. No edits and no appeals.", WarGreen) }
            } else {
                entry?.cfpScore?.let { item { cfbPanel("CFP BRACKET FINAL", "$it / 28 POINTS", NflCyan) } }
                items(cfpGames, key = { it.id }) { game ->
                    CfpGameCard(game, cfpPicks[game.id], state.cfbPostseasonResults.cfpResults[game.id], cfpLocked) { team ->
                        cfpPicks = CfbBracketEngine.select(slate.cfpSeeds, cfpPicks, game.id, team)
                    }
                }
                if (!cfpLocked) item { Button(onClick = { confirmCfp = true }, enabled = cfpReady && !state.busy, modifier = Modifier.fillMaxWidth().height(56.dp), colors = ButtonDefaults.buttonColors(containerColor = WarYellow, contentColor = Color.Black)) { Text("LOCK THIS CHAMPIONSHIP BRACKET", fontWeight = FontWeight.Black) } }
                else item { cfbPanel("CFP BRACKET SEALED", "Eleven decisions are permanently on file.", WarYellow) }
            }
        }
    }
    if (confirmBowl) ConfirmPostseason("SEAL BOWL MANIA?", "All 25 winners and all 100 confidence points become permanent.", { confirmBowl = false }) { confirmBowl = false; lockBowl(bowlPicks, allocations, false) }
    if (confirmCfp) ConfirmPostseason("SEAL THE CFP BRACKET?", "All 11 championship decisions become permanent.", { confirmCfp = false }) { confirmCfp = false; lockCfp(cfpPicks) }
    if (confirmDeadHand) ConfirmPostseason("AUTHORIZE DEAD HAND?", "The machine selects all 25 winners, allocates all 100 points, and seals the board. This cannot be undone.", { confirmDeadHand = false }) {
        confirmDeadHand = false
        val generatedPicks = slate?.bowlGames.orEmpty().mapIndexed { index, game -> game.id to if (index % 2 == 0) game.away else game.home }.toMap()
        val generatedAllocations = slate?.bowlGames.orEmpty().associate { it.id to 4 }
        bowlPicks = generatedPicks; allocations = generatedAllocations; lockBowl(generatedPicks, generatedAllocations, true)
    }
}

@Composable private fun BowlCard(game: CfbBowlGame, selected: String?, points: Int, remaining: Int, locked: Boolean, choose: (String) -> Unit, adjust: (Int) -> Unit) {
    val accent = if (game.tier == CfbBowlTier.MARQUEE) WarYellow else WarGreen
    Surface(color = PanelBlack, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth().border(1.dp, accent.copy(alpha = .45f), RoundedCornerShape(12.dp))) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row { Column(Modifier.weight(1f)) { Text(if (game.tier == CfbBowlTier.MARQUEE) "MARQUEE TARGET" else "SICKO INTELLIGENCE FILE", color = accent, fontSize = 8.sp, fontWeight = FontWeight.Black); Text(game.name.uppercase(), color = Color.White, fontWeight = FontWeight.Black) }; Row { IconButton({ adjust(-1) }, enabled = !locked && points > 1) { Text("−") }; Text("$points", color = accent, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 13.dp)); IconButton({ adjust(1) }, enabled = !locked && remaining > 0) { Text("+") } } }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf(game.away, game.home).forEach { team -> Surface(color = if (selected == team) accent else Color.White.copy(alpha = .07f), shape = RoundedCornerShape(7.dp), modifier = Modifier.weight(1f).clickable(enabled = !locked) { choose(team) }) { Text(team, color = if (selected == team) Color.Black else Color.White, fontWeight = FontWeight.Black, modifier = Modifier.padding(12.dp)) } } }
        }
    }
}

@Composable private fun CfpGameCard(game: CfbBracketGame, selected: String?, result: String?, locked: Boolean, choose: (String) -> Unit) {
    Surface(color = PanelBlack, shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth().border(1.dp, NflCyan.copy(alpha = .35f), RoundedCornerShape(10.dp))) {
        Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) { Text(game.label, color = NflCyan, fontWeight = FontWeight.Black); listOf(game.first, game.second).forEach { team -> val active = selected == team; Surface(color = if (active) WarGreen else Color.White.copy(alpha = .07f), shape = RoundedCornerShape(7.dp), modifier = Modifier.fillMaxWidth().clickable(enabled = !locked && team != "TBD") { choose(team) }) { Row(Modifier.padding(12.dp)) { Text(team, color = if (active) Color.Black else Color.White, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f)); if (active && result == team) Text("✓ CORRECT", color = Color.Black, fontSize = 8.sp, fontWeight = FontWeight.Black) } } } }
    }
}

@Composable private fun metric(label: String, value: String, modifier: Modifier) = Surface(modifier, color = PanelBlack, shape = RoundedCornerShape(8.dp)) { Column(Modifier.padding(10.dp)) { Text(value, color = WarYellow, fontWeight = FontWeight.Black); Text(label, color = Muted, fontSize = 8.sp) } }
@Composable private fun cfbPanel(title: String, detail: String, accent: Color) = Surface(color = PanelBlack, shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth().border(1.dp, accent.copy(alpha = .4f), RoundedCornerShape(10.dp))) { Column(Modifier.padding(16.dp)) { Text(title, color = accent, fontWeight = FontWeight.Black); Text(detail, color = Color.White.copy(alpha = .65f)) } }
@Composable private fun ConfirmPostseason(title: String, detail: String, dismiss: () -> Unit, confirm: () -> Unit) = AlertDialog(onDismissRequest = dismiss, title = { Text(title) }, text = { Text(detail) }, dismissButton = { TextButton(onClick = dismiss) { Text("REVIEW AGAIN") } }, confirmButton = { Button(onClick = confirm) { Text("CONFIRM & SEAL") } })
