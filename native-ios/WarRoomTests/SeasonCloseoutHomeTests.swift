import Foundation
import Testing
@testable import WarRoom

@Suite(.serialized)
struct SeasonCloseoutHomeTests {
    @Test func closeoutDecodesCurrentAndLegacyChampionAuthority() throws {
        let league = UUID(uuidString: "10000000-0000-0000-0000-000000000001")!
        let champion = UUID(uuidString: "20000000-0000-0000-0000-000000000001")!
        let coChampion = UUID(uuidString: "20000000-0000-0000-0000-000000000002")!
        let payload = """
        {
          "id": "30000000-0000-0000-0000-000000000001",
          "league_id": "\(league.uuidString)",
          "season_key": 2027,
          "sport_id": "ncaaw",
          "competition_type": "league",
          "national_champion": "South Carolina",
          "league_champion_id": "\(champion.uuidString)",
          "league_champion_ids": ["\(champion.uuidString)", "\(coChampion.uuidString)"],
          "closed_at": "2027-04-05T04:00:00Z"
        }
        """

        let closeout = try JSONDecoder().decode(LeagueSeasonCloseout.self, from: Data(payload.utf8))

        #expect(closeout.leagueId == league)
        #expect(closeout.authoritativeChampionIds == [champion, coChampion])
        #expect(closeout.nationalChampion == "South Carolina")
    }

    @Test func presentationRequiresExactLeagueSeasonTypeAndWinner() throws {
        let league = UUID()
        let champion = UUID()
        let closeout = closeout(league: league, champion: champion)
        let expected = trophy(league: league, season: 2026, type: "championship", winner: champion, name: "Riley V")
        let wrongLeague = trophy(league: UUID(), season: 2026, type: "championship", winner: champion, name: "Wrong League")
        let wrongSeason = trophy(league: league, season: 2025, type: "championship", winner: champion, name: "Wrong Season")
        let wrongType = trophy(league: league, season: 2026, type: "toilet_bowl", winner: champion, name: "Wrong Hardware")

        let presentation = try #require(ReigningChampionPolicy.presentation(
            closeout: closeout,
            trophies: [wrongLeague, wrongSeason, wrongType, expected]
        ))

        #expect(presentation.names == "Riley V")
        #expect(presentation.primaryTrophyDesignId == "nfl_gridiron_crown")
    }

    @Test func coChampionPresentationRejectsPartialEvidence() throws {
        let league = UUID()
        let first = UUID()
        let second = UUID()
        let closeout = closeout(league: league, champion: first, champions: [first, second])
        let firstTrophy = trophy(league: league, season: 2026, type: "championship", winner: first, name: "First Champion")
        let secondTrophy = trophy(league: league, season: 2026, type: "championship", winner: second, name: "Second Champion")

        #expect(ReigningChampionPolicy.presentation(closeout: closeout, trophies: [firstTrophy]) == nil)

        let complete = try #require(ReigningChampionPolicy.presentation(
            closeout: closeout,
            trophies: [firstTrophy, secondTrophy]
        ))
        #expect(complete.champions.count == 2)
        #expect(complete.names == "First Champion & Second Champion")
    }

    @Test func legacyEmptyChampionArrayFallsBackToSingleChampion() throws {
        let league = UUID()
        let champion = UUID()
        let closeout = closeout(league: league, champion: champion, champions: [])
        let hardware = trophy(league: league, season: 2026, type: "championship", winner: champion, name: "Legacy Champion")

        let presentation = try #require(ReigningChampionPolicy.presentation(closeout: closeout, trophies: [hardware]))
        #expect(presentation.champions.map(\.userId) == [champion])
    }

    @Test func seasonWindowKeepsEstimatedAndOfficialDatesDistinct() throws {
        let estimated = try JSONDecoder().decode(SportSeasonWindow.self, from: Data("""
        {"sport_id":"ncaam","season_key":2027,"first_event_at":"2027-11-01T05:00:00Z","season_ends_at":"2028-04-04T04:00:00Z","timing_status":"estimated","display_label":"2027-28"}
        """.utf8))
        let official = SportSeasonWindow(
            sportId: "ncaam",
            seasonKey: 2027,
            firstEventAt: "2027-11-01T05:00:00Z",
            seasonEndsAt: "2028-04-04T04:00:00Z",
            timingStatus: "official",
            displayLabel: "2027-28"
        )

        #expect(estimated.isEstimated)
        #expect(!official.isEstimated)
        #expect(estimated.firstEventAt == official.firstEventAt)
    }

    @Test @MainActor func serverCalendarMovesWeeklyGateAndMarksEstimatedDates() throws {
        let window = SportSeasonWindow(
            sportId: "nfl",
            seasonKey: 2027,
            firstEventAt: "2027-09-09T00:00:00Z",
            seasonEndsAt: "2028-02-14T05:00:00Z",
            timingStatus: "estimated",
            displayLabel: "2027-28"
        )
        SeasonCardBuildGate.recordServerAuthority(window, sportId: "nfl")
        defer { SeasonCardBuildGate.recordServerFailure(sportId: "nfl") }

        let beforeOpen = try #require(footballKickoffDate("2027-09-01T23:59:59Z"))
        let afterOpen = try #require(footballKickoffDate("2027-09-02T00:00:01Z"))
        let weekThree = try #require(footballKickoffDate("2027-09-23T00:00:00Z"))

        #expect(!SeasonCardBuildGate.allowsBuild(sportId: "nfl", week: 1, at: beforeOpen))
        #expect(SeasonCardBuildGate.allowsBuild(sportId: "nfl", week: 1, at: afterOpen))
        #expect(SeasonCardBuildGate.firstScheduledDay(sportId: "nfl", week: 3) == weekThree)
        #expect(SeasonCardBuildGate.lockedMessage(sportId: "nfl", week: 1).contains("~ SEP 1, 2027"))
    }

    @Test @MainActor func successfulEmptyCalendarFailsClosed() {
        SeasonCardBuildGate.recordServerAuthority(nil, sportId: "ncaaw")
        defer { SeasonCardBuildGate.recordServerFailure(sportId: "ncaaw") }

        #expect(!SeasonCardBuildGate.allowsBuild(sportId: "ncaaw", week: 1))
        #expect(SeasonCardBuildGate.lockedMessage(sportId: "ncaaw", week: 1).contains("DATE PENDING"))
    }

    private func closeout(
        league: UUID,
        champion: UUID,
        champions: [UUID]? = nil
    ) -> LeagueSeasonCloseout {
        LeagueSeasonCloseout(
            id: UUID(),
            leagueId: league,
            seasonKey: 2026,
            sportId: "nfl",
            competitionType: "league",
            nationalChampion: "Philadelphia",
            leagueChampionId: champion,
            leagueChampionIds: champions ?? [champion],
            closedAt: "2027-02-15T04:00:00Z"
        )
    }

    private func trophy(
        league: UUID,
        season: Int,
        type: String,
        winner: UUID,
        name: String
    ) -> ProfileTrophy {
        ProfileTrophy(
            id: UUID(),
            leagueId: league,
            seasonYear: season,
            trophyType: type,
            winnerName: name,
            winnerUserId: winner,
            subtitle: nil,
            notes: nil,
            awardedAt: "2027-02-15T04:00:00Z",
            trophyDesignId: "nfl_gridiron_crown"
        )
    }
}
