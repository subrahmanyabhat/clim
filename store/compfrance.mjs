import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
const radios = await p.evaluate(() => [...document.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent)
  .map(r => ({ id: r.id, name: r.name, label: (r.closest('label,li,div')?.innerText||'').replace(/\s+/g,' ').slice(0,40) })));
console.log("options:", JSON.stringify(radios, null, 1));
const yes = radios.find(r => /^yes/i.test(r.label.trim()) || /true/i.test(r.id));
if (yes) { await p.locator('#' + yes.id).check(); console.log("checked:", yes.id, yes.label); }
await p.waitForTimeout(2000);
await p.getByText('Save', { exact: true }).last().click();
await p.waitForTimeout(10000);
const t = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  return d ? 'dialog: ' + d.innerText.replace(/\s+/g,' ').slice(0,300)
           : 'closed | missing compliance still: ' + /missing compliance/i.test(document.body.innerText);
});
console.log(t);
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-saved.png' });
await b.close();
