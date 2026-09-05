import SwiftUI
import Combine
import UserNotifications
import UniformTypeIdentifiers

private struct FieldhouseLeagueEnvironmentKey: EnvironmentKey {
    static let defaultValue: FieldhouseLeague = .activeBuild
}

private extension EnvironmentValues {
    var fieldhouseLeague: FieldhouseLeague {
        get { self[FieldhouseLeagueEnvironmentKey.self] }
        set { self[FieldhouseLeagueEnvironmentKey.self] = newValue }
    }
}

enum FieldhouseTheme {
    static func accent(for league: FieldhouseLeague) -> Color {
        switch league {
        case .ncaam: .orange
        case .ncaaw: Color(red: 0.25, green: 0.92, blue: 0.86)
        }
    }

    static func secondary(for league: FieldhouseLeague) -> Color {
        switch league {
        case .ncaam: Color(red: 1.0, green: 0.32, blue: 0.08)
        case .ncaaw: Color(red: 0.84, green: 0.32, blue: 1.0)
        }
    }
}

struct FieldhouseCardReminder: Equatable {
    let identifier: String
    let fireAt: Date
}

enum FieldhouseCardReminderSchedule {
    static func oneHour(lockAt: Date, now: Date, leagueID: UUID, week: Int) -> FieldhouseCardReminder? {
        let fireAt = lockAt.addingTimeInterval(-60 * 60)
        guard fireAt > now else { return nil }
        return FieldhouseCardReminder(
            identifier: "fieldhouse.card-lock.1h.\(leagueID.uuidString).\(week)",
            fireAt: fireAt
        )
    }
}

enum FieldhouseNotificationScheduler {
    private static let center = UNUserNotificationCenter.current()

    static func cardPublished(
        leagueID: UUID,
        leagueName: String,
        week: Int,
        lockAt: Date,
        cardKind: FieldhouseCardKind = .weekly,
        now: Date = Date()
    ) async {
        let authorization = await center.notificationSettings().authorizationStatus
        guard authorization == .authorized || authorization == .provisional else { return }

        let builtID = "fieldhouse.card-built.\(leagueID.uuidString).\(week)"
        if !UserDefaults.standard.bool(forKey: builtID) {
            let content = notificationContent(
                title: cardKind == .conferenceChampionship ? "Championship Week is live" : "Week \(week) card built",
                body: cardKind == .conferenceChampionship
                    ? "\(leagueName) has four conference titles on the board. Pick all four champions."
                    : "\(leagueName) is open. Make and lock your 10 picks before the first tip.",
                leagueID: leagueID,
                week: week,
                kind: "fieldhouse_card_built"
            )
            do {
                try await center.add(UNNotificationRequest(identifier: builtID, content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false)))
                UserDefaults.standard.set(true, forKey: builtID)
            } catch { }
        }

        if let reminder = FieldhouseCardReminderSchedule.oneHour(lockAt: lockAt, now: now, leagueID: leagueID, week: week) {
            center.removePendingNotificationRequests(withIdentifiers: [reminder.identifier])
            let content = notificationContent(
                title: cardKind == .conferenceChampionship ? "1 HOUR · CHAMPIONSHIP PICKS LOCK" : "1 HOUR · WEEK \(week) LOCKS",
                body: cardKind == .conferenceChampionship
                    ? "\(leagueName) closes at first tip. Finish and confirm all four champions."
                    : "\(leagueName) closes at first tip. Finish and lock your card.",
                leagueID: leagueID,
                week: week,
                kind: "fieldhouse_card_lock_1h"
            )
            let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: reminder.fireAt)
            try? await center.add(UNNotificationRequest(identifier: reminder.identifier, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)))
        }
    }

    private static func notificationContent(title: String, body: String, leagueID: UUID, week: Int, kind: String) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.categoryIdentifier = "WAR_ROOM_SYSTEM"
        content.threadIdentifier = "league.\(leagueID.uuidString)"
        content.userInfo = [
            "kind": kind,
            "league_id": leagueID.uuidString.lowercased(),
            "destination": "picks",
            "week": week
        ]
        return content
    }
}

enum FieldhousePreviewIdentity {
    static func leagueID(for league: FieldhouseLeague) -> UUID {
        UUID(uuidString: league == .ncaam
            ? "F13D0000-0000-4000-8000-000000000001"
            : "F13D0000-0000-4000-8000-000000000004")!
    }
}

enum FieldhouseSeasonCalendar {
    static let eastern = TimeZone(identifier: "America/New_York")!
    static let postseasonSeasonKey = 2027
    static var openingTip: Date {
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = eastern
        components.year = 2026; components.month = 11; components.day = 2; components.hour = 0
        return components.date!
    }

    static func start(of window: Int) -> Date {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = eastern
        return calendar.date(byAdding: .day, value: max(0, window - 1) * 7, to: openingTip)!
    }

    static func fallbackLockDate(for window: Int) -> Date {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = eastern
        return calendar.date(byAdding: .hour, value: 19 + (3 * 24), to: start(of: window))!
    }

    static func lockDate(for window: Int, games: [FieldhouseGame]) -> Date {
        games.map { $0.tipDate(in: window) }.min() ?? fallbackLockDate(for: window)
    }

    static func lockClock(at now: Date, window: Int, games: [FieldhouseGame] = []) -> String {
        let deadline = lockDate(for: window, games: games)
        guard now < deadline else { return "WEEK \(window) PICKS LOCKED" }
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = eastern
        let parts = calendar.dateComponents([.day, .hour, .minute], from: now, to: deadline)
        return "WEEK \(window) PICKS LOCK IN \(max(0, parts.day ?? 0))D \(max(0, parts.hour ?? 0))H \(max(0, parts.minute ?? 0))M"
    }

    static func windowLabel(_ window: Int) -> String {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = eastern
        let start = start(of: window)
        let end = calendar.date(byAdding: .day, value: 6, to: start)!
        let formatter = DateFormatter(); formatter.timeZone = eastern; formatter.dateFormat = "MMM d"
        return "WEEK \(window) · \(formatter.string(from: start).uppercased())–\(formatter.string(from: end).uppercased())"
    }
}

enum WarRoomPostseasonStatus: Equatable {
    case championship(seed: Int)
    case activeNoBrass
    case toilet(seed: Int)
}

enum WarRoomPostseasonRule {
    static let leagueFieldSize = 16
    static let regionalFieldSize = 4

    static func status(rank: Int, playerCount: Int) -> WarRoomPostseasonStatus {
        let count = max(1, playerCount)
        let safeRank = min(max(1, rank), count)
        let field = min(regionalFieldSize, count / 2)
        if safeRank <= field { return .championship(seed: safeRank) }
        if safeRank > count - field { return .toilet(seed: safeRank - (count - field)) }
        return .activeNoBrass
    }

    static func counts(playerCount: Int) -> (championship: Int, activeNoBrass: Int, toilet: Int) {
        let count = max(0, playerCount)
        let field = min(leagueFieldSize, count / 2)
        return (field, count - (field * 2), field)
    }

    static func regionalCounts(playerCount: Int) -> (championship: Int, activeNoBrass: Int, toilet: Int) {
        let count = max(0, playerCount)
        let field = min(regionalFieldSize, count / 2)
        return (field, count - (field * 2), field)
    }
}

struct FieldhouseCompetitionRank: Equatable {
    let place: Int
    let tied: Bool

    var rowLabel: String { tied ? "T\(place)" : "\(place)" }
    var headlineLabel: String { tied ? "T-\(place)" : "#\(place)" }
}

enum FieldhousePostseasonRanking {
    static func rank(
        for userID: UUID,
        among participantIDs: [UUID],
        totals: [UUID: Int]
    ) -> FieldhouseCompetitionRank? {
        guard participantIDs.contains(userID) else { return nil }
        let score = totals[userID] ?? 0
        let higher = participantIDs.filter { (totals[$0] ?? 0) > score }.count
        let tied = participantIDs.filter { (totals[$0] ?? 0) == score }.count > 1
        return FieldhouseCompetitionRank(place: higher + 1, tied: tied)
    }
}

enum FieldhouseSeasonPhase: String, Codable {
    case preseason = "PRESEASON"
    case regularSeason = "REGULAR SEASON"
    case conferenceChampionships = "CONFERENCE CHAMPIONSHIPS"
    case postseason = "POSTSEASON"
}

enum FieldhouseCardKind: String, Codable {
    case weekly = "weekly"
    case conferenceChampionship = "conference_championship"

    var requiredGameCount: Int {
        self == .conferenceChampionship ? 4 : FieldhouseGameCatalog.weeklyCardSize
    }
    var requiresProp: Bool { self == .weekly }
    var allowsHellfire: Bool { self == .weekly }
    var usesStraightUpScoring: Bool { self == .conferenceChampionship }
}

enum FieldhouseChampionshipConference: String, CaseIterable, Identifiable, Codable {
    case acc
    case big12
    case big10
    case sec

    var id: String { rawValue }
    var displayName: String {
        switch self {
        case .acc: "ACC"
        case .big12: "BIG 12"
        case .big10: "BIG TEN"
        case .sec: "SEC"
        }
    }
}

enum FieldhouseLeague: String, CaseIterable, Identifiable, Codable {
    case ncaam = "NCAAM"
    case ncaaw = "NCAAW"
    var id: String { rawValue }
    var displayName: String { "THE FIELDHOUSE · \(rawValue)" }
    static let activeBuild: FieldhouseLeague = .ncaam

    init(summary: LeagueSummary) {
        let configured = summary.sportSettings?.fieldhouseLeague?.lowercased()
        self = configured == "ncaaw" || summary.sportId.lowercased() == "ncaaw" ? .ncaaw : .ncaam
    }

    var favoriteSportID: String { rawValue.lowercased() }
}

struct FieldhouseAuthenticatedSnapshot {
    let membership: LeagueMembership
    let card: WeekCard?
    let pick: PlayerPick?
    let favoriteTeam: FavoriteTeam?
    let crystalBall: CrystalBallPick?
    var latestScorecard: RegularSeasonScorecard? = nil
    var standings: [Standing] = []
    var scoringCard: WeekCard? = nil
    var scoringPick: PlayerPick? = nil
    var officialField: FieldhouseOfficialField? = nil
    var bracketEntry: FieldhouseBracketEntryRecord? = nil
    var roundEntries: [FieldhouseRoundEntryRecord] = []
    var postseasonTotals: [FieldhousePostseasonTotalRecord] = []
    var postseasonQualifier: FieldhousePostseasonQualifierRecord? = nil
}

private struct FieldhouseRepositoryError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

enum FieldhouseAuthenticatedRepository {
    static func load(
        token: String,
        userID: UUID,
        preferredLeagueID: UUID? = nil
    ) async throws -> FieldhouseAuthenticatedSnapshot {
        let memberships = try await SupabaseAPI.leagueMemberships(token: token, userId: userID)
        let fieldhouse = memberships.filter { membership in
            ["cbb", "ncaam", "ncaaw"].contains(membership.leagues.sportId.lowercased())
        }
        let membership: LeagueMembership?
        if let preferredLeagueID {
            membership = fieldhouse.first { $0.leagueId == preferredLeagueID }
        } else {
            membership = fieldhouse.first
        }
        guard let membership else {
            throw FieldhouseRepositoryError(message: "This account does not belong to a Fieldhouse league.")
        }

        let fieldhouseLeague = FieldhouseLeague(summary: membership.leagues)
        async let card = SupabaseAPI.weekCard(
            token: token,
            leagueId: membership.leagueId,
            weekNumber: membership.leagues.currentWeek
        )
        async let pick = SupabaseAPI.playerPick(
            token: token,
            leagueId: membership.leagueId,
            userId: userID,
            weekNumber: membership.leagues.currentWeek
        )
        async let favorite = SupabaseAPI.favoriteTeam(
            token: token,
            userId: userID,
            sportId: fieldhouseLeague.favoriteSportID
        )
        async let crystal = SupabaseAPI.crystalBallPick(
            token: token,
            leagueId: membership.leagueId,
            userId: userID
        )
        async let scorecards = SupabaseAPI.regularSeasonScorecards(
            token: token,
            leagueId: membership.leagueId,
            userId: userID
        )
        async let standings = SupabaseAPI.standings(token: token, leagueId: membership.leagueId)
        let scoringWeek = membership.leagues.currentWeek - 1
        async let scoringCard: WeekCard? = scoringWeek > 0
            ? SupabaseAPI.weekCard(token: token, leagueId: membership.leagueId, weekNumber: scoringWeek)
            : nil
        async let scoringPick: PlayerPick? = scoringWeek > 0
            ? SupabaseAPI.playerPick(token: token, leagueId: membership.leagueId, userId: userID, weekNumber: scoringWeek)
            : nil

        let loadedScorecards = try await scorecards
        let loadedField = try await SupabaseAPI.fieldhouseOfficialField(
            token: token,
            sportId: fieldhouseLeague.favoriteSportID,
            seasonKey: FieldhouseSeasonCalendar.postseasonSeasonKey
        )
        let loadedBracket: FieldhouseBracketEntryRecord?
        let loadedRounds: [FieldhouseRoundEntryRecord]
        let loadedPostseasonTotals: [FieldhousePostseasonTotalRecord]
        let loadedPostseasonQualifier: FieldhousePostseasonQualifierRecord?
        if let loadedField {
            async let bracket = SupabaseAPI.fieldhouseBracketEntry(
                token: token,
                tournamentId: loadedField.tournamentID,
                leagueId: membership.leagueId,
                userId: userID
            )
            async let rounds = SupabaseAPI.fieldhouseRoundEntries(
                token: token,
                tournamentId: loadedField.tournamentID,
                leagueId: membership.leagueId,
                userId: userID
            )
            async let totals = SupabaseAPI.fieldhousePostseasonTotals(
                token: token,
                tournamentId: loadedField.tournamentID,
                leagueId: membership.leagueId
            )
            async let qualifier = SupabaseAPI.fieldhousePostseasonQualifier(
                token: token,
                tournamentId: loadedField.tournamentID,
                leagueId: membership.leagueId,
                userId: userID
            )
            loadedBracket = try await bracket
            loadedRounds = try await rounds
            loadedPostseasonTotals = try await totals
            loadedPostseasonQualifier = try await qualifier
        } else {
            loadedBracket = nil
            loadedRounds = []
            loadedPostseasonTotals = []
            loadedPostseasonQualifier = nil
        }
        return try await FieldhouseAuthenticatedSnapshot(
            membership: membership,
            card: card,
            pick: pick,
            favoriteTeam: favorite,
            crystalBall: crystal,
            latestScorecard: loadedScorecards.first,
            standings: standings,
            scoringCard: scoringCard,
            scoringPick: scoringPick,
            officialField: loadedField,
            bracketEntry: loadedBracket,
            roundEntries: loadedRounds,
            postseasonTotals: loadedPostseasonTotals,
            postseasonQualifier: loadedPostseasonQualifier
        )
    }

    static func saveSetup(
        token: String,
        userID: UUID,
        membership: LeagueMembership,
        favoriteTeam: String,
        crystalBallChampion: String
    ) async throws {
        let league = FieldhouseLeague(summary: membership.leagues)
        try await SupabaseAPI.saveFavoriteTeam(
            token: token,
            userId: userID,
            sportId: league.favoriteSportID,
            teamId: favoriteTeam
        )
        try await SupabaseAPI.saveCrystalBallPick(
            token: token,
            leagueId: membership.leagueId,
            userId: userID,
            teamName: crystalBallChampion
        )
    }

    static func savePicks(
        token: String,
        membership: LeagueMembership,
        state: FieldhouseSeasonState
    ) async throws -> SavedPickResponse {
        let plan = try FieldhousePickWritePlan(state: state)
        return try await SupabaseAPI.saveWeekPicks(
            token: token,
            leagueId: membership.leagueId,
            weekNumber: state.window,
            picks: plan.picks,
            bestBetGameId: plan.bestBetGameID,
            propChoice: plan.propChoice,
            isChaos: plan.usedHellfire
        )
    }

    static func publishCard(
        token: String,
        membership: LeagueMembership,
        state: FieldhouseSeasonState
    ) async throws {
        if state.cardKind == .conferenceChampionship {
            let plan = try FieldhouseChampionshipCardWritePlan(state: state)
            try await SupabaseAPI.publishFieldhouseChampionshipCard(
                token: token,
                leagueId: membership.leagueId,
                weekNumber: state.window,
                games: plan.games
            )
            return
        }
        let plan = try FieldhouseCardWritePlan(state: state)
        try await SupabaseAPI.publishWeekCard(
            token: token,
            leagueId: membership.leagueId,
            weekNumber: state.window,
            games: plan.games,
            propQuestion: plan.prop.question,
            propA: "YES",
            propB: "NO",
            propPoints: 3
        )
    }

    static func saveFavoriteTeam(token: String, userID: UUID, membership: LeagueMembership, favoriteTeam: String) async throws {
        try await SupabaseAPI.saveFavoriteTeam(
            token: token, userId: userID,
            sportId: FieldhouseLeague(summary: membership.leagues).favoriteSportID,
            teamId: favoriteTeam
        )
    }

    static func selectTrophy(token: String, membership: LeagueMembership, trophyID: String) async throws {
        try await SupabaseAPI.selectChampionshipTrophy(
            token: token, leagueId: membership.leagueId, trophyId: trophyID
        )
    }

    static func saveBracket(token: String, membership: LeagueMembership, state: FieldhouseSeasonState) async throws {
        guard let field = state.officialPostseasonField else {
            throw FieldhouseRepositoryError(message: "The official Selection Sunday field has not been published.")
        }
        guard FieldhouseBracketEngine.progress(picks: state.postseasonBracketPicks, league: state.league, field: field) == 75 else {
            throw FieldhouseRepositoryError(message: "Complete all 75 bracket decisions before filing.")
        }
        _ = try await SupabaseAPI.saveFieldhouseBracket(
            token: token,
            leagueId: membership.leagueId,
            seasonKey: field.seasonKey,
            picks: state.postseasonBracketPicks,
            hellfire: state.bracketHellfireUsed
        )
    }

    static func saveRoundPicks(token: String, membership: LeagueMembership, state: FieldhouseSeasonState) async throws {
        guard let field = state.officialPostseasonField,
              let round = state.activePostseasonRound else {
            throw FieldhouseRepositoryError(message: "No official tournament round is open for picks.")
        }
        let required = field.games.filter { $0.roundKey == round }.count
        let picks = state.postseasonRoundPicks[round] ?? [:]
        guard required > 0, picks.count == required else {
            throw FieldhouseRepositoryError(message: "Pick every game in \(FieldhouseBracketEngine.roundTitle(round)) before filing.")
        }
        _ = try await SupabaseAPI.saveFieldhouseRoundPicks(
            token: token, leagueId: membership.leagueId, seasonKey: field.seasonKey,
            roundKey: round, picks: picks
        )
    }

    static func importOfficialField(token: String, userID: UUID, membership: LeagueMembership, data: Data, publish: Bool) async throws {
        guard AppIdentity.isCreator(userID) else {
            throw FieldhouseRepositoryError(message: "War Room owner access required.")
        }
        let league = FieldhouseLeague(summary: membership.leagues)
        _ = try await SupabaseAPI.importFieldhouseOfficialField(
            token: token, sportId: league.favoriteSportID,
            seasonKey: FieldhouseSeasonCalendar.postseasonSeasonKey,
            fieldData: data, publish: publish
        )
    }

    static func syncOfficialSchedule(token: String, userID: UUID, membership: LeagueMembership, data: Data) async throws {
        guard AppIdentity.isCreator(userID) else {
            throw FieldhouseRepositoryError(message: "War Room owner access required.")
        }
        let league = FieldhouseLeague(summary: membership.leagues)
        _ = try await SupabaseAPI.syncFieldhouseOfficialSchedule(
            token: token, sportId: league.favoriteSportID,
            seasonKey: FieldhouseSeasonCalendar.postseasonSeasonKey,
            fieldData: data
        )
    }
}

struct FieldhouseCardWritePlan {
    let games: [[String: Any]]
    let prop: FieldhousePropKind

    init(state: FieldhouseSeasonState) throws {
        guard state.isCommissioner,
              state.cardIsPublished,
              state.publishedGames.count == FieldhouseGameCatalog.weeklyCardSize,
              let prop = state.publishedProp else {
            throw FieldhouseRepositoryError(message: "Choose exactly ten games and an automatic prop before publishing the card.")
        }
        let formatter = ISO8601DateFormatter()
        self.games = try state.publishedGames.enumerated().map { index, game in
            guard let favorite = game.favoriteTeam,
                  let spread = game.favoriteSpread,
                  spread < 0,
                  FieldhouseSpreadRule.isHalfPoint(spread),
                  favorite == game.away || favorite == game.home else {
                throw FieldhouseRepositoryError(message: "Every Fieldhouse game needs a valid favorite and half-point spread.")
            }
            let favoriteSide = favorite == game.away ? "away" : "home"
            return [
                "sort_order": index,
                "away_team": game.away,
                "home_team": game.home,
                "spread": spread,
                "favorite": favoriteSide,
                "start_time": formatter.string(from: game.tipDate(in: state.window)),
                "bookmaker": game.bookmaker ?? "Fieldhouse",
                "away_rank": NSNull(),
                "home_rank": NSNull(),
                "is_rivalry": false
            ]
        }
        self.prop = prop
    }
}

struct FieldhouseChampionshipCardWritePlan {
    let games: [[String: Any]]

    init(state: FieldhouseSeasonState) throws {
        guard state.isCommissioner,
              state.cardKind == .conferenceChampionship,
              state.cardIsPublished,
              state.publishedGames.count == FieldhouseCardKind.conferenceChampionship.requiredGameCount,
              Set(state.publishedGames.compactMap(\.championshipConference)) == Set(FieldhouseChampionshipConference.allCases) else {
            throw FieldhouseRepositoryError(message: "Publish exactly one ACC, Big 12, Big Ten, and SEC championship game.")
        }
        let formatter = ISO8601DateFormatter()
        self.games = try state.publishedGames.enumerated().map { index, game in
            guard let conference = game.championshipConference else {
                throw FieldhouseRepositoryError(message: "Every Championship Week game needs its conference label.")
            }
            return [
                "sort_order": index,
                "away_team": game.away,
                "home_team": game.home,
                "start_time": formatter.string(from: game.tipDate(in: state.window)),
                "bookmaker": game.bookmaker ?? "Fieldhouse",
                "conference_key": conference.rawValue,
                "away_rank": NSNull(),
                "home_rank": NSNull()
            ]
        }
    }
}

enum FieldhouseReleaseGate {
    // Keep the live route dark until authenticated writes, scoring, and the
    // complete NCAAM/NCAAW release checklist have all passed.
    static let isEnabled = false

    static func supports(sportID: String) -> Bool {
        ["cbb", "ncaam", "ncaaw"].contains(sportID.lowercased())
    }

    static func shouldRoute(sportID: String) -> Bool {
        isEnabled && supports(sportID: sportID)
    }
}

private struct FieldhouseLiveContext {
    let token: String
    let userID: UUID
    let membership: LeagueMembership
    let standings: [Standing]
}

private enum FieldhousePersistenceEvent {
    case setup, publishCard, picks, trophy, favoriteTeam, bracket, postseasonRound
    case importOfficialField(Data, publish: Bool)
    case syncOfficialSchedule(Data)
}

private struct FieldhousePersistenceActionKey: EnvironmentKey {
    static let defaultValue: (FieldhousePersistenceEvent) -> Void = { _ in }
}

private struct FieldhouseStandingsKey: EnvironmentKey {
    static let defaultValue: [Standing] = []
}

private extension EnvironmentValues {
    var fieldhousePersist: (FieldhousePersistenceEvent) -> Void {
        get { self[FieldhousePersistenceActionKey.self] }
        set { self[FieldhousePersistenceActionKey.self] = newValue }
    }
    var fieldhouseStandings: [Standing] {
        get { self[FieldhouseStandingsKey.self] }
        set { self[FieldhouseStandingsKey.self] = newValue }
    }
}

struct FieldhouseAuthenticatedContainer: View {
    @EnvironmentObject private var auth: AuthStore
    @Binding var notificationDestination: WarRoomNotificationRoute?
    @State private var phase: Phase = .loading

    private enum Phase {
        case loading
        case ready(FieldhouseSeasonState, FieldhouseStateScope, FieldhouseLiveContext)
        case failed(String)
    }

    var body: some View {
        Group {
            switch phase {
            case .loading:
                ZStack {
                    FieldhouseBackdrop().ignoresSafeArea()
                    ProgressView("Opening the Fieldhouse…")
                        .tint(.orange)
                }
            case .ready(let state, let scope, let context):
                FieldhouseNativePreviewView(
                    authenticatedState: state,
                    scope: scope,
                    liveContext: context,
                    notificationDestination: $notificationDestination
                )
            case .failed(let message):
                ZStack {
                    FieldhouseBackdrop().ignoresSafeArea()
                    ContentUnavailableView {
                        Label("Can’t open the Fieldhouse", systemImage: "basketball.fill")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("TRY AGAIN") { Task { await load() } }
                            .buttonStyle(.borderedProminent)
                            .tint(.orange)
                    }
                }
            }
        }
        .task(id: "\(auth.user?.id.uuidString ?? "signed-out")|\(auth.selectedLeagueId?.uuidString ?? "none")") {
            await load()
        }
    }

