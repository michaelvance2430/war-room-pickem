import SwiftUI

struct FieldhouseBracketTeam: Identifiable, Hashable, Codable {
    let id: String
    let name: String
    let seed: Int
}

struct FieldhouseOfficialTeam: Identifiable, Hashable, Codable {
    let teamID: String
    let displayName: String
    let region: String
    let seed: Int
    var id: String { teamID }
}

struct FieldhouseOfficialGame: Identifiable, Hashable, Codable {
    let gameID: String
    let roundKey: String
    let roundOrder: Int
    let ordinal: Int
    let region: String?
    let firstTeamID: String?
    let secondTeamID: String?
    let firstSourceGameID: String?
    let secondSourceGameID: String?
    let startsAt: String?
    let winnerTeamID: String?
    let firstScore: Int?
    let secondScore: Int?
    let firstMoneyline: Int?
    let secondMoneyline: Int?
    let oddsBookmaker: String?
    let oddsUpdatedAt: String?
    var id: String { gameID }

    init(
        gameID: String,
        roundKey: String,
        roundOrder: Int,
        ordinal: Int,
        region: String?,
        firstTeamID: String?,
        secondTeamID: String?,
        firstSourceGameID: String?,
        secondSourceGameID: String?,
        startsAt: String?,
        winnerTeamID: String?,
        firstScore: Int? = nil,
        secondScore: Int? = nil,
        firstMoneyline: Int? = nil,
        secondMoneyline: Int? = nil,
        oddsBookmaker: String? = nil,
        oddsUpdatedAt: String? = nil
    ) {
        self.gameID = gameID
        self.roundKey = roundKey
        self.roundOrder = roundOrder
        self.ordinal = ordinal
        self.region = region
        self.firstTeamID = firstTeamID
        self.secondTeamID = secondTeamID
        self.firstSourceGameID = firstSourceGameID
        self.secondSourceGameID = secondSourceGameID
        self.startsAt = startsAt
        self.winnerTeamID = winnerTeamID
        self.firstScore = firstScore
        self.secondScore = secondScore
        self.firstMoneyline = firstMoneyline
        self.secondMoneyline = secondMoneyline
        self.oddsBookmaker = oddsBookmaker
        self.oddsUpdatedAt = oddsUpdatedAt
    }
}

struct FieldhouseRoundEntry: Equatable, Codable {
    let roundKey: String
    let picks: [String: String]
    let submittedAt: String?
    let lockedAt: String?
    let points: Int
}

struct FieldhouseOfficialField: Equatable, Codable {
    let tournamentID: UUID
    let sportID: String
    let seasonKey: Int
    let status: String
    let firstTipAt: String?
    let teams: [FieldhouseOfficialTeam]
    let games: [FieldhouseOfficialGame]
}

extension FieldhouseOfficialField {
    static func previewRound(for league: FieldhouseLeague) -> Self {
        let names = Array(FieldhouseTeamCatalog.teams(for: league).prefix(16))
        let teams = names.enumerated().map {
            FieldhouseOfficialTeam(teamID: "preview-\($0.offset + 1)", displayName: $0.element, region: "East", seed: $0.offset + 1)
        }
        let pairs = FieldhouseBracketEngine.regionSeedPairs
        let games = pairs.enumerated().map { index, seeds in
            FieldhouseOfficialGame(
                gameID: "preview-east-r64-\(index)", roundKey: "r64", roundOrder: 1, ordinal: index,
                region: "East", firstTeamID: "preview-\(seeds.0)", secondTeamID: "preview-\(seeds.1)",
                firstSourceGameID: nil, secondSourceGameID: nil,
                startsAt: "2027-03-18T16:00:00Z", winnerTeamID: nil,
                firstMoneyline: index.isMultiple(of: 2) ? -220 : 145,
                secondMoneyline: index.isMultiple(of: 2) ? 180 : -170,
                oddsBookmaker: "DraftKings",
                oddsUpdatedAt: "2027-03-18T04:00:00Z"
            )
        }
        return .init(tournamentID: UUID(uuidString: "F13D0000-0000-4000-8000-000000000076")!, sportID: league.favoriteSportID, seasonKey: 2027, status: "published", firstTipAt: "2027-03-18T16:00:00Z", teams: teams, games: games)
    }
}

struct FieldhouseBracketMatchup: Identifiable, Equatable {
    let id: String
    let label: String
    let first: FieldhouseBracketTeam?
    let second: FieldhouseBracketTeam?

    var isReady: Bool { first != nil && second != nil }
    var teams: [FieldhouseBracketTeam] { [first, second].compactMap { $0 } }
}

enum FieldhouseBracketSection: Hashable, Identifiable {
    case buyIn
    case region(FieldhouseRegion)
    case finalFour

    var id: String {
        switch self {
        case .buyIn: "buy-in"
        case .region(let region): "region-\(region.rawValue.lowercased())"
        case .finalFour: "final-four"
        }
    }

