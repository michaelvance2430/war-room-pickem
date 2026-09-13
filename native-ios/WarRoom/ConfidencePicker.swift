import SwiftUI

/// Shared confidence controls for every sport. Values remain ordinary scoring integers.
struct ConfidencePicker: View {
    let current: Int?
    let used: Set<Int>
    let maximum: Int
    var enabled = true
    var accessibilityPrefix = "confidence"
    let onChange: (Int?) -> Void

    private func tint(_ value: Int) -> Color {
        value > 20 ? .red : (value > 10 ? .yellow : .green)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(current.map { "\($0) POINTS" } ?? "CHOOSE CONFIDENCE")
                    .font(.caption.weight(.black)).foregroundStyle(tint(current ?? 1))
                Spacer()
                Button("Clear") { onChange(nil) }.font(.caption).disabled(current == nil)
            }
            if maximum > 0 {
                ForEach(0..<((min(maximum, 10) + 4) / 5), id: \.self) { row in
                    HStack(spacing: 7) {
                        ForEach((row * 5 + 1)...min(row * 5 + 5, min(maximum, 10)), id: \.self) { base in
                            confidenceButton(base)
                        }
                    }
                }
            }
            if maximum > 10 {
                Text("Tap again for the next color. Used numbers are skipped. Clear removes your choice.")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }.disabled(!enabled)
    }

    private func confidenceButton(_ base: Int) -> some View {
        let chosen = current.map { ($0 - 1) % 10 + 1 == base } ?? false
        let next = ConfidenceCycle.next(base: base, current: chosen ? current : nil, used: used, maximum: maximum)
        return Button { onChange(next) } label: {
            Text("\(chosen ? current! : base)")
                .font(.caption.weight(.black)).monospacedDigit()
                .frame(maxWidth: .infinity).frame(height: 44)
                .foregroundStyle(chosen ? .black : (next == nil ? .white.opacity(0.22) : .white))
                .background(chosen ? tint(current!) : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 9))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(next == nil && !chosen)
        .accessibilityIdentifier("\(accessibilityPrefix).\(base)")
        .accessibilityLabel("Confidence button \(base)")
        .accessibilityValue(chosen ? "\(current!) points selected" : "Not selected")
        .accessibilityHint(next.map { "Select \($0) points" } ?? (chosen ? "Clear confidence" : "All values in use"))
    }
}
