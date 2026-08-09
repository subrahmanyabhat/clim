import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.evaluate(() => { const c=[...document.querySelectorAll('button')].find(e=>/^cancel$/i.test(e.innerText.trim())); c&&c.click(); });
await p.waitForTimeout(3000);
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/distribution/ios/version/inflight", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(13000);
const st = await p.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g,' ');
  return {
    version: (t.match(/iOS App Version ([\d.]+)/)||[])[1],
    status: (t.match(/(Prepare for Submission|Waiting for Review|Ready for Sale)/i)||[])[1],
    buildAttached: !/Add Build/i.test(t),
    screenshots: (t.match(/(\d+) of 10 Screenshots/)||[])[1],
    errors: /one or more errors/i.test(t),
    addForReview: [...document.querySelectorAll('button')].some(e=>/add for review/i.test(e.innerText)&&!e.disabled),
  };
});
console.log(JSON.stringify(st, null, 1));
await b.close();
