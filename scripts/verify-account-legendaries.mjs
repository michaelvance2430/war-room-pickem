import fs from "node:fs";

const grants = fs.readFileSync("src/lib/legacy-badge-grants.ts", "utf8");
const season = fs.readFileSync("src/lib/season-mode.ts", "utf8");

const assignments = [
  ["two_wolves_of_prestige", "463700da-a4cd-4e82-a0a5-f46ee08acff2", "PRESTIGE_WORLDWIDE_USER_IDS"],
  ["built_different_olympian", "c2b807c8-eb6d-4a15-8acc-0872af50f85a", "ROB_HARBISON_USER_IDS"],
  ["the_816_archivist", "9e579623-23b7-4f0b-9ae6-683e50bae1dc", "KAHMANN_USER_IDS"],
];

for (const [badgeId, userId, pinName] of assignments) {
  if (!grants.includes(userId)) throw new Error(`${badgeId}: missing account UUID pin`);
  if (!grants.includes(`userIds: ${pinName}`)) throw new Error(`${badgeId}: pin is not connected to grant`);
  if (!season.includes(`"${badgeId}"`)) throw new Error(`${badgeId}: missing preseason protection`);
}

console.log("Account legendaries verified: 3 UUID pins · 3 protected one-of-one grants");
