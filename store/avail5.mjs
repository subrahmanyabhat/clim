import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.waitForTimeout(6000);
const t = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  const body = document.body.innerText.replace(/\s+/g,' ');
  const i = body.search(/availability/i);
  return { dialog: d ? d.innerText.replace(/\s+/g,' ').slice(0,250) : null, page: i>=0 ? body.slice(i, i+250) : body.slice(0,200) };
});
console.log(JSON.stringify(t, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/availability4.png' });
await b.close();
