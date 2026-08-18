import assert from "node:assert/strict";
import {
  calculateDeploymentCredit,
  calculateDeploymentCreditWeek,
} from "../src/lib/deployment-credit.ts";

function scores(values) {
  return values.map((score) => ({ score, submitted: true, isBot: false }));
}

const twenty = calculateDeploymentCreditWeek(3, scores([
  6, 9, 11, 12, 13, 14, 15, 16, 17, 18,
  19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
]));
assert.equal(twenty.bottomCount, 3, "20 players uses bottom 3");
assert.deepEqual(twenty.bottomScores, [6, 9, 11]);
assert.equal(twenty.credit, 8, "floors the bottom-three average");

const excluded = calculateDeploymentCreditWeek(4, [
  ...scores([0, 7, 10, 13, 16, 19]),
  { score: 2, submitted: false, isBot: false },
  { score: 1, submitted: true, isBot: true },
  { score: null, submitted: true, isBot: false },
]);
assert.deepEqual(excluded.qualifyingScores, [7, 10, 13, 16, 19]);
assert.equal(excluded.bottomCount, 1);
assert.equal(excluded.credit, 7);

assert.equal(calculateDeploymentCreditWeek(5, []).credit, 0);
assert.equal(calculateDeploymentCreditWeek(5, scores([0, 0])).credit, 0);
assert.equal(calculateDeploymentCreditWeek(5, scores([12])).credit, 12);
assert.equal(calculateDeploymentCreditWeek(5, scores([5, 5, 20, 20])).credit, 5);

const season = calculateDeploymentCredit([
  { weekNumber: 2, scores: scores([10, 18, 20, 22, 24, 26, 28]) },
  { weekNumber: 0, scores: scores([8, 14, 18, 20, 22, 24, 26]) },
  { weekNumber: 1, scores: scores([9, 16, 18, 20, 22, 24, 26]) },
]);
assert.deepEqual(season.weeks.map((week) => week.weekNumber), [0, 1, 2]);
assert.deepEqual(season.weeks.map((week) => week.credit), [11, 12, 14]);
assert.equal(season.total, 37, "rounds each week before summing");

console.log("Deployment Credit fixtures PASS");
