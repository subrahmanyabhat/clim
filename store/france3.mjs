import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/distribution/ios/version/inflight", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(11000);
await p.getByText('Pricing and Availability', { exact: false }).first().click({ timeout: 20000 });
await p.waitForTimeout(13000);
console.log("url:", p.url());
const info = await p.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g,' ');
  const i = t.search(/availability/i);
  return {
    near: i>=0 ? t.slice(i, i+260) : t.slice(0,200),
    edits: [...document.querySelectorAll('a,button')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(x=>/edit|set up/i.test(x)).slice(0,6),
  };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/pricing2.png' });
await b.close();
