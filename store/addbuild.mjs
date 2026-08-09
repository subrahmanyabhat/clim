import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].filter(e=>e.offsetParent).find(e => /^add build$/i.test(e.innerText.trim()));
  btn && btn.click();
});
await p.waitForTimeout(8000);
const info = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  return {
    dialog: !!d,
    text: (d ? d.innerText : document.body.innerText).replace(/\s+/g,' ').slice(0, 400),
    radios: [...(d||document).querySelectorAll('input[type=radio],input[type=checkbox]')].filter(e=>e.offsetParent).map(r=>r.id||r.name).slice(0,6),
    btns: [...(d||document).querySelectorAll('button')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean).slice(0,8),
  };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/addbuild.png' });
await b.close();
