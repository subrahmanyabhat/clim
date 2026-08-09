import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
const info = await p.evaluate(() => {
  const bad = [...document.querySelectorAll('[aria-invalid="true"]')].filter(e=>e.offsetParent)
    .map(e => `${e.tagName} id=${e.id||'?'} name=${e.name||'?'} val="${(e.value||'').slice(0,25)}"`);
  const t = document.body.innerText;
  const i = t.search(/one or more errors/i);
  return { invalid: bad, context: i>=0 ? t.slice(i, i+260).replace(/\s+/g,' ') : '' };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
