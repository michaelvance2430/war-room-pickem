package com.warroompicks.WarRoom.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.warroompicks.WarRoom.AppViewModel
import com.warroompicks.WarRoom.model.Sport
import com.warroompicks.WarRoom.ui.screens.*
import com.warroompicks.WarRoom.ui.theme.NflCyan
import com.warroompicks.WarRoom.ui.theme.WarGreen
import kotlinx.coroutines.delay

private enum class AppTab(val label: String, val icon: ImageVector) {
    Home("Home", Icons.Default.Home), Picks("Picks", Icons.Default.FactCheck),
    Standings("Standings", Icons.Default.FormatListNumbered), Locker("Locker", Icons.Default.Forum),
    You("You", Icons.Default.AccountCircle),
}

@Composable
fun WarRoomApp(viewModel: AppViewModel, notificationDestination: String? = null, recoveryToken: String? = null, clearRecovery: () -> Unit = {}) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var tab by remember { mutableStateOf(AppTab.Home) }
    LaunchedEffect(notificationDestination) {
        tab = when (notificationDestination) {
            "picks", "results" -> AppTab.Picks
            "announcements" -> AppTab.Home
            else -> tab
        }
    }

    when {
        recoveryToken != null -> ResetPasswordScreen(state.busy, state.error) { password -> viewModel.updateRecoveredPassword(recoveryToken, password, clearRecovery) }
        state.restoring -> LoadingScreen()
        state.session == null -> AuthScreen(state.busy, state.error, state.notice, viewModel::signIn, viewModel::signUp, viewModel::recover)
        state.league == null -> NoLeagueScreen(state.busy, viewModel::joinLeague, viewModel::createLeague, viewModel::signOut)
        else -> {
            val sport = state.league!!.sport
            Scaffold(
                containerColor = Color.Transparent,
                bottomBar = {
                    NavigationBar(containerColor = Color(0xFF090B0A), tonalElevation = 8.dp) {
                        AppTab.entries.forEach { destination ->
                            NavigationBarItem(
                                selected = tab == destination,
                                onClick = { tab = destination },
                                icon = { Icon(destination.icon, null) },
                                label = { Text(destination.label) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = if (sport == Sport.NFL) NflCyan else WarGreen,
                                    selectedTextColor = if (sport == Sport.NFL) NflCyan else WarGreen,
                                    indicatorColor = Color.White.copy(alpha = .13f),
                                    unselectedIconColor = Color.White,
                                    unselectedTextColor = Color.White,
                                ),
                            )
                        }
                    }
                },
                snackbarHost = {
                    SnackbarHost(remember { SnackbarHostState() })
                },
            ) { padding ->
                Box(Modifier.padding(padding)) {
                    when (tab) {
                        AppTab.Home -> HomeScreen(state, viewModel::selectLeague, viewModel::postAnnouncement, viewModel::pullOdds, viewModel::publishCard, viewModel::selectTrophy) { tab = AppTab.Picks }
                        AppTab.Picks -> PicksScreen(state, viewModel::lockPicks)
                        AppTab.Standings -> StandingsScreen(state)
                        AppTab.Locker -> LockerScreen(state, viewModel::postMessage)
                        AppTab.You -> YouScreen(state, viewModel::saveFavorite, viewModel::saveCrystalBall, viewModel::updateDisplayName, viewModel::signOut)
                    }
                }
            }
            LaunchedEffect(state.error, state.notice) {
                if (state.error != null || state.notice != null) {
                    delay(4_000)
                    viewModel.clearMessage()
                }
            }
            LaunchedEffect(state.league?.id) { viewModel.refreshLive() }
            if ((state.favoriteTeam == null || state.crystalBallTeam == null) && !state.busy) {
                IdentitySetupDialog(
                    sport = sport,
                    needsFavorite = state.favoriteTeam == null,
                    needsCrystal = state.crystalBallTeam == null,
                    saveFavorite = viewModel::saveFavorite,
                    saveCrystal = viewModel::saveCrystalBall,
                    dismissAllowed = false,
                )
            }
        }
    }
}

@Composable
private fun LoadingScreen() = Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
    CircularProgressIndicator(color = WarGreen)
}

@Composable
private fun NoLeagueScreen(busy: Boolean, join: (String) -> Unit, create: (String, Sport, Boolean, Int) -> Unit, signOut: () -> Unit) {
    var code by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var sport by remember { mutableStateOf(Sport.CFB) }
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text("NO ACTIVE LEAGUE", style = MaterialTheme.typography.headlineLarge)
        Text("Join a CFB or NFL league with an invite code or commission a new room.")
        OutlinedTextField(code, { code = it.uppercase() }, label = { Text("INVITE CODE") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = { join(code) }, enabled = code.isNotBlank() && !busy, modifier = Modifier.fillMaxWidth()) { Text("JOIN LEAGUE") }
        Spacer(Modifier.height(20.dp))
        OutlinedTextField(name, { name = it }, label = { Text("NEW LEAGUE NAME") }, modifier = Modifier.fillMaxWidth())
        Row { Sport.entries.forEach { option -> FilterChip(selected = sport == option, onClick = { sport = option }, label = { Text(option.id.uppercase()) }); Spacer(Modifier.width(8.dp)) } }
        Button(onClick = { create(name, sport, false, 100) }, enabled = name.isNotBlank() && !busy, modifier = Modifier.fillMaxWidth()) { Text("CREATE PRIVATE LEAGUE") }
        Button(onClick = signOut) { Text("SIGN OUT") }
    }
}