    @MainActor private func load() async {
        guard let user = auth.user else { return }
        phase = .loading
        do {
            let token = try await auth.validAccessToken()
            let snapshot = try await FieldhouseAuthenticatedRepository.load(
                token: token,
                userID: user.id,
                preferredLeagueID: auth.selectedLeagueId
            )
            let scope = FieldhouseStateScope(userID: user.id, leagueID: snapshot.membership.leagueId)
            let cached = FieldhouseStateStore().load(scope: scope)
            phase = .ready(
                FieldhouseStateHydrator.hydrate(snapshot: snapshot, userID: user.id, cached: cached),
                scope,
                FieldhouseLiveContext(token: token, userID: user.id, membership: snapshot.membership, standings: snapshot.standings)
            )
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

struct FieldhousePickWritePlan {
    let picks: [PickSubmission]
    let bestBetGameID: UUID
    let propChoice: String?
    let usedHellfire: Bool

    init(state: FieldhouseSeasonState) throws {
        let required = state.cardKind.requiredGameCount
        guard state.cardIsComplete, state.publishedGames.count == required,
              let bestBetIndex = state.bestBetGame,
              state.publishedGames.indices.contains(bestBetIndex),
              let bestBetID = UUID(uuidString: state.publishedGames[bestBetIndex].id) else {
            throw FieldhouseRepositoryError(message: state.cardKind == .conferenceChampionship
                ? "Pick all four champions, use confidence 4–3–2–1 once each, and mark one Best Bet."
                : "Complete all ten picks, confidence points, Best Bet, and the prop before locking the card.")
        }
        if state.cardKind.requiresProp && state.propAnswer == nil {
            throw FieldhouseRepositoryError(message: "Answer the floor prop before locking the card.")
        }

        let picks = try state.publishedGames.enumerated().map { index, game -> PickSubmission in
            guard let gameID = UUID(uuidString: game.id),
                  let selectedTeam = state.sideSelections[index],
                  let confidence = state.confidenceSelections[index] else {
                throw FieldhouseRepositoryError(message: "This card contains a game that cannot be saved. Pull a fresh card and try again.")
            }
            let side: String
            if selectedTeam == game.away { side = "away" }
            else if selectedTeam == game.home { side = "home" }
            else { throw FieldhouseRepositoryError(message: "One of your selected teams is not on the published card. Reopen that matchup and choose again.") }
            return PickSubmission(gameId: gameID, side: side, confidence: confidence)
        }
        self.picks = picks
        self.bestBetGameID = bestBetID
        self.propChoice = state.propAnswer
        self.usedHellfire = state.cardKind.allowsHellfire && state.hellfireDeployedOnCurrentCard
    }
}

struct FieldhouseTrophyOption: Identifiable, Equatable {
    let id: String
    let name: String
    let detail: String
    let asset: String
}

enum FieldhouseTrophyCatalog {
    static let ncaam = [
        FieldhouseTrophyOption(id: "m-iron-rim", name: "The Iron Rim", detail: "Nobody came through the lane clean.", asset: "FieldhouseMTheIronRim"),
        FieldhouseTrophyOption(id: "m-net-cutter", name: "The Net Cutter", detail: "Bring your own ladder.", asset: "FieldhouseMTheNetCutter"),
        FieldhouseTrophyOption(id: "m-hardwood-crown", name: "The Hardwood Crown", detail: "The court belongs to one room.", asset: "FieldhouseMTheHardwoodCrown"),
        FieldhouseTrophyOption(id: "m-final-possession", name: "The Final Possession", detail: "The clock reached zero. You did not.", asset: "FieldhouseMTheFinalPossession"),
        FieldhouseTrophyOption(id: "m-glass-house", name: "The Glass House", detail: "Own the boards. Own the room.", asset: "FieldhouseMTheGlassHouse"),
        FieldhouseTrophyOption(id: "m-fieldhouse-cup", name: "The Fieldhouse Cup", detail: "Old building. Permanent address.", asset: "FieldhouseMTheFieldhouseCup")
    ]
    static let ncaaw = [
        FieldhouseTrophyOption(id: "w-pure-game", name: "The Pure Game", detail: "The version with footwork.", asset: "FieldhouseWThePureGame"),
        FieldhouseTrophyOption(id: "w-extra-pass", name: "The Extra Pass", detail: "Apparently all five players can touch the ball.", asset: "FieldhouseWTheExtraPass"),
        FieldhouseTrophyOption(id: "w-94-feet", name: "Ninety-Four Feet", detail: "Every possession. The entire floor.", asset: "FieldhouseWNinetyFourFeet"),
        FieldhouseTrophyOption(id: "w-nylon-standard", name: "The Nylon Standard", detail: "Backboard optional.", asset: "FieldhouseWTheNylonStandard"),
        FieldhouseTrophyOption(id: "w-forty-minutes", name: "Forty Minutes", detail: "No hero-ball exemption.", asset: "FieldhouseWFortyMinutes"),
        FieldhouseTrophyOption(id: "w-better-bracket", name: "The Better Bracket", detail: "We said what we said.", asset: "FieldhouseWTheBetterBracket")
    ]
    static func options(for league: FieldhouseLeague) -> [FieldhouseTrophyOption] { league == .ncaam ? ncaam : ncaaw }
}

enum FieldhouseLateEntryRule {
    static func entryScore(existingScores: [Int]) -> Int {
        guard !existingScores.isEmpty else { return 0 }
        let sampleCount = max(1, Int(ceil(Double(existingScores.count) * 0.15)))
        let bottom = existingScores.sorted().prefix(sampleCount)
        return Int((Double(bottom.reduce(0, +)) / Double(bottom.count)).rounded())
    }

    static func acceptsEntries(during phase: FieldhouseSeasonPhase) -> Bool { phase != .postseason }
}

enum FieldhouseRegion: String, CaseIterable, Identifiable, Codable {
    case east = "EAST"
    case west = "WEST"
    case south = "SOUTH"
    case midwest = "MIDWEST"
    var id: String { rawValue }

    var regionalTrophyAsset: String {
        switch self {
        case .east: "FieldhouseRegionalEast"
        case .west: "FieldhouseRegionalWest"
        case .south: "FieldhouseRegionalSouth"
        case .midwest: "FieldhouseRegionalMidwest"
        }
    }

    var regionalTrophyName: String {
        switch self {
        case .east: "The First Light"
        case .west: "The Last Horizon"
        case .south: "The Magnolia Rim"
        case .midwest: "The Steel Standard"
        }
    }
}

enum FieldhousePostseasonRound: String, CaseIterable, Identifiable, Codable {
    case openingRound = "BUY-IN"
    case roundOf64 = "ROUND OF 64"
    case roundOf32 = "ROUND OF 32"
    case sweet16 = "SWEET 16"
    case elite8 = "ELITE EIGHT"
    case finalFour = "FINAL FOUR"
    case championship = "CHAMPIONSHIP"

    var id: String { rawValue }
    var gameCount: Int {
        switch self {
        case .openingRound: 12
        case .roundOf64: 32
        case .roundOf32: 16
        case .sweet16: 8
        case .elite8: 4
        case .finalFour: 2
        case .championship: 1
        }
    }
}

struct FieldhousePostseasonScore: Equatable {
    let bracketPredictionPoints: Int
    let roundPickPoints: Int

    var trophyPoints: Int { bracketPredictionPoints + roundPickPoints }
}

enum FieldhouseRegionalRaceRule {
    static func isMathematicallyAlive(score: Int, leaderScore: Int, remainingAvailablePoints: Int) -> Bool {
        score + max(0, remainingAvailablePoints) >= leaderScore
    }

    static func orderedSeeds<T>(
        _ entries: [T],
        buyInPoints: (T) -> Int,
        regularSeasonRank: (T) -> Int
    ) -> [T] {
        entries.sorted {
            let leftPoints = buyInPoints($0)
            let rightPoints = buyInPoints($1)
            if leftPoints != rightPoints { return leftPoints > rightPoints }
            return regularSeasonRank($0) < regularSeasonRank($1)
        }
    }
}

enum FieldhouseTeamCatalog {
    // Shared Division I institutional baseline; NCAAW applies women-specific program names and membership.
    static let all: [String] = raw.split(separator: "|").map(String.init)
    static func teams(for league: FieldhouseLeague) -> [String] {
        guard league == .ncaaw else { return all }
        let replacements = Dictionary(uniqueKeysWithValues: ncaawNamePairs)
        let removed = Set(["Mercyhurst Lakers", "The Citadel Bulldogs", "VMI Keydets"])
        let renamed = all.compactMap { team -> String? in
            guard !removed.contains(team) else { return nil }
            return replacements[team] ?? team
        }
        return (renamed + ["Lindenwood Lions", "Queens University Royals", "Southern Indiana Screaming Eagles"]).sorted()
    }

    static func displayName(forStoredID storedID: String, league: FieldhouseLeague) -> String? {
        let wanted = FootballTeamCatalog.normalizedTeamId(storedID)
        return teams(for: league).first {
            FootballTeamCatalog.normalizedTeamId($0) == wanted
        }
    }

    private static let ncaawNamePairs: [(String, String)] = [
        ("Alabama State Hornets", "Alabama State Lady Hornets"),
        ("Alcorn State Braves", "Alcorn State Lady Braves"),
        ("East Tennessee State Buccaneers", "East Tennessee State Bucs"),
        ("Georgia Bulldogs", "Georgia Lady Bulldogs"),
        ("Grambling Tigers", "Grambling Lady Tigers"),
        ("Hampton Pirates", "Hampton Lady Pirates"),
        ("Jackson State Tigers", "Jackson State Lady Tigers"),
        ("Louisiana Tech Bulldogs", "Louisiana Tech Lady Techsters"),
        ("Massachusetts Minutemen", "Massachusetts Minutewomen"),
        ("McNeese Cowboys", "McNeese Cowgirls"),
        ("Mississippi Valley State Delta Devils", "Mississippi Valley State Devilettes"),
        ("Missouri State Bears", "Missouri State Lady Bears"),
        ("Montana Grizzlies", "Montana Lady Griz"),
        ("Morgan State Bears", "Morgan State Lady Bears"),
        ("Northwestern State Demons", "Northwestern State Lady Demons"),
        ("Oklahoma State Cowboys", "Oklahoma State Cowgirls"),
        ("Penn State Nittany Lions", "Penn State Lady Lions"),
        ("Prairie View A&M Panthers", "Prairie View A&M Lady Panthers"),
        ("SE Louisiana Lions", "SE Louisiana Lady Lions"),
        ("South Carolina State Bulldogs", "South Carolina State Lady Bulldogs"),
        ("Southern Miss Golden Eagles", "Southern Miss Lady Eagles"),
        ("Stephen F. Austin Lumberjacks", "Stephen F. Austin Ladyjacks"),
        ("Tennessee State Tigers", "Tennessee State Lady Tigers"),
        ("Tennessee Volunteers", "Tennessee Lady Volunteers"),
        ("Texas Tech Red Raiders", "Texas Tech Lady Raiders"),
        ("UNLV Rebels", "UNLV Lady Rebels"),
        ("Western Kentucky Hilltoppers", "Western Kentucky Lady Toppers"),
        ("Wyoming Cowboys", "Wyoming Cowgirls")
    ]
    private static let raw = "Abilene Christian Wildcats|Air Force Falcons|Akron Zips|Alabama A&M Bulldogs|Alabama Crimson Tide|Alabama State Hornets|Alcorn State Braves|American University Eagles|App State Mountaineers|Arizona State Sun Devils|Arizona Wildcats|Arkansas Razorbacks|Arkansas State Red Wolves|Arkansas-Pine Bluff Golden Lions|Army Black Knights|Auburn Tigers|Austin Peay Governors|BYU Cougars|Ball State Cardinals|Baylor Bears|Bellarmine Knights|Belmont Bruins|Bethune-Cookman Wildcats|Binghamton Bearcats|Boise State Broncos|Boston College Eagles|Boston University Terriers|Bowling Green Falcons|Bradley Braves|Brown Bears|Bryant Bulldogs|Bucknell Bison|Buffalo Bulls|Butler Bulldogs|Cal Poly Mustangs|Cal State Bakersfield Roadrunners|Cal State Fullerton Titans|Cal State Northridge Matadors|California Baptist Lancers|California Golden Bears|Campbell Fighting Camels|Canisius Golden Griffins|Central Arkansas Bears|Central Connecticut Blue Devils|Central Michigan Chippewas|Charleston Cougars|Charleston Southern Buccaneers|Charlotte 49ers|Chattanooga Mocs|Chicago State Cougars|Cincinnati Bearcats|Clemson Tigers|Cleveland State Vikings|Coastal Carolina Chanticleers|Colgate Raiders|Colorado Buffaloes|Colorado State Rams|Columbia Lions|Coppin State Eagles|Cornell Big Red|Creighton Bluejays|Dartmouth Big Green|Davidson Wildcats|Dayton Flyers|DePaul Blue Demons|Delaware Blue Hens|Delaware State Hornets|Denver Pioneers|Detroit Mercy Titans|Drake Bulldogs|Drexel Dragons|Duke Blue Devils|Duquesne Dukes|East Carolina Pirates|East Tennessee State Buccaneers|East Texas A&M Lions|Eastern Illinois Panthers|Eastern Kentucky Colonels|Eastern Michigan Eagles|Eastern Washington Eagles|Elon Phoenix|Evansville Purple Aces|Fairfield Stags|Fairleigh Dickinson Knights|Florida A&M Rattlers|Florida Atlantic Owls|Florida Gators|Florida Gulf Coast Eagles|Florida International Panthers|Florida State Seminoles|Fordham Rams|Fresno State Bulldogs|Furman Paladins|Gardner-Webb Runnin' Bulldogs|George Mason Patriots|George Washington Revolutionaries|Georgetown Hoyas|Georgia Bulldogs|Georgia Southern Eagles|Georgia State Panthers|Georgia Tech Yellow Jackets|Gonzaga Bulldogs|Grambling Tigers|Grand Canyon Lopes|Green Bay Phoenix|Hampton Pirates|Harvard Crimson|Hawai'i Rainbow Warriors|High Point Panthers|Hofstra Pride|Holy Cross Crusaders|Houston Christian Huskies|Houston Cougars|Howard Bison|IU Indianapolis Jaguars|Idaho State Bengals|Idaho Vandals|Illinois Fighting Illini|Illinois State Redbirds|Incarnate Word Cardinals|Indiana Hoosiers|Indiana State Sycamores|Iona Gaels|Iowa Hawkeyes|Iowa State Cyclones|Jackson State Tigers|Jacksonville Dolphins|Jacksonville State Gamecocks|James Madison Dukes|Kansas City Roos|Kansas Jayhawks|Kansas State Wildcats|Kennesaw State Owls|Kent State Golden Flashes|Kentucky Wildcats|LSU New Orleans Privateers|LSU Tigers|La Salle Explorers|Lafayette Leopards|Lamar Cardinals|Le Moyne Dolphins|Lehigh Mountain Hawks|Liberty Flames|Lipscomb Bisons|Little Rock Trojans|Long Beach State Beach|Long Island University Sharks|Longwood Lancers|Louisiana Ragin' Cajuns|Louisiana Tech Bulldogs|Louisville Cardinals|Loyola Chicago Ramblers|Loyola Maryland Greyhounds|Loyola Marymount Lions|Maine Black Bears|Manhattan Jaspers|Marist Red Foxes|Marquette Golden Eagles|Marshall Thundering Herd|Maryland Eastern Shore Hawks|Maryland Terrapins|Massachusetts Minutemen|McNeese Cowboys|Memphis Tigers|Mercer Bears|Mercyhurst Lakers|Merrimack Warriors|Miami (OH) RedHawks|Miami Hurricanes|Michigan State Spartans|Michigan Wolverines|Middle Tennessee Blue Raiders|Milwaukee Panthers|Minnesota Golden Gophers|Mississippi State Bulldogs|Mississippi Valley State Delta Devils|Missouri State Bears|Missouri Tigers|Monmouth Hawks|Montana Grizzlies|Montana State Bobcats|Morehead State Eagles|Morgan State Bears|Mount St. Mary's Mountaineers|Murray State Racers|NC State Wolfpack|NJIT Highlanders|Navy Midshipmen|Nebraska Cornhuskers|Nevada Wolf Pack|New Hampshire Wildcats|New Haven Chargers|New Mexico Lobos|New Mexico State Aggies|Niagara Purple Eagles|Nicholls Colonels|Norfolk State Spartans|North Alabama Lions|North Carolina A&T Aggies|North Carolina Central Eagles|North Carolina Tar Heels|North Dakota Fighting Hawks|North Dakota State Bison|North Florida Ospreys|North Texas Mean Green|Northeastern Huskies|Northern Arizona Lumberjacks|Northern Colorado Bears|Northern Illinois Huskies|Northern Iowa Panthers|Northern Kentucky Norse|Northwestern State Demons|Northwestern Wildcats|Notre Dame Fighting Irish|Oakland Golden Grizzlies|Ohio Bobcats|Ohio State Buckeyes|Oklahoma Sooners|Oklahoma State Cowboys|Old Dominion Monarchs|Ole Miss Rebels|Omaha Mavericks|Oral Roberts Golden Eagles|Oregon Ducks|Oregon State Beavers|Pacific Tigers|Penn State Nittany Lions|Pennsylvania Quakers|Pepperdine Waves|Pittsburgh Panthers|Portland Pilots|Portland State Vikings|Prairie View A&M Panthers|Presbyterian Blue Hose|Princeton Tigers|Providence Friars|Purdue Boilermakers|Purdue Fort Wayne Mastodons|Quinnipiac Bobcats|Radford Highlanders|Rhode Island Rams|Rice Owls|Richmond Spiders|Rider Broncs|Robert Morris Colonials|Rutgers Scarlet Knights|SE Louisiana Lions|SIU Edwardsville Cougars|SMU Mustangs|Sacramento State Hornets|Sacred Heart Pioneers|Saint Joseph's Hawks|Saint Louis Billikens|Saint Mary's Gaels|Saint Peter's Peacocks|Sam Houston Bearkats|Samford Bulldogs|San Diego State Aztecs|San Diego Toreros|San Francisco Dons|San José State Spartans|Santa Clara Broncos|Seattle U Redhawks|Seton Hall Pirates|Siena Saints|South Alabama Jaguars|South Carolina Gamecocks|South Carolina State Bulldogs|South Carolina Upstate Spartans|South Dakota Coyotes|South Dakota State Jackrabbits|South Florida Bulls|Southeast Missouri State Redhawks|Southern Illinois Salukis|Southern Jaguars|Southern Miss Golden Eagles|Southern Utah Thunderbirds|St. Bonaventure Bonnies|St. John's Red Storm|St. Thomas Tommies|Stanford Cardinal|Stephen F. Austin Lumberjacks|Stetson Hatters|Stonehill Skyhawks|Stony Brook Seawolves|Syracuse Orange|TCU Horned Frogs|Tarleton State Texans|Temple Owls|Tennessee State Tigers|Tennessee Tech Golden Eagles|Tennessee Volunteers|Texas A&M Aggies|Texas A&M-Corpus Christi Islanders|Texas Longhorns|Texas Southern Tigers|Texas State Bobcats|Texas Tech Red Raiders|The Citadel Bulldogs|Toledo Rockets|Towson Tigers|Troy Trojans|Tulane Green Wave|Tulsa Golden Hurricane|UAB Blazers|UAlbany Great Danes|UC Davis Aggies|UC Irvine Anteaters|UC Riverside Highlanders|UC San Diego Tritons|UC Santa Barbara Gauchos|UCF Knights|UCLA Bruins|UConn Huskies|UIC Flames|UL Monroe Warhawks|UMBC Retrievers|UMass Lowell River Hawks|UNC Asheville Bulldogs|UNC Greensboro Spartans|UNC Wilmington Seahawks|UNLV Rebels|USC Trojans|UT Arlington Mavericks|UT Martin Skyhawks|UT Rio Grande Valley Vaqueros|UTEP Miners|UTSA Roadrunners|Utah State Aggies|Utah Tech Trailblazers|Utah Utes|Utah Valley Wolverines|VCU Rams|VMI Keydets|Valparaiso Beacons|Vanderbilt Commodores|Vermont Catamounts|Villanova Wildcats|Virginia Cavaliers|Virginia Tech Hokies|Wagner Seahawks|Wake Forest Demon Deacons|Washington Huskies|Washington State Cougars|Weber State Wildcats|West Florida Argonauts|West Georgia Wolves|West Virginia Mountaineers|Western Carolina Catamounts|Western Illinois Leathernecks|Western Kentucky Hilltoppers|Western Michigan Broncos|Wichita State Shockers|William & Mary Tribe|Winthrop Eagles|Wisconsin Badgers|Wofford Terriers|Wright State Raiders|Wyoming Cowboys|Xavier Musketeers|Yale Bulldogs|Youngstown State Penguins"
}

enum FieldhouseDesk: String, CaseIterable, Identifiable {
    case home = "Home"
    case picks = "Picks"
    case standings = "Standings"
    case locker = "Locker"
    case profile = "You"
    var id: String { rawValue }
    var icon: String {
        switch self {
        case .home: "house.fill"
        case .picks: "basketball.fill"
        case .standings: "list.number"
        case .locker: "bubble.left.and.bubble.right.fill"
        case .profile: "person.crop.circle.fill"
        }
    }
}

struct FieldhouseGame: Identifiable, Equatable, Codable {
    let id: String
    let away: String
    let home: String
    let spread: String
    let tip: String
    let dayOffset: Int
    let tipHour: Int
    let tipMinute: Int
    let bookmaker: String?
    let championshipConference: FieldhouseChampionshipConference?

    init(id: String, away: String, home: String, spread: String, tip: String, dayOffset: Int = 3, tipHour: Int = 19, tipMinute: Int = 0, bookmaker: String? = nil, championshipConference: FieldhouseChampionshipConference? = nil) {
        self.id = id
        self.away = away
        self.home = home
        self.spread = spread
        self.tip = tip
        self.dayOffset = dayOffset
        self.tipHour = tipHour
        self.tipMinute = tipMinute
        self.bookmaker = bookmaker
        self.championshipConference = championshipConference
    }

    func tipDate(in window: Int) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = FieldhouseSeasonCalendar.eastern
        let day = calendar.date(byAdding: .day, value: dayOffset, to: FieldhouseSeasonCalendar.start(of: window))!
        return calendar.date(bySettingHour: tipHour, minute: tipMinute, second: 0, of: day)!
    }

    func displayTip(in window: Int) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = FieldhouseSeasonCalendar.eastern
        formatter.dateFormat = "EEE MMM d · h:mm a z"
        return formatter.string(from: tipDate(in: window)).uppercased()
    }

    var favoriteTeam: String? {
        let pieces = spread.split(separator: " ")
        guard pieces.count > 1, Double(pieces.last ?? "") != nil else { return nil }
        let favoriteLabel = pieces.dropLast().joined(separator: " ")
        if away.localizedCaseInsensitiveCompare(favoriteLabel) == .orderedSame || away.localizedCaseInsensitiveContains(favoriteLabel) { return away }
        if home.localizedCaseInsensitiveCompare(favoriteLabel) == .orderedSame || home.localizedCaseInsensitiveContains(favoriteLabel) { return home }
        return nil
    }

    var underdogTeam: String? {
        guard let favoriteTeam else { return nil }
        if favoriteTeam == away { return home }
        if favoriteTeam == home { return away }
        return nil
    }

    var favoriteSpread: Double? { Double(spread.split(separator: " ").last ?? "") }
}

enum FieldhouseSpreadRule {
    static func isHalfPoint(_ spread: Double) -> Bool {
        let magnitude = abs(spread)
        return abs((magnitude - floor(magnitude)) - 0.5) < 0.000_1
    }
}

extension FieldhouseGame {
    func assigned(to conference: FieldhouseChampionshipConference) -> FieldhouseGame {
        FieldhouseGame(
            id: id, away: away, home: home, spread: spread, tip: tip,
            dayOffset: dayOffset, tipHour: tipHour, tipMinute: tipMinute,
            bookmaker: bookmaker, championshipConference: conference
        )
    }

    init?(oddsGame: OddsGame, window: Int) {
        guard let rawTip = oddsGame.commenceTime,
              let tipDate = footballKickoffDate(rawTip),
              ["home", "away"].contains(oddsGame.favorite.lowercased()),
              FieldhouseSpreadRule.isHalfPoint(oddsGame.spread) else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = FieldhouseSeasonCalendar.eastern
        let windowStart = FieldhouseSeasonCalendar.start(of: window)
        let dayOffset = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: windowStart),
            to: calendar.startOfDay(for: tipDate)
        ).day ?? -1
        guard (0...6).contains(dayOffset) else { return nil }
        let favorite = oddsGame.favorite.lowercased() == "away" ? oddsGame.awayTeam : oddsGame.homeTeam
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = FieldhouseSeasonCalendar.eastern
        formatter.dateFormat = "EEE · h:mm a"
        self.init(
            id: oddsGame.id,
            away: oddsGame.awayTeam,
            home: oddsGame.homeTeam,
            spread: "\(favorite) \((-abs(oddsGame.spread)).formatted(.number.precision(.fractionLength(1))))",
            tip: formatter.string(from: tipDate).uppercased(),
            dayOffset: dayOffset,
            tipHour: calendar.component(.hour, from: tipDate),
            tipMinute: calendar.component(.minute, from: tipDate),
            bookmaker: oddsGame.bookmaker,
            championshipConference: nil
        )
    }

    init(cardGame: CardGame, window: Int) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = FieldhouseSeasonCalendar.eastern
        let parsedTip = footballKickoffDate(cardGame.startTime)
        let windowStart = FieldhouseSeasonCalendar.start(of: window)
        let dayOffset = parsedTip.map {
            calendar.dateComponents(
                [.day],
                from: calendar.startOfDay(for: windowStart),
                to: calendar.startOfDay(for: $0)
            ).day ?? 0
        } ?? 0
        let hour = parsedTip.map { calendar.component(.hour, from: $0) } ?? 19
        let minute = parsedTip.map { calendar.component(.minute, from: $0) } ?? 0
        let tip = parsedTip.map { date in
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = FieldhouseSeasonCalendar.eastern
            formatter.dateFormat = "EEE MMM d · h:mm a z"
            return formatter.string(from: date).uppercased()
        } ?? "TIP TIME PENDING"
        let storedFavorite = cardGame.favorite.trimmingCharacters(in: .whitespacesAndNewlines)
        let favorite: String
        switch storedFavorite.lowercased() {
        case "away": favorite = cardGame.awayTeam
        case "home": favorite = cardGame.homeTeam
        default: favorite = storedFavorite
        }
        let line = -abs(cardGame.spread)

        self.init(
            id: cardGame.id.uuidString.lowercased(),
            away: cardGame.awayTeam,
            home: cardGame.homeTeam,
            spread: "\(favorite) \(line.formatted(.number.precision(.fractionLength(1))))",
            tip: tip,
            dayOffset: dayOffset,
            tipHour: hour,
            tipMinute: minute,
            bookmaker: cardGame.bookmaker,
            championshipConference: cardGame.fieldhouseConference.flatMap(FieldhouseChampionshipConference.init(rawValue:))
        )
    }
}

enum FieldhousePickVisibility {
    static func canSeeRoomPicks(at now: Date, gameTip: Date) -> Bool { now >= gameTip }
}

enum FieldhouseGamePhase: Equatable, Codable {
    case scheduled
    case live(period: String)
    case final
}

struct FieldhouseGameResult: Equatable, Codable {
    let gameID: String
    let awayScore: Int
    let homeScore: Int
    let phase: FieldhouseGamePhase

    var isFinal: Bool { phase == .final }

    func straightUpWinner(in game: FieldhouseGame) -> String? {
        guard isFinal, awayScore != homeScore else { return nil }
        return awayScore > homeScore ? game.away : game.home
    }

    func projectedStraightUpLeader(in game: FieldhouseGame) -> String? {
        guard awayScore != homeScore else { return nil }
        return awayScore > homeScore ? game.away : game.home
    }


    func coverWinner(in game: FieldhouseGame) -> String? {
        guard isFinal, let favorite = game.favoriteTeam, let line = game.favoriteSpread,
              let underdog = game.underdogTeam else { return nil }
        return coverLeader(in: game, favorite: favorite, line: line, underdog: underdog)
    }

    func projectedCoverWinner(in game: FieldhouseGame) -> String? {
        guard let favorite = game.favoriteTeam, let line = game.favoriteSpread,
              let underdog = game.underdogTeam else { return nil }
        return coverLeader(in: game, favorite: favorite, line: line, underdog: underdog)
    }

    private func coverLeader(in game: FieldhouseGame, favorite: String, line: Double, underdog: String) -> String? {
        let favoriteScore = favorite == game.away ? awayScore : homeScore
        let underdogScore = underdog == game.away ? awayScore : homeScore
        let adjustedFavoriteScore = Double(favoriteScore) + line
        guard adjustedFavoriteScore != Double(underdogScore) else { return nil }
        return adjustedFavoriteScore > Double(underdogScore) ? favorite : underdog
    }
}

enum FieldhousePropEvaluator {
    static func answer(for prop: FieldhousePropKind, games: [FieldhouseGame], results: [String: FieldhouseGameResult]) -> Bool? {
        let completed = games.compactMap { game -> (FieldhouseGame, FieldhouseGameResult)? in
            guard let result = results[game.id], result.isFinal else { return nil }
            return (game, result)
        }
        guard completed.count == games.count, !games.isEmpty else { return nil }

        switch prop {
        case .teamScores90:
            return completed.contains { $0.1.awayScore >= 90 || $0.1.homeScore >= 90 }
        case .gameWithinThree:
            return completed.contains { abs($0.1.awayScore - $0.1.homeScore) <= 3 }
        case .underdogWins:
            return completed.contains { item in item.1.straightUpWinner(in: item.0) == item.0.underdogTeam }
        case .combinedScore150:
            return completed.contains { $0.1.awayScore + $0.1.homeScore >= 150 }
        case .teamScores100:
            return completed.contains { $0.1.awayScore >= 100 || $0.1.homeScore >= 100 }
        case .bothTeamsScore75:
            return completed.contains { $0.1.awayScore >= 75 && $0.1.homeScore >= 75 }
        case .winningMargin20:
            return completed.contains { abs($0.1.awayScore - $0.1.homeScore) >= 20 }
        case .threeUnderdogsWin:
            return completed.filter { item in item.1.straightUpWinner(in: item.0) == item.0.underdogTeam }.count >= 3
        case .sixFavoritesCover:
            return completed.filter { item in item.1.coverWinner(in: item.0) == item.0.favoriteTeam }.count >= 6
        case .everyGameReaches130:
            return completed.allSatisfy { $0.1.awayScore + $0.1.homeScore >= 130 }
        }
    }
}

enum FieldhouseScoreEngine {
    static func points(
        games: [FieldhouseGame],
        results: [String: FieldhouseGameResult],
        selections: [Int: String],
        confidences: [Int: Int],
        bestBetGame: Int?,
        prop: FieldhousePropKind?,
        propAnswer: String?,
        gameMultiplier: Int = 1,
        cardKind: FieldhouseCardKind = .weekly
    ) -> Int {
        var total = 0
        let effectiveGameMultiplier = cardKind.allowsHellfire ? gameMultiplier : 1
        for (index, game) in games.enumerated() {
            guard let result = results[game.id],
                  let winner = cardKind.usesStraightUpScoring
                    ? result.straightUpWinner(in: game)
                    : result.coverWinner(in: game),
                  selections[index] == winner, let confidence = confidences[index] else { continue }
            total += confidence * (bestBetGame == index ? 2 : 1) * effectiveGameMultiplier
        }
        if cardKind.requiresProp, let prop, let propAnswer,
           let correctAnswer = FieldhousePropEvaluator.answer(for: prop, games: games, results: results),
           propAnswer == (correctAnswer ? "YES" : "NO") {
            total += 3
        }
        return total
    }
}

enum FieldhouseLiveStandingsEngine {
    static func projectedTotals(
        standings: [Standing],
        board: [FieldhouseLiveBoardPick],
        games: [FieldhouseGame],
        results: [String: FieldhouseGameResult],
        prop: FieldhousePropKind?,
        cardKind: FieldhouseCardKind = .weekly
    ) -> [UUID: Int] {
        let indexedGames = Dictionary(uniqueKeysWithValues: games.enumerated().compactMap { index, game in
            UUID(uuidString: game.id).map { ($0, (index, game)) }
        })

        return Dictionary(uniqueKeysWithValues: standings.map { standing in
            guard let slip = board.first(where: { $0.userId == standing.userId }),
                  slip.totalPoints == nil else {
                return (standing.userId, standing.totalPoints)
            }

            var liveWeek = 0
            for pick in slip.pickGames {
                guard let (_, game) = indexedGames[pick.cardGameId],
                      let result = results[game.id],
                      let leader = cardKind.usesStraightUpScoring
                        ? result.projectedStraightUpLeader(in: game)
                        : result.projectedCoverWinner(in: game) else { continue }
                let selectedTeam = pick.side.lowercased() == "away" ? game.away : game.home
                guard selectedTeam == leader else { continue }
                liveWeek += pick.confidence * (pick.isBestBet ? 2 : 1)
            }
            if cardKind.allowsHellfire && slip.isHellfire { liveWeek *= 2 }

            if cardKind.requiresProp, let prop,
               let choice = slip.propChoice,
               let answer = FieldhousePropEvaluator.answer(for: prop, games: games, results: results),
               choice.uppercased() == (answer ? "YES" : "NO") {
                liveWeek += 3
            }
            return (standing.userId, standing.totalPoints + liveWeek)
        })
    }
}

struct FieldhouseRoomPickCount: Equatable {
    var away = 0
    var home = 0
}

enum FieldhouseRoomPickEngine {
    static func counts(board: [FieldhouseLiveBoardPick], games: [FieldhouseGame]) -> [String: FieldhouseRoomPickCount] {
        let gameByID = Dictionary(uniqueKeysWithValues: games.compactMap { game in
            UUID(uuidString: game.id).map { ($0, game.id) }
        })
        var counts = Dictionary(uniqueKeysWithValues: games.map { ($0.id, FieldhouseRoomPickCount()) })
        for slip in board {
            for pick in slip.pickGames {
                guard let gameID = gameByID[pick.cardGameId] else { continue }
                if pick.side.lowercased() == "away" { counts[gameID]?.away += 1 }
                if pick.side.lowercased() == "home" { counts[gameID]?.home += 1 }
            }
        }
        return counts
    }
}

enum FieldhousePostseasonScoreEngine {
    static func bracketWeight(for roundKey: String) -> Int {
        switch roundKey {
        case "opening", "r64": 1
        case "r32": 2
        case "s16": 4
        case "e8": 8
        case "ff": 16
        case "title": 32
        default: 0
        }
    }

    static func adjustedPoints(
        rawPoints: Int,
        correctPicks: Int,
        totalPicks: Int,
        usedHellfire: Bool
    ) -> Int {
        guard usedHellfire, totalPicks > 0 else { return rawPoints }
        let clearedThreshold = Double(correctPicks) / Double(totalPicks) >= 0.60
        let multiplier = clearedThreshold ? 1.5 : 0.5
        return Int((Double(rawPoints) * multiplier).rounded())
    }
}

struct FieldhousePostseasonGameReceipt: Equatable, Identifiable {
    let gameID: String
    let label: String
    let startsAt: String?
    let firstTeam: FieldhouseBracketTeam
    let secondTeam: FieldhouseBracketTeam
    let firstScore: Int?
    let secondScore: Int?
    let winnerTeamID: String?
    let bracketPickName: String?
    let bracketPoints: Int
    let freshPickName: String?
    let freshPoints: Int

    var id: String { gameID }
    var isFinal: Bool { winnerTeamID != nil && firstScore != nil && secondScore != nil }
}

struct FieldhousePostseasonRoundReceipt: Equatable, Identifiable {
    let roundKey: String
    let gameCount: Int
    let finalGames: Int
    let bracketHits: Int
    let bracketPoints: Int
    let freshHits: Int
    let freshCardFiled: Bool
    let games: [FieldhousePostseasonGameReceipt]

    var id: String { roundKey }
}

enum FieldhouseGameCatalog {
    static let weeklyCardSize = 10
    static let windowOne = [
        FieldhouseGame(id: "gonzaga-duke", away: "Gonzaga Bulldogs", home: "Duke Blue Devils", spread: "Duke -3.5", tip: "THU · 7:00 PM", tipHour: 19),
        FieldhouseGame(id: "auburn-houston", away: "Auburn Tigers", home: "Houston Cougars", spread: "Houston -2.5", tip: "THU · 7:30 PM", tipHour: 19, tipMinute: 30),
        FieldhouseGame(id: "uconn-kansas", away: "UConn Huskies", home: "Kansas Jayhawks", spread: "Kansas -1.5", tip: "THU · 8:00 PM", tipHour: 20),
        FieldhouseGame(id: "iowa-state-tennessee", away: "Iowa State Cyclones", home: "Tennessee Volunteers", spread: "Tennessee -4.5", tip: "THU · 8:30 PM", tipHour: 20, tipMinute: 30),
        FieldhouseGame(id: "baylor-alabama", away: "Baylor Bears", home: "Alabama Crimson Tide", spread: "Alabama -5.5", tip: "THU · 9:00 PM", tipHour: 21),
        FieldhouseGame(id: "purdue-michigan-state", away: "Purdue Boilermakers", home: "Michigan State Spartans", spread: "Purdue -2.5", tip: "THU · 9:30 PM", tipHour: 21, tipMinute: 30),
        FieldhouseGame(id: "kentucky-north-carolina", away: "Kentucky Wildcats", home: "North Carolina Tar Heels", spread: "North Carolina -1.5", tip: "THU · 10:00 PM", tipHour: 22),
        FieldhouseGame(id: "arizona-illinois", away: "Arizona Wildcats", home: "Illinois Fighting Illini", spread: "Arizona -3.5", tip: "THU · 10:30 PM", tipHour: 22, tipMinute: 30),
        FieldhouseGame(id: "marquette-creighton", away: "Marquette Golden Eagles", home: "Creighton Bluejays", spread: "Creighton -1.5", tip: "SAT · 3:30 PM", dayOffset: 5, tipHour: 15, tipMinute: 30),
        FieldhouseGame(id: "ucla-oregon", away: "UCLA Bruins", home: "Oregon Ducks", spread: "UCLA -2.5", tip: "SAT · 6:00 PM", dayOffset: 5, tipHour: 18),
        FieldhouseGame(id: "texas-tech-baylor", away: "Texas Tech Red Raiders", home: "Baylor Bears", spread: "Baylor -3.5", tip: "SUN · 2:00 PM", dayOffset: 6, tipHour: 14),
        FieldhouseGame(id: "villanova-st-johns", away: "Villanova Wildcats", home: "St. John's Red Storm", spread: "St. John's -4.5", tip: "SUN · 5:00 PM", dayOffset: 6, tipHour: 17)
    ]

    static let ncaawWindowOne = [
        FieldhouseGame(id: "w-uconn-south-carolina", away: "UConn Huskies", home: "South Carolina Gamecocks", spread: "South Carolina -2.5", tip: "THU · 7:00 PM", tipHour: 19),
        FieldhouseGame(id: "w-ucla-texas", away: "UCLA Bruins", home: "Texas Longhorns", spread: "UCLA -1.5", tip: "THU · 7:30 PM", tipHour: 19, tipMinute: 30),
        FieldhouseGame(id: "w-lsu-notre-dame", away: "LSU Tigers", home: "Notre Dame Fighting Irish", spread: "LSU -3.5", tip: "THU · 8:00 PM", tipHour: 20),
        FieldhouseGame(id: "w-usc-duke", away: "USC Trojans", home: "Duke Blue Devils", spread: "USC -4.5", tip: "THU · 8:30 PM", tipHour: 20, tipMinute: 30),
        FieldhouseGame(id: "w-south-carolina-state-tennessee", away: "South Carolina State Lady Bulldogs", home: "Tennessee Lady Volunteers", spread: "Tennessee -12.5", tip: "THU · 9:00 PM", tipHour: 21),
        FieldhouseGame(id: "w-iowa-ohio-state", away: "Iowa Hawkeyes", home: "Ohio State Buckeyes", spread: "Iowa -2.5", tip: "THU · 9:30 PM", tipHour: 21, tipMinute: 30),
        FieldhouseGame(id: "w-oklahoma-state-baylor", away: "Oklahoma State Cowgirls", home: "Baylor Bears", spread: "Baylor -1.5", tip: "THU · 10:00 PM", tipHour: 22),
        FieldhouseGame(id: "w-stanford-nc-state", away: "Stanford Cardinal", home: "NC State Wolfpack", spread: "NC State -3.5", tip: "THU · 10:30 PM", tipHour: 22, tipMinute: 30),
        FieldhouseGame(id: "w-maryland-penn-state", away: "Maryland Terrapins", home: "Penn State Lady Lions", spread: "Maryland -5.5", tip: "SAT · 3:30 PM", dayOffset: 5, tipHour: 15, tipMinute: 30),
        FieldhouseGame(id: "w-gonzaga-oregon", away: "Gonzaga Bulldogs", home: "Oregon Ducks", spread: "Oregon -2.5", tip: "SAT · 6:00 PM", dayOffset: 5, tipHour: 18),
        FieldhouseGame(id: "w-louisville-kentucky", away: "Louisville Cardinals", home: "Kentucky Wildcats", spread: "Louisville -3.5", tip: "SUN · 2:00 PM", dayOffset: 6, tipHour: 14),
        FieldhouseGame(id: "w-iowa-state-tcu", away: "Iowa State Cyclones", home: "TCU Horned Frogs", spread: "TCU -4.5", tip: "SUN · 5:00 PM", dayOffset: 6, tipHour: 17)
    ]

