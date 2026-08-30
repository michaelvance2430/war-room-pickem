package com.warroompicks.WarRoom

import com.warroompicks.WarRoom.model.NflBracketEngine
import com.warroompicks.WarRoom.model.NflPostseasonTeam
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NflBracketEngineTest {
    private val teams = listOf("AFC", "NFC").flatMap { conference ->
        (1..7).map { seed -> NflPostseasonTeam("${conference.lowercase()}-$seed", "$conference Team $seed", conference, seed) }
    }

    @Test fun bracketContainsExactlyThirteenDecisions() {
        val picks = completePicks()
        assertEquals(13, NflBracketEngine.games(teams, picks).size)
        assertTrue(NflBracketEngine.requiredKeys.all { picks[it] != null })
    }

    @Test fun wildCardChangeClearsEveryDependentConferencePickAndSuperBowl() {
        val full = completePicks()
        val changed = NflBracketEngine.select(full, "AFC-WC-2-7", "afc-7")
        assertFalse("AFC-DIV-1" in changed)
        assertFalse("AFC-DIV-2" in changed)
        assertFalse("AFC-CONF" in changed)
        assertFalse("SUPER-BOWL" in changed)
        assertTrue("NFC-CONF" in changed)
    }

    @Test fun divisionalMatchupsReseedLowestRemainingAgainstOneSeed() {
        var picks = emptyMap<String, String>()
        picks = NflBracketEngine.select(picks, "AFC-WC-2-7", "afc-7")
        picks = NflBracketEngine.select(picks, "AFC-WC-3-6", "afc-3")
        picks = NflBracketEngine.select(picks, "AFC-WC-4-5", "afc-4")
        val divisional = NflBracketEngine.games(teams, picks).first { it.id == "AFC-DIV-1" }
        assertEquals(listOf(1, 7), divisional.teams.map { it.seed })
    }

    private fun completePicks(): Map<String, String> {
        var picks = emptyMap<String, String>()
        repeat(4) {
            NflBracketEngine.games(teams, picks).filter { it.teams.size == 2 && picks[it.id] == null }.forEach { game ->
                picks = NflBracketEngine.select(picks, game.id, game.teams.first().id)
            }
        }
        return picks
    }
}
