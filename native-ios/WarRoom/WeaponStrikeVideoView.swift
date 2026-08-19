import AVKit
import SwiftUI

struct StrikePresentation: Identifiable {
    let id = UUID()
    let resourceName: String
}

enum WeaponStrikeCatalog {
    static func presentation(for sportId: String) -> StrikePresentation? {
        let names: [String]
        switch sportId.lowercased() {
        case "cfb": names = ["nuke-football-1", "nuke-football-2", "nuke-football-3"]
        case "cbb": names = ["hellfire-fieldhouse-1"]
        default: names = []
        }
        return names.randomElement().map { StrikePresentation(resourceName: $0) }
    }
}

struct WeaponStrikeVideoView: View {
    let presentation: StrikePresentation
    let onComplete: () -> Void
    @State private var player: AVPlayer?
    @State private var muted = false
    @State private var failed = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let player {
                VideoPlayer(player: player)
                    .ignoresSafeArea()
            } else if failed {
                VStack(spacing: 14) {
                    Image(systemName: "exclamationmark.triangle.fill").font(.largeTitle).foregroundStyle(.red)
                    Text("STRIKE FEED LOST").font(.headline.weight(.black))
                    Button("RETURN TO COMMAND", action: onComplete).buttonStyle(.borderedProminent).tint(.red)
                }
            } else {
                ProgressView("ARMING STRIKE FEED…").tint(.red)
            }

            VStack {
                HStack {
                    Label("TACTICAL STRIKE · LIVE", systemImage: "dot.radiowaves.left.and.right")
                        .font(.caption2.weight(.black)).tracking(1.2).foregroundStyle(.red)
                        .padding(.horizontal, 12).padding(.vertical, 9).background(.black.opacity(0.65), in: Capsule())
                    Spacer()
                    Button { muted.toggle(); player?.isMuted = muted } label: {
                        Image(systemName: muted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                            .frame(width: 44, height: 44).background(.black.opacity(0.65), in: Circle())
                    }
                    Button("SKIP STRIKE", action: onComplete)
                        .font(.caption2.weight(.black)).padding(.horizontal, 13).frame(height: 44)
                        .background(.black.opacity(0.65), in: Capsule())
                }
                Spacer()
            }
            .padding(.horizontal, 14).padding(.top, 8)
        }
        .statusBarHidden()
        .onAppear {
            guard let url = Bundle.main.url(forResource: presentation.resourceName, withExtension: "mp4") else {
                failed = true
                return
            }
            let created = AVPlayer(url: url)
            created.isMuted = muted
            player = created
            created.play()
        }
        .onDisappear { player?.pause(); player = nil }
        .onReceive(NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime)) { note in
            guard let current = player?.currentItem, let ended = note.object as? AVPlayerItem, ended === current else { return }
            onComplete()
        }
    }
}
