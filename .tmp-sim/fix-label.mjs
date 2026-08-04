import fs from "fs";
const p = "src/app/league-build/page.tsx";
let c = fs.readFileSync(p, "utf8");
const next = '{busy ? "Saving room…" : "Save room · build first card →"}';
const re = /\{busy \? "Saving room[^"]*" : "Save room[^"]*"\}/;
if (!re.test(c)) {
  console.log("pattern not found");
  const hits = c.split("\n").filter((l) => l.includes("busy ?"));
  console.log(hits);
  process.exit(1);
}
c = c.replace(re, next);
fs.writeFileSync(p, c, "utf8");
console.log("ok:", next);
