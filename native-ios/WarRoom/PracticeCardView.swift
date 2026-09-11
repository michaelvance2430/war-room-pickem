import SwiftUI

struct PracticePick: Equatable, Sendable {
    var side: String?
    var confidence: Int?
}

enum PracticeCardCoach {
    static func nextStep(picks: [PracticePick], bestBet: Int?) -> String {
        if let game = picks.firstIndex(where: { $0.side == nil }) { return "Pick a winner in Game \(game + 1)." }
        if let game = picks.firstIndex(where: { $0.confidence == nil }) { return "Assign confidence to Game \(game + 1). Use 3, 2, and 1 once each." }
        if bestBet == nil { return "Mark one Best Bet. It scores 2× points when correct." }
        return "Practice card complete. You’re ready for the live room."
    }

    static func isComplete(picks: [PracticePick], bestBet: Int?) -> Bool {
        picks.count == 3
            && picks.allSatisfy { $0.side != nil && $0.confidence != nil }
            && Set(picks.compactMap(\.confidence)) == Set(1...3)
            && bestBet != nil
    }
}

struct PracticeCardView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("warroom.practice-card.completed") private var completed = false
    private let onComplete: (() -> Void)?
    @State private var picks = Array(repeating: PracticePick(), count: 3)
    @State private var bestBet: Int?

    private let games = [
        ("Raleigh Generals", "Austin Outlaws", "Generals -3.5"),
        ("Chicago Dogs", "Miami Sharks", "Sharks -1.5"),
        ("Seattle Rain", "Boston Rebels", "Rain -6.0")
    ]

    init(onComplete: (() -> Void)? = nil) {
        self.onComplete = onComplete
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [.black, Color.green.opacity(0.14), .black], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 15) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("NO PRESSURE · NO POINTS · NO EXCUSES").font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(.green)
                        Text("Practice Card").font(.system(size: 34, weight: .black)).fontWidth(.condensed)
                        Text("Learn the entire weekly card in about a minute. Nothing here is saved to your league.")
                            .font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.62))
                    }
                    coachPanel
                    ForEach(games.indices, id: \.self) { index in practiceGame(index) }
                    Button {
                        guard PracticeCardCoach.isComplete(picks: picks, bestBet: bestBet) else { return }
                        completed = true
                        if let onComplete { onComplete() } else { dismiss() }
                    } label: {
                        Label(completed || PracticeCardCoach.isComplete(picks: picks, bestBet: bestBet) ? "OPEN THE LIVE ROOM" : "FINISH THE PRACTICE CARD", systemImage: "arrow.right.circle.fill")
                            .font(.headline.weight(.black)).frame(maxWidth: .infinity).padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(PracticeCardCoach.isComplete(picks: picks, bestBet: bestBet) ? .green : .gray)
                    .disabled(!PracticeCardCoach.isComplete(picks: picks, bestBet: bestBet))
                    Button("RESET PRACTICE") { withAnimation { picks = Array(repeating: PracticePick(), count: 3); bestBet = nil } }
                        .font(.caption.weight(.black)).foregroundStyle(.white.opacity(0.48)).frame(maxWidth: .infinity)
                }
                .padding(16).padding(.bottom, 28)
            }
        }
        .preferredColorScheme(.dark)
        .navigationTitle("Practice")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var coachPanel: some View {
        HStack(spacing: 11) {
            Image(systemName: PracticeCardCoach.isComplete(picks: picks, bestBet: bestBet) ? "checkmark.seal.fill" : "location.fill")
                .font(.title2).foregroundStyle(PracticeCardCoach.isComplete(picks: picks, bestBet: bestBet) ? .green : .yellow)
            VStack(alignment: .leading, spacing: 3) {
                Text("YOUR NEXT STEP").font(.caption2.weight(.black)).tracking(1.2).foregroundStyle(.yellow)
                Text(PracticeCardCoach.nextStep(picks: picks, bestBet: bestBet)).font(.subheadline.weight(.bold))
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(.black.opacity(0.8), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(.yellow.opacity(0.42)))
    }

    private func practiceGame(_ index: Int) -> some View {
        let used = Set(picks.enumerated().compactMap { $0.offset == index ? nil : $0.element.confidence })
        return VStack(alignment: .leading, spacing: 11) {
            HStack { Text("GAME \(index + 1)").font(.caption2.weight(.black)).foregroundStyle(.green); Spacer(); Text(games[index].2).font(.caption.weight(.black).monospacedDigit()).foregroundStyle(.yellow) }
            HStack(spacing: 8) {
                sideButton(games[index].0, side: "away", game: index)
                sideButton(games[index].1, side: "home", game: index)
            }
            HStack(spacing: 8) {
                Text("CONFIDENCE").font(.caption2.weight(.black)).foregroundStyle(.white.opacity(0.5))
                Spacer()
                ForEach((1...3).reversed(), id: \.self) { value in
                    Button("\(value)") { picks[index].confidence = picks[index].confidence == value ? nil : value }
                        .buttonStyle(.borderedProminent)
                        .tint(picks[index].confidence == value ? .green : .gray.opacity(0.35))
                        .disabled(used.contains(value))
                }
            }
            Button { bestBet = bestBet == index ? nil : index } label: {
                BestBetActionLabel(isSelected: bestBet == index, accent: .yellow)
            }.buttonStyle(.plain)
        }
        .padding(15).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke((bestBet == index ? Color.yellow : Color.green).opacity(0.38)))
    }

    private func sideButton(_ name: String, side: String, game: Int) -> some View {
        Button(name) { picks[game].side = side }
            .font(.caption.weight(.bold)).frame(maxWidth: .infinity)
            .buttonStyle(.borderedProminent)
            .tint(picks[game].side == side ? .green : .gray.opacity(0.35))
    }
}

struct PracticeCardPreviewHost: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var enteredLiveRoom = false

    var body: some View {
        if enteredLiveRoom {
            RootView()
                .environmentObject(auth)
                .task { await auth.restore() }
        } else {
            NavigationStack {
                PracticeCardView(onComplete: { enteredLiveRoom = true })
            }
        }
    }
}
