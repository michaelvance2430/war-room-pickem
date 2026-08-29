
import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    // This belongs to the running app session, not to a league-specific view.
    // ContentView is rebuilt when the active league changes; keeping the flag
    // here prevents a league switch from replaying the launch film.
    @State private var showOpening = true

    var body: some View {
        Group {
            if auth.isRestoring {
                ProgressView("Opening the room…")
            } else if auth.user == nil {
                LoginView()
            } else {
                MembershipGateView(showOpening: $showOpening)
            }
        }
        .preferredColorScheme(.dark)
    }
}

private struct MembershipGateView: View {
    @EnvironmentObject private var auth: AuthStore
    @Binding var showOpening: Bool
    @State private var state: MembershipState = .loading

    private enum MembershipState: Equatable {
        case loading
        case member
        case rookie
        case failed(String)
    }

    private var refreshKey: String {
        "\(auth.user?.id.uuidString ?? "signed-out")|\(auth.selectedLeagueId?.uuidString ?? "none")"
    }

    var body: some View {
        Group {
            switch state {
            case .loading:
                ZStack {
                    WarRoomBackdrop()
                    ProgressView("Checking the roster…").tint(.green)
                }
            case .member:
                ContentView(showOpening: $showOpening)
            case .rookie:
                RookieMusterShell()
            case .failed(let message):
                ZStack {
                    WarRoomBackdrop()
                    ContentUnavailableView {
                        Label("Can’t reach the War Room", systemImage: "antenna.radiowaves.left.and.right.slash")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("TRY AGAIN") { Task { await loadMemberships() } }
                            .buttonStyle(.borderedProminent).tint(.green)
                        Button("SIGN OUT", role: .destructive) { auth.signOut() }
                    }
                }
            }
        }
        .task(id: refreshKey) { await loadMemberships() }
    }

    @MainActor private func loadMemberships() async {
        guard let token = auth.token, let user = auth.user else { return }
        state = .loading
        do {
            let memberships = try await SupabaseAPI.leagueMemberships(token: token, userId: user.id)
            state = memberships.isEmpty ? .rookie : .member
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}

private struct RookieMusterShell: View {
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        NavigationStack {
            LobbyView()
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            NavigationLink {
                                SafetyAndSupportView()
                            } label: {
                                Label("Privacy & Safety", systemImage: "hand.raised.fill")
                            }
                            Button(role: .destructive) { auth.signOut() } label: {
                                Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            }
                        } label: {
                            Image(systemName: "person.crop.circle")
                                .accessibilityLabel("Account options")
                        }
                    }
                }
        }
    }
}

struct ContentView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.scenePhase) private var scenePhase
    @Binding var showOpening: Bool
    @State private var selectedTab = 0
    @State private var tabRootIds = (0..<5).map { _ in UUID() }
    @State private var picksKickoff: Date?
    @State private var clock = Date()
    @State private var platformStatus: PlatformStatus?
    @State private var showingNotificationPrimer = false
    @State private var showingPushAnnouncements = false
    @AppStorage("warroom.notifications.primer-seen") private var notificationPrimerSeen = false
    @AppStorage("warroom.activeSportId") private var activeSportId = "cfb"

    private var boardIsOpen: Bool { picksKickoff.map { clock >= $0 } ?? false }

    private var tabSelection: Binding<Int> {
        Binding(
            get: { selectedTab },
            set: { openTab($0) }
        )
    }

    var body: some View {
        ZStack {
            TabView(selection: tabSelection) {
                NavigationStack {
                    HomeView(
                        onOpenPicks: { openTab(1) },
                        onOpenStandings: { openTab(2) },
                        onOpenLocker: { openTab(3) }
                    )
                }
                    .id(tabRootIds[0])
                    .tabItem { Label("Home", systemImage: "house.fill") }
                    .tag(0)
                PicksView(onKickoffLoaded: { picksKickoff = $0 })
                    .id(tabRootIds[1])
                    .tabItem { Label(boardIsOpen ? "Board" : "Picks", systemImage: boardIsOpen ? "rectangle.grid.2x2.fill" : "checkmark.seal.fill") }
                    .tag(1)
                StandingsView()
                    .id(tabRootIds[2])
                    .tabItem { Label("Standings", systemImage: "list.number") }
                    .tag(2)
                LockerRoomView()
                    .id(tabRootIds[3])
                    .tabItem { Label("Locker", systemImage: "bubble.left.and.bubble.right.fill") }
                    .tag(3)
                YouView()
                    .id(tabRootIds[4])
                    .tabItem { Label("You", systemImage: "person.crop.circle.fill") }
                    .tag(4)
            }
            .tint(activeSportId == "nfl" ? .cyan : .green)
            .safeAreaInset(edge: .top, spacing: 0) {
                if let status = platformStatus, status.incidentActive {
                    PlatformIncidentBanner(message: status.incidentMessage)
                }
            }
            if showOpening {
                SeasonOpeningView(isPresented: $showOpening)
                    .transition(.opacity)
                    .zIndex(10)
            }
            if !showOpening, let location = EasterEggEngine.mascotLocation(), location.tabIndex == selectedTab {
                WarRoomScoutSighting(location: location).zIndex(5)
            }
        }
        .preferredColorScheme(.dark)
        .task(id: auth.user?.id) { await recordAppOpenDiscoveries() }
        .task(id: auth.selectedLeagueId) { await refreshActiveSport() }
        .task(id: auth.user?.id) { await refreshPlatformStatus() }
        .task(id: auth.user?.id) { await prepareNotifications() }
        .onReceive(NotificationCenter.default.publisher(for: .warRoomNotificationDestination)) { notification in
            guard let destination = notification.object as? String else { return }
            showOpening = false
            if destination == "announcements" {
                openTab(0)
                showingPushAnnouncements = true
            } else if destination == "picks" {
                openTab(1)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .warRoomDeviceTokenChanged)) { _ in
            Task { await registerPushToken() }
        }
        .sheet(isPresented: $showingPushAnnouncements) { NavigationStack { AnnouncementsView() } }
        .alert("Stay ahead of the lock", isPresented: $showingNotificationPrimer) {
            Button("Not now", role: .cancel) { notificationPrimerSeen = true }
            Button("Enable alerts") {
                notificationPrimerSeen = true
                Task {
                    if await WarRoomNotificationCenter.requestAuthorization() {
                        await registerPushToken()
                    }
                }
            }
        } message: {
            Text("War Room can alert you when a card is built, 12 hours before it locks, one hour before it locks, and when your commissioner posts an announcement. You can change this anytime in Settings.")
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await refreshPlatformStatus() } }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                clock = Date()
                if Calendar.current.component(.second, from: clock) < 15 {
                    await refreshPlatformStatus()
                }
            }
        }
    }

    private func recordAppOpenDiscoveries() async {
        guard let token = auth.token, let user = auth.user else { return }
        _ = try? await SupabaseAPI.recordNativeAppOpen(token: token)
        if let trophies = try? await SupabaseAPI.profileTrophies(token: token, userId: user.id),
           EasterEggEngine.hasThreePeat(trophies.filter { $0.trophyType.lowercased() == "championship" }.map(\.seasonYear)) {
            _ = try? await SupabaseAPI.recordEasterEggFind(token: token, discoveryId: "egg_three_peat")
        }
    }

    @MainActor private func prepareNotifications() async {
        guard auth.user != nil else { return }
        let status = await WarRoomNotificationCenter.authorizationStatus()
        if status == .authorized || status == .provisional {
            UIApplication.shared.registerForRemoteNotifications()
            await registerPushToken()
        } else if status == .notDetermined, !notificationPrimerSeen {
            showingNotificationPrimer = true
        }
    }

    private func registerPushToken() async {
        guard let token = auth.token,
              let user = auth.user,
              let deviceToken = UserDefaults.standard.string(forKey: WarRoomNotificationCenter.deviceTokenKey),
              !deviceToken.isEmpty
        else { return }
        try? await SupabaseAPI.registerPushDevice(token: token, userId: user.id, deviceToken: deviceToken)
    }

    private func refreshActiveSport() async {
        guard let token = auth.token, let user = auth.user,
              let active = try? await SupabaseAPI.activeLeague(token: token, userId: user.id, preferredLeagueId: auth.selectedLeagueId)
        else { return }
        activeSportId = active.leagues.sportId.lowercased() == "nfl" ? "nfl" : "cfb"
    }

    @MainActor private func refreshPlatformStatus() async {
        guard let token = auth.token else { return }
        if let status = try? await SupabaseAPI.platformStatus(token: token) {
            platformStatus = status
        }
    }

    private func openTab(_ tab: Int) {
        guard tabRootIds.indices.contains(tab) else { return }
        tabRootIds[tab] = UUID()
        selectedTab = tab
    }
}

private struct PlatformIncidentBanner: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.black)
            VStack(alignment: .leading, spacing: 2) {
                Text("WE'RE ON IT")
                    .font(.system(size: 9, weight: .black)).tracking(1.4)
                Text(message.isEmpty ? "We're aware of the issue and working on it." : message)
                    .font(.footnote.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(.black)
        .padding(.horizontal, 14).padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.yellow)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("App announcement. \(message)")
    }
}

struct WarRoomScoutSighting: View {
    @EnvironmentObject private var auth: AuthStore
    let location: EasterEggEngine.MascotLocation
    @State private var hidden = false
    @State private var message: String?

    var body: some View {
        GeometryReader { proxy in
            if !hidden, let user = auth.user, !EasterEggEngine.hasFoundMascot(location, userId: user.id) {
                Button { Task { await findScout(userId: user.id) } } label: {
                    Image("WarRoomScout").resizable().scaledToFit().frame(width: 58, height: 72)
                        .opacity(0.48).shadow(color: .orange.opacity(0.45), radius: 8)
                }
                .buttonStyle(.plain).accessibilityLabel("Something small is hiding here")
                .position(position(in: proxy.size))
            }
        }
        .allowsHitTesting(!hidden)
        .alert("SCOUT LOCATED", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("SALUTE") { message = nil }
        } message: { Text(message ?? "") }
    }

    private func position(in size: CGSize) -> CGPoint {
        switch location {
        case .homeCorner, .boardScoreboard: return CGPoint(x: size.width - 36, y: 112)
        case .standingsEdge: return CGPoint(x: 34, y: 118)
        case .lockerBench: return CGPoint(x: 36, y: size.height - 132)
        case .gazetteMargin: return CGPoint(x: 34, y: size.height - 116)
        }
    }

    @MainActor private func findScout(userId: UUID) async {
        hidden = true
        let find = EasterEggEngine.recordMascotLocation(location, userId: userId)
        guard find.isFirst, let token = auth.token else { return }
        if find.total == 1 {
            _ = try? await SupabaseAPI.recordEasterEggFind(token: token, discoveryId: "egg_mascot_scout")
            message = "You found the general in the wild. He will relocate when command feels like it."
        } else if find.total >= 5 {
            _ = try? await SupabaseAPI.recordEasterEggFind(token: token, discoveryId: "egg_impossible")
            message = "Five hideouts. No useful explanation. The file is now marked ???"
        } else {
            message = "Another hideout compromised. The scout is already denying everything."
        }
    }
}

struct RegularSeasonWeaponPlan {
    let submissions: [PickSubmission]
    let bestBetGameId: UUID
}

enum RegularSeasonWeaponEngine {
    /// Regular-season weapons are deliberately conservative. They take the
    /// posted favorite in every game and put the largest confidence value on
    /// the strongest posted favorite. Postseason weapon engines remain random.
    static func plan(for games: [CardGame]) -> RegularSeasonWeaponPlan? {
        guard !games.isEmpty else { return nil }
        let ranked = games.sorted {
            let left = abs($0.spread)
            let right = abs($1.spread)
            return left == right ? $0.id.uuidString < $1.id.uuidString : left < right
        }
        let confidenceById = Dictionary(uniqueKeysWithValues: ranked.enumerated().map { index, game in
            (game.id, index + 1)
        })
        guard let strongest = ranked.last else { return nil }
        let submissions = games.map { game in
            PickSubmission(
                gameId: game.id,
                side: game.favorite.lowercased() == "away" ? "away" : "home",
                confidence: confidenceById[game.id] ?? 1
            )
        }
        return RegularSeasonWeaponPlan(submissions: submissions, bestBetGameId: strongest.id)
    }
}

private struct PicksView: View {
    @EnvironmentObject private var auth: AuthStore
    let onKickoffLoaded: (Date?) -> Void
    @State private var league: LeagueMembership?
    @State private var memberships: [LeagueMembership] = []
    @State private var card: WeekCard?
    @State private var pick: PlayerPick?
    @State private var loadErrorMessage: String?
    @State private var saveErrorMessage: String?
    @State private var loading = true
    @State private var saving = false
    @State private var draft: [UUID: GamePickDraft] = [:]
    @State private var bestBetGameId: UUID?
    @State private var propChoice: String?
    @State private var saveNotice: String?
    @State private var editingSubmittedCard = false
    @State private var tacticalNukesUsed = 0
    @State private var confirmingRegularSeasonWeapon = false
    @State private var strikePresentation: StrikePresentation?
    @State private var boardPicks: [BoardPick] = []
    @State private var boardLoading = false
    @State private var boardError: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Loading this week…")
                } else if let loadErrorMessage {
                    ContentUnavailableView("Card unavailable", systemImage: "exclamationmark.triangle", description: Text(loadErrorMessage))
                } else if let card {
                    let completedGames = card.cardGames.filter { draft[$0.id]?.side != nil && draft[$0.id]?.confidence != nil }.count
                    if !canEdit(card: card) {
                    WeekBoardView(card: card, picks: boardPicks, sportId: league?.leagues.sportId ?? "cfb", loading: boardLoading, errorMessage: boardError) {
                            Task { await loadBoard(card: card) }
                        }
                    } else if let pick, !editingSubmittedCard {
                        LockedPickSummaryView(
                            leagueName: league?.leagues.name ?? "War Room",
                            sportId: league?.leagues.sportId ?? "cfb",
                            card: card,
                            pick: pick,
                            canEdit: canEdit(card: card) && !pick.isChaos,
                            onEdit: { editingSubmittedCard = true }
                        )
                    } else {
                        ZStack {
                        if league?.leagues.sportId.lowercased() == "nfl" { NflHomeBackdrop(phase: .regularSeason) }
                        else { PicksRecruitingBackdrop() }
                        ScrollView {
                            VStack(alignment: .leading, spacing: 16) {
                                if league?.leagues.sportId.lowercased() == "nfl" {
                                    NflPickMissionHeader(
                                        leagueName: league?.leagues.name ?? "War Room",
                                        week: card.weekNumber,
                                        complete: completedGames,
                                        total: card.cardGames.count,
                                        saved: pick != nil,
                                        ready: isComplete(card: card)
                                    )
                                } else {
                                    PickMissionHeader(
                                        leagueName: league?.leagues.name ?? "War Room",
                                        week: card.weekNumber,
                                        complete: completedGames,
                                        total: card.cardGames.count,
                                        saved: pick != nil,
                                        ready: isComplete(card: card)
                                    )
                                }
                                PickOrderAlert()
                                if league?.leagues.sportId.lowercased() == "nfl" {
                                    NflSundayOperationsPanel(week: card.weekNumber)
                                }
                                if pick == nil,
                                   card.weekNumber <= (league?.leagues.regularSeasonWeeks ?? 0),
                                   ["cfb", "nfl"].contains(league?.leagues.sportId.lowercased() ?? "cfb") {
                                    RegularSeasonWeaponPanel(
                                        sportId: league?.leagues.sportId ?? "cfb",
                                        remaining: max(0, 2 - tacticalNukesUsed),
                                        armed: false
                                    ) {
                                        confirmingRegularSeasonWeapon = true
                                    }
                                }
                                if league?.leagues.sportId.lowercased() == "nfl" { NflBroadcastSectionLabel(title: "PRIME-TIME SLATE", detail: "PICK A SIDE · ASSIGN CONFIDENCE · CHOOSE ONE BEST BET") }
                                else { HomeSectionLabel(title: "THE SLATE", detail: "PICK A SIDE · ASSIGN CONFIDENCE · CHOOSE ONE BEST BET") }
                            ForEach(card.cardGames) { game in
                                EditableGamePickRow(
                                    game: game,
                                    sportId: league?.leagues.sportId ?? "cfb",
                                    draft: draft[game.id] ?? GamePickDraft(),
                                    confidenceOptions: Array(1...card.cardGames.count),
                                    usedConfidences: Set(draft.compactMap { $0.key == game.id ? nil : $0.value.confidence }),
                                    isBestBet: bestBetGameId == game.id,
                                    onSide: { setSide($0, for: game.id) },
                                    onConfidence: { setConfidence($0, for: game.id) },
                                    onBestBet: { bestBetGameId = game.id }
                                )
                            }
                        if let question = card.propQuestion {
                                    if league?.leagues.sportId.lowercased() == "nfl" { NflBroadcastSectionLabel(title: "GAME-DAY PROP", detail: "\(card.propPoints) BONUS POINTS · AUTO-SCORED") }
                                    else { HomeSectionLabel(title: "WEEKLY PROP", detail: "\(card.propPoints) BONUS POINTS · AUTO-SCORED") }
                                    VStack(alignment: .leading, spacing: 14) {
                                        Label("INTELLIGENCE TEST", systemImage: "scope")
                                            .font(.caption2.weight(.black)).tracking(1.6).foregroundStyle(league?.leagues.sportId.lowercased() == "nfl" ? .cyan : .yellow)
                                        Text(question).font(.headline.weight(.black))
                                if let optionA = card.propOptionA, let optionB = card.propOptionB {
                                    Picker("Your answer", selection: $propChoice) {
                                        Text("Choose…").tag(String?.none)
                                        Text(optionA).tag(String?.some(optionA))
                                        Text(optionB).tag(String?.some(optionB))
                                    }
                                            .pickerStyle(.segmented)
                                }
                                    }
                                    .padding(18)
                                    .background(.black.opacity(0.76), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 20, bottomTrailingRadius: 4, topTrailingRadius: 20))
                                    .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: league?.leagues.sportId.lowercased() == "nfl" ? 6 : 20, bottomTrailingRadius: 4, topTrailingRadius: league?.leagues.sportId.lowercased() == "nfl" ? 6 : 20).stroke((league?.leagues.sportId.lowercased() == "nfl" ? Color.cyan : Color.yellow).opacity(0.45)))
                            }
                                VStack(spacing: 12) {
                            Button {
                                Task { await save(card: card) }
                            } label: {
                                HStack {
                                    Spacer()
                                    if saving { ProgressView() }
                                            else {
                                                Label(pick == nil ? "LOCK THE CARD" : "UPDATE THE CARD", systemImage: "lock.fill")
                                                    .font(.headline.weight(.black)).tracking(0.6)
                                            }
                                    Spacer()
                                }
                                        .padding(.vertical, 8)
                            }
                                    .buttonStyle(.borderedProminent).tint(isComplete(card: card) ? (league?.leagues.sportId.lowercased() == "nfl" ? .blue : .green) : .gray)
                            .disabled(!isComplete(card: card) || saving)
                            if let saveNotice {
                                Label(saveNotice, systemImage: "checkmark.circle.fill")
                                    .font(.footnote).foregroundStyle(league?.leagues.sportId.lowercased() == "nfl" ? .cyan : .green)
                            } else if let saveErrorMessage {
                                Label(saveErrorMessage, systemImage: "exclamationmark.triangle.fill")
                                    .font(.footnote).foregroundStyle(.red)
                            } else if !isComplete(card: card) {
                                Label(nextCommand(card: card), systemImage: "arrow.up.circle.fill")
                                    .font(.footnote.weight(.semibold)).foregroundStyle(league?.leagues.sportId.lowercased() == "nfl" ? .red : .yellow)
                            }
                                }
                                .padding(18)
                                .background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 18))
                            }
                            .padding(.horizontal, 16)
                            .padding(.top, 10)
                            .padding(.bottom, 34)
                        }
                        .refreshable { await load() }
                    }
                    }
                } else {
                    MissingWeekCardView(
                        league: league,
                        memberships: memberships,
                        isCommissioner: league.map { membership in
                            auth.user.map { membership.isCommissioner(userId: $0.id) } ?? false
                        } ?? false,
                        retry: { Task { await load() } }
                    )
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .task(id: auth.selectedLeagueId) { await load() }
            .task(id: card?.id) {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(15))
                    guard let card, !canEdit(card: card) else { continue }
                    await loadBoard(card: card)
                }
            }
            .alert(regularSeasonWeaponConfirmationTitle, isPresented: $confirmingRegularSeasonWeapon) {
                Button("KEEP CONTROL", role: .cancel) {}
                Button(regularSeasonWeaponAuthorizationLabel, role: .destructive) {
                    if let card { Task { await authorizeRegularSeasonWeapon(card: card) } }
                }
            } message: {
                Text(regularSeasonWeaponConfirmationMessage)
            }
            .fullScreenCover(item: $strikePresentation) { strike in
                WeaponStrikeVideoView(presentation: strike) { strikePresentation = nil }
            }
        }
    }

    private func load() async {
        guard let token = auth.token, let user = auth.user else { return }
        loading = true
        do {
            let active = try await SupabaseAPI.activeLeague(token: token, userId: user.id, preferredLeagueId: auth.selectedLeagueId)
            try? await SupabaseAPI.touchLastSeen(token: token, userId: user.id)
            async let loadedCard = SupabaseAPI.weekCard(token: token, leagueId: active.leagueId, weekNumber: active.leagues.currentWeek)
            async let loadedPick = SupabaseAPI.playerPick(token: token, leagueId: active.leagueId, userId: user.id, weekNumber: active.leagues.currentWeek)
            async let loadedMemberships = SupabaseAPI.leagueMemberships(token: token, userId: user.id)
            league = active
            card = try await loadedCard
            let kickoff = card?.cardGames.compactMap { footballKickoffDate($0.startTime) }.min()
            onKickoffLoaded(kickoff)
            pick = try await loadedPick
            tacticalNukesUsed = (try? await SupabaseAPI.tacticalNukesUsed(
                token: token,
                leagueId: active.leagueId,
                userId: user.id
            )) ?? 0
            memberships = (try? await loadedMemberships) ?? [active]
            hydrateDraft(from: pick)
            editingSubmittedCard = false
            loadErrorMessage = nil
            if let card, !canEdit(card: card) { await loadBoard(card: card) }
        } catch {
            loadErrorMessage = error.localizedDescription
        }
        loading = false
    }

    private func loadBoard(card: WeekCard) async {
        guard let token = auth.token, let league else { return }
        boardLoading = true
        do {
            boardPicks = try await SupabaseAPI.weekBoard(token: token, leagueId: league.leagueId, weekNumber: card.weekNumber)
            boardError = nil
        } catch {
            boardError = error.localizedDescription
        }
        boardLoading = false
    }

    private func hydrateDraft(from pick: PlayerPick?) {
        draft = Dictionary(uniqueKeysWithValues: (pick?.pickGames ?? []).map {
            ($0.cardGameId, GamePickDraft(side: $0.side, confidence: $0.confidence))
        })
        bestBetGameId = pick?.pickGames.first(where: \.isBestBet)?.cardGameId
        propChoice = pick?.propChoice
        saveNotice = nil
        saveErrorMessage = nil
    }

    private func setSide(_ side: String, for gameId: UUID) {
        var value = draft[gameId] ?? GamePickDraft()
        value.side = side
        draft[gameId] = value
        saveNotice = nil
        saveErrorMessage = nil
    }

    private func setConfidence(_ confidence: Int?, for gameId: UUID) {
        if let confidence {
            for id in draft.keys where id != gameId && draft[id]?.confidence == confidence {
                draft[id]?.confidence = nil
            }
        }
        var value = draft[gameId] ?? GamePickDraft()
        value.confidence = confidence
        draft[gameId] = value
        saveNotice = nil
    }

    private func isComplete(card: WeekCard) -> Bool {
        let values = card.cardGames.compactMap { draft[$0.id] }
        let confidences = values.compactMap(\.confidence)
        return values.count == card.cardGames.count
            && values.allSatisfy { $0.side != nil && $0.confidence != nil }
            && Set(confidences).count == card.cardGames.count
            && bestBetGameId != nil
            && propChoice != nil
    }

    private func canEdit(card: WeekCard) -> Bool {
        let kickoffs = card.cardGames.compactMap { footballKickoffDate($0.startTime) }
        guard let firstKickoff = kickoffs.min() else { return true }
        return Date() < firstKickoff
    }

    private func nextCommand(card: WeekCard) -> String {
        let unfinished = card.cardGames.filter {
            draft[$0.id]?.side == nil || draft[$0.id]?.confidence == nil
        }.count
        if unfinished > 0 { return "Finish \(unfinished) game\(unfinished == 1 ? "" : "s"). The fence is not a team." }
        if bestBetGameId == nil { return "Courage, please. Mark one Best Bet." }
        if propChoice == nil { return "Answer the prop. We promise not to tell your bookie." }
        return league?.leagues.sportId.lowercased() == "nfl"
            ? "Ready to lock it in. Regret can wait until Sunday."
            : "Ready to lock it in. Regret can wait until Saturday."
    }

    private func save(card: WeekCard) async {
        guard let token = auth.token, let league, let bestBetGameId, let propChoice,
              isComplete(card: card) else { return }
        saving = true
        saveErrorMessage = nil
        do {
            let submissions = card.cardGames.compactMap { game -> PickSubmission? in
                guard let value = draft[game.id], let side = value.side, let confidence = value.confidence else { return nil }
                return PickSubmission(gameId: game.id, side: side, confidence: confidence)
            }
            _ = try await SupabaseAPI.saveWeekPicks(
                token: token,
                leagueId: league.leagueId,
                weekNumber: card.weekNumber,
                picks: submissions,
                bestBetGameId: bestBetGameId,
                propChoice: propChoice
            )
            if EasterEggEngine.isLuckySeven(Date()) {
                _ = try? await SupabaseAPI.recordEasterEggFind(token: token, discoveryId: "egg_lucky_seven")
            }
            if let user = auth.user {
                pick = try await SupabaseAPI.playerPick(token: token, leagueId: league.leagueId, userId: user.id, weekNumber: card.weekNumber)
                hydrateDraft(from: pick)
            }
            saveNotice = "Locked in. Confidence now officially exceeds evidence."
            editingSubmittedCard = false
        } catch {
            saveErrorMessage = error.localizedDescription
        }
        saving = false
    }

    private var isNFL: Bool { league?.leagues.sportId.lowercased() == "nfl" }

    private var regularSeasonWeaponConfirmationTitle: String {
        isNFL ? "AUTHORIZE JDAM SUPPORT?" : "GO NUCLEAR?"
    }

    private var regularSeasonWeaponAuthorizationLabel: String {
        isNFL ? "AUTHORIZE JDAM" : "AUTHORIZE ☢"
    }

    private var regularSeasonWeaponConfirmationMessage: String {
        let weapon = isNFL ? "JDAM" : "The targeting computer"
        return "\(weapon) takes the full regular-season card using the posted favorites and a legal confidence ladder. It adds a 50% bonus to points earned, never subtracts points, and immediately spends one of two season uses. No edits. No rerolls."
    }

    private func authorizeRegularSeasonWeapon(card: WeekCard) async {
        guard tacticalNukesUsed < 2, pick == nil, let token = auth.token, let league,
              let user = auth.user,
              card.weekNumber <= league.leagues.regularSeasonWeeks,
              let prop = card.propOptionA,
              let plan = RegularSeasonWeaponEngine.plan(for: card.cardGames) else { return }
        saving = true
        saveErrorMessage = nil
        do {
            _ = try await SupabaseAPI.saveWeekPicks(
                token: token,
                leagueId: league.leagueId,
                weekNumber: card.weekNumber,
                picks: plan.submissions,
                bestBetGameId: plan.bestBetGameId,
                propChoice: prop,
                isChaos: true
            )
            pick = try await SupabaseAPI.playerPick(token: token, leagueId: league.leagueId, userId: user.id, weekNumber: card.weekNumber)
            hydrateDraft(from: pick)
            tacticalNukesUsed = min(2, tacticalNukesUsed + 1)
            saveNotice = isNFL
                ? "JDAM card sealed. Earned points receive 50% support."
                : "Nuclear card sealed. Earned points receive 50% support."
            editingSubmittedCard = false
            strikePresentation = WeaponStrikeCatalog.presentation(for: league.leagues.sportId)
        } catch { saveErrorMessage = error.localizedDescription }
        saving = false
    }
}

struct WeekBoardView: View {
    let card: WeekCard
    let picks: [BoardPick]
    let sportId: String
    let loading: Bool
    let errorMessage: String?
    let retry: () -> Void
    @State private var clock = Date()
    private var identity: SportIdentity { SportIdentity(sportId) }

    private var scored: Bool { picks.contains { $0.totalPoints != nil } }
    private var visibleGames: [CardGame] {
        card.cardGames.filter { boardGameIsDeclassified(startTime: $0.startTime, at: clock, weekScored: scored) }
    }
    private var nextKickoff: Date? {
        card.cardGames.compactMap { footballKickoffDate($0.startTime) }.filter { $0 > clock }.min()
    }

    var body: some View {
        ZStack {
            if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) } else { BoardSituationRoomBackdrop() }
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("\(identity.boardKicker) · WEEK \(card.weekNumber)")
                            .font(.caption2.weight(.black)).tracking(2.1).foregroundStyle(identity.secondaryAccent)
                        Text(identity.boardTitle)
                            .font(.system(size: 43, weight: .black)).fontWidth(.compressed)
                        Text(identity.boardDetail)
                            .font(.caption.weight(.black)).tracking(1.1).foregroundStyle(identity.isNFL ? .red : .orange)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(18)
                    .background(.black.opacity(0.72), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 24, bottomTrailingRadius: 4, topTrailingRadius: 24))
                    .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 24, bottomTrailingRadius: 4, topTrailingRadius: 24).stroke(identity.secondaryAccent.opacity(0.75), lineWidth: 1.5))

                    if loading {
                        HStack { Spacer(); ProgressView("Decrypting the cards…").tint(identity.isNFL ? .cyan : .green); Spacer() }.padding(.vertical, 50)
                    } else if let errorMessage {
                        VStack(spacing: 12) {
                            Text("BOARD TEMPORARILY JAMMED").font(.headline.weight(.black)).foregroundStyle(identity.isNFL ? .red : .orange)
                            Text(errorMessage).font(.footnote).foregroundStyle(.white.opacity(0.65)).multilineTextAlignment(.center)
                            Button("TRY THE RADIO AGAIN", action: retry).buttonStyle(.borderedProminent).tint(identity.isNFL ? .blue : .green)
                        }.frame(maxWidth: .infinity).padding(24).background(.black.opacity(0.8), in: RoundedRectangle(cornerRadius: 18))
                    } else if picks.isEmpty {
                        Text("NO LOCKED CARDS RECOVERED. EVERYONE HAS SOME EXPLAINING TO DO.")
                            .font(.headline.weight(.black)).foregroundStyle(identity.isNFL ? .red : .orange).padding(24)
                    } else {
                        HStack {
                            BoardMetric(value: "\(picks.count)", label: "CARDS EXPOSED", color: identity.isNFL ? .cyan : .green)
                            BoardMetric(value: "\(visibleGames.count)/\(card.cardGames.count)", label: "DECLASSIFIED", color: identity.isNFL ? .red : .orange)
                            BoardMetric(value: "\(picks.filter { $0.totalPoints != nil }.count)", label: "SCORED", color: identity.isNFL ? .blue : .yellow)
                        }

                        if identity.isNFL { NflBroadcastSectionLabel(title: "CONSENSUS BOARD", detail: "WHO TOOK WHAT · CONFIDENCE ATTACHED") }
                        else { HomeSectionLabel(title: "CONSENSUS MAP", detail: "WHO TOOK WHAT · CONFIDENCE ATTACHED") }
                        ForEach(visibleGames) { game in
                            BoardGamePanel(game: game, picks: picks, sportId: sportId)
                        }
                        if let nextKickoff, !scored {
                            Label("NEXT PICKS DECLASSIFY AT \(nextKickoff.formatted(date: .omitted, time: .shortened))", systemImage: "lock.fill")
                                .font(.caption.weight(.black)).tracking(0.7).foregroundStyle(identity.isNFL ? .red : .orange)
                                .frame(maxWidth: .infinity).padding(14)
                                .background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 12))
                        }

                        if identity.isNFL { NflBroadcastSectionLabel(title: "PLAYER TAPE", detail: "EVERY LOCKED CARD · NO HIDING") }
                        else { HomeSectionLabel(title: "PERSONNEL FILES", detail: "EVERY LOCKED CARD · NO HIDING") }
                        ForEach(Array(picks.enumerated()), id: \.element.id) { index, player in
                            BoardPlayerDossier(index: index + 1, player: player, card: card, sportId: sportId)
                        }
                    }
                }
                .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 38)
            }
            .refreshable { retry() }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                clock = Date()
            }
        }
    }
}

private struct BoardMetric: View {
    let value: String
    let label: String
    let color: Color
    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.title2.weight(.black)).foregroundStyle(color)
            Text(label).font(.system(size: 7, weight: .black)).tracking(0.8).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
        }.frame(maxWidth: .infinity).padding(.vertical, 11).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 10)).overlay(RoundedRectangle(cornerRadius: 10).stroke(color.opacity(0.35)))
    }
}

private struct BoardGamePanel: View {
    let game: CardGame
    let picks: [BoardPick]
    let sportId: String
    private var identity: SportIdentity { SportIdentity(sportId) }
    private func selections(for team: String, sideKey: String) -> [(String, PickedGame, Bool)] {
        picks.compactMap { player in
            guard let choice = player.pickGames.first(where: { $0.cardGameId == game.id }),
                  choice.side.caseInsensitiveCompare(team) == .orderedSame || choice.side.lowercased() == sideKey else { return nil }
            return (player.displayName, choice, isFavorite(team, for: player))
        }
    }
    private func isFavorite(_ team: String, for player: BoardPick) -> Bool {
        guard let favorite = FootballTeamCatalog.team(forTeamId: player.favoriteTeamId, sportId: sportId) else { return false }
        return FootballTeamCatalog.matches(team, favorite: favorite)
    }
    var body: some View {
        let away = selections(for: game.awayTeam, sideKey: "away")
        let home = selections(for: game.homeTeam, sideKey: "home")
        VStack(spacing: 0) {
            HStack {
                Text("GAME \(game.sortOrder + 1)").font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(identity.isNFL ? .cyan : .green)
                Spacer()
                Text("\(away.count) — \(home.count)").font(.caption.weight(.black)).foregroundStyle(identity.isNFL ? .red : .orange)
            }.padding(12).background(.white.opacity(0.055))
            HStack(alignment: .top, spacing: 1) {
                BoardTeamColumn(team: game.awayTeam, selections: away, leading: true, accent: identity.isNFL ? .cyan : .green, bestBetAccent: identity.isNFL ? .red : .yellow)
                Rectangle().fill((identity.isNFL ? Color.cyan : Color.green).opacity(0.28)).frame(width: 1)
                BoardTeamColumn(team: game.homeTeam, selections: home, leading: false, accent: identity.isNFL ? .cyan : .green, bestBetAccent: identity.isNFL ? .red : .yellow)
            }
        }
        .background(.black.opacity(0.83), in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 14))
        .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 14).stroke((identity.isNFL ? Color.cyan : Color.green).opacity(0.42)))
        .clipShape(RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 14))
    }
}

private struct BoardTeamColumn: View {
    let team: String
    let selections: [(String, PickedGame, Bool)]
    let leading: Bool
    let accent: Color
    let bestBetAccent: Color
    var body: some View {
        VStack(alignment: leading ? .leading : .trailing, spacing: 8) {
            Text(team.uppercased()).font(.caption.weight(.black)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            ForEach(Array(selections.enumerated()), id: \.offset) { _, item in
                HStack(spacing: 5) {
                    if !leading { Spacer(minLength: 0) }
                    if item.1.isBestBet { Text("BB").font(.system(size: 7, weight: .black)).foregroundStyle(.white).padding(.horizontal, 4).padding(.vertical, 2).background(bestBetAccent, in: Capsule()) }
                    if item.2 { Image(systemName: "heart.fill").font(.system(size: 8, weight: .black)).foregroundStyle(.red).accessibilityLabel("Favorite team") }
                    Text(item.0).font(.system(size: 10, weight: .bold)).lineLimit(1)
                    Text("\(item.1.confidence)").font(.system(size: 10, weight: .black)).foregroundStyle(accent)
                    if leading { Spacer(minLength: 0) }
                }
            }
            if selections.isEmpty { Text("NO TAKERS").font(.system(size: 9, weight: .black)).foregroundStyle(.white.opacity(0.28)) }
        }.frame(maxWidth: .infinity, alignment: leading ? .leading : .trailing).padding(12)
    }
}

private struct BoardPlayerDossier: View {
    let index: Int
    let player: BoardPick
    let card: WeekCard
    let sportId: String
    private var identity: SportIdentity { SportIdentity(sportId) }
    private var favoriteTeam: FootballTeam? { FootballTeamCatalog.team(forTeamId: player.favoriteTeamId, sportId: sportId) }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Text(String(format: "%02d", index)).font(.title3.weight(.black)).foregroundStyle((identity.isNFL ? Color.cyan : Color.green).opacity(0.6))
                VStack(alignment: .leading, spacing: 2) {
                    Text(player.displayName.uppercased()).font(.headline.weight(.black))
                    if let favoriteTeam {
                        Label("LOYALTY · \(favoriteTeam.name.uppercased())", systemImage: "heart.fill")
                            .font(.system(size: 8, weight: .black)).tracking(0.8).foregroundStyle(.red)
                    }
                    Text(player.totalPoints.map { "\($0) POINTS · OFFICIAL" } ?? "RESULTS PENDING")
                        .font(.caption2.weight(.black)).tracking(1).foregroundStyle(player.totalPoints == nil ? (identity.isNFL ? .red : .orange) : (identity.isNFL ? .cyan : .yellow))
                }
                Spacer()
                if let prop = player.propChoice { Text("PROP\n\(prop)").font(.system(size: 8, weight: .black)).multilineTextAlignment(.trailing).foregroundStyle(.white.opacity(0.55)) }
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 7) {
                ForEach(player.pickGames, id: \.cardGameId) { choice in
                    let game = card.cardGames.first { $0.id == choice.cardGameId }
                    let team = choice.side.lowercased() == "away" ? game?.awayTeam : choice.side.lowercased() == "home" ? game?.homeTeam : choice.side
                    VStack(alignment: .leading, spacing: 3) {
                        Text((team ?? choice.side).uppercased()).font(.system(size: 9, weight: .black)).lineLimit(1)
                        HStack {
                            Text("CONF \(choice.confidence)").font(.system(size: 8, weight: .bold)).foregroundStyle(identity.isNFL ? .cyan : .green)
                            Spacer()
                            if choice.isBestBet { Text("BEST BET").font(.system(size: 7, weight: .black)).foregroundStyle(identity.isNFL ? .red : .yellow) }
                        }
                        if let favoriteTeam, let team {
                            if FootballTeamCatalog.matches(team, favorite: favoriteTeam) {
                                Text("HOMER PICK").font(.system(size: 7, weight: .black)).foregroundStyle(.red)
                            } else if gameInvolvesFavorite(choice, favoriteTeam: favoriteTeam) {
                                Text("BETRAYAL").font(.system(size: 7, weight: .black)).foregroundStyle(identity.isNFL ? .cyan : .orange)
                            }
                        }
                    }.padding(9).background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 8))
                }
            }
        }
        .padding(15).background(.black.opacity(0.86), in: UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 18, bottomTrailingRadius: 3, topTrailingRadius: 18))
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 18, bottomTrailingRadius: 3, topTrailingRadius: 18).stroke((identity.isNFL ? Color.blue : Color.orange).opacity(0.35)))
    }

    private func gameInvolvesFavorite(_ choice: PickedGame, favoriteTeam: FootballTeam) -> Bool {
        guard let game = card.cardGames.first(where: { $0.id == choice.cardGameId }) else { return false }
        return [game.awayTeam, game.homeTeam].contains { FootballTeamCatalog.matches($0, favorite: favoriteTeam) }
    }
}

private struct BoardSituationRoomBackdrop: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [.black, Color(red: 0.015, green: 0.10, blue: 0.045), .black], startPoint: .topLeading, endPoint: .bottomTrailing)
            Canvas { context, size in
                var path = Path()
                stride(from: 0.0, through: size.width, by: 28).forEach { x in path.move(to: CGPoint(x: x, y: 0)); path.addLine(to: CGPoint(x: x, y: size.height)) }
                stride(from: 0.0, through: size.height, by: 28).forEach { y in path.move(to: CGPoint(x: 0, y: y)); path.addLine(to: CGPoint(x: size.width, y: y)) }
                context.stroke(path, with: .color(.green.opacity(0.055)), lineWidth: 0.7)
            }
            RadialGradient(colors: [.orange.opacity(0.13), .clear], center: .topTrailing, startRadius: 10, endRadius: 260)
        }.ignoresSafeArea()
    }
}

private struct MissingWeekCardView: View {
    let league: LeagueMembership?
    let memberships: [LeagueMembership]
    let isCommissioner: Bool
    let retry: () -> Void
    private var isNFL: Bool { league?.leagues.sportId.lowercased() == "nfl" }
    private var accent: Color { isNFL ? .cyan : .yellow }

    var body: some View {
        ZStack {
            PicksRecruitingBackdrop()
            ScrollView {
                VStack(spacing: 18) {
                    Image(systemName: "calendar.badge.exclamationmark")
                        .font(.system(size: 58, weight: .black))
                        .foregroundStyle(accent)
                        .shadow(color: accent.opacity(0.35), radius: 16)
                    Text("WEEK \(league?.leagues.currentWeek ?? 0) · \((league?.leagues.sportId ?? "SPORT").uppercased())")
                        .font(.caption2.weight(.black)).tracking(2).foregroundStyle(accent)
                    Text("NO CARD\nON THE BOARD")
                        .font(.system(size: 34, weight: .black)).fontWidth(.condensed)
                        .multilineTextAlignment(.center).lineSpacing(-3)
                    Text(league?.leagues.name.uppercased() ?? "WAR ROOM")
                        .font(.caption.weight(.black)).tracking(1.4).foregroundStyle(isNFL ? .red : .green)
                    Text(isCommissioner
                         ? "This league does not have a published card for its active week. Build and publish the slate before players enter the room."
                         : "Command has not published this week’s card yet. Your Picks tab will populate automatically when the slate goes live.")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.68))
                        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                    if isCommissioner, let league {
                        NavigationLink {
                            CommissionerCardBuilderView(membership: league)
                        } label: {
                            Label("BUILD WEEK \(league.leagues.currentWeek) CARD", systemImage: "hammer.fill")
                                .font(.caption.weight(.black)).tracking(0.7)
                                .frame(maxWidth: .infinity).padding(.vertical, 8)
                        }
                        .buttonStyle(.borderedProminent).tint(isNFL ? .blue : .yellow).foregroundStyle(isNFL ? .white : .black)
                    }
                    if memberships.count > 1 {
                        NavigationLink {
                            LeagueCommandCenterView(memberships: memberships)
                        } label: {
                            Label("SWITCH LEAGUE OR SPORT", systemImage: "antenna.radiowaves.left.and.right")
                                .font(.caption.weight(.black)).tracking(0.7)
                                .frame(maxWidth: .infinity).padding(.vertical, 8)
                        }
                        .buttonStyle(.bordered).tint(isNFL ? .cyan : .yellow)
                    }
                    VStack(spacing: 7) {
                        Text("COMMISH IS DRUNK AGAIN.")
                            .font(.caption.weight(.black)).tracking(1.2).foregroundStyle(isNFL ? .red : .orange)
                        Text("CHECK BACK LATER OR GO MAKE THIS EVERYONE’S PROBLEM.")
                            .font(.system(size: 8, weight: .black)).tracking(0.8).foregroundStyle(.white.opacity(0.42))
                    }
                    .multilineTextAlignment(.center).padding(.vertical, 3)
                    NavigationLink {
                        LockerRoomView()
                    } label: {
                        Label("CALL OUT THE COMMISH", systemImage: "megaphone.fill")
                            .font(.caption.weight(.black)).tracking(0.7)
                            .frame(maxWidth: .infinity).padding(.vertical, 8)
                    }
                    .buttonStyle(.borderedProminent).tint(isNFL ? .red : .orange).foregroundStyle(isNFL ? .white : .black)
                    Text("Pull down to check the board again. Hope is not a strategy, but here we are.")
                        .font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.38)).multilineTextAlignment(.center)
                }
                .padding(24)
                .frame(maxWidth: 390)
                .background(.black.opacity(0.82), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 28, bottomTrailingRadius: 4, topTrailingRadius: 28))
                .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: isNFL ? 6 : 28, bottomTrailingRadius: 4, topTrailingRadius: isNFL ? 6 : 28).stroke(accent.opacity(0.48), lineWidth: 1.5))
                .padding(.horizontal, 18).padding(.top, 70).padding(.bottom, 36)
            }
            .refreshable { retry() }
        }
    }

}

private struct RegularSeasonWeaponPanel: View {
    let sportId: String
    let remaining: Int
    let armed: Bool
    let authorize: () -> Void

    private var isNFL: Bool { sportId.lowercased() == "nfl" }
    private var accent: Color { isNFL ? .cyan : .red }
    private var title: String { isNFL ? "JDAM CATCH-UP PACKAGE" : "TACTICAL NUCLEAR BUTTON" }
    private var action: String { isNFL ? "CALL JDAM" : "GO NUCLEAR" }

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: isNFL ? "scope" : "aqi.medium")
                    .font(.system(size: 32, weight: .black)).foregroundStyle(armed ? .green : accent)
                VStack(alignment: .leading, spacing: 3) {
                    Text("REGULAR SEASON CATCH-UP WEAPON").font(.system(size: 8, weight: .black)).tracking(1.3).foregroundStyle(accent.opacity(0.9))
                    Text(title).font(.headline.weight(.black))
                }
                Spacer()
                Text("\(remaining)/2").font(.title3.weight(.black)).monospacedDigit().foregroundStyle(armed ? .green : accent)
            }
            if armed {
                Label("AI CARD SEALED · EARNED POINTS +50%", systemImage: "checkmark.seal.fill")
                    .font(.caption.weight(.black)).foregroundStyle(.green)
            } else {
                Button(action: authorize) {
                    Text(remaining > 0 ? "\(action) · \(remaining)/2" : "ARSENAL EMPTY · 0/2")
                        .font(.caption.weight(.black)).frame(maxWidth: .infinity).padding(.vertical, 7)
                }.buttonStyle(.borderedProminent).tint(accent).disabled(remaining == 0)
            }
            Text("The computer takes the posted favorites. Correct picks keep their normal points and add a 50% catch-up bonus. Misses never cost points.")
                .font(.system(size: 9, weight: .bold)).foregroundStyle(.white.opacity(0.56)).multilineTextAlignment(.center)
        }
        .padding(16)
        .background(LinearGradient(colors: [.black.opacity(0.9), accent.opacity(0.16)], startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: isNFL ? 7 : 18))
        .overlay(RoundedRectangle(cornerRadius: isNFL ? 7 : 18).stroke((armed ? Color.green : accent).opacity(0.62), lineWidth: 2))
    }
}

private struct LockedPickSummaryView: View {
    let leagueName: String
    let sportId: String
    let card: WeekCard
    let pick: PlayerPick
    let canEdit: Bool
    let onEdit: () -> Void

    private var isNFL: Bool { sportId.lowercased() == "nfl" }
    private var accent: Color { isNFL ? .cyan : .green }

    var body: some View {
        ZStack {
            if isNFL { NflHomeBackdrop(phase: .regularSeason) }
            else {
                Color.black.ignoresSafeArea()
                LinearGradient(colors: [.green.opacity(0.10), .black, .black], startPoint: .top, endPoint: .center).ignoresSafeArea()
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 5) {
                            Label("CARD ON FILE", systemImage: "checkmark.seal.fill")
                                .font(.system(size: 9, weight: .black)).tracking(1.8).foregroundStyle(accent)
                            Text("WEEK \(card.weekNumber) RECEIPT").font(.system(size: 30, weight: .black)).fontWidth(.condensed)
                            Text(leagueName.uppercased()).font(.system(size: 9, weight: .black)).tracking(1.3).foregroundStyle(.white.opacity(0.42))
                        }
                        Spacer()
                        Text(canEdit ? "EDITABLE" : "FINAL")
                            .font(.system(size: 8, weight: .black)).tracking(1)
                            .foregroundStyle(canEdit ? (isNFL ? .red : .yellow) : accent)
                            .padding(.horizontal, 9).padding(.vertical, 6)
                            .background((canEdit ? (isNFL ? Color.red : Color.yellow) : accent).opacity(0.12), in: Capsule())
                            .overlay(Capsule().stroke((canEdit ? (isNFL ? Color.red : Color.yellow) : accent).opacity(0.52)))
                    }
                    .padding(18)
                    .background(.black.opacity(0.84), in: RoundedRectangle(cornerRadius: isNFL ? 7 : 18))
                    .overlay(alignment: .top) { if isNFL { HStack(spacing: 0) { Color.blue; Color.white; Color.red }.frame(height: 3) } }
                    .overlay(RoundedRectangle(cornerRadius: isNFL ? 7 : 18).stroke(accent.opacity(0.42)))

                    if pick.isChaos {
                        HStack(spacing: 12) {
                            Image(systemName: isNFL ? "scope" : "aqi.medium")
                                .font(.title2.weight(.black)).foregroundStyle(isNFL ? .cyan : .red)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(isNFL ? "JDAM SUPPORT LOCKED" : "NUCLEAR CARD LOCKED")
                                    .font(.caption.weight(.black)).tracking(1)
                                Text("POSTED FAVORITES · EARNED POINTS +50% · SEALED")
                                    .font(.system(size: 8, weight: .black)).foregroundStyle(.white.opacity(0.52))
                            }
                            Spacer()
                            Image(systemName: "lock.fill").foregroundStyle(.green)
                        }
                        .padding(14)
                        .background((isNFL ? Color.cyan : Color.red).opacity(0.10), in: RoundedRectangle(cornerRadius: isNFL ? 6 : 14))
                        .overlay(RoundedRectangle(cornerRadius: isNFL ? 6 : 14).stroke((isNFL ? Color.cyan : Color.red).opacity(0.42)))
                    }

                    ForEach(card.cardGames) { game in
                        if let selection = pick.pickGames.first(where: { $0.cardGameId == game.id }) {
                            HStack(spacing: 12) {
                                Text(verbatim: String(selection.confidence))
                                    .font(.title2.weight(.black)).monospacedDigit().foregroundStyle(accent)
                                    .frame(width: 38, height: 38).background(accent.opacity(0.12), in: isNFL ? AnyShape(RoundedRectangle(cornerRadius: 4)) : AnyShape(Circle())).overlay((isNFL ? AnyShape(RoundedRectangle(cornerRadius: 4)) : AnyShape(Circle())).stroke(accent.opacity(0.42)))
                                VStack(alignment: .leading, spacing: 3) {
                                    if game.isRivalry {
                                        Text("🔥 CERTIFIED GRUDGE").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.red)
                                    }
                                    HStack(spacing: 6) {
                                        Text(chosenTeam(game, side: selection.side)).font(.headline.weight(.black))
                                        if selection.isBestBet { Image(systemName: "star.fill").foregroundStyle(isNFL ? .red : .yellow).accessibilityLabel("Best Bet") }
                                    }
                                    Text("\(game.awayTeam) at \(game.homeTeam)").font(.caption).foregroundStyle(.white.opacity(0.42)).lineLimit(1)
                                }
                                Spacer()
                                Image(systemName: "checkmark").font(.caption.weight(.black)).foregroundStyle(accent)
                            }
                            .padding(14).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: isNFL ? 6 : 14)).overlay(RoundedRectangle(cornerRadius: isNFL ? 6 : 14).stroke(isNFL ? Color.blue.opacity(0.36) : Color.clear))
                        }
                    }

                    if let prop = pick.propChoice {
                        HStack(spacing: 12) {
                            Image(systemName: "scope").font(.title3.weight(.black)).foregroundStyle(isNFL ? .red : .yellow).frame(width: 38)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("WEEKLY PROP").font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(isNFL ? .red : .yellow)
                                Text(prop).font(.headline.weight(.black))
                            }
                            Spacer()
                        }
                        .padding(14).background((isNFL ? Color.red : Color.yellow).opacity(0.07), in: RoundedRectangle(cornerRadius: isNFL ? 6 : 14)).overlay(RoundedRectangle(cornerRadius: isNFL ? 6 : 14).stroke((isNFL ? Color.red : Color.yellow).opacity(0.30)))
                    }

                    if canEdit {
                        Button(action: onEdit) {
                            Label("REOPEN PICKS", systemImage: "pencil").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(.vertical, 7)
                        }
                        .buttonStyle(.borderedProminent).tint(isNFL ? .blue : .yellow)
                        Text("Your card stays submitted unless you save changes. First kickoff still owns the final word.")
                            .font(.caption).foregroundStyle(.white.opacity(0.38)).multilineTextAlignment(.center).frame(maxWidth: .infinity)
                    } else {
                        Text("THE WINDOW IS CLOSED. HISTORY HAS THE PEN.")
                            .font(.system(size: 8, weight: .black)).tracking(1.4).foregroundStyle(.white.opacity(0.32)).frame(maxWidth: .infinity).padding(.top, 4)
                    }
                }
                .padding(16).padding(.top, 10).padding(.bottom, 34)
            }
        }
    }

    private func chosenTeam(_ game: CardGame, side: String) -> String { side == "away" ? game.awayTeam : game.homeTeam }
}

private struct GamePickDraft {
    var side: String?
    var confidence: Int?
}

private struct PickMissionHeader: View {
    let leagueName: String
    let week: Int
    let complete: Int
    let total: Int
    let saved: Bool
    let ready: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack {
                Label(saved ? "CARD ON FILE" : "LIVE PICKING WINDOW", systemImage: saved ? "checkmark.seal.fill" : "bolt.fill")
                    .font(.system(size: 10, weight: .black)).tracking(1.7).foregroundStyle(saved ? .green : .yellow)
                Spacer()
                Text("WEEK \(week)").font(.caption2.weight(.black)).tracking(1.4)
            }
            Text("MAKE YOUR CALLS").font(.system(size: 31, weight: .black)).fontWidth(.condensed)
            Text(leagueName.uppercased()).font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(.secondary)
            HStack(spacing: 12) {
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.09)).frame(height: 7)
                    GeometryReader { proxy in
                        Capsule().fill(complete == total ? .green : .yellow)
                            .frame(width: proxy.size.width * CGFloat(complete) / CGFloat(max(total, 1)), height: 7)
                    }.frame(height: 7)
                }
                Text("\(complete)/\(total)").font(.caption.weight(.black)).monospacedDigit()
            }
            Text(saved ? "Card saved. Evidence may change; your confidence probably won’t." : (ready ? "Entire card ready. Seal your fate." : (complete == total ? "Slate complete. Add the prop and Best Bet." : "\(total - complete) matchup\(total - complete == 1 ? "" : "s") still need orders.")))
                .font(.caption).foregroundStyle(.secondary)
        }
        .padding(20)
        .background(LinearGradient(colors: [.black.opacity(0.78), .green.opacity(0.18)], startPoint: .leading, endPoint: .trailing), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 24, bottomTrailingRadius: 4, topTrailingRadius: 24))
        .overlay(alignment: .leading) { Rectangle().fill(saved ? .green : .yellow).frame(width: 4).padding(.vertical, 13) }
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 24, bottomTrailingRadius: 4, topTrailingRadius: 24).stroke(.green.opacity(0.42)))
    }
}

private struct EditableGamePickRow: View {
    let game: CardGame
    let sportId: String
    let draft: GamePickDraft
    let confidenceOptions: [Int]
    let usedConfidences: Set<Int>
    let isBestBet: Bool
    let onSide: (String) -> Void
    let onConfidence: (Int?) -> Void
    let onBestBet: () -> Void
    private var isNFL: Bool { sportId.lowercased() == "nfl" }
    private var accent: Color { isNFL ? .cyan : .green }
    private var selection: Color { isNFL ? .blue : .green }
    private var wagerAccent: Color { isNFL ? .red : .yellow }
    private var cornerRadius: CGFloat { isNFL ? 6 : 20 }

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            if game.isRivalry {
                HStack {
                    Label(isNFL ? "DIVISION GRUDGE · BAD BLOOD FILED" : "RIVALRY WEEK · CERTIFIED GRUDGE", systemImage: "flame.fill")
                        .font(.caption2.weight(.black)).tracking(1).foregroundStyle(.red)
                    Spacer()
                    Text("NO FRIENDS").font(.system(size: 8, weight: .black)).foregroundStyle(.red.opacity(0.7))
                }
            }
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(team(game.awayTeam, rank: game.awayRank)).font(.headline.weight(.black))
                    Text("AT  \(team(game.homeTeam, rank: game.homeRank))").font(.subheadline.weight(.bold)).foregroundStyle(.secondary)
                }
                Spacer()
                Text(line).font(.caption.weight(.black).monospacedDigit()).foregroundStyle(accent)
                    .padding(.horizontal, 9).padding(.vertical, 6).background(accent.opacity(0.1), in: Capsule())
            }
            HStack(spacing: 8) {
                sideButton(game.awayTeam, side: "away")
                sideButton(game.homeTeam, side: "home")
            }
            HStack {
                Text("CONFIDENCE").font(.caption2.weight(.black)).tracking(1.3).foregroundStyle(.secondary)
                Spacer()
                ForEach(confidenceOptions, id: \.self) { confidence in
                    Button("\(confidence)") {
                        onConfidence(draft.confidence == confidence ? nil : confidence)
                    }
                        .buttonStyle(.borderedProminent)
                        .tint(draft.confidence == confidence ? selection : .secondary)
                        .disabled(usedConfidences.contains(confidence))
                        .accessibilityLabel(draft.confidence == confidence ? "Clear confidence \(confidence)" : "Set confidence \(confidence)")
                }
            }
            Button { onBestBet() } label: {
                Label(isBestBet ? "BEST BET ARMED" : "ARM AS BEST BET", systemImage: isBestBet ? "star.fill" : "star")
                    .font(.caption.weight(.black)).frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
            }
            .buttonStyle(.bordered).tint(isBestBet ? wagerAccent : .secondary)
        }
        .padding(17)
        .background(.black.opacity(0.75), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: cornerRadius, bottomTrailingRadius: 4, topTrailingRadius: cornerRadius))
        .overlay(alignment: .leading) { Rectangle().fill(game.isRivalry ? .red : (isBestBet ? wagerAccent : (draft.side == nil ? .gray.opacity(0.35) : accent))).frame(width: game.isRivalry ? 5 : 3).padding(.vertical, 12) }
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: cornerRadius, bottomTrailingRadius: 4, topTrailingRadius: cornerRadius).stroke(game.isRivalry ? .red.opacity(0.78) : (isBestBet ? wagerAccent.opacity(0.65) : accent.opacity(draft.side == nil ? 0.16 : 0.38)), lineWidth: game.isRivalry ? 2 : 1))
    }

    private func sideButton(_ name: String, side: String) -> some View {
        Button {
            onSide(side)
        } label: {
            Text(name).font(.subheadline.weight(.bold)).frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(draft.side == side ? selection : .gray.opacity(0.30))
    }

    private var line: String {
        let favoriteName = game.favorite == "away" ? game.awayTeam : game.homeTeam
        return favoriteSpreadLabel(favorite: favoriteName, spread: game.spread)
    }
    private func team(_ name: String, rank: Int?) -> String { rank.map { "#\($0) \(name)" } ?? name }
}

private struct LoginView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var working = false
    @State private var creating = false

    private var cleanEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var cleanDisplayName: String { displayName.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var validEmail: Bool {
        let pieces = cleanEmail.split(separator: "@", omittingEmptySubsequences: false)
        return pieces.count == 2 && !pieces[0].isEmpty && pieces[1].contains(".") && !cleanEmail.contains(" ")
    }
    private var validPassword: Bool { password.count >= 8 }
    private var validDisplayName: Bool { (2...30).contains(cleanDisplayName.count) }
    private var canSubmit: Bool {
        if creating { return validEmail && validPassword && validDisplayName }
        return validEmail && !password.isEmpty
    }

    var body: some View {
        ZStack {
            WarRoomBackdrop()
            ScrollView {
              VStack(alignment: .leading, spacing: 17) {
                Spacer(minLength: 55)
                HStack { Spacer(); Image(systemName: "shield.lefthalf.filled").font(.system(size: 47, weight: .black)).foregroundStyle(.green).shadow(color: .green.opacity(0.5), radius: 22); Spacer() }
                Text("WAR ROOM PICK’EM").frame(maxWidth: .infinity).font(.caption.weight(.black)).tracking(4).foregroundStyle(.green)
                Text(creating ? "Build your room." : "Enter the room.").frame(maxWidth: .infinity).font(.largeTitle.weight(.black))
                Text("Weekly pick’em with friends. One card. Confidence. Trash talk optional.")
                    .frame(maxWidth: .infinity).multilineTextAlignment(.center).font(.subheadline).foregroundStyle(.secondary)
                if creating {
                    TextField("What friends call you", text: $displayName)
                        .textContentType(.nickname)
                        .autocorrectionDisabled()
                        .padding().background(.black.opacity(0.65), in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(.green.opacity(0.32)))
                    Text("Use 2–30 characters. This is the handle other players will see.")
                        .font(.caption2.weight(.semibold)).foregroundStyle(validDisplayName || displayName.isEmpty ? Color.secondary : Color.red)
                }
                TextField("Email", text: $email)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.emailAddress)
                .textContentType(.username)
                .padding().background(.black.opacity(0.65), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.green.opacity(0.32)))
                SecureField("Password", text: $password)
                .textContentType(creating ? .newPassword : .password)
                .padding().background(.black.opacity(0.65), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.green.opacity(0.32)))
                if creating {
                    Text("Password must be at least 8 characters.")
                        .font(.caption2.weight(.semibold)).foregroundStyle(validPassword || password.isEmpty ? Color.secondary : Color.red)
                } else {
                    Button("Forgot password?") {
                        Task { await auth.sendPasswordReset(email: cleanEmail) }
                    }
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(.green)
                    .disabled(!validEmail || working)
                    .accessibilityHint("Sends a secure password-reset link to the email above")
                }
                if let error = auth.errorMessage { Text(error).font(.footnote).foregroundStyle(.red) }
                if let notice = auth.noticeMessage { Text(notice).font(.footnote).foregroundStyle(.green) }
                Button {
                working = true
                Task {
                    if creating { await auth.createAccount(email: cleanEmail, password: password, displayName: cleanDisplayName) }
                    else { await auth.signIn(email: cleanEmail, password: password) }
                    working = false
                }
            } label: {
                HStack { Spacer(); working ? AnyView(ProgressView()) : AnyView(Text(creating ? "CREATE ACCOUNT" : "SIGN IN").fontWeight(.black)); Spacer() }
                    .padding(.vertical, 4)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
                .disabled(working || !canSubmit)
                Button(creating ? "Already have an account? Sign in" : "New here? Create account") {
                creating.toggle(); auth.errorMessage = nil; auth.noticeMessage = nil
                }
                .frame(maxWidth: .infinity).foregroundStyle(.green)
                Text("Same league. Same grudges. Smaller screen.")
                .frame(maxWidth: .infinity).font(.caption).foregroundStyle(.secondary)
                Spacer(minLength: 30)
              }
              .padding(24)
            }
        }
    }
}

struct StandingsView: View {
    @EnvironmentObject private var auth: AuthStore
    let leagueOverride: LeagueMembership?
    @State private var standings: [Standing] = []
    @State private var errorMessage: String?
    @State private var loading = true
    @State private var activeConference = "OVERALL"
    @State private var latestTrophyByUser: [UUID: ProfileTrophy] = [:]
    @State private var careerRankByUser: [UUID: CareerRankProgress] = [:]
    @State private var postseasonScoreByUser: [UUID: CfbPostseasonScore] = [:]
    @State private var selectedProfileUserId: UUID?
    @State private var selectedTrophy: ProfileTrophy?
    @State private var sportId = "cfb"
    private var identity: SportIdentity { SportIdentity(sportId) }

    private var conferences: [String] {
        if sportId == "nfl" {
            let divisions = Set(standings.compactMap { $0.division?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() }.filter { !$0.isEmpty })
            return ["OVERALL"] + divisions.sorted()
        }
        return ["OVERALL", "B10", "BIG 12", "SEC", "ACC"]
    }

    init(leagueOverride: LeagueMembership? = nil) { self.leagueOverride = leagueOverride }

    var body: some View {
        NavigationStack {
            Group {
                if loading { ProgressView("Loading standings…") }
                else if let errorMessage { ContentUnavailableView("Standings unavailable", systemImage: "exclamationmark.triangle", description: Text(errorMessage)) }
                else if standings.isEmpty { ContentUnavailableView("No scored standings yet", systemImage: "list.number", description: Text("The live league has no scored weeks.")) }
                else {
                    ZStack {
                        if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) } else { StandingsHallBackdrop() }
                        ScrollView {
                            VStack(alignment: .leading, spacing: 14) {
                                VStack(alignment: .leading, spacing: 9) {
                                    Label(identity.standingsKicker, systemImage: identity.isNFL ? "football.fill" : "seal.fill")
                                        .font(.caption2.weight(.black)).tracking(2).foregroundStyle(identity.accent)
                                    Text(identity.standingsTitle).font(.system(size: 37, weight: .black)).fontWidth(.condensed).lineSpacing(-4)
                                    Text(identity.standingsDetail).font(.caption2.weight(.black)).tracking(1.7).foregroundStyle(.white.opacity(0.5))
                                }
                                .frame(maxWidth: .infinity, alignment: .leading).padding(22)
                                .background(LinearGradient(colors: [.black.opacity(0.80), identity.accent.opacity(0.13)], startPoint: .leading, endPoint: .trailing), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 25, bottomTrailingRadius: 4, topTrailingRadius: 25))
                                .overlay(alignment: .leading) { Rectangle().fill(identity.accent).frame(width: 4).padding(.vertical, 14) }
                                .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 25, bottomTrailingRadius: 4, topTrailingRadius: 25).stroke(identity.accent.opacity(0.48)))

                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        ForEach(conferences, id: \.self) { conference in
                                            Button {
                                                withAnimation(.snappy) { activeConference = conference }
                                            } label: {
                                                Text(conference)
                                                    .font(.system(size: 10, weight: .black)).tracking(1)
                                                    .foregroundStyle(activeConference == conference ? .black : .white.opacity(0.72))
                                                    .padding(.horizontal, 13).padding(.vertical, 9)
                                                    .background(activeConference == conference ? identity.accent : Color.black.opacity(0.72), in: Capsule())
                                                    .overlay(Capsule().stroke(identity.accent.opacity(activeConference == conference ? 1 : 0.28)))
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                }

                                ForEach(Array(filteredStandings.enumerated()), id: \.element.id) { index, standing in
                                    StandingRankCard(
                                        rank: index + 1,
                                        standing: standing,
                                        sportId: sportId,
                                        trophy: latestTrophyByUser[standing.userId],
                                        careerRank: careerRankByUser[standing.userId] ?? CareerRanks.resolve(points: 0, seasons: 0, sports: 1),
                                        postseasonScore: postseasonScoreByUser[standing.userId],
                                        onOpenProfile: { selectedProfileUserId = standing.userId },
                                        onOpenTrophy: { selectedTrophy = latestTrophyByUser[standing.userId] }
                                    )
                                    if activeConference != "OVERALL" && standings.count > 32 {
                                        if filteredStandings.count == 8 && index + 1 == 4 {
                                            postseasonCutLine("CHAMPIONSHIP ABOVE · TOILET BOWL BELOW", color: identity.accent)
                                        } else {
                                            if index + 1 == 4 {
                                                postseasonCutLine("CHAMPIONSHIP CUT", color: identity.accent)
                                            }
                                            if index + 1 == filteredStandings.count - 4 {
                                                postseasonCutLine("TOILET BOWL CUT", color: .purple)
                                            }
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 36)
                        }
                        .refreshable { await load() }
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .toolbar {
                Button("Sign Out") { auth.signOut() }
            }
            .navigationDestination(item: $selectedProfileUserId) { userId in
                if let standing = standings.first(where: { $0.userId == userId }) {
                    PublicPlayerProfileView(standing: standing, sportId: sportId, leagueStandingsOverride: standings)
                }
            }
            .sheet(item: $selectedTrophy) { trophy in
                TrophyEvidenceView(trophy: trophy, title: trophyDisplayTitle(trophy.trophyType))
                    .presentationDetents([.large]).presentationDragIndicator(.hidden)
            }
            .task(id: leagueOverride?.leagueId ?? auth.selectedLeagueId) { await load() }
        }
    }

    private var filteredStandings: [Standing] {
        guard activeConference != "OVERALL" else { return standings }
        if sportId == "nfl" {
            return standings.filter { $0.division?.uppercased() == activeConference }
        }
        return standings.filter { conferenceLabel(for: $0.division) == activeConference }
    }

    private func conferenceLabel(for division: String?) -> String {
        switch division?.lowercased() {
        case "south": return "B10"
        case "east": return "ACC"
        case "west": return "BIG 12"
        default: return "SEC"
        }
    }

    private func postseasonCutLine(_ label: String, color: Color) -> some View {
        HStack(spacing: 9) {
            Rectangle().fill(color.opacity(0.85)).frame(height: 1)
            Text(label).font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(color)
            Rectangle().fill(color.opacity(0.85)).frame(height: 1)
        }
        .accessibilityLabel(label)
        .padding(.vertical, 2)
    }

    private func load() async {
        guard let token = auth.token, let user = auth.user else { return }
        loading = true
        do {
            let membership: LeagueMembership
            if let leagueOverride {
                membership = leagueOverride
            } else {
                membership = try await SupabaseAPI.activeLeague(token: token, userId: user.id, preferredLeagueId: auth.selectedLeagueId)
            }
            sportId = membership.leagues.sportId.lowercased()
            activeConference = "OVERALL"
            try? await SupabaseAPI.touchLastSeen(token: token, userId: user.id)
            async let loadedStandings = SupabaseAPI.standings(token: token, leagueId: membership.leagueId)
            async let loadedTrophies = SupabaseAPI.leagueTrophies(token: token, leagueId: membership.leagueId)
            async let loadedPostseasonScores: [CfbPostseasonScore] = membership.leagues.sportId.lowercased() == "cfb" && membership.leagues.currentWeek >= membership.leagues.regularSeasonWeeks + 2
                ? SupabaseAPI.cfbPostseasonScoreboard(token: token, leagueId: membership.leagueId, seasonKey: Calendar.current.component(.year, from: Date()))
                : []
            standings = try await loadedStandings
            let trophies = (try? await loadedTrophies) ?? []
            let postseasonScores = (try? await loadedPostseasonScores) ?? []
            postseasonScoreByUser = Dictionary(uniqueKeysWithValues: postseasonScores.map { ($0.userId, $0) })
            latestTrophyByUser = resolvedTrophyMap(live: trophies, standings: standings)
            var ranks: [UUID: CareerRankProgress] = [:]
            var cheevoPointsByUser: [UUID: Int] = [:]
            await withTaskGroup(of: (UUID, [ProfileAchievement]).self) { group in
                for player in standings {
                    group.addTask { (player.userId, (try? await SupabaseAPI.profileAchievements(token: token, userId: player.userId)) ?? []) }
                }
                for await (userId, achievements) in group {
                    let creatorPoints = AppIdentity.isCreator(userId) && !achievements.contains(where: { $0.code == "the_commissioner" || $0.code == "the_creator" }) ? PromotionPoints.points(for: "the_creator") : 0
                    let player = standings.first { $0.userId == userId }
                    let cheevoPoints = PromotionPoints.total(for: achievements) + creatorPoints
                    cheevoPointsByUser[userId] = cheevoPoints
                    ranks[userId] = CareerRanks.resolve(points: cheevoPoints, seasons: (player?.weeksPlayed ?? 0) / 10, sports: 1, minimumRankId: LegacyCareerRecords.minimumRankFloor(for: userId, liveFloor: player?.profiles?.careerRankFloor))
                }
            }
            standings.sort { left, right in
                let leftTotal = left.totalPoints + postseasonScoreByUser[left.userId, default: CfbPostseasonScore(userId: left.userId, bowlScore: nil, cfpScore: nil, postseasonTotal: 0)].postseasonTotal
                let rightTotal = right.totalPoints + postseasonScoreByUser[right.userId, default: CfbPostseasonScore(userId: right.userId, bowlScore: nil, cfpScore: nil, postseasonTotal: 0)].postseasonTotal
                if leftTotal != rightTotal { return leftTotal > rightTotal }
                let leftCheevoPoints = cheevoPointsByUser[left.userId, default: 0]
                let rightCheevoPoints = cheevoPointsByUser[right.userId, default: 0]
                if leftCheevoPoints != rightCheevoPoints { return leftCheevoPoints > rightCheevoPoints }
                let nameOrder = left.name.localizedCaseInsensitiveCompare(right.name)
                if nameOrder != .orderedSame { return nameOrder == .orderedAscending }
                return left.userId.uuidString < right.userId.uuidString
            }
            careerRankByUser = ranks
            errorMessage = nil
        }
        catch { errorMessage = error.localizedDescription }
        loading = false
    }
}

private struct StandingRankCard: View {
    let rank: Int
    let standing: Standing
    let sportId: String
    let trophy: ProfileTrophy?
    let careerRank: CareerRankProgress
    let postseasonScore: CfbPostseasonScore?
    let onOpenProfile: () -> Void
    let onOpenTrophy: () -> Void
    private var identity: SportIdentity { SportIdentity(sportId) }

    private var medal: Color {
        switch rank { case 1: return identity.isNFL ? .cyan : .yellow; case 2: return Color(white: 0.78); case 3: return identity.isNFL ? .red : .orange; default: return identity.isNFL ? .blue : .green }
    }

    private var displayName: String {
        guard let title = ProfileCosmetics.titleName(for: standing.profiles?.equippedTitleId) else { return standing.name }
        return "\(SportIdentity(sportId).cheevoTitle(code: standing.profiles?.equippedTitleId ?? "", fallback: title)) \(standing.name)"
    }

    private var displayedRank: CareerRank {
        guard
            let selectedId = standing.profiles?.equippedRankId,
            let selectedIndex = CareerRanks.all.firstIndex(where: { $0.id == selectedId }),
            let currentIndex = CareerRanks.all.firstIndex(where: { $0.id == careerRank.current.id }),
            selectedIndex <= currentIndex
        else { return careerRank.current }
        return CareerRanks.all[selectedIndex]
    }

    var body: some View {
        HStack(alignment: .top, spacing: 11) {
            ZStack {
                if rank <= 3 {
                    Circle().fill(medal.opacity(0.14))
                    Circle().stroke(medal.opacity(0.75), lineWidth: 1.5)
                }
                Text("\(rank)").font(rank == 1 ? .title.weight(.black) : .headline.weight(.black)).monospacedDigit().foregroundStyle(medal)
            }.frame(width: 37, height: rank == 1 ? 54 : 48)
            VStack(alignment: .leading, spacing: 9) {
                HStack(alignment: .center, spacing: 10) {
                    ProfileAvatar(
                        urlString: standing.profiles?.avatarURL,
                        name: standing.name,
                        size: rank == 1 ? 58 : 50,
                        borderId: standing.profiles?.equippedBorderId,
                        accent: identity.isNFL ? .cyan : .green
                    )
                    VStack(alignment: .leading, spacing: 3) {
                        if rank == 1 { Text(identity.isNFL ? "SUNDAY POWER INDEX · #1" : "CURRENTLY IMMORTAL").font(.system(size: 8, weight: .black)).tracking(1.3).foregroundStyle(identity.isNFL ? .cyan : .yellow) }
                        Text(displayName)
                            .font(rank == 1 ? .title3.weight(.black) : .headline.weight(.black))
                            .lineLimit(2).minimumScaleFactor(0.82)
                        HStack(spacing: 5) {
                            Circle().fill(isRecentlySeen ? (identity.isNFL ? Color.cyan : Color.green) : Color.white.opacity(0.28)).frame(width: 6, height: 6)
                            Text("\(standing.weeksPlayed) WKS · \(lastSeenLabel)")
                                .font(.system(size: 8, weight: .black)).tracking(0.7)
                                .foregroundStyle(isRecentlySeen ? (identity.isNFL ? .cyan : .green) : .secondary)
                        }
                    }
                    Spacer(minLength: 3)
                    if let trophy, let artifact = trophyArtifactName(for: trophy) {
                        Button(action: onOpenTrophy) {
                            ZStack(alignment: .bottomTrailing) {
                                Image(artifact).resizable().scaledToFill()
                                    .frame(width: rank == 1 ? 52 : 46, height: rank == 1 ? 52 : 46)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                    .overlay(RoundedRectangle(cornerRadius: 10).stroke((identity.isNFL ? Color.cyan : Color.yellow).opacity(0.78), lineWidth: 1.5))
                                    .shadow(color: (identity.isNFL ? Color.blue : Color.yellow).opacity(0.32), radius: 7)
                                Text(String(trophy.seasonYear).suffix(2))
                                    .font(.system(size: 7, weight: .black)).foregroundStyle(.black)
                                    .padding(.horizontal, 4).padding(.vertical, 2)
                                    .background(identity.isNFL ? Color.cyan : Color.yellow, in: Capsule())
                                    .offset(x: 4, y: 4)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(String(trophy.seasonYear)) \(trophy.trophyType.replacingOccurrences(of: "_", with: " ")) trophy")
                        .accessibilityHint("Opens the trophy in the Hardware Vault")
                    }
                    VStack(alignment: .trailing, spacing: 1) {
                        Text("\(standing.totalPoints + (postseasonScore?.postseasonTotal ?? 0))").font(rank == 1 ? .system(size: 30, weight: .black) : .title2.weight(.black)).monospacedDigit().foregroundStyle(medal)
                        Text("PTS").font(.system(size: 8, weight: .black)).tracking(1.4).foregroundStyle(.secondary)
                    }
                }
                HStack(spacing: 7) {
                    RankInsigniaView(rank: displayedRank, size: 29)
                    Text(displayedRank.abbreviation)
                        .font(.system(size: 9, weight: .black)).tracking(0.8).foregroundStyle(identity.isNFL ? .cyan : .yellow)
                    Text(conferenceLabel)
                        .font(.system(size: 8, weight: .black)).tracking(0.8)
                        .foregroundStyle(conferenceColor)
                        .padding(.horizontal, 6).padding(.vertical, 3)
                        .background(conferenceColor.opacity(0.14), in: Capsule())
                        .overlay(Capsule().stroke(conferenceColor.opacity(0.55), lineWidth: 0.75))
                    Spacer()
                    Text("VIEW DOSSIER  ›")
                        .font(.system(size: 7, weight: .black)).tracking(0.9).foregroundStyle(.white.opacity(0.36))
                }
                if let postseasonScore {
                    HStack(spacing: 7) {
                        scoreChip("REG", standing.totalPoints, color: .white)
                        scoreChip("BOWL", postseasonScore.bowlScore, color: .orange)
                        scoreChip("CFP", postseasonScore.cfpScore, color: .cyan)
                        Spacer()
                        Text(postseasonScore.bowlScore == nil || postseasonScore.cfpScore == nil ? "POSTSEASON LIVE" : "+\(postseasonScore.postseasonTotal) POSTSEASON")
                            .font(.system(size: 7, weight: .black)).tracking(0.8)
                            .foregroundStyle(postseasonScore.bowlScore == nil || postseasonScore.cfpScore == nil ? .yellow : .green)
                    }
                }
            }
        }
        .padding(rank == 1 ? 18 : 14)
        .background(LinearGradient(colors: [.black.opacity(rank == 1 ? 0.72 : 0.78), medal.opacity(rank == 1 ? 0.18 : 0.07)], startPoint: .leading, endPoint: .trailing), in: UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: rank == 1 ? 23 : 16, bottomTrailingRadius: 3, topTrailingRadius: rank == 1 ? 23 : 16))
        .overlay(alignment: .leading) { Rectangle().fill(medal).frame(width: rank <= 3 ? 4 : 2).padding(.vertical, 10) }
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: rank == 1 ? 23 : 16, bottomTrailingRadius: 3, topTrailingRadius: rank == 1 ? 23 : 16).stroke(medal.opacity(rank <= 3 ? 0.52 : 0.20)))
        .shadow(color: rank == 1 ? (identity.isNFL ? Color.blue : Color.yellow).opacity(0.18) : .clear, radius: 18)
        .contentShape(Rectangle())
        .onTapGesture(perform: onOpenProfile)
    }

    private func scoreChip(_ label: String, _ score: Int?, color: Color) -> some View {
        Text("\(label) \(score.map(String.init) ?? "—")")
            .font(.system(size: 7, weight: .black)).tracking(0.6)
            .foregroundStyle(color.opacity(0.86))
            .padding(.horizontal, 6).padding(.vertical, 4)
            .background(color.opacity(0.10), in: Capsule())
            .overlay(Capsule().stroke(color.opacity(0.28), lineWidth: 0.7))
    }

    private var lastSeenDate: Date? {
        guard let value = standing.profiles?.lastSeenAt else { return nil }
        return ISO8601DateFormatter().date(from: value)
    }

    private var conferenceLabel: String {
        SportIdentity(sportId).divisionLabel(standing.division)
    }

    private var conferenceColor: Color {
        if identity.isNFL { return standing.division?.lowercased().contains("south") == true ? .red : .cyan }
        switch standing.division?.lowercased() {
        case "south": return .blue
        case "east": return .orange
        case "west": return .purple
        default: return .yellow
        }
    }

    private var isRecentlySeen: Bool {
        guard let date = lastSeenDate else { return false }
        return Date().timeIntervalSince(date) < 15 * 60
    }

    private var lastSeenLabel: String {
        guard let date = lastSeenDate else { return "NEVER" }
        let seconds = max(0, Int(Date().timeIntervalSince(date)))
        if seconds < 60 { return "NOW" }
        if seconds < 3600 { return "\(seconds / 60)M AGO" }
        if seconds < 86_400 { return "\(seconds / 3600)H AGO" }
        if seconds < 604_800 { return "\(seconds / 86_400)D AGO" }
        return date.formatted(.dateTime.month(.abbreviated).day()).uppercased()
    }
}

private struct PublicPlayerProfileView: View {
    @EnvironmentObject private var auth: AuthStore
    let standing: Standing
    let sportId: String
    var leagueStandingsOverride: [Standing]? = nil
    @State private var achievements: [ProfileAchievement] = []
    @State private var trophies: [ProfileTrophy] = []
    @State private var favoriteTeam: FavoriteTeam?
    @State private var leagueStandings: [Standing] = []
    @State private var selectedAchievement: ProfileAchievement?
    @State private var selectedTrophy: ProfileTrophy?
    @State private var loading = true
    private var identity: SportIdentity { SportIdentity(sportId) }

    var body: some View {
        ZStack {
            if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) }
            else { ProfileShrineBackdrop() }
            ScrollView {
                VStack(spacing: 15) {
                    VStack(spacing: 10) {
                        Text(identity.isNFL ? "VISITING PRO PERSONNEL FILE" : "VISITING PLAYER FILE").font(.caption2.weight(.black)).tracking(2.4).foregroundStyle(identity.isNFL ? .cyan : .yellow)
                        ProfileAvatar(urlString: standing.profiles?.avatarURL, name: standing.name, size: 110, borderId: standing.profiles?.equippedBorderId, accent: identity.isNFL ? .cyan : .green)
                        ProfileRankPlacard(progress: profileRankProgress, isOwner: auth.user?.id == standing.userId, sportId: sportId)
                        Text(standing.name).font(.system(size: 32, weight: .black)).fontWidth(.condensed)
                        Text("\(conferenceLabel) · PUBLIC RECORD")
                            .font(.system(size: 9, weight: .black)).tracking(1.4).foregroundStyle(identity.isNFL ? .red : .green)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 22)
                    .background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 20))
                    .overlay(alignment: .top) { if identity.isNFL { HStack(spacing: 0) { Color.blue; Color.white; Color.red }.frame(height: 3) } }
                    .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 20).stroke((identity.isNFL ? Color.cyan : Color.yellow).opacity(0.42)))

                    FavoriteTeamShrine(team: favoriteTeam)
                    ProfileArsenalView(userId: standing.userId, sportId: sportId)
                    CampaignDogTagsView(userId: standing.userId)
                    ProfilePassportView(userId: standing.userId, isOwner: auth.user?.id == standing.userId)
                    HStack(spacing: 10) {
                        publicStat("\(standing.totalPoints)", "CAREER PTS")
                        publicStat("\(standing.weeksPlayed)", "WEEKS")
                        publicStat("\(standing.weeklyPoints.last ?? 0)", "LAST WEEK")
                    }
                    sectionLabel("CAREER INTEL", detail: "PUBLIC NUMBERS. PRIVATE EXCUSES.")
                    CareerIntelGrid(
                        atsCorrect: standing.atsCorrect, atsTotal: standing.atsTotal,
                        streak: standing.currentStreak, bestWeek: standing.bestWeek,
                        perfectWeeks: standing.perfectWeeks,
                        bestBetHits: standing.bestBetHits, bestBetTotal: standing.bestBetTotal,
                        propHits: standing.propHits, propTotal: standing.propTotal,
                        sportId: sportId
                    )
                    ProfileRivalryCard(player: standing, standings: leagueStandings, sportId: sportId)

                    sectionLabel("EARNED CHEEVOS", detail: "NO LOCKED SHELLS. ONLY RECEIPTS.")
                    if loading {
                        ProgressView("Opening the evidence locker…").tint(identity.isNFL ? .cyan : .green).padding(26)
                    } else if displayAchievements.isEmpty {
                        Text("No cheevos on file. Their publicist has declined to comment.")
                            .font(.subheadline.weight(.bold)).foregroundStyle(.white.opacity(0.64))
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
                    } else {
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                            ForEach(displayAchievements) { achievement in
                                Button { selectedAchievement = achievement } label: { AchievementArtifactTile(achievement: achievement, sportId: sportId) }
                                    .buttonStyle(.plain)
                            }
                        }
                    }

                    sectionLabel("CAREER HARDWARE", detail: "THE ROOM CANNOT DELETE HISTORY")
                    if !loading && displayTrophies.isEmpty {
                        Text("The trophy engraver checked the spelling twice. Still nothing.")
                            .font(.subheadline.weight(.bold)).foregroundStyle(.white.opacity(0.64))
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
                    } else {
                        ForEach(displayTrophies) { trophy in
                            Button { selectedTrophy = trophy } label: {
                                HStack(spacing: 13) {
                                    Image(systemName: trophy.trophyType == "toilet_bowl" ? "toilet.fill" : "trophy.fill").font(.title2.weight(.black)).foregroundStyle(.yellow).frame(width: 42)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(trophyTitle(trophy.trophyType)).font(.headline.weight(.black))
                                        Text(trophy.subtitle ?? "\(String(trophy.seasonYear)) · Permanent record").font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer(); Text(verbatim: String(trophy.seasonYear)).font(.headline.weight(.black)).foregroundStyle(.yellow)
                                }
                                .padding(14).background(.black.opacity(0.84), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.yellow.opacity(0.24)))
                            }.buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 36)
            }
        }
        .navigationTitle(standing.name)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $selectedAchievement) { achievement in
            AchievementEvidenceView(achievement: achievement, visual: achievementVisual(for: achievement.code), sportId: sportId)
                .presentationDetents([.large]).presentationDragIndicator(.hidden)
        }
        .sheet(item: $selectedTrophy) { trophy in
            TrophyEvidenceView(trophy: trophy, title: trophyTitle(trophy.trophyType))
                .presentationDetents([.large]).presentationDragIndicator(.hidden)
        }
        .task { await load() }
    }

    private var conferenceLabel: String {
        SportIdentity(sportId).divisionLabel(standing.division)
    }
    private var profileRankProgress: CareerRankProgress {
        let creatorPoints = AppIdentity.isCreator(standing.userId) && !displayAchievements.contains(where: { $0.code == "the_commissioner" || $0.code == "the_creator" }) ? 250 : 0
        return CareerRanks.resolve(points: PromotionPoints.total(for: displayAchievements) + creatorPoints, seasons: standing.weeksPlayed / 10, sports: 1, minimumRankId: standing.profiles?.careerRankFloor)
    }
    private var displayAchievements: [ProfileAchievement] {
        var rows = achievements
        let fallbackLeague = standing.id
        if AppIdentity.isCreator(standing.userId), !rows.contains(where: { $0.code == "the_creator" || $0.code == "the_commissioner" }) {
            rows.insert(ProfileAchievement(leagueId: fallbackLeague, code: "the_creator", title: "The Creator", flavor: "Built the War Room, then voluntarily entered it.", earnedAt: ""), at: 0)
        }
        if let titleId = standing.profiles?.equippedTitleId, !rows.contains(where: { $0.code == titleId }) {
            let title = titleId == "neighborhood_creeper" ? "Neighborhood Creeper" : titleId.replacingOccurrences(of: "_", with: " ").capitalized
            let flavor = titleId == "neighborhood_creeper" ? "Opened Deep stats & legacy math. Curtains twitched. Spreadsheet energy prevailed." : "Equipped on the website and carried into the native War Room."
            rows.append(ProfileAchievement(leagueId: fallbackLeague, code: titleId, title: title, flavor: flavor, earnedAt: ""))
        }
        return rows
    }
    private var displayTrophies: [ProfileTrophy] {
        var rows = trophies
        if standing.userId.uuidString.lowercased() == "09544d2b-6eca-4131-a321-c000586c9029", !rows.contains(where: { $0.trophyType == "nfc_championship" && $0.seasonYear == 2026 }) {
            rows.append(ProfileTrophy(id: UUID(uuidString: "00000000-0000-0000-0000-000000002026")!, leagueId: standing.id, seasonYear: 2026, trophyType: "nfc_championship", winnerName: standing.name, winnerUserId: standing.userId, subtitle: "NFC Champion · 2026", notes: "Conference hardware. Permanent career history.", awardedAt: "", trophyDesignId: "nfl_gridiron_crown"))
        }
        return rows
    }
    private func publicStat(_ value: String, _ label: String) -> some View {
        let accent: Color = identity.isNFL ? .cyan : .green
        return VStack(spacing: 3) { Text(value).font(.title2.weight(.black)).monospacedDigit(); Text(label).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(accent) }
            .frame(maxWidth: .infinity).padding(.vertical, 14).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 14)).overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 14).stroke(accent.opacity(0.25)))
    }
    private func sectionLabel(_ title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 2) { Text(title).font(.caption2.weight(.black)).tracking(1.7).foregroundStyle(identity.isNFL ? .cyan : .yellow); Text(detail).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.38)) }.frame(maxWidth: .infinity, alignment: .leading).padding(.top, 4)
    }
    private func trophyTitle(_ type: String) -> String {
        switch type { case "championship": return "LEAGUE CHAMPION"; case "toilet_bowl": return "TOILET BOWL"; case "crystal_ball": return "VILLAGE NERD"; case "nfc_championship": return "NFC CHAMPIONSHIP"; default: return type.replacingOccurrences(of: "_", with: " ").uppercased() }
    }
    private func load() async {
        guard let token = auth.token else { return }
        let viewer = auth.user
        let preferredLeagueId = auth.selectedLeagueId
        async let loadedAchievements = SupabaseAPI.profileAchievements(token: token, userId: standing.userId)
        async let loadedTrophies = SupabaseAPI.profileTrophies(token: token, userId: standing.userId)
        async let loadedFavoriteTeam = SupabaseAPI.favoriteTeam(token: token, userId: standing.userId, sportId: sportId)
        async let loadedStandings: [Standing] = {
            if let leagueStandingsOverride { return leagueStandingsOverride }
            guard let viewer,
                  let active = try? await SupabaseAPI.activeLeague(token: token, userId: viewer.id, preferredLeagueId: preferredLeagueId)
            else { return [] }
            return (try? await SupabaseAPI.standings(token: token, leagueId: active.leagueId)) ?? []
        }()
        achievements = (try? await loadedAchievements) ?? []
        trophies = (try? await loadedTrophies) ?? []
        favoriteTeam = try? await loadedFavoriteTeam
        leagueStandings = await loadedStandings
        loading = false
    }
}

private struct PlayerProfileRouteView: View {
    @EnvironmentObject private var auth: AuthStore
    let userId: UUID
    let fallbackName: String
    @State private var standing: Standing?
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var sportId: String

    init(userId: UUID, fallbackName: String, sportId: String = "cfb") {
        self.userId = userId
        self.fallbackName = fallbackName
        _sportId = State(initialValue: sportId.lowercased())
    }

    var body: some View {
        Group {
            if let standing { PublicPlayerProfileView(standing: standing, sportId: sportId) }
            else if loading { ProgressView("Opening \(fallbackName)’s file…").tint(SportIdentity(sportId).isNFL ? .cyan : .green) }
            else { ContentUnavailableView("Profile unavailable", systemImage: "person.crop.circle.badge.questionmark", description: Text(errorMessage ?? "That player slipped out through a service tunnel.")) }
        }
        .task { await load() }
    }

    private func load() async {
        guard let token = auth.token, let me = auth.user else { return }
        do {
            let active = try await SupabaseAPI.activeLeague(token: token, userId: me.id, preferredLeagueId: auth.selectedLeagueId)
            sportId = active.leagues.sportId.lowercased()
            let standings = try await SupabaseAPI.standings(token: token, leagueId: active.leagueId)
            standing = standings.first { $0.userId == userId }
            if standing == nil { errorMessage = "No active-league record found for \(fallbackName)." }
        } catch { errorMessage = error.localizedDescription }
        loading = false
    }
}

struct HomeView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.openURL) private var openURL
    let leagueOverride: LeagueMembership?
    let onOpenPicks: () -> Void
    let onOpenStandings: () -> Void
    let onOpenLocker: () -> Void
    @State private var membership: LeagueMembership?
    @State private var memberships: [LeagueMembership] = []
    @State private var card: WeekCard?
    @State private var pick: PlayerPick?
    @State private var crystalBallPick: CrystalBallPick?
    @State private var standings: [Standing] = []
    @State private var announcements: [Announcement] = []
    @State private var lockerMessages: [LockerMessage] = []
    @State private var submittedUserIds: Set<UUID> = []
    @State private var sportPoolPoll: SportPoolPoll?
    @State private var latestScorecard: PostseasonScorecard?
    @State private var pendingJoinRequests: [LobbyJoinRequest] = []
    @State private var loading = true
    @State private var loadError: String?
    @State private var clock = Date()
    @State private var showingFeedbackFallback = false

    init(leagueOverride: LeagueMembership? = nil, onOpenPicks: @escaping () -> Void, onOpenStandings: @escaping () -> Void, onOpenLocker: @escaping () -> Void) {
        self.leagueOverride = leagueOverride
        self.onOpenPicks = onOpenPicks
        self.onOpenStandings = onOpenStandings
        self.onOpenLocker = onOpenLocker
    }

    var body: some View {
        ZStack {
            if let membership, membership.leagues.sportId.lowercased() == "cfb", membership.leagues.currentWeek == 13 {
                CfbRivalryWeekBackdrop()
            } else if let membership, membership.leagues.sportId.lowercased() == "nfl" {
                NflHomeBackdrop(phase: NflSeasonPhase.phase(week: membership.leagues.currentWeek))
            } else if let membership {
                CfbHomePhaseBackdrop(phase: CfbSeasonPhase.phase(week: membership.leagues.currentWeek, regularSeasonWeeks: membership.leagues.regularSeasonWeeks))
            } else {
                LinearGradient(colors: [.black, Color.red.opacity(0.08), .black], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if loading {
                        if leagueOverride?.leagues.sportId.lowercased() == "nfl" {
                            NflBroadcastHeader(leagueName: "OPENING SUNDAY COMMAND", week: leagueOverride?.leagues.currentWeek ?? 1, dateRange: nil, commissioner: false)
                            ProgressView("Opening the broadcast…").tint(.cyan)
                        } else {
                            VStack(alignment: .leading, spacing: 7) {
                                Text("SECURE CHANNEL").font(.caption2.weight(.black)).tracking(2).foregroundStyle(.red)
                                Text("OPENING WAR ROOM").font(.system(size: 31, weight: .black)).fontWidth(.condensed)
                            }.frame(maxWidth: .infinity, alignment: .leading).padding(18).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 8)).overlay(RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.16)))
                            ProgressView("Opening the room…").tint(.white)
                        }
                    }
                    else if let membership {
                        let isNFL = membership.leagues.sportId.lowercased() == "nfl"
                        let isCommissioner = auth.user.map { membership.isCommissioner(userId: $0.id) } ?? false
                        let isRivalryWeek = membership.leagues.sportId.lowercased() == "cfb" && membership.leagues.currentWeek == 13
                        let needsCrystalBall = membership.leagues.crystalBallEnabled && crystalBallPick == nil
                        let ownSubmittedUserIds: Set<UUID> = pick != nil ? Set(auth.user.map { [$0.id] } ?? []) : []
                        let visibleSubmittedUserIds = submittedUserIds.union(ownSubmittedUserIds)
                        let visibleSubmissionCount = visibleSubmittedUserIds.count
                        let firstKickoff = card?.cardGames.compactMap { footballKickoffDate($0.startTime) }.min()
                        let kickoffStarted = firstKickoff.map { clock >= $0 } ?? false
                        if isCommissioner, !pendingJoinRequests.isEmpty {
                            NavigationLink { LeagueManagementView(membership: membership) } label: {
                                HStack(spacing: 11) {
                                    ZStack(alignment: .topTrailing) {
                                        Image(systemName: "bell.badge.fill")
                                            .font(.title2.weight(.black))
                                            .foregroundStyle(.white)
                                        Text("\(pendingJoinRequests.count)")
                                            .font(.system(size: 9, weight: .black, design: .rounded))
                                            .foregroundStyle(.white)
                                            .frame(minWidth: 18, minHeight: 18)
                                            .background(.red, in: Circle())
                                            .overlay(Circle().stroke(.white, lineWidth: 1.5))
                                            .offset(x: 10, y: -9)
                                    }
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("UNREAD · COMMISSIONER INBOX")
                                            .font(.system(size: 9, weight: .black)).tracking(1.25)
                                            .foregroundStyle(.red)
                                        Text("\(pendingJoinRequests.count) join request\(pendingJoinRequests.count == 1 ? "" : "s") waiting")
                                            .font(.subheadline.weight(.black)).foregroundStyle(.white)
                                    }
                                    Spacer()
                                    Text("OPEN MANAGE LEAGUE")
                                        .font(.system(size: 8, weight: .black)).tracking(0.8)
                                        .foregroundStyle(.white.opacity(0.72))
                                    Image(systemName: "chevron.right")
                                        .font(.caption.weight(.black)).foregroundStyle(.white)
                                }
                                .padding(.horizontal, 16).padding(.vertical, 14)
                                .background(Color.red.opacity(0.24), in: RoundedRectangle(cornerRadius: isNFL ? 7 : 16))
                                .overlay(RoundedRectangle(cornerRadius: isNFL ? 7 : 16).stroke(.red, lineWidth: 2))
                                .shadow(color: .red.opacity(0.55), radius: 14)
                            }
                            .buttonStyle(WarRoomCardButtonStyle())
                            .accessibilityLabel("\(pendingJoinRequests.count) unread league join request\(pendingJoinRequests.count == 1 ? "" : "s"). Open Manage League.")
                        }
                        if isNFL {
                            NflBroadcastHeader(
                                leagueName: membership.leagues.name,
                                week: membership.leagues.currentWeek,
                                dateRange: footballWeekDateRangeLabel(sportId: membership.leagues.sportId, week: membership.leagues.currentWeek),
                                commissioner: isCommissioner
                            )
                        } else {
                            HomeCommandHeader(
                                name: membership.leagues.name,
                                sport: membership.leagues.sportId.uppercased(),
                                week: membership.leagues.currentWeek,
                                dateRange: footballWeekDateRangeLabel(sportId: membership.leagues.sportId, week: membership.leagues.currentWeek),
                                commissioner: isCommissioner
                            )
                        }
                        ShareLink(
                            item: LeagueInvitation.appStoreURL,
                            subject: Text("Join \(membership.leagues.name) on War Room Pick’Em"),
                            message: Text(LeagueInvitation.message(
                                leagueName: membership.leagues.name,
                                sportId: membership.leagues.sportId,
                                code: membership.leagues.code
                            ))
                        ) {
                            HStack(spacing: 10) {
                                Image(systemName: "square.and.arrow.up.fill")
                                    .font(.headline.weight(.black))
                                Text("SHARE")
                                    .font(.caption.weight(.black))
                                    .tracking(1.2)
                                Spacer()
                                Text("INVITE CODE \(membership.leagues.code.uppercased())")
                                    .font(.system(size: 8, weight: .black))
                                    .tracking(0.7)
                            }
                            .foregroundStyle(isNFL ? Color.white : Color.black)
                            .padding(.horizontal, 15)
                            .padding(.vertical, 12)
                            .background(isNFL ? Color.blue.opacity(0.92) : Color.green, in: RoundedRectangle(cornerRadius: isNFL ? 7 : 14))
                            .overlay(RoundedRectangle(cornerRadius: isNFL ? 7 : 14).stroke(.white.opacity(isNFL ? 0.42 : 0.18)))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Share \(membership.leagues.name) invitation")
                        if isCommissioner {
                            NavigationLink { CommissionerCommandCenterView(membership: membership, standings: standings, submittedUserIds: visibleSubmittedUserIds) } label: {
                                if isNFL {
                                    NflPrimaryActionCard(
                                        kicker: "COMMISSIONER CONTROL · LEAGUE OPERATIONS",
                                        title: "Commissioner Command",
                                        detail: pendingJoinRequests.isEmpty ? "Cards, scores, roster, AFC/NFC groups, and season control." : "\(pendingJoinRequests.count) join request\(pendingJoinRequests.count == 1 ? "" : "s") waiting · cards · scores · roster · season control.",
                                        icon: "person.3.sequence.fill"
                                    )
                                } else {
                                    StatusCard(
                                        kicker: "COMMISSIONER CONTROL · LEAGUE OPERATIONS",
                                        title: "Commissioner Command",
                                        detail: pendingJoinRequests.isEmpty ? "Cards, scores, roster, conferences, and season control from one place." : "\(pendingJoinRequests.count) join request\(pendingJoinRequests.count == 1 ? "" : "s") waiting · cards · scores · roster · conferences.",
                                        icon: "person.3.sequence.fill",
                                        featured: true,
                                        accent: .cyan,
                                        actionLabel: "OPEN COMMAND"
                                    )
                                }
                            }.buttonStyle(WarRoomCardButtonStyle())
                            if !pendingJoinRequests.isEmpty {
                                NavigationLink { JoinRequestsView(membership: membership) } label: {
                                    if isNFL {
                                        NflPrimaryActionCard(
                                            kicker: "FRONT DOOR · ACTION REQUIRED",
                                            title: "\(pendingJoinRequests.count) Join Request\(pendingJoinRequests.count == 1 ? "" : "s")",
                                            detail: "Approve or deny each player. A denial reason is optional.",
                                            icon: "person.crop.circle.badge.questionmark",
                                            urgent: true
                                        )
                                    } else {
                                        StatusCard(
                                            kicker: "🚨 FRONT DOOR · ACTION REQUIRED",
                                            title: "\(pendingJoinRequests.count) Join Request\(pendingJoinRequests.count == 1 ? "" : "s")",
                                            detail: "Approve or deny each player. A denial reason is optional.",
                                            icon: "person.crop.circle.badge.questionmark",
                                            featured: true,
                                            accent: .orange,
                                            actionLabel: "REVIEW REQUESTS"
                                        )
                                    }
                                }.buttonStyle(WarRoomCardButtonStyle())
                            }
                        }
                        if membership.leagues.sportId.lowercased() == "cfb" {
                            if isRivalryWeek {
                                CfbRivalryWeekBanner()
                            } else {
                                CfbPhaseHomeBanner(phase: CfbSeasonPhase.phase(week: membership.leagues.currentWeek, regularSeasonWeeks: membership.leagues.regularSeasonWeeks))
                            }
                        } else if isNFL {
                            NflPhaseHomeBanner(phase: NflSeasonPhase.phase(week: membership.leagues.currentWeek))
                        }
                        if let scorecard = latestScorecard {
                            NavigationLink { PostseasonScorecardView(scorecard: scorecard, sportId: membership.leagues.sportId) } label: {
                                StatusCard(
                                    kicker: "WEEK \(scorecard.weekNumber) RESULTS · CERTIFIED RECEIPT",
                                    title: membership.leagues.mode == "foundry" ? "Open the winning scorecard" : "Open your scorecard",
                                    detail: scorecard.phase == "regular_season"
                                        ? "\(scorecard.weeklyTotal) points. Every pick, confidence value, Best Bet, prop, and multiplier is itemized."
                                        : isNFL
                                            ? "\(scorecard.weeklyTotal) points. Every Wild Card, Divisional, Conference, Super Bowl, and JDAM decision is itemized."
                                            : "\(scorecard.weeklyTotal) points. Every bowl allocation, Dead Hand adjustment, and bracket point is itemized.",
                                    icon: "list.clipboard.fill", featured: true, accent: isNFL ? .cyan : .yellow, actionLabel: "VIEW SCORECARD"
                                )
                            }.buttonStyle(WarRoomCardButtonStyle())
                        }
                        NavigationLink { LeagueCommandCenterView(memberships: memberships) } label: {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(isNFL ? "ACTIVE FRANCHISE · PRO FOOTBALL" : "ACTIVE FREQUENCY · \(membership.leagues.sportId.uppercased())")
                                        .font(.system(size: 8, weight: .black)).tracking(1.4).foregroundStyle(isNFL ? .cyan : .green)
                                    Text(membership.leagues.name).font(.headline.weight(.black)).foregroundStyle(.white)
                                    Text(isNFL ? "CHANGE FRANCHISE OR ENTER THE LOBBY" : "SWITCH LEAGUE OR SPORT").font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(isNFL ? .white.opacity(0.52) : .yellow)
                                }
                                Spacer()
                                Image(systemName: isNFL ? "football.fill" : "antenna.radiowaves.left.and.right")
                                    .font(.title2.weight(.black)).foregroundStyle(isNFL ? .white : .green)
                                Image(systemName: "chevron.right").font(.caption.weight(.black)).foregroundStyle(isNFL ? .red : .yellow)
                            }
                            .padding(15)
                            .background(isNFL ? Color.black.opacity(0.9) : Color.black.opacity(0.78), in: RoundedRectangle(cornerRadius: isNFL ? 8 : 18))
                            .overlay(alignment: .leading) { if isNFL { Rectangle().fill(.blue).frame(width: 4).padding(.vertical, 8) } }
                            .overlay(RoundedRectangle(cornerRadius: isNFL ? 8 : 18).stroke(isNFL ? .blue.opacity(0.55) : .green.opacity(0.45)))
                        }.buttonStyle(WarRoomCardButtonStyle())
                        if isNFL && needsCrystalBall {
                            NavigationLink { CrystalBallView(membership: membership) } label: {
                                NflPrimaryActionCard(kicker: "SEASON-LONG CALL · REQUIRED", title: "Name Your Champion", detail: "Make the call before the evidence arrives. The receipt follows you all season.", icon: "sparkles", urgent: true)
                            }.buttonStyle(WarRoomCardButtonStyle())
                        } else if isNFL && card == nil && isCommissioner {
                            NavigationLink { CommissionerCardBuilderView(membership: membership) } label: {
                                NflPrimaryActionCard(kicker: "COMMISSIONER CONTROL · WEEK \(membership.leagues.currentWeek)", title: "Set the Prime-Time Slate", detail: "Choose five games from the Thursday-to-Monday board, then set the prop.", icon: "rectangle.3.group.fill", urgent: true)
                            }.buttonStyle(WarRoomCardButtonStyle())
                        } else if isNFL && card == nil {
                            Button(action: onOpenLocker) {
                                NflPrimaryActionCard(kicker: "SLATE NOT POSTED", title: "The commissioner is on the clock", detail: "Hit the locker room while leadership discovers urgency.", icon: "clock.badge.exclamationmark", urgent: true)
                            }.buttonStyle(WarRoomCardButtonStyle())
                        } else if isNFL && kickoffStarted {
                            Button(action: onOpenPicks) {
                                NflPrimaryActionCard(kicker: "LIVE WINDOW · PICKS DECLASSIFY AT KICKOFF", title: "Open the Game Board", detail: "Follow every side, confidence play, and Best Bet as each game goes live.", icon: "play.rectangle.on.rectangle.fill")
                            }.buttonStyle(WarRoomCardButtonStyle())
                        } else if isNFL && pick == nil {
                            Button(action: onOpenPicks) {
                                NflPrimaryActionCard(kicker: "YOU ARE ON THE CLOCK · WEEK \(membership.leagues.currentWeek)", title: "Build Your Sunday Card", detail: "Five games. Confidence points. One Best Bet. No preseason excuses.", icon: "football.fill", urgent: true)
                            }.buttonStyle(WarRoomCardButtonStyle())
                        } else if isNFL && isCommissioner {
                            NavigationLink { CommissionerCommandCenterView(membership: membership, standings: standings, submittedUserIds: visibleSubmittedUserIds) } label: {
                                NflPrimaryActionCard(kicker: "COMMISSIONER GAME-DAY DESK", title: "\(visibleSubmissionCount) of \(standings.count) cards are in", detail: "Open attendance, chase the holdouts, and verify the room before kickoff.", icon: "person.2.badge.gearshape.fill")
                            }.buttonStyle(WarRoomCardButtonStyle())
                        } else if isNFL {
                            NflPrimaryActionCard(kicker: "CARD FILED · WEEK \(membership.leagues.currentWeek)", title: "You’re set for kickoff", detail: "Your card is saved. The board opens game by game.", icon: "checkmark.seal.fill")
                        } else if needsCrystalBall {
                            NavigationLink { CrystalBallView(membership: membership) } label: {
                                StatusCard(kicker: "🚨 REQUIRED · LOOK HERE FIRST", title: "PICK CRYSTAL BALL NOW", detail: "Choose the champion before you do anything else. Revisionist history is not a feature.", icon: "exclamationmark.triangle.fill", featured: true, accent: .red, emergency: true)
                            }.buttonStyle(WarRoomCardButtonStyle())
                        } else if card == nil && isCommissioner {
                            NavigationLink { CommissionerCardBuilderView(membership: membership) } label: {
                                StatusCard(kicker: isRivalryWeek ? "🚨 DO THIS NEXT · RIVALRY DESK" : "🚨 DO THIS NEXT · COMMISSIONER", title: isRivalryWeek ? "Build the Rivalry Card" : "Build This Week’s Card", detail: isRivalryWeek ? "Pick five grudge games. Family, geography, trophies, and good judgment are all suspended." : "Pick five games, add one prop, then give the room something to argue about.", icon: isRivalryWeek ? "bolt.horizontal.fill" : "hammer.fill", featured: true, accent: .red, emergency: true, actionLabel: "OPEN COMMAND")
                            }.buttonStyle(WarRoomCardButtonStyle())
                        } else if card == nil {
                            Button(action: onOpenLocker) {
                                StatusCard(kicker: "🚨 DO THIS NEXT · WAITING ON THE COMMISH", title: "Open the Locker Room", detail: "No card has been posted. The Locker Room is accepting public complaints.", icon: "bubble.left.fill", featured: true, accent: .red, emergency: true, actionLabel: "OPEN LOCKER ROOM")
                            }.buttonStyle(WarRoomCardButtonStyle())
                        } else if kickoffStarted {
                            Button(action: onOpenPicks) {
                                StatusCard(kicker: "KICKOFF HIT · THE BOARD IS LIVE", title: "Scout the competition", detail: "Each matchup declassifies at its own kickoff. See who backed whom—and how much confidence they put on it.", icon: "binoculars.fill", featured: true, accent: .orange, actionLabel: "OPEN BOARD")
                            }.buttonStyle(WarRoomCardButtonStyle())
                        } else if pick == nil {
                            Button(action: onOpenPicks) {
                                StatusCard(kicker: isRivalryWeek ? "🚨 DO THIS NEXT · HATE WEEK" : "🚨 DO THIS NEXT · WEEK \(membership.leagues.currentWeek)", title: isRivalryWeek ? "Choose Your Enemies" : "Make Your Picks", detail: isRivalryWeek ? "Five rivalry games. One Best Bet. Every bad decision becomes family evidence." : "Spreads, confidence, Best Bet, and the weekly prop are ready.", icon: isRivalryWeek ? "flame.fill" : "arrow.right.circle.fill", featured: true, accent: .red, emergency: true, actionLabel: "MAKE PICKS")
                            }.buttonStyle(WarRoomCardButtonStyle())
                        } else if isCommissioner {
                            NavigationLink {
                                CommissionerCommandCenterView(membership: membership, standings: standings, submittedUserIds: visibleSubmittedUserIds)
                            } label: {
                                StatusCard(kicker: "CARD IS LIVE · COMMISSIONER VIEW", title: "Week \(membership.leagues.currentWeek) is ready", detail: "\(visibleSubmissionCount) of \(standings.count) have submitted. Tap for the attendance sheet.", icon: "person.2.badge.gearshape.fill", featured: true, actionLabel: "OPEN COMMAND")
                            }.buttonStyle(WarRoomCardButtonStyle())
                        } else {
                            StatusCard(kicker: "YOU’RE CAUGHT UP", title: "Week \(membership.leagues.currentWeek) is locked", detail: "Your work here is done. Suspicious, but true.", icon: "checkmark.seal.fill", featured: true)
                        }

                        if sportPoolPoll != nil || isCommissioner {
                            NavigationLink { SportPoolView(membership: membership) } label: {
                                if isNFL {
                                    NflPrimaryActionCard(
                                        kicker: sportPoolPoll == nil ? "FRANCHISE EXPANSION · 7-DAY VOTE" : "EXPANSION VOTE · \(sportPoolPoll!.yesCount) IN",
                                        title: sportPoolPoll.map { "Open a \($0.targetSportId.uppercased()) room" } ?? "Recruit the roster for another sport",
                                        detail: sportPoolPoll.map { $0.status == "open" ? "The roster is voting. The window closes in seven days." : "The vote is closed. The willing are ready for a new room." } ?? "Let the roster decide, then move only the players who opt in.",
                                        icon: "person.3.sequence.fill"
                                    )
                                } else {
                                    StatusCard(
                                        kicker: sportPoolPoll == nil ? "COMMISSIONER · OPEN A 7-DAY VOTE" : "RUN IT BACK · \(sportPoolPoll!.yesCount) YES",
                                        title: sportPoolPoll.map { "\($0.targetSportId.uppercased()) wants the smoke" } ?? "Recruit this room for another sport",
                                        detail: sportPoolPoll.map { $0.status == "open" ? "Vote before the seven-day window slams shut." : "Voting is closed. The willing are ready for extraction." } ?? "Players choose. You see who said yes. One button moves the volunteers.",
                                        icon: "person.3.sequence.fill",
                                        accent: .orange
                                    )
                                }
                            }.buttonStyle(WarRoomCardButtonStyle())
                        }
                        if membership.leagues.crystalBallEnabled, let crystalBallPick {
                            NavigationLink { CrystalBallView(membership: membership) } label: {
                                if isNFL {
                                    NflPrimaryActionCard(kicker: "SUPER BOWL FUTURES · PICK SEALED", title: crystalBallPick.teamName, detail: "Your preseason call is on tape. Open the futures desk to inspect it.", icon: "sparkles")
                                } else {
                                    StatusCard(
                                        kicker: "SEALED PROPHECY · PERMANENT RECEIPT",
                                        title: crystalBallPick.teamName,
                                        detail: "The Crystal Ball remembers. Tap to inspect your prediction.",
                                        icon: "sparkles",
                                        accent: .green
                                    )
                                }
                            }.buttonStyle(WarRoomCardButtonStyle())
                        }
                        if AppIdentity.isCreator(auth.user?.id) && leagueOverride == nil {
                            NavigationLink { FoundryView(preferredSportId: membership.leagues.sportId) } label: {
                                let foundryColor: Color = membership.leagues.sportId.lowercased() == "nfl" ? .cyan : .orange
                                HStack(spacing: 13) {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 10).fill(foundryColor.opacity(0.14))
                                        RoundedRectangle(cornerRadius: 10).stroke(foundryColor.opacity(0.65))
                                        Image(systemName: membership.leagues.sportId.lowercased() == "nfl" ? "football.fill" : "flame.fill").font(.title2.weight(.black)).foregroundStyle(foundryColor)
                                    }.frame(width: 48, height: 48)
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("CREATOR ACCESS · QUARANTINED")
                                            .font(.system(size: 8, weight: .black)).tracking(1.3).foregroundStyle(foundryColor)
                                        Text(membership.leagues.sportId.lowercased() == "nfl" ? "SUNDAY FOUNDRY" : "THE FOUNDRY").font(.headline.weight(.black)).foregroundStyle(.white)
                                        Text("TEST THE ROOM WITHOUT TOUCHING REAL HISTORY")
                                            .font(.system(size: 8, weight: .black)).tracking(0.6).foregroundStyle(.white.opacity(0.42))
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right").font(.caption.weight(.black)).foregroundStyle(foundryColor)
                                }
                                .padding(14)
                                .background(.black.opacity(0.84), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 18, bottomTrailingRadius: 4, topTrailingRadius: 18))
                                .overlay(alignment: .leading) { Rectangle().fill(foundryColor).frame(width: 3).padding(.vertical, 10) }
                                .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 18, bottomTrailingRadius: 4, topTrailingRadius: 18).stroke(foundryColor.opacity(0.42)))
                            }.buttonStyle(WarRoomCardButtonStyle())
                        }

                        if let firstKickoff = card?.cardGames.compactMap({ footballKickoffDate($0.startTime) }).min() {
                            KickoffCountdownView(kickoff: firstKickoff, sportId: membership.leagues.sportId, week: membership.leagues.currentWeek)
                        }

                        if isNFL {
                            NflScoreboardStrip(
                                players: standings.count,
                                games: card?.cardGames.count ?? 0,
                                cardStatus: isCommissioner ? "\(visibleSubmissionCount)/\(standings.count)" : (pick == nil ? "OPEN" : "FILED"),
                                commissioner: isCommissioner
                            )
                        } else {
                            HStack(spacing: 8) {
                                HomeMetric(value: "\(standings.count)", label: "IN THE ROOM")
                                HomeMetric(value: card.map { "\($0.cardGames.count)" } ?? "—", label: "GAMES")
                                HomeMetric(value: isCommissioner ? "\(visibleSubmissionCount)/\(standings.count)" : (pick == nil ? "OPEN" : "SAVED"), label: isCommissioner ? "SUBMITTED" : "YOUR CARD")
                            }
                        }

                        if isNFL { NflBroadcastSectionLabel(title: "GAME-DAY DESK", detail: "STANDINGS · LOCKER ROOM · OFFICIAL FEED") }
                        else { HomeSectionLabel(title: "ROOM OPERATIONS", detail: "AUTHORIZED PERSONNEL & DEGENERATES") }
                        HStack(spacing: 12) {
                            Button(action: onOpenStandings) {
                                HomeOperationTile(kicker: isNFL ? "PLAYOFF RACE" : "INTEL", title: "Standings", detail: isNFL ? "Every game matters" : "Facts, unfortunately", icon: "chart.bar.fill", accent: isNFL ? .blue : .green)
                            }
                            .buttonStyle(WarRoomCardButtonStyle())
                            Button(action: onOpenLocker) {
                                HomeOperationTile(kicker: isNFL ? "SIDELINE" : "COMMS", title: "Locker Room", detail: isNFL ? "Talk through the whistle" : "Choose violence", icon: "bubble.left.and.bubble.right.fill", accent: isNFL ? .red : .green)
                            }
                            .buttonStyle(WarRoomCardButtonStyle())
                        }
                        NavigationLink { AnnouncementsView() } label: {
                            if isNFL {
                                NflPrimaryActionCard(kicker: announcements.filter(\.isUnread).isEmpty ? "LEAGUE OFFICE WIRE" : "\(announcements.filter(\.isUnread).count) NEW BULLETINS", title: "Official Announcements", detail: announcements.first?.title ?? "Commissioner posts, schedule notes, and room rulings.", icon: "megaphone.fill", urgent: !announcements.filter(\.isUnread).isEmpty)
                            } else {
                                StatusCard(kicker: announcements.filter(\.isUnread).isEmpty ? "OFFICIAL TRANSMISSION" : "\(announcements.filter(\.isUnread).count) UNREAD · EYES UP", title: "Announcements", detail: announcements.first?.title ?? "Commish posts, room updates, and official yelling.", icon: "megaphone.fill", accent: announcements.filter(\.isUnread).isEmpty ? .green : .yellow)
                            }
                        }.buttonStyle(WarRoomCardButtonStyle())
                        if isNFL { NflBroadcastSectionLabel(title: "POSTGAME SHOW", detail: "FINAL THIRTEEN · DISPATCH · LAST WORD") }
                        else { HomeSectionLabel(title: "FIELD REPORTS", detail: "PROPAGANDA, RUMORS, OCCASIONAL FACTS") }
                        let postseasonIsOpen = membership.leagues.sportId.lowercased() == "nfl"
                            ? membership.leagues.currentWeek >= 19
                            : membership.leagues.currentWeek > membership.leagues.regularSeasonWeeks
                        if postseasonIsOpen {
                            if membership.leagues.sportId.lowercased() == "nfl" {
                                NavigationLink { NflPostseasonCloudView(membership: membership) } label: {
                                    let phase = NflSeasonPhase.phase(week: membership.leagues.currentWeek)
                                    StatusCard(kicker: phase.kicker, title: "Open The Final Thirteen", detail: "14 teams · automatic reseeding · 13 playoff decisions · JDAM available.", icon: "trophy.fill", accent: .cyan)
                                }.buttonStyle(WarRoomCardButtonStyle())
                            } else {
                                NavigationLink { CfbPostseasonHubView(membership: membership) } label: {
                                    let phase = CfbSeasonPhase.phase(week: membership.leagues.currentWeek, regularSeasonWeeks: membership.leagues.regularSeasonWeeks)
                                    StatusCard(kicker: phase == .conferenceChampionships ? "PHASE II · CHAMPIONSHIP SATURDAY" : "PHASE III · BOWL MANIA", title: phase == .conferenceChampionships ? "Conference titles are on the line" : "Open the Bowl Board", detail: phase == .conferenceChampionships ? "The Bowl Board and CFP remain sealed until the conference champions are official." : "Marquee 15 · Sicko 10 · 100 points · Dead Hand available.", icon: phase == .conferenceChampionships ? "flag.checkered.2.crossed" : "ticket.fill", accent: .yellow)
                                }.buttonStyle(WarRoomCardButtonStyle())
                            }
                        }
                        NavigationLink { GazetteView(membership: membership) } label: {
                            if isNFL {
                                NflPrimaryActionCard(kicker: "POSTGAME REPORT · PERMANENT TAPE", title: "The Dispatch", detail: "Winners, wreckage, standings movement, and every Sunday receipt.", icon: "newspaper.fill")
                            } else {
                                StatusCard(kicker: "THE WEEKLY PAPER · ARCHIVE", title: "The Dispatch", detail: "Crowns, shame, standings movement, rivalries, and libel fit to print.", icon: "newspaper.fill", accent: .yellow)
                            }
                        }.buttonStyle(WarRoomCardButtonStyle())
                        if let latest = lockerMessages.last {
                            Button(action: onOpenLocker) {
                                if isNFL {
                                    NflPrimaryActionCard(kicker: "LATEST FROM THE SIDELINE", title: latest.authorName, detail: latest.body, icon: "quote.bubble.fill", urgent: true)
                                } else {
                                    StatusCard(kicker: "LATEST FROM THE LOCKER", title: latest.authorName, detail: latest.body, icon: "quote.bubble.fill", accent: .green)
                                }
                            }.buttonStyle(WarRoomCardButtonStyle())
                        }

                        Button {
                            openURL(AppLinks.issueReport(sportId: membership.leagues.sportId, leagueName: membership.leagues.name)) { accepted in
                                guard !accepted else { return }
                                UIPasteboard.general.string = AppLinks.supportEmail
                                showingFeedbackFallback = true
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack(spacing: 8) {
                                    Image(systemName: "wrench.and.screwdriver.fill")
                                    Text("FIELD REPORTS · YOUR INPUT MATTERS")
                                }
                                .font(.system(size: 9, weight: .black))
                                .tracking(1.35)
                                .foregroundStyle(isNFL ? .cyan : .yellow)

                                Text("HELP SHAPE THE WAR ROOM")
                                    .font(.headline.weight(.black))
                                    .foregroundStyle(.white)

                                Text("Spot a bug, find something confusing, or have an idea that would make the game better? Send it directly to the team.")
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(.white.opacity(0.68))
                                    .fixedSize(horizontal: false, vertical: true)

                                Text(AppLinks.supportEmail)
                                    .font(.caption2.weight(.bold).monospaced())
                                    .foregroundStyle(.white.opacity(0.52))

                                HStack {
                                    Text("SUBMIT AN ISSUE OR IDEA")
                                        .font(.caption.weight(.black))
                                        .tracking(0.7)
                                    Spacer()
                                    Image(systemName: "arrow.up.right")
                                        .font(.caption.weight(.black))
                                }
                                .foregroundStyle(.white)
                                .padding(.horizontal, 13)
                                .padding(.vertical, 11)
                                .background((isNFL ? Color.blue : Color.green).opacity(0.72), in: RoundedRectangle(cornerRadius: 8))
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(.black.opacity(0.86), in: RoundedRectangle(cornerRadius: isNFL ? 8 : 16))
                            .overlay(RoundedRectangle(cornerRadius: isNFL ? 8 : 16).stroke((isNFL ? Color.cyan : Color.green).opacity(0.42)))
                        }
                        .buttonStyle(WarRoomCardButtonStyle())
                    } else if let loadError {
                        VStack(spacing: 16) {
                            ContentUnavailableView("Room unavailable", systemImage: "wifi.exclamationmark", description: Text(loadError))
                            NavigationLink {
                                LobbyView()
                            } label: {
                                Label("ENTER THE MUSTER", systemImage: "person.3.sequence.fill")
                                    .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(15)
                            }.buttonStyle(.borderedProminent).tint(.green)
                            Text("Browse rooms first. You are never assigned to one automatically.")
                                .font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
                        }
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 12)
                .padding(.bottom, 34)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task(id: leagueOverride?.leagueId ?? auth.selectedLeagueId) { await load() }
        .task(id: membership?.leagueId) {
            guard membership != nil else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(20))
                await refreshPendingJoinRequests()
            }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                clock = Date()
            }
        }
        .onAppear {
            if !loading { Task { await load() } }
        }
        .alert("SUPPORT EMAIL COPIED", isPresented: $showingFeedbackFallback) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("No email app was available, so \(AppLinks.supportEmail) was copied. Paste it into any email app to send your field report.")
        }
    }

    private func load() async {
        guard let token = auth.token, let user = auth.user else { return }
        loading = true
        do {
            let active: LeagueMembership
            if let leagueOverride {
                active = leagueOverride
            } else {
                active = try await SupabaseAPI.activeLeague(token: token, userId: user.id, preferredLeagueId: auth.selectedLeagueId)
            }
            try? await SupabaseAPI.touchLastSeen(token: token, userId: user.id)
            membership = active
            async let loadedMemberships = leagueOverride == nil ? SupabaseAPI.leagueMemberships(token: token, userId: user.id) : [active]
            async let loadedCard = SupabaseAPI.weekCard(token: token, leagueId: active.leagueId, weekNumber: active.leagues.currentWeek)
            async let loadedPick = SupabaseAPI.playerPick(token: token, leagueId: active.leagueId, userId: user.id, weekNumber: active.leagues.currentWeek)
            async let loadedCrystal = SupabaseAPI.crystalBallPick(token: token, leagueId: active.leagueId, userId: user.id)
            async let loadedStandings = SupabaseAPI.standings(token: token, leagueId: active.leagueId)
            async let loadedAnnouncements = SupabaseAPI.announcements(token: token, leagueId: active.leagueId)
            async let loadedLocker = SupabaseAPI.lockerMessages(token: token, leagueId: active.leagueId)
            async let loadedSubmissions = SupabaseAPI.weekSubmittedUserIds(token: token, leagueId: active.leagueId, weekNumber: active.leagues.currentWeek)
            async let loadedSportPool = SupabaseAPI.sportPoolPoll(token: token, leagueId: active.leagueId)
            card = try await loadedCard
            pick = try await loadedPick
            crystalBallPick = try await loadedCrystal
            standings = try await loadedStandings
            announcements = try await loadedAnnouncements
            lockerMessages = try await loadedLocker
            submittedUserIds = try await loadedSubmissions
            sportPoolPoll = try? await loadedSportPool
            if active.leagues.sportId.lowercased() == "cfb" {
                let scorecards = try? await SupabaseAPI.postseasonScorecards(
                    token: token,
                    leagueId: active.leagueId,
                    seasonKey: Calendar.current.component(.year, from: Date()),
                    userId: active.leagues.mode == "foundry" ? nil : user.id
                )
                if let latestWeek = scorecards?.map(\.weekNumber).max() {
                    latestScorecard = scorecards?
                        .filter { $0.weekNumber == latestWeek }
                        .max { $0.weeklyTotal < $1.weeklyTotal }
                } else {
                    latestScorecard = nil
                }
            } else {
                latestScorecard = nil
            }
            memberships = (try? await loadedMemberships) ?? [active]
            if active.isCommissioner(userId: user.id) {
                pendingJoinRequests = (try? await SupabaseAPI.privateRoomJoinRequests(token: token, leagueId: active.leagueId)) ?? []
            } else {
                pendingJoinRequests = []
            }
            await WarRoomNotificationCenter.sync(
                leagueId: active.leagueId,
                leagueName: active.leagues.name,
                week: active.leagues.currentWeek,
                card: card,
                announcements: announcements
            )
            loadError = nil
        } catch {
            loadError = error.localizedDescription
        }
        loading = false
    }

    @MainActor private func refreshPendingJoinRequests() async {
        guard let token = auth.token,
              let user = auth.user,
              let membership,
              membership.isCommissioner(userId: user.id)
        else {
            pendingJoinRequests = []
            return
        }
        if let requests = try? await SupabaseAPI.privateRoomJoinRequests(token: token, leagueId: membership.leagueId) {
            pendingJoinRequests = requests
        }
    }
}

struct PostseasonScorecardView: View {
    let scorecard: PostseasonScorecard
    var sportId: String = "cfb"
    private var identity: SportIdentity { SportIdentity(sportId) }
    private var phaseTitle: String { scorecard.phase.replacingOccurrences(of: "_", with: " ").uppercased() }
    var body: some View {
        ZStack {
            if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) }
            else {
                Color.black.ignoresSafeArea()
                LinearGradient(colors: [Color.yellow.opacity(0.18), .clear, Color.green.opacity(0.12)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            }
            ScorecardGrid(color: identity.isNFL ? .cyan : .green).opacity(0.32).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    classifiedHeader
                    totalHero
                    Text(identity.isNFL ? "GAME-DAY SCORING TAPE" : "SCORING EVENT LOG").font(.system(size: 10, weight: .black)).tracking(2.2).foregroundStyle(identity.isNFL ? .cyan : .yellow)
                    VStack(spacing: 10) {
                        ForEach(Array(scorecard.components.enumerated()), id: \.offset) { index, component in
                            scoreEvent(component, index: index)
                        }
                    }
                    HStack(spacing: 9) {
                        scoreMetric("\(scorecard.seasonTotalBefore)", "BEFORE")
                        scoreMetric("\(scorecard.seasonTotalAfter)", "AFTER")
                        scoreMetric(rankMovement, "STANDING")
                    }
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.seal.fill")
                        Text("CERTIFIED · IMMUTABLE · UUID ATTACHED")
                    }.font(.caption2.weight(.black)).tracking(1.25).foregroundStyle(identity.isNFL ? .cyan : .green).frame(maxWidth: .infinity).padding(.top, 2)
                }.padding(16).padding(.bottom, 40)
            }
        }.navigationTitle("Scorecard").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark)
    }

    private var classifiedHeader: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Label("WAR ROOM AFTER-ACTION REPORT", systemImage: "lock.shield.fill")
                    .font(.system(size: 9, weight: .black)).tracking(1.4).foregroundStyle(identity.isNFL ? .cyan : .yellow)
                Spacer()
                Text("WR-\(scorecard.weekNumber.formatted(.number.precision(.integerLength(2))))")
                    .font(.system(size: 9, weight: .black, design: .monospaced)).foregroundStyle(.white.opacity(0.42))
            }.padding(.bottom, 13)
            HStack(spacing: 0) { if identity.isNFL { Color.blue; Color.white; Color.red } else { Color.yellow } }.frame(height: 3)
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("WEEK \(scorecard.weekNumber)").font(.system(size: 12, weight: .black)).tracking(2).foregroundStyle(identity.isNFL ? .cyan : .yellow)
                    Text(phaseTitle).font(.system(size: 34, weight: .black)).fontWidth(.condensed)
                }
                Spacer()
                Text("DECLASSIFIED")
                    .font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(.red)
                    .padding(.horizontal, 9).padding(.vertical, 6)
                    .overlay(Rectangle().stroke(.red, lineWidth: 2)).rotationEffect(.degrees(-5))
            }.padding(.vertical, 15)
            Text("Nothing reaches the standings unless it appears below.")
                .font(.footnote.weight(.bold)).foregroundStyle(.white.opacity(0.62))
            HStack(spacing: 4) {
                ForEach(0..<13, id: \.self) { _ in
                    Parallelogram().fill((identity.isNFL ? Color.cyan : Color.yellow).opacity(0.8)).frame(width: 15, height: 5)
                }
            }.padding(.top, 14).clipped()
        }
        .padding(18).background(.black.opacity(0.88), in: UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 22, bottomTrailingRadius: 3, topTrailingRadius: 22))
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 22, bottomTrailingRadius: 3, topTrailingRadius: 22).stroke((identity.isNFL ? Color.cyan : Color.yellow).opacity(0.58), lineWidth: 1.5))
        .shadow(color: (identity.isNFL ? Color.blue : Color.yellow).opacity(0.18), radius: 22)
    }

    private var totalHero: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle().fill((identity.isNFL ? Color.blue : Color.yellow).opacity(0.12))
                Circle().stroke((identity.isNFL ? Color.cyan : Color.yellow).opacity(0.35), lineWidth: 1)
                Circle().trim(from: 0.03, to: 0.79).stroke(identity.isNFL ? .cyan : .yellow, style: StrokeStyle(lineWidth: 5, lineCap: .square)).rotationEffect(.degrees(-90))
                VStack(spacing: -3) {
                    Text(scorecard.weeklyTotal >= 0 ? "+\(scorecard.weeklyTotal)" : "\(scorecard.weeklyTotal)")
                        .font(.system(size: 38, weight: .black, design: .rounded)).foregroundStyle(identity.isNFL ? .cyan : .yellow)
                    Text("POINTS").font(.system(size: 8, weight: .black)).tracking(1.4).foregroundStyle(.white.opacity(0.55))
                }
            }.frame(width: 112, height: 112).shadow(color: (identity.isNFL ? Color.blue : Color.yellow).opacity(0.42), radius: 18)
            VStack(alignment: .leading, spacing: 7) {
                Text(identity.isNFL ? "WEEKLY TOTAL" : "MISSION TOTAL").font(.system(size: 9, weight: .black)).tracking(1.8).foregroundStyle(identity.isNFL ? .red : .green)
                Text("WEEK \(scorecard.weekNumber)\nCERTIFIED").font(.system(size: 24, weight: .black)).fontWidth(.condensed)
                Text("Every point survived the audit.").font(.caption.weight(.bold)).foregroundStyle(.white.opacity(0.48))
            }
            Spacer(minLength: 0)
        }.padding(17).background(Color.black.opacity(0.84), in: RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 20)).overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 20).stroke((identity.isNFL ? Color.cyan : Color.green).opacity(0.42)))
    }

    private func scoreEvent(_ component: PostseasonScoreComponent, index: Int) -> some View {
        let isSpecial = component.label.contains("PROP") || component.label.contains("NUCLEAR") || component.label.contains("DEAD HAND") || component.label.contains("BRACKET")
        let accent: Color = component.points < 0 ? .red : (identity.isNFL ? (isSpecial ? .red : .cyan) : (isSpecial ? .yellow : .green))
        return HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 7).fill(accent.opacity(0.14))
                RoundedRectangle(cornerRadius: 7).stroke(accent.opacity(0.6))
                Text("\(index + 1)").font(.caption.weight(.black)).foregroundStyle(accent)
            }.frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 4) {
                Text(isSpecial ? "SPECIAL ACTION" : "SCORING ACTION").font(.system(size: 7, weight: .black)).tracking(1.2).foregroundStyle(accent.opacity(0.75))
                Text(component.label).font(.subheadline.weight(.black)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            Text(component.points >= 0 ? "+\(component.points)" : "\(component.points)")
                .font(.system(size: 22, weight: .black, design: .rounded)).foregroundStyle(component.points == 0 ? .white.opacity(0.38) : accent)
                .shadow(color: component.points == 0 ? .clear : accent.opacity(0.45), radius: 8)
        }
        .padding(14).background(Color.black.opacity(0.88), in: RoundedRectangle(cornerRadius: 15))
        .overlay(alignment: .leading) { Rectangle().fill(accent).frame(width: 3).padding(.vertical, 9) }
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(component.points == 0 ? 0.18 : 0.42)))
    }
    private var rankMovement: String {
        guard let before=scorecard.rankBefore,let after=scorecard.rankAfter else { return "—" }
        return before == after ? "#\(after)" : "#\(before) → #\(after)"
    }
    private func scoreMetric(_ value: String,_ label: String) -> some View {
        let accent: Color = identity.isNFL ? .cyan : .green
        return VStack(spacing: 5) { Text(value).font(.title3.weight(.black)).minimumScaleFactor(0.62); Text(label).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(accent) }.frame(maxWidth: .infinity).padding(.vertical, 15).background(.black.opacity(0.88), in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 13)).overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 13).stroke(accent.opacity(0.38))).shadow(color: accent.opacity(0.1), radius: 10)
    }
}

private struct ScorecardGrid: View {
    var color: Color = .green
    var body: some View {
        Canvas { context, size in
            var path = Path()
            for x in stride(from: 0.0, through: size.width, by: 28) { path.move(to: CGPoint(x: x, y: 0)); path.addLine(to: CGPoint(x: x, y: size.height)) }
            for y in stride(from: 0.0, through: size.height, by: 28) { path.move(to: CGPoint(x: 0, y: y)); path.addLine(to: CGPoint(x: size.width, y: y)) }
            context.stroke(path, with: .color(color.opacity(0.16)), lineWidth: 0.5)
        }
    }
}

private struct Parallelogram: Shape {
    func path(in rect: CGRect) -> Path {
        Path { p in
            p.move(to: CGPoint(x: rect.width * 0.25, y: 0)); p.addLine(to: CGPoint(x: rect.width, y: 0))
            p.addLine(to: CGPoint(x: rect.width * 0.75, y: rect.height)); p.addLine(to: CGPoint(x: 0, y: rect.height)); p.closeSubpath()
        }
    }
}

enum LeagueInvitation {
    static let appStoreURL = URL(string: "https://apps.apple.com/app/id6802751064")!

    static func message(leagueName: String, sportId: String, code: String) -> String {
        """
        You’re invited to \(leagueName) on War Room Pick’Em.

        Download the app: \(appStoreURL.absoluteString)
        Open War Room Pick’Em → Enter Lobby → Enter an Invite Code
        Invite code: \(code.uppercased())

        Desk: \(sportId.uppercased())
        """
    }
}

private struct CommissionerCommandCenterView: View {
    let membership: LeagueMembership
    let standings: [Standing]
    let submittedUserIds: Set<UUID>

    private var week: Int { membership.leagues.currentWeek }
    private var identity: SportIdentity { SportIdentity(membership.leagues.sportId) }
    private var submittedCount: Int { standings.filter { submittedUserIds.contains($0.userId) }.count }
    private var allSubmitted: Bool { !standings.isEmpty && submittedCount == standings.count }

    var body: some View {
        ZStack {
            if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) }
            else { LinearGradient(colors: [.black, Color(red: 0.03, green: 0.10, blue: 0.07), .black], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea() }
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    commandHeader
                    weeklyStatus
                    primaryAction
                    ShareLink(
                        item: LeagueInvitation.appStoreURL,
                        subject: Text("Join \(membership.leagues.name) on War Room Pick’Em"),
                        message: Text(LeagueInvitation.message(
                            leagueName: membership.leagues.name,
                            sportId: membership.leagues.sportId,
                            code: membership.leagues.code
                        ))
                    ) {
                        HStack(spacing: 12) {
                            Image(systemName: "square.and.arrow.up.fill").font(.title2.weight(.black))
                            VStack(alignment: .leading, spacing: 3) {
                                Text("SHARE LEAGUE INVITATION").font(.headline.weight(.black))
                                Text("APP STORE DOWNLOAD · INVITE CODE \(membership.leagues.code.uppercased())")
                                    .font(.system(size: 8, weight: .black)).tracking(0.6)
                            }
                            Spacer()
                        }
                        .foregroundStyle(identity.isNFL ? .cyan : .green)
                        .padding(16).background(.black.opacity(0.80), in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 15))
                        .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 15).stroke((identity.isNFL ? Color.cyan : Color.green).opacity(0.48)))
                    }
                    if identity.isNFL { NflBroadcastSectionLabel(title: "GAME-DAY CONTROL", detail: "ONE JOB PER DESK · NO MYSTERY BUTTONS") }
                    else { HomeSectionLabel(title: "COMMAND DOORS", detail: "ONE JOB PER ROOM · NO MYSTERY BUTTONS") }
                    controlDoor(title: "MANAGE LEAGUE", detail: "ROSTER · CONFERENCES · SEASON CONTROL", icon: "person.3.sequence.fill", color: identity.isNFL ? .cyan : .green) {
                        LeagueManagementView(membership: membership)
                    }
                    controlDoor(title: "JOIN REQUESTS", detail: "APPROVE · DENY · OPTIONAL REASON · TWO-REQUEST LIMIT", icon: "person.crop.circle.badge.questionmark", color: .orange) {
                        JoinRequestsView(membership: membership)
                    }
                    controlDoor(title: "WHO’S IN", detail: "\(submittedCount) OF \(standings.count) CARDS ON FILE", icon: "person.2.fill", color: allSubmitted ? .green : .yellow) {
                        SubmissionStatusView(membership: membership, standings: standings, submittedUserIds: submittedUserIds)
                    }
                    controlDoor(title: "CARD & ODDS DESK", detail: "VIEW THE PUBLISHED SLATE OR PREPARE THE NEXT ONE", icon: "rectangle.and.pencil.and.ellipsis", color: .green) {
                        CommissionerCardBuilderView(membership: membership)
                    }
                    controlDoor(title: "OFFICIAL TRANSMISSION", detail: "ANNOUNCE DEADLINES, THREATS, AND OTHER LEADERSHIP", icon: "megaphone.fill", color: .orange) {
                        AnnouncementsView(initialTitle: "Week \(week) orders", initialBody: "Week \(week) is live. Make your picks before first kickoff—future you has enough problems.")
                    }
                    controlDoor(title: "CHAMPIONSHIP HARDWARE", detail: membership.leagues.championshipTrophyId == nil ? "THE ROOM STILL NEEDS SOMETHING TO FIGHT OVER" : "VIEW THE TROPHY WAITING AT THE END", icon: "trophy.fill", color: .yellow) {
                        ChampionshipTrophyPickerView(membership: membership)
                    }
                    controlDoor(title: "FINAL SCORES & WEEK PROCESSING", detail: "SYNC OFFICIAL SCORES · REVIEW COVERS · CERTIFY THE WEEK", icon: "checkmark.seal.fill", color: .red) {
                        CommissionerScoreWeekView(membership: membership, submittedCount: submittedCount, playerCount: standings.count)
                    }
                    controlDoor(title: "RUN IT BACK", detail: "OPEN THE 7-DAY SPORT VOTE · MOVE YES VOTERS WITH ONE BUTTON", icon: "person.3.sequence.fill", color: .orange) {
                        SportPoolView(membership: membership)
                    }
                }
                .padding(16).padding(.bottom, 34)
            }
        }
        .navigationTitle("Commissioner Command").navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
    }

    private var commandHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Label(identity.isNFL ? "GAME-DAY DIRECTOR" : "COMMISSIONER EYES ONLY", systemImage: "star.circle.fill").font(.system(size: 9, weight: .black)).tracking(1.6).foregroundStyle(identity.isNFL ? .cyan : .yellow); Spacer(); Text(membership.leagues.sportId.uppercased()).font(.caption2.weight(.black)).foregroundStyle(identity.isNFL ? .red : .green) }
            Text(identity.isNFL ? "WEEK \(week) CONTROL ROOM" : "WEEK \(week) COMMAND").font(.system(size: 34, weight: .black)).fontWidth(.condensed)
            Text(membership.leagues.name.uppercased()).font(.caption.weight(.black)).tracking(1.2).foregroundStyle(.white.opacity(0.42))
        }
        .padding(20)
        .background(LinearGradient(colors: [.black.opacity(0.88), (identity.isNFL ? Color.blue : Color.green).opacity(0.18)], startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 20))
        .overlay(alignment: .top) { if identity.isNFL { HStack(spacing: 0) { Color.blue; Color.white; Color.red }.frame(height: 3) } }
        .overlay(alignment: .leading) { Rectangle().fill(identity.isNFL ? .cyan : .yellow).frame(width: 4).padding(.vertical, 12) }
        .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 20).stroke((identity.isNFL ? Color.cyan : Color.green).opacity(0.42)))
    }

    private var weeklyStatus: some View {
        HStack(spacing: 8) {
            commandStatus("CARD", "LIVE", identity.isNFL ? .cyan : .green)
            commandStatus("PICKS", "\(submittedCount)/\(standings.count)", allSubmitted ? (identity.isNFL ? .cyan : .green) : (identity.isNFL ? .red : .yellow))
            commandStatus("SCORE", "WAITING", .secondary)
        }
    }

    private func commandStatus(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(spacing: 4) { Text(value).font(.headline.weight(.black)).foregroundStyle(color).minimumScaleFactor(0.7); Text(label).font(.system(size: 7, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.38)) }
            .frame(maxWidth: .infinity).padding(.vertical, 12).background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(color.opacity(0.30)))
    }

    @ViewBuilder private var primaryAction: some View {
        NavigationLink {
            SubmissionStatusView(membership: membership, standings: standings, submittedUserIds: submittedUserIds)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: allSubmitted ? "checkmark.seal.fill" : "person.crop.circle.badge.clock").font(.title2.weight(.black))
                VStack(alignment: .leading, spacing: 3) {
                    Text(allSubmitted ? "EVERYBODY IS IN" : "CHECK THE ATTENDANCE SHEET").font(.headline.weight(.black))
                    Text(allSubmitted ? "THE ROOM IS READY FOR FINAL SCORES." : "\(max(0, standings.count - submittedCount)) PLAYERS STILL OWE THE ROOM A CARD.").font(.system(size: 8, weight: .black)).tracking(0.7)
                }
                Spacer(); Image(systemName: "arrow.right.circle.fill")
            }
            .foregroundStyle(identity.isNFL ? .white : .black).padding(16).background(allSubmitted ? (identity.isNFL ? Color.blue : Color.green) : (identity.isNFL ? Color.red : Color.yellow), in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 15))
        }.buttonStyle(.plain)
    }

    private func controlDoor<Destination: View>(title: String, detail: String, icon: String, color: Color, @ViewBuilder destination: () -> Destination) -> some View {
        let displayColor: Color = identity.isNFL ? (color == .red ? .red : color == .orange ? .red : color == .green ? .blue : .cyan) : color
        return NavigationLink(destination: destination) {
            HStack(spacing: 13) {
                Image(systemName: icon).font(.title2.weight(.black)).foregroundStyle(displayColor).frame(width: 42, height: 42).background(displayColor.opacity(0.10), in: RoundedRectangle(cornerRadius: identity.isNFL ? 4 : 10))
                VStack(alignment: .leading, spacing: 4) { Text(title).font(.headline.weight(.black)).foregroundStyle(.white); Text(detail).font(.system(size: 8, weight: .black)).tracking(0.55).foregroundStyle(.white.opacity(0.40)).fixedSize(horizontal: false, vertical: true) }
                Spacer(); Image(systemName: "chevron.right").font(.caption.weight(.black)).foregroundStyle(displayColor)
            }
            .padding(14).background(.black.opacity(0.75), in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 15)).overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 15).stroke(displayColor.opacity(0.32)))
        }.buttonStyle(.plain)
    }

}

struct CommissionerScoreWeekView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    let submittedCount: Int
    let playerCount: Int
    var simulationWriteEnabled: Bool = false
    @State private var card: WeekCard?
    @State private var results: [UUID: String] = [:]
    @State private var propResult: String?
    @State private var loading = true
    @State private var processing = false
    @State private var error: String?
    @State private var receipt: ScoreWeekResponse?
    @State private var confirming = false
    @State private var syncedScores: [UUID: SyncedFootballScore] = [:]
    @State private var manuallySetResults: Set<UUID> = []
    @State private var scoreSyncing = false
    @State private var scoreSyncNotice: String?

    private var week: Int { membership.leagues.currentWeek }
    private var identity: SportIdentity { SportIdentity(membership.leagues.sportId) }
    private var accent: Color { identity.isNFL ? .cyan : .green }
    private var isFoundry: Bool { membership.leagues.mode == "foundry" && simulationWriteEnabled }
    private var complete: Bool {
        guard let card else { return false }
        return card.cardGames.allSatisfy { results[$0.id] != nil } && propResult != nil
    }

    var body: some View {
        ZStack {
            if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) }
            else { LinearGradient(colors: [.black, Color(red: 0.03, green: 0.10, blue: 0.07), .black], startPoint: .top, endPoint: .bottom).ignoresSafeArea() }
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(identity.isNFL ? "WEEK \(week) · OFFICIAL RESULTS CONTROL" : "WEEK \(week) · FINAL SCORE DESK").font(.caption.weight(.black)).tracking(1.3).foregroundStyle(accent)
                    Text("Call the covers.").font(.largeTitle.weight(.black)).fontWidth(.condensed)
                    Text("Choose who covered each spread—not the straight-up winner. The server validates the full card and recalculates standings as one transaction.").font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
                    preflight
                    if loading { ProgressView("Opening the official ledger…").frame(maxWidth: .infinity).padding(30) }
                    else if let card {
                        if simulationWriteEnabled { simulationControl(card) }
                        if !isFoundry { liveScoreControl }
                        ForEach(card.cardGames) { game in gameResultCard(game) }
                        if let question = card.propQuestion, let a = card.propOptionA, let b = card.propOptionB {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("PROP RESULT · \(card.propPoints) PTS").font(.caption.weight(.black)).foregroundStyle(identity.isNFL ? .cyan : .yellow)
                                Text(question).font(.headline.weight(.black))
                                resultButton(a, selected: propResult == a) { propResult = a }
                                resultButton(b, selected: propResult == b) { propResult = b }
                            }.commandPanel(accent: accent, cornerRadius: identity.isNFL ? 6 : 15)
                        }
                        fireControl
                    } else {
                        Label("NO PUBLISHED WEEK \(week) CARD", systemImage: "rectangle.slash.fill").font(.headline.weight(.black)).foregroundStyle(identity.isNFL ? .cyan : .yellow).commandPanel(accent: accent, cornerRadius: identity.isNFL ? 6 : 15)
                    }
                    if let error { Label(error, systemImage: "exclamationmark.triangle.fill").font(.footnote.weight(.bold)).foregroundStyle(.red).commandPanel(accent: accent, cornerRadius: identity.isNFL ? 6 : 15) }
                    if let receipt { receiptView(receipt) }
                }.padding(16).padding(.bottom, 36)
            }
        }
        .navigationTitle("Final Scores").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark)
        .task { await load() }
        .task(id: card?.id) {
            guard card != nil, !isFoundry else { return }
            await syncOfficialScores(silent: true)
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                guard shouldPollScores else { continue }
                await syncOfficialScores(silent: true)
            }
        }
        .confirmationDialog(isFoundry ? "Process Week \(week) in the Foundry?" : "Certify Week \(week) results?", isPresented: $confirming, titleVisibility: .visible) {
            Button(isFoundry ? "Score \(submittedCount) simulation cards" : "Score \(submittedCount) locked cards", role: .destructive) { Task { await process() } }
            Button("Cancel", role: .cancel) {}
        } message: { Text(isFoundry ? "This writes simulation results and rebuilds Foundry standings." : "This writes official results for the entire room. Review every cover and the prop before certifying.") }
    }

    private var preflight: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("PRE-FLIGHT").font(.caption.weight(.black)).tracking(1.2)
            preflightRow("Published card", good: card != nil)
            preflightRow("Locked cards · \(submittedCount)/\(playerCount)", good: submittedCount > 0)
            preflightRow(isFoundry ? "Foundry simulation isolated" : "Commissioner scoring authority", good: true)
            preflightRow("Every cover + prop entered", good: complete)
        }.commandPanel(accent: accent, cornerRadius: identity.isNFL ? 6 : 15)
    }

    private func preflightRow(_ text: String, good: Bool) -> some View {
        Label(text, systemImage: good ? "checkmark.circle.fill" : "circle.dashed").font(.footnote.weight(.bold)).foregroundStyle(good ? accent : .white.opacity(0.45))
    }

    private func gameResultCard(_ game: CardGame) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if game.isRivalry {
                Label(identity.isNFL ? "DIVISION GRUDGE · BAD BLOOD FILED" : "RIVALRY WEEK · THIS ONE COUNTS FOR THE VAULT", systemImage: "flame.fill")
                    .font(.caption2.weight(.black)).foregroundStyle(.red)
            }
            Text("GAME \(game.sortOrder + 1) · ATS RESULT").font(.caption2.weight(.black)).tracking(1).foregroundStyle(.white.opacity(0.4))
            Text("\(game.awayTeam) @ \(game.homeTeam)").font(.headline.weight(.black))
            if let live = syncedScores[game.id] {
                HStack {
                    Text("\(game.awayTeam) \(live.awayScore) · \(game.homeTeam) \(live.homeScore)")
                        .font(.caption.weight(.black)).lineLimit(1).minimumScaleFactor(0.65)
                    Spacer()
                    Text(live.completed ? "FINAL" : "LIVE")
                        .font(.system(size: 8, weight: .black)).tracking(0.8)
                        .foregroundStyle(live.completed ? accent : .yellow)
                }
            }
            HStack(spacing: 8) {
                coverButton(game.awayTeam, value: "away", game: game)
                coverButton(game.homeTeam, value: "home", game: game)
            }
        }.commandPanel(accent: accent, cornerRadius: identity.isNFL ? 6 : 15)
    }

    private func simulationControl(_ card: WeekCard) -> some View {
        Button { simulateFinals(card) } label: {
            HStack(spacing: 12) {
                Image(systemName: "dice.fill").font(.title2)
                VStack(alignment: .leading, spacing: 3) {
                    Text("SIMULATE FINAL SCORES").font(.headline.weight(.black))
                    Text("FILLS EVERY COVER + PROP · DOES NOT SCORE YET").font(.system(size: 8, weight: .black)).tracking(0.7)
                }
                Spacer(); Image(systemName: "sparkles")
            }.foregroundStyle(identity.isNFL ? .white : .black).padding(16).background(identity.isNFL ? Color.blue : Color.orange, in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 13))
        }.buttonStyle(.plain)
    }

    private func simulateFinals(_ card: WeekCard) {
        var simulated: [UUID: String] = [:]
        for (index, game) in card.cardGames.enumerated() {
            let seed = game.id.uuidString.unicodeScalars.reduce(index + week) { $0 + Int($1.value) }
            simulated[game.id] = seed.isMultiple(of: 2) ? "home" : "away"
        }
        results = simulated
        propResult = week.isMultiple(of: 2) ? card.propOptionA : card.propOptionB
        error = nil
    }

    private func coverButton(_ title: String, value: String, game: CardGame) -> some View {
        Button { results[game.id] = value; manuallySetResults.insert(game.id) } label: {
            Text(title.uppercased()).font(.system(size: 9, weight: .black)).lineLimit(2).minimumScaleFactor(0.65).frame(maxWidth: .infinity, minHeight: 42).background(results[game.id] == value ? (identity.isNFL ? Color.blue : Color.green) : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: identity.isNFL ? 4 : 9)).foregroundStyle(results[game.id] == value ? (identity.isNFL ? .white : .black) : .white)
        }.buttonStyle(.plain)
    }

    private func resultButton(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) { HStack { Text(title).font(.footnote.weight(.black)); Spacer(); Image(systemName: selected ? "checkmark.circle.fill" : "circle") }.padding(12).background(selected ? (identity.isNFL ? Color.blue : Color.yellow) : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: identity.isNFL ? 5 : 10)).foregroundStyle(selected ? (identity.isNFL ? .white : .black) : .white) }.buttonStyle(.plain)
    }

    @ViewBuilder private var fireControl: some View {
        Button { confirming = true } label: {
            Label(processing ? "PROCESSING…" : (isFoundry ? "PROCESS FOUNDRY WEEK" : "CERTIFY OFFICIAL RESULTS"), systemImage: "bolt.shield.fill")
                .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16)
                .background(complete && submittedCount > 0 ? (identity.isNFL ? Color.blue : Color.green) : Color.gray, in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 13))
                .foregroundStyle(identity.isNFL ? .white : .black)
        }.buttonStyle(.plain).disabled(!complete || submittedCount == 0 || processing)
    }

    private var liveScoreControl: some View {
        Button { Task { await syncOfficialScores(silent: false) } } label: {
            HStack(spacing: 12) {
                Image(systemName: scoreSyncing ? "arrow.triangle.2.circlepath" : "dot.radiowaves.left.and.right")
                VStack(alignment: .leading, spacing: 3) {
                    Text(scoreSyncing ? "SYNCING OFFICIAL SCORES…" : "SYNC LIVE / FINAL SCORES").font(.headline.weight(.black))
                    Text(scoreSyncNotice ?? "FINALS AUTO-FILL ATS COVERS · REVIEW BEFORE CERTIFYING")
                        .font(.system(size: 8, weight: .black)).tracking(0.55)
                }
                Spacer()
            }.foregroundStyle(identity.isNFL ? .white : .black).padding(15)
                .background(identity.isNFL ? Color.blue : Color.yellow, in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 13))
        }.buttonStyle(.plain).disabled(scoreSyncing)
    }

    private func receiptView(_ value: ScoreWeekResponse) -> some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("WEEK \(week) CERTIFIED").font(.caption.weight(.black)).tracking(1.2).foregroundStyle(accent)
            Text("The whole room moved.").font(.title2.weight(.black)).fontWidth(.condensed)
            Label("\(value.scoredCount) \(isFoundry ? "simulation" : "locked") cards scored and standings rebuilt", systemImage: "checkmark.seal.fill").font(.footnote.weight(.bold)).foregroundStyle(accent)
            if let crown = value.crownName, let points = value.crownPoints {
                damageRow("CROWN", crown, "\(points) PTS", identity.isNFL ? .cyan : .yellow, "crown.fill")
            }
            if let shame = value.shameName, let points = value.shamePoints {
                damageRow("SHAME", shame, "\(points) PTS", .red, "hand.thumbsdown.fill")
            }
            if let quote = value.lockerQuote, !quote.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("LOCKER ROOM INFLUENCE").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(identity.isNFL ? .red : .orange)
                    Text("“\(quote)”").font(.footnote.weight(.semibold)).italic().foregroundStyle(.white.opacity(0.72))
                    Text("Filed into this week's Dispatch.").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.38))
                }
            }
            NavigationLink { FoundryLeagueMirrorView(seedMembership: membership) } label: {
                Label(identity.isNFL ? "ENTER SUNDAY SIMULATION" : "ENTER FOUNDRY SIMULATION", systemImage: "rectangle.3.group.fill").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(15).foregroundStyle(identity.isNFL ? .white : .black).background(identity.isNFL ? Color.blue : Color.yellow, in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 12))
            }.buttonStyle(.plain)
            HStack {
                Image(systemName: value.phase == "postseason" ? "trophy.fill" : "arrow.right.circle.fill").foregroundStyle(identity.isNFL ? .red : .orange)
                Text(value.phase == "postseason" ? "POSTSEASON SHELL ACTIVE" : "WEEK \(value.nextWeek ?? week + 1) READY").font(.caption.weight(.black)).tracking(0.8)
                Spacer(); Image(systemName: value.nextCardReady == true ? "checkmark.circle.fill" : "flag.checkered").foregroundStyle(identity.isNFL ? .cyan : .green)
            }.padding(12).background((identity.isNFL ? Color.blue : Color.orange).opacity(0.10), in: RoundedRectangle(cornerRadius: identity.isNFL ? 5 : 10))
            DisclosureGroup("FULL SCORE LEDGER") {
                ForEach(value.details.sorted { $0.points > $1.points }) { Text("\($0.name)  ·  \($0.points) PTS").font(.footnote.weight(.bold)).foregroundStyle(.white.opacity(0.7)).padding(.top, 4) }
            }.font(.caption.weight(.black)).tint(identity.isNFL ? .cyan : .green)
        }.commandPanel(accent: accent, cornerRadius: identity.isNFL ? 6 : 15)
    }

    private func damageRow(_ label: String, _ name: String, _ points: String, _ color: Color, _ icon: String) -> some View {
        HStack(spacing: 11) {
            Image(systemName: icon).foregroundStyle(color).frame(width: 32, height: 32).background(color.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 2) { Text(label).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(color); Text(name.uppercased()).font(.headline.weight(.black)) }
            Spacer(); Text(points).font(.caption.weight(.black)).foregroundStyle(color)
        }
    }

    @MainActor private func load() async {
        defer { loading = false }
        guard let token = auth.token else { error = "Session expired."; return }
        do { card = try await SupabaseAPI.weekCard(token: token, leagueId: membership.leagueId, weekNumber: week) }
        catch { self.error = error.localizedDescription }
    }

    @MainActor private func process() async {
        guard complete, let token = auth.token, let propResult else { return }
        processing = true; error = nil
        defer { processing = false }
        do { receipt = try await SupabaseAPI.scoreLeagueWeek(token: token, leagueId: membership.leagueId, weekNumber: week, results: results, propResult: propResult, foundryMode: isFoundry) }
        catch { self.error = error.localizedDescription }
    }

    private var shouldPollScores: Bool {
        guard let card else { return false }
        return card.cardGames.contains { game in
            guard let start = game.startTime.flatMap({ ISO8601DateFormatter().date(from: $0) }), start <= Date() else { return false }
            return syncedScores[game.id]?.completed != true
        }
    }

    @MainActor private func syncOfficialScores(silent: Bool) async {
        guard !isFoundry, let token = auth.token, let card else { return }
        if !silent { scoreSyncing = true; error = nil }
        defer { if !silent { scoreSyncing = false } }
        do {
            let feed = try await SupabaseAPI.footballScores(token: token, leagueId: membership.leagueId, sportId: membership.leagues.sportId)
            var matched = 0
            var finals = 0
            for game in card.cardGames {
                guard let event = feed.events.first(where: { scoreEvent($0, matches: game) }),
                      let home = scoreValue(team: event.homeTeam, in: event),
                      let away = scoreValue(team: event.awayTeam, in: event) else { continue }
                matched += 1
                syncedScores[game.id] = SyncedFootballScore(homeScore: home, awayScore: away, completed: event.completed)
                if event.completed {
                    finals += 1
                    if !manuallySetResults.contains(game.id) { results[game.id] = atsWinner(game: game, homeScore: home, awayScore: away) }
                }
            }
            scoreSyncNotice = "\(finals) FINAL · \(max(0, matched - finals)) LIVE · \(max(0, card.cardGames.count - matched)) WAITING"
        } catch {
            if !silent { self.error = error.localizedDescription }
        }
    }

    private func scoreEvent(_ event: FootballScoreEvent, matches game: CardGame) -> Bool {
        normalizedTeam(event.homeTeam) == normalizedTeam(game.homeTeam)
            && normalizedTeam(event.awayTeam) == normalizedTeam(game.awayTeam)
    }

    private func normalizedTeam(_ value: String) -> String {
        value.lowercased().unicodeScalars.map { CharacterSet.alphanumerics.contains($0) ? Character(String($0)) : " " }
            .reduce(into: "") { $0.append($1) }
            .split(separator: " ").joined(separator: " ")
    }

    private func scoreValue(team: String, in event: FootballScoreEvent) -> Int? {
        event.scores.first(where: { normalizedTeam($0.name) == normalizedTeam(team) }).flatMap { Int($0.score) }
    }

    private func atsWinner(game: CardGame, homeScore: Int, awayScore: Int) -> String {
        let favorite = game.favorite == "away" ? "away" : "home"
        let margin = favorite == "away" ? Double(awayScore - homeScore) : Double(homeScore - awayScore)
        let line = abs(game.spread)
        if abs(margin - line) < 0.000_1 { return "push" }
        if margin > line { return favorite }
        return favorite == "home" ? "away" : "home"
    }
}

private struct SyncedFootballScore {
    let homeScore: Int
    let awayScore: Int
    let completed: Bool
}

extension View {
    func commandPanel(accent: Color = .green, cornerRadius: CGFloat = 15) -> some View { padding(15).frame(maxWidth: .infinity, alignment: .leading).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: cornerRadius)).overlay(RoundedRectangle(cornerRadius: cornerRadius).stroke(accent.opacity(0.28))) }
}

private struct SubmissionStatusView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let membership: LeagueMembership
    let standings: [Standing]
    let submittedUserIds: Set<UUID>
    @State private var showingResetConfirmation = false
    @State private var resetting = false
    @State private var resetError: String?

    private var week: Int { membership.leagues.currentWeek }
    private var identity: SportIdentity { SportIdentity(membership.leagues.sportId) }

    private var submitted: [Standing] { standings.filter { submittedUserIds.contains($0.userId) } }
    private var waiting: [Standing] { standings.filter { !submittedUserIds.contains($0.userId) } }

    var body: some View {
        List {
            Section {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("WEEK \(week) · ATTENDANCE").font(.caption.weight(.black)).foregroundStyle(identity.isNFL ? .cyan : .green)
                        Text("\(submitted.count)/\(standings.count) submitted").font(.title2.weight(.black))
                    }
                    Spacer()
                    Image(systemName: "person.2.fill").font(.title2).foregroundStyle(identity.isNFL ? .cyan : .green)
                }
                Text("Submission status only. Their picks remain none of your business until the rules say otherwise.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Section("Commissioner controls") {
                NavigationLink {
                    ChampionshipTrophyPickerView(membership: membership)
                } label: {
                    Label(membership.leagues.championshipTrophyId == nil ? "CHOOSE CHAMPIONSHIP HARDWARE" : "VIEW CHAMPIONSHIP HARDWARE", systemImage: "trophy.fill")
                        .fontWeight(.black).foregroundStyle(identity.isNFL ? .cyan : .yellow)
                }
                NavigationLink {
                    CommissionerCardBuilderView(membership: membership)
                } label: {
                    Label(membership.leagues.sportId.lowercased() == "nfl" ? "PREVIEW NFL ODDS" : "PREVIEW FBS ODDS", systemImage: "arrow.down.circle.fill")
                        .fontWeight(.black).foregroundStyle(identity.isNFL ? .cyan : .green)
                }
                Text("Viewing odds does not unlock the published card. Reset it below before building a replacement.")
                    .font(.caption).foregroundStyle(.secondary)
                NavigationLink {
                    AnnouncementsView(
                        initialTitle: "Week \(week) picks are open",
                        initialBody: "Week \(week) is live. Make your picks before first kickoff—future you has enough problems."
                    )
                } label: {
                    Label("ANNOUNCE · MAKE YOUR PICKS", systemImage: "megaphone.fill")
                        .frame(maxWidth: .infinity).fontWeight(.black)
                }
                .buttonStyle(.borderedProminent).tint(identity.isNFL ? .blue : .green)
                Button(role: .destructive) {
                    showingResetConfirmation = true
                } label: {
                    Label(resetting ? "RESETTING…" : "RESET CARD + ALL WEEK \(week) PICKS", systemImage: "trash.fill")
                        .frame(maxWidth: .infinity).fontWeight(.black)
                }
                .disabled(resetting)
                if let resetError {
                    Label(resetError, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote).foregroundStyle(.red)
                }
            }
            Section("In") {
                if submitted.isEmpty { Text("Nobody yet. A bold group strategy.").foregroundStyle(.secondary) }
                ForEach(submitted) { player in
                    NavigationLink { PublicPlayerProfileView(standing: player, sportId: membership.leagues.sportId) } label: {
                        Label(player.name, systemImage: "checkmark.circle.fill").foregroundStyle(identity.isNFL ? .cyan : .green)
                    }
                }
            }
            Section("Still wandering around") {
                if waiting.isEmpty { Text("Everybody’s in. Alert the historians.").foregroundStyle(identity.isNFL ? .cyan : .green) }
                ForEach(waiting) { player in
                    NavigationLink { PublicPlayerProfileView(standing: player, sportId: membership.leagues.sportId) } label: {
                        Label(player.name, systemImage: "clock.fill").foregroundStyle(.secondary)
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background { if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) } }
        .tint(identity.isNFL ? .cyan : .green)
        .navigationTitle("Who’s In")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Reset Week \(week) card?", isPresented: $showingResetConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("YES, RESET EVERYTHING", role: .destructive) { Task { await resetCard() } }
        } message: {
            Text("This removes the published card and every submitted pick for Week \(week). Everyone will have to pick again. This cannot be undone.")
        }
    }

    private func resetCard() async {
        guard let token = auth.token else { return }
        resetting = true
        resetError = nil
        do {
            try await SupabaseAPI.unpublishWeekCard(token: token, leagueId: membership.leagueId, weekNumber: week)
            dismiss()
        } catch {
            resetError = error.localizedDescription
        }
        resetting = false
    }
}

private struct ChampionshipTrophyPickerView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    @State private var selectedId: String?
    @State private var pendingTrophy: TrophyDesign?
    @State private var saving = false
    @State private var errorMessage: String?

    private var designs: [TrophyDesign] {
        if membership.leagues.sportId.lowercased() == "nfl" {
            return [
                TrophyDesign(id: "nfl_sunday_scepter", name: "Sunday Scepter", image: "NflSundayScepterArtifact", line: "Eighteen Sundays of evidence, forged into one merciless signal."),
                TrophyDesign(id: "nfl_gridiron_crown", name: "Gridiron Crown", image: "NflGridironCrownArtifact", line: "Goalposts bent into a crown for the room’s final authority."),
                TrophyDesign(id: "nfl_fourth_down_forge", name: "Fourth-Down Forge", image: "NflFourthDownForgeArtifact", line: "Four pillars. One suspended season. No safe decision."),
                TrophyDesign(id: "nfl_two_minute_monument", name: "Two-Minute Monument", image: "NflTwoMinuteMonumentArtifact", line: "For the champion who stayed dangerous after every warning light."),
                TrophyDesign(id: "nfl_iron_end_zone", name: "Iron End Zone", image: "NflIronEndZoneArtifact", line: "The final territory, defended all season and claimed once."),
                TrophyDesign(id: "nfl_final_whistle", name: "The Final Whistle", image: "NflFinalWhistleArtifact", line: "When this sounds, the arguments become permanent records."),
            ]
        }
        return [
            TrophyDesign(id: "command_cup", name: "The Command Cup", image: "ChampionshipArtifact", line: "Traditional authority. Excessive brass. Zero civilian oversight."),
            TrophyDesign(id: "golden_gut", name: "The Golden Gut", image: "GoldenGutArtifact", line: "For the champion whose instincts survived contact with evidence."),
            TrophyDesign(id: "the_receipt", name: "The Receipt", image: "TheReceiptArtifact", line: "Every correct call, preserved forever and displayed without mercy."),
            TrophyDesign(id: "insufferable_crown", name: "Crown of Insufferability", image: "InsufferableCrownArtifact", line: "Victory was not enough. Now everyone must hear about it."),
            TrophyDesign(id: "brass_football", name: "Big Brass Football", image: "BigBrassFootballArtifact", line: "Subtle as a marching band in a courthouse."),
            TrophyDesign(id: "last_one_standing", name: "Last One Standing", image: "LastOneStandingArtifact", line: "One survivor. Many ruined Saturdays. Beautiful work."),
        ]
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            LinearGradient(colors: membership.leagues.sportId.lowercased() == "nfl" ? [.blue.opacity(0.22), .black, .red.opacity(0.16)] : [.yellow.opacity(0.13), .black, .red.opacity(0.08)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(membership.leagues.sportId.lowercased() == "nfl" ? "PRO FOOTBALL · CHAMPIONSHIP HARDWARE" : "COMMISSIONER HARDWARE VAULT").font(.caption2.weight(.black)).tracking(2).foregroundStyle(membership.leagues.sportId.lowercased() == "nfl" ? .cyan : .yellow)
                    Text(selectedId == nil ? (membership.leagues.sportId.lowercased() == "nfl" ? "CHOOSE THE FINAL ARTIFACT" : "CHOOSE THE THRONE") : "THE VAULT IS SEALED").font(.system(size: 34, weight: .black)).fontWidth(.condensed)
                    Text(selectedId == nil ? "One design becomes this season’s permanent championship identity. Pick like people will complain about it—because they will." : "This season’s artifact is locked. Future champions inherit the exact hardware selected here.")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.58))

                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 11), GridItem(.flexible(), spacing: 11)], spacing: 11) {
                        ForEach(designs) { design in
                            Button {
                                if selectedId == nil { pendingTrophy = design }
                            } label: {
                                VStack(spacing: 9) {
                                    Image(design.image).resizable().scaledToFill().frame(height: 172).clipped()
                                    VStack(spacing: 4) {
                                        Text(design.name.uppercased()).font(.system(size: 12, weight: .black)).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.72)
                                        Text(design.line).font(.system(size: 9, weight: .semibold)).foregroundStyle(.white.opacity(0.48)).multilineTextAlignment(.center).lineLimit(3)
                                    }.padding(.horizontal, 8).padding(.bottom, 10)
                                }
                                .frame(maxWidth: .infinity, minHeight: 255, alignment: .top)
                                .background(.black.opacity(0.84), in: RoundedRectangle(cornerRadius: membership.leagues.sportId.lowercased() == "nfl" ? 7 : 18))
                                .overlay(RoundedRectangle(cornerRadius: membership.leagues.sportId.lowercased() == "nfl" ? 7 : 18).stroke(selectedId == design.id ? (membership.leagues.sportId.lowercased() == "nfl" ? .cyan : .green) : (membership.leagues.sportId.lowercased() == "nfl" ? .blue.opacity(0.55) : .yellow.opacity(0.30)), lineWidth: selectedId == design.id ? 3 : 1))
                                .overlay(alignment: .topTrailing) {
                                    if selectedId == design.id {
                                        Text("SELECTED").font(.system(size: 7, weight: .black)).tracking(1).foregroundStyle(membership.leagues.sportId.lowercased() == "nfl" ? .white : .black).padding(.horizontal, 8).padding(.vertical, 5).background(membership.leagues.sportId.lowercased() == "nfl" ? Color.blue : Color.green, in: Capsule()).padding(8)
                                    }
                                }
                            }
                            .buttonStyle(.plain).disabled(selectedId != nil || saving)
                        }
                    }
                    if let errorMessage { Label(errorMessage, systemImage: "exclamationmark.triangle.fill").font(.footnote).foregroundStyle(.red) }
                    Text("NO GENERIC CUP WILL BE SUBSTITUTED. THE DATABASE KEEPS THE RECEIPT.")
                        .font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(.white.opacity(0.30)).frame(maxWidth: .infinity).padding(.vertical, 12)
                }
                .padding(16).padding(.bottom, 24)
            }
        }
        .navigationTitle("Championship Trophy")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { selectedId = membership.leagues.championshipTrophyId }
        .alert("Seal \(pendingTrophy?.name ?? "this trophy") in the vault?", isPresented: Binding(get: { pendingTrophy != nil }, set: { if !$0 { pendingTrophy = nil } })) {
            Button("Not yet", role: .cancel) { pendingTrophy = nil }
            if let trophy = pendingTrophy {
                Button("LOCK THE HARDWARE") { Task { await save(trophy) } }
            }
        } message: {
            Text("This becomes the season’s permanent championship design. The winner gets this exact artifact beside their name and in their profile forever.")
        }
    }

    private func save(_ trophy: TrophyDesign) async {
        guard let token = auth.token else { return }
        saving = true
        do {
            try await SupabaseAPI.selectChampionshipTrophy(token: token, leagueId: membership.leagueId, trophyId: trophy.id)
            selectedId = trophy.id
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
        self.pendingTrophy = nil
        saving = false
    }
}

private struct TrophyDesign: Identifiable {
    let id: String
    let name: String
    let image: String
    let line: String
}

private struct HomeMetric: View {
    let value: String
    let label: String
    var body: some View {
        VStack(spacing: 5) {
            Text(value).font(.title2.weight(.black)).monospacedDigit().foregroundStyle(.white)
            Text(label).font(.system(size: 9, weight: .black)).tracking(1.1).foregroundStyle(.green).minimumScaleFactor(0.65)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 14)
        .background(.black.opacity(0.72), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 14, bottomTrailingRadius: 4, topTrailingRadius: 14))
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 14, bottomTrailingRadius: 4, topTrailingRadius: 14).stroke(.green.opacity(0.28)))
    }
}

private struct HomeCommandHeader: View {
    let name: String
    let sport: String
    let week: Int?
    let dateRange: String?
    let commissioner: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                HStack(spacing: 8) {
                    Circle().fill(.green).frame(width: 7, height: 7).shadow(color: .green, radius: 7)
                    Text("WAR ROOM // LIVE").font(.system(size: 10, weight: .black)).tracking(2.3).foregroundStyle(.green)
                }
                Spacer()
                if commissioner {
                    Label("COMMAND", systemImage: "star.fill")
                        .font(.system(size: 9, weight: .black)).tracking(1.1)
                        .padding(.horizontal, 9).padding(.vertical, 6)
                        .foregroundStyle(.black).background(.yellow, in: Capsule())
                }
            }
            HStack(alignment: .center, spacing: 14) {
                ZStack {
                    UnevenRoundedRectangle(topLeadingRadius: 5, bottomLeadingRadius: 17, bottomTrailingRadius: 5, topTrailingRadius: 17)
                        .fill(LinearGradient(colors: [.green, .green.opacity(0.25)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    Image(systemName: "shield.lefthalf.filled").font(.title.weight(.black)).foregroundStyle(.black)
                }.frame(width: 52, height: 52).shadow(color: .green.opacity(0.35), radius: 14)
                VStack(alignment: .leading, spacing: 3) {
                    Text(name.uppercased()).font(.system(size: 25, weight: .black)).fontWidth(.condensed).lineLimit(2).minimumScaleFactor(0.75)
                    if let week, let dateRange {
                        Text("\(sport)  /  WEEK \(week)  /  \(dateRange)")
                            .font(.system(size: 10, weight: .black)).tracking(1.15).foregroundStyle(.white.opacity(0.55))
                    } else {
                        Text(sport).font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(.white.opacity(0.45))
                    }
                }
            }
        }
        .padding(18)
        .background {
            ZStack(alignment: .trailing) {
                LinearGradient(colors: [.black.opacity(0.76), Color(red: 0.02, green: 0.16, blue: 0.07).opacity(0.60)], startPoint: .leading, endPoint: .trailing)
                Text("WR").font(.system(size: 90, weight: .black)).fontWidth(.condensed).foregroundStyle(.white.opacity(0.025)).offset(x: 8)
            }
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 5, bottomLeadingRadius: 24, bottomTrailingRadius: 5, topTrailingRadius: 24))
        }
        .overlay(alignment: .leading) { Rectangle().fill(.green).frame(width: 3).padding(.vertical, 12) }
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 5, bottomLeadingRadius: 24, bottomTrailingRadius: 5, topTrailingRadius: 24).stroke(.green.opacity(0.36)))
        .shadow(color: .green.opacity(0.15), radius: 24, y: 10)
    }
}

private struct HomeSectionLabel: View {
    let title: String
    let detail: String
    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Rectangle().fill(.green).frame(width: 22, height: 2)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 11, weight: .black)).tracking(2).foregroundStyle(.white)
                Text(detail).font(.system(size: 8, weight: .bold)).tracking(1).foregroundStyle(.white.opacity(0.35))
            }
        }.padding(.top, 4)
    }
}

private struct HomeOperationTile: View {
    let kicker: String
    let title: String
    let detail: String
    let icon: String
    let accent: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                Text(kicker).font(.system(size: 9, weight: .black)).tracking(1.8).foregroundStyle(accent)
                Spacer()
                Image(systemName: icon).font(.headline).foregroundStyle(accent)
            }
            Spacer(minLength: 4)
            Text(title).font(.headline.weight(.black)).lineLimit(1).minimumScaleFactor(0.75)
            Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, minHeight: 112, alignment: .leading)
        .padding(16)
        .background(.black.opacity(0.64), in: UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 18, bottomTrailingRadius: 3, topTrailingRadius: 18))
        .overlay(alignment: .bottomLeading) { Rectangle().fill(accent).frame(width: 42, height: 3).padding(.leading, 16) }
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 18, bottomTrailingRadius: 3, topTrailingRadius: 18).stroke(accent.opacity(0.3)))
    }
}

private struct PickOrderAlert: View {
    @State private var pulse = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                Text("DO THESE THREE THINGS")
                Spacer()
                Image(systemName: "exclamationmark.triangle.fill")
            }
            .font(.system(size: 15, weight: .black))
            .tracking(1.4)

            instruction("1", "MAKE YOUR PICKS")
            instruction("2", "SET EVERY CONFIDENCE POINT")
            instruction("3", "PICK ONE — AND ONLY ONE — BEST BET")
        }
        .foregroundStyle(.yellow)
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.black.opacity(0.94), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.yellow.opacity(pulse ? 1 : 0.48), lineWidth: pulse ? 5 : 2))
        .shadow(color: .yellow.opacity(pulse ? 0.62 : 0.22), radius: pulse ? 24 : 10)
        .animation(.easeInOut(duration: 0.75).repeatForever(autoreverses: true), value: pulse)
        .onAppear { pulse = true }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Do these three things. One, make your picks. Two, set every confidence point. Three, pick one and only one Best Bet.")
    }

    private func instruction(_ number: String, _ text: String) -> some View {
        HStack(spacing: 12) {
            Text(number)
                .font(.system(size: 18, weight: .black))
                .foregroundStyle(.black)
                .frame(width: 34, height: 34)
                .background(.yellow, in: Circle())
            Text(text)
                .font(.system(size: 17, weight: .black))
                .tracking(0.6)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private func footballWeekDateRangeLabel(sportId: String, week: Int) -> String {
    let nfl = sportId.lowercased() == "nfl"
    let fixed: [Int: (String, String)] = nfl ? [
        19: ("2027-01-16", "2027-01-18"), 20: ("2027-01-23", "2027-01-24"),
        21: ("2027-01-31", "2027-02-01"), 22: ("2027-02-14", "2027-02-14"),
    ] : [
        0: ("2026-08-27", "2026-09-02"),
        15: ("2026-12-18", "2026-12-21"), 16: ("2026-12-31", "2027-01-02"),
        17: ("2027-01-08", "2027-01-11"), 18: ("2027-01-18", "2027-01-20"),
    ]
    let parser = DateFormatter()
    parser.calendar = Calendar(identifier: .gregorian)
    parser.locale = Locale(identifier: "en_US_POSIX")
    parser.timeZone = TimeZone(secondsFromGMT: 0)
    parser.dateFormat = "yyyy-MM-dd"
    var start: Date?
    var end: Date?
    if let dates = fixed[week] {
        start = parser.date(from: dates.0); end = parser.date(from: dates.1)
    } else if (nfl && (1...18).contains(week)) || (!nfl && (1...14).contains(week)) {
        let base = parser.date(from: nfl ? "2026-09-10" : "2026-09-03")!
        var utcCalendar = Calendar(identifier: .gregorian); utcCalendar.timeZone = TimeZone(secondsFromGMT: 0)!
        if nfl, let slate = NflSeasonTimeline.regularSeasonSlate(week: week, openingThursday: base, calendar: utcCalendar) {
            start = slate.start
            end = slate.end
        } else if week >= 2,
                  let weekTwoTuesday = parser.date(from: "2026-09-08"),
                  let espnWeek = CfbWeekTimeline.espnWeek(week: week, weekTwoTuesday: weekTwoTuesday, calendar: utcCalendar) {
            start = espnWeek.start
            end = espnWeek.end
        } else {
            start = base
            end = utcCalendar.date(byAdding: .day, value: 4, to: base)
        }
    }
    guard let start, let end else { return "DATES TO BE ANNOUNCED" }
    let monthDay = DateFormatter(); monthDay.locale = Locale(identifier: "en_US"); monthDay.timeZone = TimeZone(secondsFromGMT: 0); monthDay.dateFormat = "MMM d"
    let endFormat = DateFormatter(); endFormat.locale = Locale(identifier: "en_US")
    endFormat.timeZone = TimeZone(secondsFromGMT: 0)
    var comparisonCalendar = Calendar(identifier: .gregorian); comparisonCalendar.timeZone = TimeZone(secondsFromGMT: 0)!
    endFormat.dateFormat = comparisonCalendar.component(.month, from: start) == comparisonCalendar.component(.month, from: end) ? "d" : "MMM d"
    return "\(monthDay.string(from: start).uppercased())–\(endFormat.string(from: end).uppercased())"
}

func footballKickoffDate(_ value: String?) -> Date? {
    guard let value else { return nil }
    let formatter = ISO8601DateFormatter()
    if let date = formatter.date(from: value) { return date }
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: value) { return date }
    var postgresValue = value.replacingOccurrences(of: " ", with: "T", options: [], range: value.range(of: " "))
    if postgresValue.range(of: #"[+-]\d{2}$"#, options: .regularExpression) != nil {
        postgresValue += ":00"
    }
    return formatter.date(from: postgresValue)
}

func boardGameIsDeclassified(startTime: String?, at date: Date, weekScored: Bool) -> Bool {
    weekScored || footballKickoffDate(startTime).map { $0 <= date } == true
}

private struct KickoffCountdownView: View {
    let kickoff: Date
    let sportId: String
    let week: Int

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            let seconds = max(0, Int(kickoff.timeIntervalSince(timeline.date)))
            let locked = kickoff <= timeline.date
            let isNFL = sportId.lowercased() == "nfl"
            let accent: Color = locked || seconds < 3600 ? .red : (seconds < 86400 ? (isNFL ? .cyan : .yellow) : (isNFL ? .blue : .green))
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("MISSION CLOCK · \(sportId.uppercased()) WEEK \(week)")
                        .font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(.secondary)
                    Text(locked ? "CARD CLOSED · GAMES UNDERWAY" : "FIRST KICKOFF")
                        .font(.caption.weight(.black)).foregroundStyle(accent)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text(locked ? "LOCKED" : countdown(seconds))
                        .font(.title2.weight(.black).monospacedDigit())
                    Text(kickoff.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption2.weight(.bold)).foregroundStyle(.secondary)
                }
            }
            .padding(16)
            .background(accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.5)))
            .accessibilityElement(children: .combine)
        }
    }

    private func countdown(_ total: Int) -> String {
        let days = total / 86400
        let hours = (total % 86400) / 3600
        let minutes = (total % 3600) / 60
        let seconds = total % 60
        return days > 0 ? "\(days)d \(hours)h \(minutes)m" : String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }
}

private struct CrystalBallView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    @State private var team = ""
    @State private var saving = false
    @State private var loading = true
    @State private var savedTeam: String?
    @State private var editing = false
    @State private var teamSearch = ""
    @State private var lockAt: Date?
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            if isNFL { NflHomeBackdrop(phase: .regularSeason) }
            else {
                Color.black.ignoresSafeArea()
                RadialGradient(colors: [.green.opacity(0.23), .black], center: .top, startRadius: 20, endRadius: 560).ignoresSafeArea()
            }
            ScrollView {
                if let savedTeam, !editing {
                    VStack(spacing: 18) {
                        Text(isNFL ? "SUPER BOWL FUTURES · SEALED" : "SEALED PROPHECY").font(.system(size: 9, weight: .black)).tracking(2.2).foregroundStyle(isNFL ? .cyan : .green)
                        crystalBallArtifact.frame(width: 138, height: 138)
                        VStack(spacing: 7) {
                            Text(savedTeam.uppercased()).font(.system(size: 34, weight: .black)).fontWidth(.condensed).multilineTextAlignment(.center)
                            Label("RECEIPT SECURED", systemImage: "checkmark.seal.fill")
                                .font(.caption.weight(.black)).tracking(1).foregroundStyle(isNFL ? .cyan : .green)
                        }
                        CrystalBallDeadlineView(lockAt: lockAt, sportId: membership.leagues.sportId)
                        if canChange {
                            Button {
                                editing = true
                                errorMessage = nil
                            } label: {
                                HStack { Spacer(); Label("CHANGE PICK", systemImage: "pencil.line").fontWeight(.black); Spacer() }
                                    .padding(.vertical, 14).foregroundStyle(isNFL ? .white : .black).background(isNFL ? Color.blue : Color.yellow, in: RoundedRectangle(cornerRadius: isNFL ? 6 : 14))
                            }.buttonStyle(.plain)
                            Text("Changes stay open until the opening kickoff clock reaches zero.")
                                .font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.52)).multilineTextAlignment(.center)
                        } else {
                            Label("PICK LOCKED · NO TAKE-BACKS", systemImage: "lock.fill")
                                .font(.caption.weight(.black)).tracking(1).foregroundStyle(.red)
                                .padding(12).frame(maxWidth: .infinity)
                                .background(.red.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.red.opacity(0.45)))
                        }
                        Text("ZERO POINTS. PERMANENT EVIDENCE.")
                            .font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(.white.opacity(0.30))
                    }
                    .padding(24).padding(.bottom, 20)
                } else {
                    VStack(spacing: 18) {
                    VStack(spacing: 7) {
                        Text(isNFL ? "SUPER BOWL FUTURES DESK" : "PRESEASON INTELLIGENCE DIVISION").font(.system(size: 9, weight: .black)).tracking(2).foregroundStyle(isNFL ? .cyan : .green)
                        Text("THE CRYSTAL BALL").font(.system(size: 34, weight: .black)).fontWidth(.condensed)
                        Text(isNFL ? "CALL THE SUPER BOWL CHAMPION BEFORE WEEK 1 KICKS OFF." : "CALL THE NATIONAL CHAMPION BEFORE THE RECEIPTS EXIST.")
                            .font(.caption.weight(.black)).tracking(0.8).foregroundStyle(.white.opacity(0.58)).multilineTextAlignment(.center)
                    }

                    crystalBallArtifact.frame(maxWidth: 330, maxHeight: 330)

                    CrystalBallDeadlineView(lockAt: lockAt, sportId: membership.leagues.sportId)

                    VStack(alignment: .leading, spacing: 10) {
                        Text(savedTeam == nil ? "YOUR PROPHECY" : "REVISE PROPHECY")
                            .font(.caption2.weight(.black)).tracking(1.8).foregroundStyle(isNFL ? .cyan : .yellow)
                        CrystalBallTeamSelector(sportId: membership.leagues.sportId, selection: $team, search: $teamSearch)
                        Text(isNFL ? "Zero standings points. One permanent Sunday Oracle trophy if you call the Super Bowl champion. Unlimited ‘I told you so’ privileges." : "Zero standings points. One permanent Village Nerd trophy if you are right. Unlimited ‘I told you so’ privileges.")
                            .font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.62)).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(16).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: isNFL ? 7 : 18))
                    .overlay(RoundedRectangle(cornerRadius: isNFL ? 7 : 18).stroke((isNFL ? Color.cyan : Color.green).opacity(0.34)))

                    Button { Task { await save() } } label: {
                        HStack {
                            Spacer()
                            if saving { ProgressView().tint(.black) }
                            else { Label(savedTeam == nil ? "LOCK CRYSTAL BALL" : "UPDATE PROPHECY", systemImage: "lock.shield.fill").fontWeight(.black) }
                            Spacer()
                        }
                        .padding(.vertical, 15).foregroundStyle(isNFL ? .white : .black).background(isNFL ? Color.blue : Color.yellow, in: RoundedRectangle(cornerRadius: isNFL ? 6 : 14))
                    }
                    .buttonStyle(.plain)
                    .disabled(cleanTeam.isEmpty || saving || loading || !canChange || cleanTeam.caseInsensitiveCompare(savedTeam ?? "") == .orderedSame)
                    .opacity(cleanTeam.isEmpty || saving || loading || !canChange || cleanTeam.caseInsensitiveCompare(savedTeam ?? "") == .orderedSame ? 0.45 : 1)

                    if loading { ProgressView("Consulting the evidence vault…").tint(isNFL ? .cyan : .green).foregroundStyle(.secondary) }
                    if let savedTeam {
                        Label("CURRENT RECEIPT · \(savedTeam.uppercased())", systemImage: "checkmark.seal.fill")
                            .font(.caption.weight(.black)).foregroundStyle(isNFL ? .cyan : .green).multilineTextAlignment(.center)
                    }
                    if let errorMessage { Text(errorMessage).font(.footnote.weight(.bold)).foregroundStyle(.red).multilineTextAlignment(.center) }
                    Text("THE ROOM WILL REMEMBER. ACCURACY OPTIONAL. CONFIDENCE MANDATORY.")
                        .font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(.white.opacity(0.32)).multilineTextAlignment(.center)
                    }
                    .padding(20).padding(.bottom, 20)
                }
            }
        }
        .navigationTitle("Crystal Ball").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark)
        .task {
            guard let token = auth.token, let user = auth.user else { return }
            let openingWeek = membership.leagues.sportId.lowercased() == "nfl" ? 1 : 0
            async let loadedPick = SupabaseAPI.crystalBallPick(token: token, leagueId: membership.leagueId, userId: user.id)
            async let loadedCard = SupabaseAPI.weekCard(token: token, leagueId: membership.leagueId, weekNumber: openingWeek)
            let existing = (try? await loadedPick)?.teamName
            let card = try? await loadedCard
            team = existing ?? ""
            savedTeam = existing
            lockAt = card?.cardGames.compactMap { footballKickoffDate($0.startTime) }.min() ?? footballKickoffDate(card?.lockTime)
            loading = false
        }
    }

    private var cleanTeam: String { team.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var isNFL: Bool { membership.leagues.sportId.lowercased() == "nfl" }
    @ViewBuilder private var crystalBallArtifact: some View {
        if isNFL {
            ZStack {
                RoundedRectangle(cornerRadius: 24).fill(LinearGradient(colors: [.blue.opacity(0.34), .red.opacity(0.2), .black], startPoint: .topLeading, endPoint: .bottomTrailing))
                RoundedRectangle(cornerRadius: 24).stroke(.cyan.opacity(0.6), lineWidth: 2)
                VStack(spacing: 10) {
                    Image(systemName: "football.fill").font(.system(size: 58, weight: .black)).foregroundStyle(.white)
                    Text("SUNDAY ORACLE").font(.caption.weight(.black)).tracking(1.8).foregroundStyle(.cyan)
                }
            }.shadow(color: .blue.opacity(0.42), radius: 26)
        } else {
            Image("VillageNerdArtifact").resizable().scaledToFit()
                .clipShape(RoundedRectangle(cornerRadius: 22))
                .overlay(RoundedRectangle(cornerRadius: 22).stroke(.yellow.opacity(0.42), lineWidth: 2))
                .shadow(color: .green.opacity(0.38), radius: 26)
        }
    }
    private var canChange: Bool { lockAt.map { Date() < $0 } ?? true }

    private func save() async {
        guard let token = auth.token, let user = auth.user else { return }
        saving = true
        guard canChange else {
            errorMessage = "The opening kickoff has passed. The prophecy is sealed."
            saving = false
            return
        }
        do {
            try await SupabaseAPI.saveCrystalBallPick(token: token, leagueId: membership.leagueId, userId: user.id, teamName: cleanTeam)
            savedTeam = cleanTeam
            editing = false
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
        saving = false
    }
}

private struct CrystalBallTeamSelector: View {
    let sportId: String
    @Binding var selection: String
    @Binding var search: String

    private var teams: [FootballTeam] { FootballTeamCatalog.teams(for: sportId) }
    private var identity: SportIdentity { SportIdentity(sportId) }
    private var selectedTeam: FootballTeam? { teams.first { $0.name.caseInsensitiveCompare(selection) == .orderedSame } }
    private var results: [FootballTeam] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return query.isEmpty ? teams : teams.filter { $0.searchText.contains(query) }
    }

    var body: some View {
        VStack(spacing: 10) {
            if let selectedTeam {
                teamRow(selectedTeam, selected: true)
            }
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(identity.isNFL ? .cyan : .green)
                TextField(selectedTeam == nil ? "Search official teams" : "Search to change team", text: $search)
                    .textInputAutocapitalization(.words).autocorrectionDisabled().submitLabel(.done)
                if !search.isEmpty {
                    Button { search = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                }
            }
            .padding(13).background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 5 : 12).stroke((identity.isNFL ? Color.cyan : Color.green).opacity(0.55)))

            if selectedTeam == nil || !search.isEmpty {
                ScrollView {
                    LazyVStack(spacing: 7) {
                        ForEach(results) { candidate in
                            Button {
                                selection = candidate.name
                                search = ""
                            } label: { teamRow(candidate, selected: candidate == selectedTeam) }
                            .buttonStyle(.plain)
                        }
                        if results.isEmpty {
                            Text("NO OFFICIAL TEAM FOUND")
                                .font(.caption2.weight(.black)).tracking(1.2).foregroundStyle(.red).padding(18)
                        }
                    }
                }
                .frame(maxHeight: 260)
            }
        }
    }

    private func teamRow(_ candidate: FootballTeam, selected: Bool) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(candidate.color.opacity(0.20))
                Circle().stroke(candidate.color.opacity(0.75), lineWidth: 1.5)
                Text(candidate.mark).font(.system(size: 11, weight: .black, design: .rounded)).foregroundStyle(candidate.color)
            }.frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(candidate.name.uppercased()).font(.subheadline.weight(.black)).foregroundStyle(.white)
                Text("\(candidate.shortName.uppercased()) · \(candidate.conference.uppercased())")
                    .font(.system(size: 8, weight: .black)).tracking(0.8).foregroundStyle(.white.opacity(0.46))
            }
            Spacer()
            if selected { Image(systemName: "checkmark.seal.fill").foregroundStyle(identity.isNFL ? .cyan : .green) }
            else { Image(systemName: "chevron.right").font(.caption.weight(.black)).foregroundStyle(.white.opacity(0.25)) }
        }
        .padding(10).background(selected ? (identity.isNFL ? Color.blue : Color.green).opacity(0.13) : .black.opacity(0.42), in: RoundedRectangle(cornerRadius: identity.isNFL ? 5 : 11))
        .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 5 : 11).stroke(selected ? (identity.isNFL ? Color.cyan : Color.green).opacity(0.55) : .white.opacity(0.08)))
        .contentShape(Rectangle())
    }
}

private struct CrystalBallDeadlineView: View {
    let lockAt: Date?
    var sportId: String = "cfb"
    private var identity: SportIdentity { SportIdentity(sportId) }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            let remaining = lockAt.map { max(0, Int($0.timeIntervalSince(timeline.date))) }
            let locked = remaining == 0
            HStack(spacing: 12) {
                Image(systemName: locked ? "lock.fill" : "timer").font(.title2.weight(.black)).foregroundStyle(locked ? .red : (identity.isNFL ? .cyan : .green))
                VStack(alignment: .leading, spacing: 3) {
                    Text(locked ? "CRYSTAL BALL LOCKED" : "CHANGES CLOSE AT KICKOFF")
                        .font(.caption2.weight(.black)).tracking(1.2).foregroundStyle(locked ? .red : (identity.isNFL ? .cyan : .green))
                    Text(remaining.map(countdown) ?? "OPENING KICKOFF PENDING")
                        .font(.title3.weight(.black).monospacedDigit())
                    if let lockAt { Text(lockAt.formatted(date: .abbreviated, time: .shortened)).font(.caption2.weight(.bold)).foregroundStyle(.secondary) }
                }
                Spacer()
            }
            .padding(14).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 15))
            .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 15).stroke((locked ? Color.red : (identity.isNFL ? Color.cyan : Color.green)).opacity(0.42)))
        }
    }

    private func countdown(_ total: Int) -> String {
        let days = total / 86_400
        let hours = (total % 86_400) / 3_600
        let minutes = (total % 3_600) / 60
        let seconds = total % 60
        return days > 0 ? "\(days)d \(hours)h \(minutes)m" : String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }
}

private struct CommissionerGameDraft: Identifiable {
    let id = UUID()
    var away = ""
    var home = ""
    var spread = ""
    var favorite = "away"
    var kickoff = Date().addingTimeInterval(86400)
    var isRivalry = false
}

private struct AutomaticPropPreset: Identifiable {
    let id: String
    let label: String
    let question: String
    let yes: String
    let no: String
    var sport: String? = nil
    var week: Int? = nil
}

private let automaticFootballProps: [AutomaticPropPreset] = [
    .init(id: "close7", label: "3+ games decided by 7 or fewer", question: "Will at least 3 of the 5 games be decided by 7 or fewer points?", yes: "Yes — at least 3", no: "No — 2 or fewer"),
    .init(id: "close3", label: "3+ games decided by 3 or fewer", question: "Will at least 3 of the 5 games be decided by 3 or fewer points?", yes: "Yes — at least 3", no: "No — 2 or fewer"),
    .init(id: "dogcover", label: "Any underdog covers", question: "Using the locked half-point spreads, will any underdog cover?", yes: "Yes — a dog covers", no: "No — no dog covers"),
    .init(id: "fav3", label: "Favorites cover 3+ games", question: "Will favorites cover at least 3 of the 5 games?", yes: "Yes — favorites cover 3+", no: "No — favorites cover 2 or fewer"),
    .init(id: "over55", label: "Any game totals 56+", question: "Will any game finish with a combined score of 56 or more?", yes: "Yes — at least one totals 56+", no: "No — every total is 55 or less"),
    .init(id: "under40", label: "Any game totals 40 or fewer", question: "Will any game finish with a combined score of 40 or fewer?", yes: "Yes — at least one totals 40 or fewer", no: "No — every total is 41+"),
    .init(id: "high61", label: "Highest game total is 61+", question: "Will the highest combined final score among the five games be 61 or more?", yes: "Yes — highest is 61+", no: "No — highest is 60 or less"),
    .init(id: "sum281", label: "Five-game total is 281+", question: "Will the sum of all five combined final scores be 281 or more?", yes: "Yes — combined is 281+", no: "No — combined is 280 or less"),
    .init(id: "margin21", label: "Any winning margin is 21+", question: "Will any game be decided by 21 or more points?", yes: "Yes — a margin is 21+", no: "No — every margin is 20 or less"),
    .init(id: "team9", label: "Any team scores 9 or fewer", question: "Will any team finish with 9 or fewer points?", yes: "Yes — a team scores 9 or fewer", no: "No — every team scores 10+"),
    .init(id: "team46", label: "Any team scores 46+", question: "Will any team finish with 46 or more points?", yes: "Yes — a team scores 46+", no: "No — every team scores 45 or less"),
    .init(id: "both25", label: "Both teams score 25+", question: "Will any game end with both teams scoring at least 25 points?", yes: "Yes — both teams reach 25", no: "No — never both"),
    .init(id: "chalk", label: "All five favorites cover", question: "Will the favorite cover all five games?", yes: "Yes — chalk sweep", no: "No — chalk fails"),
    .init(id: "dogs", label: "All five underdogs cover", question: "Will every underdog cover all five games?", yes: "Yes — dog sweep", no: "No — not a full sweep"),
    .init(id: "shutout", label: "Any team is shut out", question: "Will any team finish with exactly 0 points?", yes: "Yes — somebody scores 0", no: "No — everybody scores"),
    .init(id: "fifty", label: "Any team scores 50+", question: "Will any team score 50 or more points?", yes: "Yes — a team scores 50+", no: "No — every team scores 49 or less"),
    .init(id: "tie", label: "Any game ends tied", question: "Will any game finish with equal home and away scores?", yes: "Yes — at least one tie", no: "No — every game has a winner"),
    .init(id: "sum200", label: "Five-game total is 200 or fewer", question: "Will the sum of all five combined final scores be 200 or fewer?", yes: "Yes — combined is 200 or fewer", no: "No — combined is 201+"),
    .init(id: "homesweep", label: "Home teams go 5–0", question: "Will the home team win all five games straight up?", yes: "Yes — home goes 5–0", no: "No — home loses one"),
    .init(id: "roadsweep", label: "Road teams go 5–0", question: "Will the away team win all five games straight up?", yes: "Yes — road goes 5–0", no: "No — road loses one"),
    .init(id: "cfb71", label: "Any game totals 71+", question: "Will any game finish with a combined score of 71 or more?", yes: "Yes — a total reaches 71+", no: "No — every total is 70 or less", sport: "cfb"),
    .init(id: "cfb56", label: "Any team scores 56+", question: "Will any team finish with 56 or more points?", yes: "Yes — a team scores 56+", no: "No — every team scores 55 or less", sport: "cfb"),
    .init(id: "cfb35", label: "Any winning margin is 35+", question: "Will any game be decided by 35 or more points?", yes: "Yes — a margin is 35+", no: "No — every margin is 34 or less", sport: "cfb"),
    .init(id: "cfbboth30", label: "Both teams score 30+", question: "Will any game end with both teams scoring at least 30 points?", yes: "Yes — both teams reach 30", no: "No — never both", sport: "cfb"),
    .init(id: "cfb60", label: "Any team drops a 60-burger", question: "Will any team score 60 or more points?", yes: "Yes — a team scores 60+", no: "No — every team scores 59 or less", sport: "cfb"),
    .init(id: "cfbbigdog", label: "Any 14+ underdog covers", question: "Will any underdog listed at +14 or more cover?", yes: "Yes — a big dog covers", no: "No — no big dog covers", sport: "cfb"),
    .init(id: "cfbhomedogs", label: "2+ home underdogs win", question: "Will at least 2 home underdogs win straight up?", yes: "Yes — 2+ home dogs win", no: "No — 1 or fewer", sport: "cfb"),
    .init(id: "hateweekdogs", label: "Rivalry dogs bite twice", question: "Will at least 2 rivalry underdogs win outright during Hate Week?", yes: "Yes — 2+ grudges erupt", no: "No — chalk survives", sport: "cfb", week: 13),
    .init(id: "hateweekknife", label: "One grudge decided by 3", question: "Will a designated rivalry game be decided by 3 points or fewer?", yes: "Yes — family therapy required", no: "No — somebody runs away", sport: "cfb", week: 13),
    .init(id: "hateweekovertime", label: "Rivalry overtime chaos", question: "Will any designated rivalry game go to overtime?", yes: "Yes — hatred needs extras", no: "No — regulation settles it", sport: "cfb", week: 13),
    .init(id: "nfl35", label: "Any game totals 35 or fewer", question: "Will any game finish with a combined score of 35 or fewer?", yes: "Yes — a total is 35 or fewer", no: "No — every total is 36+", sport: "nfl"),
    .init(id: "nfl13", label: "Any team scores 13 or fewer", question: "Will any team finish with 13 or fewer points?", yes: "Yes — a team scores 13 or fewer", no: "No — every team scores 14+", sport: "nfl"),
    .init(id: "nfl51", label: "Any game totals 51+", question: "Will any game finish with a combined score of 51 or more?", yes: "Yes — a total reaches 51+", no: "No — every total is 50 or less", sport: "nfl"),
    .init(id: "nfl14", label: "Any winning margin is 14+", question: "Will any game be decided by 14 or more points?", yes: "Yes — a margin is 14+", no: "No — every margin is 13 or less", sport: "nfl"),
    .init(id: "nfl3", label: "Any team scores exactly 3", question: "Will any team finish with exactly 3 points?", yes: "Yes — somebody finishes on 3", no: "No — nobody finishes on 3", sport: "nfl"),
    .init(id: "nfl17", label: "Any team scores exactly 17", question: "Will any team finish with exactly 17 points?", yes: "Yes — somebody finishes on 17", no: "No — nobody finishes on 17", sport: "nfl"),
    .init(id: "nfldogs", label: "2+ underdogs win straight up", question: "Will at least 2 underdogs win straight up?", yes: "Yes — 2+ dogs win", no: "No — 1 or fewer", sport: "nfl"),
]

struct CommissionerCardBuilderView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let membership: LeagueMembership
    @State private var step = 1
    @State private var games = (0..<5).map { _ in CommissionerGameDraft() }
    @State private var propQuestion = ""
    @State private var propA = ""
    @State private var propB = ""
    @State private var propPoints = 3
    @State private var selectedPropId = ""
    @State private var publishing = false
    @State private var pullingOdds = false
    @State private var availableOdds: [OddsGame] = []
    @State private var selectedOddsIds: Set<String> = []
    @State private var roomFavoriteTeamIds: [String] = []
    @State private var oddsNotice: String?
    @State private var errorMessage: String?
    private var identity: SportIdentity { SportIdentity(membership.leagues.sportId) }
    private var deskAccent: Color { identity.isNFL ? .cyan : .green }

    private var isRivalryWeek: Bool {
        membership.leagues.sportId.lowercased() == "cfb" && membership.leagues.currentWeek == 13
    }

    var body: some View {
        Form {
            Section {
                Label("COMMISSIONER MODE", systemImage: "hammer.fill").font(.caption.weight(.black)).foregroundStyle(.red)
                Text("Build \(membership.leagues.sportId.uppercased()) Week \(membership.leagues.currentWeek)").font(.title2.weight(.black))
                Label(footballWeekDateRangeLabel(sportId: membership.leagues.sportId, week: membership.leagues.currentWeek), systemImage: "calendar")
                    .font(.subheadline.weight(.bold)).foregroundStyle(deskAccent)
                Text("Four steps. One decision at a time.").foregroundStyle(.secondary)
                if isRivalryWeek {
                    Label("RIVALRY WEEK CONTROL · ONLY THE GRUDGES GET THE RED LIGHT", systemImage: "flame.fill")
                        .font(.caption.weight(.black)).foregroundStyle(.red)
                }
                HStack(spacing: 5) {
                    ForEach(1...4, id: \.self) { number in
                        Text(step > number ? "✓" : "\(number) \(stepLabel(number))")
                            .font(.caption2.weight(.black))
                            .foregroundStyle(step == number ? (identity.isNFL ? .white : .black) : (step > number ? deskAccent : .secondary))
                            .frame(maxWidth: .infinity).padding(.vertical, 8)
                            .background(step == number ? (identity.isNFL ? Color.blue : Color.green) : .white.opacity(0.06), in: RoundedRectangle(cornerRadius: identity.isNFL ? 4 : 8))
                    }
                }
            }
            if step == 1 { Section("Odds desk") {
                HStack {
                    Label("THE ODDS API", systemImage: "network")
                    Spacer()
                    Text("SERVER-SIDE").font(.caption2.weight(.black)).foregroundStyle(deskAccent)
                }
                Text("The key stays in War Room’s vault. The app only receives the board.")
                    .font(.caption).foregroundStyle(.secondary)
                Button {
                    Task { await pullOdds() }
                } label: {
                    HStack {
                        Spacer()
                        if pullingOdds { ProgressView() }
                        else { Label("PULL ODDS", systemImage: "arrow.down.circle.fill").fontWeight(.black) }
                        Spacer()
                    }
                }
                .buttonStyle(.borderedProminent).tint(identity.isNFL ? .blue : .green).disabled(pullingOdds)
                if let oddsNotice { Text(oddsNotice).font(.footnote).foregroundStyle(deskAccent) }
                if !availableOdds.isEmpty {
                    Button("CONTINUE · \(availableOdds.count) GAMES") { step = 2 }
                        .frame(maxWidth: .infinity).fontWeight(.black)
                }
            }
            }
            if step == 2 && !availableOdds.isEmpty {
                Section("Choose five · \(selectedOddsIds.count)/5") {
                    ForEach(availableOdds) { odds in
                        let rivalry = RivalryMatchupCatalog.match(away: odds.awayTeam, home: odds.homeTeam)
                        Button {
                            toggleOdds(odds)
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: selectedOddsIds.contains(odds.id) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(selectedOddsIds.contains(odds.id) ? deskAccent : .secondary)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("\(rank(odds.awayTeam, odds.awayRank)) at \(rank(odds.homeTeam, odds.homeRank))")
                                        .fontWeight(.semibold).foregroundStyle(favoriteCount(for: odds) > 0 ? Color.blue : Color.primary)
                                    Text(oddsLine(odds)).font(.caption).foregroundStyle(.secondary)
                                    if let rivalry, isRivalryWeek {
                                        Label("\(rivalry.glyph) \(rivalry.name.uppercased()) · CERTIFIED GRUDGE", systemImage: "flame.fill")
                                            .font(.caption2.weight(.black)).foregroundStyle(.red)
                                    }
                                    if favoriteCount(for: odds) > 0 {
                                        Label("\(favoriteCount(for: odds)) room favorite\(favoriteCount(for: odds) == 1 ? "" : "s")", systemImage: "heart.fill")
                                            .font(.caption2.weight(.black)).foregroundStyle(.blue)
                                    }
                                }
                                Spacer()
                            }
                            .padding(.vertical, rivalry != nil && isRivalryWeek ? 8 : 0)
                            .padding(.horizontal, rivalry != nil && isRivalryWeek ? 8 : 0)
                            .background((rivalry != nil && isRivalryWeek ? Color.red.opacity(0.12) : Color.clear), in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(rivalry != nil && isRivalryWeek ? Color.red.opacity(0.75) : Color.clear, lineWidth: 2))
                        }
                        .foregroundStyle(.primary)
                        .disabled(!selectedOddsIds.contains(odds.id) && selectedOddsIds.count >= 5)
                    }
                    HStack {
                        Button("BACK") { step = 1 }
                        Spacer()
                        Button("NEXT · PROP") { prepareProp(); step = 3 }.fontWeight(.black).disabled(selectedOddsIds.count != 5)
                    }
                }
            }
            if step == 2 && availableOdds.isEmpty { ForEach($games) { $game in
                Section("Game \((games.firstIndex(where: { $0.id == game.id }) ?? 0) + 1)") {
                    TextField("Away team", text: $game.away).textInputAutocapitalization(.words)
                    TextField("Home team", text: $game.home).textInputAutocapitalization(.words)
                    TextField("Spread (half-points only, example: 7.5)", text: $game.spread).keyboardType(.decimalPad)
                    if let spread = Double(game.spread), !isNoPushSpread(spread) {
                        Label("Use a half-point line so every game has a winner.", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption.weight(.bold)).foregroundStyle(.red)
                    }
                    Picker("Favorite", selection: $game.favorite) {
                        Text("Away").tag("away")
                        Text("Home").tag("home")
                    }.pickerStyle(.segmented)
                    if isRivalryWeek {
                        Toggle(isOn: $game.isRivalry) {
                            Label("DESIGNATED RIVALRY GAME", systemImage: "flame.fill")
                                .font(.caption.weight(.black)).foregroundStyle(.red)
                        }.tint(.red)
                    }
                    DatePicker("Kickoff", selection: $game.kickoff, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                }
            }
            Section { Button("BACK") { step = 1 } }
            }
            if step == 3 { Section("Automatic weekly prop") {
                Label("AUTOMATED SCORING READY", systemImage: "checkmark.seal.fill")
                    .font(.caption.weight(.black)).foregroundStyle(deskAccent)
                Text("Every option below settles from official final scores and the spreads already locked on the card.")
                    .font(.caption).foregroundStyle(.secondary)
                Picker("Choose a prop", selection: $selectedPropId) {
                    ForEach(availableAutomaticProps) { preset in
                        Text(preset.label).tag(preset.id)
                    }
                }
                .pickerStyle(.navigationLink)
                .onChange(of: selectedPropId) { _, _ in applySelectedProp() }
                if !propQuestion.isEmpty {
                    Text(propQuestion).font(.headline)
                    Text("\(propA)  /  \(propB)").font(.caption).foregroundStyle(.secondary)
                    Text("3 POINTS · AUTO-SCORED").font(.caption2.weight(.black)).foregroundStyle(deskAccent)
                }
                HStack {
                    Button("BACK") { step = 2 }
                    Spacer()
                    Button("PREVIEW") { step = 4 }.fontWeight(.black).disabled(!propIsComplete)
                }
            }
            }
            if step == 4 { Section("Week \(membership.leagues.currentWeek) preview") {
                if let firstKickoff = games.map(\.kickoff).min() {
                    KickoffCountdownView(kickoff: firstKickoff, sportId: membership.leagues.sportId, week: membership.leagues.currentWeek)
                }
                ForEach(Array(games.enumerated()), id: \.element.id) { index, game in
                    HStack {
                        Text("\(index + 1). \(game.away) at \(game.home)").fontWeight(.semibold)
                        if game.isRivalry || (isRivalryWeek && RivalryMatchupCatalog.match(away: game.away, home: game.home) != nil) { Spacer(); Text("🔥 GRUDGE").font(.caption2.weight(.black)).foregroundStyle(.red) }
                    }
                }
                Divider()
                Text(propQuestion).fontWeight(.semibold)
                Text("\(propA) / \(propB) · \(propPoints) points").font(.caption).foregroundStyle(.secondary)
            }
            Section {
                Button("BACK") { step = 3 }
                Button {
                    Task { await publish() }
                } label: {
                    HStack { Spacer(); if publishing { ProgressView() } else { Text("PUBLISH WEEK \(membership.leagues.currentWeek)").fontWeight(.black) }; Spacer() }
                }
                .disabled(!isComplete || publishing)
                .tint(.red)
                if !isComplete {
                    Label("Finish all five games and the prop. Almost only counts in horseshoes and bad parlays.", systemImage: "arrow.up.circle.fill")
                        .font(.footnote).foregroundStyle(identity.isNFL ? .red : .yellow)
                }
                if let errorMessage { Text(errorMessage).font(.footnote).foregroundStyle(.red) }
            }
            }
            if step != 4, let errorMessage {
                Section { Label(errorMessage, systemImage: "exclamationmark.triangle.fill").font(.footnote).foregroundStyle(.red) }
            }
        }
        .scrollContentBackground(.hidden)
        .background { if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) } }
        .tint(identity.isNFL ? .blue : .green)
        .task { await loadRoomFavorites() }
        .contentMargins(.bottom, 36, for: .scrollContent)
        .navigationTitle("Build Card")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
    }

    private var isComplete: Bool {
        games.allSatisfy {
            !$0.away.trimmingCharacters(in: .whitespaces).isEmpty
            && !$0.home.trimmingCharacters(in: .whitespaces).isEmpty
            && Double($0.spread).map(isNoPushSpread) == true
        }
        && !propQuestion.trimmingCharacters(in: .whitespaces).isEmpty
        && !propA.trimmingCharacters(in: .whitespaces).isEmpty
        && !propB.trimmingCharacters(in: .whitespaces).isEmpty
        && propA.trimmingCharacters(in: .whitespaces) != propB.trimmingCharacters(in: .whitespaces)
    }

    private func stepLabel(_ number: Int) -> String {
        ["ODDS", "GAMES", "PROP", "PREVIEW"][number - 1]
    }

    private var propIsComplete: Bool {
        !propQuestion.trimmingCharacters(in: .whitespaces).isEmpty
        && !propA.trimmingCharacters(in: .whitespaces).isEmpty
        && !propB.trimmingCharacters(in: .whitespaces).isEmpty
        && propA.trimmingCharacters(in: .whitespaces) != propB.trimmingCharacters(in: .whitespaces)
    }

    private var availableAutomaticProps: [AutomaticPropPreset] {
        let sport = membership.leagues.sportId.lowercased() == "nfl" ? "nfl" : "cfb"
        return automaticFootballProps.filter {
            ($0.sport == nil || $0.sport == sport)
            && ($0.week == nil || $0.week == membership.leagues.currentWeek)
        }
    }

    private func prepareProp() {
        if selectedPropId.isEmpty { selectedPropId = availableAutomaticProps.first?.id ?? "" }
        applySelectedProp()
    }

    private func applySelectedProp() {
        guard let preset = availableAutomaticProps.first(where: { $0.id == selectedPropId }) else { return }
        propQuestion = preset.question
        propA = preset.yes
        propB = preset.no
        propPoints = 3
    }

    private func pullOdds() async {
        guard let token = auth.token else { return }
        pullingOdds = true
        errorMessage = nil
        do {
            let feed = try await SupabaseAPI.footballOdds(token: token, leagueId: membership.leagueId, sportId: membership.leagues.sportId, weekNumber: membership.leagues.currentWeek)
            availableOdds = feed.games
            selectedOddsIds = []
            let quota = feed.remaining.map { " · \($0) API requests remain" } ?? ""
            oddsNotice = "Pulled \(feed.games.count) games\(quota). Pick five. Try to look decisive."
        } catch { errorMessage = error.localizedDescription }
        pullingOdds = false
    }

    private func toggleOdds(_ odds: OddsGame) {
        if selectedOddsIds.contains(odds.id) {
            selectedOddsIds.remove(odds.id)
        } else if selectedOddsIds.count < 5 {
            selectedOddsIds.insert(odds.id)
        }
        let chosen = availableOdds.filter { selectedOddsIds.contains($0.id) }
        for index in games.indices {
            guard index < chosen.count else { continue }
            let source = chosen[index]
            games[index].away = source.awayTeam
            games[index].home = source.homeTeam
            games[index].spread = String(format: "%.1f", noPushSpread(source.spread))
            games[index].favorite = source.favorite
            games[index].isRivalry = isRivalryWeek && RivalryMatchupCatalog.match(away: source.awayTeam, home: source.homeTeam) != nil
            if let iso = source.commenceTime, let date = ISO8601DateFormatter().date(from: iso) { games[index].kickoff = date }
        }
    }

    private func rank(_ team: String, _ rank: Int?) -> String { rank.map { "#\($0) \(team)" } ?? team }
    private func oddsLine(_ game: OddsGame) -> String {
        let favorite = game.favorite == "away" ? game.awayTeam : game.homeTeam
        let book = game.bookmaker.map { " · \($0)" } ?? ""
        return "\(favoriteSpreadLabel(favorite: favorite, spread: game.spread))\(book)"
    }

    private func favoriteCount(for game: OddsGame) -> Int {
        roomFavoriteTeamIds.reduce(into: 0) { count, teamId in
            guard let favorite = FootballTeamCatalog.team(forTeamId: teamId, sportId: membership.leagues.sportId) else { return }
            if FootballTeamCatalog.matches(game.awayTeam, favorite: favorite) || FootballTeamCatalog.matches(game.homeTeam, favorite: favorite) { count += 1 }
        }
    }

    @MainActor private func loadRoomFavorites() async {
        guard let token = auth.token else { return }
        let standings = (try? await SupabaseAPI.standings(token: token, leagueId: membership.leagueId)) ?? []
        let favorites = (try? await SupabaseAPI.favoriteTeams(token: token, userIds: standings.map(\.userId), sportId: membership.leagues.sportId)) ?? []
        roomFavoriteTeamIds = favorites.map(\.teamId)
    }

    private func publish() async {
        guard let token = auth.token else { return }
        publishing = true
        do {
            let formatter = ISO8601DateFormatter()
            let payload: [[String: Any]] = games.enumerated().map { index, game in
                ["sort_order": index, "away_team": game.away, "home_team": game.home, "spread": noPushSpread(Double(game.spread) ?? 0.5),
                 "favorite": game.favorite, "start_time": formatter.string(from: game.kickoff), "bookmaker": "Manual", "away_rank": NSNull(), "home_rank": NSNull(),
                 "is_rivalry": isRivalryWeek && (game.isRivalry || RivalryMatchupCatalog.match(away: game.away, home: game.home) != nil)]
            }
            try await SupabaseAPI.publishWeekCard(token: token, leagueId: membership.leagueId, weekNumber: membership.leagues.currentWeek, games: payload, propQuestion: propQuestion, propA: propA, propB: propB, propPoints: propPoints)
            dismiss()
        } catch { errorMessage = error.localizedDescription }
        publishing = false
    }
}

func noPushSpread(_ value: Double) -> Double {
    let halfPoint = (abs(value) * 2).rounded() / 2
    return halfPoint.truncatingRemainder(dividingBy: 1) == 0 ? halfPoint + 0.5 : halfPoint
}

func favoriteSpreadLabel(favorite: String, spread: Double) -> String {
    "\(favorite) -\(String(format: "%.1f", noPushSpread(spread)))"
}

func isNoPushSpread(_ value: Double) -> Bool {
    let magnitude = abs(value)
    guard magnitude.isFinite else { return false }
    let doubled = magnitude * 2
    return abs(doubled.rounded() - doubled) < 0.000_001
        && magnitude.truncatingRemainder(dividingBy: 1) == 0.5
}

private struct StatusCard: View {
    let kicker: String
    let title: String
    let detail: String
    var icon: String? = nil
    var featured = false
    var accent: Color = .green
    var emergency = false
    var actionLabel: String? = nil
    @State private var pulse = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(kicker).font(emergency ? .headline.weight(.black) : .caption2.weight(.black)).tracking(emergency ? 1.2 : 2).foregroundStyle(emergency ? .white : accent)
            HStack {
                Text(title).font(emergency ? .system(size: 34, weight: .black) : (featured ? .system(size: 25, weight: .black) : .title3.weight(.black))).fontWidth(featured ? .condensed : .standard)
                Spacer(minLength: 6)
                if let icon {
                    Image(systemName: icon).font(emergency ? .system(size: 30, weight: .black) : (featured ? .title2 : .headline)).foregroundStyle(emergency ? .white : accent)
                        .padding(emergency ? 13 : (featured ? 10 : 0))
                        .background(emergency ? .white.opacity(0.16) : (featured ? accent.opacity(0.1) : .clear), in: Circle())
                }
            }
            Text(detail).font(emergency ? .body.weight(.bold) : .subheadline).foregroundStyle(emergency ? .white.opacity(0.88) : .secondary)
            if featured, emergency || actionLabel != nil {
                HStack(spacing: 6) {
                    Text(emergency ? "DO THIS NEXT" : actionLabel ?? "").font(.system(size: emergency ? 13 : 9, weight: .black)).tracking(1.5)
                    Image(systemName: "arrow.right").font(.caption2.weight(.black))
                }.foregroundStyle(emergency ? .white : accent)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(emergency ? 26 : (featured ? 22 : 18))
        .background(
            LinearGradient(colors: emergency ? [Color.red.opacity(0.96), Color(red: 0.35, green: 0, blue: 0), .black.opacity(0.9)] : [.black.opacity(featured ? 0.72 : 0.76), accent.opacity(featured ? 0.20 : 0.10)], startPoint: .leading, endPoint: .trailing),
            in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 22, bottomTrailingRadius: 4, topTrailingRadius: 22)
        )
        .overlay(alignment: .leading) { Rectangle().fill(emergency ? .white : accent).frame(width: emergency ? 7 : (featured ? 4 : 2)).padding(.vertical, emergency ? 8 : 12) }
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 22, bottomTrailingRadius: 4, topTrailingRadius: 22).stroke(emergency ? .white.opacity(pulse ? 1 : 0.48) : accent.opacity(featured ? 0.72 : 0.3), lineWidth: emergency ? (pulse ? 5 : 2.5) : (featured ? 1.5 : 1)))
        .shadow(color: emergency ? .red.opacity(pulse ? 0.72 : 0.38) : (featured ? accent.opacity(0.24) : .clear), radius: emergency ? (pulse ? 30 : 18) : 26, y: 10)
        .scaleEffect(emergency && pulse ? 1.012 : 1)
        .animation(emergency ? .easeInOut(duration: 0.9).repeatForever(autoreverses: true) : .default, value: pulse)
        .onAppear { if emergency { pulse = true } }
    }
}

private struct WarRoomCardButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(.primary)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.78 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

private struct WarRoomBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black
                LinearGradient(colors: [Color(red: 0.01, green: 0.09, blue: 0.035), .black, Color(red: 0.08, green: 0.005, blue: 0.005)], startPoint: .topLeading, endPoint: .bottomTrailing)
                Path { path in
                    stride(from: 0.0, through: proxy.size.width, by: 38).forEach {
                        path.move(to: CGPoint(x: $0, y: 0)); path.addLine(to: CGPoint(x: $0, y: proxy.size.height))
                    }
                    stride(from: 0.0, through: proxy.size.height, by: 38).forEach {
                        path.move(to: CGPoint(x: 0, y: $0)); path.addLine(to: CGPoint(x: proxy.size.width, y: $0))
                    }
                }
                .stroke(.green.opacity(0.055), lineWidth: 0.7)
                RadialGradient(colors: [.green.opacity(0.17), .clear], center: .topTrailing, startRadius: 0, endRadius: proxy.size.width * 0.9)
                RadialGradient(colors: [.red.opacity(0.09), .clear], center: .bottomLeading, startRadius: 0, endRadius: proxy.size.width * 0.75)
                LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .center, endPoint: .bottom)
            }
            .ignoresSafeArea()
        }
    }
}

private struct SituationRoomHomeBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black
                Image("SituationRoomBunker")
                    .resizable()
                    .scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped()
                    .saturation(0.42)
                    .contrast(1.16)
                LinearGradient(colors: [.black.opacity(0.10), Color(red: 0.055, green: 0.075, blue: 0.11).opacity(0.52), .black.opacity(0.72)], startPoint: .top, endPoint: .bottom)
                LinearGradient(colors: [Color(red: 0.07, green: 0.09, blue: 0.13), .black, Color(red: 0.035, green: 0.045, blue: 0.065)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    .blendMode(.multiply).opacity(0.42)
                Path { path in
                    stride(from: 0.0, through: proxy.size.width, by: 38).forEach {
                        path.move(to: CGPoint(x: $0, y: 0)); path.addLine(to: CGPoint(x: $0, y: proxy.size.height))
                    }
                    stride(from: 0.0, through: proxy.size.height, by: 38).forEach {
                        path.move(to: CGPoint(x: 0, y: $0)); path.addLine(to: CGPoint(x: proxy.size.width, y: $0))
                    }
                }.stroke(Color(red: 0.42, green: 0.55, blue: 0.72).opacity(0.07), lineWidth: 0.7)
                RadialGradient(colors: [Color(red: 0.30, green: 0.43, blue: 0.62).opacity(0.20), .clear], center: .topTrailing, startRadius: 0, endRadius: proxy.size.width * 0.9)
                RadialGradient(colors: [Color.white.opacity(0.055), .clear], center: .bottomLeading, startRadius: 0, endRadius: proxy.size.width * 0.75)
                LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .center, endPoint: .bottom)
            }.ignoresSafeArea()
        }
    }
}

private struct CfbHomePhaseBackdrop: View {
    let phase: CfbSeasonPhase
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                SituationRoomHomeBackdrop()
                switch phase {
                case .conferenceChampionships:
                    LinearGradient(colors: [Color(red: 0.01, green: 0.04, blue: 0.12).opacity(0.82), .clear, .gray.opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    RadialGradient(colors: [.white.opacity(0.22), .clear], center: .top, startRadius: 0, endRadius: proxy.size.width * 0.8)
                case .bowlMania:
                    LinearGradient(colors: [Color(red: 0.24, green: 0.10, blue: 0.01).opacity(0.66), .clear, Color(red: 0.13, green: 0.06, blue: 0.01).opacity(0.72)], startPoint: .topLeading, endPoint: .bottomTrailing)
                case .cfpFirstRound, .cfpQuarterfinals, .cfpSemifinals, .cfpChampionship, .seasonComplete:
                    LinearGradient(colors: [.black.opacity(0.34), .yellow.opacity(0.10), .black.opacity(0.78)], startPoint: .topLeading, endPoint: .bottomTrailing)
                case .regularSeason:
                    Color.clear
                }
            }.ignoresSafeArea()
        }
    }
}

private struct CfbRivalryWeekBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black
                LinearGradient(
                    colors: [Color(red: 0.34, green: 0.015, blue: 0.025), .black, Color(red: 0.01, green: 0.10, blue: 0.25)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                Image("RivalryWeekRare")
                    .resizable().scaledToFit()
                    .frame(width: proxy.size.width * 1.25)
                    .opacity(0.16).saturation(1.35).contrast(1.15)
                    .rotationEffect(.degrees(-7))
                Path { path in
                    stride(from: -proxy.size.height, through: proxy.size.width, by: 46).forEach { offset in
                        path.move(to: CGPoint(x: offset, y: 0))
                        path.addLine(to: CGPoint(x: offset + proxy.size.height, y: proxy.size.height))
                    }
                }.stroke(.white.opacity(0.035), lineWidth: 1)
                Text("VS")
                    .font(.system(size: 190, weight: .black)).fontWidth(.condensed)
                    .foregroundStyle(.white.opacity(0.035)).rotationEffect(.degrees(-8))
                RadialGradient(colors: [.red.opacity(0.26), .clear], center: .topLeading, startRadius: 0, endRadius: proxy.size.width)
                RadialGradient(colors: [.cyan.opacity(0.22), .clear], center: .bottomTrailing, startRadius: 0, endRadius: proxy.size.width)
                LinearGradient(colors: [.clear, .black.opacity(0.72)], startPoint: .top, endPoint: .bottom)
            }.ignoresSafeArea()
        }
    }
}

private struct CfbRivalryWeekBanner: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Label("ESPN WEEK 13", systemImage: "bolt.horizontal.fill")
                Spacer()
                Text("NOV 24–30")
            }
            .font(.system(size: 9, weight: .black)).tracking(1.7).foregroundStyle(.white.opacity(0.72))

            HStack(spacing: 13) {
                Image("RivalryWeekRare")
                    .resizable().scaledToFill().frame(width: 76, height: 76).clipped()
                    .background(.black, in: RoundedRectangle(cornerRadius: 13))
                    .clipShape(RoundedRectangle(cornerRadius: 13))
                    .overlay(RoundedRectangle(cornerRadius: 13).stroke(.white.opacity(0.30)))
                    .shadow(color: .red.opacity(0.45), radius: 18)
                VStack(alignment: .leading, spacing: 2) {
                    Text("RIVALRY WEEK")
                        .font(.system(size: 36, weight: .black)).fontWidth(.condensed)
                        .minimumScaleFactor(0.72).lineLimit(1)
                    Text("NO FRIENDS. ONLY RECEIPTS.")
                        .font(.system(size: 10, weight: .black)).tracking(1.45).foregroundStyle(.yellow)
                }
            }

            Text("Five grudges enter the card. Pick a side, assign confidence, and understand that screenshots will outlive the final whistle.")
                .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.73))
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 7) {
                rivalryChip("5", "GRUDGES", .red)
                rivalryChip("1", "BEST BET", .yellow)
                rivalryChip("∞", "BAD BLOOD", .cyan)
            }
        }
        .padding(17).frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [Color.red.opacity(0.34), .black.opacity(0.94), Color.blue.opacity(0.30)], startPoint: .leading, endPoint: .trailing),
            in: UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 27, bottomTrailingRadius: 3, topTrailingRadius: 27)
        )
        .overlay(alignment: .top) {
            HStack(spacing: 0) { Color.red; Color.white; Color.blue }.frame(height: 4)
        }
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 27, bottomTrailingRadius: 3, topTrailingRadius: 27).stroke(.white.opacity(0.32)))
        .shadow(color: .red.opacity(0.22), radius: 24)
    }

    private func rivalryChip(_ value: String, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.headline.weight(.black)).foregroundStyle(color)
            Text(label).font(.system(size: 7, weight: .black)).tracking(0.7).foregroundStyle(.white.opacity(0.55))
        }
        .frame(maxWidth: .infinity).padding(.vertical, 8)
        .background(color.opacity(0.09), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(color.opacity(0.35)))
    }
}

private struct CfbPhaseHomeBanner: View {
    let phase: CfbSeasonPhase
    var body: some View {
        if phase != .regularSeason {
            VStack(alignment: .leading, spacing: 8) {
                Text(phase == .conferenceChampionships ? "PHASE II · CHAMPIONSHIP SATURDAY" : "PHASE III · BOWL SEASON")
                    .font(.system(size: 9, weight: .black)).tracking(2).foregroundStyle(phase == .conferenceChampionships ? .cyan : .yellow)
                Text(phase == .conferenceChampionships ? "WIN THE CONFERENCE. CHANGE THE FIELD." : "25 BOWLS. 100 POINTS. QUESTIONABLE JUDGMENT.")
                    .font(.system(size: 27, weight: .black)).fontWidth(.condensed)
                Text(phase == .conferenceChampionships ? "The postseason is visible, but not final. Bowl Mania and the CFP stay sealed until the titles are decided." : "The Marquee 15 and Sicko 10 are open. CFP-host bowls remain outside this operation.")
                    .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.64)).fixedSize(horizontal: false, vertical: true)
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading)
            .background(.black.opacity(0.80), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 22, bottomTrailingRadius: 4, topTrailingRadius: 22))
            .overlay(alignment: .leading) { Rectangle().fill(phase == .conferenceChampionships ? Color.cyan : Color.yellow).frame(width: 4).padding(.vertical, 11) }
            .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 22, bottomTrailingRadius: 4, topTrailingRadius: 22).stroke((phase == .conferenceChampionships ? Color.cyan : Color.yellow).opacity(0.48)))
        }
    }
}

private struct PicksRecruitingBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black
                Image("PicksRecruitingBoard")
                    .resizable().scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped().saturation(0.92).contrast(1.08)
                LinearGradient(colors: [.black.opacity(0.10), .black.opacity(0.30), .black.opacity(0.68)], startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [.yellow.opacity(0.09), .clear], center: .top, startRadius: 0, endRadius: proxy.size.width * 0.85)
                LinearGradient(colors: [.green.opacity(0.10), .clear, .black.opacity(0.38)], startPoint: .topLeading, endPoint: .bottomTrailing)
            }.ignoresSafeArea()
        }
    }
}

private struct StandingsHallBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black
                Image("StandingsHall")
                    .resizable().scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped().saturation(1.08).contrast(1.05)
                LinearGradient(colors: [.black.opacity(0.02), .black.opacity(0.25), .black.opacity(0.70)], startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [.yellow.opacity(0.10), .clear], center: .top, startRadius: 0, endRadius: proxy.size.width)
                LinearGradient(colors: [.clear, .green.opacity(0.07), .black.opacity(0.35)], startPoint: .top, endPoint: .bottomTrailing)
            }.ignoresSafeArea()
        }
    }
}

private struct LockerTunnelBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black
                Image("LockerTunnel")
                    .resizable().scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped().saturation(1.15).contrast(1.08)
                LinearGradient(colors: [.black.opacity(0.10), .black.opacity(0.38), .black.opacity(0.78)], startPoint: .top, endPoint: .bottom)
                LinearGradient(colors: [.red.opacity(0.13), .clear, .green.opacity(0.12)], startPoint: .leading, endPoint: .trailing)
                RadialGradient(colors: [.white.opacity(0.08), .clear], center: .center, startRadius: 0, endRadius: proxy.size.width * 0.72)
            }
            .ignoresSafeArea()
        }
    }
}

private struct ProfileShrineBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black
                Image("ProfileShrine").resizable().scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height).clipped().saturation(1.05).contrast(1.08)
                LinearGradient(colors: [.black.opacity(0.05), .black.opacity(0.42), .black.opacity(0.82)], startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [.yellow.opacity(0.10), .clear], center: .top, startRadius: 0, endRadius: proxy.size.width * 0.85)
                LinearGradient(colors: [.green.opacity(0.07), .clear, .red.opacity(0.04)], startPoint: .topLeading, endPoint: .bottomTrailing)
            }.ignoresSafeArea()
        }
    }
}

struct LockerRoomView: View {
    private static let bottomAnchor = "locker-room-bottom"
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.openURL) private var openURL
    @StateObject private var safety = LockerSafetyStore()
    let leagueOverride: LeagueMembership?
    @State private var league: LeagueMembership?
    @State private var messages: [LockerMessage] = []
    @State private var draft = ""
    @State private var loading = true
    @State private var sending = false
    @State private var reactingTo: String?
    @State private var errorMessage: String?
    @State private var reportNotice: String?
    @State private var latestTrophyByUser: [UUID: ProfileTrophy] = [:]
    @FocusState private var composerFocused: Bool
    private var identity: SportIdentity { SportIdentity(league?.leagues.sportId ?? leagueOverride?.leagues.sportId) }

    private var cleanDraft: String { draft.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var visibleMessages: [LockerMessage] {
        messages.filter { !safety.blockedUserIDs.contains($0.userId) }
    }

    init(leagueOverride: LeagueMembership? = nil) { self.leagueOverride = leagueOverride }

    var body: some View {
        NavigationStack {
            ZStack {
                if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) } else { LockerTunnelBackdrop() }
                if loading {
                    VStack(spacing: 12) {
                        ProgressView().tint(.red).scaleEffect(1.3)
                        Text("OPENING THE CAGE").font(.caption.weight(.black)).tracking(2).foregroundStyle(.red)
                    }
                } else if visibleMessages.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "megaphone.fill").font(.system(size: 38)).foregroundStyle(.red)
                        Text("DEAD QUIET").font(.title.weight(.black)).fontWidth(.condensed)
                        Text("Say something everyone can deny later.").font(.subheadline).foregroundStyle(.secondary)
                    }
                    .padding(24).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 20))
                } else {
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(spacing: 14) {
                                VStack(alignment: .leading, spacing: 7) {
                                    HStack {
                                        Label(identity.isNFL ? "SUNDAY LIVE WIRE" : "LIVE WIRE", systemImage: "bolt.fill")
                                            .font(.caption2.weight(.black)).tracking(2).foregroundStyle(identity.isNFL ? .cyan : .green)
                                        Spacer()
                                        Text("\(messages.count) RECEIPT\(messages.count == 1 ? "" : "S")")
                                            .font(.caption2.weight(.black)).tracking(1).foregroundStyle(.white.opacity(0.45))
                                    }
                                    Text("THE LOCKER\nROOM").font(.system(size: 38, weight: .black)).fontWidth(.condensed).lineSpacing(-5)
                                    Text("NO PRESS. NO PR TEAM. NO ALIBIS.").font(.system(size: 9, weight: .black)).tracking(1.6).foregroundStyle(.red)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading).padding(20)
                                .background(LinearGradient(colors: [.black.opacity(0.88), .red.opacity(0.18)], startPoint: .leading, endPoint: .trailing), in: UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 24, bottomTrailingRadius: 3, topTrailingRadius: 24))
                                .overlay(alignment: .leading) { Rectangle().fill(.red).frame(width: 4).padding(.vertical, 12) }
                                .overlay(UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 24, bottomTrailingRadius: 3, topTrailingRadius: 24).stroke(.red.opacity(0.5)))

                                ForEach(visibleMessages) { message in
                                    LockerBubble(
                                        message: message,
                                        currentUserId: auth.user?.id,
                                        sportId: league?.leagues.sportId ?? leagueOverride?.leagues.sportId ?? "cfb",
                                        trophy: latestTrophyByUser[message.userId],
                                        reactingTo: reactingTo,
                                        onReaction: { emoji in Task { await react(to: message, emoji: emoji) } }
                                    )
                                    .id(message.id)
                                    .contextMenu {
                                        if message.userId != auth.user?.id {
                                            Button {
                                                Task { await report(message) }
                                            } label: {
                                                Label("Report Message", systemImage: "exclamationmark.bubble.fill")
                                            }
                                            Button(role: .destructive) {
                                                safety.block(message.userId)
                                            } label: {
                                                Label("Block Player", systemImage: "person.crop.circle.badge.xmark")
                                            }
                                        }
                                    }
                                }

                                Color.clear
                                    .frame(height: 1)
                                    .id(Self.bottomAnchor)
                            }
                            .padding(.horizontal, 14).padding(.top, 10).padding(.bottom, 24)
                        }
                        .scrollDismissesKeyboard(.interactively)
                        .refreshable { await load() }
                        .onAppear {
                            DispatchQueue.main.async {
                                proxy.scrollTo(Self.bottomAnchor, anchor: .bottom)
                            }
                        }
                        .onChange(of: visibleMessages.count) { _, _ in
                            proxy.scrollTo(Self.bottomAnchor, anchor: .bottom)
                        }
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 1) {
                        Text(identity.isNFL ? "NFL LOCKER ROOM" : "LOCKER ROOM").font(.caption.weight(.black)).foregroundStyle(identity.isNFL ? .cyan : .green)
                        Text(league?.leagues.name ?? "Your league").font(.caption2).foregroundStyle(.secondary)
                    }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("DONE") { composerFocused = false }
                        .font(.caption.weight(.black))
                }
            }
            .safeAreaInset(edge: .bottom) { composer }
            .task(id: leagueOverride?.leagueId ?? auth.selectedLeagueId) { await load() }
            .alert("LOCKER ROOM REPORT", isPresented: Binding(get: { reportNotice != nil }, set: { if !$0 { reportNotice = nil } })) {
                Button("OK") { reportNotice = nil }
                Button("CONTACT SUPPORT") { openURL(AppLinks.support) }
            } message: {
                Text(reportNotice ?? "")
            }
        }
    }

    private var composer: some View {
        VStack(spacing: 6) {
            if let errorMessage {
                Text(errorMessage).font(.caption).foregroundStyle(.red).frame(maxWidth: .infinity, alignment: .leading)
            }
            HStack(alignment: .bottom, spacing: 10) {
                TextField("Deliver a questionable take…", text: $draft, axis: .vertical)
                    .focused($composerFocused)
                    .lineLimit(1...4)
                    .padding(.horizontal, 14).padding(.vertical, 11)
                    .background(.black.opacity(0.92), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 18, bottomTrailingRadius: 4, topTrailingRadius: 18))
                    .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 18, bottomTrailingRadius: 4, topTrailingRadius: 18).stroke(.red.opacity(0.42)))
                    .onChange(of: draft) { _, value in
                        if value.count > 280 { draft = String(value.prefix(280)) }
                        errorMessage = nil
                    }
                Button { Task { await send() } } label: {
                    if sending { ProgressView().frame(width: 42, height: 42) }
                    else { Image(systemName: "arrow.up").fontWeight(.black).frame(width: 42, height: 42) }
                }
                .buttonStyle(.borderedProminent).buttonBorderShape(.circle).tint(.red)
                .disabled(cleanDraft.isEmpty || sending || league == nil)
            }
            HStack {
                Text(cleanDraft.isEmpty ? "Receipts last longer than courage." : "\(draft.count)/280")
                Spacer()
                if composerFocused {
                    Button { composerFocused = false } label: {
                        Label("HIDE KEYBOARD", systemImage: "keyboard.chevron.compact.down").fontWeight(.black)
                    }.foregroundStyle(identity.isNFL ? .cyan : .green)
                } else {
                    Text("POSTS TO THE WHOLE LEAGUE").fontWeight(.black)
                }
            }
            .font(.caption2).foregroundStyle(.secondary)
        }
        .padding(.horizontal).padding(.top, 8).padding(.bottom, 4)
        .background(.black.opacity(0.90))
        .overlay(alignment: .top) { Rectangle().fill(LinearGradient(colors: [.red, identity.isNFL ? .cyan : .green], startPoint: .leading, endPoint: .trailing)).frame(height: 2) }
    }

    private func load() async {
        guard let token = auth.token, let user = auth.user else { return }
        loading = messages.isEmpty
        do {
            let active: LeagueMembership
            if let leagueOverride {
                active = leagueOverride
            } else {
                active = try await SupabaseAPI.activeLeague(token: token, userId: user.id, preferredLeagueId: auth.selectedLeagueId)
            }
            league = active
            async let loadedMessages = SupabaseAPI.lockerMessages(token: token, leagueId: active.leagueId)
            async let loadedTrophies = SupabaseAPI.leagueTrophies(token: token, leagueId: active.leagueId)
            async let loadedStandings = SupabaseAPI.standings(token: token, leagueId: active.leagueId)
            messages = try await loadedMessages
            LeagueAttentionStore.markLockerRead(leagueId: active.leagueId, messages: messages)
            let trophies = (try? await loadedTrophies) ?? []
            let standings = (try? await loadedStandings) ?? []
            latestTrophyByUser = resolvedTrophyMap(live: trophies, standings: standings)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }

    private func send() async {
        guard let token = auth.token, let user = auth.user, let league else { return }
        let text = cleanDraft
        guard !text.isEmpty else { return }
        if LockerContentSafety.violation(in: text) != nil {
            errorMessage = "That message violates the Locker Room safety rules and was not posted."
            return
        }
        sending = true
        do {
            try await SupabaseAPI.postLockerMessage(token: token, leagueId: league.leagueId, userId: user.id, body: text)
            draft = ""
            messages = try await SupabaseAPI.lockerMessages(token: token, leagueId: league.leagueId)
            LeagueAttentionStore.markLockerRead(leagueId: league.leagueId, messages: messages)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        sending = false
    }

    private func report(_ message: LockerMessage) async {
        guard let token = auth.token else { return }
        do {
            try await SupabaseAPI.reportLockerMessage(token: token, messageId: message.id)
            reportNotice = "Report filed. The message has been sent to moderation for review."
        } catch {
            reportNotice = error.localizedDescription
        }
    }

    private func react(to message: LockerMessage, emoji: String) async {
        guard let token = auth.token, let user = auth.user, let league else { return }
        let key = "\(message.id)-\(emoji)"
        guard reactingTo != key else { return }
        reactingTo = key
        let isRemoving = message.lockerMessageReactions.contains { $0.userId == user.id && $0.emoji == emoji }
        do {
            try await SupabaseAPI.setLockerReaction(
                token: token,
                messageId: message.id,
                userId: user.id,
                emoji: emoji,
                isRemoving: isRemoving
            )
            messages = try await SupabaseAPI.lockerMessages(token: token, leagueId: league.leagueId)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        reactingTo = nil
    }
}

private struct LockerBubble: View {
    let message: LockerMessage
    let currentUserId: UUID?
    let sportId: String
    let trophy: ProfileTrophy?
    let reactingTo: String?
    let onReaction: (String) -> Void
    @State private var showingTrophy = false

    private let emojis = ["😂", "🔥", "💀", "🤡"]
    private var isMine: Bool { message.userId == currentUserId }
    private var isNFL: Bool { sportId.lowercased() == "nfl" }
    private var mineAccent: Color { isNFL ? .cyan : .green }

    var body: some View {
        HStack(alignment: .top, spacing: 9) {
            if isMine { Spacer(minLength: 34) }
            if !isMine {
                ProfileAvatar(urlString: message.profiles?.avatarURL, name: message.authorName, size: 34, borderId: message.profiles?.equippedBorderId, accent: mineAccent)
            }
            VStack(alignment: isMine ? .trailing : .leading, spacing: 7) {
                HStack(spacing: 7) {
                    NavigationLink { PlayerProfileRouteView(userId: message.userId, fallbackName: message.authorName, sportId: sportId) } label: {
                        Text(isMine ? "YOU" : message.authorName.uppercased())
                            .font(.system(size: 9, weight: .black)).tracking(1.2).foregroundStyle(isMine ? mineAccent : (isNFL ? .red : .yellow))
                    }.buttonStyle(.plain)
                    if let trophy, let artifact = trophyArtifactName(for: trophy) {
                        Button { showingTrophy = true } label: {
                            Image(artifact).resizable().scaledToFill().frame(width: 22, height: 22).clipShape(Circle())
                                .overlay(Circle().stroke((isNFL ? Color.cyan : Color.yellow).opacity(0.72), lineWidth: 0.8))
                        }.buttonStyle(.plain).accessibilityLabel("Open \(String(trophy.seasonYear)) championship trophy")
                    }
                    Text(timestamp.uppercased()).font(.system(size: 8, weight: .bold)).foregroundStyle(.white.opacity(0.35))
                }
                Text(message.body)
                    .font(.body.weight(.medium)).textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: isMine ? .trailing : .leading)
                HStack(spacing: 5) {
                    ForEach(emojis, id: \.self) { emoji in
                        let reactions = message.lockerMessageReactions.filter { $0.emoji == emoji }
                        let selected = reactions.contains { $0.userId == currentUserId }
                        Button { onReaction(emoji) } label: {
                            HStack(spacing: 3) {
                                Text(emoji)
                                if !reactions.isEmpty { Text("\(reactions.count)").font(.caption2.weight(.black)) }
                            }
                            .padding(.horizontal, 7).padding(.vertical, 5)
                        }
                        .buttonStyle(.plain)
                        .background(selected ? mineAccent.opacity(0.30) : .black.opacity(0.58), in: Capsule())
                        .overlay(Capsule().stroke(selected ? mineAccent : .white.opacity(0.16)))
                        .disabled(reactingTo == "\(message.id)-\(emoji)")
                        .accessibilityLabel(selected ? "Remove \(emoji) reaction" : "Add \(emoji) reaction")
                    }
                }
            }
            .padding(13)
            .background(
                LinearGradient(colors: isMine ? [mineAccent.opacity(0.24), isNFL ? Color.blue.opacity(0.16) : .black.opacity(0.88)] : [.black.opacity(0.92), .red.opacity(0.14)], startPoint: .topLeading, endPoint: .bottomTrailing),
                in: UnevenRoundedRectangle(topLeadingRadius: isMine ? 18 : 3, bottomLeadingRadius: 18, bottomTrailingRadius: isMine ? 3 : 18, topTrailingRadius: 18)
            )
            .overlay(alignment: isMine ? .trailing : .leading) { Rectangle().fill(isMine ? mineAccent : .red).frame(width: 3).padding(.vertical, 9) }
            .overlay(UnevenRoundedRectangle(topLeadingRadius: isMine ? 18 : 3, bottomLeadingRadius: 18, bottomTrailingRadius: isMine ? 3 : 18, topTrailingRadius: 18).stroke(isMine ? mineAccent.opacity(0.50) : .red.opacity(0.35)))
            if isMine {
                ProfileAvatar(urlString: message.profiles?.avatarURL, name: message.authorName, size: 34, borderId: message.profiles?.equippedBorderId, accent: mineAccent)
            } else { Spacer(minLength: 34) }
        }
        .sheet(isPresented: $showingTrophy) {
            if let trophy {
                TrophyEvidenceView(trophy: trophy, title: trophy.trophyType.replacingOccurrences(of: "_", with: " ").uppercased())
                    .presentationDetents([.large]).presentationDragIndicator(.hidden)
            }
        }
    }

    private var timestamp: String {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = fractional.date(from: message.createdAt) ?? ISO8601DateFormatter().date(from: message.createdAt)
        guard let date else { return "just now" }
        if Date().timeIntervalSince(date) < 60 { return "just now" }
        return date.formatted(date: .omitted, time: .shortened)
    }
}

private struct PlaceholderView: View {
    let title: String
    let icon: String

    var body: some View {
        NavigationStack {
            ContentUnavailableView(title, systemImage: icon, description: Text("Native screen under construction"))
                .navigationTitle(title)
        }
    }
}

private struct YouView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var leagues: [LeagueMembership] = []
    @State private var profile: Profile?
    @State private var achievements: [ProfileAchievement] = []
    @State private var trophies: [ProfileTrophy] = []
    @State private var favoriteTeam: FavoriteTeam?
    @State private var leagueStandings: [Standing] = []
    @State private var postseasonScorecards: [PostseasonScorecard] = []
    @State private var selectedAchievement: ProfileAchievement?
    @State private var selectedTrophy: ProfileTrophy?

    private var selectedMembership: LeagueMembership? {
        leagues.first { $0.leagueId == auth.selectedLeagueId } ?? leagues.first
    }
    private var identity: SportIdentity { SportIdentity(selectedMembership?.leagues.sportId) }

    var body: some View {
        NavigationStack {
            ZStack {
                if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) }
                else { ProfileShrineBackdrop() }
                ScrollView {
                    VStack(spacing: 15) {
                        VStack(spacing: 10) {
                            Text(identity.isNFL ? "PRO FOOTBALL PERSONNEL FILE" : "PLAYER DOSSIER").font(.caption2.weight(.black)).tracking(2.4).foregroundStyle(identity.isNFL ? .cyan : .yellow)
                            ProfileAvatar(urlString: profile?.avatarURL, name: playerName, size: 104, borderId: profile?.equippedBorderId, accent: identity.isNFL ? .cyan : .green)
                            ProfileRankPlacard(progress: profileRankProgress, isOwner: true, sportId: identity.sportId)
                            Text(playerName).font(.system(size: 32, weight: .black)).fontWidth(.condensed)
                            HStack(spacing: 7) {
                                profileTag(roleLabel, color: identity.isNFL ? .blue : .green)
                                profileTag(conferenceLabel, color: identity.isNFL ? .red : .yellow)
                            }
                            Text(selectedMembership?.leagues.name.uppercased() ?? "NO ACTIVE LEAGUE")
                                .font(.system(size: 9, weight: .black)).tracking(1.5).foregroundStyle(.white.opacity(0.48))
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 22)
                        .background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 20))
                        .overlay(alignment: .top) { if identity.isNFL { HStack(spacing: 0) { Color.blue; Color.white; Color.red }.frame(height: 3) } }
                        .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 20).stroke((identity.isNFL ? Color.cyan : Color.yellow).opacity(0.42)))

                            FavoriteTeamShrine(team: favoriteTeam)
                            if let user = auth.user { ProfileArsenalView(userId: user.id, sportId: identity.sportId) }
                            if let user = auth.user { CampaignDogTagsView(userId: user.id) }
                            if let user = auth.user { ProfilePassportView(userId: user.id, isOwner: true) }
                        currentCampaignCard
                        if !postseasonScorecards.isEmpty {
                            dossierLabel("POSTSEASON SCORECARDS", detail: "EVERY POINT. EVERY WEEK. NO MYSTERY MATH.")
                            ForEach(postseasonScorecards) { scorecard in
                                NavigationLink { PostseasonScorecardView(scorecard: scorecard, sportId: identity.sportId) } label: {
                                    dossierRow("Week \(scorecard.weekNumber) · \(scorecard.weeklyTotal) points", scorecard.phase.replacingOccurrences(of: "_", with: " ").uppercased(), "list.clipboard.fill", identity.isNFL ? .cyan : .yellow)
                                }.buttonStyle(.plain)
                            }
                        }
                        if let membership = selectedMembership {
                            dossierLabel("CAREER INTEL", detail: "THE NUMBERS HAVE TESTIFIED UNDER OATH")
                            CareerIntelGrid(
                                atsCorrect: membership.atsCorrect, atsTotal: membership.atsTotal,
                                streak: membership.currentStreak, bestWeek: membership.bestWeek,
                                perfectWeeks: membership.perfectWeeks,
                                bestBetHits: membership.bestBetHits, bestBetTotal: membership.bestBetTotal,
                                propHits: membership.propHits, propTotal: membership.propTotal,
                                sportId: identity.sportId
                            )
                            if let user = auth.user, let me = leagueStandings.first(where: { $0.userId == user.id }) {
                                ProfileRivalryCard(player: me, standings: leagueStandings, sportId: identity.sportId)
                            } else {
                                ProfileRivalryCard(player: nil, standings: [], sportId: identity.sportId)
                            }
                        }

                        dossierLabel("CHEEVO CABINET", detail: displayAchievements.isEmpty ? identity.emptyCabinet : "PERMANENT EVIDENCE OF QUESTIONABLE EXCELLENCE")
                        if displayAchievements.isEmpty {
                            HStack(spacing: 12) {
                                Image(systemName: "lock.shield.fill").font(.title2).foregroundStyle(identity.isNFL ? .cyan : .yellow)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text("NO HARDWARE YET").font(.headline.weight(.black))
                                    Text("The season has not started. Fraud remains unconfirmed.").font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                            .padding(15).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 16)).overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 16).stroke((identity.isNFL ? Color.cyan : Color.yellow).opacity(0.28)))
                        } else {
                            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                                ForEach(displayAchievements) { achievement in
                                    Button { selectedAchievement = achievement } label: { AchievementArtifactTile(achievement: achievement, sportId: identity.sportId) }
                                        .buttonStyle(.plain)
                                }
                            }
                        }

                        dossierLabel("CHEEVO VAULT", detail: "FOUR ROOMS. ONE CONCERNING PERSONALITY.")
                        NavigationLink {
                            CheevoVaultView(earned: displayAchievements, sportId: identity.sportId)
                        } label: {
                            CheevoVaultDoor(earned: displayAchievements)
                        }
                        .buttonStyle(.plain)

                        dossierLabel("TROPHY CASE", detail: displayTrophies.isEmpty ? "EMPTY SHELF. LOUD AMBITIONS." : "THE ROOM CANNOT DELETE HISTORY")
                        if displayTrophies.isEmpty {
                            Text("The trophy engraver has no record of this person. He checked twice and laughed once.")
                                .font(.subheadline.weight(.bold)).foregroundStyle(.white.opacity(0.64))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 4).padding(.vertical, 7)
                        } else {
                            ForEach(displayTrophies) { trophy in
                                Button { selectedTrophy = trophy } label: { trophyRow(trophy) }
                                    .buttonStyle(.plain)
                            }
                        }

                        if let membership = selectedMembership, let user = auth.user, membership.isCommissioner(userId: user.id) {
                            dossierLabel("COMMISSIONER VAULT", detail: "CHOOSE THE HARDWARE EVERYONE ELSE HAS TO LIVE WITH")
                            NavigationLink { ChampionshipTrophyPickerView(membership: membership) } label: {
                                dossierRow(membership.leagues.championshipTrophyId == nil ? "Choose Championship Trophy" : "View Championship Trophy", membership.leagues.championshipTrophyId == nil ? "Six unreasonable options await" : "The season’s hardware is sealed", "trophy.fill", identity.isNFL ? .cyan : .yellow)
                            }.buttonStyle(.plain)
                        }

                        dossierLabel("IDENTITY CONTROL", detail: "CHANGE THE NAME. KEEP THE RECEIPTS.")
                        NavigationLink { NativeProfileView() } label: {
                            dossierRow("Edit Profile", "Name, photo and public identity", "person.crop.rectangle.fill", .green)
                        }.buttonStyle(.plain)

                        dossierLabel("ROOM ACCESS", detail: "TRANSMISSIONS & RULES OF ENGAGEMENT")
                        NavigationLink { AnnouncementsView() } label: {
                            dossierRow("Announcements", "Official yelling from command", "megaphone.fill", .red)
                        }.buttonStyle(.plain)
                        NavigationLink { HowToPlayView(sportId: identity.sportId) } label: {
                            dossierRow("Rules of Engagement", "How this beautiful mess scores", "book.closed.fill", .yellow)
                        }.buttonStyle(.plain)
                        NavigationLink { SafetyAndSupportView() } label: {
                            dossierRow("Privacy & Safety", "Policies, support and account controls", "hand.raised.fill", .green)
                        }.buttonStyle(.plain)

                        if !leagues.isEmpty {
                            dossierLabel("LEAGUE FREQUENCY", detail: "SEE EVERY TASK AND UNREAD TRANSMISSION BEFORE YOU SWITCH")
                            NavigationLink { LeagueCommandCenterView(memberships: leagues) } label: {
                                dossierRow("Open League Command", "\(leagues.count) room\(leagues.count == 1 ? "" : "s") · prioritized by what needs you", "antenna.radiowaves.left.and.right", .green)
                            }.buttonStyle(.plain)
                        }

                        Button(role: .destructive) { auth.signOut() } label: {
                            dossierRow("Leave the Building", auth.user?.email ?? "Sign out", "door.left.hand.open", .red)
                        }.buttonStyle(.plain)
                    }
                    .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 36)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(item: $selectedAchievement) { achievement in
                AchievementEvidenceView(achievement: achievement, visual: achievementVisual(for: achievement.code), sportId: identity.sportId)
                    .presentationDetents([.large])
                    .presentationDragIndicator(.hidden)
            }
            .sheet(item: $selectedTrophy) { trophy in
                TrophyEvidenceView(trophy: trophy, title: trophyTitle(trophy.trophyType))
                    .presentationDetents([.large])
                    .presentationDragIndicator(.hidden)
            }
            .task {
                guard let token = auth.token, let user = auth.user else { return }
                async let loadedLeagues = SupabaseAPI.leagueMemberships(token: token, userId: user.id)
                async let loadedProfile = SupabaseAPI.profile(token: token, userId: user.id)
                async let loadedAchievements = SupabaseAPI.profileAchievements(token: token, userId: user.id)
                async let loadedTrophies = SupabaseAPI.profileTrophies(token: token, userId: user.id)
                leagues = (try? await loadedLeagues) ?? []
                profile = try? await loadedProfile
                achievements = (try? await loadedAchievements) ?? []
                trophies = (try? await loadedTrophies) ?? []
                if auth.selectedLeagueId == nil, let first = leagues.first { auth.selectLeague(first.leagueId) }
                favoriteTeam = try? await SupabaseAPI.favoriteTeam(token: token, userId: user.id, sportId: identity.sportId)
                if let leagueId = (leagues.first { $0.leagueId == auth.selectedLeagueId } ?? leagues.first)?.leagueId {
                    leagueStandings = (try? await SupabaseAPI.standings(token: token, leagueId: leagueId)) ?? []
                    postseasonScorecards = (try? await SupabaseAPI.postseasonScorecards(token: token, leagueId: leagueId, seasonKey: Calendar.current.component(.year, from: Date()), userId: user.id)) ?? []
                }
            }
        }
    }

    private var playerName: String { profile?.displayName ?? "Player to be named later" }
    private var profileRankProgress: CareerRankProgress {
        CareerRanks.resolve(
            points: PromotionPoints.total(for: displayAchievements),
            seasons: (selectedMembership?.weeksPlayed ?? 0) / 10,
            sports: max(1, Set(leagues.map { $0.leagues.sportId }).count),
            minimumRankId: auth.user.map { LegacyCareerRecords.minimumRankFloor(for: $0.id, liveFloor: profile?.careerRankFloor) } ?? profile?.careerRankFloor
        )
    }
    private var displayAchievements: [ProfileAchievement] {
        var rows = achievements
        let fallbackLeague = selectedMembership?.leagueId ?? UUID(uuidString: "00000000-0000-0000-0000-000000000000")!
        if let user = auth.user, AppIdentity.isCreator(user.id), !rows.contains(where: { $0.code == "the_creator" }) {
            rows.insert(ProfileAchievement(leagueId: fallbackLeague, code: "the_creator", title: "The Creator", flavor: "Built the War Room, then voluntarily entered it.", earnedAt: ""), at: 0)
        }
        if let titleId = profile?.equippedTitleId, !rows.contains(where: { $0.code == titleId }) {
            let meta = equippedCheevoMeta(titleId)
            rows.append(ProfileAchievement(leagueId: fallbackLeague, code: titleId, title: meta.0, flavor: meta.1, earnedAt: ""))
        }
        return rows
    }
    private var displayTrophies: [ProfileTrophy] {
        var rows = trophies
        if auth.user?.id.uuidString.lowercased() == "09544d2b-6eca-4131-a321-c000586c9029", !rows.contains(where: { $0.trophyType == "nfc_championship" && $0.seasonYear == 2026 }) {
            rows.append(ProfileTrophy(id: UUID(uuidString: "00000000-0000-0000-0000-000000002026")!, leagueId: UUID(uuidString: "00000000-0000-0000-0000-000000000000")!, seasonYear: 2026, trophyType: "nfc_championship", winnerName: playerName, winnerUserId: auth.user?.id, subtitle: "NFC Champion · 2026", notes: "Conference hardware. Permanent career history.", awardedAt: "", trophyDesignId: "nfl_gridiron_crown"))
        }
        return rows
    }
    private func equippedCheevoMeta(_ id: String) -> (String, String) {
        switch id {
        case "neighborhood_creeper": return ("Neighborhood Creeper", "Opened Deep stats & legacy math. Curtains twitched. Spreadsheet energy prevailed.")
        default: return (id.replacingOccurrences(of: "_", with: " ").capitalized, "Equipped on the website and carried into the native War Room.")
        }
    }
    private var roleLabel: String {
        guard let user = auth.user else { return "PLAYER" }
        if AppIdentity.isCreator(user.id) { return "CREATOR" }
        if selectedMembership?.isCommissioner(userId: user.id) == true { return "COMMISSIONER" }
        if selectedMembership?.isDeputy == true { return "DEPUTY" }
        if selectedMembership?.isModerator == true { return "MODERATOR" }
        return "PLAYER"
    }
    private var conferenceLabel: String {
        identity.divisionLabel(selectedMembership?.division)
    }
    private func profileTag(_ text: String, color: Color) -> some View {
        Text(text).font(.system(size: 9, weight: .black)).tracking(1)
            .foregroundStyle(color).padding(.horizontal, 9).padding(.vertical, 5)
            .background(color.opacity(0.14), in: Capsule()).overlay(Capsule().stroke(color.opacity(0.55)))
    }
    private func dossierStat(_ value: String, _ label: String) -> some View {
        let accent: Color = identity.isNFL ? .cyan : .green
        return VStack(spacing: 3) { Text(value).font(.title2.weight(.black)).monospacedDigit(); Text(label).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(accent) }
            .frame(maxWidth: .infinity).padding(.vertical, 14).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 14)).overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 14).stroke(accent.opacity(0.25)))
    }
    private var currentCampaignCard: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(identity.isNFL ? "CURRENT SEASON FILE" : "CURRENT CAMPAIGN").font(.caption2.weight(.black)).tracking(1.8).foregroundStyle(identity.isNFL ? .cyan : .green)
                    Text(campaignReadout).font(.system(size: 9, weight: .black)).tracking(0.8).foregroundStyle(.white.opacity(0.48))
                }
                Spacer()
                Image(systemName: "scope").font(.title2.weight(.black)).foregroundStyle(identity.isNFL ? .red : .green)
            }
            HStack(spacing: 10) {
                dossierStat("\(selectedMembership?.totalPoints ?? 0)", "CAREER PTS")
                dossierStat("\(selectedMembership?.weeksPlayed ?? 0)", "WEEKS")
                dossierStat("\(selectedMembership?.weeklyPoints?.last ?? 0)", "LAST WEEK")
            }
        }
        .padding(14)
        .background(LinearGradient(colors: [.black.opacity(0.92), (identity.isNFL ? Color.blue : Color.green).opacity(0.14)], startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 18))
        .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 18).stroke((identity.isNFL ? Color.cyan : Color.green).opacity(0.35)))
    }
    private var campaignReadout: String {
        let weeks = selectedMembership?.weeksPlayed ?? 0
        if weeks == 0 { return identity.untestedCampaign }
        let last = selectedMembership?.weeklyPoints?.last ?? 0
        if last >= 40 { return "FORM: DANGEROUS · THE ROOM HAS NOTICED" }
        if last >= 25 { return "FORM: FUNCTIONAL · SUSPICIOUSLY COMPETENT" }
        return "FORM: UNDER REVIEW · ALIBI PENDING"
    }
    private func dossierLabel(_ title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 2) { Text(title).font(.caption2.weight(.black)).tracking(1.7).foregroundStyle(identity.isNFL ? .cyan : .yellow); Text(detail).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.38)) }.frame(maxWidth: .infinity, alignment: .leading).padding(.top, 4)
    }
    private func dossierRow(_ title: String, _ detail: String, _ icon: String, _ color: Color) -> some View {
        let displayColor: Color = identity.isNFL ? (color == .red ? .red : color == .green ? .blue : .cyan) : color
        return HStack(spacing: 13) { Image(systemName: icon).font(.headline.weight(.black)).foregroundStyle(displayColor).frame(width: 30); VStack(alignment: .leading, spacing: 2) { Text(title).font(.headline.weight(.black)); Text(detail).font(.caption).foregroundStyle(.secondary) }; Spacer(); Image(systemName: "chevron.right").font(.caption.weight(.black)).foregroundStyle(displayColor.opacity(0.7)) }
            .padding(15).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 17)).overlay(alignment: .leading) { Rectangle().fill(displayColor).frame(width: 3).padding(.vertical, 9) }.overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 17).stroke(displayColor.opacity(0.25)))
    }
    private func trophyRow(_ trophy: ProfileTrophy) -> some View {
        let isShame = trophy.trophyType == "toilet_bowl"
        return HStack(spacing: 13) {
            Image(systemName: isShame ? "toilet.fill" : "trophy.fill").font(.title2.weight(.black)).foregroundStyle(isShame ? .brown : (identity.isNFL ? .cyan : .yellow)).frame(width: 42)
            VStack(alignment: .leading, spacing: 3) { Text(trophyTitle(trophy.trophyType)).font(.headline.weight(.black)); Text(trophy.subtitle ?? "\(String(trophy.seasonYear)) · Permanent record").font(.caption).foregroundStyle(.secondary) }
            Spacer(); Text(verbatim: String(trophy.seasonYear)).font(.headline.weight(.black)).foregroundStyle(identity.isNFL ? .cyan : .yellow)
        }
        .padding(14).background(.black.opacity(0.84), in: RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 16)).overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 7 : 16).stroke((identity.isNFL ? Color.cyan : Color.yellow).opacity(0.24)))
    }
    private func trophyTitle(_ type: String) -> String {
        switch type { case "championship": return "LEAGUE CHAMPION"; case "toilet_bowl": return "TOILET BOWL"; case "crystal_ball": return "VILLAGE NERD"; default: return type.replacingOccurrences(of: "_", with: " ").uppercased() }
    }
}

private struct ProfileRivalryCard: View {
    let player: Standing?
    let standings: [Standing]
    let sportId: String

    private var rival: Standing? {
        player.flatMap { closestRival(for: $0, in: standings) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("CURRENT RIVALRY").font(.caption2.weight(.black)).tracking(1.8).foregroundStyle(.red)
                    Text("CLOSEST LIVE THREAT · UPDATES WITH THE STANDINGS")
                        .font(.system(size: 8, weight: .black)).tracking(0.8).foregroundStyle(.white.opacity(0.40))
                }
                Spacer()
                Image(systemName: "bolt.horizontal.circle.fill").font(.title2.weight(.black)).foregroundStyle(.red)
            }
            if let player, let rival {
                HStack(spacing: 11) {
                    ProfileAvatar(urlString: player.profiles?.avatarURL, name: player.name, size: 48, borderId: player.profiles?.equippedBorderId, accent: SportIdentity(sportId).isNFL ? .cyan : .green)
                    Text("VS").font(.caption.weight(.black)).foregroundStyle(.red)
                    ProfileAvatar(urlString: rival.profiles?.avatarURL, name: rival.name, size: 48, borderId: rival.profiles?.equippedBorderId, accent: SportIdentity(sportId).isNFL ? .cyan : .green)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(rival.name.uppercased()).font(.headline.weight(.black)).fontWidth(.condensed)
                        Text(rivalryLine(player: player, rival: rival)).font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.66)).fixedSize(horizontal: false, vertical: true)
                    }
                }
                NavigationLink { PublicPlayerProfileView(standing: rival, sportId: sportId, leagueStandingsOverride: standings) } label: {
                    HStack { Text("OPEN RIVAL DOSSIER").font(.caption.weight(.black)); Spacer(); Image(systemName: "chevron.right") }
                        .foregroundStyle(.red).padding(.top, 2)
                }.buttonStyle(.plain)
            } else {
                Text("Rivalries report for duty after real scored cards exist. We do not manufacture enemies before kickoff.")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.62)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(16)
        .background(LinearGradient(colors: [.black.opacity(0.90), .red.opacity(0.13)], startPoint: .topLeading, endPoint: .bottomTrailing), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 20, bottomTrailingRadius: 4, topTrailingRadius: 20))
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 20, bottomTrailingRadius: 4, topTrailingRadius: 20).stroke(.red.opacity(0.42)))
    }

    private func rivalryLine(player: Standing, rival: Standing) -> String {
        let difference = player.totalPoints - rival.totalPoints
        if difference == 0 { return "Dead even at \(player.totalPoints) points. No adult supervision." }
        if difference > 0 { return "\(difference) point\(difference == 1 ? "" : "s") back—your closest threat right now." }
        let gap = abs(difference)
        return "\(gap) point\(gap == 1 ? "" : "s") ahead—your closest target right now."
    }
}

func closestRival(for player: Standing, in standings: [Standing]) -> Standing? {
    guard player.weeksPlayed > 0 || player.atsTotal > 0 else { return nil }
    return standings
        .filter { $0.userId != player.userId && ($0.weeksPlayed > 0 || $0.atsTotal > 0) }
        .sorted {
            let leftGap = abs($0.totalPoints - player.totalPoints)
            let rightGap = abs($1.totalPoints - player.totalPoints)
            if leftGap != rightGap { return leftGap < rightGap }
            let nameOrder = $0.name.localizedCaseInsensitiveCompare($1.name)
            if nameOrder != .orderedSame { return nameOrder == .orderedAscending }
            return $0.userId.uuidString < $1.userId.uuidString
        }
        .first
}

private struct CareerIntelGrid: View {
    let atsCorrect: Int
    let atsTotal: Int
    let streak: Int
    let bestWeek: Int
    let perfectWeeks: Int
    let bestBetHits: Int
    let bestBetTotal: Int
    let propHits: Int
    let propTotal: Int
    let sportId: String
    private var isNFL: Bool { sportId.lowercased() == "nfl" }

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
            intelCell("\(atsCorrect)-\(max(0, atsTotal - atsCorrect))", "ATS RECORD", isNFL ? .cyan : .green)
            intelCell(streakLabel, "STREAK", streak >= 0 ? (isNFL ? .blue : .orange) : .red)
            intelCell("\(bestWeek)", "BEST WEEK", isNFL ? .cyan : .yellow)
            intelCell("\(perfectWeeks)", "PERFECT", isNFL ? .white : .cyan)
            intelCell(accuracy(bestBetHits, bestBetTotal), "BEST BET", isNFL ? .red : .purple)
            intelCell(accuracy(propHits, propTotal), "PROPS", isNFL ? .blue : .pink)
        }
    }

    private var streakLabel: String {
        if streak > 0 { return "W\(streak)" }
        if streak < 0 { return "L\(abs(streak))" }
        return "—"
    }
    private func accuracy(_ hits: Int, _ total: Int) -> String {
        guard total > 0 else { return "—" }
        return "\(Int((Double(hits) / Double(total) * 100).rounded()))%"
    }
    private func intelCell(_ value: String, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.system(size: 18, weight: .black)).monospacedDigit().foregroundStyle(color)
            Text(label).font(.system(size: 7, weight: .black)).tracking(0.8).foregroundStyle(.white.opacity(0.45)).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 12)
        .background(.black.opacity(0.82), in: UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 13, bottomTrailingRadius: 3, topTrailingRadius: 13))
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 13, bottomTrailingRadius: 3, topTrailingRadius: 13).stroke(color.opacity(0.25)))
    }
}

private struct FavoriteTeamShrine: View {
    let team: FavoriteTeam?

    var body: some View {
        Group {
            if let team, team.teamId != "no-team" {
                ZStack {
                    LinearGradient(colors: [teamColors.0.opacity(0.92), .black, teamColors.1.opacity(0.68)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    HStack(spacing: 16) {
                        ZStack {
                            Circle().fill(.black.opacity(0.56)).frame(width: 78, height: 78)
                            Circle().stroke(teamColors.1, lineWidth: 3).frame(width: 72, height: 72)
                            Text(teamMonogram).font(.system(size: 30, weight: .black)).foregroundStyle(.white)
                        }
                        .shadow(color: teamColors.0.opacity(0.65), radius: 18)
                        VStack(alignment: .leading, spacing: 5) {
                            Text("ALLEGIANCE SHRINE").font(.system(size: 8, weight: .black)).tracking(1.8).foregroundStyle(teamColors.1)
                            Text(teamName.uppercased()).font(.system(size: 25, weight: .black)).fontWidth(.condensed).lineLimit(1).minimumScaleFactor(0.65)
                            Text(shrineLine).font(.system(size: 9, weight: .black)).tracking(0.5).foregroundStyle(.white.opacity(0.58))
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(18)
                }
                .frame(maxWidth: .infinity, minHeight: 118)
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 28, bottomTrailingRadius: 4, topTrailingRadius: 28))
                .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 28, bottomTrailingRadius: 4, topTrailingRadius: 28).stroke(teamColors.1.opacity(0.68)))
            } else {
                Text("No allegiance declared. A deeply suspicious amount of emotional stability.")
                    .font(.subheadline.weight(.bold)).foregroundStyle(.white.opacity(0.62))
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
            }
        }
    }

    private var teamName: String {
        team?.teamId.replacingOccurrences(of: "cfb-", with: "").replacingOccurrences(of: "nfl-", with: "").replacingOccurrences(of: "-", with: " ").capitalized ?? "Undeclared"
    }
    private var teamMonogram: String {
        switch team?.teamId.lowercased() {
        case "louisville": return "L"
        case "georgia": return "G"
        case "alabama": return "A"
        case "clemson": return "C"
        case "ohio-state": return "O"
        default: return String(teamName.prefix(1)).uppercased()
        }
    }
    private var teamColors: (Color, Color) {
        switch team?.teamId.lowercased() {
        case "louisville": return (.red, Color(white: 0.82))
        case "georgia": return (.red, .white)
        case "alabama": return (Color(red: 0.62, green: 0.04, blue: 0.10), .white)
        case "clemson": return (.orange, .purple)
        case "ohio-state": return (.red, Color(white: 0.72))
        case "michigan": return (.blue, .yellow)
        case "florida-state": return (Color(red: 0.48, green: 0.10, blue: 0.18), .yellow)
        default: return team?.sportId.lowercased() == "nfl" ? (.blue, .cyan) : (.green, .yellow)
        }
    }
    private var shrineLine: String {
        switch team?.teamId.lowercased() {
        case "louisville": return "CARDINAL DEVOTION · MEDICAL ADVICE IGNORED"
        default: return team?.sportId.lowercased() == "nfl" ? "SUNDAY ALLEGIANCE · EIGHTEEN WEEKS OF EVIDENCE" : "RIDE OR DIE · MOSTLY DIE, STATISTICALLY"
        }
    }
}

private struct AchievementVisual {
    let icon: String
    let glyph: String?
    let color: Color
}

private struct CheevoDefinition: Identifiable {
    let id: String
    let name: String
}

private enum CheevoCatalog {
    static let all: [CheevoDefinition] = raw.split(separator: "\n").compactMap { line in
        let parts = line.split(separator: "|", maxSplits: 1).map(String.init)
        guard parts.count == 2 else { return nil }
        return CheevoDefinition(id: parts[0], name: parts[1])
    }

    /// One-of-one lore belongs only in historical personnel records. These are
    /// not public goals and never appear in the Cheevo catalog. The Creator
    /// deliberately remains public—the lock copy is part of the War Room's trash talk.
    private static let privateLegendaryIds: Set<String> = [
        "worlds_greatest_cavalry_scout", "the_dr", "house_dragon_legendary",
        "hodor_of_hodors", "two_wolves_of_prestige", "built_different_olympian",
        "the_816_archivist"
    ]

    static var publicCatalog: [CheevoDefinition] {
        all.filter { !privateLegendaryIds.contains($0.id) }
    }

    private static let raw = """
the_commissioner|The Creator
war_room_legend|War Room Legend
worlds_greatest_cavalry_scout|World Greatest Cavalry Scout
the_dr|The Dr.
house_dragon_legendary|House Dragon
hodor_of_hodors|The Hodor of Hodors
two_wolves_of_prestige|The Two Wolves of Prestige
built_different_olympian|Built Different
the_816_archivist|The 816 Archivist
immortal_streak|Immortal Streak
the_closer|The Closer
elite_commish|Elite Commish
war_room_general|War Room General
sniper|Sniper
max_card|Max Card
perfect_saturday|Perfect Saturday
seasoned_vet|Seasoned Vet
villain_arc|Villain Arc
crew_points_furnace|Points Furnace
crew_multi_chapter|Multi-Chapter
first_and_final|First & Final
hot_hand|Hot Hand
clean_sheet|Clean Sheet
parlay_pilot|Parlay Pilot
underdog_believer|Underdog Believer
volume_shooter|Volume Shooter
crew_midseason_loyal|Midseason Loyal
crew_dual_desk|Crew Dual Desk
crew_card_grinder|Card Grinder
iron_lungs|Iron Lungs
hate_week_roll_call|Picked a Fight
rivalry_week|Family Group Chat Muted
grudge_veteran|Two-Year Restraining Order
dynasty_of_spite|Generational Hater
clutch_gene|Clutch Gene
cheevo_king|Cheevo King
let_them_cook|Let Them Cook
neighborhood_creeper|Neighborhood Creeper
calendar_cosplayer|Calendar Cosplayer
egg_anniversary|One Year of Bad Picks
egg_curiosity_trophy|Curiosity Didn't Kill the Cat
egg_vonnaggio_gold|Family Vacay Gold
egg_hidden_headline|Ink Stain
egg_leap_day|Time Traveler
egg_birthday|Local Legend Aged Up
egg_lucky_seven|Lucky Seven
egg_obsession|Authorities Concerned
egg_halloween|Boo!
egg_christmas|Candy Cane Edition
egg_thanksgiving|Gravy Boat
egg_newyear|Resolution Already Broken
egg_three_peat|Dynasty Ink
egg_never_give_up|Never Give Up
egg_developer_thanks|Believer
egg_impossible|???
egg_mascot_scout|Mascot Spotter
egg_veterans|The Veterans Have Returned
egg_welcome_home|Welcome Home
first_blood|First Blood
war_room_recruit|War Room Recruit
creator_checked_in|Better Than Christmas
lock_it_in|Lock It In
on_the_board|On the Board
chalk_eater|Chalk Eater
saturday_starter|Saturday Starter
green_light|Green Light
face_of_the_franchise|Face of the Franchise
gameday_ready|Gameday Ready
national_nightmare|National Nightmare
championship_ring|Championship Ring
toilet_crown|Toilet Crown
season_sovereign|Season Sovereign
unbreakable|Unbreakable
dual_desk_legend|Saturday & Sunday
six_seven|Sixxxxx Seveennnn
six_pack_saturday|Six-Pack Saturday
confidence_king|Confidence King
best_bet_assassin|Best Bet Assassin
prop_overlord|Prop Overlord
dog_whisperer|Dog Whisperer
ten_streak_terror|Ten-Streak Terror
division_dominator|Division Dominator
comeback_kid|Comeback Kid
cut_line_killer|Cut Line Killer
iron_card|Iron Card
four_green_friday|Four-Green Friday
sweep_adjacent|Sweep Adjacent
best_bet_banker|Best Bet Banker
prop_prophet|Prop Prophet
underdog_spree|Underdog Spree
chalk_streak|Chalk Streak
division_climber|Division Climber
leaderboard_lookin|Leaderboard Lookin’
cut_line_escape|Cut Line Escape
bottom_of_the_barrel|Bottom of the Barrel
streak_starter|Streak Starter
ten_week_tenant|Ten-Week Tenant
full_conference|Full Conference
road_dog|Road Dog
home_cookin|Home Cookin’
silence_the_room|Silence the Room
card_complete|Card Complete
prop_merchant|Prop Merchant
best_bet_marked|Best Bet Marked
confidence_ladder|Confidence Ladder
division_dweller|Division Dweller
week_one_warrior|Week One Warrior
two_week_tour|Two-Week Tour
halfway_hangin|Halfway Hangin’
double_digit_club|Double Digit Club
fifty_club|Fifty Club
century_club|Century Club
push_happens|Half-Point Hero
favorite_survivor|Favorite Survivor
dog_day_afternoon|Dog Day Afternoon
spread_survivor|Spread Survivor
multi_game_monday|Multi-Game Monday
three_pack|Three-Pack
locker_lurker|Locker Lurker
news_reader|News Reader
board_watcher|Board Watcher
rules_skimmer|Rules Skimmer
crystal_gazed|Crystal Gazed
profile_peeker|Profile Peeker
late_night_lock|Late Night Lock
rematch_ready|Rematch Ready
bare_minimum_dual|Bare Minimum Dual
keys_to_the_war_room|Keys to the War Room
open_for_business|Open for Business
the_velvet_rope|The Velvet Rope
walk_in_warrior|Walk-In Warrior
knock_knock|Knock Knock
welcome_to_the_party|Welcome to the Party
favorite_child|Favorite Child
ride_with_mine|Ride With Mine
tough_love|Tough Love
early_bird_special|Early Bird Special
no_takebacks|No Takebacks
second_thoughts|Second Thoughts
top_shelf_pick|Top-Shelf Pick
the_little_engine|The Little Engine
best_bet_baby|Best Bet Baby
prop_me_up|Prop Me Up
home_cooking_card|Home Cooking
road_snacks|Sunday Driver
dog_tag|Dog Tag
chalk_dust|Chalk Dust
split_decision|Any Given Sunday
lone_wolf|Lone Wolf
photo_finish|Half-Point Heart Attack
thursday_night_shift|Thursday Night Shift
saturday_detention|Saturday Detention
nfl_first_down|First Down
nfl_sunday_service|Sunday Service
nfl_monday_night_closer|Monday Night Closer
nfl_red_zone_regular|Red Zone Regular
nfl_primetime_personnel|Primetime Personnel
nfl_division_business|Division Business
nfl_wild_card_applicant|Wild Card Applicant
nfl_jdam_trainee|JDAM Trainee
nfl_conference_caller|Conference Caller
nfl_super_sunday|Super Sunday
fieldhouse_tip_off|Tip-Off
fieldhouse_full_court_press|Full-Court Press
fieldhouse_buzzer_beater|Buzzer Beater
fieldhouse_chalk_in_the_paint|Chalk in the Paint
fieldhouse_bracket_curious|Bracket Curious
fieldhouse_first_four_foreman|First Four Foreman
fieldhouse_cinderella_scout|Cinderella Scout
fieldhouse_marching_orders|Marching Orders
fieldhouse_hardwood_homer|Hardwood Homer
fieldhouse_net_result|Net Result
cfb_saturday_school|Saturday School
cfb_tailgate_certified|Tailgate Certified
cfb_ranked_and_dangerous|Ranked & Dangerous
cfb_upset_alert|Upset Alert
cfb_noon_whistle|Noon Whistle
cfb_after_dark|After Dark
cfb_grudge_match|Grudge Match
cfb_title_game_tourist|Title Game Tourist
cfb_bowl_curious|Bowl Curious
cfb_bowl_bound|Bowl Bound
"""
}

private enum CheevoRarity: String, CaseIterable, Identifiable {
    case legendary = "LEGENDARY"
    case epic = "EPIC"
    case rare = "RARE"
    case common = "COMMON"

    var id: String { rawValue }
    var color: Color {
        switch self {
        case .legendary: return .yellow
        case .epic: return .purple
        case .rare: return .cyan
        case .common: return .green
        }
    }
    var icon: String {
        switch self {
        case .legendary: return "crown.fill"
        case .epic: return "bolt.shield.fill"
        case .rare: return "diamond.fill"
        case .common: return "star.fill"
        }
    }
    var briefing: String {
        switch self {
        case .legendary: return "CAREER-DEFINING EVIDENCE"
        case .epic: return "SERIOUSLY QUESTIONABLE EXCELLENCE"
        case .rare: return "NOT AN ACCIDENT ANYMORE"
        case .common: return "WHERE THE PROBLEM BEGINS"
        }
    }
    var doorAssetName: String {
        switch self {
        case .legendary: return "LegendaryVaultDoor"
        case .epic: return "EpicVaultDoor"
        case .rare: return "RareVaultDoor"
        case .common: return "CommonVaultDoor"
        }
    }
}

private extension CheevoDefinition {
    var recruitmentTag: (label: String, color: Color)? {
        if id.hasPrefix("nfl_") || ["road_snacks", "split_decision", "photo_finish", "thursday_night_shift"].contains(id) {
            return ("NFL", .blue)
        }
        if id.hasPrefix("fieldhouse_") { return ("FIELDHOUSE", .orange) }
        if id.hasPrefix("cfb_") || id == "saturday_detention" { return ("CFB", Color(red: 0.18, green: 0.95, blue: 0.38)) }
        if rarity == .common { return ("WAR ROOM", Color(white: 0.78)) }
        return nil
    }

    var accentColor: Color { recruitmentTag?.color ?? rarity.color }

    var rarity: CheevoRarity {
        let legendary: Set<String> = [
            "the_commissioner", "war_room_legend", "worlds_greatest_cavalry_scout", "the_dr",
            "house_dragon_legendary", "hodor_of_hodors", "two_wolves_of_prestige",
            "built_different_olympian", "the_816_archivist", "immortal_streak", "the_closer",
            "elite_commish", "egg_impossible", "egg_welcome_home", "national_nightmare",
            "championship_ring", "toilet_crown", "season_sovereign", "unbreakable",
            "dual_desk_legend", "dynasty_of_spite"
        ]
        let epic: Set<String> = [
            "sniper", "max_card", "perfect_saturday", "seasoned_vet", "villain_arc",
            "war_room_general", "crew_points_furnace", "crew_multi_chapter", "six_seven",
            "egg_obsession", "egg_three_peat", "egg_never_give_up",
            "egg_veterans",
            "six_pack_saturday", "confidence_king", "best_bet_assassin",
            "prop_overlord", "dog_whisperer", "ten_streak_terror", "division_dominator",
            "comeback_kid", "cut_line_killer", "iron_card", "grudge_veteran"
        ]
        let rare: Set<String> = [
            "crew_midseason_loyal", "crew_dual_desk", "crew_card_grinder", "neighborhood_creeper",
            "egg_anniversary", "egg_curiosity_trophy", "egg_vonnaggio_gold", "egg_hidden_headline",
            "egg_leap_day", "egg_birthday", "egg_lucky_seven", "egg_halloween",
            "egg_christmas", "egg_thanksgiving", "egg_newyear", "egg_developer_thanks",
            "egg_mascot_scout",
            "first_and_final", "hot_hand", "clean_sheet", "parlay_pilot", "underdog_believer",
            "volume_shooter", "iron_lungs", "rivalry_week", "clutch_gene", "cheevo_king",
            "let_them_cook", "calendar_cosplayer",
            "four_green_friday", "sweep_adjacent", "best_bet_banker", "prop_prophet",
            "underdog_spree", "chalk_streak", "division_climber", "leaderboard_lookin",
            "cut_line_escape", "bottom_of_the_barrel", "ten_week_tenant", "full_conference",
            "road_dog", "home_cookin", "silence_the_room", "fifty_club", "century_club"
        ]
        if legendary.contains(id) { return .legendary }
        if epic.contains(id) { return .epic }
        if rare.contains(id) { return .rare }
        return .common
    }
}

private struct CheevoVaultDoor: View {
    let earned: [ProfileAchievement]
    private var earnedIds: Set<String> {
        Set(earned.map { $0.code == "the_creator" ? "the_commissioner" : $0.code })
    }
    private var visibleCatalog: [CheevoDefinition] { CheevoCatalog.publicCatalog }

    var body: some View {
        VStack(spacing: 13) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("OPEN THE VAULT").font(.headline.weight(.black)).foregroundStyle(.white)
                    Text("\(earnedIds.count) SECURED · \(max(0, visibleCatalog.count - earnedIds.count)) STILL OUT THERE")
                        .font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.48))
                }
                Spacer()
                Image(systemName: "chevron.right.circle.fill").font(.title2).foregroundStyle(.yellow)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(CheevoRarity.allCases) { rarity in
                    let total = visibleCatalog.filter { $0.rarity == rarity }.count
                    let secured = visibleCatalog.filter { $0.rarity == rarity && earnedIds.contains($0.id) }.count
                    HStack(spacing: 8) {
                        Image(systemName: rarity.icon).foregroundStyle(rarity.color)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(rarity.rawValue).font(.system(size: 9, weight: .black)).foregroundStyle(.white)
                            Text("\(secured) / \(total)").font(.system(size: 8, weight: .bold)).foregroundStyle(rarity.color.opacity(0.8))
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(10).background(rarity.color.opacity(0.1), in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(rarity.color.opacity(0.35)))
                }
            }
        }
        .padding(15).background(.black.opacity(0.84), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.yellow.opacity(0.3)))
    }
}

private struct CheevoVaultView: View {
    let earned: [ProfileAchievement]
    let sportId: String
    private var earnedIds: Set<String> {
        Set(earned.map { $0.code == "the_creator" ? "the_commissioner" : $0.code })
    }
    private var visibleCatalog: [CheevoDefinition] { CheevoCatalog.publicCatalog }

    var body: some View {
        ZStack {
            ProfileShrineBackdrop()
            ScrollView {
                VStack(spacing: 15) {
                    VStack(spacing: 5) {
                        Text("AUTHORIZED PERSONNEL ONLY").font(.system(size: 8, weight: .black)).tracking(2).foregroundStyle(.yellow.opacity(0.74))
                        Text("CHEEVO VAULT").font(.system(size: 30, weight: .black)).fontWidth(.condensed)
                        Text("PICK A RARITY. REVIEW THE EVIDENCE.").font(.system(size: 9, weight: .black)).tracking(1.4).foregroundStyle(.white.opacity(0.48))
                    }.padding(.vertical, 18)

                    ForEach(CheevoRarity.allCases) { rarity in
                        NavigationLink {
                            CheevoRarityView(rarity: rarity, earned: earned, sportId: sportId)
                        } label: {
                            rarityDoor(rarity)
                        }.buttonStyle(.plain)
                    }
                }.padding(16).padding(.bottom, 30)
            }
        }
        .navigationTitle("Cheevo Vault").navigationBarTitleDisplayMode(.inline)
    }

    private func rarityDoor(_ rarity: CheevoRarity) -> some View {
        let catalog = visibleCatalog.filter { $0.rarity == rarity }
        let secured = catalog.filter { earnedIds.contains($0.id) }.count
        return VStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 22)
                    .fill(rarity.color.opacity(0.38))
                    .blur(radius: 24)
                    .padding(4)
                RoundedRectangle(cornerRadius: 17)
                    .stroke(rarity.color.opacity(0.72), lineWidth: 5)
                    .blur(radius: 9)
                    .padding(3)
                Image(rarity.doorAssetName).resizable().scaledToFill()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .overlay {
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(
                                LinearGradient(
                                    colors: [.clear, rarity.color.opacity(0.95), .clear, rarity.color.opacity(0.72)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 2.5
                            )
                            .shadow(color: rarity.color.opacity(0.95), radius: 8)
                    }
                    .shadow(color: rarity.color.opacity(0.72), radius: 18)
            }
            .frame(maxWidth: .infinity)
            .frame(height: rarity == .legendary ? 176 : 158)
            .clipped()
            .padding(.horizontal, 3)
            .accessibilityLabel("\(rarity.rawValue) door")
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(rarity.rawValue).font(.title3.weight(.black)).foregroundStyle(.white)
                    Text(rarity.briefing).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(rarity.color.opacity(0.8))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text("\(secured) / \(catalog.count)").font(.headline.weight(.black)).foregroundStyle(rarity.color)
                    Text("SECURED").font(.system(size: 7, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.35))
                }
                Image(systemName: "chevron.right.circle.fill").foregroundStyle(rarity.color)
            }.padding(.horizontal, 4)
        }
        .padding(16).background(.black.opacity(0.84), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(rarity.color.opacity(0.5), lineWidth: 1.5))
    }
}

private struct CheevoRarityView: View {
    let rarity: CheevoRarity
    let earned: [ProfileAchievement]
    let sportId: String
    @State private var selectedCheevo: CheevoDefinition?
    private var earnedById: [String: ProfileAchievement] {
        earned.reduce(into: [:]) { records, achievement in
            let code = achievement.code == "the_creator" ? "the_commissioner" : achievement.code
            records[code] = records[code] ?? achievement
        }
    }
    private var catalog: [CheevoDefinition] {
        CheevoCatalog.publicCatalog.filter { $0.rarity == rarity }
    }

    var body: some View {
        ZStack {
            ProfileShrineBackdrop()
            ScrollView {
                LazyVStack(spacing: 10) {
                    Text(rarity.briefing).font(.caption2.weight(.black)).tracking(1.3).foregroundStyle(rarity.color).padding(.vertical, 8)
                    cheevoBaitSign
                    ForEach(catalog) { cheevo in
                        let achievement = earnedById[cheevo.id]
                        let accent = cheevo.accentColor
                        Button {
                            selectedCheevo = cheevo
                        } label: {
                            HStack(spacing: 13) {
                                Group {
                                    if let artifact = achievementArtifactName(for: cheevo.id) {
                                        ZStack(alignment: .bottomTrailing) {
                                            Image(artifact)
                                                .resizable()
                                                .scaledToFill()
                                                .saturation(achievement == nil ? 0.62 : 1)
                                                .opacity(achievement == nil ? 0.62 : 1)
                                            if achievement == nil {
                                                Image(systemName: "lock.fill")
                                                    .font(.system(size: 8, weight: .black))
                                                    .foregroundStyle(.white)
                                                    .padding(4)
                                                    .background(.black.opacity(0.82), in: Circle())
                                                    .padding(3)
                                            }
                                        }
                                    } else {
                                        GeneratedCheevoArtifactView(code: cheevo.id, locked: achievement == nil)
                                    }
                                }
                                .frame(width: 48, height: 48).clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke((achievement == nil ? accent : accent).opacity(achievement == nil ? 0.18 : 0.42)))
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack(spacing: 6) {
                                        Text(SportIdentity(sportId).cheevoTitle(code: cheevo.id, fallback: cheevo.name)).font(.subheadline.weight(.black)).foregroundStyle(achievement == nil ? .white.opacity(0.55) : .white)
                                        if let tag = cheevo.recruitmentTag {
                                            Text(tag.label).font(.system(size: 7, weight: .black)).tracking(0.8).foregroundStyle(tag.color)
                                                .padding(.horizontal, 5).padding(.vertical, 2)
                                                .background(tag.color.opacity(0.12), in: Capsule())
                                                .overlay(Capsule().stroke(tag.color.opacity(0.45)))
                                        }
                                    }
                                    Text(achievement == nil ? "LOCKED · TAP FOR REQUIREMENTS" : "EARNED · TAP FOR REQUIREMENTS")
                                        .font(.system(size: 8, weight: .black)).tracking(0.8).foregroundStyle(achievement == nil ? .white.opacity(0.24) : accent)
                                }
                                Spacer()
                                if achievement != nil { Image(systemName: "checkmark.seal.fill").foregroundStyle(accent) }
                            }
                            .padding(12).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 15))
                            .overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(achievement == nil ? 0.12 : 0.42)))
                        }.buttonStyle(.plain)
                    }
                }.padding(16).padding(.bottom, 30)
            }
        }
        .navigationTitle(rarity.rawValue.capitalized).navigationBarTitleDisplayMode(.inline)
        .sheet(item: $selectedCheevo) { cheevo in
            CheevoBriefingView(definition: cheevo, achievement: earnedById[cheevo.id], sportId: sportId)
                .presentationDetents([.large]).presentationDragIndicator(.hidden)
        }
    }

    private var cheevoBaitSign: some View {
        let remaining = catalog.filter { earnedById[$0.id] == nil }.count
        let headline: String = {
            switch rarity {
            case .legendary: return "LEGENDS AREN’T BORN. THEY’RE ANNOYINGLY PERSISTENT."
            case .epic: return "YOUR RESUME COULD USE A LITTLE VIOLENCE."
            case .rare: return "CLOSE ENOUGH TO TASTE IT. WEIRD THAT YOU HAVEN’T."
            case .common: return "THESE ARE THE EASY ONES, CHAMP."
            }
        }()
        return VStack(spacing: 6) {
            HStack(spacing: 7) {
                Image(systemName: "scope").foregroundStyle(rarity.color)
                Text("START CHASING CHEEVO POINTS").font(.system(size: 10, weight: .black)).tracking(1.2).foregroundStyle(rarity.color)
            }
            Text(headline).font(.subheadline.weight(.black)).multilineTextAlignment(.center).foregroundStyle(.white)
            Text("\(remaining) STILL AVAILABLE · GO MAKE SOME STATISTICALLY INTERESTING DECISIONS")
                .font(.system(size: 7, weight: .black)).tracking(0.8).multilineTextAlignment(.center).foregroundStyle(.white.opacity(0.38))
        }
        .frame(maxWidth: .infinity).padding(14)
        .background(rarity.color.opacity(0.09), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(rarity.color.opacity(0.4), style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
        .padding(.bottom, 4)
    }
}

private struct CheevoBriefingView: View {
    @Environment(\.dismiss) private var dismiss
    let definition: CheevoDefinition
    let achievement: ProfileAchievement?
    let sportId: String
    private var identity: SportIdentity { SportIdentity(sportId) }

    private var visual: AchievementVisual {
        let base = achievementVisual(for: definition.id)
        return AchievementVisual(icon: base.icon, glyph: base.glyph, color: definition.accentColor)
    }
    private var isEarned: Bool { achievement != nil }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            RadialGradient(colors: [visual.color.opacity(0.28), .black], center: .top, startRadius: 18, endRadius: 500).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 18) {
                    HStack {
                        Text(isEarned ? "SECURED PERSONNEL RECORD" : "PROMOTION INTELLIGENCE")
                            .font(.caption2.weight(.black)).tracking(1.7).foregroundStyle(visual.color)
                        Spacer()
                        Button { dismiss() } label: {
                            Image(systemName: "xmark").font(.headline.weight(.black)).frame(width: 42, height: 42).background(.white.opacity(0.10), in: Circle())
                        }.buttonStyle(.plain).accessibilityLabel("Close Cheevo details")
                    }

                    Group {
                        if let artifact = achievementArtifactName(for: definition.id) {
                            Image(artifact).resizable().scaledToFit()
                                .frame(maxWidth: 310, maxHeight: 310)
                                .clipShape(RoundedRectangle(cornerRadius: 22))
                                .overlay(RoundedRectangle(cornerRadius: 22).stroke(visual.color.opacity(0.45), lineWidth: 2))
                        } else {
                            GeneratedCheevoArtifactView(code: definition.id, locked: !isEarned)
                                .frame(maxWidth: 310, maxHeight: 310)
                                .clipShape(RoundedRectangle(cornerRadius: 22))
                                .overlay(RoundedRectangle(cornerRadius: 22).stroke(visual.color.opacity(0.45), lineWidth: 2))
                        }
                    }.shadow(color: visual.color.opacity(0.45), radius: 24)

                    VStack(spacing: 7) {
                        Text(isEarned ? "ACHIEVEMENT UNLOCKED" : "ACHIEVEMENT LOCKED")
                            .font(.system(size: 9, weight: .black)).tracking(2).foregroundStyle(isEarned ? .green : .white.opacity(0.46))
                        Text(identity.cheevoTitle(code: definition.id, fallback: definition.name).uppercased()).font(.system(size: 29, weight: .black)).fontWidth(.condensed).multilineTextAlignment(.center)
                        Text("\(PromotionPoints.points(for: definition.id)) PROMOTION POINTS")
                            .font(.caption.weight(.black)).foregroundStyle(visual.color)
                    }

                    if let lore = CheevoLore.text(for: definition.id, revealed: isEarned) {
                        Text(identity.localizedCheevoCopy(lore))
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.72))
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: 9) {
                        Label(isEarned ? "HOW YOU EARNED IT" : "HOW TO EARN IT", systemImage: isEarned ? "checkmark.seal.fill" : "scope")
                            .font(.caption.weight(.black)).tracking(1).foregroundStyle(visual.color)
                        Text(identity.localizedCheevoCopy(CheevoRequirements.text(for: definition.id)))
                            .font(.body.weight(.semibold)).foregroundStyle(.white.opacity(0.86)).fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading).padding(16)
                    .background(.black.opacity(0.74), in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(visual.color.opacity(0.42)))

                    if let achievement {
                        Text(identity.localizedCheevoCopy(achievement.flavor)).font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.58)).multilineTextAlignment(.center)
                        if !achievement.earnedAt.isEmpty {
                            Label("PERMANENT RECORD SAVED", systemImage: "externaldrive.fill.badge.checkmark")
                                .font(.caption2.weight(.black)).foregroundStyle(.green)
                        }
                    } else {
                        Text("YOUR ORDERS ARE CLEAR. THE EXECUTION REMAINS QUESTIONABLE.")
                            .font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(.white.opacity(0.34)).multilineTextAlignment(.center)
                    }
                }.padding(22)
            }
        }.preferredColorScheme(.dark)
    }
}

private func trophyArtifactName(for trophy: ProfileTrophy) -> String? {
    switch trophy.trophyDesignId ?? trophy.trophyType {
    case "command_cup", "championship": return "ChampionshipArtifact"
    case "nfc_championship": return "NfcChampionshipArtifact"
    case "afc_championship": return "AfcChampionshipArtifact"
    case "golden_gut": return "GoldenGutArtifact"
    case "the_receipt": return "TheReceiptArtifact"
    case "insufferable_crown": return "InsufferableCrownArtifact"
    case "brass_football": return "BigBrassFootballArtifact"
    case "last_one_standing": return "LastOneStandingArtifact"
    case "nfl_sunday_scepter": return "NflSundayScepterArtifact"
    case "nfl_gridiron_crown": return "NflGridironCrownArtifact"
    case "nfl_fourth_down_forge": return "NflFourthDownForgeArtifact"
    case "nfl_two_minute_monument": return "NflTwoMinuteMonumentArtifact"
    case "nfl_iron_end_zone": return "NflIronEndZoneArtifact"
    case "nfl_final_whistle": return "NflFinalWhistleArtifact"
    case "crystal_ball": return "VillageNerdArtifact"
    case "toilet_bowl": return "ToiletBowlArtifact"
    default: return nil
    }
}

private func trophyDisplayTitle(_ type: String) -> String {
    switch type.lowercased() {
    case "championship": return "LEAGUE CHAMPION"
    case "toilet_bowl": return "TOILET BOWL"
    case "crystal_ball": return "VILLAGE NERD"
    case "nfc_championship": return "NFC CHAMPIONSHIP"
    case "afc_championship": return "AFC CHAMPIONSHIP"
    default: return type.replacingOccurrences(of: "_", with: " ").uppercased()
    }
}

private func resolvedTrophyMap(live: [ProfileTrophy], standings: [Standing]) -> [UUID: ProfileTrophy] {
    var result: [UUID: ProfileTrophy] = [:]
    for standing in standings {
        let playerTrophies = LegacyCareerRecords.trophies(
            for: standing.userId,
            merging: live.filter { $0.winnerUserId == standing.userId }
        )
        if let featured = playerTrophies.max(by: { left, right in
            let leftPriority = trophyFeaturePriority(left.trophyType)
            let rightPriority = trophyFeaturePriority(right.trophyType)
            if leftPriority != rightPriority { return leftPriority < rightPriority }
            return left.seasonYear < right.seasonYear
        }) {
            result[standing.userId] = featured
        }
    }
    return result
}

private func trophyFeaturePriority(_ type: String) -> Int {
    switch type.lowercased() {
    case "championship": return 100
    case "nfc_championship", "afc_championship": return 80
    case let value where value.contains("division"): return 70
    case "crystal_ball": return 60
    case "toilet_bowl": return 50
    default: return 40
    }
}

private func achievementVisual(for code: String) -> AchievementVisual {
    switch code.lowercased() {
    case "the_creator": return AchievementVisual(icon: "shield.lefthalf.filled", glyph: "🪖", color: .green)
    case "the_commissioner": return AchievementVisual(icon: "crown.fill", glyph: "👑", color: .yellow)
    case "two_wolves_of_prestige": return AchievementVisual(icon: "pawprint.fill", glyph: "🐺", color: .yellow)
    case "egg_obsession": return AchievementVisual(icon: "eye.fill", glyph: "🫣", color: .purple)
    case "egg_three_peat": return AchievementVisual(icon: "3.circle.fill", glyph: "3️⃣", color: .purple)
    case "egg_never_give_up": return AchievementVisual(icon: "figure.strengthtraining.traditional", glyph: "🫡", color: .purple)
    case "egg_veterans": return AchievementVisual(icon: "medal.fill", glyph: "🎖️", color: .purple)
    case "egg_anniversary": return AchievementVisual(icon: "calendar.badge.clock", glyph: "🎂", color: .cyan)
    case "egg_curiosity_trophy": return AchievementVisual(icon: "cat.fill", glyph: "🐈", color: .cyan)
    case "egg_vonnaggio_gold": return AchievementVisual(icon: "sun.max.fill", glyph: "🏖️", color: .cyan)
    case "egg_hidden_headline": return AchievementVisual(icon: "newspaper.fill", glyph: "🗞️", color: .cyan)
    case "egg_leap_day": return AchievementVisual(icon: "hare.fill", glyph: "🐇", color: .cyan)
    case "egg_birthday": return AchievementVisual(icon: "gift.fill", glyph: "🎁", color: .cyan)
    case "egg_lucky_seven": return AchievementVisual(icon: "7.circle.fill", glyph: "🎰", color: .cyan)
    case "egg_halloween": return AchievementVisual(icon: "moon.haze.fill", glyph: "🎃", color: .cyan)
    case "egg_christmas": return AchievementVisual(icon: "snowflake", glyph: "🎄", color: .cyan)
    case "egg_thanksgiving": return AchievementVisual(icon: "fork.knife", glyph: "🦃", color: .cyan)
    case "egg_newyear": return AchievementVisual(icon: "sparkles", glyph: "🎆", color: .cyan)
    case "egg_developer_thanks": return AchievementVisual(icon: "heart.fill", glyph: "💚", color: .cyan)
    case "egg_mascot_scout": return AchievementVisual(icon: "binoculars.fill", glyph: "🦅", color: .cyan)
    case "neighborhood_creeper": return AchievementVisual(icon: "binoculars.fill", glyph: "🪟", color: .green)
    case "let_them_cook": return AchievementVisual(icon: "cpu.fill", glyph: "🤖", color: .purple)
    case "cheevo_king": return AchievementVisual(icon: "crown.fill", glyph: "👑", color: .yellow)
    case "clutch_gene": return AchievementVisual(icon: "snowflake", glyph: "🧊", color: .cyan)
    case "calendar_cosplayer": return AchievementVisual(icon: "theatermasks.fill", glyph: "🎭", color: .purple)
    case "hate_week_roll_call": return AchievementVisual(icon: "figure.boxing", glyph: "🥊", color: .green)
    case "rivalry_week": return AchievementVisual(icon: "iphone.slash", glyph: "📵", color: .cyan)
    case "grudge_veteran": return AchievementVisual(icon: "doc.text.fill", glyph: "🧾", color: .purple)
    case "dynasty_of_spite": return AchievementVisual(icon: "crown.fill", glyph: "🧬", color: .yellow)
    case "war_room_legend": return AchievementVisual(icon: "trophy.fill", glyph: "🏆", color: .yellow)
    case "elite_commish": return AchievementVisual(icon: "scalemass.fill", glyph: "⚖️", color: .yellow)
    case "war_room_recruit": return AchievementVisual(icon: "helmet.fill", glyph: "🪖", color: .green)
    case "creator_checked_in": return AchievementVisual(icon: "gift.fill", glyph: "🎁", color: .red)
    case "face_of_the_franchise": return AchievementVisual(icon: "person.crop.circle.badge.camera.fill", glyph: "📸", color: .cyan)
    case "first_blood": return AchievementVisual(icon: "drop.fill", glyph: "🩸", color: .red)
    case "lock_it_in": return AchievementVisual(icon: "lock.fill", glyph: "🔐", color: .green)
    case "on_the_board": return AchievementVisual(icon: "chart.bar.fill", glyph: "📍", color: .green)
    case "chalk_eater": return AchievementVisual(icon: "figure.american.football", glyph: "🧱", color: .green)
    case "saturday_starter": return AchievementVisual(icon: "calendar", glyph: "🗓️", color: .green)
    case "green_light": return AchievementVisual(icon: "light.beacon.max.fill", glyph: "🚦", color: .green)
    case "gameday_ready": return AchievementVisual(icon: "backpack.fill", glyph: "🎒", color: .green)
    case "streak_starter": return AchievementVisual(icon: "flame.fill", glyph: "🔥", color: .green)
    case "card_complete": return AchievementVisual(icon: "checkmark.rectangle.stack.fill", glyph: "✅", color: .green)
    case "prop_merchant": return AchievementVisual(icon: "text.badge.checkmark", glyph: "🧾", color: .green)
    case "best_bet_marked": return AchievementVisual(icon: "star.square.fill", glyph: "⭐️", color: .green)
    case "confidence_ladder": return AchievementVisual(icon: "chart.bar.xaxis.ascending", glyph: "🪜", color: .green)
    case "division_dweller": return AchievementVisual(icon: "house.fill", glyph: "🏠", color: .green)
    case "week_one_warrior": return AchievementVisual(icon: "1.circle.fill", glyph: "1️⃣", color: .green)
    case "two_week_tour": return AchievementVisual(icon: "2.circle.fill", glyph: "2️⃣", color: .green)
    case "halfway_hangin": return AchievementVisual(icon: "circle.lefthalf.filled", glyph: "🪢", color: .green)
    case "double_digit_club": return AchievementVisual(icon: "10.circle.fill", glyph: "🔟", color: .green)
    case "push_happens": return AchievementVisual(icon: "arrow.left.arrow.right", glyph: "↔️", color: .green)
    case "favorite_survivor": return AchievementVisual(icon: "shield.checkered", glyph: "🛡️", color: .green)
    case "dog_day_afternoon": return AchievementVisual(icon: "pawprint.fill", glyph: "🐶", color: .green)
    case "spread_survivor": return AchievementVisual(icon: "ruler.fill", glyph: "📏", color: .green)
    case "multi_game_monday": return AchievementVisual(icon: "moon.stars.fill", glyph: "🌙", color: .green)
    case "three_pack": return AchievementVisual(icon: "3.circle.fill", glyph: "3️⃣", color: .green)
    case "locker_lurker": return AchievementVisual(icon: "eye.fill", glyph: "👀", color: .green)
    case "news_reader": return AchievementVisual(icon: "newspaper.fill", glyph: "📰", color: .green)
    case "board_watcher": return AchievementVisual(icon: "binoculars.fill", glyph: "🔭", color: .green)
    case "rules_skimmer": return AchievementVisual(icon: "book.pages.fill", glyph: "📖", color: .green)
    case "crystal_gazed": return AchievementVisual(icon: "sparkles", glyph: "🔮", color: .green)
    case "profile_peeker": return AchievementVisual(icon: "person.text.rectangle.fill", glyph: "🕵️", color: .green)
    case "late_night_lock": return AchievementVisual(icon: "moon.fill", glyph: "🌃", color: .green)
    case "rematch_ready": return AchievementVisual(icon: "arrow.trianglehead.2.clockwise.rotate.90", glyph: "🔁", color: .green)
    case "bare_minimum_dual": return AchievementVisual(icon: "2.circle.fill", glyph: "✌️", color: .green)
    case "keys_to_the_war_room": return AchievementVisual(icon: "key.fill", glyph: "🗝️", color: .yellow)
    case "open_for_business": return AchievementVisual(icon: "door.left.hand.open", glyph: "🚪", color: .green)
    case "the_velvet_rope": return AchievementVisual(icon: "person.badge.key.fill", glyph: "🪢", color: .purple)
    case "walk_in_warrior": return AchievementVisual(icon: "figure.walk.arrival", glyph: "🥾", color: .cyan)
    case "knock_knock": return AchievementVisual(icon: "hand.raised.fingers.spread.fill", glyph: "✊", color: .orange)
    case "welcome_to_the_party": return AchievementVisual(icon: "party.popper.fill", glyph: "🎉", color: .pink)
    case "favorite_child": return AchievementVisual(icon: "heart.circle.fill", glyph: "💚", color: .green)
    case "ride_with_mine": return AchievementVisual(icon: "heart.fill", glyph: "🫡", color: .cyan)
    case "tough_love": return AchievementVisual(icon: "heart.slash.fill", glyph: "💔", color: .red)
    case "early_bird_special": return AchievementVisual(icon: "bird.fill", glyph: "🐦", color: .yellow)
    case "no_takebacks": return AchievementVisual(icon: "lock.shield.fill", glyph: "🔒", color: .green)
    case "second_thoughts": return AchievementVisual(icon: "arrow.triangle.2.circlepath", glyph: "🤔", color: .orange)
    case "top_shelf_pick": return AchievementVisual(icon: "5.circle.fill", glyph: "🖐️", color: .yellow)
    case "the_little_engine": return AchievementVisual(icon: "1.circle.fill", glyph: "🚂", color: .cyan)
    case "best_bet_baby": return AchievementVisual(icon: "star.circle.fill", glyph: "👶", color: .pink)
    case "prop_me_up": return AchievementVisual(icon: "checkmark.bubble.fill", glyph: "🪜", color: .green)
    case "home_cooking_card": return AchievementVisual(icon: "house.fill", glyph: "🍳", color: .orange)
    case "road_snacks": return AchievementVisual(icon: "car.fill", glyph: "🥨", color: .cyan)
    case "dog_tag": return AchievementVisual(icon: "pawprint.fill", glyph: "🐕", color: .green)
    case "chalk_dust": return AchievementVisual(icon: "scribble.variable", glyph: "🧑‍🏫", color: .white)
    case "split_decision": return AchievementVisual(icon: "scalemass.fill", glyph: "⚖️", color: .orange)
    case "lone_wolf": return AchievementVisual(icon: "moon.stars.fill", glyph: "🐺", color: .purple)
    case "photo_finish": return AchievementVisual(icon: "camera.aperture", glyph: "📸", color: .cyan)
    case "thursday_night_shift": return AchievementVisual(icon: "moon.fill", glyph: "🌙", color: .blue)
    case "saturday_detention": return AchievementVisual(icon: "building.columns.fill", glyph: "📝", color: .orange)
    case "nfl_first_down": return AchievementVisual(icon: "1.circle.fill", glyph: "🏈", color: .blue)
    case "nfl_sunday_service": return AchievementVisual(icon: "sun.max.fill", glyph: "⛪️", color: .yellow)
    case "nfl_monday_night_closer": return AchievementVisual(icon: "moon.stars.fill", glyph: "🌃", color: .blue)
    case "nfl_red_zone_regular": return AchievementVisual(icon: "rectangle.inset.filled.and.person.filled", glyph: "🚨", color: .red)
    case "nfl_primetime_personnel": return AchievementVisual(icon: "tv.fill", glyph: "📺", color: .purple)
    case "nfl_division_business": return AchievementVisual(icon: "briefcase.fill", glyph: "💼", color: .orange)
    case "nfl_wild_card_applicant": return AchievementVisual(icon: "rectangle.portrait.on.rectangle.portrait.fill", glyph: "🃏", color: .cyan)
    case "nfl_jdam_trainee": return AchievementVisual(icon: "scope", glyph: "💣", color: .green)
    case "nfl_conference_caller": return AchievementVisual(icon: "phone.fill", glyph: "☎️", color: .blue)
    case "nfl_super_sunday": return AchievementVisual(icon: "trophy.fill", glyph: "🏟️", color: .yellow)
    case "fieldhouse_tip_off": return AchievementVisual(icon: "basketball.fill", glyph: "🏀", color: .orange)
    case "fieldhouse_full_court_press": return AchievementVisual(icon: "figure.basketball", glyph: "🗜️", color: .red)
    case "fieldhouse_buzzer_beater": return AchievementVisual(icon: "timer", glyph: "⏰", color: .yellow)
    case "fieldhouse_chalk_in_the_paint": return AchievementVisual(icon: "paintbrush.pointed.fill", glyph: "🎨", color: .white)
    case "fieldhouse_bracket_curious": return AchievementVisual(icon: "point.3.connected.trianglepath.dotted", glyph: "🧐", color: .purple)
    case "fieldhouse_first_four_foreman": return AchievementVisual(icon: "hammer.fill", glyph: "🔨", color: .orange)
    case "fieldhouse_cinderella_scout": return AchievementVisual(icon: "shoe.fill", glyph: "👠", color: .pink)
    case "fieldhouse_marching_orders": return AchievementVisual(icon: "list.clipboard.fill", glyph: "📋", color: .green)
    case "fieldhouse_hardwood_homer": return AchievementVisual(icon: "house.fill", glyph: "🏠", color: .orange)
    case "fieldhouse_net_result": return AchievementVisual(icon: "checkmark.seal.fill", glyph: "🥅", color: .green)
    case "cfb_saturday_school": return AchievementVisual(icon: "graduationcap.fill", glyph: "🎓", color: .green)
    case "cfb_tailgate_certified": return AchievementVisual(icon: "takeoutbag.and.cup.and.straw.fill", glyph: "🌭", color: .orange)
    case "cfb_ranked_and_dangerous": return AchievementVisual(icon: "number.circle.fill", glyph: "🔢", color: .green)
    case "cfb_upset_alert": return AchievementVisual(icon: "exclamationmark.triangle.fill", glyph: "🚨", color: .red)
    case "cfb_noon_whistle": return AchievementVisual(icon: "sun.max.fill", glyph: "☀️", color: .yellow)
    case "cfb_after_dark": return AchievementVisual(icon: "moon.haze.fill", glyph: "🌌", color: .purple)
    case "cfb_grudge_match": return AchievementVisual(icon: "figure.wrestling", glyph: "😡", color: .green)
    case "cfb_title_game_tourist": return AchievementVisual(icon: "ticket.fill", glyph: "🎟️", color: .cyan)
    case "cfb_bowl_curious": return AchievementVisual(icon: "takeoutbag.and.cup.and.straw.fill", glyph: "🥣", color: .orange)
    case "cfb_bowl_bound": return AchievementVisual(icon: "airplane.departure", glyph: "🛫", color: .green)
    case let value where value.contains("chalk"): return AchievementVisual(icon: "figure.american.football", glyph: "🧱", color: .yellow)
    case let value where value.contains("chaos"): return AchievementVisual(icon: "tornado", glyph: "🌪️", color: .purple)
    case let value where value.contains("streak"): return AchievementVisual(icon: "flame.fill", glyph: "🔥", color: .orange)
    case let value where value.contains("perfect"): return AchievementVisual(icon: "scope", glyph: "🎯", color: .cyan)
    case let value where value.contains("friend"): return AchievementVisual(icon: "person.2.fill", glyph: "🤝", color: .pink)
    default: return AchievementVisual(icon: "medal.star.fill", glyph: nil, color: .yellow)
    }
}

private func achievementArtifactName(for code: String) -> String? {
    switch code.lowercased() {
    case "the_creator": return "CreatorRangerCheevoArtifact"
    case "the_commissioner": return "CreatorCheevoArtifact"
    case "neighborhood_creeper": return "NeighborhoodCreeperCheevoArtifact"
    case "house_dragon_legendary": return "HouseDragonCheevoArtifact"
    case "the_dr": return "DoctorCheevoArtifact"
    case "the_816_archivist": return "Archivist816CheevoArtifact"
    case "worlds_greatest_cavalry_scout": return "CavalryScoutCheevoArtifact"
    case "hodor_of_hodors": return "HodorCheevoArtifact"
    case "built_different_olympian": return "BuiltDifferentCheevoArtifact"
    case "war_room_legend": return "WarRoomLegendArtifact"
    case "immortal_streak": return "ImmortalStreakArtifact"
    case "the_closer": return "TheCloserArtifact"
    case "elite_commish": return "EliteCommishArtifact"
    case "egg_impossible": return "ImpossibleArtifact"
    case "egg_welcome_home": return "WelcomeHomeArtifact"
    case "national_nightmare": return "NationalNightmareArtifact"
    case "championship_ring": return "ChampionshipRingCheevoArtifact"
    case "toilet_crown": return "ToiletCrownCheevoArtifact"
    case "season_sovereign": return "SeasonSovereignArtifact"
    case "unbreakable": return "UnbreakableArtifact"
    case "dual_desk_legend": return "DualDeskLegendArtifact"
    case "dynasty_of_spite": return "DynastyOfSpiteLegendary"
    case "war_room_general": return "WarRoomGeneralEpic"
    case "sniper": return "SniperEpic"
    case "max_card": return "MaxCardEpic"
    case "perfect_saturday": return "PerfectSaturdayEpic"
    case "seasoned_vet": return "SeasonedVetEpic"
    case "villain_arc": return "VillainArcEpic"
    case "crew_points_furnace": return "PointsFurnaceEpic"
    case "crew_multi_chapter": return "MultiChapterEpic"
    case "six_seven": return "SixSevenEpic"
    case "six_pack_saturday": return "SixPackSaturdayEpic"
    case "confidence_king": return "ConfidenceKingEpic"
    case "best_bet_assassin": return "BestBetAssassinEpic"
    case "prop_overlord": return "PropOverlordEpic"
    case "dog_whisperer": return "DogWhispererEpic"
    case "ten_streak_terror": return "TenStreakTerrorEpic"
    case "division_dominator": return "DivisionDominatorEpic"
    case "comeback_kid": return "ComebackKidEpic"
    case "cut_line_killer": return "CutLineKillerEpic"
    case "iron_card": return "IronCardEpic"
    case "grudge_veteran": return "GrudgeVeteranEpic"
    case "crew_midseason_loyal": return "CrewMidseasonRare"
    case "crew_dual_desk": return "CrewDualDeskRare"
    case "crew_card_grinder": return "CrewCardGrinderRare"
    case "first_and_final": return "FirstFinalRare"
    case "hot_hand": return "HotHandRare"
    case "clean_sheet": return "CleanSheetRare"
    case "parlay_pilot": return "ParlayPilotRare"
    case "underdog_believer": return "UnderdogBelieverRare"
    case "volume_shooter": return "VolumeShooterRare"
    case "iron_lungs": return "IronLungsRare"
    case "rivalry_week": return "RivalryWeekRare"
    case "hate_week_roll_call": return "HateWeekRollCallCommon"
    case "clutch_gene": return "ClutchGeneRare"
    case "cheevo_king": return "CheevoKingRare"
    case "let_them_cook": return "LetThemCookRare"
    case "calendar_cosplayer": return "CalendarCosplayerRare"
    case "four_green_friday": return "FourGreenFridayRare"
    case "sweep_adjacent": return "SweepAdjacentRare"
    case "best_bet_banker": return "BestBetBankerRare"
    case "prop_prophet": return "PropProphetRare"
    case "underdog_spree": return "UnderdogSpreeRare"
    case "road_dog": return "RoadDogRare"
    case "home_cookin": return "HomeCookinRare"
    case "division_climber": return "DivisionClimberRare"
    case "leaderboard_lookin": return "LeaderboardLookinRare"
    case "cut_line_escape": return "CutLineEscapeRare"
    case "bottom_of_the_barrel": return "BottomBarrelRare"
    case "silence_the_room": return "SilenceRoomRare"
    case "full_conference": return "FullConferenceRare"
    case "fifty_club": return "FiftyClubRare"
    case "century_club": return "CenturyClubRare"
    case "ten_week_tenant": return "TenWeekTenantRare"
    case "chalk_streak": return "ChalkStreakRare"
    default: return nil
    }
}

private struct AchievementArtifactTile: View {
    let achievement: ProfileAchievement
    let sportId: String
    private var visual: AchievementVisual { achievementVisual(for: achievement.code) }
    private var displayTitle: String { SportIdentity(sportId).cheevoTitle(code: achievement.code, fallback: achievement.title) }

    var body: some View {
        VStack(spacing: 9) {
            Group {
                if let artifact = achievementArtifactName(for: achievement.code) {
                    Image(artifact).resizable().scaledToFill()
                        .frame(width: 92, height: 92).clipShape(RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(visual.color.opacity(0.45)))
                } else {
                    GeneratedCheevoArtifactView(code: achievement.code, locked: false)
                        .frame(width: 92, height: 92).clipShape(RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(visual.color.opacity(0.45)))
                }
            }
            .shadow(color: visual.color.opacity(0.32), radius: 10)
            Text(displayTitle.uppercased()).font(.system(size: 11, weight: .black)).tracking(0.5).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.72)
            Text("TAP FOR RECEIPTS").font(.system(size: 7, weight: .black)).tracking(1).foregroundStyle(visual.color.opacity(0.82))
        }
        .frame(maxWidth: .infinity, minHeight: 142)
        .padding(12)
        .background(LinearGradient(colors: [.black.opacity(0.94), visual.color.opacity(0.13)], startPoint: .top, endPoint: .bottom), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 20, bottomTrailingRadius: 4, topTrailingRadius: 20))
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 20, bottomTrailingRadius: 4, topTrailingRadius: 20).stroke(visual.color.opacity(0.38)))
        .accessibilityLabel("\(displayTitle), earned achievement. Tap for details.")
    }
}

private struct AchievementGlyph: View {
    let visual: AchievementVisual
    let size: CGFloat
    var body: some View {
        Group {
            if let glyph = visual.glyph { Text(glyph).font(.system(size: size)) }
            else { Image(systemName: visual.icon).font(.system(size: size, weight: .black)).foregroundStyle(visual.color) }
        }
        .accessibilityHidden(true)
    }
}

private struct GeneratedCheevoArtifactView: View {
    let code: String
    let locked: Bool
    private var visual: AchievementVisual { achievementVisual(for: code) }
    private var definition: CheevoDefinition? {
        let normalized = code == "the_creator" ? "the_commissioner" : code.lowercased()
        return CheevoCatalog.all.first { $0.id == normalized }
    }
    private var rarity: CheevoRarity { definition?.rarity ?? .common }
    private var assetName: String {
        if locked && rarity == .common { return "CommonLockedCheevoArtifact" }
        switch rarity {
        case .legendary: return "LegendaryFallbackCheevoArtifact"
        case .epic: return "EpicFallbackCheevoArtifact"
        case .rare: return "RareFallbackCheevoArtifact"
        case .common:
            switch definition?.recruitmentTag?.label {
            case "NFL": return "CommonNflCheevoArtifact"
            case "CFB": return "CommonCfbCheevoArtifact"
            case "FIELDHOUSE": return "CommonFieldhouseCheevoArtifact"
            default: return "CommonUnlockedCheevoArtifact"
            }
        }
    }

    var body: some View {
        GeometryReader { proxy in
            let edge = min(proxy.size.width, proxy.size.height)
            ZStack {
                Image(assetName)
                    .resizable()
                    .scaledToFill()
                    .saturation(locked ? 0.35 : 1)
                    .opacity(locked ? 0.68 : 1)
                if locked && rarity != .common {
                    Image(systemName: "lock.fill")
                        .font(.system(size: edge * 0.18, weight: .black))
                        .foregroundStyle(.white.opacity(0.72))
                        .padding(edge * 0.09)
                        .background(.black.opacity(0.76), in: Circle())
                } else if !locked {
                    Circle()
                        .fill(.black.opacity(0.58))
                        .frame(width: edge * 0.40, height: edge * 0.40)
                        .overlay(Circle().stroke(visual.color.opacity(0.92), lineWidth: max(1, edge * 0.016)))
                    AchievementGlyph(visual: visual, size: edge * 0.22)
                        .shadow(color: visual.color.opacity(0.9), radius: edge * 0.05)
                }
            }
        }
        .accessibilityHidden(true)
    }
}

private struct AchievementEvidenceView: View {
    @Environment(\.dismiss) private var dismiss
    let achievement: ProfileAchievement
    let visual: AchievementVisual
    let sportId: String
    private var identity: SportIdentity { SportIdentity(sportId) }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            RadialGradient(colors: [visual.color.opacity(0.30), .black], center: .top, startRadius: 20, endRadius: 470).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 18) {
                HStack {
                    Text("PERMANENT PERSONNEL RECORD").font(.caption2.weight(.black)).tracking(2).foregroundStyle(visual.color)
                    Spacer()
                    Button { dismiss() } label: { Image(systemName: "xmark").font(.headline.weight(.black)).frame(width: 42, height: 42).background(.white.opacity(0.10), in: Circle()) }
                        .buttonStyle(.plain).accessibilityLabel("Close achievement")
                }
                Spacer(minLength: 4)
                Group {
                    if let artifact = achievementArtifactName(for: achievement.code) {
                        Image(artifact).resizable().scaledToFit()
                            .frame(maxWidth: 310, maxHeight: 310)
                            .clipShape(RoundedRectangle(cornerRadius: 22))
                            .overlay(RoundedRectangle(cornerRadius: 22).stroke(visual.color.opacity(0.4)))
                    } else {
                        GeneratedCheevoArtifactView(code: achievement.code, locked: false)
                            .frame(maxWidth: 310, maxHeight: 310)
                            .clipShape(RoundedRectangle(cornerRadius: 22))
                            .overlay(RoundedRectangle(cornerRadius: 22).stroke(visual.color.opacity(0.4)))
                    }
                }
                .shadow(color: visual.color.opacity(0.52), radius: 26)
                VStack(spacing: 7) {
                    Text("ACHIEVEMENT UNLOCKED").font(.system(size: 9, weight: .black)).tracking(2).foregroundStyle(.green)
                    Text(identity.cheevoTitle(code: achievement.code, fallback: achievement.title).uppercased()).font(.system(size: 30, weight: .black)).fontWidth(.condensed).multilineTextAlignment(.center)
                    Text(identity.localizedCheevoCopy(achievement.flavor)).font(.body.weight(.semibold)).foregroundStyle(.white.opacity(0.68)).multilineTextAlignment(.center)
                }
                VStack(alignment: .leading, spacing: 8) {
                    Label("HOW THIS WAS EARNED", systemImage: "scope")
                        .font(.caption.weight(.black)).tracking(1).foregroundStyle(visual.color)
                    Text(identity.localizedCheevoCopy(CheevoRequirements.text(for: achievement.code)))
                        .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.82)).fixedSize(horizontal: false, vertical: true)
                    Text("\(PromotionPoints.points(for: achievement.code)) PROMOTION POINTS")
                        .font(.caption2.weight(.black)).foregroundStyle(visual.color)
                }
                .frame(maxWidth: .infinity, alignment: .leading).padding(14)
                .background(.black.opacity(0.68), in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(visual.color.opacity(0.36)))
                if !achievement.earnedAt.isEmpty {
                    Label(evidenceDate, systemImage: "calendar.badge.checkmark")
                        .font(.caption.weight(.black)).foregroundStyle(visual.color)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(visual.color.opacity(0.12), in: Capsule()).overlay(Capsule().stroke(visual.color.opacity(0.40)))
                }
                Spacer()
                Text("THE DATABASE REMEMBERS. EVEN IF EVERYONE ELSE PRETENDS NOT TO.")
                    .font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(.white.opacity(0.34)).multilineTextAlignment(.center)
            }
                .padding(22)
            }
            .scrollIndicators(.hidden)
        }
        .preferredColorScheme(.dark)
    }

    private var evidenceDate: String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: achievement.earnedAt) else { return "EARNED · DATE CLASSIFIED" }
        return "EARNED · \(date.formatted(date: .abbreviated, time: .omitted).uppercased())"
    }
}

private struct TrophyEvidenceView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var auth: AuthStore
    let trophy: ProfileTrophy
    let title: String
    @State private var trophyTapCount = 0
    @State private var lastTrophyTap: Date?
    @State private var discoveryMessage: String?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            RadialGradient(colors: [.yellow.opacity(0.24), .black], center: .top, startRadius: 10, endRadius: 520).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 18) {
                    HStack {
                        Text("HARDWARE VAULT · \(String(trophy.seasonYear))").font(.caption2.weight(.black)).tracking(2).foregroundStyle(.yellow)
                        Spacer()
                        Button { dismiss() } label: { Image(systemName: "xmark").font(.headline.weight(.black)).frame(width: 42, height: 42).background(.white.opacity(0.10), in: Circle()) }
                            .buttonStyle(.plain).accessibilityLabel("Close trophy")
                    }
                    Group {
                        if let artifactName {
                            Image(artifactName).resizable().scaledToFit()
                                .frame(maxWidth: 360, maxHeight: 360)
                                .clipShape(RoundedRectangle(cornerRadius: 22))
                                .overlay(RoundedRectangle(cornerRadius: 22).stroke(.yellow.opacity(0.42), lineWidth: 2))
                                .shadow(color: .yellow.opacity(0.40), radius: 28)
                        } else {
                            Image(systemName: trophy.trophyType == "toilet_bowl" ? "toilet.fill" : "trophy.fill")
                                .font(.system(size: 128, weight: .black)).foregroundStyle(trophy.trophyType == "toilet_bowl" ? .brown : .yellow)
                                .shadow(color: .yellow.opacity(0.45), radius: 26)
                                .frame(minHeight: 210)
                        }
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { registerTrophyTap() }
                    Text(title).font(.system(size: 32, weight: .black)).fontWidth(.condensed).multilineTextAlignment(.center)
                    Text(trophy.subtitle ?? "\(String(trophy.seasonYear)) · Permanent career record")
                        .font(.headline.weight(.bold)).foregroundStyle(.yellow).multilineTextAlignment(.center)

                    VStack(spacing: 8) {
                        Text("OFFICIAL ENGRAVING").font(.system(size: 8, weight: .black)).tracking(2).foregroundStyle(.black.opacity(0.62))
                        Text(trophy.winnerName.uppercased()).font(.system(size: 24, weight: .black, design: .serif)).fontWidth(.condensed).multilineTextAlignment(.center)
                        Text("\(title.uppercased()) · \(String(trophy.seasonYear))").font(.caption.weight(.black)).tracking(0.8).multilineTextAlignment(.center)
                        Rectangle().fill(.black.opacity(0.28)).frame(height: 1)
                        Text(engravingLine).font(.system(.subheadline, design: .serif).weight(.bold)).italic().multilineTextAlignment(.center)
                    }
                    .foregroundStyle(.black.opacity(0.84)).frame(maxWidth: .infinity).padding(18)
                    .background(LinearGradient(colors: [Color(red: 0.94, green: 0.77, blue: 0.30), Color(red: 0.60, green: 0.38, blue: 0.08), Color(red: 0.92, green: 0.72, blue: 0.24)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(.yellow.opacity(0.85), lineWidth: 2))
                    .shadow(color: .yellow.opacity(0.24), radius: 14)

                    if let notes = trophy.notes, !notes.isEmpty {
                        Text(notes).font(.body.weight(.semibold)).foregroundStyle(.white.opacity(0.68)).multilineTextAlignment(.center)
                            .padding(15).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16))
                    }
                    Text("THIS SHELF IS PUBLIC. HUMILITY WAS NEVER CONSULTED.")
                        .font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(.white.opacity(0.34)).multilineTextAlignment(.center)
                }
                .padding(22).padding(.bottom, 18)
            }
        }
        .preferredColorScheme(.dark)
        .alert("CLASSIFIED HARDWARE FOUND", isPresented: Binding(get: { discoveryMessage != nil }, set: { if !$0 { discoveryMessage = nil } })) {
            Button("SEAL IT") { discoveryMessage = nil }
        } message: { Text(discoveryMessage ?? "") }
    }

    private func registerTrophyTap() {
        let now = Date()
        trophyTapCount = lastTrophyTap.map { now.timeIntervalSince($0) <= 1.5 ? trophyTapCount + 1 : 1 } ?? 1
        lastTrophyTap = now
        guard trophyTapCount >= 5 else { return }
        trophyTapCount = 0
        Task { await recordTrophyDiscovery() }
    }

    private func recordTrophyDiscovery() async {
        guard let token = auth.token, let user = auth.user else { return }
        let membership = try? await SupabaseAPI.activeLeague(token: token, userId: user.id, preferredLeagueId: trophy.leagueId)
        let familyVacay = membership?.leagues.name.lowercased().contains("vonnag") == true
        let id = familyVacay ? "egg_vonnaggio_gold" : "egg_curiosity_trophy"
        guard let result = try? await SupabaseAPI.recordEasterEggFind(token: token, discoveryId: id), result.newFind == true else { return }
        discoveryMessage = familyVacay
            ? "Five taps woke the Family Vacay gold form. The family remembers."
            : "Five taps in a row. One spin. Zero competitive edge."
    }

    private var artifactName: String? {
        trophyArtifactName(for: trophy)
    }

    private var engravingLine: String {
        switch trophy.trophyType.lowercased() {
        case "nfc_championship": return "CONFERENCE OWNED. RECEIPTS ATTACHED. HUMILITY DECLINED TO COMMENT."
        case "championship": return "LAST ONE STANDING AFTER EVERYONE ELSE FOUND A CREATIVE WAY TO LOSE."
        case "toilet_bowl": return "FINISHED THE JOB NOBODY WANTED. THE BOWL REMEMBERS."
        case "crystal_ball": return "SAW THE FUTURE, TOLD EVERYONE, AND WILL NEVER SHUT UP ABOUT IT."
        case let value where value.contains("division"): return "CLAIMED THE TERRITORY. LOCAL AUTHORITIES REMAIN POWERLESS."
        default: return "PERMANENT HARDWARE FOR TEMPORARILY QUESTIONABLE DECISIONS."
        }
    }
}

private struct NativeProfileView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var displayName = ""
    @State private var originalName = ""
    @State private var loading = true
    @State private var saving = false
    @State private var notice: String?
    @State private var errorMessage: String?
    @State private var avatarURL: String?
    @State private var equippedTitleId: String?
    @State private var equippedBorderId: String?
    @State private var equippedRankId: String?
    @State private var careerRankFloor: String?
    @State private var achievements: [ProfileAchievement] = []
    @State private var memberships: [LeagueMembership] = []
    @State private var birthday = Date()
    @State private var birthdayMMDD: String?
    @State private var savingBirthday = false
    @State private var confirmingBirthday = false
    @State private var favoriteTeamId: String?
    private var identity: SportIdentity {
        SportIdentity((memberships.first { $0.leagueId == auth.selectedLeagueId } ?? memberships.first)?.leagues.sportId)
    }

    private var cleanName: String {
        displayName.trimmingCharacters(in: .whitespacesAndNewlines)
            .split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    var body: some View {
        ZStack {
            if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) }
            else {
                Image("ProfileConstructionZone")
                    .resizable().scaledToFill().ignoresSafeArea()
                    .overlay(.black.opacity(0.24)).ignoresSafeArea()
            }
            Form {
                Section {
                    HStack(spacing: 14) {
                        ProfileAvatar(urlString: avatarURL, name: cleanName, size: 58, borderId: equippedBorderId, accent: identity.isNFL ? .cyan : .green)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(cleanName.isEmpty ? "Player to be named later" : cleanName).font(.headline)
                            Text(auth.user?.email ?? "Signed in").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                .listRowBackground(Color.black.opacity(0.76))
                Section("War Room account name") {
                    if loading {
                        ProgressView("Finding your reputation…")
                    } else {
                        TextField("What should the room call you?", text: $displayName)
                            .textContentType(.name)
                            .onChange(of: displayName) { _, value in
                                if value.count > 40 { displayName = String(value.prefix(40)) }
                                notice = nil
                                errorMessage = nil
                            }
                        Text("Used across your profile and as the default name in every league.")
                            .font(.caption).foregroundStyle(.secondary)
                        Button {
                            Task { await save() }
                        } label: {
                            HStack {
                                Spacer()
                                if saving { ProgressView() }
                                else { Text("SAVE NAME").fontWeight(.black) }
                                Spacer()
                            }
                        }
                        .buttonStyle(.borderedProminent).tint(identity.isNFL ? .blue : .green)
                        .disabled(saving || cleanName.count < 2 || cleanName == originalName)
                        if let notice { Label(notice, systemImage: "checkmark.circle.fill").font(.footnote).foregroundStyle(identity.isNFL ? .cyan : .green) }
                        if let errorMessage { Label(errorMessage, systemImage: "exclamationmark.triangle.fill").font(.footnote).foregroundStyle(.red) }
                    }
                }
                .listRowBackground(Color.black.opacity(0.80))
                Section("CLASSIFIED BIRTHDAY FILE") {
                    if let birthdayMMDD {
                        Label(formattedBirthday(birthdayMMDD), systemImage: "lock.shield.fill")
                            .font(.headline.weight(.black)).foregroundStyle(identity.isNFL ? .cyan : .green)
                        Text("Locked permanently. When that day arrives, the paper may notice.")
                            .font(.caption).foregroundStyle(.secondary)
                    } else {
                        DatePicker("Birthday", selection: $birthday, displayedComponents: .date)
                            .datePickerStyle(.compact)
                        Text("War Room stores only the month and day. Once sealed, you cannot change it yourself.")
                            .font(.caption).foregroundStyle(.secondary)
                        Button("SEAL BIRTHDAY IN PERSONNEL FILE") { confirmingBirthday = true }
                            .font(.caption.weight(.black)).foregroundStyle(.yellow)
                            .disabled(savingBirthday)
                    }
                }
                .listRowBackground(Color.black.opacity(0.80))
                Section(identity.isNFL ? "NFL TEAM LOYALTY" : "COLLEGE TEAM LOYALTY") {
                    NavigationLink {
                        FavoriteTeamPickerView(sportId: identity.sportId, selectedTeamId: $favoriteTeamId)
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "heart.fill").foregroundStyle(identity.isNFL ? .blue : .green)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(FootballTeamCatalog.team(forTeamId: favoriteTeamId, sportId: identity.sportId)?.name ?? "Choose your team")
                                    .font(.headline.weight(.black))
                                Text("Highlighted on the Board and in the commissioner’s weekly game finder.")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .listRowBackground(Color.black.opacity(0.80))
                Section("ACTIVE CONSTRUCTION ORDERS") {
                    NavigationLink {
                        ProfileTitlePickerView(
                            name: cleanName, options: availableTitles,
                            selectedTitleId: $equippedTitleId, selectedBorderId: $equippedBorderId,
                            sportId: identity.sportId
                        )
                    } label: {
                        profileLoadoutRow("EQUIPPED TITLE", value: titleName)
                    }
                    NavigationLink {
                        ProfileRankPickerView(
                            options: ProfileCosmetics.ranks(upTo: currentRank), currentRank: currentRank,
                            selectedRankId: $equippedRankId, sportId: identity.sportId
                        )
                    } label: {
                        profileLoadoutRow("STANDINGS RANK INSIGNIA", value: displayedRankName)
                    }
                    NavigationLink {
                        ProfileBorderPickerView(
                            name: cleanName, avatarURL: avatarURL, options: availableBorders,
                            selectedTitleId: $equippedTitleId, selectedBorderId: $equippedBorderId, sportId: identity.sportId
                        )
                    } label: {
                        profileLoadoutRow("AVATAR BORDER", value: borderName)
                    }
                    Text(avatarURL == nil ? "Portrait upload controls are next on the blueprint." : "Website portrait secured. No re-upload required.")
                        .font(.caption).foregroundStyle(avatarURL == nil ? Color.secondary : Color.green)
                }
                .listRowBackground(Color.black.opacity(0.84))
            }
            .scrollContentBackground(.hidden)
            .background(.clear)
        }
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .task { await load() }
        .alert("Lock this birthday permanently?", isPresented: $confirmingBirthday) {
            Button("Not yet", role: .cancel) {}
            Button("LOCK IT") { Task { await lockBirthday() } }
        } message: {
            Text("Only the month and day are stored. This cannot be changed from the app after you confirm it.")
        }
    }

    private func load() async {
        guard let token = auth.token, let user = auth.user else { return }
        do {
            async let loadedProfile = SupabaseAPI.profile(token: token, userId: user.id)
            async let loadedAchievements = SupabaseAPI.profileAchievements(token: token, userId: user.id)
            async let loadedMemberships = SupabaseAPI.leagueMemberships(token: token, userId: user.id)
            let profile = try await loadedProfile
            displayName = profile?.displayName ?? ""
            avatarURL = profile?.avatarURL
            equippedTitleId = profile?.equippedTitleId
            equippedBorderId = profile?.equippedBorderId ?? "plain"
            equippedRankId = profile?.equippedRankId
            careerRankFloor = profile?.careerRankFloor
            birthdayMMDD = profile?.birthdayMMDD
            achievements = try await loadedAchievements
            memberships = try await loadedMemberships
            favoriteTeamId = try? await SupabaseAPI.favoriteTeam(token: token, userId: user.id, sportId: identity.sportId)?.teamId
            originalName = cleanName
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }

    private var currentRank: CareerRank {
        CareerRanks.resolve(
            points: PromotionPoints.total(for: achievements),
            seasons: (memberships.compactMap(\.weeksPlayed).max() ?? 0) / 10,
            sports: max(1, Set(memberships.map { $0.leagues.sportId }).count),
            minimumRankId: auth.user.map { LegacyCareerRecords.minimumRankFloor(for: $0.id, liveFloor: careerRankFloor) } ?? careerRankFloor
        ).current
    }

    private func lockBirthday() async {
        guard let token = auth.token, let user = auth.user, birthdayMMDD == nil else { return }
        savingBirthday = true
        let monthDay = Self.birthdayStorageFormatter.string(from: birthday)
        do {
            try await SupabaseAPI.lockBirthday(token: token, userId: user.id, monthDay: monthDay)
            birthdayMMDD = monthDay
            notice = "Birthday sealed. The newsroom has marked its calendar."
        } catch {
            errorMessage = error.localizedDescription
        }
        savingBirthday = false
    }

    private func formattedBirthday(_ value: String) -> String {
        guard let date = Self.birthdayStorageFormatter.date(from: value) else { return value }
        return Self.birthdayDisplayFormatter.string(from: date).uppercased()
    }

    private static let birthdayStorageFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MM-dd"
        return formatter
    }()

    private static let birthdayDisplayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMMM d"
        return formatter
    }()

    private var availableTitles: [ProfileCosmeticOption] {
        var rows = ProfileCosmetics.titles(earned: achievements, rank: currentRank)
        if let user = auth.user, AppIdentity.isCreator(user.id), !rows.contains(where: { $0.id == "the_commissioner" }) {
            rows.insert(.init(id: "the_commissioner", name: "The Creator", detail: "Built the app. Peasants stay grey.", primary: .yellow, secondary: .red), at: 0)
        }
        return rows.map { option in
            ProfileCosmeticOption(
                id: option.id,
                name: identity.cheevoTitle(code: option.id, fallback: option.name),
                detail: identity.localizedCheevoCopy(option.detail),
                primary: option.primary,
                secondary: option.secondary
            )
        }
    }

    private var availableBorders: [ProfileCosmeticOption] {
        auth.user.map { ProfileCosmetics.borders(userId: $0.id, earned: achievements) } ?? []
    }

    private var titleName: String { availableTitles.first { $0.id == equippedTitleId }?.name ?? "Name only" }
    private var displayedRankName: String {
        ProfileCosmetics.ranks(upTo: currentRank).first { $0.id == equippedRankId }?.abbreviation ?? "\(currentRank.abbreviation) · automatic"
    }
    private var borderName: String { availableBorders.first { $0.id == equippedBorderId }?.name ?? "Plain Ring" }

    private func profileLoadoutRow(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label).font(.system(size: 9, weight: .black)).tracking(1.2).foregroundStyle(identity.isNFL ? .cyan : .yellow)
            Text(value).font(.headline.weight(.black))
        }.padding(.vertical, 4)
    }

    private func save() async {
        guard let token = auth.token, let user = auth.user, cleanName.count >= 2 else { return }
        saving = true
        do {
            try await SupabaseAPI.updateDisplayName(token: token, userId: user.id, displayName: cleanName)
            displayName = cleanName
            originalName = cleanName
            notice = "Name saved. Alibis remain unchanged."
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        saving = false
    }
}

private struct ProfileTitlePickerView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let name: String
    let options: [ProfileCosmeticOption]
    @Binding var selectedTitleId: String?
    @Binding var selectedBorderId: String?
    let sportId: String
    @State private var saving = false
    @State private var error: String?

    var body: some View {
        loadoutBackdrop(sportId: sportId) {
            VStack(spacing: 12) {
                Text("NAMEPLATE FABRICATION").font(.caption2.weight(.black)).tracking(2).foregroundStyle(SportIdentity(sportId).isNFL ? .cyan : .yellow)
                Text(ProfileCosmetics.titleName(for: selectedTitleId).map { "\(SportIdentity(sportId).cheevoTitle(code: selectedTitleId ?? "", fallback: $0)) \(name)" } ?? name)
                    .font(.system(size: 27, weight: .black)).fontWidth(.condensed).multilineTextAlignment(.center).padding(.bottom, 8)
                loadoutButton(id: nil, name: "NAME ONLY", detail: "No title. Just the suspect.")
                ForEach(options) { option in loadoutButton(id: option.id, name: option.name, detail: option.detail) }
                if let error { Text(error).font(.caption.weight(.bold)).foregroundStyle(.red) }
            }.padding(16).padding(.bottom, 30)
        }
        .navigationTitle("Equip Title").navigationBarTitleDisplayMode(.inline)
    }

    private func loadoutButton(id: String?, name: String, detail: String) -> some View {
        Button { Task { await save(id) } } label: {
            HStack {
                VStack(alignment: .leading, spacing: 3) { Text(name).font(.headline.weight(.black)); Text(detail).font(.caption).foregroundStyle(.white.opacity(0.52)).lineLimit(2) }
                Spacer(); Text(selectedTitleId == id ? "EQUIPPED" : "EQUIP").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(selectedTitleId == id ? (SportIdentity(sportId).isNFL ? .cyan : .green) : (SportIdentity(sportId).isNFL ? .red : .yellow))
            }.padding(14).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: SportIdentity(sportId).isNFL ? 6 : 10)).overlay(RoundedRectangle(cornerRadius: SportIdentity(sportId).isNFL ? 6 : 10).stroke(selectedTitleId == id ? (SportIdentity(sportId).isNFL ? Color.cyan : Color.green) : (SportIdentity(sportId).isNFL ? Color.blue : Color.yellow).opacity(0.28)))
        }.buttonStyle(.plain).disabled(saving)
    }

    private func save(_ id: String?) async {
        guard let token = auth.token, let user = auth.user else { return }
        saving = true
        do {
            try await SupabaseAPI.updateProfileCosmetics(token: token, userId: user.id, titleId: id, borderId: selectedBorderId)
            let verified = try await SupabaseAPI.profile(token: token, userId: user.id)
            guard verified?.equippedTitleId == id else { throw ProfileLoadoutError.verification("Title") }
            selectedTitleId = id; dismiss()
        } catch { self.error = error.localizedDescription }
        saving = false
    }
}

private struct ProfileRankPickerView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let options: [CareerRank]
    let currentRank: CareerRank
    @Binding var selectedRankId: String?
    let sportId: String
    @State private var saving = false
    @State private var error: String?

    var body: some View {
        loadoutBackdrop(sportId: sportId) {
            VStack(spacing: 12) {
                Text("INSIGNIA DISPLAY CASE").font(.caption2.weight(.black)).tracking(2).foregroundStyle(SportIdentity(sportId).isNFL ? .cyan : .yellow)
                Text("Your dossier always shows \(currentRank.abbreviation). Choose what the standings see.")
                    .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.68)).multilineTextAlignment(.center)
                rankButton(nil, label: "CURRENT RANK · AUTOMATIC", detail: "Updates whenever you are promoted")
                ForEach(options) { rank in
                    rankButton(rank.id, label: "\(rank.abbreviation) · \(rank.name)", detail: rank.id == currentRank.id ? "Your current earned rank" : "Previously earned · permanently displayable", rank: rank)
                }
                if let error { Text(error).font(.caption.weight(.bold)).foregroundStyle(.red) }
            }.padding(16).padding(.bottom, 30)
        }
        .navigationTitle("Standings Rank").navigationBarTitleDisplayMode(.inline)
    }

    private func rankButton(_ id: String?, label: String, detail: String, rank: CareerRank? = nil) -> some View {
        Button { Task { await save(id) } } label: {
            HStack(spacing: 12) {
                if let rank { RankInsigniaView(rank: rank, size: 46) }
                else { Image(systemName: "arrow.triangle.2.circlepath").font(.title2).foregroundStyle(SportIdentity(sportId).isNFL ? .cyan : .green).frame(width: 46, height: 46) }
                VStack(alignment: .leading, spacing: 3) {
                    Text(label).font(.subheadline.weight(.black))
                    Text(detail).font(.caption2).foregroundStyle(.white.opacity(0.52))
                }
                Spacer()
                Text(selectedRankId == id ? "EQUIPPED" : "EQUIP").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(selectedRankId == id ? (SportIdentity(sportId).isNFL ? .cyan : .green) : (SportIdentity(sportId).isNFL ? .red : .yellow))
            }
            .padding(13).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: SportIdentity(sportId).isNFL ? 6 : 10).stroke(selectedRankId == id ? (SportIdentity(sportId).isNFL ? Color.cyan : Color.green) : (SportIdentity(sportId).isNFL ? Color.blue : Color.yellow).opacity(0.28)))
        }.buttonStyle(.plain).disabled(saving)
    }

    private func save(_ id: String?) async {
        guard let token = auth.token, let user = auth.user else { return }
        saving = true
        do {
            try await SupabaseAPI.updateProfileRankDisplay(token: token, userId: user.id, rankId: id)
            let verified = try await SupabaseAPI.profile(token: token, userId: user.id)
            guard verified?.equippedRankId == id else { throw ProfileLoadoutError.verification("Rank display") }
            selectedRankId = id; dismiss()
        } catch { self.error = error.localizedDescription }
        saving = false
    }
}

private struct ProfileBorderPickerView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let name: String
    let avatarURL: String?
    let options: [ProfileCosmeticOption]
    @Binding var selectedTitleId: String?
    @Binding var selectedBorderId: String?
    let sportId: String
    @State private var saving = false
    @State private var error: String?

    var body: some View {
        loadoutBackdrop(sportId: sportId) {
            VStack(spacing: 14) {
                Text("PORTRAIT ARMOR BAY").font(.caption2.weight(.black)).tracking(2).foregroundStyle(SportIdentity(sportId).isNFL ? .cyan : .yellow)
                ProfileAvatar(urlString: avatarURL, name: name, size: 104, borderId: selectedBorderId, accent: SportIdentity(sportId).isNFL ? .cyan : .green)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(options) { option in
                        Button { Task { await save(option.id) } } label: {
                            VStack(spacing: 8) {
                                Circle().fill(LinearGradient(colors: [option.primary, option.secondary, option.primary], startPoint: .topLeading, endPoint: .bottomTrailing)).frame(width: 52, height: 52).overlay(Circle().fill(.black).padding(5))
                                Text(option.name).font(.caption.weight(.black)).multilineTextAlignment(.center)
                                Text(selectedBorderId == option.id ? "EQUIPPED" : "EQUIP").font(.system(size: 7, weight: .black)).tracking(1).foregroundStyle(selectedBorderId == option.id ? (SportIdentity(sportId).isNFL ? .cyan : .green) : (SportIdentity(sportId).isNFL ? .red : .yellow))
                            }.frame(maxWidth: .infinity, minHeight: 118).padding(10).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: SportIdentity(sportId).isNFL ? 6 : 12)).overlay(RoundedRectangle(cornerRadius: SportIdentity(sportId).isNFL ? 6 : 12).stroke(selectedBorderId == option.id ? (SportIdentity(sportId).isNFL ? Color.cyan : Color.green) : option.primary.opacity(0.45)))
                        }.buttonStyle(.plain).disabled(saving)
                    }
                }
                if let error { Text(error).font(.caption.weight(.bold)).foregroundStyle(.red) }
            }.padding(16).padding(.bottom, 30)
        }
        .navigationTitle("Avatar Border").navigationBarTitleDisplayMode(.inline)
    }

    private func save(_ id: String) async {
        guard let token = auth.token, let user = auth.user else { return }
        saving = true
        do {
            try await SupabaseAPI.updateProfileCosmetics(token: token, userId: user.id, titleId: selectedTitleId, borderId: id)
            let verified = try await SupabaseAPI.profile(token: token, userId: user.id)
            guard verified?.equippedBorderId == id else { throw ProfileLoadoutError.verification("Border") }
            selectedBorderId = id; dismiss()
        } catch { self.error = error.localizedDescription }
        saving = false
    }
}

private func loadoutBackdrop<Content: View>(sportId: String, @ViewBuilder content: () -> Content) -> some View {
    ZStack {
        if SportIdentity(sportId).isNFL { NflHomeBackdrop(phase: .regularSeason) }
        else { Image("ProfileConstructionZone").resizable().scaledToFill().ignoresSafeArea().overlay(.black.opacity(0.38)).ignoresSafeArea() }
        ScrollView { content() }
    }.preferredColorScheme(.dark)
}

private enum ProfileLoadoutError: LocalizedError {
    case verification(String)
    var errorDescription: String? {
        switch self { case .verification(let item): return "\(item) save could not be verified." }
    }
}

struct ProfileAvatar: View {
    let urlString: String?
    let name: String
    let size: CGFloat
    var borderId: String? = nil
    var accent: Color = .green
    @State private var showingLightbox = false

    var body: some View {
        Group {
            if validURL != nil {
                Button { showingLightbox = true } label: { avatar }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(name) profile photo")
                    .accessibilityHint("Opens full-screen photo")
            } else {
                avatar
            }
        }
        .fullScreenCover(isPresented: $showingLightbox) {
            if let validURL {
                AvatarLightboxView(url: validURL, name: name, accent: accent)
            }
        }
    }

    private var validURL: URL? { urlString.flatMap(URL.init(string:)) }

    private var avatar: some View {
        ZStack {
            Circle().fill(accent.opacity(0.15))
            if let url = validURL {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else if phase.error != nil {
                        initials
                    } else {
                        ProgressView().tint(accent)
                    }
                }
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay {
            if let borderId { ProfileRingView(id: borderId, size: size) }
            else { Circle().stroke(accent.opacity(0.62), lineWidth: 1.5) }
        }
        .shadow(color: borderId == nil ? accent.opacity(0.18) : .clear, radius: 8)
        .accessibilityLabel("\(name) profile photo")
    }

    private var initials: some View {
        Text(name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased())
            .font(.system(size: size * 0.30, weight: .black)).foregroundStyle(accent)
    }
}

private struct ProfileRingView: View {
    let id: String
    let size: CGFloat

    var body: some View {
        if id.hasPrefix("creator_") || id == "creator" {
            TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
                creatorRing(time: timeline.date.timeIntervalSinceReferenceDate)
            }
        } else {
            let border = ProfileCosmetics.border(id)
            Circle()
                .stroke(AngularGradient(colors: [border.primary, border.secondary, border.primary], center: .center), lineWidth: max(3, size * 0.055))
                .shadow(color: border.primary.opacity(id == "plain" ? 0.20 : 0.72), radius: id == "plain" ? 2 : 9)
        }
    }

    @ViewBuilder private func creatorRing(time: TimeInterval) -> some View {
        let degrees = time.truncatingRemainder(dividingBy: 8) / 8 * 360
        let turn = Angle.degrees(degrees)
        if id == "creator_circuit" {
            ZStack {
                Circle().stroke(.green.opacity(0.22), lineWidth: size * 0.12).blur(radius: 5)
                Circle().stroke(style: StrokeStyle(lineWidth: 3, lineCap: .square, dash: [2, 6])).foregroundStyle(.green).rotationEffect(turn)
                Circle().stroke(style: StrokeStyle(lineWidth: 1, dash: [12, 4])).foregroundStyle(.cyan.opacity(0.9)).rotationEffect(.degrees(-degrees * 1.7))
                orbitNodes(turn: turn, color: .green)
            }.shadow(color: .green.opacity(0.85), radius: 10)
        } else if id == "creator_forge" {
            ZStack {
                Circle().stroke(.orange.opacity(0.24), lineWidth: size * 0.15).blur(radius: 6)
                Circle().stroke(AngularGradient(colors: [.black, .orange, .yellow, .white, .orange, .black], center: .center), lineWidth: 7).rotationEffect(turn)
                Circle().stroke(AngularGradient(colors: [.yellow, .clear, .orange, .clear, .yellow], center: .center), style: StrokeStyle(lineWidth: 2, dash: [8, 4])).rotationEffect(.degrees(-degrees * 0.8))
                ForEach(0..<8, id: \.self) { index in
                    Circle().fill(.yellow).frame(width: 3, height: 3).offset(y: -size * 0.51).rotationEffect(.degrees(Double(index) * 45) + turn)
                }
            }.shadow(color: .orange.opacity(0.95), radius: 12)
        } else {
            ZStack {
                Circle().stroke(.red.opacity(0.28), lineWidth: size * 0.17).blur(radius: 7)
                Circle().stroke(AngularGradient(colors: [.red, .orange, .yellow, .white, .orange, .red], center: .center), style: StrokeStyle(lineWidth: 6, lineCap: .round, dash: [7, 2])).rotationEffect(turn)
                ForEach(0..<14, id: \.self) { index in
                    Capsule().fill(LinearGradient(colors: [.yellow, .orange, .red.opacity(0)], startPoint: .bottom, endPoint: .top))
                        .frame(width: 4, height: 10 + CGFloat(sin(time * 4 + Double(index))) * 3)
                        .offset(y: -size * 0.55)
                        .rotationEffect(.degrees(Double(index) * (360 / 14) - degrees * 0.35))
                }
            }.shadow(color: .orange.opacity(0.95), radius: 12)
        }
    }

    private func orbitNodes(turn: Angle, color: Color) -> some View {
        ForEach(0..<3, id: \.self) { index in
            Circle().fill(index == 0 ? Color.white : color).frame(width: 5, height: 5)
                .offset(y: -size * 0.52).rotationEffect(turn + .degrees(Double(index) * 120))
        }
    }
}

private struct AvatarLightboxView: View {
    @Environment(\.dismiss) private var dismiss
    let url: URL
    let name: String
    let accent: Color

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFit()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if phase.error != nil {
                    ContentUnavailableView("Photo unavailable", systemImage: "photo.badge.exclamationmark", description: Text("The website image declined its close-up."))
                } else {
                    ProgressView("Developing evidence…").tint(accent)
                }
            }
            VStack {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("PLAYER FILE").font(.caption2.weight(.black)).tracking(2).foregroundStyle(accent)
                        Text(name).font(.headline.weight(.black))
                    }
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.headline.weight(.black))
                            .frame(width: 44, height: 44).background(.white.opacity(0.12), in: Circle())
                    }.buttonStyle(.plain).accessibilityLabel("Close photo")
                }
                .padding(20)
                .background(LinearGradient(colors: [.black.opacity(0.9), .clear], startPoint: .top, endPoint: .bottom))
                Spacer()
                Text("TAP × TO RETURN TO THE ARGUMENT")
                    .font(.caption2.weight(.black)).tracking(1.4).foregroundStyle(.white.opacity(0.42)).padding(.bottom, 28)
            }
        }
        .statusBarHidden()
    }
}

private struct HowToPlayView: View {
    let sportId: String
    private var isNFL: Bool { sportId.lowercased() == "nfl" }
    private var steps: [(String, String, String)] { [
        ("hand.tap.fill", "Pick a side", "Every game. The fence scores zero."),
        ("number.circle.fill", "Set confidence", "Use each number once. Higher means louder."),
        ("star.fill", "Mark one Best Bet", "It doubles the confidence points. Choose bravely or irresponsibly."),
        ("questionmark.bubble.fill", "Answer the prop", "Free points, assuming you possess foresight."),
        ("lock.fill", "Lock it in", "You can edit until the first kickoff. Then history gets a pen."),
    ] }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Five moves. No seminar.")
                    .font(.title.weight(.black))
                Text("The weekly card teaches itself, but here are the receipts.")
                    .foregroundStyle(.secondary)
                if isNFL {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("NFL CAMPAIGN · WEEK 1 THROUGH SUPER BOWL", systemImage: "football.fill")
                            .font(.caption.weight(.black)).tracking(1).foregroundStyle(.cyan)
                        Text("No preseason. Pick five games each week through Week 18, call the Super Bowl champion in the Crystal Ball, then build all 13 playoff decisions. Two regular-season JDAM support calls can add a 50% catch-up bonus; the postseason JDAM remains the unpredictable full-bracket override.")
                            .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.72))
                    }
                    .padding(16).background(.blue.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(.blue.opacity(0.5)))
                }
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    HStack(alignment: .top, spacing: 14) {
                        ZStack {
                            Circle().fill(isNFL ? .cyan : .green)
                            Text("\(index + 1)").font(.headline.weight(.black)).foregroundStyle(.black)
                        }
                        .frame(width: 38, height: 38)
                        VStack(alignment: .leading, spacing: 5) {
                            Label(step.1, systemImage: step.0).font(.headline)
                            Text(step.2).font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: isNFL ? 6 : 16))
                }
            }
            .padding()
        }
        .navigationTitle("How to Play")
        .background { if isNFL { NflHomeBackdrop(phase: .regularSeason) } else { WarRoomBackdrop() } }
    }
}

private struct AnnouncementsView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var league: LeagueMembership?
    @State private var items: [Announcement] = []
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var composeTitle = ""
    @State private var composeBody = ""
    @State private var posting = false
    @State private var postNotice: String?

    init(initialTitle: String = "", initialBody: String = "") {
        _composeTitle = State(initialValue: initialTitle)
        _composeBody = State(initialValue: initialBody)
    }

    private var isCommissioner: Bool {
        guard let user = auth.user, let league else { return false }
        return league.isCommissioner(userId: user.id)
    }
    private var identity: SportIdentity { SportIdentity(league?.leagues.sportId) }

    var body: some View {
        Group {
            if loading {
                ProgressView("Checking the bulletin board…")
            } else if let errorMessage {
                ContentUnavailableView("News desk offline", systemImage: "megaphone.fill", description: Text(errorMessage))
            } else {
                List {
                    if isCommissioner {
                        Section("Commissioner · Post announcement") {
                            TextField("Headline", text: $composeTitle)
                                .onChange(of: composeTitle) { _, value in
                                    if value.count > 120 { composeTitle = String(value.prefix(120)) }
                                    postNotice = nil; errorMessage = nil
                                }
                            TextField("Message to the league…", text: $composeBody, axis: .vertical)
                                .lineLimit(3...8)
                                .onChange(of: composeBody) { _, value in
                                    if value.count > 4000 { composeBody = String(value.prefix(4000)) }
                                    postNotice = nil; errorMessage = nil
                                }
                            Button { Task { await post() } } label: {
                                HStack {
                                    Spacer()
                                    if posting { ProgressView() }
                                    else { Text("POST TO THE LEAGUE").fontWeight(.black) }
                                    Spacer()
                                }
                            }
                            .buttonStyle(.borderedProminent).tint(identity.isNFL ? .blue : .green)
                            .disabled(posting || composeTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || composeBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                            Text("Everyone in \(league?.leagues.name ?? "this league") will see this.")
                                .font(.caption).foregroundStyle(.secondary)
                            if let postNotice { Label(postNotice, systemImage: "checkmark.circle.fill").font(.footnote).foregroundStyle(identity.isNFL ? .cyan : .green) }
                        }
                    }
                    Section(items.isEmpty ? "League news" : "History") {
                        if items.isEmpty {
                            Label("No announcements. Rare commissioner restraint.", systemImage: "megaphone")
                                .foregroundStyle(.secondary)
                        }
                        ForEach(items) { item in
                            VStack(alignment: .leading, spacing: 9) {
                                HStack(alignment: .firstTextBaseline) {
                                    if item.isUnread {
                                        Circle().fill(identity.isNFL ? .cyan : .green).frame(width: 9, height: 9)
                                            .accessibilityLabel("Unread")
                                    }
                                    Text(item.title).font(.headline.weight(.black))
                                    Spacer()
                                    Image(systemName: "megaphone.fill").foregroundStyle(item.isUnread ? (identity.isNFL ? .cyan : .green) : .secondary)
                                }
                                Text(item.body).font(.subheadline)
                                HStack {
                                    NavigationLink { PlayerProfileRouteView(userId: item.authorId, fallbackName: item.authorName, sportId: identity.sportId) } label: {
                                        Text(item.authorName).fontWeight(.semibold)
                                    }.buttonStyle(.plain)
                                    Spacer()
                                    Text(timestamp(item.createdAt))
                                }
                                .font(.caption).foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 7)
                        }
                    }
                }
                .refreshable { await load() }
                .scrollContentBackground(.hidden)
                .background { if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) } }
            }
        }
        .navigationTitle("Announcements")
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 1) {
                    Text(identity.isNFL ? "LEAGUE OFFICE WIRE" : "ANNOUNCEMENTS").font(.caption.weight(.black)).foregroundStyle(identity.isNFL ? .cyan : .green)
                    Text(league?.leagues.name ?? "League news").font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .task(id: auth.selectedLeagueId) { await load() }
    }

    private func load() async {
        guard let token = auth.token, let user = auth.user else { return }
        loading = items.isEmpty
        do {
            let active = try await SupabaseAPI.activeLeague(token: token, userId: user.id, preferredLeagueId: auth.selectedLeagueId)
            league = active
            let loaded = try await SupabaseAPI.announcements(token: token, leagueId: active.leagueId)
            items = loaded
            try await SupabaseAPI.markAnnouncementsRead(
                token: token,
                userId: user.id,
                announcementIds: loaded.filter(\.isUnread).map(\.id)
            )
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }

    private func post() async {
        guard let token = auth.token, let user = auth.user, let league,
              league.isCommissioner(userId: user.id) else { return }
        let title = composeTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = composeBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, !body.isEmpty else { return }
        posting = true
        do {
            try await SupabaseAPI.postAnnouncement(token: token, leagueId: league.leagueId, authorId: user.id, title: title, body: body)
            composeTitle = ""
            composeBody = ""
            postNotice = "Posted. The league has been officially informed."
            items = try await SupabaseAPI.announcements(token: token, leagueId: league.leagueId)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        posting = false
    }

    private func timestamp(_ value: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: value) else { return value }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}
