import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
const found = await p.evaluate(() => {
  const all = [...document.querySelectorAll('button,a')].filter(e=>e.offsetParent);
  const gen = all.find(e => /generate api key|\+/i.test(e.innerText) || /generate/i.test(e.getAttribute('aria-label')||''));
  if (!gen) return { names: all.map(e=>`"${e.innerText.trim().slice(0,25)}" aria="${e.getAttribute('aria-label')||''}"`).slice(0,20) };
  gen.click(); return { clicked: gen.innerText.trim() || gen.getAttribute('aria-label') };
});
console.log(JSON.stringify(found, null, 1));
await p.waitForTimeout(6000);
const dlg = await p.evaluate(() => ({
  inputs: [...document.querySelectorAll('input,select')].filter(e=>e.offsetParent).map(e=>`${e.tagName}[${e.type||''}] id=${e.id} name=${e.name}`),
  selects: [...document.querySelectorAll('select')].filter(e=>e.offsetParent).map(s=>`${s.id}: ${[...s.options].map(o=>o.text).join(' | ')}`),
  body: document.body.innerText.replace(/\s+/g,' ').slice(-300),
}));
console.log(JSON.stringify(dlg, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/apikey-dialog.png' });
await b.close();
