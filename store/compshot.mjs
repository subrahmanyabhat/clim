import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
const d = p.locator('[role=dialog]').first();
await d.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-visual.png' }).catch(async()=>{
  await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-visual.png' });
});
console.log("captured");
await b.close();
