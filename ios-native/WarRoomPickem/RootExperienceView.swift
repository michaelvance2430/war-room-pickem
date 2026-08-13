import SwiftUI

struct RootExperienceView: View {
    @State private var showingOpening = true

    var body: some View {
        ZStack {
            if showingOpening {
                SeasonOpeningView {
                    withAnimation(.easeOut(duration: 0.55)) {
                        showingOpening = false
                    }
                }
                .transition(.opacity)
            } else {
                HomeView()
                    .transition(.opacity)
            }
        }
        .background(Color.black.ignoresSafeArea())
    }
}
