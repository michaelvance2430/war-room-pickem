import SwiftUI

enum FoundryLabPolicy {
    static func accepts(mode: String?, sportId: String, preferredSportId: String?) -> Bool {
        guard mode == "foundry" else { return false }
        guard let preferredSportId else { return true }
        return sportId.lowercased() == preferredSportId.lowercased()
    }
}

struct FoundryView: View {
    @EnvironmentObject private var auth: AuthStore
    let preferredSportId: String?
    @State private var memberships: [LeagueMembership] = []
    @State private var card: WeekCard?
    @State private var standings: [Standing] = []
    @State private var submittedUserIds: Set<UUID> = []
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var emergencyToolsOpen = false
    @State private var confirmingReset = false
    @State private var resetting = false
    @State private var confirmingSeasonSkip = false
    @State private var completingSeason = false
    @State private var seasonSkipNotice: String?
    @State private var lockingWeek = false
    @State private var scoringWeek = false
    @State private var weekActionNotice: String?
    @State private var lifecycle: FoundrySeasonLifecycle?
    @State private var stagingRivalry = false
    @State private var seedingRivalryHistory = false
    @State private var rivalryTestNotice: String?
    @State private var showingSeasonOpening = false
    @State private var showingChampionshipColdOpen = false
    @State private var showingSeasonFinale = false
    @State private var seasonChampion = "FOUNDRY CHAMPION"
    @State private var postseasonWeekLocked = false
    @State private var selectedLabId: UUID?

    init(preferredSportId: String? = nil) {
        self.preferredSportId = preferredSportId?.lowercased()
    }

    private var authorized: Bool { AppIdentity.isCreator(auth.user?.id) }
    private var isNFLFoundry: Bool { preferredSportId == "nfl" }
    private var foundryAccent: Color { isNFLFoundry ? Color(red: 0.10, green: 0.58, blue: 1.0) : .orange }
    private var foundrySecondary: Color { isNFLFoundry ? Color(red: 0.92, green: 0.12, blue: 0.22) : .green }
    private var labLeagues: [LeagueMembership] {
        memberships.filter { membership in
            FoundryLabPolicy.accepts(
                mode: membership.leagues.mode,
                sportId: membership.leagues.sportId,
                preferredSportId: preferredSportId
            )
        }
    }
    private var productionCount: Int { memberships.filter { $0.leagues.mode != "foundry" }.count }
    private var lab: LeagueMembership? { labLeagues.first { $0.leagueId == selectedLabId } ?? labLeagues.first }
    private var bots: [Standing] { standings.filter(\.isBot) }
    private var humans: [Standing] { standings.filter { !$0.isBot } }
    private var submittedCount: Int { bots.filter { submittedUserIds.contains($0.userId) }.count }
    private var safeBotLab: Bool { bots.count >= 8 && humans.count == 1 && humans.first?.userId == auth.user?.id }
    private var weekLocked: Bool {
        if lifecycle?.stage == "week_locked" { return true }
        guard let kickoff = card?.cardGames.compactMap({ footballKickoffDate($0.startTime) }).min() else { return false }
        return kickoff <= Date()
    }
    private var seasonReady: Bool { lifecycle?.stage != "season_opening" && lifecycle?.stage != "championship_cold_open" }
    private func cfbPhase(_ membership: LeagueMembership) -> CfbSeasonPhase {
        .phase(week: membership.leagues.currentWeek, regularSeasonWeeks: membership.leagues.sportId.lowercased() == "nfl" ? 18 : membership.leagues.regularSeasonWeeks)
    }

