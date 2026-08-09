import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
for (const [id, v] of [
  ['contactFirstName','Subrahmanya'], ['contactLastName','Bhat'],
  ['contactEmail','subrahmanya126@gmail.com'], ['contactPhone','+91 9480420288'],
]) { await p.locator('#'+id).fill(v); }
await p.waitForTimeout(1500);
console.log("contact:", JSON.stringify(await p.evaluate(() => ({
  f: document.querySelector('#contactFirstName')?.value, l: document.querySelector('#contactLastName')?.value,
  e: document.querySelector('#contactEmail')?.value, p: document.querySelector('#contactPhone')?.value,
}))));
console.log(await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(e => /^save$/i.test(e.innerText.trim()) && !e.disabled);
  if (!btn) return 'no enabled save'; btn.click(); return 'saved';
}));
await p.waitForTimeout(14000);
console.log(JSON.stringify(await p.evaluate(() => {
  const t = document.body.innerText;
  return { banner: /one or more errors/i.test(t),
           invalid: [...document.querySelectorAll('[aria-invalid="true"]')].filter(e=>e.offsetParent).map(e=>e.id),
           shots: (t.match(/(\d+) of 10 Screenshots/)||[])[1] };
}), null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/contact-saved.png' });
await b.close();
