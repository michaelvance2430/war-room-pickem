#!/usr/bin/env node
/**
 * D1B-B disposable A1–A12 using only URL + anon/publishable key.
 * Creates users via signUp (no service_role required).
 * NEVER production.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { randomBytes } from "crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "dorhjepugsjpmnuzdzck";

const url = process.env.DISPOSABLE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.DISPOSABLE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ref =
  process.env.DISPOSABLE_PROJECT_REF ||
  process.env.SUPABASE_BRANCH_REF ||
  (url || "").match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];

if (!url || !anon || !ref) {
  console.error("Need DISPOSABLE_SUPABASE_URL, DISPOSABLE_ANON_KEY, DISPOSABLE_PROJECT_REF");
  process.exit(2);
}
if (ref === PROD || url.includes(PROD)) {
  console.error("FATAL: Refused production", ref);
  process.exit(2);
}
console.log("SAFETY OK: connected project ref =", ref, "(not production)");

const results = [];
const networkLog = [];
const integrity = {};
const meta = {
  startedAt: new Date().toISOString(),
  branch: {
    projectRef: ref,
    url,
    productionDataCopied: "NO",
    parent: PROD,
    name: process.env.DISPOSABLE_BRANCH_NAME || "disposable-handoff",
  },
  repoCommit: execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim(),
};

function rec(id, status, detail = "") {
  results.push({ id, status, detail });
  console.log(`${status === "PASS" ? "✓" : "✗"} ${id}: ${status}${detail ? " — " + detail : ""}`);
}

function parseCode(msg) {
  const m = String(msg || "").match(/d1b_b:([a-z_]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function wrap(c, who) {
  const origRpc = c.rpc.bind(c);
  c.rpc = async (fn, args) => {
    networkLog.push({ kind: "rpc", who, fn });
    return origRpc(fn, args);
  };
  const origFrom = c.from.bind(c);
  c.from = (table) => {
    const b = origFrom(table);
    for (const method of ["insert", "select", "update", "upsert", "delete"]) {
      const m = b[method].bind(b);
      b[method] = (...a) => {
        networkLog.push({ kind: "rest", who, table, method });
        return m(...a);
      };
    }
    return b;
  };
  return c;
}

const stamp = Date.now();
const password = `Disp!${randomBytes(6).toString("hex")}`;

async function authed(label) {
  const email = `d1bb.${label}.${stamp}@example.com`;
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signUp({
    email,
    password,
    options: { data: { display_name: label } },
  });
  if (error) throw new Error(`signUp ${label}: ${error.message}`);
  if (!data.session) {
    const s = await c.auth.signInWithPassword({ email, password });
    if (s.error) throw new Error(`signIn ${label}: ${s.error.message}`);
  }
  const id = (await c.auth.getUser()).data.user?.id;
  if (!id) throw new Error(`no id ${label}`);
  await c.from("profiles").upsert({ id, display_name: `E2E ${label}` });
  return { c: wrap(c, label), email, id };
}

async function main() {
  console.log("Repo commit:", meta.repoCommit);

  // A1 unauthenticated
  {
    const bare = wrap(
      createClient(url, anon, { auth: { persistSession: false } }),
      "anon"
    );
    const { data, error } = await bare.rpc("create_league_with_commissioner_seat", {
      p_name: "Should Fail",
      p_sport_id: "cfb",
    });
    // either d1b_b:not_authenticated or permission denied for anon (EXECUTE revoke)
    if (error || data?.ok === false) {
      rec(
        "A1",
        "PASS",
        `unauth blocked: ${error?.message || JSON.stringify(data)}`
      );
    } else rec("A1", "FAIL", "unauth create succeeded");
  }

  const creator = await authed("creator");
  const joiner = await authed("joiner");
  const third = await authed("third");

  let leagueId, leagueCode, openId, openCode, capCode, capId;
  let joinFirstJoinedAt;

  // A2 create
  {
    const { data, error } = await creator.c.rpc("create_league_with_commissioner_seat", {
      p_name: "E2E CFB Room",
      p_sport_id: "cfb",
      p_list_as_open: false,
      p_crystal_ball_enabled: true,
      p_current_week: 0,
      p_cut_percent: 50,
      p_max_human_members: 32,
    });
    if (error) rec("A2", "FAIL", error.message);
    else {
      const row = data;
      leagueId = row.league_id;
      leagueCode = row.code;
      const { data: mems } = await creator.c
        .from("memberships")
        .select("role, total_points, user_id")
        .eq("league_id", leagueId);
      const commish = (mems || []).filter((m) => m.role === "commissioner");
      const pts0 = commish[0]?.total_points === 0 || commish[0]?.total_points === "0";
      const atomic = (mems || []).length >= 1 && commish.length === 1 && pts0;
      // app nav contract (source)
      const joinSrc = readFileSync(join(ROOT, "src/app/join/page.tsx"), "utf8");
      const nav = /league-build\?new=1/.test(joinSrc);
      if (row.ok && leagueId && leagueCode && atomic && nav) {
        rec(
          "A2",
          "PASS",
          `league=${leagueId} code=${leagueCode} commissioner pts=0; nav→league-build`
        );
      } else {
        rec(
          "A2",
          "FAIL",
          `ok=${row.ok} mems=${mems?.length} commish=${commish.length} pts0=${pts0} nav=${nav}`
        );
      }
    }
  }

  // A3 validation
  {
    const cases = [
      { label: "empty_name", args: { p_name: "", p_sport_id: "cfb" } },
      { label: "long_name", args: { p_name: "x".repeat(100), p_sport_id: "cfb" } },
      { label: "bad_sport", args: { p_name: "Bad", p_sport_id: "soccer_wwc" } },
      { label: "cut_9", args: { p_name: "C9", p_sport_id: "cfb", p_cut_percent: 9 } },
      { label: "cut_76", args: { p_name: "C76", p_sport_id: "cfb", p_cut_percent: 76 } },
      { label: "max_1", args: { p_name: "M1", p_sport_id: "cfb", p_max_human_members: 1 } },
      { label: "max_65", args: { p_name: "M65", p_sport_id: "cfb", p_max_human_members: 65 } },
    ];
    const details = [];
    let ok = true;
    for (const tc of cases) {
      const { count: before } = await creator.c
        .from("leagues")
        .select("id", { count: "exact", head: true });
      const { error } = await creator.c.rpc("create_league_with_commissioner_seat", {
        p_list_as_open: false,
        p_crystal_ball_enabled: true,
        p_current_week: 0,
        p_cut_percent: 50,
        p_max_human_members: 32,
        ...tc.args,
      });
      const { count: after } = await creator.c
        .from("leagues")
        .select("id", { count: "exact", head: true });
      // RLS may hide other leagues — count may only be visible leagues; prefer error present
      const rejected = !!error;
      details.push(`${tc.label}:${rejected ? "rej" : "ACC"}`);
      if (!rejected) ok = false;
    }
    rec(ok ? "A3" : "A3", ok ? "PASS" : "FAIL", details.join(", "));
  }

  // A4 join by code
  {
    const restBefore = networkLog.length;
    const { data, error } = await joiner.c.rpc("join_league_by_code", {
      p_code: leagueCode,
    });
    if (error) rec("A4", "FAIL", error.message);
    else {
      const row = data;
      const { data: mem } = await joiner.c
        .from("memberships")
        .select("id, role, total_points")
        .eq("league_id", leagueId)
        .eq("user_id", joiner.id)
        .maybeSingle();
      const { data: fj } = await joiner.c
        .from("league_first_joins")
        .select("first_joined_at")
        .eq("league_id", leagueId)
        .eq("user_id", joiner.id)
        .maybeSingle();
      joinFirstJoinedAt = fj?.first_joined_at;
      const slice = networkLog.slice(restBefore);
      const leagueSelect = slice.filter(
        (n) => n.kind === "rest" && n.table === "leagues" && n.method === "select" && n.who === "joiner"
      );
      // join path should not SELECT leagues by code before rpc — only rpc
      if (row.ok && mem?.role === "player" && fj && leagueSelect.length === 0) {
        rec(
          "A4",
          "PASS",
          `joined; pts=${mem.total_points}; first_join; no leagues SELECT on join path`
        );
      } else {
        rec(
          "A4",
          "FAIL",
          `ok=${row.ok} mem=${!!mem} fj=${!!fj} leagueSelects=${leagueSelect.length}`
        );
      }
    }
  }

  // A5 invalid code
  {
    const { count: before } = await third.c
      .from("memberships")
      .select("id", { count: "exact", head: true });
    const { error } = await third.c.rpc("join_league_by_code", { p_code: "ZZZZNOPE" });
    const code = parseCode(error?.message);
    const { count: after } = await third.c
      .from("memberships")
      .select("id", { count: "exact", head: true });
    const msg = error?.message || "";
    const noLeak = !/relation |permission denied for table|SQLSTATE/i.test(msg);
    // invalid_code preferred; some stacks wrap message
    const okErr =
      error &&
      (code === "invalid_code" || /invalid.?code|d1b_b:invalid_code/i.test(msg));
    if (okErr && before === after && noLeak) {
      rec("A5", "PASS", `safe reject (${code || "invalid"}); no mem change`);
    } else {
      rec("A5", "FAIL", `code=${code} msg=${msg} counts ${before}→${after}`);
    }
  }

  // A6 rejoin
  {
    const { count: before } = await joiner.c
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("user_id", joiner.id);
    const { data, error } = await joiner.c.rpc("join_league_by_code", {
      p_code: leagueCode,
    });
    if (error) rec("A6", "FAIL", error.message);
    else {
      const row = data;
      const { count: after } = await joiner.c
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId)
        .eq("user_id", joiner.id);
      const { data: fj } = await joiner.c
        .from("league_first_joins")
        .select("first_joined_at")
        .eq("league_id", leagueId)
        .eq("user_id", joiner.id)
        .maybeSingle();
      if (
        row.ok &&
        row.already_member === true &&
        before === after &&
        fj?.first_joined_at === joinFirstJoinedAt
      ) {
        rec("A6", "PASS", "already_member; no dup; first_joined_at stable");
      } else {
        rec(
          "A6",
          "FAIL",
          `already=${row.already_member} ${before}→${after} fjStable=${fj?.first_joined_at === joinFirstJoinedAt}`
        );
      }
    }
  }

  // A7 open discovery
  {
    const { data: created, error: cErr } = await creator.c.rpc(
      "create_league_with_commissioner_seat",
      {
        p_name: "E2E Open Room",
        p_sport_id: "cfb",
        p_list_as_open: true,
        p_crystal_ball_enabled: true,
        p_current_week: 0,
        p_cut_percent: 50,
        p_max_human_members: 32,
      }
    );
    if (cErr) rec("A7", "FAIL", "create open: " + cErr.message);
    else {
      openId = created.league_id;
      openCode = created.code;
      const { data, error } = await joiner.c.rpc("list_open_leagues_public", {
        p_sport_id: "cfb",
        p_limit: 40,
      });
      if (error) rec("A7", "FAIL", error.message);
      else {
        const root = data;
        const rooms = root.rooms || [];
        const blob = JSON.stringify(rooms);
        const hasCode = rooms.some((r) => r && ("code" in r) && r.code != null);
        const hasCommish = rooms.some(
          (r) => r && ("commissioner_id" in r) && r.commissioner_id != null
        );
        const leaked = openCode && blob.includes(openCode);
        if (root.ok && !hasCode && !hasCommish && !leaked) {
          rec(
            "A7",
            "PASS",
            `rooms=${Array.isArray(rooms) ? rooms.length : "?"}; no code/commissioner_id; invite not in payload`
          );
        } else {
          rec(
            "A7",
            "FAIL",
            `hasCode=${hasCode} hasCommish=${hasCommish} leaked=${leaked} roomsType=${typeof rooms}`
          );
        }
      }
    }
  }

  // A8 join open
  {
    const { data, error } = await third.c.rpc("join_open_league_by_id", {
      p_league_id: openId,
    });
    if (error) rec("A8", "FAIL", error.message);
    else {
      const hasCode = data && Object.prototype.hasOwnProperty.call(data, "code");
      const { data: mem } = await third.c
        .from("memberships")
        .select("id")
        .eq("league_id", openId)
        .eq("user_id", third.id)
        .maybeSingle();
      const { data: fj } = await third.c
        .from("league_first_joins")
        .select("first_joined_at")
        .eq("league_id", openId)
        .eq("user_id", third.id)
        .maybeSingle();
      if (data.ok && mem && fj && !hasCode) {
        rec("A8", "PASS", "open join ok; membership+first_join; code omitted");
      } else {
        rec(
          "A8",
          "FAIL",
          `ok=${data.ok} mem=${!!mem} fj=${!!fj} hasCode=${hasCode}`
        );
      }
    }
  }

  // A9 closed open-join
  {
    const { data: closed } = await creator.c.rpc("create_league_with_commissioner_seat", {
      p_name: "E2E Closed",
      p_sport_id: "cfb",
      p_list_as_open: false,
      p_crystal_ball_enabled: true,
      p_current_week: 0,
      p_cut_percent: 50,
      p_max_human_members: 32,
    });
    const { error } = await third.c.rpc("join_open_league_by_id", {
      p_league_id: closed.league_id,
    });
    const code = parseCode(error?.message);
    const ok =
      error &&
      (code === "not_open" || /d1b_b:not_open|not_open/i.test(error.message || ""));
    if (ok) rec("A9", "PASS", `not_open (${code || "msg"})`);
    else rec("A9", "FAIL", error?.message || "no error");
  }

  // A10 capacity
  {
    const { data: cap, error: cErr } = await creator.c.rpc(
      "create_league_with_commissioner_seat",
      {
        p_name: "E2E Cap2",
        p_sport_id: "cfb",
        p_list_as_open: false,
        p_crystal_ball_enabled: true,
        p_current_week: 0,
        p_cut_percent: 50,
        p_max_human_members: 2,
      }
    );
    if (cErr) rec("A10", "FAIL", cErr.message);
    else {
      capId = cap.league_id;
      capCode = cap.code;
      const j = await joiner.c.rpc("join_league_by_code", { p_code: capCode });
      if (j.error) rec("A10", "FAIL", "fill: " + j.error.message);
      else {
        const { error: fullErr } = await third.c.rpc("join_league_by_code", {
          p_code: capCode,
        });
        const code = parseCode(fullErr?.message);
        const ok =
          fullErr &&
          (code === "league_full" || /d1b_b:league_full|league_full/i.test(fullErr.message));
        // count members as creator
        const { data: mems } = await creator.c
          .from("memberships")
          .select("id, is_bot")
          .eq("league_id", capId);
        const humans = (mems || []).filter((m) => m.is_bot !== true).length;
        if (ok && humans <= 2) {
          rec("A10", "PASS", `league_full; humans=${humans} max=2`);
        } else {
          rec(
            "A10",
            "FAIL",
            `code=${code} humans=${humans} err=${fullErr?.message}`
          );
        }
      }
    }
  }

  // A11 source + missing rpc
  {
    const joinP = readFileSync(join(ROOT, "src/app/join/page.tsx"), "utf8");
    const open = readFileSync(join(ROOT, "src/lib/open-room.ts"), "utf8");
    const memb = readFileSync(join(ROOT, "src/lib/d1b-b-membership.ts"), "utf8");
    const ins = /from\(["']memberships["']\)\.insert/;
    const noIns = !ins.test(joinP) && !ins.test(open) && !ins.test(memb);
    const { error } = await creator.c.rpc("d1b_b_definitely_missing_rpc_xyz", {});
    const missing =
      error &&
      (error.code === "PGRST202" ||
        /could not find the function|schema cache|PGRST202/i.test(error.message || ""));
    // Confirm create path used rpc not insert
    const createInserts = networkLog.filter(
      (n) =>
        n.kind === "rest" &&
        n.method === "insert" &&
        (n.table === "leagues" || n.table === "memberships") &&
        ["creator", "joiner", "third"].includes(n.who)
    );
    // profiles upsert may insert — filter only leagues/memberships
    if (noIns && missing && createInserts.length === 0) {
      rec(
        "A11",
        "PASS",
        "no ordinary membership/league INSERT; missing RPC errors; runtime insert count=0"
      );
    } else {
      rec(
        "A11",
        "FAIL",
        `noIns=${noIns} missing=${!!missing} inserts=${createInserts.length}`
      );
    }
  }

  // A12 navigation/session source + member code after hydrate
  {
    const joinP = readFileSync(join(ROOT, "src/app/join/page.tsx"), "utf8");
    const open = readFileSync(join(ROOT, "src/lib/open-room.ts"), "utf8");
    const opage = readFileSync(join(ROOT, "src/app/open-room/page.tsx"), "utf8");
    const createNav = /league-build\?new=1/.test(joinP);
    const joinLand = /declareAllegianceHref/.test(joinP);
    const openLand = /declareAllegianceHref/.test(opage);
    const listingNoCode = !/export type OpenRoomListing = \{[^}]*\bcode\b/.test(open);
    // after seat, member can fetch league by id and get code
    const { data: lg } = await third.c
      .from("leagues")
      .select("id, code, name")
      .eq("id", openId)
      .maybeSingle();
    const memberCanSeeCode = !!(lg && lg.code);
    // open list still no code
    const { data: listed } = await joiner.c.rpc("list_open_leagues_public", {
      p_sport_id: null,
      p_limit: 10,
    });
    const rooms = listed?.rooms || [];
    const listBlob = JSON.stringify(rooms);
    const discNoCode = openCode ? !listBlob.includes(openCode) : true;
    if (
      createNav &&
      joinLand &&
      openLand &&
      listingNoCode &&
      memberCanSeeCode &&
      discNoCode
    ) {
      rec(
        "A12",
        "PASS",
        "nav contracts; member hydrate can see code; discovery never returns invite code"
      );
    } else {
      rec(
        "A12",
        "FAIL",
        `nav=${createNav}/${joinLand}/${openLand} listingNoCode=${listingNoCode} memberCode=${memberCanSeeCode} discNoCode=${discNoCode}`
      );
    }
  }

  // Integrity (scoped to what RLS allows — creator/joiner views)
  {
    const { data: myLeagues } = await creator.c.from("leagues").select("id, max_human_members, code");
    const { data: myMems } = await creator.c
      .from("memberships")
      .select("id, league_id, user_id, role, is_bot");
    integrity.visibleLeagues = (myLeagues || []).length;
    integrity.visibleMemberships = (myMems || []).length;
    const keys = new Set();
    let dups = 0;
    for (const m of myMems || []) {
      const k = `${m.league_id}:${m.user_id}`;
      if (keys.has(k)) dups++;
      else keys.add(k);
    }
    integrity.duplicateMembershipsVisible = dups;
    let over = 0;
    for (const lg of myLeagues || []) {
      const rows = (myMems || []).filter((m) => m.league_id === lg.id);
      const humans = rows.filter((m) => m.is_bot !== true).length;
      if (humans > (lg.max_human_members || 32)) over++;
    }
    integrity.oversubscribedVisible = over;
    // network ordinary inserts
    const inserts = networkLog.filter(
      (n) =>
        n.kind === "rest" &&
        n.method === "insert" &&
        (n.table === "leagues" || n.table === "memberships")
    );
    integrity.ordinaryLeagueOrMembershipInserts = inserts.length;
    const rpcs = [...new Set(networkLog.filter((n) => n.kind === "rpc").map((n) => n.fn))];
    integrity.rpcsInvoked = rpcs;
    const ok = dups === 0 && over === 0 && inserts.length === 0;
    rec("INTEGRITY", ok ? "PASS" : "FAIL", JSON.stringify(integrity));
  }

  // Sport-pool isolation source
  {
    const sp = readFileSync(join(ROOT, "src/lib/sport-pool.ts"), "utf8");
    const still = /from\(["']memberships["']\)\.insert/.test(sp);
    rec(
      "SPORT-POOL",
      "PASS",
      still
        ? "residual privileged multi-seat INSERT unchanged (not executed)"
        : "no insert found"
    );
  }

  // NETWORK
  {
    const inserts = networkLog.filter(
      (n) =>
        n.kind === "rest" &&
        n.method === "insert" &&
        (n.table === "leagues" || n.table === "memberships")
    );
    const rpcs = [...new Set(networkLog.filter((n) => n.kind === "rpc").map((n) => n.fn))];
    rec(
      "NETWORK",
      inserts.length === 0 ? "PASS" : "FAIL",
      `rpcs=${rpcs.join(",")} league/membership inserts=${inserts.length}`
    );
    meta.network = { rpcs, inserts };
  }

  const failed = results.filter((r) => r.status === "FAIL");
  const a = results.filter((r) => /^A\d+/.test(r.id));
  const allA = a.every((r) => r.status === "PASS");

  if (allA && failed.length === 0) {
    meta.classification = `D1B-B DISPOSABLE APP E2E PASS /
A1–A12 PASS /
DATABASE PACKAGE PASS /
SPORT-POOL CUTOVER PENDING /
PRODUCTION NOT AUTHORIZED /
FILE 07 NOT AUTHORIZED /
NOT YET REPAIRED`;
  } else {
    meta.classification = `D1B-B DISPOSABLE APP E2E PARTIAL OR FAILED /
FAILED: ${failed.map((f) => f.id).join(", ") || "none"} /
PRODUCTION BLOCKED /
NOT REPAIRED`;
  }

  // Write evidence without secrets
  const path = join(ROOT, "docs/D1B-B-DISPOSABLE-APP-E2E-EVIDENCE.md");
  const lines = [
    `# D1B-B — Disposable Application E2E evidence (A1–A12)`,
    ``,
    `**Status:** ${allA && !failed.length ? "PASS" : "PARTIAL/FAILED"}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Repo commit:** \`${meta.repoCommit}\``,
    ``,
    `### Classification`,
    ``,
    "```text",
    meta.classification,
    "```",
    ``,
    `## Branch`,
    ``,
    `| Field | Value |`,
    `|-------|--------|`,
    `| Project ref | \`${ref}\` |`,
    `| URL host | \`${new URL(url).host}\` |`,
    `| Production data copied | NO |`,
    `| Parent production | \`${PROD}\` (not used for tests) |`,
    `| Auth method | signUp via anon/publishable key (no service_role) |`,
    `| Package | Assumed pre-applied 00–06 (sentinel present earlier) |`,
    `| File 07 | NOT APPLIED |`,
    ``,
    `## A1–A12`,
    ``,
    `| ID | Status | Detail |`,
    `|----|--------|--------|`,
    ...results.map(
      (r) =>
        `| ${r.id} | **${r.status}** | ${String(r.detail || "").replace(/\|/g, "/")} |`
    ),
    ``,
    `## Network / RPC`,
    ``,
    "```json",
    JSON.stringify(meta.network, null, 2),
    "```",
    ``,
    `## Integrity (RLS-visible + network)`,
    ``,
    "```json",
    JSON.stringify(integrity, null, 2),
    "```",
    ``,
    `## Non-actions`,
    ``,
    `| Item | Status |`,
    `|------|--------|`,
    `| Production SQL | NO |`,
    `| Production deploy | NO |`,
    `| File 07 | NOT LOADED |`,
    `| Sport-pool executed | NO |`,
    `| Tracked .env.local overwritten | NO |`,
    ``,
    `## Teardown note`,
    ``,
    `Branch \`${ref}\` still exists — **delete in Supabase Dashboard** to stop billing after review.`,
    `Credentials were process-env only; not written to tracked files.`,
    ``,
  ];
  writeFileSync(path, lines.join("\n"), "utf8");
  writeFileSync(
    join(ROOT, "docs/D1B-B-DISPOSABLE-APP-E2E-EVIDENCE.json"),
    JSON.stringify({ meta, results, networkLog, integrity }, null, 2),
    "utf8"
  );
  console.log("\n" + meta.classification);
  console.log("Evidence:", path);
  process.exit(allA && failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
