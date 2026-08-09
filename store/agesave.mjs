import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
// Look for a Next/Continue inside the age section before saving the page
const next = p.getByRole('button', { name: /^(next|continue|done)$/i }).first();
if (await next.count()) { console.log("clicking", (await next.innerText()).trim()); await next.click().catch(()=>{}); await p.waitForTimeout(6000); }
const info = await p.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g,' ');
  const radios = [...new Set([...document.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(r=>r.name))];
  const i = t.search(/violence|profanity|horror|gambling|frequency/i);
  return { radios, contentSection: i>=0 ? t.slice(i, i+300) : 'no content-frequency questions visible' };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/age-next.png' });
await b.close();