    var title: String {
        switch self {
        case .buyIn: "BUY-IN"
        case .region(let region): region.rawValue
        case .finalFour: "FINAL FOUR"
        }
    }
}

enum FieldhouseBracketEngine {
    static let regionSeedPairs = [(1, 16), (8, 9), (5, 12), (4, 13), (6, 11), (3, 14), (7, 10), (2, 15)]
    private static let playInSeeds = [16, 11, 12]

    static var allDecisionIDs: [String] {
        openingGames().map(\.id)
        + FieldhouseRegion.allCases.flatMap { region in
            (0..<8).map { regionKey(region, "r64", $0) }
            + (0..<4).map { regionKey(region, "r32", $0) }
            + (0..<2).map { regionKey(region, "s16", $0) }
            + [regionKey(region, "e8", 0)]
        }
        + ["national.ff.0", "national.ff.1", "national.title.0"]
    }

    static func decisionIDs(field: FieldhouseOfficialField?) -> [String] {
        field?.games.sorted { ($0.roundOrder, $0.ordinal) < ($1.roundOrder, $1.ordinal) }.map(\.gameID) ?? allDecisionIDs
    }

    static let orderedRoundKeys = ["opening", "r64", "r32", "s16", "e8", "ff", "title"]

    static func roundTitle(_ key: String) -> String {
        switch key {
        case "opening": "OPENING ROUND"
        case "r64": "FIRST ROUND"
        case "r32": "SECOND ROUND"
        case "s16": "SWEET 16"
        case "e8": "ELITE EIGHT"
        case "ff": "FINAL FOUR"
        case "title": "NATIONAL CHAMPIONSHIP"
        default: key.uppercased()
        }
    }

    static func liveRoundKey(field: FieldhouseOfficialField, now: Date = Date()) -> String? {
        let formatter = ISO8601DateFormatter()
        for key in orderedRoundKeys {
            let games = field.games.filter { $0.roundKey == key }
            guard !games.isEmpty, games.contains(where: { $0.winnerTeamID == nil }) else { continue }
            let participantsReady = games.allSatisfy { game in
                resolveParticipant(game.firstTeamID, source: game.firstSourceGameID, field: field) != nil &&
                resolveParticipant(game.secondTeamID, source: game.secondSourceGameID, field: field) != nil
            }
            guard participantsReady else { continue }
            let tips = games.compactMap { $0.startsAt.flatMap(formatter.date(from:)) }
            if tips.isEmpty || now < (tips.min() ?? now) { return key }
            return key
        }
        return nil
    }

    static func roundMatchups(key: String, field: FieldhouseOfficialField) -> [FieldhouseBracketMatchup] {
        field.games.filter { $0.roundKey == key }.sorted { $0.ordinal < $1.ordinal }.map {
            officialRoundMatchup($0, field: field)
        }
    }

    private static func resolveParticipant(_ teamID: String?, source: String?, field: FieldhouseOfficialField) -> String? {
        teamID ?? source.flatMap { sourceID in field.games.first(where: { $0.gameID == sourceID })?.winnerTeamID }
    }

    private static func officialRoundMatchup(_ game: FieldhouseOfficialGame, field: FieldhouseOfficialField) -> FieldhouseBracketMatchup {
        func team(_ id: String?) -> FieldhouseBracketTeam? {
            guard let id, let value = field.teams.first(where: { $0.teamID == id }) else { return nil }
            return .init(id: id, name: value.displayName, seed: value.seed)
        }
        return .init(
            id: game.gameID,
            label: [game.region?.uppercased(), "GAME \(game.ordinal + 1)"].compactMap { $0 }.joined(separator: " · "),
            first: team(resolveParticipant(game.firstTeamID, source: game.firstSourceGameID, field: field)),
            second: team(resolveParticipant(game.secondTeamID, source: game.secondSourceGameID, field: field))
        )
    }

    static func openingGames(league: FieldhouseLeague = .ncaam) -> [FieldhouseBracketMatchup] {
        let catalog = Array(FieldhouseTeamCatalog.teams(for: league).dropFirst(64).prefix(24))
        return (0..<12).map { index in
            let region = FieldhouseRegion.allCases[index / 3]
            let seed = playInSeeds[index % 3]
            let firstName = catalog.indices.contains(index * 2) ? catalog[index * 2] : "Opening Team \(index * 2 + 1)"
            let secondName = catalog.indices.contains(index * 2 + 1) ? catalog[index * 2 + 1] : "Opening Team \(index * 2 + 2)"
            return FieldhouseBracketMatchup(
                id: openingKey(region, seed),
                label: "\(region.rawValue) · \(seed) SEED",
                first: team(firstName, seed: seed),
                second: team(secondName, seed: seed)
            )
        }
    }

