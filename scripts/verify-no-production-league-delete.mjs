/**
 * Assert production UI / app-layer cannot delete leagues.
 */
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
const commish = read("src/app/commissioner/CommissionerClient.tsx");
const del = read("src/lib/session-restore.ts");
const admin = read("src/lib/admin-test-cleanup.ts");
const founder = read("src/app/founder/page.tsx");

assert(!account.includes("Delete league"), "1 Account: no Delete league label");
assert(!account.includes("deleteModal"), "2 Account: no delete modal");
assert(!account.includes("confirmHardDelete"), "3 Account: no hard delete");
assert(account.includes("leaveLeague"), "4 Account: Leave preserved");

assert(!manage.includes("Delete league"), "5 Manage League: no Delete league");
assert(!manage.includes("handleDeleteLeague"), "6 Manage League: no handleDelete");
assert(!manage.includes("resetLeague"), "7 Manage League: no resetLeague import");
assert(manage.includes("League history is preserved"), "8 Manage: preserve copy");

assert(
  !commish.includes("Delete league and reset app"),
  "9 CommissionerClient: no delete reset button"
);
assert(!/\bonClick=\{handleReset\}/.test(commish), "10 no handleReset click");

const delFn = del.slice(
  del.indexOf("export async function deleteLeague"),
  del.indexOf("export async function deleteLeague") + 500
);
assert(
  delFn.includes("ok: false") && !delFn.includes('.from("leagues").delete'),
  "11 deleteLeague fails closed without Supabase DELETE"
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
