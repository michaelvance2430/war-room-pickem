/**
 * Fair Entry percentile parity fixtures — TypeScript side.
 * Run: node scripts/verify-fair-entry-parity.mjs
 * Compare against SQL d1b_b_percentile_value / band selection on disposable DB.
 *
 * REVIEW ONLY — no production side effects.
 */

/** Mirror of fair-entry.ts percentileValue */
function percentileValue(values, percentile) {
  if (!values.length) return 0;
  const s = [...values].map((v) => Number(v) || 0).sort((a, b) => a - b);
  if (s.length === 1) return Math.round(s[0]);
  const p = Math.min(100, Math.max(0, percentile));
  const rank = (p / 100) * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return Math.round(s[lo]);
  const v = s[lo] + (s[hi] - s[lo]) * (rank - lo);
  return Math.round(v);
}

const FAIR_ENTRY_BANDS = [
  { id: "1-2", minScored: 1, maxScored: 2, percentile: 75 },
  { id: "3-4", minScored: 3, maxScored: 4, percentile: 60 },
  { id: "5-6", minScored: 5, maxScored: 6, percentile: 50 },
  { id: "7-8", minScored: 7, maxScored: 8, percentile: 30 },
  { id: "9+", minScored: 9, maxScored: Infinity, percentile: 15 },
];

function bandForLatestScoredWeek(latest) {
  if (latest == null || !Number.isFinite(latest) || latest < 1) return null;
  for (const b of FAIR_ENTRY_BANDS) {
    if (latest >= b.minScored && latest <= b.maxScored) return b;
  }
  return FAIR_ENTRY_BANDS[FAIR_ENTRY_BANDS.length - 1];
}

/** Fixtures: same inputs → expected points (SQL must match) */
export const FIXTURES = [
  { id: "empty", values: [], pct: 75, expect: 0 },
  { id: "one-zero", values: [0], pct: 75, expect: 0 },
  { id: "one-positive", values: [42], pct: 75, expect: 42 },
  { id: "two-p50", values: [0, 100], pct: 50, expect: 50 },
  { id: "two-p75", values: [0, 100], pct: 75, expect: 75 },
  { id: "two-p0", values: [10, 90], pct: 0, expect: 10 },
  { id: "two-p100", values: [10, 90], pct: 100, expect: 90 },
  { id: "multi-p75", values: [0, 10, 20, 40], pct: 75, expect: 25 },
  { id: "all-equal", values: [15, 15, 15, 15], pct: 60, expect: 15 },
  { id: "ties", values: [5, 5, 20, 20], pct: 50, expect: 12 },
  { id: "bot-ignored-input", values: [0, 100], pct: 75, expect: 75 }, // bots already filtered before call
  { id: "negative-coerced", values: [-5, 10], pct: 50, expect: 3 }, // Number(-5)||0 → -5 in TS? Number(-5)||0 is -5 because -5 is truthy
];

// Clarify negative: Number(-5) || 0 is -5 (truthy). Document as product quirk.
// SQL coalesce(v,0) keeps -5. Match TS: use (v) => Number(v) || 0 which is -5 for -5.

function run() {
  let fail = 0;
  for (const f of FIXTURES) {
    const got = percentileValue(f.values, f.pct);
    const ok = got === f.expect;
    if (!ok) {
      fail++;
      console.error("FAIL", f.id, "got", got, "expect", f.expect);
    } else {
      console.log("PASS", f.id, got);
    }
  }

  // Band selection smoke
  const bandCases = [
    [null, null],
    [0, null],
    [1, "1-2"],
    [2, "1-2"],
    [3, "3-4"],
    [9, "9+"],
    [18, "9+"],
  ];
  for (const [w, id] of bandCases) {
    const b = bandForLatestScoredWeek(w);
    const got = b?.id ?? null;
    if (got !== id) {
      fail++;
      console.error("BAND FAIL", w, got, id);
    } else {
      console.log("BAND PASS", w, got);
    }
  }

  if (fail) {
    console.error("FAILED", fail);
    process.exit(1);
  }
  console.log("All TypeScript fair-entry fixtures PASS");
  console.log(
    "SQL parity: SELECT public.d1b_b_percentile_value(ARRAY[...], pct) on disposable after 02b"
  );
}

run();