    static func matchups(
        for section: FieldhouseBracketSection,
        league: FieldhouseLeague,
        picks: [String: String],
        field: FieldhouseOfficialField? = nil
    ) -> [(round: String, games: [FieldhouseBracketMatchup])] {
        if let field { return officialMatchups(for: section, field: field, picks: picks) }
        switch section {
        case .buyIn:
            return [("OPENING ROUND · 12 GAMES", openingGames(league: league))]
        case .region(let region):
            return [
                ("FIRST ROUND · 8 GAMES", regionalRound64(region: region, league: league, picks: picks)),
                ("SECOND ROUND · 4 GAMES", derivedRound(region: region, round: "r32", source: "r64", count: 4, picks: picks)),
                ("SWEET 16 · 2 GAMES", derivedRound(region: region, round: "s16", source: "r32", count: 2, picks: picks)),
                ("ELITE EIGHT · REGIONAL FINAL", derivedRound(region: region, round: "e8", source: "s16", count: 1, picks: picks))
            ]
        case .finalFour:
            return [
                ("NATIONAL SEMIFINALS", finalFour(picks: picks)),
                ("NATIONAL CHAMPIONSHIP", [titleGame(picks: picks)])
            ]
        }
    }

    static func progress(picks: [String: String], league: FieldhouseLeague, field: FieldhouseOfficialField? = nil) -> Int {
        if let field { return officialPruned(picks: picks, field: field).count }
        return pruned(picks: picks, league: league).count
    }

    static func choose(_ team: FieldhouseBracketTeam, in matchup: FieldhouseBracketMatchup, picks: inout [String: String], league: FieldhouseLeague, field: FieldhouseOfficialField? = nil) {
        guard matchup.teams.contains(team) else { return }
        picks[matchup.id] = team.id
        picks = field.map { officialPruned(picks: picks, field: $0) } ?? pruned(picks: picks, league: league)
    }

    static func pruned(picks: [String: String], league: FieldhouseLeague) -> [String: String] {
        var valid: [String: String] = [:]
        for game in openingGames(league: league) { retain(game, from: picks, into: &valid) }
        for region in FieldhouseRegion.allCases {
            for game in regionalRound64(region: region, league: league, picks: valid) { retain(game, from: picks, into: &valid) }
            for game in derivedRound(region: region, round: "r32", source: "r64", count: 4, picks: valid) { retain(game, from: picks, into: &valid) }
            for game in derivedRound(region: region, round: "s16", source: "r32", count: 2, picks: valid) { retain(game, from: picks, into: &valid) }
            for game in derivedRound(region: region, round: "e8", source: "s16", count: 1, picks: valid) { retain(game, from: picks, into: &valid) }
        }
        for game in finalFour(picks: valid) { retain(game, from: picks, into: &valid) }
        retain(titleGame(picks: valid), from: picks, into: &valid)
        return valid
    }

    static func hellfirePicks(league: FieldhouseLeague, field: FieldhouseOfficialField? = nil) -> [String: String] {
        if let field {
            var picks: [String: String] = [:]
            for game in field.games.sorted(by: { ($0.roundOrder, $0.ordinal) < ($1.roundOrder, $1.ordinal) }) {
                let matchup = officialMatchup(game, field: field, picks: picks)
                if let team = matchup.teams.max(by: { $0.seed < $1.seed }) { picks[game.gameID] = team.id }
            }
            return officialPruned(picks: picks, field: field)
        }
        var picks: [String: String] = [:]
        for game in openingGames(league: league) { if let team = game.teams.last { choose(team, in: game, picks: &picks, league: league) } }
        for region in FieldhouseRegion.allCases {
            for game in regionalRound64(region: region, league: league, picks: picks) { if let team = game.teams.max(by: { $0.seed < $1.seed }) { choose(team, in: game, picks: &picks, league: league) } }
            for game in derivedRound(region: region, round: "r32", source: "r64", count: 4, picks: picks) { if let team = game.teams.max(by: { $0.seed < $1.seed }) { choose(team, in: game, picks: &picks, league: league) } }
            for game in derivedRound(region: region, round: "s16", source: "r32", count: 2, picks: picks) { if let team = game.teams.max(by: { $0.seed < $1.seed }) { choose(team, in: game, picks: &picks, league: league) } }
            for game in derivedRound(region: region, round: "e8", source: "s16", count: 1, picks: picks) { if let team = game.teams.max(by: { $0.seed < $1.seed }) { choose(team, in: game, picks: &picks, league: league) } }
        }
        for game in finalFour(picks: picks) { if let team = game.teams.max(by: { $0.seed < $1.seed }) { choose(team, in: game, picks: &picks, league: league) } }
        let title = titleGame(picks: picks)
        if let team = title.teams.max(by: { $0.seed < $1.seed }) { choose(team, in: title, picks: &picks, league: league) }
        return picks
    }

