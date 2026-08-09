import assert from "node:assert/strict";
import {
  HOME_TAGLINE_ROTATION_DAYS,
  homeTaglinePresetsForSport,
  resolveRotatingHomeTagline,
} from "../src/lib/home-tagline.ts";

const day = 24 * 60 * 60 * 1000;
const cadence = HOME_TAGLINE_ROTATION_DAYS * day;
const reference = Date.UTC(2026, 7, 9);
const start = Math.floor(reference / cadence) * cadence;
const base = {
  homeTaglineId: "good-teams",
  sportId: "cfb",
  roomKey: "league-alpha",
};

const first = resolveRotatingHomeTagline({ ...base, now: start });
assert.equal(
  resolveRotatingHomeTagline({ ...base, now: start + cadence - 1 }),
  first,
  "motto must remain stable inside the three-day window"
);
assert.notEqual(
  resolveRotatingHomeTagline({
    ...base,
    now: start + cadence,
  }),
  first,
  "motto must advance at the next cadence"
);

const custom = "Built by this room. Nobody else.";
assert.equal(
  resolveRotatingHomeTagline({
    homeTaglineId: "custom",
    homeTaglineCustom: custom,
    sportId: "nfl",
    roomKey: "league-beta",
    now: start + 99 * day,
  }),
  custom,
  "commissioner custom motto must remain pinned"
);

const nflLines = new Set(
  homeTaglinePresetsForSport("nfl")
    .filter((preset) => preset.id !== "custom")
    .map((preset) => preset.text)
);
assert.ok(
  nflLines.has(
    resolveRotatingHomeTagline({
      homeTaglineId: "good-teams",
      sportId: "nfl",
      roomKey: "league-nfl",
      now: start,
    })
  ),
  "NFL rotation must only use NFL voice"
);

console.log("Home motto rotation: 4 passed, 0 failed");
