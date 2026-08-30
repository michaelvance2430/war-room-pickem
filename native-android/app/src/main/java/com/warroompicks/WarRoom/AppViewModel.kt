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
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging

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
    val announcements: List<Announcement> = emptyList(),
    val availableOdds: List<OddsGame> = emptyList(),
    val history: List<HistoryWeek> = emptyList(),
    val trophies: List<Trophy> = emptyList(),
    val favoriteTeam: String? = null,
    val crystalBallTeam: String? = null,
    val error: String? = null,
    val notice: String? = null,
)

private data class LeagueSnapshot(
    val card: Pair<WeekCard, List<CardGame>>?, val games: List<CardGame>, val pick: CurrentPick?,
    val favorite: String?, val crystal: String?, val standings: List<Standing>,
    val messages: List<LockerMessage>, val announcements: List<Announcement>,
    val history: List<HistoryWeek>, val trophies: List<Trophy>,
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

    fun updateRecoveredPassword(token: String, password: String, completed: () -> Unit) = launchBusy {
        require(password.length >= 8) { "Use at least 8 characters for the new password." }
        api.updateRecoveredPassword(token, password)
        completed()
        _state.value = AppState(restoring = false, notice = "Password updated. Sign in with the new password.")
    }

    fun signOut() {
        secureStore.clear()
        _state.value = AppState(restoring = false)
    }

    fun joinLeague(code: String) = launchBusy {
        val session = _state.value.session ?: return@launchBusy
        val id = api.joinLeague(session.accessToken, code)
        loadLeagues(session)
        _state.value.leagues.firstOrNull { it.id == id }?.let(::selectLeague)
    }

    fun createLeague(name: String, sport: Sport, public: Boolean, maxMembers: Int) = launchBusy {
        val session = _state.value.session ?: return@launchBusy
        val id = api.createLeague(session.accessToken, name, sport, public, maxMembers)
        loadLeagues(session)
        _state.value.leagues.firstOrNull { it.id == id }?.let(::selectLeague)
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
            LeagueSnapshot(
                card = card,
                games = runCatching { api.liveScores(session.accessToken, league, card?.second.orEmpty()) }.getOrDefault(card?.second.orEmpty()),
                pick = runCatching { api.currentPick(session.accessToken, league, session.userId) }.getOrNull(),
                favorite = runCatching { api.favoriteTeam(session.accessToken, session.userId, league.sport) }.getOrNull(),
                crystal = runCatching { api.crystalBall(session.accessToken, league.id, session.userId) }.getOrNull(),
                standings = runCatching { api.standings(session.accessToken, league.id) }.getOrDefault(state.standings),
                messages = runCatching { api.lockerMessages(session.accessToken, league.id) }.getOrDefault(state.messages),
                announcements = runCatching { api.announcements(session.accessToken, league.id) }.getOrDefault(state.announcements),
                history = runCatching { api.history(session.accessToken, league.id, session.userId) }.getOrDefault(state.history),
                trophies = runCatching { api.trophies(session.accessToken, session.userId) }.getOrDefault(state.trophies),
            )
        }.onSuccess { loaded ->
            _state.value = _state.value.copy(
                card = loaded.card?.first, games = loaded.games, currentPick = loaded.pick,
                favoriteTeam = loaded.favorite, crystalBallTeam = loaded.crystal,
                standings = loaded.standings, messages = loaded.messages,
                announcements = loaded.announcements, error = null,
                history = loaded.history, trophies = loaded.trophies,
            )
        }.onFailure(::showError)
    }

    fun refreshLive() = viewModelScope.launch {
        while (true) {
            refreshLeague()
            delay(15_000)
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

    fun selectTrophy(trophyId: String) = launchBusy {
        val session = _state.value.session ?: return@launchBusy
        val league = _state.value.league ?: return@launchBusy
        require(league.isCommissioner(session.userId)) { "Only the commissioner can choose championship hardware." }
        require(league.championshipTrophyId == null) { "This season's championship hardware is already sealed." }
        val saved = api.selectChampionshipTrophy(session.accessToken, league.id, trophyId)
        val updated = league.copy(championshipTrophyId = saved)
        _state.value = _state.value.copy(
            busy = false, league = updated,
            leagues = _state.value.leagues.map { if (it.id == updated.id) updated else it },
            notice = "CHAMPIONSHIP HARDWARE SEALED",
        )
    }

    fun updateDisplayName(name: String) = launchBusy {
        val session = _state.value.session ?: return@launchBusy
        require(name.trim().length in 2..40) { "Your name must be between 2 and 40 characters." }
        api.updateDisplayName(session.accessToken, session.userId, name)
        val standings = _state.value.standings.map { if (it.userId == session.userId) it.copy(displayName = name.trim()) else it }
        _state.value = _state.value.copy(busy = false, standings = standings, notice = "Personnel file updated.")
    }

    fun postAnnouncement(title: String, body: String) = launchBusy {
        val session = _state.value.session ?: return@launchBusy
        val league = _state.value.league ?: return@launchBusy
        require(league.isCommissioner(session.userId)) { "Only the commissioner can issue a league announcement." }
        require(title.isNotBlank() && body.isNotBlank()) { "Announcement title and message are required." }
        api.postAnnouncement(session.accessToken, league.id, session.userId, title, body)
        val announcements = api.announcements(session.accessToken, league.id)
        _state.value = _state.value.copy(busy = false, announcements = announcements, notice = "Announcement issued to ${league.name}.")
    }

    fun pullOdds() = launchBusy {
        val session = _state.value.session ?: return@launchBusy
        val league = _state.value.league ?: return@launchBusy
        require(league.isCommissioner(session.userId)) { "Only the commissioner can pull the weekly slate." }
        val odds = api.footballOdds(session.accessToken, league)
        _state.value = _state.value.copy(busy = false, availableOdds = odds, notice = "${odds.size} eligible games received.")
    }

    fun publishCard(games: List<OddsGame>, prop: String, optionA: String, optionB: String) = launchBusy {
        val session = _state.value.session ?: return@launchBusy
        val league = _state.value.league ?: return@launchBusy
        require(league.isCommissioner(session.userId)) { "Only the commissioner can publish the weekly card." }
        require(games.size == 5) { "Choose exactly five games." }
        require(prop.isNotBlank() && optionA.isNotBlank() && optionB.isNotBlank()) { "Complete the prop question and both answers." }
        api.publishWeekCard(session.accessToken, league, games, prop, optionA, optionB)
        _state.value = _state.value.copy(busy = false, availableOdds = emptyList(), notice = "WEEK ${league.currentWeek} IS LIVE")
        refreshLeague()
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
        registerPush(session)
    }

    private fun registerPush(session: UserSession) {
        val app = getApplication<Application>()
        val prefs = app.getSharedPreferences("war_room_push", Application.MODE_PRIVATE)
        fun upload(value: String) = viewModelScope.launch {
            runCatching { api.registerPushToken(session.accessToken, session.userId, value) }
                .onSuccess { prefs.edit().remove("pending_fcm_token").apply() }
        }
        prefs.getString("pending_fcm_token", null)?.let(::upload)
        if (FirebaseApp.getApps(app).isNotEmpty()) FirebaseMessaging.getInstance().token.addOnSuccessListener(::upload)
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