    static func regionalChampion(_ region: FieldhouseRegion, picks: [String: String], league: FieldhouseLeague, field: FieldhouseOfficialField? = nil) -> FieldhouseBracketTeam? {
        if let field, let game = field.games.first(where: { $0.roundKey == "e8" && $0.region == region.rawValue }) {
            return selectedTeam(in: officialMatchup(game, field: field, picks: picks), picks: picks)
        }
        let game = derivedRound(region: region, round: "e8", source: "s16", count: 1, picks: picks)[0]
        return selectedTeam(in: game, picks: picks)
    }

    static func nationalChampion(picks: [String: String], field: FieldhouseOfficialField? = nil) -> FieldhouseBracketTeam? {
        if let field, let game = field.games.first(where: { $0.roundKey == "title" }) {
            return selectedTeam(in: officialMatchup(game, field: field, picks: picks), picks: picks)
        }
        return selectedTeam(in: titleGame(picks: picks), picks: picks)
    }

    private static func officialMatchups(for section: FieldhouseBracketSection, field: FieldhouseOfficialField, picks: [String: String]) -> [(round: String, games: [FieldhouseBracketMatchup])] {
        let keys: [(String, String)]
        switch section {
        case .buyIn: keys = [("opening", "OPENING ROUND · 12 GAMES")]
        case .region: keys = [("r64", "FIRST ROUND · 8 GAMES"), ("r32", "SECOND ROUND · 4 GAMES"), ("s16", "SWEET 16 · 2 GAMES"), ("e8", "ELITE EIGHT · REGIONAL FINAL")]
        case .finalFour: keys = [("ff", "NATIONAL SEMIFINALS"), ("title", "NATIONAL CHAMPIONSHIP")]
        }
        return keys.map { key, title in
            let games = field.games.filter { game in
                guard game.roundKey == key else { return false }
                if case .region(let region) = section { return game.region == region.rawValue }
                return true
            }.sorted { $0.ordinal < $1.ordinal }.map { officialMatchup($0, field: field, picks: picks) }
            return (title, games)
        }
    }

    private static func officialMatchup(_ game: FieldhouseOfficialGame, field: FieldhouseOfficialField, picks: [String: String]) -> FieldhouseBracketMatchup {
        func participant(teamID: String?, sourceID: String?) -> FieldhouseBracketTeam? {
            let resolved = teamID ?? sourceID.flatMap { picks[$0] }
            guard let resolved, let team = field.teams.first(where: { $0.teamID == resolved }) else { return nil }
            return FieldhouseBracketTeam(id: team.teamID, name: team.displayName, seed: team.seed)
        }
        return FieldhouseBracketMatchup(
            id: game.gameID,
            label: [game.region?.uppercased(), "GAME \(game.ordinal + 1)"].compactMap { $0 }.joined(separator: " · "),
            first: participant(teamID: game.firstTeamID, sourceID: game.firstSourceGameID),
            second: participant(teamID: game.secondTeamID, sourceID: game.secondSourceGameID)
        )
    }

    private static func officialPruned(picks: [String: String], field: FieldhouseOfficialField) -> [String: String] {
        var valid: [String: String] = [:]
        for game in field.games.sorted(by: { ($0.roundOrder, $0.ordinal) < ($1.roundOrder, $1.ordinal) }) {
            retain(officialMatchup(game, field: field, picks: valid), from: picks, into: &valid)
        }
        return valid
    }

    private static func regionalRound64(region: FieldhouseRegion, league: FieldhouseLeague, picks: [String: String]) -> [FieldhouseBracketMatchup] {
        let catalog = FieldhouseTeamCatalog.teams(for: league)
        let regionIndex = FieldhouseRegion.allCases.firstIndex(of: region) ?? 0
        let names = Array(catalog.dropFirst(regionIndex * 16).prefix(16))
        return regionSeedPairs.enumerated().map { index, seeds in
            FieldhouseBracketMatchup(
                id: regionKey(region, "r64", index),
                label: "\(region.rawValue) · GAME \(index + 1)",
                first: seedTeam(region: region, seed: seeds.0, names: names, picks: picks, league: league),
                second: seedTeam(region: region, seed: seeds.1, names: names, picks: picks, league: league)
            )
        }
    }

    private static func seedTeam(region: FieldhouseRegion, seed: Int, names: [String], picks: [String: String], league: FieldhouseLeague) -> FieldhouseBracketTeam? {
        if playInSeeds.contains(seed) {
            let key = openingKey(region, seed)
            return openingGames(league: league).first(where: { $0.id == key })?.teams.first(where: { $0.id == picks[key] })
        }
        let name = names.indices.contains(seed - 1) ? names[seed - 1] : "\(region.rawValue.capitalized) Seed \(seed)"
        return team(name, seed: seed)
    }

