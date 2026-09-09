package com.warroompicks.WarRoom.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.warroompicks.WarRoom.AppState
import com.warroompicks.WarRoom.model.Sport
import com.warroompicks.WarRoom.model.TrophyCatalog
import com.warroompicks.WarRoom.model.StandingMovement
import com.warroompicks.WarRoom.ui.components.WarBackdrop
import com.warroompicks.WarRoom.ui.components.WarHeader
import com.warroompicks.WarRoom.ui.components.PlayerAvatar
import com.warroompicks.WarRoom.ui.theme.*

@Composable
fun StandingsScreen(state: AppState, loadCfbPolls: () -> Unit, fileCfbBallot: (List<String>) -> Unit) {
    val league = state.league ?: return
    val accent = if (league.sport == Sport.NFL) NflCyan else WarGreen
    var tab by remember(league.id) { mutableStateOf("ROOM STANDINGS") }
    LaunchedEffect(tab, league.id) { if (league.sport == Sport.CFB && tab != "ROOM STANDINGS") loadCfbPolls() }
    val movement = StandingMovement.compute(state.standings)
    WarBackdrop(league.sport) {
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            item { WarHeader(if (league.sport == Sport.NFL) "SUNDAY POWER INDEX" else "PERMANENT RECORD", if (league.sport == Sport.NFL) "THE LEAGUE TABLE" else "HALL OF RECKONING", "Live totals refresh while the games are being played.", league.sport) }
            item { ChampionshipHardware(league.championshipTrophyId, league.sport) }
            if (league.sport == Sport.CFB) {
                stickyHeader {
                    Surface(color = Color(0xF2090B0A), modifier = Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            listOf("ROOM STANDINGS", "AP TOP 25", "MEMBERS’ TOP 12").forEach { choice ->
                                FilterChip(tab == choice, { tab = choice }, { Text(choice, fontSize = 9.sp, fontWeight = FontWeight.Black) }, modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
            if (tab == "AP TOP 25") {
                item { PollHero("THE NATIONAL MEASURE", "AP TOP 25", "The official weekly poll. Reference only—these rankings never change your card or score.", WarYellow) }
                if (state.cfbPollLoading) item { LinearProgressIndicator(Modifier.fillMaxWidth(), color = WarYellow) }
                items(state.cfbPollSnapshot?.rankings?.size ?: 0) { index ->
                    val ranking = state.cfbPollSnapshot!!.rankings[index]
                    PollRow(ranking.rank, ranking.market.ifBlank { ranking.name }, "${ranking.points} PTS${if (ranking.firstPlaceVotes > 0) " · ${ranking.firstPlaceVotes} FPV" else ""}", WarYellow)
                }
            } else if (tab == "MEMBERS’ TOP 12") {
                item { PollHero("YOUR ROOM · YOUR PLAYOFF FIELD", "MEMBERS’ TOP 12", "Rank the room’s 12-team playoff field. Zero standings points and zero Cheevos.", WarGreen) }
                item { MemberPollBoard(state, fileCfbBallot) }
                state.cfbPollSnapshot?.takeIf { it.revealed }?.memberResults?.let { rows ->
                    items(rows.size) { index -> val row = rows[index]; val team = state.cfbPollSnapshot.rankings.firstOrNull { it.id == row.id }; PollRow(row.rank, team?.market?.ifBlank { team.name } ?: row.id, "${row.points} BALLOT PTS${if (row.firstPlaceVotes > 0) " · ${row.firstPlaceVotes} #1" else ""}", WarGreen) }
                }
            } else {
            val grouped = state.standings.groupBy { it.division ?: "Unassigned" }
            grouped.forEach { (division, players) ->
                item {
                    Text(division.uppercase(), color = accent, fontWeight = FontWeight.Black, letterSpacing = 2.sp, modifier = Modifier.padding(top = 10.dp, bottom = 3.dp))
                }
                itemsIndexed(players, key = { _, player -> player.userId }) { index, player ->
                    Surface(color = PanelBlack, shape = MaterialTheme.shapes.medium) {
                        Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.width(46.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("${player.rank}", color = accent, fontSize = 22.sp, fontWeight = FontWeight.Black)
                                MovementBadge(movement[player.userId] ?: 0)
                            }
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
}

@Composable private fun ChampionshipHardware(trophyId: String?, sport: Sport) {
    val trophy = trophyId?.let { id -> TrophyCatalog.designs(sport).firstOrNull { it.id == id } }
    val accent = if (sport == Sport.NFL) NflCyan else WarYellow
    Surface(color = PanelBlack, shape = MaterialTheme.shapes.large, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("🏆", fontSize = 54.sp)
            Spacer(Modifier.width(14.dp))
            Column { Text("THE HARDWARE", color = accent, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp); Text((trophy?.name ?: "TROPHY NOT SELECTED").uppercase(), color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black); Text(trophy?.line ?: "The commissioner still needs to choose the season’s permanent trophy.", color = Muted, fontSize = 12.sp) }
        }
    }
}

@Composable private fun MovementBadge(change: Int) {
    val color = if (change > 0) WarGreen else if (change < 0) Color.Red else Color(0xFF42A5F5)
    Text(if (change > 0) "▲ $change" else if (change < 0) "▼ ${-change}" else "—", color = color, fontSize = 9.sp, fontWeight = FontWeight.Black)
}

@Composable private fun PollHero(kicker: String, title: String, detail: String, accent: Color) = Surface(color = PanelBlack, shape = MaterialTheme.shapes.large) { Column(Modifier.padding(16.dp)) { Text(kicker, color = accent, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp); Text(title, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black); Text(detail, color = Muted) } }

@Composable private fun PollRow(rank: Int, name: String, detail: String, accent: Color) = Surface(color = PanelBlack, shape = MaterialTheme.shapes.medium) { Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) { Text("$rank", color = accent, fontSize = 21.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(38.dp)); Column { Text(name.uppercase(), color = Color.White, fontWeight = FontWeight.Black); Text(detail, color = Muted, fontSize = 10.sp) } } }

@Composable private fun MemberPollBoard(state: AppState, fileBallot: (List<String>) -> Unit) {
    val snapshot = state.cfbPollSnapshot
    var ballot by remember(snapshot?.ownBallot) { mutableStateOf(snapshot?.ownBallot.orEmpty()) }
    val filed = snapshot?.ownBallot?.size == 12
    Surface(color = PanelBlack, shape = MaterialTheme.shapes.large) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(if (filed) "MY BALLOT · FILED" else "BUILD MY TOP 12", color = if (filed) WarGreen else WarYellow, fontWeight = FontWeight.Black); Text("${ballot.size}/12", color = WarYellow, fontWeight = FontWeight.Black) }
            snapshot?.let { Text("${it.filedCount} BALLOTS · ${if (it.official) "OFFICIAL" else "4 REQUIRED"} · ${if (it.revealed) "REVEALED" else "SEALED UNTIL CARD LOCK"}", color = Muted, fontSize = 10.sp, fontWeight = FontWeight.Black) }
            if (!filed) snapshot?.rankings?.forEach { team ->
                val position = ballot.indexOf(team.id).takeIf { it >= 0 }
                Row(Modifier.fillMaxWidth().clickable { ballot = if (position != null) ballot - team.id else if (ballot.size < 12) ballot + team.id else ballot }.padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(position?.plus(1)?.toString() ?: "–", color = if (position != null) Color.Black else Muted, fontWeight = FontWeight.Black, modifier = Modifier.width(30.dp)); Text(team.market.ifBlank { team.name }.uppercase(), color = Color.White, fontWeight = FontWeight.Black)
                }
            }
            if (!filed) Button({ fileBallot(ballot) }, enabled = ballot.size == 12 && !state.busy, modifier = Modifier.fillMaxWidth()) { Text("FILE MY BALLOT", fontWeight = FontWeight.Black) }
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
