package com.warroompicks.WarRoom

import com.warroompicks.WarRoom.model.Sport
import com.warroompicks.WarRoom.model.WeeklyCardSizePolicy
import org.junit.Assert.assertEquals
import org.junit.Test

class Build25ParityTest {
    @Test fun cfbCardsFlexFromFiveThroughTenWhileNflStaysFive() {
        assertEquals(5, WeeklyCardSizePolicy.size(Sport.CFB, 4))
        assertEquals(7, WeeklyCardSizePolicy.size(Sport.CFB, 7))
        assertEquals(10, WeeklyCardSizePolicy.size(Sport.CFB, 11))
        assertEquals(5, WeeklyCardSizePolicy.size(Sport.NFL, 10))
        assert(WeeklyCardSizePolicy.isValid(Sport.CFB, 6))
        assert(!WeeklyCardSizePolicy.isValid(Sport.NFL, 6))
    }
}
