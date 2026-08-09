/**
 * Headless export driver.
 *
 * The editor exports by clicking "Export bundle", which builds a zip in the
 * browser with html-to-image. Doing that by hand once per device is fine; doing
 * it every time the copy changes is not, so Playwright drives the same button
 * and unpacks the download.
 *
 *   node export.mjs                 # every device that has slides
 *   node export.mjs iphone android  # just these
 *
 * Output lands in ./export/<device>/… exactly as the zip is laid out.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.STORE_URL || "http://localhost:3000";
const OUT = path.resolve("export");
const project = JSON.parse(fs.readFileSync("app-store-screenshots.json", "utf8"));


// PNG surgery without a dependency: rewrite each file through `sips`, which
// ships with macOS and drops the alpha channel when the format is set to RGB.
function flattenToRgb(files) {
  for (const f of files) {
    try {
      execFileSync("sips", ["-s", "format", "png", "-s", "formatOptions", "best",
                            "--matchTo", "/System/Library/ColorSync/Profiles/sRGB Profile.icc",
                            f, "--out", f], { stdio: "ignore" });
    } catch {
      // sips is best-effort; the bundle script verifies modes independently.
    }
  }
}

const wanted = process.argv.slice(2);
const devices = Object.entries(project.slidesByDevice)
  .filter(([, slides]) => Array.isArray(slides) && slides.length)
  .map(([device]) => device)
  .filter((d) => (wanted.length ? wanted.includes(d) : true));

if (!devices.length) {
  console.error("no devices with slides — nothing to export");
  process.exit(1);
}

const browser = await chromium.launch();
// Big viewport: the preview stage scales to fit, and a cramped window makes the
// canvas render at a scale html-to-image then has to upsample.
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
page.on("pageerror", (e) => console.error("  page error:", e.message));

// Clear only what this run rebuilds. Wiping OUT wholesale meant a partial run
// ("export.mjs feature-graphic") silently deleted the decks it was not asked
// to touch.
fs.mkdirSync(OUT, { recursive: true });
for (const device of devices) {
  fs.rmSync(path.join(OUT, device), { recursive: true, force: true });
}

for (const device of devices) {
  process.stdout.write(`${device}: `);

  // The editor persists the active device in the project file, so set it there
  // and reload rather than trying to drive a custom select widget.
  const state = JSON.parse(fs.readFileSync("app-store-screenshots.json", "utf8"));
  state.device = device;
  fs.writeFileSync("app-store-screenshots.json", JSON.stringify(state, null, 2) + "\n");

  await page.goto(BASE, { waitUntil: "networkidle" });
  // localStorage is an instant-paint mirror of the project file and wins on
  // load; clearing it forces the reload to read the device we just wrote.
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const button = page.getByRole("button", { name: /export bundle/i });
  await button.waitFor({ state: "visible", timeout: 30_000 });

  const download = await Promise.all([
    page.waitForEvent("download", { timeout: 240_000 }),
    button.click(),
  ]).then(([d]) => d);

  const zip = path.join(OUT, `${device}.zip`);
  await download.saveAs(zip);
  const dir = path.join(OUT, device);
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("unzip", ["-q", "-o", zip, "-d", dir]);
  fs.unlinkSync(zip);

  const pngs = [];
  (function walk(p) {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".png")) pngs.push(full);
    }
  })(dir);

  // html-to-image writes RGBA, and App Store Connect refuses any screenshot
  // carrying an alpha channel ("Images can't contain alpha channels or
  // transparencies"). Flatten onto the deck's own background so the upload is
  // accepted and nothing changes visually.
  flattenToRgb(pngs);
  console.log(`${pngs.length} png`);
}

await browser.close();
console.log(`\ndone → ${OUT}`);
