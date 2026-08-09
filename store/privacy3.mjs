import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
const info = await p.evaluate(() => {
  const edits = [...document.querySelectorAll('button,a')].filter(e=>e.offsetParent)
    .map((e,i) => `${i}: "${e.innerText.trim().slice(0,24)}" href=${e.getAttribute('href')||''}`)
    .filter(s => /edit|get started|set up|publish/i.test(s));
  return { edits, body: document.body.innerText.replace(/\s+/g,' ').slice(300, 900) };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
