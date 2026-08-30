package com.warroompicks.WarRoom

import com.warroompicks.WarRoom.model.CfbBracketEngine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CfbBracketEngineTest {
    private val seeds = (1..12).map { "Seed $it" }

    @Test fun fixedTwelveTeamBracketContainsElevenDecisions() {
        assertEquals(11, CfbBracketEngine.games(seeds, emptyMap()).size)
        assertEquals(11, CfbBracketEngine.order.size)
    }

    @Test fun changingFirstRoundWinnerClearsIllegalDownstreamPath() {
        var picks = emptyMap<String, String>()
        picks = CfbBracketEngine.select(seeds, picks, "r1a", "Seed 5")
        picks = CfbBracketEngine.select(seeds, picks, "q1", "Seed 5")
        picks = CfbBracketEngine.select(seeds, picks, "r1a", "Seed 12")
        assertEquals("Seed 12", picks["r1a"])
        assertFalse("q1" in picks)
    }

    @Test fun completePathProducesNationalChampion() {
        var picks = emptyMap<String, String>()
        repeat(4) {
            CfbBracketEngine.games(seeds, picks).filter { it.first != "TBD" && it.second != "TBD" && picks[it.id] == null }.forEach { game ->
                picks = CfbBracketEngine.select(seeds, picks, game.id, game.first)
            }
        }
        assertTrue(CfbBracketEngine.order.all { picks[it] != null })
        assertEquals("Seed 4", picks["final"])
    }
}
