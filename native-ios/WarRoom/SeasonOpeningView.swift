import SwiftUI
import AVFoundation
import UIKit

struct SeasonOpeningView: View {
    @Binding var isPresented: Bool
    @State private var player: AVPlayer = {
        guard let url = Bundle.main.url(forResource: "war-room-opening-vertical", withExtension: "mp4") else { return AVPlayer() }
        return AVPlayer(url: url)
    }()
    @State private var muted = true

    var body: some View {
        ZStack {
            PlayerSurface(player: player)
                .ignoresSafeArea()
            VStack {
                HStack {
                    Spacer()
                    Button("SKIP INTRO →") { dismiss() }
                        .font(.caption.weight(.black)).tracking(1.4)
                        .padding(.horizontal, 18).padding(.vertical, 13)
                        .background(.black.opacity(0.72), in: Capsule())
                        .overlay(Capsule().stroke(.white.opacity(0.75), lineWidth: 1.5))
                }
                Spacer()
                if muted {
                    Button("TAP FOR SOUND") {
                        muted = false
                        player.isMuted = false
                        player.play()
                    }
                    .font(.caption.weight(.black)).tracking(1.4)
                    .padding(.horizontal, 22).padding(.vertical, 15)
                    .background(.black.opacity(0.8), in: Capsule())
                    .overlay(Capsule().stroke(.green.opacity(0.85)))
                }
            }
            .padding(18)
        }
        .background(.black)
        .onAppear {
            player.isMuted = true
            player.play()
        }
        .onReceive(NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime)) { note in
            guard note.object as AnyObject? === player.currentItem else { return }
            dismiss()
        }
        .onDisappear { player.pause() }
    }

    private func dismiss() {
        player.pause()
        withAnimation(.easeOut(duration: 0.7)) { isPresented = false }
    }
}

private struct PlayerSurface: UIViewRepresentable {
    let player: AVPlayer
    func makeUIView(context: Context) -> PlayerView {
        let view = PlayerView()
        view.layerPlayer.player = player
        return view
    }
    func updateUIView(_ uiView: PlayerView, context: Context) { uiView.layerPlayer.player = player }
}

private final class PlayerView: UIView {
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    var layerPlayer: AVPlayerLayer { layer as! AVPlayerLayer }
    override init(frame: CGRect) {
        super.init(frame: frame)
        layerPlayer.videoGravity = .resizeAspectFill
        backgroundColor = .black
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}
