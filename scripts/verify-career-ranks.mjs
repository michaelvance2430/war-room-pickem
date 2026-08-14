import assert from "node:assert/strict";
import { CAREER_RANKS, careerRankByTitleId, resolveCareerRank } from "../src/lib/career-ranks.ts";
import { promotionGazetteDeck } from "../src/lib/career-rank-promotions.ts";

assert.equal(CAREER_RANKS[0].abbreviation, "PVT");
assert.equal(CAREER_RANKS.find((rank) => rank.abbreviation === "CSM")?.name, "Command Sergeant Major");
assert.equal(CAREER_RANKS.find((rank) => rank.abbreviation === "2LT")?.grade, "officer");
assert.equal(CAREER_RANKS[CAREER_RANKS.findIndex((rank) => rank.abbreviation === "CSM") + 1]?.abbreviation, "2LT", "CSM commissions directly to 2LT");
assert.equal(CAREER_RANKS.at(-1)?.name, "Five-Star Field General");
assert.equal(resolveCareerRank({ achievementPoints: 20000, seasons: 0, sports: 5 }).current.abbreviation, "SGT", "senior ranks require seasons");
assert.equal(resolveCareerRank({ achievementPoints: 20000, seasons: 20, sports: 5, tacticalNukes: 1 }).current.name, "Five-Star Field General");
assert.equal(resolveCareerRank({ achievementPoints: 6000, seasons: 8, sports: 3 }).current.abbreviation, "LTC", "COL requires a Tactical Nuke call");
assert.equal(resolveCareerRank({ achievementPoints: 6000, seasons: 8, sports: 3, tacticalNukes: 1 }).current.abbreviation, "COL", "one Tactical Nuke qualifies COL");
assert.equal(resolveCareerRank({ achievementPoints: 180, seasons: 0, sports: 1, minimumRankId: "rank_sgt" }).current.abbreviation, "SGT", "earned ranks never reverse when current points load lower");
assert.equal(careerRankByTitleId("rank_sgt")?.abbreviation, "SGT");
assert.match(promotionGazetteDeck("Mike", careerRankByTitleId("rank_csm"), careerRankByTitleId("rank_2lt")), /adult supervision and a map/);
assert.match(promotionGazetteDeck("Mike", careerRankByTitleId("rank_sgm"), careerRankByTitleId("rank_csm")), /grass has been placed on notice/);
console.log("Career ranks verified: PVT → CSM → 2LT → Five-Star Field General · AP + seasons + multisport gates");
