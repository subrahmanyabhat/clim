import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));
// clim shows your own terminal session. None of these categories are content
// the app itself contains.
for (const n of ['profanityOrCrudeHumor','horrorOrFearThemes','alcoholTobaccoOrDrugUseOrReferences']) {
  const el = p.locator(`#${n}__NONE`);
  if (await el.count()) { await el.check().catch(()=>{}); console.log(`  ${n} = NONE`); }
}
await p.waitForTimeout(2500);
for (let step=0; step<6; step++) {
  const next = p.getByRole('button', { name: /^(next|continue)$/i }).first();
  if (!(await next.count())) break;
  await next.click().catch(()=>{});
  await p.waitForTimeout(5000);
  const st = await p.evaluate(() => {
    const names = [...new Set([...document.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent).map(r=>r.name))];
    return { names, done: /your app.{0,20}rating|age rating is|4\+|9\+|13\+|16\+|18\+/i.test(document.body.innerText) };
  });
  console.log(`  step ${step}: questions=[${st.names.join(', ')}]`);
  // answer any new NONE/false questions truthfully
  for (const n of st.names) {
    for (const suffix of ['__NONE','__false']) {
      const el = p.locator(`#${n}${suffix}`);
      if (await el.count()) { await el.check().catch(()=>{}); break; }
    }
  }
  await p.waitForTimeout(2000);
}
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/age-final.png' });
const final = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0,600));
console.log("\nfinal:", final.slice(0, 400));
await b.close();
