import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.evaluate(() => {
  const m = [...document.querySelectorAll('a,button')].filter(e=>e.offsetParent).find(e => /^manage$/i.test(e.innerText.trim()));
  m && m.click();
});
await p.waitForTimeout(8000);
const info = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  const scope = d || document;
  return {
    dialog: !!d,
    text: (d ? d.innerText : document.body.innerText).replace(/\s+/g,' ').slice(0, 700),
    radios: [...scope.querySelectorAll('input[type=radio],input[type=checkbox]')].filter(e=>e.offsetParent).map(r => {
      let n=r,l=''; for(let i=0;i<7&&n;i++,n=n.parentElement){const t=(n.innerText||'').replace(/\s+/g,' ').trim(); if(t.length>25){l=t.slice(0,160);break;}}
      return `${r.id||r.name}|${r.value} :: ${l}`;
    }).slice(0,8),
    btns: [...scope.querySelectorAll('button')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean).slice(0,8),
  };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-q.png' });
await b.close();
