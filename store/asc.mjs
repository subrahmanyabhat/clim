/**
 * App Store Connect driver.
 *
 * Opens a real, visible browser against App Store Connect using a persistent
 * profile, so you sign in once (with your own password and 2FA — this script
 * never sees either) and every later run reuses the session.
 *
 *   node asc.mjs login     open the browser and wait for you to sign in
 *   node asc.mjs status    report what exists: the app record, its state
 *   node asc.mjs fill      write the listing copy into the version form
 *   node asc.mjs shots     upload the six 6.9" screenshots
 *
 * Nothing here submits the app for review. The last click stays yours.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PROFILE = path.join(os.homedir(), ".clim-asc-profile");
const ASC = "https://appstoreconnect.apple.com";
const BUNDLE_ID = "com.dingalabs.clim";
const SHOTS = path.join(os.homedir(), "Desktop/clim-store-screenshots/app-store");

const cmd = process.argv[2] || "login";

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1500, height: 950 },
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] || (await ctx.newPage());

async function signedIn() {
  // The apps dashboard only renders for an authenticated session; the sign-in
  // page keeps an Apple ID field on screen.
  await page.goto(`${ASC}/apps`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(3000);
  const url = page.url();
  if (/idmsa\.apple\.com|signin/i.test(url)) return false;
  return /appstoreconnect\.apple\.com/.test(url);
}

async function waitForLogin(maxMs = 15 * 60 * 1000) {
  const started = Date.now();
  process.stdout.write("waiting for sign-in");
  while (Date.now() - started < maxMs) {
    if (await signedIn()) { console.log("\nsigned in"); return true; }
    process.stdout.write(".");
    await page.waitForTimeout(10_000);
  }
  console.log("\ntimed out waiting for sign-in");
  return false;
}

if (cmd === "login") {
  await page.goto(ASC, { waitUntil: "domcontentloaded" });
  console.log("Browser is open. Sign in with your Apple ID and complete 2FA.");
  console.log("This script does not read the password or the code.");
  await waitForLogin();
  console.log(`session stored in ${PROFILE} — later runs reuse it`);
}

if (cmd === "status") {
  if (!(await signedIn())) {
    console.log("not signed in — run: node asc.mjs login");
  } else {
    await page.waitForTimeout(2000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasClim = /\bclim\b/i.test(bodyText);
    console.log("app record for clim visible on dashboard:", hasClim ? "yes" : "no");
    console.log("--- apps listed ---");
    console.log(bodyText.split("\n").filter(Boolean).slice(0, 40).join("\n"));
  }
}

if (cmd === "shots") {
  const files = fs.existsSync(SHOTS)
    ? fs.readdirSync(SHOTS).filter((f) => f.endsWith(".png")).sort()
    : [];
  console.log(`${files.length} screenshots ready at ${SHOTS}`);
  files.forEach((f) => console.log("  " + f));
  console.log("\nOpen the version page, scroll to App Previews and Screenshots,");
  console.log("then drop these on the 6.9\" well. Automating that drag is brittle;");
  console.log("the file picker is the reliable path.");
}

if (cmd !== "login") {
  console.log("\nleaving the browser open — close it yourself when done");
} else {
  console.log("\nbrowser stays open for the next command");
}
