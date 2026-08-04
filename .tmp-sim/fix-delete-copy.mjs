import fs from "fs";

const p = "src/app/account/page.tsx";
let c = fs.readFileSync(p, "utf8");

const a = "on empty practice rooms or before the season is real.";
const a2 =
  "Only empty solo rooms with no history. Real leagues belong to the community.";
if (c.includes(a)) c = c.replace(a, a2);

c = c.replace("Yes, delete forever", "Yes, delete empty room");

const b =
  "Nobody is forced to be commissioner\n                  </strong>\n                  . When someone wants to jump in so the room can keep running\n                  week to week, pass them the keys. You stay as a player. Trophy\n                  Room stays with the league.";
const bCrlf = b.replace(/\n/g, "\r\n");
const bNew =
  "The league belongs to the community\n                  </strong>\n                  — not the commissioner. Nobody is forced to host. Pass the\n                  keys when someone is ready. History, trophies, and Gazette stay\n                  with the room. League retirement will be a community vote later\n                  — never one click erase.";
const bNewCrlf = bNew.replace(/\n/g, "\r\n");

if (c.includes(b)) c = c.replace(b, bNew);
else if (c.includes(bCrlf)) c = c.replace(bCrlf, bNewCrlf);
else {
  // fallback: single-line-ish
  c = c.replace(
    "Nobody is forced to be commissioner",
    "The league belongs to the community"
  );
  c = c.replace(
    "When someone wants to jump in so the room can keep running\n                  week to week, pass them the keys. You stay as a player. Trophy\n                  Room stays with the league.",
    "Not the commissioner. Nobody is forced to host. Pass the keys when someone is ready. History stays with the room. Retirement is a community vote later — never one-click erase."
  );
  c = c.replace(
    "When someone wants to jump in so the room can keep running\r\n                  week to week, pass them the keys. You stay as a player. Trophy\r\n                  Room stays with the league.",
    "Not the commissioner. Nobody is forced to host. Pass the keys when someone is ready. History stays with the room. Retirement is a community vote later — never one-click erase."
  );
}

// title when blocked
c = c.replace(
  ': "Keep the team together"}',
  ': "The league stays open"}'
);

fs.writeFileSync(p, c, "utf8");
console.log({
  emptyRoom: c.includes("Yes, delete empty room"),
  community: c.includes("belongs to the community"),
  stays: c.includes("The league stays open"),
});
