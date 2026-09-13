import SwiftUI

struct ConfidenceUsageStrip<GameID: Hashable>: View {
    let assignments: [GameID: Int]
    let total: Int
    let onSelectGame: (GameID) -> Void

    private var used: Set<Int> { Set(assignments.values) }
    private func tint(_ number: Int) -> Color {
        number > 20 ? .red : (number > 10 ? .yellow : .green)
    }

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Text("CONFIDENCE").font(.system(size: 9, weight: .black)).tracking(1.2)
                Text("TAP USED TO FIND GAME")
                    .font(.system(size: 8, weight: .bold)).foregroundStyle(.white.opacity(0.55))
                Spacer(minLength: 3)
                Text("\(used.count)/\(total)").font(.system(size: 10, weight: .black)).monospacedDigit()
            }
            ForEach(0..<((total + 6) / 7), id: \.self) { row in
                HStack(spacing: 5) {
                    ForEach(1...7, id: \.self) { column in
                        let number = row * 7 + column
                        if number <= total {
                            let game = assignments.first { $0.value == number }?.key
                            Button {
                                if let game { onSelectGame(game) }
                            } label: {
                            HStack(spacing: 3) {
                                Text("\(number)").font(.system(size: 12, weight: .black)).monospacedDigit()
                                if used.contains(number) {
                                    Image(systemName: "checkmark").font(.system(size: 8, weight: .black))
                                }
                            }
                            .frame(maxWidth: .infinity).frame(height: 36)
                            .foregroundStyle(used.contains(number) ? .black : .white.opacity(0.65))
                            .background(used.contains(number) ? tint(number) : .clear, in: RoundedRectangle(cornerRadius: 5))
                            .overlay(RoundedRectangle(cornerRadius: 5).stroke(used.contains(number) ? tint(number) : .white.opacity(0.22)))
                            }
                            .contentShape(Rectangle())
                            .buttonStyle(.plain)
                            .disabled(game == nil)
                            .accessibilityLabel("Confidence \(number), \(game.map { _ in "assigned" } ?? "available")")
                            .accessibilityHint(game == nil ? "Not assigned to a game" : "Jump to this game")
                        } else {
                            Color.clear.frame(maxWidth: .infinity).frame(height: 36)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(Color(red: 0.025, green: 0.04, blue: 0.03))
        .overlay(alignment: .bottom) { Rectangle().fill(.white.opacity(0.14)).frame(height: 1) }
    }
}
