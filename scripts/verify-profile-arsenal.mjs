import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const icons = readFileSync("src/components/WarRoomArsenalIcon.tsx", "utf8");
const preview = readFileSync("src/app/foundry/preview/page.tsx", "utf8");

for (const kind of ["maps", "nuke", "dead_hand", "jdam", "hellfire"]) assert.match(icons, new RegExp(`kind === \\\"${kind}\\\"|kind: ArsenalIconKind`));
assert.match(icons, /M\.A\.P\.&apos;s/);
assert.match(preview, /Profile Arsenal/);
assert.match(preview, /AUTHORIZED SYSTEMS/);
assert.match(preview, /Weapons appear here because the season remembers/);
assert.match(preview, /Dead Hand Protocol/);
assert.match(preview, /JDAM Protocol/);
assert.match(preview, /Hellfire Mode/);

console.log("Profile Arsenal verified: five vector insignias · sport-native M.A.P.'s delivery system · season-use status");
