/**
 * THE browser. Start this once, leave it running, sign in once.
 *
 * It listens on a debug port, so every other script attaches to this same
 * window instead of launching its own. That was the bug: each script opened a
 * fresh browser and closed it on exit, so Apple asked for a sign-in every time.
 *
 *   node asc-browser.mjs        start it and hold it open
 *   node asc-do.mjs <command>   attach and act, without closing anything
 */
import { chromium } from "playwright";
import path from "node:path";
import os from "node:os";

const PROFILE = path.join(os.homedir(), ".clim-asc-profile");
const PORT = 9222;

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1500, height: 950 },
  args: [
    `--remote-debugging-port=${PORT}`,
    "--disable-blink-features=AutomationControlled",
  ],
});

const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto("https://developer.apple.com/account/resources/identifiers/list",
  { waitUntil: "domcontentloaded" }).catch(() => {});

console.log(`browser up on debug port ${PORT}, profile ${PROFILE}`);
console.log("sign in once in this window; it will not close on its own");

// Hold the process open so the window stays alive. Ctrl-C, or `pkill -f
// asc-browser`, is the only thing that closes it.
await new Promise(() => {});
