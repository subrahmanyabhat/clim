import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
const saves = await p.getByText('Save', { exact: true }).count();
console.log("Save controls:", saves);
await p.getByText('Save', { exact: true }).nth(saves - 1).click({ timeout: 20000 }).catch(async (e) => {
  console.log("text click failed:", e.message.slice(0,60));
  await p.getByRole('button', { name: /^save$/i }).last().click({ force: true });
});
await p.waitForTimeout(11000);
const t = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  return d ? 'dialog still: ' + d.innerText.replace(/\s+/g,' ').slice(0,240)
           : 'closed | missing compliance: ' + /missing compliance/i.test(document.body.innerText);
});
console.log(t);
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-result.png' });
await b.close();
