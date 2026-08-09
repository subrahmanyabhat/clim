import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/distribution/ios/version/inflight", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(13000);
const st = await p.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g,' ');
  const bi = t.search(/\bBuild\b/);
  return {
    buildSection: bi>=0 ? t.slice(bi, bi+150) : '',
    hasAddBuild: [...document.querySelectorAll('button')].some(e=>/^add build$/i.test(e.innerText.trim())),
    addForReviewEnabled: [...document.querySelectorAll('button')].some(e=>/add for review/i.test(e.innerText)&&!e.disabled),
    errors: /one or more errors/i.test(t),
  };
});
console.log(JSON.stringify(st, null, 1));
await b.close();
