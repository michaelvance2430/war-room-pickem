package com.warroompicks.WarRoom

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onNodeWithTag
import com.warroompicks.WarRoom.model.*
import com.warroompicks.WarRoom.ui.screens.PicksScreen
import com.warroompicks.WarRoom.ui.theme.WarRoomTheme
import org.junit.Rule
import org.junit.Test
import java.time.Instant
import java.util.UUID

class AndroidUiSmokeTest {
    @get:Rule val compose = createComposeRule()
    private val userId = UUID.fromString("00000000-0000-0000-0000-000000000001")
    private val leagueId = UUID.fromString("00000000-0000-0000-0000-000000000002")
    private val session = UserSession(userId, "qa@warroom.test", "token", "refresh", Long.MAX_VALUE)

    @Test fun regularSeasonCfbPicksRenderBlankDecisionDesk() {
        val league = league(Sport.CFB, 1, 14)
        val cardId = UUID.randomUUID()
        val card = WeekCard(cardId, leagueId, 1, "published", Instant.now().plusSeconds(3600), "Who wins the late game?")
        val games = (1..5).map { index -> CardGame(UUID.randomUUID(), cardId, "Away $index", "Home $index", -3.5, "Home $index", Instant.now().plusSeconds(3600L * index)) }
        render(AppState(restoring = false, session = session, league = league, leagues = listOf(league), card = card, games = games))
        compose.onNodeWithText("MAKE YOUR PICKS").assertIsDisplayed()
        compose.onNodeWithText("DECISION 1").assertIsDisplayed()
        compose.onNodeWithTag("picks-list").performScrollToNode(hasText("REVIEW & LOCK CARD"))
        compose.onNodeWithText("REVIEW & LOCK CARD").assertIsDisplayed()
    }

    @Test fun nflFinalThirteenRendersFromVerifiedField() {
        val league = league(Sport.NFL, 19, 18)
        val teams = listOf("AFC", "NFC").flatMap { conference -> (1..7).map { seed -> NflPostseasonTeam("${conference.lowercase()}-$seed", "$conference Team $seed", conference, seed) } }
        render(AppState(restoring = false, session = session, league = league, leagues = listOf(league), nflPostseasonSlate = NflPostseasonSlate(2026, teams)))
        compose.onNodeWithText("THE FINAL THIRTEEN").assertIsDisplayed()
        compose.onNodeWithText("AFC CONFERENCE BOARD").assertIsDisplayed()
    }

    @Test fun cfbBowlManiaRendersTwentyFiveGameField() {
        val league = league(Sport.CFB, 16, 14)
        val bowls = (1..25).map { index -> CfbBowlGame("bowl-$index", "Bowl $index", if (index <= 15) CfbBowlTier.MARQUEE else CfbBowlTier.SICKO, if (index <= 15) index else index - 15, "Away $index", "Home $index") }
        render(AppState(restoring = false, session = session, league = league, leagues = listOf(league), cfbPostseasonSlate = CfbPostseasonSlate(2026, bowls, (1..12).map { "Seed $it" })))
        compose.onAllNodesWithText("BOWL MANIA").onFirst().assertIsDisplayed()
        compose.onNodeWithText("MARQUEE 15").assertIsDisplayed()
    }

    private fun render(state: AppState) = compose.setContent {
        WarRoomTheme { PicksScreen(state, { _, _, _ -> }, { _, _ -> }, { _, _, _ -> }, {}, {}, {}, { _, _ -> }, { _, _ -> }) }
    }

    private fun league(sport: Sport, week: Int, regularWeeks: Int) = League(leagueId, "QA League", sport, "QATEST", userId, week, regularWeeks, null)
}
