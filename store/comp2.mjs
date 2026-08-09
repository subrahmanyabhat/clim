import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/testflight/ios", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(12000);
const links = await p.evaluate(() => [...document.querySelectorAll('a,button')].filter(e=>e.offsetParent)
  .map(e => `"${e.innerText.trim().slice(0,30)}" href=${(e.getAttribute('href')||'').slice(0,60)}`)
  .filter(s => /compliance|manage|1\.1\.0|build|provide/i.test(s)).slice(0,10));
console.log("links:", JSON.stringify(links, null, 1));
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
const i = t.search(/missing compliance|1\.1\.0/i);
console.log("context:", i>=0 ? t.slice(i-100, i+200) : 'none');
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/tf-build.png' });
await b.close();
