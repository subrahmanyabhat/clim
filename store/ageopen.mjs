import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
const r = await p.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter(e=>e.offsetParent);
  const b = btns.find(e => /set up age rating/i.test(e.innerText));
  if (!b) return 'button missing';
  b.scrollIntoView({block:'center'}); b.click(); return 'clicked ' + b.innerText.trim();
});
console.log(r);
await p.waitForTimeout(12000);
const st = await p.evaluate(() => ({
  radios: [...new Set([...document.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(x=>x.name))],
  dialog: !!document.querySelector('[role=dialog]'),
  buttons: [...document.querySelectorAll('button')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean).slice(0,12),
}));
console.log(JSON.stringify(st, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/age-open-state.png' });
await b.close();