    static func games(for league: FieldhouseLeague) -> [FieldhouseGame] {
        league == .ncaaw ? ncaawWindowOne : windowOne
    }

    static func championshipGames(for league: FieldhouseLeague) -> [FieldhouseGame] {
        let source = games(for: league)
        return zip(FieldhouseChampionshipConference.allCases, source.prefix(4)).map { conference, game in
            game.assigned(to: conference)
        }
    }
}

enum FieldhousePropKind: String, CaseIterable, Identifiable, Codable {
    case teamScores90
    case gameWithinThree
    case underdogWins
    case combinedScore150
    case teamScores100
    case bothTeamsScore75
    case winningMargin20
    case threeUnderdogsWin
    case sixFavoritesCover
    case everyGameReaches130

    var id: String { rawValue }
    var question: String {
        switch self {
        case .teamScores90: "Will any team score 90 or more points?"
        case .gameWithinThree: "Will any game finish within 3 points?"
        case .underdogWins: "Will any underdog win outright?"
        case .combinedScore150: "Will any game reach 150 combined points?"
        case .teamScores100: "Will any team score 100 or more points?"
        case .bothTeamsScore75: "Will both teams score 75 or more in any game?"
        case .winningMargin20: "Will any game finish with a 20-point margin?"
        case .threeUnderdogsWin: "Will at least three underdogs win outright?"
        case .sixFavoritesCover: "Will at least six favorites cover the spread?"
        case .everyGameReaches130: "Will every game reach 130 combined points?"
        }
    }
}

struct FieldhouseSeasonState: Codable, Equatable {
    var league: FieldhouseLeague = .activeBuild
    var championshipTrophyID = FieldhouseTrophyCatalog.ncaam[0].id
    // Basketball is double-buffered: one week scores while the next accepts picks.
    var window = 2
    var regularSeasonWeeks = 18
    var cardKind: FieldhouseCardKind = .weekly
    var scoringWindow = 1
    var scoringCardKind: FieldhouseCardKind = .weekly
    var scoringGames = Array(FieldhouseGameCatalog.windowOne.prefix(FieldhouseGameCatalog.weeklyCardSize))
    var scoringResults: [String: FieldhouseGameResult] = [
        "gonzaga-duke": FieldhouseGameResult(gameID: "gonzaga-duke", awayScore: 78, homeScore: 76, phase: .final),
        "auburn-houston": FieldhouseGameResult(gameID: "auburn-houston", awayScore: 71, homeScore: 74, phase: .final),
        "uconn-kansas": FieldhouseGameResult(gameID: "uconn-kansas", awayScore: 69, homeScore: 75, phase: .final),
        "iowa-state-tennessee": FieldhouseGameResult(gameID: "iowa-state-tennessee", awayScore: 80, homeScore: 78, phase: .final),
        "baylor-alabama": FieldhouseGameResult(gameID: "baylor-alabama", awayScore: 72, homeScore: 84, phase: .final),
        "purdue-michigan-state": FieldhouseGameResult(gameID: "purdue-michigan-state", awayScore: 77, homeScore: 74, phase: .final),
        "kentucky-north-carolina": FieldhouseGameResult(gameID: "kentucky-north-carolina", awayScore: 52, homeScore: 49, phase: .live(period: "2H · 11:42")),
        "arizona-illinois": FieldhouseGameResult(gameID: "arizona-illinois", awayScore: 41, homeScore: 44, phase: .live(period: "HALF")),
        "marquette-creighton": FieldhouseGameResult(gameID: "marquette-creighton", awayScore: 22, homeScore: 18, phase: .live(period: "1H · 7:08")),
        "ucla-oregon": FieldhouseGameResult(gameID: "ucla-oregon", awayScore: 8, homeScore: 12, phase: .live(period: "1H · 15:31"))
    ]
    var scoringSelections: [Int: String] = [
        0: "Gonzaga Bulldogs", 1: "Auburn Tigers", 2: "Kansas Jayhawks", 3: "Tennessee Volunteers",
        4: "Alabama Crimson Tide", 5: "Michigan State Spartans", 6: "Kentucky Wildcats",
        7: "Arizona Wildcats", 8: "Marquette Golden Eagles", 9: "UCLA Bruins"
    ]
    var scoringConfidences: [Int: Int] = Dictionary(uniqueKeysWithValues: (0..<FieldhouseGameCatalog.weeklyCardSize).map { ($0, FieldhouseGameCatalog.weeklyCardSize - $0) })
    var scoringBestBetGame: Int? = 0
    var scoringProp: FieldhousePropKind = .teamScores90
    var scoringPropAnswer = "YES"
    var scoringUsedHellfire = false
    var lastCertifiedWindow: Int?
    var lastCertifiedPoints: Int?
    var phase: FieldhouseSeasonPhase = .regularSeason
    var isAuthenticatedSession = false
    var isCreator = false
    var isCommissioner = true
    var seasonHasStarted = true
    var cardIsPublished = false
    var publishedGames: [FieldhouseGame] = []
    var publishedProp: FieldhousePropKind?
    var playerCount = 100
    var regionPlayerCount = 25
    var rank = 5
    var regularHellfiresUsed = 0
    var bracketHellfireUsed = false
    var bracketLocked = false
    var officialPostseasonField: FieldhouseOfficialField?
    var postseasonBracketPicks: [String: String] = [:]
    var bracketSubmitted = false
    var postseasonRoundPicks: [String: [String: String]] = [:]
    var postseasonRoundSubmitted: Set<String> = []
    var postseasonRoundLocked: Set<String> = []
    var postseasonBracketCorrectPicks = 0
    var postseasonBracketRawPoints = 0
    var postseasonBracketAdjustedPoints = 0
    var postseasonFreshRoundPoints = 0
    var postseasonTotalPoints = 0
    var postseasonLeaderboardTotals: [UUID: Int] = [:]
    var postseasonScoreUpdatedAt: String?
    var postseasonEligibilityPath: String?
    var postseasonEligibilityRank: Int?
    var selectedRegion: FieldhouseRegion = .midwest
    var favoriteTeam: String?
    var crystalBallChampion: String?
    var sideSelections: [Int: String] = [:]
    var confidenceSelections: [Int: Int] = [:]
    var bestBetGame: Int?
    var propAnswer: String?
    var picksLocked = false
    var hellfireDeployedOnCurrentCard = false

    var regularHellfiresRemaining: Int { max(0, 2 - regularHellfiresUsed) }
    var postseasonIsActive: Bool { officialPostseasonField != nil }
    var postseasonScorecardIsActive: Bool {
        postseasonIsActive && (bracketSubmitted || !postseasonRoundSubmitted.isEmpty)
    }
    func postseasonPoints(for userID: UUID) -> Int {
        postseasonLeaderboardTotals[userID] ?? 0
    }
    var postseasonScoreFreshnessLabel: String {
        guard let value = postseasonScoreUpdatedAt,
              let date = footballKickoffDate(value) else {
            return "WAITING FOR FIRST OFFICIAL RESULT"
        }
        return "SERVER UPDATED \(date.formatted(date: .abbreviated, time: .shortened).uppercased())"
    }
    var postseasonEligibilityLabel: String {
        switch postseasonEligibilityPath {
        case "championship": "CHAMPIONSHIP FIELD"
        case "toilet_bowl": "TOILET BOWL FIELD"
        case "no_brass": "POINTS + CHEEVOS · NO BRASS"
        default: "SELECTION SUNDAY PENDING"
        }
    }
    func postseasonRoundReceipt(for roundKey: String) -> FieldhousePostseasonRoundReceipt? {
        guard let field = officialPostseasonField else { return nil }
        let games = field.games.filter { $0.roundKey == roundKey }
        guard !games.isEmpty else { return nil }
        let freshPicks = postseasonRoundPicks[roundKey] ?? [:]
        let matchups = Dictionary(uniqueKeysWithValues: FieldhouseBracketEngine.roundMatchups(key: roundKey, field: field).map { ($0.id, $0) })
        let weight = FieldhousePostseasonScoreEngine.bracketWeight(for: roundKey)
        let finalGames = games.filter { $0.winnerTeamID != nil }
        let bracketHits = finalGames.filter { game in
            postseasonBracketPicks[game.gameID] == game.winnerTeamID
        }.count
        let freshHits = finalGames.filter { game in
            freshPicks[game.gameID] == game.winnerTeamID
        }.count
        return FieldhousePostseasonRoundReceipt(
            roundKey: roundKey,
            gameCount: games.count,
            finalGames: finalGames.count,
            bracketHits: bracketHits,
            bracketPoints: bracketHits * FieldhousePostseasonScoreEngine.bracketWeight(for: roundKey),
            freshHits: freshHits,
            freshCardFiled: postseasonRoundSubmitted.contains(roundKey),
            games: games.sorted { $0.ordinal < $1.ordinal }.compactMap { game in
                guard let matchup = matchups[game.gameID],
                      let first = matchup.first,
                      let second = matchup.second else { return nil }
                let bracketPick = postseasonBracketPicks[game.gameID]
                let freshPick = freshPicks[game.gameID]
                return FieldhousePostseasonGameReceipt(
                    gameID: game.gameID,
                    label: matchup.label,
                    startsAt: game.startsAt,
                    firstTeam: first,
                    secondTeam: second,
                    firstScore: game.firstScore,
                    secondScore: game.secondScore,
                    winnerTeamID: game.winnerTeamID,
                    bracketPickName: bracketPick.flatMap { id in field.teams.first(where: { $0.teamID == id })?.displayName },
                    bracketPoints: game.winnerTeamID != nil && bracketPick == game.winnerTeamID ? weight : 0,
                    freshPickName: freshPick.flatMap { id in field.teams.first(where: { $0.teamID == id })?.displayName },
                    freshPoints: game.winnerTeamID != nil && freshPick == game.winnerTeamID ? 1 : 0
                )
            }
        )
    }
    func activePostseasonRound(at date: Date = Date()) -> String? {
        officialPostseasonField.flatMap { FieldhouseBracketEngine.liveRoundKey(field: $0, now: date) }
    }
    var activePostseasonRound: String? {
        activePostseasonRound()
    }
    func postseasonBracketIsLocked(at now: Date = Date()) -> Bool {
        if bracketLocked { return true }
        guard let firstTipAt = officialPostseasonField?.firstTipAt,
              let firstTip = footballKickoffDate(firstTipAt) else { return false }
        return now >= firstTip
    }
    func postseasonRoundScheduleIsReady(_ roundKey: String) -> Bool {
        guard let field = officialPostseasonField else { return false }
        let games = field.games.filter { $0.roundKey == roundKey }
        return !games.isEmpty && games.allSatisfy { game in
            footballKickoffDate(game.startsAt) != nil
        }
    }
    func postseasonRoundIsLocked(_ roundKey: String, at now: Date = Date()) -> Bool {
        if postseasonRoundLocked.contains(roundKey) { return true }
        guard let field = officialPostseasonField else { return false }
        let firstTip = field.games
            .filter { $0.roundKey == roundKey }
            .compactMap { footballKickoffDate($0.startsAt) }
            .min()
        return firstTip.map { now >= $0 } ?? false
    }
    func postseasonLockLabel(at now: Date) -> String {
        guard let field = officialPostseasonField,
              let round = activePostseasonRound else { return "TOURNAMENT COMPLETE" }
        let firstTip = field.games
            .filter { $0.roundKey == round }
            .compactMap { footballKickoffDate($0.startsAt) }
            .min()
        guard let firstTip else { return "\(FieldhouseBracketEngine.roundTitle(round)) · TIP PENDING" }
        guard now < firstTip else { return "\(FieldhouseBracketEngine.roundTitle(round)) PICKS LOCKED" }
        let parts = Calendar.current.dateComponents([.day, .hour, .minute], from: now, to: firstTip)
        return "\(FieldhouseBracketEngine.roundTitle(round)) LOCKS IN \(max(0, parts.day ?? 0))D \(max(0, parts.hour ?? 0))H \(max(0, parts.minute ?? 0))M"
    }
    var scoringFinalGames: Int {
        scoringGames.filter { scoringResults[$0.id]?.isFinal == true }.count
    }
    var scoringLiveGames: Int {
        scoringGames.filter {
            guard let result = scoringResults[$0.id] else { return false }
            if case .live = result.phase { return true }
            return false
        }.count
    }
    var scoringPoints: Int {
        FieldhouseScoreEngine.points(
            games: scoringGames,
            results: scoringResults,
            selections: scoringSelections,
            confidences: scoringConfidences,
            bestBetGame: scoringBestBetGame,
            prop: scoringProp,
            propAnswer: scoringPropAnswer,
            gameMultiplier: scoringCardKind.allowsHellfire && scoringUsedHellfire ? 2 : 1,
            cardKind: scoringCardKind
        )
    }
    var scoringPropResult: Bool? {
        guard scoringCardKind.requiresProp else { return nil }
        return FieldhousePropEvaluator.answer(for: scoringProp, games: scoringGames, results: scoringResults)
    }
    var scoringIsComplete: Bool {
        !scoringGames.isEmpty && scoringFinalGames == scoringGames.count && (!scoringCardKind.requiresProp || scoringPropResult != nil)
    }
    func scoringGamePoints(at index: Int) -> Int? {
        guard scoringGames.indices.contains(index),
              let result = scoringResults[scoringGames[index].id], result.isFinal,
              let winner = scoringCardKind.usesStraightUpScoring
                ? result.straightUpWinner(in: scoringGames[index])
                : result.coverWinner(in: scoringGames[index]),
              let selection = scoringSelections[index], let confidence = scoringConfidences[index] else { return nil }
        guard selection == winner else { return 0 }
        let weaponMultiplier = scoringCardKind.allowsHellfire && scoringUsedHellfire ? 2 : 1
        return confidence * (scoringBestBetGame == index ? 2 : 1) * weaponMultiplier
    }
    func roomPicksAreVisible(for gameID: String) -> Bool {
        guard let result = scoringResults[gameID] else { return false }
        switch result.phase {
        case .scheduled: return false
        case .live, .final: return true
        }
    }
    var canRebalanceRegions: Bool { !seasonHasStarted }
    var canSelectChampionshipTrophy: Bool { !seasonHasStarted }
    var canBuildCard: Bool {
        guard isCommissioner, !cardIsPublished, phase != .postseason else { return false }
        if phase == .conferenceChampionships,
           scoringCardKind == .conferenceChampionship {
            return false
        }
        return true
    }
    var playerPicksAreComplete: Bool { cardIsPublished && picksLocked }
    func outstandingPickTaskCount(at date: Date) -> Int {
        if postseasonIsActive {
            var count = 0
            if !bracketSubmitted && !postseasonBracketIsLocked(at: date) { count += 1 }
            if let round = activePostseasonRound(at: date),
               postseasonRoundScheduleIsReady(round),
               !postseasonRoundIsLocked(round, at: date),
               !postseasonRoundSubmitted.contains(round) {
                count += 1
            }
            return count
        }
        return cardIsPublished && !picksLocked && canEditPicks(at: date) ? 1 : 0
    }
    func hasOutstandingPickTask(at date: Date) -> Bool {
        outstandingPickTaskCount(at: date) > 0
    }
    var postseasonStatus: WarRoomPostseasonStatus {
        WarRoomPostseasonRule.status(rank: rank, playerCount: regionPlayerCount)
    }
    var cardIsComplete: Bool {
        let count = cardKind.requiredGameCount
        guard cardIsPublished, publishedGames.count == count, sideSelections.count == count,
              confidenceSelections.count == count, Set(confidenceSelections.values) == Set(1...count),
              bestBetGame != nil else { return false }
        if cardKind.requiresProp && propAnswer == nil { return false }
        return (0..<count).allSatisfy { sideSelections[$0] != nil && confidenceSelections[$0] != nil }
    }

    var pickLockDate: Date { FieldhouseSeasonCalendar.lockDate(for: window, games: publishedGames) }

    func canEditPicks(at date: Date) -> Bool {
        cardIsPublished && date < pickLockDate
    }

    func pickWindowIsClosed(at date: Date) -> Bool {
        cardIsPublished && date >= pickLockDate
    }

    mutating func enforcePickDeadline(at date: Date) {
        if pickWindowIsClosed(at: date), cardIsComplete { picksLocked = true }
    }

    @discardableResult
    mutating func lockPicks(at date: Date) -> Bool {
        guard cardIsComplete, canEditPicks(at: date) else { return false }
        picksLocked = true
        return true
    }

    @discardableResult
    mutating func reopenPicks(at date: Date) -> Bool {
        guard picksLocked, !hellfireDeployedOnCurrentCard, canEditPicks(at: date) else { return false }
        picksLocked = false
        return true
    }

    @discardableResult
    mutating func deployRegularSeasonHellfire(at date: Date) -> Bool {
        guard cardKind.allowsHellfire, regularHellfiresRemaining > 0, !picksLocked, canEditPicks(at: date),
              publishedGames.count == FieldhouseGameCatalog.weeklyCardSize,
              publishedGames.allSatisfy({ $0.favoriteTeam != nil }) else { return false }

        sideSelections = Dictionary(uniqueKeysWithValues: publishedGames.enumerated().map {
            ($0.offset, $0.element.favoriteTeam!)
        })
        confidenceSelections = Dictionary(uniqueKeysWithValues: publishedGames.indices.map {
            ($0, FieldhouseGameCatalog.weeklyCardSize - $0)
        })
        bestBetGame = 0
        propAnswer = "YES"
        regularHellfiresUsed += 1
        hellfireDeployedOnCurrentCard = true
        picksLocked = true
        return true
    }

    @discardableResult
    mutating func advanceToNextWindow(at date: Date) -> Bool {
        guard scoringIsComplete, picksLocked, date >= pickLockDate,
              publishedGames.count == cardKind.requiredGameCount else { return false }
        if cardKind.requiresProp && (publishedProp == nil || propAnswer == nil) { return false }

        lastCertifiedWindow = scoringWindow
        lastCertifiedPoints = scoringPoints
        scoringWindow = window
        scoringCardKind = cardKind
        scoringGames = publishedGames
        scoringResults = Dictionary(uniqueKeysWithValues: publishedGames.map {
            ($0.id, FieldhouseGameResult(gameID: $0.id, awayScore: 0, homeScore: 0, phase: .scheduled))
        })
        scoringSelections = sideSelections
        scoringConfidences = confidenceSelections
        scoringBestBetGame = bestBetGame
        if let publishedProp { scoringProp = publishedProp }
        scoringPropAnswer = propAnswer ?? ""
        scoringUsedHellfire = hellfireDeployedOnCurrentCard

        if cardKind == .conferenceChampionship {
            window = regularSeasonWeeks + 1
            cardKind = .conferenceChampionship
        } else {
            window += 1
            cardKind = .weekly
        }
        cardIsPublished = false
        publishedGames = []
        self.publishedProp = nil
        sideSelections = [:]
        confidenceSelections = [:]
        bestBetGame = nil
        self.propAnswer = nil
        picksLocked = false
        hellfireDeployedOnCurrentCard = false
        return true
    }

    func confidenceAvailable(_ value: Int, for game: Int) -> Bool {
        !confidenceSelections.contains { $0.key != game && $0.value == value }
    }

    mutating func toggleConfidence(_ value: Int, for game: Int) {
        guard !picksLocked,
              confidenceSelections[game] == value || confidenceAvailable(value, for: game) else { return }
        confidenceSelections[game] = confidenceSelections[game] == value ? nil : value
    }

    mutating func selectLeague(_ newLeague: FieldhouseLeague) {
        league = newLeague
        championshipTrophyID = FieldhouseTrophyCatalog.options(for: newLeague)[0].id
        let games = Array(FieldhouseGameCatalog.games(for: newLeague).prefix(FieldhouseGameCatalog.weeklyCardSize))
        scoringGames = games
        scoringResults = Dictionary(uniqueKeysWithValues: games.enumerated().map { index, game in
            let phase: FieldhouseGamePhase = index < 6 ? .final : .live(period: index == 6 ? "2H · 11:42" : "1H · 7:08")
            return (game.id, FieldhouseGameResult(gameID: game.id, awayScore: 68 + index, homeScore: 72 + index, phase: phase))
        })
        scoringSelections = Dictionary(uniqueKeysWithValues: games.enumerated().map { ($0.offset, $0.element.away) })
    }

    @discardableResult
    mutating func selectChampionshipTrophy(_ trophyID: String) -> Bool {
        guard canSelectChampionshipTrophy,
              FieldhouseTrophyCatalog.options(for: league).contains(where: { $0.id == trophyID }) else { return false }
        championshipTrophyID = trophyID
        return true
    }

    @discardableResult
    mutating func publishCard(games: [FieldhouseGame], prop: FieldhousePropKind) -> Bool {
        let count = FieldhouseGameCatalog.weeklyCardSize
        guard games.count == count,
              Set(games.map(\.id)).count == count,
              games.allSatisfy({
                  (0...6).contains($0.dayOffset) &&
                  (0...23).contains($0.tipHour) &&
                  (0...59).contains($0.tipMinute) &&
                  $0.favoriteTeam != nil &&
                  ($0.favoriteSpread ?? 0) < 0 &&
                  FieldhouseSpreadRule.isHalfPoint($0.favoriteSpread ?? 0)
              }) else { return false }
        publishedGames = games
        cardKind = .weekly
        publishedProp = prop
        cardIsPublished = true
        sideSelections = [:]
        confidenceSelections = [:]
        bestBetGame = nil
        propAnswer = nil
        picksLocked = false
        hellfireDeployedOnCurrentCard = false
        return true
    }

    @discardableResult
    mutating func publishChampionshipCard(games: [FieldhouseGame]) -> Bool {
        let conferences = games.compactMap(\.championshipConference)
        guard phase == .conferenceChampionships,
              games.count == FieldhouseCardKind.conferenceChampionship.requiredGameCount,
              Set(games.map(\.id)).count == games.count,
              Set(conferences) == Set(FieldhouseChampionshipConference.allCases),
              games.allSatisfy({
                  (0...6).contains($0.dayOffset) &&
                  (0...23).contains($0.tipHour) &&
                  (0...59).contains($0.tipMinute)
              }) else { return false }
        publishedGames = games.sorted {
            guard let lhs = $0.championshipConference,
                  let rhs = $1.championshipConference else { return $0.id < $1.id }
            return FieldhouseChampionshipConference.allCases.firstIndex(of: lhs)! < FieldhouseChampionshipConference.allCases.firstIndex(of: rhs)!
        }
        cardKind = .conferenceChampionship
        publishedProp = nil
        cardIsPublished = true
        sideSelections = [:]
        confidenceSelections = [:]
        bestBetGame = nil
        propAnswer = nil
        picksLocked = false
        hellfireDeployedOnCurrentCard = false
        return true
    }
}

enum FieldhouseStateReconciler {
    static func bracketDraftIsDirty(
        current: FieldhouseSeasonState,
        verified: FieldhouseSeasonState
    ) -> Bool {
        current.postseasonBracketPicks != verified.postseasonBracketPicks
            || current.bracketSubmitted != verified.bracketSubmitted
            || current.bracketLocked != verified.bracketLocked
            || current.bracketHellfireUsed != verified.bracketHellfireUsed
    }

    static func roundDraftIsDirty(
        current: FieldhouseSeasonState,
        verified: FieldhouseSeasonState
    ) -> Bool {
        current.postseasonRoundPicks != verified.postseasonRoundPicks
            || current.postseasonRoundSubmitted != verified.postseasonRoundSubmitted
            || current.postseasonRoundLocked != verified.postseasonRoundLocked
    }
}

enum FieldhouseStateHydrator {
    static func hydrate(
        snapshot: FieldhouseAuthenticatedSnapshot,
        userID: UUID,
        cached: FieldhouseSeasonState? = nil,
        now: Date = Date()
    ) -> FieldhouseSeasonState {
        var state = cached ?? FieldhouseSeasonState()
        state.isAuthenticatedSession = true
        state.isCreator = AppIdentity.isCreator(userID)
        let league = FieldhouseLeague(summary: snapshot.membership.leagues)
        if state.league != league { state.selectLeague(league) }

        state.window = max(1, snapshot.membership.leagues.currentWeek)
        state.regularSeasonWeeks = snapshot.membership.leagues.regularSeasonWeeks
        state.isCommissioner = snapshot.membership.isCommissioner(userId: userID)
        if !snapshot.standings.isEmpty {
            state.playerCount = snapshot.standings.count
            let userDivision = snapshot.standings.first(where: { $0.userId == userID })?.fieldhouseRegion ?? snapshot.membership.fieldhouseRegion
            let regional = snapshot.standings.filter { $0.fieldhouseRegion == userDivision }
            state.regionPlayerCount = max(1, regional.count)
            if let index = regional.firstIndex(where: { $0.userId == userID }) { state.rank = index + 1 }
        }
        state.seasonHasStarted = snapshot.membership.leagues.currentWeek > 1 || now >= FieldhouseSeasonCalendar.openingTip
        state.favoriteTeam = snapshot.favoriteTeam.flatMap {
            FieldhouseTeamCatalog.displayName(forStoredID: $0.teamId, league: league)
        }
        state.crystalBallChampion = snapshot.crystalBall?.teamName
        state.officialPostseasonField = snapshot.officialField
        if snapshot.officialField != nil {
            state.phase = .postseason
        } else if state.window > state.regularSeasonWeeks {
            state.phase = .conferenceChampionships
        } else {
            state.phase = .regularSeason
        }
        state.postseasonBracketPicks = snapshot.bracketEntry?.picks ?? state.postseasonBracketPicks
        state.bracketSubmitted = snapshot.bracketEntry?.submittedAt != nil
        state.bracketLocked = snapshot.bracketEntry?.lockedAt != nil
        state.bracketHellfireUsed = snapshot.bracketEntry?.hellfireUsed == true
        state.postseasonRoundPicks = Dictionary(uniqueKeysWithValues: snapshot.roundEntries.map { ($0.roundKey, $0.picks) })
        state.postseasonRoundSubmitted = Set(snapshot.roundEntries.compactMap { $0.submittedAt == nil ? nil : $0.roundKey })
        state.postseasonRoundLocked = Set(snapshot.roundEntries.compactMap { $0.lockedAt == nil ? nil : $0.roundKey })
        state.postseasonLeaderboardTotals = Dictionary(uniqueKeysWithValues: snapshot.postseasonTotals.map { ($0.userId, $0.totalPoints) })
        state.postseasonEligibilityPath = snapshot.postseasonQualifier?.path
        state.postseasonEligibilityRank = snapshot.postseasonQualifier?.regularRank
        if let ownTotal = snapshot.postseasonTotals.first(where: { $0.userId == userID }) {
            state.postseasonBracketCorrectPicks = ownTotal.bracketCorrectPicks
            state.postseasonBracketRawPoints = ownTotal.bracketRawPoints
            state.postseasonBracketAdjustedPoints = ownTotal.bracketAdjustedPoints
            state.postseasonFreshRoundPoints = ownTotal.roundPoints
            state.postseasonTotalPoints = ownTotal.totalPoints
            state.postseasonScoreUpdatedAt = ownTotal.updatedAt
        } else {
            state.postseasonBracketCorrectPicks = 0
            state.postseasonBracketRawPoints = 0
            state.postseasonBracketAdjustedPoints = 0
            // The generated postseason total is the only score authority used
            // by Home, scorecard, standings, regional races, and awards. Round
            // entry points may be written just before that total is refreshed;
            // adding them here would temporarily create a second scoreboard.
            state.postseasonFreshRoundPoints = 0
            state.postseasonTotalPoints = 0
            state.postseasonScoreUpdatedAt = nil
        }

        if let trophyID = snapshot.membership.leagues.championshipTrophyId,
           FieldhouseTrophyCatalog.options(for: league).contains(where: { $0.id == trophyID }) {
            state.championshipTrophyID = trophyID
        }

        // Authenticated state starts empty and is populated only from server
        // authority below. Never allow Foundry preview scores or picks to leak
        // into a real league that has not produced a scoring card yet.
        state.scoringGames = []
        state.scoringCardKind = .weekly
        state.scoringResults = [:]
        state.scoringSelections = [:]
        state.scoringConfidences = [:]
        state.scoringBestBetGame = nil
        state.scoringPropAnswer = ""
        state.scoringUsedHellfire = false
        state.lastCertifiedWindow = nil
        state.lastCertifiedPoints = nil

        if let scorecard = snapshot.latestScorecard,
           snapshot.scoringCard == nil || snapshot.scoringCard?.weekNumber == scorecard.weekNumber {
            let orderedScoringGames = scorecard.card.cardGames.sorted { $0.sortOrder < $1.sortOrder }
            state.scoringWindow = scorecard.weekNumber
            state.scoringCardKind = FieldhouseCardKind(rawValue: scorecard.card.cardKind ?? "") ?? .weekly
            state.scoringGames = orderedScoringGames.map { FieldhouseGame(cardGame: $0, window: scorecard.weekNumber) }
            state.scoringResults = Dictionary(uniqueKeysWithValues: scorecard.result.gameResults.compactMap { result in
                guard let game = orderedScoringGames.first(where: { $0.id == result.cardGameId }),
                      let awayScore = result.awayScore,
                      let homeScore = result.homeScore else { return nil }
                let mapped = FieldhouseGameResult(
                    gameID: game.id.uuidString.lowercased(),
                    awayScore: awayScore,
                    homeScore: homeScore,
                    phase: .final
                )
                return (mapped.gameID, mapped)
            })
            let scoringIndex = Dictionary(uniqueKeysWithValues: orderedScoringGames.enumerated().map { ($0.element.id, $0.offset) })
            state.scoringSelections = Dictionary(uniqueKeysWithValues: scorecard.pick.pickGames.compactMap { picked in
                guard let index = scoringIndex[picked.cardGameId] else { return nil }
                let game = orderedScoringGames[index]
                return (index, picked.side == "home" ? game.homeTeam : game.awayTeam)
            })
            state.scoringConfidences = Dictionary(uniqueKeysWithValues: scorecard.pick.pickGames.compactMap { picked in
                scoringIndex[picked.cardGameId].map { ($0, picked.confidence) }
            })
            state.scoringBestBetGame = scorecard.pick.pickGames.first(where: \.isBestBet).flatMap { scoringIndex[$0.cardGameId] }
            state.scoringProp = FieldhousePropKind.allCases.first(where: { $0.question == scorecard.card.propQuestion }) ?? .teamScores90
            state.scoringPropAnswer = scorecard.pick.propChoice ?? ""
            state.scoringUsedHellfire = state.scoringCardKind.allowsHellfire && scorecard.pick.isChaos
            state.lastCertifiedWindow = scorecard.weekNumber
            state.lastCertifiedPoints = scorecard.totalPoints
        } else if let scoringCard = snapshot.scoringCard {
            let orderedScoringGames = scoringCard.cardGames.sorted { $0.sortOrder < $1.sortOrder }
            state.scoringWindow = scoringCard.weekNumber
            state.scoringCardKind = FieldhouseCardKind(rawValue: scoringCard.cardKind ?? "") ?? .weekly
            state.scoringGames = orderedScoringGames.map { FieldhouseGame(cardGame: $0, window: scoringCard.weekNumber) }
            state.scoringResults = [:]
            let scoringIndex = Dictionary(uniqueKeysWithValues: orderedScoringGames.enumerated().map { ($0.element.id, $0.offset) })
            state.scoringSelections = Dictionary(uniqueKeysWithValues: (snapshot.scoringPick?.pickGames ?? []).compactMap { picked in
                guard let index = scoringIndex[picked.cardGameId] else { return nil }
                let game = orderedScoringGames[index]
                return (index, picked.side == "home" ? game.homeTeam : game.awayTeam)
            })
            state.scoringConfidences = Dictionary(uniqueKeysWithValues: (snapshot.scoringPick?.pickGames ?? []).compactMap { picked in
                scoringIndex[picked.cardGameId].map { ($0, picked.confidence) }
            })
            state.scoringBestBetGame = snapshot.scoringPick?.pickGames.first(where: \.isBestBet).flatMap { scoringIndex[$0.cardGameId] }
            state.scoringProp = FieldhousePropKind.allCases.first(where: { $0.question == scoringCard.propQuestion }) ?? .teamScores90
            state.scoringPropAnswer = snapshot.scoringPick?.propChoice ?? ""
            state.scoringUsedHellfire = state.scoringCardKind.allowsHellfire && snapshot.scoringPick?.isChaos == true
        }

        guard let card = snapshot.card else {
            state.cardIsPublished = false
            state.cardKind = state.phase == .conferenceChampionships ? .conferenceChampionship : .weekly
            state.publishedGames = []
            state.publishedProp = nil
            state.sideSelections = [:]
            state.confidenceSelections = [:]
            state.bestBetGame = nil
            state.propAnswer = nil
            state.picksLocked = false
            state.hellfireDeployedOnCurrentCard = false
            return state
        }

        let orderedGames = card.cardGames.sorted { $0.sortOrder < $1.sortOrder }
        state.cardKind = FieldhouseCardKind(rawValue: card.cardKind ?? "") ?? .weekly
        state.publishedGames = orderedGames.map { FieldhouseGame(cardGame: $0, window: state.window) }
        state.publishedProp = FieldhousePropKind.allCases.first { $0.question == card.propQuestion }
        state.cardIsPublished = !orderedGames.isEmpty

        let gameIndex = Dictionary(uniqueKeysWithValues: orderedGames.enumerated().map {
            ($0.element.id, $0.offset)
        })
        state.sideSelections = Dictionary(uniqueKeysWithValues: (snapshot.pick?.pickGames ?? []).compactMap {
            guard let index = gameIndex[$0.cardGameId] else { return nil }
            let game = orderedGames[index]
            switch $0.side.lowercased() {
            case "away": return (index, game.awayTeam)
            case "home": return (index, game.homeTeam)
            default: return nil
            }
        })
        state.confidenceSelections = Dictionary(uniqueKeysWithValues: (snapshot.pick?.pickGames ?? []).compactMap {
            guard let index = gameIndex[$0.cardGameId] else { return nil }
            return (index, $0.confidence)
        })
        state.bestBetGame = snapshot.pick?.pickGames.first(where: \.isBestBet).flatMap { gameIndex[$0.cardGameId] }
        state.propAnswer = snapshot.pick?.propChoice
        state.picksLocked = snapshot.pick?.isLocked == true
        state.hellfireDeployedOnCurrentCard = snapshot.pick?.isChaos == true
        return state
    }
}