    var body: some View {
        ZStack {
            FoundryBackdrop(sportId: preferredSportId)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    if authorized && labLeagues.count > 1 { labSwitcher }
                    if !authorized {
                        lockedPanel
                    } else if loading {
                        ProgressView("Running quarantine preflight…").tint(.orange).frame(maxWidth: .infinity).padding(40)
                    } else {
                        if let lab {
                            weekBanner(lab)
                            nextAction(lab)
                            progressTrail(lab)
                            seasonTimeMachine(lab)
                            emergencyTools
                        } else if errorMessage != nil {
                            connectionErrorPanel
                        } else {
                            noLabPanel
                        }
                    }
                }
                .padding(16).padding(.bottom, 36)
            }
        }
        .navigationTitle("The Foundry").navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .task { await preflight() }
        .confirmationDialog("Restore the Foundry Bot Lab to Week \(SportIdentity(lab?.leagues.sportId).openingWeek)?", isPresented: $confirmingReset, titleVisibility: .visible) {
            Button("RESTORE BOT LAB", role: .destructive) { Task { await resetLab() } }
            Button("Cancel", role: .cancel) {}
        } message: { Text("Only disposable Foundry scores, Dispatch editions, cards, picks, and bot chatter are cleared. Production leagues remain untouched.") }
        .confirmationDialog("Complete the Foundry regular season?", isPresented: $confirmingSeasonSkip, titleVisibility: .visible) {
            Button("COMPLETE REGULAR SEASON") { Task { await completeRegularSeason() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Every remaining bot week will be scored through the real weekly pipeline. Standings, Crown & Shame, Dispatch editions, and cards will all be created before the Foundry enters postseason.")
        }
        .fullScreenCover(isPresented: $showingSeasonOpening, onDismiss: { Task { await finishPresentation("season_opening") } }) {
            if lab?.leagues.sportId.lowercased() == "nfl" {
                NflFoundryOpeningView(isPresented: $showingSeasonOpening)
            } else {
                SeasonOpeningView(isPresented: $showingSeasonOpening)
            }
        }
        .fullScreenCover(isPresented: $showingChampionshipColdOpen, onDismiss: { Task { await finishPresentation("championship_cold_open") } }) {
            if let lab { FoundryChampionshipColdOpenView(membership: lab, isPresented: $showingChampionshipColdOpen) }
        }
        .fullScreenCover(isPresented: $showingSeasonFinale) {
            if let lab { FoundrySeasonFinaleView(membership: lab, champion: seasonChampion, isPresented: $showingSeasonFinale) }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label(isNFLFoundry ? "PRO FOOTBALL SIMULATION LAB" : "CREATOR WORKSHOP", systemImage: isNFLFoundry ? "football.fill" : "flame.fill")
                    .font(.system(size: 9, weight: .black)).tracking(1.8).foregroundStyle(foundryAccent)
                Spacer()
                Text("NATIVE · V1").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.38))
            }
            Text(isNFLFoundry ? "SUNDAY OPERATIONS" : "THE FOUNDRY").font(.system(size: 39, weight: .black)).fontWidth(.condensed)
            Text(isNFLFoundry ? "EIGHTEEN WEEKS · FOUR PLAYOFF ROUNDS · ONE CONTROLLED TEST NETWORK" : "BREAK THE TEST ROOM. LEAVE REAL HISTORY ALONE.")
                .font(.caption.weight(.black)).tracking(1).foregroundStyle(.white.opacity(0.48))
        }
        .padding(20)
        .background(LinearGradient(colors: isNFLFoundry ? [Color(red: 0.015, green: 0.06, blue: 0.16), Color(red: 0.12, green: 0.01, blue: 0.04)] : [.black.opacity(0.92), foundryAccent.opacity(0.18)], startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: isNFLFoundry ? 8 : 24))
        .overlay(alignment: .top) { if isNFLFoundry { HStack(spacing: 0) { foundryAccent; foundrySecondary }.frame(height: 4) } }
        .overlay(alignment: .leading) { if !isNFLFoundry { Rectangle().fill(foundryAccent).frame(width: 4).padding(.vertical, 13) } }
        .overlay(RoundedRectangle(cornerRadius: isNFLFoundry ? 8 : 24).stroke(foundryAccent.opacity(0.58)))
    }

    private var lockedPanel: some View {
        FoundryPanel(accent: .red) {
            Label("FOUNDRY ACCESS DENIED", systemImage: "lock.shield.fill").font(.headline.weight(.black)).foregroundStyle(.red)
            Text("The Foundry accepts the Creator UUID only. Commissioner status is not enough.").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
        }
    }

    private var labSwitcher: some View {
        FoundryPanel(accent: .cyan) {
            FoundrySectionTitle(kicker: "TEST DESK", title: "CHOOSE THE SPORT LAB")
            HStack(spacing: 9) {
                ForEach(labLeagues) { membership in
                    Button {
                        selectedLabId = membership.leagueId
                        Task { await preflight() }
                    } label: {
                        VStack(spacing: 3) {
                            Text(membership.leagues.sportId.uppercased()).font(.headline.weight(.black))
                            Text("WEEK \(membership.leagues.currentWeek)").font(.system(size: 7, weight: .black))
                        }
                        .frame(maxWidth: .infinity).padding(11)
                        .foregroundStyle(selectedLabId == membership.leagueId ? .black : .white)
                        .background(selectedLabId == membership.leagueId ? Color.cyan : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 11))
                    }.buttonStyle(.plain)
                }
            }
        }
    }

    private var noLabPanel: some View {
        FoundryPanel(accent: .yellow) {
            FoundrySectionTitle(kicker: "STOP", title: "NO DISPOSABLE LAB FOUND")
            Text(preferredSportId == "nfl" ? "No pro-football bot lab is connected. Sunday Operations will never borrow another sport’s lab or a production room." : "The Foundry will not borrow a production room. Connect a league marked foundry before testing.").font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
        }
    }

    private var connectionErrorPanel: some View {
        FoundryPanel(accent: .red) {
            FoundrySectionTitle(kicker: "CONNECTION STOP", title: "THE LAB WAS NOT ERASED")
            Text(errorMessage ?? "The Foundry could not verify the lab.")
                .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)
            Button { Task { await preflight() } } label: {
                Label("REFRESH LOGIN & TRY AGAIN", systemImage: "arrow.clockwise.circle.fill")
                    .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(14)
                    .foregroundStyle(.black).background(.orange, in: RoundedRectangle(cornerRadius: 13))
            }.buttonStyle(.plain)
        }
    }

    private func weekBanner(_ lab: LeagueMembership) -> some View {
        let isNFL = lab.leagues.sportId.lowercased() == "nfl"
        return VStack(alignment: .leading, spacing: 7) {
            Label(isNFL ? "PRO FOOTBALL SIMULATION" : "YOU ARE TESTING", systemImage: isNFL ? "dot.radiowaves.left.and.right" : "flask.fill").font(.caption.weight(.black)).tracking(1.5).foregroundStyle(isNFL ? .cyan : .black)
            Text(isNFL ? "GAME WEEK \(lab.leagues.currentWeek)" : "WEEK \(lab.leagues.currentWeek)").font(.system(size: 42, weight: .black)).fontWidth(.condensed).foregroundStyle(isNFL ? .white : .black)
            Text(isNFL ? "THURSDAY → MONDAY · \(lab.leagues.name.uppercased())" : lab.leagues.name.uppercased()).font(.caption.weight(.black)).tracking(1).foregroundStyle(isNFL ? .white.opacity(0.55) : .black.opacity(0.58))
        }.padding(18).frame(maxWidth: .infinity, alignment: .leading)
            .background(isNFL ? AnyShapeStyle(LinearGradient(colors: [Color(red: 0.02, green: 0.16, blue: 0.36), Color(red: 0.20, green: 0.015, blue: 0.055)], startPoint: .leading, endPoint: .trailing)) : AnyShapeStyle(Color.orange), in: RoundedRectangle(cornerRadius: isNFL ? 8 : 18))
            .overlay(RoundedRectangle(cornerRadius: isNFL ? 8 : 18).stroke(isNFL ? .cyan.opacity(0.65) : .clear))
    }

    private func nextAction(_ lab: LeagueMembership) -> some View {
        let phase = cfbPhase(lab)
        let isNFL = lab.leagues.sportId.lowercased() == "nfl"
        let nflPhase = NflSeasonPhase.phase(week: lab.leagues.currentWeek)
        let nflPostseason = isNFL && nflPhase != .regularSeason
        return FoundryPanel(accent: isNFL ? .blue : .green) {
            if nflPostseason || phase.isPostseasonScoring || phase == .seasonComplete {
                if isNFL { NflFoundrySectionTitle(kicker: nflPhase.kicker, title: nflPhase.title) }
                else { FoundrySectionTitle(kicker: phase == .seasonComplete ? "SEASON COMPLETE" : phase.isCfp ? "PLAYOFF WEEK CONTROL" : "BOWL WEEK CONTROL", title: phase == .seasonComplete ? "POSTSEASON CERTIFIED" : phase.isCfp ? "THE PLAYOFFS ARE LIVE" : "BOWL MANIA IS LIVE") }
                Text(isNFL ? "Wild Card through the Super Bowl lives on the NFL bracket. JDAM is the only postseason weapon on this desk." : phase == .seasonComplete ? "The Foundry postseason is complete. Review the Dispatch, standings, and final board." : "Same Foundry rhythm. Lock Week freezes every bot card for inspection. Score Week certifies this phase, creates its Dispatch, and advances the room.")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.64)).fixedSize(horizontal: false, vertical: true)
                if phase != .seasonComplete && !isNFL {
                    HStack(spacing: 10) {
                        Button { Task { await lockPostseasonWeek(lab) } } label: {
                            VStack(spacing: 5) {
                                Image(systemName: postseasonWeekLocked ? "lock.fill" : "lock.open.fill").font(.title2)
                                Text(lockingWeek ? "LOCKING…" : postseasonWeekLocked ? "WEEK LOCKED" : "LOCK WEEK").font(.headline.weight(.black))
                                Text(phase.isCfp ? "BRACKET · BOARD" : "BOWLS · BOARD").font(.system(size: 7, weight: .black)).tracking(0.6)
                            }.frame(maxWidth: .infinity).padding(.vertical, 14).foregroundStyle(.black).background(postseasonWeekLocked ? Color.gray : Color.orange, in: RoundedRectangle(cornerRadius: 13))
                        }.buttonStyle(.plain).disabled(postseasonWeekLocked || lockingWeek || scoringWeek)
                        Button { Task { await scorePostseasonWeek(lab) } } label: {
                            VStack(spacing: 5) {
                                Image(systemName: "checkmark.seal.fill").font(.title2)
                                Text(scoringWeek ? "SCORING…" : "SCORE WEEK").font(.headline.weight(.black))
                                Text("RESULTS · DISPATCH").font(.system(size: 7, weight: .black)).tracking(0.6)
                            }.frame(maxWidth: .infinity).padding(.vertical, 14).foregroundStyle(.black).background(postseasonWeekLocked ? Color.green : Color.gray, in: RoundedRectangle(cornerRadius: 13))
                        }.buttonStyle(.plain).disabled(!postseasonWeekLocked || lockingWeek || scoringWeek)
                    }
                } else if !isNFL || nflPhase == .seasonComplete {
                    Button { Task { await presentSeasonFinale(lab) } } label: {
                        Label("REPLAY THE RING CEREMONY", systemImage: "sparkles")
                            .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(15)
                            .foregroundStyle(.black).background(.yellow, in: RoundedRectangle(cornerRadius: 13))
                    }.buttonStyle(.plain)
                } else {
                    Label("OPEN PLAYOFF COMMAND TO STAGE, LOCK, AND SCORE THIS ROUND", systemImage: "arrow.down.right.circle.fill")
                        .font(.caption.weight(.black)).foregroundStyle(.cyan)
                }
                if let weekActionNotice { Text(weekActionNotice).font(.caption.weight(.black)).foregroundStyle(.green) }
                NavigationLink { FoundryLeagueMirrorView(seedMembership: lab) } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("OPEN THE FULL LEAGUE").font(.headline.weight(.black))
                            Text("HOME · BOARD · STANDINGS · LOCKER · DISPATCH")
                                .font(.system(size: 7, weight: .black)).tracking(0.5)
                        }
                        Spacer()
                        Image(systemName: "rectangle.3.group.fill").font(.title2)
                    }
                    .foregroundStyle(.white).padding(16)
                    .background(.orange.opacity(0.18), in: RoundedRectangle(cornerRadius: 13))
                    .overlay(RoundedRectangle(cornerRadius: 13).stroke(.orange.opacity(0.65)))
                }.buttonStyle(.plain)
                NavigationLink { isNFL ? AnyView(NflPostseasonCloudView(membership: lab)) : AnyView(CfbPostseasonHubView(membership: lab)) } label: {
                    Label(isNFL ? "OPEN NFL PLAYOFF COMMAND" : phase == .seasonComplete ? "REVIEW POSTSEASON" : "OPEN BOWL / PLAYOFF COMMAND", systemImage: "trophy.fill")
                        .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(15)
                        .foregroundStyle(.black).background(.yellow, in: RoundedRectangle(cornerRadius: 13))
                }.buttonStyle(.plain)
            } else {
                if isNFL { NflFoundrySectionTitle(kicker: "GAME WEEK \(lab.leagues.currentWeek) · CONTROL DESK", title: !seasonReady ? "OPENING BROADCAST REQUIRED" : card == nil ? "STAGING THE GAME SLATE" : weekLocked ? "KICKOFF HAS HIT" : "CHOOSE THE MOMENT") }
                else { FoundrySectionTitle(kicker: "WEEK \(lab.leagues.currentWeek) CONTROL", title: !seasonReady ? "OPENING CEREMONY REQUIRED" : card == nil ? "STAGING THE TEST WEEK" : weekLocked ? "KICKOFF HAS HIT" : phase == .conferenceChampionships ? "CHAMPIONSHIP SATURDAY" : "CHOOSE THE MOMENT") }
                Text(card == nil ? "The Foundry is creating this week and filling every bot card automatically. No commissioner setup required." : safeBotLab ? "Lock Week stops before scoring so you can inspect the Board. Score Week runs the finals, standings, Crown & Shame, Dispatch, and progression." : "Safety stop: this room is not a verified bot lab. Both controls stay sealed.")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.64)).fixedSize(horizontal: false, vertical: true)
                if card != nil {
                HStack(spacing: 10) {
                    Button { Task { await lockCurrentWeek(lab) } } label: {
                        VStack(spacing: 5) {
                            Image(systemName: weekLocked ? "lock.fill" : "lock.open.fill").font(.title2)
                            Text(lockingWeek ? "LOCKING…" : weekLocked ? "WEEK LOCKED" : "LOCK WEEK").font(.headline.weight(.black))
                            Text(weekLocked ? "BOARD IS LIVE" : "KICKOFF · BOARD").font(.system(size: 7, weight: .black)).tracking(0.6)
                        }.frame(maxWidth: .infinity).padding(.vertical, 14)
                            .foregroundStyle(.white).background(weekLocked ? Color.gray : (isNFL ? Color.blue : Color.orange), in: RoundedRectangle(cornerRadius: isNFL ? 7 : 13))
                    }.buttonStyle(.plain).disabled(!safeBotLab || !seasonReady || weekLocked || lockingWeek || scoringWeek)
                    Button { Task { await scoreCurrentWeek(lab) } } label: {
                        VStack(spacing: 5) {
                            Image(systemName: "checkmark.seal.fill").font(.title2)
                            Text(scoringWeek ? "SCORING…" : "SCORE WEEK").font(.headline.weight(.black))
                            Text("RESULTS · DISPATCH").font(.system(size: 7, weight: .black)).tracking(0.6)
                        }.frame(maxWidth: .infinity).padding(.vertical, 14)
                            .foregroundStyle(isNFL ? .white : .black).background(isNFL ? Color.red : Color.green, in: RoundedRectangle(cornerRadius: isNFL ? 7 : 13))
                    }.buttonStyle(.plain).disabled(!safeBotLab || !seasonReady || lockingWeek || scoringWeek)
                }
                if let weekActionNotice { Text(weekActionNotice).font(.caption.weight(.black)).foregroundStyle(.green) }
                if seasonReady {
                    NavigationLink { FoundryLeagueMirrorView(seedMembership: lab) } label: {
                        HStack { VStack(alignment: .leading, spacing: 3) { Text(weekLocked ? "REVIEW THE LOCKED WEEK" : "REVIEW THE LIVE LEAGUE").font(.headline.weight(.black)); Text(weekLocked ? "BOARD · STANDINGS · LOCKER · DISPATCH" : "HOME · SEALED PICKS · STANDINGS · LOCKER").font(.system(size: 7, weight: .black)).tracking(0.5) }; Spacer(); Image(systemName: "rectangle.3.group.fill").font(.title2) }
                            .foregroundStyle(.white).padding(16).background((isNFL ? Color.blue : Color.orange).opacity(0.18), in: RoundedRectangle(cornerRadius: isNFL ? 7 : 13)).overlay(RoundedRectangle(cornerRadius: isNFL ? 7 : 13).stroke((isNFL ? Color.cyan : Color.orange).opacity(0.65)))
                    }.buttonStyle(.plain)
                }
                } else { ProgressView("STAGING WEEK…").tint(.cyan).frame(maxWidth: .infinity).padding(15) }
            }
        }
    }

    private func progressTrail(_ lab: LeagueMembership) -> some View {
        FoundryPanel(accent: isNFLFoundry ? .blue : .orange) {
            if isNFLFoundry { NflFoundrySectionTitle(kicker: "DRIVE STATUS", title: "MOVE THE CHAINS") }
            else { FoundrySectionTitle(kicker: "THIS WEEK", title: "FOLLOW THE LIGHTS") }
            trailRow("1", "Quarantine", "Production blocked", done: true, active: false)
            trailRow("2", isNFLFoundry ? "Game slate" : "Test card", card == nil ? "Auto-staging" : "Published", done: card != nil, active: card == nil)
            trailRow("3", "Bot roster", safeBotLab ? "\(submittedCount)/\(bots.count) bots submitted" : "Bot quarantine failed", done: safeBotLab && submittedCount == bots.count, active: !safeBotLab || submittedCount < bots.count)
            trailRow("4", isNFLFoundry ? "Kickoff" : "Kickoff lock", weekLocked ? "Board declassified" : "Picks still sealed", done: weekLocked, active: !weekLocked)
            trailRow("5", "Score week", "Standings · Crown · Shame · Dispatch", done: false, active: weekLocked)
            trailRow("6", "Review the damage", "Standings · Crown · Shame · Dispatch", done: false, active: false)
            trailRow("7", "Next week", "Repeat until postseason", done: false, active: false)
        }
    }

    private func seasonTimeMachine(_ lab: LeagueMembership) -> some View {
        let phase = cfbPhase(lab)
        let isNFL = lab.leagues.sportId.lowercased() == "nfl"
        return FoundryPanel(accent: phase == .regularSeason ? .purple : .green) {
            if isNFL { NflFoundrySectionTitle(kicker: "SEASON SIMULATOR", title: phase == .regularSeason ? "FAST-FORWARD THE TAPE" : "FINAL THIRTEEN UNLOCKED") }
            else { FoundrySectionTitle(kicker: "SEASON TIME MACHINE", title: phase == .regularSeason ? "SKIP THE REPETITION" : phase == .conferenceChampionships ? "CHAMPIONSHIP SATURDAY" : "POSTSEASON UNLOCKED") }
            if phase != .regularSeason {
                Text(isNFL ? "The 18-week regular season is certified. Wild Card, Divisional, Conference Championship, and Super Bowl decisions are ready for inspection." : phase == .conferenceChampionships ? "The regular season is certified. Score this separate championship card before Bowl Mania opens." : "Championship Saturday is certified. Bowl Mania and the CFP are ready for inspection.")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.64))
                NavigationLink { isNFL ? AnyView(NflPostseasonCloudView(membership: lab)) : phase == .conferenceChampionships ? AnyView(FoundryLeagueMirrorView(seedMembership: lab)) : AnyView(CfbPostseasonHubView(membership: lab)) } label: {
                    Label(isNFL ? "OPEN NFL PLAYOFF COMMAND" : phase == .conferenceChampionships ? "REVIEW CHAMPIONSHIP WEEK" : "OPEN POSTSEASON COMMAND", systemImage: "trophy.fill")
                        .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(15)
                        .foregroundStyle(.black).background(.green, in: RoundedRectangle(cornerRadius: 13))
                }.buttonStyle(.plain)
            } else {
                if !isNFL && lab.leagues.currentWeek <= 13 {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("RIVALRY WEEK TEST RIG", systemImage: "flame.fill")
                            .font(.caption.weight(.black)).tracking(1.1).foregroundStyle(.red)
                        Text("Jump safely to ESPN Week 13, inspect the five certified grudges, then load two synthetic past seasons to prove the Epic and Legendary gates cannot come from one season.")
                            .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
                        Button { Task { await stageRivalryWeek(lab) } } label: {
                            Label(stagingRivalry ? "STAGING HATE WEEK…" : "JUMP TO RIVALRY WEEK", systemImage: "forward.end.alt.fill")
                                .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(14)
                                .foregroundStyle(.white).background(.red, in: RoundedRectangle(cornerRadius: 12))
                        }.buttonStyle(.plain).disabled(stagingRivalry || completingSeason || !safeBotLab)
                        Button { Task { await seedRivalryHistory(lab) } } label: {
                            Label(seedingRivalryHistory ? "LOADING RECEIPTS…" : "LOAD TWO PAST-SEASON RECEIPTS", systemImage: "clock.arrow.2.circlepath")
                                .font(.caption.weight(.black)).frame(maxWidth: .infinity).padding(12)
                                .foregroundStyle(.purple).background(.purple.opacity(0.14), in: RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.purple.opacity(0.7)))
                        }.buttonStyle(.plain).disabled(seedingRivalryHistory || !safeBotLab)
                        if let rivalryTestNotice { Text(rivalryTestNotice).font(.caption.weight(.black)).foregroundStyle(.green) }
                    }
                    .padding(14).background(.red.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
                }
                Text("You proved the weekly loop. Process Weeks \(lab.leagues.currentWeek)–\(isNFL ? 18 : lab.leagues.regularSeasonWeeks) automatically, preserve every receipt, and report directly to postseason.")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.64)).fixedSize(horizontal: false, vertical: true)
                Button { confirmingSeasonSkip = true } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(completingSeason ? "RUNNING THE SEASON…" : "COMPLETE REGULAR SEASON").font(.headline.weight(.black))
                            Text("SCORE · STANDINGS · DISPATCH · POSTSEASON").font(.system(size: 7, weight: .black)).tracking(0.6)
                        }
                        Spacer()
                        if completingSeason { ProgressView().tint(.black) } else { Image(systemName: "forward.end.fill").font(.title2) }
                    }.foregroundStyle(.black).padding(16).background(.purple, in: RoundedRectangle(cornerRadius: 13))
                }.buttonStyle(.plain).disabled(completingSeason || !safeBotLab)
            }
            if let seasonSkipNotice { Text(seasonSkipNotice).font(.caption.weight(.black)).foregroundStyle(.green) }
        }
    }

    private func trailRow(_ number: String, _ title: String, _ detail: String, done: Bool, active: Bool) -> some View {
        HStack(spacing: 12) {
            ZStack { Circle().fill(done ? foundrySecondary : active ? foundryAccent : Color.white.opacity(0.08)).frame(width: 30, height: 30); Image(systemName: done ? "checkmark" : number + ".circle.fill").font(.caption.weight(.black)).foregroundStyle(done || active ? .white : .white.opacity(0.35)) }
            VStack(alignment: .leading, spacing: 2) { Text(title.uppercased()).font(.caption.weight(.black)).foregroundStyle(active ? foundryAccent : .white); Text(detail).font(.caption2.weight(.semibold)).foregroundStyle(.white.opacity(0.42)) }
            Spacer()
            if active { Text(isNFLFoundry ? "LIVE" : "NOW").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(foundryAccent) }
        }.padding(.vertical, 3)
    }

    private var emergencyTools: some View {
        FoundryPanel(accent: .white.opacity(0.3)) {
            Button { withAnimation { emergencyToolsOpen.toggle() } } label: {
                HStack { Label("EMERGENCY TOOLS", systemImage: "wrench.and.screwdriver.fill").font(.caption.weight(.black)); Spacer(); Image(systemName: emergencyToolsOpen ? "chevron.up" : "chevron.down") }
            }.buttonStyle(.plain)
            if emergencyToolsOpen {
                Divider().overlay(.white.opacity(0.15))
                FoundryCheck(label: "Creator identity", value: "VERIFIED", color: .green)
                FoundryCheck(label: "Production rooms", value: "\(productionCount) BLOCKED", color: .green)
                FoundryCheck(label: "Website", value: "FROZEN", color: .green)
                FoundryCheck(label: "Server restore", value: "CONNECTED", color: .green)
                if let lab {
                    Button { confirmingReset = true } label: {
                        Label(resetting ? "RESTORING…" : "RESTORE BOT LAB TO WEEK \(SportIdentity(lab.leagues.sportId).openingWeek)", systemImage: "arrow.counterclockwise.circle.fill")
                            .font(.caption.weight(.black)).frame(maxWidth: .infinity).padding(13)
                            .foregroundStyle(.black).background(.orange, in: RoundedRectangle(cornerRadius: 11))
                    }.buttonStyle(.plain).disabled(resetting)
                    Text("This is a real server restore scoped to \(lab.leagues.name). It cannot target a production room.").font(.caption2.weight(.semibold)).foregroundStyle(.white.opacity(0.4))
                }
                if let errorMessage { Text(errorMessage).font(.caption.weight(.bold)).foregroundStyle(.red) }
            }
        }
    }

    private func preflight() async {
        guard authorized, let user = auth.user, let token = auth.token else {
            loading = false
            return
        }
        loading = true
        errorMessage = nil
        do {
            memberships = try await SupabaseAPI.leagueMemberships(token: token, userId: user.id, includeFoundry: true)
            let availableLabs = memberships.filter { membership in
                FoundryLabPolicy.accepts(
                    mode: membership.leagues.mode,
                    sportId: membership.leagues.sportId,
                    preferredSportId: preferredSportId
                )
            }
            if selectedLabId == nil || !availableLabs.contains(where: { $0.leagueId == selectedLabId }) {
                selectedLabId = availableLabs.first?.leagueId
            }
            if let lab = availableLabs.first(where: { $0.leagueId == selectedLabId }) ?? availableLabs.first {
                var loadedWeekCard = try await SupabaseAPI.weekCard(token: token, leagueId: lab.leagueId, weekNumber: lab.leagues.currentWeek)
                if loadedWeekCard == nil && CfbSeasonPhase.phase(week: lab.leagues.currentWeek, regularSeasonWeeks: lab.leagues.regularSeasonWeeks) == .regularSeason {
                    try await SupabaseAPI.bootstrapFoundryWeek(token: token, leagueId: lab.leagueId, weekNumber: lab.leagues.currentWeek)
                    loadedWeekCard = try await SupabaseAPI.weekCard(token: token, leagueId: lab.leagueId, weekNumber: lab.leagues.currentWeek)
                }
                async let loadedStandings = SupabaseAPI.standings(token: token, leagueId: lab.leagueId)
                async let loadedSubmitted = SupabaseAPI.weekSubmittedUserIds(token: token, leagueId: lab.leagueId, weekNumber: lab.leagues.currentWeek)
                async let loadedLifecycle = SupabaseAPI.foundrySeasonLifecycle(token: token, leagueId: lab.leagueId)
                card = loadedWeekCard
                (standings, submittedUserIds, lifecycle) = try await (loadedStandings, loadedSubmitted, loadedLifecycle)
                let phase = cfbPhase(lab)
                if phase.isPostseasonScoring && lab.leagues.sportId.lowercased() != "nfl" {
                    let seasonKey = Calendar.current.component(.year, from: Date())
                    let postseasonRows = try await SupabaseAPI.foundryCfbPostseasonStandings(token: token, leagueId: lab.leagueId, seasonKey: seasonKey)
                    let botRows = postseasonRows.filter { $0.userId != user.id }
                    postseasonWeekLocked = !botRows.isEmpty && botRows.allSatisfy { phase == .bowlMania ? $0.bowlLocked : $0.cfpLocked }
                } else {
                    postseasonWeekLocked = false
                }
                presentRequiredLifecycleStage()
            }
        }
        catch { errorMessage = error.localizedDescription }
        loading = false
    }

    @MainActor private func stageRivalryWeek(_ lab: LeagueMembership) async {
        guard let token = auth.token else { return }
        stagingRivalry = true
        rivalryTestNotice = nil
        do {
            let result = try await SupabaseAPI.stageFoundryRivalryWeek(token: token, leagueId: lab.leagueId)
            rivalryTestNotice = "Week \(result.rivalryWeek) staged through \(result.weeksProcessed) certified week\(result.weeksProcessed == 1 ? "" : "s"). Open the league and inspect the red-lit grudge card."
            await preflight()
        } catch { rivalryTestNotice = error.localizedDescription }
        stagingRivalry = false
    }

    @MainActor private func seedRivalryHistory(_ lab: LeagueMembership) async {
        guard let token = auth.token else { return }
        seedingRivalryHistory = true
        rivalryTestNotice = nil
        do {
            let result = try await SupabaseAPI.seedFoundryRivalryHistory(token: token, leagueId: lab.leagueId)
            rivalryTestNotice = "Loaded \(result.pastSeasons) distinct test seasons. Epic is now eligible; score current Rivalry Week to test the three-season Legendary gate."
            await preflight()
        } catch { rivalryTestNotice = error.localizedDescription }
        seedingRivalryHistory = false
    }

    @MainActor private func resetLab() async {
        guard let token = auth.token, let lab else { return }
        resetting = true; errorMessage = nil
        do {
            try await SupabaseAPI.resetFoundryLab(token: token, leagueId: lab.leagueId)
            loading = true
            await preflight()
        } catch { errorMessage = error.localizedDescription }
        resetting = false
    }

    @MainActor private func completeRegularSeason() async {
        guard let token = auth.token, let lab else { return }
        completingSeason = true
        errorMessage = nil
        seasonSkipNotice = nil
        do {
            let result = try await SupabaseAPI.completeFoundryRegularSeason(token: token, leagueId: lab.leagueId)
            seasonSkipNotice = "\(result.weeksProcessed) weeks certified. Postseason Week \(result.postseasonWeek) is live."
            loading = true
            await preflight()
        } catch { errorMessage = error.localizedDescription }
        completingSeason = false
    }

    @MainActor private func lockCurrentWeek(_ lab: LeagueMembership) async {
        guard let token = auth.token, safeBotLab, !weekLocked else { return }
        lockingWeek = true; errorMessage = nil; weekActionNotice = nil
        do {
            let result = try await SupabaseAPI.lockFoundryWeek(token: token, leagueId: lab.leagueId, weekNumber: lab.leagues.currentWeek)
            weekActionNotice = "Week \(result.week) locked. \(result.lockedCards) bot cards are now visible on the Board. Nothing has been scored."
            loading = true
            await preflight()
        } catch { errorMessage = error.localizedDescription }
        lockingWeek = false
    }

    @MainActor private func scoreCurrentWeek(_ lab: LeagueMembership) async {
        guard let token = auth.token, safeBotLab else { return }
        scoringWeek = true; errorMessage = nil; weekActionNotice = nil
        do {
            let result = try await SupabaseAPI.scoreFoundryWeekSimulated(token: token, leagueId: lab.leagueId, weekNumber: lab.leagues.currentWeek)
            weekActionNotice = "Week \(lab.leagues.currentWeek) scored. \(result.scoredCount) cards certified; Crown, Shame, Dispatch, and Week \(result.nextWeek ?? lab.leagues.currentWeek + 1) are ready."
            loading = true
            await preflight()
        } catch { errorMessage = error.localizedDescription }
        scoringWeek = false
    }

    @MainActor private func lockPostseasonWeek(_ lab: LeagueMembership) async {
        guard let token = auth.token else { return }
        lockingWeek = true; errorMessage = nil; weekActionNotice = nil
        do {
            let seasonKey = Calendar.current.component(.year, from: Date())
            let result = try await SupabaseAPI.lockFoundryPostseasonWeek(token: token, leagueId: lab.leagueId, seasonKey: seasonKey)
            postseasonWeekLocked = true
            weekActionNotice = "Week \(result.week) locked. \(result.lockedCards ?? 0) bot cards are frozen for review. Nothing has been scored."
        } catch { errorMessage = error.localizedDescription }
        lockingWeek = false
    }

    @MainActor private func scorePostseasonWeek(_ lab: LeagueMembership) async {
        guard let token = auth.token, postseasonWeekLocked else { return }
        scoringWeek = true; errorMessage = nil; weekActionNotice = nil
        do {
            let seasonKey = Calendar.current.component(.year, from: Date())
            let result = try await SupabaseAPI.scoreFoundryPostseasonWeek(token: token, leagueId: lab.leagueId, seasonKey: seasonKey)
            weekActionNotice = "Week \(result.week) scored. \(result.scoredCards ?? 0) bot cards certified; the phase Dispatch and Week \(result.nextWeek ?? result.week + 1) are ready."
            if result.phase == "championship" {
                await presentSeasonFinale(lab)
            }
            loading = true
            await preflight()
        } catch { errorMessage = error.localizedDescription }
        scoringWeek = false
    }

    @MainActor private func presentSeasonFinale(_ lab: LeagueMembership) async {
        guard let token = auth.token else { return }
        do {
            if lab.leagues.sportId.lowercased() == "nfl" {
                let finalStandings = try await SupabaseAPI.standings(token: token, leagueId: lab.leagueId)
                seasonChampion = finalStandings.sorted {
                    if $0.totalPoints == $1.totalPoints { return $0.name < $1.name }
                    return $0.totalPoints > $1.totalPoints
                }.first?.name ?? "FOUNDRY CHAMPION"
            } else {
                let seasonKey = Calendar.current.component(.year, from: Date())
                let finalStandings = try await SupabaseAPI.foundryCfbPostseasonStandings(token: token, leagueId: lab.leagueId, seasonKey: seasonKey)
                seasonChampion = finalStandings.first?.displayName ?? "FOUNDRY CHAMPION"
            }
            showingSeasonFinale = true
        } catch { errorMessage = error.localizedDescription }
    }

    @MainActor private func presentRequiredLifecycleStage() {
        guard !showingSeasonOpening, !showingChampionshipColdOpen else { return }
        if lifecycle?.stage == "season_opening" { showingSeasonOpening = true }
        else if lifecycle?.stage == "championship_cold_open" { showingChampionshipColdOpen = true }
    }

    @MainActor private func finishPresentation(_ stage: String) async {
        guard let token = auth.token, let lab, lifecycle?.stage == stage else { return }
        do {
            lifecycle = try await SupabaseAPI.advanceFoundryPresentation(token: token, leagueId: lab.leagueId, expectedStage: stage)
            presentRequiredLifecycleStage()
        } catch { errorMessage = error.localizedDescription }
    }
}

