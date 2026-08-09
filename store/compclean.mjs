import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/testflight/ios", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(12000);
await p.getByRole('link', { name: /^manage$/i }).or(p.getByRole('button', { name: /^manage$/i })).first().click().catch(async () => {
  await p.evaluate(() => { const m=[...document.querySelectorAll('a,button')].find(e=>/^manage$/i.test(e.innerText.trim())); m&&m.click(); });
});
await p.waitForTimeout(9000);
console.log("dialog open:", await p.locator('[role=dialog]').count());
await p.getByLabel(/standard encryption algorithms/i).check().catch(async () => {
  await p.locator('#encryptionCheck_standardEncryption').check();
});
await p.waitForTimeout(2500);
const btns = await p.evaluate(() => [...document.querySelectorAll('button')].filter(e=>e.offsetParent).map(e=>`"${e.innerText.trim()}" disabled=${e.disabled}`));
console.log("buttons:", JSON.stringify(btns.slice(0,10)));
await b.close();
