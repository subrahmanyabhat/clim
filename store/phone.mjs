import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/distribution/ios/version/inflight", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
// Apple requires a leading + and country code. 10 digits starting 9 is an
// Indian mobile, and the account is Indian, so +91.
await p.locator('#contactPhone').fill('+91 9480420288');
await p.waitForTimeout(1500);
console.log("phone:", await p.evaluate(() => document.querySelector('#contactPhone')?.value));
const clicked = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(e => /^save$/i.test(e.innerText.trim()) && !e.disabled);
  if (!btn) return 'no enabled save'; btn.click(); return 'saved';
});
console.log(clicked);
await p.waitForTimeout(12000);
const st = await p.evaluate(() => {
  const t = document.body.innerText;
  return {
    errors: (t.match(/(This field is required|This field is invalid)[^\n]{0,60}/gi)||[]).slice(0,4),
    hasErrorBanner: /one or more errors on this page/i.test(t),
    shots: (t.match(/(\d+) of 10 Screenshots/)||[])[1],
  };
});
console.log(JSON.stringify(st, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/phone-saved.png' });
await b.close();