private struct NflFoundryOpeningView: View {
    @Binding var isPresented: Bool

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            LinearGradient(
                colors: [Color(red: 0.01, green: 0.08, blue: 0.15), .black, Color.blue.opacity(0.18)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ).ignoresSafeArea()
            RadialGradient(colors: [.cyan.opacity(0.28), .clear], center: .top, startRadius: 12, endRadius: 430).ignoresSafeArea()
            VStack(spacing: 18) {
                Spacer()
                Image(systemName: "football.fill")
                    .font(.system(size: 72, weight: .black))
                    .foregroundStyle(.cyan)
                    .shadow(color: .cyan.opacity(0.65), radius: 28)
                Text("SUNDAY FOUNDRY").font(.caption.weight(.black)).tracking(3).foregroundStyle(.cyan)
                Text("WEEK 1 STARTS\nUNDER THE LIGHTS")
                    .font(.system(size: 42, weight: .black)).fontWidth(.condensed)
                    .multilineTextAlignment(.center)
                Text("Five games each week. Eighteen regular-season weeks, four playoff rounds, and native pro-football rules from kickoff to the final whistle.")
                    .font(.headline.weight(.semibold)).foregroundStyle(.white.opacity(0.68))
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 9) {
                    NflFoundryOpeningMetric(value: "22", label: "GAME WEEKS")
                    NflFoundryOpeningMetric(value: "5", label: "GAMES")
                    NflFoundryOpeningMetric(value: "13", label: "PLAYOFF CALLS")
                }
                Spacer()
                Button { isPresented = false } label: {
                    Label("OPEN THE NFL LAB", systemImage: "arrow.right.circle.fill")
                        .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(17)
                        .foregroundStyle(.black).background(.cyan, in: RoundedRectangle(cornerRadius: 14))
                }.buttonStyle(.plain)
            }.padding(24).padding(.vertical, 24)
        }.preferredColorScheme(.dark)
    }
}

