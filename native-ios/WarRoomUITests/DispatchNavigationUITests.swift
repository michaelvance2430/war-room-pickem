import XCTest

final class DispatchNavigationUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    @MainActor func testCFBDispatchPagesAndArchiveRemainTappable() { checkPages(sport: "cfb", finalWeek: 13) }
    @MainActor func testNFLDispatchPagesAndArchiveRemainTappable() { checkPages(sport: "nfl", finalWeek: 18) }

    @MainActor private func checkPages(sport: String, finalWeek: Int) {
        let app = XCUIApplication()
        app.launchArguments = ["--dispatch-navigation-preview"] + (sport == "nfl" ? ["--dispatch-nfl"] : [])
        app.launch()
        app.buttons["Open Dispatch"].tap()
        XCTAssertTrue(app.buttons["dispatch.page.2"].waitForExistence(timeout: 5))
        for week in [1, 2, finalWeek] {
            if week != 1 { app.buttons["WEEK \(week)"].tap() }
            XCTAssertTrue(app.staticTexts["CLASSIFIED // PAGE 1 OF 4"].exists)
            for page in [2, 3, 4, 1] {
                let button = app.buttons["dispatch.page.\(page)"]
                XCTAssertTrue(button.isHittable)
                button.tap()
                XCTAssertTrue(app.staticTexts["CLASSIFIED // PAGE \(page) OF 4"].waitForExistence(timeout: 2), "Edition \(week) would not open page \(page)")
            }
        }
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertTrue(app.buttons["Open Dispatch"].waitForExistence(timeout: 2))
    }
}
