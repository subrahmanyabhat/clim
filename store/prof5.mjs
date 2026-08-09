import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
// Include both distribution certs so the profile matches whichever private key
// is in the local keychain.
const n = await p.evaluate(() => {
  const cs = [...document.querySelectorAll('input[type=checkbox],input[type=radio]')].filter(e=>e.offsetParent);
  cs.forEach(c => { if (!c.checked) c.click(); });
  return cs.length;
});
console.log("certs selected:", n);
await p.waitForTimeout(2000);
await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(e=>/^continue$/i.test(e.innerText.trim())); b&&b.click(); });
await p.waitForTimeout(8000);
const step = await p.evaluate(() => ({
  inputs: [...document.querySelectorAll('input[type=text]')].filter(e=>e.offsetParent).map(e=>`${e.id||e.name}`),
  body: document.body.innerText.replace(/\s+/g,' ').slice(0,250),
  btns: [...document.querySelectorAll('button')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean).slice(0,6),
}));
console.log(JSON.stringify(step, null, 1));
await b.close();