private struct NflFoundryOpeningMetric: View {
    let value: String
    let label: String
    var body: some View {
        VStack(spacing: 3) {
            Text(value).font(.title2.weight(.black)).foregroundStyle(.cyan)
            Text(label).font(.system(size: 7, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.48))
        }
        .frame(maxWidth: .infinity).padding(13)
        .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(.cyan.opacity(0.25)))
    }
}

private struct FoundrySeasonFinaleView: View {
    let membership: LeagueMembership
    let champion: String
    @Binding var isPresented: Bool
    private var isNFL: Bool { membership.leagues.sportId.lowercased() == "nfl" }

    private var trophy: (name: String, image: String) {
        switch membership.leagues.championshipTrophyId {
        case "golden_gut": ("THE GOLDEN GUT", "GoldenGutArtifact")
        case "the_receipt": ("THE RECEIPT", "TheReceiptArtifact")
        case "insufferable_crown": ("CROWN OF INSUFFERABILITY", "InsufferableCrownArtifact")
        case "brass_football": ("BIG BRASS FOOTBALL", "BigBrassFootballArtifact")
        case "last_one_standing": ("LAST ONE STANDING", "LastOneStandingArtifact")
        case "nfl_sunday_scepter": ("SUNDAY SCEPTER", "NflSundayScepterArtifact")
        case "nfl_gridiron_crown": ("GRIDIRON CROWN", "NflGridironCrownArtifact")
        case "nfl_fourth_down_forge": ("FOURTH-DOWN FORGE", "NflFourthDownForgeArtifact")
        case "nfl_two_minute_monument": ("TWO-MINUTE MONUMENT", "NflTwoMinuteMonumentArtifact")
        case "nfl_iron_end_zone": ("IRON END ZONE", "NflIronEndZoneArtifact")
        case "nfl_final_whistle": ("THE FINAL WHISTLE", "NflFinalWhistleArtifact")
        default: isNFL ? ("SUNDAY SCEPTER", "NflSundayScepterArtifact") : ("THE COMMAND CUP", "ChampionshipArtifact")
        }
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: isNFL ? [Color(red: 0.01, green: 0.04, blue: 0.12), .black, Color(red: 0.15, green: 0.01, blue: 0.035)] : [.black, Color(red: 0.19, green: 0.11, blue: 0.01), .black], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            RadialGradient(colors: [(isNFL ? Color.blue : Color.yellow).opacity(0.42), .clear], center: .center, startRadius: 20, endRadius: 390).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 18) {
                    Text(isNFL ? "FINAL WHISTLE · CHAMPIONSHIP BROADCAST" : "SEASON COMPLETE · RING CEREMONY").font(.caption.weight(.black)).tracking(2).foregroundStyle(isNFL ? .cyan : .yellow)
                    Text(isNFL ? "THE SEASON HAS\nONE SURVIVOR" : "A CHAMPION\nHAS BEEN CROWNED").font(.system(size: 40, weight: .black)).fontWidth(.condensed).multilineTextAlignment(.center)
                    Image(trophy.image).resizable().scaledToFit().frame(maxHeight: 330).shadow(color: (isNFL ? Color.blue : Color.yellow).opacity(0.7), radius: 32)
                    Text(champion.uppercased()).font(.system(size: 31, weight: .black)).fontWidth(.condensed).multilineTextAlignment(.center).foregroundStyle(isNFL ? .white : .yellow)
                    Text(trophy.name).font(.headline.weight(.black)).tracking(1.2)
                    Text(isNFL ? "Eighteen weeks. Four playoff rounds. One permanent receipt. The Sunday desk belongs to the champion." : "The bracket is closed. The receipts are permanent. The group chat now belongs to the loudest survivor.")
                        .font(.subheadline.weight(.semibold)).multilineTextAlignment(.center).foregroundStyle(.white.opacity(0.68))
                    HStack(spacing: 8) {
                        Image(systemName: isNFL ? "football.fill" : "seal.fill").foregroundStyle(isNFL ? .red : .yellow)
                        Text(isNFL ? "FINAL RECORD CERTIFIED" : "CHAMPIONSHIP RING ISSUED").font(.caption.weight(.black)).tracking(1.2)
                        Image(systemName: isNFL ? "football.fill" : "seal.fill").foregroundStyle(isNFL ? .blue : .yellow)
                    }.padding(13).background((isNFL ? Color.blue : Color.yellow).opacity(0.12), in: Capsule()).overlay(Capsule().stroke((isNFL ? Color.blue : Color.yellow).opacity(0.55)))
                    Button { isPresented = false } label: {
                        Text(isNFL ? "RETURN TO SUNDAY COMMAND" : "ENTER THE CHAMPION'S WAR ROOM").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(17).foregroundStyle(isNFL ? .white : .black).background(isNFL ? Color.blue : Color.yellow, in: RoundedRectangle(cornerRadius: isNFL ? 7 : 14))
                    }.buttonStyle(.plain)
                }.padding(24).padding(.vertical, 32)
            }
        }.preferredColorScheme(.dark)
    }
}

