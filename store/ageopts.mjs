import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
const info = await p.evaluate(() => {
  const names = [...new Set([...document.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(r=>r.name))];
  return names.map(n => {
    const opts = [...document.querySelectorAll(`input[name="${n}"]`)].map(r => r.id.replace(n+'__',''));
    let node = document.querySelector(`input[name="${n}"]`), label='';
    for (let i=0;i<8&&node;i++,node=node.parentElement){ const t=(node.innerText||'').replace(/\s+/g,' ').trim(); if(t.length>25){label=t.slice(0,90);break;} }
    return `${n} [${opts.join(', ')}] :: ${label}`;
  });
});
console.log(info.join("\n\n"));
await b.close();
