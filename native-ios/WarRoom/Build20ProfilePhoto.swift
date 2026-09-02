import SwiftUI
import PhotosUI
import UIKit

extension Notification.Name {
    static let warRoomProfilePhotoChanged = Notification.Name("warRoom.profile-photo-changed")
}

struct ProfilePhotoManager: View {
    @EnvironmentObject private var auth: AuthStore
    @Binding var avatarURL: String?
    let displayName: String
    let borderId: String?
    let accent: Color

    @State private var pickedItem: PhotosPickerItem?
    @State private var editorImage: UIImage?
    @State private var busy = false
    @State private var errorMessage: String?
    @State private var confirmRemoval = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 15) {
                ProfileAvatar(
                    urlString: avatarURL,
                    name: displayName,
                    size: 86,
                    borderId: borderId,
                    accent: accent
                )
                VStack(alignment: .leading, spacing: 9) {
                    PhotosPicker(selection: $pickedItem, matching: .images) {
                        Label(avatarURL == nil ? "ADD PHOTO" : "CHANGE PHOTO", systemImage: "photo.badge.plus")
                            .font(.caption.weight(.black))
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(accent)
                    .disabled(busy)
                    .accessibilityLabel(avatarURL == nil ? "Add profile photo" : "Change profile photo")

                    if avatarURL != nil {
                        Button(role: .destructive) { confirmRemoval = true } label: {
                            Label("REMOVE PHOTO", systemImage: "trash")
                                .font(.caption.weight(.black))
                        }
                        .disabled(busy)
                        .accessibilityLabel("Remove profile photo")
                    }
                }
                Spacer(minLength: 0)
            }
            Text("One portrait across CFB, NFL, Standings, Locker Room, and every league.")
                .font(.caption).foregroundStyle(.secondary)
            if busy { ProgressView("Updating your personnel file…").tint(accent) }
            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption.weight(.semibold)).foregroundStyle(.red)
            }
        }
        .onChange(of: pickedItem) { _, item in
            guard let item else { return }
            Task { await loadPickedImage(item) }
        }
        .sheet(isPresented: Binding(
            get: { editorImage != nil },
            set: { if !$0 { editorImage = nil; pickedItem = nil } }
        )) {
            if let editorImage {
                NavigationStack {
                    AvatarCropView(image: editorImage) { jpeg in
                        self.editorImage = nil
                        self.pickedItem = nil
                        Task { await upload(jpeg) }
                    }
                }
            }
        }
        .alert("Remove profile photo?", isPresented: $confirmRemoval) {
            Button("Keep Photo", role: .cancel) {}
            Button("Remove", role: .destructive) { Task { await remove() } }
        } message: {
            Text("Your initials will replace the photo everywhere. Your avatar border stays equipped.")
        }
    }

    @MainActor private func loadPickedImage(_ item: PhotosPickerItem) async {
        errorMessage = nil
        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data)
            else { throw ProfilePhotoError.decode }
            editorImage = image.normalizedOrientation()
        } catch {
            pickedItem = nil
            errorMessage = "That photo could not be opened. Try a different image."
        }
    }

    @MainActor private func upload(_ data: Data) async {
        guard let token = auth.token, let user = auth.user else { return }
        busy = true
        errorMessage = nil
        do {
            let url = try await SupabaseAPI.uploadProfileAvatar(
                token: token,
                userId: user.id,
                jpegData: data,
                replacing: avatarURL
            )
            avatarURL = url
            NotificationCenter.default.post(name: .warRoomProfilePhotoChanged, object: url)
        } catch {
            errorMessage = error.localizedDescription
        }
        busy = false
    }

    @MainActor private func remove() async {
        guard let token = auth.token, let user = auth.user else { return }
        busy = true
        errorMessage = nil
        do {
            try await SupabaseAPI.removeProfileAvatar(token: token, userId: user.id, currentURL: avatarURL)
            avatarURL = nil
            NotificationCenter.default.post(name: .warRoomProfilePhotoChanged, object: nil)
        } catch {
            errorMessage = error.localizedDescription
        }
        busy = false
    }
}

