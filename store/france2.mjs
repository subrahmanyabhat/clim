import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.waitForTimeout(8000);
console.log("url:", p.url());
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 500));
console.log("page:", t);
const links = await p.evaluate(() => [...document.querySelectorAll('a')].filter(e=>e.offsetParent)
  .map(e=>`${e.innerText.trim().slice(0,26)} -> ${(e.getAttribute('href')||'').slice(0,50)}`)
  .filter(s=>/pricing|availability/i.test(s)).slice(0,6));
console.log("links:", JSON.stringify(links));
await b.close();
