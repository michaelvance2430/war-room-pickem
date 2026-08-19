import SwiftUI
import UIKit

struct CareerRank: Identifiable, Hashable {
    enum Grade { case enlisted, officer }
    let id: String
    let abbreviation: String
    let name: String
    let promotionPoints: Int
    let seasons: Int
    let sports: Int
    let tacticalNukes: Int
    let grade: Grade
    let atlasRect: CGRect
}

struct CareerRankProgress {
    let current: CareerRank
    let next: CareerRank?
    let points: Int
    let seasons: Int
    let sports: Int
    let tacticalNukes: Int

    var pointsToNext: Int { max(0, (next?.promotionPoints ?? points) - points) }
    var progress: Double {
        guard let next else { return 1 }
        let span = max(1, next.promotionPoints - current.promotionPoints)
        return min(1, max(0, Double(points - current.promotionPoints) / Double(span)))
    }
}

enum CareerRanks {
    private static func cell(_ column: Int, _ row: Int) -> CGRect {
        CGRect(x: CGFloat(column) / 3, y: CGFloat(row) / 3, width: 1.0 / 3, height: 1.0 / 3)
    }

    static let all: [CareerRank] = [
        CareerRank(id: "rank_pfc", abbreviation: "PFC", name: "Private First Class", promotionPoints: 0, seasons: 0, sports: 1, tacticalNukes: 0, grade: .enlisted, atlasRect: cell(0, 0)),
        // Enlisted gaps are never smaller than the largest single Cheevo (200 PP),
        // so one unlock can promote a player once, never skip multiple ranks.
        CareerRank(id: "rank_cpl", abbreviation: "CPL", name: "Corporal", promotionPoints: 200, seasons: 0, sports: 1, tacticalNukes: 0, grade: .enlisted, atlasRect: cell(1, 0)),
        CareerRank(id: "rank_sgt", abbreviation: "SGT", name: "Sergeant", promotionPoints: 400, seasons: 0, sports: 1, tacticalNukes: 0, grade: .enlisted, atlasRect: cell(2, 0)),
        CareerRank(id: "rank_ssg", abbreviation: "SSG", name: "Staff Sergeant", promotionPoints: 600, seasons: 1, sports: 1, tacticalNukes: 0, grade: .enlisted, atlasRect: cell(0, 1)),
        CareerRank(id: "rank_sfc", abbreviation: "SFC", name: "Sergeant First Class", promotionPoints: 800, seasons: 1, sports: 1, tacticalNukes: 0, grade: .enlisted, atlasRect: cell(1, 1)),
        CareerRank(id: "rank_msg", abbreviation: "MSG", name: "Master Sergeant", promotionPoints: 1000, seasons: 2, sports: 1, tacticalNukes: 0, grade: .enlisted, atlasRect: cell(2, 1)),
        CareerRank(id: "rank_1sg", abbreviation: "1SG", name: "First Sergeant", promotionPoints: 1200, seasons: 2, sports: 2, tacticalNukes: 0, grade: .enlisted, atlasRect: cell(0, 2)),
        CareerRank(id: "rank_sgm", abbreviation: "SGM", name: "Sergeant Major", promotionPoints: 1400, seasons: 3, sports: 2, tacticalNukes: 0, grade: .enlisted, atlasRect: cell(1, 2)),
        CareerRank(id: "rank_csm", abbreviation: "CSM", name: "Command Sergeant Major", promotionPoints: 1600, seasons: 3, sports: 2, tacticalNukes: 0, grade: .enlisted, atlasRect: cell(2, 2)),
        CareerRank(id: "rank_2lt", abbreviation: "2LT", name: "Second Lieutenant", promotionPoints: 1850, seasons: 4, sports: 2, tacticalNukes: 0, grade: .officer, atlasRect: CGRect(x: 0.02, y: 0.02, width: 0.24, height: 0.29)),
        CareerRank(id: "rank_1lt", abbreviation: "1LT", name: "First Lieutenant", promotionPoints: 2250, seasons: 4, sports: 2, tacticalNukes: 0, grade: .officer, atlasRect: CGRect(x: 0.25, y: 0.02, width: 0.24, height: 0.29)),
        CareerRank(id: "rank_cpt", abbreviation: "CPT", name: "Captain", promotionPoints: 2750, seasons: 5, sports: 3, tacticalNukes: 0, grade: .officer, atlasRect: CGRect(x: 0.48, y: 0.02, width: 0.27, height: 0.29)),
        CareerRank(id: "rank_maj", abbreviation: "MAJ", name: "Major", promotionPoints: 3400, seasons: 6, sports: 3, tacticalNukes: 0, grade: .officer, atlasRect: CGRect(x: 0.01, y: 0.29, width: 0.27, height: 0.28)),
        CareerRank(id: "rank_ltc", abbreviation: "LTC", name: "Lieutenant Colonel", promotionPoints: 4200, seasons: 7, sports: 3, tacticalNukes: 0, grade: .officer, atlasRect: CGRect(x: 0.25, y: 0.29, width: 0.27, height: 0.28)),
        CareerRank(id: "rank_col", abbreviation: "COL", name: "Colonel", promotionPoints: 5200, seasons: 8, sports: 3, tacticalNukes: 1, grade: .officer, atlasRect: CGRect(x: 0.48, y: 0.29, width: 0.28, height: 0.28)),
        CareerRank(id: "rank_bg", abbreviation: "BG", name: "Brigadier General", promotionPoints: 6500, seasons: 9, sports: 4, tacticalNukes: 1, grade: .officer, atlasRect: CGRect(x: 0.75, y: 0.29, width: 0.24, height: 0.28)),
        CareerRank(id: "rank_mg", abbreviation: "MG", name: "Major General", promotionPoints: 8000, seasons: 10, sports: 4, tacticalNukes: 1, grade: .officer, atlasRect: CGRect(x: 0.02, y: 0.57, width: 0.32, height: 0.23)),
        CareerRank(id: "rank_ltg", abbreviation: "LTG", name: "Lieutenant General", promotionPoints: 10000, seasons: 12, sports: 4, tacticalNukes: 1, grade: .officer, atlasRect: CGRect(x: 0.29, y: 0.57, width: 0.32, height: 0.23)),
        CareerRank(id: "rank_gen", abbreviation: "GEN", name: "General", promotionPoints: 12500, seasons: 14, sports: 5, tacticalNukes: 1, grade: .officer, atlasRect: CGRect(x: 0.58, y: 0.57, width: 0.40, height: 0.23)),
        CareerRank(id: "rank_field_general", abbreviation: "★★★★★", name: "Five-Star Field General", promotionPoints: 15000, seasons: 16, sports: 5, tacticalNukes: 1, grade: .officer, atlasRect: CGRect(x: 0.02, y: 0.76, width: 0.58, height: 0.23))
    ]

