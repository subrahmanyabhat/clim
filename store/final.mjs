import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/testflight/ios", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(11000);
const tf = await p.evaluate(() => (document.body.innerText.match(/Build\s*1[\s\S]{0,80}/)||[''])[0].replace(/\s+/g,' '));
console.log("TestFlight build row:", tf);
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/distribution/ios/version/inflight", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(12000);
const v = await p.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g,' ');
  const i = t.search(/BUILD VERSION|Build\b/);
  return {
    build: i>=0 ? t.slice(i, i+120) : 'no build section',
    errors: /one or more errors/i.test(t),
    addForReview: [...document.querySelectorAll('button')].some(e => /add for review/i.test(e.innerText) && !e.disabled),
    missing: /missing compliance/i.test(t),
  };
});
console.log(JSON.stringify(v, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/ready.png', fullPage: true });
await b.close();
