import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
const qs = await p.evaluate(() => {
  const names = [...new Set([...document.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(r=>r.name))];
  return names.map(n => {
    const r = document.querySelector(`input[name="${n}"]`);
    let node = r, label = '';
    for (let i=0;i<8 && node;i++, node = node.parentElement) {
      const txt = (node.innerText||'').replace(/\s+/g,' ').trim();
      if (txt.length > 25) { label = txt.slice(0,150); break; }
    }
    return `${n} :: ${label}`;
  });
});
console.log(qs.join("\n\n"));
await b.close();
