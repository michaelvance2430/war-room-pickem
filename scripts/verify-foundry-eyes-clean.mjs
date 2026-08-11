import fs from "node:fs";

const nav = fs.readFileSync("src/components/Nav.tsx", "utf8");
const chrome = fs.readFileSync(
  "src/components/FoundrySessionChrome.tsx",
  "utf8"
);

const checks = [
  [
    !nav.includes("PREVIEW (local card"),
    "creator preview banner is absent from player navigation",
  ],
  [
    !nav.includes("exit → Foundry"),
    "Foundry exit language is absent from the player surface",
  ],
  [
    nav.includes("Exit player preview"),
    "eyes exit remains available inside the ordinary You menu",
  ],
  [
    chrome.includes('e === "off" && isFoundrySessionSticky()'),
    "sticky Foundry chrome is suppressed while Eyes mode is active",
  ],
  [
    nav.includes("playerPreview && !eyesLabel"),
    "commissioner preview labels are suppressed during Eyes mode",
  ],
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