    static func resolve(points: Int, seasons: Int, sports: Int, tacticalNukes: Int = 0, minimumRankId: String? = nil) -> CareerRankProgress {
        let qualified = all.lastIndex { points >= $0.promotionPoints && seasons >= $0.seasons && sports >= $0.sports && tacticalNukes >= $0.tacticalNukes } ?? 0
        let floor = minimumRankId.flatMap { id in all.firstIndex { $0.id == id } } ?? 0
        let index = max(qualified, floor)
        return CareerRankProgress(current: all[index], next: all.indices.contains(index + 1) ? all[index + 1] : nil, points: points, seasons: seasons, sports: max(1, sports), tacticalNukes: tacticalNukes)
    }
}

struct RankInsigniaView: View {
    let rank: CareerRank
    var size: CGFloat = 46

    var body: some View {
        Group {
            if rank.id == "rank_pfc" {
                PFCInsigniaShape()
            } else if let image = croppedImage {
                Image(uiImage: image).resizable().scaledToFit()
            } else {
                Image(systemName: "medal.fill").resizable().scaledToFit().foregroundStyle(.yellow)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel("\(rank.name) rank insignia")
    }

    private var croppedImage: UIImage? {
        let name = rank.grade == .enlisted ? "EnlistedRankAtlas" : "OfficerRankAtlas"
        guard let source = UIImage(named: name)?.cgImage else { return nil }
        let rect = CGRect(x: rank.atlasRect.minX * CGFloat(source.width), y: rank.atlasRect.minY * CGFloat(source.height), width: rank.atlasRect.width * CGFloat(source.width), height: rank.atlasRect.height * CGFloat(source.height)).integral
        guard let crop = source.cropping(to: rect) else { return nil }
        return UIImage(cgImage: crop, scale: UIScreen.main.scale, orientation: .up)
    }
}

private struct PFCInsigniaShape: View {
    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let height = proxy.size.height
            let outer = Path { path in
                path.move(to: CGPoint(x: width * 0.13, y: height * 0.78))
                path.addLine(to: CGPoint(x: width * 0.13, y: height * 0.50))
                path.addLine(to: CGPoint(x: width * 0.50, y: height * 0.10))
                path.addLine(to: CGPoint(x: width * 0.87, y: height * 0.50))
                path.addLine(to: CGPoint(x: width * 0.87, y: height * 0.78))
                path.addQuadCurve(to: CGPoint(x: width * 0.13, y: height * 0.78), control: CGPoint(x: width * 0.50, y: height * 1.02))
                path.closeSubpath()

                path.move(to: CGPoint(x: width * 0.25, y: height * 0.56))
                path.addLine(to: CGPoint(x: width * 0.50, y: height * 0.29))
                path.addLine(to: CGPoint(x: width * 0.75, y: height * 0.56))
                path.addLine(to: CGPoint(x: width * 0.75, y: height * 0.68))
                path.addQuadCurve(to: CGPoint(x: width * 0.25, y: height * 0.68), control: CGPoint(x: width * 0.50, y: height * 0.84))
                path.closeSubpath()
            }
            outer
                .fill(
                    LinearGradient(
                        colors: [Color(red: 0.98, green: 0.80, blue: 0.34), Color(red: 0.49, green: 0.28, blue: 0.05), Color(red: 0.90, green: 0.67, blue: 0.20)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    style: FillStyle(eoFill: true)
                )
            outer.stroke(Color(red: 0.30, green: 0.16, blue: 0.03), lineWidth: max(1, width * 0.025))
        }
        .aspectRatio(1, contentMode: .fit)
        .shadow(color: .yellow.opacity(0.22), radius: 3, y: 2)
        .accessibilityHidden(true)
    }
}

struct ProfileRankPlacard: View {
    let progress: CareerRankProgress
    let isOwner: Bool
    var sportId: String = "cfb"
    private var isNFL: Bool { sportId.lowercased() == "nfl" }
    private var accent: Color { isNFL ? .cyan : .yellow }

    var body: some View {
        NavigationLink {
            PromotionBoardView(progress: progress, showsRequirements: isOwner, sportId: sportId)
        } label: {
            VStack(spacing: 6) {
                RankInsigniaView(rank: progress.current, size: 76)
                    .shadow(color: accent.opacity(0.28), radius: 14)
                Text("\(progress.current.abbreviation) · \(progress.current.name.uppercased())")
                    .font(.system(size: 10, weight: .black)).tracking(1.1).foregroundStyle(accent)
                ProgressView(value: progress.progress).tint(accent).frame(width: 128)
                Text(progress.next == nil ? "MAXIMUM RANK" : "\(progress.points) PP · \(progress.pointsToNext) TO \(progress.next!.abbreviation)")
                    .font(.system(size: 8, weight: .black)).tracking(0.8).foregroundStyle(.white.opacity(0.52))
                Text("PROMOTION BOARD  ›").font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(isNFL ? .blue : .green)
            }
            .padding(.horizontal, 18).padding(.vertical, 11)
            .background(.black.opacity(0.72), in: UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 18, bottomTrailingRadius: 3, topTrailingRadius: 18))
            .overlay(UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 18, bottomTrailingRadius: 3, topTrailingRadius: 18).stroke(accent.opacity(0.38)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(progress.current.name), \(progress.points) promotion points. Open Promotion Board.")
    }
}

struct PromotionBoardView: View {
    let progress: CareerRankProgress
    let showsRequirements: Bool
    var sportId: String = "cfb"
    @State private var selectedRank: CareerRank?
    private var isNFL: Bool { sportId.lowercased() == "nfl" }
    private var accent: Color { isNFL ? .cyan : .yellow }
    private var secondary: Color { isNFL ? .blue : .green }

    var body: some View {
        ZStack {
            LinearGradient(colors: isNFL ? [Color(red: 0.015, green: 0.06, blue: 0.17), .black] : [Color(red: 0.04, green: 0.035, blue: 0.018), .black], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    Text(isNFL ? "PRO PERSONNEL PROMOTION BOARD" : "PROMOTION BOARD").font(.caption2.weight(.black)).tracking(2.6).foregroundStyle(accent)
                    RankInsigniaView(rank: progress.current, size: 132).shadow(color: accent.opacity(0.34), radius: 24)
                    Text(progress.current.abbreviation).font(.system(size: 38, weight: .black)).fontWidth(.condensed)
                    Text(progress.current.name.uppercased()).font(.caption.weight(.black)).tracking(1.5).foregroundStyle(accent)
                    ProgressView(value: progress.progress).tint(accent).frame(maxWidth: 250)
                    Text("\(progress.points) PROMOTION POINTS").font(.caption2.weight(.black)).tracking(1.4).foregroundStyle(.white.opacity(0.55))

                    if let next = progress.next {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("NEXT GRADE · \(next.abbreviation)").font(.caption2.weight(.black)).tracking(1.8).foregroundStyle(secondary)
                            HStack { RankInsigniaView(rank: next, size: 56); VStack(alignment: .leading) { Text(next.name).font(.headline.weight(.black)); Text("\(progress.pointsToNext) promotion points remaining").font(.caption).foregroundStyle(.secondary) }; Spacer() }
                            if showsRequirements {
                                qualification("PROMOTION POINTS", "\(progress.points) / \(next.promotionPoints) PP", progress.points >= next.promotionPoints)
                                qualification("TIME IN SERVICE", "\(progress.seasons) / \(next.seasons) seasons", progress.seasons >= next.seasons)
                                qualification("CAMPAIGN BREADTH", "\(progress.sports) / \(next.sports) sports", progress.sports >= next.sports)
                                if next.tacticalNukes > 0 { qualification(isNFL ? "JDAM QUALIFICATION" : "NUCLEAR QUALIFICATION", "\(progress.tacticalNukes) / \(next.tacticalNukes)", progress.tacticalNukes >= next.tacticalNukes) }
                            } else {
                                Text("Detailed promotion requirements are visible only to this player.").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        .padding(16).background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: isNFL ? 7 : 18)).overlay(RoundedRectangle(cornerRadius: isNFL ? 7 : 18).stroke(secondary.opacity(0.34)))
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("CAREER LADDER").font(.caption2.weight(.black)).tracking(1.8).foregroundStyle(accent)
                        ForEach(CareerRanks.all) { rank in
                            Button { selectedRank = rank } label: {
                                HStack(spacing: 12) {
                                    RankInsigniaView(rank: rank, size: 38)
                                    VStack(alignment: .leading, spacing: 2) { Text("\(rank.abbreviation) · \(rank.name)").font(.subheadline.weight(.black)); Text("\(rank.promotionPoints) PP").font(.caption2).foregroundStyle(.secondary) }
                                    Spacer()
                                    Image(systemName: rank.promotionPoints <= progress.current.promotionPoints ? "checkmark.seal.fill" : "lock.fill").foregroundStyle(rank.id == progress.current.id ? accent : rank.promotionPoints <= progress.current.promotionPoints ? secondary : .white.opacity(0.25))
                                    Image(systemName: "chevron.right").font(.caption2.weight(.black)).foregroundStyle(accent.opacity(0.58))
                                }
                                .padding(11).background(rank.id == progress.current.id ? accent.opacity(0.10) : Color.black.opacity(0.48), in: RoundedRectangle(cornerRadius: isNFL ? 6 : 12))
                            }
                            .buttonStyle(.plain)
                            .accessibilityHint("Opens promotion requirements")
                        }
                    }
                }
                .padding(18).padding(.bottom, 28)
            }
        }
        .navigationTitle("Promotion Board").navigationBarTitleDisplayMode(.inline)
        .sheet(item: $selectedRank) { rank in
            RankRequirementsView(rank: rank, progress: progress, showsPersonalProgress: showsRequirements, sportId: sportId)
                .presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
        }
    }

    private func qualification(_ label: String, _ value: String, _ qualified: Bool) -> some View {
        HStack { VStack(alignment: .leading) { Text(label).font(.system(size: 8, weight: .black)).tracking(1); Text(value).font(.caption.weight(.bold)) }; Spacer(); Text(qualified ? "QUALIFIED" : "PENDING").font(.system(size: 8, weight: .black)).foregroundStyle(qualified ? secondary : accent) }
            .padding(10).background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 10))
    }
}