private struct FoundryChampionshipColdOpenView: View {
    let membership: LeagueMembership
    @Binding var isPresented: Bool

    private var design: (name: String, image: String, line: String) {
        let isNFL = membership.leagues.sportId.lowercased() == "nfl"
        switch membership.leagues.championshipTrophyId {
        case "golden_gut": return ("THE GOLDEN GUT", "GoldenGutArtifact", "Instinct over evidence. Glory over restraint.")
        case "the_receipt": return ("THE RECEIPT", "TheReceiptArtifact", "Every correct call preserved. Every bad take subpoenaed.")
        case "insufferable_crown": return ("CROWN OF INSUFFERABILITY", "InsufferableCrownArtifact", "Winning was never going to make them quieter.")
        case "brass_football": return ("BIG BRASS FOOTBALL", "BigBrassFootballArtifact", isNFL ? "Subtle as a prime-time touchdown celebration." : "Subtle as a marching band entering a courtroom.")
        case "last_one_standing": return ("LAST ONE STANDING", "LastOneStandingArtifact", "One survivor. A season full of alibis.")
        case "nfl_sunday_scepter": return ("SUNDAY SCEPTER", "NflSundayScepterArtifact", "Eighteen Sundays of evidence. One signal left standing.")
        case "nfl_gridiron_crown": return ("GRIDIRON CROWN", "NflGridironCrownArtifact", "The goalposts bend for one final authority.")
        case "nfl_fourth_down_forge": return ("FOURTH-DOWN FORGE", "NflFourthDownForgeArtifact", "Four pillars. One season suspended between them.")
        case "nfl_two_minute_monument": return ("TWO-MINUTE MONUMENT", "NflTwoMinuteMonumentArtifact", "Great seasons survive when the warning lights turn red.")
        case "nfl_iron_end_zone": return ("IRON END ZONE", "NflIronEndZoneArtifact", "The last territory on the board belongs to the champion.")
        case "nfl_final_whistle": return ("THE FINAL WHISTLE", "NflFinalWhistleArtifact", "When it sounds, every argument becomes a permanent record.")
        default: return isNFL ? ("SUNDAY SCEPTER", "NflSundayScepterArtifact", "Eighteen Sundays of evidence. One signal left standing.") : ("THE COMMAND CUP", "ChampionshipArtifact", "The room has its orders. Bring home the hardware.")
        }
    }

    var body: some View {
        let isNFL = membership.leagues.sportId.lowercased() == "nfl"
        ZStack {
            LinearGradient(colors: isNFL ? [Color(red: 0.01, green: 0.04, blue: 0.13), .black, Color(red: 0.14, green: 0.01, blue: 0.04)] : [.black, Color(red: 0.16, green: 0.10, blue: 0.01), .black], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            RadialGradient(colors: [(isNFL ? Color.blue : Color.yellow).opacity(0.30), .clear], center: .center, startRadius: 10, endRadius: 350).ignoresSafeArea()
            VStack(spacing: 20) {
                Text(isNFL ? "PRO FOOTBALL · OPENING BROADCAST" : "CHAMPIONSHIP COLD OPEN").font(.system(size: 10, weight: .black)).tracking(2.5).foregroundStyle(isNFL ? .cyan : .yellow)
                Text(membership.leagues.name.uppercased()).font(.caption.weight(.black)).tracking(1.4).foregroundStyle(.white.opacity(0.5))
                Image(design.image).resizable().scaledToFit().frame(maxWidth: 350, maxHeight: 410)
                    .shadow(color: (isNFL ? Color.blue : Color.yellow).opacity(0.55), radius: 35)
                Text(design.name).font(.system(size: 34, weight: .black)).fontWidth(.condensed).multilineTextAlignment(.center)
                Text(design.line).font(.headline.weight(.semibold)).foregroundStyle(.white.opacity(0.68)).multilineTextAlignment(.center)
                Text(isNFL ? "THIS IS WHAT EIGHTEEN SUNDAYS ARE FOR." : "THIS IS WHAT THE ROOM IS FIGHTING FOR.").font(.caption.weight(.black)).tracking(1.5).foregroundStyle(isNFL ? .red : .yellow)
                Button { isPresented = false } label: {
                    Label(isNFL ? "GO LIVE" : "OPEN THE SEASON", systemImage: isNFL ? "play.fill" : "flag.checkered").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16).foregroundStyle(isNFL ? .white : .black).background(isNFL ? Color.blue : Color.yellow, in: RoundedRectangle(cornerRadius: isNFL ? 7 : 14))
                }.buttonStyle(.plain)
            }.padding(24)
        }.preferredColorScheme(.dark)
    }
}

