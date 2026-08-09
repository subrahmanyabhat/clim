import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.getByRole('button', { name: /set up age ratings/i }).first().click();
await p.waitForTimeout(7000);
const info = await p.evaluate(() => {
  const sels = [...document.querySelectorAll('select')].filter(e=>e.offsetParent)
    .map(s => `${s.id||s.name}: [${[...s.options].map(o=>o.text).slice(0,5).join(' | ')}]`);
  const radios = [...document.querySelectorAll('input[type=radio],input[type=checkbox]')].filter(e=>e.offsetParent)
    .map(r => `${r.type} id=${r.id} name=${r.name}`).slice(0,20);
  return { sels: sels.slice(0,14), radios, body: document.body.innerText.replace(/\s+/g,' ').slice(0,700) };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/age-dialog.png' });
await b.close();
