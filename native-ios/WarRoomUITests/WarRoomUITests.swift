//
//  WarRoomUITests.swift
//  WarRoomUITests
//
//  Created by Michael Vance on 8/14/26.
//

import XCTest

final class WarRoomUITests: XCTestCase {

    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.

        // In UI tests it is usually best to stop immediately when a failure occurs.
        continueAfterFailure = false

        // In UI tests it’s important to set the initial state - such as interface orientation - required for your tests before they run. The setUp method is a good place to do this.
    }

    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }

    @MainActor
    func testExample() throws {
        // UI tests must launch the application that they test.
        let app = XCUIApplication()
        app.launch()

        // Use XCTAssert and related functions to verify your tests produce the correct results.
        // XCUIAutomation Documentation
        // https://developer.apple.com/documentation/xcuiautomation
    }

    @MainActor
    func testFieldhouseBracketBottomNavigationReturnsToSectionTop() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--fieldhouse-preview", "--fieldhouse-review", "--fieldhouse-review-bracket"]
        app.launch()

        let bottomEast = app.buttons["fieldhouse.bracket.bottom.region-east"]
        for _ in 0..<14 where !bottomEast.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(bottomEast.isHittable, "The repeated bracket navigation should be reachable below the Buy-In games.")

        bottomEast.tap()

        let eastTop = app.otherElements["fieldhouse.bracket.section.region-east.top"]
        XCTAssertTrue(eastTop.waitForExistence(timeout: 2))
        XCTAssertTrue(eastTop.isHittable, "Changing sections from the bottom rail must reset the bracket to the new section's top.")
    }

    @MainActor
    func testLaunchPerformance() throws {
        // This measures how long it takes to launch your application.
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            XCUIApplication().launch()
        }
    }
}
