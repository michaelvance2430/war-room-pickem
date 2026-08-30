package com.warroompicks.WarRoom.model

object TeamCatalog {
    val nfl = listOf(
        "Arizona Cardinals", "Atlanta Falcons", "Baltimore Ravens", "Buffalo Bills", "Carolina Panthers", "Chicago Bears",
        "Cincinnati Bengals", "Cleveland Browns", "Dallas Cowboys", "Denver Broncos", "Detroit Lions", "Green Bay Packers",
        "Houston Texans", "Indianapolis Colts", "Jacksonville Jaguars", "Kansas City Chiefs", "Las Vegas Raiders",
        "Los Angeles Chargers", "Los Angeles Rams", "Miami Dolphins", "Minnesota Vikings", "New England Patriots",
        "New Orleans Saints", "New York Giants", "New York Jets", "Philadelphia Eagles", "Pittsburgh Steelers",
        "San Francisco 49ers", "Seattle Seahawks", "Tampa Bay Buccaneers", "Tennessee Titans", "Washington Commanders",
    )
    val cfb = listOf(
        "Alabama", "Arizona", "Arizona State", "Arkansas", "Auburn", "Boise State", "BYU", "Clemson", "Colorado",
        "Florida", "Florida State", "Georgia", "Iowa", "Kansas", "Kansas State", "Kentucky", "Louisville", "LSU",
        "Miami", "Michigan", "Michigan State", "Mississippi State", "Missouri", "NC State", "Nebraska", "Notre Dame",
        "Ohio State", "Oklahoma", "Oklahoma State", "Ole Miss", "Oregon", "Penn State", "South Carolina", "Tennessee",
        "Texas", "Texas A&M", "USC", "Utah", "Virginia Tech", "Washington", "West Virginia", "Wisconsin",
    )
    fun teams(sport: Sport) = if (sport == Sport.NFL) nfl else cfb
    fun slug(team: String) = team.lowercase().replace("&", "and").replace(Regex("[^a-z0-9]+"), "-").trim('-')
}