    private static func derivedRound(region: FieldhouseRegion, round: String, source: String, count: Int, picks: [String: String]) -> [FieldhouseBracketMatchup] {
        (0..<count).map { index in
            FieldhouseBracketMatchup(
                id: regionKey(region, round, index),
                label: "\(region.rawValue) · GAME \(index + 1)",
                first: winner(of: regionKey(region, source, index * 2), picks: picks),
                second: winner(of: regionKey(region, source, index * 2 + 1), picks: picks)
            )
        }
    }

    private static func finalFour(picks: [String: String]) -> [FieldhouseBracketMatchup] {
        [
            FieldhouseBracketMatchup(id: "national.ff.0", label: "EAST vs WEST", first: winner(of: regionKey(.east, "e8", 0), picks: picks), second: winner(of: regionKey(.west, "e8", 0), picks: picks)),
            FieldhouseBracketMatchup(id: "national.ff.1", label: "SOUTH vs MIDWEST", first: winner(of: regionKey(.south, "e8", 0), picks: picks), second: winner(of: regionKey(.midwest, "e8", 0), picks: picks))
        ]
    }

    private static func titleGame(picks: [String: String]) -> FieldhouseBracketMatchup {
        FieldhouseBracketMatchup(id: "national.title.0", label: "ONE SHINING DECISION", first: winner(of: "national.ff.0", picks: picks), second: winner(of: "national.ff.1", picks: picks))
    }

    private static func selectedTeam(in game: FieldhouseBracketMatchup, picks: [String: String]) -> FieldhouseBracketTeam? {
        game.teams.first(where: { $0.id == picks[game.id] })
    }

    private static func winner(of key: String, picks: [String: String]) -> FieldhouseBracketTeam? {
        guard let id = picks[key] else { return nil }
        let seed = Int(id.split(separator: "|").first ?? "0") ?? 0
        let name = id.split(separator: "|", maxSplits: 1).dropFirst().first.map(String.init) ?? id
        return FieldhouseBracketTeam(id: id, name: name, seed: seed)
    }

    private static func retain(_ game: FieldhouseBracketMatchup, from source: [String: String], into target: inout [String: String]) {
        guard let choice = source[game.id], game.teams.contains(where: { $0.id == choice }) else { return }
        target[game.id] = choice
    }

    private static func team(_ name: String, seed: Int) -> FieldhouseBracketTeam {
        FieldhouseBracketTeam(id: "\(seed)|\(name)", name: name, seed: seed)
    }

    private static func openingKey(_ region: FieldhouseRegion, _ seed: Int) -> String { "opening.\(region.rawValue.lowercased()).\(seed)" }
    private static func regionKey(_ region: FieldhouseRegion, _ round: String, _ index: Int) -> String { "region.\(region.rawValue.lowercased()).\(round).\(index)" }
}

struct FieldhouseBracketPickerView: View {
    let league: FieldhouseLeague
    let officialField: FieldhouseOfficialField?
    @Binding var picks: [String: String]
    @Binding var submitted: Bool
    let locked: Bool
    let hellfireUsed: Bool
    let save: () -> Void
    let close: () -> Void

    @State private var section: FieldhouseBracketSection = .buyIn
    @State private var showingReview = false
    @State private var showingSubmitConfirmation = false

    private var accent: Color { FieldhouseTheme.accent(for: league) }
    private var progress: Int { FieldhouseBracketEngine.progress(picks: picks, league: league, field: officialField) }

