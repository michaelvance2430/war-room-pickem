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
fun CfbPostseasonScreen(
    state: AppState,
    lockBowl: (Map<String, String>, Map<String, Int>, Boolean) -> Unit,
    lockCfp: (Map<String, String>) -> Unit,
    publishField: (List<CfbBowlGame>, List<String>) -> Unit,
    saveResults: (Map<String, String>, Map<String, String>) -> Unit,
) {
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
    var editingField by remember { mutableStateOf(false) }
    var editingResults by remember { mutableStateOf(false) }
    val isCommissioner = state.session?.let { state.league?.isCommissioner(it.userId) } == true
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
                if (isCommissioner) item { Button(onClick = { editingField = true }, modifier = Modifier.fillMaxWidth()) { Text("BUILD POSTSEASON FIELD", fontWeight = FontWeight.Black) } }
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
            if (slate != null && isCommissioner) item { OutlinedButton(onClick = { editingResults = true }, modifier = Modifier.fillMaxWidth()) { Text("COMMISSIONER RESULTS DESK", fontWeight = FontWeight.Black) } }
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
    if (editingField) CfbFieldEditorDialog(state.busy, { editingField = false }) { bowls, seeds -> editingField = false; publishField(bowls, seeds) }
    if (editingResults && slate != null) CfbResultsDialog(slate, state.cfbPostseasonResults, state.busy, { editingResults = false }) { bowls, cfp -> editingResults = false; saveResults(bowls, cfp) }
}

private val marqueeBowls = listOf("Citrus Bowl","Alamo Bowl","Music City Bowl","Gator Bowl","Texas Bowl","ReliaQuest Bowl","Las Vegas Bowl","Sun Bowl","Pop-Tarts Bowl","Holiday Bowl","Liberty Bowl","Duke's Mayo Bowl","Pinstripe Bowl","Independence Bowl","Armed Forces Bowl")
private val sickoBowls = listOf("68 Ventures Bowl","Salute to Veterans Bowl","Cure Bowl","Myrtle Beach Bowl","Frisco Bowl","Famous Idaho Potato Bowl","New Orleans Bowl","New Mexico Bowl","Birmingham Bowl","First Responder Bowl")

@Composable private fun CfbFieldEditorDialog(busy: Boolean, dismiss: () -> Unit, publish: (List<CfbBowlGame>, List<String>) -> Unit) {
    val names = marqueeBowls + sickoBowls
    var away by remember { mutableStateOf<Map<Int, String>>(emptyMap()) }
    var home by remember { mutableStateOf<Map<Int, String>>(emptyMap()) }
    var seeds by remember { mutableStateOf<Map<Int, String>>(emptyMap()) }
    val valid = (0 until 25).all { !away[it].isNullOrBlank() && !home[it].isNullOrBlank() } && (0 until 12).all { !seeds[it].isNullOrBlank() } && seeds.values.map { it.trim().lowercase() }.toSet().size == 12
    AlertDialog(
        onDismissRequest = dismiss, title = { Text("BUILD BOWL MANIA + CFP") },
        text = { LazyColumn(Modifier.heightIn(max = 560.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(names.indices.toList()) { index -> Column { Text("${index + 1}. ${names[index]}", color = if (index < 15) WarYellow else WarGreen, fontWeight = FontWeight.Black); Row { OutlinedTextField(away[index].orEmpty(), { away = away + (index to it) }, label = { Text("Away") }, modifier = Modifier.weight(1f)); OutlinedTextField(home[index].orEmpty(), { home = home + (index to it) }, label = { Text("Home") }, modifier = Modifier.weight(1f)) } } }
            item { Text("OFFICIAL 12-TEAM CFP SEEDING", color = NflCyan, fontWeight = FontWeight.Black) }
            items((0 until 12).toList()) { index -> OutlinedTextField(seeds[index].orEmpty(), { seeds = seeds + (index to it) }, label = { Text("#${index + 1} team") }, modifier = Modifier.fillMaxWidth()) }
        } },
        dismissButton = { TextButton(onClick = dismiss) { Text("CANCEL") } },
        confirmButton = { Button(onClick = { val bowls = names.mapIndexed { index, name -> CfbBowlGame("${if (index < 15) "marquee" else "sicko"}-${index + 1}", name, if (index < 15) CfbBowlTier.MARQUEE else CfbBowlTier.SICKO, if (index < 15) index + 1 else index - 14, away[index]!!.trim(), home[index]!!.trim()) }; publish(bowls, (0 until 12).map { seeds[it]!!.trim() }) }, enabled = valid && !busy) { Text("PUBLISH FIELD") } },
    )
}

@Composable private fun CfbResultsDialog(slate: CfbPostseasonSlate, saved: CfbPostseasonResults, busy: Boolean, dismiss: () -> Unit, save: (Map<String, String>, Map<String, String>) -> Unit) {
    var bowls by remember(saved) { mutableStateOf(saved.bowlResults) }
    var cfp by remember(saved) { mutableStateOf(saved.cfpResults) }
    val cfpGames = CfbBracketEngine.games(slate.cfpSeeds, cfp)
    AlertDialog(
        onDismissRequest = dismiss, title = { Text("CFB OFFICIAL RESULTS") },
        text = { LazyColumn(Modifier.heightIn(max = 560.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item { Text("BOWL RESULTS", color = WarYellow, fontWeight = FontWeight.Black) }
            items(slate.bowlGames, key = { it.id }) { game -> Column { Text(game.name, fontWeight = FontWeight.Black); Row { listOf(game.away, game.home).forEach { team -> FilterChip(bowls[game.id] == team, { if (game.id !in saved.bowlResults) bowls = bowls + (game.id to team) }, { Text(team) }, enabled = game.id !in saved.bowlResults) } } } }
            item { Text("CFP RESULTS", color = NflCyan, fontWeight = FontWeight.Black) }
            items(cfpGames, key = { it.id }) { game -> Column { Text(game.label, fontWeight = FontWeight.Black); Row { listOf(game.first, game.second).filter { it != "TBD" }.forEach { team -> FilterChip(cfp[game.id] == team, { if (game.id !in saved.cfpResults) cfp = CfbBracketEngine.select(slate.cfpSeeds, cfp, game.id, team) }, { Text(team) }, enabled = game.id !in saved.cfpResults) } } } }
        } },
        dismissButton = { TextButton(onClick = dismiss) { Text("CANCEL") } },
        confirmButton = { Button(onClick = { save(bowls, cfp) }, enabled = (bowls != saved.bowlResults || cfp != saved.cfpResults) && !busy) { Text("CERTIFY NEW RESULTS") } },
    )
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
