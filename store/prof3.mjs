import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
await p.waitForTimeout(6000);
const info = await p.evaluate(() => ({
  selects: [...document.querySelectorAll('select')].map(s => `${s.id||s.name} visible=${!!s.offsetParent} opts=${[...s.options].map(o=>o.text).slice(0,5).join(' | ')}`),
  inputs: [...document.querySelectorAll('input')].filter(e=>e.offsetParent).map(e=>`${e.type} id=${e.id} name=${e.name}`).slice(0,10),
  body: document.body.innerText.replace(/\s+/g,' ').slice(0,300),
}));
console.log(JSON.stringify(info, null, 1));
await b.close();
