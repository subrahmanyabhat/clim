import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
// index 23 is the Edit next to Privacy Policy
await p.evaluate(() => {
  const all = [...document.querySelectorAll('button,a')].filter(e=>e.offsetParent);
  const edit = all.filter(e => /^edit$/i.test(e.innerText.trim()))[0];
  edit && edit.click();
});
await p.waitForTimeout(7000);
const fields = await p.evaluate(() => ({
  inputs: [...document.querySelectorAll('input,textarea')].filter(e=>e.offsetParent).map(e=>`${e.tagName}[${e.type}] id=${e.id} name=${e.name} aria="${e.getAttribute('aria-label')||''}"`),
  dialog: !!document.querySelector('[role=dialog]'),
  tail: document.body.innerText.replace(/\s+/g,' ').slice(-260),
}));
console.log(JSON.stringify(fields, null, 1));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/privacy-edit2.png' });
await b.close();