struct FieldhouseStateScope: Equatable {
    let userID: UUID
    let leagueID: UUID

    var storageKey: String {
        "fieldhouse.state.v1.\(userID.uuidString.lowercased()).\(leagueID.uuidString.lowercased())"
    }
}

protocol FieldhouseStatePersisting {
    func load(scope: FieldhouseStateScope) -> FieldhouseSeasonState?
    func save(_ state: FieldhouseSeasonState, scope: FieldhouseStateScope)
    func remove(scope: FieldhouseStateScope)
}

struct FieldhouseStateStore: FieldhouseStatePersisting {
    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load(scope: FieldhouseStateScope) -> FieldhouseSeasonState? {
        guard let data = defaults.data(forKey: scope.storageKey) else { return nil }
        return try? decoder.decode(FieldhouseSeasonState.self, from: data)
    }

    func save(_ state: FieldhouseSeasonState, scope: FieldhouseStateScope) {
        guard let data = try? encoder.encode(state) else { return }
        defaults.set(data, forKey: scope.storageKey)
    }

    func remove(scope: FieldhouseStateScope) {
        defaults.removeObject(forKey: scope.storageKey)
    }
}

struct FieldhouseNativePreviewView: View {
    @EnvironmentObject private var auth: AuthStore
    private var accent: Color { FieldhouseTheme.accent(for: state.league) }
    @State private var desk: FieldhouseDesk = .home
    @State private var state: FieldhouseSeasonState
    @State private var strikePresentation: StrikePresentation?
    @State private var showingEntrance = true
    @State private var showingSetup = false
    @State private var persistenceError: String?
    @State private var openActivePostseasonRound = false
    @State private var lastVerifiedState: FieldhouseSeasonState
    @State private var standings: [Standing]
    @State private var liveProjectionByUser: [UUID: Int] = [:]
    @State private var liveProjectionWeek: Int?
    @State private var liveProjectionActive = false
    @State private var liveProjectionStale = false
    @State private var liveRoomPickCounts: [String: FieldhouseRoomPickCount]?
    @Binding private var notificationDestination: WarRoomNotificationRoute?
    @Environment(\.scenePhase) private var scenePhase
    private let stateStore = FieldhouseStateStore()
    private let initialLeague: FieldhouseLeague
    private let authenticatedState: FieldhouseSeasonState?
    private let authenticatedScope: FieldhouseStateScope?
    private let liveContext: FieldhouseLiveContext?
    private var stateScope: FieldhouseStateScope {
        authenticatedScope ?? FieldhouseStateScope(
            userID: UUID(uuidString: "F13D0000-0000-4000-8000-000000000002")!,
            leagueID: FieldhousePreviewIdentity.leagueID(for: state.league)
        )
    }

    init(initialLeague: FieldhouseLeague = .activeBuild) {
        self.initialLeague = initialLeague
        self.authenticatedState = nil
        self.authenticatedScope = nil
        self.liveContext = nil
        let initialState = Self.makePreviewState(for: initialLeague)
        let reviewRound = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-round")
        let reviewScorecard = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-scorecard")
        let reviewChampionship = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-championship")
        let reviewMode = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review") || reviewRound || reviewScorecard || reviewChampionship
        let reviewPicks = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-picks")
        let reviewLocker = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-locker")
        let reviewProfile = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-profile")
        let reviewBracket = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-bracket")
        let reviewHellfire = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-hellfire")
        var displayState = initialState
        if reviewRound || reviewBracket {
            displayState.officialPostseasonField = .previewRound(for: initialLeague)
            displayState.phase = .postseason
        }
        if reviewScorecard { Self.seedPostseasonScorecardPreview(&displayState, league: initialLeague) }
        _state = State(initialValue: displayState)
        _lastVerifiedState = State(initialValue: displayState)
        _standings = State(initialValue: [])
        _notificationDestination = .constant(nil)
        _desk = State(initialValue: (reviewBracket || reviewRound || reviewChampionship) ? .picks : (reviewProfile ? .profile : (reviewLocker ? .locker : (reviewPicks ? .picks : .home))))
        _strikePresentation = State(initialValue: reviewHellfire ? StrikePresentation(resourceName: initialLeague == .ncaaw ? "hellfire-fieldhouse-ncaaw-1" : "hellfire-fieldhouse-1") : nil)
        _showingEntrance = State(initialValue: !reviewMode)
    }

    fileprivate init(
        authenticatedState: FieldhouseSeasonState,
        scope: FieldhouseStateScope,
        liveContext: FieldhouseLiveContext,
        notificationDestination: Binding<WarRoomNotificationRoute?>
    ) {
        self.initialLeague = authenticatedState.league
        self.authenticatedState = authenticatedState
        self.authenticatedScope = scope
        self.liveContext = liveContext
        _state = State(initialValue: authenticatedState)
        _lastVerifiedState = State(initialValue: authenticatedState)
        _standings = State(initialValue: liveContext.standings)
        _notificationDestination = notificationDestination
        _desk = State(initialValue: .home)
        _strikePresentation = State(initialValue: nil)
        _showingEntrance = State(initialValue: true)
    }

    private static func makePreviewState(for league: FieldhouseLeague) -> FieldhouseSeasonState {
        var initialState = FieldhouseSeasonState()
        initialState.selectLeague(league)
        let reviewMode = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review")
            || ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-scorecard")
        let reviewPicks = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-picks")
        let reviewChampionship = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-championship")
        let reviewTrophies = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-trophies")
        if reviewMode {
            initialState.favoriteTeam = league == .ncaaw ? "South Carolina Gamecocks" : "Duke Blue Devils"
            initialState.crystalBallChampion = "UConn Huskies"
        }
        if reviewPicks {
            _ = initialState.publishCard(
                games: Array(FieldhouseGameCatalog.games(for: league).prefix(FieldhouseGameCatalog.weeklyCardSize)),
                prop: .teamScores90
            )
        }
        if reviewChampionship {
            initialState.phase = .conferenceChampionships
            initialState.regularSeasonWeeks = 18
            initialState.window = 19
            _ = initialState.publishChampionshipCard(games: FieldhouseGameCatalog.championshipGames(for: league))
        }
        if reviewTrophies { initialState.seasonHasStarted = false }
        if ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-scorecard") {
            seedPostseasonScorecardPreview(&initialState, league: league)
        }
        return initialState
    }

    private static func seedPostseasonScorecardPreview(_ state: inout FieldhouseSeasonState, league: FieldhouseLeague) {
        state.officialPostseasonField = .previewRound(for: league)
        state.phase = .postseason
        state.bracketSubmitted = true
        state.bracketLocked = true
        state.postseasonBracketCorrectPicks = 27
        state.postseasonBracketRawPoints = 39
        state.postseasonBracketAdjustedPoints = 39
        state.postseasonFreshRoundPoints = 8
        state.postseasonTotalPoints = 47
    }

    var body: some View {
        ZStack {
            FieldhouseBackdrop(leagueOverride: state.league).ignoresSafeArea()
            VStack(spacing: 0) {
                if desk != .home && desk != .profile && !(desk == .locker && liveContext != nil) {
                    FieldhouseHeader(state: state, canGoBack: true) { desk = .home }
                }
                if desk == .locker {
                    if let liveContext {
                        LockerRoomView(leagueOverride: liveContext.membership, onBack: { desk = .home })
                    } else {
                        FieldhouseLockerPage().padding(.horizontal, 14)
                    }
                } else if desk == .picks {
                    if state.postseasonIsActive {
                        FieldhouseBracketsPage(
                            state: $state,
                            strikePresentation: $strikePresentation,
                            openActivePostseasonRound: $openActivePostseasonRound,
                            overviewHorizontalPadding: 14
                        )
                    } else {
                        FieldhousePicksPage(
                            state: $state,
                            strikePresentation: $strikePresentation,
                            roomPickCounts: liveRoomPickCounts,
                            roomPickCountsAreStale: liveProjectionStale
                        )
                    }
                } else if desk == .profile {
                    if auth.user != nil && auth.token != nil {
                        YouView(onBack: { desk = .home })
                    } else {
                        NavigationStack {
                            ScrollView {
                                FieldhouseProfilePage(state: $state)
                                    .padding(14).padding(.bottom, 30)
                            }
                        }
                    }
                } else if desk == .standings {
                    FieldhouseStandingsPage(
                        state: $state,
                        openActivePostseasonRound: $openActivePostseasonRound,
                        liveProjectionByUser: liveProjectionByUser,
                        liveProjectionActive: liveProjectionActive,
                        liveProjectionStale: liveProjectionStale
                    )
                        .padding(14).padding(.bottom, 30)
                } else {
                    ScrollView {
                        Group {
                            switch desk {
                            case .home: FieldhouseHomePage(state: $state, desk: $desk, openActivePostseasonRound: $openActivePostseasonRound)
                            case .picks: EmptyView()
                            case .standings: EmptyView()
                            case .locker: EmptyView()
                            case .profile: EmptyView()
                            }
                        }
                        .padding(14).padding(.bottom, 30)
                    }
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            TimelineView(.periodic(from: .now, by: 15)) { context in
                FieldhouseBottomNavigation(
                    selection: $desk,
                    outstandingPickTaskCount: state.outstandingPickTaskCount(at: context.date)
                )
            }
        }
        .environment(\.fieldhouseLeague, state.league)
        .environment(\.fieldhousePersist, { event in persist(event) })
        .environment(\.fieldhouseStandings, standings)
        .accentColor(FieldhouseTheme.accent(for: state.league))
        .preferredColorScheme(.dark)
        .fullScreenCover(item: $strikePresentation) { presentation in
            WeaponStrikeVideoView(presentation: presentation) { strikePresentation = nil }
        }
        .fullScreenCover(isPresented: $showingEntrance) {
            FieldhouseEntranceView(league: state.league) {
                showingEntrance = false
                showingSetup = state.favoriteTeam == nil || state.crystalBallChampion == nil
            }
        }
        .fullScreenCover(isPresented: $showingSetup) {
            FieldhouseSeasonSetupView(state: $state) { showingSetup = false }
        }
        .alert("Couldn’t save that change", isPresented: Binding(
            get: { persistenceError != nil },
            set: { if !$0 { persistenceError = nil } }
        )) {
            Button("OK", role: .cancel) { persistenceError = nil }
        } message: {
            Text(persistenceError ?? "Try again.")
        }
        .onAppear { routeNotificationIfNeeded() }
        .onChange(of: notificationDestination) { _, _ in routeNotificationIfNeeded() }
        .onAppear {
            if let authenticatedState {
                state = authenticatedState
                refreshLifecycle(at: Date())
                return
            }
            var initialState = Self.makePreviewState(for: initialLeague)
            if ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-round")
                || ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-bracket") {
                initialState.officialPostseasonField = .previewRound(for: initialLeague)
                initialState.phase = .postseason
            }
            let initialScope = FieldhouseStateScope(
                userID: UUID(uuidString: "F13D0000-0000-4000-8000-000000000002")!,
                leagueID: FieldhousePreviewIdentity.leagueID(for: initialLeague)
            )
            state = (ProcessInfo.processInfo.arguments.contains("--fieldhouse-review")
                || ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-scorecard"))
                ? initialState
                : (stateStore.load(scope: initialScope) ?? initialState)
            refreshLifecycle(at: Date())
        }
        .onChange(of: state) { _, newState in
            stateStore.save(newState, scope: stateScope)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { refreshLifecycle(at: Date()) }
        }
        .task(id: liveContext?.membership.leagueId) {
            guard liveContext != nil else { return }
            while !Task.isCancelled {
                await refreshAuthenticatedScoring()
                try? await Task.sleep(for: .seconds(60))
            }
        }
    }

    private func routeNotificationIfNeeded() {
        guard let route = notificationDestination else { return }
        notificationDestination = nil
        switch route.destination {
        case "picks":
            if state.activePostseasonRound != nil && !route.routesToFieldhousePostseasonOverview {
                openActivePostseasonRound = true
            }
            desk = .picks
        case "announcements", "results":
            desk = .home
        default:
            break
        }
    }

    private func refreshLifecycle(at date: Date) {
        state.enforcePickDeadline(at: date)
        _ = state.advanceToNextWindow(at: date)
    }

    @MainActor private func refreshAuthenticatedScoring() async {
        guard let liveContext else { return }
        resetLiveProjectionIfWeekChanged()
        do {
            let token = try await auth.validAccessToken()
            let verified = try await FieldhouseAuthenticatedRepository.load(
                token: token,
                userID: liveContext.userID,
                preferredLeagueID: liveContext.membership.leagueId
            )
            let hydrated = FieldhouseStateHydrator.hydrate(snapshot: verified, userID: liveContext.userID, cached: state)
            let localBracketDraftIsDirty = FieldhouseStateReconciler.bracketDraftIsDirty(
                current: state,
                verified: lastVerifiedState
            )
            let localRoundDraftIsDirty = FieldhouseStateReconciler.roundDraftIsDirty(
                current: state,
                verified: lastVerifiedState
            )
            let priorScoringWindow = state.scoringWindow
            let priorScoringResults = state.scoringResults
            state.scoringWindow = hydrated.scoringWindow
            state.scoringGames = hydrated.scoringGames
            state.scoringResults = hydrated.scoringResults.isEmpty
                && !hydrated.scoringGames.isEmpty
                && hydrated.scoringWindow == priorScoringWindow
                ? priorScoringResults
                : hydrated.scoringResults
            state.scoringSelections = hydrated.scoringSelections
            state.scoringConfidences = hydrated.scoringConfidences
            state.scoringBestBetGame = hydrated.scoringBestBetGame
            state.scoringProp = hydrated.scoringProp
            state.scoringPropAnswer = hydrated.scoringPropAnswer
            state.scoringUsedHellfire = hydrated.scoringUsedHellfire
            state.lastCertifiedWindow = hydrated.lastCertifiedWindow
            state.lastCertifiedPoints = hydrated.lastCertifiedPoints
            state.officialPostseasonField = hydrated.officialPostseasonField
            if !localBracketDraftIsDirty {
                state.postseasonBracketPicks = hydrated.postseasonBracketPicks
                state.bracketSubmitted = hydrated.bracketSubmitted
                state.bracketLocked = hydrated.bracketLocked
                state.bracketHellfireUsed = hydrated.bracketHellfireUsed
            }
            if !localRoundDraftIsDirty {
                state.postseasonRoundPicks = hydrated.postseasonRoundPicks
                state.postseasonRoundSubmitted = hydrated.postseasonRoundSubmitted
                state.postseasonRoundLocked = hydrated.postseasonRoundLocked
            }
            state.postseasonBracketCorrectPicks = hydrated.postseasonBracketCorrectPicks
            state.postseasonBracketRawPoints = hydrated.postseasonBracketRawPoints
            state.postseasonBracketAdjustedPoints = hydrated.postseasonBracketAdjustedPoints
            state.postseasonFreshRoundPoints = hydrated.postseasonFreshRoundPoints
            state.postseasonTotalPoints = hydrated.postseasonTotalPoints
            state.postseasonLeaderboardTotals = hydrated.postseasonLeaderboardTotals
            state.postseasonScoreUpdatedAt = hydrated.postseasonScoreUpdatedAt
            state.postseasonEligibilityPath = hydrated.postseasonEligibilityPath
            state.postseasonEligibilityRank = hydrated.postseasonEligibilityRank
            standings = verified.standings
            // This is the newest server-confirmed rollback point. Unsaved local
            // bracket and round edits remain in `state`, while failed writes
            // return to this refreshed authority instead of an old launch copy.
            lastVerifiedState = hydrated

            // Tournament results and totals are already settled by the
            // autonomous server worker. Read that permanent authority first
            // and never make the UI depend on a second provider call.
            if state.officialPostseasonField != nil {
                clearLiveProjection()
                refreshLifecycle(at: Date())
                return
            }

            let feed: FootballScoreFeed
            do {
                feed = try await SupabaseAPI.footballScores(
                    token: token,
                    leagueId: liveContext.membership.leagueId,
                    sportId: liveContext.membership.leagues.sportId,
                    daysFrom: 3
                )
            } catch {
                if liveProjectionActive { liveProjectionStale = true }
                refreshLifecycle(at: Date())
                return
            }
            var refreshed: [String: FieldhouseGameResult] = [:]
            for game in state.scoringGames {
                guard let event = feed.events.first(where: {
                    normalizedFieldhouseTeam($0.homeTeam) == normalizedFieldhouseTeam(game.home)
                        && normalizedFieldhouseTeam($0.awayTeam) == normalizedFieldhouseTeam(game.away)
                }),
                let home = fieldhouseScoreValue(game.home, event: event),
                let away = fieldhouseScoreValue(game.away, event: event) else { continue }
                refreshed[game.id] = FieldhouseGameResult(
                    gameID: game.id,
                    awayScore: away,
                    homeScore: home,
                    phase: event.completed ? .final : .live(period: "LIVE")
                )
            }
            state.scoringResults.merge(refreshed) { _, new in new }

            let projectionWeek = state.scoringWindow
            do {
                let board = try await SupabaseAPI.fieldhouseLiveBoard(
                    token: token,
                    leagueId: liveContext.membership.leagueId,
                    weekNumber: projectionWeek
                )
                liveProjectionByUser = FieldhouseLiveStandingsEngine.projectedTotals(
                    standings: verified.standings,
                    board: board,
                    games: state.scoringGames,
                    results: state.scoringResults,
                    prop: state.scoringCardKind.requiresProp ? state.scoringProp : nil,
                    cardKind: state.scoringCardKind
                )
                liveRoomPickCounts = FieldhouseRoomPickEngine.counts(board: board, games: state.scoringGames)
                liveProjectionWeek = projectionWeek
                liveProjectionActive = !board.isEmpty
                    && !state.scoringResults.isEmpty
                    && state.lastCertifiedWindow != projectionWeek
                liveProjectionStale = feed.stale == true
            } catch {
                if liveProjectionWeek == projectionWeek,
                   liveProjectionActive || liveRoomPickCounts != nil {
                    liveProjectionStale = true
                } else {
                    clearLiveProjection()
                }
            }
            refreshLifecycle(at: Date())
            resetLiveProjectionIfWeekChanged()
        } catch {
            // Keep the last trustworthy board and retry on the next tick.
        }
    }

    private func resetLiveProjectionIfWeekChanged() {
        guard let liveProjectionWeek, liveProjectionWeek != state.scoringWindow else { return }
        clearLiveProjection()
    }

    private func clearLiveProjection() {
        liveProjectionByUser = [:]
        liveProjectionWeek = nil
        liveProjectionActive = false
        liveProjectionStale = false
        liveRoomPickCounts = nil
    }

    private func normalizedFieldhouseTeam(_ value: String) -> String {
        value.lowercased().unicodeScalars
            .map { CharacterSet.alphanumerics.contains($0) ? Character(String($0)) : " " }
            .reduce(into: "") { $0.append($1) }
            .split(separator: " ").joined(separator: " ")
    }

    private func fieldhouseScoreValue(_ team: String, event: FootballScoreEvent) -> Int? {
        event.scores.first(where: { normalizedFieldhouseTeam($0.name) == normalizedFieldhouseTeam(team) }).flatMap { Int($0.score) }
    }

    private func persist(_ event: FieldhousePersistenceEvent) {
        guard let liveContext else { return }
        let pendingState = state
        Task { @MainActor in
            do {
                let token = try await auth.validAccessToken()
                switch event {
                case .setup:
                    guard let favorite = pendingState.favoriteTeam, let champion = pendingState.crystalBallChampion else {
                        throw FieldhouseRepositoryError(message: "Favorite team and Crystal Ball champion are both required.")
                    }
                    try await FieldhouseAuthenticatedRepository.saveSetup(token: token, userID: liveContext.userID, membership: liveContext.membership, favoriteTeam: favorite, crystalBallChampion: champion)
                case .publishCard:
                    try await FieldhouseAuthenticatedRepository.publishCard(token: token, membership: liveContext.membership, state: pendingState)
                case .picks:
                    _ = try await FieldhouseAuthenticatedRepository.savePicks(token: token, membership: liveContext.membership, state: pendingState)
                case .trophy:
                    let trophyID = pendingState.championshipTrophyID
                    guard !trophyID.isEmpty else { throw FieldhouseRepositoryError(message: "Choose a trophy before saving.") }
                    try await FieldhouseAuthenticatedRepository.selectTrophy(token: token, membership: liveContext.membership, trophyID: trophyID)
                case .favoriteTeam:
                    guard let favorite = pendingState.favoriteTeam else { throw FieldhouseRepositoryError(message: "Choose a favorite team before saving.") }
                    try await FieldhouseAuthenticatedRepository.saveFavoriteTeam(token: token, userID: liveContext.userID, membership: liveContext.membership, favoriteTeam: favorite)
                case .bracket:
                    try await FieldhouseAuthenticatedRepository.saveBracket(
                        token: token,
                        membership: liveContext.membership,
                        state: pendingState
                    )
                case .postseasonRound:
                    try await FieldhouseAuthenticatedRepository.saveRoundPicks(
                        token: token,
                        membership: liveContext.membership,
                        state: pendingState
                    )
                case .importOfficialField(let data, let publish):
                    try await FieldhouseAuthenticatedRepository.importOfficialField(
                        token: token,
                        userID: liveContext.userID,
                        membership: liveContext.membership,
                        data: data,
                        publish: publish
                    )
                case .syncOfficialSchedule(let data):
                    try await FieldhouseAuthenticatedRepository.syncOfficialSchedule(
                        token: token,
                        userID: liveContext.userID,
                        membership: liveContext.membership,
                        data: data
                    )
                }

                let verified = try await FieldhouseAuthenticatedRepository.load(token: token, userID: liveContext.userID, preferredLeagueID: liveContext.membership.leagueId)
                let hydrated = FieldhouseStateHydrator.hydrate(snapshot: verified, userID: liveContext.userID, cached: pendingState)
                state = hydrated
                standings = verified.standings
                lastVerifiedState = hydrated
            } catch {
                state = lastVerifiedState
                persistenceError = error.localizedDescription
            }
        }
    }
}

private struct FieldhouseSeasonSetupView: View {
    @Environment(\.fieldhousePersist) private var persist
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    @Binding var state: FieldhouseSeasonState
    let finish: () -> Void
    @State private var step = 0
    @State private var pendingTeam: String?
    @State private var searchText = ""
    private var catalog: [String] { FieldhouseTeamCatalog.teams(for: state.league) }
    private var teams: [String] {
        return searchText.isEmpty ? catalog : catalog.filter { $0.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        ZStack {
            FieldhouseBackdrop(leagueOverride: state.league).ignoresSafeArea()
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    if pendingTeam != nil {
                        Button { pendingTeam = nil } label: {
                            Image(systemName: "chevron.left").font(.headline.weight(.black))
                                .frame(width: 40, height: 40).background(.white.opacity(0.10), in: Circle())
                        }.buttonStyle(.plain).accessibilityLabel("Back to team list")
                    }
                    Text(step == 0 ? "COURTSIDE IDENTITY" : "SEALED PROPHECY")
                        .font(.system(size: 10, weight: .black)).tracking(2).foregroundStyle(accent)
                }
                Text(step == 0 ? "PICK YOUR\nFAVORITE TEAM" : "PICK YOUR\nCHAMPION")
                    .font(.system(size: 42, weight: .black)).fontWidth(.condensed)
                Text(step == 0 ? "This follows your profile across every Fieldhouse league. You can change your favorite team later from You." : "The Crystal Ball is mandatory. This championship call locks when you confirm it.")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
                if pendingTeam == nil {
                    TextField("Search all \(catalog.count) \(state.league.rawValue) Division I teams", text: $searchText)
                        .textInputAutocapitalization(.words).autocorrectionDisabled()
                        .padding(13).background(.white.opacity(0.09), in: RoundedRectangle(cornerRadius: 12))
                    ScrollView {
                        VStack(spacing: 8) {
                            ForEach(teams, id: \.self) { team in
                                Button { pendingTeam = team } label: {
                                    HStack { Image(systemName: "basketball.fill"); Text(team).font(.headline.weight(.black)); Spacer(); Image(systemName: "chevron.right") }
                                        .padding(15).foregroundStyle(.white).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                } else if let pendingTeam {
                    VStack(spacing: 14) {
                        Image(systemName: step == 0 ? "heart.fill" : "sparkles").font(.system(size: 54, weight: .black)).foregroundStyle(accent)
                        Text(pendingTeam).font(.title2.weight(.black)).multilineTextAlignment(.center)
                        Button("CHANGE SELECTION") { self.pendingTeam = nil }
                            .font(.caption.weight(.black)).foregroundStyle(accent)
                    }.frame(maxWidth: .infinity).padding(28).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 20))
                }
                Spacer()
                Button {
                    guard let pendingTeam else { return }
                    if step == 0 {
                        state.favoriteTeam = pendingTeam
                        self.pendingTeam = nil
                        searchText = ""
                        step = 1
                    } else {
                        state.crystalBallChampion = pendingTeam
                        persist(.setup)
                        finish()
                    }
                } label: {
                    Text(step == 0 ? "CONFIRM FAVORITE TEAM" : "CONFIRM CRYSTAL BALL")
                        .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(17)
                        .foregroundStyle(.black).background(pendingTeam == nil ? Color.gray : accent, in: RoundedRectangle(cornerRadius: 16))
                }.buttonStyle(.plain).disabled(pendingTeam == nil)
            }.padding(22).padding(.top, 22)
        }.preferredColorScheme(.dark)
    }
}

struct FieldhouseBackdrop: View {
    @Environment(\.fieldhouseLeague) private var league
    let leagueOverride: FieldhouseLeague?
    init(leagueOverride: FieldhouseLeague? = nil) { self.leagueOverride = leagueOverride }
    private var activeLeague: FieldhouseLeague { leagueOverride ?? league }
    private var accent: Color { FieldhouseTheme.accent(for: activeLeague) }
    var body: some View {
        ZStack {
            LinearGradient(
                colors: activeLeague == .ncaam
                    ? [Color(red: 0.035, green: 0.018, blue: 0.008), Color(red: 0.15, green: 0.055, blue: 0.012), .black]
                    : [Color(red: 0.018, green: 0.018, blue: 0.08), Color(red: 0.13, green: 0.025, blue: 0.17), .black],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Canvas { context, size in
                let paint = accent.opacity(0.075)
                for x in stride(from: 0.0, through: size.width, by: 34) {
                    context.fill(Path(CGRect(x: x, y: 0, width: 1, height: size.height)), with: .color(paint))
                }
                context.stroke(Path { path in
                    path.move(to: CGPoint(x: size.width / 2, y: 0)); path.addLine(to: CGPoint(x: size.width / 2, y: size.height))
                    path.addEllipse(in: CGRect(x: size.width / 2 - 92, y: size.height / 2 - 92, width: 184, height: 184))
                }, with: .color(accent.opacity(0.15)), lineWidth: 2)
            }
        }
    }
}

private struct FieldhouseHeader: View {
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    let state: FieldhouseSeasonState
    let canGoBack: Bool
    let back: () -> Void
    private var statusLine: String {
        guard state.postseasonIsActive else {
            return "WINDOW \(state.window) · FOUR REGIONS · ONE ROAD TO THE MIDDLE"
        }
        guard let round = state.activePostseasonRound else {
            return "POSTSEASON · TOURNAMENT COMPLETE · PERMANENT RECEIPT"
        }
        let title = FieldhouseBracketEngine.roundTitle(round)
        let gameCount = state.officialPostseasonField?.games.filter { $0.roundKey == round }.count ?? 0
        let phase: String
        if !state.postseasonRoundScheduleIsReady(round) {
            phase = "TIMES PENDING"
        } else if state.postseasonRoundIsLocked(round) {
            phase = "LIVE BOARD"
        } else if state.postseasonRoundSubmitted.contains(round) {
            phase = "PICKS FILED"
        } else {
            phase = "PICKS OPEN"
        }
        return "POSTSEASON · \(title) · \(gameCount) GAMES · \(phase)"
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                if canGoBack {
                    Button(action: back) {
                        Image(systemName: "chevron.left").font(.headline.weight(.black))
                            .frame(width: 36, height: 36).background(.white.opacity(0.10), in: Circle())
                    }.buttonStyle(.plain).accessibilityLabel("Back to Fieldhouse home")
                }
                Label("COLLEGE BASKETBALL", systemImage: "basketball.fill").font(.system(size: 9, weight: .black)).tracking(1.8).foregroundStyle(accent)
                Spacer(); Text("NATIVE FIELDHOUSE").font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(.white.opacity(0.42))
            }
            Text(state.league.displayName).font(.system(size: 29, weight: .black)).fontWidth(.condensed)
            Text(statusLine)
                .font(.system(size: 9, weight: .black)).tracking(1)
                .foregroundStyle(state.postseasonIsActive ? accent : .white.opacity(0.55))
                .lineLimit(1).minimumScaleFactor(0.72)
                .accessibilityIdentifier("fieldhouse.header.status")
        }
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 13)
        .background(.black.opacity(0.78)).overlay(alignment: .bottom) { Rectangle().fill(LinearGradient(colors: [.clear, accent, .clear], startPoint: .leading, endPoint: .trailing)).frame(height: 2) }
    }
}

private struct FieldhouseBottomNavigation: View {
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    @Binding var selection: FieldhouseDesk
    let outstandingPickTaskCount: Int
    var body: some View {
        HStack(spacing: 0) {
            ForEach(FieldhouseDesk.allCases) { desk in
                Button { selection = desk } label: {
                    VStack(spacing: 4) {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: desk.icon).font(.system(size: 21, weight: .bold))
                            if desk == .picks && outstandingPickTaskCount > 0 {
                                Text("\(outstandingPickTaskCount)")
                                    .font(.system(size: 8, weight: .black))
                                    .foregroundStyle(.black)
                                    .frame(width: 16, height: 16)
                                    .background(accent, in: Circle())
                                    .overlay(Circle().stroke(.black, lineWidth: 2))
                                    .offset(x: 10, y: -7)
                                    .accessibilityLabel("\(outstandingPickTaskCount) pick tasks remaining")
                            }
                        }
                        Text(desk.rawValue).font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(selection == desk ? accent : Color.white.opacity(0.78))
                    .frame(maxWidth: .infinity).frame(height: 58)
                    .background(selection == desk ? Color.white.opacity(0.10) : .clear, in: RoundedRectangle(cornerRadius: 18))
                }.buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.14)))
        .padding(.horizontal, 12).padding(.bottom, 4)
    }
}

private struct FieldhouseEntranceView: View {
    private var accent: Color { FieldhouseTheme.accent(for: league) }
    let league: FieldhouseLeague
    let enter: () -> Void
    var body: some View {
        ZStack {
            FieldhouseBackdrop(leagueOverride: league).ignoresSafeArea()
            VStack(spacing: 18) {
                Spacer()
                Image(systemName: "basketball.fill")
                    .font(.system(size: 78, weight: .black)).foregroundStyle(accent)
                    .shadow(color: accent.opacity(0.75), radius: 28)
                Text("COURTSIDE PASS").font(.system(size: 12, weight: .black)).tracking(4).foregroundStyle(accent)
                Text("THE\nFIELDHOUSE").font(.system(size: 58, weight: .black)).fontWidth(.condensed).multilineTextAlignment(.center)
                Text(league.rawValue).font(.system(size: 12, weight: .black)).tracking(3).foregroundStyle(accent)
                Text("FOUR REGIONS · ONE ROAD TO THE MIDDLE")
                    .font(.system(size: 10, weight: .black)).tracking(1.8).foregroundStyle(.white.opacity(0.58))
                Spacer()
                Button(action: enter) {
                    Label("TAKE THE FLOOR", systemImage: "arrow.right.circle.fill")
                        .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(17)
                        .foregroundStyle(.black).background(accent, in: RoundedRectangle(cornerRadius: 16))
                }.buttonStyle(.plain)
                Text("DIVISION I \(league == .ncaam ? "MEN'S" : "WOMEN'S") BASKETBALL · SIX TROPHIES · ONE FIELDHOUSE")
                    .font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(.white.opacity(0.42))
            }.padding(24).padding(.bottom, 18)
        }.preferredColorScheme(.dark)
    }
}

