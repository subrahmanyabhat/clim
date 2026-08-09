import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.getByRole('button', { name: /set up age ratings/i }).first().click();
await p.waitForTimeout(6000);

for (let step=0; step<10; step++) {
  const names = await p.evaluate(() => [...new Set([...document.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(r=>r.name))]);
  for (const n of names) {
    for (const s of ['__NONE','__false']) {
      const el = p.locator(`#${n}${s}`);
      if (await el.count()) { await el.check().catch(()=>{}); break; }
    }
  }
  await p.waitForTimeout(1800);
  const btns = await p.evaluate(() => [...document.querySelectorAll('button')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean));
  const finish = btns.find(x => /^(done|submit|confirm|save)$/i.test(x));
  const next = btns.find(x => /^(next|continue)$/i.test(x));
  console.log(`step ${step}: q=${names.length} buttons=[${btns.slice(0,8).join(',')}]`);
  if (next) { await p.getByRole('button', { name: new RegExp(`^${next}$`, 'i') }).first().click().catch(()=>{}); await p.waitForTimeout(5000); continue; }
  if (finish && /done|submit|confirm/i.test(finish)) {
    console.log("  clicking", finish);
    await p.getByRole('button', { name: new RegExp(`^${finish}$`, 'i') }).first().click().catch(()=>{});
    await p.waitForTimeout(7000);
  }
  break;
}
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
const m = t.match(/(4\+|9\+|13\+|16\+|18\+)/);
console.log("\ncomputed rating:", m ? m[1] : "not displayed");
console.log("still says Set Up:", /set up age rating/i.test(t));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/age-submitted.png' });
await b.close();