private struct AvatarCropView: View {
    @Environment(\.dismiss) private var dismiss
    let image: UIImage
    let onConfirm: (Data) -> Void
    @State private var zoom: CGFloat = 1
    @State private var committedZoom: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var committedOffset: CGSize = .zero
    @State private var cropViewportSide: CGFloat = 1
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 18) {
            Text("POSITION YOUR PHOTO")
                .font(.caption.weight(.black)).tracking(2).foregroundStyle(.green)
            GeometryReader { proxy in
                let side = min(proxy.size.width, proxy.size.height)
                ZStack {
                    Color.black
                    Image(uiImage: image).resizable().scaledToFill()
                        .frame(width: side, height: side)
                        .scaleEffect(zoom)
                        .offset(offset)
                    Circle().stroke(.white, lineWidth: 3)
                        .shadow(color: .black, radius: 4)
                    Rectangle().fill(.black.opacity(0.52))
                        .mask(EvenOddMask())
                }
                .frame(width: side, height: side)
                .clipShape(Rectangle())
                .contentShape(Rectangle())
                .onAppear { cropViewportSide = max(side, 1) }
                .onChange(of: side) { _, value in cropViewportSide = max(value, 1); clampOffset() }
                .gesture(DragGesture().onChanged { value in
                    offset = CGSize(width: committedOffset.width + value.translation.width,
                                    height: committedOffset.height + value.translation.height)
                    clampOffset()
                }.onEnded { _ in committedOffset = offset })
                .simultaneousGesture(MagnifyGesture().onChanged { value in
                    zoom = min(max(1, committedZoom * value.magnification), 4)
                    clampOffset()
                }.onEnded { _ in committedZoom = zoom; committedOffset = offset })
            }
            .aspectRatio(1, contentMode: .fit)
            Text("Drag to position. Pinch to zoom. The circle is what the room sees.")
                .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
            if let errorMessage { Text(errorMessage).font(.caption).foregroundStyle(.red) }
        }
        .padding(20)
        .background(Color.black.ignoresSafeArea())
        .navigationTitle("Confirm Photo")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Use Photo") {
                    guard let data = renderCrop() else {
                        errorMessage = "The crop could not be prepared. Try again."
                        return
                    }
                    onConfirm(data)
                }.fontWeight(.black)
            }
        }
    }

    private func renderCrop() -> Data? {
        let normalized = image.normalizedOrientation()
        let input = normalized.size
        guard input.width > 0, input.height > 0 else { return nil }
        let baseScale = max(1024 / input.width, 1024 / input.height)
        let scaled = CGSize(width: input.width * baseScale * zoom, height: input.height * baseScale * zoom)
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 1024, height: 1024))
        let rendered = renderer.image { _ in
            UIColor.black.setFill()
            UIRectFill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
            let origin = CGPoint(
                x: (1024 - scaled.width) / 2 + offset.width * (1024 / cropViewportSide),
                y: (1024 - scaled.height) / 2 + offset.height * (1024 / cropViewportSide)
            )
            normalized.draw(in: CGRect(origin: origin, size: scaled))
        }
        return rendered.jpegData(compressionQuality: 0.82)
    }

    private func clampOffset() {
        let side = max(cropViewportSide, 1)
        let input = image.size
        guard input.width > 0, input.height > 0 else { offset = .zero; return }
        let coverScale = max(side / input.width, side / input.height)
        let renderedWidth = input.width * coverScale * zoom
        let renderedHeight = input.height * coverScale * zoom
        let maxX = max(0, (renderedWidth - side) / 2)
        let maxY = max(0, (renderedHeight - side) / 2)
        offset.width = min(max(offset.width, -maxX), maxX)
        offset.height = min(max(offset.height, -maxY), maxY)
    }
}

private struct EvenOddMask: View {
    var body: some View {
        Canvas { context, size in
            var path = Path(CGRect(origin: .zero, size: size))
            path.addEllipse(in: CGRect(origin: .zero, size: size).insetBy(dx: 3, dy: 3))
            context.fill(path, with: .color(.white), style: FillStyle(eoFill: true))
        }
    }
}

