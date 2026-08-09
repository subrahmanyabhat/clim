import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.evaluate(() => { const btn=[...document.querySelectorAll('button')].find(e=>/^add build$/i.test(e.innerText.trim())); btn&&btn.click(); });
await p.waitForTimeout(8000);
const rid = await p.evaluate(() => {
  const r = document.querySelector('[role=dialog] input[type=radio]');
  return r ? r.id : null;
});
console.log("build radio:", rid);
if (rid) { await p.locator('#' + rid).check(); await p.waitForTimeout(2000); }
await p.getByText('Done', { exact: true }).last().click({ timeout: 20000 }).catch(e => console.log("done click:", e.message.slice(0,40)));
await p.waitForTimeout(9000);
const st = await p.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g,' ');
  const i = t.search(/BUILD VERSION STATUS|Build 1/);
  return { row: i>=0 ? t.slice(i, i+120) : 'not attached', missing: /missing compliance/i.test(t) };
});
console.log(JSON.stringify(st, null, 1));
// Save the version so the attachment sticks
await p.evaluate(() => { const s=[...document.querySelectorAll('button')].find(e=>/^save$/i.test(e.innerText.trim())&&!e.disabled); s&&s.click(); });
await p.waitForTimeout(10000);
console.log("saved. errors:", await p.evaluate(() => /one or more errors/i.test(document.body.innerText)));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/build-attached2.png' });
await b.close();
