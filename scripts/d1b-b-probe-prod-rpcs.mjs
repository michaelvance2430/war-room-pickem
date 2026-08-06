import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      const k = l.slice(0, i).trim();
      let v = l.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return [k, v];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ref = (url || "").match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
console.log("PROD_REF", ref);
if (ref !== "dorhjepugsjpmnuzdzck") {
  console.error("Unexpected prod ref");
  process.exit(2);
}
const c = createClient(url, key, { auth: { persistSession: false } });
const rpcs = [
  ["create_league_with_commissioner_seat", { p_name: "x", p_sport_id: "cfb" }],
  ["join_league_by_code", { p_code: "XXXXXX" }],
  [
    "join_open_league_by_id",
    { p_league_id: "00000000-0000-0000-0000-000000000001" },
  ],
  ["list_open_leagues_public", { p_sport_id: null, p_limit: 1 }],
];
let missing = 0;
for (const [fn, args] of rpcs) {
  const { error } = await c.rpc(fn, args);
  const msg = error?.message || "ok-or-empty";
  const code = error?.code || "";
  const isMissing =
    code === "PGRST202" || /could not find the function|schema cache/i.test(msg);
  const status = isMissing ? "MISSING" : "PRESENT";
  if (isMissing) missing++;
  console.log(fn, status, code || "-", msg.slice(0, 140));
}
process.exit(missing ? 1 : 0);
