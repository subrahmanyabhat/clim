import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
const t = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  return {
    dialog: d ? d.innerText.replace(/\s+/g,' ').slice(0,300) : null,
    missing: /missing compliance/i.test(document.body.innerText),
    buildRow: (document.body.innerText.match(/Build 1[^\n]{0,80}/)||[])[0],
  };
});
console.log(JSON.stringify(t, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-now.png' });
await b.close();
