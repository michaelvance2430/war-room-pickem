import fs from "fs";

const p = "src/app/picks/PicksClient.tsx";
let c = fs.readFileSync(p, "utf8");

if (c.includes("<LeagueLockTimer")) {
  console.log("already inserted");
  process.exit(0);
}

const marker = "{quietPicks && !practiceMode && weekEditable && hasCard && !cardFrozen && (";
const idx = c.indexOf(marker);
if (idx < 0) {
  console.error("marker not found");
  process.exit(1);
}

const block = `        {/* League Lock Timer — answers "How long do I have left?" before the card */}
        {hasCard && games.length > 0 && (
          <LeagueLockTimer
            games={games}
            hidden={practiceMode || isPastOrOtherWeek || !weekEditable}
          />
        )}

        `;

c = c.slice(0, idx) + block + c.slice(idx);
fs.writeFileSync(p, c, "utf8");
console.log("inserted at", idx);
