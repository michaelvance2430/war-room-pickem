import Testing
@testable import WarRoom

struct PracticeCardTests {
    @Test func coachWalksThroughSideConfidenceAndBestBet() {
        var picks = Array(repeating: PracticePick(), count: 3)
        #expect(PracticeCardCoach.nextStep(picks: picks, bestBet: nil) == "Pick a winner in Game 1.")
        picks = [PracticePick(side: "away", confidence: nil), PracticePick(side: "home", confidence: nil), PracticePick(side: "away", confidence: nil)]
        #expect(PracticeCardCoach.nextStep(picks: picks, bestBet: nil).contains("confidence"))
        picks[0].confidence = 3; picks[1].confidence = 2; picks[2].confidence = 1
        #expect(PracticeCardCoach.nextStep(picks: picks, bestBet: nil).contains("Best Bet"))
        #expect(PracticeCardCoach.isComplete(picks: picks, bestBet: 0))
    }

    @Test func duplicateConfidenceNeverCompletesPractice() {
        let picks = [PracticePick(side: "away", confidence: 3), PracticePick(side: "home", confidence: 3), PracticePick(side: "away", confidence: 1)]
        #expect(!PracticeCardCoach.isComplete(picks: picks, bestBet: 0))
    }
}
