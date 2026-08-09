import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
// NaCl / tweetnacl: Curve25519 + XSalsa20-Poly1305. Published, standard,
// implemented in the app rather than only calling Apple's crypto.
await p.evaluate(() => document.querySelector('#encryptionCheck_standardEncryption')?.click());
await p.waitForTimeout(2000);
console.log("selected standard:", await p.evaluate(() => document.querySelector('#encryptionCheck_standardEncryption')?.checked));
await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  const s = [...d.querySelectorAll('button')].find(e => /^save$/i.test(e.innerText.trim()));
  s && s.click();
});
await p.waitForTimeout(8000);
const info = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  const scope = d || document;
  return {
    dialog: !!d,
    text: (d ? d.innerText : document.body.innerText).replace(/\s+/g,' ').slice(0, 600),
    radios: [...scope.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(r => {
      let n=r,l=''; for(let i=0;i<7&&n;i++,n=n.parentElement){const t=(n.innerText||'').replace(/\s+/g,' ').trim(); if(t.length>25){l=t.slice(0,170);break;}}
      return `${r.id}|${r.value} :: ${l}`;
    }).slice(0,6),
  };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-q2.png' });
await b.close();
