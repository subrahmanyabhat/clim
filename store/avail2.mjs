import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
// Choose "Specific Countries or Regions" so France can be deselected.
await p.getByText('Specific Countries or Regions', { exact: false }).first().click({ timeout: 20000 });
await p.waitForTimeout(8000);
const info = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  const boxes = [...(d||document).querySelectorAll('input[type=checkbox]')].filter(e=>e.offsetParent);
  const fr = boxes.find(c => /^france$/i.test((c.closest('label,li,tr,div')?.innerText||'').trim()));
  return { boxes: boxes.length, franceFound: !!fr, id: fr?.id, checked: fr?.checked,
           sample: boxes.slice(0,3).map(c=>(c.closest('label,li,tr,div')?.innerText||'').trim().slice(0,20)) };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/availability2.png' });
await b.close();
