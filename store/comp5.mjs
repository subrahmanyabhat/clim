import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
for (let step = 0; step < 6; step++) {
  const acted = await p.evaluate(() => {
    const d = document.querySelector('[role=dialog]'); if (!d) return null;
    const btn = [...d.querySelectorAll('button')].find(e => /^(next|save|done)$/i.test(e.innerText.trim()));
    if (!btn) return null; const l = btn.innerText.trim(); btn.click(); return l;
  });
  await p.waitForTimeout(7000);
  const info = await p.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    if (!d) return { closed: true, page: document.body.innerText.replace(/\s+/g,' ').match(/missing compliance/i) ? 'still missing' : 'compliance resolved?' };
    return {
      text: d.innerText.replace(/\s+/g,' ').slice(0, 420),
      radios: [...d.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(r => {
        let n=r,l=''; for(let i=0;i<7&&n;i++,n=n.parentElement){const t=(n.innerText||'').replace(/\s+/g,' ').trim(); if(t.length>25){l=t.slice(0,150);break;}}
        return `${r.id} :: ${l}`;
      }).slice(0,6),
    };
  });
  console.log(`step ${step} clicked=${acted}:`, JSON.stringify(info, null, 1));
  if (info.closed) break;
}
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-q3.png' });
await b.close();
