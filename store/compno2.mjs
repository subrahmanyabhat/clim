import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
const state = await p.evaluate(() => ({
  dialog: !!document.querySelector('[role=dialog]'),
  text: (document.querySelector('[role=dialog]')?.innerText || document.body.innerText).replace(/\s+/g,' ').slice(0,200),
  radios: [...document.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(r=>r.id),
}));
console.log(JSON.stringify(state, null, 1));
if (!state.dialog) {
  await p.goto("https://appstoreconnect.apple.com/apps/6799607439/testflight/ios", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(11000);
  await p.evaluate(() => { const m=[...document.querySelectorAll('a,button')].find(e=>/^manage$/i.test(e.innerText.trim())); m&&m.click(); });
  await p.waitForTimeout(9000);
  await p.locator('#encryptionCheck_standardEncryption').check();
  await p.waitForTimeout(2000);
  await p.getByText('Next', { exact: true }).last().click();
  await p.waitForTimeout(7000);
  console.log("reopened to France step");
}
await p.locator('#franceCheck_no').check();
await p.waitForTimeout(2500);
await p.getByText('Save', { exact: true }).last().click({ timeout: 25000 });
await p.waitForTimeout(12000);
const after = await p.evaluate(() => ({
  dialog: !!document.querySelector('[role=dialog]'),
  missing: /missing compliance/i.test(document.body.innerText),
}));
console.log("after:", JSON.stringify(after));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-final2.png' });
await b.close();
