import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const error = read("src/app/error.tsx");
const missing = read("src/app/not-found.tsx");
const home = read("src/app/page.tsx");
const picks = read("src/app/picks/PicksClient.tsx");
const login = read("src/app/login/page.tsx");

assert.match(error, /^"use client";/);
assert.match(error, /onClick=\{reset\}/, "failure screen cannot retry in place");
assert.match(error, /submitted picks are not replaced/i, "failure screen could encourage destructive recovery");
assert.match(error, /href="\/"/, "failure screen lacks a Home escape route");
assert.match(error, /href="\/login"/, "failure screen lacks a Login escape route");
assert.match(missing, /href="\/"/, "missing page traps the player");
assert.match(home, /Couldn’t load your room \(slow connection\)/, "Home no longer distinguishes a network failure");
assert.match(home, /Try again/, "Home network recovery action missing");
assert.match(picks, /network_error/, "Picks no longer handles session network failure");
assert.match(picks, /Could not load the current week card\. Try again\./, "Picks missing-card recovery copy drifted");
assert.match(login, /Login is taking too long\. Check connection and try again\./, "Login timeout escape missing");

console.log("App failure surfaces PASS — retry, non-destructive copy, and navigation escapes verified");
