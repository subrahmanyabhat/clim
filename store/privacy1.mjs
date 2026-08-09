import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/distribution/privacy", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(11000);
const info = await p.evaluate(() => ({
  url: location.href,
  body: document.body.innerText.replace(/\s+/g,' ').slice(0, 600),
  btns: [...document.querySelectorAll('button,a')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean).slice(0,18),
}));
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/privacy.png' });
await b.close();
