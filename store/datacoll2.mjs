import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.evaluate(() => document.querySelector('#CONFIRM_COLLECT_DATA_radio_false')?.click());
await p.waitForTimeout(2000);
console.log("selected 'no data collected':", await p.evaluate(() => document.querySelector('#CONFIRM_COLLECT_DATA_radio_false')?.checked));
await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]') || document;
  const s = [...d.querySelectorAll('button')].filter(e=>e.offsetParent).find(e => /^save$/i.test(e.innerText.trim()));
  s && s.click();
});
await p.waitForTimeout(10000);
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
const i = t.search(/data (types|not) collected|no data|privacy practices/i);
console.log("state:", i>=0 ? t.slice(i, i+220) : t.slice(400, 640));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/privacy-answered.png' });
await b.close();
