import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.locator('#franceCheck_no').check();
await p.waitForTimeout(2500);
console.log("France = No:", await p.evaluate(() => document.querySelector('#franceCheck_no')?.checked));
const save = p.getByText('Save', { exact: true }).last();
console.log("Save present:", await save.count());
await save.click({ timeout: 25000 });
await p.waitForTimeout(11000);
const st = await p.evaluate(() => ({
  dialog: !!document.querySelector('[role=dialog]'),
  missing: /missing compliance/i.test(document.body.innerText),
  row: (document.body.innerText.match(/Build\s*1[\s\S]{0,60}/)||[])[0].replace(/\s+/g,' '),
}));
console.log(JSON.stringify(st, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-cleared.png' });
await b.close();
