import Testing
@testable import WarRoom

struct CfbMemberPollTests {
    @Test func ballotRequiresTenUniqueTeams() {
        #expect(CfbMemberBallot(voterID: "a", rankedTeamIDs: Array(repeating: "OSU", count: 10)).isValid == false)
        #expect(CfbMemberBallot(voterID: "a", rankedTeamIDs: (1...10).map(String.init)).isValid)
    }

    @Test func roomPollUsesTenToOnePointsAndFirstPlaceTieBreak() {
        let ballots = [
            CfbMemberBallot(voterID: "a", rankedTeamIDs: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]),
            CfbMemberBallot(voterID: "b", rankedTeamIDs: ["B", "A", "C", "D", "E", "F", "G", "H", "I", "J"])
        ]
        let rows = CfbMemberPollEngine.standings(ballots: ballots)
        #expect(rows.map(\.id).prefix(2) == ["A", "B"])
        #expect(rows[0].points == 19)
        #expect(rows[0].firstPlaceVotes == 1)
    }

    @Test func officialPollRequiresFourUniqueValidVoters() {
        let ranking = (1...10).map(String.init)
        let three = (1...3).map { CfbMemberBallot(voterID: "\($0)", rankedTeamIDs: ranking) }
        let four = three + [CfbMemberBallot(voterID: "4", rankedTeamIDs: ranking)]
        #expect(CfbMemberPollEngine.isOfficial(ballots: three) == false)
        #expect(CfbMemberPollEngine.isOfficial(ballots: four))
    }
}
