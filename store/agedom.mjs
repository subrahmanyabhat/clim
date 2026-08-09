import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
const domClick = (re) => p.evaluate((r) => {
  const btn = [...document.querySelectorAll('button')].find(e => e.offsetParent && new RegExp(r,'i').test(e.innerText.trim()));
  if (!btn) return null; btn.click(); return btn.innerText.trim();
}, re.source ?? re);

console.log("open:", await domClick('^set up age ratings$'));
await p.waitForTimeout(6000);
for (let s=0; s<10; s++) {
  const names = await p.evaluate(() => [...new Set([...document.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(r=>r.name))]);
  await p.evaluate((ns) => { for (const n of ns) { const el = document.querySelector(`#${n}__NONE`) || document.querySelector(`#${n}__false`); if (el) el.click(); } }, names);
  await p.waitForTimeout(1800);
  const nxt = await domClick('^(next|continue)$');
  const btns = await p.evaluate(() => [...document.querySelectorAll('button')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean).slice(0,10));
  console.log(`step ${s}: q=${names.length} next=${nxt} buttons=[${btns.join(',')}]`);
  if (!nxt) { console.log("finish:", await domClick('^(done|submit|confirm)$')); break; }
  await p.waitForTimeout(5000);
}
await p.waitForTimeout(6000);
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
console.log("\nrating shown:", (t.match(/(4\+|9\+|13\+|16\+|18\+)/)||['none'])[0]);
console.log("still 'Set Up Age Ratings':", /set up age rating/i.test(t));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/age-done.png' });
await b.close();
