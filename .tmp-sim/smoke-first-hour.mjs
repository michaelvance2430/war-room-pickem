import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3000";
const notes = [];
const log = (s) => {
  notes.push(s);
  console.log(s);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(30000);

async function text(max = 1500) {
  return (
    await page.evaluate(() =>
      (document.body?.innerText || "").replace(/\n{3,}/g, "\n\n").trim()
    )
  ).slice(0, max);
}

async function clickText(label) {
  const el = page.getByRole("button", { name: new RegExp(label, "i") }).first();
  if ((await el.count()) > 0) {
    await el.click();
    log("  click: " + label);
    return true;
  }
  log("  MISS: " + label);
  return false;
}

// Guest player path
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await clickText("Explore as guest");
await page.waitForTimeout(1500);
await clickText("Look around");
await page.waitForTimeout(600);
await clickText("View as player");
await page.waitForTimeout(600);
log("COACH:\n" + (await text(800)));
await clickText("Open My Picks");
await page.waitForTimeout(2000);
log("AFTER COACH URL: " + page.url());
log("PICKS (should have no tutorial modal):\n" + (await text(1200)));
const hasTutorial = await page
  .getByText("PLAYER TUTORIAL", { exact: false })
  .count();
const hasCoach = await page.getByText("One thing", { exact: false }).count();
log(`tutorial sticky? ${hasTutorial > 0 || hasCoach > 0}`);

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
const home = await text(1500);
log("HOME:\n" + home);
log(
  "home hang? " +
    /Opening Home/.test(home) +
    " waiting on card? " +
    /waiting on the card|hasn't published/i.test(home)
);

await page.goto(BASE + "/locker-room", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const locker = await text(1000);
log("LOCKER:\n" + locker);
log(
  "infra leak? " +
    /uuid|invalid input syntax|22P02|guest-demo-league/i.test(locker)
);

await page.goto(BASE + "/picks", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const picks = await text(800);
log("PICKS live card? " + /Week 9|confidence|Save Picks/i.test(picks));

// You menu
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const you = page.locator('nav[aria-label="Primary"] button:has-text("You")');
if ((await you.count()) > 0) {
  await you.click();
  await page.waitForTimeout(500);
  const menu = await page
    .locator("#mobile-nav-menu")
    .innerText()
    .catch(() => "");
  log("YOU MENU:\n" + menu.slice(0, 500));
}

fs.writeFileSync(path.join(__dirname, "smoke-notes.txt"), notes.join("\n"));
await browser.close();
log("done");
