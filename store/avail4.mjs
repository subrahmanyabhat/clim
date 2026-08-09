import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.locator('#SETUP_GRANULAR').check();
await p.waitForTimeout(3000);
const nxt = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].filter(e=>e.offsetParent&&!e.disabled)
    .find(e => /^(next|continue|done|save)$/i.test(e.innerText.trim()));
  if (!btn) return 'no button'; const l = btn.innerText.trim(); btn.click(); return l;
});
console.log("granular selected, clicked:", nxt);
await p.waitForTimeout(10000);
const info = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  const boxes = [...(d||document).querySelectorAll('input[type=checkbox]')].filter(e=>e.offsetParent);
  const fr = boxes.find(c => /france/i.test((c.closest('label,li,tr,div')?.innerText||'')));
  return { boxes: boxes.length, franceFound: !!fr, id: fr?.id, checked: fr?.checked };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/availability3.png' });
await b.close();