struct FoundryLeagueMirrorView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let seedMembership: LeagueMembership
    @State private var membership: LeagueMembership
    @State private var section: MirrorSection = .home
    @State private var standings: [Standing] = []
    @State private var messages: [LockerMessage] = []
    @State private var editions: [GazetteEditionRow] = []
    @State private var selectedDispatchId: UUID?
    @State private var picks: [BoardPick] = []
    @State private var card: WeekCard?
    @State private var lifecycle: FoundrySeasonLifecycle?
    @State private var submittedCount = 0
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var momentMode: FoundryMomentMode = .vault
    @State private var selectedKeyMoment: FoundryKeyMoment?

    init(seedMembership: LeagueMembership) {
        self.seedMembership = seedMembership
        _membership = State(initialValue: seedMembership)
    }

    private var reviewedWeek: Int { max(0, membership.leagues.currentWeek - 1) }
    private var isNFL: Bool { membership.leagues.sportId.lowercased() == "nfl" }
    private var mirrorAccent: Color { isNFL ? .cyan : .orange }
    private var mirrorSecondary: Color { isNFL ? .blue : .green }
    private var mirrorHighlight: Color { isNFL ? .white : .yellow }
    private var mirrorSignal: Color { isNFL ? .red : .orange }
    private var mirrorCornerRadius: CGFloat { isNFL ? 5 : 13 }
    private var bots: [Standing] { standings.filter(\.isBot) }
    private var selectedEdition: GazetteEditionRow? { editions.first { $0.id == selectedDispatchId } ?? editions.first }
    private var boardDeclassified: Bool { lifecycle?.stage == "week_locked" }
    private var availableSections: [MirrorSection] {
        MirrorSection.allCases.filter { item in
            if item == .postseason { return membership.leagues.currentWeek >= (membership.leagues.sportId.lowercased() == "nfl" ? 19 : membership.leagues.regularSeasonWeeks + 1) }
            if item == .dispatch || item == .moments || item == .audit { return !editions.isEmpty }
            return true
        }
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 0) {
                mirrorHeader
                sectionRail
                Group {
                    if loading { ProgressView(isNFL ? "Opening Sunday simulation…" : "Entering the bot league…").tint(mirrorAccent).frame(maxWidth: .infinity, maxHeight: .infinity) }
                    else if let errorMessage { ContentUnavailableView("Mirror unavailable", systemImage: "exclamationmark.triangle.fill", description: Text(errorMessage)) }
                    else { sectionBody }
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
        .task { await load() }
        .sheet(item: $selectedKeyMoment) { moment in
            FoundryKeyMomentDetail(moment: moment) { selectedDispatchId = moment.editionId; section = .audit }
                .presentationDetents([.large]).presentationDragIndicator(.hidden)
        }
    }

    private var mirrorHeader: some View {
        HStack(spacing: 11) {
            Button { dismiss() } label: {
                Label(isNFL ? "EXIT SIMULATION" : "EXIT BOT LEAGUE", systemImage: "chevron.backward")
                    .font(.system(size: 9, weight: .black))
                    .padding(.horizontal, 11)
                    .frame(height: 40)
                    .foregroundStyle(.black)
                    .background(mirrorAccent, in: RoundedRectangle(cornerRadius: isNFL ? 5 : 20))
            }.buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 2) {
                Text(isNFL ? "SUNDAY OPERATIONS · LIVE SIMULATION" : "FOUNDRY LEAGUE MIRROR").font(.system(size: 8, weight: .black)).tracking(1.4).foregroundStyle(mirrorAccent)
                Text(membership.leagues.name.uppercased()).font(.headline.weight(.black)).lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) { Text("LIVE STATE").font(.system(size: 7, weight: .black)).tracking(1).foregroundStyle(isNFL ? .cyan : .green); Text("WEEK \(membership.leagues.currentWeek)").font(.caption.weight(.black)) }
        }
        .padding(.horizontal, 14).padding(.vertical, 10).background(isNFL ? Color(red: 0.015, green: 0.055, blue: 0.14) : .black).overlay(alignment: .bottom) { Rectangle().fill(mirrorAccent.opacity(0.7)).frame(height: isNFL ? 3 : 1) }
    }

    private var sectionRail: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 7), count: 3), spacing: 7) {
                ForEach(availableSections) { item in
                    Button { withAnimation(.snappy) { section = item } } label: {
                        Label(item.label, systemImage: item.icon)
                            .font(.system(size: 8, weight: .black)).tracking(0.35)
                            .frame(maxWidth: .infinity).frame(height: 34)
                            .foregroundStyle(section == item ? .black : .white.opacity(0.62))
                            .background(section == item ? mirrorAccent : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: isNFL ? 4 : 9))
                    }.buttonStyle(.plain)
                }
        }.padding(.horizontal, 12).padding(.vertical, 9)
            .background(isNFL ? Color(red: 0.02, green: 0.04, blue: 0.09) : Color(red: 0.045, green: 0.045, blue: 0.045))
    }

    @ViewBuilder private var sectionBody: some View {
        switch section {
        case .home:
            HomeView(
                leagueOverride: membership,
                onOpenPicks: { section = .picks },
                onOpenStandings: { section = .standings },
                onOpenLocker: { section = .locker }
            )
        case .picks:
            if membership.leagues.sportId.lowercased() == "nfl" && membership.leagues.currentWeek >= 19 {
                NflPostseasonCloudView(membership: membership)
            } else if membership.leagues.currentWeek >= membership.leagues.regularSeasonWeeks + 2 {
                FoundryPostseasonBoardView(membership: membership)
            } else if boardDeclassified, let card {
                WeekBoardView(card: card, picks: picks, sportId: membership.leagues.sportId, loading: false, errorMessage: errorMessage) { Task { await load() } }
            } else if let card {
                mirrorScroll { FoundrySealedWeekView(card: card, lockedCount: submittedCount, sportId: membership.leagues.sportId) }
            } else {
                mirrorScroll { picksPage }
            }
        case .standings: StandingsView(leagueOverride: membership)
        case .locker: LockerRoomView(leagueOverride: membership)
        case .dispatch: GazetteView(membership: membership)
        case .postseason:
            if membership.leagues.sportId.lowercased() == "nfl" { NflPostseasonCloudView(membership: membership) }
            else { CfbPostseasonHubView(membership: membership) }
        case .moments: mirrorScroll { keyMomentsPage }
        case .audit: mirrorScroll { dispatchPage }
        }
    }

    private func mirrorScroll<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        ScrollView { content().padding(14).padding(.bottom, 34) }.refreshable { await load() }
    }

    private var homePage: some View {
        VStack(alignment: .leading, spacing: 14) {
            MirrorHero(kicker: isNFL ? "SUNDAY SIMULATION · MEMBER VIEW" : "BOT LEAGUE · MEMBER VIEW", title: "WEEK \(reviewedWeek) AFTERMATH", detail: "Nothing is hidden behind a receipt. Walk every league page and inspect what actually moved.", color: mirrorAccent)
            HStack(spacing: 9) {
                MirrorMetric(value: "\(bots.count)", label: "BOTS", color: mirrorAccent)
                MirrorMetric(value: "\(picks.count)", label: "SCORED", color: mirrorAccent)
                MirrorMetric(value: "\(editions.count)", label: "DISPATCHES", color: mirrorAccent)
            }
            if let leader = bots.first { MirrorImpactCard(kicker: "LEAGUE LEADER", title: leader.name, detail: "\(leader.totalPoints) total · \(leader.weeklyPoints.last ?? 0) this week", color: mirrorHighlight, icon: "crown.fill") }
            pageButton(.standings, "SEE EVERY STANDINGS MOVE", "Before rank → after rank · weekly points", mirrorSecondary)
            pageButton(.picks, "AUDIT EVERY BOT CARD", "Picks, confidence, Best Bet, prop, score", .blue)
            pageButton(.locker, "READ THE ROOM", "See the exact bullshit available to Dispatch", .red)
            pageButton(.moments, "INSPECT KEY MOMENTS", "Every trigger · every week · every receipt", mirrorSignal)
            pageButton(.audit, "OPEN THE DISPATCH AUDIT", "Compare every issue and hunt repeated copy", mirrorHighlight)
        }
    }

    private var picksPage: some View {
        VStack(alignment: .leading, spacing: 12) {
            MirrorHero(kicker: "WEEK \(reviewedWeek) · SCORE AUDIT", title: "EVERY CARD. EVERY RECEIPT.", detail: card.map { "\($0.cardGames.count) games · \(picks.count) bot slips · prop included" } ?? "Scored bot slips", color: .blue)
            ForEach(picks) { pick in
                DisclosureGroup {
                    VStack(alignment: .leading, spacing: 7) {
                        ForEach(pick.pickGames.sorted { $0.confidence > $1.confidence }, id: \.cardGameId) { game in
                            FoundryPickAuditRow(game: game)
                        }
                        Text("PROP · \(pick.propChoice ?? "NO PICK")").font(.caption.weight(.black)).foregroundStyle(mirrorHighlight)
                    }.padding(.top, 8)
                } label: {
                    HStack { Text(pick.name.uppercased()).font(.headline.weight(.black)); Spacer(); Text("\(pick.totalPoints ?? 0) PTS").font(.headline.weight(.black)).foregroundStyle(mirrorAccent) }
                }.tint(mirrorSecondary).padding(14).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: mirrorCornerRadius))
            }
        }
    }

    private var standingsPage: some View {
        VStack(alignment: .leading, spacing: 12) {
            MirrorHero(kicker: "WEEK \(reviewedWeek) · MOVEMENT", title: "THE DAMAGE BOARD", detail: "Previous rank is reconstructed before this week's points. Current rank is the real rebuilt standing.", color: mirrorSecondary)
            ForEach(Array(bots.enumerated()), id: \.element.id) { index, standing in
                let oldRank = previousRank(for: standing)
                HStack(spacing: 12) {
                    Text("\(index + 1)").font(.title2.weight(.black)).foregroundStyle(index == 0 ? mirrorHighlight : mirrorAccent).frame(width: 32)
                    VStack(alignment: .leading, spacing: 3) { Text(standing.name.uppercased()).font(.headline.weight(.black)); Text("\(standing.weeklyPoints.last ?? 0) THIS WEEK · \(standing.totalPoints) TOTAL").font(.caption2.weight(.black)).foregroundStyle(.white.opacity(0.46)) }
                    Spacer()
                    Text(oldRank == index + 1 ? "—" : "\(oldRank) → \(index + 1)").font(.caption.weight(.black)).foregroundStyle(oldRank > index + 1 ? mirrorAccent : .red)
                }.padding(13).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: mirrorCornerRadius))
            }
        }
    }

    private var lockerPage: some View {
        VStack(alignment: .leading, spacing: 12) {
            MirrorHero(kicker: "DISPATCH SOURCE MATERIAL", title: "THE LOCKER ROOM WIRE", detail: "These are the actual comments available when the week was filed. The \(isNFL ? "cyan" : "orange") marker identifies the latest quote candidate.", color: .red)
            ForEach(Array(messages.reversed().enumerated()), id: \.element.id) { index, message in
                HStack(alignment: .top, spacing: 10) {
                    Circle().fill(index == 0 ? mirrorAccent : Color.red.opacity(0.35)).frame(width: 9, height: 9).padding(.top, 5)
                    VStack(alignment: .leading, spacing: 4) { Text(message.authorName.uppercased()).font(.caption.weight(.black)).foregroundStyle(index == 0 ? mirrorAccent : .red); Text(message.body).font(.subheadline.weight(.semibold)) }
                    Spacer()
                }.padding(13).background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 13))
            }
        }
    }

    private var dispatchPage: some View {
        VStack(alignment: .leading, spacing: 13) {
            MirrorHero(kicker: "FULL-SEASON COPY DESK", title: "HUNT THE REPEAT", detail: "Open every issue here. Compare jokes, headlines, quotes, Crown & Shame framing, and the facts behind the roast.", color: mirrorHighlight)
            if let edition = selectedEdition {
                DispatchHistoryControl(editions: editions, selectedId: $selectedDispatchId)
                Text("WEEK \(edition.weekNumber) · AFTER ACTION EDITION")
                    .font(.caption.weight(.black)).tracking(1.4).foregroundStyle(mirrorAccent)
                let payload = edition.payload
                MirrorImpactCard(kicker: "CROWN", title: payload.crown?.headline ?? "NO CROWN FILED", detail: payload.crown?.deck ?? "Missing copy", color: mirrorHighlight, icon: "crown.fill")
                MirrorImpactCard(kicker: "SHAME", title: payload.shame?.headline ?? "NO SHAME FILED", detail: payload.shame?.deck ?? "Missing copy", color: .red, icon: "hand.thumbsdown.fill")
                if let quote = payload.pullQuote { MirrorImpactCard(kicker: "LOCKER ROOM RECEIPT", title: quote.by ?? "THE ROOM", detail: "“\(quote.text ?? "No quote")”", color: mirrorSignal, icon: "quote.bubble.fill") }
                VStack(alignment: .leading, spacing: 8) { Text("WEEK \(edition.weekNumber) STANDINGS RECEIPT").font(.caption.weight(.black)).foregroundStyle(mirrorAccent); ForEach(Array(historicalStandings(through: edition.weekNumber).prefix(8).enumerated()), id: \.element.id) { index, bot in HStack { Text("\(index + 1). \(bot.name)").fontWeight(.black); Spacer(); Text("+\(weeklyScore(for: bot, week: edition.weekNumber)) · \(historicalTotal(for: bot, through: edition.weekNumber))").monospacedDigit() }.font(.caption) } }.padding(15).background(mirrorSecondary.opacity(0.08), in: RoundedRectangle(cornerRadius: mirrorCornerRadius)).overlay(RoundedRectangle(cornerRadius: mirrorCornerRadius).stroke(mirrorAccent.opacity(0.35)))
                NavigationLink { GazetteView(membership: membership) } label: { Label("VIEW THE MEMBER-FACING EDITION", systemImage: "newspaper.fill").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(15).foregroundStyle(isNFL ? .white : .black).background(isNFL ? Color.blue : Color.yellow, in: RoundedRectangle(cornerRadius: isNFL ? 5 : 12)) }.buttonStyle(.plain)
            } else {
                ContentUnavailableView("No Dispatch filed", systemImage: "newspaper", description: Text("Score a Foundry week first."))
            }
        }
    }

    private var keyMomentsPage: some View {
        VStack(alignment: .leading, spacing: 13) {
            MirrorHero(kicker: "FOUNDRY · SEASON MEMORY", title: "KEY MOMENTS", detail: "This is the event ledger behind the experience. Change weeks and verify that the right people, scores, rivalries, detonations, promotions, and room quotes were captured—not merely that the week advanced.", color: mirrorSignal)
            Picker("KEY MOMENTS MODE", selection: $momentMode) {
                ForEach(FoundryMomentMode.allCases) { mode in Text(mode.label).tag(mode) }
            }.pickerStyle(.segmented)
            if momentMode == .vault {
                vaultMoments
            } else if let edition = selectedEdition {
                DispatchHistoryControl(editions: editions, selectedId: $selectedDispatchId)
                HStack(spacing: 8) {
                    MirrorMetric(value: "\(edition.weekNumber)", label: "WEEK", color: mirrorAccent)
                    MirrorMetric(value: "\(moments(for: edition).count)", label: "MOMENTS", color: mirrorAccent)
                    MirrorMetric(value: moments(for: edition).isEmpty ? "MISS" : "LIVE", label: "CAPTURE", color: mirrorAccent)
                }
                Text("WEEK PLAYBACK · MOMENTS APPEAR AFTER SCORE WEEK").font(.caption2.weight(.black)).tracking(1.1).foregroundStyle(mirrorAccent)
                ForEach(moments(for: edition)) { moment in
                    keyMomentButton(moment)
                }
                if moments(for: edition).isEmpty {
                    ContentUnavailableView("No key moments captured", systemImage: "waveform.path.ecg", description: Text("This week advanced without producing a Key Moments receipt. Treat that as a Foundry failure and inspect the scoring pipeline."))
                }
            } else {
                ContentUnavailableView("No scored week yet", systemImage: "clock.badge.questionmark", description: Text("Score one Foundry week to generate the first Key Moments file."))
            }
        }
    }

    private var vaultMoments: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 8) {
                MirrorMetric(value: "\(editions.count)", label: "WEEKS", color: mirrorAccent)
                MirrorMetric(value: "\(seasonKeyMoments.count)", label: "MOMENTS", color: mirrorAccent)
                MirrorMetric(value: "TAP", label: "OPEN FILE", color: mirrorAccent)
            }
            Text("NEWEST FIRST · TAP ANY MOMENT").font(.caption2.weight(.black)).tracking(1.2).foregroundStyle(mirrorAccent)
            ForEach(seasonKeyMoments.reversed()) { moment in keyMomentButton(moment) }
            if seasonKeyMoments.isEmpty { ContentUnavailableView("Moment vault empty", systemImage: "archivebox", description: Text("Score a Foundry week to file the first moment.")) }
        }
    }

    private func keyMomentButton(_ moment: FoundryKeyMoment) -> some View {
        Button { selectedKeyMoment = moment } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: moment.icon).font(.title2).foregroundStyle(moment.color).frame(width: 42, height: 42).background(moment.color.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text("WEEK \(moment.week) · \(moment.kind)").font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(moment.color)
                    Text(moment.title.uppercased()).font(.headline.weight(.black)).multilineTextAlignment(.leading)
                    Text(moment.detail).font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.52)).lineLimit(2).multilineTextAlignment(.leading)
                }
                Spacer();Image(systemName:"arrow.up.left.and.arrow.down.right").font(.caption.weight(.black)).foregroundStyle(moment.color)
            }.padding(15).background(.white.opacity(0.055),in:RoundedRectangle(cornerRadius:14)).overlay(RoundedRectangle(cornerRadius:14).stroke(moment.color.opacity(0.28)))
        }.buttonStyle(.plain)
    }

    private var seasonKeyMoments: [FoundryKeyMoment] { editions.sorted { $0.weekNumber < $1.weekNumber }.flatMap(moments(for:)) }

    private func moments(for edition: GazetteEditionRow) -> [FoundryKeyMoment] {
        let payload=edition.payload
        var rows:[FoundryKeyMoment]=[]
        func add(_ kind:String,_ story:GazetteStory?,_ color:Color,_ icon:String) { guard let story,(story.headline?.isEmpty==false || story.deck?.isEmpty==false) else{return};rows.append(.init(id:"\(edition.id)-\(kind)",editionId:edition.id,week:edition.weekNumber,kind:kind,title:story.headline ?? story.names?.joined(separator:" vs ") ?? "MOMENT CAPTURED",detail:story.deck ?? story.pts.map{"\($0) points"} ?? "Moment receipt filed.",names:story.names ?? [],points:story.pts,color:color,icon:icon)) }
        add("CROWN",payload.crown,.yellow,"crown.fill");add("SHAME",payload.shame,.red,"hand.thumbsdown.fill");add("STANDINGS DEADLOCK",payload.standingsDeadlock,.purple,"equal.circle.fill");add("NO-LOCK INCIDENT",payload.noLock,.red,"lock.slash.fill")
        if membership.leagues.sportId.lowercased() != "nfl" {
            add("CRYSTAL BALL MISS",payload.crystalBallMiss,.cyan,"sparkles")
            add("CHAOS DETONATION",payload.chaosDetonation,.red,"radiation")
        }
        add("BIGGEST SWING",payload.swing,.green,"arrow.up.arrow.down.circle.fill");add("RIVALRY WATCH",payload.rivalryWatch,.orange,"bolt.horizontal.circle.fill")
        if let q=payload.pullQuote,let text=q.text,!text.isEmpty { rows.append(.init(id:"\(edition.id)-quote",editionId:edition.id,week:edition.weekNumber,kind:"LOCKER ROOM RECEIPT",title:q.by ?? "THE ROOM",detail:"“\(text)”",names:[q.by].compactMap{$0},points:nil,color:.orange,icon:"quote.bubble.fill")) }
        for (index,order) in (payload.promotionOrders ?? []).enumerated() { rows.append(.init(id:"\(edition.id)-promotion-\(index)",editionId:edition.id,week:edition.weekNumber,kind:"PROMOTION ORDER",title:order.name ?? "CLASSIFIED PERSONNEL",detail:"\(order.from ?? "UNKNOWN") → \(order.to ?? "UNKNOWN") · \(order.deck ?? "Promotion filed.")",names:[order.name].compactMap{$0},points:nil,color:.yellow,icon:"chevron.up.2")) }
        if let text=payload.emergencyProtocol,!text.isEmpty { rows.append(.init(id:"\(edition.id)-emergency",editionId:edition.id,week:edition.weekNumber,kind:"EMERGENCY PROTOCOL",title:"THE ROOM TRIPPED A WIRE",detail:text,names:[],points:nil,color:.red,icon:"exclamationmark.triangle.fill")) }
        return rows
    }

    private func weeklyScore(for standing: Standing, week: Int) -> Int {
        standing.weeklyPoints.indices.contains(week) ? standing.weeklyPoints[week] : 0
    }

    private func historicalTotal(for standing: Standing, through week: Int) -> Int {
        standing.weeklyPoints.prefix(max(0, week + 1)).reduce(0, +)
    }

    private func historicalStandings(through week: Int) -> [Standing] {
        bots.sorted {
            let lhs = historicalTotal(for: $0, through: week)
            let rhs = historicalTotal(for: $1, through: week)
            return lhs == rhs ? $0.name < $1.name : lhs > rhs
        }
    }

    private func pageButton(_ target: MirrorSection, _ title: String, _ detail: String, _ color: Color) -> some View {
        Button { section = target } label: { HStack { VStack(alignment: .leading, spacing: 3) { Text(title).font(.headline.weight(.black)); Text(detail).font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.45)) }; Spacer(); Image(systemName: "arrow.right.circle.fill").font(.title2).foregroundStyle(color) }.padding(15).background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(color.opacity(0.32))) }.buttonStyle(.plain)
    }

    private func previousRank(for standing: Standing) -> Int {
        let ordered = bots.sorted { lhs, rhs in
            let l = lhs.totalPoints - (lhs.weeklyPoints.last ?? 0), r = rhs.totalPoints - (rhs.weeklyPoints.last ?? 0)
            return l == r ? lhs.name < rhs.name : l > r
        }
        return (ordered.firstIndex(where: { $0.id == standing.id }) ?? 0) + 1
    }

    @MainActor private func load() async {
        guard let token = auth.token, let user = auth.user else { return }
        loading = true
        do {
            let all = try await SupabaseAPI.leagueMemberships(token: token, userId: user.id, includeFoundry: true)
            if let fresh = all.first(where: { $0.leagueId == seedMembership.leagueId }) { membership = fresh }
            lifecycle = try await SupabaseAPI.foundrySeasonLifecycle(token: token, leagueId: membership.leagueId)
            let week = membership.leagues.currentWeek
            async let s = SupabaseAPI.standings(token: token, leagueId: membership.leagueId)
            async let m = SupabaseAPI.lockerMessages(token: token, leagueId: membership.leagueId)
            async let e = SupabaseAPI.gazetteEditions(token: token, leagueId: membership.leagueId)
            async let c = SupabaseAPI.weekCard(token: token, leagueId: membership.leagueId, weekNumber: week)
            async let submitted = SupabaseAPI.weekSubmittedUserIds(token: token, leagueId: membership.leagueId, weekNumber: week)
            (standings,messages,editions,card) = try await (s,m,e,c)
            if boardDeclassified {
                picks = try await SupabaseAPI.weekBoard(token: token, leagueId: membership.leagueId, weekNumber: week)
                submittedCount = picks.count
            } else {
                let ids = try await submitted
                submittedCount = ids.count
                picks = []
            }
            if selectedDispatchId == nil || !editions.contains(where: { $0.id == selectedDispatchId }) {
                selectedDispatchId = editions.first?.id
            }
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
        loading = false
    }
}

