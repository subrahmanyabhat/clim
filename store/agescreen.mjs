import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
const t = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  return d ? d.innerText.replace(/\s+/g,' ').slice(0,700) : 'no dialog: ' + document.body.innerText.replace(/\s+/g,' ').slice(0,300);
});
console.log(t);
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/age-last-step.png' });
await b.close();
