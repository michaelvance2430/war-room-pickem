import SwiftUI
import UIKit

struct GazetteView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    @State private var editions: [GazetteEditionRow] = []
    @State private var selectedId: UUID?
    @State private var page = 0
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var discoveryMessage: String?

    private var selected: GazetteEditionRow? {
        editions.first { $0.id == selectedId } ?? editions.first
    }
    private var isNFL: Bool { membership.leagues.sportId.lowercased() == "nfl" }

    var body: some View {
        ZStack {
            LinearGradient(colors: membership.leagues.sportId.lowercased() == "nfl" ? [.black, Color(red: 0.02, green: 0.09, blue: 0.20), .black] : [.black, Color(red: 0.16, green: 0.015, blue: 0.01), .black], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            if loading {
                ProgressView("Opening the press room…").tint(.red)
            } else if let edition = selected {
                GeometryReader { geometry in
                    ScrollView {
                        VStack(spacing: 12) {
                            editionPicker
                            if membership.leagues.mode == "foundry" && membership.leagues.sportId.lowercased() == "cfb" && edition.weekNumber == 1 {
                                CinematicDispatchConceptView(page: $page)
                            } else {
                                GazettePaperView(
                                    edition: edition,
                                    leagueId: membership.leagueId,
                                    sportId: membership.leagues.sportId,
                                    regularSeasonWeeks: membership.leagues.regularSeasonWeeks,
                                    page: $page
                                )
                            }
                        }
                        .frame(width: max(0, geometry.size.width - 20))
                        .padding(.horizontal, 10).padding(.bottom, 28)
                    }
                }
            } else {
                GazetteEmptyState(league: membership.leagues, errorMessage: errorMessage)
            }
            if EasterEggEngine.mascotLocation() == .gazetteMargin {
                WarRoomScoutSighting(location: .gazetteMargin).zIndex(5)
            }
        }
        .navigationTitle("The Dispatch")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .onChange(of: selectedId) { _, _ in Task { await recordSelectedSecrets() } }
        .alert("THE PAPER NOTICED", isPresented: Binding(get: { discoveryMessage != nil }, set: { if !$0 { discoveryMessage = nil } })) {
            Button("FILE IT") { discoveryMessage = nil }
        } message: { Text(discoveryMessage ?? "") }
    }

    private var editionPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(editions) { edition in
                    Button {
                        selectedId = edition.id
                        page = 0
                    } label: {
                        Text(edition.weekLabel.isEmpty ? "WEEK \(edition.weekNumber)" : edition.weekLabel.uppercased())
                            .font(.caption2.weight(.black)).padding(.horizontal, 12).frame(height: 36)
                            .foregroundStyle(selected?.id == edition.id ? (isNFL ? .white : .black) : .white)
                            .background(selected?.id == edition.id ? (isNFL ? Color.blue : Color.yellow) : .white.opacity(0.08), in: Capsule())
                    }
                }
            }
        }
    }

    private func load() async {
        guard let token = auth.token else { return }
        do {
            editions = try await SupabaseAPI.gazetteEditions(token: token, leagueId: membership.leagueId)
            selectedId = editions.first?.id
            errorMessage = nil
            await recordSelectedSecrets()
        } catch { errorMessage = error.localizedDescription }
        loading = false
    }

    private func recordSelectedSecrets() async {
        guard let token = auth.token, let user = auth.user, let edition = selected else { return }
        if EasterEggEngine.rareGazetteLine(leagueId: membership.leagueId, week: edition.weekNumber) != nil,
           let result = try? await SupabaseAPI.recordEasterEggFind(token: token, discoveryId: "egg_hidden_headline"), result.newFind == true {
            discoveryMessage = "You caught a Dispatch headline that should not exist. Ink Stain secured."
        }
        if EasterEggEngine.collectGazetteWeek(edition.weekNumber, userId: user.id),
           let result = try? await SupabaseAPI.recordEasterEggFind(token: token, discoveryId: "egg_never_give_up"), result.newFind == true {
            discoveryMessage = "The quiet letters finally said it: NEVER GIVE UP."
        }
    }
}

