import SwiftUI

struct LeagueLegacyAward: Identifiable, Sendable {
    let id: String
    let season: Int
    let kind: String
    let winner: String
    let subtitle: String
    let asset: String

    init(id: String = UUID().uuidString, season: Int, kind: String, winner: String, subtitle: String, asset: String) {
        self.id = id; self.season = season; self.kind = kind; self.winner = winner; self.subtitle = subtitle; self.asset = asset
    }
}

enum LeagueLegacyFixtures {
    static func awards(for leagueName: String) -> [LeagueLegacyAward] {
        switch leagueName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "saturday situation room":
            return [
                .init(season: 2025, kind: "LEAGUE CHAMPION", winner: "Kahmann", subtitle: "Saturday Situation Room Champion", asset: "ChampionshipArtifact"),
                .init(season: 2025, kind: "NERD AWARD", winner: "Big Balls Ben", subtitle: "Village Nerd · Receipts preserved", asset: "VillageNerdArtifact"),
                .init(season: 2025, kind: "TOILET BOWL", winner: "JStray", subtitle: "Basement bracket survivor", asset: "ToiletBowlArtifact")
            ]
        case "all jokes aside":
            return [
                .init(season: 2026, kind: "SUPER BOWL CHAMPION", winner: "Maria", subtitle: "League Champion · 2026", asset: "AllJokesAsideTrophyArtifact"),
                .init(season: 2026, kind: "NFC CHAMPION", winner: "Mr Founder", subtitle: "Conference hardware · 2026", asset: "NfcChampionshipArtifact")
            ]
        default: return []
        }
    }
}

