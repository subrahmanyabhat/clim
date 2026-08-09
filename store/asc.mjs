/**
 * App Store Connect / Developer Portal driver.
 *
 * Uses a persistent Chromium profile so you sign in once, with your own
 * password and 2FA. This script never reads either — it only waits until an
 * authenticated page renders.
 *
 *   node asc.mjs probe      where are we: signed in? app id? app record?
 *   node asc.mjs appid      register the bundle id com.dingalabs.clim
 *   node asc.mjs create     create the app record in App Store Connect
 *   node asc.mjs fill       write the listing copy into the version form
 *
 * Nothing here submits for review. That click stays yours.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PROFILE = path.join(os.homedir(), ".clim-asc-profile");
const ASC = "https://appstoreconnect.apple.com";
const DEV = "https://developer.apple.com/account/resources/identifiers/list";
const BUNDLE_ID = "com.dingalabs.clim";
const APP_NAME = "clim: terminal remote";
const SKU = "clim-ios-001";
const SHOT_DIR = path.join(os.homedir(), "Desktop/clim-asc-shots");

fs.mkdirSync(SHOT_DIR, { recursive: true });
const cmd = process.argv[2] || "probe";

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1500, height: 950 },
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] || (await ctx.newPage());

const shot = async (name) => {
  const f = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: f, fullPage: false }).catch(() => {});
  return f;
};

async function go(url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

function isSignIn(url, text) {
  return /idmsa\.apple\.com|\/login|signin/i.test(url) ||
         /sign in with your apple|apple account/i.test(text.slice(0, 400));
}

async function readPage() {
  const url = page.url();
  const text = await page.evaluate(() => document.body.innerText).catch(() => "");
  return { url, text };
}

// ---------------------------------------------------------------- probe
if (cmd === "probe") {
  await go(`${ASC}/apps`);
  let { url, text } = await readPage();
  const authed = !isSignIn(url, text);
  console.log(`app store connect: ${authed ? "SIGNED IN" : "NOT SIGNED IN"}  (${url})`);
  console.log(await shot("01-asc"));

  if (authed) {
    const hasClim = /\bclim\b/i.test(text);
    console.log(`app record for clim: ${hasClim ? "EXISTS" : "not found"}`);
    console.log("--- dashboard text ---");
    console.log(text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 25).join("\n"));
  }

  await go(DEV);
  ({ url, text } = await readPage());
  const devAuthed = !isSignIn(url, text);
  console.log(`\ndeveloper portal: ${devAuthed ? "SIGNED IN" : "NOT SIGNED IN"}  (${url})`);
  console.log(await shot("02-devportal"));
  if (devAuthed) {
    const hasId = text.includes(BUNDLE_ID);
    console.log(`app id ${BUNDLE_ID}: ${hasId ? "REGISTERED" : "not registered"}`);
  }
}

// ---------------------------------------------------------------- app id
if (cmd === "appid") {
  await go("https://developer.apple.com/account/resources/identifiers/add/bundleId");
  const { url, text } = await readPage();
  if (isSignIn(url, text)) { console.log("not signed in — run: node asc.mjs probe, sign in, retry"); }
  else {
    console.log("on:", url);
    console.log(await shot("03-appid-form"));
    console.log("--- visible controls ---");
    const inputs = await page.evaluate(() =>
      [...document.querySelectorAll("input,button,select")]
        .filter((e) => e.offsetParent)
        .slice(0, 30)
        .map((e) => `${e.tagName.toLowerCase()}[${e.type || ""}] name=${e.name || ""} id=${e.id || ""} text=${(e.innerText || e.value || "").slice(0, 40)}`)
    );
    console.log(inputs.join("\n"));
  }
}

// ---------------------------------------------------------------- create
if (cmd === "create") {
  await go(`${ASC}/apps`);
  const { url, text } = await readPage();
  if (isSignIn(url, text)) { console.log("not signed in"); }
  else {
    // The "+" that opens the New App dialog
    const plus = page.locator('button:has-text("+"), [aria-label*="Add" i]').first();
    if (await plus.count()) {
      await plus.click().catch(() => {});
      await page.waitForTimeout(3000);
    }
    console.log(await shot("04-newapp-dialog"));
    const controls = await page.evaluate(() =>
      [...document.querySelectorAll("input,select,button")]
        .filter((e) => e.offsetParent)
        .slice(0, 40)
        .map((e) => `${e.tagName.toLowerCase()}[${e.type || ""}] ph=${e.placeholder || ""} text=${(e.innerText || "").slice(0, 40)}`)
    );
    console.log(controls.join("\n"));
    console.log(`\nintended values → name: ${APP_NAME} | bundle: ${BUNDLE_ID} | sku: ${SKU}`);
  }
}

console.log(`\nscreenshots of what the browser saw: ${SHOT_DIR}`);
console.log("browser left open");
