package com.warroompicks.WarRoom

import com.warroompicks.WarRoom.model.Sport
import com.warroompicks.WarRoom.model.TeamCatalog
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TeamCatalogTest {
    @Test fun nflCatalogHasEveryTeam() = assertEquals(32, TeamCatalog.teams(Sport.NFL).size)

    @Test fun sportsNeverShareTheWrongCatalog() {
        assertTrue("Kansas City Chiefs" in TeamCatalog.teams(Sport.NFL))
        assertTrue("Alabama" in TeamCatalog.teams(Sport.CFB))
        assertTrue("Alabama" !in TeamCatalog.teams(Sport.NFL))
    }

    @Test fun favoritesUseIosCompatibleSlugs() {
        assertEquals("texas-aandm", TeamCatalog.slug("Texas A&M"))
        assertEquals("san-francisco-49ers", TeamCatalog.slug("San Francisco 49ers"))
    }
}
