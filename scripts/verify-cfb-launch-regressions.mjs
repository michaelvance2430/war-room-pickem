import { spawnSync } from "node:child_process";

const checks = [
  ["atomic week scoring", "scripts/verify-atomic-week-rescore.mjs"],
  ["season reset", "scripts/verify-season-reset-v2.mjs"],
  ["Foundry reset", "scripts/verify-foundry-reset-sql.mjs"],
  ["Foundry CFB certification transition", "scripts/verify-foundry-cfb-certification-v2.mjs"],
  ["kickoff locks and reveal", "scripts/verify-lock-clock-surfaces.mjs"],
  ["late-join player lifecycle", "scripts/verify-late-join-lifecycle.mjs", true],
  ["app failure and recovery surfaces", "scripts/verify-app-failure-surfaces.mjs"],
  ["CFB calendar", "scripts/verify-cfb-postseason-calendar.mjs", true],
  ["Weeks 15–20 progression", "scripts/verify-cfb-weeks-15-20.mjs", true],
  ["postseason partition", "scripts/verify-postseason-ps1.mjs", true],
  ["postseason authority", "scripts/verify-postseason-authority-sql.mjs"],
  ["postseason routes", "scripts/verify-postseason-route-retirement.mjs"],
  ["postseason player flow", "scripts/verify-cfb-postseason-player.mjs", true],
  ["postseason commissioner ops", "scripts/verify-cfb-postseason-ops.mjs"],
  ["season closeout", "scripts/verify-cfb-season-closeout.mjs"],
  ["Dispatch contract and archive", "scripts/verify-dispatch-contract.mjs", true],
  ["Dispatch newsroom", "scripts/verify-dispatch-newsroom.mjs", true],
  ["earned badges", "scripts/verify-profile-earned-badges.mjs"],
  ["profile trophies", "scripts/verify-profile-trophy-room.mjs"],
  ["standings hardware", "scripts/verify-standings-permanent-hardware.mjs"],
  ["trophy shapes", "scripts/verify-championship-trophy-shapes.mjs"],
];

for (const [label, file, needsTsx] of checks) {
  const args = needsTsx ? ["--import", "tsx", file] : [file];
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\nCFB launch regression failed: ${label}`);
    process.exit(result.status || 1);
  }
}

console.log(`\nCFB launch regression gate PASS (${checks.length} permanent checks)`);
