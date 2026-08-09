import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.evaluate(() => {
  const g = [...document.querySelectorAll('button,a')].filter(e=>e.offsetParent).find(e => /get started/i.test(e.innerText));
  g && g.click();
});
await p.waitForTimeout(8000);
const info = await p.evaluate(() => ({
  radios: [...document.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(r => {
    let n=r,l=''; for(let i=0;i<7&&n;i++,n=n.parentElement){const t=(n.innerText||'').replace(/\s+/g,' ').trim(); if(t.length>20){l=t.slice(0,110);break;}}
    return `${r.id||r.name} :: ${l}`;
  }).slice(0,8),
  btns: [...document.querySelectorAll('button')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean).slice(0,10),
  body: document.body.innerText.replace(/\s+/g,' ').slice(-420),
}));
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/datacollection.png' });
await b.close();
