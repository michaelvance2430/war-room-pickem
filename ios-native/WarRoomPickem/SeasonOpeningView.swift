import AVKit
import SwiftUI

struct SeasonOpeningView: View {
    let onFinished: () -> Void

    @State private var player = AVPlayer()
    @State private var isExiting = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            VideoPlayer(player: player)
                .ignoresSafeArea()
                .allowsHitTesting(false)
                .opacity(isExiting ? 0 : 1)

            Button("SKIP INTRO →", action: finish)
                .font(.caption2.weight(.black))
                .tracking(1.2)
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .frame(minHeight: 44)
                .background(.black.opacity(0.66), in: Capsule())
                .overlay(Capsule().stroke(.white.opacity(0.55), lineWidth: 1))
                .padding(.top, 12)
                .padding(.trailing, 14)
        }
        .onAppear {
            guard let url = Bundle.main.url(forResource: "war-room-opening-vertical", withExtension: "mp4") else {
                finish()
                return
            }
            player.replaceCurrentItem(with: AVPlayerItem(url: url))
            player.play()
        }
        .onReceive(NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime)) { _ in
            finish()
        }
        .onDisappear { player.pause() }
    }

    private func finish() {
        guard !isExiting else { return }
        isExiting = true
        player.pause()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.55) {
            onFinished()
        }
    }
}
