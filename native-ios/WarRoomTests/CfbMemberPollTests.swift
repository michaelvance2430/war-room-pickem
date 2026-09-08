import Testing
@testable import WarRoom

struct CfbMemberPollTests {
    @Test func ballotRequiresTwelveUniqueTeams() {
        #expect(CfbMemberBallot(voterID: "a", rankedTeamIDs: Array(repeating: "OSU", count: 12)).isValid == false)
        #expect(CfbMemberBallot(voterID: "a", rankedTeamIDs: (1...12).map(String.init)).isValid)
    }

    @Test func roomPollUsesTwelveToOnePointsAndFirstPlaceTieBreak() {
        let ballots = [
            CfbMemberBallot(voterID: "a", rankedTeamIDs: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]),
            CfbMemberBallot(voterID: "b", rankedTeamIDs: ["B", "A", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"])
        ]
        let rows = CfbMemberPollEngine.standings(ballots: ballots)
        #expect(rows.map(\.id).prefix(2) == ["A", "B"])
        #expect(rows[0].points == 23)
        #expect(rows[0].firstPlaceVotes == 1)
    }

    @Test func officialPollRequiresFourUniqueValidVoters() {
        let ranking = (1...12).map(String.init)
        let three = (1...3).map { CfbMemberBallot(voterID: "\($0)", rankedTeamIDs: ranking) }
        let four = three + [CfbMemberBallot(voterID: "4", rankedTeamIDs: ranking)]
        #expect(CfbMemberPollEngine.isOfficial(ballots: three) == false)
        #expect(CfbMemberPollEngine.isOfficial(ballots: four))
    }

    @Test func equalPointsAndFirstsCompareSecondPlaceVotesBeforeLowerPositions() {
        let ballots = [
            CfbMemberBallot(voterID: "1", rankedTeamIDs: ["A", "C", "B", "D", "E", "F", "G", "H", "I", "J", "K", "L"]),
            CfbMemberBallot(voterID: "2", rankedTeamIDs: ["B", "A", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]),
            CfbMemberBallot(voterID: "3", rankedTeamIDs: ["C", "D", "B", "A", "E", "F", "G", "H", "I", "J", "K", "L"])
        ]

        let rows = CfbMemberPollEngine.standings(ballots: ballots)
        let a = rows.first { $0.id == "A" }!
        let b = rows.first { $0.id == "B" }!
        #expect(a.points == b.points)
        #expect(a.firstPlaceVotes == b.firstPlaceVotes)
        #expect(a.rank < b.rank)
    }
}
