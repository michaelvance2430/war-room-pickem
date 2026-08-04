import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3000";
const OUT = __dirname;
const notes = [];

function log(s) {
  notes.push(s);
  console.log(s);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: true });
}

async function visibleText(page, max = 2500) {
  const t = await page.evaluate(() => {
    const body = document.body?.innerText || "";
    return body.replace(/\n{3,}/g, "\n\n").trim();
  });
  return t.slice(0, max);
}

async function clickIf(page, selectors, label) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    try {
      if ((await el.count()) > 0 && (await el.isVisible())) {
        await el.click({ timeout: 5000 });
        log(`  clicked: ${label} (${sel})`);
        return true;
      }
    } catch {
      /* try next */
    }
  }
  log(`  MISS click: ${label}`);
  return false;
}

async function navTabs(page) {
  const tabs = await page
    .locator('nav[aria-label="Primary"] a, nav[aria-label="Primary"] button')
    .allTextContents();
  return tabs.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
}

async function menuItems(page) {
  const items = await page
    .locator("#mobile-nav-menu a, #mobile-nav-menu button")
    .allTextContents();
  return items.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
});
const page = await context.newPage();
page.setDefaultTimeout(45000);

// ─── LOGIN ───
log("\n=== 1. LOGIN GATE ===");
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await shot(page, "01-login");
log("URL: " + page.url());
log("TEXT:\n" + (await visibleText(page, 1200)));

// ─── GUEST PLAYER ───
log("\n=== 2. GUEST AS NEW PLAYER ===");
await clickIf(
  page,
  ['button:has-text("Explore as guest")', "text=Explore as guest"],
  "Explore as guest"
);
await page.waitForTimeout(2500);
await shot(page, "02-guest-welcome");
log("After guest enter URL: " + page.url());
log("TEXT:\n" + (await visibleText(page, 1500)));

await clickIf(page, ['button:has-text("Look around")'], "Look around");
await page.waitForTimeout(700);
await shot(page, "03-guest-role");
log("ROLE screen:\n" + (await visibleText(page, 1000)));

await clickIf(page, ['button:has-text("View as player")'], "View as player");
await page.waitForTimeout(700);
await shot(page, "04-player-tutorial");
log("TUTORIAL:\n" + (await visibleText(page, 1200)));

for (let i = 0; i < 5; i++) {
  const advanced = await clickIf(
    page,
    [
      'button:has-text("Open My Picks")',
      'button:has-text("I’m on My Picks")',
      "button:has-text(\"I'm on My Picks\")",
      'button:has-text("Got it")',
      'button:has-text("Skip")',
      'button:has-text("Done")',
      'button:has-text("let’s play")',
      'button:has-text("let\'s play")',
    ],
    "tutorial step " + i
  );
  await page.waitForTimeout(800);
  if (!advanced) break;
}
await shot(page, "05-after-tutorial");
log("Post-tutorial URL: " + page.url());
log("TABS: " + JSON.stringify(await navTabs(page)));
log("POST TUTORIAL:\n" + (await visibleText(page, 1800)));

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
await shot(page, "06-home-player");
log("\n--- HOME (player) ---");
log(await visibleText(page, 2200));
log("TABS: " + JSON.stringify(await navTabs(page)));

