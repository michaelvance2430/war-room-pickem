import SwiftUI

struct ReigningChampionPresentation: Equatable, Sendable {
    let seasonKey: Int
    let sportId: String
    let nationalChampion: String
    let champions: [Champion]

    struct Champion: Equatable, Sendable {
        let userId: UUID
        let name: String
        let trophyDesignId: String?
        let trophyType: String
    }

    var names: String {
        champions.map(\.name).joined(separator: champions.count == 2 ? " & " : ", ")
    }

    var primaryTrophyDesignId: String? { champions.first?.trophyDesignId }
    var primaryTrophyType: String { champions.first?.trophyType ?? "championship" }
}

enum ReigningChampionPolicy {
    nonisolated static func presentation(
        closeout: LeagueSeasonCloseout?,
        trophies: [ProfileTrophy]
    ) -> ReigningChampionPresentation? {
        guard let closeout else { return nil }
        let expectedIds = closeout.authoritativeChampionIds
        guard !expectedIds.isEmpty else { return nil }
        let expectedSet = Set(expectedIds)

        let exactTrophies = trophies.filter {
            $0.leagueId == closeout.leagueId
                && $0.seasonYear == closeout.seasonKey
                && $0.trophyType.lowercased() == "championship"
                && $0.winnerUserId.map(expectedSet.contains) == true
        }

        var newestByWinner: [UUID: ProfileTrophy] = [:]
        for trophy in exactTrophies {
            guard let winnerId = trophy.winnerUserId else { continue }
            if let current = newestByWinner[winnerId], current.awardedAt >= trophy.awardedAt { continue }
            newestByWinner[winnerId] = trophy
        }

        guard Set(newestByWinner.keys) == expectedSet else { return nil }
        let champions = expectedIds.compactMap { winnerId -> ReigningChampionPresentation.Champion? in
            guard let trophy = newestByWinner[winnerId] else { return nil }
            return .init(
                userId: winnerId,
                name: trophy.winnerName,
                trophyDesignId: trophy.trophyDesignId,
                trophyType: trophy.trophyType
            )
        }
        guard champions.count == expectedIds.count else { return nil }

        return ReigningChampionPresentation(
            seasonKey: closeout.seasonKey,
            sportId: closeout.sportId,
            nationalChampion: closeout.nationalChampion,
            champions: champions
        )
    }
}

struct ReigningChampionHomeCard: View {
    let presentation: ReigningChampionPresentation

    private var accent: Color {
        switch presentation.sportId.lowercased() {
        case "nfl": .cyan
        case "ncaam": .orange
        case "ncaaw": .pink
        default: .yellow
        }
    }

    private var trophyAsset: String? {
        trophyArtifactName(
            trophyDesignId: presentation.primaryTrophyDesignId,
            trophyType: presentation.primaryTrophyType
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 14) {
                Group {
                    if let trophyAsset {
                        Image(trophyAsset)
                            .resizable()
                            .scaledToFit()
                    } else {
                        Image(systemName: "trophy.fill")
                            .resizable()
                            .scaledToFit()
                            .padding(17)
                            .foregroundStyle(.yellow)
                    }
                }
                .frame(width: 104, height: 104)
                .background(accent.opacity(0.10), in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.46)))
                .shadow(color: accent.opacity(0.34), radius: 18)

                VStack(alignment: .leading, spacing: 6) {
                    Text("REIGNING HARDWARE · \(presentation.seasonKey)")
                        .font(.system(size: 9, weight: .black))
                        .tracking(1.55)
                        .foregroundStyle(accent)
                    Text(presentation.champions.count == 1 ? "DEFENDING CHAMPION" : "DEFENDING CO-CHAMPIONS")
                        .font(.system(size: 22, weight: .black))
                        .fontWidth(.condensed)
                        .foregroundStyle(.white)
                    Text(presentation.names.uppercased())
                        .font(.headline.weight(.black))
                        .foregroundStyle(.white.opacity(0.78))
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }

            HStack(spacing: 9) {
                Image(systemName: "clock.badge.questionmark.fill")
                Text("NEXT SEASON CLOCK ARMS WHEN THE OFFICIAL SCHEDULE IS SET")
                    .font(.system(size: 8, weight: .black))
                    .tracking(1.0)
            }
            .foregroundStyle(.white.opacity(0.56))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(17)
        .background(
            LinearGradient(
                colors: [accent.opacity(0.18), .black.opacity(0.92), .black],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 18)
        )
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(accent.opacity(0.62), lineWidth: 1.4))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Defending champion for \(presentation.seasonKey): \(presentation.names).")
    }
}
