import assert from "node:assert/strict";
import {
  resolveGameLeagueInterest,
  sortGamesByLeagueInterest,
} from "../src/lib/league-favorite-interest.ts";

const nflCounts = {
  "nfl-buf": 2,
  "nfl-nyj": 1,
  "nfl-kc": 3,
};

const billsJets = {
  id: "nfl-1",
  awayTeam: "Buffalo Bills",
  homeTeam: "New York Jets",
  commenceTime: "2026-09-13T17:00:00.000Z",
};
const chiefsRaiders = {
  id: "nfl-2",
  awayTeam: "Kansas City Chiefs",
  homeTeam: "Las Vegas Raiders",
  commenceTime: "2026-09-13T20:00:00.000Z",
};
const neutralNfl = {
  id: "nfl-3",
  awayTeam: "Chicago Bears",
  homeTeam: "Green Bay Packers",
  commenceTime: "2026-09-13T16:00:00.000Z",
};

const nflInterest = resolveGameLeagueInterest(billsJets, nflCounts, "nfl");
assert.equal(nflInterest.away?.matched.name, "Buffalo Bills");
assert.equal(nflInterest.away?.count, 2);
assert.equal(nflInterest.home?.matched.name, "New York Jets");
assert.equal(nflInterest.home?.count, 1);
assert.equal(nflInterest.combined, 3);
assert.equal(nflInterest.bothSides, true);

const sorted = sortGamesByLeagueInterest(
  [neutralNfl, chiefsRaiders, billsJets],
  nflCounts,
  "nfl"
);
assert.equal(sorted[0].id, "nfl-1", "both represented NFL sides sort first");
assert.equal(sorted[1].id, "nfl-2", "one represented NFL side sorts next");
assert.equal(sorted[2].id, "nfl-3", "unrepresented NFL games sort last");

const cfbInterest = resolveGameLeagueInterest(
  {
    id: "cfb-1",
    awayTeam: "Missouri",
    homeTeam: "Alabama",
  },
  { missouri: 2 },
  "cfb"
);
assert.equal(cfbInterest.away?.matched.name, "Missouri");
assert.equal(cfbInterest.combined, 2, "CFB behavior remains intact");

const unsupported = resolveGameLeagueInterest(
  billsJets,
  nflCounts,
  "cbb"
);
assert.equal(unsupported.combined, 0, "sports never share favorite catalogs");

console.log(
  "Football favorite interest verified: NFL + CFB matching, blue-marker counts, and priority sorting"
);
