import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
const all = await p.evaluate(() => [...document.querySelectorAll('button')].filter(e=>e.offsetParent)
  .map(e => `"${e.innerText.trim().slice(0,16)}" disabled=${e.disabled}`).filter(s=>/next|save|done|submit|cancel/i.test(s)));
console.log("page buttons:", JSON.stringify(all));
const clicked = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].filter(e=>e.offsetParent && !e.disabled)
    .find(e => /^(next|save|done|submit)$/i.test(e.innerText.trim()));
  if (!btn) return 'none enabled';
  const l = btn.innerText.trim(); btn.click(); return 'clicked ' + l;
});
console.log(clicked);
await p.waitForTimeout(8000);
const d = await p.evaluate(() => {
  const dlg = document.querySelector('[role=dialog]');
  return dlg ? dlg.innerText.replace(/\s+/g,' ').slice(0,400) : 'dialog closed | page: ' + (document.body.innerText.match(/missing compliance/i) ? 'STILL MISSING' : 'compliance cleared');
});
console.log("after:", d);
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-next.png' });
await b.close();
