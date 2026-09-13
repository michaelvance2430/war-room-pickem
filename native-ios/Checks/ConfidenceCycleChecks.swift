import Foundation

@main
struct ConfidenceCycleChecks {
    static func main() {
        // Every legal card size uses each point value exactly once, including
        // the user's 1-already-used -> 11 case and partially filled final tiers.
        for maximum in 1...30 {
            var used = Set<Int>()
            for _ in 1...maximum {
                let available = (1...min(10, maximum)).compactMap {
                    ConfidenceCycle.next(base: $0, current: nil, used: used, maximum: maximum)
                }
                guard let value = available.first else { fatalError("Unreachable confidence at size \(maximum)") }
                precondition((1...maximum).contains(value) && !used.contains(value))
                used.insert(value)
            }
            precondition(used == Set(1...maximum))
        }
        precondition(ConfidenceCycle.next(base: 1, current: nil, used: [1], maximum: 21) == 11)
        precondition(ConfidenceCycle.next(base: 1, current: 11, used: [1], maximum: 21) == 21)
        precondition(ConfidenceCycle.next(base: 1, current: 21, used: [1], maximum: 21) == nil)
        precondition(ConfidenceCycle.next(base: 2, current: 2, used: [12], maximum: 21) == nil)
        precondition(ConfidenceCycle.next(base: 1, current: 1, used: [], maximum: 4) == nil)
        print("PASS: all card sizes 1–30, unique allocation, tier skipping, and clearing")
    }
}
