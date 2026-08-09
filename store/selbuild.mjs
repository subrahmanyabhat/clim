import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.evaluate(() => {
  const r = document.querySelector('#f89a9ff0-1a1b-43f3-93d3-e083c4e6d492') ||
            document.querySelector('[role=dialog] input[type=radio]');
  r && r.click();
});
await p.waitForTimeout(2000);
await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  const done = [...d.querySelectorAll('button')].find(e => /^done$/i.test(e.innerText.trim()));
  done && done.click();
});
await p.waitForTimeout(9000);
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
const i = t.search(/build/i);
console.log("build section:", t.slice(i, i+260));
console.log("missing compliance present:", /missing compliance/i.test(t));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/build-attached.png' });
await b.close();
