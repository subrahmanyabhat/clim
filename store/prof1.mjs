import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://developer.apple.com/account/resources/profiles/add", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
const info = await p.evaluate(() => {
  const radios = [...document.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(r => {
    let n=r, label='';
    for(let i=0;i<6&&n;i++,n=n.parentElement){const t=(n.innerText||'').replace(/\s+/g,' ').trim(); if(t.length>10){label=t.slice(0,60);break;}}
    return `${r.id} :: ${label}`;
  });
  return { url: location.href, radios: radios.slice(0,20), btns: [...document.querySelectorAll('button')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean).slice(0,6) };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
