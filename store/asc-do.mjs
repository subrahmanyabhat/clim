/**
 * Attaches to the already-running browser (asc-browser.mjs) over CDP and acts.
 * Never launches, never closes — so the session you signed into survives.
 *
 *   node asc-do.mjs status
 *   node asc-do.mjs appid            fill the App ID form, stop before Register
 *   node asc-do.mjs appid --register fill it and press Register
 *   node asc-do.mjs create           open the New App dialog and fill it
 */
import { chromium } from "playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const SHOTS = path.join(os.homedir(), "Desktop/clim-asc-shots");
fs.mkdirSync(SHOTS, { recursive: true });
const BUNDLE_ID = "com.dingalabs.clim";
const APP_NAME = "clim: terminal remote";
const SKU = "clim-ios-001";
const cmd = process.argv[2] || "status";

const browser = await chromium.connectOverCDP("http://localhost:9222").catch((e) => {
  console.error("cannot attach — is asc-browser.mjs running?\n" + e.message);
  process.exit(1);
});
const ctx = browser.contexts()[0];
const page = ctx.pages().at(-1) || (await ctx.newPage());

const shot = async (n) => {
  const f = path.join(SHOTS, `${n}.png`);
  await page.screenshot({ path: f }).catch(() => {});
  console.log("  shot:", f);
};
const text = async () => (await page.evaluate(() => document.body.innerText).catch(() => "")).replace(/\n+/g, " | ");
const authed = async () => !/idmsa|signin|\/login/i.test(page.url());

async function open(url, label) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(6000);
  console.log(`  url: ${page.url()}`);
  console.log(`  ${await authed() ? "authenticated" : "NOT AUTHENTICATED — sign in in that window"}`);
  await shot(label);
}

if (cmd === "status") {
  await open("https://developer.apple.com/account/resources/identifiers/list", "st-dev");
  const t = await text();
  console.log("  app id registered:", t.includes(BUNDLE_ID) ? "YES" : "no");
  await open("https://appstoreconnect.apple.com/apps", "st-asc");
  console.log("  clim app record:", /\bclim\b/i.test(await text()) ? "YES" : "no");
}

if (cmd === "appid") {
  await open("https://developer.apple.com/account/resources/identifiers/add/bundleId", "ai-1");
  if (!(await authed())) process.exit(1);

  // Wizard step 1 — pick App IDs, verified by label text before clicking.
  const label = await page.evaluate(() => {
    const r = document.querySelector('input[type="radio"]');
    return r ? (r.closest("label")?.innerText || r.parentElement?.innerText || "") : "";
  });
  console.log("  first option:", label.replace(/\n/g, " ").slice(0, 50));
  if (!/app ids/i.test(label)) { console.log("  unexpected form — stopping"); process.exit(1); }
  await page.locator('input[type="radio"]').first().check().catch(() => {});
  await page.getByRole("button", { name: /continue/i }).first().click().catch(() => {});
  await page.waitForTimeout(4000);

  // Wizard step 2 — type App
  await page.locator('input[type="radio"]').first().check().catch(() => {});
  await page.getByRole("button", { name: /continue/i }).first().click().catch(() => {});
  await page.waitForTimeout(4000);
  await shot("ai-2-form");

  const fields = await page.evaluate(() =>
    [...document.querySelectorAll("input[type=text]")].filter((e) => e.offsetParent)
      .map((e) => ({ id: e.id, name: e.name, ph: e.placeholder })));
  console.log("  fields:", JSON.stringify(fields));

  for (const f of fields) {
    const sel = f.id ? `#${CSS.escape ? f.id : f.id}` : `input[name="${f.name}"]`;
    const isDesc = /desc/i.test(f.id + f.name + f.ph);
    const isBundle = /bundle|identifier/i.test(f.id + f.name + f.ph);
    if (isDesc) { await page.locator(sel).first().fill("clim terminal remote").catch(() => {}); console.log("  description filled"); }
    if (isBundle) { await page.locator(sel).first().fill(BUNDLE_ID).catch(() => {}); console.log("  bundle id filled"); }
  }
  await shot("ai-3-filled");

  if (process.argv.includes("--register")) {
    await page.getByRole("button", { name: /^register$/i }).first().click().catch(() => {});
    await page.waitForTimeout(6000);
    await shot("ai-4-done");
    console.log("  after register:", (await text()).slice(0, 200));
  } else {
    console.log("\n  stopped before Register — rerun with --register to commit");
  }
}

if (cmd === "create") {
  await open("https://appstoreconnect.apple.com/apps", "cr-1");
  if (!(await authed())) process.exit(1);
  const plus = page.locator('button[aria-label*="add" i], a[href*="/new"], button:has-text("+")').first();
  if (await plus.count()) { await plus.click().catch(() => {}); await page.waitForTimeout(4000); }
  await shot("cr-2-dialog");
  const controls = await page.evaluate(() =>
    [...document.querySelectorAll("input,select,textarea,button")].filter((e) => e.offsetParent)
      .slice(0, 40).map((e) => `${e.tagName.toLowerCase()}[${e.type || ""}] name=${e.name || ""} ph=${e.placeholder || ""} txt=${(e.innerText || "").slice(0, 30)}`));
  console.log(controls.join("\n"));
  console.log(`\n  intended → name: ${APP_NAME} | bundle: ${BUNDLE_ID} | sku: ${SKU}`);
}

// Detach without closing anything.
await browser.close();
console.log("\ndetached — browser still open");
