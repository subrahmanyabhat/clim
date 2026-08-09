import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
await p.getByText('Set Up Availability', { exact: true }).first().click({ timeout: 20000 });
await p.waitForTimeout(10000);
const info = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  const scope = d || document;
  const boxes = [...scope.querySelectorAll('input[type=checkbox]')].filter(e=>e.offsetParent);
  const france = boxes.find(c => /france/i.test(c.closest('label,li,tr,div')?.innerText||''));
  return {
    dialog: !!d,
    totalCheckboxes: boxes.length,
    franceFound: !!france,
    franceId: france?.id || france?.name || null,
    franceChecked: france?.checked,
    text: (d?d.innerText:'').replace(/\s+/g,' ').slice(0,200),
  };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/availability.png' });
await b.close();