private struct FoundryPostseasonBoardView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    @State private var rows: [FoundryCfbPostseasonStanding] = []
    @State private var slate: CfbPostseasonSlate?
    @State private var loading = true
    @State private var errorMessage: String?

    private var seasonKey: Int { Calendar.current.component(.year, from: Date()) }
    private var phase: CfbSeasonPhase {
        .phase(week: membership.leagues.currentWeek, regularSeasonWeeks: membership.leagues.regularSeasonWeeks)
    }
    private var showingCfp: Bool { phase.isCfp || phase == .seasonComplete }
    private let cfpOrder = ["r1a", "r1b", "r1c", "r1d", "q1", "q2", "q3", "q4", "s1", "s2", "final"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 13) {
                MirrorHero(
                    kicker: showingCfp ? "PLAYOFF BOARD · DECLASSIFIED" : "BOWL BOARD · DECLASSIFIED",
                    title: showingCfp ? "EVERY BRACKET. EVERY RECEIPT." : "ALL 25 BOWLS. NO HIDING.",
                    detail: "This is the actual Foundry postseason board—not a leftover regular-season card.",
                    color: showingCfp ? .cyan : .yellow
                )
                if loading { ProgressView("Recovering postseason cards…").tint(.orange).frame(maxWidth: .infinity).padding(30) }
                else if let errorMessage { Text(errorMessage).font(.footnote.weight(.bold)).foregroundStyle(.red) }
                else if rows.isEmpty {
                    MirrorImpactCard(kicker: "PICKS SEALED", title: "LOCK WEEK FIRST", detail: "Bot postseason picks do not exist—and cannot leak—until the Foundry Lock Week control is used.", color: .orange, icon: "lock.fill")
                } else {
                    HStack(spacing: 8) {
                        MirrorMetric(value: "\(rows.count)", label: "CARDS")
                        MirrorMetric(value: showingCfp ? "11" : "25", label: showingCfp ? "GAMES" : "BOWLS")
                        MirrorMetric(value: "\(rows.filter { showingCfp ? $0.cfpLocked : $0.bowlLocked }.count)", label: "LOCKED")
                    }
                    ForEach(rows) { row in
                        DisclosureGroup {
                            VStack(alignment: .leading, spacing: 7) {
                                if showingCfp {
                                    ForEach(cfpOrder, id: \.self) { gameId in
                                        postseasonPickRow(label: gameId.uppercased(), pick: row.cfpPicks[gameId] ?? "NO PICK")
                                    }
                                } else {
                                    ForEach(slate?.bowlGames.sorted(by: { $0.rank < $1.rank }) ?? []) { game in
                                        postseasonPickRow(label: game.name.uppercased(), pick: row.bowlPicks[game.id] ?? "NO PICK")
                                    }
                                }
                            }.padding(.top, 9)
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack { Text(row.displayName.uppercased()).font(.headline.weight(.black)); if row.deadHand { Image(systemName: "hand.raised.fingers.spread.fill").foregroundStyle(.red) } }
                                    Text((showingCfp ? row.cfpLocked : row.bowlLocked) ? "LOCKED RECEIPT" : "NOT LOCKED").font(.caption2.weight(.black)).foregroundStyle((showingCfp ? row.cfpLocked : row.bowlLocked) ? .green : .red)
                                }
                                Spacer()
                                Text(showingCfp ? row.cfpScore.map { "\($0) PTS" } ?? "—" : row.bowlScore.map { "\($0) PTS" } ?? "—").font(.headline.weight(.black)).foregroundStyle(.yellow)
                            }
                        }
                        .tint(.orange).padding(14).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 13))
                    }
                }
            }.padding(14).padding(.bottom, 34)
        }.refreshable { await load() }.task { await load() }
    }

    private func postseasonPickRow(label: String, pick: String) -> some View {
        HStack(alignment: .top) { Text(label).font(.caption2.weight(.black)).foregroundStyle(.white.opacity(0.42)); Spacer(); Text(pick.uppercased()).font(.caption.weight(.black)).foregroundStyle(.green).multilineTextAlignment(.trailing) }
            .padding(.vertical, 3)
    }

    @MainActor private func load() async {
        guard let token = auth.token else { loading = false; return }
        do {
            async let loadedRows = SupabaseAPI.foundryCfbPostseasonStandings(token: token, leagueId: membership.leagueId, seasonKey: seasonKey)
            async let loadedSlate = SupabaseAPI.cfbPostseasonSlate(token: token, leagueId: membership.leagueId, seasonKey: seasonKey)
            (rows, slate) = try await (loadedRows, loadedSlate)
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
        loading = false
    }
}

private enum FoundryMomentMode: String, CaseIterable, Identifiable {
    case vault, playback
    var id: String { rawValue }
    var label: String { self == .vault ? "MOMENT VAULT" : "SEASON PLAYBACK" }
}

private struct FoundryKeyMoment: Identifiable {
    let id: String
    let editionId: UUID
    let week: Int
    let kind: String
    let title: String
    let detail: String
    let names: [String]
    let points: Int?
    let color: Color
    let icon: String
}

