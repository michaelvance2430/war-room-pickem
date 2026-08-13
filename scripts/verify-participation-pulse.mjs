import fs from "node:fs";

const cloud = fs.readFileSync("src/lib/cloud.ts", "utf8");
const hero = fs.readFileSync("src/components/HomeWeekHero.tsx", "utf8");
const pulse = fs.readFileSync("src/components/WeeklyParticipationPulse.tsx", "utf8");

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(
  /const complete =\s*!!pick &&\s*!!pick\.locked_at &&/.test(cloud),
  "A filled autosave must not count as complete until it is locked."
);
expect(
  hero.includes("<WeeklyParticipationPulse weekNumber={state.week} games={state.games} />"),
  "Home must render the participation pulse for the published card."
);
expect(
  pulse.includes("countLockedPicksForWeek") && pulse.includes("loadPickSubmissionStatus"),
  "Pulse must use member-safe aggregate truth and the ops-only detail loader."
);
expect(
  pulse.includes("navigator.share") && pulse.includes("/picks"),
  "Commissioner reminder must preserve a direct route to My Picks."
);
expect(
  !pulse.includes("pick_games") && !pulse.includes("prop_choice"),
  "Participation UI must never fetch or expose actual pick choices."
);
expect(
  !pulse.includes('? "Closed" : "Open"'),
  "Open-card status must not render a misleading button-like badge."
);

console.log("Participation pulse regression checks passed.");
