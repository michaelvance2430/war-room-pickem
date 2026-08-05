/**
 * Pure planner verification for Auto Balance (no Supabase, no production writes).
 * Run: node scripts/verify-auto-balance-planner.mjs
 */
import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";
import { fileURLToPath } from "url";

// Compile-free: reimplement thin wrappers by dynamic import of ts via tsx if available,
// else inline-copy the pure algorithms for verification.
// Prefer importing built logic through ts-node/tsx when present.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

async function loadPlanner() {
  // Try tsx/ts-node register paths — fall back to transpile-less duplicate of pure API
  // by spawning tsc isn't available. Inline the algorithms from source by eval is bad.
  // Use dynamic import of .ts via next's not available.
  // Simplest reliable path: re-require through jiti if installed, else inline.

  try {
    const { createJiti } = await import("jiti");
    const jiti = createJiti(import.meta.url);
    return jiti(path.join(root, "src/lib/divisions.ts"));
  } catch {
    /* fall through */
  }

  try {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line
    require("tsx/cjs");
    return require(path.join(root, "src/lib/divisions.ts"));
  } catch {
    /* fall through */
  }

  // Inline minimal copy matching divisions.ts (kept in sync for CI without tsx)
  return await import(pathToFileURL(path.join(root, "scripts/_balance-planner-inline.mjs")).href);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function fmt(counts) {
  return ["North", "South", "East", "West"].map((d) => counts[d]).join("/");
}

function makeRoster(countsByDiv, invalid = 0) {
  const members = [];
  let i = 0;
  for (const [div, n] of Object.entries(countsByDiv)) {
    for (let k = 0; k < n; k++) {
      members.push({ id: `m${String(i).padStart(3, "0")}`, division: div });
      i++;
    }
  }
  for (let k = 0; k < invalid; k++) {
    members.push({ id: `m${String(i).padStart(3, "0")}`, division: null });
    i++;
  }
  return members;
}

async function main() {
  const d = await loadPlanner();
  const {
    planMinMoveBalance,
    conferenceTotals,
    fourWayMaxMinDiff,
    isLeagueDivisionBalanced,
    formatDivisionCounts,
  } = d;

  const results = [];

  function run(name, members, sportId, checks) {
    const plan = planMinMoveBalance(members, { sportId });
    const line = {
      name,
      n: members.length,
      sportId,
      before: formatDivisionCounts(plan.beforeCounts),
      after: formatDivisionCounts(plan.afterCounts),
      moves: plan.moveCount,
      already: plan.alreadyBalanced,
    };
    checks(plan, line);
    results.push(line);
    console.log(
      `✓ ${name}: ${line.before} → ${line.after} moves=${line.moves} already=${line.already}`
    );
  }

  // 26 at 10/6/5/5 NFL → conference 13/13, four-way 7/7/6/6 ordering, min moves
  run(
    "26 10/6/5/5 NFL",
    makeRoster({ North: 10, South: 6, East: 5, West: 5 }),
    "nfl",
    (plan) => {
      assert(plan.moveCount > 0 && plan.moveCount < 26, "should min-move not full reshuffle");
      assert(fourWayMaxMinDiff(plan.afterCounts) <= 1, "four-way");
      const { afc, nfc } = conferenceTotals(plan.afterCounts);
      assert(afc === 13 && nfc === 13, `conf ${afc}/${nfc}`);
      assert(
        isLeagueDivisionBalanced(plan.afterCounts, 26, { sportId: "nfl" }),
        "balanced"
      );
      // Must not be 7/7/6/6 with AFC 14
      assert(!(plan.afterCounts.North === 7 && plan.afterCounts.South === 7), "no AFC 14");
    }
  );

  // 26 already valid conference-balanced → 0 moves
  run(
    "26 already 7/6/7/6 NFL",
    makeRoster({ North: 7, South: 6, East: 7, West: 6 }),
    "nfl",
    (plan) => {
      assert(plan.moveCount === 0, "zero moves");
      assert(plan.alreadyBalanced, "already");
    }
  );

  // 26 CFB 10/6/5/5 → 7/7/6/6 any order
  run(
    "26 10/6/5/5 CFB",
    makeRoster({ North: 10, South: 6, East: 5, West: 5 }),
    "cfb",
    (plan) => {
      assert(fourWayMaxMinDiff(plan.afterCounts) <= 1, "four-way");
      assert(plan.moveCount < 26, "min moves");
      const sizes = Object.values(plan.afterCounts).sort((a, b) => b - a);
      assert(sizes.join(",") === "7,7,6,6", sizes.join(","));
    }
  );

  // 25
  run(
    "25 uneven NFL",
    makeRoster({ North: 10, South: 5, East: 5, West: 5 }),
    "nfl",
    (plan) => {
      assert(fourWayMaxMinDiff(plan.afterCounts) <= 1, "four-way");
      const { afc, nfc } = conferenceTotals(plan.afterCounts);
      assert(Math.abs(afc - nfc) <= 1, `conf ${afc}/${nfc}`);
      assert(afc + nfc === 25, "sum");
    }
  );

  // 24 → 6/6/6/6
  run(
    "24 square",
    makeRoster({ North: 9, South: 5, East: 5, West: 5 }),
    "nfl",
    (plan) => {
      assert(
        Object.values(plan.afterCounts).every((x) => x === 6),
        "all 6"
      );
    }
  );

  // 27
  run(
    "27 NFL",
    makeRoster({ North: 12, South: 5, East: 5, West: 5 }),
    "nfl",
    (plan) => {
      assert(fourWayMaxMinDiff(plan.afterCounts) <= 1, "four-way");
      const { afc, nfc } = conferenceTotals(plan.afterCounts);
      assert(Math.abs(afc - nfc) <= 1, `conf ${afc}/${nfc}`);
    }
  );

  // 3
  run(
    "3 members",
    makeRoster({ North: 3, South: 0, East: 0, West: 0 }),
    "cfb",
    (plan) => {
      assert(fourWayMaxMinDiff(plan.afterCounts) <= 1, "four-way");
      assert(
        Object.values(plan.afterCounts).filter((x) => x === 1).length === 3,
        "three ones"
      );
    }
  );

  // 1
  run(
    "1 member",
    makeRoster({ North: 1, South: 0, East: 0, West: 0 }),
    "cfb",
    (plan) => {
      assert(plan.afterCounts.North + plan.afterCounts.South + plan.afterCounts.East + plan.afterCounts.West === 1, "one");
      assert(plan.moveCount === 0, "already in north keeps");
    }
  );

  // Unassigned
  run(
    "unassigned 4",
    [
      { id: "a", division: null },
      { id: "b", division: null },
      { id: "c", division: null },
      { id: "d", division: null },
    ],
    "cfb",
    (plan) => {
      assert(plan.moveCount === 4, "all assigned");
      assert(Object.values(plan.afterCounts).every((x) => x === 1), "1 each");
    }
  );

  // Invalid corrected
  run(
    "invalid string",
    [
      { id: "a", division: "Nope" },
      { id: "b", division: "North" },
      { id: "c", division: "South" },
      { id: "d", division: "East" },
    ],
    "cfb",
    (plan) => {
      assert(plan.assignments.every((a) => ["North", "South", "East", "West"].includes(a.division)), "valid");
      assert(fourWayMaxMinDiff(plan.afterCounts) <= 1, "four-way");
    }
  );

  // Duplicate names irrelevant — id deterministic
  run(
    "dup names ids",
    [
      { id: "z-id", division: "North" },
      { id: "a-id", division: "North" },
      { id: "m-id", division: "North" },
      { id: "b-id", division: "North" },
    ],
    "cfb",
    (plan) => {
      assert(plan.assignments.length === 4, "4");
      // lowest ids kept preferentially in overfull North when filling
      assert(fourWayMaxMinDiff(plan.afterCounts) <= 1, "four-way");
    }
  );

  // All surplus in one group
  run(
    "all in West 26",
    makeRoster({ North: 0, South: 0, East: 0, West: 26 }),
    "nfl",
    (plan) => {
      const { afc, nfc } = conferenceTotals(plan.afterCounts);
      assert(afc === 13 && nfc === 13, "13/13");
      assert(fourWayMaxMinDiff(plan.afterCounts) <= 1, "four-way");
    }
  );

  // Four-way balanced but conference-unbalanced (7/7/6/6 AFC14)
  run(
    "conf fix 7/7/6/6 NFL",
    makeRoster({ North: 7, South: 7, East: 6, West: 6 }),
    "nfl",
    (plan) => {
      assert(plan.moveCount > 0, "must move for conf");
      const { afc, nfc } = conferenceTotals(plan.afterCounts);
      assert(afc === 13 && nfc === 13, `conf ${afc}/${nfc}`);
      assert(fourWayMaxMinDiff(plan.afterCounts) <= 1, "four-way");
    }
  );

  console.log("\nAll planner checks passed.");
  console.log(
    "Sample 10/6/5/5 NFL moves:",
    results.find((r) => r.name.startsWith("26 10/6/5/5 NFL"))?.moves
  );
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
