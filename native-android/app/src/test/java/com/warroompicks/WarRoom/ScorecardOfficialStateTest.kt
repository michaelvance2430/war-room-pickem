package com.warroompicks.WarRoom

import com.warroompicks.WarRoom.model.ScorecardOfficialState
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant
import java.util.UUID

class ScorecardOfficialStateTest {
    @Test
    fun certifiedTotalReplacesGameOnlySubtotal() {
        assertEquals(8, ScorecardOfficialState.total(gamePoints = 8, certifiedTotal = null))
        assertEquals(11, ScorecardOfficialState.total(gamePoints = 8, certifiedTotal = 11))
    }

    @Test
    fun propStatusMatchesIosCertifiedStates() {
        assertEquals("PENDING", ScorecardOfficialState.propStatus("Yes", null, 3))
        assertEquals("HIT +3", ScorecardOfficialState.propStatus("Yes", "Yes", 3))
        assertEquals("MISS +0", ScorecardOfficialState.propStatus("No", "Yes", 3))
    }

    @Test
    fun propPickerSubmitsPublishedAnswerTextInsteadOfABMarkers() {
        val card = com.warroompicks.WarRoom.model.WeekCard(
            UUID.randomUUID(), UUID.randomUUID(), 0, "published", Instant.now(),
            "Will any game total 56+?", "Yes — at least one totals 56+", "No — all stay below 56", 3,
        )
        assertEquals(
            listOf("Yes — at least one totals 56+", "No — all stay below 56"),
            ScorecardOfficialState.propOptions(card),
        )
    }
}
