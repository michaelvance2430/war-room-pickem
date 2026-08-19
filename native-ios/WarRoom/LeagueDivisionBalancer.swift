import Foundation

struct LeagueDivisionBalanceCandidate: Sendable {
    let membershipId: UUID
    let name: String
    let currentDivision: String?
}

enum LeagueDivisionBalancer {
    static let divisions = ["North", "South", "East", "West"]

    /// Produces an even, deterministic alignment while retaining as many
    /// existing assignments as possible. Final division sizes differ by at
    /// most one player.
    static func assignments(for candidates: [LeagueDivisionBalanceCandidate]) -> [UUID: String] {
        let ordered = candidates.sorted {
            let nameOrder = $0.name.localizedCaseInsensitiveCompare($1.name)
            if nameOrder != .orderedSame { return nameOrder == .orderedAscending }
            return $0.membershipId.uuidString < $1.membershipId.uuidString
        }
        let base = ordered.count / divisions.count
        let remainder = ordered.count % divisions.count
        let targets = Dictionary(uniqueKeysWithValues: divisions.enumerated().map { index, division in
            (division, base + (index < remainder ? 1 : 0))
        })

        var buckets = Dictionary(uniqueKeysWithValues: divisions.map { ($0, [LeagueDivisionBalanceCandidate]()) })
        var unassigned: [LeagueDivisionBalanceCandidate] = []
        for candidate in ordered {
            if let division = canonical(candidate.currentDivision) { buckets[division, default: []].append(candidate) }
            else { unassigned.append(candidate) }
        }

        var result: [UUID: String] = [:]
        for division in divisions {
            let target = targets[division, default: 0]
            let current = buckets[division, default: []]
            current.prefix(target).forEach { result[$0.membershipId] = division }
            unassigned.append(contentsOf: current.dropFirst(target))
        }
        unassigned.sort {
            let nameOrder = $0.name.localizedCaseInsensitiveCompare($1.name)
            if nameOrder != .orderedSame { return nameOrder == .orderedAscending }
            return $0.membershipId.uuidString < $1.membershipId.uuidString
        }

        var cursor = 0
        for division in divisions {
            let retained = result.values.filter { $0 == division }.count
            let needed = max(0, targets[division, default: 0] - retained)
            guard needed > 0 else { continue }
            for _ in 0..<needed where cursor < unassigned.count {
                result[unassigned[cursor].membershipId] = division
                cursor += 1
            }
        }
        return result
    }

    static func canonical(_ value: String?) -> String? {
        divisions.first { $0.caseInsensitiveCompare(value ?? "") == .orderedSame }
    }
}
