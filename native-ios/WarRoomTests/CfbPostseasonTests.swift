import Testing
@testable import WarRoom

struct CfbPostseasonTests {
    @Test func weekTransitions() {
        #expect(CfbSeasonPhase.phase(week: 14, regularSeasonWeeks: 14) == .regularSeason)
        #expect(CfbSeasonPhase.phase(week: 15, regularSeasonWeeks: 14) == .conferenceChampionships)
        #expect(CfbSeasonPhase.phase(week: 16, regularSeasonWeeks: 14) == .bowlMania)
    }

    @Test func playoffHostBowlsAreExcludedAndReplaced() throws {
        var candidates = (1...16).map { CfbBowlCandidate(id: "m\($0)", name: "M \($0)", tier: .marquee, rank: $0, hostsCfpGame: $0 == 2) }
        candidates += (1...11).map { CfbBowlCandidate(id: "s\($0)", name: "S \($0)", tier: .sicko, rank: $0, hostsCfpGame: $0 == 4) }
        let board = try CfbPostseasonRules.selectBoard(from: candidates)
        #expect(board.count == 25)
        #expect(!board.contains(where: { $0.hostsCfpGame }))
        #expect(board.contains(where: { $0.id == "m16" }))
        #expect(board.contains(where: { $0.id == "s11" }))
    }

    @Test func bowlBankrollAndDeadHand() throws {
        let board = (1...25).map { CfbBowlCandidate(id: "b\($0)", name: "Bowl \($0)", tier: $0 <= 15 ? .marquee : .sicko, rank: $0 <= 15 ? $0 : $0 - 15, hostsCfpGame: false) }
        var allocation = Dictionary(uniqueKeysWithValues: board.map { ($0.id, 4) })
        try CfbPostseasonRules.validateAllocation(allocation, board: board)
        allocation["b1"] = 3
        #expect(throws: CfbPostseasonError.self) { try CfbPostseasonRules.validateAllocation(allocation, board: board) }
        #expect(CfbPostseasonRules.deadHandScore(raw: 60) == 90)
        #expect(CfbPostseasonRules.deadHandScore(raw: 59) == 30)
    }
}