private struct FieldhouseHomePage: View {
    @Environment(\.fieldhousePersist) private var persist
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    @Binding var state: FieldhouseSeasonState
    @Binding var desk: FieldhouseDesk
    @Binding var openActivePostseasonRound: Bool
    @State private var showingLeagueSwitcher = false
    @State private var showingCardBuilder = false
    @State private var showingCommissionerCommand = false
    @State private var showingAnnouncements = false
    @State private var showingTournamentScorecard = false
    var body: some View {
        VStack(spacing: 13) {
            FieldhouseHomeMasthead(state: state)
            HStack(spacing: 10) {
                ShareLink(
                    item: URL(string: "https://app.war-room-picks.com/join/FH2026")!,
                    subject: Text("Join The Fieldhouse"),
                    message: Text("Join my Fieldhouse league in War Room Pick'Em. Invite code: FH2026")
                ) {
                    FieldhouseHomeButton(title: "SHARE · FH2026", icon: "square.and.arrow.up")
                }
                Button { showingLeagueSwitcher = true } label: {
                    FieldhouseHomeButton(title: "SWITCH LEAGUE", icon: "antenna.radiowaves.left.and.right")
                }.buttonStyle(.plain)
            }
            if state.isCommissioner {
                Button { showingCommissionerCommand = true } label: {
                    FieldhouseAction(kicker: "COMMISSIONER COMMAND", title: "Manage your league", detail: "Cards, players, regions, and season controls.", icon: "person.3.fill")
                }.buttonStyle(.plain)
            }
            playerCommand
            if state.postseasonScorecardIsActive {
                Button { showingTournamentScorecard = true } label: {
                    FieldhouseAction(
                        kicker: "TOURNAMENT SCORECARD · \(state.postseasonScoreFreshnessLabel)",
                            title: "\(state.postseasonTotalPoints) POSTSEASON POINTS",
                            detail: "\(state.postseasonEligibilityLabel) · bracket \(state.postseasonBracketAdjustedPoints) · round picks \(state.postseasonFreshRoundPoints). Tap for the permanent receipt.",
                        icon: "chart.line.uptrend.xyaxis"
                    )
                }.buttonStyle(.plain)
            } else {
                Button { desk = .picks } label: {
                    FieldhouseAction(
                        kicker: state.scoringIsComplete ? "FINAL HORN · WEEK \(state.scoringWindow)" : "ON THE FLOOR · WEEK \(state.scoringWindow)",
                        title: state.scoringIsComplete ? "\(state.scoringPoints) POINTS · CERTIFIED" : "\(state.scoringFinalGames) FINAL · \(state.scoringLiveGames) LIVE",
                        detail: state.scoringIsComplete ? "Your final receipt and prop result are ready." : "\(state.scoringPoints) points and moving. Tap to open the live board and your scorecard.",
                        icon: state.scoringIsComplete ? "checkmark.seal.fill" : "basketball.fill"
                    )
                }.buttonStyle(.plain)
            }
            if let certifiedWindow = state.lastCertifiedWindow, let certifiedPoints = state.lastCertifiedPoints {
                FieldhouseAction(kicker: "LAST CERTIFIED SCORECARD", title: "Week \(certifiedWindow) · \(certifiedPoints) points", detail: "Permanent weekly receipt.", icon: "clipboard.fill")
            }
            Button { showingAnnouncements = true } label: {
                FieldhouseAction(
                    kicker: "OFFICIAL TRANSMISSION",
                    title: "Announcements",
                    detail: "Commissioner posts, room updates, and official yelling.",
                    icon: "megaphone.fill"
                )
            }
            .buttonStyle(.plain)
        }
        .sheet(isPresented: $showingLeagueSwitcher) {
            FieldhouseLeagueSwitcher(league: Binding(get: { state.league }, set: { state.selectLeague($0) }), dismiss: { showingLeagueSwitcher = false })
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showingCardBuilder) {
            if state.phase == .conferenceChampionships {
                FieldhouseChampionshipCardBuilder(window: state.window) { games in
                    if state.publishChampionshipCard(games: games) {
                        persist(.publishCard)
                        showingCardBuilder = false
                        scheduleCardNotifications()
                    }
                }
            } else {
                FieldhouseCardBuilder(window: state.window) { games, prop in
                    if state.publishCard(games: games, prop: prop) {
                        persist(.publishCard)
                        showingCardBuilder = false
                        scheduleCardNotifications()
                    }
                }
            }
        }
        .sheet(isPresented: $showingCommissionerCommand) {
            FieldhouseCommissionerCommand(state: $state)
        }
        .sheet(isPresented: $showingAnnouncements) {
            NavigationStack { AnnouncementsView() }
                .preferredColorScheme(.dark)
        }
        .fullScreenCover(isPresented: $showingTournamentScorecard) {
            FieldhouseTournamentScorecardView(state: state)
        }
        .onAppear {
            if ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-trophies") {
                showingCommissionerCommand = true
            }
        }
    }

    private func scheduleCardNotifications() {
        // Authenticated leagues use the durable server outbox so every member
        // receives one event. Keep local scheduling confined to isolated preview.
        guard !state.isAuthenticatedSession else { return }
        let week = state.window
        let lockAt = state.pickLockDate
        let leagueName = state.league.displayName
        Task {
            await FieldhouseNotificationScheduler.cardPublished(
                leagueID: FieldhousePreviewIdentity.leagueID(for: state.league),
                leagueName: leagueName,
                week: week,
                lockAt: lockAt,
                cardKind: state.cardKind
            )
        }
    }

    @ViewBuilder private var playerCommand: some View {
        if state.postseasonIsActive {
            let now = Date()
            let round = state.activePostseasonRound(at: now)
            let bracketLocked = state.postseasonBracketIsLocked(at: now)
            let bracketNeedsAction = !state.bracketSubmitted && !bracketLocked
            let bracketMissed = !state.bracketSubmitted && bracketLocked
            let roundFiled = round.map { state.postseasonRoundSubmitted.contains($0) } ?? true
            let roundLocked = round.map { state.postseasonRoundIsLocked($0, at: now) } ?? false
            let scheduleReady = round.map { state.postseasonRoundScheduleIsReady($0) } ?? true
            let roundNeedsAction = round != nil && scheduleReady && !roundLocked && !roundFiled
            let roundMissed = round != nil && roundLocked && !roundFiled
            let taskCount = state.outstandingPickTaskCount(at: now)
            let roundTitle = FieldhouseBracketEngine.roundTitle(round ?? "opening")
            Button {
                openActivePostseasonRound = taskCount == 1 && roundNeedsAction
                desk = .picks
            } label: {
                FieldhouseAction(
                    kicker: taskCount > 0
                        ? "POSTSEASON COMMAND · \(taskCount) ACTION\(taskCount == 1 ? "" : "S") REQUIRED"
                        : (bracketMissed || roundMissed ? "POSTSEASON COMMAND · WINDOW MISSED" : scheduleReady ? "POSTSEASON COMMAND · COMPLETE" : "POSTSEASON COMMAND · SCHEDULE PENDING"),
                    title: taskCount == 2
                        ? "Complete Selection Sunday"
                        : bracketNeedsAction
                            ? "Fill Out Your 76-Team Bracket"
                            : round.map {
                                if !scheduleReady { return "\(FieldhouseBracketEngine.roundTitle($0)) Times Pending" }
                                if roundMissed { return "\(FieldhouseBracketEngine.roundTitle($0)) Locked" }
                                return roundFiled ? "\(FieldhouseBracketEngine.roundTitle($0)) Picks Filed" : "Pick the \(FieldhouseBracketEngine.roundTitle($0))"
                            } ?? "View Tournament Command",
                    detail: taskCount == 2
                        ? "File all 75 bracket decisions and your fresh \(roundTitle) card before first tip."
                        : bracketNeedsAction
                            ? "Your permanent bracket is still blank. Complete all 75 decisions before the tournament begins."
                            : !scheduleReady
                                ? "The matchup is set. Fresh picks open when every official tip time is on file."
                                : bracketMissed || roundMissed
                                    ? "A required pick window closed before a card was filed. Open Picks to follow the live tournament."
                                    : roundFiled
                                        ? "Your current-round picks are on the record. Open Picks for the bracket and live board."
                                        : "The tournament command center is ready.",
                    icon: taskCount > 0 ? "basketball.fill" : bracketMissed || roundMissed ? "lock.fill" : scheduleReady ? "checkmark.seal.fill" : "clock.fill",
                    signalColor: taskCount > 0 || bracketMissed || roundMissed ? .red : scheduleReady ? .green : accent
                )
            }.buttonStyle(.plain)
        } else {
            let commandColor: Color = state.playerPicksAreComplete ? .green : (state.cardIsPublished ? .red : accent)
            Button {
                if state.cardIsPublished { desk = .picks }
                else if state.canBuildCard { showingCardBuilder = true }
            } label: {
                FieldhouseAction(
                    kicker: state.playerPicksAreComplete
                        ? "PLAYER COMMAND · WEEK \(state.window) · COMPLETE"
                        : (state.cardIsPublished ? "PLAYER COMMAND · WEEK \(state.window) · PICKS OPEN" : "PLAYER COMMAND · WEEK \(state.window)"),
                    title: state.playerPicksAreComplete
                        ? "Week \(state.window) Picks Complete"
                        : (state.cardIsPublished ? "Make Your 10 Picks" : (state.isCommissioner ? "Build Next Week's Card" : "Card Not Posted Yet")),
                    detail: state.playerPicksAreComplete
                        ? "Your ten picks are on the record. Tap to view your locked board."
                        : (state.cardIsPublished
                        ? "Ten shared games. One card. Locks at the first selected tip."
                        : (state.isCommissioner ? "Pull the odds and publish the next board." : "The commissioner is building the next ten-game board.")),
                    icon: state.playerPicksAreComplete ? "checkmark.seal.fill" : (state.cardIsPublished ? "list.bullet.clipboard.fill" : (state.isCommissioner ? "hammer.fill" : "hourglass")),
                    signalColor: commandColor
                )
            }
            .buttonStyle(.plain)
            .disabled(!state.cardIsPublished && !state.canBuildCard)
            .opacity(!state.cardIsPublished && !state.canBuildCard ? 0.72 : 1)
        }
    }

}

private struct FieldhouseTournamentScorecardView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    let state: FieldhouseSeasonState

    var body: some View {
        NavigationStack {
            ZStack {
                FieldhouseBackdrop(leagueOverride: state.league).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 14) {
                        FieldhouseHero(
                            kicker: "\(state.postseasonEligibilityLabel) · \(state.postseasonScoreFreshnessLabel)",
                            title: "\(state.postseasonTotalPoints) POINTS",
                            detail: "One authoritative total for your homepage, standings, regional race, and championship result.",
                            icon: "checklist.checked"
                        )
                        HStack(spacing: 9) {
                            FieldhouseMetric(value: "\(state.postseasonBracketAdjustedPoints)", label: "BRACKET")
                            FieldhouseMetric(value: "\(state.postseasonFreshRoundPoints)", label: "ROUND PICKS")
                            FieldhouseMetric(value: "\(state.postseasonBracketCorrectPicks)", label: "BRACKET HITS")
                        }
                        VStack(alignment: .leading, spacing: 11) {
                            scoreRow("Initial bracket", value: state.postseasonBracketRawPoints)
                            if state.bracketHellfireUsed {
                                scoreRow("Hellfire-adjusted bracket", value: state.postseasonBracketAdjustedPoints, color: .orange)
                                Text(state.officialPostseasonField?.status == "final"
                                     ? "Hellfire is final: 1.5× at 60% correct or better; 0.5× below 60%."
                                     : "Hellfire remains provisional until the championship ends, when the 60% threshold can be calculated.")
                                    .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
                            }
                            scoreRow("Fresh round picks", value: state.postseasonFreshRoundPoints)
                            Divider().overlay(accent.opacity(0.4))
                            scoreRow("Tournament total", value: state.postseasonTotalPoints, color: accent, prominent: true)
                        }
                        .padding(16)
                        .background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 18))
                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(accent.opacity(0.38)))
                        VStack(alignment: .leading, spacing: 10) {
                            Text("ROUND-BY-ROUND LEDGER")
                                .font(.caption.weight(.black)).tracking(1.5).foregroundStyle(accent)
                            ForEach(FieldhouseBracketEngine.orderedRoundKeys, id: \.self) { roundKey in
                                if let receipt = state.postseasonRoundReceipt(for: roundKey) {
                                    roundReceipt(receipt)
                                }
                            }
                        }
                        .padding(16)
                        .background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 18))
                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(accent.opacity(0.38)))
                        Text("\(state.postseasonScoreFreshnessLabel). Scores refresh as official tournament games become final. No separate homepage or standings math is permitted.")
                            .font(.caption.weight(.bold)).foregroundStyle(.white.opacity(0.54))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(16).padding(.bottom, 24)
                }
            }
            .navigationTitle("Tournament Scorecard")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Label("BACK", systemImage: "chevron.left") }
                        .font(.caption.weight(.black)).foregroundStyle(accent)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func scoreRow(_ title: String, value: Int, color: Color = .white, prominent: Bool = false) -> some View {
        HStack {
            Text(title).font(prominent ? .headline.weight(.black) : .subheadline.weight(.bold))
            Spacer()
            Text("+\(value)").font(prominent ? .title2.weight(.black) : .headline.weight(.black)).foregroundStyle(color)
        }
    }

    private func roundReceipt(_ receipt: FieldhousePostseasonRoundReceipt) -> some View {
        NavigationLink {
            FieldhouseTournamentRoundReceiptView(receipt: receipt)
        } label: {
            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    Text(FieldhouseBracketEngine.roundTitle(receipt.roundKey))
                        .font(.subheadline.weight(.black)).foregroundStyle(.white)
                    Spacer()
                    Text("\(receipt.finalGames)/\(receipt.gameCount) FINAL")
                        .font(.system(size: 8, weight: .black)).tracking(1)
                        .foregroundStyle(receipt.finalGames == receipt.gameCount ? accent : .white.opacity(0.48))
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.black)).foregroundStyle(accent)
                }
                HStack(spacing: 8) {
                    roundMetric("BRACKET", value: receipt.bracketPoints, detail: "\(receipt.bracketHits) hits")
                    roundMetric(
                        "FRESH CARD",
                        value: receipt.freshHits,
                        detail: receipt.freshCardFiled ? "filed" : "not filed",
                        muted: !receipt.freshCardFiled
                    )
                }
            }
            .padding(12)
            .background(accent.opacity(0.07), in: RoundedRectangle(cornerRadius: 13))
            .overlay(RoundedRectangle(cornerRadius: 13).stroke(accent.opacity(0.18)))
        }
        .buttonStyle(.plain)
    }

    private func roundMetric(_ label: String, value: Int, detail: String, muted: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.system(size: 7, weight: .black)).tracking(0.9)
                .foregroundStyle(.white.opacity(0.42))
            Text(muted ? "—" : "+\(value)").font(.headline.weight(.black))
                .foregroundStyle(muted ? .white.opacity(0.3) : accent)
            Text(detail.uppercased()).font(.system(size: 7, weight: .bold)).tracking(0.6)
                .foregroundStyle(.white.opacity(0.42))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(9)
        .background(.black.opacity(0.56), in: RoundedRectangle(cornerRadius: 10))
    }
}

private struct FieldhouseTournamentRoundReceiptView: View {
    @Environment(\.fieldhouseLeague) private var league
    private var accent: Color { FieldhouseTheme.accent(for: league) }
    let receipt: FieldhousePostseasonRoundReceipt

    var body: some View {
        ZStack {
            FieldhouseBackdrop(leagueOverride: league).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 12) {
                    FieldhouseHero(
                        kicker: "CERTIFIED ROUND RECEIPT",
                        title: FieldhouseBracketEngine.roundTitle(receipt.roundKey),
                        detail: "\(receipt.finalGames) of \(receipt.gameCount) games final · bracket +\(receipt.bracketPoints) · fresh card +\(receipt.freshHits)",
                        icon: "basketball.fill"
                    )
                    ForEach(receipt.games) { game in
                        gameReceipt(game)
                    }
                }
                .padding(16).padding(.bottom, 24)
            }
        }
        .navigationTitle("Round Scores")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func gameReceipt(_ game: FieldhousePostseasonGameReceipt) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(game.label).font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(accent)
                Spacer()
                Text(game.isFinal ? "FINAL" : tipLabel(game.startsAt))
                    .font(.system(size: 8, weight: .black)).tracking(0.8)
                    .foregroundStyle(game.isFinal ? .white : .white.opacity(0.48))
            }
            teamScore(game.firstTeam, score: game.firstScore, winnerID: game.winnerTeamID)
            teamScore(game.secondTeam, score: game.secondScore, winnerID: game.winnerTeamID)
            Divider().overlay(accent.opacity(0.24))
            pickReceipt("ORIGINAL BRACKET", team: game.bracketPickName, points: game.bracketPoints, final: game.isFinal)
            pickReceipt("FRESH ROUND", team: game.freshPickName, points: game.freshPoints, final: game.isFinal)
        }
        .padding(14)
        .background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.30)))
    }

    private func teamScore(_ team: FieldhouseBracketTeam, score: Int?, winnerID: String?) -> some View {
        let winner = winnerID == team.id
        return HStack(spacing: 10) {
            Text("#\(team.seed)").font(.caption.weight(.black)).foregroundStyle(accent).frame(width: 28, alignment: .leading)
            Text(team.name).font(.subheadline.weight(.black)).foregroundStyle(winner ? .green : .white)
            Spacer()
            Text(score.map(String.init) ?? "—").font(.title3.weight(.black)).monospacedDigit().foregroundStyle(winner ? .green : .white.opacity(0.72))
        }
    }

    private func pickReceipt(_ label: String, team: String?, points: Int, final: Bool) -> some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.system(size: 7, weight: .black)).tracking(0.9).foregroundStyle(.white.opacity(0.42))
                Text(team ?? "NO PICK FILED").font(.caption.weight(.bold)).foregroundStyle(.white.opacity(team == nil ? 0.42 : 0.82))
            }
            Spacer()
            Text(final ? "+\(points)" : "PENDING")
                .font(.caption.weight(.black)).foregroundStyle(final ? (points > 0 ? .green : .red) : .yellow)
        }
    }

    private func tipLabel(_ value: String?) -> String {
        guard let date = footballKickoffDate(value) else { return "TIP PENDING" }
        let formatter = DateFormatter()
        formatter.timeZone = TimeZone(identifier: "America/New_York")
        formatter.dateFormat = "EEE MMM d · h:mm a"
        return formatter.string(from: date).uppercased()
    }
}

private struct FieldhouseCommissionerCommand: View {
    @Environment(\.fieldhousePersist) private var persist
    @Environment(\.fieldhouseLeague) private var themedLeague
    @Environment(\.fieldhouseStandings) private var standings
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    private var activeStandings: [Standing] { standings.filter { !$0.isBot } }
    private var lateEntryScore: Int {
        FieldhouseLateEntryRule.entryScore(existingScores: activeStandings.map(\.totalPoints))
    }
    @Binding var state: FieldhouseSeasonState
    @Environment(\.dismiss) private var dismiss
    @State private var showingCardBuilder = false
    @State private var pendingTrophy: FieldhouseTrophyOption?
    var body: some View {
        NavigationStack {
            ZStack {
                FieldhouseBackdrop().ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 12) {
                        FieldhouseHero(kicker: "COMMISSIONER CONTROL", title: "LEAGUE OPERATIONS", detail: "Players, regions, card state, and season rules from one place.", icon: "person.3.fill")
                        Button {
                            if state.canBuildCard { showingCardBuilder = true }
                        } label: {
                            commandRow(
                                state.phase == .conferenceChampionships ? "CHAMPIONSHIP WEEK" : "WEEK \(state.window) · ON DECK",
                                detail: state.cardIsPublished
                                    ? (state.cardKind == .conferenceChampionship ? "Four conference title games published" : "Ten games and prop published")
                                    : (state.phase == .conferenceChampionships ? "Post ACC, Big 12, Big Ten, and SEC title games" : "Choose ten games and an automatic floor prop"),
                                icon: "list.bullet.clipboard.fill",
                                status: state.cardIsPublished ? "PICKS OPEN" : (state.canBuildCard ? "BUILD CARD" : "LOCKED"),
                                color: state.cardIsPublished ? .green : (state.canBuildCard ? .yellow : .red)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(!state.canBuildCard)
                        commandRow(
                            "PLAYERS",
                            detail: "\(activeStandings.count) active · late entry seed \(lateEntryScore) points",
                            icon: "person.2.fill",
                            status: FieldhouseLateEntryRule.acceptsEntries(during: state.phase) ? "OPEN" : "CLOSED",
                            color: FieldhouseLateEntryRule.acceptsEntries(during: state.phase) ? .green : .red
                        )
                        commandRow("WEEK \(state.scoringWindow) · ON THE FLOOR", detail: "\(state.scoringFinalGames) final · \(state.scoringLiveGames) live", icon: "basketball.fill", status: "SCORING", color: .green)
                        commandRow("REGION ASSIGNMENTS", detail: "East · West · South · Midwest", icon: "square.grid.2x2.fill", status: state.canRebalanceRegions ? "EDIT" : "LOCKED", color: state.canRebalanceRegions ? accent : .red)
                        commandRow("SEASON PHASE", detail: "Transitions control entry eligibility and regional seeding", icon: "calendar.badge.clock", status: state.phase.rawValue, color: accent)
                        VStack(alignment: .leading, spacing: 7) {
                            Text("HARD RULES").font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(accent)
                            Label("Region rebalancing locks when the season begins.", systemImage: "lock.fill")
                            Label("Late entries receive the rounded average of the bottom 15%.", systemImage: "person.badge.plus")
                            Label("New entries close when postseason begins.", systemImage: "calendar.badge.exclamationmark")
                        }.font(.caption.weight(.semibold)).frame(maxWidth: .infinity, alignment: .leading).padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(0.28)))
                        trophySelector
                    }.padding(14).padding(.bottom, 28)
                }
            }.navigationTitle("Commissioner Command").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .topBarLeading) { Button("DONE") { dismiss() }.font(.caption.weight(.black)) } }
                .sheet(isPresented: $showingCardBuilder) {
                    if state.phase == .conferenceChampionships {
                        FieldhouseChampionshipCardBuilder(window: state.window) { games in
                            if state.publishChampionshipCard(games: games) {
                                persist(.publishCard)
                                showingCardBuilder = false
                                scheduleCardNotifications()
                            }
                        }
                    } else {
                        FieldhouseCardBuilder(window: state.window) { games, prop in
                            if state.publishCard(games: games, prop: prop) {
                                persist(.publishCard)
                                showingCardBuilder = false
                                scheduleCardNotifications()
                            }
                        }
                    }
                }
                .alert(
                    "USE \(pendingTrophy?.name.uppercased() ?? "THIS TROPHY")?",
                    isPresented: Binding(
                        get: { pendingTrophy != nil },
                        set: { if !$0 { pendingTrophy = nil } }
                    ),
                    presenting: pendingTrophy
                ) { trophy in
                    Button("CONFIRM TROPHY") {
                        if state.selectChampionshipTrophy(trophy.id) { persist(.trophy) }
                        pendingTrophy = nil
                    }
                    Button("CANCEL", role: .cancel) { pendingTrophy = nil }
                } message: { _ in
                    Text("You may change the selection before the season's first tip. At first tip, the league hardware locks permanently.")
                }
        }.preferredColorScheme(.dark)
    }

    private func scheduleCardNotifications() {
        // Authenticated leagues use the durable server outbox so every member
        // receives one event. Keep local scheduling confined to isolated preview.
        guard !state.isAuthenticatedSession else { return }
        let week = state.window
        let lockAt = state.pickLockDate
        let leagueName = state.league.displayName
        Task {
            await FieldhouseNotificationScheduler.cardPublished(
                leagueID: FieldhousePreviewIdentity.leagueID(for: state.league),
                leagueName: leagueName,
                week: week,
                lockAt: lockAt,
                cardKind: state.cardKind
            )
        }
    }

    private func commandRow(_ title: String, detail: String, icon: String, status: String, color: Color) -> some View {
        return HStack(spacing: 12) {
            Image(systemName: icon).font(.title3.weight(.black)).foregroundStyle(accent).frame(width: 42, height: 42).background(accent.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 4) { Text(title).font(.headline.weight(.black)); Text(detail).font(.caption).foregroundStyle(.white.opacity(0.52)) }
            Spacer(); Text(status).font(.system(size: 8, weight: .black)).tracking(0.8).foregroundStyle(color).padding(.horizontal, 9).padding(.vertical, 6).background(color.opacity(0.12), in: Capsule())
        }.padding(14).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(0.22)))
    }

    private var trophySelector: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("\(state.league.rawValue) · CHAMPIONSHIP TROPHY").font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(accent)
                Spacer()
                Label(state.canSelectChampionshipTrophy ? "SELECT" : "LOCKED", systemImage: state.canSelectChampionshipTrophy ? "hand.tap.fill" : "lock.fill")
                    .font(.system(size: 8, weight: .black)).foregroundStyle(state.canSelectChampionshipTrophy ? accent : .red)
            }
            Text(state.canSelectChampionshipTrophy ? "Choose the league hardware before the season's first tip." : "The season has tipped. Championship hardware is permanently locked.")
                .font(.caption).foregroundStyle(.white.opacity(0.52))
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(FieldhouseTrophyCatalog.options(for: state.league)) { trophy in
                    let selected = state.championshipTrophyID == trophy.id
                    Button { pendingTrophy = trophy } label: {
                        VStack(spacing: 7) {
                            Image(trophy.asset).resizable().scaledToFit().frame(height: 112)
                            Text(trophy.name.uppercased()).font(.system(size: 9, weight: .black)).multilineTextAlignment(.center)
                            Text(trophy.detail).font(.system(size: 8, weight: .semibold)).foregroundStyle(.white.opacity(0.55)).multilineTextAlignment(.center).lineLimit(2)
                        }
                        .frame(maxWidth: .infinity).padding(10)
                        .background(selected ? accent.opacity(0.16) : .black.opacity(0.74), in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? accent : .white.opacity(0.10), lineWidth: selected ? 2 : 1))
                    }.buttonStyle(.plain).disabled(!state.canSelectChampionshipTrophy)
                }
            }
        }
        .padding(14).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(0.28)))
    }
}

private struct FieldhouseCardBuilder: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    let window: Int
    let publish: ([FieldhouseGame], FieldhousePropKind) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var oddsLoaded = false
    @State private var loadingOdds = false
    @State private var oddsError: String?
    @State private var loadedGames: [FieldhouseGame] = []
    @State private var selectedIDs: Set<String> = []
    @State private var selectedProp: FieldhousePropKind?
    private var availableGames: [FieldhouseGame] { loadedGames }
    private var selectedGames: [FieldhouseGame] { availableGames.filter { selectedIDs.contains($0.id) } }
    private let cardSize = FieldhouseGameCatalog.weeklyCardSize
    private var ready: Bool { selectedGames.count == cardSize && selectedProp != nil }
    var body: some View {
        NavigationStack {
            ZStack {
                FieldhouseBackdrop().ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("WINDOW \(window) · COMMISSIONER").font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(accent)
                        Text("BUILD THE CARD").font(.system(size: 36, weight: .black)).fontWidth(.condensed)
                        Text("Pull the Division I board for this Monday–Sunday window, select exactly ten games, confirm the spreads, then choose an automatically scored three-point floor prop.")
                            .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
                        Button { Task { await pullOdds() } } label: {
                            HStack(spacing: 12) {
                                Image(systemName: oddsLoaded ? "checkmark.circle.fill" : "arrow.down.circle.fill")
                                    .font(.title2.weight(.black))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(oddsLoaded ? "ODDS LOADED" : "PULL \(themedLeague.rawValue) ODDS").font(.headline.weight(.black))
                                    Text(oddsLoaded ? "\(availableGames.count) eligible games · Monday–Sunday" : "Load eligible Division I games and current spreads")
                                        .font(.caption.weight(.bold)).opacity(0.72)
                                }
                                Spacer()
                                if loadingOdds { ProgressView().tint(.black) }
                                else if oddsLoaded { Text("READY").font(.caption2.weight(.black)) }
                            }
                            .frame(maxWidth: .infinity).padding(16)
                            .foregroundStyle(oddsLoaded ? Color.green : Color.black)
                            .background(oddsLoaded ? Color.green.opacity(0.12) : accent, in: RoundedRectangle(cornerRadius: 15))
                            .overlay(RoundedRectangle(cornerRadius: 15).stroke(oddsLoaded ? Color.green.opacity(0.55) : accent))
                        }
                        .buttonStyle(.plain)
                        .disabled(oddsLoaded || loadingOdds)

                        if let oddsError {
                            Label(oddsError, systemImage: "exclamationmark.triangle.fill")
                                .font(.footnote.weight(.bold)).foregroundStyle(.red)
                        }

                        if oddsLoaded {
                            ForEach(availableGames) { game in
                                let selected = selectedIDs.contains(game.id)
                                Button {
                                    if selected { selectedIDs.remove(game.id) }
                                    else if selectedIDs.count < cardSize { selectedIDs.insert(game.id) }
                                } label: {
                                    HStack(spacing: 11) {
                                        Image(systemName: selected ? "checkmark.circle.fill" : "circle").font(.title3).foregroundStyle(selected ? accent : .white.opacity(0.38))
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text("\(game.away) at \(game.home)").font(.subheadline.weight(.black)).multilineTextAlignment(.leading)
                                            Text([game.spread, game.bookmaker, game.displayTip(in: window)].compactMap { $0 }.joined(separator: " · "))
                                                .font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.48))
                                        }
                                        Spacer()
                                    }
                                }.buttonStyle(.plain)
                                .disabled(!selected && selectedIDs.count == cardSize)
                                .padding(13).background(selected ? accent.opacity(0.14) : .black.opacity(0.70), in: RoundedRectangle(cornerRadius: 13)).overlay(RoundedRectangle(cornerRadius: 13).stroke(selected ? accent : .white.opacity(0.10)))
                            }
                            VStack(alignment: .leading, spacing: 7) {
                                Text("WEEKLY PROP · 3 POINTS · AUTO-SCORED").font(.caption2.weight(.black)).tracking(1.3).foregroundStyle(accent)
                                Menu {
                                    ForEach(FieldhousePropKind.allCases) { prop in
                                        Button(prop.question) { selectedProp = prop }
                                    }
                                } label: {
                                    HStack(spacing: 10) {
                                        Image(systemName: selectedProp == nil ? "chevron.down.circle" : "checkmark.circle.fill")
                                            .foregroundStyle(selectedProp == nil ? accent : .green)
                                        Text(selectedProp?.question ?? "CHOOSE AN AUTO-SCORED PROP")
                                            .font(.subheadline.weight(.bold)).multilineTextAlignment(.leading)
                                        Spacer()
                                        Image(systemName: "chevron.up.chevron.down").foregroundStyle(accent)
                                    }
                                    .padding(14).background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 11))
                                }
                                .buttonStyle(.plain)
                                Text("\(FieldhousePropKind.allCases.count) verified score-and-spread rules available. No manual grading.")
                                    .font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.45))
                            }
                            Button { if let selectedProp { publish(selectedGames, selectedProp) } } label: {
                                Text("PUBLISH WINDOW \(window)").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16)
                                    .foregroundStyle(.black).background(ready ? accent : Color.gray, in: RoundedRectangle(cornerRadius: 15))
                            }.buttonStyle(.plain).disabled(!ready)
                        }
                    }.padding().padding(.bottom, 24)
                }
                .safeAreaInset(edge: .top, spacing: 0) {
                    if oddsLoaded { cardSelectionProgress }
                }
            }.navigationTitle("Commissioner Command").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("CANCEL") { dismiss() }.font(.caption.weight(.black)) } }
        }.preferredColorScheme(.dark)
    }

    @MainActor private func pullOdds() async {
        oddsError = nil
        loadingOdds = true
        defer { loadingOdds = false }

        // The isolated preview has no authenticated league. It intentionally
        // uses fixtures so UI review never spends provider credits.
        guard auth.user != nil, let leagueID = auth.selectedLeagueId else {
            loadedGames = FieldhouseGameCatalog.games(for: themedLeague)
            oddsLoaded = true
            return
        }
        do {
            let token = try await auth.validAccessToken()
            let feed = try await SupabaseAPI.fieldhouseOdds(
                token: token,
                leagueId: leagueID,
                sportId: themedLeague.favoriteSportID,
                window: window
            )
            let games = feed.games.compactMap { FieldhouseGame(oddsGame: $0, window: window) }
            guard games.count >= cardSize else {
                throw FieldhouseRepositoryError(message: "Only \(games.count) eligible spread games are posted for this week. Try again when sportsbooks publish more lines.")
            }
            loadedGames = games
            oddsLoaded = true
        } catch {
            oddsError = error.localizedDescription
        }
    }

    private var cardSelectionProgress: some View {
        HStack {
            Label("\(selectedGames.count)/\(cardSize) GAMES SELECTED", systemImage: "list.bullet.clipboard.fill")
                .font(.caption.weight(.black))
            Spacer()
            Text("\(max(0, cardSize - selectedGames.count)) REMAINING")
                .font(.caption.weight(.black))
                .foregroundStyle(selectedGames.count == cardSize ? .green : accent)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(.black.opacity(0.97))
        .overlay(alignment: .bottom) { Rectangle().fill(accent.opacity(0.55)).frame(height: 1) }
    }
}

