import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].filter(e=>e.offsetParent).find(e => /^edit$/i.test(e.innerText.trim()));
  btn && btn.click();
});
await p.waitForTimeout(6000);
const fields = await p.evaluate(() => [...document.querySelectorAll('input[type=text],input[type=url],textarea')].filter(e=>e.offsetParent)
  .map(e => `${e.tagName}[${e.type}] id=${e.id} name=${e.name} ph="${e.placeholder||''}" aria="${e.getAttribute('aria-label')||''}"`));
console.log("fields:", JSON.stringify(fields, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/privacy-edit.png' });
await b.close();
