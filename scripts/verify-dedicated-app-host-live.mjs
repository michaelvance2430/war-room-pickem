import { resolve4, resolve6, resolveCname } from "node:dns/promises";

const origin = "https://app.war-room-picks.com";
const host = new URL(origin).hostname;
const storefrontHosts = new Set(["war-room-picks.com", "www.war-room-picks.com"]);

async function resolveHost() {
  const attempts = await Promise.allSettled([
    resolve4(host),
    resolve6(host),
    resolveCname(host),
  ]);
  const answers = attempts
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);
  if (!answers.length) {
    throw new Error(`[app-host-live] ${host} has no public DNS record`);
  }
}

async function get(path) {
  const response = await fetch(`${origin}${path}`, { redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") || "";
    const redirectHost = location ? new URL(location, origin).hostname : "unknown";
    if (storefrontHosts.has(redirectHost)) {
      throw new Error(`[app-host-live] ${path} redirects into the storefront`);
    }
    throw new Error(`[app-host-live] ${path} unexpectedly redirects to ${location || "an empty location"}`);
  }
  if (!response.ok) throw new Error(`[app-host-live] ${path} returned HTTP ${response.status}`);
  if (new URL(response.url).hostname !== host) {
    throw new Error(`[app-host-live] ${path} escaped the dedicated app host`);
  }
  return response;
}

await resolveHost();

const [home, privacy, support, association] = await Promise.all([
  get("/"),
  get("/privacy"),
  get("/support"),
  get("/.well-known/apple-app-site-association"),
]);

const [homeText, privacyText, supportText, associationJson] = await Promise.all([
  home.text(),
  privacy.text(),
  support.text(),
  association.json(),
]);

if (!homeText.includes("War Room")) throw new Error("[app-host-live] app shell identity missing");
if (!privacyText.includes("Privacy Policy")) throw new Error("[app-host-live] privacy policy missing");
if (!supportText.includes("Support")) throw new Error("[app-host-live] support page missing");

const appId = associationJson?.applinks?.details?.[0]?.appID;
if (appId !== "XWW458P3J7.com.warroompicks.app") {
  throw new Error(`[app-host-live] universal-link appID drifted: ${appId || "missing"}`);
}

console.log(`[app-host-live] PASS — ${host} is isolated, reachable, and App Store policy/link ready`);