private struct CinematicDispatchConceptView: View {
    @Binding var page: Int
    @State private var sharing = false
    private let pages = [
        ("DispatchCoverConcept", "COVER"),
        ("DispatchDamageConcept", "DAMAGE"),
        ("DispatchBeefConcept", "BEEF"),
        ("DispatchAwardsConcept", "SCHWAG")
    ]

    private var shareImages: [UIImage] { pages.compactMap { UIImage(named: $0.0) } }

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 6) {
                ForEach(pages.indices, id: \.self) { index in
                    Button { withAnimation(.snappy) { page = index } } label: {
                        VStack(spacing: 2) {
                            Text("0\(index + 1)").font(.system(size: 7, weight: .black))
                            Text(pages[index].1).font(.system(size: 8, weight: .black))
                        }
                        .frame(maxWidth: .infinity).frame(height: 40)
                        .foregroundStyle(page == index ? .black : .white.opacity(0.55))
                        .background(page == index ? Color.yellow : .white.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
                    }.buttonStyle(.plain)
                }
            }

            Image(pages[min(max(page, 0), pages.count - 1)].0)
                .resizable().scaledToFit()
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.red, lineWidth: 2))
                .shadow(color: .red.opacity(0.5), radius: 20)
                .id(page)
                .transition(.opacity.combined(with: .scale(scale: 0.985)))

            Button { sharing = true } label: {
                Label("SHARE ALL 4 PAGES", systemImage: "square.and.arrow.up.fill")
                    .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(15)
                    .foregroundStyle(.black).background(.yellow, in: RoundedRectangle(cornerRadius: 12))
            }.buttonStyle(.plain)

            Text("INSTAGRAM / FACEBOOK · 4:5 CAROUSEL · FULL RESOLUTION")
                .font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(.white.opacity(0.42))
        }
        .sheet(isPresented: $sharing) { DispatchActivityView(items: shareImages) }
    }
}

private struct DispatchActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

