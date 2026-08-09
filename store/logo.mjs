import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://appstoreconnect.apple.com/apps", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(10000);
const info = await p.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find(e => /clim/i.test(e.getAttribute('aria-label')||''));
  const img = a ? a.querySelector('img') : null;
  return {
    found: !!a,
    icon: img ? (img.src||'').slice(0,90) : 'no <img> — placeholder tile',
    text: (document.body.innerText.match(/clim[^\n]{0,60}/i)||[])[0],
  };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/apps-icon.png' });
await b.close();