private struct RankRequirementsView: View {
    let rank: CareerRank
    let progress: CareerRankProgress
    let showsPersonalProgress: Bool
    let sportId: String
    private var isNFL: Bool { sportId.lowercased() == "nfl" }
    private var accent: Color { isNFL ? .cyan : .yellow }
    private var secondary: Color { isNFL ? .blue : .green }

    var body: some View {
        ZStack {
            LinearGradient(colors: isNFL ? [Color(red: 0.015, green: 0.06, blue: 0.17), .black] : [Color(red: 0.055, green: 0.045, blue: 0.018), .black], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 15) {
                    Text("PROMOTION REQUIREMENTS").font(.caption2.weight(.black)).tracking(2.3).foregroundStyle(accent)
                    RankInsigniaView(rank: rank, size: 112).shadow(color: accent.opacity(0.32), radius: 22)
                    Text(rank.abbreviation).font(.system(size: 34, weight: .black)).fontWidth(.condensed)
                    Text(rank.name.uppercased()).font(.caption.weight(.black)).tracking(1.3).foregroundStyle(accent)

                    VStack(spacing: 9) {
                        requirement("PROMOTION POINTS", "\(rank.promotionPoints) PP", progress.points >= rank.promotionPoints)
                        requirement("TIME IN SERVICE", "\(rank.seasons) season\(rank.seasons == 1 ? "" : "s")", progress.seasons >= rank.seasons)
                        requirement("CAMPAIGN BREADTH", "\(rank.sports) sport\(rank.sports == 1 ? "" : "s")", progress.sports >= rank.sports)
                        if rank.tacticalNukes > 0 { requirement(isNFL ? "JDAM QUALIFICATION" : "NUCLEAR QUALIFICATION", isNFL ? "\(rank.tacticalNukes) JDAM authorization" : "\(rank.tacticalNukes) Tactical Nuke", progress.tacticalNukes >= rank.tacticalNukes) }
                    }

                    if showsPersonalProgress {
                        Text("YOUR FILE · \(progress.points) PP · \(progress.seasons) SEASONS · \(progress.sports) SPORTS")
                            .font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(secondary).multilineTextAlignment(.center)
                    } else {
                        Text("PERSONAL QUALIFICATION STATUS IS VISIBLE ONLY TO THIS PLAYER.")
                            .font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.40)).multilineTextAlignment(.center)
                    }
                }
                .padding(22)
            }
        }
        .preferredColorScheme(.dark)
    }

    private func requirement(_ title: String, _ standard: String, _ qualified: Bool) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) { Text(title).font(.system(size: 8, weight: .black)).tracking(1); Text(standard).font(.headline.weight(.black)) }
            Spacer()
            if showsPersonalProgress {
                Label(qualified ? "QUALIFIED" : "PENDING", systemImage: qualified ? "checkmark.seal.fill" : "lock.fill")
                    .font(.system(size: 8, weight: .black)).foregroundStyle(qualified ? secondary : accent)
            }
        }
        .padding(13).background(.black.opacity(0.66), in: RoundedRectangle(cornerRadius: isNFL ? 6 : 13)).overlay(RoundedRectangle(cornerRadius: isNFL ? 6 : 13).stroke((showsPersonalProgress && qualified ? secondary : accent).opacity(0.25)))
    }
}