private struct GazettePaperView: View {
    let edition: GazetteEditionRow
    let leagueId: UUID
    let sportId: String
    let regularSeasonWeeks: Int
    @Binding var page: Int
    private let pageNames = ["FRONT", "SPORTS", "RIVALRIES", "BACK"]
    private var payload: GazettePayload { edition.payload }
    private let ink = Color.white
    private let paper = Color(red: 0.035, green: 0.03, blue: 0.025)
    private var storySeed: Int { abs(edition.weekNumber) % 6 }
    private var identity: SportIdentity { SportIdentity(sportId) }
    private var dispatchAccent: Color { identity.isNFL ? .cyan : .yellow }
    private var movementAccent: Color { identity.isNFL ? .blue : .green }
    private var incidentAccent: Color { identity.isNFL ? .red : .orange }
    private var operationName: String { ["OPERATION BROKEN COMPASS", "THE \(identity.gameDay) MASSACRE", "PROJECT FALSE CONFIDENCE", "THE GREAT COLLAPSE", "OPERATION BAD BEAT", "THE AUDACITY FILES"][storySeed] }
    private var victoryDeck: String { [
        "A \(blastRadius)-point blast radius separated first place from the wreckage. League officials have advised everyone else to avoid eye contact.",
        "The crown changed hands under suspiciously competent circumstances. A \(blastRadius)-point crater is all that remains of the opposition.",
        "Witnesses report \(crownName) arrived with answers, confidence, and the deeply irritating receipts to prove both.",
        "The standings have been secured as a crime scene after \(crownName) escaped the week by \(blastRadius) points.",
        "Experts called it unsustainable. \(crownName) called it first place and declined further questions.",
        "A tactical masterclass or a statistical accident? The crown does not care. Neither does \(crownName)."
    ][storySeed] }
    private var shameDeck: String { [
        "Investigators recovered a pick card, several excuses, and absolutely no evidence of a functioning \(identity.gameDay.capitalized) plan.",
        "The card has been placed in a lead-lined evidence bag. Family members have been notified.",
        "Analysts replayed the decisions frame by frame and have requested hazard pay.",
        "Officials initially suspected sabotage. They have since confirmed the picks were made voluntarily.",
        "The score was technically legal, though several states are reviewing the footage.",
        "A rescue team reached the bottom of the standings and found \(shameName) already decorating."
    ][storySeed] }
    private var rivalryDeck: String { [
        "The league requested calm. The Dispatch rejected that request and enlarged the screenshots.",
        "Diplomats have left the group chat. Screenshots are being preserved for sentencing.",
        "Neither camp will apologize, which is excellent news for circulation.",
        "The ceasefire lasted eleven minutes and ended with a reaction emoji.",
        "Sources describe the situation as personal, unnecessary, and therefore perfect.",
        "Peace talks collapsed when somebody brought up last season again."
    ][storySeed] }
    private var rareLine: EasterEggEngine.RareGazetteLine? { EasterEggEngine.rareGazetteLine(leagueId: leagueId, week: edition.weekNumber) }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                Text("WEEKLY THREAT ASSESSMENT")
                Spacer()
                Text("DEFCON \(max(1, 5 - min(4, edition.weekNumber)))")
            }
            .font(.system(size: 9, weight: .black)).tracking(1.5).foregroundStyle(.black)
            .padding(.horizontal, 12).frame(height: 34).background(identity.isNFL ? Color.cyan : Color.yellow)

            VStack(spacing: 6) {
                Text("⚠  \(operationName) · INTERCEPTED · WEAPONIZED  ⚠").font(.system(size: 8, weight: .black)).tracking(1.05).foregroundStyle(.red)
                Text((payload.masthead ?? "THE WAR ROOM DISPATCH").replacingOccurrences(of: "GAZETTE", with: "DISPATCH"))
                    .font(.system(size: 34, weight: .black)).fontWidth(.compressed).minimumScaleFactor(0.58).lineLimit(1)
                Text((payload.tagline ?? "ALL THE NEWS THAT'S FIT TO ROAST").uppercased())
                    .font(.system(size: 8, weight: .black)).tracking(1.6).foregroundStyle(dispatchAccent)
                HStack(spacing: 5) { Rectangle(); Image(systemName: "star.fill"); Rectangle() }.frame(height: 4).foregroundStyle(.red)
                HStack {
                    Text(edition.volumeLabel.uppercased())
                    Spacer()
                    Text("NO SURVIVORS · NO RETRACTIONS")
                    Spacer()
                    Text((payload.sportId ?? "WAR ROOM").uppercased())
                }.font(.system(size: 7, weight: .black)).tracking(1)
            }
            .foregroundStyle(ink).padding(.horizontal, 12).padding(.vertical, 10)

            HStack(spacing: 3) {
                ForEach(pageNames.indices, id: \.self) { index in
                    Button { page = index } label: {
                        VStack(spacing: 1) {
                            Text("\(index + 1)").font(.system(size: 7, weight: .bold))
                            Text(pageNames[index]).font(.system(size: 8, weight: .black))
                        }.frame(maxWidth: .infinity).frame(height: 38)
                            .foregroundStyle(page == index ? .black : ink.opacity(0.55))
                            .background(page == index ? Color.red : .clear)
                    }
                }
            }
            .padding(4).background(.black).overlay(Rectangle().stroke(Color.red.opacity(0.6)))

            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("CLASSIFIED // PAGE \(page + 1) OF 4")
                    Spacer()
                    Text((payload.stampLine ?? "FINAL SCORES").uppercased())
                }.font(.system(size: 7, weight: .black)).tracking(1.4).foregroundStyle(.red)
                Text(pageTitle).font(.system(size: 29, weight: .black)).fontWidth(.compressed)
                Rectangle().fill(Color.red).frame(height: 5)
                DispatchPhotoEvidence(
                    assetName: pageArtwork,
                    caption: pageArtworkCaption,
                    week: edition.weekNumber,
                    page: page,
                    sportId: sportId
                )
                pageContent
            }
            .foregroundStyle(ink).padding(14).frame(maxWidth: .infinity, minHeight: 520, alignment: .topLeading)

            Text((payload.coverageLine ?? "COVERAGE: \(edition.weekLabel)").uppercased())
                .font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(dispatchAccent)
                .frame(maxWidth: .infinity).padding(10).background(.red.opacity(0.16)).overlay(Rectangle().stroke(Color.red.opacity(0.7)))
        }
        .background(paper)
        .overlay(Rectangle().stroke(Color.red, lineWidth: 2))
        .shadow(color: .red.opacity(0.55), radius: 22)
    }

    private var pageTitle: String {
        let titles = [
            ["THE WEEK DETONATED", "WINNERS, LOSERS & WAR CRIMES", "BEEF SURVEILLANCE", "EVIDENCE LOCKER"],
            ["CROWN UNDER INVESTIGATION", "THE CASUALTY LEDGER", "HOSTILE WITNESSES", "SEIZED PROPERTY"],
            ["CONFIDENCE WITHOUT EVIDENCE", "THE AUTOPSY REPORT", "OPEN-MIC DISASTER", "PERSONNEL ORDERS"],
            ["THE STANDINGS CRIME SCENE", "\(identity.gameDay)'S WRECKAGE", "GRIEVANCE COMMAND", "THE BLACK MARKET"],
            ["BAD BEATS & WORSE PEOPLE", "OFFICIAL DAMAGE REPORT", "THE PETTY DESK", "CLASSIFIED FINDINGS"],
            ["AUDACITY WINS AGAIN", "FAILURE, ITEMIZED", "BEEF: FULLY ESCALATED", "NO RETRACTIONS"]
        ]
        return titles[storySeed][page]
    }
    private var crownName: String { payload.crown?.names?.first?.uppercased() ?? "UNKNOWN MENACE" }
    private var shameName: String { payload.shame?.names?.first?.uppercased() ?? "UNIDENTIFIED CASUALTY" }
    private var crownPoints: Int { payload.crown?.pts ?? 0 }
    private var shamePoints: Int { payload.shame?.pts ?? 0 }
    private var blastRadius: Int { max(0, crownPoints - shamePoints) }

    private var pageArtwork: String {
        if page == 0, let announcement = phaseAnnouncement { return announcement.artwork }
        let rotations = [
            ["SituationRoomBunker", "WarRoomGeneralEpic", "NationalNightmareArtifact", "TheCloserArtifact", "LastOneStandingArtifact", "ChampionshipArtifact"],
            ["StandingsHall", "BottomBarrelRare", "ComebackKidEpic", "ConfidenceKingEpic", "SweepAdjacentRare", "CleanSheetRare"],
            ["LockerTunnel", "VillainArcEpic", "RivalryWeekRare", "SilenceRoomRare", "InsufferableCrownArtifact", "TheReceiptArtifact"],
            ["ProfileShrine", "CheevoKingRare", "BigBrassFootballArtifact", "ToiletBowlArtifact", "VillageNerdArtifact", "GoldenGutArtifact"]
        ]
        let choices = rotations[min(max(page, 0), rotations.count - 1)]
        return choices[abs(edition.weekNumber + page * 2) % choices.count]
    }

    private var pageArtworkCaption: String {
        [
            "DISPATCH PHOTOGRAPHERS ENTERED THE BLAST ZONE AFTER THE CROWN WAS SECURED.",
            "FORENSIC REVIEW OF THE WEEK'S DAMAGE. SOME DIGNITY COULD NOT BE RECOVERED.",
            "SURVEILLANCE IMAGE FROM THE BEEF DESK. DIPLOMATS WERE NOT CONSULTED.",
            "EVIDENCE SEIZED, LABELED, AND IMMEDIATELY USED FOR PUBLIC HUMILIATION."
        ][min(max(page, 0), 3)]
    }

    @ViewBuilder private var pageContent: some View {
        switch page {
        case 0:
            if let announcement = phaseAnnouncement { PhaseDispatchFrontPage(announcement: announcement) }
            else { frontPage }
        case 1: sportsPage
        case 2: rivalriesPage
        default: backPage
        }
    }

    private var phaseAnnouncement: DispatchPhaseAnnouncement? {
        if sportId.lowercased() == "nfl" {
            switch edition.weekNumber {
            case 18:
                return .init(eyebrow: "THE ROAD NARROWS", headline: "THE NFL PLAYOFFS ARE NEXT", deck: "Eighteen weeks are in the file. Fourteen teams remain. Every bracket call now carries the season.", command: "NEXT PHASE · WILD CARD WEEKEND", artwork: "StandingsHall", color: .cyan)
            case 19:
                return .init(eyebrow: "WIN OR GO HOME", headline: "WILD CARD WEEKEND", deck: "Six games open the bracket. Division winners have home turf. Everyone else has a boarding pass and a problem.", command: "CURRENT PHASE · WILD CARD", artwork: "BracketWarTable", color: .blue)
            case 20:
                return .init(eyebrow: "THE FIELD RESEEDS", headline: "DIVISIONAL ROUND", deck: "The top seeds enter. The bracket tightens. Survive this weekend and the conference title is one call away.", command: "CURRENT PHASE · DIVISIONAL", artwork: "BracketWarTable", color: .cyan)
            case 21:
                return .init(eyebrow: "TWO CONFERENCES", headline: "CHAMPIONSHIP SUNDAY", deck: "AFC and NFC hardware are on the line. Four teams enter. Two tickets leave.", command: "CURRENT PHASE · CONFERENCE CHAMPIONSHIPS", artwork: "ChampionshipArtifact", color: .red)
            case 22...:
                return .init(eyebrow: "ONE GAME LEFT", headline: "THE SUPER BOWL", deck: "The bracket has one final decision. Pick the champion. Live with the receipt forever.", command: "CURRENT PHASE · SUPER BOWL", artwork: "ChampionshipArtifact", color: .cyan)
            default: return nil
            }
        }
        if edition.weekNumber == regularSeasonWeeks {
            return .init(
                eyebrow: "THE ROAD NARROWS",
                headline: "CONFERENCE CHAMPIONSHIPS ARE COMING",
                deck: "The regular season file is closed. Titles, grudges, and postseason leverage are now concentrated into one championship weekend.",
                command: "NEXT PHASE · CONFERENCE CHAMPIONSHIP WEEK",
                artwork: "StandingsHall",
                color: .orange
            )
        }
        if edition.weekNumber == regularSeasonWeeks + 1 {
            return .init(
                eyebrow: "BOWL SELECTION PROTOCOL",
                headline: "10 DAYS UNTIL THE PLAYOFFS",
                deck: "Fifteen core bowls. Ten glorious nonsense bowls. Every point matters before the bracket becomes the only thing left alive.",
                command: "NEXT PHASE · BOWL MANIA",
                artwork: "BigBrassFootballArtifact",
                color: .yellow
            )
        }
        if edition.weekNumber >= regularSeasonWeeks + 2 {
            return .init(
                eyebrow: "NO MORE SAFE SATURDAYS",
                headline: "THE PLAYOFFS HAVE ARRIVED",
                deck: "The bracket is live. Survive, advance, and watch the room get smaller every time the whistle blows.",
                command: "CURRENT PHASE · COLLEGE FOOTBALL PLAYOFF",
                artwork: "BracketWarTable",
                color: .red
            )
        }
        return nil
    }

    private var frontPage: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("CATASTROPHIC VICTORY CONFIRMED").font(.system(size: 9, weight: .black)).tracking(1.8).foregroundStyle(dispatchAccent)
            if let emergency = payload.emergencyProtocol {
                GazetteBanner(text: "EMERGENCY PROTOCOL · \(emergency.replacingOccurrences(of: "_", with: " ").uppercased())")
            }
            if let rareLine {
                Text(rareLine.headline.uppercased()).font(.system(size: 24, weight: .black, design: .serif)).fontWidth(.condensed)
                Text(rareLine.deck).font(.system(size: 14, weight: .bold, design: .serif)).italic().foregroundStyle(dispatchAccent)
            }
            Text("\(crownName) DECLARES MARTIAL LAW")
                .font(.system(size: 34, weight: .black, design: .serif)).fontWidth(.condensed).fixedSize(horizontal: false, vertical: true)
            Text(victoryDeck)
                .font(.system(size: 16, weight: .bold, design: .serif)).italic().foregroundStyle(.white.opacity(0.76))
            DispatchScoreBomb(label: "CROWN CERTIFIED", name: payload.crown?.names?.first, points: payload.crown?.pts, color: dispatchAccent)
            Text("THE FRONT PAGE ENDS HERE. THE AUTOPSY CONTINUES IN SPORTS.")
                .font(.system(size: 8, weight: .black)).tracking(1.25).foregroundStyle(.red)
        }
    }

    private var sportsPage: some View {
        VStack(alignment: .leading, spacing: 14) {
            GazetteBanner(text: "THE NUMBERS HAVE BEEN CHECKED. FEELINGS HAVE NOT.")
            Text("OFFICIAL CASUALTY REPORT").font(.caption.weight(.black)).tracking(1.5).foregroundStyle(.red)
            Text("\(shameName) POSTED \(shamePoints) AND TRIGGERED A CONGRESSIONAL INQUIRY")
                .font(.system(size: 27, weight: .black)).fontWidth(.condensed)
            Text(shameDeck)
                .font(.body.weight(.bold)).foregroundStyle(.white.opacity(0.72))
            if let swing = payload.swing { GazetteBrief(kicker: "BIGGEST MOVER", story: swing, color: movementAccent) }
            if let ghost = payload.noLock { GazetteBrief(kicker: "MISSING PERSONS", story: ghost, color: .gray) }
            ForEach(Array((payload.sideStories ?? []).filter { ($0.kicker ?? "").uppercased().contains("DATA") }.enumerated()), id: \.offset) { _, story in
                GazetteSideBrief(story: story)
            }
        }
    }

    private var rivalriesPage: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack { Image(systemName: "scope"); Text("TARGET ACQUISITION: ACTIVE") }.font(.caption.weight(.black)).foregroundStyle(.red)
            Text("\(crownName) VS. \(shameName): DIPLOMATIC RELATIONS SUSPENDED")
                .font(.system(size: 24, weight: .black)).fontWidth(.condensed)
            Text(rivalryDeck)
                .font(.subheadline.weight(.bold)).foregroundStyle(.white.opacity(0.68))
            if let rivalry = payload.rivalryWatch { GazetteLead(story: rivalry, fallback: "THE ROOM REMAINS TOO FAR APART") }
            else { GazetteBanner(text: "RIVALRY DESK · INVESTIGATION CONTINUES") }
            if let quote = payload.pullQuote {
                Text("INTERCEPTED COMMS").font(.system(size: 8, weight: .black)).tracking(1.4).foregroundStyle(dispatchAccent)
                Text("“\(quote.text ?? "No comment.")”").font(.system(size: 21, weight: .black)).fontWidth(.condensed)
                Text("— \(quote.by ?? "UNKNOWN SOURCE") · OPEN MIC").font(.caption.weight(.black)).foregroundStyle(.red)
            }
            if let deadlock = payload.standingsDeadlock { GazetteBrief(kicker: "DEADLOCK", story: deadlock, color: incidentAccent) }
            if let weather = payload.weather {
                VStack(alignment: .leading, spacing: 5) {
                    Text((weather.kicker ?? "WAR ROOM WEATHER").uppercased()).font(.caption2.weight(.black))
                    Text(weather.body ?? "High confidence. Low dignity.").font(.system(.body, design: .serif).italic())
                }.padding(12).overlay(Rectangle().stroke(ink, lineWidth: 2))
            }
        }
    }

    private var backPage: some View {
        VStack(alignment: .leading, spacing: 15) {
            GazetteBanner(text: "PERSONNEL ORDERS · SEIZED PROPERTY · TERRIBLE OPPORTUNITIES")
            if let chaos = payload.chaosDetonation { GazetteBrief(kicker: "BUTTON PUSHED", story: chaos, color: .red) }
            if let orders = payload.promotionOrders, !orders.isEmpty {
                Text("PROMOTION ORDERS").font(.headline.weight(.black))
                ForEach(Array(orders.enumerated()), id: \.offset) { _, order in
                    Text("★ \(order.name ?? "PLAYER") · \(order.from ?? "RANK") → \(order.to ?? "RANK")\n\(order.deck ?? "Orders received.")")
                        .font(.system(.caption, design: .serif)).fontWeight(.bold)
                }
            }
            Text("BLACK MARKET / CLASSIFIEDS").font(.headline.weight(.black)).foregroundStyle(.red)
            ForEach(Array((payload.classifieds ?? ["WANTED: accountability. Last seen before kickoff."]).enumerated()), id: \.offset) { _, item in
                Text("• \(item)").font(.system(.caption, design: .serif))
            }
            Text("EDITOR'S NOTICE").font(.headline.weight(.black)).foregroundStyle(dispatchAccent)
            Text([
                "No apologies were requested, offered, or legally advisable during the production of this edition.",
                "This newspaper accepts tips, screenshots, and allegations with strong comedic upside.",
                "Corrections will be printed when the guilty parties become less guilty. Do not wait up.",
                "All subjects were given a chance to comment. Their excuses were funnier than our copy.",
                "The Dispatch regrets nothing and has retained counsel anyway.",
                "Next week's dignity forecast remains dangerously low."
            ][storySeed])
                .font(.system(.caption, design: .serif)).fontWeight(.bold)
            Text((payload.printedLine ?? edition.createdAt).uppercased()).font(.system(size: 7, weight: .bold)).tracking(0.7).foregroundStyle(ink.opacity(0.55))
            HStack {
                Spacer()
                Text(String(EasterEggEngine.gazetteSecretLetter(week: edition.weekNumber)))
                    .font(.system(size: 7, weight: .black, design: .monospaced)).foregroundStyle(ink.opacity(0.18))
            }
        }
    }
}

