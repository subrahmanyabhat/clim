import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));

await p.evaluate(() => document.querySelector('#IOS_APP_STORE')?.click());
await p.waitForTimeout(1500);
await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(e=>/^continue$/i.test(e.innerText.trim())); b&&b.click(); });
await p.waitForTimeout(7000);

// Step 2: choose the App ID
const sel = await p.evaluate(() => {
  const s = [...document.querySelectorAll('select')].filter(e=>e.offsetParent);
  return s.map(x => `${x.id||x.name}: ${[...x.options].map(o=>o.text).slice(0,6).join(' | ')}`);
});
console.log("selects:", JSON.stringify(sel, null, 1));
const picked = await p.evaluate(() => {
  const s = [...document.querySelectorAll('select')].filter(e=>e.offsetParent)[0];
  if (!s) return 'no select';
  const o = [...s.options].find(o => /com\.dingalabs\.clim/.test(o.text));
  if (!o) return 'clim not listed';
  s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true }));
  return 'selected ' + o.text;
});
console.log(picked);
await p.waitForTimeout(2500);
await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(e=>/^continue$/i.test(e.innerText.trim())); b&&b.click(); });
await p.waitForTimeout(7000);
const step3 = await p.evaluate(() => ({
  checks: [...document.querySelectorAll('input[type=checkbox],input[type=radio]')].filter(e=>e.offsetParent).map(c=>{
    let n=c,l=''; for(let i=0;i<6&&n;i++,n=n.parentElement){const t=(n.innerText||'').replace(/\s+/g,' ').trim(); if(t.length>10){l=t.slice(0,70);break;}}
    return `${c.id||c.name} :: ${l}`;
  }).slice(0,10),
  body: document.body.innerText.replace(/\s+/g,' ').slice(0,260),
}));
console.log(JSON.stringify(step3, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/prof-cert.png' });
await b.close();