await page.goto(BASE + "/picks", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await shot(page, "07-picks-player");
log("\n--- PICKS ---");
log(await visibleText(page, 2200));

await page.goto(BASE + "/standings", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);
await shot(page, "08-standings");
log("\n--- STANDINGS ---");
log(await visibleText(page, 1600));

await page.goto(BASE + "/locker-room", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);
await shot(page, "09-locker");
log("\n--- LOCKER ---");
log(await visibleText(page, 1400));

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const youBtn = page
  .locator(
    'nav[aria-label="Primary"] button:has-text("You"), button[aria-label="Account menu"]'
  )
  .first();
if ((await youBtn.count()) > 0) {
  await youBtn.click();
  await page.waitForTimeout(600);
  await shot(page, "10-you-menu");
  log("\n--- YOU MENU ---");
  log(JSON.stringify(await menuItems(page)));
  log(await visibleText(page, 900));
} else {
  log("You menu button not found — trying header control");
  await clickIf(
    page,
    [
      'button[aria-label="Account menu"]',
      'button[aria-controls="mobile-nav-menu"]',
    ],
    "header menu"
  );
  await page.waitForTimeout(500);
  await shot(page, "10-you-menu");
  log(JSON.stringify(await menuItems(page)));
}

await page.goto(BASE + "/board", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1400);
await shot(page, "11-board");
log("\n--- BOARD ---");
log(await visibleText(page, 1200));

// ─── GUEST COMMISSIONER ───
log("\n=== 3. GUEST AS NEW COMMISSIONER ===");
await context.clearCookies();
await page.evaluate(() => localStorage.clear());
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await clickIf(page, ['button:has-text("Explore as guest")'], "Explore as guest");
await page.waitForTimeout(1200);
await clickIf(page, ['button:has-text("Look around")'], "Look around");
await page.waitForTimeout(600);
await clickIf(
  page,
  ['button:has-text("View as commissioner")'],
  "View as commissioner"
);
await page.waitForTimeout(700);
await shot(page, "12-commish-tutorial");
log("COMMISH TUTORIAL:\n" + (await visibleText(page, 1600)));

await clickIf(
  page,
  ['button:has-text("Open Build Card")', 'a:has-text("Open Build Card")'],
  "Open Build Card"
);
await page.waitForTimeout(1800);
await shot(page, "13-commish-card");
log("After build card CTA URL: " + page.url());
log(await visibleText(page, 2000));

await page.goto(BASE + "/league-build", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);
await shot(page, "14-league-build");
log("\n--- LEAGUE BUILD ---");
log(await visibleText(page, 2000));

await page.goto(BASE + "/commissioner", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await shot(page, "15-commissioner");
log("\n--- COMMISSIONER ---");
log(await visibleText(page, 2200));

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);
await shot(page, "16-home-commish");
log("\n--- HOME COMMISH ---");
log(await visibleText(page, 2000));
log("TABS: " + JSON.stringify(await navTabs(page)));

const you2 = page
  .locator(
    'nav[aria-label="Primary"] button:has-text("You"), button[aria-label="Account menu"]'
  )
  .first();
if ((await you2.count()) > 0) {
  await you2.click();
  await page.waitForTimeout(500);
  await shot(page, "17-you-menu-commish");
  log("YOU MENU COMMISH: " + JSON.stringify(await menuItems(page)));
}

// ─── FIRST-HOUR EYES ───
log("\n=== 4. FIRST-HOUR EYES (local creator seat id=1) ===");
await page.evaluate(() => {
  localStorage.clear();
  const league = {
    id: "sim-first-hour-league",
    name: "Saturday Situation Room",
    inviteCode: "SIM001",
    sportId: "cfb",
    seasonYear: 2026,
    settings: { crystalBallEnabled: true },
  };
  const session = {
    playerId: "1",
    playerName: "Sim Host",
    leagueId: league.id,
    isCommissioner: true,
    isOps: true,
  };
  localStorage.setItem("warroom-league", JSON.stringify(league));
  localStorage.setItem("warroom-session", JSON.stringify(session));
  localStorage.setItem("warroom-foundry-session-v1", "1");
  localStorage.setItem("warroom-show-full-room-v1", "{}");
  localStorage.setItem("warroom-creator-eyes-v1", "new_player");
  localStorage.setItem(
    "warroom-creator-sandbox-v1",
    JSON.stringify({ weekNumber: 0, phase: "onboarding", sportId: "cfb" })
  );
});
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await shot(page, "18-first-hour-player-home");
log("FIRST HOUR PLAYER HOME:\n" + (await visibleText(page, 2200)));
log("TABS: " + JSON.stringify(await navTabs(page)));

await page.goto(BASE + "/picks", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await shot(page, "19-first-hour-picks");
log("FIRST HOUR PICKS:\n" + (await visibleText(page, 2000)));

await page.evaluate(() => {
  localStorage.setItem("warroom-creator-eyes-v1", "new_commissioner");
  localStorage.setItem("warroom-show-full-room-v1", "{}");
});
await page.goto(BASE + "/league-build?eyes=1&new=1", {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(2200);
await shot(page, "20-first-hour-league-build");
log("FIRST HOUR LEAGUE BUILD:\n" + (await visibleText(page, 2200)));

await page.goto(BASE + "/commissioner?first=1", {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(2200);
await shot(page, "21-first-hour-commish");
log("FIRST HOUR COMMISH:\n" + (await visibleText(page, 2200)));

// You menu first-hour
const you3 = page
  .locator(
    'nav[aria-label="Primary"] button:has-text("You"), button[aria-label="Account menu"]'
  )
  .first();
if ((await you3.count()) > 0) {
  await you3.click();
  await page.waitForTimeout(500);
  await shot(page, "22-you-first-hour");
  log("YOU MENU FIRST HOUR: " + JSON.stringify(await menuItems(page)));
}

fs.writeFileSync(path.join(OUT, "notes.txt"), notes.join("\n"), "utf8");
log("\nWrote notes + screenshots to " + OUT);
await browser.close();
