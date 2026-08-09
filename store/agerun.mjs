import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));

for (let s = 0; s < 12; s++) {
  const names = await p.evaluate(() => [...new Set([...document.querySelectorAll('[role=dialog] input[type=radio], input[type=radio]')].filter(e=>e.offsetParent).map(r=>r.name))]);
  if (!names.length) { console.log(`step ${s}: no questions`); break; }
  const n = await p.evaluate((ns) => {
    let c = 0;
    for (const name of ns) {
      const el = document.querySelector(`#${name}__NONE`) || document.querySelector(`#${name}__false`);
      if (el) { el.click(); c++; }
    }
    return c;
  }, names);
  await p.waitForTimeout(2500);
  const acted = await p.evaluate(() => {
    const scope = document.querySelector('[role=dialog]') || document;
    const btn = [...scope.querySelectorAll('button')].filter(e=>e.offsetParent)
      .find(e => /^(next|continue|done|submit|confirm)$/i.test(e.innerText.trim()));
    if (!btn) return null; const l = btn.innerText.trim(); btn.click(); return l;
  });
  console.log(`step ${s}: q=${names.length} answered=${n} clicked=${acted || 'nothing'}`);
  if (!acted) break;
  await p.waitForTimeout(5500);
  if (/done|submit|confirm/i.test(acted)) break;
}
await p.waitForTimeout(4000);
const after = await p.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g,' ');
  return { pending: /set up age rating/i.test(t), rating: (t.match(/Age Rating[^A-Za-z]{0,12}(4\+|9\+|13\+|16\+|18\+)/i)||[])[1] || (t.match(/\b(4\+|9\+|13\+|16\+|18\+)\b/)||[])[1] };
});
console.log("\nafter questionnaire:", JSON.stringify(after));
await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(e=>/^save$/i.test(e.innerText.trim())&&!e.disabled); b&&b.click(); });
await p.waitForTimeout(10000);
console.log("saved. pending now:", await p.evaluate(() => /set up age rating/i.test(document.body.innerText)));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/age-complete.png' });
await b.close();