struct LeagueTrophyRoomView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    @State private var liveAwards: [ProfileTrophy] = []
    @State private var loading = true
    @State private var expandedSeasons: Set<Int> = []

    private var accent: Color { membership.leagues.sportId.lowercased() == "nfl" ? .cyan : .yellow }
    private var awards: [LeagueLegacyAward] {
        let mapped = liveAwards.map {
            LeagueLegacyAward(
                id: $0.id.uuidString, season: $0.seasonYear,
                kind: awardTitle($0.trophyType), winner: $0.winnerName,
                subtitle: $0.subtitle ?? "Permanent league history",
                asset: awardAsset(type: $0.trophyType, design: $0.trophyDesignId)
            )
        }
        let fixtures = LeagueLegacyFixtures.awards(for: membership.leagues.name)
        let fixtureWinnerYears = Set(fixtures.map { "\($0.season)|\($0.winner)".lowercased() })
        let retainedMapped = mapped.filter { !fixtureWinnerYears.contains("\($0.season)|\($0.winner)".lowercased()) }
        return (retainedMapped + fixtures)
            .sorted { $0.season == $1.season ? $0.kind < $1.kind : $0.season > $1.season }
    }

    var body: some View {
        ZStack {
            Image("StandingsHall").resizable().scaledToFill().ignoresSafeArea()
            LinearGradient(colors: [.black.opacity(0.10), .black.opacity(0.42), .black.opacity(0.58)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("THE LEAGUE ARCHIVE").font(.caption2.weight(.black)).tracking(2.4).foregroundStyle(accent)
                        Text("TROPHY\nROOM").font(.system(size: 48, weight: .black)).fontWidth(.condensed).lineSpacing(-8)
                        Text(membership.leagues.name.uppercased()).font(.caption.weight(.black)).tracking(1.4).foregroundStyle(.white.opacity(0.58))
                        Text("Every crown, conference, humiliation, and permanent receipt—season by season.")
                            .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.68))
                    }
                    .padding(20).frame(maxWidth: .infinity, alignment: .leading)
                    .background(.black.opacity(0.48), in: UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 24, bottomTrailingRadius: 3, topTrailingRadius: 24))
                    .overlay(UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 24, bottomTrailingRadius: 3, topTrailingRadius: 24).stroke(accent.opacity(0.58), lineWidth: 1.5))

                    if loading && awards.isEmpty { ProgressView("Opening the vault…").tint(accent).frame(maxWidth: .infinity).padding(40) }
                    else if awards.isEmpty { ContentUnavailableView("The cases are empty", systemImage: "trophy", description: Text("The first certified season will live here permanently.")) }
                    else {
                        ForEach(Array(Dictionary(grouping: awards, by: \.season).keys.sorted(by: >)), id: \.self) { season in
                            seasonCase(season, awards: awards.filter { $0.season == season })
                        }
                    }
                }.padding(16).padding(.bottom, 40)
            }
        }
        .navigationTitle("Trophy Room").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark)
        .task { await load() }
    }

    private func seasonCase(_ season: Int, awards: [LeagueLegacyAward]) -> some View {
        let championship = awards.filter { awardTier($0) == 0 }
        let conference = awards.filter { awardTier($0) == 1 }
        let basement = awards.filter { awardTier($0) == 2 }
        let expanded = expandedSeasons.contains(season)
        return VStack(alignment: .leading, spacing: expanded ? 18 : 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.24)) {
                    if expanded { expandedSeasons.remove(season) }
                    else { expandedSeasons.insert(season) }
                }
            } label: {
                HStack(spacing: 10) {
                    Text(String(season) + " SEASON").font(.title2.weight(.black)).fontWidth(.condensed)
                    Spacer()
                    Text(expanded ? "CLOSE CASE" : "OPEN CASE").font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(accent)
                    Image(systemName: expanded ? "chevron.up" : "chevron.down").font(.caption.weight(.black)).foregroundStyle(accent)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(season) season trophy case")
            .accessibilityValue(expanded ? "Expanded" : "Collapsed")

            if expanded {
                if !championship.isEmpty { trophyShelf("CHAMPIONSHIP", awards: championship, hero: true) }
                if !conference.isEmpty { trophyShelf("CONFERENCE · DIVISION", awards: conference) }
                if !basement.isEmpty { trophyShelf("NERD AWARD · TOILET BOWL", awards: basement) }
            }
        }
        .padding(16).background(LinearGradient(colors: [.brown.opacity(0.16), .black.opacity(0.34)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(.yellow.opacity(0.42), lineWidth: 2))
    }

    private func trophyShelf(_ label: String, awards: [LeagueLegacyAward], hero: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.system(size: 8, weight: .black)).tracking(1.5).foregroundStyle(.white.opacity(0.52)).padding(.leading, 5)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: hero ? 1 : min(2, max(1, awards.count))), spacing: 10) {
                ForEach(awards) { award in
                    VStack(spacing: 5) {
                        Image(award.asset)
                            .resizable().scaledToFit()
                            .frame(height: hero ? 170 : 125)
                            .shadow(color: accent.opacity(0.52), radius: 20, y: 4)
                        Text(award.kind).font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(accent).multilineTextAlignment(.center)
                        Text(award.winner.uppercased()).font((hero ? Font.title2 : Font.subheadline).weight(.black)).fontWidth(.condensed).multilineTextAlignment(.center)
                        Text(award.subtitle).font(.caption2.weight(.semibold)).foregroundStyle(.white.opacity(0.62)).multilineTextAlignment(.center).lineLimit(2)
                    }
                    .frame(maxWidth: .infinity).padding(.horizontal, 8).padding(.vertical, 10)
                    .background(.black.opacity(0.24), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(accent.opacity(0.22)))
                }
            }
            woodenShelf
        }
    }

    private var woodenShelf: some View {
        ZStack(alignment: .top) {
            LinearGradient(colors: [Color(red: 0.45, green: 0.22, blue: 0.08), Color(red: 0.20, green: 0.08, blue: 0.025), Color(red: 0.08, green: 0.025, blue: 0.01)], startPoint: .top, endPoint: .bottom)
            VStack(spacing: 4) {
                Rectangle().fill(.yellow.opacity(0.32)).frame(height: 1)
                Rectangle().fill(.black.opacity(0.22)).frame(height: 1)
                Rectangle().fill(.white.opacity(0.07)).frame(height: 1)
            }.padding(.top, 3)
        }
        .frame(height: 18)
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 2, bottomLeadingRadius: 8, bottomTrailingRadius: 8, topTrailingRadius: 2))
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 2, bottomLeadingRadius: 8, bottomTrailingRadius: 8, topTrailingRadius: 2).stroke(.black.opacity(0.7)))
        .shadow(color: .black.opacity(0.8), radius: 8, y: 7)
    }

    private func awardTier(_ award: LeagueLegacyAward) -> Int {
        let kind = award.kind.uppercased()
        if kind.contains("NERD") || kind.contains("TOILET") { return 2 }
        if kind.contains("CONFERENCE") || kind.contains("DIVISION") || kind.contains("NFC") || kind.contains("AFC") { return 1 }
        return 0
    }

    private func load() async {
        defer { loading = false }
        if let token = auth.token {
            liveAwards = (try? await SupabaseAPI.leagueTrophies(token: token, leagueId: membership.leagueId)) ?? []
        }
        if expandedSeasons.isEmpty, let newestSeason = awards.map(\.season).max() {
            expandedSeasons.insert(newestSeason)
        }
    }

    private func awardTitle(_ type: String) -> String {
        return switch type {
        case "championship": "LEAGUE CHAMPION"
        case "toilet_bowl": "TOILET BOWL"
        case "village_nerd": "NERD AWARD"
        case "nfc_championship": "NFC CHAMPION"
        case "afc_championship": "AFC CHAMPION"
        default: type.replacingOccurrences(of: "_", with: " ").uppercased()
        }
    }

    private func awardAsset(type: String, design: String?) -> String {
        if design == "all_jokes_aside" { return "AllJokesAsideTrophyArtifact" }
        return switch type {
        case "toilet_bowl": "ToiletBowlArtifact"
        case "village_nerd": "VillageNerdArtifact"
        case "nfc_championship": "NfcChampionshipArtifact"
        case "afc_championship": "AfcChampionshipArtifact"
        default: "ChampionshipArtifact"
        }
    }
}
