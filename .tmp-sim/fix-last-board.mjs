import fs from "fs";

const p = "src/app/picks/PicksClient.tsx";
let c = fs.readFileSync(p, "utf8");
const nl = c.includes("\r\n") ? "\r\n" : "\n";

const startMarker = "            {weekEditable &&";
const midMarker = "trustedScoredWeeks.length > 0 && (";
const endMarker = "See last week&apos;s Board →";

const endIdx = c.indexOf(endMarker);
if (endIdx < 0) {
  console.error("end not found");
  process.exit(1);
}

// Walk back to the opening of this conditional
const before = c.lastIndexOf(startMarker, endIdx);
if (before < 0) {
  console.error("start not found");
  process.exit(1);
}

// Ensure this is the trustedScoredWeeks block
const chunkCheck = c.slice(before, endIdx);
if (!chunkCheck.includes(midMarker)) {
  console.error("wrong block");
  process.exit(1);
}

// Find closing after the link div: `)}` after </div>
const afterEnd = c.indexOf(")}", endIdx);
if (afterEnd < 0) {
  console.error("close not found");
  process.exit(1);
}
const closeEnd = afterEnd + 2;

const replacement = [
  "            {(() => {",
  "              // Only when a real prior week exists — never Week 0 with no",
  "              // history. No disabled state, no placeholder strip.",
  "              const priorScored = trustedScoredWeeks",
  "                .filter((w) => Number.isFinite(w) && w < viewWeek)",
  "                .sort((a, b) => a - b);",
  "              const lastReviewable = priorScored[priorScored.length - 1];",
  "              if (",
  "                !weekEditable ||",
  "                isCardLockDeadlinePassed(games, now) ||",
  "                viewWeek < 1 ||",
  "                lastReviewable == null",
  "              ) {",
  "                return null;",
  "              }",
  "              return (",
  '                <div className="mb-4 rounded-lg border border-border bg-card-hover px-4 py-2 text-sm">',
  "                  <Link",
  "                    href={`/board?week=${lastReviewable}`}",
  '                    className="text-primary font-semibold hover:underline"',
  "                  >",
  "                    See last week&apos;s Board →",
  "                  </Link>",
  "                </div>",
  "              );",
  "            })()}",
].join(nl);

c = c.slice(0, before) + replacement + c.slice(closeEnd);
fs.writeFileSync(p, c, "utf8");
console.log("replaced", before, "->", closeEnd);