private struct FoundryKeyMomentDetail: View {
    @Environment(\.dismiss) private var dismiss
    let moment: FoundryKeyMoment
    let openDispatch: () -> Void
    var body: some View {
        ZStack {
            LinearGradient(colors:[.black,moment.color.opacity(0.22),.black],startPoint:.topLeading,endPoint:.bottomTrailing).ignoresSafeArea()
            ScrollView { VStack(alignment:.leading,spacing:18) {
                HStack { Label("KEY MOMENT · WEEK \(moment.week)",systemImage:moment.icon).font(.caption.weight(.black)).tracking(1.5).foregroundStyle(moment.color);Spacer();Button("CLOSE"){dismiss()}.font(.caption.weight(.black)).foregroundStyle(.white.opacity(0.65)) }
                Image(systemName:moment.icon).font(.system(size:72,weight:.black)).foregroundStyle(moment.color).frame(maxWidth:.infinity).padding(.vertical,18).shadow(color:moment.color.opacity(0.55),radius:24)
                Text(moment.kind).font(.caption.weight(.black)).tracking(2).foregroundStyle(moment.color)
                Text(moment.title.uppercased()).font(.system(size:34,weight:.black)).fontWidth(.condensed)
                Text(moment.detail).font(.title3.weight(.semibold)).foregroundStyle(.white.opacity(0.72)).fixedSize(horizontal:false,vertical:true)
                if !moment.names.isEmpty { Label(moment.names.joined(separator:" · "),systemImage:"person.2.fill").font(.headline.weight(.black)).foregroundStyle(.white) }
                if let points=moment.points { Label("\(points) POINTS",systemImage:"scope").font(.headline.weight(.black)).foregroundStyle(.yellow) }
                VStack(alignment:.leading,spacing:6) { Text("GENERATION RECEIPT").font(.caption2.weight(.black)).tracking(1.3).foregroundStyle(.green);Text("Filed by the real Week \(moment.week) scoring pipeline and preserved in that week’s Dispatch payload.").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.52)) }.padding(15).background(.green.opacity(0.08),in:RoundedRectangle(cornerRadius:14)).overlay(RoundedRectangle(cornerRadius:14).stroke(.green.opacity(0.35)))
                Button { openDispatch();dismiss() } label: { Label("OPEN WEEK \(moment.week) DISPATCH RECEIPT",systemImage:"newspaper.fill").font(.headline.weight(.black)).frame(maxWidth:.infinity).padding(16).foregroundStyle(.black).background(moment.color,in:RoundedRectangle(cornerRadius:14)) }.buttonStyle(.plain)
            }.padding(20).padding(.bottom,36) }
        }.preferredColorScheme(.dark)
    }
}

private enum MirrorSection: String, CaseIterable, Identifiable {
    case home, picks, standings, locker, dispatch, moments, postseason, audit
    var id: String { rawValue }
    var label: String { self == .home ? "BOT HOME" : rawValue.uppercased() }
    var icon: String { switch self { case .home: "house.fill"; case .picks: "checkmark.seal.fill"; case .standings: "list.number"; case .locker: "bubble.left.and.bubble.right.fill"; case .dispatch: "newspaper.fill"; case .moments: "waveform.path.ecg"; case .postseason: "trophy.fill"; case .audit: "magnifyingglass" } }
}

private struct FoundrySealedWeekView: View {
    let card: WeekCard
    let lockedCount: Int
    let sportId: String
    private var isNFL: Bool { sportId.lowercased() == "nfl" }
    private var accent: Color { isNFL ? .cyan : .green }
    private var cornerRadius: CGFloat { isNFL ? 5 : 13 }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            MirrorHero(kicker: isNFL ? "GAME-DAY BLACKOUT · WEEK \(card.weekNumber)" : "PRE-KICKOFF · WEEK \(card.weekNumber)", title: "THE PICKS ARE SEALED", detail: "This is the real pre-kickoff state. The Foundry knows who submitted, but nobody—including the commissioner—gets to see a single pick.", color: accent)
            HStack(spacing: 9) {
                MirrorMetric(value: "\(lockedCount)", label: "CARDS IN", color: accent)
                MirrorMetric(value: "\(card.cardGames.count)", label: "GAMES", color: accent)
                MirrorMetric(value: "0", label: "PICKS EXPOSED", color: accent)
            }
            ForEach(card.cardGames) { game in
                VStack(alignment: .leading, spacing: 5) {
                    Text(game.isRivalry ? "🔥 CERTIFIED GRUDGE · GAME \(game.sortOrder + 1)" : "GAME \(game.sortOrder + 1)").font(.caption2.weight(.black)).tracking(1.2).foregroundStyle(game.isRivalry ? .red : accent)
                    Text("\(game.awayTeam) @ \(game.homeTeam)").font(.headline.weight(.black))
                    Text("Classified until Lock Week simulates kickoff.").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.45))
                }.padding(14).frame(maxWidth: .infinity, alignment: .leading).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: cornerRadius)).overlay(RoundedRectangle(cornerRadius: cornerRadius).stroke(game.isRivalry ? .red.opacity(0.8) : accent.opacity(0.28), lineWidth: game.isRivalry ? 2 : 1))
            }
        }
    }
}

private struct DispatchHistoryControl: View {
    let editions: [GazetteEditionRow]
    @Binding var selectedId: UUID?

    private var selectedIndex: Int { editions.firstIndex { $0.id == selectedId } ?? 0 }

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Button { move(to: selectedIndex + 1) } label: {
                    Label("OLDER", systemImage: "chevron.left").font(.caption.weight(.black))
                }.disabled(selectedIndex >= editions.count - 1)
                Spacer()
                VStack(spacing: 1) {
                    Text("DISPATCH ARCHIVE").font(.system(size: 8, weight: .black)).tracking(1.3).foregroundStyle(.yellow)
                    Text("\(editions.count) ISSUES ON FILE").font(.system(size: 7, weight: .black)).foregroundStyle(.white.opacity(0.38))
                }
                Spacer()
                Button { move(to: selectedIndex - 1) } label: {
                    Label("NEWER", systemImage: "chevron.right").labelStyle(.titleAndIcon).font(.caption.weight(.black))
                }.disabled(selectedIndex <= 0)
            }
            .foregroundStyle(.yellow)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(editions) { edition in
                        Button { withAnimation(.snappy) { selectedId = edition.id } } label: {
                            VStack(spacing: 2) {
                                Text("WEEK").font(.system(size: 7, weight: .black)).tracking(0.7)
                                Text("\(edition.weekNumber)").font(.headline.weight(.black))
                            }
                            .frame(width: 58, height: 48)
                            .foregroundStyle(selectedId == edition.id ? .black : .white.opacity(0.55))
                            .background(selectedId == edition.id ? Color.yellow : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 9))
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(.yellow.opacity(selectedId == edition.id ? 1 : 0.22)))
                        }.buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(13).background(.black.opacity(0.8), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(.yellow.opacity(0.4)))
    }

    private func move(to index: Int) {
        guard editions.indices.contains(index) else { return }
        withAnimation(.snappy) { selectedId = editions[index].id }
    }
}

private struct MirrorHero: View {
    let kicker: String; let title: String; let detail: String; let color: Color
    var body: some View { VStack(alignment: .leading, spacing: 7) { Text(kicker).font(.system(size: 8, weight: .black)).tracking(1.5).foregroundStyle(color); Text(title).font(.system(size: 29, weight: .black)).fontWidth(.condensed); Text(detail).font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.55)) }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(LinearGradient(colors: [.black,color.opacity(0.15)], startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: 17)).overlay(RoundedRectangle(cornerRadius: 17).stroke(color.opacity(0.38))) }
}

private struct MirrorMetric: View {
    let value: String; let label: String; var color: Color = .orange
    var body: some View { VStack(spacing: 3) { Text(value).font(.title2.weight(.black)).foregroundStyle(color); Text(label).font(.system(size: 7, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.42)) }.frame(maxWidth: .infinity).padding(13).background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 12)) }
}

private struct MirrorImpactCard: View {
    let kicker: String; let title: String; let detail: String; let color: Color; let icon: String
    var body: some View { HStack(alignment: .top, spacing: 12) { Image(systemName: icon).font(.title2).foregroundStyle(color).frame(width: 42, height: 42).background(color.opacity(0.12), in: Circle()); VStack(alignment: .leading, spacing: 4) { Text(kicker).font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(color); Text(title.uppercased()).font(.headline.weight(.black)); Text(detail).font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.52)) }; Spacer() }.padding(15).background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(color.opacity(0.28))) }
}

private struct FoundryPickAuditRow: View {
    let game: PickedGame
    var body: some View {
        HStack {
            Text(game.side.uppercased()).fontWeight(.black)
            Spacer()
            Text("\(game.confidence) CONF")
            if game.isBestBet { Text("BEST BET").foregroundStyle(.yellow) }
        }.font(.caption)
    }
}

private struct FoundryPanel<Content: View>: View {
    let accent: Color
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 12) { content }.padding(17).frame(maxWidth: .infinity, alignment: .leading)
            .background(.black.opacity(0.80), in: RoundedRectangle(cornerRadius: 17))
            .overlay(alignment: .leading) { Rectangle().fill(accent).frame(width: 3).padding(.vertical, 11) }
            .overlay(RoundedRectangle(cornerRadius: 17).stroke(accent.opacity(0.38)))
    }
}

private struct FoundrySectionTitle: View {
    let kicker: String
    let title: String
    var body: some View { VStack(alignment: .leading, spacing: 3) { Text(kicker).font(.system(size: 8, weight: .black)).tracking(1.5).foregroundStyle(.orange); Text(title).font(.headline.weight(.black)) } }
}

private struct NflFoundrySectionTitle: View {
    let kicker: String
    let title: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(kicker).font(.system(size: 8, weight: .black)).tracking(1.55).foregroundStyle(.cyan)
            Text(title).font(.headline.weight(.black)).foregroundStyle(.white)
        }
        .overlay(alignment: .leading) { Rectangle().fill(.red).frame(width: 20, height: 2).offset(y: 22) }
    }
}

private struct FoundryCheck: View {
    let label: String
    let value: String
    let color: Color
    var body: some View {
        HStack(spacing: 9) { Image(systemName: "circle.fill").font(.system(size: 7)).foregroundStyle(color); Text(label).font(.subheadline.weight(.semibold)); Spacer(); Text(value).font(.system(size: 8, weight: .black)).tracking(0.7).foregroundStyle(color) }
    }
}

private struct FoundryBackdrop: View {
    let sportId: String?
    private var accent: Color { sportId == "nfl" ? .cyan : .orange }
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if sportId == "nfl" {
                LinearGradient(colors: [Color(red: 0.01, green: 0.06, blue: 0.16), .black, Color(red: 0.14, green: 0.008, blue: 0.03)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
                GeometryReader { proxy in
                    Path { path in
                        let center = proxy.size.width / 2
                        path.move(to: CGPoint(x: center, y: 0)); path.addLine(to: CGPoint(x: center, y: proxy.size.height))
                        for y in stride(from: 45.0, through: proxy.size.height, by: 92.0) {
                            path.move(to: CGPoint(x: center - 11, y: y)); path.addLine(to: CGPoint(x: center + 11, y: y))
                        }
                    }.stroke(.white.opacity(0.055), lineWidth: 1)
                }
                RadialGradient(colors: [.blue.opacity(0.22), .clear], center: .topLeading, startRadius: 0, endRadius: 340).ignoresSafeArea()
                RadialGradient(colors: [.red.opacity(0.18), .clear], center: .topTrailing, startRadius: 0, endRadius: 360).ignoresSafeArea()
            } else {
                LinearGradient(colors: [accent.opacity(0.12), .black, Color(red: 0.04, green: 0.07, blue: 0.09)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
                ForEach(0..<10, id: \.self) { line in Rectangle().fill(accent.opacity(0.025)).frame(height: 1).rotationEffect(.degrees(-18)).offset(y: CGFloat(line * 90 - 410)) }
            }
        }
    }
}
