//
//  WarRoomUITests.swift
//  WarRoomUITests
//
//  Created by Michael Vance on 8/14/26.
//

import XCTest

final class WarRoomUITests: XCTestCase {

    @MainActor
    func testPatreonConnectionExplainsAccountLinkWithoutSellingGameplay() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--patreon-preview"]
        app.launch()

        XCTAssertTrue(app.staticTexts["PATREON CONNECTION"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Link Your Patreon Account"].exists)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "never changes picks, scoring, standings, or competitive access")).firstMatch.exists)
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "unlock")).firstMatch.exists)
    }

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
    func testFieldhousePicksIdentifiesAndSurfacesCurrentPostseasonRound() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--fieldhouse-preview", "--fieldhouse-review", "--fieldhouse-review-round"]
        app.launch()

        let status = app.staticTexts["fieldhouse.header.status"]
        XCTAssertTrue(status.waitForExistence(timeout: 3))
        XCTAssertTrue(status.label.contains("POSTSEASON"))
        XCTAssertTrue(status.label.contains("FIRST ROUND"))

        let back = app.buttons["fieldhouse.postseason.round.back"]
        XCTAssertTrue(back.waitForExistence(timeout: 2))
        back.tap()

        let currentRound = app.buttons["fieldhouse.postseason.current-round"]
        XCTAssertTrue(currentRound.waitForExistence(timeout: 2))
        XCTAssertTrue(currentRound.isHittable, "The current postseason round must be visible without a scavenger hunt.")
    }

    @MainActor
    func testFieldhouseChampionshipWeekShowsFourStraightUpPicksWithoutPropOrHellfire() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--fieldhouse-preview", "--fieldhouse-review", "--fieldhouse-review-championship"]
        app.launch()

        let makePicks = app.buttons["fieldhouse.picks.lane.makePicks"]
        XCTAssertTrue(makePicks.waitForExistence(timeout: 3))
        let status = app.staticTexts["fieldhouse.header.status"]
        XCTAssertTrue(status.waitForExistence(timeout: 2))
        XCTAssertTrue(status.label.contains("CHAMPIONSHIP WEEK"))
        XCTAssertFalse(status.label.contains("WINDOW 19"))
        makePicks.tap()

        XCTAssertTrue(app.staticTexts["FOUR TITLES.\nONE LAST MOVE."].waitForExistence(timeout: 2))
        XCTAssertEqual(app.staticTexts.matching(NSPredicate(format: "label == %@", "PICK THE CHAMPION · STRAIGHT UP")).count, 4)
        XCTAssertTrue(app.staticTexts["CONFIDENCE"].exists)
        XCTAssertTrue(app.staticTexts["BEST BET"].exists)
        XCTAssertFalse(app.staticTexts["PROP"].exists)
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "HELLFIRE")).firstMatch.exists)

        let bestBet = app.buttons["fieldhouse.best-bet.0"]
        for _ in 0..<5 where !bestBet.isHittable { app.swipeUp() }
        XCTAssertTrue(bestBet.isHittable, "Best Bet must be a prominent full-width action below confidence points.")
        XCTAssertTrue(bestBet.label.contains("MARK AS BEST BET"))
        bestBet.tap()
        XCTAssertTrue(bestBet.label.contains("BEST BET ARMED"))
    }

    @MainActor
    func testNflJdamStrikeFeedOpensItsDedicatedVideo() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--strike-preview-nfl"]
        app.launch()

        XCTAssertTrue(app.staticTexts["TACTICAL STRIKE · LIVE"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.staticTexts["STRIKE FEED LOST"].exists)
    }

    @MainActor
    func testLaunchPerformance() throws {
        // This measures how long it takes to launch your application.
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            XCUIApplication().launch()
        }
    }
}
