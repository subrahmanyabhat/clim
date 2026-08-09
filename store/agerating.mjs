import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.goto("https://appstoreconnect.apple.com/apps/6799607439/distribution/info", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
// Age rating lives on App Information behind an edit control
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
const i = t.search(/age rating/i);
console.log("context:", i>=0 ? t.slice(i, i+300) : "not found");
const edits = await p.evaluate(() =>
  [...document.querySelectorAll('button,a')].filter(e=>e.offsetParent && /edit|set up|age/i.test(e.innerText||e.getAttribute('aria-label')||''))
    .map(e => `"${(e.innerText||'').trim().slice(0,25)}" aria="${e.getAttribute('aria-label')||''}"`));
console.log("controls:", JSON.stringify(edits));
await b.close();
