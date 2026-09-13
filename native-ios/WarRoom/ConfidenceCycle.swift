import Foundation

enum ConfidenceCycle {
    static func next(base: Int, current: Int?, used: Set<Int>, maximum: Int = 30) -> Int? {
        let values = [base, base + 10, base + 20].filter { $0 <= maximum }
        guard !values.isEmpty else { return nil }
        // The blank state comes after the last available tier. Do not wrap
        // to the current value when the other tiers are already assigned.
        let start = current.flatMap { values.firstIndex(of: $0) }.map { $0 + 1 } ?? 0
        return values.dropFirst(start).first { !used.contains($0) }
    }
}
