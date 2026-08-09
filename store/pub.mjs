import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
const r = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].filter(e=>e.offsetParent).find(e => /^publish$/i.test(e.innerText.trim()));
  if (!btn) return 'no publish button';
  if (btn.disabled) return 'publish disabled';
  btn.click(); return 'clicked publish';
});
console.log(r);
await p.waitForTimeout(5000);
// A confirmation dialog usually follows
const conf = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  if (!d) return 'no dialog';
  const btn = [...d.querySelectorAll('button')].find(e => /^(publish|confirm|yes)$/i.test(e.innerText.trim()));
  if (btn) { btn.click(); return 'confirmed: ' + btn.innerText.trim(); }
  return 'dialog text: ' + d.innerText.replace(/\s+/g,' ').slice(0,160);
});
console.log(conf);
await p.waitForTimeout(9000);
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
console.log("published?", /published/i.test(t) ? "yes" : "check screenshot");
const i = t.search(/data not collected/i);
console.log("state:", i>=0 ? t.slice(i-60, i+140) : '');
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/privacy-published.png' });
await b.close();
