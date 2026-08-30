package com.warroompicks.WarRoom

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.warroompicks.WarRoom.core.SecureSessionStore
import com.warroompicks.WarRoom.core.SupabaseApi
import com.warroompicks.WarRoom.model.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

data class AppState(
    val restoring: Boolean = true,
    val busy: Boolean = false,
    val session: UserSession? = null,
    val leagues: List<League> = emptyList(),
    val league: League? = null,
    val card: WeekCard? = null,
    val games: List<CardGame> = emptyList(),
    val currentPick: CurrentPick? = null,
    val standings: List<Standing> = emptyList(),
    val messages: List<LockerMessage> = emptyList(),
    val favoriteTeam: String? = null,
    val crystalBallTeam: String? = null,
    val error: String? = null,
    val notice: String? = null,
)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val api = SupabaseApi()
    private val secureStore = SecureSessionStore(application)
    private val _state = MutableStateFlow(AppState())
    val state: StateFlow<AppState> = _state.asStateFlow()

    init { restore() }

    fun restore() = viewModelScope.launch {
        val saved = secureStore.read()
        if (saved == null) {
            _state.value = AppState(restoring = false)
            return@launch
        }
        runCatching { validSession(saved) }
            .onSuccess { loadLeagues(it) }
            .onFailure { secureStore.clear(); _state.value = AppState(restoring = false, error = "Your session expired. Sign in again.") }
    }

    fun signIn(email: String, password: String) = launchBusy {
        val session = api.signIn(email, password)
        secureStore.write(session)
        loadLeagues(session)
    }

    fun signUp(email: String, password: String, name: String) = launchBusy {
        val session = api.signUp(email, password, name)
        if (session == null) _state.value = _state.value.copy(busy = false, notice = "Account created. Confirm the email, then sign in.")
        else { secureStore.write(session); loadLeagues(session) }
    }

    fun recover(email: String) = launchBusy {
        api.recover(email)
        _state.value = _state.value.copy(busy = false, notice = "Password reset sent. Check your email.")
    }

    fun signOut() {
        secureStore.clear()
        _state.value = AppState(restoring = false)
    }

    fun selectLeague(league: League) = viewModelScope.launch {
        _state.value = _state.value.copy(league = league, card = null, games = emptyList(), standings = emptyList(), messages = emptyList())
        refreshLeague()
    }

    fun refreshLeague() = viewModelScope.launch {
        val state = _state.value
        val session = state.session ?: return@launch
        val league = state.league ?: return@launch
        runCatching {
            val card = api.weekCard(session.accessToken, league)
            val pick = api.currentPick(session.accessToken, league, session.userId)
            val favorite = api.favoriteTeam(session.accessToken, session.userId, league.sport)
            val crystal = api.crystalBall(session.accessToken, league.id, session.userId)
            val standings = api.standings(session.accessToken, league.id)
            val messages = api.lockerMessages(session.accessToken, league.id)
            listOf(card, pick, favorite, crystal, standings, messages)
        }.onSuccess { loaded ->
            @Suppress("UNCHECKED_CAST")
            _state.value = _state.value.copy(
                card = (loaded[0] as? Pair<WeekCard, List<CardGame>>)?.first,
                games = (loaded[0] as? Pair<WeekCard, List<CardGame>>)?.second.orEmpty(),
                currentPick = loaded[1] as? CurrentPick,
                favoriteTeam = loaded[2] as? String, crystalBallTeam = loaded[3] as? String,
                standings = loaded[4] as List<Standing>, messages = loaded[5] as List<LockerMessage>, error = null,
            )
        }.onFailure(::showError)
    }

    fun refreshLive() = viewModelScope.launch {
        while (true) {
            refreshLeague()
            delay(30_000)
        }
    }

    fun postMessage(body: String) = launchBusy {
        val session = _state.value.session ?: return@launchBusy
        val league = _state.value.league ?: return@launchBusy
        require(body.trim().isNotEmpty())
        api.postLockerMessage(session.accessToken, league.id, session.userId, body)
        val messages = api.lockerMessages(session.accessToken, league.id)
        _state.value = _state.value.copy(busy = false, messages = messages)
    }

    fun saveFavorite(team: String) = launchBusy {
        val session = _state.value.session ?: return@launchBusy
        val league = _state.value.league ?: return@launchBusy
        api.saveFavoriteTeam(session.accessToken, session.userId, league.sport, team)
        _state.value = _state.value.copy(busy = false, favoriteTeam = TeamCatalog.slug(team), notice = "Favorite team confirmed.")
    }

    fun saveCrystalBall(team: String) = launchBusy {
        val session = _state.value.session ?: return@launchBusy
        val league = _state.value.league ?: return@launchBusy
        api.saveCrystalBall(session.accessToken, league.id, session.userId, team)
        _state.value = _state.value.copy(busy = false, crystalBallTeam = team, notice = "CRYSTAL BALL LOCKED · $team")
    }

    fun lockPicks(selections: List<GameSelection>, bestBet: UUID?, propChoice: String?) = launchBusy {
        val state = _state.value
        val session = state.session ?: return@launchBusy
        val league = state.league ?: return@launchBusy
        val card = state.card ?: error("The card is not available.")
        require(selections.size == state.games.size) { "Pick every game before locking the card." }
        require(selections.mapNotNull { it.confidence }.toSet().size == state.games.size) { "Use each confidence number exactly once." }
        require(bestBet != null) { "Choose one Best Bet." }
        require(!propChoice.isNullOrBlank()) { "Answer the prop question." }
        api.savePick(session.accessToken, league, card, selections, bestBet, propChoice)
        val saved = api.currentPick(session.accessToken, league, session.userId)
        _state.value = _state.value.copy(busy = false, currentPick = saved, notice = "CARD LOCKED · Your decisions are on file.")
    }

    fun clearMessage() { _state.value = _state.value.copy(error = null, notice = null) }

    private suspend fun loadLeagues(session: UserSession) {
        val leagues = api.memberships(session.accessToken, session.userId)
        val selected = leagues.firstOrNull()
        _state.value = AppState(restoring = false, session = session, leagues = leagues, league = selected)
        if (selected != null) refreshLeague()
    }

    private suspend fun validSession(session: UserSession): UserSession {
        if (session.expiresAtEpochSeconds > Instant.now().epochSecond + 300) return session
        return api.refresh(session.refreshToken).also(secureStore::write)
    }

    private fun launchBusy(block: suspend () -> Unit) = viewModelScope.launch {
        _state.value = _state.value.copy(busy = true, error = null, notice = null)
        runCatching { block() }.onFailure(::showError)
    }

    private fun showError(error: Throwable) {
        _state.value = _state.value.copy(busy = false, error = error.message ?: "The War Room could not complete that command.")
    }
}
