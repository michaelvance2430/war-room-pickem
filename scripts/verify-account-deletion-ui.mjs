import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function assert(condition, message) {
  if (!condition) throw new Error(`[account-deletion-ui] ${message}`);
}

const contract = read("src/lib/account-lifecycle-contract.ts");
const account = read("src/app/account/page.tsx");
const panel = read("src/components/AccountDeletionPanel.tsx");
const foundry = read("src/components/AccountDeletionFoundryProof.tsx");
const route = read("src/app/api/account/delete/route.ts");

assert(contract.includes("ACCOUNT_LIFECYCLE_PUBLIC = false"), "public gate opened early");
assert(account.includes("ACCOUNT_LIFECYCLE_PUBLIC &&"), "Account entry is not gated");
assert(route.includes('ACCOUNT_DELETION_ENABLED !== "true"'), "server environment gate missing");
assert(panel.includes('const CONFIRMATION = "BURN THE DOSSIER"'), "exact confirmation missing");
assert(panel.includes('autoComplete="current-password"'), "password reauthentication field missing");
assert(panel.includes("Pass the Keys first"), "commissioner transfer gate missing");
assert(panel.includes("Picks, standings, trophies, brackets"), "preserved receipt copy missing");
assert(panel.includes('fetch("/api/account/delete"'), "deletion UI bypasses protected route");
assert(panel.includes("previewState") && panel.includes("if (isPreview) return"), "Foundry preview can call destructive path");
assert(foundry.includes('"eligible"') && foundry.includes('"commissioner"') && foundry.includes('"failed"'), "Foundry proof matrix incomplete");
assert(foundry.includes("public Account entry") && foundry.includes("remain sealed"), "Foundry does not state dark boundary");

console.log("[account-deletion-ui] PASS — dark gate, Pass the Keys, confirmation, and Foundry repair states verified");
