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
fun NflPostseasonScreen(state: AppState, lock: (Map<String, String>, Boolean) -> Unit) {
    val slate = state.nflPostseasonSlate
    val entry = state.nflPostseasonEntry
    var picks by remember(slate?.seasonKey, entry?.lockedAt) { mutableStateOf(entry?.picks.orEmpty()) }
    var confirming by remember { mutableStateOf(false) }
    var confirmingJdam by remember { mutableStateOf(false) }
    val games = remember(slate?.teams, picks) { NflBracketEngine.games(slate?.teams.orEmpty(), picks) }
    val complete = NflBracketEngine.requiredKeys.all { picks[it] != null }
    val locked = entry?.lockedAt != null

    WarBackdrop(Sport.NFL) {
        LazyColumn(contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { WarHeader("NFL POSTSEASON COMMAND", "THE FINAL THIRTEEN", "14 teams · automatic reseeding · 13 decisions · one permanent receipt", Sport.NFL) }
            if (slate == null) {
                item {
                    postseasonPanel("THE FIELD IS NOT OFFICIAL YET", "The commissioner must publish seven AFC and seven NFC seeds. The verified bracket opens for everyone the moment it arrives.", NflCyan)
                }
            } else {
                state.nflPostseasonScorecard?.let { score ->
                    item { postseasonPanel("CERTIFIED PLAYOFF RECEIPT", "${score.totalPoints} POINTS · WC ${score.wildCardPoints} · DIV ${score.divisionalPoints} · CONF ${score.conferencePoints} · SB ${score.superBowlPoints}", NflCyan) }
                }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        phaseChip("WC", NflBracketEngine.requiredKeys.filter { "-WC-" in it }.all { picks[it] != null }, Modifier.weight(1f))
                        phaseChip("DIV", NflBracketEngine.requiredKeys.filter { "-DIV-" in it }.all { picks[it] != null }, Modifier.weight(1f))
                        phaseChip("CONF", listOf("AFC-CONF", "NFC-CONF").all { picks[it] != null }, Modifier.weight(1f))
                        phaseChip("SB", picks["SUPER-BOWL"] != null, Modifier.weight(1f))
                        phaseChip("SEAL", locked, Modifier.weight(1f))
                    }
                }
                listOf("AFC", "NFC").forEach { conference ->
                    item { Text("$conference CONFERENCE BOARD", color = if (conference == "AFC") Color.Red else NflCyan, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp) }
                    items(games.filter { it.id.startsWith(conference) }, key = { it.id }) { game ->
                        NflGameCard(game, picks[game.id], state.nflPostseasonResults[game.id], locked) { team ->
                            picks = NflBracketEngine.select(picks, game.id, team.id)
                        }
                    }
                }
                item { postseasonPanel("PLEASE STAND BY", "Conference champions get one week off. No fake slate and no filler points—then the Super Bowl takes the screen.", Color.Red) }
                games.firstOrNull { it.id == "SUPER-BOWL" }?.let { game ->
                    item { NflGameCard(game, picks[game.id], state.nflPostseasonResults[game.id], locked) { team -> picks = NflBracketEngine.select(picks, game.id, team.id) } }
                }
                if (locked) {
                    item { postseasonPanel(if (entry?.usedJdam == true) "JDAM BRACKET SEALED" else "BRACKET SEALED", "Cloud receipt secured. This bracket follows you across every device.", NflCyan) }
                } else {
                    item {
                        Button(onClick = { confirming = true }, enabled = complete && !state.busy, modifier = Modifier.fillMaxWidth().height(56.dp)) {
                            Text("SEAL ALL 13 PICKS", fontWeight = FontWeight.Black)
                        }
                    }
                    item {
                        Surface(color = Color.Red.copy(alpha = .09f), shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth().border(1.dp, Color.Red.copy(alpha = .55f), RoundedCornerShape(8.dp))) {
                            Column(Modifier.padding(16.dp)) {
                                Text("POSTSEASON WEAPON · M.A.P.'S", color = Color.Red, fontSize = 9.sp, fontWeight = FontWeight.Black)
                                Text("JDAM OVERRIDE", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                                Text("Replaces every open selection and seals the full bracket in one permanent strike. No rerolls.", color = Muted)
                                Button(onClick = { confirmingJdam = true }, colors = ButtonDefaults.buttonColors(containerColor = Color.Red), modifier = Modifier.fillMaxWidth()) { Text("AUTHORIZE JDAM", fontWeight = FontWeight.Black) }
                            }
                        }
                    }
                }
            }
        }
    }
    if (confirming) AlertDialog(
        onDismissRequest = { confirming = false }, title = { Text("SEAL ALL 13 PICKS?") },
        text = { Text("This bracket cannot be changed after confirmation.") },
        dismissButton = { TextButton(onClick = { confirming = false }) { Text("REVIEW AGAIN") } },
        confirmButton = { Button(onClick = { confirming = false; lock(picks, false) }) { Text("CONFIRM & SEAL") } },
    )
    if (confirmingJdam) AlertDialog(
        onDismissRequest = { confirmingJdam = false }, title = { Text("AUTHORIZE JDAM?") },
        text = { Text("JDAM fills all 13 decisions, records the authorization, and seals the bracket. No rerolls.") },
        dismissButton = { TextButton(onClick = { confirmingJdam = false }) { Text("KEEP CONTROL") } },
        confirmButton = { Button(onClick = {
            confirmingJdam = false
            val generated = randomCompleteBracket(slate?.teams.orEmpty())
            picks = generated
            if (NflBracketEngine.requiredKeys.all { generated[it] != null }) lock(generated, true)
        }, colors = ButtonDefaults.buttonColors(containerColor = Color.Red)) { Text("AUTHORIZE") } },
    )
}

