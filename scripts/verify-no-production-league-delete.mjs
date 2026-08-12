/** Assert only unused, unplayed leagues expose the guarded delete RPC. */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

let fails = 0;
function assert(c, m) {
  if (!c) {
    console.error("FAIL", m);
    fails++;
  } else console.log("PASS", m);
}

const account = read("src/app/account/page.tsx");
const manage = read("src/app/commissioner/ManageLeagueClient.tsx");
const del = read("src/lib/session-restore.ts");
const admin = read("src/lib/admin-test-cleanup.ts");
const founder = read("src/app/founder/page.tsx");

assert(!account.includes("Delete league"), "1 Account: no Delete league label");
assert(!account.includes("deleteModal"), "2 Account: no delete modal");
assert(!account.includes("confirmHardDelete"), "3 Account: no hard delete");
assert(account.includes("leaveLeague"), "4 Account: Leave preserved");

assert(manage.includes("Delete unused league"), "5 Manage: unused-room cleanup is explicit");
assert(manage.includes("handleDeleteLeague"), "6 Manage: guarded cleanup handler exists");
assert(!manage.includes("resetLeague"), "7 Manage League: no resetLeague import");
assert(manage.includes("Once play begins—or any official history exists—the room is permanent"), "8 Manage: history protection is explicit");

assert(!manage.includes("Delete league and reset app"), "9 Manage: no unguarded delete/reset action");
assert(!/\bonClick=\{handleReset\}/.test(manage), "10 no legacy handleReset click");

const delFn = del.slice(
  del.indexOf("export async function deleteLeague"),
  del.indexOf("export async function deleteLeague") + 1400
);
assert(
  delFn.includes('rpc("delete_unused_league"') &&
    delFn.includes("league_started|history_exists") &&
    !delFn.includes('.from("leagues").delete'),
  "11 deleteLeague delegates to the server-side unused-room guard"
);

assert(
  admin.includes("production freeze") ||
    admin.includes("cannot be deleted from the app"),
  "12 admin scrub will not delete leagues"
);
assert(
  !founder.includes("Scrub + delete solo room"),
  "13 Foundry: no scrub+delete button"
);

// Leave + transfer still present
assert(
  read("src/lib/session-restore.ts").includes("export async function leaveLeague"),
  "14 leaveLeague helper remains"
);
assert(
  read("src/lib/league-delete-guard.ts").includes("passCommissionerForLeague"),
  "15 pass commissioner helper remains"
);

console.log(fails === 0 ? "\nRESULT PASS" : `\nRESULT FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
