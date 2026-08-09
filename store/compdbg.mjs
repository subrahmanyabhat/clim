import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
const info = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  if (!d) return 'no dialog';
  return {
    buttons: [...d.querySelectorAll('button')].map(e => `"${e.innerText.trim()}" disabled=${e.disabled} aria-disabled=${e.getAttribute('aria-disabled')} cls=${(e.className||'').slice(0,40)}`),
    checked: [...d.querySelectorAll('input[type=radio]')].map(r => `${r.id}=${r.checked}`),
  };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
