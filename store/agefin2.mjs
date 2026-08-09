import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/distribution/info", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(e=>/^set up age ratings$/i.test(e.innerText.trim())); b&&b.click(); });
await p.waitForTimeout(7000);

for (let s = 0; s < 12; s++) {
  const names = await p.evaluate(() => [...new Set([...document.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(r=>r.name))]);
  const answered = await p.evaluate((ns) => {
    let n = 0;
    for (const name of ns) {
      const el = document.querySelector(`#${name}__NONE`) || document.querySelector(`#${name}__false`);
      if (el && !el.checked) { el.click(); n++; }
    }
    return n;
  }, names);
  await p.waitForTimeout(2000);
  const acted = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(e => e.offsetParent && /^(next|continue|done|submit|confirm)$/i.test(e.innerText.trim()));
    if (!btn) return null; const label = btn.innerText.trim(); btn.click(); return label;
  });
  console.log(`step ${s}: questions=${names.length} answered=${answered} clicked=${acted}`);
  if (!acted) break;
  await p.waitForTimeout(5000);
  if (/done|submit|confirm/i.test(acted)) break;
}
await p.waitForTimeout(5000);
await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(e=>/^save$/i.test(e.innerText.trim())&&!e.disabled); b&&b.click(); });
await p.waitForTimeout(10000);
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
const i = t.search(/age rating/i);
console.log("\nsection:", i>=0 ? t.slice(i, i+200) : '');
console.log("pending setup:", /set up age rating/i.test(t));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/age-final-state.png' });
await b.close();
