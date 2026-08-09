import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/pricing", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(13000);
const info = await p.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g,' ');
  const i = t.search(/availability|countries|regions/i);
  return {
    near: i>=0 ? t.slice(i, i+300) : t.slice(0,240),
    links: [...document.querySelectorAll('a,button')].filter(e=>e.offsetParent)
      .map(e=>e.innerText.trim()).filter(x=>/edit|availability|countries|region|set up/i.test(x)).slice(0,8),
  };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/pricing.png' });
await b.close();
