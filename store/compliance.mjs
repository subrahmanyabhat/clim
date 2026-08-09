import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/distribution/ios/version/inflight", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(12000);
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
for (const re of [/build/i, /export compliance/i, /encryption/i]) {
  const i = t.search(re);
  console.log(`--- ${re} ---`, i>=0 ? t.slice(i, i+240) : 'not present');
}
const btns = await p.evaluate(() => [...document.querySelectorAll('button')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean).slice(0,20));
console.log("buttons:", JSON.stringify(btns));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/version-build.png', fullPage: true });
await b.close();