private struct DispatchPhaseAnnouncement {
    let eyebrow: String
    let headline: String
    let deck: String
    let command: String
    let artwork: String
    let color: Color
}

private struct PhaseDispatchFrontPage: View {
    let announcement: DispatchPhaseAnnouncement

    var body: some View {
        ZStack(alignment: .topTrailing) {
            RadialGradient(
                colors: [announcement.color.opacity(0.28), .clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 230
            )
            .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Label(announcement.eyebrow, systemImage: "bolt.fill")
                        .font(.system(size: 9, weight: .black)).tracking(1.8)
                    Spacer()
                    Text("PHASE SHIFT")
                        .font(.system(size: 7, weight: .black)).tracking(1.3)
                        .padding(.horizontal, 8).padding(.vertical, 5)
                        .overlay(Rectangle().stroke(announcement.color, lineWidth: 1))
                }
                .foregroundStyle(announcement.color)

                Text(announcement.headline)
                    .font(.system(size: 43, weight: .black, design: .serif))
                    .fontWidth(.compressed).minimumScaleFactor(0.72)
                    .fixedSize(horizontal: false, vertical: true)
                    .shadow(color: announcement.color.opacity(0.75), radius: 18)

                Rectangle()
                    .fill(LinearGradient(colors: [.clear, announcement.color, .white, announcement.color, .clear], startPoint: .leading, endPoint: .trailing))
                    .frame(height: 3)

                Text(announcement.deck)
                    .font(.system(size: 17, weight: .bold, design: .serif))
                    .italic().foregroundStyle(.white.opacity(0.80))

                HStack(spacing: 6) {
                    phaseChip("STAKES", "MAX")
                    phaseChip("ROOM", "LOCKED")
                    phaseChip("DIGNITY", "AT RISK")
                }

                HStack(spacing: 9) {
                    Image(systemName: "bolt.shield.fill")
                    Text(announcement.command)
                }
                .font(.system(size: 10, weight: .black)).tracking(1.05)
                .foregroundStyle(.black).padding(12).frame(maxWidth: .infinity)
                .background(announcement.color)
                .shadow(color: announcement.color.opacity(0.7), radius: 14)

                Text("THE DISPATCH WILL CARRY EVERY PHASE CHANGE ON PAGE ONE. IF YOU MISSED IT, THAT IS NOW A PERSONAL FAILURE.")
                    .font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(.white.opacity(0.48))
            }
        }
    }

    private func phaseChip(_ label: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(label).font(.system(size: 6, weight: .black)).tracking(1)
            Text(value).font(.system(size: 9, weight: .black))
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity).padding(.vertical, 8)
        .background(announcement.color.opacity(0.16))
        .overlay(Rectangle().stroke(announcement.color.opacity(0.75), lineWidth: 1))
    }
}

