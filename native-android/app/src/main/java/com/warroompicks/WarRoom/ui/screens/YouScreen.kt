package com.warroompicks.WarRoom.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.warroompicks.WarRoom.AppState
import com.warroompicks.WarRoom.model.Sport
import com.warroompicks.WarRoom.model.TeamCatalog
import com.warroompicks.WarRoom.ui.components.CommandPanel
import com.warroompicks.WarRoom.ui.components.WarBackdrop
import com.warroompicks.WarRoom.ui.components.WarHeader
import com.warroompicks.WarRoom.ui.theme.NflCyan
import com.warroompicks.WarRoom.ui.theme.WarGreen

@Composable
fun YouScreen(state: AppState, saveFavorite: (String) -> Unit, saveCrystal: (String) -> Unit, signOut: () -> Unit) {
    val league = state.league ?: return
    val session = state.session ?: return
    val standing = state.standings.firstOrNull { it.userId == session.userId }
    val accent = if (league.sport == Sport.NFL) NflCyan else WarGreen
    var editFavorite by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    WarBackdrop(league.sport) {
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { WarHeader("PERSONNEL FILE", standing?.displayName ?: session.email.substringBefore('@'), "One identity across every league and sport.", league.sport) }
            item { CommandPanel("CAMPAIGN RECORD", "${standing?.points?.toInt() ?: 0} career points", "Current rank: ${standing?.rank ?: "—"} · Historical weekly scorecards remain on file.", league.sport) }
            item { CommandPanel("TEAM ALLEGIANCE", state.favoriteTeam ?: "Choose favorite team", "Editable at any time. Your favorite appears on commissioner boards.", league.sport, onClick = { editFavorite = true }) }
            item { CommandPanel("CRYSTAL BALL", state.crystalBallTeam ?: "Preseason champion pick", "Required once at the start of this campaign and displayed on your profile.", league.sport) }
            item { CommandPanel("HARDWARE", "Trophy cabinet", "Championships, conference titles, Crystal Ball and Toilet Bowl evidence.", league.sport, onClick = {}) }
            item {
                OutlinedButton(onClick = signOut, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)) {
                    Text("SIGN OUT", fontWeight = FontWeight.Black)
                }
            }
        }
    }
    if (editFavorite) IdentitySetupDialog(
        sport = league.sport, needsFavorite = true, needsCrystal = false,
        saveFavorite = { saveFavorite(it); editFavorite = false }, saveCrystal = saveCrystal,
        dismissAllowed = true, onDismiss = { editFavorite = false },
    )
}

@Composable
fun IdentitySetupDialog(
    sport: Sport,
    needsFavorite: Boolean,
    needsCrystal: Boolean,
    saveFavorite: (String) -> Unit,
    saveCrystal: (String) -> Unit,
    dismissAllowed: Boolean,
    onDismiss: () -> Unit = {},
) {
    var mode by androidx.compose.runtime.remember(needsFavorite, needsCrystal) { androidx.compose.runtime.mutableStateOf(if (needsFavorite) "favorite" else "crystal") }
    var search by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }
    var selected by androidx.compose.runtime.remember(mode) { androidx.compose.runtime.mutableStateOf<String?>(null) }
    val teams = TeamCatalog.teams(sport).filter { it.contains(search, ignoreCase = true) }
    AlertDialog(
        onDismissRequest = { if (dismissAllowed) onDismiss() },
        title = { Text(if (mode == "favorite") "CHOOSE YOUR FAVORITE TEAM" else "LOCK YOUR CRYSTAL BALL") },
        text = {
            Column {
                Text(if (mode == "favorite") "This can be changed later from You." else "Pick the champion. This campaign pick is permanent after confirmation.")
                OutlinedTextField(search, { search = it }, placeholder = { Text("Search teams") }, modifier = Modifier.fillMaxWidth())
                androidx.compose.foundation.lazy.LazyColumn(Modifier.heightIn(max = 320.dp)) {
                    items(teams.size) { index ->
                        val team = teams[index]
                        ListItem(
                            headlineContent = { Text(team, fontWeight = FontWeight.Bold) },
                            modifier = Modifier.fillMaxWidth().clickable { selected = team },
                            trailingContent = { RadioButton(selected == team, onClick = { selected = team }) },
                        )
                    }
                }
            }
        },
        dismissButton = { if (dismissAllowed) TextButton(onClick = onDismiss) { Text("CANCEL") } },
        confirmButton = {
            Button(onClick = {
                val team = selected ?: return@Button
                if (mode == "favorite") {
                    saveFavorite(team)
                    if (needsCrystal) { mode = "crystal"; selected = null; search = "" }
                } else saveCrystal(team)
            }, enabled = selected != null) { Text("CONFIRM", fontWeight = FontWeight.Black) }
        },
    )
}
