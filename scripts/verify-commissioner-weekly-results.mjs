import fs from "node:fs";

const lib = fs.readFileSync("src/lib/weekly-results-share.ts", "utf8");
const page = fs.readFileSync("src/app/commissioner-plus/results/page.tsx", "utf8");
const ops = fs.readFileSync("src/app/week-ops/WeekOpsClient.tsx", "utf8");

function expect(value, message) { if (!value) throw new Error(message); }
expect(lib.includes("weekCrownAndShame") && lib.includes("rankPlayersWithSwings"), "Share card must use canonical scored truth.");
expect(lib.includes("players.filter((player) => !player.isMock)"), "Mock players must never enter a real share card.");
expect(page.includes("if (!isOps())"), "Weekly results preview must be commissioner/deputy gated.");
expect(page.includes("never reveals anyone&apos;s picks"), "Preview must state its pick-privacy boundary.");
expect(!lib.includes("pick_games") && !lib.includes("prop_choice"), "Share card must not fetch or expose picks.");
expect(ops.includes('href="/commissioner-plus/results"'), "Scoring completion must offer the results preview.");
expect(page.indexOf("Share this card") < page.indexOf("alt={`${model.leagueName}"), "Share control must appear above the tall mobile preview.");
console.log("Commissioner weekly results verified: real scores · ops only · no pick leakage · share path wired");