private enum ProfilePhotoError: LocalizedError {
    case decode, invalidResponse, rejected(String)
    var errorDescription: String? {
        switch self {
        case .decode: return "That photo could not be decoded."
        case .invalidResponse: return "The photo service returned an invalid response."
        case .rejected(let message): return message
        }
    }
}

private extension UIImage {
    func normalizedOrientation() -> UIImage {
        guard imageOrientation != .up else { return self }
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in draw(in: CGRect(origin: .zero, size: size)) }
    }
}

extension SupabaseAPI {
    static func uploadProfileAvatar(
        token: String,
        userId: UUID,
        jpegData: Data,
        replacing previousURL: String?
    ) async throws -> String {
        guard jpegData.count <= 2_500_000 else {
            throw ProfilePhotoError.rejected("The prepared photo is too large. Try again.")
        }
        // Upload to a new object first. If the profile update fails, the old
        // portrait remains the authoritative reference instead of being
        // overwritten by a half-completed replacement.
        let path = "\(userId.uuidString.lowercased())/avatar-\(UUID().uuidString.lowercased()).jpg"
        let objectURL = SupabaseConfiguration.baseURL.appending(path: "storage/v1/object/avatars/\(path)")
        var upload = URLRequest(url: objectURL)
        upload.httpMethod = "POST"
        upload.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        upload.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        upload.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        upload.httpBody = jpegData
        let (uploadData, uploadResponse) = try await URLSession.shared.data(for: upload)
        try requireAvatarSuccess(uploadData, uploadResponse)

        let publicURL = SupabaseConfiguration.baseURL
            .appending(path: "storage/v1/object/public/avatars/\(path)")
            .absoluteString
        try await updateAvatarReference(token: token, userId: userId, value: publicURL)
        if let previousPath = avatarObjectPath(from: previousURL), previousPath != path {
            try? await deleteAvatarObject(token: token, path: previousPath)
        }
        return publicURL
    }

    static func removeProfileAvatar(token: String, userId: UUID, currentURL: String?) async throws {
        try await updateAvatarReference(token: token, userId: userId, value: nil)
        guard let path = avatarObjectPath(from: currentURL) else { return }
        // The profile reference is authoritative. A cleanup failure must not
        // leave the screen showing a portrait that the account no longer has.
        try? await deleteAvatarObject(token: token, path: path)
    }

    private static func deleteAvatarObject(token: String, path: String) async throws {
        let objectURL = SupabaseConfiguration.baseURL.appending(path: "storage/v1/object/avatars/\(path)")
        var request = URLRequest(url: objectURL)
        request.httpMethod = "DELETE"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 404 || (200..<300).contains(http.statusCode) else {
            throw ProfilePhotoError.rejected("The portrait was cleared, but its old file could not be removed.")
        }
    }

    private static func avatarObjectPath(from urlString: String?) -> String? {
        guard let urlString,
              let range = urlString.range(of: "/storage/v1/object/public/avatars/")
        else { return nil }
        let tail = String(urlString[range.upperBound...])
        return tail.split(separator: "?").first.map(String.init)
    }

    private static func updateAvatarReference(token: String, userId: UUID, value: String?) async throws {
        var components = URLComponents(url: SupabaseConfiguration.baseURL.appending(path: "rest/v1/profiles"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "id", value: "eq.\(userId.uuidString.lowercased())")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "PATCH"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        let avatarValue: Any = value ?? NSNull()
        request.httpBody = try JSONSerialization.data(withJSONObject: ["avatar_url": avatarValue])
        let (data, response) = try await URLSession.shared.data(for: request)
        try requireAvatarSuccess(data, response)
        guard let rows = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]], !rows.isEmpty else {
            throw ProfilePhotoError.rejected("Your profile did not accept the photo change. Sign in again and retry.")
        }
    }

    private static func requireAvatarSuccess(_ data: Data, _ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { throw ProfilePhotoError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let raw = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])
            let message = raw?["message"] as? String ?? raw?["error"] as? String ?? "Profile photo could not be saved."
            throw ProfilePhotoError.rejected(message)
        }
    }
}
