import SwiftUI

struct MyLeagueSnapshot: Identifiable, Sendable {
    let membership: LeagueMembership
    var rank = "—"
    var points = "—"
    var progress = "—"
    var note: String? = nil
    var unavailable = false
    var id: UUID { membership.leagueId }
}

enum MyLeaguesScoring {
    static func rank(userID: UUID, totals: [UUID: Int]) -> String {
        guard let own = totals[userID] else { return "—" }
        let position = totals.values.filter { $0 > own }.count + 1
        let tied = totals.values.filter { $0 == own }.count > 1
        return "\(tied ? "T-" : "")\(position) / \(totals.count)"
    }

    static func hasStarted(card: WeekCard, now: Date = Date()) -> Bool {
        // A lock may precede kickoff. Only an actual game start changes TBD to zero.
        card.cardGames.compactMap { footballKickoffDate($0.startTime) }.contains { $0 <= now }
    }

    static func resolvedWinners(card: WeekCard, result: CertifiedWeekResult?, events: [FootballScoreEvent]) -> [UUID: String] {
        let gameIDs = Set(card.cardGames.map(\.id))
        var winners: [UUID: String] = [:]
        for result in result?.gameResults ?? [] where gameIDs.contains(result.cardGameId) {
            if ["home", "away", "push"].contains(result.winner.lowercased()) {
                winners[result.cardGameId] = result.winner.lowercased()
            }
        }
        for game in card.cardGames where winners[game.id] == nil {
            guard let event = events.first(where: {
                $0.completed && normalizedFootballTeam($0.homeTeam) == normalizedFootballTeam(game.homeTeam)
                    && normalizedFootballTeam($0.awayTeam) == normalizedFootballTeam(game.awayTeam)
                    && footballKickoffDate($0.commenceTime).map { eventDate in
                        footballKickoffDate(game.startTime).map { abs($0.timeIntervalSince(eventDate)) < 86_400 } ?? true
                    } != false
            }), let home = event.scores.first(where: { normalizedFootballTeam($0.name) == normalizedFootballTeam(game.homeTeam) }).flatMap({ Int($0.score) }),
                let away = event.scores.first(where: { normalizedFootballTeam($0.name) == normalizedFootballTeam(game.awayTeam) }).flatMap({ Int($0.score) }) else { continue }
            if card.cardKind == "conference_championship" {
                winners[game.id] = home == away ? "push" : home > away ? "home" : "away"
            } else {
                let favorite = game.favorite.lowercased() == "away" ? "away" : "home"
                let margin = Double(favorite == "away" ? away - home : home - away) - abs(game.spread)
                winners[game.id] = abs(margin) < 0.0001 ? "push" : margin > 0 ? favorite : favorite == "home" ? "away" : "home"
            }
        }
        return winners
    }

    static func points(card: WeekCard, pick: PlayerPick?, result: CertifiedWeekResult?, winners: [UUID: String], now: Date = Date()) -> String {
        guard hasStarted(card: card, now: now) || !winners.isEmpty || result != nil else { return "TBD" }
        guard let pick else { return "0" }
        if let certified = pick.totalPoints { return String(certified) }
        guard pick.isLocked else { return "0" }
        var total = pick.pickGames.reduce(0) { total, selected in
            total + (winners[selected.cardGameId] == selected.side.lowercased() ? selected.confidence * (selected.isBestBet ? 2 : 1) : 0)
        }
        if let prop = result?.propResult, prop == pick.propChoice { total += card.propPoints }
        if pick.isChaos && card.cardKind != "conference_championship" { total *= 2 }
        return String(total)
    }
}

enum MyLeaguesService {
    static func load(_ membership: LeagueMembership, token: String, userID: UUID) async -> MyLeagueSnapshot {
        var row = MyLeagueSnapshot(membership: membership)
        do {
            async let standings = SupabaseAPI.standings(token: token, leagueId: membership.leagueId)
            async let card = SupabaseAPI.weekCard(token: token, leagueId: membership.leagueId, weekNumber: membership.leagues.currentWeek)
            async let pick = SupabaseAPI.playerPick(token: token, leagueId: membership.leagueId, userId: userID, weekNumber: membership.leagues.currentWeek)
            async let result = SupabaseAPI.myLeaguesWeekResult(token: token, leagueId: membership.leagueId, week: membership.leagues.currentWeek)
            let (players, activeCard, ownPick, official) = try await (standings, card, pick, result)
            row.rank = MyLeaguesScoring.rank(userID: userID, totals: Dictionary(players.map { ($0.userId, $0.totalPoints) }, uniquingKeysWith: { first, _ in first }))
            guard let activeCard else {
                row.points = "TBD"
                row.note = "Card not posted"
                return row
            }
            var events: [FootballScoreEvent] = []
            var feedUnavailable = false
            if MyLeaguesScoring.hasStarted(card: activeCard) && official == nil {
                do {
                    let feed = try await SupabaseAPI.footballScores(token: token, leagueId: membership.leagueId, sportId: membership.leagues.sportId, weekNumber: activeCard.weekNumber)
                    events = feed.events
                    feedUnavailable = feed.stale == true
                } catch { feedUnavailable = true }
            }
            let winners = MyLeaguesScoring.resolvedWinners(card: activeCard, result: official, events: events)
            row.points = MyLeaguesScoring.points(card: activeCard, pick: ownPick, result: official, winners: winners)
            row.progress = "\(winners.count) / \(activeCard.cardGames.count)"
            if feedUnavailable {
                // Never turn an unavailable score feed into a claim that no games have scored.
                row.points = "—"
                row.progress = "—"
                row.note = "Scores unavailable · retrying"
            } else if ownPick == nil || ownPick?.isLocked == false {
                row.note = MyLeaguesScoring.hasStarted(card: activeCard) ? "No locked picks" : "Picks needed"
            } else if official == nil && !winners.isEmpty {
                row.note = "Final games · awaiting certification"
            }
        } catch {
            row.unavailable = true
            row.note = "Couldn’t refresh · tap refresh to retry"
        }
        return row
    }
}

