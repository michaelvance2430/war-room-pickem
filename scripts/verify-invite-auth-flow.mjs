import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const login = readFileSync("src/app/login/page.tsx", "utf8");
const join = readFileSync("src/app/join/page.tsx", "utf8");

assert.match(
  login,
  /const code =[\s\S]*?if \(code\) \{\s*stashPendingJoinCode\(code\);\s*\}/,
  "login must preserve an invite code without forcing account creation"
);
assert.match(
  login,
  /next \|\|\s*\(code \? `\/join\?code=\$\{encodeURIComponent\(code\)\}` : "\/"\)/,
  "login must return to the invite join URL after authentication"
);
assert.match(
  join,
  /`\/login\?next=\$\{encodeURIComponent\(`\/join\?code=\$\{q\.trim\(\)\.toUpperCase\(\)\}`\)\}`/,
  "join must carry the normalized invite URL through authentication"
);

console.log("invite auth flow contract verified");
