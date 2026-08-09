import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.locator('#privacyPolicyUrl').fill('https://getclim.netlify.app/privacy.html');
await p.waitForTimeout(1500);
console.log("url:", await p.evaluate(() => document.querySelector('#privacyPolicyUrl')?.value));
await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]') || document;
  const s = [...d.querySelectorAll('button')].filter(e=>e.offsetParent).find(e => /^save$/i.test(e.innerText.trim()));
  s && s.click();
});
await p.waitForTimeout(9000);
const after = await p.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g,' ');
  const i = t.search(/privacy policy url/i);
  return i>=0 ? t.slice(i, i+140) : t.slice(0,140);
});
console.log("after:", after);
await b.close();