struct MyLeaguesSection: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("warroom.my-leagues.expanded") private var expanded = true
    @State private var rows: [MyLeagueSnapshot] = []
    @State private var loading = false
    @State private var error: String?
    @State private var selected: LeagueMembership?
    let accent: Color
    var previewRows: [MyLeagueSnapshot]? = nil
    private var displayedRows: [MyLeagueSnapshot] { previewRows ?? rows }

    var body: some View {
        VStack(spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "list.number").foregroundStyle(accent)
                    Text("MY LEAGUES").font(.subheadline.weight(.black)).tracking(1.3)
                    Text("\(displayedRows.count)").font(.caption.weight(.bold)).foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down").font(.caption.weight(.bold))
                }.foregroundStyle(.white).padding(16).frame(minHeight: 52)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("my-leagues-toggle")
            .accessibilityLabel("My Leagues, \(displayedRows.count) leagues")
            .accessibilityValue(expanded ? "Expanded" : "Collapsed")
            .accessibilityHint(expanded ? "Collapse league summaries" : "Expand league summaries")
            if expanded {
                if displayedRows.isEmpty {
                    if loading { ProgressView("Loading your leagues…").padding() }
                    else { Text(error ?? "Your leagues will appear here.").font(.caption).foregroundStyle(.secondary).padding() }
                }
                ForEach(displayedRows) { row in
                    Rectangle().fill(.white.opacity(0.09)).frame(height: 1)
                    Button { selected = row.membership } label: { leagueRow(row) }
                        .buttonStyle(.plain)
                }
                HStack {
                    Text("Official rank · points from scored games")
                        .font(.system(size: 10)).foregroundStyle(.white.opacity(0.5))
                    Spacer(minLength: 4)
                    if previewRows == nil {
                        Button { Task { await refresh() } } label: {
                            Image(systemName: "arrow.clockwise").frame(width: 32, height: 44)
                        }.disabled(loading).accessibilityLabel("Refresh all leagues")
                    }
                }.padding(.horizontal, 16).padding(.vertical, previewRows == nil ? 0 : 12)
                if let error, !displayedRows.isEmpty { Text(error).font(.caption).foregroundStyle(.orange).padding(.bottom, 12) }
            }
        }
        .background(.black.opacity(0.9), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.35)))
        .sheet(item: $selected) { membership in
            StandingsView(leagueOverride: membership).environmentObject(auth)
        }
        .task(id: auth.user?.id) {
            guard previewRows == nil else { return }
            await refresh()
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(60)) } catch { return }
                if scenePhase == .active && expanded { await refresh() }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active && previewRows == nil { Task { await refresh() } }
        }
        .onChange(of: expanded) { _, value in
            if value && previewRows == nil { Task { await refresh() } }
        }
    }

    private func leagueRow(_ row: MyLeagueSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(row.membership.leagues.name).font(.subheadline.weight(.bold)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    Text("\(row.membership.leagues.sportId.uppercased()) · WEEK \(row.membership.leagues.currentWeek)")
                        .font(.system(size: 10, weight: .bold)).tracking(0.8).foregroundStyle(accent)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.35))
            }
            HStack(alignment: .top, spacing: 8) {
                metric("OVERALL RANK", row.rank)
                metric("WEEK POINTS", row.points)
                metric("GAMES SCORED", row.progress)
            }
            if let note = row.note {
                Text(note).font(.caption2).foregroundStyle(row.unavailable || note.contains("needed") || note.contains("unavailable") ? .orange : .white.opacity(0.5))
            }
        }.padding(16).contentShape(Rectangle())
    }

    private func metric(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.system(.title3, design: .rounded, weight: .bold)).monospacedDigit().foregroundStyle(.white)
            Text(title).font(.system(size: 8, weight: .bold)).tracking(0.4).foregroundStyle(.white.opacity(0.5))
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    @MainActor private func refresh() async {
        guard !loading, let token = auth.token, let userID = auth.user?.id else { return }
        loading = true
        defer { loading = false }
        do {
            let memberships = try await SupabaseAPI.leagueMemberships(token: token, userId: userID)
            var next: [MyLeagueSnapshot] = []
            // Bound concurrent requests for players with many rooms.
            for start in stride(from: 0, to: memberships.count, by: 3) {
                let batch = Array(memberships[start..<min(start + 3, memberships.count)])
                let loaded = await withTaskGroup(of: MyLeagueSnapshot.self) { group in
                    for membership in batch {
                        group.addTask { await MyLeaguesService.load(membership, token: token, userID: userID) }
                    }
                    var results: [MyLeagueSnapshot] = []
                    for await result in group { results.append(result) }
                    return results
                }
                next.append(contentsOf: loaded)
            }
            guard !Task.isCancelled, auth.user?.id == userID else { return }
            rows = next.sorted {
                let order = $0.membership.leagues.name.localizedCaseInsensitiveCompare($1.membership.leagues.name)
                return order == .orderedSame ? $0.id.uuidString < $1.id.uuidString : order == .orderedAscending
            }
            error = nil
        } catch {
            self.error = "Couldn’t refresh your leagues. Try again."
        }
    }
}
