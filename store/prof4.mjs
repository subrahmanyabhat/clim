import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
const input = p.locator('#react-select-2-input');
await input.click();
await input.type('clim', { delay: 120 });
await p.waitForTimeout(3000);
const opts = await p.evaluate(() => [...document.querySelectorAll('[id^="react-select"][id*="option"], [class*="option"]')]
  .filter(e=>e.offsetParent).map(e=>e.innerText.trim().slice(0,60)).slice(0,8));
console.log("options:", JSON.stringify(opts));
await p.keyboard.press('Enter');
await p.waitForTimeout(2500);
console.log("value now:", await p.evaluate(() => {
  const c = document.querySelector('[class*="singleValue"], [class*="SingleValue"]');
  return c ? c.innerText.trim() : 'unknown';
}));
await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(e=>/^continue$/i.test(e.innerText.trim())); b&&b.click(); });
await p.waitForTimeout(8000);
const step = await p.evaluate(() => ({
  checks: [...document.querySelectorAll('input[type=checkbox],input[type=radio]')].filter(e=>e.offsetParent).map(c=>{
    let n=c,l=''; for(let i=0;i<6&&n;i++,n=n.parentElement){const t=(n.innerText||'').replace(/\s+/g,' ').trim(); if(t.length>10){l=t.slice(0,70);break;}}
    return `${c.id||c.name} :: ${l}`;
  }).slice(0,8),
  body: document.body.innerText.replace(/\s+/g,' ').slice(0,300),
}));
console.log(JSON.stringify(step, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/prof-step3.png' });
await b.close();