private struct FieldhouseChampionshipCardBuilder: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.fieldhouseLeague) private var themedLeague
    @Environment(\.dismiss) private var dismiss
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    let window: Int
    let publish: ([FieldhouseGame]) -> Void
    @State private var loading = false
    @State private var loadedGames: [FieldhouseGame] = []
    @State private var selections: [FieldhouseChampionshipConference: String] = [:]
    @State private var errorMessage: String?

    private var selectedGames: [FieldhouseGame] {
        FieldhouseChampionshipConference.allCases.compactMap { conference in
            guard let id = selections[conference],
                  let game = loadedGames.first(where: { $0.id == id }) else { return nil }
            return game.assigned(to: conference)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                FieldhouseBackdrop().ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        FieldhouseHero(
                            kicker: "REGULAR-SEASON FINALE",
                            title: "CHAMPIONSHIP WEEK",
                            detail: "One straight-up title pick from the ACC, Big 12, Big Ten, and SEC. No prop. No Hellfire.",
                            icon: "trophy.fill"
                        )
                        Button { Task { await pullGames() } } label: {
                            Label(loadedGames.isEmpty ? "PULL CHAMPIONSHIP GAMES" : "DIVISION I BOARD LOADED", systemImage: loadedGames.isEmpty ? "arrow.down.circle.fill" : "checkmark.circle.fill")
                                .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16)
                                .foregroundStyle(loadedGames.isEmpty ? .black : .green)
                                .background(loadedGames.isEmpty ? accent : Color.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 15))
                        }
                        .buttonStyle(.plain).disabled(loading || !loadedGames.isEmpty)
                        if loading { ProgressView("Loading the championship board…").tint(accent) }
                        if let errorMessage {
                            Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                                .font(.footnote.weight(.bold)).foregroundStyle(.red)
                        }
                        if !loadedGames.isEmpty {
                            ForEach(FieldhouseChampionshipConference.allCases) { conference in
                                conferenceSlot(conference)
                            }
                            VStack(alignment: .leading, spacing: 7) {
                                Label("SCORING CONTRACT", systemImage: "checkmark.seal.fill")
                                    .font(.caption.weight(.black)).foregroundStyle(accent)
                                Text("Players choose four straight-up winners, assign confidence 4–3–2–1 once each, and mark one Best Bet. Certified points join the regular-season total before Selection Sunday freezes the field.")
                                    .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.60))
                            }
                            .padding(14).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(accent.opacity(0.28)))
                            Button { publish(selectedGames) } label: {
                                Text("PUBLISH CHAMPIONSHIP WEEK").font(.headline.weight(.black))
                                    .frame(maxWidth: .infinity).padding(16).foregroundStyle(.black)
                                    .background(selectedGames.count == 4 ? accent : Color.gray, in: RoundedRectangle(cornerRadius: 15))
                            }
                            .buttonStyle(.plain).disabled(selectedGames.count != 4)
                        }
                    }
                    .padding().padding(.bottom, 24)
                }
            }
            .navigationTitle("Commissioner Command")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("CANCEL") { dismiss() }.font(.caption.weight(.black))
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func conferenceSlot(_ conference: FieldhouseChampionshipConference) -> some View {
        let selectedID = selections[conference]
        let selected = selectedID.flatMap { id in loadedGames.first(where: { $0.id == id }) }
        let usedElsewhere = Set(selections.filter { $0.key != conference }.map(\.value))
        return VStack(alignment: .leading, spacing: 9) {
            Text("\(conference.displayName) CHAMPIONSHIP")
                .font(.caption.weight(.black)).tracking(1.2).foregroundStyle(accent)
            Menu {
                ForEach(loadedGames) { game in
                    Button("\(game.away) at \(game.home)") { selections[conference] = game.id }
                        .disabled(usedElsewhere.contains(game.id))
                }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: selected == nil ? "circle" : "checkmark.circle.fill")
                        .foregroundStyle(selected == nil ? .white.opacity(0.35) : .green)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(selected.map { "\($0.away) at \($0.home)" } ?? "CHOOSE THE TITLE GAME")
                            .font(.subheadline.weight(.black)).foregroundStyle(.white)
                        if let selected {
                            Text(selected.displayTip(in: window)).font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.48))
                        }
                    }
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down").foregroundStyle(accent)
                }
                .padding(14).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(selected == nil ? .white.opacity(0.12) : accent.opacity(0.45)))
            }
            .buttonStyle(.plain)
        }
    }

    @MainActor private func pullGames() async {
        errorMessage = nil
        loading = true
        defer { loading = false }
        guard auth.user != nil, let leagueID = auth.selectedLeagueId else {
            loadedGames = FieldhouseGameCatalog.games(for: themedLeague)
            selections = Dictionary(uniqueKeysWithValues: zip(FieldhouseChampionshipConference.allCases, loadedGames.prefix(4)).map { ($0.0, $0.1.id) })
            return
        }
        do {
            let token = try await auth.validAccessToken()
            let feed = try await SupabaseAPI.fieldhouseOdds(
                token: token, leagueId: leagueID,
                sportId: themedLeague.favoriteSportID, window: window
            )
            loadedGames = feed.games.compactMap { FieldhouseGame(oddsGame: $0, window: window) }
            if loadedGames.count < 4 {
                throw FieldhouseRepositoryError(message: "Only \(loadedGames.count) future Division I games are posted. Wait for all four conference title matchups.")
            }
        } catch {
            loadedGames = []
            errorMessage = error.localizedDescription
        }
    }
}

private struct FieldhouseHomeMasthead: View {
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    let state: FieldhouseSeasonState
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("FIELDHOUSE // LIVE", systemImage: "circle.fill")
                    .font(.system(size: 10, weight: .black)).tracking(1.8).foregroundStyle(accent)
                Spacer()
                Text("COMMAND").font(.caption.weight(.black)).tracking(1.2)
                    .foregroundStyle(.black).padding(.horizontal, 16).padding(.vertical, 9).background(.yellow, in: Capsule())
            }
            HStack(spacing: 14) {
                Image(systemName: "basketball.fill").font(.system(size: 38, weight: .black)).foregroundStyle(.black)
                    .frame(width: 68, height: 68).background(accent, in: RoundedRectangle(cornerRadius: 17))
                VStack(alignment: .leading, spacing: 4) {
                    Text(state.league.displayName).font(.system(size: 28, weight: .black)).fontWidth(.condensed)
                    Text(state.postseasonScorecardIsActive
                         ? "\(state.league.rawValue) · 2027 TOURNAMENT · POSTSEASON"
                         : "\(state.league.rawValue) · \(FieldhouseSeasonCalendar.windowLabel(state.window)) · \(state.phase.rawValue)")
                        .font(.system(size: 9, weight: .black)).tracking(1.2).foregroundStyle(.white.opacity(0.55))
                }
            }
            Divider().overlay(accent.opacity(0.45))
            TimelineView(.periodic(from: .now, by: 60)) { context in
                HStack {
                    Label(state.postseasonScorecardIsActive ? "ROUND CLOCK" : "SHOT CLOCK", systemImage: "timer")
                        .font(.caption2.weight(.black)).tracking(1.3)
                    Spacer()
                    Text(state.postseasonScorecardIsActive
                         ? state.postseasonLockLabel(at: context.date)
                         : FieldhouseSeasonCalendar.lockClock(at: context.date, window: state.window, games: state.publishedGames))
                        .font(.caption.weight(.black))
                }.foregroundStyle(accent)
            }
        }
        .padding(18)
        .background(LinearGradient(colors: [accent.opacity(0.25), .black.opacity(0.86)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(accent.opacity(0.58), lineWidth: 1.5))
    }
}

private struct FieldhouseHomeButton: View {
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    let title: String
    let icon: String
    var body: some View {
        Label(title, systemImage: icon).font(.system(size: 10, weight: .black)).tracking(0.6)
            .foregroundStyle(accent).frame(maxWidth: .infinity).padding(.vertical, 17)
            .background(.black.opacity(0.80), in: RoundedRectangle(cornerRadius: 15))
            .overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(0.34)))
    }
}

private struct FieldhouseLeagueSwitcher: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    @Binding var league: FieldhouseLeague
    let dismiss: () -> Void
    @State private var memberships: [LeagueMembership] = []
    @State private var loading = true
    @State private var loadError: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    if loading {
                        ProgressView("Loading your leagues…").tint(accent).padding(28)
                    } else if auth.user == nil {
                        previewLeagueChoices
                    } else if memberships.isEmpty {
                        ContentUnavailableView("No leagues found", systemImage: "person.3.fill", description: Text(loadError ?? "Join or create a league from The Muster."))
                    } else {
                        ForEach(sportIDs, id: \.self) { sportID in
                            sectionLabel(sportID)
                            ForEach(memberships.filter { $0.leagues.sportId.lowercased() == sportID }) { membership in
                                membershipButton(membership)
                            }
                        }
                    }
                }.padding()
            }
            .navigationTitle("Switch League")
            .navigationBarTitleDisplayMode(.inline)
            .task { await loadMemberships() }
        }
        .preferredColorScheme(.dark)
    }

    private var previewLeagueChoices: some View {
        ForEach(FieldhouseLeague.allCases) { option in
            Button { league = option; dismiss() } label: {
                HStack {
                    Image(systemName: "basketball.fill").foregroundStyle(FieldhouseTheme.accent(for: option)).frame(width: 30)
                    VStack(alignment: .leading) {
                        Text(option.rawValue).font(.caption.weight(.black))
                        Text(option.displayName).font(.headline.weight(.black))
                    }
                    Spacer()
                    Image(systemName: league == option ? "checkmark.circle.fill" : "chevron.right")
                }.padding(14).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
            }.buttonStyle(.plain)
        }
    }

    private var sportIDs: [String] {
        let ids = Set(memberships.map { $0.leagues.sportId.lowercased() })
        let preferred = ["cfb", "nfl", "ncaam", "ncaaw", "cbb"]
        return preferred.filter(ids.contains) + ids.filter { !preferred.contains($0) }.sorted()
    }

    private func sectionLabel(_ sportID: String) -> some View {
        Text(sportTitle(sportID))
            .font(.system(size: 10, weight: .black)).tracking(1.8)
            .foregroundStyle(SportIdentity(sportID).accent)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 8)
    }

    private func membershipButton(_ membership: LeagueMembership) -> some View {
        let selected = auth.selectedLeagueId == membership.leagueId
        let identity = SportIdentity(membership.leagues.sportId)
        return Button {
            auth.selectLeague(membership.leagueId)
            dismiss()
        } label: {
            HStack {
                Image(systemName: identity.isFieldhouse ? "basketball.fill" : "football.fill")
                    .foregroundStyle(identity.accent).frame(width: 30)
                VStack(alignment: .leading, spacing: 3) {
                    Text(membership.leagues.name).font(.headline.weight(.black))
                    Text("\(sportTitle(identity.sportId)) · WEEK \(membership.leagues.currentWeek)")
                        .font(.caption2.weight(.black)).foregroundStyle(.white.opacity(0.48))
                }
                Spacer()
                Image(systemName: selected ? "checkmark.circle.fill" : "chevron.right")
                    .foregroundStyle(selected ? identity.accent : .white.opacity(0.55))
            }
            .padding(14)
            .background(.white.opacity(selected ? 0.10 : 0.06), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? identity.accent.opacity(0.55) : .clear))
        }
        .buttonStyle(.plain)
    }

    private func sportTitle(_ sportID: String) -> String {
        switch sportID {
        case "ncaam": "FIELDHOUSE · NCAAM"
        case "ncaaw": "FIELDHOUSE · NCAAW"
        case "cbb": "FIELDHOUSE · LEGACY"
        default: sportID.uppercased()
        }
    }

    @MainActor private func loadMemberships() async {
        guard let user = auth.user else { loading = false; return }
        do {
            let token = try await auth.validAccessToken()
            memberships = try await SupabaseAPI.leagueMemberships(token: token, userId: user.id)
        } catch {
            loadError = error.localizedDescription
        }
        loading = false
    }
}

private enum FieldhousePicksLane: String {
    case liveBoard
    case makePicks
}

private struct FieldhousePicksPage: View {
    @Environment(\.fieldhousePersist) private var persist
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    @Binding var state: FieldhouseSeasonState
    @Binding var strikePresentation: StrikePresentation?
    let roomPickCounts: [String: FieldhouseRoomPickCount]?
    let roomPickCountsAreStale: Bool
    @State private var confirmingLock = false
    @State private var confirmingHellfire = false
    @State private var lane: FieldhousePicksLane = .liveBoard
    @State private var now = Date()
    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 7) {
                laneSelector
                if lane == .makePicks && state.cardIsPublished && !state.picksLocked && !state.pickWindowIsClosed(at: now) {
                    pickProgressHeader
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(.black.opacity(0.97))
            .overlay(alignment: .bottom) { Rectangle().fill(accent.opacity(0.28)).frame(height: 1) }
            .zIndex(2)

            ScrollView {
                VStack(spacing: 12) {
                    if lane == .liveBoard {
                        liveBoard
                    } else if state.picksLocked {
                        lockedUpcomingBoard
                    } else if state.pickWindowIsClosed(at: now) {
                        expiredUpcomingBoard
                    } else if !state.cardIsPublished || state.publishedGames.count != state.cardKind.requiredGameCount {
                        FieldhouseHero(
                            kicker: state.phase == .conferenceChampionships ? "CHAMPIONSHIP WEEK" : "WEEK \(state.window) · ON DECK",
                            title: "CARD NOT POSTED YET",
                            detail: state.phase == .conferenceChampionships
                                ? "The commissioner is posting the ACC, Big 12, Big Ten, and SEC title games."
                                : "Week \(state.scoringWindow) remains on the floor while the commissioner builds the next ten-game card.",
                            icon: "hourglass"
                        )
                    } else {
                        makePicksContent
                    }
                }
                .padding(.horizontal, 14).padding(.top, 8).padding(.bottom, 30)
            }
        }
        .alert("Lock these picks?", isPresented: $confirmingLock) {
            Button("NOT YET", role: .cancel) {}
            Button("LOCK PICKS") { if state.lockPicks(at: Date()) { persist(.picks) } }
        } message: {
            Text("Your card is complete. You can reopen and change it only before the first tip.")
        }
        .alert("Deploy Hellfire?", isPresented: $confirmingHellfire) {
            Button("CANCEL", role: .cancel) {}
            Button("DEPLOY HELLFIRE", role: .destructive) { deployHellfire() }
        } message: {
            Text("This cannot be undone. Hellfire fills and permanently locks all ten favorites, confidence points, Best Bet, and the prop. Every correct game pick scores double. Wrong picks lose nothing. This card cannot be edited or reopened.")
        }
        .onReceive(Timer.publish(every: 15, on: .main, in: .common).autoconnect()) { date in
            now = date
            state.enforcePickDeadline(at: date)
            _ = state.advanceToNextWindow(at: date)
        }
    }

    private var makePicksContent: some View {
        let championship = state.cardKind == .conferenceChampionship
        return VStack(spacing: 12) {
            FieldhouseHero(
                kicker: championship ? "REGULAR-SEASON FINALE" : "ON DECK · WEEK \(state.window)",
                title: championship ? "FOUR TITLES.\nONE LAST MOVE." : "TEN GAMES.\nNO EMPTY POSSESSIONS.",
                detail: championship
                    ? "Pick each conference champion straight up, assign confidence 4–3–2–1, and mark one Best Bet."
                    : "Pick the spread, assign confidence 1–10, mark one Best Bet, and answer the floor prop.",
                icon: championship ? "trophy.fill" : "list.number"
            )
            if state.cardKind.allowsHellfire {
                Button { confirmingHellfire = true } label: {
                    FieldhouseAction(kicker: "HELLFIRE · \(state.regularHellfiresRemaining)/2 AVAILABLE", title: state.regularHellfiresRemaining == 0 ? "Hellfires Expended" : "Deploy Hellfire", detail: "One-way door: fills and locks the card. Correct game picks score double; misses cost nothing.", icon: "scope")
                }.buttonStyle(.plain).disabled(state.regularHellfiresRemaining == 0 || state.picksLocked || !state.canEditPicks(at: now)).opacity(state.regularHellfiresRemaining == 0 || state.picksLocked || !state.canEditPicks(at: now) ? 0.45 : 1)
            }
                ForEach(Array(state.publishedGames.enumerated()), id: \.element.id) { index, game in
                    gameCard(index: index, game: game)
                }
            if state.cardKind.requiresProp {
                VStack(alignment: .leading, spacing: 9) {
                    Text("FLOOR PROP · 3 POINTS").font(.caption2.weight(.black)).tracking(1.4).foregroundStyle(accent)
                    Text(state.publishedProp?.question ?? "PROP NOT PUBLISHED").font(.headline.weight(.black))
                    HStack(spacing: 9) { propButton("YES"); propButton("NO") }
                }.padding(15).background(.black.opacity(0.74), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(0.28)))
            }
                if state.picksLocked {
                    VStack(spacing: 9) {
                        Label("WINDOW \(state.window) PICKS LOCKED", systemImage: "lock.fill").font(.headline.weight(.black)).foregroundStyle(.green)
                        Button("REOPEN PICKS BEFORE FIRST TIP") { _ = state.reopenPicks(at: Date()) }
                            .font(.caption.weight(.black)).foregroundStyle(accent)
                    }.frame(maxWidth: .infinity).padding(16).background(.black.opacity(0.80), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.green.opacity(0.45)))
                } else {
                    Button { confirmingLock = true } label: {
                        Label("LOCK WINDOW \(state.window) PICKS", systemImage: "lock.fill").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(17)
                            .foregroundStyle(.black).background(state.cardIsComplete ? accent : Color.gray, in: RoundedRectangle(cornerRadius: 15))
                    }.buttonStyle(.plain).disabled(!state.cardIsComplete)
                    if !state.cardIsComplete {
                        Text(championship
                             ? "Pick all four champions, use confidence 4–3–2–1 once each, and mark one Best Bet."
                             : "Pick all ten games, use confidence 1–10 once each, mark one Best Bet, and answer the prop.")
                            .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.52)).multilineTextAlignment(.center)
                    }
                }
        }
    }

    private var pickProgressHeader: some View {
        let required = state.cardKind.requiredGameCount
        let made = state.sideSelections.count
        let remaining = max(0, required - made)
        let confidenceReady = state.confidenceSelections.count == required
        return VStack(spacing: 7) {
            HStack {
                Text("\(made)/\(required) PICKS MADE").font(.caption.weight(.black))
                Spacer()
                Text("\(remaining) REMAINING").font(.caption.weight(.black)).foregroundStyle(remaining == 0 ? .green : accent)
            }
            HStack(spacing: 8) {
                requirementChip("CONFIDENCE", ready: confidenceReady)
                requirementChip("BEST BET", ready: state.bestBetGame != nil)
                if state.cardKind.requiresProp {
                    requirementChip("PROP", ready: state.propAnswer != nil)
                }
            }
        }
        .padding(11)
        .background(.black, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(accent.opacity(0.55)))
        .shadow(color: .black.opacity(0.7), radius: 8, y: 4)
    }

    private func requirementChip(_ title: String, ready: Bool) -> some View {
        Label(title, systemImage: ready ? "checkmark.circle.fill" : "circle")
            .font(.system(size: 7, weight: .black)).foregroundStyle(ready ? .green : .white.opacity(0.48))
            .frame(maxWidth: .infinity).padding(.vertical, 5)
            .background(.white.opacity(0.05), in: Capsule())
    }

    private var laneSelector: some View {
        HStack(spacing: 8) {
            laneButton(.liveBoard, label: state.scoringCardKind == .conferenceChampionship ? "CHAMPIONSHIP" : "WEEK \(state.scoringWindow)", title: "LIVE BOARD", icon: "dot.radiowaves.left.and.right")
            laneButton(
                .makePicks,
                label: state.cardKind == .conferenceChampionship || state.phase == .conferenceChampionships ? "CHAMPIONSHIP" : "WEEK \(state.window)",
                title: state.picksLocked ? "LOCKED BOARD" : (state.pickWindowIsClosed(at: now) ? "WINDOW CLOSED" : "MAKE PICKS"),
                icon: state.picksLocked || state.pickWindowIsClosed(at: now) ? "lock.fill" : "checkmark.seal.fill",
                urgent: state.hasOutstandingPickTask(at: now)
            )
        }
        .padding(6)
        .background(.black.opacity(0.84), in: RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).stroke(accent.opacity(0.34)))
    }

    private func laneButton(_ target: FieldhousePicksLane, label: String, title: String, icon: String, urgent: Bool = false) -> some View {
        Button { lane = target } label: {
            VStack(spacing: 4) {
                Text(label).font(.system(size: 8, weight: .black)).tracking(1.2)
                Label(title, systemImage: icon).font(.caption.weight(.black))
            }
            .foregroundStyle(urgent ? .white : (lane == target ? .black : .white.opacity(0.62)))
            .frame(maxWidth: .infinity).padding(.vertical, 11)
            .background(urgent ? Color.red : (lane == target ? accent : .clear), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(urgent ? Color.white.opacity(0.72) : .clear, lineWidth: urgent ? 2 : 0))
            .shadow(color: urgent ? .red.opacity(0.75) : .clear, radius: urgent ? 10 : 0)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("fieldhouse.picks.lane.\(target.rawValue)")
    }

    private var liveBoard: some View {
        VStack(spacing: 10) {
            FieldhouseHero(
                kicker: state.scoringIsComplete ? "FINAL HORN · AUTOMATICALLY CERTIFIED" : (state.scoringCardKind == .conferenceChampionship ? "CHAMPIONSHIP WEEK · ON THE FLOOR" : "ON THE FLOOR · WEEK \(state.scoringWindow)"),
                title: state.scoringIsComplete ? (state.scoringCardKind == .conferenceChampionship ? "CHAMPIONSHIP WEEK IS FINAL" : "WEEK \(state.scoringWindow) IS FINAL") : (state.scoringLiveGames > 0 ? "THE BOARD IS LIVE" : "THE BOARD IS LOCKED"),
                detail: "\(state.scoringFinalGames) final · \(state.scoringLiveGames) live · your scorecard: \(state.scoringPoints) points",
                icon: state.scoringIsComplete ? "checkmark.seal.fill" : "basketball.fill"
            )
            ForEach(Array(state.scoringGames.enumerated()), id: \.element.id) { index, game in
                let result = state.scoringResults[game.id]
                let isFinal = result?.isFinal == true
                let winningTeam = state.scoringCardKind.usesStraightUpScoring
                    ? result?.straightUpWinner(in: game)
                    : result?.coverWinner(in: game)
                HStack(spacing: 10) {
                    Image(systemName: isFinal ? "checkmark.circle.fill" : "dot.radiowaves.left.and.right")
                        .foregroundStyle(isFinal ? .green : accent)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("\(game.away) at \(game.home)").font(.caption.weight(.black))
                        Text(state.scoringCardKind.usesStraightUpScoring
                             ? "\(game.championshipConference?.displayName ?? "CONFERENCE") TITLE · \(game.displayTip(in: state.scoringWindow))"
                             : "\(game.spread) · \(game.displayTip(in: state.scoringWindow))")
                            .font(.system(size: 8, weight: .black)).foregroundStyle(.white.opacity(0.48))
                        if let winningTeam {
                            Text("\(state.scoringCardKind.usesStraightUpScoring ? "CHAMPION" : "COVERING") · \(winningTeam.uppercased())")
                                .font(.system(size: 8, weight: .black)).foregroundStyle(.green)
                        }
                        if let gamePoints = state.scoringGamePoints(at: index) {
                            Text("YOUR PICK · \(state.scoringSelections[index] ?? "—") · CONF \(state.scoringConfidences[index] ?? 0)\(state.scoringBestBetGame == index ? " · BEST BET ×2" : "")")
                                .font(.system(size: 8, weight: .black)).foregroundStyle(gamePoints > 0 ? .green : .red)
                        }
                        if state.roomPicksAreVisible(for: game.id) {
                            if let tally = roomPickCounts?[game.id] {
                                Text("ROOM PICKS · \(tally.away) \(game.away.uppercased()) · \(tally.home) \(game.home.uppercased())\(roomPickCountsAreStale ? " · REFRESH DELAYED" : "")")
                                    .font(.system(size: 7, weight: .black)).foregroundStyle(roomPickCountsAreStale ? .orange : .cyan)
                            } else {
                                Text(state.isAuthenticatedSession ? "ROOM PICK COUNTS REFRESHING" : "ROOM PICK COUNTS REQUIRE A LIVE LEAGUE")
                                    .font(.system(size: 7, weight: .black)).foregroundStyle(.white.opacity(0.38))
                            }
                        } else {
                            Text("ROOM PICKS SEALED UNTIL \(game.displayTip(in: state.scoringWindow))")
                                .font(.system(size: 7, weight: .black)).foregroundStyle(.white.opacity(0.38))
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        if let result { Text("\(result.awayScore)–\(result.homeScore)").font(.headline.weight(.black)) }
                        Text(isFinal ? "FINAL" : periodLabel(result))
                            .font(.caption2.weight(.black)).foregroundStyle(isFinal ? .green : accent)
                        if let gamePoints = state.scoringGamePoints(at: index) {
                            Text("+\(gamePoints)").font(.headline.weight(.black)).foregroundStyle(gamePoints > 0 ? .green : .white.opacity(0.35))
                        }
                    }
                }
                .padding(13).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 13))
                .overlay(RoundedRectangle(cornerRadius: 13).stroke(.white.opacity(0.10)))
            }
            if state.scoringCardKind.requiresProp {
                scoringPropReceipt
            }
        }
    }

    private var scoringPropReceipt: some View {
        let result = state.scoringPropResult
        let correctCall = result.map { state.scoringPropAnswer == ($0 ? "YES" : "NO") }
        return VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text("FLOOR PROP · 3 POINTS").font(.caption2.weight(.black)).tracking(1.3).foregroundStyle(accent)
                Spacer()
                Text(result == nil ? "PENDING" : (result == true ? "YES" : "NO"))
                    .font(.caption.weight(.black)).foregroundStyle(result == nil ? accent : .green)
            }
            Text(state.scoringProp.question).font(.subheadline.weight(.black))
            Text(result == nil ? "Resolves automatically after all ten games are final." : "YOUR CALL · \(state.scoringPropAnswer) · \(correctCall == true ? "+3" : "+0")")
                .font(.caption2.weight(.black)).foregroundStyle(correctCall == true ? .green : .white.opacity(0.50))
        }
        .padding(14).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke((result == nil ? accent : Color.green).opacity(0.35)))
    }

    private func resultStatus(_ result: FieldhouseGameResult?) -> String {
        guard let result else { return "SCHEDULED" }
        switch result.phase {
        case .scheduled: return "SCHEDULED"
        case .live: return "LIVE"
        case .final: return "FINAL"
        }
    }

    private func periodLabel(_ result: FieldhouseGameResult?) -> String {
        guard let result else { return "SOON" }
        if case let .live(period) = result.phase { return period }
        return result.isFinal ? "FINAL" : "SOON"
    }

    private var lockedUpcomingBoard: some View {
        VStack(spacing: 10) {
            FieldhouseHero(
                kicker: state.cardKind == .conferenceChampionship ? "CHAMPIONSHIP WEEK · LOCKED" : "WEEK \(state.window) · LOCKED · AWAITING TIP",
                title: "YOUR BOARD IS SET",
                detail: "Your picks remain visible to you. Room selections declassify one matchup at a time when each game tips.",
                icon: "lock.shield.fill"
            )
            ForEach(Array(state.publishedGames.enumerated()), id: \.element.id) { index, game in
                HStack(spacing: 10) {
                    Image(systemName: "lock.fill").foregroundStyle(accent)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(game.away) at \(game.home)").font(.caption.weight(.black))
                        if let conference = game.championshipConference {
                            Text("\(conference.displayName) CHAMPIONSHIP · STRAIGHT UP")
                                .font(.system(size: 8, weight: .black)).foregroundStyle(accent)
                        }
                        Text(game.displayTip(in: state.window))
                            .font(.system(size: 9, weight: .black)).foregroundStyle(accent)
                        Text("YOUR PICK · \(state.sideSelections[index] ?? "—") · CONF \(state.confidenceSelections[index] ?? 0)")
                            .font(.system(size: 8, weight: .black)).foregroundStyle(.white.opacity(0.58))
                    }
                    Spacer()
                    Text("ROOM SEALED").font(.system(size: 8, weight: .black)).foregroundStyle(accent)
                }
                .padding(13).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 13))
                .overlay(RoundedRectangle(cornerRadius: 13).stroke(accent.opacity(0.22)))
            }
            Button(state.hellfireDeployedOnCurrentCard ? "HELLFIRE CARD CANNOT REOPEN" : "REOPEN PICKS BEFORE FIRST TIP") { _ = state.reopenPicks(at: Date()) }
                .font(.caption.weight(.black)).foregroundStyle(accent)
                .frame(maxWidth: .infinity).padding(15)
                .background(.black.opacity(0.80), in: RoundedRectangle(cornerRadius: 15))
                .overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(0.35)))
                .disabled(state.hellfireDeployedOnCurrentCard || !state.canEditPicks(at: Date()))
                .opacity(!state.hellfireDeployedOnCurrentCard && state.canEditPicks(at: Date()) ? 1 : 0.45)
        }
    }

    private var expiredUpcomingBoard: some View {
        VStack(spacing: 12) {
            FieldhouseHero(
                kicker: "WEEK \(state.window) · WINDOW CLOSED",
                title: "CARD NOT SUBMITTED",
                detail: "The first selected game has tipped. This card is sealed and incomplete picks cannot be changed or scored.",
                icon: "exclamationmark.lock.fill"
            )
            Text("The next card opens with Week \(state.window + 1).")
                .font(.caption.weight(.black)).foregroundStyle(.white.opacity(0.55))
        }
    }

    private func gameCard(index: Int, game matchup: FieldhouseGame) -> some View {
        let selected = state.sideSelections[index]
        let isBestBet = state.bestBetGame == index
        return VStack(alignment: .leading, spacing: 11) {
            HStack {
                Text(matchup.championshipConference.map { "\($0.displayName) CHAMPIONSHIP · \(matchup.displayTip(in: state.window))" } ?? "COURT \(index + 1) · FIRST TIP \(matchup.displayTip(in: state.window))").font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(accent)
                Spacer()
            }
            HStack(spacing: 8) {
                sideButton(matchup.away, game: index, selected: selected)
                Text("AT").font(.caption2.weight(.black)).foregroundStyle(.white.opacity(0.38))
                sideButton(matchup.home, game: index, selected: selected)
            }
            Text(state.cardKind.usesStraightUpScoring ? "PICK THE CHAMPION · STRAIGHT UP" : matchup.spread)
                .font(.caption.weight(.black)).foregroundStyle(.white.opacity(0.52))
            HStack(spacing: 7) {
                Text("CONFIDENCE").font(.system(size: 8, weight: .black)).foregroundStyle(.white.opacity(0.48))
                ForEach(1...state.cardKind.requiredGameCount, id: \.self) { value in
                    let chosen = state.confidenceSelections[index] == value
                    let available = state.confidenceAvailable(value, for: index)
                    Button {
                        state.toggleConfidence(value, for: index)
                    } label: {
                        Text("\(value)").font(.caption.weight(.black)).frame(width: 32, height: 32)
                            .foregroundStyle(chosen ? .black : (available ? .white : .white.opacity(0.22)))
                            .background(chosen ? accent : Color.white.opacity(0.07), in: Circle())
                    }.buttonStyle(.plain).disabled(!available || state.picksLocked || !state.canEditPicks(at: now))
                }
            }
            Button {
                state.bestBetGame = isBestBet ? nil : index
            } label: {
                Label(
                    isBestBet ? "BEST BET ARMED · ×2" : "MARK AS BEST BET · ×2",
                    systemImage: isBestBet ? "star.fill" : "star"
                )
                .font(.caption.weight(.black))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .foregroundStyle(isBestBet ? .black : .white)
                .background(isBestBet ? Color.green : Color.red, in: RoundedRectangle(cornerRadius: 11))
            }
            .buttonStyle(.plain)
            .disabled(state.picksLocked || !state.canEditPicks(at: now))
            .opacity(state.picksLocked || !state.canEditPicks(at: now) ? 0.45 : 1)
            .accessibilityIdentifier("fieldhouse.best-bet.\(index)")
        }.padding(14).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(selected == nil ? .white.opacity(0.12) : accent.opacity(0.42)))
    }

    private func sideButton(_ team: String, game: Int, selected: String?) -> some View {
        Button { state.sideSelections[game] = selected == team ? nil : team } label: {
            Text(team.uppercased()).font(.caption.weight(.black)).minimumScaleFactor(0.7).lineLimit(1)
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .foregroundStyle(selected == team ? .black : .white)
                .background(selected == team ? accent : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 11))
        }.buttonStyle(.plain).disabled(state.picksLocked || !state.canEditPicks(at: now))
    }

    private func propButton(_ answer: String) -> some View {
        Button { state.propAnswer = state.propAnswer == answer ? nil : answer } label: {
            Text(answer).font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(13)
                .foregroundStyle(state.propAnswer == answer ? .black : .white)
                .background(state.propAnswer == answer ? accent : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 11))
        }.buttonStyle(.plain).disabled(state.picksLocked || !state.canEditPicks(at: now))
    }

    private func deployHellfire() {
        guard state.deployRegularSeasonHellfire(at: now) else { return }
        persist(.picks)
        strikePresentation = fieldhouseHellfirePresentation
    }

    private var fieldhouseHellfirePresentation: StrikePresentation {
        StrikePresentation(resourceName: state.league == .ncaaw ? "hellfire-fieldhouse-ncaaw-1" : "hellfire-fieldhouse-1")
    }
}

