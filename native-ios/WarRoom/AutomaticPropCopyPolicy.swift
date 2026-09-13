import Foundation

enum AutomaticPropCopyPolicy {
    static func count(_ baseline: Int, cardSize: Int, baselineSize: Int = 5) -> Int {
        max(1, (baseline * cardSize + baselineSize - 1) / baselineSize)
    }

    static func resolved(_ source: String, cardSize: Int, sportId: String) -> String {
        guard (1...30).contains(cardSize), cardSize != 5 else { return source }
        let highTotal = cardSize * 56 + 1
        let lowTotal = cardSize * 40
        var result = source
            .replacingOccurrences(of: "Five-game", with: "\(cardSize)-game", options: .caseInsensitive)
            .replacingOccurrences(of: "all five games", with: "all \(cardSize) games", options: .caseInsensitive)
            .replacingOccurrences(of: "the five games", with: "the \(cardSize) games", options: .caseInsensitive)
            .replacingOccurrences(of: "the 5 games", with: "the \(cardSize) games", options: .caseInsensitive)
            .replacingOccurrences(of: "of 5 games", with: "of \(cardSize) games", options: .caseInsensitive)
            .replacingOccurrences(of: "all five", with: "all \(cardSize)", options: .caseInsensitive)
            .replacingOccurrences(of: "five combined", with: "\(cardSize) combined", options: .caseInsensitive)
            .replacingOccurrences(of: "5–0", with: "\(cardSize)–0")
        if source.localizedCaseInsensitiveContains("combined") || source.localizedCaseInsensitiveContains("total") {
            result = result.replacingOccurrences(of: "281", with: "\(highTotal)")
                .replacingOccurrences(of: "280", with: "\(highTotal - 1)")
                .replacingOccurrences(of: "201", with: "\(lowTotal + 1)")
                .replacingOccurrences(of: "200", with: "\(lowTotal)")
        }
        return result
    }
}

