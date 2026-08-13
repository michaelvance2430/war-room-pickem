import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("src/app/page.tsx", "utf8");
const preview = readFileSync("src/components/CommissionerPlusPreview.tsx", "utf8");
const detail = readFileSync("src/app/commissioner-plus/page.tsx", "utf8");
const offer = readFileSync("src/lib/commissioner-plus.ts", "utf8");
const contract = readFileSync("src/lib/plus-contract.ts", "utf8");

assert.match(home, /\{actuallyCommish && <CommissionerPlusPreview \/>\}/, "Home preview must be limited to the actual commissioner");
assert.match(preview, /Not available for purchase/, "Home preview must clearly remain unavailable");
assert.match(detail, /Purchases are disabled/, "detail page must not imply checkout is active");
assert.match(offer, /COMMISSIONER_PLUS_PRICE = "\$19\.99"/, "offer must use the planned sports-season price");
assert.match(offer, /College Football \+ NFL/, "football pass must cover college and pro football");
assert.match(offer, /College Basketball \+ March Madness \+ NBA \+ WNBA/, "basketball pass must cover the full basketball family");
assert.match(detail, /Choose the season—not a subscription/, "offer must be framed as a sports-season pass");
for (const pillar of ["Automation", "League Identity", "Bigger Moments", "League Legacy"]) {
  assert.match(offer, new RegExp(`title: "${pillar}"`), `offer must include ${pillar}`);
}
assert.match(contract, /COMMISSIONER_PLUS_PUBLIC = false/, "Commissioner Plus must remain inactive");
assert.doesNotMatch(`${preview}\n${detail}`, /checkout|buy now|subscribe/i, "preview surfaces must not expose a purchase action");
assert.match(detail, /No extra points, late picks, extra weapons, or paid advantage/, "competitive fairness promise must remain explicit");

console.log("Commissioner Plus preview contract verified");
