/**
 * Boundary checks for 2026 CFB Week 0 / Week 1 ET windows.
 * Mirrors season-calendar etStartOfDayMs / etEndOfDayMs + windows.
 * Run: node scripts/verify-cfb-week-boundaries.mjs
 */

function etStartOfDayMs(ymd) {
  let t = Date.parse(`${ymd}T00:00:00-04:00`);
  const et = new Date(t).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  if (et !== ymd) t = Date.parse(`${ymd}T00:00:00-05:00`);
  return t;
}

function etEndOfDayMs(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  next.setUTCDate(next.getUTCDate() + 1);
  const nextYmd = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return etStartOfDayMs(nextYmd) - 1;
}

const W0 = { start: "2026-08-27", end: "2026-09-02" };
const W1 = { start: "2026-09-03", end: "2026-09-07" };

function inWin(iso, win) {
  const t = Date.parse(iso);
  return t >= etStartOfDayMs(win.start) && t <= etEndOfDayMs(win.end);
}

const cases = [
  {
    label: "Aug 26 11:59 PM ET → not W0",
    iso: "2026-08-26T23:59:00-04:00",
    expectW0: false,
    expectW1: false,
  },
  {
    label: "Aug 27 12:00 AM ET → W0",
    iso: "2026-08-27T00:00:00-04:00",
    expectW0: true,
    expectW1: false,
  },
  {
    label: "Aug 29 noon ET → W0",
    iso: "2026-08-29T12:00:00-04:00",
    expectW0: true,
    expectW1: false,
  },
  {
    label: "Sep 2 11:59 PM ET → W0",
    iso: "2026-09-02T23:59:00-04:00",
    expectW0: true,
    expectW1: false,
  },
  {
    label: "Sep 3 12:00 AM ET → W1",
    iso: "2026-09-03T00:00:00-04:00",
    expectW0: false,
    expectW1: true,
  },
  {
    label: "Sep 7 7pm ET → W1",
    iso: "2026-09-07T19:00:00-04:00",
    expectW0: false,
    expectW1: true,
  },
];

let failed = 0;
console.log(
  "W0",
  W0,
  new Date(etStartOfDayMs(W0.start)).toISOString(),
  "→",
  new Date(etEndOfDayMs(W0.end)).toISOString()
);
console.log(
  "W1",
  W1,
  new Date(etStartOfDayMs(W1.start)).toISOString(),
  "→",
  new Date(etEndOfDayMs(W1.end)).toISOString()
);
for (const c of cases) {
  const w0 = inWin(c.iso, W0);
  const w1 = inWin(c.iso, W1);
  const ok = w0 === c.expectW0 && w1 === c.expectW1;
  if (!ok) failed += 1;
  console.log(ok ? "OK " : "FAIL", c.label, { w0, w1, iso: c.iso });
}
if (failed) {
  console.error(`\n${failed} boundary check(s) failed`);
  process.exit(1);
}
console.log("\nAll boundary checks passed");
