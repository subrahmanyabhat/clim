import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
const r = await p.evaluate(() => {
  const el = [...document.querySelectorAll('a,button,span')].filter(e=>e.offsetParent)
    .find(e => /missing compliance|manage/i.test(e.innerText.trim()));
  if (!el) return 'not found';
  el.click(); return 'clicked: ' + el.innerText.trim().slice(0,30);
});
console.log(r);
await p.waitForTimeout(8000);
const info = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  const scope = d || document;
  return {
    dialog: !!d,
    radios: [...scope.querySelectorAll('input[type=radio],input[type=checkbox]')].filter(e=>e.offsetParent).map(r => {
      let n=r,l=''; for(let i=0;i<7&&n;i++,n=n.parentElement){const t=(n.innerText||'').replace(/\s+/g,' ').trim(); if(t.length>25){l=t.slice(0,150);break;}}
      return `${r.id||r.name} :: ${l}`;
    }).slice(0,8),
    text: (d ? d.innerText : '').replace(/\s+/g,' ').slice(0,400),
    btns: [...scope.querySelectorAll('button')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean).slice(0,8),
  };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-dialog.png' });
await b.close();