private struct DispatchPhotoEvidence: View {
    let assetName: String
    let caption: String
    let week: Int
    let page: Int
    let sportId: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(assetName)
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity)
                .frame(height: 190)
                .clipped()
                .overlay(alignment: .topLeading) {
                    Text("WEEK \(week) · FRAME 0\(page + 1) · UNREDACTED")
                        .font(.system(size: 7, weight: .black)).tracking(1)
                        .foregroundStyle(.black).padding(.horizontal, 8).padding(.vertical, 5)
                        .background(SportIdentity(sportId).isNFL ? Color.cyan : Color.yellow)
                        .padding(8)
                }
                .overlay(Rectangle().stroke(Color.white.opacity(0.7), lineWidth: 2))
                .saturation(0.82)
                .contrast(1.12)
            Text(caption)
                .font(.system(size: 8, weight: .black, design: .monospaced))
                .tracking(0.75).foregroundStyle(.white.opacity(0.58))
        }
    }
}

private struct GazetteLead: View {
    let story: GazetteStory?
    let fallback: String
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text((story?.headline ?? fallback).uppercased()).font(.system(size: 32, weight: .black, design: .serif)).fontWidth(.condensed).fixedSize(horizontal: false, vertical: true)
            if let deck = story?.deck { Text(deck).font(.system(size: 16, weight: .semibold, design: .serif)).italic() }
        }
    }
}

