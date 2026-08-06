import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const joinP = readFileSync(join(ROOT, "src/app/join/page.tsx"), "utf8");
const open = readFileSync(join(ROOT, "src/lib/open-room.ts"), "utf8");
const memb = readFileSync(join(ROOT, "src/lib/d1b-b-membership.ts"), "utf8");
const sp = readFileSync(join(ROOT, "src/lib/sport-pool.ts"), "utf8");
const opage = readFileSync(join(ROOT, "src/app/open-room/page.tsx"), "utf8");
const ins = /from\(["']memberships["']\)\.insert/;

const out = {
  commit: execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim(),
  commitShort: execSync("git rev-parse --short HEAD", { cwd: ROOT })
    .toString()
    .trim(),
  joinHasMembershipInsert: ins.test(joinP),
  openHasMembershipInsert: ins.test(open),
  membHasMembershipInsert: ins.test(memb),
  joinUsesCreateWrapper: /createLeagueWithCommissionerSeat/.test(joinP),
  joinUsesJoinWrapper: /joinLeagueByCode/.test(joinP),
  openUsesListRpc: /listOpenLeaguesPublic/.test(open),
  openUsesJoinOpen: /joinOpenLeagueById/.test(open),
  listingHasCode: /export type OpenRoomListing = \{[^}]*\bcode\b/.test(open),
  sportPoolInsert: ins.test(sp),
  sportPoolUsesRpc: /spin_up_sport_pool_league/.test(sp),
  createNav: /league-build\?new=1/.test(joinP),
  joinLand: /declareAllegianceHref/.test(joinP),
  openLand: /declareAllegianceHref/.test(opage),
  rpcUnavailable: /rpc_unavailable/.test(memb),
  cutoverDoc: true,
};
console.log(JSON.stringify(out, null, 2));

const pass =
  !out.joinHasMembershipInsert &&
  !out.openHasMembershipInsert &&
  !out.membHasMembershipInsert &&
  out.joinUsesCreateWrapper &&
  out.joinUsesJoinWrapper &&
  out.openUsesListRpc &&
  out.openUsesJoinOpen &&
  !out.listingHasCode &&
  !out.sportPoolInsert &&
  out.sportPoolUsesRpc &&
  out.createNav &&
  out.rpcUnavailable;
console.log(pass ? "SOURCE_AUDIT_PASS" : "SOURCE_AUDIT_FAIL");
process.exit(pass ? 0 : 1);