private struct FieldhouseStandingsPage: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.fieldhouseStandings) private var authenticatedStandings
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    @Binding var state: FieldhouseSeasonState
    @Binding var openActivePostseasonRound: Bool
    let liveProjectionByUser: [UUID: Int]
    let liveProjectionActive: Bool
    let liveProjectionStale: Bool
    private var sportID: String { state.league == .ncaaw ? "ncaaw" : "ncaam" }
    @State private var showingOverall = false
    @State private var showingPostseason = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-bracket")
    @State private var postseasonStrikePresentation: StrikePresentation?
    @State private var profile: Profile?
    @AppStorage("fieldhouse.preview.equippedTitleId") private var previewEquippedTitleId: String?
    private let previewFallbackUserID = UUID(uuidString: "09544d2b-6eca-4131-a321-c000586c9029")!
    private var profileUserID: UUID { auth.user?.id ?? previewFallbackUserID }
    private var playerName: String {
        let name = profile?.displayName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? "Riley V." : name
    }
    private var players: [String] { [playerName, "Full Court Mess", "Bracket Buster", "The Sixth Man", "Baseline Bandit", "March Sadness", "Bank Shot", "Coach's Favorite", "Paint Patrol", "Buzzer Beater", "Zone Defense", "Heat Check", "One Shining Mistake", "Fast Break", "The Transfer Portal", "Double Bonus", "Shot Clock", "Backboard Damage", "Cinderella Story", "Technical Foul", "Bubble Trouble", "Air Ball", "Traveling", "Bench Mob", "Wooden Spoon"] }
    private var usesPostseasonScores: Bool { state.postseasonIsActive }
    private func displayedPoints(for standing: Standing) -> Int {
        if usesPostseasonScores { return state.postseasonPoints(for: standing.userId) }
        if liveProjectionActive, let projected = liveProjectionByUser[standing.userId] { return projected }
        return standing.totalPoints
    }
    private var visibleStandings: [Standing] {
        let sorted = authenticatedStandings.sorted { lhs, rhs in
            let lhsPoints = displayedPoints(for: lhs)
            let rhsPoints = displayedPoints(for: rhs)
            return lhsPoints == rhsPoints
                ? lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
                : lhsPoints > rhsPoints
        }
        guard !showingOverall else { return sorted }
        return sorted.filter { ($0.fieldhouseRegion ?? "").caseInsensitiveCompare(state.selectedRegion.rawValue) == .orderedSame }
    }
    private var displayedPlayerCount: Int {
        authenticatedStandings.isEmpty ? state.regionPlayerCount : visibleStandings.count
    }
    private var regionalCounts: (championship: Int, activeNoBrass: Int, toilet: Int) {
        WarRoomPostseasonRule.regionalCounts(playerCount: displayedPlayerCount)
    }
    private var championshipCutIndex: Int? {
        regionalCounts.championship > 0 ? regionalCounts.championship - 1 : nil
    }
    private var toiletCutIndex: Int? {
        regionalCounts.toilet > 0 ? displayedPlayerCount - regionalCounts.toilet - 1 : nil
    }
    var body: some View {
        Group {
            if showingPostseason {
                VStack(spacing: 13) {
                    Button { showingPostseason = false } label: {
                        Label("BACK TO REGIONAL STANDINGS", systemImage: "chevron.left")
                            .font(.caption.weight(.black)).foregroundStyle(accent)
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
                    }.buttonStyle(.plain)
                    FieldhouseBracketsPage(
                        state: $state,
                        strikePresentation: $postseasonStrikePresentation,
                        openActivePostseasonRound: $openActivePostseasonRound
                    )
                }
            } else {
                ScrollView {
                    VStack(spacing: 13) {
            FieldhouseHero(
                kicker: usesPostseasonScores ? "FIELDHOUSE POSTSEASON" : "FIELDHOUSE STANDINGS",
                title: usesPostseasonScores ? "TOURNAMENT SCOREBOARD" : "REGIONAL SEED LINES",
                detail: usesPostseasonScores
                    ? "Bracket and fresh-round points from the same live total shown on every player’s homepage."
                    : (liveProjectionActive
                        ? "Projected points move with the live board. Certified season totals remain untouched until the final horn."
                        : "Certified points, regional position, and both postseason cuts in the same format used across War Room."),
                icon: usesPostseasonScores ? "chart.line.uptrend.xyaxis" : "list.number"
            )
            if usesPostseasonScores { postseasonRaceSummary } else { regionalCutSummary }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    standingsChip("OVERALL", selected: showingOverall) { showingOverall = true }
                    ForEach(FieldhouseRegion.allCases) { region in
                        standingsChip(region.rawValue, selected: !showingOverall && state.selectedRegion == region) {
                            showingOverall = false; state.selectedRegion = region
                        }
                    }
                }
            }
            VStack(spacing: 8) {
                if authenticatedStandings.isEmpty && state.isAuthenticatedSession {
                    FieldhouseAction(
                        kicker: "LIVE STANDINGS",
                        title: "No player rows available",
                        detail: "Pull to refresh. War Room will never substitute demo names or scores in a live league.",
                        icon: "arrow.clockwise"
                    )
                } else if authenticatedStandings.isEmpty {
                    ForEach(Array(players.enumerated()), id: \.offset) { index, player in
                        standingRow(
                            rank: index + 1,
                            player: player,
                            points: usesPostseasonScores
                                ? (index == 0 ? state.postseasonTotalPoints : max(0, state.postseasonTotalPoints - index))
                                : (index == 0 ? 87 + state.scoringPoints : 87 - (index * 2)),
                            isCurrentUser: index == 0
                        )
                        cutLines(after: index)
                    }
                } else {
                    ForEach(Array(visibleStandings.enumerated()), id: \.element.id) { index, standing in
                        authenticatedStandingRow(
                            rankLabel: displayedRankLabel(for: standing, fallbackIndex: index),
                            highlighted: index < 4,
                            standing: standing
                        )
                        cutLines(after: index)
                    }
                }
            }
            Text("EAST + WEST + SOUTH + MIDWEST  →  CENTER COURT").font(.caption.weight(.black)).tracking(1).foregroundStyle(accent).padding(14).frame(maxWidth: .infinity).background(accent.opacity(0.1), in: Capsule())
            if !usesPostseasonScores { VStack(alignment: .leading, spacing: 12) {
                Text("CHAMPIONSHIP WEEK · POWER FOUR").font(.caption2.weight(.black)).tracking(1.6).foregroundStyle(accent)
                Text("FOUR TROPHIES BEFORE THE BRACKET").font(.title2.weight(.black)).fontWidth(.condensed)
                ForEach(["ACC CHAMPIONSHIP", "BIG 12 CHAMPIONSHIP", "BIG TEN CHAMPIONSHIP", "SEC CHAMPIONSHIP"], id: \.self) { title in
                    HStack {
                        Image(systemName: "trophy.fill").foregroundStyle(.yellow)
                        Text(title).font(.subheadline.weight(.black))
                        Spacer()
                        Text("PICK").font(.caption2.weight(.black)).foregroundStyle(accent)
                        Image(systemName: "chevron.right")
                    }
                    .padding(13).background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(16).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(accent.opacity(0.32))) }
            Button { showingPostseason = true } label: {
                FieldhouseBracketPreview(state: $state)
            }.buttonStyle(.plain)
                    }
                }
            }
        }
        .fullScreenCover(item: $postseasonStrikePresentation) { presentation in
            WeaponStrikeVideoView(presentation: presentation) { postseasonStrikePresentation = nil }
        }
        .task(id: profileUserID) {
            guard let token = auth.token else { profile = nil; return }
            profile = try? await SupabaseAPI.profile(token: token, userId: profileUserID)
        }
        .onAppear { routePostseasonCommandIfNeeded() }
        .onChange(of: openActivePostseasonRound) { _, _ in routePostseasonCommandIfNeeded() }
    }

    private func routePostseasonCommandIfNeeded() {
        guard openActivePostseasonRound else { return }
        showingPostseason = true
    }

    private var regionalCutSummary: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("REGIONAL CUT").font(.caption2.weight(.black)).tracking(1.7).foregroundStyle(accent)
                    Text("\(displayedPlayerCount) PLAYERS · \(showingOverall ? "OVERALL" : "\(state.selectedRegion.rawValue) REGION")")
                        .font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.52))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(currentRegionalRankLabel).font(.title2.weight(.black)).foregroundStyle(accent)
                    if liveProjectionActive {
                        Text(liveProjectionStale ? "LIVE · LAST UPDATE" : "LIVE PROJECTION")
                            .font(.system(size: 7, weight: .black)).tracking(0.8)
                            .foregroundStyle(liveProjectionStale ? .orange : accent)
                    }
                }
            }
            HStack(spacing: 8) {
                cutMetric("TOP", regionalCounts.championship, "CHAMPIONSHIP", .yellow)
                cutMetric("MIDDLE", regionalCounts.activeNoBrass, "NO BRASS", .white)
                cutMetric("BOTTOM", regionalCounts.toilet, "TOILET BOWL", .purple)
            }
            Text("The cut recalculates from the number of players assigned to this region.")
                .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
        }
        .padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.36)))
    }

    private var postseasonRaceSummary: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("ROAD TO CENTER COURT").font(.caption2.weight(.black)).tracking(1.7).foregroundStyle(accent)
                    Text(showingOverall ? "OVERALL TOURNAMENT RACE" : "\(state.selectedRegion.rawValue.uppercased()) REGION RACE")
                        .font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.52))
                }
                Spacer()
                Text("\(state.postseasonTotalPoints) PTS").font(.title3.weight(.black)).foregroundStyle(accent)
            }
            HStack(spacing: 8) {
                cutMetric("BRACKET", state.postseasonBracketAdjustedPoints, "WEIGHTED", .yellow)
                cutMetric("ROUNDS", state.postseasonFreshRoundPoints, "1 EACH", .white)
                cutMetric("TOTAL", state.postseasonTotalPoints, "LIVE", accent)
            }
            Text("\(state.postseasonScoreFreshnessLabel). Every number comes from the same authoritative postseason scoreboard used by the homepage and final trophies.")
                .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
        }
        .padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.36)))
    }

    private func cutMetric(_ label: String, _ value: Int, _ detail: String, _ color: Color) -> some View {
        VStack(spacing: 3) {
            Text("\(value)").font(.title2.weight(.black)).foregroundStyle(color)
            Text(label).font(.system(size: 7, weight: .black))
            Text(detail).font(.system(size: 6, weight: .black)).foregroundStyle(.white.opacity(0.42))
        }
        .frame(maxWidth: .infinity)
    }

    private func standingsChip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.system(size: 10, weight: .black)).tracking(1)
                .foregroundStyle(selected ? .black : .white.opacity(0.72))
                .padding(.horizontal, 13).padding(.vertical, 9)
                .background(selected ? accent : Color.black.opacity(0.72), in: Capsule())
                .overlay(Capsule().stroke(accent.opacity(selected ? 1 : 0.28)))
        }.buttonStyle(.plain)
    }

    private func standingRow(rank: Int, player: String, points: Int, isCurrentUser: Bool) -> some View {
        let rowProfile = isCurrentUser ? profile : nil
        let equippedTitleId = rowProfile?.equippedTitleId ?? (isCurrentUser ? previewEquippedTitleId : nil)
        let earnedTitle = ProfileCosmetics.titleName(for: equippedTitleId)
        let displayName = earnedTitle.map { "\(SportIdentity(sportID).cheevoTitle(code: equippedTitleId ?? "", fallback: $0)) \(player)" } ?? player
        return HStack(spacing: 12) {
            Text("\(rank)").font(.title3.weight(.black)).foregroundStyle(rank <= 4 ? .yellow : .white.opacity(0.58)).frame(width: 30)
            ProfileAvatar(urlString: rowProfile?.avatarURL, name: player, size: 42, borderId: rowProfile?.equippedBorderId, accent: accent)
            VStack(alignment: .leading, spacing: 3) {
                Text(displayName).font(.headline.weight(.black))
                Text(showingOverall ? "FIELDHOUSE OVERALL" : "\(state.selectedRegion.rawValue) REGION").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.44))
            }
            Spacer(); Text("\(points)").font(.title2.weight(.black)).foregroundStyle(accent)
        }.padding(12).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(accent.opacity(0.18)))
    }

    @ViewBuilder private func cutLines(after index: Int) -> some View {
        if !usesPostseasonScores {
            if !showingOverall && index == championshipCutIndex { cutLine("CHAMPIONSHIP CUT", color: .yellow) }
            if !showingOverall && index == toiletCutIndex { cutLine("TOILET BOWL CUT", color: .purple) }
        }
    }

    private func authenticatedStandingRow(rankLabel: String, highlighted: Bool, standing: Standing) -> some View {
        let profile = standing.profiles
        let earnedTitle = ProfileCosmetics.titleName(for: profile?.equippedTitleId)
        let displayName = earnedTitle.map { "\(SportIdentity(sportID).cheevoTitle(code: profile?.equippedTitleId ?? "", fallback: $0)) \(standing.name)" } ?? standing.name
        return HStack(spacing: 12) {
            Text(rankLabel).font(.title3.weight(.black))
                .foregroundStyle(highlighted ? .yellow : .white.opacity(0.58))
                .frame(width: 34)
            ProfileAvatar(urlString: profile?.avatarURL, name: standing.name, size: 42, borderId: profile?.equippedBorderId, accent: accent)
            VStack(alignment: .leading, spacing: 3) {
                Text(displayName).font(.headline.weight(.black))
                Text(showingOverall ? "FIELDHOUSE OVERALL" : "\(standing.fieldhouseRegion?.uppercased() ?? "UNASSIGNED") REGION")
                    .font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.44))
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(displayedPoints(for: standing))").font(.title2.weight(.black)).foregroundStyle(accent)
                if liveProjectionActive && !usesPostseasonScores {
                    Text(liveProjectionStale ? "LAST LIVE" : "PROJECTED")
                        .font(.system(size: 6, weight: .black)).tracking(0.8)
                        .foregroundStyle(liveProjectionStale ? .orange : .white.opacity(0.45))
                }
            }
        }
        .padding(12).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(standing.userId == auth.user?.id ? accent : accent.opacity(0.18), lineWidth: standing.userId == auth.user?.id ? 2 : 1))
    }

    private func cutLine(_ title: String, color: Color) -> some View {
        HStack { Rectangle().fill(color).frame(height: 1); Text(title).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(color); Rectangle().fill(color).frame(height: 1) }
    }

    private func displayedRankLabel(for standing: Standing, fallbackIndex: Int) -> String {
        guard usesPostseasonScores else { return "\(fallbackIndex + 1)" }
        return FieldhousePostseasonRanking.rank(
            for: standing.userId,
            among: visibleStandings.map(\.userId),
            totals: state.postseasonLeaderboardTotals
        )?.rowLabel ?? "\(fallbackIndex + 1)"
    }

    private var currentRegionalRankLabel: String {
        guard let userID = auth.user?.id,
              let standing = visibleStandings.first(where: { $0.userId == userID }) else {
            return "#\(state.rank)"
        }
        guard usesPostseasonScores else {
            let index = visibleStandings.firstIndex(where: { $0.userId == userID }) ?? max(0, state.rank - 1)
            return "#\(index + 1)"
        }
        return FieldhousePostseasonRanking.rank(
            for: standing.userId,
            among: visibleStandings.map(\.userId),
            totals: state.postseasonLeaderboardTotals
        )?.headlineLabel ?? "#\(state.rank)"
    }
}

private struct FieldhouseBracketPreview: View {
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    @Binding var state: FieldhouseSeasonState
    private let conferenceTrophies = ["ACC", "BIG 12", "BIG TEN", "SEC"]
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("CHAMPIONSHIP WEEK · FOUR TROPHIES").font(.caption2.weight(.black)).tracking(1.6).foregroundStyle(accent)
            Text("CUT DOWN FOUR NETS").font(.title2.weight(.black)).fontWidth(.condensed)
            Text("The four featured conference championships close the regular season before Selection Sunday opens the national bracket.")
                .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
            HStack(spacing: 7) {
                ForEach(conferenceTrophies, id: \.self) { conference in
                    VStack(spacing: 5) {
                        Image(systemName: "trophy.fill").foregroundStyle(.yellow)
                        Text(conference).font(.system(size: 7, weight: .black)).minimumScaleFactor(0.7)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 10)
                    .background(.yellow.opacity(0.09), in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(.yellow.opacity(0.35)))
                }
            }
            HStack {
                Text("CONFERENCE CHAMPIONSHIPS")
                Spacer()
                Image(systemName: "arrow.right")
                Text("76-TEAM BRACKET")
            }
            .font(.system(size: 8, weight: .black)).foregroundStyle(accent)
        }
        .padding(16).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(accent.opacity(0.42)))
    }
}

private struct FieldhouseBracketsPage: View {
    @Environment(\.fieldhouseLeague) private var themedLeague
    @Environment(\.fieldhousePersist) private var persist
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    @Binding var state: FieldhouseSeasonState
    @Binding var strikePresentation: StrikePresentation?
    @Binding var openActivePostseasonRound: Bool
    var overviewHorizontalPadding: CGFloat = 0
    @State private var confirmingBracketHellfire = false
    @State private var showingHistory = false
    @State private var showingBracketPicker = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-bracket")
    @State private var showingRoundPicker = ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-round")
    @State private var showingFieldImporter = false
    @State private var showingScheduleImporter = false
    @State private var pendingFieldData: Data?
    @State private var pendingScheduleData: Data?
    @State private var confirmingFieldPublish = false
    @State private var confirmingScheduleSync = false
    var body: some View {
        Group {
            if showingRoundPicker, let field = state.officialPostseasonField, let round = state.activePostseasonRound {
                FieldhouseRoundPickerView(
                    league: state.league,
                    field: field,
                    roundKey: round,
                    picks: Binding(
                        get: { state.postseasonRoundPicks[round] ?? [:] },
                        set: { state.postseasonRoundPicks[round] = $0 }
                    ),
                    submitted: state.postseasonRoundSubmitted.contains(round),
                    locked: state.postseasonRoundIsLocked(round),
                    scheduleReady: state.postseasonRoundScheduleIsReady(round),
                    save: {
                        state.postseasonRoundSubmitted.insert(round)
                        persist(.postseasonRound)
                    },
                    close: { showingRoundPicker = false }
                )
            } else if showingBracketPicker {
                FieldhouseBracketPickerView(
                    league: state.league,
                    officialField: state.officialPostseasonField,
                    picks: $state.postseasonBracketPicks,
                    submitted: $state.bracketSubmitted,
                    locked: state.postseasonBracketIsLocked(),
                    hellfireUsed: state.bracketHellfireUsed,
                    save: { persist(.bracket) },
                    close: { showingBracketPicker = false }
                )
            } else {
                ScrollView {
                    overview
                        .padding(.horizontal, overviewHorizontalPadding)
                        .padding(.bottom, 30)
                }
            }
        }
        .alert("Launch Bracket Hellfire?", isPresented: $confirmingBracketHellfire) {
            Button("CANCEL", role: .cancel) {}
            Button("LAUNCH AND LOCK", role: .destructive) { deployBracketHellfire() }
        } message: {
            Text("This cannot be undone. The machine makes all 75 decisions in the 76-team bracket, locks it permanently, and allows no edits or rerolls. At least 60% correct earns 1.5× raw bracket points. Below 60% cuts raw bracket points in half.")
        }
        .onAppear { openRequestedRoundIfNeeded() }
        .onChange(of: openActivePostseasonRound) { _, _ in openRequestedRoundIfNeeded() }
        .fileImporter(isPresented: $showingFieldImporter, allowedContentTypes: [.json], allowsMultipleSelection: false) { result in
            guard case .success(let urls) = result, let url = urls.first else { return }
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            pendingFieldData = try? Data(contentsOf: url)
            confirmingFieldPublish = pendingFieldData != nil
        }
        .fileImporter(isPresented: $showingScheduleImporter, allowedContentTypes: [.json], allowsMultipleSelection: false) { result in
            guard case .success(let urls) = result, let url = urls.first else { return }
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            pendingScheduleData = try? Data(contentsOf: url)
            confirmingScheduleSync = pendingScheduleData != nil
        }
        .alert("Publish this official 76-team field?", isPresented: $confirmingFieldPublish) {
            Button("CANCEL", role: .cancel) { pendingFieldData = nil }
            Button("IMPORT DRAFT") {
                if let data = pendingFieldData { persist(.importOfficialField(data, publish: false)) }
                pendingFieldData = nil
            }
            Button("PUBLISH FIELD") {
                if let data = pendingFieldData { persist(.importOfficialField(data, publish: true)) }
                pendingFieldData = nil
            }
        } message: {
            Text("War Room validates exactly 76 teams, 75 connected games, four 16-slot regions, 12 Opening Round feeders, and official tip times. Publishing opens this same field in every \(state.league.rawValue) league.")
        }
        .alert("Sync the official game schedule?", isPresented: $confirmingScheduleSync) {
            Button("CANCEL", role: .cancel) { pendingScheduleData = nil }
            Button("SYNC TIMES + EVENT IDS") {
                if let data = pendingScheduleData { persist(.syncOfficialSchedule(data)) }
                pendingScheduleData = nil
            }
        } message: {
            Text("Only official tip times and Odds API event IDs are updated. The bracket graph and every player's permanent picks remain untouched.")
        }
    }

    private func openRequestedRoundIfNeeded() {
        guard openActivePostseasonRound, state.activePostseasonRound != nil else { return }
        showingRoundPicker = true
        openActivePostseasonRound = false
    }

    private var overview: some View {
        VStack(spacing: 13) {
            Button { confirmingBracketHellfire = true } label: {
                FieldhouseAction(kicker: "BRACKET HELLFIRE · 1/1", title: state.bracketHellfireUsed ? "Hellfire Bracket Locked" : "Launch the AI Crazy Pick", detail: state.bracketHellfireUsed ? "All 75 decisions are sealed. No reroll." : "One-way door. AI fills an erratic 76-team bracket and seals all 75 decisions. Hit 60% for 1.5×; miss it and raw points are cut in half.", icon: "wand.and.stars")
            }.buttonStyle(.plain).disabled(state.bracketHellfireUsed || state.postseasonBracketIsLocked() || (state.officialPostseasonField == nil && state.isAuthenticatedSession))
            activeRoundCommand
            FieldhouseHero(kicker: "MARCH COMMAND · 76 TEAMS · 75 DECISIONS", title: "ROAD TO CENTER COURT", detail: "Twelve Opening Round games feed the familiar field of 64. Every winner advances through the real bracket path.", icon: "point.3.connected.trianglepath.dotted")
            if state.isCreator {
                VStack(spacing: 10) {
                    Button { showingFieldImporter = true } label: {
                        FieldhouseAction(kicker: "OWNER CONTROL · SELECTION SUNDAY", title: "Import Official Field", detail: "Load one validated JSON bracket for every \(state.league.rawValue) league. Draft first or publish when verified.", icon: "doc.badge.plus")
                    }.buttonStyle(.plain)
                    Button { showingScheduleImporter = true } label: {
                        FieldhouseAction(kicker: "OWNER CONTROL · OFFICIAL SCHEDULE", title: "Sync Times + Event IDs", detail: "Update broadcast changes and provider links without replacing the bracket or player receipts.", icon: "clock.arrow.2.circlepath")
                    }.buttonStyle(.plain)
                }
            }
            postseasonPaths
            Button { showingBracketPicker = true } label: {
                FieldhouseAction(
                    kicker: state.postseasonBracketIsLocked() ? "PERMANENT BRACKET RECEIPT" : state.bracketSubmitted ? "BRACKET FILED · EDITABLE UNTIL TIP" : "SELECTION SUNDAY · PICKS OPEN",
                    title: state.postseasonBracketIsLocked() ? "View My Locked Bracket" : state.bracketSubmitted ? "Review or Change My Bracket" : "Fill Out My 76-Team Bracket",
                    detail: bracketDetail,
                    icon: "rectangle.split.3x3.fill"
                )
            }.buttonStyle(.plain).disabled(state.officialPostseasonField == nil && state.isAuthenticatedSession)
            FieldhouseRegionalRacePreview(state: state, selectedRegion: state.selectedRegion)
            HStack(spacing: 8) {
                bracketModeButton("CURRENT BRACKET", history: false)
                bracketModeButton("HISTORY", history: true)
            }
            if showingHistory {
                FieldhouseAction(kicker: "BRACKET ARCHIVE", title: "No completed Fieldhouse bracket yet", detail: "Finished tournament brackets remain here permanently by season. The first archive appears after the 2027 title game.", icon: "archivebox.fill")
            } else {
                FieldhouseNationalBracketMap()
            }
            Text("REGULAR SEASON HELLFIRE: 2/2 · BRACKET HELLFIRE: 1 TOTAL · NO EDITS · NO REROLLS").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.48))
        }
    }

    @ViewBuilder private var activeRoundCommand: some View {
        if let round = state.activePostseasonRound, let field = state.officialPostseasonField {
            let required = field.games.filter { $0.roundKey == round }.count
            let complete = (state.postseasonRoundPicks[round] ?? [:]).count == required
            let filed = state.postseasonRoundSubmitted.contains(round)
            let locked = state.postseasonRoundIsLocked(round)
            let scheduleReady = state.postseasonRoundScheduleIsReady(round)
            Button { showingRoundPicker = true } label: {
                FieldhouseAction(
                    kicker: !scheduleReady ? "CURRENT ROUND · OFFICIAL SCHEDULE PENDING" : locked && !filed ? "CURRENT ROUND · LOCKED · NO CARD FILED" : locked ? "CURRENT ROUND · LIVE BOARD" : filed ? "CURRENT ROUND · PICKS FILED" : "CURRENT ROUND · ACTION REQUIRED",
                    title: !scheduleReady ? "\(FieldhouseBracketEngine.roundTitle(round)) Times Not Final" : locked ? "Open \(FieldhouseBracketEngine.roundTitle(round)) Board" : filed ? "Review \(FieldhouseBracketEngine.roundTitle(round)) Picks" : "Make \(FieldhouseBracketEngine.roundTitle(round)) Picks",
                    detail: !scheduleReady
                        ? "The matchup is ready. Picks open only after every official tip time is on file."
                        : "\((state.postseasonRoundPicks[round] ?? [:]).count)/\(required) winners selected · one point each · \(locked ? "scores update as games finish." : "locks at first tip.")",
                    icon: !scheduleReady ? "clock.fill" : locked ? "play.rectangle.on.rectangle.fill" : complete ? "checkmark.seal.fill" : "basketball.fill",
                    signalColor: !scheduleReady ? .orange : locked ? accent : filed ? .green : .red
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fieldhouse.postseason.current-round")
        } else if state.isAuthenticatedSession {
            FieldhouseAction(kicker: "CURRENT ROUND", title: "Next Round Pending", detail: "The next card opens automatically after every team in the prior round is official.", icon: "clock.fill", signalColor: .orange)
        }
    }

    private var postseasonPaths: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("TWO PATHS · ONE POSTSEASON SCORE").font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(accent)
            HStack(spacing: 9) {
                postseasonPath(icon: "rectangle.split.3x3.fill", title: "MY BRACKET", detail: "Predict all 75 games once. Locks before the Buy-In.")
                postseasonPath(icon: "basketball.fill", title: "ROUND PICKS", detail: "A fresh winner card opens and scores every round.")
            }
            Text("Both paths earn trophy points. Cheevos remain career rewards and never alter the regional race.")
                .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
        }
        .padding(14).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.36)))
    }

    private func postseasonPath(icon: String, title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Image(systemName: icon).font(.title2).foregroundStyle(accent)
            Text(title).font(.caption.weight(.black)).foregroundStyle(.white)
            Text(detail).font(.system(size: 9, weight: .semibold)).foregroundStyle(.white.opacity(0.58)).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, minHeight: 112, alignment: .topLeading).padding(12)
        .background(accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(accent.opacity(0.25)))
    }

    private func bracketModeButton(_ title: String, history: Bool) -> some View {
        Button { showingHistory = history } label: {
            Text(title).font(.caption.weight(.black)).frame(maxWidth: .infinity).padding(.vertical, 11)
                .foregroundStyle(showingHistory == history ? .black : accent)
                .background(showingHistory == history ? accent : .black.opacity(0.7), in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(accent.opacity(0.55)))
        }.buttonStyle(.plain)
    }

    private func deployBracketHellfire() {
        guard !state.bracketHellfireUsed, !state.postseasonBracketIsLocked() else { return }
        state.postseasonBracketPicks = FieldhouseBracketEngine.hellfirePicks(league: state.league, field: state.officialPostseasonField)
        state.bracketSubmitted = true
        state.bracketHellfireUsed = true
        state.bracketLocked = true
        persist(.bracket)
        strikePresentation = StrikePresentation(resourceName: state.league == .ncaaw ? "hellfire-fieldhouse-ncaaw-1" : "hellfire-fieldhouse-1")
    }

    private var bracketDetail: String {
        guard state.officialPostseasonField != nil || !state.isAuthenticatedSession else {
            return "Selection Sunday field pending. War Room will publish the verified 76-team bracket here—no commissioner entry required."
        }
        let complete = FieldhouseBracketEngine.progress(picks: state.postseasonBracketPicks, league: state.league, field: state.officialPostseasonField)
        return "Buy-In games, four regions, Final Four, and the championship. \(complete)/75 decisions complete."
    }
}

private struct FieldhouseRegionalRacePreview: View {
    @Environment(\.fieldhouseLeague) private var themedLeague
    @Environment(\.fieldhouseStandings) private var standings
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    let state: FieldhouseSeasonState
    let selectedRegion: FieldhouseRegion

    private let previewScores: [(String, Int, Int)] = [
        ("RILEY V.", 94, 0),
        ("FULL COURT MESS", 89, 5),
        ("BRACKET BUSTER", 82, 12),
        ("THE SIXTH MAN", 74, 20)
    ]
    private var liveRegionalStandings: [Standing] {
        standings
            .filter { ($0.fieldhouseRegion ?? "").caseInsensitiveCompare(selectedRegion.rawValue) == .orderedSame }
            .sorted {
                let lhs = state.postseasonPoints(for: $0.userId)
                let rhs = state.postseasonPoints(for: $1.userId)
                return lhs == rhs
                    ? $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
                    : lhs > rhs
            }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                Image(selectedRegion.regionalTrophyAsset)
                    .resizable().scaledToFit().frame(width: 88, height: 88)
                    .accessibilityLabel("\(selectedRegion.rawValue.capitalized) postseason regional championship trophy")
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(selectedRegion.rawValue) POSTSEASON RACE").font(.caption2.weight(.black)).tracking(1.4).foregroundStyle(accent)
                    Text(selectedRegion.regionalTrophyName.uppercased()).font(.title3.weight(.black)).fontWidth(.condensed)
                    Text("Regular season earns entry. Highest cumulative postseason score through the title game earns this trophy.")
                        .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
                }
            }

            if state.isAuthenticatedSession && liveRegionalStandings.isEmpty {
                Text("The live regional race appears after postseason scores are recorded. No demo standings are shown in authenticated leagues.")
                    .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12).background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 11))
            } else if state.isAuthenticatedSession {
                ForEach(Array(liveRegionalStandings.prefix(4).enumerated()), id: \.element.id) { index, standing in
                    let score = state.postseasonPoints(for: standing.userId)
                    let leader = liveRegionalStandings.first.map { state.postseasonPoints(for: $0.userId) } ?? score
                    let rank = FieldhousePostseasonRanking.rank(
                        for: standing.userId,
                        among: liveRegionalStandings.map(\.userId),
                        totals: state.postseasonLeaderboardTotals
                    )
                    raceRow(rankLabel: rank?.rowLabel ?? "\(index + 1)", name: standing.name, score: score, pointsBack: max(0, leader - score))
                }
            } else {
                ForEach(Array(previewScores.enumerated()), id: \.offset) { index, entry in
                    raceRow(rankLabel: "\(index + 1)", name: entry.0, score: entry.1, pointsBack: entry.2)
                }
            }

            HStack(spacing: 6) {
                ForEach(FieldhouseRegion.allCases) { region in
                    VStack(spacing: 4) {
                        Image(region.regionalTrophyAsset).resizable().scaledToFit().frame(height: 44)
                        Text(region.rawValue).font(.system(size: 7, weight: .black)).foregroundStyle(region == selectedRegion ? accent : .white.opacity(0.45))
                    }.frame(maxWidth: .infinity)
                }
            }
            Text("FOUR POSTSEASON REGIONAL CHAMPIONS CUT DOWN THEIR NETS")
                .font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.yellow).frame(maxWidth: .infinity)
        }
        .padding(15).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(accent.opacity(0.42)))
    }

    private func raceRow(rankLabel: String, name: String, score: Int, pointsBack: Int) -> some View {
                HStack(spacing: 10) {
                    Text(rankLabel).font(.headline.weight(.black)).foregroundStyle(pointsBack == 0 ? .yellow : .white.opacity(0.55)).frame(width: 28)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name.uppercased()).font(.caption.weight(.black))
                        Text(pointsBack == 0 ? "POSTSEASON LEADER" : "\(pointsBack) BACK · PICKS CONTINUE")
                            .font(.system(size: 8, weight: .black)).tracking(0.7).foregroundStyle(pointsBack == 0 ? .yellow : accent)
                    }
                    Spacer()
                    Text("\(score)").font(.title3.weight(.black)).foregroundStyle(accent)
                }
                .padding(10).background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 11))
    }
}

