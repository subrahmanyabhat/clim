import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
// The footer buttons live outside [role=dialog]; click by visible text anywhere.
const nx = p.getByText('Next', { exact: true }).last();
console.log("Next visible:", await nx.count());
await nx.click();
await p.waitForTimeout(8000);
const shot = process.env.HOME + '/Desktop/clim-asc-shots/compliance-step2.png';
await p.screenshot({ path: shot });
const t = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  return d ? d.innerText.replace(/\s+/g,' ').slice(0,500) : 'no dialog | missing=' + /missing compliance/i.test(document.body.innerText);
});
console.log("now:", t);
await b.close();
