import UIKit
import Capacitor
import AVFoundation

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        let bridge = CAPBridgeViewController()
        window?.rootViewController = bridge
        window?.makeKeyAndVisible()

        let opening = SeasonOpeningViewController()
        opening.modalPresentationStyle = .overFullScreen
        opening.modalTransitionStyle = .crossDissolve
        bridge.present(opening, animated: false)

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

private final class SeasonOpeningViewController: UIViewController {
    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var playbackObserver: NSObjectProtocol?
    private var finishing = false
    private var soundEnabled = true
    private let soundButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.008, green: 0.043, blue: 0.027, alpha: 1)

        guard let url = Bundle.main.url(
            forResource: "war-room-opening-vertical",
            withExtension: "mp4",
            subdirectory: "public/media"
        ) else {
            finishOpening()
            return
        }

        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        let layer = AVPlayerLayer(player: player)
        layer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(layer)
        self.player = player
        self.playerLayer = layer

        configureSoundButton()

        let skip = UIButton(type: .system)
        var configuration = UIButton.Configuration.filled()
        configuration.title = "SKIP INTRO →"
        configuration.baseForegroundColor = .white
        configuration.baseBackgroundColor = UIColor.black.withAlphaComponent(0.72)
        configuration.cornerStyle = .capsule
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 18, bottom: 12, trailing: 18)
        skip.configuration = configuration
        skip.titleLabel?.font = .systemFont(ofSize: 12, weight: .black)
        skip.translatesAutoresizingMaskIntoConstraints = false
        skip.addTarget(self, action: #selector(skipOpening), for: .touchUpInside)
        view.addSubview(skip)
        NSLayoutConstraint.activate([
            skip.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10),
            skip.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),
            skip.heightAnchor.constraint(greaterThanOrEqualToConstant: 46),
        ])

        playbackObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            self?.finishOpening()
        }
        player.play()
    }

    private func configureSoundButton() {
        var configuration = UIButton.Configuration.filled()
        configuration.title = "SOUND ON"
        configuration.image = UIImage(systemName: "speaker.wave.2.fill")
        configuration.imagePadding = 7
        configuration.baseForegroundColor = .white
        configuration.baseBackgroundColor = UIColor.black.withAlphaComponent(0.72)
        configuration.cornerStyle = .capsule
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 18, bottom: 12, trailing: 18)
        soundButton.configuration = configuration
        soundButton.titleLabel?.font = .systemFont(ofSize: 12, weight: .black)
        soundButton.accessibilityLabel = "Opening sound on"
        soundButton.translatesAutoresizingMaskIntoConstraints = false
        soundButton.addTarget(self, action: #selector(toggleSound), for: .touchUpInside)
        view.addSubview(soundButton)

        NSLayoutConstraint.activate([
            soundButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            soundButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -14),
            soundButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 46),
        ])
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        playerLayer?.frame = view.bounds
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        releasePlayback()
    }

    deinit {
        releasePlayback()
    }

    private func releasePlayback() {
        if let playbackObserver {
            NotificationCenter.default.removeObserver(playbackObserver)
            self.playbackObserver = nil
        }
        player?.pause()
        player?.replaceCurrentItem(with: nil)
        playerLayer?.player = nil
        playerLayer?.removeFromSuperlayer()
        playerLayer = nil
        player = nil
    }

    @objc private func skipOpening() {
        finishOpening()
    }

    @objc private func toggleSound() {
        soundEnabled.toggle()
        player?.isMuted = !soundEnabled
        soundButton.configuration?.title = soundEnabled ? "SOUND ON" : "SOUND OFF"
        soundButton.configuration?.image = UIImage(
            systemName: soundEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill"
        )
        soundButton.accessibilityLabel = soundEnabled ? "Opening sound on" : "Opening sound off"
    }

    private func finishOpening() {
        guard !finishing else { return }
        finishing = true
        player?.pause()
        UIView.animate(withDuration: 0.55, delay: 0, options: [.curveEaseOut]) {
            self.view.alpha = 0
        } completion: { _ in
            self.releasePlayback()
            self.dismiss(animated: false)
        }
    }
}
