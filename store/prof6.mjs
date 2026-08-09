import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.locator('#name').fill('clim App Store');
await p.waitForTimeout(1500);
await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(e=>/^generate$/i.test(e.innerText.trim())); b&&b.click(); });
await p.waitForTimeout(9000);
const st = await p.evaluate(() => ({
  body: document.body.innerText.replace(/\s+/g,' ').slice(0,300),
  btns: [...document.querySelectorAll('button,a')].filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean).slice(0,8),
}));
console.log(JSON.stringify(st, null, 1));

// Download the generated profile
const [dl] = await Promise.all([
  p.waitForEvent('download', { timeout: 60000 }).catch(() => null),
  p.evaluate(() => { const b=[...document.querySelectorAll('button,a')].find(e=>/^download$/i.test(e.innerText.trim())); b&&b.click(); }),
]);
if (dl) {
  const dest = process.env.HOME + '/Downloads/clim_App_Store.mobileprovision';
  await dl.saveAs(dest);
  console.log("downloaded:", dest);
} else console.log("no download captured");
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/prof-generated.png' });
await b.close();