private struct DispatchScoreBomb: View {
    let label: String
    let name: String?
    let points: Int?
    let color: Color
    var body: some View {
        VStack(spacing: 5) {
            Text(label).font(.system(size: 8, weight: .black)).tracking(1.4).foregroundStyle(color)
            Text(name?.uppercased() ?? "UNKNOWN").font(.caption.weight(.black)).lineLimit(1).minimumScaleFactor(0.65)
            Text("\(points ?? 0)").font(.system(size: 35, weight: .black)).fontWidth(.compressed).foregroundStyle(color)
            Text("POINTS").font(.system(size: 7, weight: .black)).tracking(1.2)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 12)
        .background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(color, lineWidth: 2))
    }
}

private struct GazetteBrief: View {
    let kicker: String
    let story: GazetteStory?
    let color: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(kicker).font(.system(size: 8, weight: .black)).tracking(1.4).foregroundStyle(color)
            Text((story?.headline ?? "COPY DESK HOLD").uppercased()).font(.system(size: 20, weight: .black, design: .serif)).fontWidth(.condensed)
            if let deck = story?.deck { Text(deck).font(.system(.caption, design: .serif)) }
        }.padding(.vertical, 8).overlay(alignment: .bottom) { Rectangle().frame(height: 1).opacity(0.35) }
    }
}

private struct GazetteSideBrief: View {
    let story: GazetteSideStory
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text((story.kicker ?? "AROUND THE ROOM").uppercased()).font(.system(size: 7, weight: .black)).tracking(1.2).foregroundStyle(.red)
            Text((story.headline ?? "THE DESK IS INVESTIGATING").uppercased()).font(.system(size: 18, weight: .black, design: .serif))
            if let body = story.body { Text(body).font(.system(.caption, design: .serif)) }
        }
    }
}

private struct GazetteBanner: View {
    let text: String
    var body: some View { Text(text).font(.system(size: 9, weight: .black)).tracking(1.4).foregroundStyle(.white).frame(maxWidth: .infinity).padding(8).background(Color.red.opacity(0.82)) }
}

private struct GazetteEmptyState: View {
    let league: LeagueSummary
    let errorMessage: String?
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "newspaper.fill").font(.system(size: 48)).foregroundStyle(.red)
            Text("THE PRESSES ARE QUIET").font(.title2.weight(.black))
            Text(errorMessage ?? "No scored edition exists for \(league.name) yet. When the commissioner scores the week, the Dispatch archive will appear here.")
                .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }.padding(28)
    }
}
