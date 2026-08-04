import fs from "fs";

const p = "src/app/picks/PicksClient.tsx";
let c = fs.readFileSync(p, "utf8");
const nl = c.includes("\r\n") ? "\r\n" : "\n";

const old1 = `                  All picks must be locked before{" "}
                  <strong>{formatCardLockDeadline(games)}</strong>. You never
                  locked. After first kickoff you <strong>cannot</strong> lock.
                  You score <strong>0</strong> this week. No makeups. Gazette
                  may put you on the milk carton.`;

const new1 = `                  {formatCardLockDeadline(games) ? (
                    <>
                      All picks must be locked before{" "}
                      <strong>{formatCardLockDeadline(games)}</strong>. You
                      never locked.
                    </>
                  ) : (
                    <>
                      All picks must be locked before first kickoff. You never
                      locked.
                    </>
                  )}{" "}
                  After first kickoff you <strong>cannot</strong> lock. You
                  score <strong>0</strong> this week. No makeups. Gazette may
                  put you on the milk carton.`;

const old1cr = old1.replace(/\n/g, "\r\n");
const new1cr = new1.replace(/\n/g, "\r\n");
if (c.includes(old1)) c = c.replace(old1, new1);
else if (c.includes(old1cr)) c = c.replace(old1cr, new1cr);
else console.log("block1 not found");

// line around 2364
c = c.replace(
  /before first kickoff \(\{formatCardLockDeadline\(games\)\}\)\\.?/g,
  (m) => {
    console.log("found paren pattern", m);
    return m;
  }
);

// broader: if formatCardLockDeadline empty, avoid ( )
// Find context for line 2364
const idx = c.indexOf("before first kickoff ({formatCardLockDeadline(games)})");
if (idx >= 0) {
  // replace that fragment with a conditional - need more context
  const start = c.lastIndexOf("{", idx);
  // simpler string replace
  c = c.replace(
    "before first kickoff ({formatCardLockDeadline(games)})",
    "before first kickoff{formatCardLockDeadline(games) ? ` (${formatCardLockDeadline(games)})` : \"\"}"
  );
  // Wait that's wrong for JSX. Use template differently.
}

// Re-read and fix 2364 properly with unique surrounding
const marker = "before first kickoff ({formatCardLockDeadline(games)})";
if (c.includes(marker)) {
  // This is inside JSX text or expression - check
  console.log("marker context:", JSON.stringify(c.slice(idx - 80, idx + 100)));
}

fs.writeFileSync(p, c, "utf8");
console.log("done");
