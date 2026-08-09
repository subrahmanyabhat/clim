import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
// Leave the override alone (Not Applicable) — 4+ is the honest calculated result.
const btns = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]') || document;
  return [...d.querySelectorAll('button')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean);
});
console.log("dialog buttons:", JSON.stringify(btns));
const clicked = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]') || document;
  const btn = [...d.querySelectorAll('button')].filter(e=>e.offsetParent)
    .find(e => /^(done|submit|confirm|save|finish)$/i.test(e.innerText.trim()));
  if (!btn) return null; const l = btn.innerText.trim(); btn.click(); return l;
});
console.log("clicked:", clicked);
await p.waitForTimeout(10000);
const st = await p.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g,' ');
  const i = t.search(/age rating/i);
  return { pending: /set up age rating/i.test(t), near: i>=0 ? t.slice(i, i+140) : '' };
});
console.log(JSON.stringify(st, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/age-saved-final.png' });
await b.close();