@Composable
private fun NflGameCard(game: NflBracketGame, selected: String?, result: String?, locked: Boolean, choose: (NflPostseasonTeam) -> Unit) {
    Surface(color = PanelBlack, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth().border(1.dp, NflCyan.copy(alpha = .25f), RoundedCornerShape(8.dp))) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("${game.round} · ${game.title}".uppercase(), color = NflCyan, fontSize = 9.sp, fontWeight = FontWeight.Black)
            if (game.teams.size != 2) Text("AWAITING PRIOR ROUND", color = Muted, fontWeight = FontWeight.Black)
            game.teams.forEach { team ->
                val active = selected == team.id
                Surface(
                    color = if (active) NflCyan else Color.White.copy(alpha = .06f), shape = RoundedCornerShape(5.dp),
                    modifier = Modifier.fillMaxWidth().clickable(enabled = !locked) { choose(team) },
                ) {
                    Row(Modifier.padding(12.dp)) {
                        Text("#${team.seed} ${team.name}", color = if (active) Color.Black else Color.White, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                        if (active) Text(if (result == team.id) "✓ CORRECT" else "ADVANCE", color = Color.Black, fontSize = 8.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
        }
    }
}

@Composable private fun phaseChip(label: String, done: Boolean, modifier: Modifier) = Surface(modifier, color = if (done) NflCyan else Color.White.copy(alpha = .07f), shape = RoundedCornerShape(4.dp)) {
    Text(if (done) "✓ $label" else label, color = if (done) Color.Black else Muted, fontSize = 8.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(vertical = 9.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
}

@Composable private fun postseasonPanel(title: String, detail: String, accent: Color) = Surface(color = PanelBlack, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth().border(1.dp, accent.copy(alpha = .45f), RoundedCornerShape(8.dp))) {
    Column(Modifier.padding(17.dp)) { Text(title, color = accent, fontWeight = FontWeight.Black); Text(detail, color = Color.White.copy(alpha = .65f)) }
}

private fun randomCompleteBracket(teams: List<NflPostseasonTeam>): Map<String, String> {
    var picks = emptyMap<String, String>()
    repeat(4) {
        NflBracketEngine.games(teams, picks).filter { it.teams.size == 2 && picks[it.id] == null }.forEach { game ->
            picks = NflBracketEngine.select(picks, game.id, game.teams.random().id)
        }
    }
    return picks
}
