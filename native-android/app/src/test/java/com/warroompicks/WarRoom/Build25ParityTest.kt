package com.warroompicks.WarRoom

import com.warroompicks.WarRoom.model.Sport
import com.warroompicks.WarRoom.model.WeeklyCardSizePolicy
import com.warroompicks.WarRoom.model.Standing
import com.warroompicks.WarRoom.model.StandingMovement
import com.warroompicks.WarRoom.model.CrystalBallWindow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.util.UUID

class Build25ParityTest {
    @Test fun crystalBallWindowClosesAtOpeningKickoff() {
        val kickoff = Instant.parse("2026-08-29T16:00:00Z")
        assertTrue(CrystalBallWindow.isOpen(kickoff, kickoff.minusSeconds(1)))
        assertFalse(CrystalBallWindow.isOpen(kickoff, kickoff))
        assertFalse(CrystalBallWindow.isOpen(kickoff, kickoff.plusSeconds(1)))
    }
    @Test fun cfbCardsFlexFromFiveThroughTenWhileNflStaysFive() {
        assertEquals(5, WeeklyCardSizePolicy.size(Sport.CFB, 4))
        assertEquals(7, WeeklyCardSizePolicy.size(Sport.CFB, 7))
        assertEquals(10, WeeklyCardSizePolicy.size(Sport.CFB, 11))
        assertEquals(5, WeeklyCardSizePolicy.size(Sport.NFL, 10))
        assert(WeeklyCardSizePolicy.isValid(Sport.CFB, 6))
        assert(!WeeklyCardSizePolicy.isValid(Sport.NFL, 6))
    }

    @Test fun standingMovementComparesAgainstTotalsBeforeLatestWeek() {
        val climber = Standing(UUID.randomUUID(), "Climber", null, 10.0, 1, null, weeklyPoints = listOf(10))
        val formerLeader = Standing(UUID.randomUUID(), "Former Leader", null, 9.0, 2, null, weeklyPoints = listOf(0))
        val movement = StandingMovement.compute(listOf(climber, formerLeader))
        assertEquals(1, movement[climber.userId])
        assertEquals(-1, movement[formerLeader.userId])
    }
}
