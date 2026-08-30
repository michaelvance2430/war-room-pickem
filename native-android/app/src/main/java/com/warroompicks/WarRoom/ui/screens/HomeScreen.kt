package com.warroompicks.WarRoom.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.clickable
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
import com.warroompicks.WarRoom.model.OddsGame
import com.warroompicks.WarRoom.model.TrophyCatalog
import com.warroompicks.WarRoom.model.TrophyDesign
import com.warroompicks.WarRoom.ui.components.*
import com.warroompicks.WarRoom.ui.theme.*
import java.time.Duration
import java.time.Instant

@Composable
fun HomeScreen(state: AppState, selectLeague: (League) -> Unit, postAnnouncement: (String, String) -> Unit, pullOdds: () -> Unit, publishCard: (List<OddsGame>, String, String, String) -> Unit, selectTrophy: (String) -> Unit, openPicks: () -> Unit) {
    val league = state.league ?: return
    var switchOpen by remember { mutableStateOf(false) }
    var announcementComposer by remember { mutableStateOf(false) }
    var cardBuilder by remember { mutableStateOf(false) }
    var trophyPicker by remember { mutableStateOf(false) }
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
                state.announcements.firstOrNull()?.let { announcement ->
                    CommandPanel("LEAGUE DISPATCH", announcement.title, announcement.body, league.sport)
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
            if (state.session?.let { league.isCommissioner(it.userId) } == true) {
                item { CommandPanel("COMMISSIONER COMMS", "Issue an announcement", "Post an official league-wide dispatch outside locker-room chat.", league.sport, onClick = { announcementComposer = true }) }
                item {
                    val selected = TrophyCatalog.designs(league.sport).firstOrNull { it.id == league.championshipTrophyId }
                    CommandPanel(
                        "CHAMPIONSHIP HARDWARE",
                        selected?.name ?: "Choose the season's trophy",
                        if (selected == null) "Six unreasonable options await. Selection becomes permanent when the season starts." else "The vault is sealed. This exact artifact belongs to the champion.",
                        league.sport,
                        onClick = { trophyPicker = true },
                    )
                }
                if (state.card == null) item { CommandPanel("COMMISSIONER CONTROL", "Build Week ${league.currentWeek}", "Pull the correct ${league.sport.id.uppercase()} slate, choose five games and publish the prop.", league.sport, onClick = { cardBuilder = true; pullOdds() }) }
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
    if (announcementComposer) AnnouncementDialog(
        onDismiss = { announcementComposer = false },
        onPost = { title, body -> announcementComposer = false; postAnnouncement(title, body) },
    )
    if (cardBuilder) CardBuilderDialog(
        odds = state.availableOdds, busy = state.busy,
        onDismiss = { cardBuilder = false },
        onPublish = { games, prop, a, b -> cardBuilder = false; publishCard(games, prop, a, b) },
    )
    if (trophyPicker) TrophyPickerDialog(
        sport = league.sport,
        selectedId = league.championshipTrophyId,
        onDismiss = { trophyPicker = false },
        onSelect = { trophyPicker = false; selectTrophy(it) },
    )
}

@Composable
private fun TrophyPickerDialog(sport: Sport, selectedId: String?, onDismiss: () -> Unit, onSelect: (String) -> Unit) {
    var pending by remember { mutableStateOf<TrophyDesign?>(null) }
    val designs = TrophyCatalog.designs(sport)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (selectedId == null) "CHOOSE CHAMPIONSHIP HARDWARE" else "THE VAULT IS SEALED") },
        text = {
            LazyColumn(Modifier.heightIn(max = 480.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(designs) { design ->
                    Surface(
                        modifier = Modifier.fillMaxWidth().clickable(enabled = selectedId == null) { pending = design },
                        color = if (selectedId == design.id) WarYellow.copy(alpha = .20f) else Color.Black.copy(alpha = .55f),
                        shape = MaterialTheme.shapes.medium,
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Text(design.name.uppercase(), fontWeight = FontWeight.Black, color = if (sport == Sport.NFL) NflCyan else WarYellow)
                            Text(design.line, color = Color.White.copy(alpha = .72f))
                            if (selectedId == design.id) Text("SELECTED · PERMANENT", fontWeight = FontWeight.Black, color = WarGreen)
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("CLOSE") } },
    )
    pending?.let { design ->
        AlertDialog(
            onDismissRequest = { pending = null }, title = { Text("SEAL ${design.name.uppercase()} IN THE VAULT?") },
            text = { Text("This becomes the season's permanent championship design. This cannot be undone after kickoff.") },
            dismissButton = { TextButton(onClick = { pending = null }) { Text("NOT YET") } },
            confirmButton = { Button(onClick = { onSelect(design.id); pending = null }) { Text("LOCK THE HARDWARE", fontWeight = FontWeight.Black) } },
        )
    }
}

@Composable
private fun AnnouncementDialog(onDismiss: () -> Unit, onPost: (String, String) -> Unit) {
    var title by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("ISSUE LEAGUE DISPATCH") },
        text = { Column { OutlinedTextField(title, { title = it }, label = { Text("TITLE") }); OutlinedTextField(body, { body = it }, label = { Text("MESSAGE") }, minLines = 3) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("CANCEL") } },
        confirmButton = { Button(onClick = { onPost(title, body) }, enabled = title.isNotBlank() && body.isNotBlank()) { Text("POST") } },
    )
}

@Composable
private fun CardBuilderDialog(odds: List<OddsGame>, busy: Boolean, onDismiss: () -> Unit, onPublish: (List<OddsGame>, String, String, String) -> Unit) {
    var selected by remember(odds) { mutableStateOf<Set<String>>(emptySet()) }
    var prop by remember { mutableStateOf("") }
    var optionA by remember { mutableStateOf("") }
    var optionB by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("BUILD THE WEEKLY CARD") },
        text = {
            Column {
                Text(if (busy) "Pulling the eligible slate…" else "${selected.size}/5 games selected")
                LazyColumn(Modifier.heightIn(max = 300.dp)) {
                    items(odds.size) { index ->
                        val game = odds[index]
                        val checked = game.id in selected
                        ListItem(
                            headlineContent = { Text("${game.awayTeam} @ ${game.homeTeam}", fontWeight = FontWeight.Bold) },
                            supportingContent = { Text("${game.favorite} ${game.spread}") },
                            trailingContent = { Checkbox(checked, onCheckedChange = null) },
                            modifier = Modifier.clickable {
                                selected = if (checked) selected - game.id else if (selected.size < 5) selected + game.id else selected
                            },
                        )
                    }
                }
                OutlinedTextField(prop, { prop = it }, label = { Text("PROP QUESTION") })
                Row { OutlinedTextField(optionA, { optionA = it }, label = { Text("OPTION A") }, modifier = Modifier.weight(1f)); OutlinedTextField(optionB, { optionB = it }, label = { Text("OPTION B") }, modifier = Modifier.weight(1f)) }
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("CANCEL") } },
        confirmButton = { Button(onClick = { onPublish(odds.filter { it.id in selected }, prop, optionA, optionB) }, enabled = selected.size == 5 && prop.isNotBlank() && optionA.isNotBlank() && optionB.isNotBlank() && !busy) { Text("PUBLISH") } },
    )
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
