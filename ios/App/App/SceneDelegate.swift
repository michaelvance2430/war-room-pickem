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

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        playerLayer?.frame = view.bounds
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        player?.pause()
        if let playbackObserver {
            NotificationCenter.default.removeObserver(playbackObserver)
        }
    }

    @objc private func skipOpening() {
        finishOpening()
    }

    private func finishOpening() {
        guard !finishing else { return }
        finishing = true
        player?.pause()
        UIView.animate(withDuration: 0.55, delay: 0, options: [.curveEaseOut]) {
            self.view.alpha = 0
        } completion: { _ in
            self.dismiss(animated: false)
        }
    }
}
