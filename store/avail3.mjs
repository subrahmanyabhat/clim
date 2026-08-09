import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
const opts = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  if (!d) return 'no dialog';
  return [...d.querySelectorAll('input')].map(i => `${i.type} id=${i.id} name=${i.name} value=${i.value} checked=${i.checked} label="${(i.closest('label,li,div')?.innerText||'').replace(/\s+/g,' ').slice(0,45)}"`);
});
console.log(JSON.stringify(opts, null, 1));
await b.close();