    var body: some View {
        VStack(spacing: 0) {
            pinnedHeader
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 13) {
                        sectionRail(position: "top")
                            .id("bracket-section-top")
                        sectionIntro
                        ForEach(FieldhouseBracketEngine.matchups(for: section, league: league, picks: picks, field: officialField), id: \.round) { group in
                            VStack(alignment: .leading, spacing: 10) {
                                Text(group.round).font(.caption.weight(.black)).tracking(1.5).foregroundStyle(accent)
                                ForEach(group.games) { matchup in matchupCard(matchup) }
                            }
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            Text("MOVE THROUGH THE BRACKET")
                                .font(.system(size: 9, weight: .black))
                                .tracking(1.5)
                                .foregroundStyle(.white.opacity(0.52))
                            sectionRail(position: "bottom")
                        }
                        .padding(.top, 4)
                        Button { showingReview = true } label: {
                            Label(progress == 75 ? "REVIEW COMPLETED BRACKET" : "REVIEW · \(75 - progress) PICKS REMAIN", systemImage: "checklist")
                                .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16)
                                .foregroundStyle(progress == 75 ? .black : .white)
                                .background(progress == 75 ? accent : Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                        }.buttonStyle(.plain)
                    }.padding(14).padding(.bottom, 28)
                }
                .onChange(of: section) { _, _ in
                    withAnimation(.easeOut(duration: 0.24)) {
                        proxy.scrollTo("bracket-section-top", anchor: .top)
                    }
                }
            }
        }
        .background(Color.black.opacity(0.34))
        .sheet(isPresented: $showingReview) { reviewSheet }
        .alert("File this bracket?", isPresented: $showingSubmitConfirmation) {
            Button("CANCEL", role: .cancel) {}
            Button("CONFIRM BRACKET") { submitted = true; showingReview = false; save() }
        } message: {
            Text("Your 75 decisions will be recorded. You may reopen and edit them until the first Buy-In game tips. Bracket Hellfire is the only path that locks immediately.")
        }
    }

    private var pinnedHeader: some View {
        VStack(spacing: 9) {
            HStack {
                Button(action: close) { Image(systemName: "chevron.left").font(.headline.weight(.black)).frame(width: 38, height: 38).background(.white.opacity(0.10), in: Circle()) }.buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 2) {
                    Text("MY 76-TEAM BRACKET").font(.system(size: 9, weight: .black)).tracking(1.6).foregroundStyle(accent)
                    Text(locked ? "PERMANENTLY LOCKED" : submitted ? "FILED · EDITABLE UNTIL TIP" : "BUILD THE ROAD TO CENTER COURT").font(.caption.weight(.black))
                }
                Spacer()
                Text("\(progress)/75").font(.title2.weight(.black)).monospacedDigit().foregroundStyle(progress == 75 ? .green : accent)
            }
            ProgressView(value: Double(progress), total: 75).tint(progress == 75 ? .green : accent)
        }
        .padding(.horizontal, 14).padding(.vertical, 11)
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) { Rectangle().fill(accent.opacity(0.55)).frame(height: 1) }
        .zIndex(10)
    }

    private func sectionRail(position: String) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach([FieldhouseBracketSection.buyIn] + FieldhouseRegion.allCases.map(FieldhouseBracketSection.region) + [.finalFour]) { item in
                    Button { section = item } label: {
                        HStack(spacing: 5) {
                            Image(systemName: isComplete(item) ? "checkmark.circle.fill" : "circle.fill")
                            Text(item.title)
                        }
                        .font(.system(size: 9, weight: .black))
                        .tracking(0.6)
                        .padding(.horizontal, 12).padding(.vertical, 10)
                        .foregroundStyle(.white)
                        .background(sectionColor(item), in: Capsule())
                        .overlay {
                            if section == item {
                                Capsule().stroke(.white.opacity(0.92), lineWidth: 2)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("fieldhouse.bracket.\(position).\(item.id)")
                }
            }
        }
    }

    private func isComplete(_ item: FieldhouseBracketSection) -> Bool {
        let games = FieldhouseBracketEngine.matchups(for: item, league: league, picks: picks, field: officialField).flatMap(\.games)
        return !games.isEmpty && games.allSatisfy { picks[$0.id] != nil }
    }

    private func sectionColor(_ item: FieldhouseBracketSection) -> Color {
        isComplete(item) ? Color.green.opacity(section == item ? 0.95 : 0.72) : Color.red.opacity(section == item ? 0.95 : 0.72)
    }

    private var sectionIntro: some View {
        HStack(spacing: 12) {
            Image(systemName: section == .buyIn ? "arrow.triangle.branch" : section == .finalFour ? "trophy.fill" : "basketball.fill")
                .font(.title).foregroundStyle(section == .finalFour ? .yellow : accent)
            VStack(alignment: .leading, spacing: 3) {
                Text(section.title).font(.title2.weight(.black)).fontWidth(.condensed)
                Text(section == .buyIn ? "Twelve winners claim the final positions in the field of 64." : section == .finalFour ? "Four regional champions. Three final decisions." : "Finish this region to name your regional champion.")
                    .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(15)
        .background(accent.opacity(0.09), in: RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(0.32)))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("fieldhouse.bracket.section.\(section.id).top")
    }

    private func matchupCard(_ matchup: FieldhouseBracketMatchup) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(matchup.label).font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.43))
                Spacer()
                if picks[matchup.id] != nil { Label("PICKED", systemImage: "checkmark.circle.fill").font(.system(size: 8, weight: .black)).foregroundStyle(.green) }
            }
            if matchup.isReady {
                ForEach(matchup.teams) { team in teamButton(team, matchup: matchup) }
            } else {
                Label("COMPLETE THE PRIOR ROUND TO UNLOCK", systemImage: "lock.fill")
                    .font(.caption2.weight(.black)).foregroundStyle(.white.opacity(0.34)).padding(.vertical, 14)
            }
        }.padding(12).background(.black.opacity(0.80), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke((picks[matchup.id] == nil ? Color.white : accent).opacity(0.18)))
    }

    private func teamButton(_ team: FieldhouseBracketTeam, matchup: FieldhouseBracketMatchup) -> some View {
        let selected = picks[matchup.id] == team.id
        return Button {
            guard !locked else { return }
            FieldhouseBracketEngine.choose(team, in: matchup, picks: &picks, league: league, field: officialField)
            submitted = false
        } label: {
            HStack(spacing: 11) {
                Text("\(team.seed)").font(.headline.weight(.black)).foregroundStyle(selected ? .black : accent).frame(width: 28, height: 28).background(selected ? Color.white.opacity(0.72) : accent.opacity(0.12), in: Circle())
                Text(team.name.uppercased()).font(.subheadline.weight(.black)).lineLimit(2).minimumScaleFactor(0.76)
                Spacer()
                Image(systemName: selected ? "checkmark.circle.fill" : "circle").font(.title3)
            }.padding(11).foregroundStyle(selected ? .black : .white).background(selected ? accent : Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 11))
        }.buttonStyle(.plain).disabled(locked)
    }

    private var reviewSheet: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 14) {
                        Text("FINAL BRACKET REVIEW").font(.caption.weight(.black)).tracking(2).foregroundStyle(accent)
                        Text("\(progress) / 75").font(.system(size: 54, weight: .black)).monospacedDigit()
                        Text(progress == 75 ? "EVERY DECISION IS ON FILE" : "\(75 - progress) DECISIONS ARE STILL EMPTY")
                            .font(.headline.weight(.black)).foregroundStyle(progress == 75 ? .green : .red)
                        ForEach(FieldhouseRegion.allCases) { region in
                            HStack {
                                Image(region.regionalTrophyAsset).resizable().scaledToFit().frame(width: 54, height: 54)
                                VStack(alignment: .leading) {
                                    Text("\(region.rawValue) CHAMPION").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(accent)
                                    Text(FieldhouseBracketEngine.regionalChampion(region, picks: picks, league: league, field: officialField)?.name ?? "NOT DECIDED").font(.headline.weight(.black))
                                }
                                Spacer()
                            }.padding(12).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
                        }
                        HStack {
                            Image(systemName: "trophy.fill").font(.title).foregroundStyle(.yellow)
                            VStack(alignment: .leading) {
                                Text("NATIONAL CHAMPION").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.yellow)
                                Text(FieldhouseBracketEngine.nationalChampion(picks: picks, field: officialField)?.name ?? "NOT DECIDED").font(.title3.weight(.black))
                            }; Spacer()
                        }.padding(15).background(.yellow.opacity(0.10), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(.yellow.opacity(0.42)))
                        if hellfireUsed {
                            Label("BRACKET HELLFIRE · PERMANENT RECORD", systemImage: "flame.fill").font(.caption.weight(.black)).foregroundStyle(.red)
                        }
                        Button { showingSubmitConfirmation = true } label: {
                            Text(submitted ? "BRACKET FILED" : "CONFIRM ALL 75 PICKS").font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(16).foregroundStyle(.black).background(progress == 75 ? Color.green : Color.gray, in: RoundedRectangle(cornerRadius: 14))
                        }.buttonStyle(.plain).disabled(progress != 75 || submitted || locked)
                    }.padding(18)
                }
            }
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("BACK") { showingReview = false }.foregroundStyle(accent) } }
        }.preferredColorScheme(.dark)
    }
}