private struct FieldhouseNationalBracketMap: View {
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    private let rounds = [("ROUND OF 64", 8), ("ROUND OF 32", 4), ("SWEET 16", 2), ("ELITE 8", 1)]
    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            VStack(alignment: .leading, spacing: 8) {
                HStack { Label("OPENING ROUND", systemImage: "arrow.triangle.branch"); Spacer(); Text("12 GAMES · 24 TEAMS") }
                    .font(.caption.weight(.black)).foregroundStyle(.yellow)
                Text("The 12 winners feed directly into the standard 64-team bracket.")
                    .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
                HStack(spacing: 4) {
                    ForEach(1...12, id: \.self) { game in
                        Text("\(game)").font(.system(size: 7, weight: .black)).foregroundStyle(.black)
                            .frame(maxWidth: .infinity).padding(.vertical, 5).background(.yellow, in: RoundedRectangle(cornerRadius: 4))
                    }
                }
            }
            .padding(13).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(.yellow.opacity(0.38)))

            ForEach(FieldhouseRegion.allCases) { region in
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Text("\(region.rawValue) REGION").font(.caption.weight(.black)); Spacer(); Text("16 → 8 → 4 → 2 → 1").font(.system(size: 8, weight: .black)).foregroundStyle(accent) }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .center, spacing: 9) {
                            ForEach(Array(rounds.enumerated()), id: \.offset) { index, round in
                                bracketRound(round.0, games: round.1, emphasized: index == rounds.count - 1)
                                if index < rounds.count - 1 { Image(systemName: "chevron.right.2").foregroundStyle(accent.opacity(0.65)) }
                            }
                        }
                    }
                }
                .padding(13).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(accent.opacity(0.28)))
            }

            HStack(spacing: 9) {
                bracketRound("FINAL FOUR", games: 2, emphasized: true)
                Image(systemName: "chevron.right.2").foregroundStyle(.yellow)
                bracketRound("TITLE GAME", games: 1, emphasized: true)
                Image(systemName: "trophy.fill").font(.title2).foregroundStyle(.yellow)
            }
            .padding(13).background(accent.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(.yellow.opacity(0.45)))
            Text("Selection Sunday will replace every seed placeholder with the official field. The completed bracket remains in History as a permanent receipt.")
                .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
        }
    }

    private func bracketRound(_ title: String, games: Int, emphasized: Bool) -> some View {
        VStack(spacing: 6) {
            Text(title).font(.system(size: 8, weight: .black)).foregroundStyle(emphasized ? .yellow : accent)
            ForEach(0..<games, id: \.self) { game in
                VStack(spacing: 2) {
                    Text("SEED · TEAM").lineLimit(1)
                    Rectangle().fill(.white.opacity(0.12)).frame(height: 1)
                    Text("SEED · TEAM").lineLimit(1)
                }
                .font(.system(size: 7, weight: .bold)).foregroundStyle(.white.opacity(0.55))
                .frame(width: 92).padding(6).background(.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 7))
                .overlay(RoundedRectangle(cornerRadius: 7).stroke(emphasized ? .yellow.opacity(0.30) : .white.opacity(0.12)))
                .accessibilityLabel("\(title) game \(game + 1), awaiting Selection Sunday teams")
            }
        }
    }
}

private struct FieldhouseDispatchPage: View { var body: some View { VStack(spacing: 13) { FieldhouseHero(kicker: "THE FIELDHOUSE DISPATCH", title: "FINAL SCORES.\nFULL RECEIPTS.", detail: "Regional movement, busted chalk, buzzer beaters, and the weekly floor report.", icon: "newspaper.fill"); FieldhouseAction(kicker: "FRONT PAGE", title: "THE PAINT BELONGED TO NOBODY", detail: "Three favorites fell. One Best Bet survived. The Midwest is already hostile.", icon: "doc.text.image.fill") } } }

private struct FieldhouseLockerMessage: Identifiable {
    let id: String
    let author: String
    let body: String
    let avatarURL: String?
    let isMine: Bool
}

private struct FieldhouseChatAvatar: View {
    let urlString: String?
    let name: String
    let accent: Color

    private var url: URL? { urlString.flatMap(URL.init(string:)) }
    private var initials: String {
        name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
    }

    var body: some View {
        ZStack {
            Circle().fill(accent.opacity(0.18))
            if let url {
                AsyncImage(url: url) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else { fallback }
                }
            } else {
                fallback
            }
        }
        .frame(width: 38, height: 38)
        .clipShape(Circle())
        .overlay(Circle().stroke(accent.opacity(0.72), lineWidth: 1.5))
        .shadow(color: accent.opacity(0.18), radius: 7)
        .accessibilityLabel("\(name) profile photo")
    }

    private var fallback: some View {
        Text(initials).font(.system(size: 11, weight: .black)).foregroundStyle(accent)
    }
}

private struct FieldhouseLockerPage: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    private static let bottomAnchor = "fieldhouse-locker-bottom"
    @State private var draft = ""
    @State private var selectedProfile: FieldhouseLockerMessage?
    @State private var profile: Profile?
    private let previewFallbackUserID = UUID(uuidString: "09544d2b-6eca-4131-a321-c000586c9029")!
    private var profileUserID: UUID { auth.user?.id ?? previewFallbackUserID }
    private var playerName: String {
        let name = profile?.displayName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? "Riley V." : name
    }
    @State private var messages = [
        FieldhouseLockerMessage(id: "full-court-1", author: "Full Court Mess", body: "That bracket has six exits and you found all seven.", avatarURL: nil, isMine: false),
        FieldhouseLockerMessage(id: "midwest-1", author: "Midwest to the Middle", body: "Book it. This region belongs to us.", avatarURL: nil, isMine: false),
        FieldhouseLockerMessage(id: "riley-1", author: "Riley V.", body: "Two Hellfires and still down twelve is nasty work.", avatarURL: nil, isMine: true),
        FieldhouseLockerMessage(id: "buster-1", author: "Bracket Buster", body: "Receipts are permanent. Keep talking.", avatarURL: nil, isMine: false)
    ]

    var body: some View {
        VStack(spacing: 8) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 6) {
                            Label("FIELDHOUSE LIVE WIRE", systemImage: "bolt.fill").font(.caption2.weight(.black)).tracking(2).foregroundStyle(accent)
                            Text("THE LOCKER\nROOM").font(.system(size: 36, weight: .black)).fontWidth(.condensed).lineSpacing(-4)
                            Text("NO PRESS. NO PR TEAM. NO ALIBIS.").font(.system(size: 9, weight: .black)).tracking(1.5).foregroundStyle(.red)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(18).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 18)).overlay(alignment: .leading) { Rectangle().fill(accent).frame(width: 4).padding(.vertical, 12) }
                        ForEach(messages) { message in
                            let displayedMessage = resolved(message)
                            HStack(alignment: .top, spacing: 9) {
                                if message.isMine { Spacer(minLength: 38) }
                                if !message.isMine {
                                    profileButton(for: displayedMessage)
                                }
                                VStack(alignment: message.isMine ? .trailing : .leading, spacing: 5) {
                                    Button { selectedProfile = displayedMessage } label: {
                                        Text(message.isMine ? "YOU" : displayedMessage.author.uppercased()).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(accent)
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityHint("Opens this player's profile")
                                    Text(message.body).font(.subheadline.weight(.semibold)).multilineTextAlignment(message.isMine ? .trailing : .leading)
                                    HStack(spacing: 12) { Text("🔥 2"); Text("😂 1"); Text("💀"); Text("🏀") }.font(.caption).foregroundStyle(.white.opacity(0.55))
                                }
                                .frame(maxWidth: .infinity, alignment: message.isMine ? .trailing : .leading)
                                .padding(13)
                                .background(.black.opacity(0.74), in: RoundedRectangle(cornerRadius: 15))
                                .overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(0.20)))
                                if message.isMine {
                                    profileButton(for: displayedMessage)
                                } else { Spacer(minLength: 38) }
                            }
                        }
                        Color.clear.frame(height: 1).id(Self.bottomAnchor)
                    }.padding(.top, 8)
                }
                .onAppear { DispatchQueue.main.async { proxy.scrollTo(Self.bottomAnchor, anchor: .bottom) } }
                .onChange(of: messages.count) { _, _ in proxy.scrollTo(Self.bottomAnchor, anchor: .bottom) }
            }
            HStack(alignment: .bottom, spacing: 9) {
                TextField("Deliver a questionable take…", text: $draft, axis: .vertical)
                    .lineLimit(1...3).padding(12).background(.black.opacity(0.84), in: RoundedRectangle(cornerRadius: 14))
                Button {
                    let clean = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !clean.isEmpty else { return }
                    messages.append(FieldhouseLockerMessage(id: UUID().uuidString, author: playerName, body: clean, avatarURL: profile?.avatarURL, isMine: true)); draft = ""
                } label: {
                    Image(systemName: "paperplane.fill").font(.headline).foregroundStyle(.black).frame(width: 46, height: 46).background(accent, in: Circle())
                }.buttonStyle(.plain)
            }.padding(.vertical, 8)
        }
        .sheet(item: $selectedProfile) { message in
            FieldhouseLockerProfileSheet(message: message)
        }
        .onAppear {
            if ProcessInfo.processInfo.arguments.contains("--fieldhouse-review-locker-profile") {
                selectedProfile = messages.first
            }
        }
        .task(id: profileUserID) {
            guard let token = auth.token else { profile = nil; return }
            profile = try? await SupabaseAPI.profile(token: token, userId: profileUserID)
        }
    }

    private func resolved(_ message: FieldhouseLockerMessage) -> FieldhouseLockerMessage {
        guard message.isMine else { return message }
        return FieldhouseLockerMessage(id: message.id, author: playerName, body: message.body, avatarURL: profile?.avatarURL, isMine: true)
    }

    private func profileButton(for message: FieldhouseLockerMessage) -> some View {
        Button { selectedProfile = message } label: {
            FieldhouseChatAvatar(urlString: message.avatarURL, name: message.author, accent: accent)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open \(message.author) profile")
    }
}

private struct FieldhouseLockerProfileSheet: View {
    @Environment(\.fieldhouseLeague) private var league
    @Environment(\.dismiss) private var dismiss
    let message: FieldhouseLockerMessage
    private var accent: Color { FieldhouseTheme.accent(for: league) }

    var body: some View {
        NavigationStack {
            ZStack {
                FieldhouseBackdrop().ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 16) {
                        FieldhouseChatAvatar(urlString: message.avatarURL, name: message.author, accent: accent)
                            .scaleEffect(2.35)
                            .frame(height: 112)
                        Text(message.author).font(.system(size: 34, weight: .black)).fontWidth(.condensed)
                        Text("\(league.rawValue) PLAYER DOSSIER").font(.caption2.weight(.black)).tracking(2).foregroundStyle(accent)
                        HStack(spacing: 9) {
                            FieldhouseMetric(value: "#8", label: "REGION")
                            FieldhouseMetric(value: "6-4", label: "ATS")
                            FieldhouseMetric(value: "1/2", label: "HELLFIRES")
                        }
                        FieldhouseAction(kicker: "FAVORITE TEAM", title: league == .ncaaw ? "South Carolina Gamecocks" : "Duke Blue Devils", detail: "Public profile selection", icon: "heart.fill")
                        FieldhouseAction(kicker: "CRYSTAL BALL · SEALED", title: "UConn Huskies", detail: "Preseason championship prediction", icon: "sparkles")
                        FieldhouseAction(kicker: "LATEST TRANSMISSION", title: message.body, detail: "From the Locker Room", icon: "bubble.left.fill")
                    }
                    .padding(18).padding(.bottom, 28)
                }
            }
            .navigationTitle("Player Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("DONE") { dismiss() }.font(.caption.weight(.black))
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}
private struct FieldhouseProfilePage: View {
    @Environment(\.fieldhousePersist) private var persist
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.fieldhouseLeague) private var themedLeague
    private var accent: Color { FieldhouseTheme.accent(for: themedLeague) }
    @Binding var state: FieldhouseSeasonState
    @State private var editingFavorite = false
    @State private var earnedExpanded = false
    @State private var searchText = ""
    @State private var activeDestination: FieldhouseProfileDestination?
    @State private var selectedAchievement: ProfileAchievement?
    @State private var profile: Profile?
    private let previewFallbackUserID = UUID(uuidString: "09544d2b-6eca-4131-a321-c000586c9029")!
    private var profileUserID: UUID { auth.user?.id ?? previewFallbackUserID }
    private var playerName: String {
        let name = profile?.displayName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? "Riley V." : name
    }
    private var sportID: String { state.league == .ncaaw ? "ncaaw" : "ncaam" }
    private var demoAchievements: [ProfileAchievement] {
        [
            ProfileAchievement(leagueId: FieldhousePreviewIdentity.leagueID(for: state.league), code: "saturday_starter", title: "First Tip", flavor: "Made the first Fieldhouse pick and entered the permanent record.", earnedAt: "2026-11-02T18:00:00Z"),
            ProfileAchievement(leagueId: FieldhousePreviewIdentity.leagueID(for: state.league), code: "favorite_team", title: "Hardwood Homer", flavor: "Picked a favorite team and stood by it in public.", earnedAt: "2026-11-02T18:01:00Z"),
            ProfileAchievement(leagueId: FieldhousePreviewIdentity.leagueID(for: state.league), code: "best_bet_hit", title: "Heat Check", flavor: "Hit a Fieldhouse Best Bet.", earnedAt: "2026-11-09T04:00:00Z")
        ]
    }
    private var catalog: [String] { FieldhouseTeamCatalog.teams(for: state.league) }
    private var teams: [String] {
        return searchText.isEmpty ? catalog : catalog.filter { $0.localizedCaseInsensitiveContains(searchText) }
    }
    var body: some View {
        VStack(spacing: 13) {
            profileHero
            VStack(alignment: .leading, spacing: 12) {
                Text("FAVORITE TEAM").font(.caption2.weight(.black)).tracking(1.4).foregroundStyle(accent)
                Button { editingFavorite.toggle() } label: {
                    HStack {
                        Image(systemName: "heart.fill").foregroundStyle(accent)
                        Text(state.favoriteTeam ?? "Choose a favorite team").font(.headline.weight(.black))
                        Spacer(); Image(systemName: editingFavorite ? "chevron.up" : "pencil")
                    }
                }.buttonStyle(.plain)
                if editingFavorite {
                    TextField("Search all Division I teams", text: $searchText)
                        .textInputAutocapitalization(.words).autocorrectionDisabled()
                        .padding(12).background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
                    ScrollView {
                        LazyVStack(spacing: 7) {
                            ForEach(teams, id: \.self) { team in
                                Button {
                                    state.favoriteTeam = team
                                    persist(.favoriteTeam)
                                    editingFavorite = false
                                    searchText = ""
                                } label: {
                                    HStack {
                                        Text(team).font(.subheadline.weight(.bold)); Spacer()
                                        if state.favoriteTeam == team { Image(systemName: "checkmark.circle.fill").foregroundStyle(accent) }
                                    }.padding(11).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                    .frame(maxHeight: 280)
                }
            }.padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.3)))
            ProfileArsenalView(userId: profileUserID, sportId: sportID)
            CampaignDogTagsView(userId: profileUserID)
            ProfilePassportView(userId: profileUserID, isOwner: true)
            currentCampaign

            dossierLabel("SEASON SCORECARDS", detail: "EVERY CERTIFIED WEEK. EVERY PICK. PERMANENT RECEIPTS.")
            dossierButton(
                .scorecard,
                state.postseasonScorecardIsActive ? "Tournament · \(state.postseasonTotalPoints) points" : "Week 1 · \(state.scoringPoints) points",
                state.postseasonScorecardIsActive
                    ? "BRACKET \(state.postseasonBracketAdjustedPoints) · ROUNDS \(state.postseasonFreshRoundPoints)"
                    : "SEASON TOTAL · \(state.scoringPoints)",
                "checklist.checked",
                .green
            )

            dossierLabel("CAREER INTEL", detail: "THE NUMBERS HAVE TESTIFIED UNDER OATH")
            HStack(spacing: 8) {
                FieldhouseMetric(value: "6-4", label: "ATS")
                FieldhouseMetric(value: "1", label: "STREAK")
                FieldhouseMetric(value: "\(state.scoringPoints)", label: "BEST WEEK")
            }
            dossierButton(.rivalry, "Rivalry Report", "\(playerName) vs. the regional field", "person.2.fill", .red)

            VStack(alignment: .leading, spacing: 12) {
                Button { withAnimation(.snappy) { earnedExpanded.toggle() } } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("EARNED SWAG").font(.caption.weight(.black)).tracking(1.7)
                            Text("3 RECEIPTS · \(earnedExpanded ? "CLOSE CABINET" : "OPEN CABINET")").font(.system(size: 8, weight: .black)).tracking(0.8).foregroundStyle(.white.opacity(0.5))
                        }
                        Spacer(); Image(systemName: earnedExpanded ? "chevron.up" : "chevron.down")
                    }
                    .foregroundStyle(accent)
                }.buttonStyle(.plain)
                if earnedExpanded {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        ForEach(demoAchievements) { achievement in
                            Button { selectedAchievement = achievement } label: {
                                AchievementArtifactTile(achievement: achievement, sportId: sportID)
                            }.buttonStyle(.plain)
                        }
                    }
                }
            }.padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.3)))

            dossierLabel("CHEEVO VAULT", detail: "FOUR ROOMS. ONE CONCERNING PERSONALITY.")
            Button { activeDestination = .cheevoVault } label: {
                CheevoVaultDoor(earned: demoAchievements, sportId: sportID)
            }.buttonStyle(.plain)

            dossierLabel("TROPHY CASE", detail: "THE ROOM CANNOT DELETE HISTORY")
            dossierInfo("No permanent hardware yet", "The engraver checked twice", "trophy.fill", .yellow)
            Button { activeDestination = .crystalBall } label: {
                FieldhouseAction(kicker: "CRYSTAL BALL · SEALED", title: state.crystalBallChampion ?? "Champion not selected", detail: "The original championship prediction stays on your permanent profile.", icon: "sparkles")
            }.buttonStyle(.plain)

            dossierLabel("IDENTITY CONTROL", detail: "CHANGE THE NAME. KEEP THE RECEIPTS.")
            dossierButton(.editProfile, "Edit Profile", "Name, photo, birthday, favorite team and loadout", "person.crop.rectangle.fill", .green)

            dossierLabel("ROOM ACCESS", detail: "TRANSMISSIONS & RULES OF ENGAGEMENT")
            dossierButton(.announcements, "Announcements", "Official yelling from command", "megaphone.fill", .red)
            dossierButton(.rules, "Rules of Engagement", "How this beautiful mess scores", "book.closed.fill", .yellow)
            dossierButton(.privacy, "Privacy & Safety", "Policies, support and account controls", "hand.raised.fill", .green)

            dossierLabel("LEAGUE FREQUENCY", detail: "SEE EVERY TASK AND UNREAD TRANSMISSION BEFORE YOU SWITCH")
            dossierButton(.leagueCommand, "Open League Command", "1 room · prioritized by what needs you", "antenna.radiowaves.left.and.right", .green)
            dossierButton(.signOut, "Leave the Building", "Sign out", "door.left.hand.open", .red)
        }
        .sheet(item: $activeDestination, onDismiss: {
            Task { await reloadProfile() }
        }) { destination in
            FieldhouseProfileDestinationView(state: $state, destination: destination, playerName: playerName)
        }
        .sheet(item: $selectedAchievement) { achievement in
            AchievementEvidenceView(achievement: achievement, visual: achievementVisual(for: achievement.code), sportId: sportID)
                .presentationDetents([.large]).presentationDragIndicator(.hidden)
        }
        .task(id: profileUserID) {
            await reloadProfile()
        }
    }

    @MainActor
    private func reloadProfile() async {
        guard let token = auth.token else { profile = nil; return }
        profile = try? await SupabaseAPI.profile(token: token, userId: profileUserID)
    }

    private var profileHero: some View {
        VStack(spacing: 10) {
            Text("PLAYER DOSSIER").font(.caption2.weight(.black)).tracking(2.4).foregroundStyle(accent)
            ProfileAvatar(urlString: profile?.avatarURL, name: playerName, size: 104, borderId: profile?.equippedBorderId, accent: accent)
            ProfileRankPlacard(progress: CareerRanks.resolve(points: 230, seasons: 1, sports: 3), isOwner: true, sportId: sportID)
            Text(playerName).font(.system(size: 32, weight: .black)).fontWidth(.condensed)
            HStack(spacing: 7) {
                profileTag("COMMISSIONER", color: .green)
                profileTag("MIDWEST REGION", color: accent)
            }
            Text("THE FIELDHOUSE \(state.league.rawValue)").font(.system(size: 9, weight: .black)).tracking(1.5).foregroundStyle(.white.opacity(0.48))
        }
        .frame(maxWidth: .infinity).padding(.vertical, 22)
        .background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(accent.opacity(0.42)))
    }

    private var currentCampaign: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("CURRENT CAMPAIGN").font(.caption2.weight(.black)).tracking(1.8).foregroundStyle(.green)
                    Text("FORM: FUNCTIONAL · SUSPICIOUSLY COMPETENT").font(.system(size: 8, weight: .black)).tracking(0.6).foregroundStyle(.white.opacity(0.48))
                }
                Spacer(); Image(systemName: "scope").font(.title2.weight(.black)).foregroundStyle(.green)
            }
            HStack(spacing: 8) {
                FieldhouseMetric(value: "\(state.scoringPoints)", label: "CAREER PTS")
                FieldhouseMetric(value: "1", label: "WEEKS")
                FieldhouseMetric(value: "\(state.scoringPoints)", label: "LAST WEEK")
            }
        }
        .padding(14).background(LinearGradient(colors: [.black.opacity(0.92), .green.opacity(0.14)], startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.green.opacity(0.35)))
    }

    private func profileTag(_ text: String, color: Color) -> some View {
        Text(text).font(.system(size: 9, weight: .black)).tracking(1)
            .foregroundStyle(color).padding(.horizontal, 9).padding(.vertical, 5)
            .background(color.opacity(0.14), in: Capsule()).overlay(Capsule().stroke(color.opacity(0.55)))
    }

    private func dossierLabel(_ title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption2.weight(.black)).tracking(1.7).foregroundStyle(accent)
            Text(detail).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.38))
        }.frame(maxWidth: .infinity, alignment: .leading).padding(.top, 4)
    }

    private func dossierButton(_ destination: FieldhouseProfileDestination, _ title: String, _ detail: String, _ icon: String, _ color: Color) -> some View {
        Button { activeDestination = destination } label: {
            dossierRow(title, detail, icon, color, showsChevron: true)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title). \(detail)")
    }

    private func dossierInfo(_ title: String, _ detail: String, _ icon: String, _ color: Color) -> some View {
        dossierRow(title, detail, icon, color, showsChevron: false)
    }

    private func dossierRow(_ title: String, _ detail: String, _ icon: String, _ color: Color, showsChevron: Bool) -> some View {
        HStack(spacing: 13) {
            Image(systemName: icon).font(.headline.weight(.black)).foregroundStyle(color).frame(width: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline.weight(.black))
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if showsChevron {
                Image(systemName: "chevron.right").font(.caption.weight(.black)).foregroundStyle(color.opacity(0.7))
            }
        }
        .padding(15).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 17))
        .overlay(alignment: .leading) { Rectangle().fill(color).frame(width: 3).padding(.vertical, 9) }
        .overlay(RoundedRectangle(cornerRadius: 17).stroke(color.opacity(0.25)))
    }
}

private enum FieldhouseProfileDestination: String, Identifiable {
    case scorecard, rivalry, cheevoVault, crystalBall
    case editProfile, announcements, rules, privacy, leagueCommand, signOut
    var id: String { rawValue }
}

private struct FieldhouseProfileDestinationView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.fieldhouseLeague) private var league
    @Binding var state: FieldhouseSeasonState
    let destination: FieldhouseProfileDestination
    let playerName: String
    private var accent: Color { FieldhouseTheme.accent(for: league) }

    var body: some View {
        NavigationStack {
            Group {
                switch destination {
                case .cheevoVault:
                    CheevoVaultView(earned: demoAchievements, sportId: sportID)
                case .editProfile:
                    NativeProfileView()
                case .announcements:
                    AnnouncementsView()
                case .rules:
                    HowToPlayView(sportId: sportID)
                case .privacy:
                    SafetyAndSupportView()
                case .leagueCommand:
                    LeagueCommandCenterView(memberships: [])
                default:
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            Label(kicker, systemImage: icon)
                                .font(.caption.weight(.black)).tracking(1.6).foregroundStyle(accent)
                            Text(title).font(.system(size: 34, weight: .black)).fontWidth(.condensed)
                            Text(detail).font(.body.weight(.semibold)).foregroundStyle(.white.opacity(0.68))
                            content
                        }
                        .padding(20).frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .background(FieldhouseBackdrop(leagueOverride: state.league).ignoresSafeArea())
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Label("Back", systemImage: "chevron.left") }
                        .font(.subheadline.weight(.black))
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var sportID: String { state.league == .ncaaw ? "ncaaw" : "ncaam" }
    private var demoAchievements: [ProfileAchievement] {
        [
            ProfileAchievement(leagueId: FieldhousePreviewIdentity.leagueID(for: state.league), code: "saturday_starter", title: "First Tip", flavor: "Made the first Fieldhouse pick and entered the permanent record.", earnedAt: "2026-11-02T18:00:00Z"),
            ProfileAchievement(leagueId: FieldhousePreviewIdentity.leagueID(for: state.league), code: "favorite_team", title: "Hardwood Homer", flavor: "Picked a favorite team and stood by it in public.", earnedAt: "2026-11-02T18:01:00Z"),
            ProfileAchievement(leagueId: FieldhousePreviewIdentity.leagueID(for: state.league), code: "best_bet_hit", title: "Heat Check", flavor: "Hit a Fieldhouse Best Bet.", earnedAt: "2026-11-09T04:00:00Z")
        ]
    }

    @ViewBuilder private var content: some View {
        switch destination {
        case .scorecard:
            if state.postseasonScorecardIsActive {
                detailCard("TOURNAMENT TOTAL", "\(state.postseasonTotalPoints) points")
                detailCard("INITIAL BRACKET", "\(state.postseasonBracketAdjustedPoints) points · \(state.postseasonBracketCorrectPicks) correct predictions")
                detailCard("FRESH ROUND PICKS", "\(state.postseasonFreshRoundPoints) points")
            } else {
                detailCard("WEEK \(state.scoringWindow)", "\(state.scoringPoints) points · \(state.scoringFinalGames) final · \(state.scoringLiveGames) live")
                detailCard("PROP", state.scoringPropResult == nil ? "Pending final game data" : "Scored autonomously from the completed board")
            }
        case .rivalry:
            detailCard("REGIONAL POSITION", "Rank \(state.rank) of \(state.regionPlayerCount) in the Midwest Region")
            detailCard("HEAD-TO-HEAD", "\(playerName) is 6–4 against the field this season")
        case .cheevoVault:
            detailCard("FIRST TIP", "Made your first Fieldhouse pick")
            detailCard("HARDWOOD HOMER", "Locked your favorite team")
            detailCard("HEAT CHECK", "Hit a Best Bet")
        case .crystalBall:
            detailCard("SEALED PREDICTION", state.crystalBallChampion ?? "No champion selected")
            detailCard("PERMANENT RECEIPT", "The selection cannot be changed after confirmation and remains on your profile")
        case .editProfile:
            detailCard("PROFILE PHOTO", "Photo controls connect when Fieldhouse is wired to the live profile service")
            detailCard("FAVORITE TEAM", state.favoriteTeam ?? "Not selected")
            Text("Favorite team can be changed directly on the You page now.")
                .font(.subheadline.weight(.bold)).foregroundStyle(accent)
        case .announcements:
            detailCard("NO NEW TRANSMISSIONS", "Official app and league notices will remain here after the banner is dismissed")
        case .rules:
            detailCard("WEEKLY CARD", "Pick 10 games against the spread. Use each confidence value from 1 through 10 once.")
            detailCard("BEST BET", "Doubles the confidence points on one game. Incorrect picks score zero; football push language is never used.")
            detailCard("HELLFIRE", "Regular season: 2× correct game points and permanent picks. Postseason: 1.5× with the 60% threshold.")
        case .privacy:
            detailCard("ENTERTAINMENT ONLY", "No real-money wagering, prizes, or payouts")
            detailCard("ACCOUNT CONTROLS", "Profile, support, safety, and account deletion controls live here when connected to production")
        case .leagueCommand:
            detailCard("CURRENT ROOM", "The Fieldhouse \(state.league.rawValue) · \(state.playerCount) players")
            detailCard("NEXT TASK", state.cardIsPublished ? (state.picksLocked ? "Week \(state.window) picks complete" : "Finish Week \(state.window) picks") : "Build the Week \(state.window) card")
        case .signOut:
            detailCard("PREVIEW PROTECTED", "This isolated Foundry build has no live account session to sign out. Production sign-out will require confirmation.")
        }
    }

    private var kicker: String { destination == .signOut ? "ACCOUNT CONTROL" : "PLAYER DOSSIER" }
    private var title: String {
        switch destination {
        case .scorecard: state.postseasonScorecardIsActive ? "Tournament Scorecard" : "Season Scorecard"
        case .rivalry: "Rivalry Report"
        case .cheevoVault: "Cheevo Vault"
        case .crystalBall: "Crystal Ball Receipt"
        case .editProfile: "Edit Profile"
        case .announcements: "Announcements"
        case .rules: "Rules of Engagement"
        case .privacy: "Privacy & Safety"
        case .leagueCommand: "League Command"
        case .signOut: "Leave the Building"
        }
    }
    private var detail: String {
        switch destination {
        case .scorecard: "The points, status, and source of the current weekly total."
        case .rivalry: "Your position against the people trying to catch you."
        case .cheevoVault: "Every earned artifact in one cabinet."
        case .crystalBall: "The championship prediction you sealed at entry."
        case .editProfile: "Identity controls shared across every league and sport."
        case .announcements: "App-wide and league transmissions."
        case .rules: "The scoring rules without the scavenger hunt."
        case .privacy: "Safety, policy, support, and account controls."
        case .leagueCommand: "The room and its next required action."
        case .signOut: "Account exit controls."
        }
    }
    private var icon: String {
        switch destination {
        case .scorecard: "checklist.checked"
        case .rivalry: "person.2.fill"
        case .cheevoVault: "shippingbox.fill"
        case .crystalBall: "sparkles"
        case .editProfile: "person.crop.rectangle.fill"
        case .announcements: "megaphone.fill"
        case .rules: "book.closed.fill"
        case .privacy: "hand.raised.fill"
        case .leagueCommand: "antenna.radiowaves.left.and.right"
        case .signOut: "door.left.hand.open"
        }
    }

    private func detailCard(_ heading: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(heading).font(.caption.weight(.black)).tracking(1.3).foregroundStyle(accent)
            Text(body).font(.headline.weight(.semibold)).foregroundStyle(.white.opacity(0.82))
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.3)))
    }
}

private struct FieldhouseHero: View {
    @Environment(\.fieldhouseLeague) private var league
    let kicker: String; let title: String; let detail: String; let icon: String
    private var accent: Color { FieldhouseTheme.accent(for: league) }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(kicker, systemImage: icon).font(.system(size: 9, weight: .black)).tracking(1.5).foregroundStyle(accent)
            Text(title).font(.system(size: 29, weight: .black)).fontWidth(.condensed)
            Text(detail).font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: [accent.opacity(0.24), .black.opacity(0.86)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 19))
        .overlay(RoundedRectangle(cornerRadius: 19).stroke(accent.opacity(0.52)))
    }
}

private struct FieldhouseAction: View {
    @Environment(\.fieldhouseLeague) private var league
    let kicker: String; let title: String; let detail: String; let icon: String
    var signalColor: Color? = nil
    private var accent: Color { FieldhouseTheme.accent(for: league) }
    private var actionColor: Color { signalColor ?? accent }
    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: icon).font(.title2.weight(.black)).foregroundStyle(actionColor).frame(width: 45, height: 45).background(actionColor.opacity(0.14), in: Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(kicker).font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(actionColor)
                Text(title).font(.headline.weight(.black)).foregroundStyle(signalColor == nil ? .white : actionColor)
                Text(detail).font(.caption).foregroundStyle(.white.opacity(0.55))
            }
            Spacer(); Image(systemName: "chevron.right").foregroundStyle(actionColor)
        }
        .padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(actionColor.opacity(signalColor == nil ? 0.3 : 0.72), lineWidth: signalColor == nil ? 1 : 2))
    }
}

private struct FieldhouseMetric: View {
    @Environment(\.fieldhouseLeague) private var league
    let value: String; let label: String
    private var accent: Color { FieldhouseTheme.accent(for: league) }
    var body: some View {
        VStack(spacing: 4) {
            Text(value).font(.title.weight(.black)).foregroundStyle(accent)
            Text(label).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.5))
        }
        .frame(maxWidth: .infinity).padding(15).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(0.24)))
    }
}