struct FieldhouseRoundPickerView: View {
    let league: FieldhouseLeague
    let field: FieldhouseOfficialField
    let roundKey: String
    @Binding var picks: [String: String]
    let submitted: Bool
    let locked: Bool
    let scheduleReady: Bool
    let save: () -> Void
    let close: () -> Void

    @State private var confirming = false
    private var accent: Color { FieldhouseTheme.accent(for: league) }
    private var games: [FieldhouseBracketMatchup] { FieldhouseBracketEngine.roundMatchups(key: roundKey, field: field) }
    private var complete: Bool { !games.isEmpty && picks.count == games.count }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button(action: close) {
                    Image(systemName: "chevron.left").font(.headline.weight(.black))
                        .frame(width: 40, height: 40).background(.white.opacity(0.10), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back to postseason command")
                .accessibilityIdentifier("fieldhouse.postseason.round.back")
                VStack(alignment: .leading, spacing: 2) {
                    Text(locked ? "LIVE ROUND BOARD" : scheduleReady ? "FRESH ROUND PICKS" : "OFFICIAL SCHEDULE PENDING").font(.system(size: 9, weight: .black)).tracking(1.5).foregroundStyle(accent)
                    Text(FieldhouseBracketEngine.roundTitle(roundKey)).font(.headline.weight(.black)).fontWidth(.condensed)
                }
                Spacer()
                Text("\(picks.count)/\(games.count)").font(.title3.weight(.black)).foregroundStyle(complete ? accent : .red)
            }
            .padding(14).background(.black.opacity(0.94))

            ScrollView {
                VStack(spacing: 12) {
                    Text(locked
                         ? "Picks are sealed. Official scores and winners update on this board as games become final."
                         : scheduleReady
                            ? "Pick every straight-up winner for this round. Moneylines are information only; each correct pick scores one point."
                            : "Matchups are set, but picks stay closed until every official tip time is on file.")
                        .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.65))
                    ForEach(games) { game in
                        VStack(alignment: .leading, spacing: 9) {
                            Text(game.label).font(.caption2.weight(.black)).tracking(1.2).foregroundStyle(accent)
                            ForEach(game.teams) { team in
                                Button {
                                    guard scheduleReady && !locked else { return }
                                    picks[game.id] = picks[game.id] == team.id ? nil : team.id
                                } label: {
                                    HStack {
                                        Text("#\(team.seed)").font(.caption.weight(.black)).foregroundStyle(accent)
                                        Text(team.name).font(.subheadline.weight(.black)).foregroundStyle(teamColor(team, game: game))
                                        Spacer()
                                        if let moneyline = moneyline(team, game: game), officialGame(game)?.winnerTeamID == nil {
                                            Text("ML \(moneyline)")
                                                .font(.caption.weight(.black)).monospacedDigit()
                                                .foregroundStyle(.white.opacity(0.62))
                                        }
                                        if let score = score(team, game: game) {
                                            Text("\(score)").font(.headline.weight(.black)).monospacedDigit().foregroundStyle(teamColor(team, game: game))
                                        }
                                        Image(systemName: statusIcon(team, game: game))
                                            .foregroundStyle(statusColor(team, game: game))
                                    }.padding(12).background(picks[game.id] == team.id ? accent.opacity(0.14) : .white.opacity(0.05), in: RoundedRectangle(cornerRadius: 11))
                                }.buttonStyle(.plain).disabled(locked || !scheduleReady)
                            }
                            if let bookmaker = officialGame(game)?.oddsBookmaker,
                               officialGame(game)?.winnerTeamID == nil {
                                Text("\(bookmaker.uppercased()) · ODDS FOR CONTEXT · PICKS SCORE STRAIGHT-UP")
                                    .font(.system(size: 8, weight: .black)).tracking(0.7)
                                    .foregroundStyle(.white.opacity(0.40))
                            }
                        }.padding(13).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 15))
                            .overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(0.30)))
                    }
                    Button { confirming = true } label: {
                        Text(locked ? "ROUND PICKS LOCKED" : !scheduleReady ? "WAITING FOR OFFICIAL TIP TIMES" : (submitted ? "UPDATE ROUND PICKS" : "FILE ROUND PICKS"))
                            .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(15)
                            .foregroundStyle(complete ? .black : .white.opacity(0.55))
                            .background(complete ? accent : .white.opacity(0.08), in: RoundedRectangle(cornerRadius: 13))
                    }.buttonStyle(.plain).disabled(!complete || locked || !scheduleReady)
                }.padding(14).padding(.bottom, 28)
            }
        }
        .background(Color.black)
        .alert("File \(FieldhouseBracketEngine.roundTitle(roundKey)) picks?", isPresented: $confirming) {
            Button("CANCEL", role: .cancel) {}
            Button("CONFIRM PICKS") { save() }
        } message: {
            Text("Every game in this round locks together at the first official tip. You may update this card until then.")
        }
    }

    private func officialGame(_ matchup: FieldhouseBracketMatchup) -> FieldhouseOfficialGame? {
        field.games.first(where: { $0.gameID == matchup.id })
    }

    private func score(_ team: FieldhouseBracketTeam, game: FieldhouseBracketMatchup) -> Int? {
        guard let official = officialGame(game) else { return nil }
        if game.first?.id == team.id { return official.firstScore }
        if game.second?.id == team.id { return official.secondScore }
        return nil
    }

    private func moneyline(_ team: FieldhouseBracketTeam, game: FieldhouseBracketMatchup) -> String? {
        guard let official = officialGame(game) else { return nil }
        let value = game.first?.id == team.id ? official.firstMoneyline : official.secondMoneyline
        guard let value else { return nil }
        return value > 0 ? "+\(value)" : "\(value)"
    }

    private func teamColor(_ team: FieldhouseBracketTeam, game: FieldhouseBracketMatchup) -> Color {
        guard let winner = officialGame(game)?.winnerTeamID else { return .white }
        return winner == team.id ? .green : .white.opacity(0.48)
    }

    private func statusIcon(_ team: FieldhouseBracketTeam, game: FieldhouseBracketMatchup) -> String {
        guard let winner = officialGame(game)?.winnerTeamID else {
            return picks[game.id] == team.id ? "checkmark.circle.fill" : "circle"
        }
        if winner == team.id { return "checkmark.seal.fill" }
        return picks[game.id] == team.id ? "xmark.circle.fill" : "circle"
    }

    private func statusColor(_ team: FieldhouseBracketTeam, game: FieldhouseBracketMatchup) -> Color {
        guard let winner = officialGame(game)?.winnerTeamID else {
            return picks[game.id] == team.id ? accent : .white.opacity(0.35)
        }
        if winner == team.id { return .green }
        return picks[game.id] == team.id ? .red : .white.opacity(0.22)
    }
}
